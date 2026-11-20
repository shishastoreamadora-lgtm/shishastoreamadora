// =========================================================
// SHISHA STORE — Função "equipa" (Supabase Edge Function)
//  - entrar: a equipa entra só com o código → devolve uma sessão
//  - listar / criar / mudar / apagar: só o dono (com sessão iniciada)
// A chave secreta (service_role) existe só aqui no servidor do Supabase.
// Deploy: Supabase → Edge Functions → "equipa" → colar este ficheiro.
//         Em Details, desligar "Verify JWT" (a função valida tudo sozinha).
// =========================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const URL = Deno.env.get("SUPABASE_URL")!;
// chaves novas (sb_secret / sb_publishable) quando existem; senão as antigas
const envJson = (n: string) => { try { return JSON.parse(Deno.env.get(n) || "{}"); } catch { return {}; } };
const SERVICE = envJson("SUPABASE_SECRET_KEYS").default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = envJson("SUPABASE_PUBLISHABLE_KEYS").default || Deno.env.get("SUPABASE_ANON_KEY")!;
const ORIGENS = [
  "https://shishastoreamadora.pt",
  "https://www.shishastoreamadora.pt",
  "https://shishastoreamadora.pages.dev",
  "http://localhost:5182",
];
const MAX_CODIGOS = 20;
const opts = { auth: { persistSession: false, autoRefreshToken: false } };

Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  const okOrigin = ORIGENS.includes(origin) || /^https:\/\/[a-z0-9-]+\.shishastoreamadora\.pages\.dev$/.test(origin);
  const cors = {
    "Access-Control-Allow-Origin": okOrigin ? origin : ORIGENS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ erro: "pedido" }, 400); }
  const acao = String(body.acao || "");
  const admin = createClient(URL, SERVICE, opts);
  const codigoOk = (c: string) => /^\d{6,8}$/.test(c);

  // ---------- Equipa: entrar com código ----------
  if (acao === "entrar") {
    const codigo = String(body.codigo || "").trim();
    if (!codigoOk(codigo)) return json({ erro: "errado" }, 401);
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?";
    const v = await admin.rpc("equipa_verificar", { p_codigo: codigo, p_ip: ip });
    if (v.error) { console.error(v.error); return json({ erro: "servidor" }, 500); }
    const r = v.data?.[0];
    if (!r || r.estado !== "ok") return json({ erro: r?.estado === "bloqueado" ? "bloqueado" : "errado" }, r?.estado === "bloqueado" ? 429 : 401);
    const u = await admin.auth.admin.getUserById(r.user_id);
    const email = u.data.user?.email;
    if (!email) return json({ erro: "servidor" }, 500);
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (link.error) { console.error(link.error); return json({ erro: "servidor" }, 500); }
    const pub = createClient(URL, ANON, opts);
    const s = await pub.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
    if (s.error || !s.data.session) { console.error(s.error); return json({ erro: "servidor" }, 500); }
    return json({ access_token: s.data.session.access_token, refresh_token: s.data.session.refresh_token, nome: r.nome });
  }

  // ---------- Dono: gerir a equipa ----------
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const who = token ? await admin.auth.getUser(token) : null;
  const uid = who?.data.user?.id;
  if (!uid) return json({ erro: "sessao" }, 401);
  const eu = await admin.from("perfis").select("papel").eq("user_id", uid).maybeSingle();
  if (eu.data?.papel !== "dono") return json({ erro: "proibido" }, 403);

  const membro = async (id: string) => {
    const p = await admin.from("perfis").select("papel,nome").eq("user_id", id).maybeSingle();
    return p.data?.papel === "equipa" ? p.data : null;
  };
  const criar = async (nome: string, codigo: string) => {
    const email = `equipa-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}@equipa.shishastoreamadora.pt`;
    const c = await admin.auth.admin.createUser({ email, password: crypto.randomUUID() + crypto.randomUUID(), email_confirm: true, user_metadata: { nome, equipa: true } });
    if (c.error || !c.data.user) throw c.error || new Error("createUser");
    const id = c.data.user.id;
    const p = await admin.from("perfis").insert({ user_id: id, papel: "equipa", nome });
    const g = p.error ? p : await admin.rpc("equipa_guardar", { p_user: id, p_nome: nome, p_codigo: codigo });
    if (g.error) { await admin.auth.admin.deleteUser(id); throw g.error; }
    return id;
  };

  try {
    if (acao === "listar") {
      const l = await admin.from("equipa_codigos").select("user_id,nome,criado,ultimo_acesso").order("criado");
      if (l.error) throw l.error;
      return json({ equipa: l.data });
    }
    if (acao === "criar" || acao === "mudar") {
      const codigo = String(body.codigo || "").trim();
      if (!codigoOk(codigo)) return json({ erro: "codigo" }, 400);
      const livre = await admin.rpc("equipa_codigo_livre", { p_codigo: codigo });
      if (livre.error) throw livre.error;
      if (!livre.data) return json({ erro: "repetido" }, 409);
      if (acao === "criar") {
        const nome = String(body.nome || "").trim().replace(/[<>]/g, "").slice(0, 40);
        if (!nome) return json({ erro: "nome" }, 400);
        const n = await admin.from("equipa_codigos").select("user_id", { count: "exact", head: true });
        if ((n.count || 0) >= MAX_CODIGOS) return json({ erro: "limite" }, 400);
        await criar(nome, codigo);
        return json({ ok: true });
      }
      // mudar: nova conta com o mesmo nome; a antiga é apagada (sai de todos os aparelhos)
      const id = String(body.id || "");
      const m = await membro(id);
      if (!m) return json({ erro: "naoexiste" }, 404);
      await criar(m.nome || "Equipa", codigo);
      await admin.auth.admin.deleteUser(id);
      return json({ ok: true });
    }
    if (acao === "apagar") {
      const id = String(body.id || "");
      if (!(await membro(id))) return json({ erro: "naoexiste" }, 404);
      const d = await admin.auth.admin.deleteUser(id);
      if (d.error) throw d.error;
      return json({ ok: true });
    }
  } catch (e) {
    console.error(e);
    return json({ erro: "servidor" }, 500);
  }
  return json({ erro: "acao" }, 400);
});
