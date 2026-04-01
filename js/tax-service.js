// ============================================================
// MODUL: STEUERLOGIK
// ============================================================
const Tax = (() => {
  function vatSummary(transactions, year, quarter) {
    let outputVat = 0, inputVat = 0, rcBase = 0;
    const filtered = transactions.filter(t => {
      if (!t.date) return false;
      const yr = t.date.slice(0,4); const q = Math.ceil(parseInt(t.date.slice(5,7))/3);
      if (year && yr !== String(year)) return false;
      if (quarter && q !== quarter) return false;
      return true;
    });
    for (const t of filtered) {
      if (t.type === 'income' && t.vatTreatment === 'domestic_taxable_income') outputVat += (t.vatAmount || 0);
      if (t.type === 'expense' && ['domestic_taxable_expense'].includes(t.vatTreatment)) inputVat += (t.vatAmount || 0);
      if (['eu_b2b_rc_expense','eu_b2b_rc_income'].includes(t.vatTreatment)) rcBase += (t.netAmount || 0);
    }
    return { outputVat, inputVat, balance: outputVat - inputVat, rcBase };
  }

  function citEstimate(transactions, year) {
    const state = State.get();
    const txYear = transactions.filter(t => t.date && t.date.startsWith(String(year)));
    const revenue = txYear.filter(t=>t.type==='income').reduce((s,t)=>s+(t.netAmount||0),0);
    const expenses = txYear.filter(t=>t.type==='expense'&&t.deductible!==false).reduce((s,t)=>s+(t.grossAmount||0),0);
    const profit = revenue - expenses;
    const taxBase = Math.max(0, profit);
    const rules = state.settings.citRules || DEFAULT_CIT_RULES;
    let rate = 0.21;
    for (const r of rules) { if (revenue <= r.revenueUpTo) { rate = r.rate; break; } }
    const citEstimated = taxBase * rate;
    const minRules = state.settings.minTaxRules || DEFAULT_MIN_TAX;
    let minTax = 340;
    for (const r of minRules) { if (revenue <= r.revenueUpTo) { minTax = r.amount; break; } }
    const taxPayable = Math.max(citEstimated, minTax);
    return { revenue, expenses, profit, taxBase, rate, citEstimated, minTax, taxPayable };
  }

  function classifyFttTransaction(t, rules) {
    if (!t?.date || !rules) return { bucket: 'ignored', taxableAmount: 0, tax: 0, label: 'Nicht berücksichtigt' };
    if (rules.effectiveFrom && t.date < rules.effectiveFrom) return { bucket: 'ignored', taxableAmount: 0, tax: 0, label: 'Vor Wirksamkeit' };
    const amount = Math.abs(parseFloat(t.grossAmount || 0));
    if (!amount) return { bucket: 'ignored', taxableAmount: 0, tax: 0, label: 'Ohne Betrag' };

    if (t.fttType === 'exempt') return { bucket: 'exempt', taxableAmount: 0, tax: 0, label: 'Befreit' };
    if (t.fttType === 'internal') return { bucket: 'internal', taxableAmount: 0, tax: 0, label: 'Interne Überweisung' };
    if (t.fttType === 'card') return { bucket: 'card', taxableAmount: 0, tax: 0, label: 'Kartenzahlung / Jahresgebühr separat' };

    if (t.fttType === 'cash') {
      const tax = moneyRound(amount * (rules.cashRate || 0));
      return { bucket: 'cash', taxableAmount: amount, tax, label: 'Barabhebung' };
    }

    const isOutgoing = t.type === 'expense';
    const shouldTaxAsDebit = t.fttType === 'debit' || (!t.fttType && isOutgoing);
    if (shouldTaxAsDebit) {
      const cap = rules.debitCapPerTx == null ? Infinity : rules.debitCapPerTx;
      const tax = moneyRound(Math.min(amount * (rules.debitRate || 0), cap));
      return { bucket: t.fttType === 'debit' ? 'debit_manual' : 'debit_auto', taxableAmount: amount, tax, label: t.fttType === 'debit' ? 'Belastung manuell' : 'Belastung automatisch' };
    }

    return { bucket: 'ignored', taxableAmount: 0, tax: 0, label: 'Nicht steuerpflichtig' };
  }

  function fttSummary(transactions, year) {
    const rules = { ...FTT_RULES, ...(State.get().settings.fttRules || {}) };
    const txYear = transactions.filter(t=>t.date&&t.date.startsWith(String(year)));
    let debitTax = 0, cashTax = 0, autoDebitTax = 0, manualDebitTax = 0;
    let taxableDebitBase = 0, taxableCashBase = 0;
    let exemptCount = 0, internalCount = 0, ignoredCount = 0;

    const details = txYear.map(t => {
      const item = classifyFttTransaction(t, rules);
      if (item.bucket === 'debit_auto' || item.bucket === 'debit_manual') {
        debitTax += item.tax;
        taxableDebitBase += item.taxableAmount;
        if (item.bucket === 'debit_auto') autoDebitTax += item.tax;
        else manualDebitTax += item.tax;
      } else if (item.bucket === 'cash') {
        cashTax += item.tax;
        taxableCashBase += item.taxableAmount;
      } else if (item.bucket === 'exempt') exemptCount += 1;
      else if (item.bucket === 'internal') internalCount += 1;
      else ignoredCount += 1;
      return { ...t, fttComputed: item };
    });

    const cardFee = moneyRound((parseInt(rules.businessCardCount || 0, 10) || 0) * (rules.cardAnnualFee || 0));
    return {
      rules,
      details,
      debitTax: moneyRound(debitTax),
      cashTax: moneyRound(cashTax),
      autoDebitTax: moneyRound(autoDebitTax),
      manualDebitTax: moneyRound(manualDebitTax),
      taxableDebitBase: moneyRound(taxableDebitBase),
      taxableCashBase: moneyRound(taxableCashBase),
      cardFee,
      exemptCount,
      internalCount,
      ignoredCount,
      total: moneyRound(debitTax + cashTax + cardFee)
    };
  }

  function calcVatAmounts(net, rate) {
    const vat = Math.round(net * rate * 100) / 100;
    return { netAmount: net, vatRate: rate, vatAmount: vat, grossAmount: net + vat };
  }

  function assetDepreciation(asset) {
    const cost = asset.acquisitionCost || 0;
    const years = asset.depreciationYears || 1;
    return { annual: cost / years, monthly: cost / years / 12, totalYears: years };
  }

  return { vatSummary, citEstimate, fttSummary, classifyFttTransaction, calcVatAmounts, assetDepreciation };
})();

