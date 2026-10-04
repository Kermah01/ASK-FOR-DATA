"""
Gestion globale des exceptions pour l'API REST.

Sans ce handler, une exception non prévue (ex. OperationalError si une table
SQLite manque sur le disque éphémère de Render) renvoie la page d'erreur HTML
de Django : le JavaScript du front ne peut pas la parser et l'utilisateur ne
voit rien. Ici, toute exception non gérée devient un JSON propre et loggé.
"""
import logging

from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger('api')


def api_exception_handler(exc, context):
    """Renvoie toujours du JSON pour les vues API, même en cas d'erreur serveur."""
    # Laisser DRF gérer ses propres exceptions (404, 403, validation, etc.)
    response = drf_exception_handler(exc, context)
    if response is not None:
        return response

    # Exception non gérée (OperationalError, bug, etc.) → JSON 500 propre
    view = context.get('view')
    view_name = view.__class__.__name__ if view else 'unknown'
    logger.exception("Erreur serveur non gérée dans la vue API %s : %s", view_name, exc)

    return Response(
        {
            'success': False,
            'message': "Une erreur interne est survenue côté serveur. "
                       "Veuillez réessayer dans quelques instants.",
            'error_type': exc.__class__.__name__,
        },
        status=500,
    )
