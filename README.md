
# 🐉 Quarta Asa: RPG Orientado a Objetos (POO)

## 📘 Sobre o Projeto

Este projeto é um **RPG textual desenvolvido em Python**, estruturado com **Programação Orientada a Objetos (POO)**.

O objetivo é criar uma arquitetura modular e escalável, utilizando conceitos como **herança**, **polimorfismo**, **abstração** e **encapsulamento.**

A versão atual é uma **adaptação de fã** inspirada no livro **_Quarta Asa_ (_Fourth Wing_), de Rebecca Yarros**: o jogador é um cadete do Quadrante dos Cavaleiros da Escola de Guerra Basgiath e precisa sobreviver ao primeiro ano. O jogo pode ser jogado **no terminal** ou por um **front web** no navegador.

> O mundo, os lugares e os personagens pertencem à autora. Todos os textos do jogo são originais, escritos para este projeto educacional e sem fins comerciais.

---

## 🛠️ Tecnologias Utilizadas

- **Linguagem:** Python 3.10+
- **Paradigma:** Programação Orientada a Objetos (POO)
- **Somente biblioteca padrão:** `dataclasses`, `random`, `json`, `http.server`
- **Front web:** HTML, CSS e JavaScript puros (sem frameworks, sem build)

---

## 🌐 Jogar Online

**https://nhenrique864.github.io/Quarta-asa-jogo/**

