/* =========================================================
   SHISHA STORE AMADORA — App v1.0 (HTML/CSS/JS sem dependências)
   ========================================================= */
SSDB.ready.then(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const eur = (v) => v == null ? "Sob consulta" : v.toLocaleString("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: v % 1 ? 2 : 0 });
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  /* ---------- Catálogo unificado ---------- */
  const tamanho = (cm) => cm <= 30 ? "mini" : cm <= 45 ? "medio" : "grande";
  const ALL = [
    ...SHISHAS.map(p => ({ ...p, tipo: "shisha", tamanho: tamanho(p.altura), sub: `${p.altura} cm` })),
    ...ESSENCIAS.map(p => ({ ...p, tipo: "essencia", nome: p.sabor, preco: Object.values(p.precos)[0], sub: p.notas })),
    ...CARVAO.map(p => ({ ...p, tipo: "carvao" })),
    ...ACESSORIOS.map(p => ({ ...p, tipo: "acessorio" })),
    ...PACKS.map(p => ({ ...p, tipo: "pack", marca: "Shisha Store", sub: p.inclui.join(" · ") })),
  ];
  ALL.forEach(p => { if (!p.img && !p.semFoto && FOTOS.includes(p.id)) p.img = `img/${p.id}.jpg`; });
  // formato "photo-id" ou "photo-id|bottom" (zona do recorte)
  ALL.forEach(p => {
    if (p.img || p.semFoto || !FOTOS_LIVRES[p.id]) return;
    const [id, crop] = FOTOS_LIVRES[p.id].split("|");
    p.img = `https://images.unsplash.com/${id}?w=700&h=700&q=75&auto=format&fit=crop${crop ? "&crop=" + crop : ""}`;
  });
  // fotos de ambiente para produtos sem foto própria
  [["carv-cocodalya-1kg", "brasas"], ["carv-cocodalya-4kg", "carvaoFumo"], ["acc-kaloud", "cabecote"]].forEach(([id, k]) => {
    const p = ALL.find(x => x.id === id); if (p && !p.img && !p.semFoto) p.img = stock(k, 700);
  });
  const byId = Object.fromEntries(ALL.map(p => [p.id, p]));
  const photo = (id, alt = "") => `<img src="img/${id}.jpg" alt="${alt}" loading="lazy">`;

  const img = (p) => {
    if (p.img) return `<img src="${p.img}" alt="${p.nome}" loading="lazy">`;
    switch (p.tipo) {
      case "shisha": return Art.shisha(p.cor, p.altura);
      case "essencia": return Art.essencia(p.cor, p.sabor);
      case "carvao": return p.nome.toLowerCase().includes("forno") ? Art.acessorio(p.cor, p.nome) : Art.carvao(p.cor);
      case "pack": return Art.pack(p.cor);
      default: return Art.acessorio(p.cor, p.nome);
    }
  };

  /* ---------- Estado ---------- */
  let cart = store.get("ss_cart", []).filter(c => byId[c.id] && !byId[c.id].esgotado);
  let favs = store.get("ss_favs", []);

  const heart = `<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>`;
  const icons = {
    truck: `<svg viewBox="0 0 24 24"><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>`,
    lock: `<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
    store: `<svg viewBox="0 0 24 24"><path d="M4 9l1-5h14l1 5M4 9v11h16V9M4 9h16M9 20v-6h6v6"/></svg>`,
    chat: `<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z"/></svg>`,
    star: `<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/></svg>`,
  };

  /* ---------- Cores (variantes) e opiniões ---------- */
  const coresOf = (p) => p.tipo === "shisha" && Array.isArray(p.cores) ? p.cores.filter(c => c && c.nome) : [];
  const REV = SSDB.REVIEWS;
  const revOf = (id) => REV.filter(r => r.produto === id);
  const avgOf = (list) => list.length ? list.reduce((s, r) => s + r.estrelas, 0) / list.length : 0;
  const num1 = (n) => n.toLocaleString("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const starsHTML = (n) => `<span class="stars" role="img" aria-label="${num1(n)} de 5 estrelas">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= Math.round(n) ? "on" : ""}">★</i>`).join("")}</span>`;
  const fmtDia = (iso) => new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });
  function reviewHTML(r, showProd = false) {
    const prod = showProd && r.produto && byId[r.produto];
    return `<article class="review">
      <div class="review__top">${starsHTML(r.estrelas)}<span class="muted small">${fmtDia(r.data)}</span></div>
      <p class="review__txt">${tx(r.texto)}</p>
      <div class="review__who"><span class="review__av">${tx((r.nome || "?")[0].toUpperCase())}</span><strong>${tx(r.nome)}</strong>${prod ? `<a class="muted small" href="#/p/${prod.id}">· ${tx(prod.nome)}</a>` : ""}</div>
      ${r.resposta ? `<div class="review__reply"><strong>Resposta da loja</strong><p>${tx(r.resposta)}</p></div>` : ""}
    </article>`;
  }
  function reviewForm(produto = "") {
    return `<form class="rform" data-rform="${produto}" novalidate>
      <h3>Deixa a tua opinião</h3>
      <div class="rform__stars" role="group" aria-label="Quantas estrelas?">${[1, 2, 3, 4, 5].map(i => `<button type="button" data-rstar="${i}" aria-label="${i} estrela${i > 1 ? "s" : ""}">★</button>`).join("")}</div>
      <input name="nome" type="text" maxlength="40" autocomplete="given-name" placeholder="O teu nome" value="${tx(cliente.nome || "")}">
      <textarea name="texto" maxlength="600" rows="3" placeholder="${produto ? "O que achaste deste produto?" : "Como foi a tua experiência na loja?"}"></textarea>
      <input name="site" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
      <p class="checkout__err" hidden></p>
      <button class="btn btn--dark" type="submit">Enviar opinião</button>
      <p class="muted small">As opiniões são lidas pela loja antes de serem publicadas.</p>
    </form>`;
  }

  /* ---------- Tarjeta de producto (estilo The Premium Way) ---------- */
  function card(p) {
    const fav = favs.includes(p.id);
    const tag = p.esgotado ? `<span class="tag tag--out">Esgotado</span>` : p.novo ? `<span class="tag tag--new">Novo</span>` : p.top ? `<span class="tag">Top vendas</span>` : "";
    return `<article class="card ${p.esgotado ? "is-out" : ""}" data-id="${p.id}">
      <a class="card__img ${p.img ? "has-photo" : ""}" href="#/p/${p.id}">${img(p)}${tag}</a>
      <button class="card__fav ${fav ? "is-on" : ""}" data-fav="${p.id}" aria-label="Favorito">${heart}</button>
      <div class="card__body">
        <span class="card__brand">${p.marca}</span>
        <a class="card__name" href="#/p/${p.id}">${p.nome}${p.tipo === "shisha" ? ` <span class="muted">· ${p.altura} cm</span>` : ""}</a>
        <span class="card__price">${eur(p.preco)}</span>
        ${cardExtras(p)}
      </div>
    </article>`;
  }
  function cardExtras(p) {
    const cs = coresOf(p), rv = revOf(p.id);
    return (cs.length > 1 ? `<span class="card__colors" title="${cs.length} cores">${cs.slice(0, 5).map(c => `<i style="background:${safeCor(c.hex, "#999999")}"></i>`).join("")}${cs.length > 5 ? `<small>+${cs.length - 5}</small>` : ""}</span>` : "")
      + (rv.length ? `<span class="card__rating"><b>★</b> ${num1(avgOf(rv))} <span class="muted">(${rv.length})</span></span>` : "");
  }

  /* ---------- Tarjeta de essência (estilo Hookah.com) ---------- */
  function essCard(raw) {
    const p = byId[raw.id];
    const sizes = Object.keys(p.precos);
    const fav = favs.includes(p.id);
    return `<article class="ess" data-id="${p.id}" style="--c:${p.cor}">
      <button class="card__fav ${fav ? "is-on" : ""}" data-fav="${p.id}" aria-label="Favorito">${heart}</button>
      <a class="ess__img ${p.img ? "has-photo" : ""}" href="#/p/${p.id}">${img(p)}${p.img ? `<span class="ess__label">${p.marca}</span>` : ""}</a>
      <div class="ess__sizes" role="group" aria-label="Tamanho">
        ${sizes.map((s, i) => `<button class="chip-sm ${i === 0 ? "is-on" : ""}" data-size="${s}">${s}</button>`).join("")}
      </div>
      <span class="card__brand">${p.marca}</span>
      <a class="ess__name" href="#/p/${p.id}">${p.sabor}</a>
      <p class="ess__notes">${p.notas}</p>
      <div class="ess__foot">
        <span class="card__price" data-price>${eur(p.precos[sizes[0]])}</span>
        ${p.esgotado ? `<button class="btn btn--ghost btn--sm" disabled>Esgotado</button>` : `<button class="btn btn--dark btn--sm" data-add="${p.id}" data-variant="${sizes[0]}">Adicionar</button>`}
      </div>
    </article>`;
  }

  /* =========================================================
     VISTAS
     ========================================================= */
  const views = {};

  /* ---------- INÍCIO (editável no painel → Página inicial) ---------- */
  const tx = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeLink = (l) => "#/" + (/^[a-z0-9/_-]*$/i.test(l || "") ? (l || "") : "");
  const safeImg = (u) => /^(https:\/\/|img\/|data:image\/(jpeg|png|webp);base64,)/i.test(u || "") ? String(u).replace(/["'<>\s]/g, "") : "";
  const safeCor = (c, d = "#111111") => /^#[0-9a-f]{3,8}$/i.test(c || "") ? c : d;
  const grad = (c, deg = 120) => `linear-gradient(${deg}deg, ${Art.shade(c, -50)} 0%, ${c} 55%, ${Art.shade(c, 60)} 100%)`;
  function homeCfg() {
    const h = STORE.home || {}, d = HOME_DEFAULT, arr = (k) => Array.isArray(h[k]) ? h[k] : d[k];
    const secoes = mergeSecoes(h.secoes);
    return {
      slides: arr("slides"), promos: arr("promos"), categorias: arr("categorias"), novidades: arr("novidades"),
      faixa: { ...d.faixa, ...(h.faixa || {}) }, ambiente: { ...d.ambiente, ...(h.ambiente || {}) }, secoes,
    };
  }

  views.home = () => {
    const H = homeCfg();
    const slides = H.slides.filter(s => s.ativo !== false);
    const promos = H.promos.filter(s => s.ativo !== false);
    const counts = { shishas: SHISHAS.length, essencias: ESSENCIAS.length, carvao: CARVAO.length, acessorios: ACESSORIOS.length, packs: PACKS.length };
    const DUR = { lenta: "60s", normal: "38s", rapida: "22s" };

    const slideHTML = (s, i) => {
      const cor = safeCor(s.cor), img = safeImg(s.img), full = s.modo === "cheio" && img;
      return `<div class="slide ${i === 0 ? "is-active" : ""} ${full ? "slide--full" : ""}" style="background:${full ? cor : grad(cor)}">
        ${full ? `<img class="slide__bg" src="${img}" alt="" ${i ? 'loading="lazy"' : ""}>` : ""}
        <div class="slide__text">
          ${s.kicker ? `<span class="slide__kicker">${tx(s.kicker)}</span>` : ""}
          <h1 class="slide__title">${tx(s.titulo)}</h1>
          ${s.sub ? `<p>${tx(s.sub)}</p>` : ""}
          ${s.cta ? `<a class="btn btn--light" href="${safeLink(s.link)}">${tx(s.cta)}</a>` : ""}
        </div>
        ${!full && img ? `<div class="slide__photo"><img src="${img}" alt="${tx(s.titulo)}" ${i ? 'loading="lazy"' : ""}></div>` : ""}
      </div>`;
    };
    const promoHTML = (p) => {
      const cor = safeCor(p.cor), img = safeImg(p.img), full = p.modo === "cheio" && img;
      return `<a class="promo ${full ? "promo--full" : ""}" href="${safeLink(p.link)}" style="background:${full ? cor : `linear-gradient(135deg, ${cor}, ${Art.shade(cor, 70)})`}">
        ${full ? `<img class="promo__bg" src="${img}" alt="">` : ""}
        <div>${p.kicker ? `<span class="promo__kicker">${tx(p.kicker)}</span>` : ""}<strong>${tx(p.titulo)}</strong>${p.cta ? `<span class="promo__link">${tx(p.cta)}</span>` : ""}</div>
        ${!full && img ? `<div class="promo__photo"><img src="${img}" alt="" loading="lazy"></div>` : ""}
      </a>`;
    };

    const S = {
      categorias: () => `
        <section class="container section">
          <h2 class="h2">Explora por categoria</h2>
          <div class="cats">${H.categorias.map(c => { const img = safeImg(c.img); return `
            <a class="cat" href="${safeLink(c.cat)}" style="--bg:${safeCor(c.cor, "#f4ede4")}">
              <div class="cat__art ${img ? "has-photo" : ""}">${img ? `<img src="${img}" alt="${tx(c.titulo)}" loading="lazy">` : Art.pack("#b08d57")}</div>
              <div class="cat__label"><strong>${tx(c.titulo)}</strong><span>${counts[c.cat] ?? 0} produtos</span></div>
            </a>`; }).join("")}</div>
        </section>`,
      garantias: () => `
        <section class="container perks">
          ${[
            [icons.store, "Levantamento na loja", STORE.cidade ? `${tx(STORE.cidade)}` : ""],
            [icons.lock, "Pagamento seguro", "MB Way, cartão e dinheiro"],
            [icons.truck, "Novidades semanais", "Stock sempre renovado"],
            [icons.chat, "Atendimento ao cliente", "Seg–Dom · WhatsApp"],
          ].map(([i, t, s]) => `<div class="perk"><span class="perk__icon">${i}</span><div><strong>${t}</strong><span>${s}</span></div></div>`).join("")}
        </section>`,
      novidades: () => { const list = H.novidades.map(id => byId[id]).filter(Boolean); return list.length ? `
        <section class="container section">
          <div class="section__head"><h2 class="h2">Novidades</h2><a class="link" href="#/shishas">Ver todas as shishas →</a></div>
          <div class="grid grid--4">${list.map(card).join("")}</div>
        </section>` : ""; },
      essencias: () => ESSENCIAS.length ? `
        <section class="ess-band">
          <div class="container section">
            <div class="section__head">
              <div><span class="eyebrow">Representante oficial em Portugal</span><h2 class="h2">Essências Adalya</h2></div>
              <a class="link" href="#/essencias">Ver todos os sabores →</a>
            </div>
            <div class="grid grid--4">${ESSENCIAS.slice(0, 4).map(essCard).join("")}</div>
          </div>
        </section>` : "",
      packs: () => PACKS.length ? `
        <section class="container section">
          <div class="section__head"><h2 class="h2">Packs completos</h2><a class="link" href="#/packs">Ver packs →</a></div>
          ${packsHTML()}
        </section>` : "",
      ambiente: () => { const a = H.ambiente, t = (a.tiles || []).slice(0, 2); return `
        <section class="vibe">
          <div class="vibe__grid">
            <a class="vibe__tile vibe__tile--big" href="${safeLink(a.link)}">
              ${safeImg(a.img) ? `<img src="${safeImg(a.img)}" alt="" loading="lazy">` : ""}
              <div class="vibe__text">
                ${a.kicker ? `<span class="eyebrow eyebrow--light">${tx(a.kicker)}</span>` : ""}
                <h2>${tx(a.titulo)}</h2>
                ${a.texto ? `<p>${tx(a.texto)}</p>` : ""}
                ${a.cta ? `<span class="btn btn--light">${tx(a.cta)}</span>` : ""}
              </div>
            </a>
            ${t.map(x => `<a class="vibe__tile" href="${safeLink(x.link)}">
              ${safeImg(x.img) ? `<img src="${safeImg(x.img)}" alt="" loading="lazy">` : ""}
              <div class="vibe__text vibe__text--sm"><h3>${tx(x.titulo)}</h3>${x.sub ? `<span>${tx(x.sub)}</span>` : ""}</div>
            </a>`).join("")}
          </div>
        </section>`; },
      marcas: () => `
        <section class="container section">
          <div class="section__head"><h2 class="h2">Compra por marca</h2></div>
          ${brandRow()}
        </section>`,
      opinioes: () => { const list = REV.slice(0, 6), avg = avgOf(REV); return `
        <section class="container section">
          <div class="section__head">
            <div><h2 class="h2">O que dizem os clientes</h2>${list.length ? `<p class="rsum">${starsHTML(avg)} <b>${num1(avg)}</b> de 5 · ${REV.length} opini${REV.length === 1 ? "ão" : "ões"}</p>` : ""}</div>
            <a class="link" href="#/opinioes">${list.length ? "Ver todas →" : "Deixar opinião →"}</a>
          </div>
          ${list.length ? `<div class="reviews__cards">${list.map(r => reviewHTML(r, true)).join("")}</div>`
            : `<a class="rempty" href="#/opinioes"><span class="rempty__stars">★★★★★</span><strong>Já nos visitaste?</strong><span class="muted">Conta-nos como foi — a tua opinião ajuda outros clientes.</span></a>`}
        </section>`; },
      loja: () => lojaHTML(),
    };

    const faixa = H.faixa.ativo !== false && (H.faixa.itens || []).length ? `
      <div class="marquee" aria-hidden="true"><div class="marquee__track" style="--dur:${DUR[H.faixa.velocidade] || "38s"}">
        ${[...H.faixa.itens, ...H.faixa.itens, ...H.faixa.itens].map(t => `<span>${tx(t)}</span><i>✦</i>`).join("")}
      </div></div>` : "";

    return `
    ${slides.length || promos.length ? `
    <section class="hero container ${promos.length ? "" : "hero--solo"}">
      ${slides.length ? `<div class="slider" id="slider">
        ${slides.map(slideHTML).join("")}
        ${slides.length > 1 ? `
        <button class="slider__arrow slider__arrow--prev" aria-label="Anterior"><svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg></button>
        <button class="slider__arrow slider__arrow--next" aria-label="Seguinte"><svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg></button>
        <div class="slider__dots">${slides.map((_, i) => `<button class="${i === 0 ? "is-active" : ""}" data-dot="${i}" aria-label="Slide ${i + 1}"></button>`).join("")}</div>` : ""}
      </div>` : ""}
      ${promos.length ? `<div class="promos">${promos.slice(0, 2).map(promoHTML).join("")}</div>` : ""}
    </section>` : ""}
    ${faixa}
    ${H.secoes.filter(s => s.ativo !== false && S[s.id]).map(s => S[s.id]()).join("")}
    `;
  };

  function brandRow() {
    const brands = [...new Set(SHISHAS.map(s => s.marca))];
    return `<div class="brands">${brands.map(b => `<a class="brand" href="#/shishas?marca=${encodeURIComponent(b)}">${b}</a>`).join("")}</div>`;
  }

  function packsHTML() {
    return `<div class="packs">${PACKS.map(p => `
      <article class="pack ${p.destaque ? "pack--hi" : ""}">
        <div class="pack__art ${byId[p.id].img ? "has-photo" : ""}">${img(byId[p.id])}</div>
        <div class="pack__body">
          ${p.destaque ? `<span class="tag">Mais completo</span>` : ""}
          <h3>${p.nome}</h3>
          <ul>${p.inclui.map(i => `<li>${i}</li>`).join("")}</ul>
          ${p.valor && p.preco != null && p.valor > p.preco ? `<div class="pack__save"><s>${eur(p.valor)}</s><span>Poupas ${eur(p.valor - p.preco)}</span></div>` : ""}
          <div class="pack__foot"><span class="pack__price">${eur(p.preco)}</span>${p.esgotado ? `<button class="btn btn--ghost" disabled>Esgotado</button>` : `<button class="btn btn--dark" data-add="${p.id}">Adicionar</button>`}</div>
        </div>
      </article>`).join("")}</div>`;
  }

  function lojaHTML() {
    return `<section class="loja" id="loja" style="--loja-bg:url('${new URL("img/pack-85.jpg", location.href).href}')">
      <div class="container loja__grid">
        <div>
          <span class="eyebrow eyebrow--light">Loja física</span>
          <h2 class="h2 h2--light">Visita-nos na Amadora</h2>
          <p class="loja__addr">${STORE.morada}</p>
          <table class="hours">${STORE.horario.map(([d, h]) => `<tr><td>${d}</td><td>${h}</td></tr>`).join("")}</table>
          <div class="loja__actions">
            <a class="btn btn--light" href="https://wa.me/${STORE.whatsapp}" target="_blank" rel="noopener">WhatsApp ${STORE.telefone}</a>
            <a class="btn btn--outline-light" href="https://maps.google.com/?q=${encodeURIComponent("Rua João Hogan 6, Venda Nova, Amadora")}" target="_blank" rel="noopener">Como chegar</a>
          </div>
        </div>
        <div class="map">
          <!-- O mapa só carrega quando o cliente toca (o Google Maps usa cookies — RGPD) -->
          <button class="map__load" id="mapLoad" data-q="${tx(STORE.morada)}">
            <svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
            Ver o mapa da loja
            <small>Ao tocar, o mapa do Google é carregado e pode usar cookies do Google.</small>
          </button>
        </div>
      </div>
    </section>`;
  }

  /* ---------- SHISHAS (estilo Hookah Vault) ---------- */
  views.shishas = (q) => {
    const brands = [...new Set(SHISHAS.map(s => s.marca))];
    const estilos = [["moderno", "Moderna"], ["tradicional", "Tradicional"], ["led", "Com LED"], ["portatil", "Portátil / Viagem"]];
    const tamanhos = [["mini", "Mini", "até 30 cm"], ["medio", "Média", "31–45 cm"], ["grande", "Grande", "+45 cm"]];
    return `
    <section class="page-hero"><div class="container">
      <nav class="crumbs"><a href="#/">Início</a> / <span>Shishas</span></nav>
      <h1>Shishas</h1>
      <p>${SHISHAS.length} modelos em loja. Todas incluem mangueira e pinça.</p>
    </div></section>

    <section class="container shop-by">
      <h3 class="label">Compra por marca</h3>
      <div class="brand-scroller">${brands.map(b => `<button class="brand ${q.marca === b ? "is-on" : ""}" data-filter="marca" data-value="${b}">${b}</button>`).join("")}</div>

      <div class="shop-by__row">
        <div>
          <h3 class="label">Compra por estilo</h3>
          <div class="chips">${estilos.map(([v, t]) => `<button class="chip ${q.estilo === v ? "is-on" : ""}" data-filter="estilo" data-value="${v}"><i class="dot dot--${v}"></i>${t}</button>`).join("")}</div>
        </div>
        <div>
          <h3 class="label">Compra por tamanho</h3>
          <div class="sizes">${tamanhos.map(([v, t, s]) => `<button class="size ${q.tamanho === v ? "is-on" : ""}" data-filter="tamanho" data-value="${v}"><strong>${t}</strong><span>${s}</span></button>`).join("")}</div>
        </div>
      </div>
    </section>

    <section class="container shop">
      <aside class="filters" id="filters">
        <div class="filters__head"><strong>Filtros</strong><button class="link" data-clear>Limpar</button></div>
        <details open><summary>Marca</summary>${brands.map(b => `<label><input type="checkbox" data-f="marca" value="${b}" ${q.marca === b ? "checked" : ""}> ${b} <span>${SHISHAS.filter(s => s.marca === b).length}</span></label>`).join("")}</details>
        <details open><summary>Estilo</summary>${estilos.map(([v, t]) => `<label><input type="checkbox" data-f="estilo" value="${v}" ${q.estilo === v ? "checked" : ""}> ${t}</label>`).join("")}</details>
        <details open><summary>Tamanho</summary>${tamanhos.map(([v, t, s]) => `<label><input type="checkbox" data-f="tamanho" value="${v}" ${q.tamanho === v ? "checked" : ""}> ${t} <span>${s}</span></label>`).join("")}</details>
        <details open><summary>Preço</summary>
          <div class="price-range"><input type="number" placeholder="Desde €" data-price="min" min="0"><input type="number" placeholder="Até €" data-price="max" min="0"></div>
        </details>
      </aside>
      <div>
        <div class="toolbar">
          <button class="btn btn--ghost btn--sm show-sm" id="openFilters">Filtros</button>
          <span class="muted" id="count"></span>
          <select id="sort" aria-label="Ordenar">
            <option value="dest">Em destaque</option>
            <option value="asc">Preço: mais baixo</option>
            <option value="desc">Preço: mais alto</option>
            <option value="alt">Altura</option>
            <option value="az">Nome A–Z</option>
          </select>
        </div>
        <div class="grid grid--3" id="results"></div>
      </div>
    </section>`;
  };

  function applyShishaFilters() {
    const sel = (f) => $$(`input[data-f="${f}"]:checked`).map(i => i.value);
    const m = sel("marca"), e = sel("estilo"), t = sel("tamanho");
    const min = parseFloat($('[data-price="min"]')?.value) || 0;
    const max = parseFloat($('[data-price="max"]')?.value) || Infinity;
    let list = ALL.filter(p => p.tipo === "shisha"
      && (!m.length || m.includes(p.marca))
      && (!e.length || e.includes(p.estilo))
      && (!t.length || t.includes(p.tamanho))
      && ((p.preco ?? 0) >= min && (p.preco ?? 0) <= max));
    const s = $("#sort").value;
    if (s === "asc") list.sort((a, b) => (a.preco ?? 1e9) - (b.preco ?? 1e9));
    if (s === "desc") list.sort((a, b) => (b.preco ?? 0) - (a.preco ?? 0));
    if (s === "alt") list.sort((a, b) => b.altura - a.altura);
    if (s === "az") list.sort((a, b) => a.nome.localeCompare(b.nome));
    if (s === "dest") list.sort((a, b) => (b.destaque ? 1 : 0) - (a.destaque ? 1 : 0));
    $("#results").innerHTML = list.length ? list.map(card).join("") : `<p class="empty">Nenhuma shisha com estes filtros. <button class="link" data-clear>Limpar filtros</button></p>`;
    $("#count").textContent = `${list.length} ${list.length === 1 ? "produto" : "produtos"}`;
    // sincroniza botões "Compra por…"
    $$("[data-filter]").forEach(b => b.classList.toggle("is-on", sel(b.dataset.filter).includes(b.dataset.value)));
  }

  /* ---------- ESSÊNCIAS (área própria, estilo Hookah.com) ---------- */
  views.essencias = () => `
    <section class="page-hero page-hero--ess" style="--hero-bg:url('${stock("tabaco", 1600)}')"><div class="container">
      <nav class="crumbs"><a href="#/">Início</a> / <span>Essências</span></nav>
      <span class="eyebrow eyebrow--light">Representante oficial Adalya em Portugal</span>
      <h1>Essências</h1>
      <p>Escolhe o sabor e o tamanho. Reserva online e levanta na loja.</p>
    </div></section>
    <section class="container section">
      <div class="ess-tools">
        <div class="chips" id="essFilter">
          ${[["all", "Todos"], ["fruta", "Frutados"], ["menta", "Com menta / gelo"], ["top", "Mais vendidos"]].map(([v, t], i) => `<button class="chip ${i === 0 ? "is-on" : ""}" data-ess="${v}">${t}</button>`).join("")}
        </div>
        <input type="search" class="ess-search" id="essSearch" placeholder="Procurar sabor…">
      </div>
      <div class="grid grid--4" id="essGrid">${ESSENCIAS.map(essCard).join("")}</div>
      <p class="note">Os preços das essências são provisórios.</p>
    </section>`;

  function filterEss() {
    const f = $("#essFilter .is-on").dataset.ess;
    const q = $("#essSearch").value.trim().toLowerCase();
    const list = ESSENCIAS.filter(p => {
      const txt = (p.sabor + " " + p.notas).toLowerCase();
      if (q && !txt.includes(q)) return false;
      if (f === "menta") return /menta|gelo|ice|hortelã/.test(txt);
      if (f === "fruta") return !/^mint$/i.test(p.sabor);
      if (f === "top") return p.top;
      return true;
    });
    $("#essGrid").innerHTML = list.map(essCard).join("") || `<p class="empty">Nenhum sabor encontrado.</p>`;
  }

  /* ---------- LISTAS SIMPLES ---------- */
  const simpleList = (titulo, desc, tipo, crumb, bg) => () => `
    <section class="page-hero ${bg ? "page-hero--photo" : ""}" ${bg ? `style="--hero-bg:url('${bg}')"` : ""}><div class="container">
      <nav class="crumbs"><a href="#/">Início</a> / <span>${crumb}</span></nav>
      <h1>${titulo}</h1><p>${desc}</p>
    </div></section>
    <section class="container section"><div class="grid grid--4">${ALL.filter(p => p.tipo === tipo).map(card).join("")}</div></section>`;

  views.carvao = simpleList("Carvão", "Carvão de coco natural e forno elétrico para acender sem fumo.", "carvao", "Carvão", stock("carvaoFumo", 1600));
  views.acessorios = simpleList("Acessórios", "Kaloud, cabeçotes, mangueiras, boquilhas 3D, bases e LED.", "acessorio", "Acessórios", stock("cabecote", 1600));
  views.packs = () => `
    <section class="page-hero"><div class="container">
      <nav class="crumbs"><a href="#/">Início</a> / <span>Packs</span></nav>
      <h1>Packs</h1><p>Tudo o que precisas para começar, num só pack.</p>
    </div></section>
    <section class="container section">${packsHTML()}</section>`;
  views.loja = () => lojaHTML();
  views.opinioes = () => { const avg = avgOf(REV); return `
    <section class="container section">
      <nav class="crumbs"><a href="#/">Início</a> / <span>Opiniões</span></nav>
      <h1 class="h2">Opiniões de clientes</h1>
      ${REV.length ? `<p class="rsum rsum--big">${starsHTML(avg)} <b>${num1(avg)}</b> de 5 · ${REV.length} opini${REV.length === 1 ? "ão" : "ões"}</p>` : `<p class="muted">Ainda não há opiniões publicadas. Sê o primeiro!</p>`}
      <div class="reviews__grid">
        <div class="reviews__list">${REV.map(r => reviewHTML(r, true)).join("")}</div>
        ${reviewForm()}
      </div>
    </section>`; };

  /* ---------- PÁGINAS LEGAIS ---------- */
  const fill = (v, ph) => v ? v : `<em class="muted">[${ph}]</em>`;
  const legalPage = (title, body) => `
    <section class="page-hero"><div class="container"><nav class="crumbs"><a href="#/">Início</a> / <span>${title}</span></nav><h1>${title}</h1></div></section>
    <section class="container section legal">${body}<p class="muted small">Última atualização: ${new Date().toLocaleDateString("pt-PT", { month: "long", year: "numeric" })}</p></section>`;
  const owner = () => `${fill(STORE.empresa, "nome da empresa")}, NIF ${fill(STORE.nif, "NIF")}, com sede em ${STORE.morada}`;
  views.privacidade = () => legalPage("Política de privacidade", `
    <h2>Quem é o responsável pelos seus dados</h2>
    <p>${owner()} ("${STORE.nome}"). Contacto: ${fill(STORE.email, "email")} · ${STORE.telefone}.</p>
    <h2>Que dados recolhemos</h2>
    <p>Este site não tem registo de clientes nem pede dados pessoais. Quando faz uma encomenda, guardamos apenas os produtos, as quantidades e o valor, para preparar o pedido. Os seus dados de contacto (nome e número) chegam-nos pelo WhatsApp, quando decide enviar a mensagem.</p>
    <h2>Para que usamos os dados</h2>
    <p>Apenas para preparar e entregar a sua encomenda e responder às suas mensagens. Não vendemos nem partilhamos os seus dados com terceiros para fins de marketing.</p>
    <h2>Dados guardados no seu navegador</h2>
    <p>O carrinho, os favoritos e a confirmação de idade ficam guardados no seu próprio navegador (armazenamento local) e não nos são enviados. Pode apagá-los a qualquer momento nas definições do navegador. Não usamos cookies de publicidade.</p>
    <h2>Serviços de terceiros</h2>
    <p>O site usa o WhatsApp (Meta) para as encomendas, o Google Maps para o mapa da loja e um serviço de alojamento de base de dados na União Europeia. Estes serviços têm as suas próprias políticas de privacidade.</p>
    <h2>Os seus direitos</h2>
    <p>Pode pedir o acesso, a correção ou a eliminação dos seus dados através de ${fill(STORE.email, "email")}. Pode também apresentar reclamação à Comissão Nacional de Proteção de Dados (www.cnpd.pt).</p>`);
  views.termos = () => legalPage("Termos e condições", `
    <h2>Identificação</h2>
    <p>${owner()}. Contacto: ${fill(STORE.email, "email")} · ${STORE.telefone}.</p>
    <h2>Venda a maiores de 18 anos</h2>
    <p>A venda de produtos de tabaco e artigos relacionados é exclusiva a maiores de 18 anos. Poderá ser pedido documento de identificação no levantamento.</p>
    <h2>Encomendas</h2>
    <p>As encomendas feitas no site são enviadas por WhatsApp e só ficam confirmadas quando respondermos. Os produtos de tabaco são reservados online e pagos e levantados na loja física.</p>
    <h2>Preços</h2>
    <p>Os preços incluem IVA à taxa legal em vigor. Em caso de erro evidente de preço, contactaremos o cliente antes de confirmar a encomenda.</p>
    <h2>Trocas e devoluções</h2>
    <p>Os artigos não usados e na embalagem original podem ser trocados ou devolvidos no prazo legal. Produtos de tabaco abertos não podem ser devolvidos por razões de higiene e segurança.</p>
    <h2>Resolução de litígios</h2>
    <p>Em caso de litígio, o consumidor pode recorrer ao Livro de Reclamações (www.livroreclamacoes.pt) ou a uma entidade de resolução alternativa de litígios de consumo, como o CNIACC — Centro Nacional de Informação e Arbitragem de Conflitos de Consumo (www.cniacc.pt).</p>`);

  /* ---------- PRODUTO ---------- */
  views.product = (_, id) => {
    const p = byId[id];
    if (!p) return `<section class="container section"><h1>Produto não encontrado</h1><a class="link" href="#/">Voltar ao início</a></section>`;
    const back = { shisha: ["Shishas", "shishas"], essencia: ["Essências", "essencias"], carvao: ["Carvão", "carvao"], acessorio: ["Acessórios", "acessorios"], pack: ["Packs", "packs"] }[p.tipo];
    const sizes = p.precos ? Object.keys(p.precos) : null;
    const cores = coresOf(p), ci = cores.findIndex(c => !c.esgotada), cor = cores[ci];
    const semCor = cores.length > 0 && ci === -1;   // todas as cores esgotadas
    const revs = revOf(p.id), avg = avgOf(revs);
    const related = ALL.filter(x => x.tipo === p.tipo && x.id !== p.id).slice(0, 4);
    const specs = p.tipo === "shisha"
      ? [["Marca", p.marca], ["Altura", p.altura + " cm"], ["Estilo", { moderno: "Moderna", tradicional: "Tradicional", led: "Com LED", portatil: "Portátil" }[p.estilo]], ["Inclui", p.inclui]]
      : p.tipo === "essencia" ? [["Marca", p.marca], ["Notas", p.notas], ["Tamanhos", sizes.join(" · ")]]
      : p.tipo === "pack" ? [["Inclui", p.inclui.join(", ")]]
      : [["Marca", p.marca]];
    return `
    <section class="container product">
      <nav class="crumbs"><a href="#/">Início</a> / <a href="#/${back[1]}">${back[0]}</a> / <span>${p.nome}</span></nav>
      <div class="product__grid">
        <div class="product__img ${p.img || safeImg(cor?.img) ? "has-photo" : ""}" id="pImg" style="--c:${p.cor}">${safeImg(cor?.img) ? `<img src="${safeImg(cor.img)}" alt="${tx(p.nome)} ${tx(cor.nome)}">` : img(p)}</div>
        <div class="product__info">
          <span class="card__brand">${p.marca}</span>
          <h1>${p.nome}</h1>
          ${revs.length ? `<button class="prating" data-goto="rev">${starsHTML(avg)} ${num1(avg)} · ${revs.length} opini${revs.length === 1 ? "ão" : "ões"}</button>` : ""}
          <div class="product__price" id="pPrice">${eur(sizes ? p.precos[sizes[0]] : p.preco)}</div>
          ${cores.length ? `<div class="label">Cor: <b id="pCorNome">${tx(cor ? cor.nome : "esgotada")}</b></div>
          <div class="swatches" id="pCores">${cores.map((c, i) => `<button class="swatch ${i === ci ? "is-on" : ""}" data-pcor="${i}" style="--sw:${safeCor(c.hex, "#999999")}" title="${tx(c.nome)}${c.esgotada ? " (esgotada)" : ""}" aria-label="${tx(c.nome)}${c.esgotada ? " (esgotada)" : ""}" ${c.esgotada ? "disabled" : ""}></button>`).join("")}</div>` : ""}
          ${sizes ? `<div class="label">Tamanho</div><div class="chips" id="pSizes">${sizes.map((s, i) => `<button class="chip ${i === 0 ? "is-on" : ""}" data-psize="${s}">${s}</button>`).join("")}</div>` : ""}
          <table class="specs">${specs.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>
          <div class="product__actions">
            ${p.preco == null
              ? `<a class="btn btn--dark btn--lg" href="https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(`Olá! Qual o preço da ${p.nome} (${p.altura} cm)?`)}" target="_blank" rel="noopener">Pedir preço no WhatsApp</a>`
              : p.esgotado || semCor ? `<button class="btn btn--ghost btn--lg" disabled>Esgotado de momento</button>`
              : `<button class="btn btn--dark btn--lg" data-add="${p.id}" ${sizes ? `data-variant="${sizes[0]}"` : cor ? `data-variant="${tx(cor.nome)}"` : ""} id="pAdd">Adicionar ao carrinho</button>`}
            <button class="btn btn--ghost btn--lg ${favs.includes(p.id) ? "is-on" : ""}" data-fav="${p.id}">${heart} Favorito</button>
          </div>
          <ul class="product__perks">
            <li>${icons.store} Levantamento na loja — Venda Nova, Amadora</li>
            <li>${icons.chat} Dúvidas? Fala connosco no WhatsApp ${STORE.telefone}</li>
          </ul>
        </div>
      </div>
      <div class="section reviews" id="rev">
        <div class="section__head"><div><h2 class="h2">Opiniões</h2>${revs.length ? `<p class="rsum">${starsHTML(avg)} <b>${num1(avg)}</b> de 5 · ${revs.length} opini${revs.length === 1 ? "ão" : "ões"}</p>` : ""}</div></div>
        <div class="reviews__grid">
          <div class="reviews__list">${revs.length ? revs.map(r => reviewHTML(r)).join("") : `<p class="muted">Ainda não há opiniões sobre este produto. Já o tens? Conta-nos o que achaste.</p>`}</div>
          ${reviewForm(p.id)}
        </div>
      </div>
      ${related.length ? `<div class="section"><h2 class="h2">Também podes gostar</h2><div class="grid grid--4">${(p.tipo === "essencia" ? related.map(essCard) : related.map(card)).join("")}</div></div>` : ""}
    </section>`;
  };

  /* =========================================================
     ROUTER
     ========================================================= */
  function parse() {
    const h = location.hash.replace(/^#\/?/, "");
    const [path, qs] = h.split("?");
    const q = Object.fromEntries(new URLSearchParams(qs || ""));
    const parts = path.split("/").filter(Boolean);
    return { route: parts[0] || "home", arg: parts[1], q };
  }

  function render() {
    const { route, arg, q } = parse();
    const view = route === "p" ? views.product : views[route] || views.home;
    $("#app").innerHTML = view(q, arg);
    $$(".nav a[data-route]").forEach(a => a.classList.toggle("is-active", a.dataset.route === route));
    closeAll();
    window.scrollTo({ top: 0, behavior: "instant" });
    if (route === "home" || !views[route] && route !== "p") initSlider();
    if (route === "shishas") applyShishaFilters();
    document.title = route === "home" ? "Shisha Store Amadora — Shishas, Essências, Carvão e Acessórios" : `${$("#app h1")?.textContent || "Shisha Store"} · Shisha Store Amadora`;
  }

  /* ---------- Slider ---------- */
  let sliderTimer;
  function initSlider() {
    const el = $("#slider"); clearInterval(sliderTimer); if (!el) return;
    const slides = $$(".slide", el), dots = $$("[data-dot]", el);
    if (slides.length < 2) return;
    let i = 0;
    const go = (n) => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle("is-active", k === i));
      dots.forEach((d, k) => d.classList.toggle("is-active", k === i));
    };
    const auto = () => { clearInterval(sliderTimer); sliderTimer = setInterval(() => go(i + 1), 5500); };
    $(".slider__arrow--prev", el).onclick = () => { go(i - 1); auto(); };
    $(".slider__arrow--next", el).onclick = () => { go(i + 1); auto(); };
    dots.forEach(d => d.onclick = () => { go(+d.dataset.dot); auto(); });
    let x0 = null;
    el.addEventListener("touchstart", e => x0 = e.touches[0].clientX, { passive: true });
    el.addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { go(i + (dx < 0 ? 1 : -1)); auto(); } x0 = null; });
    auto();
  }

  /* =========================================================
     CARRINHO / FAVORITOS
     ========================================================= */
  function priceOf(item) { const p = byId[item.id]; return item.variant && p.precos ? p.precos[item.variant] : p.preco; }
  function saveCart() { store.set("ss_cart", cart); updateBadges(); }
  function addToCart(id, variant) {
    const ex = cart.find(c => c.id === id && c.variant === (variant || null));
    ex ? ex.qty++ : cart.push({ id, variant: variant || null, qty: 1 });
    saveCart();
    toast(`${byId[id].nome}${variant ? " · " + variant : ""} adicionado ao carrinho`);
  }
  function toggleFav(id) {
    favs = favs.includes(id) ? favs.filter(f => f !== id) : [...favs, id];
    store.set("ss_favs", favs); updateBadges();
    $$(`[data-fav="${id}"]`).forEach(b => b.classList.toggle("is-on", favs.includes(id)));
  }
  function updateBadges() {
    const n = cart.reduce((s, c) => s + c.qty, 0);
    $("#cartCount").textContent = n; $("#cartCount").hidden = !n;
    $("#favCount").textContent = favs.length; $("#favCount").hidden = !favs.length;
  }

  function openDrawer(mode) {
    const body = $("#drawerBody"), foot = $("#drawerFoot");
    if (mode === "fav") {
      $("#drawerTitle").textContent = "Favoritos";
      body.innerHTML = favs.length ? favs.map(id => byId[id]).filter(Boolean).map(p => `
        <div class="line"><a class="line__img" href="#/p/${p.id}">${img(p)}</a>
          <div class="line__info"><a href="#/p/${p.id}"><strong>${p.nome}</strong></a><span class="muted">${p.marca}</span><span>${eur(p.preco)}</span></div>
          <button class="icon-btn" data-fav="${p.id}" aria-label="Remover"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`).join("")
        : `<p class="empty">Ainda não tens favoritos. Toca no ♡ de um produto para o guardar.</p>`;
      foot.innerHTML = "";
    } else {
      $("#drawerTitle").textContent = "O teu carrinho";
      const total = cart.reduce((s, c) => s + (priceOf(c) || 0) * c.qty, 0);
      body.innerHTML = cart.length ? cart.map((c, idx) => { const p = byId[c.id], ci = coresOf(p).find(x => x.nome === c.variant); return `
        <div class="line"><a class="line__img" href="#/p/${p.id}">${safeImg(ci?.img) ? `<img src="${safeImg(ci.img)}" alt="">` : img(p)}</a>
          <div class="line__info"><strong>${p.nome}</strong><span class="muted">${p.marca}${c.variant ? " · " + (ci ? "Cor: " : "") + tx(c.variant) : ""}</span>
            <div class="qty"><button data-qty="${idx}" data-d="-1" aria-label="Menos">−</button><span>${c.qty}</span><button data-qty="${idx}" data-d="1" aria-label="Mais">+</button></div></div>
          <strong>${eur((priceOf(c) || 0) * c.qty)}</strong></div>`; }).join("")
        : `<p class="empty">O carrinho está vazio.</p><a class="btn btn--dark" href="#/shishas">Ver shishas</a>`;
      foot.innerHTML = cart.length ? `
        <div class="total"><span>Total</span><strong>${eur(total)}</strong></div>
        <div class="checkout">
          <input id="ckNome" type="text" autocomplete="name" placeholder="O teu nome" maxlength="60" value="${tx(cliente.nome || "")}">
          <input id="ckTel" type="tel" autocomplete="tel" inputmode="tel" placeholder="Telemóvel (ex.: 912 345 678)" maxlength="20" value="${tx(cliente.tel || "")}">
          <p class="checkout__err" id="ckErr" hidden></p>
        </div>
        <button class="btn btn--wa btn--lg btn--block" id="waOrder">Encomendar por WhatsApp</button>
        <p class="muted small">Pagamento e levantamento na loja: ${tx(STORE.morada)}.</p>` : "";
    }
    open($("#cartDrawer"));
  }
  function waMessage(total, cli = {}) {
    const lines = cart.map(c => { const p = byId[c.id]; return `• ${c.qty}x ${p.nome}${c.variant ? ` (${coresOf(p).some(x => x.nome === c.variant) ? "cor " : ""}${c.variant})` : ""} — ${eur((priceOf(c) || 0) * c.qty)}`; });
    return `Olá ${STORE.nome}! Gostaria de encomendar:\n${lines.join("\n")}\n\nTotal: ${eur(total)}\nLevantamento na loja.${cli.nome ? `\n\nNome: ${cli.nome}\nTelemóvel: ${cli.tel}` : ""}`;
  }
  // Dados do cliente (guardados só no telemóvel dele, para a próxima encomenda)
  let cliente = store.get("ss_cliente", {});
  // Regista a encomenda para o back office (admin.html → Encomendas) e abre o WhatsApp
  function checkout() {
    const nome = $("#ckNome").value.trim().replace(/\s+/g, " "), tel = $("#ckTel").value.trim();
    const digits = tel.replace(/\D/g, "");
    const err = (m, el) => { const e = $("#ckErr"); e.textContent = m; e.hidden = false; el.focus(); };
    if (nome.length < 2) return err("Escreve o teu nome.", $("#ckNome"));
    if (digits.length < 9 || digits.length > 15) return err("Escreve um número de telemóvel válido.", $("#ckTel"));
    cliente = { nome, tel }; store.set("ss_cliente", cliente);
    const items = cart.map(c => { const p = byId[c.id]; return { id: c.id, nome: p.nome, variant: c.variant, qty: c.qty, preco: priceOf(c) || 0 }; });
    const total = items.reduce((s, i) => s + i.preco * i.qty, 0);
    const url = `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(waMessage(total, cliente))}`;
    SSDB.placeOrder(items, total, cliente);
    const w = window.open(url, "_blank", "noopener"); if (!w) location.href = url;
    cart = []; saveCart(); setTimeout(() => { closeAll(); toast("Encomenda enviada! Obrigado 🙌"); }, 300);
  }

  /* ---------- Pesquisa ---------- */
  function search(q) {
    q = q.trim().toLowerCase();
    const out = $("#searchResults");
    if (q.length < 2) { out.innerHTML = ""; return; }
    const res = ALL.filter(p => `${p.nome} ${p.marca} ${p.sub || ""} ${p.tipo}`.toLowerCase().includes(q)).slice(0, 8);
    out.innerHTML = res.length ? res.map(p => `<a href="#/p/${p.id}" class="sr"><span class="sr__img">${img(p)}</span><span><strong>${p.nome}</strong><small>${p.marca}</small></span><span>${eur(p.preco)}</span></a>`).join("")
      : `<p class="muted">Sem resultados para “${q}”.</p>`;
  }

  /* ---------- Gavetas / overlay ---------- */
  function open(el) { closeAll(); el.classList.add("is-open"); el.setAttribute("aria-hidden", "false"); $("#overlay").classList.add("is-on"); document.body.style.overflow = "hidden"; }
  function closeAll() {
    $$(".drawer").forEach(d => { d.classList.remove("is-open"); d.setAttribute("aria-hidden", "true"); });
    $("#filters")?.classList.remove("is-open");
    $("#overlay").classList.remove("is-on"); document.body.style.overflow = "";
    $("#searchbar").hidden = true;
  }

  let toastT;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("is-on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("is-on"), 2400); }

  /* =========================================================
     EVENTOS (delegação)
     ========================================================= */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, a"); if (!t) return;

    if (t.dataset.add) { addToCart(t.dataset.add, t.dataset.variant); return; }
    if (t.id === "waOrder") { checkout(); return; }
    if (t.id === "mapLoad") {
      const f = document.createElement("iframe");
      Object.assign(f, { title: "Mapa da loja", loading: "lazy", referrerPolicy: "no-referrer-when-downgrade",
        src: `https://maps.google.com/maps?q=${encodeURIComponent(t.dataset.q || STORE.morada)}&z=16&output=embed` });
      t.replaceWith(f); return;
    }
    if (t.dataset.fav) { toggleFav(t.dataset.fav); if ($("#cartDrawer").classList.contains("is-open") && $("#drawerTitle").textContent === "Favoritos") openDrawer("fav"); return; }
    if (t.dataset.qty != null && t.dataset.d) {
      const c = cart[+t.dataset.qty]; c.qty += +t.dataset.d; if (c.qty <= 0) cart.splice(+t.dataset.qty, 1);
      saveCart(); openDrawer("cart"); return;
    }
    if (t.dataset.size) { // tamanho na tarjeta de essência
      const art = t.closest(".ess"), p = byId[art.dataset.id];
      $$(".chip-sm", art).forEach(b => b.classList.toggle("is-on", b === t));
      $("[data-price]", art).textContent = eur(p.precos[t.dataset.size]);
      $("[data-add]", art).dataset.variant = t.dataset.size; return;
    }
    if (t.dataset.pcor != null) { // cor na página de produto
      const p = byId[parse().arg], c = coresOf(p)[+t.dataset.pcor]; if (!c) return;
      $$("#pCores .swatch").forEach(b => b.classList.toggle("is-on", b === t));
      $("#pCorNome").textContent = c.nome;
      if ($("#pAdd")) $("#pAdd").dataset.variant = c.nome;
      const box = $("#pImg"), src = safeImg(c.img);
      box.innerHTML = src ? `<img src="${src}" alt="${tx(p.nome)} ${tx(c.nome)}">` : img(p);
      box.classList.toggle("has-photo", !!(src || p.img)); return;
    }
    if (t.dataset.rstar) { // estrelas no formulário de opinião
      const f = t.closest("[data-rform]"), v = +t.dataset.rstar; f.dataset.val = v;
      $$("[data-rstar]", f).forEach(b => b.classList.toggle("is-on", +b.dataset.rstar <= v)); return;
    }
    if (t.dataset.goto) { $("#" + t.dataset.goto)?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (t.dataset.psize) { // tamanho na página de produto
      const p = byId[parse().arg];
      $$("#pSizes .chip").forEach(b => b.classList.toggle("is-on", b === t));
      $("#pPrice").textContent = eur(p.precos[t.dataset.psize]); $("#pAdd").dataset.variant = t.dataset.psize; return;
    }
    if (t.dataset.filter) { // botões "Compra por…"
      const box = $(`input[data-f="${t.dataset.filter}"][value="${t.dataset.value}"]`);
      box.checked = !box.checked; applyShishaFilters(); $("#results").scrollIntoView({ behavior: "smooth", block: "start" }); return;
    }
    if (t.hasAttribute("data-clear")) { $$("#filters input").forEach(i => i.type === "checkbox" ? i.checked = false : i.value = ""); applyShishaFilters(); return; }
    if (t.dataset.ess) { $$("#essFilter .chip").forEach(b => b.classList.toggle("is-on", b === t)); filterEss(); return; }
    if (t.id === "openFilters") { $("#filters").classList.add("is-open"); $("#overlay").classList.add("is-on"); return; }
    if (t.hasAttribute("data-close")) { closeAll(); return; }

    switch (t.id) {
      case "burger": open($("#mobileMenu")); break;
      case "cartBtn": openDrawer("cart"); break;
      case "favBtn": openDrawer("fav"); break;
      case "searchBtn": { const sb = $("#searchbar"); const show = sb.hidden; closeAll(); sb.hidden = !show; if (show) $("#searchInput").focus(); break; }
    }
  });
  // Enviar opinião
  document.addEventListener("submit", async (e) => {
    const f = e.target.closest("[data-rform]"); if (!f) return;
    e.preventDefault();
    const err = (m) => { const x = $(".checkout__err", f); x.textContent = m; x.hidden = !m; };
    if (f.elements.site.value) return;   // robô
    const estrelas = +f.dataset.val || 0, nome = f.elements.nome.value.trim().replace(/\s+/g, " "), texto = f.elements.texto.value.trim();
    if (!estrelas) return err("Escolhe de 1 a 5 estrelas.");
    if (nome.length < 2) return err("Escreve o teu nome.");
    if (texto.length < 3) return err("Escreve a tua opinião.");
    const sent = store.get("ss_rev_sent", []).filter(t => Date.now() - t < 864e5);
    if (sent.length >= 3) return err("Já deixaste várias opiniões hoje. Obrigado!");
    const btn = $('button[type="submit"]', f); btn.disabled = true; btn.textContent = "A enviar…"; err("");
    const res = await SSDB.sendReview({ produto: f.dataset.rform || null, nome, estrelas, texto });
    if (!res.ok) { btn.disabled = false; btn.textContent = "Enviar opinião"; return err(res.msg); }
    store.set("ss_rev_sent", [...sent, Date.now()]);
    f.innerHTML = `<div class="rform__ok"><strong>Obrigado, ${tx(nome.split(" ")[0])}! 🙌</strong><p class="muted">A tua opinião foi enviada e aparece na loja depois de ser aprovada.</p></div>`;
  });
  $("#overlay").addEventListener("click", closeAll);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeAll(); });
  document.addEventListener("change", e => { if (e.target.matches("#filters input, #sort")) applyShishaFilters(); });
  document.addEventListener("input", e => {
    if (e.target.id === "searchInput") search(e.target.value);
    if (e.target.matches("[data-price]")) applyShishaFilters();
    if (e.target.id === "essSearch") filterEss();
  });
  window.addEventListener("scroll", () => $("#header").classList.toggle("is-scrolled", scrollY > 10), { passive: true });
  window.addEventListener("hashchange", render);

  /* ---------- Verificação de idade (18+) ---------- */
  if (!store.get("ss_age", false)) {
    const g = $("#ageGate"); g.hidden = false; document.body.style.overflow = "hidden";
    $("#ageYes").onclick = () => { store.set("ss_age", true); g.hidden = true; document.body.style.overflow = ""; };
    $("#ageNo").onclick = () => { $(".age-card p").textContent = "Lamentamos, o acesso é exclusivo a maiores de 18 anos."; $(".age-actions").remove(); };
  }

  // Logotipo oficial: versão horizontal (img/logo-h.png) e em negativo para fundos escuros
  $$(".logo").forEach(el => {
    const src = el.classList.contains("logo--light") ? "img/logo-h-white.png" : "img/logo-h.png";
    el.innerHTML = `<img class="logo__img" src="${src}" alt="Shisha Store">`;
  });
  $("#year").textContent = new Date().getFullYear();
  // Dados da loja editáveis no back office
  const tel = $(".topbar__center a");
  if (tel) { tel.textContent = STORE.telefone; tel.href = "tel:+" + STORE.whatsapp; }
  if (STORE.aviso) $(".topbar__center").textContent = STORE.aviso;
  $$('a[href^="https://wa.me/"]').forEach(a => { if (!a.href.includes("?")) a.href = "https://wa.me/" + STORE.whatsapp; });
  // rodapé com os dados atuais da loja
  const set = (id, fn) => { const el = $(id); if (el) fn(el); };
  set("#footMorada", el => { el.textContent = STORE.morada; });
  set("#footHorario", el => { el.innerHTML = ""; (STORE.horario || []).forEach(([d, h], i) => { if (i) el.append(document.createElement("br")); el.append(`${d}: ${h}`); }); });
  set("#footTel", el => { el.textContent = STORE.telefone; el.href = "tel:+" + STORE.whatsapp; });
  set("#footIg", el => { if (/^https:\/\//.test(STORE.instagram || "")) el.href = STORE.instagram; });
  updateBadges();
  render();
});
