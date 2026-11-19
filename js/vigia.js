/* =========================================================
   Vigia do botão de emergência (painel → 🚨 Emergência)
   Quando o painel esconde/mostra as essências, todas as lojas abertas
   (telemóveis e computadores) recarregam sozinhas:
     1) instantâneo  → Supabase Realtime (precisa de supabase/004-emergencia.sql)
     2) segurança    → verificação a cada 30 s, ao voltar à página e ao recuperar a internet
     3) demonstração → sem Supabase, outras abas do mesmo navegador
   Carregado depois de app.js.
   ========================================================= */
(function () {
  const C = window.SS_CONFIG || {};
  const live = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
  const SB_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  const SB_SRI = "sha384-0w2KAL2YHP6wKOkUDzkCDGgVvfmHnj02DHeQ6XcHOgTfFsGyonKOpShMH1x6nk9o";

  SSDB.ready.then(() => {
    const atual = typeof STORE !== "undefined" && !!STORE.ocultarEssencias;
    let feito = false;

    function recarregar(novo) {
      novo = !!novo;
      if (feito || novo === atual) return;
      // proteção: nunca recarregar em ciclo pelo MESMO valor (no máximo 1 vez a cada 15 s);
      // um valor diferente (ligar → desligar) recarrega logo
      try {
        const [v, t] = (sessionStorage.getItem("ss_vigia") || "|0").split("|");
        if (v === String(novo) && Date.now() - +t < 15000) return;
        sessionStorage.setItem("ss_vigia", `${novo}|${Date.now()}`);
      } catch (e) {}
      feito = true;
      // a cópia rápida do catálogo guardada no telemóvel fica já com o valor novo
      try {
        const c = JSON.parse(localStorage.getItem("ss_cache"));
        if (c && c.store) {
          if (novo) c.store.ocultarEssencias = true; else delete c.store.ocultarEssencias;
          localStorage.setItem("ss_cache", JSON.stringify(c));
        }
      } catch (e) {}
      location.reload();
    }

    /* ---- Modo demonstração: outras abas do mesmo navegador ---- */
    if (!live) {
      window.addEventListener("storage", (e) => {
        if (e.key !== "ss_catalog" || !e.newValue) return;
        try { recarregar(JSON.parse(e.newValue)?.store?.ocultarEssencias); } catch (err) {}
      });
      return;
    }

    /* ---- Verificação periódica (funciona sempre, mesmo sem Realtime) ---- */
    let aVerificar = false;
    async function verificar() {
      if (aVerificar || feito || document.visibilityState !== "visible") return;
      aVerificar = true;
      try {
        const r = await fetch(`${C.SUPABASE_URL}/rest/v1/settings?select=oc:store->ocultarEssencias&id=eq.1`, {
          headers: { apikey: C.SUPABASE_ANON_KEY, Authorization: `Bearer ${C.SUPABASE_ANON_KEY}` }, cache: "no-store",
        });
        if (r.ok) { const d = await r.json(); if (Array.isArray(d) && d.length) recarregar(d[0].oc === true); }
      } catch (e) {} finally { aVerificar = false; }
    }
    setInterval(verificar, 30000);
    document.addEventListener("visibilitychange", verificar);
    window.addEventListener("online", verificar);
    window.addEventListener("pageshow", (e) => { if (e.persisted) verificar(); });

    /* ---- Tempo real (instantâneo). Carrega depois da página para não a atrasar ---- */
    setTimeout(() => {
      const s = document.createElement("script");
      s.src = SB_JS; s.integrity = SB_SRI; s.crossOrigin = "anonymous"; s.async = true;
      s.onload = () => {
        try {
          const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          });
          sb.channel("loja-vigia")
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings", filter: "id=eq.1" },
              (p) => recarregar(p && p.new && p.new.store && p.new.store.ocultarEssencias))
            .subscribe();
        } catch (e) { /* sem tempo real: a verificação de 30 s continua a funcionar */ }
      };
      document.head.appendChild(s);
    }, 2000);
  });
})();
