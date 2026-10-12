from __future__ import annotations
from models.base import rolar

REGEN_PODER_TURNO = 4
RECARGA_DRAGAO = 3


class Combate:
    """Motor de combate por turnos, independente da interface (terminal ou web)."""

    def __init__(self, cadete, inimigo, permite_dragao=True, permite_fuga=False):
        self.cadete = cadete
        self.inimigo = inimigo
        self.permite_dragao = permite_dragao and cadete.dragao is not None
        self.permite_fuga = permite_fuga
        self.turno = 1
        self.recarga_dragao = 0
        self.terminado = False
        self.vitoria: bool | None = None
        self.fugiu = False
        self.log: list[str] = [f"⚔ {inimigo.nome} entra em combate!"]
        self.sons: list[str] = []

    # ---------------------------------------------------------
    #   AÇÕES DISPONÍVEIS
    # ---------------------------------------------------------
    def acoes(self) -> list[dict]:
        c = self.cadete
        lista = [
            {"id": "atacar", "rotulo": "Atacar", "dica": "Ataque básico."},
            {"id": "habilidade", "rotulo": f"{c.nome_habilidade} ({c.custo_habilidade} poder)",
             "dica": c.descricao_habilidade, "desabilitada": not c.pode_usar_habilidade()},
        ]
        if c.dragao:
            s = c.dragao.sinete
            lista.append({"id": "sinete", "rotulo": f"Sinete: {s.nome} ({s.custo} poder)",
                          "dica": s.descricao, "desabilitada": not c.pode_usar_sinete()})
        if self.permite_dragao:
            rotulo = f"Chamar {c.dragao.nome}"
            if self.recarga_dragao:
                rotulo += f" (recarga: {self.recarga_dragao})"
            lista.append({"id": "dragao", "rotulo": rotulo, "dica": "Sopro de fogo do seu dragão.",
                          "desabilitada": self.recarga_dragao > 0})
        lista.append({"id": "defender", "rotulo": "Defender",
                      "dica": "Reduz à metade o próximo dano e recupera 15 de poder."})
        lista.append({"id": "itens", "rotulo": "Usar item",
                      "desabilitada": not any(i.usavel_em_combate for i in c.inventario.itens)})
        if self.permite_fuga:
            lista.append({"id": "fugir", "rotulo": "Fugir", "dica": "Abandonar o treino."})
        return lista

    # ---------------------------------------------------------
    #   EXECUÇÃO DE UM TURNO
    # ---------------------------------------------------------
    def executar(self, acao: str, item=None) -> list[str]:
        """Executa um turno. Também preenche `self.sons` com os efeitos sonoros do turno
        (na ordem em que acontecem; "|" marca uma pausa entre jogador e inimigo)."""
        self.sons = []
        if self.terminado:
            return []
        c, ini = self.cadete, self.inimigo
        msgs: list[str] = []
        efeitos_antes = set(ini.efeitos)

        if acao in ("atacar", "habilidade") and ini.esquiva and rolar(ini.esquiva):
            if acao == "habilidade":
                c.poder -= c.custo_habilidade
            msgs.append(f"{ini.nome} desvia no último instante. Você erra!")
            self.sons.append("esquiva")
        elif acao == "atacar":
            msgs += c.atacar(ini)
            self.sons.append(c.som_ataque)
        elif acao == "habilidade":
            if not c.pode_usar_habilidade():
                return ["Poder insuficiente."]
            msgs += c.usar_habilidade(ini)
            self.sons.append(c.som_habilidade)
        elif acao == "sinete":
            if not c.pode_usar_sinete():
                return ["Poder insuficiente."]
            msgs += c.usar_sinete(ini)
            self.sons.append(c.dragao.sinete.som)
        elif acao == "dragao":
            if not self.permite_dragao or self.recarga_dragao:
                return ["Seu dragão não pode ajudar agora."]
            msgs += c.dragao.soprar(ini)
            self.recarga_dragao = RECARGA_DRAGAO + 1
            self.sons.append("dragao")
        elif acao == "defender":
            c.aplicar_efeito("defendendo", 1)
            c.recuperar_poder(15)
            msgs.append("🛡 Você assume postura defensiva e recupera o fôlego.")
            self.sons.append("defender")
        elif acao == "item" and item is not None:
            msgs.append(c.usar_item(item))
            self.sons.append(item.som)
        elif acao == "fugir" and self.permite_fuga:
            if rolar(0.6 + c.agilidade_total * 0.02):
                msgs.append("Você recua e encerra o combate.")
                self.terminado, self.fugiu, self.vitoria = True, True, False
                self.sons.append("fuga")
                return self._registrar(msgs)
            msgs.append("Você tenta recuar, mas não consegue!")
            self.sons.append("erro")
        else:
            return ["Ação inválida."]

        if any("CRÍTICO" in m for m in msgs):
            self.sons.append("critico")
        for efeito in ("veneno", "atordoado"):
            if efeito in ini.efeitos and efeito not in efeitos_antes:
                self.sons.append(efeito)

        if not ini.esta_vivo():
            return self._encerrar(msgs, vitoria=True)

        # ---- turno do inimigo ----
        self.sons.append("|")
        vida_antes = c.vida
        if ini.tem_efeito("atordoado"):
            msgs.append(f"{ini.nome} está atordoado e não consegue agir.")
            self.sons.append("atordoado")
        else:
            ini.som_turno = None
            msgs_inimigo = ini.agir(c)
            msgs += msgs_inimigo
            if ini.som_turno:
                self.sons.append(ini.som_turno)
            if c.vida < vida_antes:
                self.sons.append("dano_recebido")
            elif any("esquiva" in m or "erra" in m for m in msgs_inimigo):
                self.sons.append("esquiva")

        # dano contínuo (veneno/queimadura) no inimigo e no cadete
        for efeito in ("veneno", "queimadura"):
            if ini.tem_efeito(efeito) or c.tem_efeito(efeito):
                self.sons.append(efeito)
        msgs += ini.passar_turno_efeitos()
        if not ini.esta_vivo():
            return self._encerrar(msgs, vitoria=True)

        msgs += c.passar_turno_efeitos()
        if not c.esta_vivo():
            return self._encerrar(msgs, vitoria=False)

        c.recuperar_poder(REGEN_PODER_TURNO)
        self.recarga_dragao = max(0, self.recarga_dragao - 1)
        self._registrar(msgs)
        self.turno += 1
        return msgs

    def _encerrar(self, msgs, vitoria: bool) -> list[str]:
        self.terminado, self.vitoria = True, vitoria
        self.sons += ["|", "vitoria" if vitoria else "derrota"]
        if vitoria:
            msgs.append(f"🏆 {self.inimigo.nome} foi derrotado!")
        else:
            msgs.append("💀 Você cai e o mundo escurece...")
        self.cadete.buff_ataque = 0
        self.cadete.efeitos.pop("defendendo", None)
        return self._registrar(msgs)

    def _registrar(self, msgs: list[str]) -> list[str]:
        self.log.append(f"— Turno {self.turno} —")
        self.log.extend(msgs)
        return msgs

    def to_dict(self) -> dict:
        return {"inimigo": self.inimigo.to_dict(), "turno": self.turno,
                "log": self.log[-14:], "terminado": self.terminado, "vitoria": self.vitoria}
