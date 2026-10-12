from __future__ import annotations
from models.base import Combatente, calcular_dano, rolar


class Inimigo(Combatente):
    """Base dos inimigos. Subclasses sobrescrevem `agir()` (polimorfismo)."""

    descricao = ""
    chefe = False

    def __init__(self, nome, vida, ataque, defesa, nome_ataque, xp, esquiva=0.0):
        super().__init__(nome, vida, ataque, defesa)
        self.nome_ataque = nome_ataque
        self.xp = xp
        self.esquiva = esquiva
        self.turnos_agidos = 0
        self.som_turno: str | None = None  # som de um ataque especial neste turno

    def escalar(self, fator: float, fator_xp: float = 1.0) -> "Inimigo":
        self.vida = self.vida_max = int(self.vida_max * fator)
        self.ataque = int(self.ataque * fator)
        self.defesa = int(self.defesa * fator)
        self.xp = int(self.xp * fator_xp)
        return self

    def golpear(self, alvo, multiplicador=1.0, nome_ataque=None, perfuracao=0.0) -> tuple[int, list[str]]:
        """Ataque contra o cadete, considerando cegueira, esquiva e defesa."""
        nome_ataque = nome_ataque or self.nome_ataque
        if self.tem_efeito("cego") and rolar(0.45):
            return 0, [f"{self.nome} tenta {nome_ataque}, mas não enxerga você nas sombras e erra."]
        if rolar(alvo.chance_esquiva):
            return 0, [f"Você se esquiva de {nome_ataque} de {self.nome}!"]
        base = self.ataque * multiplicador
        if alvo.tem_efeito("defendendo"):
            base *= 0.5
        dano = alvo.receber_dano(calcular_dano(base, alvo.defesa_total, perfuracao))
        return dano, [f"{self.nome} usa {nome_ataque} e causa {dano} de dano."]

    def agir(self, alvo) -> list[str]:
        self.turnos_agidos += 1
        return self.golpear(alvo)[1]

    def to_dict(self) -> dict:
        return {"nome": self.nome, "vida": self.vida, "vida_max": self.vida_max,
                "descricao": self.descricao, "chefe": self.chefe,
                "efeitos": dict(self.efeitos)}


# ===========================================================
#   INIMIGOS DE BASGIATH
# ===========================================================
class CandidatoDesesperado(Inimigo):
    descricao = "Um candidato apavorado no meio do Parapeito, disposto a tudo para chegar ao outro lado."

    def __init__(self):
        super().__init__("Candidato Desesperado", 40, 10, 1, "um empurrão", xp=30)


class CadeteRival(Inimigo):
    descricao = "Um primeiro-ano que quer subir na lista do esquadrão às suas custas."

    def __init__(self, nome="Cadete Rival"):
        super().__init__(nome, 70, 15, 3, "um soco no queixo", xp=50)


class CadeteVeterano(Inimigo):
    descricao = "Terceiro-anista experiente. Às vezes encadeia dois golpes."

    def __init__(self, nome="Cadete do Terceiro Ano"):
        super().__init__(nome, 95, 18, 5, "uma estocada", xp=75)

    def agir(self, alvo):
        self.turnos_agidos += 1
        msgs = self.golpear(alvo)[1]
        if alvo.esta_vivo() and rolar(0.3):
            msgs += self.golpear(alvo, 0.6, "um segundo golpe rápido")[1]
        return msgs


class JackBarlowe(Inimigo):
    descricao = "Cruel, enorme e convencido de que os fracos não merecem um dragão. Perde o controle quando ferido."
    chefe = True

    def __init__(self):
        super().__init__("Jack Barlowe", 165, 20, 7, "um golpe de espada", xp=140)
        self.enfurecido = False

    def agir(self, alvo):
        self.turnos_agidos += 1
        msgs = []
        if not self.enfurecido and self.vida < self.vida_max * 0.4:
            self.enfurecido = True
            self.ataque = int(self.ataque * 1.35)
            msgs.append("😡 Jack Barlowe perde o controle! O ataque dele aumenta.")
            self.som_turno = "furia"
        if self.turnos_agidos % 4 == 0:
            msgs += self.golpear(alvo, 1.6, "um golpe brutal com as duas mãos")[1]
        else:
            msgs += self.golpear(alvo)[1]
        return msgs


class CavaleiroDeGrifo(Inimigo):
    descricao = "Um paladino de Poromiel montado num grifo. Ágil e difícil de acertar."

    def __init__(self):
        super().__init__("Paladino de Grifo", 110, 20, 6, "um rasante com as garras do grifo", xp=90, esquiva=0.2)


class CavaleiroPrimeiraAsa(Inimigo):
    descricao = "Um cavaleiro da Primeira Asa e o dragão dele, no exercício de guerra."

    def __init__(self):
        super().__init__("Cavaleiro da Primeira Asa", 150, 23, 8, "uma investida com o dragão", xp=110)

    def agir(self, alvo):
        self.turnos_agidos += 1
        if self.turnos_agidos % 3 == 0:
            self.som_turno = "fogo_inimigo"
            dano, msgs = self.golpear(alvo, 1.4, "fogo de dragão", perfuracao=0.5)
            if dano and rolar(0.4):
                alvo.aplicar_efeito("queimadura", 2)
                msgs.append("Você está queimando.")
            return msgs
        return self.golpear(alvo)[1]


class Wyvern(Inimigo):
    descricao = "Uma criatura que não deveria existir: meio dragão, sem alma, criada por magia sombria."

    def __init__(self):
        super().__init__("Wyvern", 175, 25, 9, "uma mordida", xp=150)

    def agir(self, alvo):
        self.turnos_agidos += 1
        if self.turnos_agidos % 3 == 0:
            self.som_turno = "fogo_inimigo"
            dano, msgs = self.golpear(alvo, 1.7, "um jato de fogo azul", perfuracao=0.4)
            if dano:
                alvo.aplicar_efeito("queimadura", 2)
            return msgs
        return self.golpear(alvo)[1]


class Venin(Inimigo):
    descricao = ("Um dominador das trevas com veias vermelhas ao redor dos olhos. Drena a vida de tudo "
                 "o que toca, inclusive a sua.")
    chefe = True

    def __init__(self):
        super().__init__("Venin", 270, 27, 10, "um toque que drena a vida", xp=300)
        self.drenou_terra = False

    def agir(self, alvo):
        self.turnos_agidos += 1
        if not self.drenou_terra and self.vida < self.vida_max * 0.5:
            self.drenou_terra = True
            cura = self.curar(self.vida_max // 5)
            self.som_turno = "dreno"
            return [f"🩸 O venin enterra as mãos no chão e drena a magia da terra ao redor: recupera {cura} de vida."]
        if self.turnos_agidos % 3 == 0:
            self.som_turno = "sombras"
            dano, msgs = self.golpear(alvo, 1.5, "uma onda de magia sombria", perfuracao=0.5)
            return msgs
        dano, msgs = self.golpear(alvo)
        if dano:
            cura = self.curar(dano // 2)
            msgs.append(f"O venin absorve sua energia e recupera {cura} de vida.")
        return msgs


INIMIGOS = {
    "candidato": CandidatoDesesperado,
    "rival": CadeteRival,
    "veterano": CadeteVeterano,
    "jack": JackBarlowe,
    "grifo": CavaleiroDeGrifo,
    "primeira_asa": CavaleiroPrimeiraAsa,
    "wyvern": Wyvern,
    "venin": Venin,
}


def criar_inimigo(chave: str, **kwargs) -> Inimigo:
    return INIMIGOS[chave](**kwargs)
