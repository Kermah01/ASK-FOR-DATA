"""
Service pour l'intégration avec l'API Gemini
"""
import google.generativeai as genai
import json
import re
import os
import time
import logging
from typing import Dict, Optional, List
from .data_service import data_service
from .national_data_service import national_data_service as nds

logger = logging.getLogger(__name__)


# Dictionnaire de synonymes pour mapper le langage naturel aux concepts des indicateurs
QUERY_SYNONYMS = {
    # Population & Démographie
    'habitants': 'population total',
    'nombre d\'habitants': 'population total',
    'combien de personnes': 'population total',
    'combien d\'habitants': 'population total',
    'démographie': 'population total',
    'gens': 'population total',
    'peuple': 'population total',
    'natalité': 'taux de natalité birth rate',
    'naissances': 'taux de natalité birth rate',
    'mortalité': 'taux de mortalité death rate mortality',
    'décès': 'taux de mortalité death rate',
    'morts': 'taux de mortalité death rate mortality',
    'espérance de vie': 'espérance de vie life expectancy',
    'durée de vie': 'espérance de vie life expectancy',
    'vivre combien de temps': 'espérance de vie life expectancy',
    'fertilité': 'taux de fertilité fertility rate',
    'fécondité': 'taux de fertilité fertility rate',
    'enfants par femme': 'taux de fertilité fertility rate',
    'migration': 'migration net migration',
    'urbanisation': 'population urbaine urban population',
    'ville': 'population urbaine urban population',
    'rural': 'population rurale rural population',
    'campagne': 'population rurale rural population',
    
    # Économie
    'richesse': 'PIB GDP produit intérieur brut',
    'économie': 'PIB GDP produit intérieur brut',
    'pib': 'PIB GDP produit intérieur brut',
    'croissance': 'croissance PIB GDP growth',
    'croissance économique': 'croissance PIB GDP growth',
    'recession': 'croissance PIB GDP growth',
    'revenu': 'revenu national GNI income',
    'revenu par habitant': 'PIB par habitant GDP per capita',
    'niveau de vie': 'PIB par habitant GDP per capita',
    'pouvoir d\'achat': 'PIB par habitant GDP per capita PPA PPP',
    'inflation': 'inflation consumer prices CPI',
    'prix': 'inflation consumer prices CPI',
    'cherté de la vie': 'inflation consumer prices CPI',
    'coût de la vie': 'inflation consumer prices CPI',
    'dette': 'dette debt endettement stock service financements DGF',
    'endettement': 'dette debt endettement stock PIB financements',
    'dette publique': 'dette publique stock extérieure intérieure PIB financements DGF',
    'dette extérieure': 'dette extérieure bilatéral multilatéral obligations financements',
    'dette intérieure': 'dette intérieure titres publics marché financements',
    'service de la dette': 'service dette remboursement principal intérêts financements',
    'viabilité de la dette': 'dette PIB intérêts recettes taux durée financements',
    'budget': 'TOFE budget dépenses recettes solde budgétaire gouvernement',
    'tofe': 'TOFE tableau opérations financières État recettes dépenses budget',
    'dépenses publiques': 'dépenses totales TOFE gouvernement fonctionnement investissement',
    'recettes': 'recettes fiscales TOFE dons revenue tax',
    'impôts': 'impôts directs recettes fiscales tax revenue TOFE',
    'fiscalité': 'recettes fiscales pression fiscale TOFE',
    'pression fiscale': 'pression fiscale recettes fiscales pourcentage PIB TOFE',
    'taux de pression fiscale': 'pression fiscale recettes fiscales pourcentage PIB TOFE',
    'recettes fiscales': 'recettes fiscales impôts TOFE',
    'revenus fiscaux': 'recettes fiscales tax revenue fiscal TOFE',
    'taxes': 'recettes fiscales tax revenue TOFE',
    'masse salariale': 'rémunération salariés masse salariale fonction publique TOFE',
    'salaires fonction publique': 'rémunération salariés masse salariale TOFE',
    'solde budgétaire': 'solde budgétaire déficit budget TOFE pourcentage PIB',
    'déficit budgétaire': 'solde budgétaire déficit budget TOFE',
    'subventions': 'subventions transferts TOFE dépenses',
    'dépenses d\'investissement': 'dépenses investissement TOFE capital',
    'financement du déficit': 'financement intérieur extérieur déficit TOFE',
    'investissement': 'investissement investment FDI FBCF capital formation taux',
    'investissement étranger': 'investissement direct étranger IDE FDI foreign direct',
    'ide': 'investissement direct étranger IDE FDI',
    'fbcf': 'formation brute capital fixe investissement FBCF',
    'taux d\'investissement': 'taux investissement FBCF PIB',
    'épargne': 'épargne savings gross domestic',
    'consommation': 'consommation finale consumption expenditure',
    'dépenses de santé': 'dépenses santé health expenditure',
    'dépenses militaires': 'dépenses militaires military expenditure',
    'transferts': 'transferts remittances',
    'aide': 'aide au développement ODA aid',
    'réserves': 'réserves reserves',
    'taux de change': 'taux de change exchange rate',
    
    # Commerce & Douanes
    'exportation': 'exportation export FOB douanes',
    'importation': 'importation import CAF douanes',
    'commerce': 'commerce trade balance commerciale douanes',
    'échanges commerciaux': 'commerce trade exportation importation',
    'balance commerciale': 'balance commerciale trade balance solde commercial douanes',
    'douanes': 'douanes recettes douanières importation exportation commerce extérieur',
    'taux de couverture': 'taux couverture commerciale exportations importations',
    'commerce extérieur': 'exportation importation balance commerciale douanes FOB CAF',
    
    # Emploi
    'chômage': 'chômage unemployment',
    'emploi': 'emploi employment',
    'travail': 'emploi employment labor',
    'sans emploi': 'chômage unemployment',
    'travailleurs': 'emploi employment labor force',
    'main d\'oeuvre': 'population active labor force',
    
    # Éducation
    'école': 'éducation education enrollment school',
    'scolarisation': 'scolarisation enrollment education',
    'alphabétisation': 'alphabétisation literacy',
    'lire et écrire': 'alphabétisation literacy',
    'éducation': 'éducation education enrollment',
    'université': 'enseignement supérieur tertiary education',
    'primaire': 'enseignement primaire primary education',
    'secondaire': 'enseignement secondaire secondary education',
    'enseignants': 'enseignants teachers',
    'professeurs': 'enseignants teachers',
    
    # Santé
    'santé': 'santé health',
    'maladie': 'santé health disease',
    'hôpital': 'santé health hospital',
    'médecins': 'médecins physicians doctors',
    'docteurs': 'médecins physicians doctors',
    'vaccination': 'vaccination immunization',
    'vaccin': 'vaccination immunization',
    'sida': 'VIH HIV AIDS',
    'vih': 'VIH HIV AIDS',
    'paludisme': 'paludisme malaria',
    'malaria': 'paludisme malaria',
    'tuberculose': 'tuberculose tuberculosis',
    'mortalité infantile': 'mortalité infantile infant mortality',
    'mortalité maternelle': 'mortalité maternelle maternal mortality',
    'malnutrition': 'malnutrition nutrition',
    'eau potable': 'eau potable drinking water access',
    'assainissement': 'assainissement sanitation',
    
    # Énergie & Environnement
    'électricité': 'électricité electricity access energy',
    'énergie': 'énergie energy',
    'co2': 'émissions CO2 emissions',
    'pollution': 'émissions CO2 emissions pollution',
    'forêt': 'forêt forest',
    'déforestation': 'forêt forest area',
    'environnement': 'environnement forest emissions CO2',
    'climat': 'changement climatique CO2 emissions',
    
    # Agriculture & Agro-industrie
    'agriculture': 'agriculture agricultural cacao secteur primaire',
    'terres agricoles': 'terres agricoles agricultural land',
    'cacao': 'cacao cocoa production transformation agriculture',
    'café': 'café coffee agriculture',
    'récolte': 'agriculture agricultural crop',
    'transformation cacao': 'cacao transformé taux transformation broyage',
    'production cacao': 'cacao production tonnes',
    
    # Technologie
    'internet': 'internet individuals using',
    'téléphone': 'téléphone mobile cellular',
    'portable': 'téléphone mobile cellular subscriptions',
    'numérique': 'internet technology ICT',
    'technologie': 'internet technology ICT',
    
    # Secteurs économiques
    'secteur primaire': 'secteur primaire agriculture PIB emploi',
    'secteur secondaire': 'secteur secondaire industrie BTP manufactures PIB emploi',
    'secteur tertiaire': 'secteur tertiaire services commerce transports PIB emploi',
    'btp': 'BTP bâtiment travaux publics construction PIB',
    'industrie': 'industrie manufacturière extractive PIB',
    'industries extractives': 'industries extractives pétrole mines PIB',
    
    # Développement humain
    'idh': 'IDH développement humain human development index espérance de vie éducation revenu',
    'développement humain': 'IDH développement humain human development index',
    'indice de développement': 'IDH développement humain human development index',
    
    # Pauvreté & Inégalités
    'pauvreté': 'pauvreté poverty',
    'pauvre': 'pauvreté poverty',
    'inégalité': 'inégalité inequality GINI',
    'gini': 'inégalité inequality GINI',
    
    # Gouvernance
    'corruption': 'corruption governance control',
    'gouvernance': 'gouvernance governance',
    'démocratie': 'démocratie governance political stability',
    'stabilité': 'stabilité politique political stability',
    'sécurité': 'sécurité security stability violence',
    
    # Infrastructure
    'routes': 'routes roads infrastructure',
    'infrastructure': 'infrastructure',
    'transport': 'transport infrastructure roads',
}


