"""
Accès privé tant qu'Ask for Data n'est pas lancé publiquement.

Quand la variable d'environnement DEMO_ACCESS_CODE est définie, chaque page demande ce code
une fois ; il est ensuite retenu 30 jours dans un cookie signé. Sans la variable (en local),
rien ne change.

- Lien de démo direct : /demo/?code=LE_CODE ouvre l'appli sans rien saisir.
- Changer le code dans Render invalide aussitôt tous les accès déjà donnés.
- /api/health reste ouvert : le maintien en éveil (keepalive.py) en a besoin.
"""

import hashlib
import hmac
import time
from urllib.parse import quote

from django.conf import settings
from django.core import signing
from django.core.cache import cache
from django.http import HttpResponse, HttpResponseRedirect, JsonResponse
from django.utils.html import escape
from django.views.decorators.csrf import csrf_protect

COOKIE = "afd_demo"
MAX_AGE = 30 * 24 * 3600
OPEN_PREFIXES = ("/demo/", "/api/health", "/static/", "/favicon")
MAX_FAILS = 8  # par adresse IP et par quart d'heure


def _code():
    return getattr(settings, "DEMO_ACCESS_CODE", "") or ""


def _fingerprint(code):
    # Le cookie porte une empreinte du code : changer le code révoque les anciens cookies.
    return hashlib.sha256(f"afd-demo:{code}".encode()).hexdigest()[:16]


def _has_access(request):
    try:
        value = signing.get_cookie_signer(salt="afd-demo").unsign(request.COOKIES.get(COOKIE, ""), max_age=MAX_AGE)
    except signing.BadSignature:
        return False
    return hmac.compare_digest(value, _fingerprint(_code()))


def _client_ip(request):
    return (request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip() or request.META.get("REMOTE_ADDR", "")) or "?"


def _safe_next(target):
    return target if target.startswith("/") and not target.startswith("//") else "/"


class DemoGateMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not _code():
            return self.get_response(request)
        path = request.path
        if path.startswith(OPEN_PREFIXES) or _has_access(request):
            response = self.get_response(request)
        elif path.startswith("/api/"):
            response = JsonResponse({"error": "Accès réservé : démo sur demande."}, status=403)
        else:
            response = HttpResponseRedirect(f"/demo/?next={quote(request.get_full_path())}")
        # Pas d'indexation tant que l'appli n'est pas lancée.
        response["X-Robots-Tag"] = "noindex, nofollow"
        return response


PAGE = """<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Ask for Data · démo privée</title>
<style>
:root{{--bg:#0b1220;--card:#121b2e;--ink:#e8eefc;--muted:#9aa8c4;--accent:#4f8cff;--warn:#ff9a52}}
*{{box-sizing:border-box}}body{{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(1200px 600px at 20% -10%,#1b2a4d,transparent),var(--bg);color:var(--ink);font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px}}
.card{{width:100%;max-width:420px;background:var(--card);border:1px solid #23314f;border-radius:20px;padding:32px;box-shadow:0 30px 80px -30px #000}}
h1{{margin:0 0 6px;font-size:1.6rem}}p{{color:var(--muted);margin:0 0 18px}}
label{{display:block;font-weight:600;margin-bottom:6px}}input{{width:100%;padding:12px 14px;border-radius:12px;border:1px solid #2c3d63;background:#0d1526;color:var(--ink);font-size:1rem;letter-spacing:.08em}}
input:focus{{outline:none;border-color:var(--accent)}}button{{margin-top:14px;width:100%;padding:12px;border:0;border-radius:999px;background:var(--accent);color:#04102a;font-weight:700;font-size:1rem;cursor:pointer}}
.err{{color:var(--warn);margin:12px 0 0}}a{{color:var(--accent)}}.small{{font-size:.9rem;margin-top:18px}}
</style></head><body><main class="card">
<h1>Ask for Data</h1>
<p>L’application n’est pas encore lancée publiquement. L’accès est réservé aux démonstrations.</p>
<form method="post" action="/demo/">{csrf}
<input type="hidden" name="next" value="{next}">
<label for="code">Code d’accès</label><input id="code" name="code" autocomplete="off" autofocus required maxlength="64">
<button type="submit">Entrer</button>{error}</form>
<p class="small">Pas de code ? <a href="mailto:kermah.assimany@gmail.com?subject=Démo%20Ask%20for%20Data">Demandez une démo</a>.</p>
</main></body></html>"""


@csrf_protect
def demo_gate_view(request):
    from django.middleware.csrf import get_token

    code = _code()
    target = _safe_next(request.POST.get("next") or request.GET.get("next") or "/")
    if not code:
        return HttpResponseRedirect(target)

    given = (request.POST.get("code") or request.GET.get("code") or "").strip()
    error = ""
    if given:
        key = f"afd-demo-fails:{_client_ip(request)}"
        fails = cache.get(key, 0)
        if fails >= MAX_FAILS:
            error = "Trop d’essais. Réessayez dans un quart d’heure."
        elif hmac.compare_digest(given.encode(), code.encode()):
            response = HttpResponseRedirect(target)
            response.set_cookie(
                COOKIE,
                signing.get_cookie_signer(salt="afd-demo").sign(_fingerprint(code)),
                max_age=MAX_AGE,
                secure=not settings.DEBUG,
                httponly=True,
                samesite="Lax",
            )
            return response
        else:
            cache.set(key, fails + 1, 15 * 60)
            time.sleep(0.5)
            error = "Code incorrect."

    html = PAGE.format(
        csrf=f'<input type="hidden" name="csrfmiddlewaretoken" value="{get_token(request)}">',
        next=escape(target),
        error=f'<p class="err">{escape(error)}</p>' if error else "",
    )
    response = HttpResponse(html, status=403 if error else 200)
    response["X-Robots-Tag"] = "noindex, nofollow"
    response["Cache-Control"] = "no-store"
    return response
