"""
Point d'entrée WSGI pour le déploiement Render.
Permet à Render de trouver l'application WSGI via 'gunicorn app:app'.

Le service Render a été créé avec buildCommand = `pip install -r requirements.txt`
uniquement : les migrations ne tournent jamais pendant le build, et le disque
est éphémère (la base SQLite repart de zéro à chaque déploiement). On exécute
donc les migrations ici, au démarrage de chaque worker, AVANT de créer
l'application WSGI. Un verrou fichier évite que plusieurs workers gunicorn
(workers sync, fork après import) migrent en même temps ; les migrations
Django sont de toute façon idempotentes.

NB : pas de collectstatic ici — WhiteNoise est configuré avec
WHITENOISE_USE_FINDERS = True (voir askfordata/settings.py), les fichiers
statiques sont servis directement via les finders sans dossier staticfiles/.
"""

import logging
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'askfordata.settings')

logger = logging.getLogger('askfordata.boot')


def _run_startup_migrations():
    """Applique les migrations au boot, sans jamais faire échouer le démarrage."""
    try:
        import django
        django.setup()

        from django.conf import settings
        from django.core.management import call_command

        # Verrou fichier simple contre les exécutions concurrentes multi-workers.
        lock_path = str(settings.BASE_DIR / '.migrate.lock')
        lock_file = open(lock_path, 'w')
        try:
            try:
                import fcntl
                fcntl.flock(lock_file, fcntl.LOCK_EX)
            except Exception:
                # Pas de fcntl (plateforme exotique) : on compte sur
                # l'idempotence des migrations Django.
                pass

            logger.info("Démarrage : application des migrations…")
            call_command('migrate', interactive=False, run_syncdb=True, verbosity=1)
            logger.info("Démarrage : migrations appliquées avec succès.")
        finally:
            lock_file.close()
    except Exception:
        # Le boot ne doit JAMAIS échouer à cause des migrations : on logge
        # et on sert quand même (les vues gèrent les erreurs DB proprement).
        logger.exception("Démarrage : échec des migrations au boot (le serveur démarre quand même).")


_run_startup_migrations()

from django.core.wsgi import get_wsgi_application  # noqa: E402

app = get_wsgi_application()
