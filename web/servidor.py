"""Servidor web do jogo (só biblioteca padrão).

Cada navegador recebe uma sessão (cookie) com sua própria instância de `Jogo`.
O front (web/static) consome a mesma API que o terminal usa: `estado()` e `agir()`.
"""
from __future__ import annotations
import json
import mimetypes
import os
import secrets
import threading
import time
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from models.jogo import Jogo
from models.dragao import DRAGOES

PASTA_STATIC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
PASTA_DRAGOES = os.path.join(PASTA_STATIC, "dragoes")
EXTENSOES_IMAGEM = (".webp", ".png", ".jpg", ".jpeg")
MAX_SESSOES = 50
MAX_CORPO = 4096

# o registro do Windows às vezes mapeia .js/.css para tipos errados
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("image/webp", ".webp")


def imagens_dragoes() -> dict[str, str]:
    """Imagens em web/static/dragoes/<chave>.<ext> que substituem as ilustrações SVG."""
    imagens = {}
    if os.path.isdir(PASTA_DRAGOES):
        for arquivo in sorted(os.listdir(PASTA_DRAGOES)):
            chave, ext = os.path.splitext(arquivo)
            if chave in DRAGOES and ext.lower() in EXTENSOES_IMAGEM and chave not in imagens:
                versao = int(os.path.getmtime(os.path.join(PASTA_DRAGOES, arquivo)))
                imagens[chave] = f"/static/dragoes/{arquivo}?v={versao}"
    return imagens


class Sessao:
    def __init__(self):
        self.jogo = Jogo()
        self.lock = threading.Lock()
        self.ultimo_acesso = time.time()


_sessoes: dict[str, Sessao] = {}
_lock_sessoes = threading.Lock()


def _obter_sessao(token: str | None) -> tuple[str, Sessao]:
    with _lock_sessoes:
        if token and token in _sessoes:
            s = _sessoes[token]
        else:
            if len(_sessoes) >= MAX_SESSOES:  # descarta a sessão mais antiga
                antiga = min(_sessoes, key=lambda k: _sessoes[k].ultimo_acesso)
                del _sessoes[antiga]
            token = secrets.token_urlsafe(24)
            s = _sessoes[token] = Sessao()
        s.ultimo_acesso = time.time()
        return token, s


class Handler(BaseHTTPRequestHandler):
    server_version = "QuartaAsa/1.0"

    def log_message(self, formato, *args):
        pass  # silencioso; os eventos do jogo já vão para logs/

    # ---------------------------------------------------------
    #   AUXILIARES
    # ---------------------------------------------------------
    def _token_cookie(self) -> str | None:
        bruto = self.headers.get("Cookie")
        if not bruto:
            return None
        c = cookies.SimpleCookie()
        try:
            c.load(bruto)
        except cookies.CookieError:
            return None
        return c["sessao"].value if "sessao" in c else None

    def _responder(self, status: int, corpo: bytes, tipo: str, token: str | None = None):
        self.send_response(status)
        self.send_header("Content-Type", tipo)
        self.send_header("Content-Length", str(len(corpo)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if token:
            self.send_header("Set-Cookie", f"sessao={token}; Path=/; HttpOnly; SameSite=Strict")
        self.end_headers()
        self.wfile.write(corpo)

    def _json(self, dados: dict, token: str | None = None, status: int = 200):
        self._responder(status, json.dumps(dados, ensure_ascii=False).encode("utf-8"),
                        "application/json; charset=utf-8", token)

    def _estado(self, sessao: Sessao, com_sons: bool) -> dict:
        estado = sessao.jogo.estado()
        estado["opcoes"] = [o for o in estado["opcoes"] if not o.get("terminal")]
        sons = sessao.jogo.consumir_sons()  # consome sempre: recarregar a página não repete sons
        estado["sons"] = sons if com_sons else []
        estado["imagens_dragoes"] = imagens_dragoes()
        return estado

    def _arquivo(self, nome: str):
        caminho = os.path.realpath(os.path.join(PASTA_STATIC, nome))
        if not caminho.startswith(os.path.realpath(PASTA_STATIC) + os.sep) or not os.path.isfile(caminho):
            return self._responder(404, b"nao encontrado", "text/plain; charset=utf-8")
        tipo = mimetypes.guess_type(caminho)[0] or "application/octet-stream"
        if tipo.startswith("text/") or tipo == "image/svg+xml":
            tipo += "; charset=utf-8"
        with open(caminho, "rb") as f:
            self._responder(200, f.read(), tipo)

    # ---------------------------------------------------------
    #   ROTAS
    # ---------------------------------------------------------
    def do_GET(self):
        rota = self.path.split("?", 1)[0]
        if rota in ("/", "/index.html"):
            return self._arquivo("index.html")
        if rota.startswith("/static/"):
            return self._arquivo(rota[len("/static/"):])
        if rota == "/api/estado":
            antigo = self._token_cookie()
            token, sessao = _obter_sessao(antigo)
            with sessao.lock:
                return self._json(self._estado(sessao, com_sons=False), token if token != antigo else None)
        self._responder(404, b"nao encontrado", "text/plain; charset=utf-8")

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/api/acao":
            return self._responder(404, b"nao encontrado", "text/plain; charset=utf-8")
        if "application/json" not in (self.headers.get("Content-Type") or ""):
            return self._json({"erro": "Content-Type deve ser application/json"}, status=415)
        tamanho = int(self.headers.get("Content-Length") or 0)
        if tamanho > MAX_CORPO:
            return self._json({"erro": "requisição grande demais"}, status=413)
        try:
            dados = json.loads(self.rfile.read(tamanho) or b"{}")
            op_id = str(dados.get("id", ""))
            texto = dados.get("texto")
            texto = str(texto)[:200] if texto is not None else None
        except (ValueError, AttributeError):
            return self._json({"erro": "JSON inválido"}, status=400)
        antigo = self._token_cookie()
        token, sessao = _obter_sessao(antigo)
        with sessao.lock:
            sessao.jogo.agir(op_id, texto)
            return self._json(self._estado(sessao, com_sons=True), token if token != antigo else None)


def iniciar(host: str = "127.0.0.1", porta: int = 8088) -> None:
    servidor = ThreadingHTTPServer((host, porta), Handler)
    print(f"Quarta Asa rodando em http://{'localhost' if host == '127.0.0.1' else host}:{porta}", flush=True)
    print("Ctrl+C para encerrar.", flush=True)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        servidor.server_close()
