/* =========================================================
   Vigia do botão de emergência (painel → 🚨 Emergência)
   Quando o painel esconde/mostra as essências, todas as lojas abertas
   (telemóveis e computadores) recarregam sozinhas, sem o cliente tocar em nada.
   Três caminhos (basta um funcionar):
     1) sinal direto do painel   → Supabase Realtime "broadcast" (instantâneo)
     2) alteração na base de dados → Supabase Realtime "postgres_changes" (instantâneo)
     3) segurança                → verificação a cada 15 s, ao voltar à página,
                                    ao recuperar a internet e ao tocar na página
   Qualquer sinal leva sempre a confirmar o valor na base de dados antes de recarregar.
   Sem Supabase (demonstração): outras abas do mesmo navegador.
   Carregado depois de app.js.
   ========================================================= */
(function () {
  const C = window.SS_CONFIG || {};
  const live = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
  const SB_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js";
  const SB_SRI = "sha384-0w2KAL2YHP6wKOkUDzkCDGgVvfmHnj02DHeQ6XcHOgTfFsGyonKOpShMH1x6nk9o";
  const CANAL = "loja-vigia";

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

    /* ---- Confirmar o valor na base de dados ---- */
    let aVerificar = false, ultima = 0;
    async function verificar(forcar) {
      if (feito || aVerificar) return;
      if (!forcar && (document.visibilityState !== "visible" || Date.now() - ultima < 4000)) return;
      aVerificar = true; ultima = Date.now();
      try {
        const r = await fetch(`${C.SUPABASE_URL}/rest/v1/settings?select=oc:store->ocultarEssencias&id=eq.1`, {
          headers: { apikey: C.SUPABASE_ANON_KEY, Authorization: `Bearer ${C.SUPABASE_ANON_KEY}` }, cache: "no-store",
        });
        if (r.ok) { const d = await r.json(); if (Array.isArray(d) && d.length) recarregar(d[0].oc === true); }
      } catch (e) {} finally { aVerificar = false; }
    }

    setInterval(() => verificar(false), 15000);
    document.addEventListener("visibilitychange", () => verificar(false));
    window.addEventListener("focus", () => verificar(false));
    window.addEventListener("online", () => verificar(true));
    window.addEventListener("pageshow", (e) => { if (e.persisted) verificar(true); });
    // o cliente continua a navegar → confirma (no máximo 1 vez a cada 4 s)
    window.addEventListener("hashchange", () => verificar(false));
    document.addEventListener("pointerdown", () => verificar(false), { passive: true });

    /* ---- Tempo real (instantâneo). Carrega depois da página para não a atrasar ---- */
    function ligarTempoReal() {
      try {
        const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
        sb.channel(CANAL)
          .on("broadcast", { event: "emergencia" }, () => verificar(true))
          .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => verificar(true))
          .subscribe((estado) => { if (estado === "SUBSCRIBED") verificar(true); });
      } catch (e) { /* sem tempo real: a verificação de 15 s continua a funcionar */ }
    }
    setTimeout(() => {
      if (window.supabase?.createClient) return ligarTempoReal();
      const s = document.createElement("script");
      s.src = SB_JS; s.integrity = SB_SRI; s.crossOrigin = "anonymous"; s.async = true;
      s.onload = ligarTempoReal;
      document.head.appendChild(s);
    }, 1500);
  });
})();
