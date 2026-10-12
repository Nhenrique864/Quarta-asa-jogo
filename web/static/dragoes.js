"use strict";

/* =========================================================================
   Quarta Asa — ilustrações dos dragões em cena de voo (SVG gerado no navegador).

   Estilo: o dragão voando sobre o Vale, com camadas de montanhas, névoa,
   céu com lua/sol e rochas em primeiro plano (como a imagem de referência
   do Morvhen). Cada dragão segue a própria descrição e legenda em models/dragao.py.

   Se existir uma imagem em /static/dragoes/<chave>.(webp|png|jpg), o front a usa
   no lugar deste desenho (veja docs/readme/dragoes.md).

   Uso: Dragoes.svg("preto", { titulo: "Morvhen" }) → string SVG (conteúdo constante).
   ========================================================================= */
const Dragoes = (() => {
  let contador = 0;

  /* ------------------------------------------------------------ dragões */
  const DEF = {
    vermelho: {
      cores: { corpo: "#9b231c", claro: "#d4513a", escuro: "#3f0b08", ventre: "#e3a463", asa: "#7a1a14",
               asaClara: "#c4442f", olho: "#ffd36b", chifre: "#e8d6b0", ponta: "#f6ecd6" },
      forma: "imponente", asas: "padrao", chifres: "coroa", cauda: "padrao", ponta: "espada",
      extras: ["brasas"], cena: "crepusculo",
    },
    preto: {
      cores: { corpo: "#24222c", claro: "#5f5a7a", escuro: "#07070b", ventre: "#3b3648", asa: "#18161f",
               asaClara: "#4a4466", olho: "#ffb347", chifre: "#8c87a0", ponta: "#dcd8ea" },
      forma: "esguio", asas: "afiadas", chifres: "laminas", cauda: "longa", ponta: "adaga",
      extras: ["nevoa"], cena: "noite",
    },
    azul: {
      cores: { corpo: "#4b6a87", claro: "#9cbcd6", escuro: "#1b2c3d", ventre: "#d0dde6", asa: "#36536e",
               asaClara: "#8fb0cc", olho: "#9ff3ff", chifre: "#e0eaf1", ponta: "#f4f8fb" },
      forma: "medio", asas: "padrao", chifres: "curvos", cauda: "escorpiao", ponta: "ferrao",
      extras: ["veneno", "geada"], cena: "lagoGelado",
    },
    verde: {
      cores: { corpo: "#4f6b38", claro: "#8aa95e", escuro: "#1f2e14", ventre: "#d2c58e", asa: "#3f5a2c",
               asaClara: "#86a35a", olho: "#ffc35a", chifre: "#d8cfae", ponta: "#ece5cc" },
      forma: "pesado", asas: "largas", chifres: "ramos", cauda: "padrao", ponta: "clava",
      extras: ["barba", "musgo", "palpebra"], cena: "floresta",
    },
    laranja: {
      cores: { corpo: "#c25a18", claro: "#f59a3a", escuro: "#4d1d06", ventre: "#f7c766", asa: "#9e4416",
               asaClara: "#f08a36", olho: "#fff3a6", chifre: "#3b2619", ponta: "#7a5a46" },
      forma: "medio", asas: "afiadas", chifres: "chamas", cauda: "padrao", ponta: "espadaSerrilhada",
      extras: ["brasas", "faiscas"], cena: "vulcao",
    },
    marrom: {
      cores: { corpo: "#6e4a2e", claro: "#a97a4e", escuro: "#2a190d", ventre: "#c9a878", asa: "#5a3c24",
               asaClara: "#9c6c42", olho: "#ffd27a", chifre: "#cdb690", ponta: "#e6d6b6" },
      forma: "pesado", asas: "largas", chifres: "aries", cauda: "padrao", ponta: "maca",
      extras: ["placas"], cena: "canion",
    },
    dourado: {
      cores: { corpo: "#c99330", claro: "#ffe18c", escuro: "#5e400f", ventre: "#fff1c4", asa: "#d9a640",
               asaClara: "#ffeab0", olho: "#7fd7ff", chifre: "#fff3d0", ponta: "#ffffff" },
      forma: "filhote", asas: "padrao", chifres: "brotos", cauda: "padrao", ponta: "penas",
      extras: ["penas", "brilhos"], cena: "aurora",
    },
  };

  /* ------------------------------------------------------------ cenários */
  const CENAS = {
    noite: { ceu: ["#070a12", "#1c2436", "#46516a"], astro: { tipo: "lua", x: 470, y: 66, r: 26, cor: "#f2f4f8" },
             luz: "#cfd8ff", relevo: "picos", montanhas: ["#4a5468", "#323a4c", "#1d2230", "#10131b"],
             nevoa: "#c9d0dc", rio: "#dfe6f2", estrelas: true, rochas: "#0c0d12" },
    crepusculo: { ceu: ["#16070b", "#6b1a1a", "#e47a3a"], astro: { tipo: "sol", x: 452, y: 196, r: 46, cor: "#ffb15a" },
                  luz: "#ffb070", relevo: "picos", montanhas: ["#7a3426", "#56221b", "#341311", "#1a0908"],
                  nevoa: "#d48a6a", rio: "#ffc48a", rochas: "#100605" },
    lagoGelado: { ceu: ["#1a2a3c", "#5f82a4", "#d4e4ee"], astro: { tipo: "sol", x: 118, y: 92, r: 24, cor: "#f4fbff" },
                  luz: "#e6f6ff", relevo: "picos", neve: true, montanhas: ["#7f9ab4", "#5b7894", "#3c5670", "#1e2e40"],
                  nevoa: "#f0f6fa", lago: "#cfe6f2", rochas: "#121c26" },
    floresta: { ceu: ["#121a10", "#56663a", "#e0bf6e"], astro: { tipo: "sol", x: 150, y: 236, r: 36, cor: "#ffd98a" },
                luz: "#ffe2a0", relevo: "pinheiros", montanhas: ["#5d6b40", "#3e4c2a", "#27331b", "#121a0c"],
                nevoa: "#d9d2a0", rio: "#f2dfa0", rochas: "#0c1108" },
    vulcao: { ceu: ["#120909", "#4a2418", "#d8622a"], astro: { tipo: "brilho", x: 300, y: 122, r: 60, cor: "#ff7a2a" },
              luz: "#ffa060", relevo: "picos", vulcao: true, montanhas: ["#5a2c22", "#3e1d17", "#28110d", "#140807"],
              nevoa: "#8a5a4a", lava: "#ff8a2a", cinzas: true, rochas: "#0e0606" },
    canion: { ceu: ["#24150e", "#8c5a38", "#efb67a"], astro: { tipo: "sol", x: 470, y: 230, r: 40, cor: "#ffd090" },
              luz: "#ffc890", relevo: "mesas", montanhas: ["#a0663e", "#7c4a2c", "#55321e", "#2a180d"],
              nevoa: "#e2b48a", rio: "#ffd9a8", rochas: "#140b06" },
    aurora: { ceu: ["#2a2440", "#b07a92", "#ffd9a0"], astro: { tipo: "sol", x: 300, y: 228, r: 40, cor: "#fff0c0", raios: true },
              luz: "#fff0c8", relevo: "colinas", montanhas: ["#a58aa0", "#7a6680", "#4e4460", "#262236"],
              nevoa: "#ffe8e0", rio: "#fff4dc", rochas: "#16131f" },
  };

  /* ------------------------------------------------- anatomia (voo, olhando à esquerda) */
  const TORSO = {
    imponente: "M184,188 C190,160 230,146 276,148 C324,150 364,164 378,188 C384,210 356,224 320,225 L234,224 C204,222 180,210 184,188 Z",
    medio: "M190,190 C196,166 232,154 274,156 C318,158 356,170 370,190 C376,208 352,220 318,221 L236,220 C208,218 186,208 190,190 Z",
    esguio: "M196,194 C202,174 236,164 276,166 C316,168 350,178 362,194 C366,208 344,217 314,218 L238,217 C214,215 193,207 196,194 Z",
    pesado: "M178,190 C182,156 228,140 278,142 C330,144 372,160 384,190 C390,216 360,232 322,233 L232,232 C198,229 174,214 178,190 Z",
    filhote: "M196,194 C198,170 230,158 268,160 C306,162 340,174 350,194 C356,214 334,228 304,229 L236,228 C210,226 194,212 196,194 Z",
  };
  const DORSO = {
    imponente: [[222, 152], [276, 148], [330, 152], [372, 176]],
    medio: [[226, 160], [274, 156], [326, 160], [364, 180]],
    esguio: [[232, 170], [276, 166], [322, 170], [356, 186]],
    pesado: [[218, 148], [278, 142], [336, 148], [378, 178]],
    filhote: [[230, 164], [268, 160], [310, 164], [344, 182]],
  };
  const VENTRE = {
    imponente: "M196,206 C210,222 240,224 276,224 C312,224 346,220 364,206 C346,214 312,218 276,218 C242,218 212,214 196,206 Z",
    medio: "M200,206 C214,218 242,220 274,220 C306,220 338,216 356,204 C338,212 306,214 274,214 C244,214 216,212 200,206 Z",
    esguio: "M206,206 C220,216 244,217 276,217 C306,217 334,213 350,204 C334,210 306,212 276,212 C246,212 222,211 206,206 Z",
    pesado: "M190,210 C206,228 240,232 278,232 C316,232 352,226 372,210 C352,222 316,226 278,226 C242,226 208,222 190,210 Z",
    filhote: "M206,208 C220,222 244,227 270,228 C298,228 326,222 342,208 C324,218 298,221 270,221 C244,221 222,217 206,208 Z",
  };
  const CABECA = {  // âncora da cabeça [x, y] e escala
    imponente: [96, 158, 1.05], medio: [96, 172, 1], esguio: [88, 184, 0.95], pesado: [100, 168, 1.08], filhote: [118, 168, 1.25],
  };
  const FRENTE = { imponente: [190, 206], medio: [194, 206], esguio: [200, 208], pesado: [184, 212], filhote: [202, 210] };

  const PERNAS = {
    frente: "M228,208 C218,226 226,242 244,248 L258,256 L264,247 L251,239 C246,231 248,222 252,216 Z",
    tras: "M334,212 C348,234 342,252 322,260 L310,268 L304,258 L317,251 C326,243 326,231 322,220 Z",
  };

  // asas: raiz, pulso, ponta e pontos da borda de fuga
  const ASAS = {
    padrao: { raiz: [292, 166], pulso: [350, 26], ponta: [540, 42], dedos: [[520, 112], [462, 150], [402, 168], [342, 178]] },
    afiadas: { raiz: [292, 170], pulso: [362, 20], ponta: [568, 30], dedos: [[540, 96], [480, 140], [414, 164], [348, 180]] },
    largas: { raiz: [292, 160], pulso: [340, 34], ponta: [520, 50], dedos: [[512, 126], [458, 166], [398, 182], [338, 186]] },
  };
  const ASA_LONGE = { raiz: [264, 160], pulso: [222, 44], ponta: [70, 58], dedos: [[92, 112], [146, 136], [200, 152]] };

  const CAUDAS = {
    padrao: ["M368,182 C420,186 470,210 488,250 C504,290 470,318 420,316 L360,306 L362,298 L418,302 C456,302 474,284 466,256 C454,224 418,206 368,212 Z",
             360, 302, 176],
    longa: ["M366,188 C430,190 492,214 512,252 C528,288 494,320 440,320 L356,313 L358,304 L438,308 C478,308 496,288 488,260 C474,228 430,214 366,208 Z",
            355, 309, 176],
    escorpiao: ["M366,184 C420,176 452,140 446,100 C442,70 414,52 386,58 L384,50 C420,40 456,62 460,98 C466,146 430,196 370,212 Z",
                385, 54, -15],
  };

  const CHIFRES = {
    coroa: ["M150,72 C166,54 188,40 218,32 C196,48 178,64 164,82 Z", "M139,69 C146,50 158,36 176,24 C164,42 156,58 152,74 Z",
            "M128,70 C130,56 136,46 146,38 C142,50 140,60 140,72 Z", "M160,96 C176,98 190,104 202,114 C184,112 170,108 156,103 Z"],
    laminas: ["M152,76 C178,70 212,68 248,72 C212,77 182,82 158,86 Z", "M146,70 C166,58 196,52 226,50 C198,60 172,68 152,78 Z",
              "M136,72 C146,62 160,56 176,54 C162,62 150,70 142,78 Z"],
    curvos: ["M152,72 C176,56 204,62 208,84 C202,74 182,72 162,84 Z", "M148,100 L176,94 L168,106 L186,108 L162,114 Z"],
    ramos: ["M150,72 C158,56 172,46 194,44 C182,54 172,62 166,76 Z", "M174,56 C180,44 188,36 200,32 C194,42 188,50 180,60 Z",
            "M144,70 C146,58 152,50 160,44 C158,54 156,62 156,72 Z"],
    chamas: ["M150,74 L170,52 L168,64 L190,44 L184,60 L206,48 L192,72 L176,80 Z", "M138,70 L146,50 L150,62 L160,42 L158,66 L148,76 Z",
             "M158,98 L182,96 L172,104 L194,110 L166,110 Z"],
    aries: ["M150,70 C170,52 200,56 204,80 C206,100 186,108 174,98 C186,96 192,86 186,78 C178,68 164,72 158,80 Z",
            "M140,68 C146,56 156,50 166,48 C160,56 156,62 154,72 Z"],
    brotos: ["M146,72 C150,62 156,56 164,54 C160,62 158,68 158,74 Z", "M134,72 C136,64 140,60 146,58 C144,64 144,68 146,74 Z"],
  };

  const PONTAS = {
    espada: (c, id) => `
      <path d="M-2,-7 L44,-11 L74,0 L44,11 L-2,7 Z" fill="url(#${id}-metal)" stroke="${c.escuro}" stroke-width="1.5"/>
      <path d="M2,0 L66,0" stroke="${c.escuro}" stroke-width="1.2" opacity=".6"/>
      <path d="M8,-8 L-4,-18 L2,-6 Z M8,8 L-4,18 L2,6 Z" fill="${c.chifre}" stroke="${c.escuro}" stroke-width="1"/>`,
    espadaSerrilhada: (c, id) => `
      <path d="M-2,-7 L12,-10 L16,-15 L22,-10 L32,-14 L38,-10 L48,-12 L76,0 L48,12 L38,10 L32,14 L22,10 L16,15 L12,10 L-2,7 Z"
            fill="url(#${id}-metal)" stroke="${c.escuro}" stroke-width="1.4"/>
      <path d="M4,0 L66,0" stroke="#ffb347" stroke-width="1.6" opacity=".8"/>`,
    adaga: (c, id) => `
      <path d="M-2,-5 L8,-14 L12,-5 L44,-4 L62,0 L44,4 L12,5 L8,14 L-2,5 Z" fill="url(#${id}-metal)" stroke="${c.escuro}" stroke-width="1.2"/>
      <path d="M12,0 L56,0" stroke="${c.escuro}" stroke-width="1" opacity=".6"/>`,
    ferrao: (c, id) => `<g transform="scale(1.35)">
      <path d="M0,-6 C-14,-14 -30,-8 -34,6 C-36,16 -30,24 -22,28 C-28,18 -26,8 -16,4 C-8,2 -2,4 2,6 Z"
            fill="url(#${id}-metal)" stroke="${c.escuro}" stroke-width="1.2"/></g>`,
    clava: (c, id) => `
      <ellipse cx="14" cy="0" rx="18" ry="15" fill="url(#${id}-metal)" stroke="${c.escuro}" stroke-width="1.5"/>
      ${[[14, -19], [30, -10], [33, 6], [22, 17], [4, 16]].map(([x, y]) =>
        `<path d="M${x - 4},${y + 3} L${x},${y - 6} L${x + 4},${y + 3} Z" fill="${c.chifre}" stroke="${c.escuro}" stroke-width="1"/>`).join("")}`,
    maca: (c, id) => `
      <path d="M-2,-4 L14,-3 L14,3 L-2,4 Z" fill="${c.escuro}"/>
      <circle cx="30" cy="0" r="16" fill="url(#${id}-metal)" stroke="${c.escuro}" stroke-width="1.5"/>
      ${Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2, x = 30 + Math.cos(a) * 16, y = Math.sin(a) * 16;
        const px = 30 + Math.cos(a) * 27, py = Math.sin(a) * 27;
        const n = [Math.cos(a + Math.PI / 2) * 4, Math.sin(a + Math.PI / 2) * 4];
        return `<path d="M${f1(x + n[0])},${f1(y + n[1])} L${f1(px)},${f1(py)} L${f1(x - n[0])},${f1(y - n[1])} Z" fill="${c.chifre}" stroke="${c.escuro}" stroke-width="1"/>`;
      }).join("")}`,
    penas: (c, id) => `
      ${[-34, -17, 0, 17, 34].map((a) => `<g transform="rotate(${a})">
        <path d="M0,0 C14,-7 34,-6 44,0 C34,6 14,7 0,0 Z" fill="url(#${id}-pena)" stroke="${c.escuro}" stroke-width="1"/>
        <path d="M2,0 L42,0" stroke="${c.escuro}" stroke-width=".8" opacity=".5"/></g>`).join("")}`,
  };

  /* -------------------------------------------------------- utilitários */
  function rngDe(texto) {
    let h = 2166136261;
    for (const ch of texto) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return () => {
      h += 0x6D2B79F5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function f1(n) { return Math.round(n * 10) / 10; }
  const ponto = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  function espinhos(pontos, n, tam, cor, contorno, arredondado) {
    const segs = [];
    for (let i = 0; i < pontos.length - 1; i++) segs.push([pontos[i], pontos[i + 1]]);
    let s = "";
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) / n * segs.length;
      const [a, b] = segs[Math.min(segs.length - 1, Math.floor(u))];
      const [x, y] = ponto(a, b, u - Math.floor(u));
      const e = tam * (0.7 + 0.5 * Math.sin(Math.PI * (k + 0.5) / n));
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const nx = Math.sin(ang), ny = -Math.cos(ang);
      const p1 = [f1(x - Math.cos(ang) * e * 0.5), f1(y - Math.sin(ang) * e * 0.5)];
      const p2 = [f1(x + Math.cos(ang) * e * 0.5), f1(y + Math.sin(ang) * e * 0.5)];
      const topo = [f1(x + nx * e * 1.25 + Math.cos(ang) * e * 0.4), f1(y + ny * e * 1.25 + Math.sin(ang) * e * 0.4)];
      s += arredondado
        ? `<path d="M${p1} Q${topo} ${p2} Z" fill="${cor}" stroke="${contorno}" stroke-width="1"/>`
        : `<path d="M${p1} L${topo} L${p2} Z" fill="${cor}" stroke="${contorno}" stroke-width="1"/>`;
    }
    return s;
  }

  /* ------------------------------------------------------------- cenário */
  function cordilheira(rng, yBase, amp, estilo) {
    let d = `M0,400 L0,${yBase}`;
    let x = 0, alto = true;
    const topos = [];
    while (x < 600) {
      const passo = estilo === "mesas" ? 40 + rng() * 60 : estilo === "colinas" ? 60 + rng() * 50 : 18 + rng() * 34;
      const nx = Math.min(600, x + passo);
      if (estilo === "picos") {
        const y = yBase - (alto ? amp * (0.45 + rng() * 0.55) : amp * rng() * 0.3);
        d += ` L${f1(nx)},${f1(y)}`;
        if (alto) topos.push([nx, y]);
        alto = !alto;
      } else if (estilo === "colinas") {
        const y = yBase - amp * (0.3 + rng() * 0.7);
        d += ` Q${f1((x + nx) / 2)},${f1(y - amp * 0.3)} ${f1(nx)},${f1(yBase - amp * rng() * 0.4)}`;
      } else if (estilo === "mesas") {
        const y = yBase - amp * (0.4 + rng() * 0.6);
        d += ` L${f1(x + 6)},${f1(y)} L${f1(nx - 6)},${f1(y)} L${f1(nx)},${f1(yBase - amp * rng() * 0.25)}`;
      } else {  // pinheiros
        const y = yBase - amp * (0.2 + rng() * 0.5);
        d += ` L${f1(nx)},${f1(y)}`;
      }
      x = nx;
    }
    d += " L600,400 Z";
    let arvores = "";
    if (estilo === "pinheiros") {
      for (let tx = 0; tx < 600; tx += 7 + rng() * 6) {
        const h = 10 + rng() * amp * 0.5;
        const base = yBase - amp * 0.2 - rng() * amp * 0.3;
        arvores += `M${f1(tx - h * 0.28)},${f1(base)} L${f1(tx)},${f1(base - h)} L${f1(tx + h * 0.28)},${f1(base)} Z `;
      }
    }
    return { d, topos, arvores };
  }

  function cenario(nomeCena, id, chave) {
    const C = CENAS[nomeCena];
    const rng = rngDe(chave + nomeCena);
    const [c0, c1] = C.ceu;
    let s = `<rect width="600" height="400" fill="url(#${id}-ceu)"/>`;

    if (C.estrelas) {
      for (let i = 0; i < 60; i++) s += `<circle cx="${f1(rng() * 600)}" cy="${f1(rng() * 170)}" r="${f1(0.4 + rng() * 0.9)}" fill="#fff" opacity="${f1(0.3 + rng() * 0.6)}"/>`;
    }
    const a = C.astro;
    if (a.raios) {
      for (let i = 0; i < 9; i++) {
        const ang = Math.PI + (i + 0.5) * (Math.PI / 9);
        const x2 = a.x + Math.cos(ang) * 460, y2 = a.y + Math.sin(ang) * 460;
        const x3 = a.x + Math.cos(ang + 0.07) * 460, y3 = a.y + Math.sin(ang + 0.07) * 460;
        s += `<path d="M${a.x},${a.y} L${f1(x2)},${f1(y2)} L${f1(x3)},${f1(y3)} Z" fill="${a.cor}" opacity=".09"/>`;
      }
    }
    s += `<circle cx="${a.x}" cy="${a.y}" r="${a.r * 3.2}" fill="url(#${id}-halo)"/>`;
    if (a.tipo === "lua") {
      s += `<circle cx="${a.x}" cy="${a.y}" r="${a.r}" fill="${a.cor}"/>
            <circle cx="${a.x - 8}" cy="${a.y - 6}" r="5" fill="#c9ced8" opacity=".5"/><circle cx="${a.x + 9}" cy="${a.y + 7}" r="3.5" fill="#c9ced8" opacity=".45"/>
            <circle cx="${a.x + 4}" cy="${a.y - 12}" r="2.5" fill="#c9ced8" opacity=".4"/>`;
    } else if (a.tipo === "sol") {
      s += `<circle cx="${a.x}" cy="${a.y}" r="${a.r}" fill="${a.cor}" opacity=".95"/>`;
    }
    s += `<g filter="url(#${id}-desfoque)" opacity=".55">`;
    for (let i = 0; i < 7; i++) {
      s += `<ellipse cx="${f1(rng() * 600)}" cy="${f1(30 + rng() * 120)}" rx="${f1(60 + rng() * 90)}" ry="${f1(8 + rng() * 14)}" fill="${i % 2 ? c1 : c0}"/>`;
    }
    s += `</g>`;

    const bases = [250, 280, 312, 345];
    const amps = [110, 90, 70, 50];
    C.montanhas.forEach((cor, i) => {
      if (C.vulcao && i === 0) {
        s += `<ellipse cx="300" cy="86" rx="56" ry="30" fill="#3a2a26" opacity=".8" filter="url(#${id}-desfoque)"/>
              <ellipse cx="324" cy="52" rx="44" ry="22" fill="#3a2a26" opacity=".6" filter="url(#${id}-desfoque)"/>
              <path d="M160,400 L160,262 L282,124 L300,118 L318,124 L440,262 L440,400 Z" fill="${cor}"/>
              <path d="M282,124 L300,118 L318,124 L308,133 L292,133 Z" fill="${C.lava}" filter="url(#${id}-brilho)"/>
              <path d="M298,133 C306,170 290,210 306,252" stroke="${C.lava}" stroke-width="3" fill="none" opacity=".8" filter="url(#${id}-brilho)"/>
              <path d="M304,133 C318,160 326,190 340,232" stroke="${C.lava}" stroke-width="2" fill="none" opacity=".6"/>`;
      }
      const estilo = C.relevo === "pinheiros" && i < 2 ? "colinas" : C.relevo;
      const m = cordilheira(rng, bases[i], amps[i], estilo);
      s += `<path d="${m.d}" fill="${cor}"/>`;
      if (m.arvores) s += `<path d="${m.arvores}" fill="${cor}"/>`;
      if (C.neve && i < 2) {
        s += m.topos.map(([x, y]) => `<path d="M${f1(x - 9)},${f1(y + 12)} L${f1(x)},${f1(y)} L${f1(x + 9)},${f1(y + 12)} L${f1(x + 3)},${f1(y + 9)} L${f1(x - 2)},${f1(y + 13)} Z" fill="#f4f8fb" opacity=".9"/>`).join("");
      }
      s += `<rect x="-20" y="${bases[i] - 14}" width="640" height="40" fill="${C.nevoa}" opacity="${f1(0.16 + i * 0.04)}" filter="url(#${id}-desfoque)"/>`;
      if (i === 2) {
        const b = bases[i];
        if (C.lago) s += `<ellipse cx="330" cy="${b + 22}" rx="190" ry="15" fill="${C.lago}" opacity=".9"/>
                         <path d="M190,${b + 22} L470,${b + 20}" stroke="#fff" stroke-width="1.5" opacity=".75"/>`;
        if (C.rio) s += `<path d="M330,${b + 2} C370,${b + 12} 330,${b + 24} 390,${b + 34} C450,${b + 44} 430,${b + 62} 500,400"
                          stroke="${C.rio}" stroke-width="4" fill="none" opacity=".8"/>`;
        if (C.lava) s += `<path d="M110,${b + 6} C170,${b + 18} 150,${b + 34} 230,${b + 46} C290,${b + 56} 270,${b + 70} 330,400"
                           stroke="${C.lava}" stroke-width="4" fill="none" opacity=".9" filter="url(#${id}-brilho)"/>`;
      }
    });

    // rochas em primeiro plano
    s += `<path d="M0,400 L0,330 L40,316 L70,326 L110,312 L150,332 L190,340 L240,362 L280,400 Z" fill="${C.rochas}"/>
          <path d="M40,316 L70,326 L110,312 L150,332" stroke="${C.luz}" stroke-width="1.2" fill="none" opacity=".35"/>
          <path d="M600,400 L600,350 L570,344 L540,356 L512,372 L490,400 Z" fill="${C.rochas}"/>
          <rect x="-20" y="340" width="640" height="70" fill="${C.nevoa}" opacity=".18" filter="url(#${id}-desfoque)"/>`;

    if (C.cinzas) {
      for (let i = 0; i < 50; i++) s += `<circle cx="${f1(rng() * 600)}" cy="${f1(rng() * 400)}" r="${f1(0.6 + rng() * 1.4)}" fill="${i % 3 ? "#9a8a80" : "#ff9a40"}" opacity="${f1(0.3 + rng() * 0.5)}"/>`;
    }
    return s;
  }

  /* -------------------------------------------------------------- dragão */
  function asaPerto(def, c, id) {
    const a = ASAS[def];
    const [rx, ry] = a.raiz, [px, py] = a.pulso, [tx, ty] = a.ponta;
    let borda = `M${rx},${ry} L${px},${py} L${tx},${ty}`;
    let anterior = [tx, ty];
    for (const [fx, fy] of a.dedos) {
      const mx = (anterior[0] + fx) / 2, my = (anterior[1] + fy) / 2;
      borda += ` Q${f1(mx + (px - mx) * 0.18)},${f1(my + (py - my) * 0.18)} ${fx},${fy}`;
      anterior = [fx, fy];
    }
    borda += ` Q${f1((anterior[0] + rx) / 2)},${f1((anterior[1] + ry) / 2 - 6)} ${rx + 18},${ry + 10} Z`;
    const dedos = [[tx, ty], ...a.dedos].map(([x, y]) =>
      `<path d="M${px},${py} L${x},${y}" stroke="${c.escuro}" stroke-width="3" stroke-linecap="round"/>`).join("");
    return `<g class="asa-perto">
      <path d="${borda}" fill="url(#${id}-asa)" stroke="${c.escuro}" stroke-width="2" stroke-linejoin="round"/>
      <path d="${borda}" fill="url(#${id}-veias)" opacity=".35"/>
      <path d="M${rx},${ry} L${px},${py}" stroke="${c.escuro}" stroke-width="7" stroke-linecap="round"/>
      <path d="M${rx},${ry} L${px},${py}" stroke="${c.claro}" stroke-width="2" stroke-linecap="round" opacity=".5"/>
      ${dedos}
      <path d="M${px},${py} l-4,-12 l10,6 Z" fill="${c.chifre}"/>
    </g>`;
  }

  function asaLonge(c, id) {
    const a = ASA_LONGE;
    const [rx, ry] = a.raiz, [px, py] = a.pulso, [tx, ty] = a.ponta;
    let borda = `M${rx},${ry} L${px},${py} L${tx},${ty}`;
    for (const [fx, fy] of a.dedos) borda += ` Q${f1((fx + px) / 2)},${f1((fy + py) / 2 + 14)} ${fx},${fy}`;
    borda += ` L${rx - 10},${ry + 6} Z`;
    const dedos = a.dedos.map(([x, y]) => `<path d="M${px},${py} L${x},${y}" stroke="${c.escuro}" stroke-width="2.2"/>`).join("");
    return `<g class="asa-longe" opacity=".9">
      <path d="${borda}" fill="url(#${id}-asaLonge)" stroke="${c.escuro}" stroke-width="1.6"/>
      <path d="M${rx},${ry} L${px},${py}" stroke="${c.escuro}" stroke-width="5" stroke-linecap="round"/>${dedos}</g>`;
  }

  function cabeca(d, c, id) {
    const [hx, hy, esc] = CABECA[d.forma];
    const palpebra = d.extras.includes("palpebra");
    const chifres = CHIFRES[d.chifres].map((p) => `<path d="${p}" fill="url(#${id}-chifre)" stroke="${c.escuro}" stroke-width="1.4"/>`).join("");
    const barba = d.extras.includes("barba")
      ? `<g stroke="${c.ventre}" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".9">
           <path d="M98,104 C96,116 100,126 94,138"/><path d="M108,106 C108,120 112,130 106,144"/>
           <path d="M118,108 C120,122 124,132 120,146"/><path d="M128,110 C132,122 136,130 134,140"/></g>`
      : "";
    const crista = d.extras.includes("penas")
      ? [[150, 80], [158, 86], [166, 92]].map(([x, y], i) =>
          `<path d="M${x},${y} C${x + 14},${y - 12 - i * 2} ${x + 30},${y - 8} ${x + 34},${y + 2} C${x + 22},${y - 2} ${x + 12},${y} ${x},${y} Z" fill="url(#${id}-pena)" stroke="${c.escuro}" stroke-width=".8"/>`).join("")
      : "";
    const cabecaPath = "M160,76 C142,64 114,66 96,77 L70,90 C66,95 69,101 77,102 L98,104 C110,111 128,116 142,113 C156,109 166,98 166,86 Z";
    return `<g transform="translate(${hx},${hy}) scale(${esc}) translate(-130,-92)">
      ${crista}${chifres}
      <path d="${cabecaPath}" fill="url(#${id}-corpo)" stroke="${c.escuro}" stroke-width="2" stroke-linejoin="round"/>
      <path d="${cabecaPath}" fill="url(#${id}-escamas)" opacity=".5"/>
      <path d="${cabecaPath}" fill="url(#${id}-luz)"/>
      ${barba}
      <path d="M77,102 C92,104 108,105 124,108" stroke="${c.escuro}" stroke-width="1.6" fill="none"/>
      <path d="M86,102 l3,5 l3,-5 M100,104 l3,5 l3,-4.5 M113,106 l2.5,4 l2.5,-3.5" fill="${c.ponta}"/>
      <ellipse cx="81" cy="91" rx="3.4" ry="1.8" fill="${c.escuro}"/>
      <path d="M112,80 Q128,70 148,78" stroke="${c.escuro}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <g filter="url(#${id}-brilho)" class="olho"><path d="M118,85 Q129,77 141,84 Q130,90 118,85 Z" fill="${c.olho}"/></g>
      <path d="M129.5,79.5 L129.5,88.5" stroke="${c.escuro}" stroke-width="2" stroke-linecap="round"/>
      ${palpebra ? `<path d="M116,84.5 Q129,75 143,83.5 Q130,80 116,84.5 Z" fill="${c.corpo}" stroke="${c.escuro}" stroke-width="1.2"/>` : ""}
    </g>`;
  }

  function pescoco(d, c) {
    const [hx, hy] = CABECA[d.forma];
    const [bx, by] = DORSO[d.forma][0];
    const [fx, fy] = FRENTE[d.forma];
    const caminho = `M${bx},${by + 4} C${bx - 30},${by - 6} ${hx + 60},${hy - 18} ${hx + 30},${hy - 14}
      L${hx + 16},${hy + 18} C${hx + 50},${hy + 28} ${fx - 30},${fy + 4} ${fx},${fy} Z`;
    let placas = "";
    for (let k = 1; k < 6; k++) {
      const t = k / 6;
      const x1 = hx + 16 + (fx - hx - 16) * t, y1 = hy + 18 + (fy - hy - 18) * t + Math.sin(t * Math.PI) * 6;
      placas += `<path d="M${f1(x1 - 6)},${f1(y1 - 4)} Q${f1(x1)},${f1(y1 + 4)} ${f1(x1 + 6)},${f1(y1 + 2)}" stroke="${c.escuro}" stroke-width="1" fill="none" opacity=".45"/>`;
    }
    return { caminho, placas };
  }

  function extrasDragao(d, c, id) {
    let s = "";
    if (d.extras.includes("musgo")) {
      s += [[230, 150, 12], [206, 160, 8], [170, 158, 7], [372, 184, 9], [420, 196, 8], [462, 230, 7]].map(([x, y, r]) =>
        `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.5}" fill="#6f8f3c" opacity=".95"/>
         <circle cx="${f1(x - r * 0.4)}" cy="${y - 2}" r="2" fill="#a5c262"/><circle cx="${f1(x + r * 0.3)}" cy="${y - 1}" r="1.6" fill="#a5c262"/>`).join("");
    }
    if (d.extras.includes("placas")) {
      s += [[226, 150], [252, 145], [280, 143], [308, 145], [336, 152], [360, 165]].map(([x, y]) =>
        `<path d="M${x - 11},${y + 6} L${x - 5},${y - 8} L${x + 7},${y - 9} L${x + 12},${y + 5} Z" fill="${c.claro}" stroke="${c.escuro}" stroke-width="1.2"/>`).join("");
      s += `<path d="M262,180 l26,14 M300,176 l18,12" stroke="${c.escuro}" stroke-width="1.5" opacity=".6"/>`;
    }
    if (d.extras.includes("geada")) {
      for (let i = 0; i < 18; i++) {
        const x = 200 + ((i * 53) % 170), y = 165 + ((i * 29) % 45);
        s += `<path d="M${x - 2},${y} L${x + 2},${y} M${x},${y - 2} L${x},${y + 2}" stroke="#fff" stroke-width="1" opacity=".75"/>`;
      }
    }
    if (d.extras.includes("penas")) {
      s += DORSO[d.forma].slice(1).map(([x, y], i) =>
        `<path d="M${x},${y} C${x + 10},${y - 14} ${x + 26},${y - 14} ${x + 32},${y - 6} C${x + 20},${y - 6} ${x + 10},${y - 2} ${x},${y} Z" fill="url(#${id}-pena)" stroke="${c.escuro}" stroke-width=".8" transform="rotate(${-10 + i * 6} ${x} ${y})"/>`).join("");
    }
    return s;
  }

  function extrasFrente(d, c, id) {
    let s = "";
    const [hx, hy, esc] = CABECA[d.forma];
    const boca = [hx - 52 * esc, hy + 2];
    if (d.extras.includes("brasas")) {
      s += `<g class="brasas">${[[0, 0, 2.6], [-14, -10, 2], [-6, -22, 1.6], [-24, 4, 1.4], [-30, -16, 1.1], [-40, -6, 0.9]].map(([x, y, r]) =>
        `<circle cx="${f1(boca[0] + x)}" cy="${f1(boca[1] + y)}" r="${r}" fill="#ffb347" filter="url(#${id}-brilho)"/>`).join("")}</g>`;
    }
    if (d.extras.includes("faiscas")) {
      for (let i = 0; i < 16; i++) {
        const t = i / 16, x = 470 - t * 120 + Math.sin(i) * 10, y = 290 + Math.cos(i * 1.7) * 18 + t * 10;
        s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(0.8 + (i % 3) * 0.6)}" fill="${i % 2 ? "#ffcf60" : "#ff7a2a"}" opacity="${f1(0.9 - t * 0.5)}"/>`;
      }
    }
    if (d.extras.includes("veneno")) {
      s += `<g class="veneno">
        <path d="M368,96 C364,103 364,109 368,112 C372,109 372,103 368,96 Z" fill="#9ae66e" stroke="#3d6b2a" stroke-width="1"/>
        <circle cx="367" cy="124" r="3" fill="#9ae66e" opacity=".85"/><circle cx="369" cy="140" r="2" fill="#9ae66e" opacity=".6"/></g>`;
    }
    if (d.extras.includes("musgo")) {
      s += `<g stroke="#e8d27a" stroke-width="1.4" fill="none" opacity=".6" class="runas">
        <path d="M402,88 l6,-8 l6,8 M420,82 l0,-10 l6,5 M436,90 l7,-7 M442,82 l0,9 M384,104 l8,0 l-4,-7 Z"/></g>`;
    }
    if (d.extras.includes("brilhos")) {
      for (let i = 0; i < 14; i++) {
        const x = 120 + ((i * 71) % 420), y = 40 + ((i * 47) % 260), r = 1.5 + (i % 3);
        s += `<path d="M${x},${y - r * 2} L${x + r * 0.5},${y} L${x},${y + r * 2} L${x - r * 0.5},${y} Z M${x - r * 2},${y} L${x},${y + r * 0.5} L${x + r * 2},${y} L${x},${y - r * 0.5} Z" fill="#fff6d0" opacity=".85"/>`;
      }
    }
    return s;
  }

  function dragao(d, c, id) {
    const forma = d.forma;
    const [caudaPath, tx, ty, ang] = CAUDAS[d.cauda];
    const escorpiao = d.cauda === "escorpiao";
    const pesc = pescoco(d, c);
    const pernaLonge = (p) => `<path d="${p}" transform="translate(16,-6)" fill="${c.corpo}" stroke="${c.escuro}" stroke-width="1.5" opacity=".55"/>`;
    const pernaPerto = (p) => `<path d="${p}" fill="url(#${id}-corpo)" stroke="${c.escuro}" stroke-width="2" stroke-linejoin="round"/>`;
    const garras = `<g fill="${c.ponta}" stroke="${c.escuro}" stroke-width=".8">
      <path d="M258,256 l2,9 l3,-8 Z M264,247 l7,5 l-2,-8 Z M310,268 l1,9 l4,-8 Z M304,258 l-6,6 l8,-1 Z"/></g>`;
    const espinhosCauda = escorpiao ? "" : espinhos(
      d.cauda === "longa" ? [[372, 190], [470, 214], [508, 262], [470, 312]] : [[372, 186], [460, 208], [486, 256], [450, 308]],
      9, forma === "pesado" ? 7 : 6, c.chifre, c.escuro, forma === "pesado");
    const segmentos = escorpiao
      ? [[396, 176, 404, 194], [428, 150, 444, 158], [440, 118, 456, 120], [432, 88, 448, 80], [408, 64, 412, 50]]
          .map(([x1, y1, x2, y2]) => `<path d="M${x1},${y1} L${x2},${y2}" stroke="${c.escuro}" stroke-width="2" opacity=".6"/>`).join("")
      : "";
    const cauda = `
      <path d="${caudaPath}" fill="url(#${id}-corpo)" stroke="${c.escuro}" stroke-width="2" stroke-linejoin="round"/>
      <path d="${caudaPath}" fill="url(#${id}-escamas)" opacity=".5"/>
      <path d="${caudaPath}" fill="url(#${id}-luz)"/>
      ${segmentos}${espinhosCauda}
      <g transform="translate(${tx},${ty}) rotate(${ang})">${PONTAS[d.ponta](c, id)}</g>`;
    const espinhoTam = forma === "pesado" ? 9 : forma === "esguio" ? 6 : forma === "filhote" ? 4 : 10;
    const [hx, hy] = CABECA[forma];
    const comEspinhos = !d.extras.includes("penas");

    return `
      ${asaLonge(c, id)}
      ${pernaLonge(PERNAS.frente)}${pernaLonge(PERNAS.tras)}
      ${escorpiao ? "" : cauda}
      <path d="${TORSO[forma]}" fill="url(#${id}-corpo)" stroke="${c.escuro}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="${TORSO[forma]}" fill="url(#${id}-escamas)" opacity=".55"/>
      <path d="${VENTRE[forma]}" fill="${c.ventre}" opacity=".85"/>
      <path d="${TORSO[forma]}" fill="url(#${id}-luz)"/>
      ${comEspinhos ? espinhos(DORSO[forma], 12, espinhoTam, c.chifre, c.escuro, forma === "pesado") : ""}
      <path d="${pesc.caminho}" fill="url(#${id}-corpo)" stroke="${c.escuro}" stroke-width="2" stroke-linejoin="round"/>
      <path d="${pesc.caminho}" fill="url(#${id}-escamas)" opacity=".55"/>
      <path d="${pesc.caminho}" fill="url(#${id}-luz)"/>
      ${pesc.placas}
      ${comEspinhos ? espinhos([[hx + 34, hy - 12], DORSO[forma][0]], 5, espinhoTam * 0.75, c.chifre, c.escuro, forma === "pesado") : ""}
      ${extrasDragao(d, c, id)}
      ${pernaPerto(PERNAS.tras)}${pernaPerto(PERNAS.frente)}${garras}
      ${asaPerto(d.asas, c, id)}
      ${escorpiao ? cauda : ""}
      ${cabeca(d, c, id)}
      ${extrasFrente(d, c, id)}`;
  }

  /* ---------------------------------------------------------------- defs */
  function defs(c, id, C) {
    const [c0, c1, c2] = C.ceu;
    return `<defs>
      <linearGradient id="${id}-ceu" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c0}"/><stop offset=".55" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
      </linearGradient>
      <radialGradient id="${id}-halo"><stop offset="0" stop-color="${C.astro.cor}" stop-opacity=".55"/><stop offset="1" stop-color="${C.astro.cor}" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}-corpo" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c.claro}"/><stop offset=".55" stop-color="${c.corpo}"/><stop offset="1" stop-color="${c.escuro}"/>
      </linearGradient>
      <linearGradient id="${id}-luz" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${C.luz}" stop-opacity=".35"/><stop offset=".4" stop-color="${C.luz}" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="${id}-asa" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${c.asaClara}" stop-opacity=".96"/><stop offset=".6" stop-color="${c.asa}" stop-opacity=".93"/><stop offset="1" stop-color="${c.escuro}" stop-opacity=".9"/>
      </linearGradient>
      <linearGradient id="${id}-asaLonge" x1="1" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c.asa}"/><stop offset="1" stop-color="${c.escuro}"/>
      </linearGradient>
      <linearGradient id="${id}-chifre" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${c.chifre}"/><stop offset="1" stop-color="${c.ponta}"/>
      </linearGradient>
      <linearGradient id="${id}-metal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c.ponta}"/><stop offset=".5" stop-color="${c.chifre}"/><stop offset="1" stop-color="${c.escuro}"/>
      </linearGradient>
      <linearGradient id="${id}-pena" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${c.corpo}"/><stop offset=".6" stop-color="${c.claro}"/><stop offset="1" stop-color="#ffffff"/>
      </linearGradient>
      <pattern id="${id}-escamas" width="10" height="8" patternUnits="userSpaceOnUse">
        <path d="M0,8 Q5,1 10,8" fill="none" stroke="${c.claro}" stroke-width=".9" opacity=".55"/>
        <path d="M-5,4 Q0,-3 5,4 M5,4 Q10,-3 15,4" fill="none" stroke="${c.escuro}" stroke-width=".7" opacity=".35"/>
      </pattern>
      <pattern id="${id}-veias" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
        <path d="M0,13 C8,9 18,17 26,13" fill="none" stroke="${c.escuro}" stroke-width=".8"/>
      </pattern>
      <filter id="${id}-brilho" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.4" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="${id}-desfoque" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="9"/></filter>
    </defs>`;
  }

  /* ------------------------------------------------------------ montagem */
  function svg(chave, { classe = "", titulo = "" } = {}) {
    const d = DEF[chave];
    if (!d) return "";
    const id = `dr${chave}${++contador}`;
    const C = CENAS[d.cena];
    // o dragão é desenhado olhando para a esquerda e espelhado para voar para a direita
    const filhote = d.forma === "filhote";
    const s = filhote ? 0.62 : 0.95;
    const dx = filhote ? 300 - 280 * s : -8;
    const dy = filhote ? 96 : 34;
    const nevoa = d.extras.includes("nevoa")
      ? `<g filter="url(#${id}-desfoque)" opacity=".6" class="nevoa">
           <ellipse cx="170" cy="300" rx="110" ry="18" fill="${C.nevoa}"/><ellipse cx="300" cy="250" rx="90" ry="12" fill="${C.nevoa}"/></g>`
      : "";
    return `<svg viewBox="0 0 600 400" xmlns="http://www.w3.org/2000/svg" class="dragao-svg ${classe}" role="img" aria-label="${titulo}" preserveAspectRatio="xMidYMid slice">
      ${defs(d.cores, id, C)}
      ${cenario(d.cena, id, chave)}
      ${nevoa}
      <g transform="translate(${f1(600 - dx)},${dy}) scale(${-s},${s})">${dragao(d, d.cores, id)}</g>
    </svg>`;
  }

  return { svg, chaves: Object.keys(DEF) };
})();
