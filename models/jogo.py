from __future__ import annotations
import random

from models.logger import Logger
from models.personagem import ARQUETIPOS, Cadete
from models.inimigo import criar_inimigo
from models.combate import Combate
from models.catalogo import criar_item
from models.equipamentos import Equipamento
from models.campanha import CAPITULOS, CENAS, AMBIENTE_CENAS
from models.dragao import criar_dragao
from utils import salvamento

NOMES_ATRIBUTOS = {
    "agilidade": "Agilidade", "astucia": "Astúcia", "forca": "Força", "ataque": "Ataque",
    "defesa": "Defesa", "vida_max": "Vida máxima", "poder_max": "Poder máximo",
}

CENARIOS_TREINO = {
    "Tatame": {"inimigos": ["rival", "veterano"], "dragao": False,
               "descricao": "Desafios corpo a corpo contra outros cadetes. Dragões não entram no tatame."},
    "Campo de Voo": {"inimigos": ["grifo", "primeira_asa"], "dragao": True,
                     "descricao": "Combate aéreo simulado. Exige um dragão vinculado."},
    "Fronteira": {"inimigos": ["wyvern", "grifo"], "dragao": True,
                  "descricao": "Patrulhas reais perto das montanhas. Liberado após Resson."},
}

# multiplicador de atributos do inimigo, multiplicador de recompensa, rolagens de item
DIFICULDADES = {"Fácil": (1.0, 1.0, 1), "Média": (1.2, 1.3, 2), "Difícil": (1.45, 1.6, 3)}

TABELA_ITENS = [("TonicoCurativo", 50), ("ElixirDeVigor", 25), ("OleoDeLamina", 15), ("FolhaDeSalgueiro", 10)]


