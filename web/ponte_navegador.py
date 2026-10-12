"""Ponte entre o front web e o motor do jogo rodando no navegador (Pyodide).

Usada na versão publicada no GitHub Pages: não há servidor, então o próprio
navegador executa o Python do jogo. Os saves ficam no localStorage de cada jogador.
"""
from __future__ import annotations
import json
from datetime import datetime

from js import localStorage  # disponível apenas dentro do Pyodide

from utils import salvamento


class RepositorioNavegador(salvamento.RepositorioJogo):
    """Mesmo contrato do RepositorioJogo, mas gravando no localStorage."""

    PREFIXO = "quarta-asa-save:"

    def __init__(self):  # não cria pasta no disco
        self.pasta = "navegador"
        self.ultimo_save: str | None = None

    def salvar(self, nome: str, dados: dict) -> str:
        nome = self.normalizar_nome(nome)
        dados = dict(dados, salvo_em=datetime.now().isoformat(timespec="seconds"))
        localStorage.setItem(self.PREFIXO + nome, json.dumps(dados, ensure_ascii=False))
        self.ultimo_save = nome
        return f"navegador ({nome})"

    def carregar(self, nome: str) -> dict:
        bruto = localStorage.getItem(self.PREFIXO + self.normalizar_nome(nome))
        if bruto is None:
            raise OSError("save não encontrado neste navegador")
        self.ultimo_save = nome
        return json.loads(bruto)

    def listar(self) -> list[dict]:
        saves = []
        for i in range(localStorage.length):
            chave = localStorage.key(i)
            if not chave or not chave.startswith(self.PREFIXO):
                continue
            try:
                dados = json.loads(localStorage.getItem(chave))
            except (TypeError, ValueError):
                continue
            resumo = self.resumo_save(chave[len(self.PREFIXO):], dados)
            if resumo:
                saves.append(resumo)
        saves.sort(key=lambda s: s["data"], reverse=True)
        return saves


# O Jogo lê salvamento.repo ao ser criado, então a troca precisa vir antes.
salvamento.repo = RepositorioNavegador()

from models.jogo import Jogo  # noqa: E402
from models.dragao import DRAGOES  # noqa: E402

IMAGENS_DRAGOES = {chave: f"static/dragoes/{chave}.webp" for chave in DRAGOES}

_jogo = Jogo()


def _resposta(com_sons: bool) -> str:
    estado = _jogo.estado()
    estado["opcoes"] = [o for o in estado["opcoes"] if not o.get("terminal")]
    sons = _jogo.consumir_sons()
    estado["sons"] = sons if com_sons else []
    estado["imagens_dragoes"] = IMAGENS_DRAGOES
    return json.dumps(estado, ensure_ascii=False)


def estado() -> str:
    return _resposta(com_sons=False)


def agir(op_id, texto=None) -> str:
    _jogo.agir(str(op_id), None if texto is None else str(texto)[:200])
    return _resposta(com_sons=True)
