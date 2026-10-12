from __future__ import annotations
from models.inventario import Item


class Equipamento(Item):
    """Item que, ao ser usado, é equipado permanentemente no cadete."""

    usavel_em_combate = False
    som = "equipar"
    bonus_ataque = 0
    bonus_defesa = 0

    def __init__(self, nome: str):
        super().__init__(nome, 0)

    def usar(self, cadete) -> str:
        if any(e.tipo == self.tipo for e in cadete.equipamentos):
            return f"Você já está equipado com {self.nome}."
        cadete.equipamentos.append(self)
        return f"Você equipou {self.nome} ({self.resumo()})."

    def resumo(self) -> str:
        partes = []
        if self.bonus_ataque:
            partes.append(f"+{self.bonus_ataque} ATQ")
        if self.bonus_defesa:
            partes.append(f"+{self.bonus_defesa} DEF")
        return ", ".join(partes)


class AdagasAfiadas(Equipamento):
    descricao = "Lâminas finas, balanceadas para arremesso. +3 de ataque."
    bonus_ataque = 3

    def __init__(self):
        super().__init__("Adagas Balanceadas")


class ArmaduraDeEscamas(Equipamento):
    descricao = "Couro reforçado com escamas de dragão. Quase nada a atravessa. +5 de defesa."
    bonus_defesa = 5

    def __init__(self):
        super().__init__("Armadura de Escamas de Dragão")
