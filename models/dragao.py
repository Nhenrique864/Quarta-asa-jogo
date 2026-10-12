from __future__ import annotations
from models.base import calcular_dano, rolar


# =====================================================
# SINETES — o poder que o vínculo com o dragão desperta
# =====================================================
class Sinete:
    nome = "Sinete"
    descricao = ""
    custo = 25
    som = "relampago"

    def usar(self, cadete, alvo) -> list[str]:
        raise NotImplementedError


class Relampago(Sinete):
    nome = "Invocar Relâmpagos"
    descricao = "Rasga o céu e derruba raios sobre o inimigo. Dano altíssimo."
    custo = 35

    def usar(self, cadete, alvo):
        dano = alvo.receber_dano(calcular_dano(cadete.ataque_total * 2.8, alvo.defesa_total, 0.6))
        msgs = [f"⚡ O céu responde: um relâmpago atinge {alvo.nome} e causa {dano} de dano!"]
        if rolar(0.3):
            alvo.aplicar_efeito("atordoado", 1)
            msgs.append(f"{alvo.nome} fica atordoado pelo trovão.")
        return msgs


class Sombras(Sinete):
    nome = "Manipular Sombras"
    descricao = "Sombras prendem e cegam o inimigo: dano e chance de ele errar por 3 turnos."
    custo = 28
    som = "sombras"

    def usar(self, cadete, alvo):
        dano = alvo.receber_dano(calcular_dano(cadete.ataque_total * 1.8, alvo.defesa_total, 0.3))
        alvo.aplicar_efeito("cego", 3)
        return [f"🌑 Sombras envolvem {alvo.nome}: {dano} de dano e visão turva por 3 turnos."]


class Gelo(Sinete):
    nome = "Congelar"
    descricao = "Gelo se espalha pelo corpo do inimigo: dano e atordoamento garantido."
    custo = 30
    som = "gelo"

    def usar(self, cadete, alvo):
        dano = alvo.receber_dano(calcular_dano(cadete.ataque_total * 1.6, alvo.defesa_total, 0.2))
        alvo.aplicar_efeito("atordoado", 1)
        return [f"❄ Uma camada de gelo prende {alvo.nome}: {dano} de dano e ele não age no próximo turno."]