O site é estático (GitHub Pages) e roda o próprio código Python do jogo **dentro do navegador**, com o
[Pyodide](https://pyodide.org). Não há servidor: os saves ficam no navegador de cada jogador. A primeira
visita baixa o Pyodide (cerca de 10 MB); depois ele fica em cache.

O site é publicado automaticamente a cada push no `main`, pelo workflow `.github/workflows/pages.yml`.
Para gerar o site localmente:

```bash
python web/montar_site.py _site
```

---

## 💻 Como Rodar o Projeto (Código-fonte)

1. Certifique-se de ter **Python 3.10 ou superior** instalado.
2. Clone o repositório e entre na pasta:

   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd rpg-textual
   ```

3. Escolha a interface:

   **Navegador (front web)**: abra http://localhost:8088 depois de rodar:

   ```bash
   python main.py --web
   ```

   Use `--porta 9000` para trocar a porta. Atalhos: as teclas numéricas escolhem as opções e `Esc` volta.

   **Terminal:**

   ```bash
   python main.py
   ```

As duas interfaces usam exatamente o mesmo motor de jogo e os mesmos saves (pasta `saves/`).

---

## 💾 Como Rodar o Jogo (Executáveis da Release)

> Os executáveis da release **v1.0.0** correspondem à versão anterior do jogo (fantasia genérica, só no terminal).

- **Windows:** baixe `rpg-v1.0.0-windows.exe` e execute com um clique (não precisa de Python).
- **Linux:** baixe `rpg-v1.0.0-linux`, dê permissão de execução e rode:

  ```bash
  chmod +x rpg-v1.0.0-linux
  ```

  ```bash
  ./rpg-v1.0.0-linux
  ```

Na seção *Assets* da release também estão o **Source code (zip)** e o **Source code (tar.gz)**.

---

## 📖 A Campanha

Sete capítulos acompanham o arco do primeiro ano em Basgiath:

| # | Capítulo | O que acontece |
|---|----------|----------------|
| 1 | Dia da Conscrição | Atravessar o Parapeito sem cair, e sem ser empurrado. |
| 2 | A Lista dos Mortos | Battle Brief, o tatame e o primeiro desafio. |
| 3 | O Gauntlet | A pista de obstáculos e as noites de treino. |
| 4 | Lâminas no Escuro | Um ataque noturno no dormitório. |
| 5 | A Debulha | Enfrentar Jack Barlowe no Vale e ser escolhido por um dragão. |
| 6 | Asas e Sinetes | Primeiro voo, treino do sinete e exercícios de guerra. |
| 7 | Resson | Wyverns, um venin e o segredo que Navarre esconde. |

Cada escolha pode exigir um **teste de atributo** (d20 + Agilidade, Astúcia ou Força), levar a um **combate** ou dar recompensas. Se o cadete morrer, seu nome vai para a lista dos mortos, e é possível recomeçar o capítulo. O progresso é salvo automaticamente ao fim de cada capítulo.

---

## 🧩 Funcionalidades

- **Criação de Cadete:** 4 arquétipos com habilidades próprias: Duelista de Adagas, Espadachim, Lutador do Tatame e Estrategista.
- **Dragões e Sinetes:** na Debulha, o jogador se vincula a um de 7 dragões: Kaelthar (vermelho), Morvhen (preto), Siolra (azul), Brannoc (verde), Lasair (laranja), Dúnmor (marrom) e Órla, o filhote dourado secreto. Cada um dá bônus, um sopro de fogo e um sinete. Os dragões aparecem com ilustração e uma apresentação própria no vínculo. Veja **[Dragões](/docs/readme/dragoes.md)**.
- **Combate por Turnos:** atacar, habilidade, sinete, chamar o dragão, defender, usar item e fugir (no treino), com críticos, esquiva e efeitos (veneno, queimadura, atordoado, cego, exposto).
- **Inimigos do Livro:** candidatos, cadetes rivais, Jack Barlowe (chefe), paladinos de grifo, cavaleiros da Primeira Asa, wyverns e o venin (chefe final).
- **Treino (missões livres):** 3 cenários (Tatame, Campo de Voo e Fronteira) × 3 dificuldades, com recompensas aleatórias.
- **Inventário e Equipamentos:** tônicos, elixires, óleos e folhas de salgueiro; adagas balanceadas e armadura de escamas de dragão.
- **Salvamento (Repository Pattern):** saves em JSON com nomes sanitizados, autosave e checkpoint por capítulo.
- **Logs de Jogo:** diário de bordo paginado e gravado em `logs/`.
- **Efeitos Sonoros (front web):** efeitos de suspense sintetizados no navegador com a Web Audio API, sem arquivos de áudio. Há BRAAMs de trailer, cordas em trêmolo, batimentos cardíacos, relógio, risers, harmônicos inquietantes, sussurros, clusters dissonantes, metais, coral, tímpanos e taikos, tudo com reverb de salão. São mais de 50 efeitos, um para cada situação, em harmonia sombria (ré menor e acordes de quinta), com resolução em maior só no final da campanha. O ícone no topo liga ou desliga os efeitos e ajusta o volume.

---

## 🏛️ Arquitetura

O núcleo (`models/jogo.py`) é uma **máquina de estados independente da interface**:

- `Jogo.estado()` devolve um dicionário com a tela atual (título, textos, opções, ficha, combate);
- `Jogo.agir(id, texto)` aplica a opção escolhida.

O **terminal** (`utils/terminal.py`) e o **front web** (`web/`) são apenas *Views* desse mesmo modelo, no padrão MVC.
O front fala com o motor por `web/static/motor.js`, que usa a API do servidor local (`python main.py --web`) ou,
no site publicado, executa o motor no navegador via Pyodide.

---

## 🗂️ Estrutura do Projeto

```text
├─ main.py                  # ponto de entrada (terminal ou --web)
├─ models/
│  ├─ base.py               # Combatente (base de Cadete e Inimigo), cálculo de dano
│  ├─ personagem.py         # Cadete + arquétipos (polimorfismo de atacar/habilidade)
│  ├─ dragao.py             # Dragao e Sinetes
│  ├─ inimigo.py            # Inimigo + inimigos do livro
│  ├─ combate.py            # motor de combate por turnos
│  ├─ campanha.py           # capítulos, cenas, escolhas e testes
│  ├─ jogo.py               # máquina de estados (telas)
│  ├─ inventario.py         # Item e Inventario
│  ├─ itens.py              # consumíveis
│  ├─ equipamentos.py       # equipamentos
│  ├─ catalogo.py           # registro de itens (salvar/carregar)
│  └─ logger.py             # logs
├─ utils/
│  ├─ salvamento.py         # RepositorioJogo (JSON)
│  └─ terminal.py           # interface de terminal
├─ web/
│  ├─ servidor.py           # servidor HTTP local + API JSON (/api/estado, /api/acao)
│  ├─ ponte_navegador.py    # ponte do motor com o navegador (Pyodide) e saves no localStorage
│  ├─ montar_site.py        # monta o site estático para o GitHub Pages
│  └─ static/               # index.html, style.css, app.js, motor.js, sons.js, dragoes.js, emblema.svg
│     └─ dragoes/           # imagens dos dragões (<chave>.webp)
└─ docs/
```

---

## 👥 Equipe

**[@Mateus Alves](https://github.com/AlvesTK)**: Desenvolvimento de Personagens

**[@Rodrigo Moraes](https://github.com/RodrigoDevBack)**: Desenvolvimento Geral, Refatoração e Github

**[@Guilherme da Silva](https://github.com/Gohanphp)**: Desenvolvimento de Inimigos

**[@Lucas Paiva](https://github.com/lucaspaiva-lp-lp)**: Desenvolvimento Geral, Refatoração, Organização, Integração, Documentação

**[@Maria Eduarda](https://github.com/mariaeduarda63)**: Desenvolvimento de Missões

**[@Nicolas](https://github.com/nicolas021007)**: Desenvolvimento de Inimigos

**[@Rian Alves](https://github.com/RianAlvesTi)**: Desenvolvimento de Missões

**[@Alexandre Arcanjo](https://github.com/alexandrexande)**: Desenvolvimento do Menu

**[@Felipe Gonçalves](https://github.com/FIGFelip)**: Desenvolvimento de Personagens

**[@Cauan Arnoldo](https://github.com/Camp-1)**: Desenvolvimento de Inimigos

---

## 📚 Documentação Complementar

A pasta `docs/readme/` documenta a arquitetura e os sistemas da versão 1.0 (fantasia genérica):

- **[Dragões](/docs/readme/dragoes.md)** (atual: lista completa, imagens e prompts)
- **[Arquitetura](/docs/readme/arquitetura.md)**
- **[Sistema de Combate](/docs/readme/sistema-de-combate.md)**
- **[Personagens](/docs/readme/personagens.md)**
- **[Missões](/docs/readme/missao.md)**
- **[Sistema de Salvamento](/docs/readme/salvamento.md)**
- **[Roadmap](/docs/readme/roadmap.md)**
