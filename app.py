"""
WSGI entry point for Render deployment.
This file allows Render to find the WSGI application using 'gunicorn app:app'
"""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'askfordata.settings')

app = get_wsgi_application()
