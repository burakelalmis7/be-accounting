// ============================================================
// MODUL: RECHNUNGSSCAN (PDF.js + Tesseract.js)
// Lädt Bibliotheken lazy, erst beim ersten Scan-Aufruf.
// ============================================================

window.InvoiceScan = (function () {

  // ── Bibliotheken lazy laden ──────────────────────────────
  async function loadScript(src) {
    if (document.querySelector(`script[src="${src}"]`)) {
      // Bereits im DOM – warten bis geladen
      await new Promise(resolve => {
        const check = () => {
          const s = document.querySelector(`script[src="${src}"]`);
          if (s && s.dataset.loaded) resolve();
          else setTimeout(check, 50);
        };
        check();
      });
      return;
    }
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => { s.dataset.loaded = '1'; resolve(); };
      s.onerror = () => reject(new Error(`Konnte ${src} nicht laden`));
      document.head.appendChild(s);
    });
  }

  async function loadPdfJs() {
    if (window.pdfjsLib) return;
    await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  }

  async function loadTesseract() {
    if (window.Tesseract) return;
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js');
  }

  // ── Textextraktion ───────────────────────────────────────
  async function extractTextFromPdf(file) {
    await loadPdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      // Items mit Y-Position gruppieren damit Zeilenumbrüche erhalten bleiben
      const lines = {};
      content.items.forEach(item => {
        const y = Math.round(item.transform[5]);
        lines[y] = (lines[y] || '') + item.str + ' ';
      });
      Object.keys(lines).sort((a, b) => b - a).forEach(y => {
        fullText += lines[y].trim() + '\n';
      });
    }
    return fullText;
  }

  async function extractTextFromImage(file, onProgress) {
    await loadTesseract();
    const worker = await Tesseract.createWorker(['deu', 'eng'], 1, {
      logger: m => {
        if (onProgress && m.status === 'recognizing text') {
          onProgress(Math.round(m.progress * 100));
        }
      }
    });
    const url = URL.createObjectURL(file);
    try {
      const { data: { text } } = await worker.recognize(url);
      return text;
    } finally {
      await worker.terminate();
      URL.revokeObjectURL(url);
    }
  }

  // ── Zahlenparser für deutsches Format ────────────────────
  // "1.234,56" → 1234.56 · "1234,56" → 1234.56 · "1234.56" → 1234.56
  function parseAmount(str) {
    if (!str) return null;
    str = str.trim().replace(/\s/g, '').replace(/€/g, '');
    if (!str) return null;
    const hasDot = str.includes('.');
    const hasComma = str.includes(',');
    let normalized;
    if (hasDot && hasComma) {
      // letztes Trennzeichen ist Dezimaltrenner
      const lastDot = str.lastIndexOf('.');
      const lastComma = str.lastIndexOf(',');
      if (lastComma > lastDot) {
        // "1.234,56" → German
        normalized = str.replace(/\./g, '').replace(',', '.');
      } else {
        // "1,234.56" → English
        normalized = str.replace(/,/g, '');
      }
    } else if (hasComma && !hasDot) {
      // "1234,56" oder "1.234" – Komma als Dezimal
      normalized = str.replace(',', '.');
    } else {
      normalized = str;
    }
    const n = parseFloat(normalized);
    return isNaN(n) ? null : Math.round(n * 100) / 100;
  }

  // ── Text-Parser ──────────────────────────────────────────
  function parseInvoiceText(text) {
    const result = {};

    // 1. Datum
    // Priorität: Schlüsselwort + numerisches Datum (DE/SK/etc: DD.MM.YYYY)
    const dateLabelPat = /(?:Rechnungs-?datum|Ausstellungsdatum|Belegdatum|D[áa]tum\s+vyhotovenia|D[áa]tum\s+vystavenia|Date\s*of\s*issue|Invoice\s*Date|Issued?(?:\s*on)?|Date)[:\s]+(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})/i;
    // Fallback: ISO-Format YYYY-MM-DD
    const dateIsoPat = /\b(\d{4})-(\d{2})-(\d{2})\b/;
    // Fallback: erstes DD.MM.YYYY im Text
    const dateDePat = /\b(\d{1,2})[.](\d{1,2})[.](\d{4})\b/;

    // Monatsnamen verschiedener europäischer Sprachen — internationale
    // Anbieter (Cloudflare, AWS, Google, Stripe …) schreiben das Datum oft
    // als "May 22, 2026" oder "22 mai 2026" statt numerisch.
    const MONTHS = {
      jan:1, january:1, januar:1, janvier:1, enero:1, gennaio:1, januára:1, januar1:1,
      feb:2, february:2, februar:2, février:2, fevrier:2, febrero:2, febbraio:2,
      mar:3, march:3, märz:3, marz:3, mars:3, marzo:3,
      apr:4, april:4, avril:4, abril:4, aprile:4,
      may:5, mai:5, mei:5, mayo:5, maggio:5,
      jun:6, june:6, juni:6, juin:6, junio:6, giugno:6,
      jul:7, july:7, juli:7, juillet:7, julio:7, luglio:7,
      aug:8, august:8, augustus:8, août:8, aout:8, agosto:8,
      sep:9, sept:9, september:9, septembre:9, septiembre:9, settembre:9,
      oct:10, october:10, oktober:10, octobre:10, octubre:10, ottobre:10,
      nov:11, november:11, novembre:11, noviembre:11,
      dec:12, december:12, dezember:12, décembre:12, decembre:12, diciembre:12, dicembre:12,
    };
    const monthNum = name => MONTHS[name.toLowerCase().replace(/[.,]/g, '')] || null;
    // "May 22, 2026" / "May 22 2026"
    const monthDayYearPat = /\b([A-Za-zÀ-ÿ]{3,12})\.?\s+(\d{1,2}),?\s+(\d{4})\b/;
    // "22 May 2026" / "22. Mai 2026" / "22 de mayo de 2026"
    const dayMonthYearPat = /\b(\d{1,2})\.?\s+(?:de\s+|of\s+)?([A-Za-zÀ-ÿ]{3,12})\.?\s+(?:de\s+)?(\d{4})\b/;

    let dm = text.match(dateLabelPat);
    if (dm) {
      const d = dm[1].padStart(2,'0'), mo = dm[2].padStart(2,'0');
      let y = dm[3]; if (y.length === 2) y = '20' + y;
      result.date = `${y}-${mo}-${d}`;
    } else {
      dm = text.match(dateIsoPat);
      if (dm) result.date = `${dm[1]}-${dm[2]}-${dm[3]}`;
      else {
        dm = text.match(dateDePat);
        if (dm) {
          const d = dm[1].padStart(2,'0'), mo = dm[2].padStart(2,'0'), y = dm[3];
          result.date = `${y}-${mo}-${d}`;
        } else {
          dm = text.match(monthDayYearPat);
          let mo = dm ? monthNum(dm[1]) : null;
          if (dm && mo) {
            result.date = `${dm[3]}-${String(mo).padStart(2,'0')}-${dm[2].padStart(2,'0')}`;
          } else {
            dm = text.match(dayMonthYearPat);
            mo = dm ? monthNum(dm[2]) : null;
            if (dm && mo) {
              result.date = `${dm[3]}-${String(mo).padStart(2,'0')}-${dm[1].padStart(2,'0')}`;
            }
          }
        }
      }
    }

    // 2. Belegnummer — mehrere Kandidaten prüfen und reine Datumswerte
    // verwerfen (bei spaltenbasiertem Layout landet sonst leicht das
    // "Rechnungsdatum" als Belegnummer, weil Label und Wert beim
    // Text-Extrahieren auseinandergerissen werden)
    const refPat = /(?:Rechnungs-?(?:nummer|nr\.?|no\.?)|Rechnung\s+Nr\.?|Invoice\s*(?:No\.?|Nr\.?|Number|#)|Beleg-?(?:nr\.?|nummer|No\.?))[:\s#]*([A-Z0-9][A-Z0-9\-\.\/]{1,30})/gi;
    const looksLikeDate = s => /^\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4}$/.test(s);
    let refM;
    while ((refM = refPat.exec(text)) !== null) {
      const candidate = refM[1].trim();
      if (!looksLikeDate(candidate)) {
        result.invoiceRef = candidate;
        break;
      }
    }
    // Fallback: bei mehrspaltigem Layout kann das Label weit vom Wert
    // entfernt landen (Label- und Wertespalten werden nacheinander
    // ausgelesen) — dann nach einem typischen Belegnummern-Muster suchen
    // ("2026-006", "RE-2026-001" …), das selbst keine Datumsform hat.
    if (!result.invoiceRef) {
      const genericRefM = text.match(/\b(?:[A-Z]{2,5}-)?\d{4}-\d{2,6}\b/);
      if (genericRefM && !looksLikeDate(genericRefM[0])) result.invoiceRef = genericRefM[0];
    }

    // 3. Beträge – mehrere Kandidaten sammeln und gegeneinander prüfen
    // (statt "erster Treffer gewinnt", was bei mehrspaltigen/Posten-Listen
    // leicht den falschen Betrag trifft)
    const AMT = '([0-9]{1,3}(?:[.\\s]?[0-9]{3})*(?:[,\\.][0-9]{1,2})?)';
    // Währungssymbol kann vor ODER nach dem Betrag stehen ("$10.46" vs. "10,46 €") —
    // internationale Anbieter (Cloudflare, AWS, Stripe …) stellen es meist voran.
    const CUR_PRE = '(?:[$€£]\\s*)?';
    const CUR_SUF = '\\s*(?:[$€£]|USD|EUR|GBP|CHF)?';

    function collectCandidates(pattern) {
      const re = new RegExp(pattern, 'gi');
      const out = [];
      let m;
      while ((m = re.exec(text)) !== null) {
        const amt = parseAmount(m[1]);
        if (amt != null) out.push(amt);
      }
      return out;
    }

    // Brutto / Gesamt — DE/SK-Format ("Gesamtzahlungsbetrag", numiron.sk) sowie
    // englische internationale Anbieter ("Total", "Amount due", "Balance due").
    // Wichtig: das Suffix bei "Gesamt…" (betrag/summe) ist absichtlich NICHT
    // optional — sonst matcht ein bloßer Tabellen-Spaltenkopf "Gesamt" und
    // greift z.B. die Positionsnummer als Betrag ab.
    const grossCandidates = collectCandidates(
      '(?:Gesamt(?:zahlungs)?(?:betrag|summe)|Brutto(?:betrag)?|Rechnungsbetrag|' +
      '(?<![\\wÀ-ÿ-])Total(?:\\s*Amount)?(?:\\s*Due)?\\b|Amount\\s*Due|Balance\\s*Due|Total\\s*Due|Grand\\s*Total|' +
      'Zu(?:\\s+)zahlen(?:der)?(?:\\s+Betrag)?|Zahlbetrag|Endbetrag|Fälliger Betrag|' +
      // Slowakisch: "Suma na úhradu" (Betrag fällig), "Celková (...) suma", "K úhrade"
      'Suma\\s+na\\s+úhradu|Celkov[áa](?:\\s+\\S+)?\\s+suma|K\\s+úhrade)' +
      '[:\\s]*' + CUR_PRE + AMT + CUR_SUF
    );

    // Netto — inkl. "MwSt.-Grundlage" (numiron.sk / SK-Format), engl. "Subtotal"
    // sowie slowakisch "Základ (DPH)" (Bemessungsgrundlage = Nettobetrag)
    const netCandidates = collectCandidates(
      '(?:Netto(?:betrag|summe|-Summe)?|Summe\\s*Netto|Net(?:\\s*Amount)?|Betrag\\s*netto|Sub-?total|' +
      'MwSt\\.?-?Grundlage(?:[^0-9]*\\d+\\s*%)?|Z[áa]klad(?:\\s*DPH)?)' +
      '[:\\s]*' + CUR_PRE + AMT + CUR_SUF
    );

    // MwSt-Satz (Zahl%) — inkl. slowakisch "DPH"
    const vatRatePat = /(?:MwSt\.?|USt\.?|Mehrwertsteuer|VAT|Tax|DPH)[^0-9%]*(\d+(?:[.,]\d+)?)\s*%/i;
    const vatRateM = text.match(vatRatePat);
    if (vatRateM) result.vatRate = parseFloat(vatRateM[1].replace(',', '.')) / 100;

    // MwSt-Betrag — SK-Format "Ust 23% 68,43" zuerst prüfen, damit
    // "MwSt.-Grundlage" (Netto-Zeile) nicht fälschlich als Betrag gilt
    const vatAmtCandidates = [
      ...collectCandidates('\\bUst\\s+\\d+\\s*%[:\\s]*' + CUR_PRE + AMT + CUR_SUF),
      ...collectCandidates('(?:MwSt\\.?|Mehrwertsteuer|VAT|Tax)(?![-\\s]*Grundlage)[^0-9%]*\\d+\\s*%[:\\s]*' + CUR_PRE + AMT + CUR_SUF),
    ];

    // Beste Kombination suchen: Netto + MwSt ≈ Brutto (Plausibilitätsprüfung).
    // Findet sie eine stimmige Dreierkombination, wird diese statt dem
    // jeweils ersten Treffer verwendet — robuster gegen Posten-/Zwischensummen.
    let bestCombo = null;
    for (const g of grossCandidates.slice(0, 5)) {
      for (const n of netCandidates.slice(0, 5)) {
        for (const v of vatAmtCandidates.slice(0, 5)) {
          if (Math.abs(n + v - g) < 0.02) { bestCombo = { g, n, v }; break; }
        }
        if (bestCombo) break;
      }
      if (bestCombo) break;
    }

    if (bestCombo) {
      result.grossAmount = bestCombo.g;
      result.netAmount = bestCombo.n;
      result.vatAmount = bestCombo.v;
    } else {
      if (grossCandidates.length) result.grossAmount = grossCandidates[0];
      if (netCandidates.length) result.netAmount = netCandidates[0];
      if (vatAmtCandidates.length) result.vatAmount = vatAmtCandidates[0];
    }

    // 3b. Lieferant / Aussteller — meist im Briefkopf, oft mit Rechtsform.
    // Wichtig: das eigene Unternehmen (als Rechnungsempfänger im Dokument
    // genannt, z.B. "ADRESÁT BE-Coding s.r.o.") muss ausgeschlossen werden —
    // sonst greift die Suffix-Regex die eigene Firma statt des Lieferanten.
    const ownCompanyName = (typeof State !== 'undefined' && State.get().company && State.get().company.name) || '';
    const coreName = n => n.toLowerCase().replace(/[.,]/g, '')
      .replace(/\b(gmbh|ag|kg|og|e\s*u|s\s*r\s*o|a\s*s|ltd|inc|llc|co|gbr|ug|spol\s*s\s*r\s*o)\b/gi, '')
      .trim();
    const ownCore = ownCompanyName ? coreName(ownCompanyName) : '';
    const isOwnCompany = name => ownCore && coreName(name) === ownCore;

    // Freiberufler/Einzelpersonen ohne Rechtsform-Zusatz (z.B. "Hakan Solmaz"):
    // Name steht häufig nach der Grußformel ("Freundliche Grüße / Mit freundlichen
    // Grüßen / Best regards") oder als erste Briefkopf-Zeile ("Name | Adresse").
    const NAME = '[A-ZÀ-Ý][\\wäöüÄÖÜßÀ-ÿ\'\\-]+(?:\\s+[A-ZÀ-Ý][\\wäöüÄÖÜßÀ-ÿ\'\\-]+){1,3}';

    const vendorPat = /^(?!.*(?:Rechnung|Invoice|Beleg|Datum|Date|Seite|Page|Kunde|Customer|Company\s*name|Bill\s*to|Adresát|Empfänger|Recipient|VAT|GST)\b)([A-ZÄÖÜ][\wäöüÄÖÜß&.,\-\s]{1,60}\b(?:GmbH|AG|KG|OG|e\.U\.|s\.r\.o\.|a\.s\.?|Ltd\.?|Inc\.?|LLC|Co\.|GbR|UG))/gm;
    let vm, vendorCandidate = null;
    while ((vm = vendorPat.exec(text)) !== null) {
      const candidate = vm[1].trim();
      if (!isOwnCompany(candidate)) { vendorCandidate = candidate; break; }
    }
    if (vendorCandidate) result.vendor = vendorCandidate;
    else {
      const signoffPat = new RegExp(
        '(?:Freundliche Grüße|Mit freundlichen Grüßen|Hochachtungsvoll|Best regards|Kind regards|Yours sincerely)' +
        '[,\\s]*\\n+\\s*(' + NAME + ')'
      );
      const signoffM = text.match(signoffPat);
      if (signoffM && !isOwnCompany(signoffM[1])) result.vendor = signoffM[1].trim();
      else {
        const firstLine = (text.split('\n').map(l => l.trim()).find(l => l.length > 2) || '');
        const headerM = firstLine.match(new RegExp('^(' + NAME + ')\\s*[|,]'));
        if (headerM && !isOwnCompany(headerM[1])) result.vendor = headerM[1].trim();
      }
    }

    // 3c. Währung — internationale Anbieter rechnen oft in USD/GBP/CHF etc.
    // statt EUR ab; das Formular geht von EUR aus, daher muss umgerechnet werden.
    const CURRENCY_SYMBOLS = { '$': 'USD', '£': 'GBP', '¥': 'JPY', 'Kč': 'CZK', 'zł': 'PLN', 'Ft': 'HUF' };
    const currencyCodePat = /\b(USD|GBP|CHF|JPY|PLN|CZK|HUF|SEK|NOK|DKK|RON|BGN|CAD|AUD|NZD)\b/;
    let currency = 'EUR';
    if (text.includes('€')) currency = 'EUR';
    else {
      const curM = text.match(currencyCodePat);
      if (curM) currency = curM[1].toUpperCase();
      else {
        for (const sym in CURRENCY_SYMBOLS) {
          if (text.includes(sym)) { currency = CURRENCY_SYMBOLS[sym]; break; }
        }
      }
    }
    result.currency = currency;

    // 4. Ableitungen wenn Felder fehlen
    if (result.netAmount && result.vatRate != null && result.grossAmount == null) {
      result.grossAmount = Math.round(result.netAmount * (1 + result.vatRate) * 100) / 100;
    }
    if (result.grossAmount && result.vatRate != null && result.netAmount == null) {
      result.netAmount = Math.round(result.grossAmount / (1 + result.vatRate) * 100) / 100;
    }
    if (result.netAmount && result.grossAmount && result.vatRate == null) {
      const impliedRate = (result.grossAmount - result.netAmount) / result.netAmount;
      // Auf bekannte Sätze runden
      const knownRates = [0, 0.05, 0.07, 0.10, 0.19, 0.20, 0.23, 0.25];
      const closest = knownRates.reduce((a, b) =>
        Math.abs(b - impliedRate) < Math.abs(a - impliedRate) ? b : a
      );
      if (Math.abs(closest - impliedRate) < 0.02) result.vatRate = closest;
    }

    // 5. Beschreibung / Betreff
    const descPat = /(?:Betreff|Beschreibung|Leistung|Subject|Re:|Rechnungsgegenstand|Gegenstand)[:\s]+([^\n]{5,100})/i;
    const descM = text.match(descPat);
    if (descM) result.description = descM[1].trim();

    return result;
  }

  // ── Währungsumrechnung (kostenlose EZB-Kurse via frankfurter.app) ──
  // Liefert historische Tageskurse ohne API-Key; fällt bei Wochenenden/
  // Feiertagen automatisch auf den letzten verfügbaren Kurs zurück.
  async function fetchExchangeRate(currency, dateStr) {
    if (!currency || currency === 'EUR' || !dateStr) return null;
    try {
      // Hinweis: api.frankfurter.app leitet per 301 ohne CORS-Header auf
      // api.frankfurter.dev um — das blockt fetch() im Browser. Daher
      // direkt die neue Domain ansprechen.
      const url = `https://api.frankfurter.dev/v1/${encodeURIComponent(dateStr)}?from=${encodeURIComponent(currency)}&to=EUR`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      const rate = json?.rates?.EUR;
      return (typeof rate === 'number') ? { rate, date: json.date || dateStr, from: currency } : null;
    } catch (e) {
      return null;
    }
  }

  async function convertAmountsToEur(data) {
    if (!data.currency || data.currency === 'EUR') return null;
    const info = await fetchExchangeRate(data.currency, data.date);
    if (!info) return null;
    const original = {
      currency: data.currency,
      netAmount: data.netAmount,
      grossAmount: data.grossAmount,
      vatAmount: data.vatAmount,
    };
    ['netAmount', 'grossAmount', 'vatAmount'].forEach(k => {
      if (data[k] != null) data[k] = Math.round(data[k] * info.rate * 100) / 100;
    });
    data.currency = 'EUR';
    return { ...info, original };
  }

  // ── Formular befüllen ────────────────────────────────────
  function applyToForm(data) {
    if (data.date) {
      const el = document.getElementById('f-date');
      if (el) el.value = data.date;
    }
    if (data.invoiceRef) {
      const el = document.getElementById('f-ref');
      if (el && !el.value) el.value = data.invoiceRef;
    }
    if (data.description) {
      const el = document.getElementById('f-desc');
      if (el && !el.value) el.value = data.description;
    }
    if (data.vendor) {
      // Geschäftspartner ist ein Auswahlfeld — versuchen, einen
      // bestehenden Partner anhand des erkannten Namens zu finden.
      const cpEl = document.getElementById('f-cp');
      if (cpEl && !cpEl.value) {
        const needle = data.vendor.toLowerCase();
        let match = Array.from(cpEl.options).find(o =>
          o.textContent && o.textContent.toLowerCase().includes(needle.split(/\s+/)[0])
        );
        // Lieferant existiert noch nicht in der Partnerliste — automatisch
        // als neuen Geschäftspartner (Typ "Lieferant") anlegen.
        if (!match && typeof State !== 'undefined') {
          const newCp = {
            id: (typeof uid === 'function' ? uid() : Math.random().toString(36).slice(2)),
            name: data.vendor, type: 'supplier',
            country: '', address: '', address2: '', zip: '', city: '',
            ico: '', dic: '', vatNumber: '', contactPerson: '', phone: '', email: '', notes: '',
            createdAt: (typeof now === 'function' ? now() : new Date().toISOString()),
            updatedAt: (typeof now === 'function' ? now() : new Date().toISOString()),
          };
          State.set(s => { s.counterparties.push(newCp); });
          const opt = document.createElement('option');
          opt.value = newCp.id;
          opt.textContent = newCp.name;
          cpEl.appendChild(opt);
          match = opt;
          data.vendorCreated = true;
        }
        if (match) cpEl.value = match.value;
      }
      // Falls keine Beschreibung erkannt wurde, Lieferantenname dort einsetzen
      const descEl = document.getElementById('f-desc');
      if (descEl && !descEl.value) descEl.value = data.vendor;
    }
    if (data.netAmount != null) {
      const el = document.getElementById('f-net');
      if (el) el.value = data.netAmount.toFixed(2);
    }
    if (data.vatRate != null) {
      const el = document.getElementById('f-vatrate');
      if (el) {
        const target = data.vatRate;
        const best = Array.from(el.options).reduce((a, b) =>
          Math.abs(parseFloat(b.value) - target) < Math.abs(parseFloat(a.value) - target) ? b : a
        );
        if (best) el.value = best.value;
      }
    }
    if (typeof txFormCalcVat === 'function') txFormCalcVat();
  }

  // ── Status-Anzeige im Formular ───────────────────────────
  function showScanStatus(html) {
    const el = document.getElementById('f-scan-status');
    if (el) el.innerHTML = html;
  }

  function showScanResult(data, rawText, conversion) {
    const found = [];
    const missing = [];
    const add = (label, val) => val != null ? found.push(label) : missing.push(label);
    add('Datum', data.date);
    add('Lieferant', data.vendor);
    add('Belegnr.', data.invoiceRef);
    add('Netto', data.netAmount);
    add('MwSt-Satz', data.vatRate);
    add('Brutto', data.grossAmount);

    // Bei wenig/keiner Erkennung den Rohtext anzeigen, damit der Nutzer
    // selbst nachsehen kann, warum die automatische Erkennung versagt hat
    // (anstelle nur "nichts gefunden" stehen zu lassen).
    const rawSnippet = rawText && rawText.trim()
      ? `<details style="margin-top:6px"><summary style="cursor:pointer;font-size:11px;color:var(--text2)">Erkannten Text anzeigen (zur manuellen Korrektur)</summary>
           <pre style="white-space:pre-wrap;font-size:11px;max-height:200px;overflow:auto;margin-top:4px;padding:6px;background:var(--bg2,rgba(128,128,128,.08));border-radius:4px">${esc(rawText.slice(0, 4000))}</pre>
         </details>`
      : '';

    // Hinweis auf Währungsumrechnung (Original- → EUR-Beträge mit Tageskurs)
    const conversionNote = conversion
      ? `<div class="tax-notice" style="margin-top:6px">Umgerechnet von ${esc(conversion.original.currency)} in EUR
           (Kurs vom ${esc(conversion.date)}: 1 ${esc(conversion.original.currency)} = ${conversion.rate.toFixed(4)} EUR) —
           Original: Netto ${conversion.original.netAmount ?? '–'}, Brutto ${conversion.original.grossAmount ?? '–'} ${esc(conversion.original.currency)}</div>`
      : '';
    const vendorCreatedNote = data.vendorCreated
      ? `<div class="tax-notice">Neuer Geschäftspartner „${esc(data.vendor)}" als Lieferant angelegt.</div>`
      : '';

    if (found.length === 0) {
      showScanStatus(`<div class="tax-notice" style="color:var(--yellow)">Keine Felder erkannt – bitte manuell ausfüllen.</div>${rawSnippet}`);
      return;
    }

    const foundTags = found.map(f => `<span class="badge badge-green">${esc(f)}</span>`).join(' ');
    const missingTags = missing.length
      ? ' <span class="muted" style="font-size:11px">Nicht erkannt: ' + missing.map(esc).join(', ') + '</span>'
      : '';
    showScanStatus(`<div style="margin-top:6px;display:flex;align-items:center;flex-wrap:wrap;gap:4px">
      <span style="font-size:11px;color:var(--text2)">Erkannt:</span> ${foundTags}${missingTags}
    </div>${conversionNote}${vendorCreatedNote}${missing.length ? rawSnippet : ''}`);
  }

  // ── Öffentliche API ──────────────────────────────────────
  window.triggerInvoiceScan = function () {
    const input = document.getElementById('f-scan-file');
    if (input) input.click();
  };

  window.handleInvoiceScanFile = async function (input) {
    const file = input?.files?.[0];
    if (!file) return;

    showScanStatus('<div class="tax-notice">Datei wird gelesen…</div>');

    try {
      let text = '';
      if (file.type === 'application/pdf') {
        showScanStatus('<div class="tax-notice">PDF wird analysiert…</div>');
        text = await extractTextFromPdf(file);
      } else {
        // Bild-OCR — beim ersten Mal wird Sprachmodell geladen (~4 MB)
        showScanStatus('<div class="tax-notice">OCR wird gestartet – beim ersten Mal kurz warten…</div>');
        text = await extractTextFromImage(file, pct => {
          showScanStatus(`<div class="tax-notice">OCR läuft… ${pct}%</div>`);
        });
      }

      const data = parseInvoiceText(text);

      let conversion = null;
      if (data.currency && data.currency !== 'EUR') {
        showScanStatus(`<div class="tax-notice">Wechselkurs ${esc(data.currency)} → EUR wird abgerufen…</div>`);
        conversion = await convertAmountsToEur(data);
      }

      applyToForm(data);
      showScanResult(data, text, conversion);

      // Datei gleichzeitig als Anhang hinzufügen
      if (typeof readFileAsDataUrl === 'function' && Array.isArray(window._editingTxAttachments)) {
        const dataUrl = await readFileAsDataUrl(file);
        window._editingTxAttachments.push({
          id: (typeof uid === 'function' ? uid() : Math.random().toString(36).slice(2)),
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size || 0,
          dataUrl,
          uploadedAt: (typeof now === 'function' ? now() : new Date().toISOString()),
        });
        if (typeof renderTxAttachmentEditor === 'function') renderTxAttachmentEditor();
      }

    } catch (err) {
      showScanStatus(`<div class="tax-notice" style="color:var(--red)">Fehler: ${esc(err.message)}</div>`);
    }

    input.value = '';
  };

  return { parseInvoiceText, parseAmount, fetchExchangeRate, convertAmountsToEur };
})();
