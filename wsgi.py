"""
WSGI config for askfordata project.
It exposes the WSGI callable as a module-level variable named ``application``.
"""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'askfordata.settings')

application = get_wsgi_application()

# Auto-réveil pendant les heures ouvrées (offre gratuite Render, quota 750 h/mois) :
# inactif hors Render (pas de RENDER_EXTERNAL_URL) ; voir askfordata/keepalive.py.
from askfordata import keepalive  # noqa: E402

keepalive.start(default_path='/api/health')
