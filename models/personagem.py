from __future__ import annotations
import random
from models.base import Combatente, calcular_dano, rolar
from models.inventario import Inventario
from models.dragao import criar_dragao


class Cadete(Combatente):
    """Cadete do Quadrante dos Cavaleiros de Basgiath (base dos arquétipos)."""

    arquetipo = "Cadete"
    descricao = ""
    nome_habilidade = "Habilidade"
    descricao_habilidade = ""
    custo_habilidade = 15
    bonus_critico = 0.0
    som_ataque = "golpe"        # efeitos sonoros tocados pelo front web
    som_habilidade = "golpe"

    def __init__(self, nome, vida, ataque, defesa, poder, agilidade, astucia):
        super().__init__(nome, vida, ataque, defesa)
        self.poder = poder
        self.poder_max = poder
        self.agilidade = agilidade
        self.astucia = astucia
        self.inventario = Inventario()
        self.equipamentos: list = []
        self.dragao = None
        self.nivel = 1
        self.xp = 0
        self.buff_ataque = 0  # bônus temporário (só dura o combate)

    # ---------------------------------------------------------
    #   ATRIBUTOS EFETIVOS (base + equipamentos + dragão)
    # ---------------------------------------------------------
    def _bonus_dragao(self, chave: str) -> int:
        return self.dragao.bonus.get(chave, 0) if self.dragao else 0

    @property
    def ataque_total(self) -> int:
        equip = sum(e.bonus_ataque for e in self.equipamentos)
        return self.ataque + equip + self.buff_ataque + self._bonus_dragao("ataque")

    @property
    def defesa_total(self) -> int:
        equip = sum(e.bonus_defesa for e in self.equipamentos)
        return self.defesa + equip + self._bonus_dragao("defesa")

    @property
    def agilidade_total(self) -> int:
        return self.agilidade + self._bonus_dragao("agilidade")

    @property
    def astucia_total(self) -> int:
        return self.astucia + self._bonus_dragao("astucia")

    @property
    def forca(self) -> int:
        """Usado em testes de força (escalar, empurrar, segurar)."""
        return self.ataque_total // 3

    @property
    def chance_critico(self) -> float:
        return 0.05 + self.astucia_total * 0.012 + self.bonus_critico

    @property
    def chance_esquiva(self) -> float:
        return min(0.35, self.agilidade_total * 0.02)

    def atributo_teste(self, nome: str) -> int:
        return {"agilidade": self.agilidade_total, "astucia": self.astucia_total,
                "forca": self.forca}[nome]

    # ---------------------------------------------------------
    #   COMBATE
    # ---------------------------------------------------------
    def _golpe(self, alvo, multiplicador=1.0, perfuracao=0.0, critico_extra=0.0):
        """Calcula e aplica um golpe. Retorna (dano, foi_critico)."""
        if alvo.tem_efeito("exposto"):
            perfuracao = 1.0
        critico = rolar(self.chance_critico + critico_extra)
        base = self.ataque_total * multiplicador * (1.75 if critico else 1.0)
        dano = alvo.receber_dano(calcular_dano(base, alvo.defesa_total, perfuracao))
        return dano, critico

    @staticmethod
    def _sufixo(critico: bool) -> str:
        return " — CRÍTICO!" if critico else ""

    def atacar(self, alvo) -> list[str]:
        dano, crit = self._golpe(alvo)
        return [f"Você ataca {alvo.nome} e causa {dano} de dano{self._sufixo(crit)}"]

    def habilidade(self, alvo) -> list[str]:
        raise NotImplementedError

    def pode_usar_habilidade(self) -> bool:
        return self.poder >= self.custo_habilidade

    def usar_habilidade(self, alvo) -> list[str]:
        self.poder -= self.custo_habilidade
        return self.habilidade(alvo)

    def pode_usar_sinete(self) -> bool:
        return self.dragao is not None and self.poder >= self.dragao.sinete.custo

    def usar_sinete(self, alvo) -> list[str]:
        self.poder -= self.dragao.sinete.custo
        return self.dragao.sinete.usar(self, alvo)

    def recuperar_poder(self, quantidade: int) -> None:
        self.poder = min(self.poder_max, self.poder + quantidade)

    # ---------------------------------------------------------
    #   PROGRESSÃO
    # ---------------------------------------------------------
    @property
    def xp_prox(self) -> int:
        return 100 + (self.nivel - 1) * 80

    def ganhar_xp(self, quantidade: int) -> list[str]:
        msgs = [f"+{quantidade} XP"]
        self.xp += quantidade
        while self.xp >= self.xp_prox:
            self.xp -= self.xp_prox
            self.subir_nivel()
            msgs.append(f"⬆ Nível {self.nivel}! Vida, ataque, defesa e poder aumentaram.")
        return msgs

    def subir_nivel(self) -> None:
        self.nivel += 1
        self.vida_max += 12
        self.ataque += 2
        self.defesa += 1
        self.poder_max += 5
        if self.nivel % 2 == 0:
            self.agilidade += 1
        else:
            self.astucia += 1
        self.vida += 12
        self.poder += 5

    def descansar(self) -> None:
        self.vida = self.vida_max
        self.poder = self.poder_max
        self.limpar_efeitos()

    def vincular_dragao(self, chave: str) -> None:
        self.dragao = criar_dragao(chave)
        self.vida_max += self.dragao.bonus.get("vida", 0)
        self.poder_max += self.dragao.bonus.get("poder", 0)
        self.descansar()

    def ajustar_atributo(self, nome: str, valor: int) -> None:
        setattr(self, nome, getattr(self, nome) + valor)
        if nome == "vida_max":
            self.vida += valor
        if nome == "poder_max":
            self.poder += valor

    # ---------------------------------------------------------
    #   INVENTÁRIO
    # ---------------------------------------------------------
    def adicionar_item(self, item):
        self.inventario.adicionar_item(item)

    def usar_item(self, item) -> str:
        msg = item.usar(self)
        self.inventario.remover_item(item)
        return msg

    # ---------------------------------------------------------
    #   PERSISTÊNCIA
    # ---------------------------------------------------------
    def to_dict(self) -> dict:
        return {
            "classe": self.__class__.__name__,
            "nome": self.nome, "nivel": self.nivel, "xp": self.xp,
            "vida": self.vida, "vida_max": self.vida_max,
            "ataque": self.ataque, "defesa": self.defesa,
            "poder": self.poder, "poder_max": self.poder_max,
            "agilidade": self.agilidade, "astucia": self.astucia,
            "inventario": [i.to_dict() for i in self.inventario.itens],
            "equipamentos": [e.to_dict() for e in self.equipamentos],
            "dragao": self.dragao.to_dict() if self.dragao else None,
        }

    @staticmethod
    def from_dict(dados: dict) -> "Cadete":
        from models.catalogo import criar_item
        cls = ARQUETIPOS.get(dados.get("classe"), Espadachim)
        c = cls(dados.get("nome", "Cadete"))
        for campo in ("nivel", "xp", "vida", "vida_max", "ataque", "defesa",
                      "poder", "poder_max", "agilidade", "astucia"):
            if campo in dados:
                setattr(c, campo, dados[campo])
        for item in dados.get("inventario", []):
            novo = criar_item(item.get("tipo"))
            if novo:
                c.inventario.adicionar_item(novo)
        for item in dados.get("equipamentos", []):
            novo = criar_item(item.get("tipo"))
            if novo:
                c.equipamentos.append(novo)
        if dados.get("dragao"):
            c.dragao = criar_dragao(dados["dragao"]["chave"])  # bônus de vida/poder já estão salvos
        return c


