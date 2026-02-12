#!/bin/bash
set -e

# Ask For Data Côte d'Ivoire — Production startup

PORT="${PORT:-3000}"

echo "── Collecting static files..."
python manage.py collectstatic --noinput

echo "── Running migrations..."
python manage.py migrate --noinput

echo "── Starting gunicorn on port $PORT..."
exec gunicorn askfordata.wsgi \
    --bind "0.0.0.0:$PORT" \
    --workers 3 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
