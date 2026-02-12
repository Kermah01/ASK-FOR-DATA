"""
Vues API REST pour Ask For Data Côte d'Ivoire
"""
import hashlib
import logging
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User

logger = logging.getLogger('api')
from .data_service import data_service
from .gemini_service import gemini_service, get_service_for_key
from .models import UserProfile, QueryCache


# Auto-create UserProfile on user creation
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)


def _get_or_create_profile(user):
    """Helper pour obtenir ou créer le profil utilisateur"""
    profile, _ = UserProfile.objects.get_or_create(user=user)
    return profile


# Page Views
def home(request):
    return render(request, 'home_v2.html')

def dashboard(request):
    return render(request, 'dashboard_v3.html')

def sectors(request):
    return render(request, 'sectors.html')

def sector_detail_page(request, sector_name):
    return render(request, 'sector_detail.html', {'sector': sector_name})

@login_required
def chat_page(request):
    profile = _get_or_create_profile(request.user)
    return render(request, 'chat.html', {
        'has_own_key': profile.has_own_key,
        'queries_today': profile.queries_today,
    })

def about(request):
    return render(request, 'about.html')

@login_required
def setup_api_key_page(request):
    from django.conf import settings as conf_settings
    profile = _get_or_create_profile(request.user)
    
    masked_key = None
    has_valid_key = False
    if profile.has_own_key:
        try:
            actual_key = profile.get_api_key()
            if actual_key != conf_settings.GEMINI_API_KEY:
                masked_key = actual_key[:8] + '...' + actual_key[-4:]
                has_valid_key = True
            else:
                profile.clear_api_key()
        except Exception:
            profile.clear_api_key()
    
    server_key_masked = conf_settings.GEMINI_API_KEY[:8] + '...' + conf_settings.GEMINI_API_KEY[-4:]
    
    return render(request, 'setup_api_key.html', {
        'has_own_key': has_valid_key,
        'masked_key': masked_key,
        'server_key_masked': server_key_masked,
    })