class Jogo:
    """Núcleo do jogo: máquina de estados independente da interface.

    As interfaces (terminal ou web) só fazem duas coisas:
      - `estado()`: devolve um dicionário descrevendo a tela atual;
      - `agir(id, texto)`: aplica a opção escolhida pelo jogador.
    """

    def __init__(self) -> None:
        self.logger = Logger()
        self.repo = salvamento.repo
        self.encerrado = False
        self.tela = "titulo"
        self.retorno = "titulo"
        self.mensagens: list[str] = []
        self.sons: list[str] = []   # efeitos sonoros gerados pela última ação (usados pelo front web)
        self.pagina_logs = 0
        self._novo_estado()

    def _novo_estado(self) -> None:
        self.cadete: Cadete | None = None
        self.capitulo = 1
        self.cena_id: str | None = None
        self.flags: set[str] = set()
        self.combate: Combate | None = None
        self.ctx_combate: dict | None = None
        self.subtela: str | None = None
        self.treino = {"cenario": "Tatame", "dificuldade": "Fácil"}
        self.checkpoint: dict | None = None
        self.campanha_concluida = False
        self.criacao = {"nome": None, "arquetipo": None}
        self.notas: list[str] = []          # resultados exibidos em destaque na próxima tela
        self.resultado: dict | None = None  # resumo do último combate

    # =================================================================
    #   API PÚBLICA
    # =================================================================
    def estado(self) -> dict:
        tela = getattr(self, f"_tela_{self.tela}")()
        return {
            "tela": self.tela,
            "titulo": tela.get("titulo", ""),
            "subtitulo": tela.get("subtitulo", ""),
            "texto": tela.get("texto", []),
            "destaque": tela.get("destaque", []),
            "monoespacado": tela.get("monoespacado", False),
            "dragao_apresentado": tela.get("dragao_apresentado"),
            "opcoes": self._numerar(tela.get("opcoes", [])),
            "entrada": tela.get("entrada"),
            "mensagens": list(self.mensagens),
            "cadete": self._cadete_dict(),
            "combate": self.combate.to_dict() if self.combate and self.tela in ("combate", "pos_combate") else None,
            "progresso": self._progresso(),
            "ambiente": self._ambiente(),
        }

    def agir(self, op_id: str, texto: str | None = None) -> None:
        self.mensagens = []
        self.sons = []
        tela = getattr(self, f"_tela_{self.tela}")()
        validas = {o["id"]: o for o in tela.get("opcoes", [])}
        opcao = validas.get(op_id)
        if not opcao:
            self.mensagens.append("Opção inválida.")
            self._som("erro")
            return
        if opcao.get("desabilitada"):
            self.mensagens.append(opcao.get("dica") or "Opção indisponível no momento.")
            self._som("erro")
            return
        try:
            getattr(self, f"_agir_{self.tela}")(op_id, (texto or "").strip())
        except Exception as e:  # nunca derruba a interface por erro de regra
            self.logger.log(f"Erro em {self.tela}/{op_id}: {e!r}", tipo="ERRO")
            self.mensagens.append(f"[ERRO] {e}")
            self._som("erro")

    # =================================================================
    #   SOM
    # =================================================================
    def _som(self, *nomes: str) -> None:
        self.sons.extend(nomes)

    def consumir_sons(self) -> list[str]:
        sons, self.sons = self.sons, []
        return sons

    def _ambiente_cena(self) -> str:
        return AMBIENTE_CENAS.get(self.cena_id, CAPITULOS[self.capitulo - 1].ambiente)

    def _ambiente(self) -> str:
        """Som ambiente da tela atual (o front web cria os loops)."""
        t = self.tela
        if t in ("titulo", "sobre", "criacao_nome", "criacao_arquetipo", "criacao_confirmar", "final"):
            return "titulo"
        if t == "morte":
            return "silencio"
        if t == "combate" and self.combate:
            return "chefe" if self.combate.inimigo.chefe else "combate"
        na_historia = (t == "narrativa"
                       or (t == "pos_combate" and self.ctx_combate and self.ctx_combate["tipo"] == "historia")
                       or (t in ("inventario", "ficha") and self.retorno == "narrativa"))
        return self._ambiente_cena() if na_historia and self.cena_id else "quartel"

    # =================================================================
    #   AUXILIARES DE APRESENTAÇÃO
    # =================================================================
    @staticmethod
    def _numerar(opcoes: list[dict]) -> list[dict]:
        teclas = iter("123456789abcdefghjklmnopqrstuvwxyz")
        for o in opcoes:
            o["tecla"] = "0" if o.get("voltar") else next(teclas)
        return opcoes

    def _fmt(self, texto: str) -> str:
        c = self.cadete
        d = c.dragao if c else None
        valores = {
            "nome": c.nome if c else "", "arquetipo": c.arquetipo if c else "",
            "dragao": d.nome if d else "seu dragão", "cor": d.cor.lower() if d else "",
            "raca": d.raca if d else "", "sinete": d.sinete.nome if d else "seu sinete",
        }
        try:
            return texto.format(**valores)
        except (KeyError, IndexError, ValueError):
            return texto

    def _cadete_dict(self) -> dict | None:
        c = self.cadete
        if not c:
            return None
        d = c.dragao
        return {
            "nome": c.nome, "arquetipo": c.arquetipo, "nivel": c.nivel,
            "xp": c.xp, "xp_prox": c.xp_prox,
            "vida": c.vida, "vida_max": c.vida_max, "poder": c.poder, "poder_max": c.poder_max,
            "ataque": c.ataque_total, "defesa": c.defesa_total,
            "agilidade": c.agilidade_total, "astucia": c.astucia_total,
            "critico": round(c.chance_critico * 100), "esquiva": round(c.chance_esquiva * 100),
            "habilidade": {"nome": c.nome_habilidade, "descricao": c.descricao_habilidade},
            "efeitos": dict(c.efeitos),
            "equipamentos": [{"nome": e.nome, "resumo": e.resumo()} for e in c.equipamentos],
            "itens": [{"nome": i.nome, "qtd": q} for i, q in c.inventario.agrupado()],
            "dragao": d.apresentacao() if d else None,
        }

    def _progresso(self) -> dict:
        caps = []
        for cap in CAPITULOS:
            if self.campanha_concluida or cap.numero < self.capitulo:
                st = "concluido"
            elif cap.numero == self.capitulo and self.cadete:
                st = "atual"
            else:
                st = "bloqueado"
            caps.append({"numero": cap.numero, "titulo": cap.titulo, "estado": st})
        return {"capitulo": self.capitulo, "total": len(CAPITULOS),
                "concluida": self.campanha_concluida, "capitulos": caps}

    def _ir(self, tela: str, retorno: str | None = None) -> None:
        if retorno:
            self.retorno = retorno
        self.tela = tela

    # =================================================================
    #   TÍTULO / SOBRE
    # =================================================================
    def _tela_titulo(self):
        opcoes = []
        if self.cadete:
            opcoes.append({"id": "continuar", "rotulo": f"Continuar a jornada de {self.cadete.nome}"})
        opcoes.append({"id": "novo", "rotulo": "Novo cadete"})
        if self.repo.listar():
            opcoes.append({"id": "carregar", "rotulo": "Carregar jogo"})
        opcoes += [
            {"id": "logs", "rotulo": "Diário de bordo (logs)"},
            {"id": "sobre", "rotulo": "Sobre esta adaptação"},
            {"id": "sair", "rotulo": "Sair", "voltar": True, "terminal": True},
        ]
        return {
            "titulo": "Quarta Asa",
            "subtitulo": "Um RPG no Quadrante dos Cavaleiros de Basgiath",
            "texto": [
                "Na Escola de Guerra Basgiath, todo cadete do Quadrante dos Cavaleiros sai de duas formas: "
                "formado ou na lista dos mortos.",
                "Atravesse o Parapeito, sobreviva aos desafios, seja escolhido por um dragão na Debulha e "
                "descubra o que Navarre esconde além da fronteira.",
            ],
            "opcoes": opcoes,
        }

    def _agir_titulo(self, op, texto):
        if op == "continuar":
            self._ir("hub")
        elif op == "novo":
            self._novo_estado()
            self._ir("criacao_nome")
        elif op == "carregar":
            self._ir("carregar", retorno="titulo")
        elif op == "logs":
            self.pagina_logs = -1
            self._ir("logs", retorno="titulo")
        elif op == "sobre":
            self._ir("sobre")
        elif op == "sair":
            self.encerrado = True

    def _tela_sobre(self):
        return {
            "titulo": "Sobre esta adaptação",
            "texto": [
                "Este RPG é uma adaptação de fã, feita para fins educacionais, inspirada no livro "
                "Quarta Asa (Fourth Wing), de Rebecca Yarros. O mundo, os lugares e os personagens "
                "pertencem à autora. Todos os textos do jogo são originais.",
                "Projeto de Paradigmas de Programação: Python com Programação Orientada a Objetos "
                "(herança, polimorfismo, encapsulamento e abstração).",
                "Como jogar: crie um cadete, escolha um arquétipo e siga os 7 capítulos da campanha. "
                "Entre um capítulo e outro, treine no Quadrante para ganhar experiência e itens.",
            ],
            "opcoes": [{"id": "voltar", "rotulo": "Voltar", "voltar": True}],
        }

    def _agir_sobre(self, op, texto):
        self._ir("titulo")

    # =================================================================
    #   CRIAÇÃO DE CADETE
    # =================================================================
    def _tela_criacao_nome(self):
        return {
            "titulo": "Registro de candidato",
            "texto": ["O escriba na mesa de registro mergulha a pena no tinteiro sem olhar para você. "
                      "Ele pergunta seu nome."],
            "entrada": {"id": "nome", "rotulo": "Nome do cadete", "max": 24,
                        "valor": self.criacao["nome"] or ""},
            "opcoes": [{"id": "enviar", "rotulo": "Confirmar nome", "entrada": True},
                       {"id": "voltar", "rotulo": "Voltar", "voltar": True}],
        }

    def _agir_criacao_nome(self, op, texto):
        if op == "voltar":
            self._ir("titulo")
            return
        nome = " ".join(texto.split())[:24]
        if not nome:
            self.mensagens.append("Digite um nome.")
            return
        self.criacao["nome"] = nome
        self._ir("criacao_arquetipo")

    def _tela_criacao_arquetipo(self):
        opcoes = []
        for chave, cls in ARQUETIPOS.items():
            ex = cls("x")
            opcoes.append({
                "id": chave, "rotulo": cls.arquetipo,
                "dica": f"{cls.descricao} Vida {ex.vida_max} · ATQ {ex.ataque} · DEF {ex.defesa} · "
                        f"AGI {ex.agilidade} · AST {ex.astucia} · Poder {ex.poder_max}. "
                        f"Habilidade: {cls.nome_habilidade}.",
            })
        opcoes.append({"id": "voltar", "rotulo": "Voltar", "voltar": True})
        return {
            "titulo": "Escolha seu arquétipo",
            "texto": [f"{self.criacao['nome']}, como você luta?"],
            "opcoes": opcoes,
        }

    def _agir_criacao_arquetipo(self, op, texto):
        if op == "voltar":
            self._ir("criacao_nome")
            return
        self.criacao["arquetipo"] = op
        self._ir("criacao_confirmar")

    def _tela_criacao_confirmar(self):
        cls = ARQUETIPOS[self.criacao["arquetipo"]]
        ex = cls(self.criacao["nome"])
        return {
            "titulo": "Confirmar cadete",
            "texto": [
                f"Nome: {ex.nome}",
                f"Arquétipo: {cls.arquetipo}. {cls.descricao}",
                f"Vida {ex.vida_max} · Ataque {ex.ataque} · Defesa {ex.defesa} · Poder {ex.poder_max}",
                f"Agilidade {ex.agilidade} · Astúcia {ex.astucia}",
                f"Habilidade: {cls.nome_habilidade}: {cls.descricao_habilidade}",
            ],
            "opcoes": [
                {"id": "confirmar", "rotulo": "Entrar na fila do Quadrante dos Cavaleiros"},
                {"id": "arquetipo", "rotulo": "Trocar arquétipo"},
                {"id": "nome", "rotulo": "Trocar nome"},
            ],
        }

    def _agir_criacao_confirmar(self, op, texto):
        if op == "arquetipo":
            self._ir("criacao_arquetipo")
        elif op == "nome":
            self._ir("criacao_nome")
        elif op == "confirmar":
            self.cadete = ARQUETIPOS[self.criacao["arquetipo"]](self.criacao["nome"])
            self.cadete.adicionar_item(criar_item("TonicoCurativo"))
            self.cadete.adicionar_item(criar_item("TonicoCurativo"))
            self.logger.log(f"Cadete criado: {self.cadete.nome} ({self.cadete.arquetipo}).")
            self._iniciar_capitulo()

    # =================================================================
    #   HUB — QUADRANTE DOS CAVALEIROS
    # =================================================================
    def _tela_hub(self):
        c = self.cadete
        if self.campanha_concluida:
            texto = ["O primeiro ato terminou. Você carrega o segredo de Resson e continua treinando para o "
                     "que está por vir. A Fronteira agora está aberta para patrulhas."]
        else:
            cap = CAPITULOS[self.capitulo - 1]
            texto = [f"Próximo: Capítulo {cap.numero}: {cap.titulo}.", cap.resumo]
        opcoes = []
        if not self.campanha_concluida:
            cap = CAPITULOS[self.capitulo - 1]
            opcoes.append({"id": "avancar", "rotulo": f"▶ Capítulo {cap.numero}: {cap.titulo}"})
        ferido = c.vida < c.vida_max or c.poder < c.poder_max
        opcoes += [
            {"id": "treino", "rotulo": "Treinar (missões livres)", "dica": "Ganhe XP e itens em combates opcionais."},
            {"id": "enfermaria", "rotulo": "Enfermaria dos curandeiros", "desabilitada": not ferido,
             "dica": "Recupera toda a vida e o poder." if ferido else "Você já está em plena forma."},
            {"id": "inventario", "rotulo": "Inventário"},
            {"id": "ficha", "rotulo": "Ficha do cadete"},
            {"id": "salvar", "rotulo": "Salvar jogo"},
            {"id": "carregar", "rotulo": "Carregar jogo"},
            {"id": "logs", "rotulo": "Diário de bordo (logs)"},
            {"id": "menu", "rotulo": "Menu principal", "voltar": True},
        ]
        return {"titulo": "Quadrante dos Cavaleiros", "subtitulo": "Escola de Guerra Basgiath",
                "texto": texto, "destaque": self._consumir_notas(), "opcoes": opcoes}

    def _agir_hub(self, op, texto):
        if op == "avancar":
            self._iniciar_capitulo()
        elif op == "treino":
            self._ir("treino")
        elif op == "enfermaria":
            self.cadete.descansar()
            self.mensagens.append("Os curandeiros cuidam dos seus ferimentos. Vida e poder restaurados.")
            self._som("cura")
            self.logger.log("Visitou a enfermaria.")
        elif op == "inventario":
            self._ir("inventario", retorno="hub")
        elif op == "ficha":
            self._ir("ficha", retorno="hub")
        elif op == "salvar":
            self._ir("salvar", retorno="hub")
        elif op == "carregar":
            self._ir("carregar", retorno="hub")
        elif op == "logs":
            self.pagina_logs = -1
            self._ir("logs", retorno="hub")
        elif op == "menu":
            self._ir("titulo")

    def _consumir_notas(self) -> list[str]:
        notas, self.notas = self.notas, []
        return notas

    # =================================================================
    #   CAMPANHA
    # =================================================================
    def _iniciar_capitulo(self) -> None:
        cap = CAPITULOS[self.capitulo - 1]
        self.checkpoint = self._serializar(incluir_logs=False)
        self.cena_id = cap.inicio
        self.logger.log(f"Capítulo {cap.numero} iniciado: {cap.titulo}.", tipo="HISTÓRIA")
        self._som("inicio")
        self._ir("narrativa")

    def _concluir_capitulo(self) -> None:
        cap = CAPITULOS[self.capitulo - 1]
        self.logger.log(f"Capítulo {cap.numero} concluído: {cap.titulo}.", tipo="HISTÓRIA")
        self.cadete.descansar()
        self.capitulo += 1
        if self.capitulo > len(CAPITULOS):
            self.capitulo = len(CAPITULOS)
            self.campanha_concluida = True
        self._autosalvar()
        self._som("|", "final" if self.campanha_concluida else "capitulo")
        self._ir("final" if self.campanha_concluida else "capitulo_fim")

    def _opcoes_visiveis(self, cena):
        return [o for o in cena.opcoes if not o.requer_flag or o.requer_flag in self.flags]

    def _tela_narrativa(self):
        cena = CENAS[self.cena_id]
        cap = CAPITULOS[self.capitulo - 1]
        texto = [self._fmt(t) for t in cena.texto]
        for flag, extra in cena.texto_flag.items():
            if flag in self.flags:
                texto += [self._fmt(t) for t in extra]
        opcoes = []
        for i, o in enumerate(self._opcoes_visiveis(cena)):
            opcao = {"id": f"op{i}", "rotulo": self._fmt(o.rotulo), "dica": self._fmt(o.dica)}
            if o.dragao:
                opcao["dragao"] = criar_dragao(o.dragao).apresentacao()
            opcoes.append(opcao)
        opcoes.append({"id": "inventario", "rotulo": "🎒 Inventário", "secundaria": True})
        tela = {"titulo": cena.titulo, "subtitulo": f"Capítulo {cap.numero}: {cap.titulo}",
                "texto": texto, "destaque": list(self.notas), "opcoes": opcoes}
        if cena.apresentar_dragao and self.cadete.dragao:
            tela["dragao_apresentado"] = self.cadete.dragao.apresentacao()
        return tela

    def _agir_narrativa(self, op, texto):
        if op == "inventario":
            self._ir("inventario", retorno="narrativa")
            return
        opcao = self._opcoes_visiveis(CENAS[self.cena_id])[int(op[2:])]
        self.notas = []
        self.notas += self._aplicar_efeitos(opcao.efeitos)
        if not self.cadete.esta_vivo():
            return self._morrer()

        if opcao.dragao:
            self.cadete.vincular_dragao(opcao.dragao)
            d = self.cadete.dragao
            self.notas.append(f"🐉 Vínculo formado com {d.nome}, {d.cor.lower()} {d.raca}. "
                              f"Sinete: {d.sinete.nome}.")
            self.logger.log(f"Vínculo com o dragão {d.nome} ({d.cor}, {d.raca}).", tipo="HISTÓRIA")
            self._som("vinculo")

        if opcao.teste:
            destino = self._resolver_teste(opcao.teste)
            if not self.cadete.esta_vivo():
                return self._morrer()
            self.cena_id = destino
            self._som("pagina")
        elif opcao.combate:
            self._iniciar_combate_historia(opcao.combate)
        elif opcao.fim_capitulo:
            self._concluir_capitulo()
        elif opcao.ir:
            self.cena_id = opcao.ir
            self._som("pagina")

    def _resolver_teste(self, teste: dict) -> str:
        attr = teste["atributo"]
        valor = self.cadete.atributo_teste(attr)
        dado = random.randint(1, 20)
        total = dado + valor
        sucesso = dado == 20 or (dado != 1 and total >= teste["cd"])
        nome_attr = NOMES_ATRIBUTOS[attr]
        resultado = "Sucesso!" if sucesso else "Falha."
        self.notas.append(f"🎲 Teste de {nome_attr}: {dado} + {valor} = {total} contra CD {teste['cd']}: {resultado}")
        self.logger.log(f"Teste de {nome_attr}: {total} vs CD {teste['cd']}: {resultado}", tipo="HISTÓRIA")
        self._som("dado", "|", "sucesso" if sucesso else "falha")
        if sucesso:
            self.notas += self._aplicar_efeitos(teste.get("efeitos_sucesso", {}))
            return teste["sucesso"]
        if teste.get("dano"):
            self.notas += self._aplicar_efeitos({"dano": teste["dano"]})
        return teste["falha"]

    def _aplicar_efeitos(self, ef: dict) -> list[str]:
        c, notas = self.cadete, []
        for nome, valor in ef.get("atributos", {}).items():
            c.ajustar_atributo(nome, valor)
            self._som("atributo")
            notas.append(f"{'+' if valor > 0 else ''}{valor} {NOMES_ATRIBUTOS.get(nome, nome)}")
        if ef.get("cura"):
            notas.append(f"+{c.curar(ef['cura'])} de vida")
        if ef.get("dano"):
            notas.append(f"-{c.receber_dano(ef['dano'])} de vida")
            self._som("dano")
        for tipo in ef.get("itens", []):
            item = criar_item(tipo)
            if isinstance(item, Equipamento):
                notas.append(f"🎁 {item.usar(c)}")
                self._som("equipar")
            elif item:
                c.adicionar_item(item)
                notas.append(f"🎁 Recebeu: {item.nome}")
                self._som("item")
            self.logger.log(f"Item obtido: {item.nome}.")
        self.flags.update(ef.get("flags", []))
        if ef.get("xp"):
            notas += self._ganhar_xp(ef["xp"])
        return notas

    def _ganhar_xp(self, quantidade: int) -> list[str]:
        linhas = self.cadete.ganhar_xp(quantidade)
        if any(linha.startswith("⬆") for linha in linhas):
            self._som("|", "nivel")
        return linhas

    def _tela_capitulo_fim(self):
        anterior = CAPITULOS[self.capitulo - 2]
        proximo = CAPITULOS[self.capitulo - 1]
        return {
            "titulo": f"Capítulo {anterior.numero} concluído",
            "subtitulo": anterior.titulo,
            "texto": ["Você sobreviveu. Os curandeiros cuidaram dos seus ferimentos e o progresso foi salvo "
                      "automaticamente.",
                      f"A seguir: Capítulo {proximo.numero}: {proximo.titulo}. {proximo.resumo}"],
            "destaque": list(self.notas),
            "opcoes": [{"id": "seguir", "rotulo": f"▶ Seguir para o Capítulo {proximo.numero}"},
                       {"id": "hub", "rotulo": "Voltar ao Quadrante (treinar, salvar, inventário)"}],
        }

    def _agir_capitulo_fim(self, op, texto):
        self.notas = []
        if op == "seguir":
            self._iniciar_capitulo()
        else:
            self._ir("hub")

    def _tela_final(self):
        return {
            "titulo": "Fim do primeiro ato",
            "subtitulo": f"{self.cadete.nome}, cavaleiro(a) de {self.cadete.dragao.nome if self.cadete.dragao else 'Basgiath'}",
            "texto": [
                "Você atravessou o Parapeito, sobreviveu à lista dos mortos, foi escolhido(a) na Debulha e "
                "enfrentou um venin em Resson.",
                "O jogo continua: volte ao Quadrante para treinar e patrulhar a Fronteira.",
            ],
            "destaque": list(self.notas),
            "opcoes": [{"id": "hub", "rotulo": "Voltar ao Quadrante"}],
        }

    def _agir_final(self, op, texto):
        self.notas = []
        self._ir("hub")

    # =================================================================
    #   COMBATE
    # =================================================================
    def _iniciar_combate_historia(self, cfg: dict) -> None:
        inimigo = criar_inimigo(cfg["inimigo"], **cfg.get("kwargs", {}))
        if cfg.get("vida_pct"):
            inimigo.vida = int(inimigo.vida_max * cfg["vida_pct"])
        for efeito, turnos in cfg.get("efeitos_inimigo", {}).items():
            inimigo.aplicar_efeito(efeito, turnos)
        self.combate = Combate(self.cadete, inimigo, permite_dragao=cfg.get("dragao", True), permite_fuga=False)
        self.ctx_combate = {"tipo": "historia", "vitoria": cfg["vitoria"]}
        self.subtela = None
        self.logger.log_batalha(f"Combate iniciado contra {inimigo.nome}.")
        self._som("combate_inicio", *(["chefe"] if inimigo.chefe else []))
        self._ir("combate")

    def _tela_combate(self):
        cb = self.combate
        ini = cb.inimigo
        if self.subtela == "itens":
            opcoes = [{"id": f"item:{i.tipo}", "rotulo": f"{i.nome} x{q}", "dica": i.descricao,
                       "desabilitada": not i.util_para(self.cadete)}
                      for i, q in self.cadete.inventario.agrupado() if i.usavel_em_combate]
            opcoes.append({"id": "voltar", "rotulo": "Voltar", "voltar": True})
            return {"titulo": ini.nome, "subtitulo": "Escolha um item", "texto": [ini.descricao], "opcoes": opcoes}
        opcoes = cb.acoes()
        sub = "Treino" if self.ctx_combate["tipo"] == "treino" else f"Capítulo {self.capitulo}"
        return {"titulo": ini.nome, "subtitulo": f"{sub} · Turno {cb.turno}",
                "texto": [ini.descricao], "destaque": list(self.notas), "opcoes": opcoes}

    def _agir_combate(self, op, texto):
        cb = self.combate
        self.notas = []
        if op == "itens":
            self.subtela = "itens"
            return
        if op == "voltar":
            self.subtela = None
            return
        if op.startswith("item:"):
            item = self.cadete.inventario.pegar_por_tipo(op[5:])
            self.subtela = None
            cb.executar("item", item)
            self._som(*cb.sons)
        else:
            cb.executar(op)
            self._som(*cb.sons)
        if cb.terminado:
            self._finalizar_combate()

    def _finalizar_combate(self) -> None:
        cb, c = self.combate, self.cadete
        ini = cb.inimigo
        c.buff_ataque = 0
        c.limpar_efeitos()
        linhas = []
        treino = self.ctx_combate["tipo"] == "treino"
        if cb.vitoria:
            self.logger.log_batalha(f"Vitória contra {ini.nome} em {cb.turno} turnos.")
            linhas += self._ganhar_xp(ini.xp)
            if treino:
                linhas += self._recompensa_treino()
            self.resultado = {"vitoria": True, "titulo": "Vitória!", "linhas": linhas}
        elif cb.fugiu:
            self.logger.log_batalha(f"Recuou do combate contra {ini.nome}.")
            self.resultado = {"vitoria": False, "titulo": "Você recuou", "linhas": ["Sem recompensas desta vez."]}
        elif treino:
            c.vida = max(1, c.vida_max // 3)
            self.logger.log_batalha(f"Derrota no treino contra {ini.nome}.")
            self.resultado = {"vitoria": False, "titulo": "Derrota",
                              "linhas": ["Você apaga no meio do treino e acorda na enfermaria, "
                                         "com o orgulho mais ferido que o corpo."]}
        else:
            self.logger.log_batalha(f"Morte em combate contra {ini.nome}.")
            self._morrer()
            return
        for linha in linhas:
            if linha.startswith("⬆"):
                self.logger.log(linha.lstrip("⬆ "))
        self._ir("pos_combate")

    def _recompensa_treino(self) -> list[str]:
        rolagens = DIFICULDADES[self.ctx_combate["dificuldade"]][2]
        linhas = []
        tipos, pesos = zip(*TABELA_ITENS)
        for _ in range(rolagens):
            if random.random() < 0.6:
                item = criar_item(random.choices(tipos, weights=pesos)[0])
                self.cadete.adicionar_item(item)
                linhas.append(f"🎁 Recebeu: {item.nome}")
                self._som("item")
                self.logger.log(f"Item obtido: {item.nome}.")
        return linhas or ["Nenhum item encontrado desta vez."]

    def _tela_pos_combate(self):
        r = self.resultado
        rotulo = "Continuar a história" if self.ctx_combate["tipo"] == "historia" else "Voltar ao treino"
        return {"titulo": r["titulo"], "subtitulo": f"contra {self.combate.inimigo.nome}",
                "destaque": r["linhas"], "opcoes": [{"id": "continuar", "rotulo": rotulo}]}

    def _agir_pos_combate(self, op, texto):
        ctx = self.ctx_combate
        self.combate = None
        self.ctx_combate = None
        if ctx["tipo"] == "historia":
            self.notas = list(self.resultado["linhas"])
            self.cena_id = ctx["vitoria"]
            self._som("pagina")
            self._ir("narrativa")
        else:
            self._ir("treino")

    def _morrer(self) -> None:
        self.logger.log(f"{self.cadete.nome} morreu no capítulo {self.capitulo}.", tipo="HISTÓRIA")
        self.combate = None
        self._som("|", "morte")
        self._ir("morte")

    def _tela_morte(self):
        opcoes = []
        if self.checkpoint:
            opcoes.append({"id": "recomecar", "rotulo": f"Recomeçar o Capítulo {self.capitulo}"})
        if self.repo.listar():
            opcoes.append({"id": "carregar", "rotulo": "Carregar jogo"})
        opcoes.append({"id": "menu", "rotulo": "Menu principal", "voltar": True})
        return {
            "titulo": "A Lista dos Mortos",
            "texto": [f"Na formação da manhã seguinte, o nome de {self.cadete.nome} é lido em voz alta. "
                      "Alguns cadetes baixam a cabeça. A maioria apenas espera o próximo nome.",
                      "Em Basgiath, ninguém para por muito tempo."],
            "opcoes": opcoes,
        }

    def _agir_morte(self, op, texto):
        if op == "recomecar":
            self._restaurar(self.checkpoint)
            self.notas = []
            self._iniciar_capitulo()
        elif op == "carregar":
            self._ir("carregar", retorno="morte")
        else:
            self._novo_estado()
            self._ir("titulo")

    # =================================================================
    #   TREINO (missões livres com cenário e dificuldade)
    # =================================================================
    def _cenario_liberado(self, nome: str) -> bool:
        if nome == "Campo de Voo":
            return self.cadete.dragao is not None
        if nome == "Fronteira":
            return self.campanha_concluida or self.capitulo >= 7
        return True

    def _tela_treino(self):
        cfg = CENARIOS_TREINO[self.treino["cenario"]]
        return {
            "titulo": "Treino",
            "subtitulo": "Missões livres",
            "texto": [f"Cenário: {self.treino['cenario']}. {cfg['descricao']}",
                      f"Dificuldade: {self.treino['dificuldade']}. Quanto mais difícil, mais fortes os "
                      "inimigos e melhores as recompensas."],
            "destaque": list(self.notas),
            "opcoes": [
                {"id": "iniciar", "rotulo": "⚔ Iniciar combate"},
                {"id": "cenario", "rotulo": f"Cenário: {self.treino['cenario']}"},
                {"id": "dificuldade", "rotulo": f"Dificuldade: {self.treino['dificuldade']}"},
                {"id": "voltar", "rotulo": "Voltar ao Quadrante", "voltar": True},
            ],
        }

    def _agir_treino(self, op, texto):
        self.notas = []
        if op == "cenario":
            self._ir("treino_cenario")
        elif op == "dificuldade":
            self._ir("treino_dificuldade")
        elif op == "voltar":
            self._ir("hub")
        elif op == "iniciar":
            cfg = CENARIOS_TREINO[self.treino["cenario"]]
            mult_atrib, mult_xp, _ = DIFICULDADES[self.treino["dificuldade"]]
            fator_nivel = 1 + 0.07 * (self.cadete.nivel - 1)
            inimigo = criar_inimigo(random.choice(cfg["inimigos"])).escalar(mult_atrib * fator_nivel, mult_xp)
            self.combate = Combate(self.cadete, inimigo, permite_dragao=cfg["dragao"], permite_fuga=True)
            self.ctx_combate = {"tipo": "treino", "dificuldade": self.treino["dificuldade"]}
            self.subtela = None
            self._som("combate_inicio")
            self.logger.log_batalha(
                f"Treino iniciado: {self.treino['dificuldade']} / {self.treino['cenario']} contra {inimigo.nome}.")
            self._ir("combate")

    def _tela_treino_cenario(self):
        opcoes = []
        for nome, cfg in CENARIOS_TREINO.items():
            liberado = self._cenario_liberado(nome)
            opcoes.append({"id": nome, "rotulo": nome, "dica": cfg["descricao"], "desabilitada": not liberado})
        opcoes.append({"id": "voltar", "rotulo": "Voltar", "voltar": True})
        return {"titulo": "Escolha o cenário", "opcoes": opcoes}

    def _agir_treino_cenario(self, op, texto):
        if op != "voltar":
            self.treino["cenario"] = op
        self._ir("treino")

    def _tela_treino_dificuldade(self):
        dicas = {"Fácil": "Inimigos normais, 1 chance de item.",
                 "Média": "Inimigos +20%, XP x1,3, 2 chances de item.",
                 "Difícil": "Inimigos +45%, XP x1,6, 3 chances de item."}
        opcoes = [{"id": d, "rotulo": d, "dica": dicas[d]} for d in DIFICULDADES]
        opcoes.append({"id": "voltar", "rotulo": "Voltar", "voltar": True})
        return {"titulo": "Escolha a dificuldade", "opcoes": opcoes}

    def _agir_treino_dificuldade(self, op, texto):
        if op != "voltar":
            self.treino["dificuldade"] = op
        self._ir("treino")

    # =================================================================
    #   INVENTÁRIO / FICHA
    # =================================================================
    def _tela_inventario(self):
        c = self.cadete
        texto = []
        if c.equipamentos:
            texto.append("Equipado: " + ", ".join(f"{e.nome} ({e.resumo()})" for e in c.equipamentos))
        if c.inventario.esta_vazio():
            texto.append("Sua mochila está vazia.")
        opcoes = [{"id": f"usar:{i.tipo}", "rotulo": f"Usar {i.nome} x{q}",
                   "dica": i.descricao + (" Só pode ser usado em combate." if i.apenas_em_combate else ""),
                   "desabilitada": i.apenas_em_combate or not i.util_para(c)}
                  for i, q in c.inventario.agrupado()]
        opcoes.append({"id": "voltar", "rotulo": "Voltar", "voltar": True})
        return {"titulo": "Inventário", "texto": texto, "opcoes": opcoes}

    def _agir_inventario(self, op, texto):
        if op == "voltar":
            self._ir(self.retorno)
            return
        item = self.cadete.inventario.pegar_por_tipo(op[5:])
        self.mensagens.append(self.cadete.usar_item(item))
        self._som(item.som)
        self.logger.log(f"Usou {item.nome} fora de combate.")

    def _tela_ficha(self):
        c = self.cadete
        texto = [
            f"{c.nome}: {c.arquetipo}, nível {c.nivel} ({c.xp}/{c.xp_prox} XP)",
            f"Vida {c.vida}/{c.vida_max} · Poder {c.poder}/{c.poder_max}",
            f"Ataque {c.ataque_total} · Defesa {c.defesa_total} · Agilidade {c.agilidade_total} · Astúcia {c.astucia_total}",
            f"Crítico {round(c.chance_critico * 100)}% · Esquiva {round(c.chance_esquiva * 100)}%",
            f"Habilidade: {c.nome_habilidade}: {c.descricao_habilidade}",
        ]
        if c.dragao:
            d = c.dragao
            texto += [f"Dragão: {d.nome}, {d.cor.lower()} {d.raca}. {d.descricao}",
                      f"Sinete: {d.sinete.nome}: {d.sinete.descricao}"]
        else:
            texto.append("Dragão: nenhum (ainda).")
        return {"titulo": "Ficha do cadete", "texto": texto,
                "opcoes": [{"id": "voltar", "rotulo": "Voltar", "voltar": True}]}

    def _agir_ficha(self, op, texto):
        self._ir(self.retorno)

    # =================================================================
    #   SALVAR / CARREGAR
    # =================================================================
    def _serializar(self, incluir_logs=True) -> dict:
        dados = {
            "versao": 2,
            "cadete": self.cadete.to_dict(),
            "capitulo": self.capitulo,
            "campanha_concluida": self.campanha_concluida,
            "flags": sorted(self.flags),
            "treino": dict(self.treino),
        }
        if incluir_logs:
            dados["logs"] = self.logger.exportar()
        return dados

    def _restaurar(self, dados: dict) -> None:
        if "cadete" not in dados:
            raise ValueError("save incompatível com esta versão do jogo")
        self._novo_estado()
        self.cadete = Cadete.from_dict(dados["cadete"])
        self.capitulo = dados.get("capitulo", 1)
        self.campanha_concluida = dados.get("campanha_concluida", False)
        self.flags = set(dados.get("flags", []))
        self.treino.update(dados.get("treino", {}))
        if "logs" in dados:
            self.logger.importar(dados["logs"])

    def _autosalvar(self) -> None:
        try:
            # um autosave por cadete, para partidas diferentes não sobrescreverem umas às outras
            self.repo.salvar(f"autosave_{self.repo.normalizar_nome(self.cadete.nome.lower())}", self._serializar())
        except OSError as e:
            self.mensagens.append(f"Não foi possível salvar automaticamente: {e}")

    def _tela_salvar(self):
        sugestao = self.repo.normalizar_nome(self.cadete.nome.lower()) if self.cadete else "meu_jogo"
        return {
            "titulo": "Salvar jogo",
            "texto": ["Escolha um nome para o arquivo (letras, números, - e _)."],
            "entrada": {"id": "nome_save", "rotulo": "Nome do save", "max": 40, "valor": sugestao},
            "opcoes": [{"id": "enviar", "rotulo": "Salvar", "entrada": True},
                       {"id": "rapido", "rotulo": "Salvar rápido (quick_save)"},
                       {"id": "voltar", "rotulo": "Voltar", "voltar": True}],
        }

    def _agir_salvar(self, op, texto):
        if op == "voltar":
            self._ir(self.retorno)
            return
        nome = "quick_save" if op == "rapido" else (texto or "meu_jogo")
        caminho = self.repo.salvar(nome, self._serializar())
        self.logger.log(f"Jogo salvo em {caminho}.")
        self.mensagens.append(f"✔ Progresso salvo em: {caminho}")
        self._som("salvar")
        self._ir(self.retorno)

    def _tela_carregar(self):
        saves = self.repo.listar()
        opcoes = [{"id": f"load:{s['nome']}", "rotulo": s["nome"], "dica": s["resumo"]} for s in saves]
        opcoes.append({"id": "voltar", "rotulo": "Voltar", "voltar": True})
        texto = [] if saves else ["Nenhum jogo salvo encontrado."]
        return {"titulo": "Carregar jogo", "texto": texto, "opcoes": opcoes}

    def _agir_carregar(self, op, texto):
        if op == "voltar":
            self._ir(self.retorno)
            return
        nome = op[5:]
        try:
            self._restaurar(self.repo.carregar(nome))
        except (OSError, ValueError, KeyError) as e:
            self.mensagens.append(f"❌ Erro ao carregar: {e}")
            return
        self.logger.log(f"Jogo carregado: {nome}.")
        self.mensagens.append(f"✔ Jogo carregado: {nome}")
        self._som("carregar")
        self._ir("hub")

    # =================================================================
    #   LOGS
    # =================================================================
    POR_PAGINA = 12

    def _tela_logs(self):
        eventos = self.logger.eventos
        total = max(1, (len(eventos) - 1) // self.POR_PAGINA + 1)
        if self.pagina_logs < 0 or self.pagina_logs >= total:
            self.pagina_logs = total - 1  # abre na página mais recente
        ini = self.pagina_logs * self.POR_PAGINA
        texto = eventos[ini:ini + self.POR_PAGINA] or ["(sem registros)"]
        return {
            "titulo": "Diário de bordo",
            "subtitulo": f"Página {self.pagina_logs + 1} de {total}",
            "texto": texto,
            "monoespacado": True,
            "opcoes": [
                {"id": "anterior", "rotulo": "◀ Página anterior", "desabilitada": self.pagina_logs == 0},
                {"id": "proxima", "rotulo": "Próxima página ▶", "desabilitada": self.pagina_logs >= total - 1},
                {"id": "limpar", "rotulo": "Limpar logs", "desabilitada": not eventos},
                {"id": "voltar", "rotulo": "Voltar", "voltar": True},
            ],
        }

    def _agir_logs(self, op, texto):
        if op == "anterior":
            self.pagina_logs -= 1
        elif op == "proxima":
            self.pagina_logs += 1
        elif op == "limpar":
            self._ir("confirmar_limpar_logs")
        else:
            self._ir(self.retorno)

    def _tela_confirmar_limpar_logs(self):
        return {"titulo": "Limpar logs", "texto": ["Tem certeza que deseja apagar todos os logs da sessão?"],
                "opcoes": [{"id": "sim", "rotulo": "Sim, apagar"},
                           {"id": "nao", "rotulo": "Não", "voltar": True}]}

    def _agir_confirmar_limpar_logs(self, op, texto):
        if op == "sim":
            self.logger.eventos.clear()
            self.mensagens.append("✔ Todos os logs foram apagados.")
            self._som("apagar")
        self.pagina_logs = 0
        self._ir("logs")
