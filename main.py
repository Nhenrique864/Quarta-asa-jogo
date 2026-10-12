from __future__ import annotations
import argparse
import sys

from models.jogo import Jogo


def main() -> None:
    """Ponto de entrada.

    - `python main.py`                 → joga no terminal;
    - `python main.py --web`           → abre o front web em http://localhost:8088;
    - `python main.py --web --porta N` → usa outra porta.
    """
    parser = argparse.ArgumentParser(description="Quarta Asa — RPG textual")
    parser.add_argument("--web", action="store_true", help="inicia o front web em vez do terminal")
    parser.add_argument("--porta", type=int, default=8088, help="porta do servidor web (padrão 8088)")
    parser.add_argument("--host", default="127.0.0.1", help="endereço do servidor web (padrão 127.0.0.1)")
    args = parser.parse_args()

    if args.web:
        from web.servidor import iniciar
        iniciar(args.host, args.porta)
    else:
        from utils.terminal import executar
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")  # emojis/acentos no console do Windows
        executar(Jogo())


if __name__ == "__main__":
    main()
