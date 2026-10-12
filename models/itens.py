from __future__ import annotations
from models.inventario import Item


class TonicoCurativo(Item):
    descricao = "Preparado pelos curandeiros de Basgiath. Recupera 35 de vida."

    def __init__(self):
        super().__init__("Tônico dos Curandeiros", 35)

    def usar(self, cadete) -> str:
        cura = cadete.curar(self.valor)
        return f"Você bebe o {self.nome} e recupera {cura} de vida."

    def util_para(self, cadete) -> bool:
        return cadete.vida < cadete.vida_max


class ElixirDeVigor(Item):
    descricao = "Raiz amarga que reacende o corpo. Recupera 30 de poder."

    def __init__(self):
        super().__init__("Elixir de Vigor", 30)

    def usar(self, cadete) -> str:
        antes = cadete.poder
        cadete.poder = min(cadete.poder_max, cadete.poder + self.valor)
        return f"Você toma o {self.nome} e recupera {cadete.poder - antes} de poder."

    def util_para(self, cadete) -> bool:
        return cadete.poder < cadete.poder_max


class OleoDeLamina(Item):
    descricao = "Óleo para afiar lâminas. +6 de ataque até o fim do combate."
    apenas_em_combate = True
    som = "oleo"

    def __init__(self):
        super().__init__("Óleo de Lâmina", 6)

    def usar(self, cadete) -> str:
        cadete.buff_ataque += self.valor
        return f"Você passa {self.nome} nas armas: +{self.valor} de ataque neste combate."


class FolhaDeSalgueiro(Item):
    descricao = "Mastigar a folha amortece a dor. Remove veneno e queimaduras e cura 15."
    som = "folha"

    def __init__(self):
        super().__init__("Folha de Salgueiro", 15)

    def usar(self, cadete) -> str:
        cadete.limpar_efeitos()
        cura = cadete.curar(self.valor)
        return f"A dor recua: efeitos negativos removidos e +{cura} de vida."

    def util_para(self, cadete) -> bool:
        return cadete.vida < cadete.vida_max or any(k in cadete.efeitos for k in ("veneno", "queimadura"))
