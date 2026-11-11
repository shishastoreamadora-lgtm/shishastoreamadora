/* =========================================================
   Camada de dados da loja
   - Com Supabase configurado (js/config.js): lê o catálogo e os dados
     da loja da base de dados e grava as encomendas lá.
   - Sem Supabase: modo demonstração (data.js + alterações do navegador).
   Carregado depois de data.js e config.js.
   ========================================================= */
window.SSDB = (() => {
  const C = window.SS_CONFIG || {};
  const live = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
  const REVIEWS = [];   // opiniões aprovadas (as mais recentes primeiro)
  const LISTS = { shishas: SHISHAS, essencias: ESSENCIAS, carvao: CARVAO, acessorios: ACESSORIOS, packs: PACKS };

  const rest = (path, opt = {}) => fetch(`${C.SUPABASE_URL}/rest/v1/${path}`, {
    ...opt,
    headers: { apikey: C.SUPABASE_ANON_KEY, Authorization: `Bearer ${C.SUPABASE_ANON_KEY}`, "Content-Type": "application/json", ...(opt.headers || {}) },
  });

  // Segurança: os textos vindos da base de dados não podem trazer HTML,
  // e as imagens só podem vir de endereços seguros.
  const SAFE_IMG = /^(https:\/\/|img\/|data:image\/(jpeg|png|webp);base64,)/i;
  function clean(v, key) {
    if (typeof v === "string") {
      if (key === "img") return SAFE_IMG.test(v) ? v.replace(/["'<>\s]/g, "") : undefined;
      if (key === "cor" || key === "hex") return /^#[0-9a-f]{3,8}$/i.test(v) ? v : "#999999";
      return v.replace(/[<>]/g, "");
    }
    if (Array.isArray(v)) return v.map(x => clean(x));
    if (v && typeof v === "object") { const o = {}; for (const [k, x] of Object.entries(v)) { const c = clean(x, k); if (c !== undefined) o[k] = c; } return o; }
    return v;
  }

  // linhas da tabela "catalog" → listas do catálogo
  function applyRows(rows) {
    const by = { shishas: [], essencias: [], carvao: [], acessorios: [], packs: [] };
    rows.sort((a, b) => a.pos - b.pos).forEach(r => { if (by[r.cat]) by[r.cat].push({ ...clean(r.data), id: String(r.id).replace(/[^a-z0-9-]/gi, "") }); });
    for (const [k, arr] of Object.entries(LISTS)) arr.splice(0, arr.length, ...by[k]);
  }

  // opiniões vindas da base de dados → só os campos esperados, sem HTML
  function applyReviews(rows) {
    const ok = (Array.isArray(rows) ? rows : []).filter(r => r && r.aprovado !== false).map(r => ({
      id: r.id, data: r.created_at, produto: r.produto ? String(r.produto).replace(/[^a-z0-9-]/gi, "") : null,
      nome: String(r.nome || "").replace(/[<>]/g, "").slice(0, 40), estrelas: Math.min(5, Math.max(1, Math.round(+r.estrelas || 5))),
      texto: String(r.texto || "").replace(/[<>]/g, "").slice(0, 600), resposta: r.resposta ? String(r.resposta).replace(/[<>]/g, "").slice(0, 400) : "",
    }));
    REVIEWS.splice(0, REVIEWS.length, ...ok.sort((a, b) => new Date(b.data) - new Date(a.data)));
  }

  function applyLocal() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem("ss_catalog")); } catch {}
    if (!saved) return;
    for (const [k, arr] of Object.entries(LISTS)) if (Array.isArray(saved[k])) arr.splice(0, arr.length, ...saved[k]);
    if (saved.store) Object.assign(STORE, saved.store);
  }
  function localReviews() { try { applyReviews(JSON.parse(localStorage.getItem("ss_reviews")) || []); } catch {} }

  async function load() {
    if (!live) { applyLocal(); localReviews(); return; }
    // Velocidade: usa a última cópia do catálogo guardada no telemóvel do cliente
    // se a internet estiver lenta (mais de 2,5 s), e atualiza-a em segundo plano.
    let cache = null;
    try { cache = JSON.parse(localStorage.getItem("ss_cache")); } catch {}
    const useData = (d) => { if (d.rows?.length) applyRows(d.rows); if (d.store) Object.assign(STORE, clean(d.store)); if (d.reviews) applyReviews(d.reviews); };
    const fresh = (async () => {
      const [cat, set, rev] = await Promise.all([
        rest("catalog?select=id,cat,pos,data&order=pos.asc"),
        rest("settings?select=store&id=eq.1"),
        // o servidor só devolve as opiniões aprovadas
        rest("reviews?select=id,created_at,produto,nome,estrelas,texto,resposta&order=created_at.desc&limit=300").catch(() => null),
      ]);
      if (!cat.ok) throw new Error("catalog " + cat.status);
      const d = { t: Date.now(), rows: await cat.json(), store: set.ok ? (await set.json())[0]?.store : null, reviews: rev?.ok ? await rev.json() : [] };
      try { localStorage.setItem("ss_cache", JSON.stringify(d)); } catch {}
      return d;
    })();
    try {
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("lento")), cache ? 2500 : 8000));
      useData(await Promise.race([fresh, timeout]));
    } catch (e) {
      if (cache) useData(cache);
      else console.warn("Sem ligação à base de dados — a usar o catálogo guardado no site.", e);
    }
  }

  // Na loja, os produtos ocultos não aparecem (no painel aparecem todos)
  function hideHidden() {
    if (window.SS_ADMIN) return;
    Object.values(LISTS).forEach(arr => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i].oculto) arr.splice(i, 1); });
  }

  // Encomenda feita no carrinho
  async function placeOrder(items, total, cliente = null) {
    if (!live) {
      let orders = [];
      try { orders = JSON.parse(localStorage.getItem("ss_orders")) || []; } catch {}
      const n = orders.reduce((m, o) => Math.max(m, o.n || 0), 1000) + 1;
      orders.unshift({ n, data: new Date().toISOString(), items, total, estado: "nova", canal: "WhatsApp", cliente });
      try { localStorage.setItem("ss_orders", JSON.stringify(orders)); } catch {}
      return;
    }
    try {
      await rest("orders", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ items: items.map(({ id, variant, qty }) => ({ id, variant, qty })), total: Math.round(total * 100) / 100, ...(cliente ? { cliente: { nome: String(cliente.nome).slice(0, 60), tel: String(cliente.tel).slice(0, 20) } } : {}) }) });
    } catch (e) { console.warn("Não foi possível registar a encomenda.", e); }
  }

  // Opinião deixada por um cliente (fica à espera de aprovação no painel)
  async function sendReview(r) {
    const row = { produto: r.produto || null, nome: String(r.nome).slice(0, 40), estrelas: r.estrelas, texto: String(r.texto).slice(0, 600) };
    if (!live) {
      let all = [];
      try { all = JSON.parse(localStorage.getItem("ss_reviews")) || []; } catch {}
      all.unshift({ ...row, id: Date.now(), created_at: new Date().toISOString(), aprovado: false, resposta: "" });
      try { localStorage.setItem("ss_reviews", JSON.stringify(all)); } catch {}
      return { ok: true };
    }
    try {
      const res = await rest("reviews", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });
      if (res.ok) return { ok: true };
      const err = await res.json().catch(() => ({}));
      return { ok: false, msg: /opini|ocupado/i.test(err.message || "") ? err.message : "Não foi possível enviar. Tenta outra vez." };
    } catch { return { ok: false, msg: "Sem internet. Tenta outra vez." }; }
  }

  // No painel em modo demonstração, as alterações do navegador carregam já (o modo real lê da base de dados)
  if (window.SS_ADMIN && !live) applyLocal();
  const ready = window.SS_ADMIN ? Promise.resolve() : load().then(hideHidden);
  return { live, config: C, LISTS, REVIEWS, applyRows, clean, placeOrder, sendReview, ready };
})();