# =============================================================
#   ARQUÉTIPOS
# =============================================================
class DuelistaDeAdagas(Cadete):
    arquetipo = "Duelista de Adagas"
    descricao = "Frágil, mas rápida e precisa. Vence pela astúcia e por adagas no ponto certo."
    nome_habilidade = "Chuva de Adagas"
    descricao_habilidade = "Três arremessos que podem ser críticos e envenenar."
    custo_habilidade = 15
    bonus_critico = 0.10
    som_ataque = "adaga"
    som_habilidade = "adagas"

    def __init__(self, nome):
        super().__init__(nome, vida=80, ataque=14, defesa=4, poder=40, agilidade=7, astucia=6)

    def atacar(self, alvo):
        dano, crit = self._golpe(alvo)
        return [f"Você arremessa uma adaga em {alvo.nome}: {dano} de dano{self._sufixo(crit)}"]

    def habilidade(self, alvo):
        msgs, total = [], 0
        for _ in range(3):
            dano, crit = self._golpe(alvo, 0.7)
            total += dano
            if crit:
                msgs.append(f"Uma adaga acerta um ponto vital ({dano})!")
        msgs.insert(0, f"🗡 Chuva de Adagas! Três lâminas cortam o ar: {total} de dano no total.")
        if rolar(0.3):
            alvo.aplicar_efeito("veneno", 3)
            msgs.append(f"As lâminas estavam envenenadas: {alvo.nome} está envenenado.")
        return msgs


