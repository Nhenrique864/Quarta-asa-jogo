"use strict";

/* Front do Quarta Asa: só desenha o estado vindo de /api/estado e envia ações para /api/acao. */

const palco = document.getElementById("palco");
const ficha = document.getElementById("ficha");
const trilha = document.getElementById("trilha");
const layout = document.getElementById("layout");
const toast = document.getElementById("toast");

const TELAS_SEM_FICHA = ["titulo", "sobre", "criacao_nome", "criacao_arquetipo", "criacao_confirmar"];
const AURA_DRAGAO = {
  vermelho: "#e0573c", preto: "#9a86e8", azul: "#8fdcff", verde: "#b9d66e",
  laranja: "#ff8f3a", marrom: "#d6a46c", dourado: "#ffd76a",
};
const NOMES_EFEITOS = {
  veneno: "Envenenado", queimadura: "Queimando", atordoado: "Atordoado",
  exposto: "Exposto", cego: "Cego", defendendo: "Defendendo",
};

let estado = null;
let ocupado = false;
let fichaAberta = false;
let chaveTelaAnterior = "";
let vidaInimigoAnterior = null;
let toastTimer = null;

/* ---------------- utilitário de DOM (sempre textContent, nunca innerHTML) ---------------- */
function h(tag, props = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const f of filhos.flat()) {
    if (f == null || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}

function anexar(pai, ...filhos) {
  pai.append(...filhos.flat().filter((f) => f != null && f !== false));
}

/* ---------------- comunicação (servidor local ou Python no navegador: veja motor.js) ---------------- */
function agir(id, texto) {
  if (ocupado || !estado) return;
  ocupado = true;
  Som.tocar("clique");
  Motor.agir(id, texto)
    .then(render)
    .catch((e) => mostrarToast(`Algo deu errado: ${e.message}`))
    .finally(() => { ocupado = false; });
}

function telaCarregando(mensagem, erro = false) {
  layout.classList.add("sem-ficha");
  palco.replaceChildren(h("section", { class: `cartao hero carregando${erro ? " erro" : ""}` },
    h("img", { src: "static/emblema.svg", alt: "" }),
    h("h1", { class: "titulo-cena", text: "Quarta Asa" }),
    erro ? null : h("div", { class: "girando", "aria-hidden": "true" }),
    h("p", { class: "subt", role: "status", text: mensagem })));
}

/* ---------------- render principal ---------------- */
function render(e) {
  estado = e;
  const semFicha = !e.cadete || TELAS_SEM_FICHA.includes(e.tela);
  layout.classList.toggle("sem-ficha", semFicha);
  renderTrilha(e);
  if (!semFicha) renderFicha(e.cadete);
  renderPalco(e);
  if (e.mensagens && e.mensagens.length) mostrarToast(e.mensagens.join(" · "));
  Som.tocarSequencia(e.sons);

  const chave = `${e.tela}|${e.titulo}`;
  if (chave !== chaveTelaAnterior && e.tela !== "combate") window.scrollTo({ top: 0, behavior: "smooth" });
  chaveTelaAnterior = chave;
}

function renderTrilha(e) {
  const p = e.progresso;
  trilha.replaceChildren();
  if (!e.cadete) return;
  const atual = p.capitulos.find((c) => c.estado === "atual");
  const rotulo = p.concluida ? "Campanha concluída" : atual ? `Cap. ${atual.numero}: ${atual.titulo}` : "";
  trilha.append(h("span", { class: "rotulo-cap", text: rotulo }));
  for (const c of p.capitulos) {
    trilha.append(h("span", {
      class: `pip ${c.estado}`,
      title: `Capítulo ${c.numero}: ${c.titulo}`,
      "aria-label": `Capítulo ${c.numero}: ${c.titulo} (${c.estado})`,
      role: "img",
    }));
  }
}

function barra(classe, rotulo, atual, maximo) {
  const pct = Math.max(0, Math.min(100, (atual / Math.max(1, maximo)) * 100));
  return h("div", { class: `barra ${classe}` },
    h("div", { class: "barra-topo" }, h("span", { text: rotulo }), h("b", { text: `${atual}/${maximo}` })),
    h("div", { class: "trilho" }, h("i", { style: `width:${pct}%` })));
}

function chipsEfeitos(efeitos) {
  const chaves = Object.keys(efeitos || {});
  if (!chaves.length) return null;
  return h("div", { class: "chips" },
    chaves.map((k) => h("span", { class: `chip ${k}`, text: `${NOMES_EFEITOS[k] || k} (${efeitos[k]})` })));
}

function renderFicha(c) {
  ficha.classList.toggle("aberta", fichaAberta);
  const attr = (sigla, valor, titulo) => h("div", { class: "attr", title: titulo }, h("small", { text: sigla }), h("b", { text: valor }));
  const d = c.dragao;

  ficha.replaceChildren();
  anexar(ficha,
    h("div", { class: "ficha-cabeca" },
      h("div", {}, h("div", { class: "ficha-nome", text: c.nome }), h("div", { class: "ficha-arq", text: c.arquetipo })),
      h("span", { class: "nivel", text: `Nv ${c.nivel}` })),
    barra("vida", "Vida", c.vida, c.vida_max),
    barra("poder", "Poder", c.poder, c.poder_max),
    barra("xp", "Experiência", c.xp, c.xp_prox),
    chipsEfeitos(c.efeitos),
    h("button", {
      class: "ficha-toggle", type: "button", "aria-expanded": String(fichaAberta),
      onclick: () => { fichaAberta = !fichaAberta; renderFicha(c); },
      text: fichaAberta ? "Esconder detalhes" : "Ver atributos, dragão e itens",
    }),
    h("div", { class: "ficha-extra" },
      h("div", { class: "atributos" },
        attr("ATQ", c.ataque, "Ataque"), attr("DEF", c.defesa, "Defesa"), attr("AGI", c.agilidade, "Agilidade"),
        attr("AST", c.astucia, "Astúcia"), attr("CRIT", `${c.critico}%`, "Chance de crítico"),
        attr("ESQ", `${c.esquiva}%`, "Chance de esquiva")),
      h("div", { class: "secao-ficha" },
        h("h3", { text: "Habilidade" }),
        h("div", { style: "font-size:13px" }, h("b", { text: c.habilidade.nome }),
          h("div", { style: "color:var(--texto-suave)", text: c.habilidade.descricao }))),
      h("div", { class: "secao-ficha" },
        h("h3", { text: "Dragão" }),
        d ? h("div", { class: "dragao-card", title: d.descricao, style: `--aura:${AURA_DRAGAO[d.chave]}` },
              ilustracao(d.chave, "mini", d.nome),
              h("div", {},
                h("div", { class: "dragao-nome", text: d.nome }),
                h("div", { class: "dragao-raca", text: `${d.cor} · ${d.raca}` }),
                h("div", { class: "dragao-sinete", text: `Sinete: ${d.sinete}`, title: d.sinete_descricao })))
          : h("div", { class: "vazio", text: "Ainda não foi escolhido(a) por um dragão." })),
      c.equipamentos.length ? h("div", { class: "secao-ficha" },
        h("h3", { text: "Equipamento" }),
        h("ul", { class: "lista-mini" }, c.equipamentos.map((e) => h("li", {}, h("span", { text: e.nome }), h("span", { text: e.resumo }))))) : null,
      h("div", { class: "secao-ficha" },
        h("h3", { text: "Mochila" }),
        c.itens.length
          ? h("ul", { class: "lista-mini" }, c.itens.map((i) => h("li", {}, h("span", { text: i.nome }), h("span", { text: `x${i.qtd}` }))))
          : h("div", { class: "vazio", text: "Vazia." }))),
  );
}

/* ---------------- palco ---------------- */
function paragrafos(textos, mono) {
  return h("div", { class: `narrativa${mono ? " mono" : ""}` }, textos.map((t) => h("p", { text: t })));
}

function destaques(linhas) {
  if (!linhas || !linhas.length) return null;
  return h("div", { class: "destaques" },
    linhas.map((l) => h("div", { class: l.startsWith("⬆") ? "lvl" : "", text: l })));
}

/* ilustração do dragão: imagem em /static/dragoes/ se existir; senão o SVG gerado localmente */
function ilustracao(chave, classe, titulo) {
  const el = h("div", { class: `ilustracao ${classe}` });
  const imagem = estado && estado.imagens_dragoes && estado.imagens_dragoes[chave];
  if (imagem) {
    el.classList.add("com-imagem");
    const img = h("img", { src: imagem, alt: titulo || "", loading: classe === "grande" ? "eager" : "lazy", decoding: "async" });
    img.addEventListener("error", () => {  // imagem ausente: volta para a ilustração SVG
      el.classList.remove("com-imagem");
      el.innerHTML = Dragoes.svg(chave, { titulo: (titulo || "").replace(/[<>&"]/g, "") });
    }, { once: true });
    el.append(img);
  } else {
    el.innerHTML = Dragoes.svg(chave, { titulo: (titulo || "").replace(/[<>&"]/g, "") });
  }
  return el;
}

function cartaoDragao(o) {
  const d = o.dragao;
  const botao = h("button", {
    class: "opcao cartao-dragao", type: "button", disabled: !!o.desabilitada,
    style: `--aura:${AURA_DRAGAO[d.chave]}`, onclick: () => agir(o.id),
    "aria-label": `${d.nome}, dragão ${d.cor.toLowerCase()}, ${d.raca}. ${d.descricao} Sinete: ${d.sinete}.`,
  },
    ilustracao(d.chave, "media", d.nome),
    h("span", { class: "tecla", "aria-hidden": "true", text: o.tecla }),
    h("span", { class: "dragao-info" },
      h("span", { class: "dragao-titulo", text: d.nome }),
      h("span", { class: "dragao-raca", text: `${d.cor} · ${d.raca}` }),
      h("span", { class: "dica", text: d.descricao }),
      h("span", { class: "dragao-sinete", text: `Sinete: ${d.sinete}` })));
  if (d.legenda) botao.title = `${d.nome} — ${d.cor}, ${d.raca}. ${d.legenda}`;
  return botao;
}

function botaoOpcao(o) {
  if (o.dragao) return cartaoDragao(o);
  const classes = ["opcao"];
  if (o.voltar) classes.push("voltar");
  if (o.secundaria) classes.push("secundaria");
  return h("button", {
    class: classes.join(" "), type: "button", disabled: !!o.desabilitada,
    title: o.desabilitada && o.dica ? o.dica : null,
    onclick: () => agir(o.id),
  },
    h("span", { class: "tecla", "aria-hidden": "true", text: o.tecla }),
    h("span", {}, h("span", { class: "rot", text: o.rotulo }), o.dica ? h("span", { class: "dica", text: o.dica }) : null));
}

function blocoOpcoes(e, extraClasse = "") {
  const opcoes = e.opcoes.filter((o) => !o.entrada);
  if (!opcoes.length) return null;
  const dragoes = opcoes.filter((o) => o.dragao);
  if (dragoes.length) {
    return h("div", { class: "opcoes" },
      h("div", { class: "grade-dragoes" }, dragoes.map(cartaoDragao)),
      opcoes.filter((o) => !o.dragao).map(botaoOpcao));
  }
  return h("div", { class: `opcoes ${extraClasse}` }, opcoes.map(botaoOpcao));
}

function formularioEntrada(e) {
  const envio = e.opcoes.find((o) => o.entrada);
  const input = h("input", {
    type: "text", maxlength: e.entrada.max || 40, value: e.entrada.valor || "",
    "aria-label": e.entrada.rotulo, placeholder: e.entrada.rotulo, autocomplete: "off",
  });
  const form = h("form", {
    class: "form-entrada",
    onsubmit: (ev) => { ev.preventDefault(); agir(envio.id, input.value); },
  }, input, h("button", { class: "botao", type: "submit", text: envio.rotulo }));
  requestAnimationFrame(() => { input.focus(); input.select(); });
  return form;
}

function classeLinhaLog(linha, nomeInimigo) {
  if (linha.startsWith("— Turno")) return "turno";
  if (linha.startsWith("🏆") || linha.startsWith("💀")) return "fim";
  if (linha.includes("CRÍTICO")) return "crit";
  if (linha.startsWith("🐉")) return "drag";
  if (/^[⚡❄🌑👁]/u.test(linha)) return "poder-l";
  const acaoInimigo = linha.startsWith(nomeInimigo) && / (usa|tenta) /.test(linha);
  if (acaoInimigo || linha.startsWith("O venin") || linha.startsWith("🩸") || linha.startsWith("😡")) return "inimigo-l";
  return "";
}

function renderCombate(e) {
  const cb = e.combate;
  const ini = cb.inimigo;
  const atingido = vidaInimigoAnterior !== null && ini.vida < vidaInimigoAnterior && e.tela === "combate";
  vidaInimigoAnterior = e.tela === "combate" ? ini.vida : null;

  const registro = h("div", { class: "registro", role: "log", "aria-label": "Registro do combate" },
    cb.log.map((l) => h("div", { class: classeLinhaLog(l, ini.nome), text: l })));
  requestAnimationFrame(() => { registro.scrollTop = registro.scrollHeight; });

  const cartaoInimigo = h("section", { class: `cartao inimigo${atingido ? " atingido" : ""}` },
    h("div", { class: "sobretitulo", text: e.subtitulo }),
    h("div", { class: "inimigo-cabeca" },
      h("h1", { class: "inimigo-nome", text: ini.nome }),
      ini.chefe ? h("span", { class: "selo-chefe", text: "Chefe" }) : null),
    ini.descricao ? h("p", { class: "inimigo-desc", text: ini.descricao }) : null,
    barra("vida", "Vida", ini.vida, ini.vida_max),
    chipsEfeitos(ini.efeitos),
    registro);

  if (e.tela === "pos_combate") {
    const venceu = e.titulo.startsWith("Vitória");
    anexar(palco, cartaoInimigo,
      h("section", { class: `cartao entrar ${venceu ? "vitoria" : ""}` },
        h("h2", { class: "titulo-cena", text: e.titulo }),
        destaques(e.destaque)),
      blocoOpcoes(e));
  } else {
    anexar(palco, cartaoInimigo, destaques(e.destaque), blocoOpcoes(e, "combate"));
  }
}

function renderPalco(e) {
  palco.replaceChildren();
  if (e.combate && (e.tela === "combate" || e.tela === "pos_combate")) {
    renderCombate(e);
    return;
  }
  vidaInimigoAnterior = null;

  if (e.tela === "titulo") {
    anexar(palco, 
      h("section", { class: "cartao hero entrar" },
        h("img", { src: "static/emblema.svg", alt: "" }),
        h("h1", { class: "titulo-cena", text: e.titulo }),
        h("div", { class: "subt", text: e.subtitulo }),
        paragrafos(e.texto)),
      blocoOpcoes(e));
    return;
  }

  if (e.dragao_apresentado) anexar(palco, apresentacaoDragao(e.dragao_apresentado));
  const classes = ["cartao", "entrar"];
  if (e.tela === "morte") classes.push("morte");
  if (e.tela === "final" || e.tela === "capitulo_fim") classes.push("vitoria");
  anexar(palco, 
    h("section", { class: classes.join(" ") },
      e.subtitulo ? h("div", { class: "sobretitulo", text: e.subtitulo }) : null,
      h("h1", { class: "titulo-cena", text: e.titulo }),
      e.texto.length ? paragrafos(e.texto, e.monoespacado) : null,
      destaques(e.destaque)),
    e.entrada ? formularioEntrada(e) : null,
    blocoOpcoes(e));
}

function apresentacaoDragao(d) {
  return h("section", { class: "apresentacao-dragao", style: `--aura:${AURA_DRAGAO[d.chave]}`, "aria-label": `Apresentação de ${d.nome}` },
    h("div", { class: "palco-dragao" },
      h("div", { class: "aura", "aria-hidden": "true" }),
      h("div", { class: "faiscas", "aria-hidden": "true" },
        Array.from({ length: 14 }, (_, i) => h("i", { style: `--x:${(i * 37) % 100}%;--d:${(i % 5) * 0.7}s;--t:${4 + (i % 4)}s` }))),
      ilustracao(d.chave, "grande", d.nome)),
    d.legenda ? h("p", { class: "legenda-dragao" },
      h("b", { text: `${d.nome} — ${d.cor}, ${d.raca}.` }), ` ${d.legenda}`) : null,
    h("div", { class: "apresentacao-texto" },
      h("div", { class: "sobretitulo", text: "Você foi escolhido(a) por" }),
      h("h2", { class: "nome-dragao", text: d.nome }),
      h("div", { class: "raca-dragao", text: `Dragão ${d.cor.toLowerCase()} · ${d.raca}` }),
      h("p", { class: "descricao-dragao", text: d.descricao }),
      h("div", { class: "chips bonus-dragao" }, d.bonus.map((b) => h("span", { class: "chip", text: b }))),
      h("div", { class: "detalhes-dragao" },
        h("div", {}, h("small", { text: "Sinete" }), h("b", { text: d.sinete }),
          h("span", { text: `${d.sinete_descricao} (${d.sinete_custo} de poder)` })),
        h("div", {}, h("small", { text: "Sopro de fogo" }), h("b", { text: `${d.sopro} de dano base` }),
          h("span", { text: "Use \"Chamar dragão\" em combate (recarga de 3 turnos)." })))));
}

/* ---------------- toast ---------------- */
function mostrarToast(msg) {
  toast.textContent = msg;
  toast.classList.add("visivel");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visivel"), 3800);
}

/* ---------------- atalhos de teclado ---------------- */
document.addEventListener("keydown", (ev) => {
  if (!estado || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (ev.key === "Escape" && painelSomAberto()) { fecharPainelSom(); return; }
  const alvo = ev.target;
  if (alvo instanceof Element && alvo.closest(".controle-som")) return;
  if (alvo instanceof HTMLInputElement) {
    if (ev.key === "Escape") {
      const voltar = estado.opcoes.find((o) => o.voltar);
      if (voltar) agir(voltar.id);
    }
    return;
  }
  const tecla = ev.key === "Escape" || ev.key === "Backspace" ? "0" : ev.key.toLowerCase();
  const opcao = estado.opcoes.find((o) => o.tecla === tecla && !o.entrada);
  if (opcao && !opcao.desabilitada) {
    ev.preventDefault();
    agir(opcao.id);
  }
});

/* ---------------- controle de som ---------------- */
const ICONE_SOM = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4z"/><path class="ondas" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/><path class="mudo" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 9l5 6M21 9l-5 6"/></svg>';
const controleSom = document.getElementById("controle-som");
let botaoSom, painelSom;

function silenciado() {
  const c = Som.config;
  return c.volume === 0 || !c.efeitos;
}

function atualizarIconeSom() {
  botaoSom.classList.toggle("silenciado", silenciado());
  botaoSom.setAttribute("aria-label", silenciado() ? "Som desligado: abrir controles" : "Som ligado: abrir controles");
}

const painelSomAberto = () => painelSom && !painelSom.hidden;
function fecharPainelSom() {
  painelSom.hidden = true;
  botaoSom.setAttribute("aria-expanded", "false");
}

function montarControleSom() {
  botaoSom = h("button", {
    class: "botao-som", type: "button", "aria-expanded": "false", "aria-controls": "painel-som", title: "Som",
    onclick: () => {
      painelSom.hidden = !painelSom.hidden;
      botaoSom.setAttribute("aria-expanded", String(!painelSom.hidden));
    },
  });
  botaoSom.innerHTML = ICONE_SOM;  // SVG constante, sem dados do usuário

  const alternador = (chave, rotulo) => {
    const input = h("input", { type: "checkbox", checked: Som.config[chave] });
    input.addEventListener("change", () => {
      Som.definir({ [chave]: input.checked });
      atualizarIconeSom();
      if (chave === "efeitos" && input.checked) Som.tocar("clique");
    });
    return h("label", { class: "linha-som" }, input, h("span", { text: rotulo }));
  };
  const volume = h("input", {
    type: "range", min: "0", max: "100", step: "5", value: String(Math.round(Som.config.volume * 100)),
    "aria-label": "Volume",
  });
  volume.addEventListener("input", () => { Som.definir({ volume: Number(volume.value) / 100 }); atualizarIconeSom(); });
  volume.addEventListener("change", () => Som.tocar("clique"));

  painelSom = h("div", { class: "painel-som", id: "painel-som", hidden: true, role: "group", "aria-label": "Controles de som" },
    h("div", { class: "titulo-som", text: "Som" }),
    alternador("efeitos", "Efeitos sonoros"),
    h("label", { class: "linha-som volume" }, h("span", { text: "Volume" }), volume));

  document.addEventListener("pointerdown", (ev) => {
    if (painelSomAberto() && !controleSom.contains(ev.target)) fecharPainelSom();
  });
  controleSom.append(botaoSom, painelSom);
  atualizarIconeSom();
}

montarControleSom();

telaCarregando("Preparando Basgiath…");
Motor.iniciar(telaCarregando)
  .then(render)
  .catch((e) => telaCarregando(`Não foi possível carregar o jogo: ${e.message}. Verifique a conexão e recarregue a página.`, true));
