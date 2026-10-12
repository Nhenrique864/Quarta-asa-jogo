# 🐉 Dragões da Debulha

Na Debulha (capítulo 5), o cadete é escolhido por um dos dragões abaixo. Os dados ficam em `models/dragao.py`.
As ilustrações aparecem nos cartões de escolha, na apresentação do vínculo e na ficha.

| Dragão | Cor | Classe | Sinete | Sopro | Bônus |
|---|---|---|---|---|---|
| Kaelthar | Vermelho | Rabo de Espada | Invocar Relâmpagos | 38 | +6 ATQ, +2 DEF, +25 Vida, +20 Poder |
| Morvhen | Preto | Rabo de Adaga | Manipular Sombras | 34 | +4 ATQ, +2 DEF, +20 Vida, +25 Poder, +2 AGI |
| Siolra | Azul | Rabo de Escorpião | Congelar | 32 | +3 ATQ, +4 DEF, +30 Vida, +20 Poder |
| Brannoc | Verde | Rabo de Clava | Ler Intenções | 30 | +3 ATQ, +3 DEF, +35 Vida, +25 Poder, +2 AST |
| Lasair | Laranja | Rabo de Espada | Invocar Explosões | 40 | +7 ATQ, +1 DEF, +15 Vida, +20 Poder |
| Dúnmor | Marrom | Rabo de Maça | Abalar a Terra | 28 | +2 ATQ, +6 DEF, +40 Vida, +15 Poder |
| Órla* | Dourado | Rabo de Penas | Deter o Tempo | 22 | +2 ATQ, +2 DEF, +15 Vida, +35 Poder, +1 AGI, +1 AST |

\* Órla, o filhote dourado, só aparece na Debulha para quem escolheu **proteger o filhote** de Jack Barlowe.

## Imagens

Coloque a imagem de cada dragão em `web/static/dragoes/` com o nome da **chave** do dragão:

| Dragão | Arquivo |
|---|---|
| Kaelthar | `vermelho.webp` |
| Morvhen | `preto.webp` |
| Siolra | `azul.webp` |
| Brannoc | `verde.webp` |
| Lasair | `laranja.webp` |
| Dúnmor | `marrom.webp` |
| Órla | `dourado.webp` |

- Formatos aceitos: `.webp`, `.png`, `.jpg`. Proporção recomendada: **3:2** (por exemplo, 1536×1024).
- Não precisa reiniciar o servidor: basta recarregar a página.
- Sem imagem, o jogo mostra uma ilustração vetorial gerada no navegador (`web/static/dragoes.js`).

## Prompts usados como referência

Todos os sete dragões já têm imagem. Os prompts abaixo ficam como referência para refazer ou criar novas versões no mesmo estilo: arte de fantasia fotorrealista, cinematográfica, dragão em destaque numa
paisagem do Vale, iluminação dramática, proporção 3:2.

**Lasair: laranja, Rabo de Espada**
> Epic photorealistic fantasy illustration, a fierce orange dragon with scales glowing like living embers, jagged
> dark horns shaped like flames, sharp swept wings with fiery membranes, a long tail ending in a serrated
> sword-like blade trailing sparks, flying over a volcanic valley with rivers of lava, sky full of ash and smoke
> lit by orange firelight, cinematic lighting, highly detailed scales, dramatic atmosphere, 3:2

**Dúnmor: marrom, Rabo de Maça**
> Epic photorealistic fantasy illustration, a massive brown dragon with thick rocky plates like canyon stone,
> heavy curled ram-like horns, broad leathery wings, scarred and battle-worn, a heavy tail ending in a spiked
> morningstar mace, standing guard on a cliff edge above deep red-rock canyons and mesas at sunset, dust haze,
> warm golden light, loyal and unshakable expression, cinematic, highly detailed, 3:2

**Órla: o filhote dourado, Rabo de Penas**
> Epic photorealistic fantasy illustration, a small young golden dragon hatchling with shimmering gold scales and
> iridescent feathers along its neck and back, small horn buds, bright curious blue eyes, delicate wings, a tail
> ending in a fan of golden feathers, gliding through morning mist over a forested valley at dawn, soft pink and
> golden sunrise light with sun rays, magical sparkles in the air, tender yet ancient presence, cinematic, 3:2

## Legendas

Cada dragão tem uma `legenda` em `models/dragao.py`, exibida sob a imagem na apresentação, no formato
**"Nome — Cor, Classe. Descrição da cena."**. Se trocar uma imagem, ajuste a legenda para combinar.
