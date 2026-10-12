"""Campanha narrativa inspirada em *Quarta Asa* (Fourth Wing), de Rebecca Yarros.

Adaptação de fã para fins educacionais: o mundo e os personagens pertencem à autora;
os textos abaixo são originais e acompanham o arco do primeiro ano em Basgiath.

Placeholders disponíveis nos textos: {nome}, {arquetipo}, {dragao}, {cor}, {raca}, {sinete}.
"""
from __future__ import annotations
from dataclasses import dataclass, field


@dataclass
class Opcao:
    rotulo: str
    ir: str | None = None
    teste: dict | None = None      # {"atributo", "cd", "sucesso", "falha", "dano", "efeitos_sucesso"}
    combate: dict | None = None    # {"inimigo", "vitoria", "dragao", "kwargs", "efeitos_inimigo", "vida_pct"}
    efeitos: dict = field(default_factory=dict)  # {"xp", "itens", "atributos", "flags", "cura"}
    dragao: str | None = None
    fim_capitulo: bool = False
    requer_flag: str | None = None
    dica: str = ""


@dataclass
class Cena:
    titulo: str
    texto: list[str]
    opcoes: list[Opcao]
    texto_flag: dict[str, list[str]] = field(default_factory=dict)
    apresentar_dragao: bool = False  # mostra a apresentação do dragão vinculado


@dataclass
class Capitulo:
    numero: int
    titulo: str
    inicio: str
    resumo: str


CAPITULOS = [
    Capitulo(1, "Dia da Conscrição", "c1_inicio", "Atravesse o Parapeito e sobreviva ao primeiro dia."),
    Capitulo(2, "A Lista dos Mortos", "c2_inicio", "Aprenda as regras do Quadrante e vença seu primeiro desafio."),
    Capitulo(3, "O Gauntlet", "c3_inicio", "Escale a pista de obstáculos que separa os fortes dos mortos."),
    Capitulo(4, "Lâminas no Escuro", "c4_inicio", "Alguém quer diminuir a concorrência antes da Debulha."),
    Capitulo(5, "A Debulha", "c5_inicio", "Entre no Vale e seja escolhido por um dragão, ou não saia de lá."),
    Capitulo(6, "Asas e Sinetes", "c6_inicio", "Aprenda a voar, domine seu sinete e vença os exercícios de guerra."),
    Capitulo(7, "Resson", "c7_inicio", "Uma missão na fronteira revela o que Navarre esconde."),
]


