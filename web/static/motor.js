"use strict";

/* =========================================================================
   Motor do jogo para o front web, com dois modos:

   - "servidor": rodando com `python main.py --web`, usa a API HTTP local;
   - "navegador": no site estático (GitHub Pages), carrega o Pyodide e executa
     o próprio código Python do jogo dentro do navegador.

   Os dois modos devolvem o mesmo estado JSON para o app.js.
   ========================================================================= */
const Motor = (() => {
  const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
  let modo = null;
  let ponte = null;

  function carregarScript(src) {
    return new Promise((ok, erro) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = () => erro(new Error(`não foi possível carregar ${src}`));
      document.head.append(s);
    });
  }

  async function tentarServidor() {
    try {
      const r = await fetch("api/estado", { credentials: "same-origin" });
      if (r.ok && (r.headers.get("content-type") || "").includes("application/json")) return await r.json();
    } catch (_) { /* sem servidor: site estático */ }
    return null;
  }

  async function iniciarNavegador(progresso) {
    progresso("Carregando o Python no navegador (só demora na primeira visita)…");
    await carregarScript(PYODIDE + "pyodide.js");
    const py = await loadPyodide({ indexURL: PYODIDE });

    progresso("Carregando o jogo…");
    const arquivos = await (await fetch("py/arquivos.json")).json();
    py.FS.mkdirTree("/jogo");
    for (const arquivo of arquivos) {
      const resposta = await fetch(`py/${arquivo}`);
      if (!resposta.ok) throw new Error(`arquivo do jogo ausente: ${arquivo}`);
      const pasta = arquivo.includes("/") ? "/jogo/" + arquivo.slice(0, arquivo.lastIndexOf("/")) : "/jogo";
      py.FS.mkdirTree(pasta);
      py.FS.writeFile(`/jogo/${arquivo}`, await resposta.text());
    }
    py.runPython("import os, sys\nsys.path.insert(0, '/jogo')\nos.chdir('/jogo')");
    ponte = py.pyimport("ponte_navegador");
    return JSON.parse(ponte.estado());
  }

  async function iniciar(progresso = () => {}) {
    const doServidor = await tentarServidor();
    if (doServidor) {
      modo = "servidor";
      return doServidor;
    }
    modo = "navegador";
    return iniciarNavegador(progresso);
  }

  async function agir(id, texto) {
    if (modo === "navegador") {
      return JSON.parse(ponte.agir(id, texto === undefined ? null : texto));
    }
    const resp = await fetch("api/acao", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(texto === undefined ? { id } : { id, texto }),
    });
    if (!resp.ok) throw new Error(`Servidor respondeu ${resp.status}`);
    return resp.json();
  }

  return { iniciar, agir, get modo() { return modo; } };
})();
