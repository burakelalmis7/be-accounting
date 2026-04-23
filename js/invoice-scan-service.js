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
    // Priorität: Schlüsselwort + Datum
    const dateLabelPat = /(?:Rechnungs-?datum|Ausstellungsdatum|Belegdatum|Invoice\s*Date|Date)[:\s]+(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})/i;
    // Fallback: ISO-Format YYYY-MM-DD
    const dateIsoPat = /\b(\d{4})-(\d{2})-(\d{2})\b/;
    // Fallback: erstes DD.MM.YYYY im Text
    const dateDePat = /\b(\d{1,2})[.](\d{1,2})[.](\d{4})\b/;

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
        }
      }
    }

    // 2. Belegnummer
    const refPat = /(?:Rechnungs-?(?:nummer|nr\.?|no\.?)|Invoice\s*(?:No\.?|Nr\.?|Number|#)|Beleg-?(?:nr\.?|nummer|No\.?))[:\s#]*([A-Z0-9][A-Z0-9\-\.\/]{1,30})/i;
    const refM = text.match(refPat);
    if (refM) result.invoiceRef = refM[1].trim();

    // 3. Beträge – Brutto hat höchste Priorität da am eindeutigsten
    const AMT = '([0-9]{1,3}(?:[.\\s]?[0-9]{3})*(?:[,\\.][0-9]{1,2})?)';

    // Brutto / Gesamt
    const grossPat = new RegExp(
      '(?:Gesamt(?:betrag|summe)?|Brutto(?:betrag)?|Rechnungsbetrag|Total(?:\\s*Amount)?|' +
      'Zu(?:\\s+)zahlen(?:der)?(?:\\s+Betrag)?|Zahlbetrag|Endbetrag|Fälliger Betrag)' +
      '[:\\s]*' + AMT + '\\s*€?', 'i'
    );
    const grossM = text.match(grossPat);
    if (grossM) result.grossAmount = parseAmount(grossM[1]);

    // Netto
    const netPat = new RegExp(
      '(?:Netto(?:betrag|summe|-Summe)?|Summe\\s*Netto|Net(?:\\s*Amount)?|Betrag\\s*netto)' +
      '[:\\s]*' + AMT + '\\s*€?', 'i'
    );
    const netM = text.match(netPat);
    if (netM) result.netAmount = parseAmount(netM[1]);

    // MwSt-Satz (Zahl%)
    const vatRatePat = /(?:MwSt\.?|USt\.?|Mehrwertsteuer|VAT)[^0-9%]*(\d+(?:[.,]\d+)?)\s*%/i;
    const vatRateM = text.match(vatRatePat);
    if (vatRateM) result.vatRate = parseFloat(vatRateM[1].replace(',', '.')) / 100;

    // MwSt-Betrag (nach dem Satz oder eigene Zeile)
    const vatAmtPat = new RegExp(
      '(?:MwSt\.?|USt\.?|Mehrwertsteuer|VAT)' +
      '[^0-9%]*\\d+\\s*%[:\\s]*' + AMT + '\\s*€?', 'i'
    );
    const vatAmtM = text.match(vatAmtPat);
    if (vatAmtM) result.vatAmount = parseAmount(vatAmtM[1]);

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

  function showScanResult(data) {
    const found = [];
    const missing = [];
    const add = (label, val) => val != null ? found.push(label) : missing.push(label);
    add('Datum', data.date);
    add('Belegnr.', data.invoiceRef);
    add('Netto', data.netAmount);
    add('MwSt-Satz', data.vatRate);
    add('Brutto', data.grossAmount);

    if (found.length === 0) {
      showScanStatus('<div class="tax-notice" style="color:var(--yellow)">Keine Felder erkannt – bitte manuell ausfüllen.</div>');
      return;
    }

    const foundTags = found.map(f => `<span class="badge badge-green">${esc(f)}</span>`).join(' ');
    const missingTags = missing.length
      ? ' <span class="muted" style="font-size:11px">Nicht erkannt: ' + missing.map(esc).join(', ') + '</span>'
      : '';
    showScanStatus(`<div style="margin-top:6px;display:flex;align-items:center;flex-wrap:wrap;gap:4px">
      <span style="font-size:11px;color:var(--text2)">Erkannt:</span> ${foundTags}${missingTags}
    </div>`);
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
      applyToForm(data);
      showScanResult(data);

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

  return { parseInvoiceText, parseAmount };
})();