CENAS: dict[str, Cena] = {
    # =================================================================
    #   CAPÍTULO 1 — DIA DA CONSCRIÇÃO
    # =================================================================
    "c1_inicio": Cena(
        "Os portões de Basgiath",
        [
            "O sol mal nasceu e a fila de candidatos já dá a volta na base da torre. "
            "Mochilas pesadas, botas novas, rostos pálidos. A maioria vai para a Infantaria, para os "
            "Curandeiros ou para os Escribas. Você, {nome}, entrou na fila do Quadrante dos Cavaleiros.",
            "Dizem que um quarto dos candidatos não sobrevive ao primeiro dia. Ninguém ri quando dizem isso.",
            "Enquanto a fila avança, você se lembra do motivo que te trouxe até aqui.",
        ],
        [
            Opcao("Honrar o nome da sua família", "c1_parapeito",
                  efeitos={"atributos": {"vida_max": 10}}, dica="+10 de vida máxima"),
            Opcao("Você nunca se encaixou entre os escribas", "c1_parapeito",
                  efeitos={"atributos": {"astucia": 1}}, dica="+1 de astúcia"),
            Opcao("Provar que todos estavam errados sobre você", "c1_parapeito",
                  efeitos={"atributos": {"agilidade": 1}}, dica="+1 de agilidade"),
        ],
    ),
    "c1_parapeito": Cena(
        "O Parapeito",
        [
            "A ponte de pedra liga duas torres sobre um desfiladeiro. Não tem corrimão, mal tem a largura "
            "de um pé, e a chuva da noite deixou tudo escorregadio. Lá embaixo, o rio parece um fio de prata.",
            "Do outro lado, cadetes de uniforme preto esperam com uma lista. Quem chega tem o nome escrito. "
            "Quem cai também tem, só que em outra lista.",
            "O vento sopra forte. É a sua vez.",
        ],
        [
            Opcao("Atravessar com passos curtos e o corpo baixo",
                  teste={"atributo": "agilidade", "cd": 11, "sucesso": "c1_meio", "falha": "c1_escorregao", "dano": 12},
                  dica="Teste de agilidade (CD 11)"),
            Opcao("Ler o vento e esperar as rajadas passarem",
                  teste={"atributo": "astucia", "cd": 11, "sucesso": "c1_meio", "falha": "c1_escorregao", "dano": 12},
                  dica="Teste de astúcia (CD 11)"),
        ],
    ),
    "c1_escorregao": Cena(
        "Pedra molhada",
        [
            "Seu pé desliza. Por um instante o mundo inteiro inclina e você vê o desfiladeiro de frente. "
            "Suas mãos encontram a borda e você se agarra, rasgando a pele contra a pedra.",
            "Com os braços tremendo, você volta a subir. Ainda está viva(o). Ainda está na ponte.",
        ],
        [Opcao("Respirar fundo e continuar", "c1_meio")],
    ),
    "c1_meio": Cena(
        "No meio do caminho",
        [
            "Na metade da ponte você ouve um grito atrás. Um candidato, olhos arregalados, avança rápido "
            "demais. Ele não quer esperar e não pretende dividir a passagem com ninguém.",
            "Ele estende as mãos na sua direção para te empurrar.",
        ],
        [
            Opcao("Firmar os pés e lutar",
                  combate={"inimigo": "candidato", "vitoria": "c1_fim", "dragao": False}),
            Opcao("Abaixar no último instante e deixá-lo passar",
                  teste={"atributo": "agilidade", "cd": 13, "sucesso": "c1_fim", "falha": "c1_luta_forcada", "dano": 6,
                         "efeitos_sucesso": {"xp": 20}},
                  dica="Teste de agilidade (CD 13)"),
            Opcao("Falar com ele e acalmá-lo",
                  teste={"atributo": "astucia", "cd": 14, "sucesso": "c1_fim", "falha": "c1_luta_forcada", "dano": 0,
                         "efeitos_sucesso": {"xp": 30, "flags": ["salvou_candidato"]}},
                  dica="Teste de astúcia (CD 14)"),
        ],
    ),
    "c1_luta_forcada": Cena(
        "Sem saída",
        ["Não funciona. Ele agarra seu uniforme e os dois cambaleiam sobre o vazio. Agora é lutar ou cair."],
        [Opcao("Lutar", combate={"inimigo": "candidato", "vitoria": "c1_fim", "dragao": False})],
    ),
    "c1_fim": Cena(
        "O outro lado",
        [
            "Seus pés tocam a pedra firme da torre. Um cadete de cabelos escuros, com uma marca de "
            "rebelião subindo pelo pescoço, ergue os olhos da lista. É Xaden Riorson, líder de ala da "
            "Quarta Asa, e ele te avalia como quem avalia uma arma.",
            "Ele anota seu nome sem dizer nada. Atrás dele, Dain Aetos, líder do seu novo esquadrão, "
            "solta o ar que estava segurando. Uma garota de tranças sorri e se apresenta: Rhiannon. "
            "Ela atravessou poucos minutos antes de você.",
            "Bem-vindo(a) à Quarta Asa, cadete {nome}.",
        ],
        [Opcao("Juntar-se ao esquadrão", efeitos={"xp": 20, "itens": ["TonicoCurativo"]}, fim_capitulo=True)],
        texto_flag={"salvou_candidato": [
            "O candidato que você acalmou chega logo depois, ainda tremendo, e acena para você. "
            "Ele vai lembrar disso."]},
    ),

    # =================================================================
    #   CAPÍTULO 2 — A LISTA DOS MORTOS
    # =================================================================
    "c2_inicio": Cena(
        "Formação ao amanhecer",
        [
            "Toda manhã, o Quadrante inteiro forma no pátio e alguém lê em voz alta os nomes de quem "
            "morreu desde o dia anterior. Na primeira semana a lista é longa.",
            "Depois da formação vêm as aulas: Battle Brief, onde a professora Devera mostra no mapa os "
            "ataques de Poromiel aos postos da fronteira, e o tatame do professor Emetterio, onde os "
            "cadetes aprendem a machucar uns aos outros.",
            "Você tem pouco tempo livre. Como vai usar?",
        ],
        [
            Opcao("Estudar os relatórios do Battle Brief", "c2_desafio",
                  efeitos={"atributos": {"astucia": 1}}, dica="+1 de astúcia"),
            Opcao("Treinar sozinho(a) no tatame até tarde", "c2_desafio",
                  efeitos={"atributos": {"ataque": 2}}, dica="+2 de ataque"),
            Opcao("Correr nas escadarias da torre com Rhiannon", "c2_desafio",
                  efeitos={"atributos": {"vida_max": 10}}, dica="+10 de vida máxima"),
        ],
    ),
    "c2_desafio": Cena(
        "O quadro de desafios",
        [
            "Os nomes dos desafios do dia aparecem no quadro. O seu está lá, ao lado de Corvin Halse, "
            "um primeiro-ano que cruzou o Parapeito rindo e que, desde então, escolhe os oponentes "
            "que acha mais fáceis.",
            "No tatame não há armas de verdade, mas há ossos quebrados. Dain cruza os braços na beira "
            "do círculo, preocupado. Emetterio dá o sinal.",
        ],
        [
            Opcao("Ir direto para cima dele",
                  combate={"inimigo": "rival", "vitoria": "c2_vitoria", "dragao": False,
                           "kwargs": {"nome": "Corvin Halse"}}),
            Opcao("Observar a guarda dele nos primeiros segundos",
                  teste={"atributo": "astucia", "cd": 12, "sucesso": "c2_luta_vantagem", "falha": "c2_luta_normal", "dano": 0},
                  dica="Teste de astúcia (CD 12): sucesso deixa o rival exposto"),
        ],
    ),
    "c2_luta_vantagem": Cena(
        "Uma brecha",
        ["Ele sempre baixa o braço esquerdo antes de golpear. Você viu. Agora é só esperar."],
        [Opcao("Atacar na brecha",
               combate={"inimigo": "rival", "vitoria": "c2_vitoria", "dragao": False,
                        "kwargs": {"nome": "Corvin Halse"}, "efeitos_inimigo": {"exposto": 2}})],
    ),
    "c2_luta_normal": Cena(
        "Sem tempo para pensar",
        ["Corvin não te dá tempo para estudar nada. Ele já está em cima de você."],
        [Opcao("Lutar", combate={"inimigo": "rival", "vitoria": "c2_vitoria", "dragao": False,
                                 "kwargs": {"nome": "Corvin Halse"}})],
    ),
    "c2_vitoria": Cena(
        "Olhares do outro lado do tatame",
        [
            "Corvin bate no tatame pedindo para parar. Emetterio anota o resultado sem cerimônia.",
            "Do outro lado do salão, um cadete enorme de cabelo claro não tira os olhos de você. "
            "Jack Barlowe. Ele passa o polegar pela garganta e sorri. Na Debulha, dizem, ele "
            "pretende eliminar todos os que considera fracos demais para um dragão.",
            "Dain se aproxima e diz baixinho para você nunca andar sozinho(a) pelos corredores.",
        ],
        [Opcao("Guardar a ameaça e seguir em frente", efeitos={"xp": 30, "itens": ["ElixirDeVigor"]},
               fim_capitulo=True)],
    ),

    # =================================================================
    #   CAPÍTULO 3 — O GAUNTLET
    # =================================================================
    "c3_inicio": Cena(
        "O Gauntlet",
        [
            "O Gauntlet é uma pista de obstáculos escavada na encosta da montanha: paredes de pedra, "
            "troncos que giram, cordas sobre o vazio. Os dragões assistem dos penhascos. Eles estão "
            "escolhendo quem vale a pena observar.",
            "Rhiannon termina antes de você e grita seu nome lá de cima. É a sua vez.",
        ],
        [
            Opcao("Subir na força bruta",
                  teste={"atributo": "forca", "cd": 12, "sucesso": "c3_topo", "falha": "c3_queda", "dano": 14,
                         "efeitos_sucesso": {"xp": 40}},
                  dica="Teste de força (CD 12)"),
            Opcao("Confiar no ritmo e na técnica",
                  teste={"atributo": "agilidade", "cd": 12, "sucesso": "c3_topo", "falha": "c3_queda", "dano": 14,
                         "efeitos_sucesso": {"xp": 40}},
                  dica="Teste de agilidade (CD 12)"),
            Opcao("Observar os outros e achar o caminho mais seguro",
                  teste={"atributo": "astucia", "cd": 13, "sucesso": "c3_topo", "falha": "c3_queda", "dano": 14,
                         "efeitos_sucesso": {"xp": 40}},
                  dica="Teste de astúcia (CD 13)"),
        ],
    ),
    "c3_queda": Cena(
        "Chão duro",
        [
            "Um tronco gira antes da hora e você despenca alguns metros, batendo as costelas numa saliência. "
            "Com a visão turva, você recomeça a subir. Devagar, mas sobe. Quando chega ao topo, ninguém "
            "aplaude, mas ninguém risca seu nome.",
        ],
        [Opcao("Mancar de volta para o dormitório", "c3_noite", efeitos={"xp": 15})],
    ),
    "c3_topo": Cena(
        "O topo",
        [
            "Você alcança o topo com o coração disparado. Lá embaixo, um dos dragões, imenso e escuro, "
            "inclina a cabeça na sua direção antes de alçar voo. Rhiannon aperta seu ombro, sem palavras.",
        ],
        [Opcao("Voltar para o dormitório", "c3_noite")],
    ),
    "c3_noite": Cena(
        "Noites sem dormir",
        [
            "Faltam semanas para a Debulha. Quem não for escolhido por um dragão, ou não sobreviver ao Vale, "
            "não continua no Quadrante. Cada hora conta.",
            "Esta noite, você escolhe como se preparar.",
        ],
        [
            Opcao("Aceitar o treino noturno de Xaden no tatame", fim_capitulo=True,
                  efeitos={"atributos": {"agilidade": 1, "defesa": 1}, "flags": ["treinou_xaden"]},
                  dica="+1 agilidade, +1 defesa"),
            Opcao("Estudar dragões nos Arquivos com os escribas", fim_capitulo=True,
                  efeitos={"atributos": {"astucia": 2}, "flags": ["estudou_arquivos"]},
                  dica="+2 astúcia"),
            Opcao("Afiar as armas e treinar arremessos com Rhiannon", fim_capitulo=True,
                  efeitos={"atributos": {"ataque": 2}, "flags": ["treinou_rhiannon"]},
                  dica="+2 ataque"),
        ],
    ),

    # =================================================================
    #   CAPÍTULO 4 — LÂMINAS NO ESCURO
    # =================================================================
    "c4_inicio": Cena(
        "Passos no corredor",
        [
            "Corre um boato pelo Quadrante: alguns terceiro-anistas acham que há cadetes demais para "
            "dragões de menos e querem resolver o problema antes da Debulha.",
            "Passa da meia-noite quando você ouve a maçaneta girar devagar. Uma sombra no vão da porta. "
            "Uma lâmina refletindo a luz da lua.",
        ],
        [
            Opcao("Fingir que dorme e emboscar o invasor",
                  teste={"atributo": "astucia", "cd": 13, "sucesso": "c4_emboscada", "falha": "c4_luta", "dano": 8},
                  dica="Teste de astúcia (CD 13): sucesso atordoa o inimigo"),
            Opcao("Empurrar o baú contra a porta e gritar por ajuda",
                  teste={"atributo": "forca", "cd": 12, "sucesso": "c4_ajuda", "falha": "c4_luta", "dano": 8},
                  dica="Teste de força (CD 12): sucesso traz Rhiannon para ajudar"),
            Opcao("Pegar sua arma e enfrentá-lo de frente", "c4_luta"),
        ],
    ),
    "c4_emboscada": Cena(
        "A emboscada",
        ["Ele se inclina sobre a cama. Você ataca primeiro, e o golpe o atinge antes que ele entenda o que aconteceu."],
        [Opcao("Terminar o serviço",
               combate={"inimigo": "veterano", "vitoria": "c4_depois", "dragao": False,
                        "efeitos_inimigo": {"atordoado": 1}})],
    ),
    "c4_ajuda": Cena(
        "Reforços",
        [
            "O baú segura a porta tempo suficiente para Rhiannon chegar correndo pelo corredor. "
            "Ela acerta o invasor por trás antes de ele entrar. Ele ainda está de pé, mas ferido.",
        ],
        [Opcao("Lutar ao lado de Rhiannon",
               combate={"inimigo": "veterano", "vitoria": "c4_depois", "dragao": False, "vida_pct": 0.65})],
    ),
    "c4_luta": Cena(
        "Frente a frente",
        ["Ele entra no quarto com a lâmina em punho. Não há para onde correr."],
        [Opcao("Lutar pela sua vida", combate={"inimigo": "veterano", "vitoria": "c4_depois", "dragao": False})],
    ),
    "c4_depois": Cena(
        "Depois do sangue",
        [
            "O invasor foge mancando pelo corredor. Minutos depois, Xaden aparece na porta. Ele olha o "
            "quarto revirado e depois para você, e algo muda no rosto dele.",
            "No dia seguinte, os outros envolvidos no ataque não aparecem na formação. Ninguém pergunta "
            "o motivo. Na sua cama, você encontra um embrulho sem bilhete: um conjunto de adagas "
            "perfeitamente balanceadas.",
        ],
        [Opcao("Guardar as adagas e tratar os ferimentos",
               efeitos={"xp": 30, "itens": ["AdagasAfiadas", "TonicoCurativo", "TonicoCurativo"]},
               fim_capitulo=True)],
        texto_flag={"treinou_xaden": [
            "Você reconhece o equilíbrio das lâminas. São iguais às que Xaden usou nos treinos noturnos."]},
    ),

    # =================================================================
    #   CAPÍTULO 5 — A DEBULHA
    # =================================================================
    "c5_inicio": Cena(
        "O Vale",
        [
            "A Debulha começa ao amanhecer. Os primeiro-anistas são soltos no Vale, uma floresta fechada "
            "atrás de Basgiath, onde os dragões que vão escolher cavaleiros este ano estão esperando.",
            "Não se escolhe um dragão. O dragão escolhe você ou te queima. E, entre as árvores, os "
            "cadetes também caçam uns aos outros.",
        ],
        [
            Opcao("Seguir o riacho até o norte do Vale", "c5_jack", efeitos={"flags": ["sozinho_vale"]}),
            Opcao("Subir pelas rochas para ter visão do terreno", "c5_jack",
                  efeitos={"flags": ["sozinho_vale"], "atributos": {"agilidade": 1}}, dica="+1 agilidade"),
            Opcao("Ficar com o grupo de Rhiannon", "c5_jack", efeitos={"flags": ["grupo_rhiannon"]}),
        ],
    ),
    "c5_jack": Cena(
        "Caçador",
        [
            "Numa clareira, você encontra um filhote dourado de dragão, pequeno demais para ser escolhido, "
            "acuado contra uma rocha. Na frente dele, de espada em punho, está Jack Barlowe.",
            "Ele vira para você com um sorriso. Parece que encontrou duas presas fáceis de uma vez só.",
        ],
        [
            Opcao("Ficar entre Jack e o filhote",
                  combate={"inimigo": "jack", "vitoria": "c5_dragoes", "dragao": False},
                  efeitos={"flags": ["protegeu_filhote"]},
                  dica="Proteger o filhote dourado"),
            Opcao("Atacar Jack pelas costas enquanto ele mira no filhote",
                  combate={"inimigo": "jack", "vitoria": "c5_dragoes", "dragao": False,
                           "efeitos_inimigo": {"exposto": 2}},
                  dica="Combate mais fácil, mas o filhote foge à própria sorte"),
        ],
        texto_flag={"grupo_rhiannon": [
            "Rhiannon e os outros cuidam dos dois capangas que acompanham Jack. Ele é todo seu."]},
    ),
    "c5_dragoes": Cena(
        "Os escolhidos",
        [
            "Jack foge entre as árvores, sangrando e humilhado.",
            "Então o chão treme. Seis dragões saem da mata e cercam a clareira. O calor que vem deles "
            "faz o ar ondular. Um deles vai te escolher, e você sente que pode se aproximar de apenas um.",
        ],
        [
            Opcao("Kaelthar: vermelho, Rabo de Espada", dragao="vermelho", ir="c5_vinculo",
                  dica="Força bruta. Sinete: Invocar Relâmpagos"),
            Opcao("Morvhen: preto, Rabo de Adaga", dragao="preto", ir="c5_vinculo",
                  dica="Velocidade. Sinete: Manipular Sombras"),
            Opcao("Siolra: azul, Rabo de Escorpião", dragao="azul", ir="c5_vinculo",
                  dica="Resistência. Sinete: Congelar"),
            Opcao("Brannoc: verde, Rabo de Clava", dragao="verde", ir="c5_vinculo",
                  dica="Sabedoria. Sinete: Ler Intenções"),
            Opcao("Lasair: laranja, Rabo de Espada", dragao="laranja", ir="c5_vinculo",
                  dica="Fúria imprevisível. Sinete: Invocar Explosões"),
            Opcao("Dúnmor: marrom, Rabo de Maça", dragao="marrom", ir="c5_vinculo",
                  dica="Lealdade e proteção. Sinete: Abalar a Terra"),
            Opcao("Órla: o filhote dourado, Rabo de Penas", dragao="dourado", ir="c5_vinculo",
                  requer_flag="protegeu_filhote", dica="Raríssima. Sinete: Deter o Tempo"),
        ],
        texto_flag={"protegeu_filhote": [
            "Por último, contra todas as regras do Vale, o filhote dourado que você protegeu volta e se "
            "coloca entre os gigantes, encarando você sem medo."]},
    ),
    "c5_vinculo": Cena(
        "O vínculo",
        [
            "{dragao}, o dragão {cor} {raca}, abaixa a cabeça até ficar à altura dos seus olhos. "
            "Então uma voz que não é sua ecoa dentro da sua mente, grave e antiga, e diz que você serve.",
            "Uma dor aguda queima seu ombro, onde a relíquia do vínculo vai marcar sua pele. Uma "
            "energia nova corre pelo seu sangue: em algumas semanas ela vai se manifestar como o seu "
            "sinete, {sinete}.",
            "Você saiu do Vale como cavaleiro(a).",
        ],
        [Opcao("Voltar a Basgiath montado(a) em {dragao}", efeitos={"xp": 50}, fim_capitulo=True)],
        apresentar_dragao=True,
    ),

    # =================================================================
    #   CAPÍTULO 6 — ASAS E SINETES
    # =================================================================
    "c6_inicio": Cena(
        "O primeiro voo",
        [
            "Montar é uma coisa. Continuar montado(a) é outra. {dragao} não facilita nada: mergulha, gira, "
            "sobe em espiral, e você precisa se manter na sela só com as pernas e a força de vontade.",
        ],
        [
            Opcao("Se agarrar e confiar no seu equilíbrio",
                  teste={"atributo": "agilidade", "cd": 12, "sucesso": "c6_sinete", "falha": "c6_sinete", "dano": 15,
                         "efeitos_sucesso": {"xp": 30}},
                  dica="Teste de agilidade (CD 12)"),
            Opcao("Prever as manobras pela postura de {dragao}",
                  teste={"atributo": "astucia", "cd": 12, "sucesso": "c6_sinete", "falha": "c6_sinete", "dano": 15,
                         "efeitos_sucesso": {"xp": 30}},
                  dica="Teste de astúcia (CD 12)"),
        ],
    ),
    "c6_sinete": Cena(
        "O professor Carr",
        [
            "Seu sinete se manifestou: {sinete}. O professor Carr, que treina os sinetes dos cadetes, "
            "explica sem rodeios que um poder que não se controla mata primeiro quem o carrega.",
            "Os treinos são exaustivos. Até onde você vai forçar?",
        ],
        [
            Opcao("Até o limite, mesmo que doa", "c6_jogos",
                  efeitos={"atributos": {"poder_max": 12}, "dano": 12}, dica="+12 poder máximo, -12 de vida"),
            Opcao("Com cautela e controle", "c6_jogos",
                  efeitos={"atributos": {"poder_max": 6}}, dica="+6 poder máximo"),
        ],
    ),
    "c6_jogos": Cena(
        "Exercícios de guerra",
        [
            "Os exercícios de guerra colocam as asas umas contra as outras. O objetivo da Quarta Asa é "
            "capturar a bandeira da Primeira Asa num pico ao norte. As regras dizem que ninguém deve morrer, "
            "mas todo ano alguém morre.",
            "Um cavaleiro da Primeira Asa e o dragão dele estão no caminho.",
        ],
        [
            Opcao("Atacar de frente com {dragao}",
                  combate={"inimigo": "primeira_asa", "vitoria": "c6_fim", "dragao": True}),
            Opcao("Propor um ataque pelo flanco ao seu esquadrão",
                  teste={"atributo": "astucia", "cd": 14, "sucesso": "c6_flanco", "falha": "c6_frontal", "dano": 0},
                  dica="Teste de astúcia (CD 14): sucesso deixa o inimigo exposto e ferido"),
        ],
    ),
    "c6_flanco": Cena(
        "Pelo flanco",
        ["O plano funciona: Rhiannon distrai o inimigo pela frente enquanto você mergulha pelo lado cego dele."],
        [Opcao("Mergulhar sobre o inimigo",
               combate={"inimigo": "primeira_asa", "vitoria": "c6_fim", "dragao": True,
                        "vida_pct": 0.8, "efeitos_inimigo": {"exposto": 2}})],
    ),
    "c6_frontal": Cena(
        "Plano descartado",
        ["Dain acha o plano arriscado demais e não aceita. Vai ter que ser de frente."],
        [Opcao("Atacar", combate={"inimigo": "primeira_asa", "vitoria": "c6_fim", "dragao": True})],
    ),
    "c6_fim": Cena(
        "A bandeira",
        [
            "A Quarta Asa captura a bandeira. Na comemoração, Xaden te entrega um pacote pesado: uma "
            "armadura justa, reforçada com escamas de dragão. Ele diz que não pode estar sempre por perto "
            "e precisa saber que você vai voltar inteiro(a).",
            "Dias depois, chega a ordem: seu esquadrão vai acompanhar a ala de Xaden numa missão de "
            "treinamento num posto da fronteira, perto de Resson.",
        ],
        [Opcao("Vestir a armadura e se preparar para partir",
               efeitos={"xp": 40, "itens": ["ArmaduraDeEscamas", "FolhaDeSalgueiro", "TonicoCurativo"]},
               fim_capitulo=True)],
    ),

    # =================================================================
    #   CAPÍTULO 7 — RESSON
    # =================================================================
    "c7_inicio": Cena(
        "Fumaça no horizonte",
        [
            "O posto de Resson deveria ser tranquilo. Mas, quando vocês chegam, há fumaça subindo da vila "
            "e gritos vindo dos muros.",
            "No céu, criaturas que você só viu em livros proibidos, ou em nenhum livro: parecem dragões, "
            "mas são menores, cinzentas, com olhos vazios. Wyverns. Navarre ensina que elas são lenda.",
            "Uma delas mergulha sobre um grupo de civis que corre para a muralha.",
        ],
        [
            Opcao("Interceptar a wyvern com {dragao}",
                  combate={"inimigo": "wyvern", "vitoria": "c7_venin", "dragao": True}),
        ],
    ),
    "c7_venin": Cena(
        "O dominador das trevas",
        [
            "A wyvern cai e se desfaz em pó antes de tocar o chão. No meio da praça, uma figura de manto "
            "observa tudo calmamente. A grama aos pés dela está seca e cinzenta. As veias ao redor dos "
            "olhos estão vermelhas.",
            "Xaden pousa ao seu lado e diz o nome que Navarre jurou não existir: venin. Eles drenam a magia "
            "da terra, e as wyverns são criação deles. Ele sabia, e outros sabem também. A guerra que te "
            "ensinaram é só metade da verdade.",
            "O venin sorri e começa a caminhar na sua direção.",
        ],
        [
            Opcao("Enfrentar o venin",
                  combate={"inimigo": "venin", "vitoria": "c7_fim", "dragao": True}),
            Opcao("Pedir para {dragao} atacar primeiro, do alto",
                  teste={"atributo": "astucia", "cd": 14, "sucesso": "c7_ataque_aereo", "falha": "c7_direto", "dano": 10},
                  dica="Teste de astúcia (CD 14): sucesso fere o venin antes do combate"),
        ],
    ),
    "c7_ataque_aereo": Cena(
        "Fogo do céu",
        ["{dragao} mergulha das nuvens e envolve o venin em fogo. Ele sai das chamas ferido e furioso."],
        [Opcao("Atacar enquanto ele está ferido",
               combate={"inimigo": "venin", "vitoria": "c7_fim", "dragao": True, "vida_pct": 0.75})],
    ),
    "c7_direto": Cena(
        "Sem surpresa",
        ["O venin percebe o mergulho e uma onda de magia sombria joga você contra o chão. Ele está pronto."],
        [Opcao("Levantar e lutar", combate={"inimigo": "venin", "vitoria": "c7_fim", "dragao": True})],
    ),
    "c7_fim": Cena(
        "O que Navarre esconde",
        [
            "O venin cai. Seu corpo seca e se esfarela como se estivesse morto há séculos. O silêncio que "
            "fica na praça é pior que os gritos.",
            "No voo de volta, Xaden te conta o resto: as relíquias da rebelião, os povos de Poromiel que "
            "morrem defendendo uma fronteira que Navarre finge não enxergar, e as armas que alguns cavaleiros "
            "contrabandeiam em segredo.",
            "Você volta a Basgiath com um segredo que pode te matar e um dragão que nunca vai te deixar "
            "sozinho(a). O primeiro ano ainda não terminou, mas você já não é quem atravessou o Parapeito.",
        ],
        [Opcao("Fim do primeiro ato", efeitos={"xp": 60}, fim_capitulo=True)],
    ),
}
