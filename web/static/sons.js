"use strict";

/* =========================================================================
   Quarta Asa — efeitos sonoros e trilha ambiente, 100% sintetizados (Web Audio API).
   Nenhum arquivo de áudio: metais, coral, cordas, tímpanos, taikos e pratos são
   montados com osciladores, ruído, filtros e um reverb de salão gerado na hora.

   API:
     Som.tocarSequencia(["espada", "critico", "|", "dano_recebido"])  // "|" = pausa
     Som.tocar("clique")
     Som.ambiente("floresta")
     Som.config / Som.definir({ efeitos, ambiente, volume })
   ========================================================================= */
const Som = (() => {
  const CHAVE = "quarta-asa-som";
  const PAUSA = 0.45;          // segundos entre a ação do jogador e a resposta do inimigo
  const ESPACO = 0.07;         // segundos entre sons de um mesmo grupo
  const VOL_AMBIENTE = 0.45;

  const config = { efeitos: true, ambiente: true, volume: 0.7 };
  try { Object.assign(config, JSON.parse(localStorage.getItem(CHAVE) || "{}")); } catch (_) { /* sem storage */ }

  let ctx = null, master = null, busEfeitos = null, busSeco = null, busAmbiente = null, ruidoBuf = null;
  let ambienteAtual = null, ambienteDesejado = null, ambienteNos = null;

  /* ---------------------------------------------------------------- notas */
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function nota(n) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
    const semi = SEMI[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
    return 440 * Math.pow(2, (12 * (Number(m[3]) + 1) + semi - 69) / 12);
  }
  const N = (...ns) => ns.map(nota);

  /* ------------------------------------------------------------- mixagem */
  function criarReverb(dur = 3.6, decai = 2.4) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decai);
    }
    const conv = ctx.createConvolver();
    conv.buffer = buf;
    return conv;
  }

  function iniciar() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();

    // master → compressor (cola) → limitador → saída
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    const limitador = ctx.createDynamicsCompressor();
    limitador.threshold.value = -2; limitador.ratio.value = 20; limitador.attack.value = 0.002; limitador.release.value = 0.1;
    master = ctx.createGain();
    master.gain.value = config.volume;
    master.connect(comp).connect(limitador).connect(ctx.destination);

    // reverb de salão compartilhado (com pré-delay)
    const preDelay = ctx.createDelay(0.1); preDelay.delayTime.value = 0.03;
    const reverb = criarReverb();
    const retorno = ctx.createGain(); retorno.gain.value = 0.6;
    const realce = ctx.createBiquadFilter(); realce.type = "lowshelf"; realce.frequency.value = 180; realce.gain.value = 3;
    preDelay.connect(reverb).connect(retorno).connect(realce).connect(master);

    busEfeitos = ctx.createGain();
    busEfeitos.gain.value = config.efeitos ? 1 : 0;
    busEfeitos.connect(master);
    const envioEfeitos = ctx.createGain(); envioEfeitos.gain.value = 0.5;
    busEfeitos.connect(envioEfeitos).connect(preDelay);

    busSeco = ctx.createGain();  // interface: sem reverb
    busSeco.gain.value = config.efeitos ? 1 : 0;
    busSeco.connect(master);

    busAmbiente = ctx.createGain();
    busAmbiente.gain.value = config.ambiente ? VOL_AMBIENTE : 0;
    busAmbiente.connect(master);
    const envioAmbiente = ctx.createGain(); envioAmbiente.gain.value = 0.7;
    busAmbiente.connect(envioAmbiente).connect(preDelay);

    ruidoBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = ruidoBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    if (ambienteDesejado) ambiente(ambienteDesejado);
    return true;
  }

  const agora = () => ctx.currentTime;
  const aleatorio = (a, b) => a + Math.random() * (b - a);

  function conectar(no, destino, pan) {
    if (pan == null) { no.connect(destino); return; }
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    no.connect(p).connect(destino);
  }

  /* envelope percussivo: ataque linear, queda exponencial */
  function envelope(g, t, pico, ataque, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(pico, t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + dur);
  }

  /* envelope sustentado: ataque, sustentação até `dur`, liberação */
  function envelopeSust(g, t, vol, ataque, dur, lib) {
    const fimSust = t + Math.max(ataque, dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + ataque);
    g.gain.setValueAtTime(vol, fimSust);
    g.gain.exponentialRampToValueAtTime(0.0001, fimSust + lib);
    return fimSust + lib + 0.05;
  }

  /* ---------------------------------------------------------- primitivas */
  function tom(t, { freq, fim, tipo = "sine", dur = 0.2, vol = 0.2, ataque = 0.005, destino, filtro, vibrato, pan }) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(freq, t);
    if (fim) o.frequency.exponentialRampToValueAtTime(fim, t + ataque + dur);
    let saida = o;
    if (filtro) {
      const f = ctx.createBiquadFilter();
      f.type = filtro.tipo || "lowpass";
      f.frequency.value = filtro.freq;
      if (filtro.q) f.Q.value = filtro.q;
      saida.connect(f); saida = f;
    }
    if (vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = vibrato.freq; lg.gain.value = vibrato.prof;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t); lfo.stop(t + ataque + dur + 0.05);
    }
    saida.connect(g);
    conectar(g, destino || busEfeitos, pan);
    envelope(g, t, vol, ataque, dur);
    o.start(t);
    o.stop(t + ataque + dur + 0.05);
  }

  function ruido(t, { dur = 0.2, vol = 0.2, ataque = 0.005, tipo = "bandpass", freq = 1000, fim, q = 1, destino, pan, panFim }) {
    const s = ctx.createBufferSource();
    s.buffer = ruidoBuf;
    s.playbackRate.value = aleatorio(0.9, 1.1);
    const f = ctx.createBiquadFilter();
    f.type = tipo; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (fim) f.frequency.exponentialRampToValueAtTime(fim, t + ataque + dur);
    const g = ctx.createGain();
    s.connect(f).connect(g);
    if (panFim != null) {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(pan || 0, t);
      p.pan.linearRampToValueAtTime(panFim, t + ataque + dur);
      g.connect(p).connect(destino || busEfeitos);
    } else {
      conectar(g, destino || busEfeitos, pan);
    }
    envelope(g, t, vol, ataque, dur);
    s.start(t, Math.random());
    s.stop(t + ataque + dur + 0.05);
  }

  /* metais orquestrais: vários dente-de-serra desafinados com filtro que abre */
  function supersaw(t, { freq, dur = 1, vol = 0.1, ataque = 0.06, lib = 0.5, corteIni = 450, corteFim = 2600, vozes = 5, spread = 14, destino, pan }) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.Q.value = 0.9;
    f.frequency.setValueAtTime(corteIni, t);
    f.frequency.linearRampToValueAtTime(corteFim, t + ataque + Math.min(dur, 0.6) * 0.5);
    f.frequency.setTargetAtTime(corteIni * 1.4, t + Math.max(ataque, dur), lib / 3);
    const g = ctx.createGain();
    f.connect(g);
    conectar(g, destino || busEfeitos, pan);
    const fim = envelopeSust(g, t, vol, ataque, dur, lib);
    for (let v = 0; v < vozes; v++) {
      const o = ctx.createOscillator(), vg = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.value = freq;
      o.detune.value = (v - (vozes - 1) / 2) * (spread / ((vozes - 1) / 2 || 1));
      vg.gain.value = 1 / vozes;
      o.connect(vg).connect(f);
      o.start(t); o.stop(fim);
    }
  }

  function metais(t, freq, dur = 0.6, vol = 0.09, opts = {}) {
    supersaw(t, { freq, dur, vol, ...opts });
    supersaw(t, { freq: freq / 2, dur, vol: vol * 0.55, corteIni: 300, corteFim: 1300, ...opts });
  }

  /* coral: dente-de-serra filtrado por formantes de vogal */
  const VOGAIS = {
    a: [[800, 1], [1150, 0.5], [2900, 0.22]],
    o: [[450, 1], [800, 0.45], [2830, 0.12]],
    u: [[325, 1], [700, 0.3], [2530, 0.08]],
  };
  function coro(t, freqs, { dur = 2, vol = 0.05, ataque = 0.6, lib = 1.6, vogal = "a", destino, pan } = {}) {
    for (const freq of freqs) {
      const g = ctx.createGain();
      conectar(g, destino || busEfeitos, pan != null ? pan : aleatorio(-0.35, 0.35));
      const fim = envelopeSust(g, t, vol, ataque, dur, lib);
      const soma = ctx.createGain(); soma.gain.value = 1 / 3;
      for (const [ff, a] of VOGAIS[vogal]) {
        const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = ff; bp.Q.value = 9;
        const ag = ctx.createGain(); ag.gain.value = a * 3;
        soma.connect(bp).connect(ag).connect(g);
      }
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = aleatorio(4.6, 5.6); lg.gain.value = freq * 0.006;
      lfo.connect(lg);
      lfo.start(t); lfo.stop(fim);
      for (const det of [-9, 0, 9]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth"; o.frequency.value = freq; o.detune.value = det + aleatorio(-3, 3);
        lg.connect(o.frequency);
        o.connect(soma);
        o.start(t); o.stop(fim);
      }
    }
  }

  /* cordas: dente-de-serra desafinado, filtro suave e vibrato */
  function cordas(t, freqs, { dur = 2, vol = 0.05, ataque = 0.7, lib = 1.4, corte = 1700, destino, pan } = {}) {
    for (const freq of freqs) {
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = corte; f.Q.value = 0.4;
      const g = ctx.createGain();
      f.connect(g);
      conectar(g, destino || busEfeitos, pan != null ? pan : aleatorio(-0.5, 0.5));
      const fim = envelopeSust(g, t, vol, ataque, dur, lib);
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = aleatorio(5, 6); lg.gain.value = freq * 0.004;
      lfo.connect(lg); lfo.start(t); lfo.stop(fim);
      for (const det of [-11, -4, 4, 11]) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = "sawtooth"; o.frequency.value = freq; o.detune.value = det;
        og.gain.value = 0.25;
        lg.connect(o.frequency);
        o.connect(og).connect(f);
        o.start(t); o.stop(fim);
      }
    }
  }

  function timpano(t, freq = nota("D2"), vol = 0.5, pan) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(freq * 1.6, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
    o.connect(g); conectar(g, busEfeitos, pan);
    envelope(g, t, vol, 0.003, 1.6);
    o.start(t); o.stop(t + 1.7);
    tom(t, { freq: freq * 1.5, dur: 0.6, vol: vol * 0.25, pan });
    ruido(t, { tipo: "bandpass", freq: 200, dur: 0.08, vol: vol * 0.6, pan });
  }

  function rufo(t, dur, freq = nota("D2"), volIni = 0.05, volFim = 0.35) {
    const passos = Math.floor(dur / 0.05);
    for (let i = 0; i < passos; i++) {
      const v = volIni + (volFim - volIni) * (i / passos);
      timpano(t + i * 0.05, freq, v, i % 2 ? 0.15 : -0.15);
    }
  }

  function taiko(t, vol = 0.6, freq = 60, destino, pan) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(freq * 2.2, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
    o.frequency.exponentialRampToValueAtTime(freq * 0.75, t + 0.6);
    o.connect(g); conectar(g, destino || busEfeitos, pan);
    envelope(g, t, vol, 0.003, 0.75);
    o.start(t); o.stop(t + 0.85);
    ruido(t, { tipo: "lowpass", freq: 1000, dur: 0.05, vol: vol * 0.45, destino, pan });
    ruido(t, { tipo: "bandpass", freq: 260, q: 1.2, dur: 0.22, vol: vol * 0.3, destino, pan });
  }

  function boom(t, vol = 0.6) {
    tom(t, { freq: 80, fim: 26, dur: 1.9, vol });
    ruido(t, { tipo: "lowpass", freq: 160, fim: 50, dur: 1.4, vol: vol * 0.6 });
    taiko(t, vol * 0.6, 48);
  }

  function prato(t, vol = 0.16, dur = 2.8) {
    ruido(t, { tipo: "highpass", freq: 6000, dur, vol, pan: -0.55 });
    ruido(t, { tipo: "highpass", freq: 7600, dur: dur * 0.9, vol: vol * 0.9, pan: 0.55 });
    ruido(t, { tipo: "bandpass", freq: 3500, q: 0.8, dur: 0.35, vol: vol * 0.7 });
  }

  /* prato reverso: cresce e corta exatamente em t + dur */
  function pratoReverso(t, dur = 1.2, vol = 0.14) {
    for (const pan of [-0.5, 0.5]) {
      const s = ctx.createBufferSource(); s.buffer = ruidoBuf;
      const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 4500;
      const g = ctx.createGain();
      s.connect(f).connect(g); conectar(g, busEfeitos, pan);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + dur);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.03);
      s.start(t, Math.random()); s.stop(t + dur + 0.05);
    }
  }

  function metal(t, base, vol = 0.12, dur = 0.5, pan) {
    [1, 1.73, 2.61, 3.9, 5.2].forEach((m, i) =>
      tom(t, { freq: base * m, dur: dur / (1 + i * 0.35), vol: vol / (1 + i * 0.6), ataque: 0.002, pan }));
  }

  function sino(t, base, vol = 0.25, dur = 4.5) {
    [[0.5, 1], [1, 0.8], [1.19, 0.5], [1.5, 0.45], [2, 0.35], [2.74, 0.2], [3.76, 0.12]].forEach(([m, a]) =>
      tom(t, { freq: base * m, dur: dur * (m < 1.2 ? 1 : 0.6), vol: vol * a, ataque: 0.003 }));
  }

  function impacto(t, vol = 0.45, grave = 110, pan) {
    tom(t, { freq: grave, fim: grave * 0.4, dur: 0.28, vol, pan });
    tom(t, { freq: 55, fim: 30, dur: 0.45, vol: vol * 0.7 });
    ruido(t, { tipo: "lowpass", freq: 1000, dur: 0.1, vol: vol * 0.5, pan });
  }

  function whoosh(t, de = 700, ate = 3200, dur = 0.18, vol = 0.22, pan = null, panFim = null) {
    ruido(t, { freq: de, fim: ate, q: 1.4, dur, vol, ataque: dur * 0.45, pan, panFim });
  }

  function rugido(t, base = 95, dur = 1.3, vol = 0.24, destino = busEfeitos) {
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    const am = ctx.createOscillator(), amg = ctx.createGain();
    f.type = "lowpass";
    f.frequency.setValueAtTime(420, t);
    f.frequency.linearRampToValueAtTime(1500, t + dur * 0.3);
    f.frequency.exponentialRampToValueAtTime(280, t + dur);
    am.frequency.value = 27; amg.gain.value = 0.55;
    am.connect(amg).connect(g.gain);
    f.connect(g).connect(destino);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.15);
    g.gain.setValueAtTime(vol, t + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const [m, det] of [[1, 0], [1.012, 0], [0.5, 5], [1.5, -7]]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth"; o.detune.value = det;
      o.frequency.setValueAtTime(base * m, t);
      o.frequency.linearRampToValueAtTime(base * m * 1.3, t + dur * 0.3);
      o.frequency.exponentialRampToValueAtTime(base * m * 0.55, t + dur);
      o.connect(f);
      o.start(t); o.stop(t + dur + 0.05);
    }
    am.start(t); am.stop(t + dur + 0.05);
    tom(t, { freq: base / 2, fim: base / 3, dur, vol: vol * 0.9, ataque: 0.1, destino });
    ruido(t, { freq: 480, q: 1.6, dur: dur * 0.9, vol: vol * 0.8, ataque: 0.12, destino });
  }

  function fogo(t, dur = 1.1, vol = 0.28) {
    ruido(t, { freq: 400, fim: 1700, q: 0.8, dur, vol, ataque: 0.15, pan: -0.45 });
    ruido(t + 0.03, { freq: 450, fim: 1900, q: 0.8, dur, vol, ataque: 0.15, pan: 0.45 });
    ruido(t, { tipo: "lowpass", freq: 260, dur: dur * 1.3, vol: vol * 1.1, ataque: 0.1 });
    for (let i = 0; i < 14; i++)
      ruido(t + aleatorio(0.1, dur), { tipo: "highpass", freq: 3000, dur: 0.02, vol: 0.09, pan: aleatorio(-0.8, 0.8) });
  }

  function arpejo(t, notas, { tipo = "triangle", passo = 0.08, dur = 0.3, vol = 0.12 } = {}) {
    notas.forEach((f, i) => tom(t + i * passo, { freq: f, tipo, dur, vol }));
  }

  function brilho(t, vol = 0.04, dur = 1.2) {
    for (let i = 0; i < 10; i++)
      tom(t + aleatorio(0, dur * 0.6), { freq: aleatorio(2500, 6000), dur: aleatorio(0.2, 0.6), vol: vol * 0.6, pan: aleatorio(-0.9, 0.9) });
    ruido(t, { tipo: "highpass", freq: 7000, dur, vol: vol * 0.7, ataque: dur * 0.3 });
  }

  /* acorde orquestral completo: metais + coral + cordas */
  function acordeEpico(t, notas, dur = 2, vol = 1) {
    notas.forEach((f) => metais(t, f, dur * 0.8, 0.045 * vol, { ataque: 0.08 }));
    coro(t, notas, { dur, vol: 0.03 * vol, ataque: 0.25 });
    cordas(t, notas.map((f) => f / 2), { dur, vol: 0.035 * vol, ataque: 0.2 });
  }

  /* -------------------------------------------------------------- efeitos */
  const EFEITOS = {
    // ---------- interface (secos, discretos) ----------
    clique: (t) => tom(t, { freq: 1700, fim: 1100, tipo: "triangle", dur: 0.035, vol: 0.06, destino: busSeco }),
    erro: (t) => { tom(t, { freq: 220, tipo: "square", dur: 0.08, vol: 0.05, filtro: { freq: 1100 }, destino: busSeco });
                   tom(t + 0.1, { freq: 165, tipo: "square", dur: 0.12, vol: 0.05, filtro: { freq: 1100 }, destino: busSeco }); },
    pagina: (t) => { ruido(t, { freq: 2600, fim: 1400, q: 0.9, dur: 0.22, vol: 0.09, ataque: 0.06 });
                     ruido(t + 0.12, { freq: 3200, fim: 1800, q: 0.9, dur: 0.14, vol: 0.06, ataque: 0.03 });
                     tom(t, { freq: nota("D2"), dur: 1.2, vol: 0.06, ataque: 0.2 }); },
    salvar: (t) => { for (let i = 0; i < 3; i++) ruido(t + i * 0.09, { freq: 4200, q: 3, dur: 0.06, vol: 0.08, ataque: 0.01 });
                     sino(t + 0.32, nota("A5"), 0.05, 1.6); },
    carregar: (t) => { pratoReverso(t, 0.6, 0.08); coro(t + 0.6, N("D4", "A4"), { dur: 0.8, vol: 0.03, ataque: 0.05 }); brilho(t + 0.6, 0.03, 0.8); },
    apagar: (t) => ruido(t, { freq: 1800, fim: 600, q: 0.7, dur: 0.35, vol: 0.12, ataque: 0.02 }),

    // ---------- narrativa ----------
    dado: (t) => {
      let x = t;
      for (let i = 0; i < 6; i++) {
        ruido(x, { tipo: "highpass", freq: 2500, dur: 0.025, vol: 0.13, pan: aleatorio(-0.4, 0.4) });
        tom(x, { freq: aleatorio(550, 950), tipo: "triangle", dur: 0.04, vol: 0.07 });
        x += aleatorio(0.045, 0.1) * (1 + i * 0.15);
      }
      timpano(x, nota("A1"), 0.25);
    },
    sucesso: (t) => { metais(t, nota("A3"), 0.18, 0.06); acordeEpico(t + 0.2, N("D4", "F#4", "A4"), 1.1, 0.9);
                      timpano(t + 0.2, nota("D2"), 0.4); prato(t + 0.2, 0.07, 1.6); },
    falha: (t) => { metais(t, nota("A3"), 0.4, 0.06, { corteFim: 1400 }); metais(t + 0.4, nota("F3"), 0.9, 0.06, { corteFim: 1200 });
                    cordas(t + 0.4, N("D3", "F3"), { dur: 1, vol: 0.04, ataque: 0.2 }); timpano(t + 0.4, nota("A1"), 0.45); },
    dano: (t) => { impacto(t, 0.55, 120); boom(t, 0.3); },
    atributo: (t) => { sino(t, nota("A5"), 0.06, 1.8); coro(t, N("D5", "A5"), { dur: 0.6, vol: 0.02, ataque: 0.1, lib: 1 }); brilho(t, 0.025, 0.8); },
    item: (t) => { arpejo(t, N("D6", "F#6", "A6", "D7"), { tipo: "sine", passo: 0.05, dur: 0.4, vol: 0.06 }); brilho(t, 0.03, 0.9); },
    equipar: (t) => { ruido(t, { freq: 2800, q: 6, dur: 0.15, vol: 0.12 }); metal(t, 520, 0.11, 0.8, -0.3); metal(t + 0.14, 700, 0.08, 0.7, 0.3);
                      timpano(t + 0.14, nota("D2"), 0.3); },
    nivel: (t) => {
      rufo(t, 0.6, nota("D2"), 0.04, 0.3);
      metais(t, nota("D4"), 0.18, 0.06); metais(t + 0.2, nota("A4"), 0.18, 0.06);
      acordeEpico(t + 0.45, N("D4", "F#4", "A4", "D5"), 2, 1.1);
      prato(t + 0.45, 0.15); boom(t + 0.45, 0.45); brilho(t + 0.45, 0.04, 1.6);
    },
    inicio: (t) => {
      // trompa de guerra, taikos e coro
      metais(t, nota("D2"), 1.4, 0.09, { ataque: 0.5, corteFim: 1600 });
      metais(t, nota("A2"), 1.4, 0.06, { ataque: 0.55, corteFim: 1600 });
      taiko(t, 0.6); taiko(t + 0.4, 0.5); taiko(t + 0.8, 0.55);
      pratoReverso(t + 0.2, 1.0, 0.12);
      boom(t + 1.2, 0.6); prato(t + 1.2, 0.14);
      acordeEpico(t + 1.2, N("D3", "A3", "D4", "F4"), 2.2, 1);
    },
    capitulo: (t) => {
      rufo(t, 0.85, nota("D2"), 0.04, 0.4);
      metais(t, nota("D4"), 0.22, 0.07); metais(t + 0.25, nota("A4"), 0.22, 0.07); metais(t + 0.5, nota("D5"), 0.28, 0.07);
      acordeEpico(t + 0.85, N("D4", "F#4", "A4", "D5"), 2.6, 1.2);
      boom(t + 0.85, 0.6); prato(t + 0.85, 0.17, 3.2); brilho(t + 0.85, 0.04, 2);
    },
    final: (t) => {
      // I – IV – V – I com orquestra completa
      const prog = [["D4", "F#4", "A4"], ["G3", "B3", "D4", "G4"], ["A3", "C#4", "E4", "A4"]];
      prog.forEach((acorde, i) => {
        const x = t + i * 1.2;
        acordeEpico(x, N(...acorde), 1.2, 1);
        timpano(x, nota(i === 1 ? "G1" : i === 2 ? "A1" : "D2"), 0.45);
      });
      rufo(t + 2.4, 1.2, nota("A1"), 0.05, 0.45);
      pratoReverso(t + 2.4, 1.2, 0.15);
      acordeEpico(t + 3.6, N("D4", "F#4", "A4", "D5", "F#5"), 4, 1.4);
      boom(t + 3.6, 0.7); prato(t + 3.6, 0.2, 4); brilho(t + 3.6, 0.05, 3);
    },
    vinculo: (t) => {
      // rugido, silêncio tenso, prato reverso e explosão de coral
      rugido(t, 82, 1.8, 0.26); boom(t, 0.5);
      cordas(t + 0.6, N("D3", "A3"), { dur: 1.6, vol: 0.035, ataque: 1 });
      pratoReverso(t + 1.4, 1.2, 0.16);
      boom(t + 2.6, 0.7); prato(t + 2.6, 0.2, 4);
      acordeEpico(t + 2.6, N("D3", "F#3", "A3", "D4", "F#4", "A4"), 4, 1.3);
      brilho(t + 2.6, 0.05, 3);
    },
    morte: (t) => {
      sino(t, 196, 0.24, 6);
      tom(t, { freq: nota("D1"), dur: 6, vol: 0.12, ataque: 1 });
      coro(t + 0.4, N("D3", "F3", "A3"), { dur: 3.5, vol: 0.035, ataque: 1.5, lib: 2.5, vogal: "o" });
      sino(t + 2.6, 196, 0.17, 6);
    },
    cura: (t) => { coro(t, N("D4", "F#4", "A4", "D5"), { dur: 1.2, vol: 0.025, ataque: 0.4, lib: 1.4 }); brilho(t + 0.2, 0.035, 1.2); },

    // ---------- itens ----------
    beber: (t) => { for (let i = 0; i < 3; i++) tom(t + i * 0.16, { freq: 340, fim: 170, dur: 0.09, vol: 0.18 }); brilho(t + 0.45, 0.02, 0.6); },
    oleo: (t) => { ruido(t, { freq: 1800, fim: 6500, q: 4, dur: 0.45, vol: 0.12, ataque: 0.05 }); metal(t + 0.45, 1200, 0.06, 0.9); },
    folha: (t) => { for (let i = 0; i < 4; i++) ruido(t + i * 0.08 + aleatorio(0, 0.03), { freq: 1500, q: 1.5, dur: 0.05, vol: 0.12 }); },

    // ---------- combate ----------
    combate_inicio: (t) => {
      ruido(t, { tipo: "highpass", freq: 2500, fim: 8000, dur: 0.45, vol: 0.13, ataque: 0.25 });
      metal(t + 0.42, 1250, 0.09, 1.2);
      boom(t + 0.42, 0.55); taiko(t + 0.72, 0.5);
      metais(t + 0.42, nota("D3"), 0.35, 0.07); metais(t + 0.42, nota("A3"), 0.35, 0.05);
    },
    chefe: (t) => {
      metais(t + 0.5, nota("D2"), 2, 0.1, { ataque: 0.6, corteFim: 1400 });
      metais(t + 0.5, nota("Eb2"), 2, 0.06, { ataque: 0.7, corteFim: 1200 });
      coro(t + 0.5, N("D3", "Eb3", "A3"), { dur: 2, vol: 0.04, ataque: 0.8, vogal: "o" });
      taiko(t + 0.5, 0.6); taiko(t + 0.9, 0.6); taiko(t + 1.3, 0.7);
      boom(t + 1.7, 0.7); prato(t + 1.7, 0.15);
    },
    golpe: (t) => { whoosh(t, 600, 2200, 0.13, 0.16); impacto(t + 0.11, 0.35, 220); },
    adaga: (t, pan = aleatorio(-0.4, 0.4)) => {
      whoosh(t, 2000, 5500, 0.09, 0.16, pan - 0.3, pan);
      tom(t + 0.09, { freq: 260, fim: 90, dur: 0.07, vol: 0.3, pan });
      ruido(t + 0.09, { tipo: "highpass", freq: 3000, dur: 0.03, vol: 0.1, pan });
    },
    adagas: (t) => { EFEITOS.adaga(t, -0.6); EFEITOS.adaga(t + 0.11, 0); EFEITOS.adaga(t + 0.22, 0.6); taiko(t + 0.31, 0.3, 90); },
    espada: (t) => { whoosh(t, 800, 3200, 0.16, 0.2, -0.5, 0.4); metal(t + 0.13, 880, 0.1, 0.6); impacto(t + 0.13, 0.3, 160); },
    espada_pesada: (t) => {
      whoosh(t, 350, 2400, 0.34, 0.28, -0.7, 0.5);
      metal(t + 0.32, 620, 0.13, 1.1); boom(t + 0.32, 0.55); taiko(t + 0.32, 0.5);
      metais(t + 0.32, nota("D3"), 0.25, 0.05);
    },
    soco: (t, pan) => impacto(t, 0.5, 150, pan),
    combo: (t) => { EFEITOS.soco(t, -0.3); EFEITOS.soco(t + 0.13, 0.3); taiko(t + 0.13, 0.35, 80); },
    analise: (t) => { sino(t, nota("A5"), 0.05, 1.2); coro(t, N("A4", "E5"), { dur: 0.4, vol: 0.02, ataque: 0.05, lib: 0.8 }); EFEITOS.golpe(t + 0.2); },
    critico: (t) => { metal(t + 0.05, 1700, 0.09, 1.2); boom(t + 0.05, 0.45); prato(t + 0.05, 0.08, 1.4); },
    esquiva: (t) => whoosh(t, 1400, 450, 0.28, 0.16, -0.8, 0.8),
    dano_recebido: (t) => { impacto(t, 0.6, 90); boom(t, 0.35); ruido(t, { tipo: "lowpass", freq: 500, dur: 0.25, vol: 0.25 }); },
    defender: (t) => { metal(t, 400, 0.14, 0.9); taiko(t, 0.4, 90); },
    fuga: (t) => { for (let i = 0; i < 4; i++) ruido(t + i * 0.14, { tipo: "lowpass", freq: 700, dur: 0.06, vol: 0.2, pan: i % 2 ? 0.3 : -0.3 });
                   whoosh(t + 0.4, 1200, 400, 0.3, 0.1, 0, 0.9); },
    veneno: (t) => { for (let i = 0; i < 6; i++) tom(t + i * 0.07 + aleatorio(0, 0.03), { freq: aleatorio(380, 900), fim: aleatorio(900, 1400), dur: 0.05, vol: 0.06, filtro: { freq: 2500 }, pan: aleatorio(-0.5, 0.5) }); },
    queimadura: (t) => { ruido(t, { tipo: "highpass", freq: 4000, dur: 0.55, vol: 0.09, ataque: 0.05 }); ruido(t, { tipo: "lowpass", freq: 300, dur: 0.6, vol: 0.12, ataque: 0.1 }); },
    atordoado: (t) => [1400, 1800, 1400, 1800].forEach((f, i) => tom(t + i * 0.09, { freq: f, dur: 0.08, vol: 0.05, vibrato: { freq: 18, prof: 40 }, pan: i % 2 ? 0.4 : -0.4 })),

    // ---------- sinetes e dragão ----------
    relampago: (t) => {
      ruido(t, { tipo: "highpass", freq: 1200, dur: 0.07, vol: 0.7 });
      tom(t, { freq: 2400, fim: 150, tipo: "sawtooth", dur: 0.1, vol: 0.1 });
      boom(t, 0.7);
      ruido(t + 0.05, { tipo: "lowpass", freq: 420, fim: 60, dur: 2.6, vol: 0.55, ataque: 0.02, pan: -0.5 });
      ruido(t + 0.18, { tipo: "lowpass", freq: 300, fim: 55, dur: 2.4, vol: 0.45, ataque: 0.08, pan: 0.5 });
      prato(t, 0.1, 2);
    },
    sombras: (t) => {
      pratoReverso(t, 0.7, 0.08);
      tom(t, { freq: 55, fim: 82, tipo: "sawtooth", dur: 1.2, vol: 0.12, ataque: 0.6, filtro: { freq: 320 } });
      tom(t, { freq: 58, fim: 87, tipo: "sawtooth", dur: 1.2, vol: 0.1, ataque: 0.65, filtro: { freq: 320 } });
      coro(t, N("D3", "Eb3", "Ab3"), { dur: 1, vol: 0.035, ataque: 0.5, lib: 1.2, vogal: "u" });
      boom(t + 0.7, 0.45);
    },
    gelo: (t) => {
      for (let i = 0; i < 16; i++) tom(t + aleatorio(0, 0.6), { freq: aleatorio(2200, 5600), dur: aleatorio(0.15, 0.5), vol: 0.035, pan: aleatorio(-0.9, 0.9) });
      ruido(t, { tipo: "highpass", freq: 6500, dur: 0.8, vol: 0.08, ataque: 0.1 });
      coro(t + 0.1, N("A5", "E6"), { dur: 0.7, vol: 0.015, ataque: 0.3 });
      metal(t + 0.55, 900, 0.08, 1.2); boom(t + 0.55, 0.4);
    },
    mente: (t) => {
      coro(t, N("A4", "E5", "A5"), { dur: 1, vol: 0.03, ataque: 0.4, lib: 1.4 });
      tom(t, { freq: 660, dur: 1.2, vol: 0.04, ataque: 0.4, vibrato: { freq: 4, prof: 6 } });
      brilho(t, 0.035, 1.3);
    },
    dragao: (t) => { rugido(t, 92, 1.3, 0.26); boom(t, 0.5); fogo(t + 0.85, 1.2, 0.3); taiko(t + 0.85, 0.4); },
    explosao: (t) => {
      pratoReverso(t, 0.45, 0.1);
      boom(t + 0.45, 0.75); taiko(t + 0.45, 0.6, 50);
      ruido(t + 0.45, { tipo: "lowpass", freq: 1800, fim: 120, dur: 1.4, vol: 0.5, pan: -0.4 });
      ruido(t + 0.5, { tipo: "lowpass", freq: 1500, fim: 100, dur: 1.3, vol: 0.45, pan: 0.4 });
      fogo(t + 0.5, 0.9, 0.22); prato(t + 0.45, 0.12, 2);
    },
    tremor: (t) => {
      for (let i = 0; i < 6; i++) taiko(t + i * 0.09, 0.25 + i * 0.05, 40 + i * 3, undefined, i % 2 ? 0.3 : -0.3);
      ruido(t, { tipo: "lowpass", freq: 140, dur: 1.6, vol: 0.55, ataque: 0.2 });
      for (let i = 0; i < 10; i++) ruido(t + 0.2 + Math.random() * 1, { tipo: "bandpass", freq: aleatorio(600, 1800), q: 2, dur: 0.05, vol: 0.12, pan: aleatorio(-0.8, 0.8) });
      boom(t + 0.55, 0.6); metais(t + 0.55, nota("D2"), 0.8, 0.05, { corteFim: 900 });
    },
    tempo: (t) => {
      tom(t, { freq: 1200, fim: 300, dur: 0.6, vol: 0.06, vibrato: { freq: 9, prof: 30 } });
      for (let i = 0; i < 6; i++) tom(t + 0.1 + i * 0.12, { freq: 2600 - i * 180, dur: 0.06, vol: 0.05, tipo: "triangle", pan: i % 2 ? 0.5 : -0.5 });
      coro(t + 0.3, N("D4", "A4", "D5", "F#5"), { dur: 1.4, vol: 0.03, ataque: 0.5, lib: 2 });
      sino(t + 0.3, nota("D6"), 0.05, 2.5); brilho(t + 0.3, 0.04, 1.6);
    },

    // ---------- inimigos ----------
    furia: (t) => { rugido(t, 150, 0.9, 0.2); taiko(t, 0.45); taiko(t + 0.3, 0.45); },
    fogo_inimigo: (t) => { tom(t, { freq: 700, fim: 280, tipo: "sawtooth", dur: 0.5, vol: 0.06, filtro: { freq: 2200 } }); fogo(t + 0.15, 0.9, 0.24); },
    dreno: (t) => {
      tom(t, { freq: 440, fim: 110, dur: 1.3, vol: 0.08, ataque: 0.1, vibrato: { freq: 7, prof: 10 } });
      coro(t, N("A3", "Eb3"), { dur: 1, vol: 0.03, ataque: 0.3, lib: 1, vogal: "u" });
      ruido(t, { tipo: "lowpass", freq: 1200, fim: 150, dur: 1.3, vol: 0.15, ataque: 0.2 });
      tom(t, { freq: nota("D1"), dur: 1.4, vol: 0.1, ataque: 0.4 });
    },

    // ---------- resultado ----------
    vitoria: (t) => {
      metais(t, nota("D4"), 0.14, 0.07); metais(t + 0.15, nota("F#4"), 0.14, 0.07); metais(t + 0.3, nota("A4"), 0.14, 0.07);
      acordeEpico(t + 0.45, N("D4", "F#4", "A4", "D5"), 1.6, 1.1);
      timpano(t + 0.45, nota("D2"), 0.5); prato(t + 0.45, 0.15); boom(t + 0.45, 0.4);
    },
    derrota: (t) => {
      cordas(t, N("A3"), { dur: 0.6, vol: 0.05, ataque: 0.1 });
      cordas(t + 0.6, N("F3"), { dur: 0.6, vol: 0.05, ataque: 0.1 });
      cordas(t + 1.2, N("D3", "A2"), { dur: 1.6, vol: 0.05, ataque: 0.1, lib: 2 });
      coro(t + 1.2, N("D3", "F3"), { dur: 1.6, vol: 0.03, ataque: 0.6, vogal: "o" });
      boom(t + 1.2, 0.55);
    },
  };

  function tocar(nome, atraso = 0) {
    if (!config.efeitos || !iniciar()) return;
    const fn = EFEITOS[nome];
    if (fn) fn(agora() + 0.01 + atraso);
  }

  function tocarSequencia(lista) {
    if (!lista || !lista.length || !config.efeitos || !iniciar()) return;
    let t = 0;
    let anterior = false;
    for (const nome of lista) {
      if (nome === "|") { t += PAUSA; anterior = false; continue; }
      if (anterior) t += ESPACO;
      tocar(nome, t);
      anterior = true;
    }
  }

  /* ------------------------------------------------------------- ambientes */
  function camadaRuido(destino, { tipo = "bandpass", freq = 500, q = 0.7, vol = 0.3, lfo = 0.1, prof = 200, lfoVol = 0 }) {
    const s = ctx.createBufferSource(); s.buffer = ruidoBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = tipo; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = vol;
    const l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = lfo; lg.gain.value = prof; l.connect(lg).connect(f.frequency);
    const nos = [s, l];
    if (lfoVol) {
      const l2 = ctx.createOscillator(), lg2 = ctx.createGain();
      l2.frequency.value = lfo * 0.7; lg2.gain.value = vol * lfoVol; l2.connect(lg2).connect(g.gain);
      l2.start(); nos.push(l2);
    }
    s.connect(f).connect(g).connect(destino);
    s.start(0, Math.random() * 2); l.start();
    return nos;
  }

  function drone(destino, freqs, vol = 0.05, tipo = "sine", corte = 600) {
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = corte;
    f.connect(destino);
    return freqs.map((fr, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = tipo; o.frequency.value = fr; o.detune.value = (i % 2 ? 6 : -6);
      g.gain.value = vol;
      o.connect(g).connect(f); o.start();
      return o;
    });
  }

  function repetir(fn, min, max, timers) {
    const passo = () => { fn(); timers.push(setTimeout(passo, aleatorio(min, max))); };
    timers.push(setTimeout(passo, aleatorio(min * 0.3, max * 0.5)));
  }

  /* progressão de acordes que se repete (pads de cordas/coral) */
  function progressao(acordes, segundos, voz, timers) {
    let i = 0;
    const proximo = () => { voz(agora() + 0.05, N(...acordes[i % acordes.length]), segundos); i++; };
    proximo();
    timers.push(setInterval(proximo, segundos * 1000));
  }

  /* sequenciador em semicolcheias com agendamento antecipado */
  function sequenciador(bpm, fn, timers) {
    const passo = 60 / bpm / 4;
    let proximo = agora() + 0.15, i = 0;
    const agendar = () => {
      while (proximo < agora() + 0.3) { fn(proximo, i++); proximo += passo; }
    };
    agendar();
    timers.push(setInterval(agendar, 50));
  }

  function staccato(t, freq, vol, destino) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = "sawtooth"; o2.type = "sawtooth";
    o.frequency.value = freq; o2.frequency.value = freq; o2.detune.value = 9;
    f.type = "lowpass"; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(350, t + 0.16);
    o.connect(f); o2.connect(f); f.connect(g).connect(destino);
    envelope(g, t, vol, 0.006, 0.17);
    o.start(t); o2.start(t); o.stop(t + 0.22); o2.stop(t + 0.22);
  }

  function padCordas(destino, vol, corte = 1500) {
    return (t, notas, seg) => cordas(t, notas, { dur: seg, vol, ataque: seg * 0.35, lib: seg * 0.5, corte, destino });
  }
  function padCoro(destino, vol, vogal = "a") {
    return (t, notas, seg) => coro(t, notas, { dur: seg, vol, ataque: seg * 0.4, lib: seg * 0.5, vogal, destino, pan: 0 });
  }

  const AMBIENTES = {
    titulo: (s, timers) => {
      const nos = drone(s, N("D1", "D2"), 0.05, "sine", 300);
      nos.push(...camadaRuido(s, { tipo: "lowpass", freq: 380, vol: 0.12, lfo: 0.05, prof: 150 }));
      const acordes = [["D3", "F3", "A3"], ["Bb2", "D3", "F3"], ["F2", "A2", "C3", "F3"], ["C3", "E3", "G3"]];
      progressao(acordes, 7, padCordas(s, 0.045), timers);
      progressao(acordes.map((a) => a.slice(-2).map((n) => n.replace(/\d/, (d) => String(Number(d) + 1)))), 7, padCoro(s, 0.022), timers);
      repetir(() => { taiko(agora(), 0.35, 45, s); }, 9000, 16000, timers);
      return nos;
    },
    quartel: (s, timers) => {
      const nos = drone(s, N("D2"), 0.03, "sine", 300);
      nos.push(...camadaRuido(s, { tipo: "lowpass", freq: 250, vol: 0.1, lfo: 0.07, prof: 60 }));
      progressao([["D3", "A3"], ["A2", "E3"], ["Bb2", "F3"], ["A2", "E3"]], 9, padCordas(s, 0.028, 1100), timers);
      repetir(() => ruido(agora(), { tipo: "bandpass", freq: aleatorio(1500, 4000), q: 2, dur: 0.02, vol: 0.07, destino: s, pan: aleatorio(-0.7, 0.7) }), 90, 380, timers);
      return nos;
    },
    vento: (s, timers) => {
      const nos = camadaRuido(s, { freq: 550, q: 0.8, vol: 0.5, lfo: 0.13, prof: 350, lfoVol: 0.6 });
      progressao([["D3", "A3", "E4"], ["C3", "G3", "D4"]], 11, padCordas(s, 0.025, 1200), timers);
      return nos;
    },
    voo: (s, timers) => {
      const nos = camadaRuido(s, { freq: 700, q: 0.6, vol: 0.6, lfo: 0.2, prof: 500, lfoVol: 0.5 });
      const herois = [["D3", "F#3", "A3"], ["A2", "C#3", "E3", "A3"], ["B2", "D3", "F#3"], ["G2", "B2", "D3", "G3"]];
      progressao(herois, 5, padCordas(s, 0.04), timers);
      progressao(herois.map((a) => a.slice(-2).map((n) => n.replace(/\d/, (d) => String(Number(d) + 1)))), 5, padCoro(s, 0.02), timers);
      repetir(() => ruido(agora(), { freq: 300, fim: 1500, q: 0.7, dur: 1.6, vol: 0.3, ataque: 0.8, destino: s, pan: aleatorio(-0.8, 0.8) }), 3500, 7000, timers);
      return nos;
    },
    floresta: (s, timers) => {
      const nos = camadaRuido(s, { tipo: "lowpass", freq: 1100, vol: 0.16, lfo: 0.09, prof: 300, lfoVol: 0.5 });
      progressao([["E3", "B3", "G4"], ["C3", "G3", "E4"], ["D3", "A3", "F#4"], ["B2", "F#3", "D4"]], 9, padCordas(s, 0.025, 1300), timers);
      repetir(() => {
        const t = agora(), base = aleatorio(2400, 3600), n = 2 + Math.floor(Math.random() * 3), pan = aleatorio(-0.9, 0.9);
        for (let i = 0; i < n; i++) tom(t + i * 0.11, { freq: base, fim: base * 1.3, dur: 0.07, vol: 0.045, destino: s, pan });
      }, 1800, 5200, timers);
      repetir(() => rugido(agora(), 60, 2.2, 0.05, s), 14000, 26000, timers);  // dragões ao longe
      return nos;
    },
    noite: (s, timers) => {
      const nos = drone(s, N("A1"), 0.04, "sine", 200);
      progressao([["A2", "E3", "C4"], ["F2", "C3", "A3"]], 12, padCordas(s, 0.02, 900), timers);
      repetir(() => {
        const t = agora(), f = aleatorio(4200, 4800), pan = aleatorio(-0.8, 0.8);
        for (let i = 0; i < 3; i++) tom(t + i * 0.045, { freq: f, dur: 0.025, vol: 0.03, destino: s, pan });
      }, 450, 1100, timers);
      repetir(() => { const t = agora(); tom(t, { freq: 420, fim: 380, dur: 0.35, vol: 0.03, destino: s, ataque: 0.05 });
                      tom(t + 0.45, { freq: 400, fim: 340, dur: 0.5, vol: 0.025, destino: s, ataque: 0.05 }); }, 9000, 18000, timers);
      return nos;
    },
    fogo: (s, timers) => {
      const nos = camadaRuido(s, { tipo: "lowpass", freq: 180, vol: 0.45, lfo: 0.3, prof: 60, lfoVol: 0.3 });
      progressao([["D3", "F3", "A3"], ["Eb3", "G3", "Bb3"], ["D3", "F3", "Ab3"], ["C3", "Eb3", "G3"]], 6, padCordas(s, 0.03, 1100), timers);
      progressao([["D4", "A4"], ["Eb4", "Bb4"], ["D4", "Ab4"], ["C4", "G4"]], 6, padCoro(s, 0.015, "o"), timers);
      repetir(() => ruido(agora(), { tipo: "bandpass", freq: aleatorio(1800, 5000), q: 1.5, dur: aleatorio(0.01, 0.04), vol: aleatorio(0.05, 0.16), destino: s, pan: aleatorio(-0.8, 0.8) }), 40, 260, timers);
      repetir(() => { const t = agora(); taiko(t, 0.3, 40, s, aleatorio(-0.6, 0.6)); ruido(t, { tipo: "lowpass", freq: 200, dur: 1.5, vol: 0.2, destino: s }); }, 4000, 9000, timers);
      repetir(() => tom(agora(), { freq: aleatorio(800, 1100), fim: 380, tipo: "sawtooth", dur: 0.7, vol: 0.02, filtro: { freq: 2400 }, destino: s, pan: aleatorio(-0.9, 0.9) }), 7000, 15000, timers);
      return nos;
    },
    combate: (s, timers) => {
      const nos = drone(s, N("D1", "D2"), 0.035, "sawtooth", 220);
      const ost = N("D2", "D2", "D3", "D2", "F2", "D2", "E2", "D2");
      sequenciador(100, (t, i) => {
        const p = i % 16, compasso = Math.floor(i / 16);
        if ([0, 6, 8, 11].includes(p)) taiko(t, p === 0 ? 0.55 : 0.4, 58, s);
        if (p === 4 || p === 12) taiko(t, 0.3, 140, s, 0.3);
        if (p % 4 === 2) ruido(t, { tipo: "highpass", freq: 3500, dur: 0.02, vol: 0.05, destino: s, pan: -0.3 });
        if (p % 2 === 0) staccato(t, ost[(p / 2) % 8], 0.035, s);
        if (p === 0 && compasso % 8 === 0) metais(t, nota("D2"), 2.2, 0.025, { ataque: 0.8, destino: s, corteFim: 1200 });
      }, timers);
      return nos;
    },
    chefe: (s, timers) => {
      const nos = drone(s, N("D1", "Eb1"), 0.04, "sawtooth", 260);
      const ost = N("D2", "D2", "Eb2", "D2", "D3", "D2", "Eb2", "C2");
      sequenciador(124, (t, i) => {
        const p = i % 16, compasso = Math.floor(i / 16);
        if ([0, 3, 6, 8, 10, 11, 14].includes(p)) taiko(t, p === 0 || p === 8 ? 0.6 : 0.42, 55, s);
        if ([4, 12, 15].includes(p)) taiko(t, 0.32, 150, s, p === 15 ? -0.4 : 0.4);
        if (p % 2 === 1) ruido(t, { tipo: "highpass", freq: 4000, dur: 0.015, vol: 0.04, destino: s });
        if (p % 2 === 0) staccato(t, ost[(p / 2) % 8], 0.04, s);
        if (p === 0 && compasso % 4 === 0) metais(t, nota("D2"), 1.6, 0.03, { ataque: 0.4, destino: s, corteFim: 1300 });
        if (p === 0 && compasso % 4 === 2) metais(t, nota("Eb2"), 1.6, 0.03, { ataque: 0.4, destino: s, corteFim: 1300 });
      }, timers);
      progressao([["D3", "Eb3", "A3"], ["C3", "Eb3", "G3"]], 7.7, padCoro(s, 0.025, "o"), timers);
      return nos;
    },
    silencio: (s, timers) => {
      const nos = camadaRuido(s, { tipo: "lowpass", freq: 300, vol: 0.07, lfo: 0.05, prof: 80 });
      progressao([["D3", "F3", "A3"], ["Bb2", "D3", "F3"]], 10, padCoro(s, 0.018, "o"), timers);
      return nos;
    },
  };

  function pararAmbiente() {
    if (!ambienteNos) return;
    const { saida, nos, timers } = ambienteNos;
    timers.forEach((id) => { clearTimeout(id); clearInterval(id); });
    const t = agora();
    saida.gain.cancelScheduledValues(t);
    saida.gain.setValueAtTime(saida.gain.value, t);
    saida.gain.linearRampToValueAtTime(0.0001, t + 1.4);
    setTimeout(() => { nos.forEach((n) => { try { n.stop(); } catch (_) { /* já parado */ } }); saida.disconnect(); }, 9000);
    ambienteNos = null;
  }

  function ambiente(nome) {
    ambienteDesejado = nome;
    if (!ctx || nome === ambienteAtual) return;
    pararAmbiente();
    ambienteAtual = nome;
    const fabrica = AMBIENTES[nome];
    if (!fabrica) return;
    const saida = ctx.createGain();
    saida.gain.value = 0.0001;
    saida.connect(busAmbiente);
    saida.gain.linearRampToValueAtTime(1, agora() + 1.8);
    const timers = [];
    const nos = fabrica(saida, timers) || [];
    ambienteNos = { saida, nos, timers };
  }

  /* --------------------------------------------------------- configuração */
  function definir(novo) {
    Object.assign(config, novo);
    try { localStorage.setItem(CHAVE, JSON.stringify(config)); } catch (_) { /* sem storage */ }
    if (!ctx) return;
    const t = agora();
    master.gain.setTargetAtTime(config.volume, t, 0.05);
    busEfeitos.gain.setTargetAtTime(config.efeitos ? 1 : 0, t, 0.05);
    busSeco.gain.setTargetAtTime(config.efeitos ? 1 : 0, t, 0.05);
    busAmbiente.gain.setTargetAtTime(config.ambiente ? VOL_AMBIENTE : 0, t, 0.2);
  }

  /* o navegador só libera áudio após um gesto do usuário */
  const destravar = () => {
    if (iniciar()) {
      window.removeEventListener("pointerdown", destravar);
      window.removeEventListener("keydown", destravar);
    }
  };
  window.addEventListener("pointerdown", destravar);
  window.addEventListener("keydown", destravar);

  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  return { tocar, tocarSequencia, ambiente, definir, config, efeitos: Object.keys(EFEITOS), ambientes: Object.keys(AMBIENTES) };
})();
