from __future__ import annotations


# =====================================================
# CLASSE ITEM
# =====================================================
class Item:
    """Item genérico. Subclasses sobrescrevem `usar()` (polimorfismo)."""

    descricao = ""
    usavel_em_combate = True
    apenas_em_combate = False
    som = "beber"

    def __init__(self, nome: str, valor: int):
        self.nome = nome
        self.valor = valor

    @property
    def tipo(self) -> str:
        return self.__class__.__name__

    def usar(self, cadete) -> str:
        return f"{self.nome} não pode ser usado."

    def util_para(self, cadete) -> bool:
        """Se usar o item agora teria algum efeito (evita desperdício)."""
        return True

    def to_dict(self) -> dict:
        return {"tipo": self.tipo, "nome": self.nome, "valor": self.valor}

    def __repr__(self):
        return f"<Item: {self.nome}, Valor: {self.valor}>"


# =====================================================
# CLASSE INVENTÁRIO
# =====================================================
class Inventario:
    """Inventário de um cadete. Guarda itens e permite adicionar/remover."""

    def __init__(self):
        self.itens: list[Item] = []

    def adicionar_item(self, item: Item):
        self.itens.append(item)

    def remover_item(self, item: Item):
        if item in self.itens:
            self.itens.remove(item)

    def listar_itens(self) -> list[Item]:
        return self.itens

    def esta_vazio(self) -> bool:
        return len(self.itens) == 0

    def agrupado(self) -> list[tuple[Item, int]]:
        """Itens agrupados por tipo: [(exemplo, quantidade), ...]."""
        grupos: dict[str, list[Item]] = {}
        for item in self.itens:
            grupos.setdefault(item.tipo, []).append(item)
        return [(lista[0], len(lista)) for lista in grupos.values()]

    def pegar_por_tipo(self, tipo: str) -> Item | None:
        return next((i for i in self.itens if i.tipo == tipo), None)
