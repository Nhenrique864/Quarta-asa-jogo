from __future__ import annotations
import random


def calcular_dano(base: float, defesa: float, perfuracao: float = 0.0) -> int:
    """Dano com variação aleatória e mitigação proporcional pela defesa.

    `perfuracao` (0 a 1) ignora parte da defesa do alvo.
    """
    defesa_efetiva = max(0.0, defesa * (1 - perfuracao))
    bruto = base * random.uniform(0.85, 1.15)
    return max(1, round(bruto * 20 / (20 + defesa_efetiva)))


class Combatente:
    """Base comum de Cadete e Inimigo: vida, ataque, defesa e efeitos de status."""

    def __init__(self, nome: str, vida: int, ataque: int, defesa: int):
        self.nome = nome
        self.vida = vida
        self.vida_max = vida
        self.ataque = ataque
        self.defesa = defesa
        self.efeitos: dict[str, int] = {}

    # -------------------- vida --------------------
    def esta_vivo(self) -> bool:
        return self.vida > 0

    def receber_dano(self, dano: int) -> int:
        dano = max(0, int(dano))
        self.vida = max(0, self.vida - dano)
        return dano

    def curar(self, quantidade: int) -> int:
        antes = self.vida
        self.vida = min(self.vida_max, self.vida + int(quantidade))
        return self.vida - antes

    # -------------------- atributos efetivos --------------------
    @property
    def ataque_total(self) -> int:
        return self.ataque

    @property
    def defesa_total(self) -> int:
        return self.defesa

    # -------------------- efeitos de status --------------------
    def aplicar_efeito(self, nome: str, turnos: int) -> None:
        self.efeitos[nome] = max(self.efeitos.get(nome, 0), turnos)

    def tem_efeito(self, nome: str) -> bool:
        return self.efeitos.get(nome, 0) > 0

    def passar_turno_efeitos(self) -> list[str]:
        """Aplica efeitos contínuos (veneno, queimadura) e reduz a duração."""
        msgs = []
        if self.tem_efeito("veneno"):
            dano = self.receber_dano(max(3, self.vida_max // 20))
            msgs.append(f"☠ {self.nome} sofre {dano} de dano do veneno.")
        if self.tem_efeito("queimadura"):
            dano = self.receber_dano(max(4, self.vida_max // 16))
            msgs.append(f"🔥 {self.nome} queima e perde {dano} de vida.")
        for k in list(self.efeitos):
            self.efeitos[k] -= 1
            if self.efeitos[k] <= 0:
                del self.efeitos[k]
        return msgs

    def limpar_efeitos(self) -> None:
        self.efeitos.clear()

    def barra_hp(self, largura: int = 20) -> str:
        v = max(0, self.vida)
        vmax = max(1, self.vida_max)
        cheio = int(largura * v / vmax)
        return "[" + "#" * cheio + "-" * (largura - cheio) + f"] {v}/{vmax}"


def rolar(chance: float) -> bool:
    return random.random() < chance
