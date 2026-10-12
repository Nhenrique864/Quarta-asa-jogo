"use strict";

/* =========================================================================
   Quarta Asa — efeitos sonoros de suspense, 100% sintetizados (Web Audio API).
   Nenhum arquivo de áudio: metais, coral, cordas, tímpanos, taikos e pratos são
   montados com osciladores, ruído, filtros e um reverb de salão gerado na hora.

   API:
     Som.tocarSequencia(["espada", "critico", "|", "dano_recebido"])  // "|" = pausa
     Som.tocar("clique")
     Som.config / Som.definir({ efeitos, volume })
   ========================================================================= */
const Som = (() => {
  const CHAVE = "quarta-asa-som";
  const PAUSA = 0.45;          // segundos entre a ação do jogador e a resposta do inimigo
  const ESPACO = 0.07;         // segundos entre sons de um mesmo grupo

  const config = { efeitos: true, volume: 0.7 };
  try { Object.assign(config, JSON.parse(localStorage.getItem(CHAVE) || "{}")); } catch (_) { /* sem storage */ }
  delete config.ambiente;  // preferência de versões antigas, que tinham som ambiente

  let ctx = null, master = null, busEfeitos = null, busSeco = null, ruidoBuf = null;

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


    ruidoBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = ruidoBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

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

  /* ------------------------------------------------- recursos de suspense */
  let curvaDistorcao = null;
  function distorcao() {
    if (curvaDistorcao) return curvaDistorcao;
    const n = 1024, k = 6;
    curvaDistorcao = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curvaDistorcao[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    return curvaDistorcao;
  }

  /* BRAAM: trompas graves distorcidas, o som dos trailers de suspense */
  function braam(t, base = nota("D1"), dur = 2.4, vol = 0.16, destino) {
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.Q.value = 2;
    f.frequency.setValueAtTime(180, t);
    f.frequency.linearRampToValueAtTime(1400, t + 0.12);
    f.frequency.exponentialRampToValueAtTime(240, t + dur);
    const ws = ctx.createWaveShaper(); ws.curve = distorcao(); ws.oversample = "2x";
    const g = ctx.createGain();
    f.connect(ws).connect(g).connect(destino || busEfeitos);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.06);
    g.gain.setValueAtTime(vol * 0.8, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const [m, det] of [[1, -12], [1, 10], [2, -6], [2, 7], [3, 0], [1.5, 4]]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = "sawtooth"; o.frequency.value = base * m; o.detune.value = det;
      og.gain.value = m === 1 ? 0.3 : 0.16;
      o.connect(og).connect(f);
      o.start(t); o.stop(t + dur + 0.05);
    }
    tom(t, { freq: base / 2, dur: dur * 0.8, vol: vol * 1.2, ataque: 0.04, destino });
  }

  /* coração: "tum-tum" grave */
  function batimento(t, vol = 0.4, destino) {
    tom(t, { freq: 62, fim: 38, dur: 0.16, vol, destino });
    tom(t + 0.2, { freq: 54, fim: 34, dur: 0.2, vol: vol * 0.7, destino });
  }

  /* tique de relógio */
  function tique(t, vol = 0.07, destino, agudo = true) {
    ruido(t, { tipo: "highpass", freq: agudo ? 4500 : 3000, dur: 0.015, vol, destino });
    tom(t, { freq: agudo ? 1900 : 1400, dur: 0.02, vol: vol * 0.5, tipo: "triangle", destino });
  }

  /* riser: tensão que sobe até t + dur e corta seco */
  function riser(t, dur = 1.2, vol = 0.12, destino) {
    const saida = destino || busEfeitos;
    const s = ctx.createBufferSource(); s.buffer = ruidoBuf;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 3;
    f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    const g = ctx.createGain();
    s.connect(f).connect(g).connect(saida);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.04);
    s.start(t, Math.random()); s.stop(t + dur + 0.06);
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), og = ctx.createGain();
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(880, t + dur);
    lp.type = "lowpass"; lp.frequency.value = 2500;
    lfo.frequency.setValueAtTime(6, t); lfo.frequency.linearRampToValueAtTime(18, t + dur);
    lg.gain.value = vol * 0.15;
    lfo.connect(lg).connect(og.gain);
    o.connect(lp).connect(og).connect(saida);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(vol * 0.4, t + dur); og.gain.linearRampToValueAtTime(0.0001, t + dur + 0.04);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.06); lfo.stop(t + dur + 0.06);
  }

  /* cordas em trêmolo (arco rápido): a assinatura do suspense */
  function tremolo(t, freqs, { dur = 2, vol = 0.04, ataque = 0.4, lib = 1, taxa = 13, corte = 2200, destino } = {}) {
    for (const freq of freqs) {
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = corte;
      const am = ctx.createGain(); am.gain.value = 0.55;
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = taxa * aleatorio(0.95, 1.05); lg.gain.value = 0.45;
      lfo.connect(lg).connect(am.gain);
      const g = ctx.createGain();
      f.connect(am).connect(g);
      conectar(g, destino || busEfeitos, aleatorio(-0.5, 0.5));
      const fim = envelopeSust(g, t, vol, ataque, dur, lib);
      lfo.start(t); lfo.stop(fim);
      for (const det of [-8, 0, 8]) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = "sawtooth"; o.frequency.value = freq; o.detune.value = det; og.gain.value = 0.33;
        o.connect(og).connect(f);
        o.start(t); o.stop(fim);
      }
    }
  }

  /* harmônicos agudos inquietantes */
  function harmonico(t, freq, dur = 3, vol = 0.025, destino) {
    tom(t, { freq, dur, vol, ataque: dur * 0.4, vibrato: { freq: 5.5, prof: freq * 0.006 }, destino, pan: aleatorio(-0.6, 0.6) });
    tom(t, { freq: freq * 1.004, dur, vol: vol * 0.6, ataque: dur * 0.5, destino, pan: aleatorio(-0.6, 0.6) });
  }

  /* sussurros: ruído filtrado por formantes de voz */
  function sussurro(t, dur = 1.6, vol = 0.05, destino) {
    const s = ctx.createBufferSource(); s.buffer = ruidoBuf; s.playbackRate.value = aleatorio(0.8, 1.2);
    const g = ctx.createGain();
    conectar(g, destino || busEfeitos, aleatorio(-0.9, 0.9));
    const vogal = VOGAIS[["a", "o", "u"][Math.floor(Math.random() * 3)]];
    for (const [ff, a] of vogal) {
      const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = ff * aleatorio(0.9, 1.3); bp.Q.value = 12;
      const ag = ctx.createGain(); ag.gain.value = a * 4;
      s.connect(bp).connect(ag).connect(g);
    }
    envelope(g, t, vol, dur * 0.4, dur * 0.6);
    s.start(t, Math.random()); s.stop(t + dur + 0.1);
  }

  /* cluster dissonante de cordas (segundas menores) */
  function cluster(t, base, opts = {}) {
    cordas(t, [base, base * Math.pow(2, 1 / 12), base * Math.pow(2, 3 / 12), base * 2 * Math.pow(2, 1 / 12)], { vol: 0.03, ...opts });
  }

  /* acorde de quinta (sem terça): épico e ambíguo */
  const quinta = (f) => [f, f * 1.5, f * 2];

  /* acorde sombrio: metais fechados + coro "oh" + cordas em trêmolo */
  function acordeSombrio(t, notas, dur = 2, vol = 1) {
    notas.forEach((f) => metais(t, f, dur * 0.8, 0.04 * vol, { ataque: 0.12, corteFim: 1500 }));
    coro(t, notas, { dur, vol: 0.03 * vol, ataque: 0.3, vogal: "o" });
    tremolo(t, notas.map((f) => f / 2), { dur, vol: 0.03 * vol, ataque: 0.15 });
  }

  /* -------------------------------------------------------------- efeitos */
  const EFEITOS = {
    // ---------- interface (secos, discretos) ----------
    clique: (t) => tom(t, { freq: 1500, fim: 900, tipo: "triangle", dur: 0.035, vol: 0.05, destino: busSeco }),
    erro: (t) => { tom(t, { freq: 196, tipo: "square", dur: 0.09, vol: 0.05, filtro: { freq: 900 }, destino: busSeco });
                   tom(t + 0.1, { freq: 185, tipo: "square", dur: 0.14, vol: 0.05, filtro: { freq: 900 }, destino: busSeco }); },
    pagina: (t) => { ruido(t, { freq: 2200, fim: 1200, q: 0.9, dur: 0.24, vol: 0.07, ataque: 0.06 });
                     tom(t, { freq: nota("D1"), dur: 1.6, vol: 0.1, ataque: 0.05 });
                     harmonico(t + 0.1, nota("A5"), 1.4, 0.008); },
    salvar: (t) => { for (let i = 0; i < 3; i++) ruido(t + i * 0.09, { freq: 3800, q: 3, dur: 0.06, vol: 0.07, ataque: 0.01 });
                     sino(t + 0.32, nota("D4"), 0.06, 2.4); },
    carregar: (t) => { pratoReverso(t, 0.8, 0.08); coro(t + 0.8, N("D3", "A3"), { dur: 1, vol: 0.03, ataque: 0.05, vogal: "o" }); boom(t + 0.8, 0.3); },
    apagar: (t) => ruido(t, { freq: 1600, fim: 400, q: 0.7, dur: 0.4, vol: 0.11, ataque: 0.02 }),

    // ---------- narrativa ----------
    dado: (t) => {
      // relógio, dados rolando e um coração antes do veredito
      for (let i = 0; i < 4; i++) tique(t + i * 0.18, 0.05, undefined, i % 2 === 0);
      let x = t + 0.1;
      for (let i = 0; i < 6; i++) {
        ruido(x, { tipo: "highpass", freq: 2500, dur: 0.025, vol: 0.11, pan: aleatorio(-0.4, 0.4) });
        tom(x, { freq: aleatorio(400, 750), tipo: "triangle", dur: 0.04, vol: 0.06 });
        x += aleatorio(0.05, 0.1) * (1 + i * 0.18);
      }
      riser(t, x - t, 0.05);
      batimento(x + 0.05, 0.35);
    },
    sucesso: (t) => { metais(t, nota("A3"), 0.15, 0.05); acordeSombrio(t + 0.15, [nota("D3"), ...quinta(nota("D4"))], 1.3, 0.9);
                      timpano(t + 0.15, nota("D2"), 0.45); prato(t + 0.15, 0.06, 1.6); },
    falha: (t) => { cluster(t, nota("D3"), { dur: 1.4, vol: 0.04, ataque: 0.05, lib: 1.6 });
                    braam(t, nota("D1"), 1.6, 0.09); boom(t, 0.35); harmonico(t + 0.2, nota("Eb6"), 1.6, 0.012); },
    dano: (t) => { impacto(t, 0.55, 110); boom(t, 0.3); batimento(t + 0.35, 0.3); },
    atributo: (t) => { sino(t, nota("A4"), 0.06, 2); harmonico(t, nota("A5"), 1.4, 0.014); coro(t, N("D4", "A4"), { dur: 0.7, vol: 0.02, ataque: 0.15, lib: 1, vogal: "u" }); },
    item: (t) => { arpejo(t, N("D5", "F5", "A5", "D6"), { tipo: "sine", passo: 0.07, dur: 0.5, vol: 0.05 }); brilho(t, 0.02, 0.9); },
    equipar: (t) => { ruido(t, { freq: 2400, q: 6, dur: 0.15, vol: 0.1 }); metal(t, 440, 0.11, 0.9, -0.3); metal(t + 0.14, 620, 0.08, 0.8, 0.3);
                      timpano(t + 0.14, nota("D2"), 0.3); tremolo(t + 0.14, N("D2"), { dur: 0.6, vol: 0.03, ataque: 0.05 }); },
    nivel: (t) => {
      riser(t, 0.9, 0.08); rufo(t + 0.2, 0.7, nota("D2"), 0.04, 0.3);
      braam(t + 0.9, nota("D1"), 2.2, 0.12);
      acordeSombrio(t + 0.9, [nota("D3"), ...quinta(nota("D4"))], 2.2, 1.1);
      prato(t + 0.9, 0.13); brilho(t + 0.9, 0.03, 1.6);
    },
    inicio: (t) => {
      // coração, tensão subindo e o BRAAM que abre o capítulo
      batimento(t, 0.35); batimento(t + 0.75, 0.4);
      harmonico(t, nota("A5"), 1.6, 0.014); sussurro(t + 0.3, 1.2, 0.03);
      riser(t + 0.3, 1.2, 0.1);
      braam(t + 1.5, nota("D1"), 3, 0.17); taiko(t + 1.5, 0.6); prato(t + 1.5, 0.12);
      acordeSombrio(t + 1.5, N("D3", "F3", "A3", "D4"), 2.6, 1);
    },
    capitulo: (t) => {
      rufo(t, 0.9, nota("D2"), 0.04, 0.42);
      metais(t, nota("A3"), 0.25, 0.06); metais(t + 0.3, nota("C4"), 0.25, 0.06); metais(t + 0.6, nota("D4"), 0.3, 0.06);
      braam(t + 0.9, nota("D1"), 2.8, 0.15);
      acordeSombrio(t + 0.9, N("D3", "A3", "D4", "F4", "A4"), 2.8, 1.2);
      boom(t + 0.9, 0.6); prato(t + 0.9, 0.16, 3.2);
    },
    final: (t) => {
      // Dm – Bb – C sombrios e, enfim, a resolução em ré maior
      [["D3", "F3", "A3", "D4"], ["Bb2", "D3", "F3", "Bb3"], ["C3", "E3", "G3", "C4"]].forEach((acorde, i) => {
        const x = t + i * 1.4;
        acordeSombrio(x, N(...acorde), 1.4, 1);
        timpano(x, nota(["D2", "Bb1", "C2"][i]), 0.45);
        braam(x, nota(["D1", "Bb0", "C1"][i]), 1.3, 0.09);
      });
      rufo(t + 2.8, 1.4, nota("A1"), 0.05, 0.45); riser(t + 2.8, 1.4, 0.12);
      braam(t + 4.2, nota("D1"), 4, 0.17);
      acordeEpico(t + 4.2, N("D4", "F#4", "A4", "D5", "F#5"), 4.5, 1.3);
      boom(t + 4.2, 0.7); prato(t + 4.2, 0.2, 4); brilho(t + 4.2, 0.05, 3);
    },
    vinculo: (t) => {
      // rugido, silêncio com o coração disparando, e a explosão do vínculo
      rugido(t, 78, 1.8, 0.26); boom(t, 0.5);
      [1.2, 1.75, 2.2, 2.55, 2.85].forEach((x, i) => batimento(t + x, 0.25 + i * 0.05));
      harmonico(t + 1.1, nota("D6"), 2, 0.012); sussurro(t + 1.3, 1.4, 0.035); sussurro(t + 1.9, 1.2, 0.03);
      riser(t + 1.6, 1.5, 0.12);
      braam(t + 3.1, nota("D1"), 3.5, 0.18); boom(t + 3.1, 0.7); prato(t + 3.1, 0.2, 4);
      acordeSombrio(t + 3.1, N("D3", "F3", "A3", "D4", "F4", "A4"), 4, 1.3);
      brilho(t + 3.1, 0.04, 3);
    },
    morte: (t) => {
      // o coração desacelera até parar; depois, o sino da lista dos mortos
      [0, 0.85, 1.9, 3.3].forEach((x, i) => batimento(t + x, 0.42 - i * 0.08));
      cluster(t, nota("D2"), { dur: 4.5, vol: 0.03, ataque: 1.5, lib: 3 });
      tom(t, { freq: nota("D1"), dur: 6, vol: 0.12, ataque: 1 });
      sino(t + 4.6, 196, 0.24, 6);
      coro(t + 4.6, N("D3", "F3", "A3"), { dur: 3.5, vol: 0.035, ataque: 1.2, lib: 2.5, vogal: "o" });
    },
    cura: (t) => { coro(t, N("D4", "F4", "A4"), { dur: 1.4, vol: 0.022, ataque: 0.5, lib: 1.4, vogal: "u" }); harmonico(t + 0.2, nota("A5"), 1.5, 0.012); },

    // ---------- itens ----------
    beber: (t) => { for (let i = 0; i < 3; i++) tom(t + i * 0.16, { freq: 320, fim: 160, dur: 0.09, vol: 0.17 }); },
    oleo: (t) => { ruido(t, { freq: 1600, fim: 6000, q: 4, dur: 0.5, vol: 0.11, ataque: 0.05 }); metal(t + 0.5, 1100, 0.06, 1); },
    folha: (t) => { for (let i = 0; i < 4; i++) ruido(t + i * 0.08 + aleatorio(0, 0.03), { freq: 1400, q: 1.5, dur: 0.05, vol: 0.11 }); },

    // ---------- combate ----------
    combate_inicio: (t) => {
      riser(t, 0.55, 0.08);
      ruido(t + 0.1, { tipo: "highpass", freq: 2500, fim: 8000, dur: 0.4, vol: 0.12, ataque: 0.25 });
      braam(t + 0.55, nota("D1"), 1.8, 0.15); metal(t + 0.55, 1100, 0.08, 1.2);
      boom(t + 0.55, 0.5); taiko(t + 0.85, 0.5);
    },
    chefe: (t) => {
      batimento(t, 0.35); batimento(t + 0.6, 0.4);
      harmonico(t, nota("Eb6"), 1.4, 0.015); sussurro(t + 0.2, 1, 0.035);
      braam(t + 1.2, nota("D1"), 3.2, 0.2); braam(t + 1.25, nota("Eb1"), 3, 0.08);
      cluster(t + 1.2, nota("D2"), { dur: 2.6, vol: 0.035, ataque: 0.3 });
      coro(t + 1.2, N("D3", "Eb3", "A3"), { dur: 2.6, vol: 0.04, ataque: 0.6, vogal: "o" });
      taiko(t + 1.2, 0.65); taiko(t + 1.6, 0.6); taiko(t + 2.0, 0.7);
      prato(t + 1.2, 0.14);
    },
    golpe: (t) => { whoosh(t, 600, 2200, 0.13, 0.16); impacto(t + 0.11, 0.35, 200); },
    adaga: (t, pan = aleatorio(-0.4, 0.4)) => {
      whoosh(t, 2000, 5500, 0.09, 0.16, pan - 0.3, pan);
      tom(t + 0.09, { freq: 240, fim: 80, dur: 0.07, vol: 0.3, pan });
      ruido(t + 0.09, { tipo: "highpass", freq: 3000, dur: 0.03, vol: 0.1, pan });
    },
    adagas: (t) => { EFEITOS.adaga(t, -0.6); EFEITOS.adaga(t + 0.11, 0); EFEITOS.adaga(t + 0.22, 0.6); taiko(t + 0.31, 0.3, 80); },
    espada: (t) => { whoosh(t, 800, 3200, 0.16, 0.2, -0.5, 0.4); metal(t + 0.13, 820, 0.1, 0.7); impacto(t + 0.13, 0.32, 150); },
    espada_pesada: (t) => {
      whoosh(t, 350, 2400, 0.34, 0.28, -0.7, 0.5);
      metal(t + 0.32, 580, 0.13, 1.2); boom(t + 0.32, 0.55); taiko(t + 0.32, 0.5);
      braam(t + 0.32, nota("D2"), 0.7, 0.07);
    },
    soco: (t, pan) => impacto(t, 0.5, 140, pan),
    combo: (t) => { EFEITOS.soco(t, -0.3); EFEITOS.soco(t + 0.13, 0.3); taiko(t + 0.13, 0.35, 75); },
    analise: (t) => { harmonico(t, nota("A5"), 0.9, 0.015); sussurro(t, 0.6, 0.025); EFEITOS.golpe(t + 0.25); },
    critico: (t) => { metal(t + 0.05, 1600, 0.09, 1.3); boom(t + 0.05, 0.45); braam(t + 0.05, nota("D2"), 0.8, 0.08); prato(t + 0.05, 0.07, 1.4); },
    esquiva: (t) => whoosh(t, 1400, 420, 0.3, 0.16, -0.8, 0.8),
    dano_recebido: (t) => { impacto(t, 0.6, 85); boom(t, 0.35); cluster(t, nota("D3"), { dur: 0.3, vol: 0.03, ataque: 0.01, lib: 0.6 });
                            batimento(t + 0.3, 0.3); },
    defender: (t) => { metal(t, 380, 0.14, 1); taiko(t, 0.4, 85); },
    fuga: (t) => { for (let i = 0; i < 5; i++) ruido(t + i * 0.12, { tipo: "lowpass", freq: 700, dur: 0.06, vol: 0.2, pan: i % 2 ? 0.3 : -0.3 });
                   batimento(t, 0.25); batimento(t + 0.4, 0.25); whoosh(t + 0.5, 1200, 400, 0.3, 0.1, 0, 0.9); },
    veneno: (t) => { for (let i = 0; i < 6; i++) tom(t + i * 0.07 + aleatorio(0, 0.03), { freq: aleatorio(300, 800), fim: aleatorio(800, 1300), dur: 0.05, vol: 0.055, filtro: { freq: 2200 }, pan: aleatorio(-0.5, 0.5) });
                     sussurro(t, 0.6, 0.02); },
    queimadura: (t) => { ruido(t, { tipo: "highpass", freq: 4000, dur: 0.55, vol: 0.09, ataque: 0.05 }); ruido(t, { tipo: "lowpass", freq: 300, dur: 0.6, vol: 0.12, ataque: 0.1 }); },
    atordoado: (t) => [1300, 1700, 1300, 1700].forEach((f, i) => tom(t + i * 0.09, { freq: f, dur: 0.08, vol: 0.045, vibrato: { freq: 18, prof: 40 }, pan: i % 2 ? 0.4 : -0.4 })),

    // ---------- sinetes e dragão ----------
    relampago: (t) => {
      riser(t, 0.35, 0.07);
      ruido(t + 0.35, { tipo: "highpass", freq: 1200, dur: 0.07, vol: 0.7 });
      tom(t + 0.35, { freq: 2400, fim: 150, tipo: "sawtooth", dur: 0.1, vol: 0.1 });
      boom(t + 0.35, 0.7);
      ruido(t + 0.4, { tipo: "lowpass", freq: 420, fim: 60, dur: 2.6, vol: 0.55, ataque: 0.02, pan: -0.5 });
      ruido(t + 0.53, { tipo: "lowpass", freq: 300, fim: 55, dur: 2.4, vol: 0.45, ataque: 0.08, pan: 0.5 });
      prato(t + 0.35, 0.1, 2);
    },
    sombras: (t) => {
      pratoReverso(t, 0.8, 0.08); sussurro(t, 1.2, 0.05); sussurro(t + 0.2, 1, 0.04);
      cluster(t, nota("D2"), { dur: 1.2, vol: 0.04, ataque: 0.5, lib: 1.2 });
      coro(t, N("D3", "Eb3", "Ab3"), { dur: 1, vol: 0.035, ataque: 0.5, lib: 1.2, vogal: "u" });
      braam(t + 0.8, nota("D1"), 1.6, 0.1); boom(t + 0.8, 0.4);
    },
    gelo: (t) => {
      for (let i = 0; i < 16; i++) tom(t + aleatorio(0, 0.6), { freq: aleatorio(2200, 5600), dur: aleatorio(0.15, 0.5), vol: 0.03, pan: aleatorio(-0.9, 0.9) });
      ruido(t, { tipo: "highpass", freq: 6500, dur: 0.8, vol: 0.07, ataque: 0.1 });
      harmonico(t, nota("Eb6"), 1, 0.015);
      metal(t + 0.55, 850, 0.08, 1.3); boom(t + 0.55, 0.4);
    },
    mente: (t) => {
      sussurro(t, 1.2, 0.045); sussurro(t + 0.3, 1, 0.035);
      coro(t, N("A3", "E4", "Bb4"), { dur: 1.1, vol: 0.028, ataque: 0.4, lib: 1.4, vogal: "u" });
      harmonico(t, nota("E6"), 1.4, 0.016);
    },
    dragao: (t) => { rugido(t, 88, 1.4, 0.26); braam(t, nota("D1"), 1.4, 0.08); boom(t, 0.5); fogo(t + 0.9, 1.2, 0.3); taiko(t + 0.9, 0.4); },
    explosao: (t) => {
      pratoReverso(t, 0.5, 0.1);
      boom(t + 0.5, 0.75); taiko(t + 0.5, 0.6, 50); braam(t + 0.5, nota("D1"), 1.4, 0.1);
      ruido(t + 0.5, { tipo: "lowpass", freq: 1800, fim: 120, dur: 1.4, vol: 0.5, pan: -0.4 });
      ruido(t + 0.55, { tipo: "lowpass", freq: 1500, fim: 100, dur: 1.3, vol: 0.45, pan: 0.4 });
      fogo(t + 0.55, 0.9, 0.22); prato(t + 0.5, 0.12, 2);
    },
    tremor: (t) => {
      for (let i = 0; i < 6; i++) taiko(t + i * 0.09, 0.25 + i * 0.05, 40 + i * 3, undefined, i % 2 ? 0.3 : -0.3);
      ruido(t, { tipo: "lowpass", freq: 140, dur: 1.6, vol: 0.55, ataque: 0.2 });
      for (let i = 0; i < 10; i++) ruido(t + 0.2 + Math.random(), { tipo: "bandpass", freq: aleatorio(600, 1800), q: 2, dur: 0.05, vol: 0.12, pan: aleatorio(-0.8, 0.8) });
      boom(t + 0.55, 0.6); braam(t + 0.55, nota("D1"), 1.2, 0.09);
    },
    tempo: (t) => {
      // tique-taque desacelerando, silêncio absoluto e o mundo parado
      let x = t;
      for (let i = 0; i < 7; i++) { tique(x, 0.06, undefined, i % 2 === 0); x += 0.1 + i * 0.06; }
      tom(x, { freq: 1200, fim: 200, dur: 0.6, vol: 0.05, vibrato: { freq: 9, prof: 30 } });
      coro(x + 0.3, N("D4", "A4", "Eb5"), { dur: 1.4, vol: 0.03, ataque: 0.5, lib: 2, vogal: "u" });
      harmonico(x + 0.3, nota("D6"), 1.8, 0.015); sino(x + 0.3, nota("D5"), 0.05, 2.5);
    },

    // ---------- inimigos ----------
    furia: (t) => { rugido(t, 140, 0.9, 0.2); braam(t, nota("Eb1"), 1, 0.09); taiko(t, 0.45); taiko(t + 0.3, 0.45); },
    fogo_inimigo: (t) => { tom(t, { freq: 700, fim: 260, tipo: "sawtooth", dur: 0.5, vol: 0.06, filtro: { freq: 2000 } }); fogo(t + 0.15, 0.9, 0.24); },
    dreno: (t) => {
      tom(t, { freq: 440, fim: 100, dur: 1.4, vol: 0.08, ataque: 0.1, vibrato: { freq: 7, prof: 10 } });
      sussurro(t, 1.2, 0.04); coro(t, N("A3", "Eb3"), { dur: 1, vol: 0.03, ataque: 0.3, lib: 1, vogal: "u" });
      ruido(t, { tipo: "lowpass", freq: 1200, fim: 150, dur: 1.3, vol: 0.15, ataque: 0.2 });
      batimento(t + 0.6, 0.3);
    },

    // ---------- resultado ----------
    vitoria: (t) => {
      // bVI – bVII – i: heroico, mas sem perder a sombra
      metais(t, nota("Bb3"), 0.16, 0.06); metais(t + 0.18, nota("C4"), 0.16, 0.06);
      acordeSombrio(t + 0.36, [nota("D3"), ...quinta(nota("D4"))], 1.8, 1.1);
      braam(t + 0.36, nota("D1"), 1.6, 0.1);
      timpano(t + 0.36, nota("D2"), 0.5); prato(t + 0.36, 0.14);
    },
    derrota: (t) => {
      cluster(t, nota("D3"), { dur: 1.4, vol: 0.04, ataque: 0.1 });
      cordas(t + 0.6, N("F3"), { dur: 0.6, vol: 0.05, ataque: 0.1 });
      cordas(t + 1.2, N("D3", "A2"), { dur: 1.8, vol: 0.05, ataque: 0.1, lib: 2 });
      coro(t + 1.2, N("D3", "F3"), { dur: 1.8, vol: 0.03, ataque: 0.6, vogal: "o" });
      braam(t + 1.2, nota("D1"), 2.2, 0.12); boom(t + 1.2, 0.55);
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

  /* --------------------------------------------------------- configuração */
  function definir(novo) {
    Object.assign(config, novo);
    try { localStorage.setItem(CHAVE, JSON.stringify(config)); } catch (_) { /* sem storage */ }
    if (!ctx) return;
    const t = agora();
    master.gain.setTargetAtTime(config.volume, t, 0.05);
    busEfeitos.gain.setTargetAtTime(config.efeitos ? 1 : 0, t, 0.05);
    busSeco.gain.setTargetAtTime(config.efeitos ? 1 : 0, t, 0.05);
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

  return { tocar, tocarSequencia, definir, config, efeitos: Object.keys(EFEITOS) };
})();