class LeituraDeMemorias(Sinete):
    nome = "Ler Intenções"
    descricao = "Você lê a mente do inimigo: ele fica exposto (ignora defesa) e você se cura."
    custo = 25
    som = "mente"

    def usar(self, cadete, alvo):
        alvo.aplicar_efeito("exposto", 3)
        cura = cadete.curar(cadete.vida_max // 5)
        return [f"👁 Você enxerga cada movimento de {alvo.nome} antes que aconteça. "
                f"Ele fica exposto por 3 turnos e você recupera {cura} de vida."]


class Explosao(Sinete):
    nome = "Invocar Explosões"
    descricao = ("O ar ao redor do inimigo detona: dano enorme e chance de queimar, "
                 "mas às vezes a explosão também te atinge.")
    custo = 30
    som = "explosao"

    def usar(self, cadete, alvo):
        dano = alvo.receber_dano(calcular_dano(cadete.ataque_total * 2.5, alvo.defesa_total, 0.4))
        msgs = [f"💥 O ar ao redor de {alvo.nome} explode: {dano} de dano!"]
        if rolar(0.3):
            alvo.aplicar_efeito("queimadura", 2)
            msgs.append(f"{alvo.nome} está em chamas.")
        if rolar(0.25):
            recuo = cadete.receber_dano(max(1, cadete.vida_max * 8 // 100))
            msgs.append(f"O poder escapa do seu controle e a onda de choque te atinge: {recuo} de dano.")
        return msgs


class AbalarTerra(Sinete):
    nome = "Abalar a Terra"
    descricao = "O chão se parte sob o inimigo: dano, chance de atordoar e paredes de pedra te protegem por 2 turnos."
    custo = 28
    som = "tremor"

    def usar(self, cadete, alvo):
        dano = alvo.receber_dano(calcular_dano(cadete.ataque_total * 1.4, alvo.defesa_total, 0.3))
        msgs = [f"🪨 A terra se parte sob {alvo.nome}: {dano} de dano. Paredes de pedra se erguem à sua frente."]
        cadete.aplicar_efeito("defendendo", 2)
        if rolar(0.4):
            alvo.aplicar_efeito("atordoado", 1)
            msgs.append(f"{alvo.nome} perde o equilíbrio e fica atordoado.")
        return msgs


class DeterTempo(Sinete):
    nome = "Deter o Tempo"
    descricao = "Um dom raríssimo: o mundo congela por dois turnos para o inimigo, e você recupera o fôlego."
    custo = 32
    som = "tempo"

    def usar(self, cadete, alvo):
        dano = alvo.receber_dano(calcular_dano(cadete.ataque_total, alvo.defesa_total))
        alvo.aplicar_efeito("atordoado", 2)
        cadete.recuperar_poder(10)
        return [f"⏳ O tempo para. Você atravessa o instante congelado e golpeia {alvo.nome} ({dano} de dano). "
                f"Ele fica parado por 2 turnos."]


# =====================================================
# DRAGÃO
# =====================================================
class Dragao:
    """Dragão vinculado ao cadete. Concede bônus, sopro e um sinete."""

    def __init__(self, chave, nome, cor, raca, descricao, bonus, sopro, sinete_cls, legenda=""):
        self.chave = chave
        self.legenda = legenda      # legenda da ilustração (aparência e cenário)
        self.nome = nome
        self.cor = cor
        self.raca = raca
        self.descricao = descricao
        self.bonus = bonus          # {"ataque", "defesa", "vida", "poder", "agilidade", "astucia"}
        self.sopro = sopro          # dano base do sopro de fogo
        self.sinete: Sinete = sinete_cls()

    def soprar(self, alvo) -> list[str]:
        dano = alvo.receber_dano(calcular_dano(self.sopro, alvo.defesa_total, 0.5))
        msgs = [f"🐉 {self.nome} mergulha e cospe fogo em {alvo.nome}: {dano} de dano!"]
        if rolar(0.35):
            alvo.aplicar_efeito("queimadura", 2)
            msgs.append(f"{alvo.nome} está em chamas.")
        return msgs

    def to_dict(self) -> dict:
        return {"chave": self.chave}

    def resumo_bonus(self) -> list[str]:
        nomes = {"ataque": "Ataque", "defesa": "Defesa", "vida": "Vida", "poder": "Poder",
                 "agilidade": "Agilidade", "astucia": "Astúcia"}
        return [f"+{v} {nomes[k]}" for k, v in self.bonus.items()]

    def apresentacao(self) -> dict:
        """Dados usados pelas interfaces para apresentar o dragão."""
        return {
            "chave": self.chave, "nome": self.nome, "cor": self.cor, "raca": self.raca,
            "descricao": self.descricao, "legenda": self.legenda,
            "bonus": self.resumo_bonus(), "sopro": self.sopro,
            "sinete": self.sinete.nome, "sinete_descricao": self.sinete.descricao,
            "sinete_custo": self.sinete.custo,
        }


DRAGOES = {
    "vermelho": lambda: Dragao(
        "vermelho", "Kaelthar", "Vermelho", "Rabo de Espada",
        "Enorme e orgulhoso, com uma cauda que corta como lâmina. Despreza a fraqueza, "
        "mas respeita quem não recua.",
        {"ataque": 6, "defesa": 2, "vida": 25, "poder": 20}, 38, Relampago,
        "Escamas carmesim e ventre dourado, chifres em coroa e a cauda-lâmina reluzindo sobre rochas "
        "vulcânicas, sob um céu de tempestade rasgado pelo pôr do sol."),
    "preto": lambda: Dragao(
        "preto", "Morvhen", "Preto", "Rabo de Adaga",
        "Escuro como a noite do Vale, rápido e silencioso. Escolhe pouquíssimos cavaleiros.",
        {"ataque": 4, "defesa": 2, "vida": 20, "poder": 25, "agilidade": 2}, 34, Sombras,
        "Escamas de obsidiana com reflexos violeta, passos silenciosos sobre as rochas molhadas e uma cauda "
        "afiada cortando a névoa noturna do Vale."),
    "azul": lambda: Dragao(
        "azul", "Siolra", "Azul", "Rabo de Escorpião",
        "Azul-acinzentado, a cauda carregada de veneno. Paciente e calculista.",
        {"ataque": 3, "defesa": 4, "vida": 30, "poder": 20}, 32, Gelo,
        "Escamas azul-escuras, ventre prateado e a cauda segmentada de escorpião pingando veneno verde "
        "sobre os picos nevados ao luar."),
    "verde": lambda: Dragao(
        "verde", "Brannoc", "Verde", "Rabo de Clava",
        "Verde-musgo, massivo e sereno. Conhece as histórias antigas melhor que qualquer escriba.",
        {"ataque": 3, "defesa": 3, "vida": 35, "poder": 25, "astucia": 2}, 30, LeituraDeMemorias,
        "Coberto de musgo, com chifres como galhos retorcidos, barba longa e asas gravadas com runas antigas, "
        "guardando a floresta das cachoeiras com a clava cravejada da cauda."),
    "laranja": lambda: Dragao(
        "laranja", "Lasair", "Laranja", "Rabo de Espada",
        "Imprevisível e explosivo como uma fagulha em palha seca. Ninguém sabe o que o irrita, "
        "nem mesmo os outros dragões.",
        {"ataque": 7, "defesa": 1, "vida": 15, "poder": 20}, 40, Explosao,
        "Escamas laranja que brilham como brasas vivas e chifres negros como labaredas, avançando sobre a rocha "
        "vulcânica enquanto um vulcão desperta, com a cauda-lâmina serrilhada soltando faíscas."),
    "marrom": lambda: Dragao(
        "marrom", "Dúnmor", "Marrom", "Rabo de Maça",
        "Leal e inabalável como a montanha onde nasceu. Fala pouco, protege sempre e nunca abandona "
        "o próprio cavaleiro.",
        {"ataque": 2, "defesa": 6, "vida": 40, "poder": 15}, 28, AbalarTerra,
        "Placas como rocha de cânion e chifres curvados de carneiro, firme como uma muralha à beira dos "
        "desfiladeiros ao pôr do sol, com a maça cravejada da cauda pronta para golpear."),
    "dourado": lambda: Dragao(
        "dourado", "Órla", "Dourado", "Rabo de Penas",
        "O filhote dourado que você protegeu de Jack. Pequeno demais para ser escolhido, segundo as regras, "
        "mas ninguém avisou isso a ela. Raríssima, curiosa e mais antiga do que parece.",
        {"ataque": 2, "defesa": 2, "vida": 15, "poder": 35, "agilidade": 1, "astucia": 1}, 22, DeterTempo,
        "Filhote de escamas douradas e olhos azuis curiosos, com um leque de penas na cauda, na luz da aurora "
        "sobre o Vale enevoado. Pequena demais para ser escolhida, mas não para escolher."),
}


def criar_dragao(chave: str) -> Dragao:
    return DRAGOES[chave]()
