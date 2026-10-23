"""
Auto-réveil (keep-alive) pendant les heures ouvrées, pour l'offre gratuite de Render.

Contexte
--------
Render endort un service web gratuit après 15 minutes sans trafic ENTRANT ;
le réveil suivant prend environ une minute. Pour l'éviter pendant les heures
de travail, un thread démon interroge toutes les 10 minutes l'URL PUBLIQUE du
service : la requête ressort sur Internet puis repasse par le proxy de Render,
elle compte donc comme du trafic entrant (un appel à localhost ne compterait pas).

Pourquoi seulement une fenêtre horaire : l'offre gratuite accorde 750 heures
d'instance par mois pour TOUT le compte Render (Ask for Data + IABE + e-SNDS).
Deux services éveillés 24h/24 consommeraient ~1 490 h : le quota serait épuisé
vers le 15 du mois et tous les services gratuits seraient suspendus jusqu'au
mois suivant. Par défaut on ne garde donc éveillé que du lundi au vendredi,
de 08:00 à 19:00 UTC (≈ 2 × 11 h × 23 jours ≈ 506 h/mois). Hors fenêtre, le
thread ne fait rien et le service s'endort normalement.

Variables d'environnement
-------------------------
KEEPALIVE_URL               URL complète à interroger (prioritaire).
RENDER_EXTERNAL_URL         Fournie automatiquement par Render
                            (ex. https://monapp.onrender.com) ; on y ajoute
                            KEEPALIVE_PATH. Aucune des deux => module inactif
                            (donc jamais actif en local).
KEEPALIVE_PATH              Chemin ajouté à RENDER_EXTERNAL_URL
                            (défaut : celui passé à start()).
KEEPALIVE_DISABLED          "1" / "true" pour désactiver complètement.
KEEPALIVE_DAYS              Jours ISO (1 = lundi … 7 = dimanche), liste et/ou
                            plages : "1-5" (défaut), "1,3,5", "1-3,6".
KEEPALIVE_START_HOUR        Heure UTC de début, incluse (défaut 8).
KEEPALIVE_END_HOUR          Heure UTC de fin, exclue (défaut 19).
KEEPALIVE_INTERVAL_SECONDS  Intervalle entre deux passages (défaut 600 ;
                            doit rester < 15 min pour être utile).

Plusieurs workers gunicorn : un verrou fichier non bloquant (fcntl.flock) dans
le répertoire temporaire garantit qu'un seul processus lance le thread ; le
worker qui obtient le verrou garde le fichier ouvert jusqu'à sa mort (le noyau
libère alors le verrou et le worker de remplacement pourra le reprendre).

Module volontairement autonome (bibliothèque standard uniquement) : il est
copié à l'identique dans chaque dépôt qui l'utilise.
"""

import datetime
import hashlib
import logging
import os
import tempfile
import threading
import time
import urllib.error
import urllib.request

logger = logging.getLogger("keepalive")

DEFAULT_DAYS = "1-5"
DEFAULT_START_HOUR = 8
DEFAULT_END_HOUR = 19
DEFAULT_INTERVAL_SECONDS = 600
REQUEST_TIMEOUT_SECONDS = 30

# État du processus courant : thread lancé et fichier de verrou gardé ouvert.
_state_lock = threading.Lock()
_thread = None
_stop_event = None
_lock_file = None


def parse_days(spec):
    """Convertit "1-5" ou "1,3,6-7" en ensemble de jours ISO (1 = lundi)."""
    days = set()
    for part in (spec or "").split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            first, last = (int(x) for x in part.split("-", 1))
            days.update(range(first, last + 1))
        else:
            days.add(int(part))
    invalid = [d for d in days if not 1 <= d <= 7]
    if invalid:
        raise ValueError("jours invalides (1-7 attendus) : %s" % invalid)
    return days


def in_window(now, days, start_hour, end_hour):
    """Vrai si `now` (datetime UTC) tombe un jour autorisé et start <= heure < end."""
    return now.isoweekday() in days and start_hour <= now.hour < end_hour


def resolve_url(environ, default_path):
    """URL à interroger, ou None si le module doit rester inactif."""
    if environ.get("KEEPALIVE_DISABLED", "").strip().lower() in ("1", "true", "yes", "on"):
        return None
    url = environ.get("KEEPALIVE_URL", "").strip()
    if url:
        return url
    base = environ.get("RENDER_EXTERNAL_URL", "").strip()
    if not base:
        return None
    path = environ.get("KEEPALIVE_PATH", default_path).strip() or "/"
    return base.rstrip("/") + "/" + path.lstrip("/")


