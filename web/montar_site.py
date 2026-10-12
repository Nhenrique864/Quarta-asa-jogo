"""Monta a versão estática do jogo (GitHub Pages), em que o Python roda no navegador via Pyodide.

Uso:  python web/montar_site.py [pasta_destino]   (padrão: _site)

Estrutura gerada:
    index.html             página do jogo
    static/                CSS, JS, sons, ilustrações e imagens dos dragões
    py/                    código Python do jogo + ponte_navegador.py
    py/arquivos.json       lista dos arquivos Python que o navegador deve carregar
"""
from __future__ import annotations
import json
import shutil
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PYTHON_DO_JOGO = ["models", "utils"]
IGNORAR_PY = {"utils/terminal.py"}  # a interface de terminal não roda no navegador


def montar(destino: Path) -> None:
    if destino.exists():
        shutil.rmtree(destino)
    estaticos = RAIZ / "web" / "static"
    shutil.copytree(estaticos, destino / "static",
                    ignore=shutil.ignore_patterns("index.html", "__pycache__"))
    shutil.copy2(estaticos / "index.html", destino / "index.html")

    arquivos = []
    for pasta in PYTHON_DO_JOGO:
        for caminho in sorted((RAIZ / pasta).glob("*.py")):
            relativo = caminho.relative_to(RAIZ).as_posix()
            if relativo in IGNORAR_PY:
                continue
            (destino / "py" / pasta).mkdir(parents=True, exist_ok=True)
            shutil.copy2(caminho, destino / "py" / relativo)
            arquivos.append(relativo)
    shutil.copy2(RAIZ / "web" / "ponte_navegador.py", destino / "py" / "ponte_navegador.py")
    arquivos.append("ponte_navegador.py")
    (destino / "py" / "arquivos.json").write_text(json.dumps(arquivos, indent=2), encoding="utf-8")
    (destino / ".nojekyll").write_text("", encoding="utf-8")  # publica os arquivos como estão
    print(f"Site montado em {destino} ({len(arquivos)} arquivos Python).")


if __name__ == "__main__":
    montar(Path(sys.argv[1] if len(sys.argv) > 1 else RAIZ / "_site").resolve())
