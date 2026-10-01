const AppBootstrap = (() => {
  function overlay(html='') { const el = document.getElementById('auth-overlay'); if (el) el.innerHTML = html; }
  function setupScreen(message='') { return `<main class="auth-screen"><section class="auth-card"><h1>Cloud-Speicher einrichten</h1><p class="muted">Diese Installation hat noch keine Supabase-Projektadresse und keinen Publishable Key. Bestehende Browserdaten werden nicht verändert.</p>${message ? `<p class="form-status error">${esc(message)}</p>` : ''}<p class="muted">Siehe <code>docs/SUPABASE_SETUP.md</code>. Danach Seite neu laden.</p></section></main>`; }
  async function startSignedIn() {
    try {
      const company = await Persistence.findCompany();
      State.setAuthContext(Auth.user().id, company.id);
      Drafts.setContext(Auth.user().id, company.id);
      Drafts.setStatus('global-save-status', 'saving', 'Lade zentralen Datenbestand …');
      const state = await Persistence.loadState();
      State.replace(state);
      overlay('');
      UI.render('dashboard');
      Drafts.setStatus('global-save-status', 'cloud', 'Zentraler Datenbestand geladen');
    } catch (error) {
      overlay(Auth.authScreen(error.message || 'Datenbestand konnte nicht geladen werden.'));
      Auth.bindScreen();
    }
  }
  async function init() {
    if (!SupabaseClient.configured()) { overlay(setupScreen()); return; }
    try { await Auth.restore(); } catch (error) { overlay(Auth.authScreen(error.message)); Auth.bindScreen(); return; }
    if (!Auth.user()) { overlay(Auth.authScreen()); Auth.bindScreen(); return; }
    await startSignedIn();
  }
  return { init, startSignedIn };
})();
