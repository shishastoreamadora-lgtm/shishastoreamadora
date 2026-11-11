/* =========================================================
   SHISHA STORE — Back office (demonstração, sem servidor)
   Guarda as alterações no navegador (localStorage):
     ss_catalog → produtos + dados da loja (lidos pela loja via store-data.js)
     ss_orders  → encomendas registadas pelo carrinho da loja
   Para publicar: "Exportar / Publicar" → data.js
   ========================================================= */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const ls = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const eur = (v) => v == null || v === "" ? "—" : Number(v).toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
  const slug = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ---------- Dados de trabalho ---------- */
  const CATS = {
    shishas: { label: "Shishas", one: "shisha" },
    essencias: { label: "Essências", one: "essência" },
    carvao: { label: "Carvão", one: "carvão" },
    acessorios: { label: "Acessórios", one: "acessório" },
    packs: { label: "Packs", one: "pack" },
  };
  const CAT_EMOJI = { shishas: "🪔", essencias: "🍉", carvao: "🔥", acessorios: "🧰", packs: "📦" };
  const ESTILOS = { moderno: "Moderna", tradicional: "Tradicional", led: "Com LED", portatil: "Portátil" };
  const ESTADOS = { nova: "Nova", confirmada: "Confirmada", pronta: "Pronta a levantar", entregue: "Entregue", cancelada: "Cancelada" };

  const db = {
    shishas: clone(SHISHAS), essencias: clone(ESSENCIAS), carvao: clone(CARVAO),
    acessorios: clone(ACESSORIOS), packs: clone(PACKS), store: clone(STORE),
  };
  let orders = ls.get("ss_orders", []);
  let reviews = SSDB.live ? [] : ls.get("ss_reviews", []);   // opiniões de clientes
  let reviewsMissing = false;                                 // falta correr supabase/003-opinioes.sql

  /* =========================================================
     BASE DE DADOS (Supabase) — modo real
     Sem configuração em js/config.js → modo demonstração (navegador)
     ========================================================= */
  const LIVE = SSDB.live;
  const sb = LIVE ? window.supabase.createClient(SSDB.config.SUPABASE_URL, SSDB.config.SUPABASE_ANON_KEY) : null;
  let knownIds = new Set();      // ids que existem na base de dados (para saber o que apagar)
  let saving = Promise.resolve();

  const rowsFromDb = () => Object.keys(CATS).flatMap(cat => db[cat].map((p, pos) => { const { id, ...data } = p; return { id, cat, pos, data }; }));
  async function loadRemote() {
    const [cat, set, ord] = await Promise.all([
      sb.from("catalog").select("id,cat,pos,data").order("pos"),
      sb.from("settings").select("store").eq("id", 1).maybeSingle(),
      sb.from("orders").select("*").order("created_at", { ascending: false }).limit(500),
      refreshReviews(),
    ]);
    if (cat.error) throw cat.error;
    if (cat.data.length) {
      Object.keys(CATS).forEach(k => db[k] = []);
      cat.data.forEach(r => { if (db[r.cat]) db[r.cat].push({ ...r.data, id: r.id }); });
      knownIds = new Set(cat.data.map(r => r.id));
    } else {
      // primeira vez: copia o catálogo do site para a base de dados
      await syncRemote(); toast("Catálogo copiado para a base de dados");
    }
    if (set.data?.store) db.store = { ...db.store, ...set.data.store };
    else await sb.from("settings").upsert({ id: 1, store: publicStore() });
    if (!ord.error) orders = ord.data.map(o => ({ n: o.n, data: o.created_at, items: o.items, total: Number(o.total), estado: o.estado, canal: o.canal, exemplo: o.exemplo, cliente: o.cliente }));
  }
  const publicStore = () => { const s = { ...db.store }; delete s.pin; return s; };
  async function uploadOne(dataUrl, name) {
    const blob = await (await fetch(dataUrl)).blob();
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const path = `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
    // nome único + cache de 1 ano: o navegador e a CDN guardam a foto e a loja abre mais rápido
    const up = await sb.storage.from("produtos").upload(path, blob, { contentType: blob.type || "image/jpeg", cacheControl: "31536000", upsert: false });
    if (up.error) throw up.error;
    return sb.storage.from("produtos").getPublicUrl(path).data.publicUrl;
  }
  async function uploadPhotos() {
    for (const p of allProducts().map(x => x.p)) {
      if (p.img && p.img.startsWith("data:")) p.img = await uploadOne(p.img, p.id);
      for (const c of p.cores || []) if (c.img && c.img.startsWith("data:")) c.img = await uploadOne(c.img, p.id + "-cor");
    }
    // fotos da página inicial (carrossel, banners, categorias, ambiente)
    const walk = async (o) => {
      if (Array.isArray(o)) { for (const x of o) await walk(x); return; }
      if (!o || typeof o !== "object") return;
      for (const [k, v] of Object.entries(o)) {
        if (k === "img" && typeof v === "string" && v.startsWith("data:")) o[k] = await uploadOne(v, "inicio");
        else if (v && typeof v === "object") await walk(v);
      }
    };
    if (db.store.home) await walk(db.store.home);
  }
  async function syncRemote() {
    await uploadPhotos();
    const rows = rowsFromDb();
    const up = await sb.from("catalog").upsert(rows);
    if (up.error) throw up.error;
    const ids = new Set(rows.map(r => r.id));
    const gone = [...knownIds].filter(id => !ids.has(id));
    if (gone.length) { const del = await sb.from("catalog").delete().in("id", gone); if (del.error) throw del.error; }
    knownIds = ids;
    const st = await sb.from("settings").upsert({ id: 1, store: publicStore(), updated_at: new Date().toISOString() });
    if (st.error) throw st.error;
  }

  function save(msg = "Alterações guardadas") {
    if (!LIVE) {
      const ok = ls.set("ss_catalog", db);
      if (!ok) return toast("Sem espaço no navegador: usa fotos mais pequenas ou um link", true);
      return msg && toast(msg);
    }
    // guarda em fila (uma de cada vez) para nunca se perderem alterações
    saving = saving.then(syncRemote).then(() => msg && toast(msg)).catch(err => { console.error(err); toast("Não foi possível guardar. Verifica a internet e tenta outra vez.", true); });
    return saving;
  }
  const saveOrders = () => { if (!LIVE) ls.set("ss_orders", orders); };
  async function setOrderState(o) { if (LIVE) { const r = await sb.from("orders").update({ estado: o.estado }).eq("n", o.n); if (r.error) toast("Não foi possível atualizar a encomenda", true); } else saveOrders(); }
  async function deleteOrder(n) { if (LIVE) { const r = await sb.from("orders").delete().eq("n", n); if (r.error) return toast("Não foi possível apagar", true); } orders = orders.filter(o => o.n !== n); saveOrders(); }
  async function refreshOrders() {
    if (!LIVE) return;
    const r = await sb.from("orders").select("*").order("created_at", { ascending: false }).limit(500);
    if (!r.error) orders = r.data.map(o => ({ n: o.n, data: o.created_at, items: o.items, total: Number(o.total), estado: o.estado, canal: o.canal, exemplo: o.exemplo, cliente: o.cliente }));
  }

  /* ---------- Opiniões ---------- */
  async function refreshReviews() {
    if (!LIVE) { reviews = ls.get("ss_reviews", []); return; }
    const r = await sb.from("reviews").select("*").order("created_at", { ascending: false }).limit(500);
    reviewsMissing = !!r.error;
    if (!r.error) reviews = r.data;
  }
  const saveReviewsLocal = () => { if (!LIVE) ls.set("ss_reviews", reviews); };
  async function updateReview(rv, patch) {
    if (LIVE) { const r = await sb.from("reviews").update(patch).eq("id", rv.id); if (r.error) { toast("Não foi possível guardar", true); return false; } }
    Object.assign(rv, patch); saveReviewsLocal(); return true;
  }
  async function deleteReview(id) {
    if (LIVE) { const r = await sb.from("reviews").delete().eq("id", id); if (r.error) { toast("Não foi possível apagar", true); return false; } }
    reviews = reviews.filter(x => x.id !== id); saveReviewsLocal(); return true;
  }
  const pendingReviews = () => reviews.filter(r => !r.aprovado).length;

  /* ---------- Ajudas de produto ---------- */
  const nameOf = (p) => p.nome || p.sabor || "Sem nome";
  const priceOf = (p) => p.preco ?? (p.precos ? Object.values(p.precos)[0] : null);
  const STOCK_IMG = { "carv-cocodalya-1kg": "brasas", "carv-cocodalya-4kg": "carvaoFumo", "acc-kaloud": "cabecote" };
  function imgOf(p) {
    if (p.img) return p.img;
    if (p.semFoto) return null;
    if (FOTOS.includes(p.id)) return `img/${p.id}.jpg`;
    if (FOTOS_LIVRES[p.id]) { const [id, crop] = FOTOS_LIVRES[p.id].split("|"); return `https://images.unsplash.com/${id}?w=200&h=200&q=70&auto=format&fit=crop${crop ? "&crop=" + crop : ""}`; }
    if (STOCK_IMG[p.id]) return stock(STOCK_IMG[p.id], 200);
    return null;
  }
  function thumb(p, cls = "thumb") {
    const src = imgOf(p);
    if (src) return `<img class="${cls}" src="${esc(src)}" alt="" loading="lazy">`;
    const ini = nameOf(p).split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
    return `<span class="${cls}" style="background:${esc(p.cor || "#999")}">${esc(ini)}</span>`;
  }
  const allProducts = () => Object.entries(CATS).flatMap(([cat]) => db[cat].map(p => ({ p, cat })));
  const findProduct = (id) => { for (const cat of Object.keys(CATS)) { const i = db[cat].findIndex(p => p.id === id); if (i > -1) return { cat, i, p: db[cat][i] }; } return null; };

  /* ---------- Ícones ---------- */
  const I = {
    box: `<svg viewBox="0 0 24 24"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/></svg>`,
    bag: `<svg viewBox="0 0 24 24"><path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>`,
    euro: `<svg viewBox="0 0 24 24"><path d="M17 6.5A7 7 0 1 0 17 17.5"/><path d="M4 10h9M4 14h9"/></svg>`,
    alert: `<svg viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v4M12 17h.01"/></svg>`,
    edit: `<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m13 7 4 4"/></svg>`,
    copy: `<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>`,
    trash: `<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>`,
    plus: `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`,
    search: `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
    eye: `<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
    check: `<svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>`,
    wa: `<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z"/></svg>`,
    down: `<svg viewBox="0 0 24 24"><path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 17v3h16v-3"/></svg>`,
    up: `<svg viewBox="0 0 24 24"><path d="M12 15V3m0 0L8 7m4-4 4 4"/><path d="M4 17v3h16v-3"/></svg>`,
    reset: `<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>`,
    info: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>`,
    file: `<svg viewBox="0 0 24 24"><path d="M14 3H6v18h12V7l-4-4z"/><path d="M14 3v4h4"/></svg>`,
    clock: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
    pen: `<svg viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>`,
  };

  /* =========================================================
     LOGIN
     - Modo real: email + palavra-passe (Supabase Auth)
     - Modo demonstração: PIN (não é segurança real)
     ========================================================= */
  let session = null;
  const pinOk = () => LIVE ? !!session : sessionStorage.getItem("ss_admin") === "1";
  function showLogin() {
    $("#login").hidden = false; $("#app").hidden = true;
    $("#loginLive").hidden = !LIVE; $("#loginDemo").hidden = LIVE;
    setTimeout(() => (LIVE ? $("#email") : $("#pin")).focus(), 50);
  }
  async function showApp() {
    $("#login").hidden = true; $("#app").hidden = false;
    if (LIVE) {
      $("#view").innerHTML = `<div class="empty">A carregar a loja…</div>`;
      try { await loadRemote(); } catch (err) { console.error(err); $("#view").innerHTML = `<div class="empty">Não foi possível ligar à base de dados.<br>Verifica a internet e recarrega a página.</div>`; return; }
    }
    render();
  }
  function loginError(msg) { const e = $("#loginErr"); e.textContent = msg; e.hidden = false; const c = $(".login__card"); c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake"); }
  let tries = 0;
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!LIVE) {
      if ($("#pin").value === String(db.store.pin || "1234")) { sessionStorage.setItem("ss_admin", "1"); $("#loginErr").hidden = true; showApp(); }
      else { $("#pin").value = ""; loginError("PIN incorreto. Tenta outra vez."); }
      return;
    }
    if (!$("#email").value.trim() || !$("#password").value) return loginError("Escreve o email e a palavra-passe.");
    if (++tries > 5) { loginError("Demasiadas tentativas. Espera um minuto."); setTimeout(() => tries = 0, 60000); return; }
    const btn = $("#loginBtn"); btn.disabled = true; btn.textContent = "A entrar…";
    const { data, error } = await sb.auth.signInWithPassword({ email: $("#email").value.trim(), password: $("#password").value });
    btn.disabled = false; btn.textContent = "Entrar";
    if (error) { $("#password").value = ""; return loginError("Email ou palavra-passe incorretos."); }
    session = data.session; tries = 0; $("#loginErr").hidden = true; $("#password").value = ""; showApp();
  });
  $("#logout").addEventListener("click", async () => {
    if (LIVE) { await sb.auth.signOut(); session = null; } else sessionStorage.removeItem("ss_admin");
    location.hash = ""; showLogin();
  });
  if (LIVE) sb.auth.onAuthStateChange((_ev, s) => { session = s; if (!s && !$("#app").hidden) showLogin(); });

  /* =========================================================
     ROUTER
     ========================================================= */
  const state = { cat: "todos", q: "", estado: "todas" };
  function route() { return (location.hash.replace(/^#\/?/, "").split("?")[0] || "painel"); }
  function setHeader(title, sub = "", actions = "") { $("#pageTitle").textContent = title; $("#pageSub").textContent = sub; $("#topActions").innerHTML = actions; }
  function render() {
    if (!pinOk()) return showLogin();
    const r = route();
    $$("[data-nav]").forEach(a => a.classList.toggle("is-active", a.dataset.nav === r));
    $("#side").classList.remove("is-open");
    (views[r] || views.painel)();
    const n = orders.filter(o => o.estado === "nova").length;
    $("#newOrders").textContent = n; $("#newOrders").hidden = !n;
    $("#newOrders2").textContent = n; $("#newOrders2").hidden = !n;
    const nr = pendingReviews(); $("#newReviews").textContent = nr; $("#newReviews").hidden = !nr;
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", () => { closePanel(); render(); });
  const views = {};

  /* ---------- RESUMO ---------- */
  views.painel = () => {
    const prods = allProducts();
    const out = prods.filter(x => x.p.esgotado);
    const toConfirm = prods.filter(x => x.p.confirmar);
    const valid = orders.filter(o => o.estado !== "cancelada");
    const now = new Date();
    const month = valid.filter(o => { const d = new Date(o.data); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
    const revenue = month.reduce((s, o) => s + o.total, 0);
    const avg = valid.length ? valid.reduce((s, o) => s + o.total, 0) / valid.length : 0;
    // últimos 7 dias
    const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return d; });
    const perDay = days.map(d => valid.filter(o => { const x = new Date(o.data); x.setHours(0, 0, 0, 0); return +x === +d; }).reduce((s, o) => s + o.total, 0));
    const max = Math.max(...perDay, 1);
    // mais vendidos
    const sold = {};
    valid.forEach(o => o.items.forEach(it => { sold[it.id] = sold[it.id] || { nome: it.nome, qty: 0, id: it.id }; sold[it.id].qty += it.qty; }));
    const top = Object.values(sold).sort((a, b) => b.qty - a.qty).slice(0, 5);

    const novas = orders.filter(o => o.estado === "nova").length;
    const hora = now.getHours();
    setHeader(`${hora < 13 ? "Bom dia" : hora < 20 ? "Boa tarde" : "Boa noite"}! 👋`, `Este é o resumo da ${db.store.nome} hoje.`, `<a class="btn btn--ghost" href="index.html" target="_blank">${I.eye} Ver a minha loja</a>`);
    $("#view").innerHTML = `
      ${ls.get("ss_help_off", false) ? "" : `
      <div class="help">
        <div><h3>Primeira vez aqui? É simples:</h3>
          <ol><li><b>Produtos</b> → toca no preço para o mudar, ou no interruptor para marcar como esgotado.</li>
          <li><b>Encomendas</b> → quando um cliente encomenda pelo site, aparece aqui. Vai mudando o estado até "Entregue".</li>
          <li>Tudo o que mudas fica <b>guardado sozinho</b> e aparece logo na loja.</li></ol></div>
        <button class="icon-btn" data-help-off title="Fechar ajuda"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>`}
      <h2 class="h-sec">O que queres fazer?</h2>
      <div class="quick">
        <a href="#/produtos?novo" class="quick__item"><span class="quick__ic" style="background:#111;color:#fff">${I.plus}</span><b>Adicionar produto</b><small>Nova shisha, sabor ou acessório</small></a>
        <a href="#/produtos" class="quick__item"><span class="quick__ic" style="background:#fdf3e1;color:#8c6d3f">${I.euro}</span><b>Mudar preços e stock</b><small>Toca no preço para o alterar</small></a>
        <a href="#/encomendas" class="quick__item"><span class="quick__ic" style="background:#eff6ff;color:#2563eb">${I.bag}</span><b>Ver encomendas</b><small>${novas ? `<span class="dot-new"></span>${novas} nova${novas > 1 ? "s" : ""} à espera` : "Nenhuma nova"}</small></a>
        <a href="#/loja" class="quick__item"><span class="quick__ic" style="background:#f0fdf4;color:#16a34a">${I.clock}</span><b>Horário e contactos</b><small>Morada, telefone e avisos</small></a>
        <a href="#/inicio" class="quick__item"><span class="quick__ic" style="background:#f3e8ff;color:#7c3aed">🖼️</span><b>Página inicial</b><small>Fotos do topo, faixa e categorias</small></a>
      </div>
      <h2 class="h-sec">Como vai a loja</h2>
      <div class="kpis">
        ${kpi(I.euro, "#fdf3e1", "#8c6d3f", "Vendas este mês", eur(revenue), `${month.length} encomenda${month.length === 1 ? "" : "s"}`)}
        ${kpi(I.bag, "#eff6ff", "#2563eb", "Encomendas novas", orders.filter(o => o.estado === "nova").length, "à espera de confirmação")}
        ${kpi(I.box, "#f0fdf4", "#16a34a", "Produtos à venda", prods.filter(x => !x.p.oculto && !x.p.esgotado).length, `${prods.length} no catálogo`)}
        ${kpi(I.alert, "#fef2f2", "#dc2626", "Esgotados", out.length, `Valor médio por encomenda: ${eur(avg)}`)}
      </div>
      <div class="two">
        <div class="card">
          <div class="card__head"><h3>Vendas dos últimos 7 dias</h3><span class="muted">${eur(perDay.reduce((a, b) => a + b, 0))}</span></div>
          <div class="card__body">
            ${valid.length ? `<div class="bars">${days.map((d, i) => `
              <div class="bar ${i === 6 ? "is-today" : ""}"><div class="bar__fill" style="height:${Math.round(perDay[i] / max * 100)}%">${perDay[i] ? `<span>${Math.round(perDay[i])}€</span>` : ""}</div>
              <span class="bar__label">${i === 6 ? "Hoje" : d.toLocaleDateString("pt-PT", { weekday: "short" }).replace(".", "")}</span></div>`).join("")}</div>`
            : `<div class="empty">Ainda não há encomendas.<br>As encomendas feitas no carrinho da loja aparecem aqui.<br><button class="btn btn--gold btn--sm" data-demo-orders>${I.plus} Gerar encomendas de exemplo</button></div>`}
          </div>
        </div>
        <div class="card">
          <div class="card__head"><h3>Mais vendidos</h3><a class="muted" href="#/encomendas">Ver encomendas →</a></div>
          ${top.length ? `<ul class="list">${top.map((t, i) => { const f = findProduct(t.id); return `<li>${f ? thumb(f.p) : `<span class="thumb" style="background:#999">${i + 1}</span>`}<div class="list__main"><strong>${esc(t.nome)}</strong><span>${t.qty} vendido${t.qty > 1 ? "s" : ""}</span></div></li>`; }).join("")}</ul>`
          : `<div class="empty">Sem vendas registadas.</div>`}
        </div>
      </div>
      <div class="two" style="margin-top:16px">
        <div class="card">
          <div class="card__head"><h3>Últimas encomendas</h3><a class="muted" href="#/encomendas">Ver todas →</a></div>
          ${orders.length ? `<ul class="list">${orders.slice(0, 5).map(o => `<li style="cursor:pointer" data-order="${o.n}"><div class="list__main"><strong>#${o.n} · ${o.items.map(i => i.nome).join(", ")}</strong><span>${fmtDate(o.data)}</span></div><span class="pill st-${o.estado}">${ESTADOS[o.estado]}</span><strong>${eur(o.total)}</strong></li>`).join("")}</ul>`
          : `<div class="empty">Ainda não há encomendas.</div>`}
        </div>
        <div class="card">
          <div class="card__head"><h3>Precisa de atenção</h3></div>
          ${out.length || toConfirm.length || pendingReviews() ? `<ul class="list">
            ${pendingReviews() ? `<li><a href="#/opinioes" class="list__link"><span class="thumb" style="background:#fdf3e1;color:#8c6d3f">★</span><div class="list__main"><strong>${pendingReviews()} opini${pendingReviews() > 1 ? "ões" : "ão"} por aprovar</strong><span>Lê e publica na loja</span></div><span class="pill st-nova">Ver</span></a></li>` : ""}
            ${out.map(({ p }) => `<li style="cursor:pointer" data-edit="${p.id}">${thumb(p)}<div class="list__main"><strong>${esc(nameOf(p))}</strong><span>Sem stock</span></div><span class="pill st-esgotado">Esgotado</span></li>`).join("")}
            ${toConfirm.slice(0, 6).map(({ p }) => `<li style="cursor:pointer" data-edit="${p.id}">${thumb(p)}<div class="list__main"><strong>${esc(nameOf(p))}</strong><span>Preço por confirmar</span></div><span class="pill st-confirmada">Confirmar</span></li>`).join("")}
            ${toConfirm.length > 6 ? `<li><span class="muted">+ ${toConfirm.length - 6} produtos com preço por confirmar</span></li>` : ""}
          </ul>` : `<div class="empty">Está tudo em ordem 👌</div>`}
        </div>
      </div>`;
  };
  function kpi(icon, bg, fg, label, value, sub) {
    return `<div class="card kpi"><span class="kpi__icon" style="background:${bg};color:${fg}">${icon}</span><div><div class="kpi__label">${label}</div><div class="kpi__value">${value}</div><div class="kpi__sub">${sub}</div></div></div>`;
  }
  const fmtDate = (iso) => new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  /* ---------- PRODUTOS ---------- */
  views.produtos = () => {
    setHeader("Produtos", "Toca no preço para o mudar. Usa os interruptores para stock e destaques.", `<button class="btn btn--dark" data-new>${I.plus} Adicionar produto</button>`);
    const counts = Object.fromEntries(Object.keys(CATS).map(c => [c, db[c].length]));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    $("#view").innerHTML = `
      <div class="toolbar">
        <div class="tabs" id="tabs">
          <button data-cat="todos" class="${state.cat === "todos" ? "is-on" : ""}">Todos <i>${total}</i></button>
          ${Object.entries(CATS).map(([k, c]) => `<button data-cat="${k}" class="${state.cat === k ? "is-on" : ""}">${c.label} <i>${counts[k]}</i></button>`).join("")}
        </div>
        <label class="search">${I.search}<input id="q" type="search" placeholder="Procurar produto ou marca…" value="${esc(state.q)}"></label>
        <select class="select" id="fstock">
          <option value="">Mostrar todos</option><option value="stock">Só disponíveis</option><option value="esgotado">Só esgotados</option><option value="oculto">Só escondidos da loja</option><option value="confirmar">Preço por confirmar</option>
        </select>
      </div>
      <div class="card table-wrap"><table class="t">
        <thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th title="Desliga quando acabar o stock">Disponível</th><th title="Aparece em destaque na página inicial">Destaque</th><th title="Desliga para esconder o produto da loja">Na loja</th><th></th></tr></thead>
        <tbody id="rows"></tbody>
      </table></div>`;
    drawRows();
    if (location.hash.includes("novo")) { history.replaceState(null, "", "#/produtos"); openEditor(); }
  };
  function drawRows() {
    const q = state.q.trim().toLowerCase(), f = $("#fstock")?.value || "";
    let list = allProducts().filter(({ cat }) => state.cat === "todos" || cat === state.cat);
    if (q) list = list.filter(({ p }) => `${nameOf(p)} ${p.marca || ""} ${p.notas || ""}`.toLowerCase().includes(q));
    if (f === "stock") list = list.filter(({ p }) => !p.esgotado);
    if (f === "esgotado") list = list.filter(({ p }) => p.esgotado);
    if (f === "oculto") list = list.filter(({ p }) => p.oculto);
    if (f === "confirmar") list = list.filter(({ p }) => p.confirmar);
    $("#rows").innerHTML = list.length ? list.map(({ p, cat }) => `
      <tr class="${p.oculto ? "is-hidden" : ""}">
        <td class="td-prod"><div class="prod" style="cursor:pointer" data-edit="${p.id}">${thumb(p)}<div><strong>${esc(nameOf(p))}</strong><span>${esc(p.marca || "")}${p.altura ? ` · ${p.altura} cm` : ""}${p.cores?.length ? ` · ${p.cores.length} cor${p.cores.length > 1 ? "es" : ""}` : ""}</span></div></div></td>
        <td data-label="Categoria">${CATS[cat].label}</td>
        <td data-label="Preço" class="price">${p.precos
          ? Object.entries(p.precos).map(([k, v]) => `<button class="price-btn" data-price="${p.id}" data-size="${k}" title="Tocar para mudar">${eur(v)} <span class="muted">${k}</span> ${I.pen}</button>`).join("")
          : `<button class="price-btn" data-price="${p.id}" title="Tocar para mudar">${priceOf(p) == null ? `<span class="muted">Sob consulta</span>` : eur(priceOf(p))} ${I.pen}</button>`}${p.confirmar ? "<small>por confirmar</small>" : ""}</td>
        <td data-label="Disponível"><label class="switch"><input type="checkbox" data-toggle="stock" data-id="${p.id}" ${p.esgotado ? "" : "checked"}><i></i>${p.esgotado ? "Esgotado" : "Sim"}</label></td>
        <td data-label="Destaque"><label class="switch switch--gold"><input type="checkbox" data-toggle="destaque" data-id="${p.id}" ${p.destaque || p.top ? "checked" : ""}><i></i></label></td>
        <td data-label="Na loja"><label class="switch"><input type="checkbox" data-toggle="visivel" data-id="${p.id}" ${p.oculto ? "" : "checked"}><i></i>${p.oculto ? "Escondido" : ""}</label></td>
        <td class="td-act"><div class="actions">
          <button class="act" data-edit="${p.id}">${I.edit}<span>Editar</span></button>
          <button class="act" data-dup="${p.id}" title="Criar uma cópia para um produto parecido">${I.copy}<span>Duplicar</span></button>
          <button class="act act--del" data-del="${p.id}">${I.trash}<span>Apagar</span></button>
        </div></td>
      </tr>`).join("") : `<tr><td colspan="7"><div class="empty">Nenhum produto encontrado.</div></td></tr>`;
  }

  // mudar o preço diretamente na lista (tocar no preço → escrever → Enter)
  function editPrice(btn) {
    const f = findProduct(btn.dataset.price); if (!f) return;
    const size = btn.dataset.size, cur = size ? f.p.precos[size] : f.p.preco;
    const inp = document.createElement("input");
    Object.assign(inp, { type: "number", step: "0.01", min: "0", className: "price-input", value: cur ?? "", placeholder: size ? "0,00" : "Sob consulta" });
    const wrap = document.createElement("span"); wrap.className = "price-wrap";
    wrap.append(inp, Object.assign(document.createElement("span"), { textContent: size ? `€ ${size}` : "€" }));
    btn.replaceWith(wrap); inp.focus(); inp.select();
    let done = false;
    const commit = (ok) => {
      if (done) return; done = true;
      if (ok) {
        const v = inp.value.trim(), n = v === "" ? null : Math.round(parseFloat(v.replace(",", ".")) * 100) / 100;
        if (v !== "" && (isNaN(n) || n < 0)) toast("Preço inválido", true);
        else if (size && n == null) toast("Escreve um preço", true);
        else if (n !== cur) {
          if (size) f.p.precos[size] = n; else f.p.preco = n;
          delete f.p.confirmar;
          save(`${nameOf(f.p)}: ${n == null ? "Sob consulta" : eur(n)}`);
        }
      }
      drawRows();
    };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") commit(true); if (e.key === "Escape") { e.stopPropagation(); commit(false); } });
    inp.addEventListener("blur", () => commit(true));
  }

  /* ---------- Editor de produto ---------- */
  let editing = null; // { cat, i (ou -1), p }
  function openEditor(id, dup = false) {
    const f = id ? findProduct(id) : null;
    const cat = f ? f.cat : (state.cat !== "todos" ? state.cat : "shishas");
    if (cat === "packs") return openPackEditor(id, dup);
    const p = f ? clone(f.p) : { marca: "", cor: "#b08d57" };
    if (dup) { p.id = ""; if (p.nome) p.nome += " (cópia)"; if (p.sabor) p.sabor += " (cópia)"; }
    editing = { cat, i: f && !dup ? f.i : -1, p, img: imgOf(p) };
    $("#panelTitle").textContent = f && !dup ? `Editar ${CATS[cat].one}` : `Novo produto`;
    drawEditor();
    $("#panel").classList.add("is-open"); $("#panel").setAttribute("aria-hidden", "false"); $("#overlay").classList.add("is-on");
  }
  function closePanel() { $("#side").classList.remove("is-open"); $("#panel").classList.remove("is-open"); $("#panel").setAttribute("aria-hidden", "true"); $("#overlay").classList.remove("is-on"); editing = null; }

  function drawEditor() {
    const { cat, p, i } = editing;
    const isNew = i === -1;
    const fld = (name, label, val, type = "text", extra = "") => `<div class="field"><label for="f_${name}">${label}</label><input id="f_${name}" name="${name}" type="${type}" value="${esc(val ?? "")}" ${extra}></div>`;
    const money = (name, label, val) => `<div class="field"><label for="f_${name}">${label}</label><div class="prefix"><input id="f_${name}" name="${name}" type="number" step="0.01" min="0" value="${val ?? ""}" placeholder="0,00"><span>€</span></div></div>`;
    let specific = "";
    if (cat === "shishas") specific = `
      <div class="row--3 row">${fld("altura", "Altura (cm)", p.altura, "number", 'min="5" max="150"')}
        <div class="field"><label for="f_estilo">Estilo</label><select id="f_estilo" name="estilo">${Object.entries(ESTILOS).map(([k, v]) => `<option value="${k}" ${p.estilo === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        ${money("preco", "Preço", p.preco)}</div>
      <div class="field"><label for="f_inclui">O que inclui</label><input id="f_inclui" name="inclui" value="${esc(p.inclui || "")}" placeholder="Mangueira, pinça, cabeçote de barro"><small>Deixa o preço vazio para mostrar "Sob consulta".</small></div>`;
    else if (cat === "essencias") specific = `
      <div class="field"><label for="f_notas">Notas de sabor</label><input id="f_notas" name="notas" value="${esc(p.notas || "")}" placeholder="Melancia, melão e menta"></div>
      <div class="row">${money("p50", "Preço 50g", p.precos?.["50g"])}${money("p200", "Preço 200g", p.precos?.["200g"])}</div>`;
    else if (cat === "packs") specific = `
      ${money("preco", "Preço", p.preco)}
      <div class="field"><label for="f_inclui">O que inclui</label><textarea id="f_inclui" name="incluiPack" placeholder="Um item por linha">${esc((p.inclui || []).join("\n"))}</textarea><small>Um item por linha.</small></div>`;
    else specific = money("preco", "Preço", p.preco);

    $("#panelBody").innerHTML = `
      <form class="form" id="prodForm">
        ${isNew ? `<div class="section-title">1. O que vais adicionar?</div>
        <div class="cat-pick">${Object.entries(CATS).map(([k, c]) => `<button type="button" data-pick-cat="${k}" class="${k === cat ? "is-on" : ""}"><span>${CAT_EMOJI[k]}</span>${c.label}</button>`).join("")}</div>` : ""}
        <div class="section-title">${isNew ? "2. " : ""}Foto</div>
        <div class="photo">
          <div class="photo__prev" id="photoPrev" style="background:${esc(p.cor || "#999")}">${editing.img ? `<img src="${esc(editing.img)}" alt="">` : "📷"}</div>
          <div class="photo__btns">
            <label class="btn btn--dark btn--sm" style="cursor:pointer">📷 ${editing.img ? "Trocar foto" : "Tirar ou escolher foto"}<input type="file" accept="image/*" id="f_file" hidden></label>
            ${editing.img ? `<button type="button" class="btn btn--sm btn--ghost" id="rmPhoto">${I.trash} Remover foto</button>` : `<small class="muted">Do telemóvel ou do computador. Fundo limpo fica melhor.</small>`}
          </div>
        </div>
        <div class="section-title">${isNew ? "3. " : ""}Nome e preço</div>
        <div class="row">
          ${fld(cat === "essencias" ? "sabor" : "nome", cat === "essencias" ? "Sabor" : "Nome", cat === "essencias" ? p.sabor : p.nome, "text", 'required')}
          ${cat === "packs" ? "" : fld("marca", "Marca", p.marca)}
        </div>
        ${specific}
        ${cat === "shishas" ? `<div class="section-title">Cores <small class="muted" style="text-transform:none;letter-spacing:0;font-weight:400">(opcional)</small></div><div id="coresBox">${coresHTML()}</div>` : ""}
        <div class="section-title">${isNew ? "4. " : ""}Na loja</div>
        <div class="toggles">
          <label class="switch"><input type="checkbox" name="stock" ${p.esgotado ? "" : "checked"}><i></i><span><b>Disponível</b><small>Desliga quando esgotar</small></span></label>
          <label class="switch"><input type="checkbox" name="visivel" ${p.oculto ? "" : "checked"}><i></i><span><b>Mostrar na loja</b><small>Desliga para esconder</small></span></label>
          <label class="switch switch--gold"><input type="checkbox" name="destaque" ${p.destaque || p.top ? "checked" : ""}><i></i><span><b>Destacar</b><small>Aparece primeiro</small></span></label>
          <label class="switch switch--gold"><input type="checkbox" name="novo" ${p.novo ? "checked" : ""}><i></i><span><b>Etiqueta "Novo"</b><small>Para novidades</small></span></label>
        </div>
        <details class="adv">
          <summary>Mais opções</summary>
          <div class="form" style="margin-top:12px">
            <div class="field"><label for="f_img">Link de uma imagem (em vez de carregar)</label><input type="url" id="f_img" placeholder="https://…" value="${esc(p.img && !p.img.startsWith("data:") ? p.img : "")}"></div>
            <div class="field"><label>Cor do desenho (quando não há foto)</label><div class="color"><input type="color" name="cor" value="${esc(p.cor || "#b08d57")}"><span class="muted">${esc(p.cor || "")}</span></div></div>
            <label class="switch"><input type="checkbox" name="confirmar" ${p.confirmar ? "checked" : ""}><i></i>Marcar preço como "por confirmar"</label>
          </div>
        </details>
      </form>`;
    $("#panelFoot").innerHTML = `
      ${isNew ? "" : `<button class="btn btn--danger spacer" data-del="${p.id}">${I.trash} Apagar</button>`}
      <button class="btn btn--ghost" data-close>Cancelar</button>
      <button class="btn btn--dark" id="saveProd">${I.check} Guardar</button>`;

    $$("[data-pick-cat]").forEach(b => b.addEventListener("click", () => {
      if (b.dataset.pickCat === "packs") return openPackEditor();
      readForm(); editing.cat = b.dataset.pickCat; drawEditor();
    }));
    $("#f_file").addEventListener("change", async (e) => {
      const file = e.target.files[0]; if (!file) return;
      readForm(); editing.img = await compress(file); editing.p.img = editing.img; delete editing.p.semFoto;
      drawEditor(); toast("Foto pronta — carrega em Guardar");
    });
    $("#f_img").addEventListener("change", (e) => {
      const v = e.target.value.trim(); if (!v) return;
      editing.img = v; editing.p.img = v; $("#photoPrev").innerHTML = `<img src="${esc(v)}" alt="">`;
    });
    $("#rmPhoto")?.addEventListener("click", () => { readForm(); editing.p.img = null; editing.img = null; editing.p._semFoto = true; drawEditor(); });
  }

  const COR_PRESETS = [["Preto", "#111111"], ["Branco", "#f5f5f5"], ["Dourado", "#c9a227"], ["Prateado", "#bfc3c7"], ["Azul", "#2563eb"], ["Vermelho", "#dc2626"], ["Verde", "#16a34a"], ["Rosa", "#ec4899"], ["Roxo", "#7c3aed"], ["Laranja", "#ea580c"]];
  function coresHTML() {
    const cs = editing.p.cores || [];
    return `${cs.length ? `<div class="cores">${cs.map((c, i) => `
      <div class="cor-row ${c.esgotada ? "is-off" : ""}">
        <input type="color" data-cor="${i}" data-k="hex" value="${esc(/^#[0-9a-f]{6}$/i.test(c.hex || "") ? c.hex : "#111111")}" aria-label="Escolher a cor">
        <input type="text" data-cor="${i}" data-k="nome" value="${esc(c.nome)}" placeholder="Nome da cor" maxlength="30" aria-label="Nome da cor">
        <label class="cor-photo" title="${c.img ? "Trocar a foto desta cor" : "Foto desta cor (opcional)"}">${c.img ? `<img src="${esc(c.img)}" alt="">` : "📷"}<input type="file" accept="image/*" data-corfile="${i}" hidden></label>
        <label class="switch" title="Disponível"><input type="checkbox" data-cor="${i}" data-k="stock" ${c.esgotada ? "" : "checked"}><i></i></label>
        <button type="button" class="icon-btn" data-cordel="${i}" title="Apagar esta cor">${I.trash}</button>
      </div>`).join("")}</div>
      <small class="muted">📷 foto dessa cor (opcional) · interruptor desligado = cor esgotada.</small>`
      : `<p class="muted small" style="margin:0 0 8px">Se esta shisha existe em várias cores, junta-as aqui. O cliente escolhe a cor na loja e ela aparece na encomenda.</p>`}
      <div class="cor-presets">${COR_PRESETS.map(([n, h]) => `<button type="button" class="cor-chip" data-coradd="${n}|${h}"><i style="background:${h}"></i>${n}</button>`).join("")}<button type="button" class="cor-chip" data-coradd="|#888888">${I.plus} Outra cor</button></div>`;
  }
  const redrawCores = () => { const b = $("#coresBox"); if (b) b.innerHTML = coresHTML(); };

  function readForm() {
    const form = $("#prodForm"); if (!form) return;
    const v = (n) => form.elements[n]?.value?.trim();
    const num = (n) => { const x = v(n); return x === "" || x == null ? null : Math.round(parseFloat(x.replace(",", ".")) * 100) / 100; };
    const ch = (n) => form.elements[n]?.checked;
    const p = editing.p, cat = editing.cat;
    if (cat === "essencias") { p.sabor = v("sabor") ?? p.sabor; delete p.nome; } else if (v("nome") != null) p.nome = v("nome");
    if (form.elements.marca) p.marca = v("marca");
    if (cat === "shishas") { p.altura = num("altura") ?? p.altura ?? 40; p.estilo = v("estilo") || "moderno"; p.inclui = v("inclui") || ""; p.preco = num("preco"); }
    else if (cat === "essencias") { p.notas = v("notas") || ""; p.precos = {}; const a = num("p50"), b = num("p200"); if (a != null) p.precos["50g"] = a; if (b != null) p.precos["200g"] = b; delete p.preco; }
    else if (cat === "packs") { p.preco = num("preco"); p.inclui = (form.elements.incluiPack?.value || "").split("\n").map(s => s.trim()).filter(Boolean); }
    else p.preco = num("preco");
    p.cor = form.elements.cor?.value || p.cor;
    const flag = (k, on) => { if (on) p[k] = true; else delete p[k]; };
    flag("esgotado", !ch("stock")); flag("oculto", !ch("visivel")); flag("novo", ch("novo")); flag("confirmar", ch("confirmar"));
    if (cat === "shishas" || cat === "packs") { flag("destaque", ch("destaque")); delete p.top; } else { flag("top", ch("destaque")); delete p.destaque; }
    const url = $("#f_img")?.value.trim();
    if (url) p.img = url; else if (editing.img && editing.img.startsWith("data:")) p.img = editing.img;
    if (!p.img) delete p.img;
  }

  function saveProduct() {
    readForm();
    const { cat, p } = editing;
    if (!nameOf(p) || nameOf(p) === "Sem nome") { $("#prodForm .field input[required]").closest(".field").classList.add("field--err"); toast("Falta o nome do produto", true); return; }
    if (cat === "essencias" && !Object.keys(p.precos || {}).length) { toast("Indica pelo menos um preço", true); return; }
    if (cat === "packs" && !p.inclui.length) p.inclui = ["Shisha"];
    // limpar campos de outras categorias (ao trocar de tipo num produto novo)
    if (cat !== "shishas") { delete p.altura; delete p.estilo; delete p.cores; if (cat !== "packs") delete p.inclui; }
    else {
      const seen = new Set();
      p.cores = (p.cores || []).map(c => ({ nome: String(c.nome || "").replace(/[<>|]/g, "").trim().slice(0, 30), hex: /^#[0-9a-f]{6}$/i.test(c.hex || "") ? c.hex : "#888888", ...(c.img ? { img: c.img } : {}), ...(c.esgotada ? { esgotada: true } : {}) }))
        .filter(c => c.nome && !seen.has(c.nome.toLowerCase()) && seen.add(c.nome.toLowerCase()));
      if (!p.cores.length) delete p.cores;
    }
    if (cat !== "essencias") { delete p.notas; delete p.precos; delete p.sabor; }
    if (cat === "packs") delete p.marca;
    // foto removida → impedir que a foto original volte a aparecer
    if (p.img) delete p.semFoto; else if (p._semFoto) p.semFoto = true;
    delete p._semFoto;
    if (editing.i === -1) {
      let id = (cat.slice(0, 3) + "-" + slug(nameOf(p))) || "prod-" + Date.now();
      while (findProduct(id)) id += "-2";
      p.id = id;
      db[cat].unshift(p);
    } else {
      const f = findProduct(p.id);
      if (f.cat !== cat) { db[f.cat].splice(f.i, 1); db[cat].unshift(p); } else db[cat][f.i] = p;
    }
    save(editing.i === -1 ? "Produto criado" : "Produto atualizado");
    closePanel(); render();
  }

  // comprime a foto (máx. 800px) para caber no navegador
  function compress(file) {
    return new Promise((res) => {
      const r = new FileReader();
      r.onload = () => { const im = new Image(); im.onload = () => {
        // máx. 900px e formato WebP (≈60–120 KB por foto); JPEG se o navegador não suportar WebP
        const s = Math.min(1, 900 / Math.max(im.width, im.height)); const c = document.createElement("canvas");
        c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
        const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0, c.width, c.height);
        const webp = c.toDataURL("image/webp", .78);
        res(webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/jpeg", .8)); }; im.src = r.result; };
      r.readAsDataURL(file);
    });
  }

  /* ---------- PACKS ---------- */
  const packValue = (pk) => (pk.itens || []).reduce((s, it) => { const f = findProduct(it.id); return s + (f ? (it.size && f.p.precos ? f.p.precos[it.size] || 0 : priceOf(f.p) || 0) * (it.qty || 1) : 0); }, 0);
  views.packs = () => {
    setHeader("Packs", "Junta vários produtos num pack com desconto. Os clientes adoram!", `<button class="btn btn--dark" data-pack-new>${I.plus} Criar pack</button>`);
    $("#view").innerHTML = db.packs.length ? `
      <div class="packs-grid">${db.packs.map(pk => {
        const val = packValue(pk), save = val && pk.preco != null ? val - pk.preco : 0;
        return `<div class="card pack-card ${pk.oculto ? "is-hidden" : ""}">
          <div class="pack-card__img">${imgOf(pk) ? thumb(pk, "pack-card__photo") : `<span class="pack-card__photo" style="background:${esc(pk.cor || "#b08d57")}">📦</span>`}${pk.destaque ? `<span class="pill st-confirmada" style="position:absolute;top:10px;left:10px">⭐ Destaque</span>` : ""}${pk.esgotado ? `<span class="pill st-esgotado" style="position:absolute;top:10px;right:10px">Esgotado</span>` : ""}</div>
          <div class="pack-card__body">
            <h3>${esc(pk.nome)}</h3>
            <div class="pack-card__price">${pk.preco == null ? "Sob consulta" : eur(pk.preco)}${save > 0 ? `<span class="pack-save">Poupa ${eur(save)}</span>` : ""}</div>
            <ul>${(pk.inclui || []).slice(0, 6).map(i => `<li>${esc(i)}</li>`).join("")}${(pk.inclui || []).length > 6 ? `<li class="muted">+ ${pk.inclui.length - 6} mais</li>` : ""}</ul>
            <div class="actions" style="justify-content:flex-start">
              <button class="act" data-edit="${pk.id}">${I.edit}<span>Editar</span></button>
              <button class="act" data-dup="${pk.id}">${I.copy}<span>Duplicar</span></button>
              <button class="act act--del" data-del="${pk.id}">${I.trash}<span>Apagar</span></button>
            </div>
          </div>
        </div>`; }).join("")}
        <button class="card pack-card pack-card--new" data-pack-new><span>${I.plus}</span><b>Criar novo pack</b><small>Escolhe os produtos e o preço</small></button>
      </div>`
      : `<div class="card empty">Ainda não tens packs.<br><button class="btn btn--dark btn--sm" data-pack-new>${I.plus} Criar o primeiro pack</button></div>`;
  };

  function openPackEditor(id, dup = false) {
    const f = id ? findProduct(id) : null;
    const pk = f ? clone(f.p) : { nome: "", preco: null, inclui: [], itens: [], cor: "#b08d57" };
    if (dup) { pk.id = ""; pk.nome += " (cópia)"; }
    // packs antigos só têm texto: ficam como "outros itens"
    if (!pk.itens) { pk.itens = []; pk.extras = [...(pk.inclui || [])]; }
    if (!pk.extras) pk.extras = [];
    editing = { cat: "packs", i: f && !dup ? f.i : -1, p: pk, img: imgOf(pk), pack: true, q: "", precoManual: pk.preco != null };
    $("#panelTitle").textContent = f && !dup ? "Editar pack" : "Criar pack";
    drawPackEditor();
    $("#panel").classList.add("is-open"); $("#panel").setAttribute("aria-hidden", "false"); $("#overlay").classList.add("is-on");
  }

  function drawPackEditor() {
    const pk = editing.p, isNew = editing.i === -1;
    $("#panelBody").innerHTML = `
      <form class="form" id="packForm">
        <div class="section-title">${isNew ? "1. " : ""}Nome e foto</div>
        <div class="field"><label for="pk_nome">Nome do pack</label><input id="pk_nome" value="${esc(pk.nome)}" placeholder="Ex.: Pack Verão, Pack Iniciante…"></div>
        <div class="photo">
          <div class="photo__prev" style="background:${esc(pk.cor || "#999")}">${editing.img ? `<img src="${esc(editing.img)}" alt="">` : "📦"}</div>
          <div class="photo__btns">
            <label class="btn btn--dark btn--sm" style="cursor:pointer">📷 ${editing.img ? "Trocar foto" : "Tirar ou escolher foto"}<input type="file" accept="image/*" id="pk_file" hidden></label>
            ${editing.img ? `<button type="button" class="btn btn--sm btn--ghost" id="pk_rm">${I.trash} Remover foto</button>` : `<small class="muted">Uma foto com tudo junto vende melhor.</small>`}
          </div>
        </div>

        <div class="section-title">${isNew ? "2. " : ""}O que leva o pack?</div>
        <div class="pk-chosen" id="pkChosen"></div>
        <label class="search">${I.search}<input id="pk_q" type="search" placeholder="Procurar produto para juntar…" value="${esc(editing.q)}"></label>
        <div class="pk-list" id="pkList"></div>
        <div class="field"><label for="pk_extras">Outros itens (um por linha)</label><textarea id="pk_extras" placeholder="Ex.: 100g de sabor à escolha&#10;Boquilha 3D">${esc(pk.extras.join("\n"))}</textarea><small>Para coisas que não estão no catálogo ou que o cliente escolhe na loja.</small></div>

        <div class="section-title">${isNew ? "3. " : ""}Preço do pack</div>
        <div class="pk-sum" id="pkSum"></div>

        <div class="section-title">${isNew ? "4. " : ""}Na loja</div>
        <div class="toggles">
          <label class="switch"><input type="checkbox" id="pk_stock" ${pk.esgotado ? "" : "checked"}><i></i><span><b>Disponível</b><small>Desliga quando esgotar</small></span></label>
          <label class="switch"><input type="checkbox" id="pk_vis" ${pk.oculto ? "" : "checked"}><i></i><span><b>Mostrar na loja</b><small>Desliga para esconder</small></span></label>
          <label class="switch switch--gold"><input type="checkbox" id="pk_dest" ${pk.destaque ? "checked" : ""}><i></i><span><b>Destacar</b><small>Etiqueta "Mais completo"</small></span></label>
        </div>
      </form>`;
    $("#panelFoot").innerHTML = `
      ${isNew ? "" : `<button class="btn btn--danger spacer" data-del="${pk.id}">${I.trash} Apagar</button>`}
      <button class="btn btn--ghost" data-close>Cancelar</button>
      <button class="btn btn--dark" id="savePack">${I.check} Guardar pack</button>`;
    drawPackChosen(); drawPackList(); drawPackSum();

    $("#pk_q").addEventListener("input", (e) => { editing.q = e.target.value; drawPackList(); });
    $("#pk_nome").addEventListener("input", (e) => { pk.nome = e.target.value; });
    $("#pk_extras").addEventListener("input", (e) => { pk.extras = e.target.value.split("\n").map(s => s.trim()).filter(Boolean); });
    $("#pk_file").addEventListener("change", async (e) => { const file = e.target.files[0]; if (!file) return; editing.img = await compress(file); pk.img = editing.img; delete pk.semFoto; drawPackEditor(); });
    $("#pk_rm")?.addEventListener("click", () => { delete pk.img; editing.img = null; pk.semFoto = true; drawPackEditor(); });
  }
  function drawPackChosen() {
    const pk = editing.p;
    $("#pkChosen").innerHTML = pk.itens.length ? pk.itens.map((it, idx) => {
      const f = findProduct(it.id); if (!f) return "";
      const sizes = f.p.precos ? Object.keys(f.p.precos) : null;
      return `<div class="pk-item">${thumb(f.p)}<div class="list__main"><strong>${esc(nameOf(f.p))}</strong><span>${eur(sizes ? f.p.precos[it.size] : priceOf(f.p))}</span></div>
        ${sizes ? `<select class="select" data-pk-size="${idx}">${sizes.map(s => `<option ${s === it.size ? "selected" : ""}>${s}</option>`).join("")}</select>` : ""}
        <div class="qty"><button type="button" data-pk-qty="${idx}" data-d="-1">−</button><span>${it.qty || 1}</span><button type="button" data-pk-qty="${idx}" data-d="1">+</button></div>
        <button type="button" class="icon-btn" data-pk-rm="${idx}" title="Tirar do pack" style="color:var(--red)">${I.trash}</button></div>`;
    }).join("") : `<p class="muted" style="margin:0;font-size:13px">Ainda não escolheste produtos. Procura em baixo e toca em <b>Juntar</b>.</p>`;
  }
  function drawPackList() {
    const q = editing.q.trim().toLowerCase(), chosen = new Set(editing.p.itens.map(i => i.id));
    let list = allProducts().filter(({ cat }) => cat !== "packs");
    if (q) list = list.filter(({ p }) => `${nameOf(p)} ${p.marca || ""}`.toLowerCase().includes(q));
    $("#pkList").innerHTML = list.slice(0, q ? 30 : 8).map(({ p, cat }) => `
      <div class="pk-row">${thumb(p)}<div class="list__main"><strong>${esc(nameOf(p))}</strong><span>${CATS[cat].label} · ${p.precos ? eur(Object.values(p.precos)[0]) : priceOf(p) == null ? "Sob consulta" : eur(priceOf(p))}</span></div>
        ${chosen.has(p.id) ? `<span class="pill st-entregue">No pack</span>` : `<button type="button" class="act" data-pk-add="${p.id}">${I.plus}<span>Juntar</span></button>`}</div>`).join("")
      + (!q ? `<p class="muted" style="font-size:12px;margin:6px 0 0">A mostrar 8 produtos. Escreve para procurar os outros.</p>` : "");
  }
  function drawPackSum() {
    const pk = editing.p, val = packValue(pk);
    const save = val && pk.preco != null ? val - pk.preco : 0;
    $("#pkSum").innerHTML = `
      <div class="pk-sum__row"><span>Valor dos produtos em separado</span><b>${eur(val)}</b></div>
      <div class="pk-sum__row pk-sum__price"><label for="pk_preco">Preço do pack</label><div class="prefix"><input id="pk_preco" type="number" step="0.01" min="0" value="${pk.preco ?? ""}" placeholder="0,00"><span>€</span></div></div>
      ${val ? `<div class="pk-sum__row pk-sum__save ${save > 0 ? "is-good" : save < 0 ? "is-bad" : ""}"><span>${save > 0 ? "🎉 O cliente poupa" : save < 0 ? "⚠️ O pack está mais caro do que em separado" : "Sem desconto"}</span><b>${save > 0 ? `${eur(save)} (${Math.round(save / val * 100)}%)` : save < 0 ? eur(-save) : ""}</b></div>
      <div class="pk-sum__hint">Sugestão: ${[10, 15, 20].map(d => `<button type="button" class="chip-s" data-pk-sug="${Math.floor(val * (1 - d / 100))}">${d}% desc. → ${eur(Math.floor(val * (1 - d / 100)))}</button>`).join("")}</div>` : `<p class="muted" style="font-size:12.5px;margin:0">Junta produtos para ver quanto o cliente poupa.</p>`}`;
    const inp = $("#pk_preco");
    inp.addEventListener("input", () => { const v = inp.value.trim(); pk.preco = v === "" ? null : Math.round(parseFloat(v) * 100) / 100; editing.precoManual = true; refreshSave(); });
  }
  // enquanto o dono não escrever um preço, sugere 10% de desconto automaticamente
  function autoPackPrice() {
    if (editing.precoManual) return;
    const v = packValue(editing.p); editing.p.preco = v ? Math.floor(v * 0.9) : null;
  }
  // atualiza só a linha da poupança (para não perder o foco ao escrever o preço)
  function refreshSave() {
    const pk = editing.p, val = packValue(pk), save = val && pk.preco != null ? val - pk.preco : 0, el = $(".pk-sum__save");
    if (!el) return;
    el.className = `pk-sum__row pk-sum__save ${save > 0 ? "is-good" : save < 0 ? "is-bad" : ""}`;
    el.innerHTML = `<span>${save > 0 ? "🎉 O cliente poupa" : save < 0 ? "⚠️ O pack está mais caro do que em separado" : "Sem desconto"}</span><b>${save > 0 ? `${eur(save)} (${Math.round(save / val * 100)}%)` : save < 0 ? eur(-save) : ""}</b>`;
  }

  function savePack() {
    const pk = editing.p;
    pk.nome = ($("#pk_nome").value || "").trim();
    if (!pk.nome) { $("#pk_nome").closest(".field").classList.add("field--err"); $("#pk_nome").focus(); return toast("Dá um nome ao pack", true); }
    if (!pk.itens.length && !pk.extras.length) return toast("Junta pelo menos um produto ao pack", true);
    const flag = (k, on) => { if (on) pk[k] = true; else delete pk[k]; };
    flag("esgotado", !$("#pk_stock").checked); flag("oculto", !$("#pk_vis").checked); flag("destaque", $("#pk_dest").checked);
    pk.inclui = [...pk.itens.map(it => { const f = findProduct(it.id); return f ? `${(it.qty || 1) > 1 ? it.qty + "× " : ""}${nameOf(f.p)}${it.size ? " " + it.size : ""}` : null; }).filter(Boolean), ...pk.extras];
    const val = packValue(pk); if (val) pk.valor = Math.round(val * 100) / 100; else delete pk.valor;
    if (!pk.img) delete pk.img;
    if (editing.i === -1) {
      const s = slug(pk.nome); let id = s.startsWith("pack") ? s : "pack-" + s; while (findProduct(id)) id += "-2";
      pk.id = id; db.packs.unshift(pk);
    } else db.packs[findProduct(pk.id).i] = pk;
    save(editing.i === -1 ? "Pack criado" : "Pack atualizado");
    closePanel(); render();
  }

  /* ---------- PÁGINA INICIAL ---------- */
  const SEC_LABEL = {
    categorias: ["🗂️", "Explora por categoria"], garantias: ["✅", "Garantias (levantamento, pagamento…)"], novidades: ["✨", "Novidades"],
    essencias: ["🍉", "Essências Adalya"], packs: ["📦", "Packs completos"], ambiente: ["🌆", "Monta a sessão perfeita"],
    marcas: ["🏷️", "Compra por marca"], opinioes: ["⭐", "Opiniões de clientes"], loja: ["📍", "Loja física e mapa"],
  };
  const LINK_PAGES = [["", "Início"], ["shishas", "Shishas"], ["essencias", "Essências"], ["carvao", "Carvão"], ["acessorios", "Acessórios"], ["packs", "Packs"], ["opinioes", "Opiniões"], ["loja", "Loja física"]];
  const shadeHex = (hex, amt) => { const n = parseInt((hex || "#111111").slice(1), 16) || 0; const c = (v) => Math.max(0, Math.min(255, v + amt)); return "#" + ((c(n >> 16) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)).toString(16).padStart(6, "0"); };
  const gradA = (c) => `linear-gradient(120deg, ${shadeHex(c, -50)} 0%, ${c} 55%, ${shadeHex(c, 60)} 100%)`;
  function ensureHome() {
    const d = clone(HOME_DEFAULT), h = db.store.home || {};
    const secoes = mergeSecoes(h.secoes);
    db.store.home = {
      slides: h.slides || d.slides, promos: h.promos || d.promos, categorias: h.categorias || d.categorias,
      novidades: h.novidades || d.novidades, faixa: { ...d.faixa, ...(h.faixa || {}) }, ambiente: { ...d.ambiente, ...(h.ambiente || {}) }, secoes,
    };
    return db.store.home;
  }
  const getPath = (o, p) => p.split(".").reduce((x, k) => x == null ? x : x[k], o);
  const setPath = (o, p, v) => { const ks = p.split("."), last = ks.pop(); const t = ks.reduce((x, k) => x[k], o); t[last] = v; };
  // imagem grande de um produto (para usar na página inicial)
  function imgBig(p) {
    if (p.img) return p.img;
    if (FOTOS.includes(p.id)) return `img/${p.id}.jpg`;
    if (FOTOS_LIVRES[p.id]) { const [id, crop] = FOTOS_LIVRES[p.id].split("|"); return `https://images.unsplash.com/${id}?w=1400&q=75&auto=format&fit=crop${crop ? "&crop=" + crop : ""}`; }
    if (STOCK_IMG[p.id]) return stock(STOCK_IMG[p.id], 1400);
    return "";
  }
  function linkSelect(path, val) {
    return `<select class="select" data-h="${path}">
      <optgroup label="Páginas">${LINK_PAGES.map(([v, l]) => `<option value="${v}" ${val === v ? "selected" : ""}>${l}</option>`).join("")}</optgroup>
      ${Object.entries(CATS).map(([cat, c]) => `<optgroup label="${c.label}">${db[cat].map(p => `<option value="p/${esc(p.id)}" ${val === "p/" + p.id ? "selected" : ""}>${esc(nameOf(p))}</option>`).join("")}</optgroup>`).join("")}
    </select>`;
  }
  function photoCtl(path, img) {
    return `<div class="hphoto">
      <div class="hphoto__prev">${img ? `<img src="${esc(img)}" alt="">` : "📷"}</div>
      <div class="hphoto__btns">
        <label class="act" style="cursor:pointer">📷 <span>${img ? "Trocar foto" : "Carregar foto"}</span><input type="file" accept="image/*" data-hfile="${path}" hidden></label>
        <button type="button" class="act" data-hpick="${path}">🛍️ <span>Foto de um produto</span></button>
        ${img ? `<button type="button" class="act act--del" data-hset="${path}" data-val="">${I.trash}<span>Tirar</span></button>` : ""}
      </div>
    </div>`;
  }
  const moveBtns = (list, i, n) => `
    <button type="button" class="act" data-hmove="${list}:${i}:-1" ${i === 0 ? "disabled" : ""} title="Subir">↑</button>
    <button type="button" class="act" data-hmove="${list}:${i}:1" ${i === n - 1 ? "disabled" : ""} title="Descer">↓</button>`;

  function bannerCard(list, s, i, n, opts = {}) {
    const p = `${list}.${i}`, full = s.modo === "cheio" && s.img;
    const bg = full ? s.cor : gradA(s.cor || "#111111");
    return `<div class="card hcard ${s.ativo === false ? "is-off" : ""}">
      <div class="hprev ${opts.small ? "hprev--sm" : ""}" style="background:${esc(bg)}">
        ${s.img ? `<img class="${full ? "hprev__bg" : "hprev__side"}" src="${esc(s.img)}" alt="">` : ""}
        <div class="hprev__text">${s.kicker ? `<small>${esc(s.kicker)}</small>` : ""}<b>${esc(s.titulo || "Sem título")}</b>${s.sub ? `<span>${esc(s.sub)}</span>` : ""}${s.cta ? `<i>${esc(s.cta)}</i>` : ""}</div>
        ${s.ativo === false ? `<span class="hprev__off">Escondido</span>` : ""}
      </div>
      <div class="hcard__body">
        <div class="hcard__top">
          <strong>${opts.label} ${i + 1}</strong>
          <div class="actions">${moveBtns(list, i, n)}<button type="button" class="act act--del" data-hdel="${list}:${i}">${I.trash}<span>Apagar</span></button></div>
        </div>
        <label class="switch"><input type="checkbox" data-h="${p}.ativo" ${s.ativo === false ? "" : "checked"}><i></i>Mostrar na loja</label>
        ${photoCtl(`${p}.img`, s.img)}
        <div class="row">
          <div class="field"><label>Texto pequeno (em cima)</label><input data-h="${p}.kicker" value="${esc(s.kicker || "")}" maxlength="40" placeholder="Ex.: Nova chegada"></div>
          <div class="field"><label>Título</label><input data-h="${p}.titulo" value="${esc(s.titulo || "")}" maxlength="40" placeholder="Ex.: WOOKAH"></div>
        </div>
        ${opts.sub ? `<div class="field"><label>Frase</label><input data-h="${p}.sub" value="${esc(s.sub || "")}" maxlength="110" placeholder="Uma frase curta"></div>` : ""}
        <div class="row">
          <div class="field"><label>Texto do botão</label><input data-h="${p}.cta" value="${esc(s.cta || "")}" maxlength="24" placeholder="Ex.: Ver shisha"></div>
          <div class="field"><label>Ao tocar, abre…</label>${linkSelect(`${p}.link`, s.link || "")}</div>
        </div>
        <div class="row">
          <div class="field"><label>Como mostrar a foto</label><select class="select" data-h="${p}.modo"><option value="lado" ${s.modo !== "cheio" ? "selected" : ""}>Foto ao lado do texto</option><option value="cheio" ${s.modo === "cheio" ? "selected" : ""}>Foto a ocupar tudo</option></select></div>
          <div class="field"><label>Cor de fundo</label><div class="color"><input type="color" data-h="${p}.cor" value="${esc(s.cor || "#111111")}"><span class="muted">${esc(s.cor || "")}</span></div></div>
        </div>
      </div>
    </div>`;
  }

  views.inicio = () => {
    const H = ensureHome(), tab = state.homeTab || "carrossel";
    setHeader("Página inicial", "Muda as fotos, textos e secções da página principal da loja.", `<a class="btn btn--ghost" href="./" target="_blank">${I.eye} Ver a loja</a>`);
    const TABS = [["carrossel", "🖼️ Carrossel"], ["banners", "📢 Banners"], ["faixa", "🎞️ Faixa"], ["categorias", "🗂️ Categorias"], ["secoes", "⚙️ Secções"]];
    let body = "";
    if (tab === "carrossel") body = `
      <p class="muted hintline">As imagens grandes do topo. Passam sozinhas a cada 5 segundos.</p>
      <div class="hlist">${H.slides.map((s, i) => bannerCard("slides", s, i, H.slides.length, { label: "Imagem", sub: true })).join("")}</div>
      <button class="btn btn--dark" data-hadd="slides">${I.plus} Adicionar imagem ao carrossel</button>`;
    if (tab === "banners") body = `
      <p class="muted hintline">Os 2 anúncios à direita do carrossel (no telemóvel aparecem por baixo).</p>
      <div class="hlist">${H.promos.map((s, i) => bannerCard("promos", s, i, H.promos.length, { label: "Banner", small: true })).join("")}</div>
      ${H.promos.length < 2 ? `<button class="btn btn--dark" data-hadd="promos">${I.plus} Adicionar banner</button>` : `<p class="muted" style="font-size:12.5px">Máximo 2 banners. Apaga um para adicionar outro.</p>`}`;
    if (tab === "faixa") body = `
      <div class="card"><div class="card__body form">
        <div class="hmarquee"><div style="--dur:${{ lenta: "60s", normal: "38s", rapida: "22s" }[H.faixa.velocidade] || "38s"}">${[...H.faixa.itens, ...H.faixa.itens].map(t => `<span>${esc(t)}</span><i>✦</i>`).join("")}</div></div>
        <div class="row">
          <label class="switch"><input type="checkbox" data-h="faixa.ativo" ${H.faixa.ativo === false ? "" : "checked"}><i></i>Mostrar a faixa na loja</label>
          <div class="field"><label>Velocidade</label><select class="select" data-h="faixa.velocidade">${[["lenta", "Lenta"], ["normal", "Normal"], ["rapida", "Rápida"]].map(([v, l]) => `<option value="${v}" ${H.faixa.velocidade === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        </div>
        <div class="section-title">Frases</div>
        ${H.faixa.itens.map((t, i) => `<div class="hrow"><input data-h="faixa.itens.${i}" value="${esc(t)}" maxlength="40"><div class="actions">${moveBtns("faixa.itens", i, H.faixa.itens.length)}<button type="button" class="act act--del" data-hdel="faixa.itens:${i}">${I.trash}</button></div></div>`).join("")}
        <button class="btn btn--ghost btn--sm" data-hadd="faixa.itens" style="justify-self:start">${I.plus} Adicionar frase</button>
      </div></div>`;
    if (tab === "categorias") body = `
      <p class="muted hintline">Os quadrados de "Explora por categoria". Toca em "Trocar foto" para mudar a imagem.</p>
      <div class="hcats">${H.categorias.map((c, i) => `
        <div class="card hcard">
          <div class="hcat" style="--bg:${esc(c.cor || "#f4ede4")}">${c.img ? `<img src="${esc(c.img)}" alt="">` : "📦"}<b>${esc(c.titulo)}</b></div>
          <div class="hcard__body">
            ${photoCtl(`categorias.${i}.img`, c.img)}
            <div class="row">
              <div class="field"><label>Nome</label><input data-h="categorias.${i}.titulo" value="${esc(c.titulo)}" maxlength="24"></div>
              <div class="field"><label>Cor de fundo</label><div class="color"><input type="color" data-h="categorias.${i}.cor" value="${esc(c.cor || "#f4ede4")}"></div></div>
            </div>
            <div class="actions" style="justify-content:flex-start">${moveBtns("categorias", i, H.categorias.length)}</div>
          </div>
        </div>`).join("")}</div>`;
    if (tab === "secoes") {
      const A = H.ambiente, nov = new Set(H.novidades);
      body = `
      <div class="two">
        <div class="card"><div class="card__head"><h3>Secções da página e ordem</h3></div><div class="card__body">
          <p class="muted" style="margin:0 0 10px;font-size:13px">O carrossel, os banners e a faixa ficam sempre no topo.</p>
          ${H.secoes.map((s, i) => `<div class="hrow hsec ${s.ativo === false ? "is-off" : ""}"><span>${SEC_LABEL[s.id]?.[0] || ""} ${SEC_LABEL[s.id]?.[1] || s.id}</span>
            <div class="actions">${moveBtns("secoes", i, H.secoes.length)}<label class="switch"><input type="checkbox" data-h="secoes.${i}.ativo" ${s.ativo === false ? "" : "checked"}><i></i></label></div></div>`).join("")}
        </div></div>
        <div class="card"><div class="card__head"><h3>✨ Produtos em "Novidades"</h3><span class="muted">${nov.size} escolhidos</span></div><div class="card__body">
          <p class="muted" style="margin:0 0 10px;font-size:13px">Escolhe 4 ou 8 para ficar bonito.</p>
          <div class="hnov">${allProducts().filter(({ cat }) => cat !== "packs").map(({ p }) => `<label class="hnov__item ${nov.has(p.id) ? "is-on" : ""}"><input type="checkbox" data-hnov="${esc(p.id)}" ${nov.has(p.id) ? "checked" : ""}>${thumb(p)}<span>${esc(nameOf(p))}</span></label>`).join("")}</div>
        </div></div>
      </div>
      <div class="card" style="margin-top:16px"><div class="card__head"><h3>🌆 "Monta a sessão perfeita"</h3></div><div class="card__body form">
        ${photoCtl("ambiente.img", A.img)}
        <div class="row">
          <div class="field"><label>Texto pequeno</label><input data-h="ambiente.kicker" value="${esc(A.kicker || "")}" maxlength="40"></div>
          <div class="field"><label>Título</label><input data-h="ambiente.titulo" value="${esc(A.titulo || "")}" maxlength="40"></div>
        </div>
        <div class="field"><label>Texto</label><input data-h="ambiente.texto" value="${esc(A.texto || "")}" maxlength="140"></div>
        <div class="row">
          <div class="field"><label>Texto do botão</label><input data-h="ambiente.cta" value="${esc(A.cta || "")}" maxlength="24"></div>
          <div class="field"><label>Ao tocar, abre…</label>${linkSelect("ambiente.link", A.link || "")}</div>
        </div>
        ${(A.tiles || []).map((t, i) => `
          <div class="section-title">Quadrado pequeno ${i + 1}</div>
          ${photoCtl(`ambiente.tiles.${i}.img`, t.img)}
          <div class="row--3 row">
            <div class="field"><label>Título</label><input data-h="ambiente.tiles.${i}.titulo" value="${esc(t.titulo || "")}" maxlength="30"></div>
            <div class="field"><label>Texto</label><input data-h="ambiente.tiles.${i}.sub" value="${esc(t.sub || "")}" maxlength="30"></div>
            <div class="field"><label>Abre…</label>${linkSelect(`ambiente.tiles.${i}.link`, t.link || "")}</div>
          </div>`).join("")}
      </div></div>`;
    }
    $("#view").innerHTML = `
      <div class="toolbar"><div class="tabs">${TABS.map(([k, l]) => `<button data-htab="${k}" class="${tab === k ? "is-on" : ""}">${l}</button>`).join("")}</div>
        <button class="btn btn--ghost btn--sm" data-hreset style="margin-left:auto">${I.reset} Repor o desenho original</button></div>
      ${body}`;
  };
  function redrawHome() { const y = window.scrollY; views.inicio(); window.scrollTo(0, y); }
  function homeSave(msg = "Página inicial atualizada") { save(msg); redrawHome(); }
  function openHomePicker(path) {
    $("#panelTitle").textContent = "Escolher foto";
    const items = allProducts().map(({ p }) => ({ p, src: imgBig(p) })).filter(x => x.src);
    const amb = Object.keys(STOCK).map(k => stock(k, 1400));
    $("#panelBody").innerHTML = `
      <label class="search" style="margin-bottom:12px">${I.search}<input id="hpq" type="search" placeholder="Procurar produto…"></label>
      <div class="hpick" id="hpickList">${items.map(({ p, src }) => `<button type="button" class="hpick__item" data-hpicked="${esc(src)}" data-name="${esc(nameOf(p).toLowerCase())}"><img src="${esc(src.includes("unsplash") ? src.replace("w=1400", "w=300") : src)}" alt="" loading="lazy"><span>${esc(nameOf(p))}</span></button>`).join("")}</div>
      <div class="section-title" style="margin:18px 0 8px">Fotos de ambiente</div>
      <div class="hpick">${amb.map(src => `<button type="button" class="hpick__item" data-hpicked="${esc(src)}" data-name=""><img src="${esc(src.replace("w=1400", "w=300"))}" alt="" loading="lazy"></button>`).join("")}</div>`;
    $("#panelFoot").innerHTML = `<button class="btn btn--ghost" data-close>Cancelar</button>`;
    $("#panel").dataset.hpath = path;
    $("#panel").classList.add("is-open"); $("#overlay").classList.add("is-on");
    $("#hpq").addEventListener("input", (e) => { const q = e.target.value.trim().toLowerCase(); $$("#hpickList .hpick__item").forEach(b => b.hidden = q && !b.dataset.name.includes(q)); });
  }

  /* ---------- ENCOMENDAS ---------- */
  views.encomendas = () => {
    setHeader("Encomendas", "Pedidos feitos no carrinho da loja e enviados por WhatsApp.", `<button class="btn btn--ghost" data-demo-orders>${I.plus} Encomendas de exemplo</button>`);
    const counts = Object.fromEntries(Object.keys(ESTADOS).map(k => [k, orders.filter(o => o.estado === k).length]));
    const list = orders.filter(o => state.estado === "todas" || o.estado === state.estado);
    $("#view").innerHTML = `
      <div class="toolbar"><div class="tabs" id="otabs">
        <button data-estado="todas" class="${state.estado === "todas" ? "is-on" : ""}">Todas <i>${orders.length}</i></button>
        ${Object.entries(ESTADOS).map(([k, v]) => `<button data-estado="${k}" class="${state.estado === k ? "is-on" : ""}">${v} <i>${counts[k]}</i></button>`).join("")}
      </div></div>
      <div class="card table-wrap">${list.length ? `<table class="t">
        <thead><tr><th>Nº</th><th>Data</th><th>Cliente</th><th>Produtos</th><th>Total</th><th>Estado</th><th></th></tr></thead>
        <tbody>${list.map(o => `<tr style="cursor:pointer" data-order="${o.n}">
          <td><strong>#${o.n}</strong></td><td>${fmtDate(o.data)}</td><td>${o.cliente ? `<strong>${esc(o.cliente.nome)}</strong><br><span class="muted">${esc(o.cliente.tel)}</span>` : `<span class="muted">—</span>`}</td>
          <td>${esc(o.items.map(i => `${i.qty}× ${i.nome}${i.variant ? " (" + i.variant + ")" : ""}`).join(", "))}</td>
          <td class="price">${eur(o.total)}</td><td><span class="pill st-${o.estado}">${ESTADOS[o.estado]}</span></td>
          <td><div class="actions"><button class="icon-btn" title="Ver">${I.eye}</button></div></td></tr>`).join("")}</tbody></table>`
      : `<div class="empty">${orders.length ? "Nenhuma encomenda neste estado." : `Ainda não há encomendas.<br>Quando um cliente carregar em "Encomendar por WhatsApp" na loja, a encomenda aparece aqui.<br><button class="btn btn--gold btn--sm" data-demo-orders>${I.plus} Gerar encomendas de exemplo</button>`}</div>`}</div>`;
  };
  function openOrder(n) {
    const o = orders.find(x => x.n === +n); if (!o) return;
    $("#panelTitle").textContent = `Encomenda #${o.n}`;
    const telCli = (o.cliente?.tel || "").replace(/\D/g, ""), telWa = telCli.length === 9 ? "351" + telCli : telCli;
    const msg = `Olá${o.cliente?.nome ? " " + o.cliente.nome.split(" ")[0] : ""}! A sua encomenda #${o.n} na ${db.store.nome} está ${ESTADOS[o.estado].toLowerCase()}. Total: ${eur(o.total)}. Obrigado!`;
    $("#panelBody").innerHTML = `
      <p class="muted" style="margin-top:0">${fmtDate(o.data)} · via ${esc(o.canal || "WhatsApp")}</p>
      ${o.cliente ? `<div class="note" style="margin-bottom:16px">👤<div><b>${esc(o.cliente.nome)}</b><br><a href="tel:${esc(o.cliente.tel)}">${esc(o.cliente.tel)}</a></div></div>` : ""}
      <div class="section-title" style="margin-bottom:8px">Estado</div>
      <div class="steps" id="ordSteps">${Object.entries(ESTADOS).map(([k, v]) => `<button data-set-estado="${k}" class="${o.estado === k ? "is-on" : ""}">${v}</button>`).join("")}</div>
      <div class="section-title" style="margin:22px 0 4px">Produtos</div>
      <table class="order-items">${o.items.map(i => `<tr><td>${i.qty}× ${esc(i.nome)}${i.variant ? ` <span class="muted">(${esc(i.variant)})</span>` : ""}</td><td>${eur(i.preco * i.qty)}</td></tr>`).join("")}</table>
      <div class="order-total"><span>Total</span><span>${eur(o.total)}</span></div>
      <div class="note" style="margin-top:22px">${I.info}<div>Pagamento e levantamento na loja: ${esc(db.store.morada)}.</div></div>`;
    $("#panelFoot").innerHTML = `
      <button class="btn btn--danger spacer" data-del-order="${o.n}">${I.trash} Apagar</button>
      <a class="btn btn--ghost" target="_blank" rel="noopener" href="https://wa.me/${telWa}?text=${encodeURIComponent(msg)}">${I.wa} ${telWa ? "Avisar cliente" : "Enviar por WhatsApp"}</a>
      <button class="btn btn--dark" data-close>Fechar</button>`;
    $("#panel").classList.add("is-open"); $("#overlay").classList.add("is-on");
    editing = null; $("#panel").dataset.order = o.n;
  }
  async function demoOrders() {
    if (LIVE) {
      const tmp = orders; orders = []; demoOrdersLocal(); const fake = orders; orders = tmp;
      const r = await sb.from("orders").insert(fake.map(o => ({ created_at: o.data, items: o.items, total: Math.round(o.total * 100) / 100, estado: o.estado, canal: o.canal, exemplo: true })));
      if (r.error) return toast("Não foi possível criar exemplos", true);
      await refreshOrders(); toast("Encomendas de exemplo criadas"); return render();
    }
    demoOrdersLocal(); saveOrders(); toast("Encomendas de exemplo criadas"); render();
  }
  async function clearDemoOrders() {
    if (LIVE) { const r = await sb.from("orders").delete().eq("exemplo", true); if (r.error) return toast("Não foi possível apagar", true); await refreshOrders(); }
    else { orders = orders.filter(o => !o.exemplo); saveOrders(); }
    toast("Encomendas de exemplo apagadas"); render();
  }
  function demoOrdersLocal() {
    const pool = allProducts().filter(({ p }) => priceOf(p) != null && !p.oculto);
    const pick = () => pool[Math.floor(Math.random() * pool.length)].p;
    const estados = ["nova", "nova", "confirmada", "pronta", "entregue", "entregue", "entregue", "cancelada"];
    let n = orders.reduce((m, o) => Math.max(m, o.n || 0), 1000);
    for (let k = 0; k < 9; k++) {
      const d = new Date(); d.setDate(d.getDate() - Math.floor(k * 0.8)); d.setHours(10 + (k * 3) % 10, (k * 17) % 60);
      const items = [...Array(1 + (k % 3))].map(() => { const p = pick(); const variant = p.precos ? Object.keys(p.precos)[k % Object.keys(p.precos).length] : null; return { id: p.id, nome: nameOf(p), variant, qty: 1 + (k % 2), preco: variant ? p.precos[variant] : priceOf(p) }; });
      orders.push({ n: ++n, data: d.toISOString(), items, total: items.reduce((s, i) => s + i.preco * i.qty, 0), estado: estados[k % estados.length], canal: "WhatsApp", exemplo: true });
    }
    orders.sort((a, b) => new Date(b.data) - new Date(a.data));
  }

  /* ---------- OPINIÕES ---------- */
  const starTxt = (n) => "★".repeat(n) + "☆".repeat(5 - n);
  views.opinioes = () => {
    setHeader("Opiniões de clientes", "Lê as opiniões e publica as que quiseres. Só aparecem na loja depois de as aprovares.", `<button class="btn btn--dark" data-rv-new>${I.plus} Juntar opinião</button>`);
    const tab = state.rev || "pendentes";
    const lists = { pendentes: reviews.filter(r => !r.aprovado), publicadas: reviews.filter(r => r.aprovado), todas: reviews };
    const list = lists[tab];
    const avg = lists.publicadas.length ? lists.publicadas.reduce((s, r) => s + r.estrelas, 0) / lists.publicadas.length : 0;
    $("#view").innerHTML = `
      ${reviewsMissing ? `<div class="note" style="margin-bottom:16px">${I.alert}<div><b>Falta ativar as opiniões na base de dados.</b><br>No Supabase → SQL Editor, cola e executa o ficheiro <code>supabase/003-opinioes.sql</code> (só uma vez).</div></div>` : ""}
      <div class="toolbar"><div class="tabs">
        <button data-rv-tab="pendentes" class="${tab === "pendentes" ? "is-on" : ""}">Por aprovar <i>${lists.pendentes.length}</i></button>
        <button data-rv-tab="publicadas" class="${tab === "publicadas" ? "is-on" : ""}">Publicadas <i>${lists.publicadas.length}</i></button>
        <button data-rv-tab="todas" class="${tab === "todas" ? "is-on" : ""}">Todas <i>${reviews.length}</i></button>
      </div>${lists.publicadas.length ? `<span class="muted">Média na loja: <b style="color:#8c6d3f">★ ${avg.toFixed(1).replace(".", ",")}</b> de 5</span>` : ""}</div>
      ${list.length ? `<div class="rvs">${list.map(rv => { const prod = rv.produto && findProduct(rv.produto); return `
        <div class="card rv ${rv.aprovado ? "" : "rv--new"}">
          <div class="rv__head">
            <span class="rv__stars" title="${rv.estrelas} de 5">${starTxt(rv.estrelas)}</span>
            <strong>${esc(rv.nome)}</strong>
            <span class="muted">${fmtDate(rv.created_at)}</span>
            <span class="pill">${prod ? esc(nameOf(prod.p)) : "Loja em geral"}</span>
            <span class="pill ${rv.aprovado ? "st-entregue" : "st-nova"}">${rv.aprovado ? "Publicada" : "Por aprovar"}</span>
          </div>
          <p class="rv__txt">${esc(rv.texto)}</p>
          <div class="field"><label for="rvr${rv.id}">Resposta da loja <span class="muted">(opcional, aparece por baixo)</span></label><textarea id="rvr${rv.id}" data-rv-reply="${rv.id}" maxlength="400" rows="2" placeholder="Ex.: Obrigado pela visita, ${esc(String(rv.nome).split(" ")[0])}!">${esc(rv.resposta || "")}</textarea></div>
          <div class="rv__act">
            ${rv.aprovado ? `<button class="btn btn--ghost btn--sm" data-rv-hide="${rv.id}">Esconder da loja</button>` : `<button class="btn btn--dark btn--sm" data-rv-ok="${rv.id}">${I.check} Publicar na loja</button>`}
            <button class="btn btn--danger btn--sm" data-rv-del="${rv.id}">${I.trash} Apagar</button>
          </div>
        </div>`; }).join("")}</div>`
      : `<div class="card"><div class="empty">${tab === "pendentes" ? "Não há opiniões à espera. 👌<br>Quando um cliente deixar uma opinião na loja, aparece aqui." : "Ainda não há opiniões aqui."}</div></div>`}
      <div class="note" style="margin-top:16px">${I.info}<div>Publica só opiniões verdadeiras. Podes juntar opiniões que os clientes te deram na loja, no Google ou no Instagram, mas inventar opiniões é proibido por lei.</div></div>`;
  };
  function openReviewEditor() {
    $("#panelTitle").textContent = "Juntar opinião";
    const prods = allProducts().filter(x => !x.p.oculto);
    $("#panelBody").innerHTML = `
      <form class="form" id="rvForm">
        <div class="note">${I.info}<div>Para opiniões que um cliente te deu pessoalmente, no Google ou no Instagram. Ficam publicadas logo.</div></div>
        <div class="field"><label for="rv_nome">Nome do cliente</label><input id="rv_nome" name="nome" maxlength="40" placeholder="Ex.: Joana M."></div>
        <div class="field"><label for="rv_est">Estrelas</label><select id="rv_est" name="estrelas">${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${starTxt(n)} (${n})</option>`).join("")}</select></div>
        <div class="field"><label for="rv_prod">Sobre</label><select id="rv_prod" name="produto"><option value="">A loja em geral</option>${prods.map(({ p }) => `<option value="${esc(p.id)}">${esc(nameOf(p))}</option>`).join("")}</select></div>
        <div class="field"><label for="rv_txt">Opinião</label><textarea id="rv_txt" name="texto" maxlength="600" rows="5" placeholder="O que o cliente disse"></textarea></div>
      </form>`;
    $("#panelFoot").innerHTML = `<button class="btn btn--ghost" data-close>Cancelar</button><button class="btn btn--dark" id="saveRev">${I.check} Publicar</button>`;
    $("#panel").classList.add("is-open"); $("#panel").setAttribute("aria-hidden", "false"); $("#overlay").classList.add("is-on");
    editing = null;
  }
  async function saveReviewNew() {
    const f = $("#rvForm").elements;
    const row = { nome: f.nome.value.trim().replace(/[<>]/g, ""), estrelas: +f.estrelas.value, produto: f.produto.value || null, texto: f.texto.value.trim().replace(/[<>]/g, ""), aprovado: true };
    if (row.nome.length < 2) return toast("Escreve o nome do cliente", true);
    if (row.texto.length < 3) return toast("Escreve a opinião", true);
    if (LIVE) {
      const r = await sb.from("reviews").insert(row).select().single();
      if (r.error) return toast(reviewsMissing ? "Primeiro ativa as opiniões no Supabase (ficheiro 003)" : "Não foi possível guardar", true);
      reviews.unshift(r.data);
    } else { reviews.unshift({ ...row, id: Date.now(), created_at: new Date().toISOString(), resposta: "" }); saveReviewsLocal(); }
    closePanel(); state.rev = "publicadas"; toast("Opinião publicada na loja"); render();
  }

  /* ---------- DADOS DA LOJA ---------- */
  views.loja = () => {
    const s = db.store;
    setHeader("Dados da loja", "Contactos, horário e avisos que aparecem na loja.", `<button class="btn btn--dark" id="saveStore">${I.check} Guardar</button>`);
    const h = s.horario || [];
    $("#view").innerHTML = `
      <div class="two">
        <div class="card"><div class="card__head"><h3>Informação da loja</h3></div><div class="card__body">
          <form class="form" id="storeForm">
            <div class="row">
              <div class="field"><label>Nome da loja</label><input name="nome" value="${esc(s.nome)}"></div>
              <div class="field"><label>Cidade</label><input name="cidade" value="${esc(s.cidade)}"></div>
            </div>
            <div class="field"><label>Morada</label><input name="morada" value="${esc(s.morada)}"></div>
            <div class="row">
              <div class="field"><label>Telefone (como aparece)</label><input name="telefone" value="${esc(s.telefone)}"></div>
              <div class="field"><label>WhatsApp (com indicativo)</label><input name="whatsapp" value="${esc(s.whatsapp)}" placeholder="351910000000"><small>Recebe as encomendas do carrinho.</small></div>
            </div>
            <div class="field"><label>Instagram</label><input name="instagram" value="${esc(s.instagram)}"></div>
            <div class="field"><label>Aviso no topo da loja</label><input name="aviso" value="${esc(s.aviso || "")}" placeholder="Ex.: 🎉 Novas essências Adalya esta semana!"><small>Vazio = mostra o telefone de atendimento.</small></div>
            <div class="section-title">Dados legais</div>
            <div class="row">
              <div class="field"><label>Nome da empresa</label><input name="empresa" value="${esc(s.empresa || "")}" placeholder="Ex.: Nome Empresa, Lda."></div>
              <div class="field"><label>NIF</label><input name="nif" value="${esc(s.nif || "")}" inputmode="numeric" maxlength="9"></div>
            </div>
            <div class="field"><label>Email de contacto</label><input name="email" type="email" value="${esc(s.email || "")}"><small>Aparecem na Política de privacidade e nos Termos (obrigatório por lei).</small></div>
          </form>
        </div></div>
        <div class="grid" style="align-content:start">
          <div class="card"><div class="card__head"><h3>Horário</h3></div><div class="card__body"><div class="form" id="hours">
            ${[0, 1, 2].map(i => `<div class="row"><div class="field"><input data-h="${i}" data-k="0" value="${esc(h[i]?.[0] || "")}" placeholder="Dias"></div><div class="field"><input data-h="${i}" data-k="1" value="${esc(h[i]?.[1] || "")}" placeholder="Horas"></div></div>`).join("")}
          </div></div></div>
          <div class="card"><div class="card__head"><h3>Segurança</h3></div><div class="card__body"><div class="form">
            ${LIVE ? `<div class="field"><label>Nova palavra-passe</label><input id="newPass" type="password" autocomplete="new-password" placeholder="Mínimo 10 caracteres"><small>Sessão iniciada como ${esc(session?.user?.email || "")}.</small></div>
            <button class="btn btn--ghost btn--sm" id="changePass" type="button">Mudar palavra-passe</button>`
            : `<div class="field"><label>PIN de acesso ao painel</label><input id="newPin" type="password" inputmode="numeric" maxlength="8" placeholder="Novo PIN (4 a 8 números)"><small>Na demonstração o PIN é 1234.</small></div>`}
          </div></div></div>
        </div>
      </div>`;
    $("#saveStore").addEventListener("click", () => {
      const f = $("#storeForm").elements;
      ["nome", "cidade", "morada", "telefone", "whatsapp", "instagram", "aviso", "empresa", "nif", "email"].forEach(k => db.store[k] = f[k].value.trim());
      db.store.whatsapp = db.store.whatsapp.replace(/\D/g, "");
      if (db.store.instagram && !/^https:\/\//.test(db.store.instagram)) return toast("O Instagram deve começar por https://", true);
      db.store.horario = [0, 1, 2].map(i => [$(`[data-h="${i}"][data-k="0"]`).value.trim(), $(`[data-h="${i}"][data-k="1"]`).value.trim()]).filter(r => r[0] || r[1]);
      const pin = $("#newPin")?.value.trim();
      if (pin) { if (!/^\d{4,8}$/.test(pin)) return toast("O PIN deve ter 4 a 8 números", true); db.store.pin = pin; }
      save("Dados da loja guardados");
    });
    $("#changePass")?.addEventListener("click", async () => {
      const pw = $("#newPass").value;
      if (pw.length < 10) return toast("A palavra-passe deve ter pelo menos 10 caracteres", true);
      const { error } = await sb.auth.updateUser({ password: pw });
      $("#newPass").value = "";
      toast(error ? "Não foi possível mudar a palavra-passe" : "Palavra-passe alterada", !!error);
    });
  };

  /* ---------- EXPORTAR / PUBLICAR ---------- */
  views.dados = () => {
    setHeader("Cópias de segurança", LIVE ? "Guarda uma cópia de tudo, por precaução." : "Guarda uma cópia de tudo ou envia as alterações para o site.");
    const changed = !!localStorage.getItem("ss_catalog");
    $("#view").innerHTML = `
      <div class="note">${I.info}<div>${LIVE
        ? `<b>Tudo é publicado automaticamente.</b> Quando guardas uma alteração, os clientes veem-na logo na loja. Recomendamos descarregar uma cópia de segurança uma vez por mês.`
        : `<b>Como funciona:</b> as alterações ficam guardadas neste navegador e já aparecem na loja aberta aqui. Para que todos os clientes as vejam, descarrega o ficheiro <b>data.js</b> e substitui o da pasta <code>js/</code> do site (ou envia-o ao teu programador).${changed ? "" : "<br><br>Ainda não fizeste alterações ao catálogo original."}`}</div></div>
      <div class="export">
        ${LIVE ? "" : `<div class="card"><span class="export__icon">${I.file}</span><h3>Exportar data.js</h3><p>Ficheiro com todo o catálogo e os dados da loja, pronto a publicar no site.</p><button class="btn btn--dark" data-export="js">${I.down} Descarregar data.js</button></div>`}
        <div class="card"><span class="export__icon">${I.down}</span><h3>Cópia de segurança</h3><p>Guarda tudo (produtos, loja e encomendas) num ficheiro para recuperar mais tarde.</p><button class="btn btn--dark" data-export="json">${I.down} Descarregar cópia</button></div>
        <div class="card"><span class="export__icon">${I.up}</span><h3>Restaurar cópia</h3><p>Carrega uma cópia de segurança feita antes neste painel.${LIVE ? " Substitui o catálogo atual." : ""}</p><label class="btn btn--ghost" style="cursor:pointer">${I.up} Escolher ficheiro<input type="file" accept="application/json" id="importFile" hidden></label></div>
        ${orders.some(o => o.exemplo) ? `<div class="card"><span class="export__icon">${I.trash}</span><h3>Apagar encomendas de exemplo</h3><p>Remove as encomendas de exemplo criadas para testar o painel.</p><button class="btn btn--danger" data-clear-demo>${I.trash} Apagar exemplos</button></div>` : ""}
        ${LIVE ? "" : `<div class="card"><span class="export__icon">${I.reset}</span><h3>Repor demonstração</h3><p>Apaga as alterações feitas neste navegador e volta ao catálogo original.</p><button class="btn btn--danger" data-reset>${I.reset} Repor tudo</button></div>`}
      </div>`;
    $("#importFile").addEventListener("change", (e) => {
      const file = e.target.files[0]; if (!file) return;
      const r = new FileReader(); r.onload = () => {
        try {
          const data = JSON.parse(r.result);
          Object.keys(CATS).forEach(k => { if (Array.isArray(data[k])) db[k] = data[k]; });
          if (data.store) db.store = data.store;
          if (!LIVE && Array.isArray(data.orders)) { orders = data.orders; saveOrders(); }
          if (LIVE && !confirm("Substituir o catálogo atual da loja por esta cópia?")) return;
          save("Cópia restaurada"); render();
        } catch { toast("Ficheiro inválido", true); }
      }; r.readAsText(file);
    });
  };
  function download(name, text, type) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportJs() {
    const J = (v) => JSON.stringify(v, null, 2);
    const storeOut = { ...db.store }; delete storeOut.pin;
    const txt = `/* =========================================================
   SHISHA STORE — Catálogo (exportado do back office em ${new Date().toLocaleString("pt-PT")})
   ========================================================= */

const STORE = ${J(storeOut)};

const SHISHAS = ${J(db.shishas)};

const ESSENCIAS = ${J(db.essencias)};

const CARVAO = ${J(db.carvao)};

const ACESSORIOS = ${J(db.acessorios)};

const FOTOS = ${J(FOTOS)};

const STOCK = ${J(STOCK)};
const FOTOS_LIVRES = ${J(FOTOS_LIVRES)};
const stock = (k, w = 1400) => \`https://images.unsplash.com/\${STOCK[k]}?w=\${w}&q=75&auto=format&fit=crop\`;

const PACKS = ${J(db.packs)};
`;
    download("data.js", txt, "text/javascript");
    toast("data.js descarregado");
  }

  /* =========================================================
     EVENTOS
     ========================================================= */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, a, [data-edit], [data-order], label"); if (!t) return;
    if (t.matches("[data-close]")) return closePanel();
    if (t.matches("[data-new]")) return openEditor();
    if (t.dataset.edit && !t.closest("[data-toggle]")) return openEditor(t.dataset.edit);
    if (t.dataset.dup) return openEditor(t.dataset.dup, true);
    if (t.dataset.price) return editPrice(t);
    if (t.matches("[data-pack-new]")) return openPackEditor();
    // --- Página inicial ---
    if (t.dataset.htab) { state.homeTab = t.dataset.htab; return views.inicio(); }
    if (t.dataset.hpick) return openHomePicker(t.dataset.hpick);
    if (t.dataset.hpicked != null) { setPath(ensureHome(), $("#panel").dataset.hpath, t.dataset.hpicked); closePanel(); return homeSave("Foto atualizada"); }
    if (t.dataset.hset) { setPath(ensureHome(), t.dataset.hset, t.dataset.val || ""); return homeSave("Foto removida"); }
    if (t.dataset.hmove) {
      const [list, i, dir] = t.dataset.hmove.split(":"), arr = getPath(ensureHome(), list), j = +i + +dir;
      if (j < 0 || j >= arr.length) return;
      [arr[+i], arr[j]] = [arr[j], arr[+i]]; return homeSave("Ordem atualizada");
    }
    if (t.dataset.hdel) {
      const [list, i] = t.dataset.hdel.split(":"), arr = getPath(ensureHome(), list), removed = arr.splice(+i, 1)[0];
      save(null); redrawHome();
      toast("Apagado", false, () => { getPath(ensureHome(), list).splice(+i, 0, removed); homeSave("Recuperado"); });
      return;
    }
    if (t.dataset.hadd) {
      const arr = getPath(ensureHome(), t.dataset.hadd);
      if (t.dataset.hadd === "faixa.itens") arr.push("Nova frase");
      else arr.push({ ativo: true, kicker: "Novidade", titulo: "TÍTULO", ...(t.dataset.hadd === "slides" ? { sub: "Escreve aqui uma frase curta." } : {}), cta: "Ver mais", link: "shishas", img: "", modo: "lado", cor: "#262626" });
      homeSave("Adicionado — agora escolhe a foto e os textos");
      setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 50);
      return;
    }
    if (t.matches("[data-hreset]")) {
      if (confirm("Voltar a página inicial ao desenho original? As fotos e textos que mudaste aqui serão substituídos.")) { delete db.store.home; ensureHome(); homeSave("Página inicial reposta"); }
      return;
    }
    if (t.id === "savePack") return savePack();
    // --- Cores da shisha ---
    if (t.dataset.coradd && editing) {
      const [nome, hex] = t.dataset.coradd.split("|"), cs = editing.p.cores = editing.p.cores || [];
      if (nome && cs.some(c => c.nome.toLowerCase() === nome.toLowerCase())) return toast(`A cor ${nome} já está na lista`, true);
      cs.push({ nome, hex }); redrawCores();
      if (!nome) $$("#coresBox [data-k='nome']").pop()?.focus();
      return;
    }
    if (t.dataset.cordel != null && editing) { editing.p.cores.splice(+t.dataset.cordel, 1); return redrawCores(); }
    // --- Opiniões ---
    if (t.dataset.rvTab) { state.rev = t.dataset.rvTab; return views.opinioes(); }
    if (t.matches("[data-rv-new]")) return openReviewEditor();
    if (t.id === "saveRev") return saveReviewNew();
    if (t.dataset.rvOk || t.dataset.rvHide) {
      const rv = reviews.find(x => String(x.id) === (t.dataset.rvOk || t.dataset.rvHide)); if (!rv) return;
      const on = !!t.dataset.rvOk;
      updateReview(rv, { aprovado: on }).then(ok => { if (ok) { toast(on ? "Publicada na loja" : "Escondida da loja"); render(); } });
      return;
    }
    if (t.dataset.rvDel) {
      if (confirm("Apagar esta opinião? Não dá para recuperar.")) deleteReview(isNaN(+t.dataset.rvDel) ? t.dataset.rvDel : +t.dataset.rvDel).then(ok => { if (ok) { toast("Opinião apagada"); render(); } });
      return;
    }
    if (t.dataset.pkAdd) {
      const f = findProduct(t.dataset.pkAdd);
      editing.p.itens.push({ id: t.dataset.pkAdd, qty: 1, ...(f.p.precos ? { size: Object.keys(f.p.precos)[0] } : {}) });
      autoPackPrice(); drawPackChosen(); drawPackList(); drawPackSum(); toast(`${nameOf(f.p)} juntado ao pack`); return;
    }
    if (t.dataset.pkRm != null) { editing.p.itens.splice(+t.dataset.pkRm, 1); autoPackPrice(); drawPackChosen(); drawPackList(); drawPackSum(); return; }
    if (t.dataset.pkQty != null) { const it = editing.p.itens[+t.dataset.pkQty]; it.qty = Math.max(1, (it.qty || 1) + +t.dataset.d); autoPackPrice(); drawPackChosen(); drawPackSum(); return; }
    if (t.dataset.pkSug) { editing.p.preco = +t.dataset.pkSug; editing.precoManual = true; drawPackSum(); return; }
    if (t.matches("[data-help-off]")) { ls.set("ss_help_off", true); t.closest(".help").remove(); return; }
    if (t.dataset.del) {
      const f = findProduct(t.dataset.del); if (!f) return;
      const removed = db[f.cat].splice(f.i, 1)[0];
      save(null); closePanel(); render();
      toast(`"${nameOf(removed)}" apagado`, false, () => { db[f.cat].splice(f.i, 0, removed); save("Produto recuperado"); render(); });
      return;
    }
    if (t.dataset.cat) { state.cat = t.dataset.cat; return views.produtos(); }
    if (t.dataset.estado) { state.estado = t.dataset.estado; return views.encomendas(); }
    if (t.dataset.order && !t.matches("[data-del-order]")) return openOrder(t.dataset.order);
    if (t.dataset.setEstado) {
      const o = orders.find(x => x.n === +$("#panel").dataset.order); o.estado = t.dataset.setEstado; setOrderState(o);
      toast(`Encomenda #${o.n}: ${ESTADOS[o.estado]}`); openOrder(o.n); render(); return;
    }
    if (t.dataset.delOrder) {
      if (confirm("Apagar esta encomenda?")) { deleteOrder(+t.dataset.delOrder).then(() => { closePanel(); render(); }); }
      return;
    }
    if (t.matches("[data-demo-orders]")) return demoOrders();
    if (t.matches("[data-clear-demo]")) { if (confirm("Apagar todas as encomendas de exemplo?")) clearDemoOrders(); return; }
    if (t.dataset.export === "js") return exportJs();
    if (t.dataset.export === "json") { download(`shisha-store-copia-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ ...db, orders, reviews }, null, 2), "application/json"); return toast("Cópia descarregada"); }
    if (t.matches("[data-reset]")) {
      if (confirm("Repor a demonstração? As alterações e encomendas feitas neste navegador serão apagadas.")) { localStorage.removeItem("ss_catalog"); localStorage.removeItem("ss_orders"); location.reload(); }
      return;
    }
    if (t.id === "saveProd") return saveProduct();
    if (t.id === "burger" || t.id === "burger2") { const open = $("#side").classList.toggle("is-open"); $("#overlay").classList.toggle("is-on", open); return; }
  });
  // interruptores rápidos na tabela
  document.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.toggle) {
      const f = findProduct(t.dataset.id); if (!f) return;
      const p = f.p, on = t.checked;
      if (t.dataset.toggle === "stock") { if (on) delete p.esgotado; else p.esgotado = true; save(on ? "Marcado em stock" : "Marcado como esgotado"); }
      if (t.dataset.toggle === "visivel") { if (on) delete p.oculto; else p.oculto = true; save(on ? "Visível na loja" : "Oculto da loja"); }
      if (t.dataset.toggle === "destaque") { const k = f.cat === "shishas" || f.cat === "packs" ? "destaque" : "top"; if (on) p[k] = true; else delete p[k]; save(on ? "Em destaque" : "Destaque removido"); }
      drawRows();
    }
    if (t.id === "fstock") drawRows();
    if (t.dataset.cor != null && editing?.p.cores) {
      const c = editing.p.cores[+t.dataset.cor]; if (!c) return;
      if (t.dataset.k === "stock") { if (t.checked) delete c.esgotada; else c.esgotada = true; return redrawCores(); }
    }
    if (t.dataset.corfile != null && editing?.p.cores) {
      const file = t.files[0], i = +t.dataset.corfile; if (!file) return;
      compress(file).then(data => { if (editing?.p.cores?.[i]) { editing.p.cores[i].img = data; redrawCores(); toast("Foto da cor pronta — carrega em Guardar"); } });
      return;
    }
    if (t.dataset.rvReply) {
      const rv = reviews.find(x => String(x.id) === t.dataset.rvReply); if (!rv) return;
      const v = t.value.trim().replace(/[<>]/g, "").slice(0, 400);
      if (v !== (rv.resposta || "")) updateReview(rv, { resposta: v || null }).then(ok => ok && toast(v ? "Resposta guardada" : "Resposta apagada"));
      return;
    }
    if (t.dataset.pkSize != null) { editing.p.itens[+t.dataset.pkSize].size = t.value; drawPackChosen(); drawPackSum(); }
    // --- Página inicial ---
    if (t.dataset.h) {
      const v = t.type === "checkbox" ? t.checked : t.value.trim();
      setPath(ensureHome(), t.dataset.h, v);
      // campos de texto: guarda sem redesenhar (para não perder o cursor ao passar para o campo seguinte)
      if (t.tagName === "INPUT" && (t.type === "text" || t.type === "")) return save("Guardado");
      return homeSave();
    }
    if (t.dataset.hfile) {
      const file = t.files[0]; if (!file) return;
      compress(file).then(data => { setPath(ensureHome(), t.dataset.hfile, data); homeSave("Foto carregada"); });
    }
    if (t.dataset.hnov) {
      const H = ensureHome(), id = t.dataset.hnov;
      H.novidades = t.checked ? [...H.novidades.filter(x => x !== id), id] : H.novidades.filter(x => x !== id);
      return homeSave(t.checked ? "Juntado às Novidades" : "Tirado das Novidades");
    }
  });
  document.addEventListener("input", (e) => {
    const t = e.target;
    if (t.id === "q") { state.q = t.value; drawRows(); }
    // cores: o nome e a cor ficam guardados enquanto se escreve (sem redesenhar)
    if (t.dataset.cor != null && editing?.p.cores && (t.dataset.k === "nome" || t.dataset.k === "hex")) { const c = editing.p.cores[+t.dataset.cor]; if (c) c[t.dataset.k] = t.value; }
  });
  $("#overlay").addEventListener("click", closePanel);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });
  // a loja (noutro separador) pode registar encomendas novas
  if (!LIVE) window.addEventListener("storage", (e) => { if (e.key === "ss_reviews") { reviews = ls.get("ss_reviews", []); if (pinOk() && !$("#panel").classList.contains("is-open")) render(); } });
  if (!LIVE) window.addEventListener("storage", (e) => { if (e.key === "ss_orders") { orders = ls.get("ss_orders", []); if (pinOk() && !$("#panel").classList.contains("is-open")) render(); } });

  let tt;
  function toast(msg, err = false, undo = null) {
    const t = $("#toast"); t.innerHTML = `${err ? "" : I.check}<span>${esc(msg)}</span>${undo ? `<button class="toast__undo">Desfazer</button>` : ""}`;
    t.style.background = err ? "#b91c1c" : ""; t.style.pointerEvents = undo ? "auto" : "";
    if (undo) t.querySelector(".toast__undo").onclick = () => { t.classList.remove("is-on"); undo(); };
    t.classList.add("is-on"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("is-on"), undo ? 6000 : 2400);
  }

  // formulários do painel nunca recarregam a página
  document.addEventListener("submit", (e) => { if (e.target.id !== "loginForm") e.preventDefault(); });
  // novas encomendas: atualiza a cada 30 segundos (modo real)
  if (LIVE) setInterval(async () => {
    if (!session || document.hidden || $("#panel").classList.contains("is-open")) return;
    const before = orders.filter(o => o.estado === "nova").length, rBefore = pendingReviews();
    await Promise.all([refreshOrders(), refreshReviews()]);
    const now = orders.filter(o => o.estado === "nova").length, rNow = pendingReviews();
    if (now > before) toast(`🛍️ Nova encomenda! (${now} por confirmar)`);
    else if (rNow > rBefore) toast(`⭐ Nova opinião para aprovar`);
    // não redesenha enquanto se escreve uma resposta
    if (document.activeElement?.matches("textarea, input")) return;
    if (["painel", "encomendas", "opinioes"].includes(route())) render();
    else { $("#newOrders").textContent = now; $("#newOrders").hidden = !now; $("#newOrders2").textContent = now; $("#newOrders2").hidden = !now; $("#newReviews").textContent = rNow; $("#newReviews").hidden = !rNow; }
  }, 30000);
  // arranque
  if (LIVE) sb.auth.getSession().then(({ data }) => { session = data.session; session ? showApp() : showLogin(); });
  else pinOk() ? showApp() : showLogin();
})();
