from __future__ import annotations
from models.itens import TonicoCurativo, ElixirDeVigor, OleoDeLamina, FolhaDeSalgueiro
from models.equipamentos import AdagasAfiadas, ArmaduraDeEscamas

# Registro de itens por nome de classe (usado para salvar/carregar e nas recompensas)
ITENS = {cls.__name__: cls for cls in (
    TonicoCurativo, ElixirDeVigor, OleoDeLamina, FolhaDeSalgueiro,
    AdagasAfiadas, ArmaduraDeEscamas,
)}


def criar_item(tipo: str | None):
    cls = ITENS.get(tipo or "")
    return cls() if cls else None