class Espadachim(Cadete):
    arquetipo = "Espadachim"
    descricao = "Resistente e forte. Aguenta o castigo do tatame e devolve com o dobro de força."
    nome_habilidade = "Golpe Devastador"
    descricao_habilidade = "Um corte pesado que atravessa metade da defesa."
    custo_habilidade = 15
    som_ataque = "espada"
    som_habilidade = "espada_pesada"

    def __init__(self, nome):
        super().__init__(nome, vida=120, ataque=15, defesa=8, poder=30, agilidade=3, astucia=3)

    def atacar(self, alvo):
        dano, crit = self._golpe(alvo)
        return [f"Sua espada atinge {alvo.nome}: {dano} de dano{self._sufixo(crit)}"]

    def habilidade(self, alvo):
        dano, crit = self._golpe(alvo, 2.0, perfuracao=0.5)
        return [f"⚔ Golpe Devastador! A lâmina desce sobre {alvo.nome}: {dano} de dano{self._sufixo(crit)}"]


class Lutador(Cadete):
    arquetipo = "Lutador do Tatame"
    descricao = "Equilibrado, mestre do corpo a corpo. Derruba e atordoa os adversários."
    nome_habilidade = "Sequência no Tatame"
    descricao_habilidade = "Dois golpes rápidos com chance de atordoar."
    custo_habilidade = 15
    som_ataque = "soco"
    som_habilidade = "combo"

    def __init__(self, nome):
        super().__init__(nome, vida=100, ataque=13, defesa=6, poder=35, agilidade=5, astucia=4)

    def atacar(self, alvo):
        dano, crit = self._golpe(alvo)
        return [f"Você acerta um golpe em {alvo.nome}: {dano} de dano{self._sufixo(crit)}"]

    def habilidade(self, alvo):
        d1, c1 = self._golpe(alvo, 0.9)
        d2, c2 = self._golpe(alvo, 0.9)
        msgs = [f"🥋 Sequência no Tatame! Dois golpes: {d1} + {d2} de dano{self._sufixo(c1 or c2)}"]
        if rolar(0.45):
            alvo.aplicar_efeito("atordoado", 1)
            msgs.append(f"{alvo.nome} vai ao chão e fica atordoado.")
        return msgs


class Estrategista(Cadete):
    arquetipo = "Estrategista"
    descricao = "Treinado para o Quadrante dos Escribas. Lê o oponente e explora cada fraqueza."
    nome_habilidade = "Analisar Fraquezas"
    descricao_habilidade = ("Golpe preciso que deixa o inimigo exposto (sem defesa) por 3 turnos. "
                            "Seus ataques causam +30% de dano em inimigos expostos.")
    custo_habilidade = 15
    som_ataque = "golpe"
    som_habilidade = "analise"

    def __init__(self, nome):
        super().__init__(nome, vida=90, ataque=13, defesa=5, poder=45, agilidade=4, astucia=8)

    def atacar(self, alvo):
        mult = 1.3 if alvo.tem_efeito("exposto") else 1.0
        dano, crit = self._golpe(alvo, mult)
        return [f"Você golpeia {alvo.nome} num ponto calculado: {dano} de dano{self._sufixo(crit)}"]

    def habilidade(self, alvo):
        dano, crit = self._golpe(alvo, 1.4)
        alvo.aplicar_efeito("exposto", 3)
        return [f"📜 Você encontra a falha na guarda de {alvo.nome}: {dano} de dano{self._sufixo(crit)}. "
                f"Ele fica exposto por 3 turnos."]


ARQUETIPOS = {cls.__name__: cls for cls in (DuelistaDeAdagas, Espadachim, Lutador, Estrategista)}
