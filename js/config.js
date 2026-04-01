// ============================================================
// MODUL: SCHEMA & STANDARDWERTE
// ============================================================
const SCHEMA_VERSION = '1.2.0';

const DEFAULT_VAT_RATES = [
  { id: 'vat23', label: '23% Standard',   rate: 0.23, active: true },
  { id: 'vat19', label: '19% Ermäßigt',   rate: 0.19, active: true },
  { id: 'vat5',  label: '5% Ermäßigt',    rate: 0.05, active: true },
  { id: 'vat0',  label: '0% (ohne USt.)', rate: 0.00, active: true },
];

const VAT_TREATMENTS = [
  { code: 'domestic_taxable_income',    label: 'Inländische steuerpflichtige Einnahme',      direction: 'income' },
  { code: 'domestic_taxable_expense',   label: 'Inländische steuerpflichtige Ausgabe',        direction: 'expense' },
  { code: 'vat_exempt',                 label: 'Steuerbefreit',                               direction: 'both' },
  { code: 'non_vat',                    label: 'Ohne USt. (außerhalb des Geltungsbereichs)',  direction: 'both' },
  { code: 'eu_b2b_rc_income',           label: 'EU B2B Reverse Charge – Einnahme',           direction: 'income' },
  { code: 'eu_b2b_rc_expense',          label: 'EU B2B Reverse Charge – Ausgabe',            direction: 'expense' },
  { code: 'third_country_income',       label: 'Drittland – Einnahme',                       direction: 'income' },
  { code: 'third_country_expense',      label: 'Drittland – Ausgabe',                        direction: 'expense' },
  { code: 'non_deductible_vat',         label: 'Nicht abzugsfähige Vorsteuer',               direction: 'expense' },
  { code: 'partially_deductible',       label: 'Teilweise abzugsfähige Vorsteuer*',          direction: 'expense', configurable: true },
];

const EXPENSE_CATEGORIES = [
  'Software & Lizenzen','Hardware & IT-Ausstattung','Büromiete','Telekommunikation',
  'Reise & Transport','Marketing & Werbung','Rechts- & Buchhaltungskosten','Subunternehmer',
  'Löhne & Sozialabgaben','Weiterbildung','Bankgebühren','Versicherung','Repräsentation','Sonstiges'
];

const INCOME_CATEGORIES = [
  'IT-Beratung','Softwareentwicklung','Lizenzen','Support & Wartung','Schulung','Sonstiges'
];

const DEFAULT_CIT_RULES = [
  { id: 'cit10', label: '10% (Einnahmen ≤ 100.000 EUR)', rate: 0.10, revenueUpTo: 100000 },
  { id: 'cit21', label: '21% (Einnahmen 100.001–5.000.000 EUR)', rate: 0.21, revenueUpTo: 5000000 },
  { id: 'cit24', label: '24% (Einnahmen > 5.000.000 EUR)', rate: 0.24, revenueUpTo: Infinity },
];

const DEFAULT_MIN_TAX = [
  { id: 'mt1', label: '340 EUR (Einnahmen ≤ 50.000)', revenueUpTo: 50000, amount: 340 },
  { id: 'mt2', label: '960 EUR (Einnahmen ≤ 250.000)', revenueUpTo: 250000, amount: 960 },
  { id: 'mt3', label: '1.920 EUR (Einnahmen ≤ 500.000)', revenueUpTo: 500000, amount: 1920 },
  { id: 'mt4', label: '3.840 EUR (Einnahmen > 500.000)', revenueUpTo: Infinity, amount: 3840 },
];

const FTT_RULES = {
  effectiveFrom: '2025-04-01',
  debitRate: 0.004,
  cashRate: 0.008,
  debitCapPerTx: 40,
  cashCapPerTx: null,
  cardAnnualFee: 2,
  businessCardCount: 0,
};

const DIVIDEND_DEFAULT_WHT = 0.10; // 10% – KONFIGURIERBAR


function defaultInvoiceSettings() {
  return {
    prefix: '',
    nextNumber: 1,
    resetYearly: false,
    dueDays: 15,
    defaultUnit: 'h',
    standardGreeting: 'Sehr geehrte Damen und Herren,',
    standardIntroText: 'vielen Dank für Ihr Vertrauen in meine Dienstleistung. Ich stelle Ihnen hiermit folgende Leistungen in Rechnung:',
    standardPaymentTerms: 'Zahlung innerhalb von 15 Tagen ab Rechnungseingang ohne Abzüge.',
    standardReverseChargeNote: 'Die Rechnungsausweis erfolgt ohne Umsatzsteuer, da die Steuerschuldnerschaft des Leistungsempfängers greift (Reverse-Charge-Verfahren).',
    standardVatNote: 'Es gilt die gesetzliche Umsatzsteuer.',
    standardClosingText: 'Mit freundlichen Grüßen',
    signatureName: 'Burak Elalmis',
    footerExtra: '',
    numberingFormat: 'plain',
  };
}

