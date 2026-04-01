// ============================================================
// INITIALISIERUNG
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  State.load();
  syncIssuedInvoicesToIncomeTransactions();

  document.querySelectorAll('.nav-item').forEach(el=>{
    el.addEventListener('click', ()=>UI.render(el.dataset.tab));
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
        State.importJSON(ev.target.result);
        syncIssuedInvoicesToIncomeTransactions();
        showToast('Zustand importiert','success');
        UI.render(UI.currentTab);
      } catch(err) { showToast('Importfehler: '+err.message,'error'); }
    };
    reader.readAsText(file);
    e.target.value='';
  });

  UI.render('dashboard');
});

