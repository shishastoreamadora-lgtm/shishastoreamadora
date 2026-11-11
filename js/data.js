/* =========================================================
   SHISHA STORE AMADORA — Catálogo v1.0
   Fonte: publicações do Instagram @shishaamadoraa (preços e
   tamanhos tal como aparecem nas legendas).
   Campos marcados com  confirmar: true  são valores de exemplo
   que o cliente tem de confirmar antes de publicar.
   Para usar fotos reais: preencher  img: "img/nome.jpg".
   ========================================================= */

const STORE = {
  nome: "Shisha Store",
  cidade: "Amadora",
  morada: "Rua João Hogan, nº 6 — Venda Nova, Amadora",
  telefone: "910 614 646",
  whatsapp: "351910614646",
  instagram: "https://www.instagram.com/shishaamadoraa/",
  horario: [
    ["Segunda a sábado", "10h–12h · 14h–20h"],
    ["Domingo", "14h–20h"],
    ["Feriados", "Horário de domingo"],
  ],
  // Dados legais (Política de privacidade e Termos) — editar no painel → Dados da loja
  empresa: "",
  nif: "",
  email: "",
};

/* ---------- SHISHAS ---------- */
// estilo: moderno | tradicional | portatil | led
// tamanho é calculado pela altura: mini <=30cm, medio <=45cm, grande >45cm
const SHISHAS = [
  { id: "wookah-60", marca: "Wookah", nome: "Wookah Madeira", altura: 60, preco: null, estilo: "moderno", inclui: "Mangueira, pinça", cor: "#8a5a32", destaque: true, novo: true },
  { id: "adalya-ath-45", marca: "Adalya", nome: "Adalya ATH", altura: 45, preco: 200, estilo: "moderno", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#b08d57", destaque: true },
  { id: "adalya-65", marca: "Adalya", nome: "Adalya Grande", altura: 65, preco: 150, estilo: "moderno", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#2d2d2d", destaque: true },
  { id: "amy-carbono-45", marca: "Amy Deluxe", nome: "Amy Deluxe Carbono", altura: 45, preco: 80, estilo: "moderno", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#1c1c1c", destaque: true },
  { id: "amy-90-50", marca: "Amy Deluxe", nome: "Amy Deluxe Premium", altura: 50, preco: 90, estilo: "moderno", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#3b6ea8" },
  { id: "amy-55-50", marca: "Amy Deluxe", nome: "Amy Deluxe", altura: 50, preco: 55, estilo: "moderno", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#9b2c2c" },
  { id: "amy-55-35", marca: "Amy Deluxe", nome: "Amy Deluxe Compacta", altura: 35, preco: 55, estilo: "moderno", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#4a7c59" },
  { id: "amy-40-35", marca: "Amy Deluxe", nome: "Amy Deluxe Classic", altura: 35, preco: 40, estilo: "moderno", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#6b4fa0" },
  { id: "amy-55-20", marca: "Amy Deluxe", nome: "Amy Deluxe Mini", altura: 20, preco: 55, estilo: "portatil", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#c2410c" },
  { id: "crystalia-60", marca: "Crystalia", nome: "Crystalia XL", altura: 60, preco: 80, estilo: "led", inclui: "Acessórios, mangueira, cabeçote de barro, pinça", cor: "#7dd3fc" },
  { id: "crystalia-3s-50", marca: "Crystalia", nome: "Crystalia 3 Saídas", altura: 50, preco: 70, estilo: "led", inclui: "1 mangueira, pinça, cabeçote de barro", cor: "#c084fc" },
  { id: "crystalia-45", marca: "Crystalia", nome: "Crystalia Completa", altura: 45, preco: 60, estilo: "led", inclui: "Mangueira, pinça, cabeçote de silicone, Kaloud", cor: "#f0abfc" },
  { id: "aladin-70", marca: "Aladin", nome: "Aladin", altura: 45, preco: 70, estilo: "moderno", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#a16207" },
  { id: "aladin-alux", marca: "Aladin", nome: "Aladin Alux", altura: 45, preco: 45, estilo: "moderno", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#525252" },
  { id: "boss-50", marca: "Boss", nome: "Boss", altura: 50, preco: 60, estilo: "moderno", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#111827" },
  { id: "galaxy-50", marca: "Galaxy", nome: "Galaxy", altura: 50, preco: 60, estilo: "tradicional", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#1e3a8a" },
  { id: "galaxy-35", marca: "Galaxy", nome: "Galaxy Compacta", altura: 35, preco: 40, estilo: "tradicional", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#312e81" },
  { id: "paname-35", marca: "Paname", nome: "Paname", altura: 35, preco: 55, estilo: "moderno", inclui: "Acessórios, mangueira, tubo, pinça", cor: "#0f766e" },
  { id: "stars-55", marca: "Stars", nome: "Stars", altura: 55, preco: 50, estilo: "tradicional", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#b45309" },
  { id: "stars-45", marca: "Stars", nome: "Stars Média", altura: 45, preco: 40, estilo: "tradicional", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#92400e" },
  { id: "smoke-50", marca: "Smoke", nome: "Smoke", altura: 50, preco: 50, estilo: "tradicional", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#374151" },
  { id: "toro-45", marca: "Toro", nome: "Toro Plus", altura: 45, preco: 45, estilo: "moderno", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#be123c" },
  { id: "toro-40", marca: "Toro", nome: "Toro Kaloud", altura: 40, preco: 40, estilo: "moderno", inclui: "Mangueira, pinça, silicone, Kaloud", cor: "#e11d48" },
  { id: "toro-35", marca: "Toro", nome: "Toro", altura: 45, preco: 35, estilo: "moderno", inclui: "1 mangueira, pinça, cabeçote de barro", cor: "#881337" },
  { id: "toro-25", marca: "Toro", nome: "Toro Mini", altura: 25, preco: 40, estilo: "portatil", inclui: "Mangueira, pinça, cabeçote de barro (com Kaloud e silicone: 45€)", cor: "#9f1239" },
  { id: "clones-45", marca: "Clones", nome: "Clones", altura: 45, preco: 40, estilo: "tradicional", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#57534e" },
  { id: "hookah-30", marca: "Hookah", nome: "Hookah Classic", altura: 30, preco: 30, estilo: "tradicional", inclui: "Mangueira, pinça, cabeçote de barro", cor: "#ca8a04" },
  { id: "ms-10", marca: "MS", nome: "MS Travel", altura: 10, preco: 55, estilo: "portatil", inclui: "Mangueira, pinça", cor: "#404040" },
  { id: "invi-15", marca: "Invi", nome: "Invi", altura: 15, preco: 20, estilo: "portatil", inclui: "Mangueira", cor: "#0ea5e9" },
  { id: "acrilico-25", marca: "Acrílico", nome: "Shisha Acrílico", altura: 25, preco: 15, estilo: "portatil", inclui: "Mangueira, pinça, cabeçote de silicone", cor: "#22c55e" },
];

/* ---------- ESSÊNCIAS ---------- */
// A loja é representante oficial da Adalya em Portugal.
// Preços e lista de sabores: CONFIRMAR com o cliente.
const ESSENCIAS = [
  { id: "ad-love66", marca: "Adalya", sabor: "Love 66", notas: "Melancia, melão, maracujá e menta", cor: "#e11d48", precos: { "50g": 4.5, "200g": 15 }, confirmar: true, top: true },
  { id: "ad-ladykiller", marca: "Adalya", sabor: "Lady Killer", notas: "Manga, frutos do bosque e menta", cor: "#f59e0b", precos: { "50g": 4.5, "200g": 15 }, confirmar: true, top: true },
  { id: "ad-hawaii", marca: "Adalya", sabor: "Hawaii", notas: "Ananás, manga e menta fresca", cor: "#eab308", precos: { "50g": 4.5, "200g": 15 }, confirmar: true },
  { id: "ad-miamor", marca: "Adalya", sabor: "Mi Amor", notas: "Manga, banana, ananás e menta", cor: "#fb923c", precos: { "50g": 4.5, "200g": 15 }, confirmar: true },
  { id: "ad-bluemelon", marca: "Adalya", sabor: "Blue Melon", notas: "Mirtilo e melão doce", cor: "#3b82f6", precos: { "50g": 4.5, "200g": 15 }, confirmar: true },
  { id: "ad-icebonbon", marca: "Adalya", sabor: "Ice Bonbon", notas: "Rebuçado de fruta gelado", cor: "#06b6d4", precos: { "50g": 4.5, "200g": 15 }, confirmar: true },
  { id: "ad-doubleapple", marca: "Adalya", sabor: "Two Apples", notas: "Maçã verde e vermelha com anis", cor: "#16a34a", precos: { "50g": 4.5, "200g": 15 }, confirmar: true },
  { id: "ad-grapemint", marca: "Adalya", sabor: "Grape Mint", notas: "Uva escura e menta", cor: "#7c3aed", precos: { "50g": 4.5, "200g": 15 }, confirmar: true },
  { id: "ad-lemonmint", marca: "Adalya", sabor: "Lemon Mint", notas: "Limão fresco e hortelã", cor: "#84cc16", precos: { "50g": 4.5, "200g": 15 }, confirmar: true },
  { id: "ad-peach", marca: "Adalya", sabor: "Peach Ice", notas: "Pêssego maduro e gelo", cor: "#fdba74", precos: { "50g": 4.5, "200g": 15 }, confirmar: true },
  { id: "ad-mint", marca: "Adalya", sabor: "Mint", notas: "Menta pura, refrescante", cor: "#10b981", precos: { "50g": 4.5, "200g": 15 }, confirmar: true },
  { id: "ad-strawberry", marca: "Adalya", sabor: "Strawberry Ice", notas: "Morango doce com gelo", cor: "#f43f5e", precos: { "50g": 4.5, "200g": 15 }, confirmar: true },
];

/* ---------- CARVÃO ---------- */
const CARVAO = [
  // Marcas vistas nas fotos da loja: Coco Dalya (Adalya) e forno Toro Hookah
  { id: "carv-cocodalya-1kg", marca: "Coco Dalya", nome: "Coco Dalya 1kg — 64 peças", preco: 6, cor: "#3f3f46", confirmar: true, top: true },
  { id: "carv-cocodalya-4kg", marca: "Coco Dalya", nome: "Coco Dalya — Caixa 4kg", preco: 20, cor: "#27272a", confirmar: true },
  { id: "carv-coco-250", marca: "Coco", nome: "Carvão de Coco — 250g", preco: 2.5, cor: "#52525b", confirmar: true },
  { id: "carv-forno", marca: "Toro Hookah", nome: "Forno elétrico para carvão", preco: 12, cor: "#78716c" },
];

/* ---------- ACESSÓRIOS ---------- */
const ACESSORIOS = [
  // Preços da tabela publicada no Instagram (Kaloud corrigido para 10€ na legenda)
  { id: "acc-kaloud", marca: "Kaloud", nome: "Kaloud (gestor de calor)", preco: 10, cor: "#a3a3a3", top: true },
  { id: "acc-conjunto", marca: "Shisha Store", nome: "Conjunto Kaloud + cabeçote de silicone", preco: 12.5, cor: "#404040", confirmar: true },
  { id: "acc-paravento", marca: "Shisha Store", nome: "Para-vento para shisha", preco: 10, cor: "#d4d4d4" },
  { id: "acc-base", marca: "Shisha Store", nome: "Base de shisha", preco: 10, cor: "#525252" },
  { id: "acc-led", marca: "Shisha Store", nome: "LED para base", preco: 5, cor: "#a855f7" },
  { id: "acc-boquilha3d", marca: "Shisha Store", nome: "Boquilha 3D", preco: 5, cor: "#f97316", confirmar: true, top: true },
  { id: "acc-mangueira", marca: "Shisha Store", nome: "Mangueira de silicone lavável", preco: 8, cor: "#0ea5e9", confirmar: true },
  { id: "acc-pinca", marca: "Shisha Store", nome: "Pinça para carvão", preco: 3, cor: "#71717a", confirmar: true },
  { id: "acc-cabecote-barro", marca: "Shisha Store", nome: "Cabeçote de barro", preco: 5, cor: "#b45309", confirmar: true },
  { id: "acc-cabecote-silicone", marca: "Shisha Store", nome: "Cabeçote de silicone", preco: 5, cor: "#dc2626" },
];

/* ---------- FOTOS REAIS ----------
   Produtos com foto em img/<id>.jpg (tiradas do Instagram da loja, 900px).
   Para juntar mais: guardar a foto como img/<id>.jpg e acrescentar o id aqui. */
const FOTOS = [
  "wookah-60", "adalya-ath-45", "adalya-65", "amy-carbono-45", "amy-90-50", "amy-55-50", "amy-55-35",
  "amy-40-35", "amy-55-20", "crystalia-60", "crystalia-3s-50", "crystalia-45", "aladin-70", "aladin-alux",
  "boss-50", "galaxy-50", "galaxy-35", "paname-35", "stars-55", "stars-45", "smoke-50", "toro-45", "toro-40",
  "toro-35", "toro-25", "clones-45", "hookah-30", "ms-10", "invi-15", "acrilico-25",
  "acc-paravento", "pack-75", "pack-85",
];

/* ---------- FOTOS DE AMBIENTE (Unsplash, licença gratuita) ----------
   Servidas diretamente do Unsplash (precisa de internet). Para trocar uma,
   basta mudar o id "photo-…" pelo de outra foto de unsplash.com. */
const STOCK = {
  brasas: "photo-1655855055440-bb76fc92e1ba",      // carvão a arder no cabeçote
  carvaoFumo: "photo-1559756224-da6dbeaf45bf",     // cubos de carvão com fumo
  loungeVermelho: "photo-1574238752695-675b86d49267",
  tabaco: "photo-1683231097406-b02b25e92c0d",      // preparar o tabaco
  tabaco2: "photo-1683231089717-4dde53471d33",
  loungeNeon: "photo-1762553901129-588842051ea0",
  loungeEscuro: "photo-1734995972049-9ba511033c07",
  cabecote: "photo-1511302188604-d1d5ba206381",    // cabeçote com carvão, fundo escuro
  preparar: "photo-1635548308183-45920db8ec88",
};
// Fotos genéricas (sem marcas) por produto: sabores = fruta do sabor; acessórios = foto do tipo de produto
const FOTOS_LIVRES = {
  "ad-love66": "photo-1589984662646-e7b2e4962f18",
  "ad-ladykiller": "photo-1635716279493-d1e30afc25a0",
  "ad-hawaii": "photo-1589820296156-2454bb8a6ad1",
  "ad-miamor": "photo-1619566636858-adf3ef46400b",
  "ad-bluemelon": "photo-1783521339549-fde000c3bb52",
  "ad-icebonbon": "photo-1633158832466-be592c721217",
  "ad-doubleapple": "photo-1610397962076-02407a169a5b",
  "ad-grapemint": "photo-1632040282042-7ebb8d90e5da",
  "ad-lemonmint": "photo-1603653856395-084002e5d39d",
  "ad-peach": "photo-1639588473831-dd9d014646ae",
  "ad-mint": "photo-1588908933351-eeb8cd4c4521",
  "ad-strawberry": "photo-1783711394890-bbe60920b86c",
  "acc-mangueira": "photo-1707737225928-f5b78965e666",
  "acc-boquilha3d": "photo-1646996915297-e81707d38755",
  "acc-pinca": "photo-1668420688223-2681aba9cca6",
  "acc-cabecote-barro": "photo-1693986151906-780147109bdd",
  "acc-cabecote-silicone": "photo-1717061676153-412021ea397a",
  "acc-conjunto": "photo-1705488007677-10f46b295c7b",
  "acc-led": "photo-1685345729575-7f059204c0cd",
  "acc-base": "photo-1747812750221-160934af5254|bottom",        // base de vidro lapidado
  "carv-coco-250": "photo-1756912641606-88fa74182ac9",   // cubos de coco em brasa
  "carv-forno": "photo-1768368826061-9ae98f015137",      // resistência elétrica incandescente
};
const stock = (k, w = 1400) => `https://images.unsplash.com/${STOCK[k]}?w=${w}&q=75&auto=format&fit=crop`;

/* ---------- PACKS ---------- */
const PACKS = [
  { id: "pack-75", nome: "Pack Iniciante", preco: 75, cor: "#b08d57", inclui: ["Shisha", "Mangueira", "Pinça", "Cabeçote de silicone", "Forno", "Carvão", "Boquilha 3D", "100g de sabor"] },
  { id: "pack-85", nome: "Pack Completo", preco: 85, cor: "#1c1c1c", inclui: ["Shisha (modelo superior)", "Mangueira", "Pinça", "Cabeçote de silicone", "Forno", "Carvão", "Boquilha 3D", "100g de sabor"], destaque: true },
];

/* ---------- PÁGINA INICIAL (editável no painel → Página inicial) ----------
   link: "p/<id do produto>" ou uma secção: "shishas", "essencias", "carvao", "acessorios", "packs", "loja"
   modo: "cheio" = foto a ocupar tudo · "lado" = foto ao lado do texto */
const HOME_DEFAULT = {
  slides: [
    { ativo: true, kicker: "Nova chegada", titulo: "WOOKAH", sub: "Madeira artesanal · 60 cm. Já disponível na loja.", cta: "Ver shisha", link: "p/wookah-60", img: "img/wookah-60.jpg", modo: "lado", cor: "#6b4423" },
    { ativo: true, kicker: "Representante oficial", titulo: "ADALYA", sub: "Os sabores mais pedidos de Portugal: Love 66, Lady Killer, Hawaii…", cta: "Ver essências", link: "essencias", img: stock("tabaco"), modo: "cheio", cor: "#1a0a10" },
    { ativo: true, kicker: "Carvão de coco", titulo: "COCO DALYA", sub: "Queima limpa e longa duração. Caixa de 1kg com 64 peças.", cta: "Ver carvão", link: "carvao", img: stock("carvaoFumo"), modo: "cheio", cor: "#0b0b0b" },
    { ativo: true, kicker: "Tudo incluído", titulo: "PACKS DESDE 75€", sub: "Shisha, mangueira, forno, carvão, boquilha 3D e 100g de sabor.", cta: "Ver packs", link: "packs", img: "img/pack-85.jpg", modo: "lado", cor: "#262626" },
    { ativo: true, kicker: "Amy Deluxe", titulo: "CARBONO", sub: "Acabamento em fibra de carbono · 45 cm · 80€", cta: "Comprar", link: "p/amy-carbono-45", img: "img/amy-carbono-45.jpg", modo: "lado", cor: "#1e3a8a" },
  ],
  promos: [
    { ativo: true, kicker: "Novo preço", titulo: "Kaloud a 10€", cta: "Comprar →", link: "p/acc-kaloud", img: stock("cabecote", 900), modo: "cheio", cor: "#0b0b0b" },
    { ativo: true, kicker: "Cristal", titulo: "Crystalia desde 60€", cta: "Ver modelos →", link: "shishas", img: "img/crystalia-3s-50.jpg", modo: "lado", cor: "#6d28d9" },
  ],
  faixa: {
    ativo: true, velocidade: "normal",
    itens: ["Novidades todas as semanas", "Levantamento na loja", "Pagamento seguro", "Atendimento ao cliente", "Representante Adalya", "Melhor preço do mercado"],
  },
  categorias: [
    { cat: "shishas", titulo: "Shishas", img: "img/amy-55-50.jpg", cor: "#f4ede4" },
    { cat: "essencias", titulo: "Essências", img: stock("tabaco2", 600), cor: "#fde2e4" },
    { cat: "carvao", titulo: "Carvão", img: stock("brasas", 600), cor: "#e7e5e4" },
    { cat: "acessorios", titulo: "Acessórios", img: "img/acc-paravento.jpg", cor: "#e0f2fe" },
    { cat: "packs", titulo: "Packs", img: "img/pack-75.jpg", cor: "#ede9fe" },
  ],
  novidades: ["wookah-60", "adalya-ath-45", "amy-carbono-45", "crystalia-3s-50", "boss-50", "toro-25", "paname-35", "stars-55"],
  ambiente: {
    kicker: "A tua sessão, ao teu estilo", titulo: "Monta a sessão perfeita",
    texto: "Shisha, sabor, carvão e acessórios — tudo num só lugar, com aconselhamento de quem percebe.",
    cta: "Ver packs", link: "packs", img: stock("loungeNeon", 1400),
    tiles: [
      { titulo: "Sabores Adalya", sub: "Descobrir →", link: "essencias", img: stock("preparar", 800) },
      { titulo: "Shishas premium", sub: "Ver modelos →", link: "shishas", img: stock("loungeVermelho", 800) },
    ],
  },
  secoes: [
    { id: "categorias", ativo: true }, { id: "garantias", ativo: true }, { id: "novidades", ativo: true },
    { id: "essencias", ativo: true }, { id: "packs", ativo: true }, { id: "ambiente", ativo: true },
    { id: "marcas", ativo: true }, { id: "opinioes", ativo: true }, { id: "loja", ativo: true },
  ],
};

// Junta às secções guardadas as secções novas (na posição certa, antes da que lhe segue)
function mergeSecoes(saved) {
  const out = Array.isArray(saved) ? saved.map(s => ({ ...s })) : [];
  HOME_DEFAULT.secoes.forEach((s, k) => {
    if (out.some(x => x.id === s.id)) return;
    const next = HOME_DEFAULT.secoes.slice(k + 1).find(n => out.some(x => x.id === n.id));
    const at = next ? out.findIndex(x => x.id === next.id) : out.length;
    out.splice(at, 0, { ...s });
  });
  return out;
}
