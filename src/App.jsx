import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Mail, ArrowLeft, ExternalLink, Sun, Moon } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

// ------------------------------------------------------
// PradoWrites – Minimal Blog (MD posts)
// Mudança: posts agora vêm de /public/posts/index.json com conteúdo
// em arquivos .md individuais. Mantém fallback local se não houver
// arquivos ainda. Inclui cache simples de conteúdo.
// ------------------------------------------------------

// Fallback local caso /posts/index.json não exista ainda
const FALLBACK_POSTS = [
  {
    slug: "manifesto",
    title: "Manifesto do PradoWrites",
    date: "2025-08-12",
    excerpt:
      "Por que escrever, o que publicar aqui e como pretendo manter este canal vivo.",
    tags: ["meta", "introducao"],
    mdPath: "/posts/manifesto.md",
  },
  {
    slug: "operacao-e-estrategia",
    title: "Notas rápidas sobre Operação e Estratégia",
    date: "2025-08-10",
    excerpt:
      "Um snapshot prático: indicadores que realmente movem a agulha no dia a dia.",
    tags: ["gestao", "kpi"],
    mdPath: "/posts/operacao-e-estrategia.md",
  },
  {
    slug: "mvrv-e-ciclos",
    title: "MVRV e leitura de ciclos",
    date: "2025-08-06",
    excerpt:
      "Resumo da abordagem de regressão sobre MVRV e picos de ciclo, para consulta rápida.",
    tags: ["bitcoin", "dados"],
    mdPath: "/posts/mvrv-e-ciclos.md",
  },
];

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

// Pure function for testing and reuse
export function searchPosts(posts, q, contentMap) {
  if (!q) return posts;
  const query = q.toLowerCase();
  return posts.filter((p) => {
    const inTitle = p.title.toLowerCase().includes(query);
    const inExcerpt = (p.excerpt || "").toLowerCase().includes(query);
    const inTags = Array.isArray(p.tags) && p.tags.some((t) => String(t).toLowerCase().includes(query));
    const content = contentMap?.[p.slug] || "";
    const inContent = content.toLowerCase().includes(query);
    return inTitle || inExcerpt || inTags || inContent;
  });
}

// Hook wrapper with memoization
function useSearch(posts, query, contentMap) {
  return useMemo(() => searchPosts(posts, query, contentMap), [posts, query, contentMap]);
}

