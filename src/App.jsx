import React, { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import "./App.css";

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [post, setPost] = useState(null);
  const [slug, setSlug] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("slug");
    setSlug(s);

    if (s) {
      fetch(`/posts/${s}.md`)
        .then(res => res.text())
        .then(setPost)
        .catch(err => console.error("Erro ao carregar o post:", err));
    }
  }, []);

  return (
    <div className={darkMode ? "dark" : "light"}>
      <header className="header">
        <h1>PradoWrites</h1>
        <nav>
          <a href="/">Arquivo</a>
          <a href="/about">Sobre</a>
          <a href="/contact">Contato</a>
        </nav>
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="toggle-theme"
        >
          {darkMode ? <Sun /> : <Moon />}
        </button>
      </header>

      <main className="content">
        {post ? (
          <article
            className="markdown"
            dangerouslySetInnerHTML={{ __html: marked.parse(post) }}
          />
        ) : (
          <p>Selecione um post para ler</p>
        )}
      </main>
    </div>
  );
}

export default App;
