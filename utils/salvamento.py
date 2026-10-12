from __future__ import annotations
import json
import os
import re
from datetime import datetime


class RepositorioJogo:
    """Repositório responsável por SALVAR e CARREGAR o progresso em JSON.

    Não conhece a interface: recebe/devolve dicionários montados pelo `Jogo`.
    """

    def __init__(self, pasta="saves"):
        self.pasta = pasta
        os.makedirs(self.pasta, exist_ok=True)
        self.ultimo_save: str | None = None

    @staticmethod
    def normalizar_nome(nome: str) -> str:
        """Mantém só letras, números, '-' e '_' (impede caminhos como '../')."""
        nome = re.sub(r"[^\w\-]+", "_", nome.strip(), flags=re.UNICODE).strip("_")
        return nome[:40] or "meu_jogo"

    def _caminho(self, nome: str) -> str:
        return os.path.join(self.pasta, f"{self.normalizar_nome(nome)}.json")

    # =========================================================
    #                      SALVAR
    # =========================================================
    def salvar(self, nome: str, dados: dict) -> str:
        caminho = self._caminho(nome)
        dados = dict(dados, salvo_em=datetime.now().isoformat(timespec="seconds"))
        with open(caminho, "w", encoding="utf-8") as arq:
            json.dump(dados, arq, indent=4, ensure_ascii=False)
        self.ultimo_save = caminho
        return caminho

    # =========================================================
    #                      CARREGAR
    # =========================================================
    def carregar(self, nome: str) -> dict:
        caminho = self._caminho(nome)
        with open(caminho, "r", encoding="utf-8") as f:
            dados = json.load(f)
        self.ultimo_save = caminho
        return dados

    def listar(self) -> list[dict]:
        """Saves compatíveis, do mais recente para o mais antigo."""
        saves = []
        if not os.path.isdir(self.pasta):
            return saves
        for arquivo in os.listdir(self.pasta):
            if not arquivo.endswith(".json"):
                continue
            caminho = os.path.join(self.pasta, arquivo)
            try:
                with open(caminho, "r", encoding="utf-8") as f:
                    dados = json.load(f)
            except (OSError, ValueError):
                continue
            resumo = self.resumo_save(arquivo[:-5], dados)
            if resumo:
                saves.append(resumo)
        saves.sort(key=lambda s: s["data"], reverse=True)
        return saves

    @staticmethod
    def resumo_save(nome: str, dados: dict) -> dict | None:
        """Resumo exibido na tela de carregar (None para saves antigos/corrompidos)."""
        try:
            cad = dados["cadete"]
        except (KeyError, TypeError):
            return None
        cap = "campanha concluída" if dados.get("campanha_concluida") else f"capítulo {dados.get('capitulo', 1)}"
        return {
            "nome": nome,
            "data": dados.get("salvo_em", ""),
            "resumo": f"{cad.get('nome')} · nível {cad.get('nivel', 1)} · {cap} · "
                      f"{dados.get('salvo_em', '').replace('T', ' ')}",
        }


repo = RepositorioJogo()
