// ============================================================
// INITIALISIERUNG
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  State.load();

  document.querySelectorAll('.nav-item').forEach(el=>{
    el.addEventListener('click', ()=>UI.render(el.dataset.tab));
  });

  // Mobile sidebar drawer
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  const openSidebar = () => {
    sidebar.classList.add('sidebar-open');
    sidebarBackdrop.classList.add('sidebar-open');
  };
  const closeSidebar = () => {
    sidebar.classList.remove('sidebar-open');
    sidebarBackdrop.classList.remove('sidebar-open');
  };
  sidebarToggle.addEventListener('click', openSidebar);
  sidebarBackdrop.addEventListener('click', closeSidebar);
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', closeSidebar);
  });

  const legacyYearSelect = document.getElementById('topbar-year-select');
  if (legacyYearSelect) {
    legacyYearSelect.addEventListener('change', e => {
      setAccountingYear(e.target.value);
      UI.render(UI.currentTab);
    });
  }

  document.getElementById('file-input').addEventListener('change', e=>{
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const info = Migration.stage(ev.target.result);
        if (Auth.user()) {
          const totalInvoices = info.counts.invoicesIssued + info.counts.invoicesReceived;
          openModal('Altdaten sicher übernehmen', `<p>Gefunden: <strong>${info.counts.transactions} Buchungen</strong>, ${totalInvoices} Rechnungen, ${info.counts.counterparties} Geschäftspartner und ${info.attachmentCount} Belege.</p><p class="tax-notice">Die Datei wird nur übernommen, wenn der Cloud-Bestand leer ist. Bestehende Datensätze werden nicht überschrieben. Nach dem Import werden Anzahl und Buchungsbeträge geprüft.</p>`, `<button class="btn btn-ghost btn-sm" onclick="closeModal()">Abbrechen</button><button class="btn btn-primary btn-sm" onclick="startLegacyImport()">Jetzt übernehmen</button>`);
        } else {
          State.importJSON(ev.target.result);
          showToast('Legacy-Daten lokal geprüft und geladen', 'success');
          UI.render(UI.currentTab);
        }
      } catch(err) { showToast('Importfehler: '+err.message,'error'); }
    };
    reader.readAsText(file);
    e.target.value='';
  });

  window.startLegacyImport = async function() {
    const status = message => openModal('Altdaten übernehmen', `<p>${esc(message)}</p><p class="muted">Bitte die Seite bis zum Abschluss geöffnet lassen.</p>`);
    status('Import wird vorbereitet …');
    try {
      const result = await Migration.importStaged(status);
      await AppBootstrap.startSignedIn();
      openModal('Import abgeschlossen', `<p>${result.counts.transactions} Buchungen und ${result.counts.invoicesIssued + result.counts.invoicesReceived} Rechnungen wurden übernommen und geprüft.</p>`, `<button class="btn btn-primary btn-sm" onclick="closeModal()">Schließen</button>`);
    } catch (error) {
      openModal('Import angehalten', `<p class="form-status error">${esc(error.message || 'Unbekannter Fehler')}</p><p>Die Sicherungsdatei bleibt unverändert. Bitte keine andere Sicherung importieren, bevor der Fehler geprüft ist.</p>`, `<button class="btn btn-ghost btn-sm" onclick="closeModal()">Schließen</button>`);
    }
  };

  await AppBootstrap.init();
});
