import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Mail, ArrowLeft, ExternalLink, Sun, Moon } from "lucide-react";

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
              {loadingPost && <p className="opacity-70 text-sm">Carregando…</p>}
              {!loadingPost && <Markdown text={activeContent || ""} invert={darkMode} />}
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
