// Supabase client boundary. Never place a service-role key in this file.
const SupabaseClient = (() => {
  let client = null;
  function configured() {
    const cfg = window.BE_ACCOUNTING_SUPABASE || {};
    return Boolean(cfg.url && cfg.publishableKey && window.supabase?.createClient);
  }
  function get() {
    if (!configured()) return null;
    if (!client) {
      const cfg = window.BE_ACCOUNTING_SUPABASE;
      client = window.supabase.createClient(cfg.url, cfg.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    }
    return client;
  }
  return { configured, get };
})();
