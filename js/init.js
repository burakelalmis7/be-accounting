// ============================================================
// INITIALISIERUNG
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  State.load();
  syncIssuedInvoicesToIncomeTransactions();

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