def load_config(environ=None, default_path="/"):
    """Lit la configuration depuis l'environnement ; None si inactif."""
    environ = os.environ if environ is None else environ
    url = resolve_url(environ, default_path)
    if not url:
        return None
    return {
        "url": url,
        "days": parse_days(environ.get("KEEPALIVE_DAYS", DEFAULT_DAYS)),
        "start_hour": int(environ.get("KEEPALIVE_START_HOUR", DEFAULT_START_HOUR)),
        "end_hour": int(environ.get("KEEPALIVE_END_HOUR", DEFAULT_END_HOUR)),
        "interval": max(1, int(environ.get("KEEPALIVE_INTERVAL_SECONDS", DEFAULT_INTERVAL_SECONDS))),
    }


def ping(url):
    """Une requête GET courte ; ne lève jamais d'exception."""
    started = time.monotonic()
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "render-keepalive/1.0"})
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            response.read(1024)
            status = response.status
        logger.info("keep-alive pid=%s : GET %s -> HTTP %s (%.2f s)",
                    os.getpid(), url, status, time.monotonic() - started)
        return True
    except urllib.error.HTTPError as exc:
        # Une réponse d'erreur reste du trafic entrant : le service est réveillé.
        logger.warning("keep-alive pid=%s : GET %s -> HTTP %s", os.getpid(), url, exc.code)
    except Exception as exc:  # réseau, DNS, timeout… : on réessaiera au prochain passage
        logger.warning("keep-alive pid=%s : GET %s a échoué : %s", os.getpid(), url, exc)
    return False


def _run(config, stop_event, clock):
    while not stop_event.wait(config["interval"]):
        try:
            if in_window(clock(), config["days"], config["start_hour"], config["end_hour"]):
                ping(config["url"])
        except Exception:  # filet de sécurité : le thread ne doit jamais mourir
            logger.exception("keep-alive : erreur inattendue")


def _utcnow():
    return datetime.datetime.now(datetime.timezone.utc)


def _acquire_process_lock(url):
    """Verrou exclusif non bloquant, partagé par les workers d'un même service."""
    import fcntl  # absent sous Windows : start() reste alors inactif

    name = "keepalive-%s.lock" % hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]
    lock_file = open(os.path.join(tempfile.gettempdir(), name), "w")
    try:
        fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        lock_file.close()
        return None
    return lock_file


def _ensure_log_handler():
    # Sans configuration LOGGING (cas d'un projet Django par défaut), les
    # messages INFO seraient perdus : on ajoute alors une sortie console.
    if not logger.hasHandlers():
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
        logger.addHandler(handler)
    if logger.getEffectiveLevel() > logging.INFO:
        logger.setLevel(logging.INFO)


def start(default_path="/", environ=None, clock=_utcnow):
    """
    Lance le thread d'auto-réveil si la configuration le permet.

    Sans effet (et sans erreur) si aucune URL n'est configurée, si un autre
    worker détient déjà le verrou, ou si le thread tourne déjà dans ce
    processus. Retourne le thread lancé, sinon None.
    """
    global _thread, _stop_event, _lock_file
    try:
        _ensure_log_handler()
        config = load_config(environ, default_path)
        if config is None:
            logger.debug("keep-alive inactif (aucune URL configurée ou désactivé).")
            return None
        if config["start_hour"] >= config["end_hour"]:
            logger.warning("keep-alive : fenêtre horaire vide (%sh-%sh UTC), rien ne sera fait.",
                           config["start_hour"], config["end_hour"])
            return None
        with _state_lock:
            if _thread is not None and _thread.is_alive():
                return None
            lock_file = _acquire_process_lock(config["url"])
            if lock_file is None:
                logger.info("keep-alive pid=%s : déjà assuré par un autre worker.", os.getpid())
                return None
            _lock_file = lock_file
            _stop_event = threading.Event()
            _thread = threading.Thread(
                target=_run,
                args=(config, _stop_event, clock),
                name="render-keepalive",
                daemon=True,
            )
            _thread.start()
        logger.info(
            "keep-alive pid=%s : actif, GET %s toutes les %s s, jours ISO %s, %02d:00-%02d:00 UTC.",
            os.getpid(), config["url"], config["interval"],
            ",".join(str(d) for d in sorted(config["days"])),
            config["start_hour"], config["end_hour"],
        )
        return _thread
    except Exception:
        # Le démarrage de l'application ne doit jamais échouer à cause du keep-alive.
        logger.exception("keep-alive : démarrage impossible (l'application tourne quand même).")
        return None


def stop(timeout=5):
    """Arrête le thread et libère le verrou (utile pour les tests)."""
    global _thread, _stop_event, _lock_file
    with _state_lock:
        if _stop_event is not None:
            _stop_event.set()
        if _thread is not None:
            _thread.join(timeout)
        if _lock_file is not None:
            _lock_file.close()
        _thread = _stop_event = _lock_file = None