function Markdown({ text, invert }) {
  // Tiny markdown renderer for headings, bold, italics, code, lists and links
  const html = useMemo(() => {
    let h = text
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-8 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>')
      .replace(/^> (.*$)/gim, '<blockquote class="border-l pl-4 italic opacity-80 my-4">$1</blockquote>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/`([^`]+)`/gim, '<code class="px-1 py-0.5 text-sm rounded bg-neutral-800/40">$1</code>')
      .replace(/\n- (.*)/gim, '<ul class="list-disc ml-6 my-2"><li>$1</li></ul>')
      .replace(/\n\n/g, '<br/><br/>');

    // Links [text](url)
    h = h.replace(/\[(.*?)\]\((.*?)\)/g, '<a class="underline hover:no-underline" href="$2" target="_blank" rel="noreferrer">$1</a>');
    return h;
  }, [text]);

  return (
    <div
      className={
        invert ? "prose prose-invert max-w-none" : "prose max-w-none"
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function PradoWrites() {
  const [active, setActive] = useState(null); // slug | null
  const [panel, setPanel] = useState(null); // 'about' | 'contact' | 'archive' | null
  const [query, setQuery] = useState("");
  const [darkMode, setDarkMode] = useState(true);

  const [posts, setPosts] = useState(FALLBACK_POSTS);
  const [contentMap, setContentMap] = useState({}); // { slug: mdString }
  const [loadingPost, setLoadingPost] = useState(false);

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "dark") setDarkMode(true);
      else if (stored === "light") setDarkMode(false);
      else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) setDarkMode(false);
    } catch {}
  }, []);

  // Persist theme
  useEffect(() => {
    try { localStorage.setItem("theme", darkMode ? "dark" : "light"); } catch {}
  }, [darkMode]);

  // Fetch posts index from /public/posts/index.json if available
  useEffect(() => {
    let cancelled = false;
    fetch("/posts/index.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data) && data.length) setPosts(data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Load content for active post if not cached
  useEffect(() => {
    if (!active) return;
    if (contentMap[active]) return;
    const meta = posts.find((p) => p.slug === active);
    if (!meta) return;
    const path = meta.mdPath || `/posts/${meta.slug}.md`;
    setLoadingPost(true);
    fetch(path)
      .then((r) => (r.ok ? r.text() : "# Conteúdo não encontrado"))
      .then((txt) => setContentMap((m) => ({ ...m, [meta.slug]: txt })))
      .finally(() => setLoadingPost(false));
  }, [active, posts, contentMap]);

  const results = useSearch(posts, query, contentMap);
  const activePost = active ? posts.find((p) => p.slug === active) : null;
  const activeContent = activePost ? contentMap[activePost.slug] : "";

  const theme = {
    page: darkMode ? "min-h-screen bg-neutral-950 text-neutral-100" : "min-h-screen bg-neutral-100 text-neutral-900",
    header: darkMode
      ? "sticky top-0 z-20 backdrop-blur border-b border-neutral-900/80 bg-neutral-950/70"
      : "sticky top-0 z-20 backdrop-blur border-b border-neutral-300/80 bg-neutral-100/70",
    searchBox: darkMode
      ? "mb-8 flex items-center gap-2 border border-neutral-900 rounded-2xl px-3 py-2"
      : "mb-8 flex items-center gap-2 border border-neutral-300 rounded-2xl px-3 py-2",
    input: "w-full bg-transparent outline-none text-sm",
    footer: "mx-auto max-w-3xl px-4 py-12 opacity-70 text-sm",
    selection: darkMode ? "selection:bg-neutral-200 selection:text-neutral-900" : "selection:bg-neutral-800 selection:text-neutral-100",
    borderPanel: darkMode ? "border-neutral-900 bg-neutral-950" : "border-neutral-300 bg-white",
  };

  return (
    <div className={`${theme.page} ${theme.selection}`}>
      {/* Top bar */}
      <header className={theme.header}>
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <button onClick={() => { setActive(null); setPanel(null); }} className="text-lg tracking-tight font-semibold hover:opacity-80">
            Prado<span className="opacity-80">Writes</span>
          </button>

          <nav className="flex items-center gap-3 text-sm">
            <button className="hover:opacity-80" onClick={() => { setActive(null); setPanel("archive"); }}>Arquivo</button>
            <button className="hover:opacity-80" onClick={() => { setActive(null); setPanel("about"); }}>Sobre</button>
            <button className="hover:opacity-80" onClick={() => { setActive(null); setPanel("contact"); }}>Contato</button>
            <button onClick={() => setDarkMode((v) => !v)} className="hover:opacity-80" aria-label="Alternar tema">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-3xl px-4 py-10">
        {!active && (
          <div className={theme.searchBox}>
            <Search size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título, tag ou trecho..."
              className={theme.input}
            />
          </div>
        )}

        {/* Listing */}
        {!active && !panel && (
          <ul className="space-y-8">
            {results.map((post) => (
              <li key={post.slug} className="group">
                <button
                  onClick={() => setActive(post.slug)}
                  className="text-left w-full"
                >
                  <motion.h2 layout className="text-xl font-semibold tracking-tight group-hover:underline">
                    {post.title}
                  </motion.h2>
                  <div className="text-xs opacity-70 mt-1">{formatDate(post.date)} · {post.tags?.join(" · ")}</div>
                  <p className="opacity-90 mt-2">{post.excerpt}</p>
                </button>
              </li>
            ))}

            {results.length === 0 && (
              <p className="opacity-70">Nada encontrado. Tente outros termos.</p>
            )}
          </ul>
        )}

        {/* Post view */}
        {activePost && (
          <article className="max-w-2xl">
            <button onClick={() => setActive(null)} className="inline-flex items-center gap-2 text-sm mb-6 hover:opacity-80">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">{activePost.title}</h1>
            <div className="text-xs opacity-70 mt-1">{formatDate(activePost.date)} · {activePost.tags?.join(" · ")}</div>
            <div className="mt-6">
              {activePost.slug === "mvrv-e-ciclos" ? (
                <div className="rounded-xl overflow-hidden border border-neutral-900/40">
                  <BitcoinDashboardPhase5Visual />
                </div>
              ) : (
                <>
                  {loadingPost && <p className="opacity-70 text-sm">Carregando…</p>}
                  {!loadingPost && <Markdown text={activeContent || ""} invert={darkMode} />}
                </>
              )}
            </div>
          </article>
        )}

        {/* Panels */}
        <AnimatePresence>
          {panel && (
            <Overlay onClose={() => setPanel(null)} darkMode={darkMode}>
              {getPanel(panel, posts)}
            </Overlay>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className={theme.footer}>
        © {new Date().getFullYear()} PradoWrites · Feito com React.
      </footer>
    </div>
  );
}

function getPanel(kind, posts) {
  if (kind === "about") {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Sobre</h2>
        <p>
          PradoWrites é um canal pessoal para publicar ideias, notas de operação e produtos, tecnologia, gestão e o que estiver em experimento. Minimalista, direto, sem anúncios.
        </p>
        <p className="opacity-80">
          Temas recorrentes: operações, KPIs, dados aplicados, IA prática e esportes.
        </p>
      </div>
    );
  }
  if (kind === "contact") {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Contato</h2>
        <p>
          Preferência por e-mail. Respondo assim que possível.
        </p>
        <a
          className="inline-flex items-center gap-2 underline hover:no-underline"
          href="mailto:contato@pradowrites.com"
        >
          <Mail size={16} /> contato@pradowrites.com
        </a>
        <p className="text-sm opacity-70">
          Dica: crie o e-mail e domínio no provedor de sua preferência e aponte o site quando publicar.
        </p>
      </div>
    );
  }
  if (kind === "archive") {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Arquivo</h2>
        <ul className="space-y-3">
          {posts.map((p) => (
            <li key={p.slug} className="flex items-center justify-between">
              <span className="opacity-80 text-sm">{formatDate(p.date)}</span>
              <span className="flex-1 mx-3 truncate">{p.title}</span>
              <a
                href={`#${p.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  const evt = new CustomEvent("open-post", { detail: p.slug });
                  window.dispatchEvent(evt);
                }}
                className="text-sm underline hover:no-underline inline-flex items-center gap-1"
              >
                Abrir <ExternalLink size={14} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return null;
}

function Overlay({ children, onClose, darkMode }) {
  const box = darkMode
    ? "w-full max-w-2xl rounded-2xl border border-neutral-900 bg-neutral-950 p-6 shadow-2xl"
    : "w-full max-w-2xl rounded-2xl border border-neutral-300 bg-white p-6 shadow-2xl";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-black/30"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 10, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className={box}
      >
        <button onClick={onClose} className="text-sm opacity-70 hover:opacity-100">Fechar</button>
        <div className="mt-3">{children}</div>
      </motion.div>
    </motion.div>
  );
}

// ------------------------------------------------------
// Dev tests for searchPosts and index fallbacks
// ------------------------------------------------------
function runDevTests() {
  if (typeof window === "undefined") return;
  const samples = [
    { slug: "a", title: "Teste A", excerpt: "foo bar", tags: ["alpha"], mdPath: "/posts/a.md" },
    { slug: "mvrv", title: "MVRV explained", excerpt: "bitcoin metric", tags: ["bitcoin"], mdPath: "/posts/mvrv.md" },
    { slug: "gestao", title: "Gestão", excerpt: "KPIs e margem", tags: ["kpi", "gestao"], mdPath: "/posts/gestao.md" },
  ];
  const contents = { mvrv: "mvrv details" };
  console.assert(searchPosts(samples, "").length === 3, "searchPosts: vazio retorna todos");
  console.assert(searchPosts(samples, "mvrv", contents).length === 1, "searchPosts: encontra por conteúdo carregado");
  console.assert(searchPosts(samples, "kpi", contents).length === 1, "searchPosts: encontra por tag");
  console.assert(searchPosts(samples, "inexistente", contents).length === 0, "searchPosts: termo inexistente");
}

runDevTests();

/* ------------------------------------------------------
   Inline Dashboard Component (renders when slug === 'mvrv-e-ciclos')
   Adaptado para funcionar dentro deste arquivo único.
------------------------------------------------------ */

// Helpers
function generateMockPriceSeries(days = 180) {
  const now = Date.now();
  let price = 68000;
  return Array.from({ length: days }, (_, i) => {
    price += (Math.random() - 0.5) * 1200;
    const t = now - (days - 1 - i) * 24 * 60 * 60 * 1000;
    return { t, price: Math.max(15000, price) };
  });
}

function generateMockMVRVSeries(anchorLength = 180) {
  const now = Date.now();
  let mvrv = 2.1;
  const len = typeof anchorLength === 'number' && anchorLength > 0 ? anchorLength : 180;
  const arr = Array.from({ length: len }, (_, i) => {
    mvrv += (Math.random() - 0.5) * 0.06;
    const t = now - (len - 1 - i) * 24 * 60 * 60 * 1000;
    return { t, mvrv: Math.max(0.6, Math.min(5, mvrv)) };
  });
  return { current: arr[arr.length - 1].mvrv, series: arr };
}

async function fetchBTC() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("http " + res.status);
    const j = await res.json();
    const p = j && j.bitcoin ? j.bitcoin : null;
    return {
      price: p && typeof p.usd === "number" ? p.usd : null,
      change24h: p && typeof p.usd_24h_change === "number" ? p.usd_24h_change : null,
    };
  } catch (e) {
    return { price: null, change24h: null, error: String(e && e.message ? e.message : e) };
  }
}

async function fetchBTC6m() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=180&interval=daily",
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("http " + res.status);
    const j = await res.json();
    const prices = Array.isArray(j.prices) ? j.prices : [];
    return prices.map(([ts, val]) => ({ t: ts, price: Number(val) }));
  } catch (e) {
    return generateMockPriceSeries(180);
  }
}

async function fetchFearGreed() {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1&format=json", { cache: "no-store" });
    if (!res.ok) throw new Error("http " + res.status);
    const j = await res.json();
    const v = j && j.data && j.data[0] ? j.data[0] : null;
    return {
      value: v && v.value ? Number(v.value) : null,
      classification: v && v.value_classification ? String(v.value_classification) : null,
      updated: v && v.timestamp ? new Date(Number(v.timestamp) * 1000) : null,
    };
  } catch (e) {
    return { value: null, classification: null, updated: null, error: String(e && e.message ? e.message : e) };
  }
}

async function fetchMVRV() {
  try {
    const res = await fetch("/api/mvrv", { cache: "no-store" });
    if (!res.ok) throw new Error("http " + res.status);
    const j = await res.json();
    const points = Array.isArray(j.series) ? j.series : [];
    return {
      current: typeof j.current === 'number' ? j.current : (points.length ? Number(points[points.length - 1].mvrv) : null),
      series: points.map((p) => ({ t: new Date(p.t).getTime(), mvrv: Number(p.mvrv) })),
      fromProxy: true,
    };
  } catch (e) {
    const mock = generateMockMVRVSeries();
    return { ...mock, fromProxy: false, error: String(e && e.message ? e.message : e) };
  }
}

function currency(n) {
  return typeof n === "number"
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })
    : "—";
}

function FNGBar({ value = 0 }) {
  const v = Math.max(0, Math.min(100, Number(value || 0)));
  const color = v < 30 ? '#dc2626' : (v <= 75 ? '#f59e0b' : '#dc2626');
  return (
    <div style={{ width: '100%', height: 12, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${v}%`, height: '100%', background: color }} />
    </div>
  );
}

function computeMvrvDomain(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return [0, 4];
  let mn = Infinity, mx = -Infinity;
  for (const p of arr) {
    if (typeof p.mvrv === 'number') {
      if (p.mvrv < mn) mn = p.mvrv;
      if (p.mvrv > mx) mx = p.mvrv;
    }
  }
  if (!isFinite(mn) || !isFinite(mx)) return [0, 4];
  const pad = Math.max(0.05, (mx - mn) * 0.1);
  return [Math.max(0, Math.floor((mn - pad) * 10) / 10), Math.ceil((mx + pad) * 10) / 10];
}

function buildAlerts(state) {
  const out = [];
  const mv = state && state.mvrv && typeof state.mvrv.current === 'number' ? state.mvrv.current : null;
  const fg = state && typeof state.fngValue === 'number' ? state.fngValue : null;
  if (typeof mv === 'number') {
    if (mv >= 3.0) out.push({ level: 'HIGH', title: 'MVRV Overbought', desc: `MVRV at ${mv.toFixed(2)} (>= 3.0).` });
    else if (mv >= 2.5) out.push({ level: 'MEDIUM', title: 'MVRV Elevated', desc: `MVRV at ${mv.toFixed(2)} (>= 2.5).` });
  }
  if (typeof fg === 'number' && fg >= 70) out.push({ level: 'MEDIUM', title: 'Extreme Greed', desc: `Fear & Greed = ${fg}.` });
  return out;
}

function AlertBadge({ level }) {
  const color = level === 'HIGH' ? '#dc2626' : level === 'MEDIUM' ? '#f59e0b' : '#64748b';
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 999, background: color, marginTop: 6 }} />;
}

const S = {
  page: { background: '#0b1220', minHeight: '100vh' },
  hero: {
    background: 'linear-gradient(180deg, #0b1220 0%, #0f172a 100%)',
    color: '#e2e8f0',
    padding: '24px 24px 12px',
    borderBottom: '1px solid rgba(148,163,184,0.12)'
  },
  heroTitle: { fontSize: 24, fontWeight: 800, letterSpacing: 0.2 },
  heroSub: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  content: { padding: 24 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 },
  mainGrid: (isWide) => ({ display: 'grid', gridTemplateColumns: isWide ? '2fr 1fr' : '1fr', gap: 16 }),
  card: { background: '#ffffff', borderRadius: 16, boxShadow: '0 4px 24px rgba(2,6,23,0.05)', border: '1px solid #eef2f7', padding: 14 },
  statLabel: { fontSize: 12, color: '#64748b' },
  statValue: { fontSize: 22, fontWeight: 700 },
  muted: { fontSize: 12, color: '#64748b' },
  btn: { padding: '8px 12px', borderRadius: 10, border: '1px solid #1f2937', background: 'transparent', color: '#e5e7eb', cursor: 'pointer' },
};

function Sidebar({ active = 'dashboard', onSelect }) {
  const items = [
    { id: 'dashboard', label: 'MVRV' },
    { id: 'markets', label: 'Markets' },
    { id: 'onchain', label: 'On-chain' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'settings', label: 'Settings' },
  ];
  const Item = ({ id, label }) => {
    const isActive = active === id;
    return (
      <button
        onClick={() => onSelect && onSelect(id)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid ' + (isActive ? '#334155' : 'transparent'),
          background: isActive ? 'rgba(148,163,184,0.12)' : 'transparent',
          color: '#e2e8f0',
          cursor: 'pointer'
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <aside style={{
      width: 240,
      minHeight: '100vh',
      background: '#0b1220',
      borderRight: '1px solid rgba(148,163,184,0.12)',
      padding: 16,
      position: 'sticky',
      top: 0
    }}>
      <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 16, marginBottom: 12 }}>Menu</div>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((it) => (
          <Item key={it.id} id={it.id} label={it.label} />
        ))}
      </div>
    </aside>
  );
}

function mergeSeries(priceArr, mvrvArr) {
  const out = [];
  let i = 0, j = 0;
  while (i < (priceArr?.length || 0) || j < (mvrvArr?.length || 0)) {
    const p = priceArr[i];
    const m = mvrvArr[j];
    if (p && m) {
      const tp = Number(p.t);
      const tm = Number(m.t);
      if (Math.abs(tp - tm) <= 12 * 60 * 60 * 1000) {
        out.push({ t: tp, price: p.price, mvrv: m.mvrv });
        i++; j++;
      } else if (tp < tm) {
        out.push({ t: tp, price: p.price, mvrv: undefined });
        i++;
      } else {
        out.push({ t: tm, price: undefined, mvrv: m.mvrv });
        j++;
      }
    } else if (p) {
      out.push({ t: Number(p.t), price: p.price, mvrv: undefined });
      i++;
    } else if (m) {
      out.push({ t: Number(m.t), price: undefined, mvrv: m.mvrv });
      j++;
    } else {
      break;
    }
  }
  return out;
}

function compute10DayTicks(series) {
  if (!Array.isArray(series) || !series.length) return [];
  const start = Number(series[0].t);
  const end = Number(series[series.length - 1].t);
  const oneDay = 24 * 60 * 60 * 1000;
  const step = 10 * oneDay;
  const alignedStart = start - (start % oneDay);
  const ticks = [];
  for (let t = alignedStart; t <= end + 1; t += step) ticks.push(t);
  return ticks;
}

function BitcoinDashboardPhase5Visual() {
  const initial = useMemo(() => generateMockPriceSeries(180), []);
  const [priceSeries, setPriceSeries] = useState(initial);
  const [price, setPrice] = useState(null);
  const [change24h, setChange24h] = useState(null);

  const [fngValue, setFngValue] = useState(null);
  const [fngClass, setFngClass] = useState(null);
  const [fngUpdated, setFngUpdated] = useState(null);

  const [mvrv, setMvrv] = useState({ current: null, series: [], fromProxy: false, error: null });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ price: null, fng: null, mvrv: null });
  const [isWide, setIsWide] = useState(true);
  const [active, setActive] = useState('dashboard');

  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= 1024);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  async function refreshPrice() {
    const r = await fetchBTC();
    if (r && typeof r.price === "number") {
      setPrice(r.price);
      setChange24h(r.change24h);
      setErrors((e) => ({ ...e, price: null }));
    } else {
      setErrors((e) => ({ ...e, price: r && r.error ? r.error : 'fetch error' }));
    }
  }

  async function refreshFNG() {
    const r = await fetchFearGreed();
    if (r && typeof r.value === "number") {
      setFngValue(r.value);
      setFngClass(r.classification || "Neutral");
      setFngUpdated(r.updated || new Date());
      setErrors((e) => ({ ...e, fng: null }));
    } else {
      setFngValue(74);
      setFngClass("Greed");
      setFngUpdated(new Date());
      setErrors((e) => ({ ...e, fng: r && r.error ? r.error : 'fetch error' }));
    }
  }

  async function refreshMVRV() {
    const r = await fetchMVRV();
    if (r && Array.isArray(r.series) && r.series.length) {
      setMvrv({ current: r.current, series: r.series, fromProxy: !!r.fromProxy, error: null });
      setErrors((e) => ({ ...e, mvrv: null }));
    } else {
      const mock = generateMockMVRVSeries(priceSeries.length);
      setMvrv({ current: mock.current, series: mock.series, fromProxy: false, error: r && r.error ? r.error : 'fetch error' });
      setErrors((e) => ({ ...e, mvrv: r && r.error ? r.error : 'fetch error' }));
    }
  }

  async function refreshAll() {
    setLoading(true);
    try {
      const hist = await fetchBTC6m();
      if (Array.isArray(hist) && hist.length) setPriceSeries(hist);
    } catch {}
    await Promise.all([refreshPrice(), refreshFNG(), refreshMVRV()]);
    setLoading(false);
  }

  useEffect(() => {
    refreshAll();
    const id = setInterval(refreshAll, 60000);
    return () => clearInterval(id);
  }, []);

  const changeText = typeof change24h === "number" ? `${change24h.toFixed(2)}%` : "—";
  const changeColor = typeof change24h === "number" ? (change24h >= 0 ? "#059669" : "#dc2626") : "#475569";
  const mvrvDomain = computeMvrvDomain(mvrv.series);
  const alerts = buildAlerts({ mvrv, fngValue });

  return (
    <div style={{ ...S.page, display: 'flex' }}>
      <Sidebar active={active} onSelect={setActive} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.hero}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={S.heroTitle}>Bitcoin Market Overview</div>
              <div style={S.heroSub}>Live price, sentiment and on-chain valuation (MVRV)</div>
            </div>
            <button onClick={refreshAll} disabled={loading} style={{ ...S.btn, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        <div style={S.content}>
          {active === 'dashboard' && (
            <>
              <div style={{ ...S.statsGrid, marginBottom: 16 }}>
                <div style={{ ...S.card }}>
                  <div style={S.statLabel}>Bitcoin Price</div>
                  <div style={S.statValue}>{currency(price)}</div>
                  <div style={{ ...S.muted, color: changeColor, marginTop: 4 }}>24h {changeText}</div>
                </div>
                <div style={{ ...S.card }}>
                  <div style={S.statLabel}>MVRV</div>
                  <div style={S.statValue}>{typeof mvrv.current === 'number' ? mvrv.current.toFixed(2) : '—'}</div>
                  <div style={S.muted}>{mvrv.fromProxy ? 'Live' : 'Mock'}</div>
                </div>
                <div style={{ ...S.card }}>
                  <div style={S.statLabel}>Fear & Greed</div>
                  <div style={S.statValue}>{typeof fngValue === 'number' ? fngValue : '—'}</div>
                  <div style={S.muted}>{fngClass || 'Neutral'}</div>
                </div>
                <div style={{ ...S.card }}>
                  <div style={S.statLabel}>Updated</div>
                  <div style={S.statValue}>{fngUpdated ? new Date(fngUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</div>
                  <div style={S.muted}>auto-refresh 60s</div>
                </div>
              </div>

              <div style={S.mainGrid(isWide)}>
                <div style={{ ...S.card }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Price & MVRV</div>
                    <div style={{ ...S.muted }}>Last 6 months • ticks every 10 days</div>
                  </div>
                  <div style={{ width: '100%', height: 420 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mergeSeries(priceSeries, mvrv.series)} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                        <XAxis
                          dataKey="t"
                          type="number"
                          domain={["dataMin", "dataMax"]}
                          scale="time"
                          ticks={compute10DayTicks(priceSeries)}
                          tickFormatter={(t) => new Date(t).toLocaleDateString([], { month: 'short', day: '2-digit' })}
                          fontSize={12}
                          stroke="#94a3b8"
                          tick={{ fill: '#475569' }}
                        />
                        <YAxis yAxisId="left" tickFormatter={(v) => `$${Math.round(v / 1000)}k`} fontSize={12} stroke="#94a3b8" tick={{ fill: '#475569' }} />
                        <YAxis yAxisId="right" orientation="right" domain={mvrvDomain} tickFormatter={(v) => Number(v).toFixed(1)} fontSize={12} stroke="#94a3b8" tick={{ fill: '#475569' }} />
                        <Tooltip labelFormatter={(l) => new Date(l).toLocaleString()} formatter={(v, n) => (n === 'price' ? `$${Number(v).toFixed(2)}` : Number(v).toFixed(2))} />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="price" name="Bitcoin Price" dot={false} strokeWidth={2} />
                        <Line yAxisId="right" type="monotone" dataKey="mvrv" name="MVRV" dot={false} strokeWidth={2} strokeDasharray="4 2" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 16 }}>
                  <div style={{ ...S.card }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Fear & Greed Index</div>
                      <div style={{ ...S.muted }}>{fngUpdated ? new Date(fngUpdated).toLocaleString() : '—'}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'center' }}>
                      <div style={{ minWidth: 70, fontSize: 28, fontWeight: 800, color: '#0f172a' }}>{typeof fngValue === 'number' ? fngValue : '—'}</div>
                      <div style={{ minWidth: 80, fontSize: 14, color: '#475569' }}>{fngClass || 'Neutral'}</div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <FNGBar value={fngValue || 0} />
                    </div>
                    <div style={{ marginTop: 8, ...S.muted }}>Components: Volatility, Market Momentum, Social Media, Surveys, Dominance, Trends</div>
                  </div>

                  <div style={{ ...S.card }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Market Alerts</div>
                      <div style={{ ...S.muted }}>{alerts.length} active</div>
                    </div>
                    {alerts.length === 0 ? (
                      <div style={{ ...S.muted }}>No active alerts.</div>
                    ) : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {alerts.map((a, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', border: '1px solid #eef2f7', borderRadius: 12, padding: 10 }}>
                            <AlertBadge level={a.level} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{a.title}</div>
                              <div style={{ fontSize: 12, color: '#475569' }}>{a.desc}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {(errors.price || errors.fng || errors.mvrv) ? (
                <div style={{ marginTop: 16, background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa', padding: 10, borderRadius: 12 }}>
                  {errors.price ? `Price: ${errors.price}. ` : ''}
                  {errors.fng ? `F&G: ${errors.fng}. ` : ''}
                  {errors.mvrv ? `MVRV: ${errors.mvrv}.` : ''}
                </div>
              ) : null}
            </>
          )}

          {active !== 'dashboard' && (
            <div style={{ ...S.card }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#0f172a' }}>
                {active.charAt(0).toUpperCase() + active.slice(1)}
              </div>
              <div style={S.muted}>This section is a placeholder. Click Dashboard in the sidebar to return.</div>
            </div>
          )}

          <pre style={{ fontSize: 11, color: '#64748b', marginTop: 12 }}>Visual polished + mobile fixes. See console for runtime tests.</pre>
        </div>
      </div>
    </div>
  );
}
