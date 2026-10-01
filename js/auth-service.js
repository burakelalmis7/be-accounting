// Authentication UI and session lifecycle. Registration intentionally remains
// disabled in the UI; the first user is provisioned in Supabase Auth.
const Auth = (() => {
  let _session = null;
  let _listenerBound = false;
  function session() { return _session; }
  function user() { return _session?.user || null; }
  async function restore() {
    const client = SupabaseClient.get();
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    _session = data.session;
    if (!_listenerBound) {
      _listenerBound = true;
      client.auth.onAuthStateChange((event, next) => {
        _session = next;
        // INITIAL_SESSION is also emitted for a visitor who has never signed
        // in. Reloading there creates an endless login/dashboard loop.
        if (event === 'SIGNED_OUT') {
          State?.setAuthContext?.(null, null);
          window.location.reload();
        }
      });
    }
    return _session;
  }
  async function signIn(email, password) {
    const { data, error } = await SupabaseClient.get().auth.signInWithPassword({ email, password });
    if (error) throw error;
    _session = data.session;
    return data.session;
  }
  async function resetPassword(email) {
    const { error } = await SupabaseClient.get().auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}${location.pathname}` });
    if (error) throw error;
  }
  async function signOut() {
    if (Drafts?.hasUnsynced?.()) throw new Error('Es gibt noch nur lokal gesicherte Entwürfe. Bitte zuerst synchronisieren oder bewusst verwerfen.');
    const { error } = await SupabaseClient.get().auth.signOut();
    if (error) throw error;
  }
  function authScreen(message='') {
    return `<main class="auth-screen"><section class="auth-card"><h1>BE-Coding Buchhaltung</h1><p class="muted">Bitte anmelden, um den zentralen Firmenbestand zu öffnen.</p>${message ? `<p class="form-status error">${esc(message)}</p>` : ''}<form id="auth-form"><div class="form-group"><label>E-Mail</label><input id="auth-email" type="email" autocomplete="email" required></div><div class="form-group"><label>Passwort</label><input id="auth-password" type="password" autocomplete="current-password" required></div><button class="btn btn-primary" type="submit">Anmelden</button></form><button class="btn btn-ghost btn-sm" id="auth-reset" style="margin-top:10px">Passwort zurücksetzen</button></section></main>`;
  }
  function bindScreen() {
    document.getElementById('auth-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = event.currentTarget.querySelector('button[type=submit]');
      submit.disabled = true;
      try { await signIn(document.getElementById('auth-email').value, document.getElementById('auth-password').value); await AppBootstrap.startSignedIn(); }
      catch (error) { document.getElementById('auth-overlay').innerHTML = authScreen(error.message || 'Anmeldung fehlgeschlagen.'); bindScreen(); }
      finally { submit.disabled = false; }
    });
    document.getElementById('auth-reset')?.addEventListener('click', async () => {
      const email = document.getElementById('auth-email').value;
      if (!email) return showToast('Bitte zuerst die E-Mail-Adresse eingeben.', 'warn');
      try { await resetPassword(email); showToast('Wiederherstellungs-E-Mail wurde angefordert.', 'success'); } catch (error) { showToast(error.message, 'error'); }
    });
  }
  return { restore, signIn, signOut, session, user, authScreen, bindScreen };
})();
