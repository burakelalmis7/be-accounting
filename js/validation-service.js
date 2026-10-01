// ============================================================
// MODUL: VALIDIERUNG
// ============================================================
const Validate = (() => {
  function transaction(t) {
    const errors = [];
    if (!t.date) errors.push('Datum ist erforderlich');
    if (!t.type) errors.push('Buchungstyp ist erforderlich');
    if (!t.description || !t.description.trim()) errors.push('Beschreibung ist erforderlich');
    if (!t.netAmount || isNaN(t.netAmount) || t.netAmount <= 0) errors.push('Betrag muss eine positive Zahl sein');
    if (!t.vatTreatment) errors.push('Steuerliche Einordnung ist erforderlich');
    if (!t.category) errors.push('Kategorie ist erforderlich');
    if (t.vatRate > 0) {
      const expectedVat = Math.round(t.netAmount * t.vatRate * 100) / 100;
      if (Math.abs((t.vatAmount||0) - expectedVat) > 0.02) errors.push('USt.-Betrag stimmt nicht mit dem Steuersatz überein');
    }
    return errors;
  }

  function invoice(inv) {
    const errors = [];
    if ((!inv.number || !String(inv.number).trim()) && !inv.deferNumber) errors.push('Rechnungsnummer ist erforderlich');
    if (!inv.counterpartyId) errors.push('Geschäftspartner ist erforderlich');
    if (!inv.recipientSnapshot?.customerName) errors.push('Empfängername fehlt');
    if (!inv.recipientSnapshot?.addressLine1) errors.push('Empfängeradresse fehlt');
    if (!inv.issueDate) errors.push('Ausstellungsdatum ist erforderlich');
    if (!inv.dueDate) errors.push('Fälligkeitsdatum ist erforderlich');
    const lines = inv.lineItems || [];
    if (!lines.length) errors.push('Mindestens eine Rechnungsposition ist erforderlich');
    lines.forEach((line, idx) => {
      if (!line.description || !String(line.description).trim()) errors.push(`Beschreibung in Position ${idx+1} fehlt`);
      if (!(parseFloat(line.quantity) > 0)) errors.push(`Menge in Position ${idx+1} muss größer als 0 sein`);
      if (!(parseFloat(line.unitPrice) >= 0)) errors.push(`Einheitspreis in Position ${idx+1} ist ungültig`);
    });
    if (Math.abs(moneyRound((inv.subtotalNet||0) + (inv.totalVat||0)) - moneyRound(inv.totalGross||0)) > 0.02) errors.push('Summen der Rechnung sind inkonsistent');
    if (inv.reverseCharge && Math.abs(inv.totalVat || 0) > 0.02) errors.push('Reverse-Charge-Rechnungen dürfen keine USt. ausweisen');
    return errors;
  }

  function asset(a) {
    const errors = [];
    if (!a.name || !a.name.trim()) errors.push('Bezeichnung des Wirtschaftsguts ist erforderlich');
    if (!a.purchaseDate) errors.push('Anschaffungsdatum ist erforderlich');
    if (!a.acquisitionCost || isNaN(a.acquisitionCost) || a.acquisitionCost <= 0) errors.push('Anschaffungskosten sind erforderlich');
    if (!a.depreciationYears || a.depreciationYears < 1) errors.push('Nutzungsdauer muss mindestens 1 Jahr betragen');
    return errors;
  }

  return { transaction, invoice, asset };
})();