# API Views
@csrf_exempt
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

    is_authenticated = request.user.is_authenticated

    # --- Gestion des utilisateurs anonymes (session) ---
    if not is_authenticated:
        from django.conf import settings as conf_settings
        anon_limit = getattr(conf_settings, 'ANONYMOUS_QUERIES_LIMIT', 2)
        anon_queries = request.session.get('anon_queries', 0)

        if anon_queries >= anon_limit:
            return Response({
                'success': False,
                'message': f'Vous avez utilisé vos {anon_limit} requêtes d\'essai. '
                           f'Connectez-vous pour continuer à explorer les données.',
                'needs_login': True,
                'remaining': 0
            }, status=status.HTTP_401_UNAUTHORIZED)

    # --- Utilisateurs connectés : profil et quota ---
    profile = None
    if is_authenticated:
        profile = _get_or_create_profile(request.user)

    # Vérifier le cache d'abord
    query_hash = hashlib.sha256(query.lower().strip().encode()).hexdigest()
    cached = QueryCache.objects.filter(query_hash=query_hash).first()
    if cached and cached.is_trusted:
        cached.hit_count += 1
        cached.save(update_fields=['hit_count'])
        response_data = cached.response_json
        response_data['cached'] = True
        response_data['query_hash'] = query_hash
        # Incrémenter le compteur anonyme même pour les résultats en cache
        if not is_authenticated:
            request.session['anon_queries'] = request.session.get('anon_queries', 0) + 1
            request.session.modified = True
            from django.conf import settings as conf_settings
            anon_limit = getattr(conf_settings, 'ANONYMOUS_QUERIES_LIMIT', 2)
            response_data['remaining'] = anon_limit - request.session['anon_queries']
        return Response(response_data)

    # Vérifier le quota (utilisateurs connectés uniquement)
    if is_authenticated:
        quota = profile.check_and_increment_quota()
        if not quota['allowed']:
            return Response({
                'success': False,
                'message': f'Vous avez atteint votre limite de requêtes gratuites pour aujourd\'hui. '
                           f'Ajoutez votre propre clé API Gemini pour des requêtes illimitées.',
                'needs_key': True,
                'remaining': 0
            }, status=status.HTTP_429_TOO_MANY_REQUESTS)

    # Déterminer quel service Gemini utiliser
    if is_authenticated and profile.has_own_key:
        user_api_key = profile.get_api_key()
        from django.conf import settings as conf_settings
        if user_api_key == conf_settings.GEMINI_API_KEY:
            logger.warning(f"User {request.user.email} has_own_key=True but decryption fell back to server key!")
        else:
            logger.info(f"User {request.user.email} using personal API key (***{user_api_key[-4:]})")
        service = get_service_for_key(user_api_key)
    else:
        service = gemini_service
    
    if service is None:
        return Response({
            'success': False,
            'message': 'Le service d\'analyse n\'est pas configuré.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    # Interpréter la requête
    result = service.interpret_query(query)

    # Gérer le compteur restant selon le type d'utilisateur
    if is_authenticated:
        result['remaining'] = quota['remaining']
    else:
        # Incrémenter le compteur anonyme
        request.session['anon_queries'] = request.session.get('anon_queries', 0) + 1
        request.session.modified = True
        from django.conf import settings as conf_settings
        anon_limit = getattr(conf_settings, 'ANONYMOUS_QUERIES_LIMIT', 2)
        result['remaining'] = anon_limit - request.session['anon_queries']

    # Mettre en cache les résultats réussis
    if result.get('success'):
        try:
            QueryCache.objects.update_or_create(
                query_hash=query_hash,
                defaults={
                    'query_text': query,
                    'response_json': result,
                    'positive_feedback': 0,
                    'negative_feedback': 0,
                    'invalidated': False,
                }
            )
        except Exception:
            pass
    
    result['query_hash'] = query_hash
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
def dashboard_data(request):
    """
    Endpoint pour alimenter les dashboards avec les données réelles de la BDD.
    
    GET /api/dashboard-data
    """
    def get_series(code, n_last=10):
        """Retourne les n dernières valeurs d'un indicateur."""
        detail = data_service.get_indicator_detail(code)
        if not detail or not detail.get('values'):
            return {'years': [], 'values': [], 'name': code}
        vals = detail['values'][-n_last:] if len(detail['values']) > n_last else detail['values']
        return {
            'years': [v['year'] for v in vals],
            'values': [round(v['value'], 4) for v in vals],
            'name': detail['name'],
        }

    def latest(code):
        """Retourne la dernière valeur connue d'un indicateur."""
        detail = data_service.get_indicator_detail(code)
        if not detail or not detail.get('values'):
            return {'year': None, 'value': None}
        v = detail['values'][-1]
        return {'year': v['year'], 'value': round(v['value'], 4)}

    def prev(code):
        """Retourne l'avant-dernière valeur connue."""
        detail = data_service.get_indicator_detail(code)
        if not detail or not detail.get('values') or len(detail['values']) < 2:
            return {'year': None, 'value': None}
        v = detail['values'][-2]
        return {'year': v['year'], 'value': round(v['value'], 4)}

    # --- KPIs ---
    gdp = latest('NY.GDP.MKTP.CD')
    gdp_prev = prev('NY.GDP.MKTP.CD')
    gdp_growth = latest('NY.GDP.MKTP.KD.ZG')
    inflation = latest('FP.CPI.TOTL.ZG')
    inflation_prev = prev('FP.CPI.TOTL.ZG')
    pop = latest('SP.POP.TOTL')
    pop_growth = latest('SP.POP.GROW')
    life_exp = latest('SP.DYN.LE00.IN')
    life_exp_prev = prev('SP.DYN.LE00.IN')
    unemp = latest('SL.UEM.TOTL.ZS')

    kpis = {
        'gdp': {
            'value': f"${gdp['value']/1e9:.1f} Mrd" if gdp['value'] else 'N/A',
            'year': gdp['year'],
            'trend': f"+{gdp_growth['value']:.1f}% vs n-1" if gdp_growth['value'] and gdp_growth['value'] > 0 else f"{gdp_growth['value']:.1f}% vs n-1" if gdp_growth['value'] else '',
            'dir': 'up' if gdp_growth['value'] and gdp_growth['value'] > 0 else 'down',
        },
        'inflation': {
            'value': f"{inflation['value']:.1f}%" if inflation['value'] else 'N/A',
            'year': inflation['year'],
            'trend': 'En baisse' if inflation_prev['value'] and inflation['value'] and inflation['value'] < inflation_prev['value'] else 'En hausse',
            'dir': 'up' if inflation_prev['value'] and inflation['value'] and inflation['value'] < inflation_prev['value'] else 'down',
        },
        'pop': {
            'value': f"{pop['value']/1e6:.1f} M" if pop['value'] else 'N/A',
            'year': pop['year'],
            'trend': f"+{pop_growth['value']:.1f}% an" if pop_growth['value'] else '',
            'dir': 'neutral',
        },
        'life': {
            'value': f"{life_exp['value']:.1f} Ans" if life_exp['value'] else 'N/A',
            'year': life_exp['year'],
            'trend': f"+{life_exp['value'] - life_exp_prev['value']:.1f}" if life_exp['value'] and life_exp_prev['value'] else '',
            'dir': 'up' if life_exp['value'] and life_exp_prev['value'] and life_exp['value'] > life_exp_prev['value'] else 'neutral',
        },
        'unemp': {
            'value': f"{unemp['value']:.1f}%" if unemp['value'] else 'N/A',
            'year': unemp['year'],
            'trend': 'Au sens BIT',
            'dir': 'neutral',
        },
    }

    # --- Séries temporelles pour les graphiques ---
    series_data = {
        # Macro
        'gdp_nominal': get_series('NY.GDP.MKTP.CD', 10),
        'gdp_growth': get_series('NY.GDP.MKTP.KD.ZG', 10),
        'gdp_per_capita': get_series('NY.GDP.PCAP.CD', 10),
        'inflation': get_series('FP.CPI.TOTL.ZG', 10),
        'exports_pct': get_series('NE.EXP.GNFS.ZS', 10),
        'imports_pct': get_series('NE.IMP.GNFS.ZS', 10),
        'fdi_pct': get_series('BX.KLT.DINV.WD.GD.ZS', 10),
        # Demographie
        'population': get_series('SP.POP.TOTL', 10),
        'pop_growth': get_series('SP.POP.GROW', 10),
        'urban_pct': get_series('SP.URB.TOTL.IN.ZS', 10),
        'fertility': get_series('SP.DYN.TFRT.IN', 10),
        'birth_rate': get_series('SP.DYN.CBRT.IN', 10),
        'death_rate': get_series('SP.DYN.CDRT.IN', 10),
        # Sante
        'life_expectancy': get_series('SP.DYN.LE00.IN', 10),
        'infant_mortality': get_series('SP.DYN.IMRT.IN', 10),
        'health_expenditure': get_series('SH.XPD.CHEX.GD.ZS', 10),
        'physicians': get_series('SH.MED.PHYS.ZS', 10),
        # Education
        'primary_enroll': get_series('SE.PRM.ENRR', 10),
        'secondary_enroll': get_series('SE.SEC.ENRR', 10),
        'tertiary_enroll': get_series('SE.TER.ENRR', 10),
        'literacy': get_series('SE.ADT.LITR.ZS', 10),
        # Emploi
        'unemployment': get_series('SL.UEM.TOTL.ZS', 10),
        'labor_force': get_series('SL.TLF.TOTL.IN', 10),
        # Infrastructure
        'electricity_access': get_series('EG.ELC.ACCS.ZS', 10),
        'electricity_consumption': get_series('EG.USE.ELEC.KH.PC', 10),
        'internet_users': get_series('IT.NET.USER.ZS', 10),
        'mobile_subscriptions': get_series('IT.CEL.SETS.P2', 10),
        # Environnement
        'forest_pct': get_series('AG.LND.FRST.ZS', 10),
        'arable_land_pct': get_series('AG.LND.ARBL.ZS', 10),
        # Pauvreté
        'poverty': get_series('SI.POV.NAHC', 10),
        'gini': get_series('SI.POV.GINI', 10),
    }

    return Response({
        'kpis': kpis,
        'series': series_data,
    })


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


@csrf_exempt
@api_view(['POST'])
def submit_feedback(request):
    """
    Endpoint pour soumettre un feedback sur une réponse IA
    
    POST /api/feedback
    Body: {"query_hash": "...", "feedback": "positive" ou "negative"}
    """
    query_hash = request.data.get('query_hash', '').strip()
    feedback = request.data.get('feedback', '').strip()
    
    if not query_hash or feedback not in ('positive', 'negative'):
        return Response({
            'success': False,
            'message': 'Paramètres invalides.'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    cached = QueryCache.objects.filter(query_hash=query_hash).first()
    if not cached:
        return Response({
            'success': False,
            'message': 'Réponse non trouvée.'
        }, status=status.HTTP_404_NOT_FOUND)
    
    if feedback == 'positive':
        cached.positive_feedback += 1
        cached.save(update_fields=['positive_feedback'])
    else:
        cached.negative_feedback += 1
        # Invalidate cache if negative feedback reaches threshold
        if cached.negative_feedback >= cached.positive_feedback and cached.negative_feedback >= 1:
            cached.invalidated = True
        cached.save(update_fields=['negative_feedback', 'invalidated'])
    
    return Response({
        'success': True,
        'message': 'Merci pour votre retour !' if feedback == 'positive' 
                   else 'Merci. Cette réponse sera réanalysée lors de la prochaine requête.',
        'invalidated': cached.invalidated
    })


@api_view(['GET'])
def suggest_indicators(request):
    """
    Endpoint pour l'autocomplétion
    
    GET /api/suggest?q=...
    """
    query = request.GET.get('q', '').strip()
    if not query or len(query) < 2:
        return Response({'suggestions': []})
    
    try:
        suggestions = data_service.search_indicators(query)
        # Limiter à 10 résultats pour l'autocomplétion
        return Response({'suggestions': suggestions[:10]})
    except Exception as e:
        return Response({'suggestions': [], 'error': str(e)})


@csrf_exempt
@api_view(['POST'])
def save_api_key(request):
    """Sauvegarde la clé API Gemini de l'utilisateur"""
    if not request.user.is_authenticated:
        return Response({'success': False, 'message': 'Non authentifié.'}, status=401)

    api_key = request.data.get('api_key', '').strip()
    if not api_key or not api_key.startswith('AIza'):
        return Response({
            'success': False,
            'message': 'Clé API invalide. Elle doit commencer par "AIza".'
        }, status=400)

    # Vérifier que la clé fonctionne
    import google.generativeai as genai
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-2.5-flash')
        model.generate_content('test')
    except Exception as e:
        error_str = str(e).lower()
        if '429' in error_str or 'quota' in error_str:
            return Response({
                'success': False,
                'message': 'Cette clé API a déjà épuisé son quota. Vérifiez que l\'API est bien activée sur votre projet Google.'
            }, status=400)
        return Response({
            'success': False,
            'message': f'Clé API invalide ou non fonctionnelle: {str(e)[:100]}'
        }, status=400)

    profile = _get_or_create_profile(request.user)
    profile.set_api_key(api_key)

    return Response({
        'success': True,
        'message': 'Clé API sauvegardée ! Vous avez maintenant des requêtes illimitées.'
    })


@csrf_exempt
@api_view(['POST'])
def delete_api_key(request):
    """Supprime la clé API personnelle de l'utilisateur"""
    if not request.user.is_authenticated:
        return Response({'success': False}, status=401)

    profile = _get_or_create_profile(request.user)
    profile.clear_api_key()
    return Response({'success': True, 'message': 'Clé API supprimée.'})


@api_view(['GET'])
def user_status(request):
    """Retourne le statut de l'utilisateur (quota, clé, etc.)"""
    if not request.user.is_authenticated:
        from django.conf import settings as s
        anon_limit = getattr(s, 'ANONYMOUS_QUERIES_LIMIT', 2)
        anon_queries = request.session.get('anon_queries', 0)
        return Response({
            'authenticated': False,
            'has_own_key': False,
            'remaining': max(0, anon_limit - anon_queries),
            'anon_limit': anon_limit,
            'anon_queries': anon_queries,
        })

    from django.conf import settings
    profile = _get_or_create_profile(request.user)
    from django.utils import timezone
    today = timezone.now().date()
    if profile.last_query_date != today:
        queries_today = 0
    else:
        queries_today = profile.queries_today

    limit = settings.FREE_QUERIES_PER_DAY
    remaining = limit - queries_today if not profile.has_own_key else -1

    # Masquer la clé API pour affichage
    masked_key = None
    key_source = 'server'
    if profile.has_own_key:
        try:
            actual_key = profile.get_api_key()
            if actual_key != settings.GEMINI_API_KEY:
                masked_key = actual_key[:8] + '...' + actual_key[-4:]
                key_source = 'personal'
            else:
                key_source = 'server_fallback'
                profile.clear_api_key()
        except Exception:
            key_source = 'server_fallback'
            profile.clear_api_key()

    return Response({
        'authenticated': True,
        'email': request.user.email,
        'has_own_key': profile.has_own_key and key_source == 'personal',
        'masked_key': masked_key,
        'key_source': key_source,
        'queries_today': queries_today,
        'remaining': remaining,
        'limit': limit,
    })
