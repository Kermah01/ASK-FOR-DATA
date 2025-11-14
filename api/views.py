"""
Vues API REST pour Ask For Data Côte d'Ivoire
"""
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from .data_service import data_service
from .gemini_service import gemini_service


@api_view(['POST'])
def query_data(request):
    """
    Endpoint pour interpréter une requête utilisateur
    
    POST /api/query
    Body: {"query": "votre question"}
    """
    query = request.data.get('query', '').strip()
    
    if not query:
        return Response({
            'success': False,
            'message': 'Veuillez poser une question.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    # Vérifier que Gemini est initialisé
    if gemini_service is None:
        return Response({
            'success': False,
            'message': 'Le service d\'analyse n\'est pas configuré.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    # Interpréter la requête via Gemini
    result = gemini_service.interpret_query(query)
    
    return Response(result)


@api_view(['GET'])
def list_indicators(request):
    """
    Endpoint pour lister tous les indicateurs
    
    GET /api/indicators
    """
    try:
        indicators = data_service.get_all_indicators()
        
        # Filtrer par recherche si paramètre fourni
        search = request.GET.get('search', '').strip().lower()
        if search:
            indicators = [
                ind for ind in indicators 
                if search in str(ind['name']).lower() or search in str(ind['code']).lower()
            ]
        
        return Response({
            'success': True,
            'count': len(indicators),
            'indicators': indicators
        })
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Erreur lors de la récupération des indicateurs: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def indicator_detail(request, code):
    """
    Endpoint pour obtenir les détails d'un indicateur
    
    GET /api/indicator/<code>
    """
    try:
        indicator = data_service.get_indicator_detail(code)
        
        if indicator is None:
            return Response({
                'success': False,
                'message': f'Indicateur {code} non trouvé.'
            }, status=status.HTTP_404_NOT_FOUND)
        
        return Response({
            'success': True,
            'indicator': indicator
        })
    except Exception as e:
        return Response({
            'success': False,
            'message': f'Erreur lors de la récupération de l\'indicateur: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def health_check(request):
    """
    Endpoint de santé
    
    GET /api/health
    """
    return Response({
        'status': 'ok',
        'service': 'Ask For Data Côte d\'Ivoire'
    })
