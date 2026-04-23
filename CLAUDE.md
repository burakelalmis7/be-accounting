# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page, zero-dependency accounting application for **BE-Coding s.r.o.** (a Slovak IT company). It runs entirely in the browser with no build step, no package manager, and no server. All data lives in `localStorage` under the key `becoding_v1`.

Open `becoding-buchhaltung.html` directly in a browser to run the app. There is no dev server, no `npm install`, no compilation.

## Script loading order (matters — all globals)

Scripts are loaded in dependency order in the HTML:

1. `js/config.js` — constants and defaults (`SCHEMA_VERSION`, `DEFAULT_VAT_RATES`, `CIT_RULES_BY_YEAR`, `MIN_TAX_RULES_BY_YEAR`, `FTT_RULES`, etc.)
2. `js/state.js` — `State` IIFE (load/get/set/save/reset/exportJSON/importJSON)
3. `js/ui-helper.js` — global utility functions (`uid`, `fmtMoney`, `esc`, `escAttr`, `showToast`, `openModal`, `closeModal`, `confirm`, etc.)
4. `js/tax-service.js` — `Tax` IIFE (vatSummary, citEstimate, fttSummary, assetDepreciation, etc.)
5. `js/validation-service.js` — `Validate` IIFE (transaction, invoice, asset)
6. `js/invoice-service.js` — global functions (`normalizeInvoice`, `syncIssuedInvoicesToIncomeTransactions`, `generateInvoiceDocument`, etc.)
7. `js/invoice-scan-service.js` — `window.InvoiceScan` (lazy-loads PDF.js and Tesseract.js from CDN on first use)
8. `js/page-service.js` — `Pages` object + `UI` IIFE
9. `js/init.js` — bootstrap: calls `State.load()`, wires nav clicks, calls `UI.render('dashboard')`

There is no module bundler. Every IIFE or `const` at the top level of a script file becomes a global. Inline `onclick` handlers in generated HTML call window-scoped functions directly (e.g. `window.saveTx`, `window.deleteInvoice`).

## Architecture

### State

`State` is a single IIFE exposing the full application state. On `State.load()`:
- Reads from `localStorage`; if empty, seeds demo data
- Runs `migrate()` which deep-merges persisted state with `empty()` defaults, normalising counterparties and invoices

`State.set(updater)` accepts either a function `(s) => { mutate s }` or a plain object, then auto-saves.

### Page rendering

`Pages` is a plain object where each key is a tab name (`dashboard`, `income`, `expenses`, `transactions`, `invoices`, `assets`, `dividends`, `counterparties`, `taxes`, `reports`, `settings`). Each value is a function returning an HTML string.

`UI.render(tab)` injects that HTML into `#content`. Action handlers (save, delete, open modal) must be attached to `window` so inline `onclick` attributes in generated HTML can reach them.

### Invoice ↔ Transaction sync

Issued invoices (`state.invoicesIssued`) are **authoritative for income**. `syncIssuedInvoicesToIncomeTransactions()` (called at startup and after import) upserts a corresponding income transaction for every issued invoice, linking them via `linkedTransactionId`. The income tab merges these synced rows with any manually-entered income transactions that have no linked invoice.

### Tax logic (Slovak s.r.o.)

All tax calculations are in `Tax` (`js/tax-service.js`):

- **CIT** (`citEstimate`): revenue-tiered rates (10/21/24%) defined per year in `CIT_RULES_BY_YEAR`. Uses `grossAmount` for deductible expenses. Managing-director loans are auto-detected and forced non-deductible.
- **VAT** (`vatSummary`): separates output VAT (domestic taxable income), input VAT (domestic taxable expense), and EU B2B reverse-charge base. Filterable by year and quarter.
- **FTT/DzFT** (`fttSummary`): Slovak financial transaction tax effective 2025-04-01. Outgoing transactions default to taxable debit (0.4%, capped at €40/tx) unless explicitly flagged via `fttType` (`exempt`, `internal`, `card`, `cash`, `debit`).
- **Minimum tax** (`getMinTaxRulesForYear`): floor tax that applies when CIT estimate is lower, tiered by revenue band.

Tax rules for future years can be added to `CIT_RULES_BY_YEAR` and `MIN_TAX_RULES_BY_YEAR` in `config.js`. Per-year overrides can also be stored in `state.settings.citRulesByYear[year]`.

### Data model key fields

**Transaction**: `{ id, date, type ('income'|'expense'), category, description, counterpartyId, netAmount, vatRate, vatAmount, grossAmount, vatTreatment, paymentStatus, invoiceRef, deductible, fttType, attachments[], currency }`

**Invoice (issued/received)**: `{ id, number, invoiceType, issueDate, dueDate, lineItems[], subtotalNet, totalVat, totalGross, vatTreatment, reverseCharge, senderSnapshot{}, recipientSnapshot{}, linkedTransactionId, status, documentMeta{} }`

**`vatTreatment`** codes (defined in `VAT_TREATMENTS` in `config.js`): `domestic_taxable_income`, `domestic_taxable_expense`, `vat_exempt`, `non_vat`, `eu_b2b_rc_income`, `eu_b2b_rc_expense`, `third_country_income`, `third_country_expense`, `non_deductible_vat`, `partially_deductible`.

### HTML/CSS conventions

- CSS custom properties are defined on `:root` in `app.css` (colours like `--green`, `--red`, `--yellow`, `--blue`, `--border`, `--surface`, `--text`, `--text2`)
- XSS safety: all user-supplied strings rendered into HTML must go through `esc()` (for text content) or `escAttr()` (for attribute values) from `ui-helper.js`
- Money amounts must be rounded with `moneyRound()` before storage to avoid floating-point drift; display with `fmtMoney()`
- The UI language is **German** — all labels, messages, and toasts are in German

## Adding a new page / tab

1. Add a `Pages.mypage = function(opts) { return '<html>…'; }` in `page-service.js`
2. Add its title to the `TITLES` map in the `UI` IIFE
3. Add a `<div class="nav-item" data-tab="mypage">` in `becoding-buchhaltung.html`
4. Expose any action handlers on `window`

## Data persistence & export

- `State.exportJSON()` downloads the full state as a timestamped `.json` file (attachments embedded as base64 data URLs)
- `State.importJSON(jsonString)` replaces state and runs migration
- `exportCSV()` / `exportTaxCSV()` export transaction data / tax summary for the active accounting year