class GeminiService:
    """Service pour interpréter les requêtes utilisateur via Gemini"""
    
    MAX_RETRIES = 3
    RETRY_BASE_DELAY = 2  # seconds
    
    def __init__(self, api_key: str):
        """
        Initialise le service Gemini
        
        Args:
            api_key: Clé API Gemini
        """
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        self.fallback_model = genai.GenerativeModel('gemini-2.0-flash-lite')
        self._quota_exhausted = False
    
    def _call_gemini(self, prompt: str, use_fallback: bool = False) -> str:
        """
        Appelle l'API Gemini avec retry automatique et fallback model.
        Retourne le texte de la réponse.
        Lève une exception si tous les essais échouent.
        """
        models_to_try = [self.model, self.fallback_model] if not use_fallback else [self.fallback_model]
        if self._quota_exhausted:
            models_to_try = [self.fallback_model]
        
        last_error = None
        for model in models_to_try:
            for attempt in range(self.MAX_RETRIES):
                try:
                    response = model.generate_content(prompt)
                    self._quota_exhausted = False
                    return response.text
                except Exception as e:
                    last_error = e
                    error_str = str(e).lower()
                    is_quota_error = '429' in error_str or 'quota' in error_str or 'resource_exhausted' in error_str or 'resourceexhausted' in str(type(e).__name__).lower()
                    if is_quota_error:
                        logger.warning(f"Quota exceeded for {model.model_name} (attempt {attempt+1}/{self.MAX_RETRIES})")
                        # If daily quota hit (limit: 0), no point retrying
                        if 'limit: 0' in error_str or 'perdayperproject' in error_str.replace(' ', '').replace('_', ''):
                            if model == self.model:
                                self._quota_exhausted = True
                                break  # Try fallback model
                            else:
                                raise  # Both models exhausted, fail fast
                        if model == self.model:
                            self._quota_exhausted = True
                            break  # Switch to fallback model immediately
                        delay = self.RETRY_BASE_DELAY * (2 ** attempt)
                        time.sleep(delay)
                    else:
                        logger.error(f"Gemini API error: {e}")
                        raise
        
        raise last_error
    
    def _enrich_query(self, user_query: str) -> str:
        """
        Enrichit la requête utilisateur avec des mots-clés pertinents
        à partir du dictionnaire de synonymes pour améliorer la compréhension.
        """
        query_lower = user_query.lower().strip()
        enrichments = set()
        
        # Chercher les correspondances dans le dictionnaire de synonymes
        for key, value in QUERY_SYNONYMS.items():
            if key in query_lower:
                enrichments.add(value)
        
        if enrichments:
            enrichment_text = ', '.join(enrichments)
            return f"{user_query} [Mots-clés associés: {enrichment_text}]"
        
        return user_query
    
    def _try_fallback_search(self, user_query: str) -> Optional[Dict]:
        """
        Tente une recherche par mots-clés dans la base de données
        quand Gemini ne trouve pas de correspondance.
        Retourne le meilleur indicateur trouvé ou None.
        """
        query_lower = user_query.lower()
        
        # Étape 1: Chercher avec les synonymes enrichis
        search_terms = set()
        for key, value in QUERY_SYNONYMS.items():
            if key in query_lower:
                # Ajouter chaque mot du mapping comme terme de recherche
                for word in value.split():
                    if len(word) > 2:
                        search_terms.add(word)
        
        # Étape 2: Ajouter les mots significatifs de la requête originale
        stop_words = {
            'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'en', 'au', 'aux',
            'et', 'ou', 'est', 'sont', 'a', 'ont', 'ce', 'cette', 'ces',
            'qui', 'que', 'quoi', 'quel', 'quelle', 'quels', 'quelles',
            'comment', 'combien', 'pourquoi', 'quand', 'où',
            'il', 'elle', 'ils', 'elles', 'on', 'nous', 'vous',
            'mon', 'ton', 'son', 'ma', 'ta', 'sa', 'mes', 'tes', 'ses',
            'je', 'tu', 'me', 'te', 'se', 'ne', 'pas', 'plus', 'moins',
            'par', 'pour', 'avec', 'sans', 'dans', 'sur', 'sous',
            'très', 'trop', 'peu', 'beaucoup', 'bien', 'mal',
            'fait', 'faire', 'être', 'avoir', 'aller', 'dire',
            'peut', 'doit', 'faut', 'y', 'ci', 'là',
            'côte', 'ivoire', "d'ivoire", 'ivoirien', 'ivoirienne',
            'quel', 'quelle', 'donnez', 'donne', 'moi', 'svp', 'stp',
            'merci', 'bonjour', 'salut', 'hey', 'bonsoir',
            'veux', 'voudrais', 'savoir', 'connaître', 'cherche',
            'information', 'informations', 'données', 'donnée',
            'statistique', 'statistiques', 'chiffre', 'chiffres',
            'pays', 'nation', 'état', 'republic', 'république',
            'actuel', 'actuelle', 'actuellement', 'récent', 'récente',
            'dernier', 'dernière', 'derniers', 'dernières',
            'année', 'années', 'ans', 'depuis', 'entre',
        }
        
        query_words = re.findall(r'[a-zàâäéèêëïîôùûüÿç]+', query_lower)
        for word in query_words:
            if word not in stop_words and len(word) > 2:
                search_terms.add(word)
        
        if not search_terms:
            return None
        
        # Étape 3: Chercher dans les indicateurs avec les termes enrichis
        best_match = None
        best_score = 0
        
        # Search in World Bank indicators
        for term in search_terms:
            results = data_service.search_indicators(term)
            if results:
                match = results[0]
                indicator_lower = match['name'].lower()
                score = sum(1 for t in search_terms if t in indicator_lower) * 100
                score += 50
                if score > best_score:
                    best_score = score
                    best_match = match
        
        # Search in national indicators
        for term in search_terms:
            nat_results = nds.search_indicators(term)
            if nat_results:
                match = nat_results[0]
                indicator_lower = match['name'].lower()
                score = sum(1 for t in search_terms if t in indicator_lower) * 100
                score += 75  # Slight bonus for national data (more specific)
                if score > best_score:
                    best_score = score
                    best_match = match
        
        return best_match
    
    def _clean_json_response(self, response_text: str) -> str:
        """Nettoie la réponse de Gemini pour extraire le JSON valide."""
        text = response_text.strip()
        if text.startswith('```json'):
            text = text[7:]
        if text.startswith('```'):
            text = text[3:]
        if text.endswith('```'):
            text = text[:-3]
        return text.strip()
    
    def _build_data_analysis_prompt(self, indicator_name: str, values: list,
                                     methodology: str, user_query: str,
                                     match_type: str = 'exact',
                                     proxy_explanation: str = None,
                                     definition: str = None) -> str:
        """
        Construit un prompt d'analyse statistique avec les données réelles.
        Phase 2: Gemini analyse les données comme un économiste/statisticien.
        Gère les cas exact match vs proxy indicator.
        """
        # Formater les données
        data_str = "\n".join([f"  {v['year']}: {v['value']}" for v in values])
        
        # Calculer des stats de base pour aider l'analyse
        vals = [v['value'] for v in values]
        years = [v['year'] for v in values]
        
        stats_context = ""
        if len(vals) >= 2:
            variation_totale = ((vals[-1] - vals[0]) / vals[0]) * 100 if vals[0] != 0 else 0
            val_min = min(vals)
            val_max = max(vals)
            moyenne = sum(vals) / len(vals)
            year_min = years[vals.index(val_min)]
            year_max = years[vals.index(val_max)]
            
            stats_context = f"""
STATISTIQUES CALCULÉES (vérifiées, tu peux les utiliser):
- Valeur min: {val_min:.4g} (en {year_min})
- Valeur max: {val_max:.4g} (en {year_max})
- Moyenne: {moyenne:.4g}
- Variation totale: {variation_totale:+.2f}% entre {years[0]} et {years[-1]}
- Nombre de points: {len(vals)}"""
        
        definition_section = ""
        if definition:
            definition_section = f"""

DÉFINITION DE L'INDICATEUR:
{definition}"""

        methodology_section = ""
        if methodology:
            meth_text = methodology[:1500] if len(methodology) > 1500 else methodology
            methodology_section = f"""

MÉTHODOLOGIE DE COLLECTE:
{meth_text}"""

        # Section proxy/exact match
        proxy_section = ""
        if match_type == 'proxy' and proxy_explanation:
            proxy_section = f"""
ATTENTION — INDICATEUR PROXY:
L'utilisateur a demandé quelque chose que notre base ne contient PAS directement.
L'indicateur ci-dessous est un PROXY (indicateur approché/composant).
Explication du lien: {proxy_explanation}

Tu DOIS ABSOLUMENT:
1. Commencer par dire clairement que l'indicateur exact demandé n'est pas disponible dans la base.
2. Expliquer le LIEN entre ce que l'utilisateur a demandé et l'indicateur que tu présentes.
3. Ensuite seulement, analyser les données de l'indicateur proxy."""
        
        return f"""Tu es un statisticien-économiste expert de la Côte d'Ivoire.

Ta mission: RÉPONDRE DIRECTEMENT à la question de l'utilisateur. Tu n'es PAS un robot qui récite des fiches. Tu es un expert qui dialogue avec quelqu'un qui te pose une vraie question. Adapte ta réponse au contexte précis de la question.

INDICATEUR FOURNI: {indicator_name}

DONNÉES:
{data_str}
{stats_context}
{definition_section}
{methodology_section}
{proxy_section}

QUESTION DE L'UTILISATEUR: "{user_query}"

RÈGLES STRICTES:
1. RÉPONDS à la question posée. Si on te demande "quel est l'IDH ?", ne commence pas par "L'espérance de vie est...". Commence par répondre à ce que l'utilisateur a demandé. 
2. UTILISE UNIQUEMENT les données fournies. NE JAMAIS inventer de chiffres.
3. Sois CONCIS: 3-5 paragraphes courts maximum.
4. Donne une définition claire et concise de l'indicateur ainsi que de sa méthode de collecte, et de sa source si possible en 1 ou 2 phrases max. 
5. Donne la tendance GLOBALE avec les chiffres clés. Pas de détail année par année.
6. Interprétations PRUDENTES: "cela pourrait s'expliquer par...", "possiblement lié à..."
7. Utilise **gras** pour les chiffres clés et concepts importants.
8. Termine par: "Les données détaillées sont présentées dans le graphique et le tableau ci-dessous."
9. Ton ton doit être naturel, comme un expert qui parle à un citoyen, un utilisateur lambda qui n'est pas forcément bon statisticien. PAS de langage robotique.

Réponds UNIQUEMENT en JSON:
{{
    "analysis": "TA RÉPONSE PERSONNALISÉE ICI (paragraphes séparés par \\n\\n)",
    "related_indicators": ["Indicateur connexe 1", "Indicateur connexe 2", "Indicateur connexe 3"]
}}"""
    
    def interpret_query(self, user_query: str) -> Dict:
        """
        Interprète une requête utilisateur en 2 phases:
        Phase 1: Identifier l'indicateur pertinent
        Phase 2: Analyser les données réelles comme un statisticien
        """
        
        # === PHASE 1: IDENTIFICATION DE L'INDICATEUR ===
        enriched_query = self._enrich_query(user_query)
        
        # Extraire les termes de recherche pour pré-filtrer les indicateurs
        search_terms = set()
        query_lower = user_query.lower()
        for key, value in QUERY_SYNONYMS.items():
            if key in query_lower:
                for word in value.split():
                    if len(word) > 2:
                        search_terms.add(word)
        # Ajouter les mots significatifs de la requête
        for word in re.findall(r'[a-zàâäéèêëïîôùûüÿç]+', query_lower):
            if len(word) > 3:
                search_terms.add(word)
        
        indicators_list = data_service.get_compact_indicator_list(
            search_terms=list(search_terms) if search_terms else None
        )
        
        # Ajouter les indicateurs nationaux (TOFE, Douanes, Base Éco, Financements)
        national_indicators_list = nds.get_compact_indicator_list()
        
        phase1_prompt = f"""Identifie l'indicateur le plus pertinent pour la question ci-dessous.
Voici la liste des indicateurs disponibles (Côte d'Ivoire).
Format: CODE|NOM ou CODE|NOM|DESCRIPTION (la description aide à comprendre ce que mesure l'indicateur).

=== INDICATEURS BANQUE MONDIALE (2000-2024) ===
{indicators_list}

=== INDICATEURS NATIONAUX (TOFE, Douanes, Base Éco, Financements) ===
Les codes commençant par NAT. sont des données nationales plus détaillées.
{national_indicators_list}

GUIDE RAPIDE:
- Population → SP.POP.TOTL
- PIB ($ courants) → NY.GDP.MKTP.CD
- Croissance PIB (Banque Mondiale) → NY.GDP.MKTP.KD.ZG
- Croissance PIB réel (DGE) → NAT.base_eco.croissance_pib_reel
- Inflation → FP.CPI.TOTL.ZG
- Chômage → SL.UEM.TOTL.ZS
- Espérance de vie → SP.DYN.LE00.IN
- Mortalité infantile → SP.DYN.IMRT.IN
- Internet → IT.NET.USER.ZS
- Électricité → EG.ELC.ACCS.ZS
- Pression fiscale (% PIB, source TOFE) → NAT.tofe.pression_fiscale
- Recettes fiscales (Mds FCFA) → NAT.tofe.recettes_fiscales
- Recettes et dons (TOFE) → NAT.tofe.recettes_et_dons
- Dépenses totales (TOFE) → NAT.tofe.depenses_totales
- Solde budgétaire (% PIB) → NAT.tofe.solde_budgetaire_pct_pib
- Masse salariale → NAT.tofe.remuneration_salaries
- Impôts directs → NAT.tofe.impots_directs
- Dépenses publiques (% PIB, BM) → GC.XPN.TOTL.GD.ZS
- Dette publique (% PIB, DGF) → NAT.financements.dette_pct_pib
- Service de la dette → NAT.financements.service_dette_total
- Balance commerciale (Douanes) → NAT.douanes.solde_commercial
- Exportations FOB → NAT.douanes.exports_fob
- Importations CAF → NAT.douanes.imports_caf
- Taux de couverture → NAT.douanes.taux_couverture
- Production cacao → NAT.base_eco.cacao_production
- Taux de transformation cacao → NAT.base_eco.cacao_taux_transfo
- Part du PIB primaire → NAT.base_eco.pib_primaire_pct
- IDE reçus (Mds FCFA) → NAT.base_eco.ide_total_mds

RÈGLES IMPORTANTES:
1. Choisis l'indicateur le PLUS pertinent parmi la liste.
2. UTILISE LA DESCRIPTION (3ème colonne) pour mieux comprendre ce que mesure chaque indicateur.
3. NE PRÉFÈRE PAS automatiquement les indicateurs NAT. ou Banque Mondiale. Analyse le contexte de la requête:
   - Si l'utilisateur demande une ANNÉE PRÉCISE, choisis l'indicateur qui COUVRE cette année (vérifie [Npts, →YYYY]).
   - Si l'utilisateur demande une PÉRIODE (ex: 2010-2023), choisis celui qui couvre le mieux cette période.
   - Si la question porte SPÉCIFIQUEMENT sur le TOFE, les douanes, la dette DGF, le cacao (transformation), la structure sectorielle du PIB, alors les indicateurs NAT. sont plus adaptés car plus détaillés.
   - Sinon, compare la COMPLÉTUDE (nombre de points) et la RÉCENCE (→année) entre les candidats et choisis le meilleur.
4. Si l'indicateur EXACT demandé existe dans la liste, match_type = "exact".
5. Si l'indicateur exact N'EXISTE PAS mais qu'un indicateur PROCHE existe, match_type = "proxy" et explique le lien.
6. success=false seulement si AUCUN rapport avec des statistiques.
7. À pertinence égale entre plusieurs candidats, PRÉFÈRE l'indicateur qui: (a) couvre les années demandées par l'utilisateur, (b) a la série temporelle la plus longue [Npts], (c) a les données les plus récentes (→YYYY). La couverture des années demandées est PRIORITAIRE sur la longueur de la série.

REQUÊTE: "{enriched_query}"

Réponds UNIQUEMENT en JSON:
{{"success":true,"indicator_code":"CODE_EXACT","match_type":"exact ou proxy","proxy_explanation":"explication du lien si proxy, sinon null","start_year":null,"end_year":null,"calculation_requested":null}}"""
        
        try:
            # Phase 1: Identifier l'indicateur
            response_text = self._call_gemini(phase1_prompt)
            response_text = self._clean_json_response(response_text)
            gemini_response = json.loads(response_text)
            
            indicator_code = gemini_response.get('indicator_code')
            match_type = gemini_response.get('match_type', 'exact')
            proxy_explanation = gemini_response.get('proxy_explanation')
            start_year = gemini_response.get('start_year')
            end_year = gemini_response.get('end_year')
            calculation = gemini_response.get('calculation_requested')
            
            # Fallback si Gemini échoue
            if not gemini_response.get('success', False) or not indicator_code:
                fallback_match = self._try_fallback_search(user_query)
                if fallback_match:
                    indicator_code = fallback_match['code']
                else:
                    return {
                        'success': False,
                        'message': gemini_response.get('message',
                            'Désolé, je n\'ai pas trouvé d\'indicateur correspondant. '
                            'Essayez de préciser le thème (population, économie, santé, éducation...).'),
                        'data': [],
                        'chart_type': 'none'
                    }
            
            # Récupérer les données (national ou Banque Mondiale)
            if indicator_code and indicator_code.startswith('NAT.'):
                indicator_data = data_service.get_indicator_data_for_national(indicator_code)
            else:
                indicator_data = data_service.get_indicator_data_for_query(
                    indicator_code, start_year, end_year
                )
            
            # Fallback si le code ne correspond pas
            if not indicator_data or not indicator_data.get('values'):
                fallback_match = self._try_fallback_search(user_query)
                if fallback_match:
                    fb_code = fallback_match['code']
                    if fb_code.startswith('NAT.'):
                        indicator_data = data_service.get_indicator_data_for_national(fb_code)
                    else:
                        indicator_data = data_service.get_indicator_data_for_query(
                            fb_code, start_year, end_year
                        )
                    if indicator_data and indicator_data.get('values'):
                        indicator_code = fb_code
                
                if not indicator_data or not indicator_data.get('values'):
                    if start_year or end_year:
                        if indicator_code and indicator_code.startswith('NAT.'):
                            indicator_data = data_service.get_indicator_data_for_national(indicator_code)
                        else:
                            indicator_data = data_service.get_indicator_data_for_query(indicator_code)
                    
                    if not indicator_data or not indicator_data.get('values'):
                        return {
                            'success': False,
                            'message': 'Aucune donnée disponible pour cet indicateur. '
                                       'Essayez avec un autre indicateur ou une période différente.',
                            'data': [],
                            'chart_type': 'none'
                        }
            
            values = indicator_data['values']
            
            # Calcul si demandé
            calculation_result = None
            calculation_formula = None
            if calculation and values:
                if calculation in ('moyenne', 'average'):
                    total = sum(v['value'] for v in values)
                    calculation_result = total / len(values)
                    calculation_formula = f"({' + '.join(str(v['value']) for v in values)}) / {len(values)}"
                elif calculation == 'variation' and len(values) >= 2:
                    first_value = values[0]['value']
                    last_value = values[-1]['value']
                    if first_value != 0:
                        calculation_result = ((last_value - first_value) / first_value) * 100
                        calculation_formula = f"(({last_value} - {first_value}) / {first_value}) × 100"
            
            # === PHASE 2: ANALYSE STATISTIQUE DES DONNÉES RÉELLES ===
            # Get French definition for the indicator
            definition_fr = ''
            if indicator_code.startswith('NAT.'):
                definition_fr = indicator_data.get('description', '') or indicator_data.get('methodology', '')
            else:
                cached_def = data_service._desc_cache.get(indicator_code, {})
                definition_fr = cached_def.get('full_fr', '') or indicator_data.get('methodology', '')
            
            analysis_prompt = self._build_data_analysis_prompt(
                indicator_data['name'],
                values,
                indicator_data.get('methodology', ''),
                user_query,
                match_type=match_type,
                proxy_explanation=proxy_explanation,
                definition=definition_fr
            )
            
            try:
                analysis_text = self._call_gemini(analysis_prompt)
                analysis_text = self._clean_json_response(analysis_text)
                analysis_json = json.loads(analysis_text)
                message = analysis_json.get('analysis', '')
                related_indicators = analysis_json.get('related_indicators', [])
            except:
                # Fallback: générer un message basique
                message = self._generate_response_message(
                    indicator_data['name'], values, '',
                    start_year, end_year, calculation_result, calculation_formula
                )
                related_indicators = []
            
            if not related_indicators:
                related_indicators = data_service.get_related_indicators(indicator_code, limit=5)
            
            chart_type = 'line' if len(values) > 1 else 'bar'
            
            return {
                'success': True,
                'message': message,
                'indicator_code': indicator_code,
                'indicator_name': indicator_data['name'],
                'match_type': match_type,
                'proxy_explanation': proxy_explanation,
                'data': values,
                'source': indicator_data.get('source', ''),
                'source_link': indicator_data.get('source_link', ''),
                'definition': definition_fr,
                'methodology': indicator_data.get('methodology', ''),
                'calculation_result': calculation_result,
                'calculation_formula': calculation_formula,
                'chart_type': chart_type,
                'related_indicators': related_indicators
            }
            
        except json.JSONDecodeError as e:
            return self._handle_fallback(user_query, str(e))
        except Exception as e:
            error_str = str(e).lower()
            if '429' in error_str or 'quota' in error_str or 'resourceexhausted' in str(type(e).__name__).lower():
                logger.error(f"Gemini quota exhausted: {e}")
                return {
                    'success': False,
                    'message': '⚠️ Le service d\'intelligence artificielle est temporairement indisponible '
                               '(quota API dépassé). Veuillez réessayer dans quelques minutes. '
                               'En attendant, les données sont toujours consultables via le tableau de bord.',
                    'data': [],
                    'chart_type': 'none',
                    'error': 'quota_exceeded'
                }
            return self._handle_fallback(user_query, str(e))
    
    def _handle_fallback(self, user_query: str, error_msg: str = '') -> Dict:
        """Gestion unifiée du fallback quand Gemini échoue."""
        fallback_match = self._try_fallback_search(user_query)
        if fallback_match:
            try:
                fb_code = fallback_match['code']
                if fb_code.startswith('NAT.'):
                    indicator_data = data_service.get_indicator_data_for_national(fb_code)
                else:
                    indicator_data = data_service.get_indicator_data_for_query(fb_code)
                if indicator_data and indicator_data.get('values'):
                    values = indicator_data['values']
                    # Get French definition
                    fb_def = ''
                    if fb_code.startswith('NAT.'):
                        fb_def = indicator_data.get('description', '')
                    else:
                        fb_cached = data_service._desc_cache.get(fb_code, {})
                        fb_def = fb_cached.get('full_fr', '')
                    return {
                        'success': True,
                        'message': self._generate_response_message(
                            indicator_data['name'], values, '',
                            None, None, None, None
                        ),
                        'indicator_code': fallback_match['code'],
                        'indicator_name': indicator_data['name'],
                        'data': values,
                        'source': indicator_data.get('source', ''),
                        'source_link': indicator_data.get('source_link', ''),
                        'definition': fb_def,
                        'methodology': indicator_data.get('methodology', ''),
                        'calculation_result': None,
                        'calculation_formula': None,
                        'chart_type': 'line' if len(values) > 1 else 'bar',
                        'related_indicators': data_service.get_related_indicators(fallback_match['code'], limit=5)
                    }
            except:
                pass
        return {
            'success': False,
            'message': 'Désolé, je n\'ai pas pu traiter votre question. '
                       'Essayez de reformuler, par exemple: "PIB de la Côte d\'Ivoire" ou "population en 2023".',
            'data': [],
            'chart_type': 'none',
            'error': error_msg
        }
    
    def _generate_response_message(self, indicator_name: str, values: List[Dict], 
                                   unit: str, start_year: Optional[int], 
                                   end_year: Optional[int], calculation_result: Optional[float],
                                   calculation_formula: Optional[str]) -> str:
        """
        Génère un message textuel clair et neutre
        """
        if not values:
            return "Aucune donnée disponible pour cet indicateur."
        
        # Période
        years = [v['year'] for v in values]
        period = f"de {min(years)} à {max(years)}" if len(years) > 1 else f"en {years[0]}"
        
        # Message de base
        message = f"Pour l'indicateur « {indicator_name} » en Côte d'Ivoire {period}, "
        
        if len(values) == 1:
            value = values[0]['value']
            message += f"la valeur est de {value:.2f}"
        else:
            first_value = values[0]['value']
            last_value = values[-1]['value']
            message += f"les valeurs varient de {first_value:.2f} ({values[0]['year']}) à {last_value:.2f} ({values[-1]['year']})"
        
        if unit:
            message += f" {unit}."
        else:
            message += "."
        
        # Ajouter le résultat du calcul si présent
        if calculation_result is not None and calculation_formula:
            message += f" Calcul demandé : {calculation_result:.2f} (formule : {calculation_formula})."
        
        return message


# Instance globale (sera initialisée dans settings.py)
gemini_service = None

# Cache des services par clé API (pour ne pas recréer à chaque requête)
_user_services = {}


def get_service_for_key(api_key: str) -> 'GeminiService':
    """Retourne un GeminiService pour une clé API donnée (avec cache)"""
    if api_key not in _user_services:
        _user_services[api_key] = GeminiService(api_key)
        # Limiter la taille du cache
        if len(_user_services) > 100:
            oldest = list(_user_services.keys())[0]
            del _user_services[oldest]
    return _user_services[api_key]


def init_gemini_service(api_key: str):
    """Initialise le service Gemini avec la clé API"""
    global gemini_service
    gemini_service = GeminiService(api_key)
    return gemini_service
