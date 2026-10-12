"""Interface de terminal (View): só desenha `jogo.estado()` e repassa a escolha para `jogo.agir()`."""
from __future__ import annotations
import textwrap

LARGURA = 78


def _barra(atual: int, maximo: int, largura: int = 20) -> str:
    cheio = int(largura * max(0, atual) / max(1, maximo))
    return "[" + "#" * cheio + "-" * (largura - cheio) + f"] {atual}/{maximo}"


def _paragrafo(texto: str, recuo: str = "") -> None:
    print(textwrap.fill(texto, LARGURA, initial_indent=recuo, subsequent_indent=recuo) if texto else "")


def desenhar(estado: dict) -> None:
    print("\n" + "=" * LARGURA)
    titulo = estado["titulo"].upper()
    if estado.get("subtitulo"):
        titulo += f"  —  {estado['subtitulo']}"
    print(titulo)
    print("=" * LARGURA)

    d = estado.get("dragao_apresentado")
    if d:
        moldura = "~" * LARGURA
        print(moldura)
        print(f"  🐉 {d['nome'].upper()}  —  dragão {d['cor'].lower()}, {d['raca']}".center(LARGURA))
        print(moldura)
        _paragrafo(d["descricao"], "  ")
        print(f"  Bônus do vínculo: {', '.join(d['bonus'])}")
        print(f"  Sinete: {d['sinete']} ({d['sinete_custo']} de poder): {d['sinete_descricao']}")
        print(f"  Sopro de fogo: {d['sopro']} de dano base")
        print(moldura)

    c = estado.get("cadete")
    if c and estado["tela"] in ("combate", "pos_combate", "hub", "narrativa"):
        print(f"{c['nome']} ({c['arquetipo']}, nv {c['nivel']})  "
              f"Vida {_barra(c['vida'], c['vida_max'], 14)}  Poder {_barra(c['poder'], c['poder_max'], 8)}")

    cb = estado.get("combate")
    if cb:
        ini = cb["inimigo"]
        efeitos = ", ".join(ini["efeitos"]) if ini["efeitos"] else ""
        print(f"{ini['nome']:<{len(c['nome']) + 2}} Vida {_barra(ini['vida'], ini['vida_max'], 14)}"
              + (f"  [{efeitos}]" if efeitos else ""))
        print("-" * LARGURA)
        for linha in cb["log"][-8:]:
            _paragrafo(linha, "  ")
        print("-" * LARGURA)
    elif estado["texto"]:
        print()

    if estado["tela"] != "combate" or not cb:
        for t in estado["texto"]:
            if estado.get("monoespacado"):
                print("- " + t)
            else:
                _paragrafo(t)
                print()

    for d in estado.get("destaque", []):
        _paragrafo(d, "  » ")
    for m in estado.get("mensagens", []):
        _paragrafo(m, "  ! ")

    print()
    for o in estado["opcoes"]:
        if o.get("entrada"):
            continue
        marca = " (indisponível)" if o.get("desabilitada") else ""
        print(f"[{o['tecla']}] {o['rotulo']}{marca}")
        if o.get("dica"):
            _paragrafo(o["dica"], "      ")


def executar(jogo) -> None:
    while not jogo.encerrado:
        estado = jogo.estado()
        desenhar(estado)
        opcoes = {o["tecla"]: o for o in estado["opcoes"]}
        entrada = estado.get("entrada")
        try:
            if entrada:
                padrao = f"Enter = '{entrada['valor']}', " if entrada.get("valor") else ""
                valor = input(f"\n{entrada['rotulo']} ({padrao}0 = voltar): ").strip()
                if valor in opcoes and not opcoes[valor].get("entrada"):
                    jogo.agir(opcoes[valor]["id"])  # atalhos como "0" (voltar) ou "2" (salvar rápido)
                else:
                    envio = next(o for o in estado["opcoes"] if o.get("entrada"))
                    jogo.agir(envio["id"], valor or entrada.get("valor", ""))
                continue
            escolha = input("> ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\nAté logo!")
            return
        if escolha in opcoes:
            jogo.agir(opcoes[escolha]["id"])
        else:
            jogo.mensagens = ["Opção inválida. Tente novamente."]
    print("Até logo!")
