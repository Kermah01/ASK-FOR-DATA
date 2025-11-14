"""
Service pour l'intégration avec l'API Gemini
"""
import google.generativeai as genai
import json
import os
from typing import Dict, Optional, List
from .data_service import data_service


class GeminiService:
    """Service pour interpréter les requêtes utilisateur via Gemini"""
    
    def __init__(self, api_key: str):
        """
        Initialise le service Gemini
        
        Args:
            api_key: Clé API Gemini
        """
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
    
    def interpret_query(self, user_query: str) -> Dict:
        """
        Interprète une requête utilisateur et retourne une réponse structurée
        
        Args:
            user_query: La question de l'utilisateur en langage naturel
            
        Returns:
            Dict contenant:
            - success: bool
            - message: str (texte de réponse)
            - indicator_code: str (code de l'indicateur identifié)
            - indicator_name: str
            - start_year: int (optionnel)
            - end_year: int (optionnel)
            - data: List[Dict] (données avec année, valeur)
            - unit: str
            - source: str
            - source_link: str
            - calculation: str (si un calcul est demandé)
            - chart_type: str ('line', 'bar', 'none')
        """
        
        # Obtenir le catalogue complet des indicateurs
        indicators_summary = data_service.get_full_dataset_summary()
        
        # Construire le prompt pour Gemini
        prompt = f"""Tu es un assistant expert en analyse de données statistiques de la Côte d'Ivoire.

{indicators_summary}

RÈGLES STRICTES:
1. NE JAMAIS inventer de données ou de valeurs
2. Si tu ne peux pas trouver l'information demandée, réponds UNIQUEMENT: {{"success": false, "message": "Je ne sais pas."}}
3. Identifie l'indicateur le plus pertinent basé sur son CODE et son NOM
4. Extrais les années demandées (si spécifié)
5. Si un calcul est demandé (moyenne, variation, etc.), note-le mais ne calcule rien
6. Réponds UNIQUEMENT en JSON valide

REQUÊTE UTILISATEUR: "{user_query}"

Réponds en JSON avec cette structure exacte:
{{
    "success": true/false,
    "indicator_code": "CODE_EXACT" ou null,
    "start_year": année_debut ou null,
    "end_year": année_fin ou null,
    "calculation_requested": "moyenne" / "variation" / "somme" / null,
    "message": "Explication courte si pas trouvé"
}}

Exemples:
- "Taux d'inflation 2018-2023" → {{"success": true, "indicator_code": "FP.CPI.TOTL.ZG", "start_year": 2018, "end_year": 2023}}
- "Accès électricité" → {{"success": true, "indicator_code": "EG.ELC.ACCS.ZS", "start_year": null, "end_year": null}}
- "Population de chats" → {{"success": false, "message": "Je ne sais pas. Aucun indicateur ne correspond à cette recherche."}}
"""
        
        try:
            # Appeler Gemini
            response = self.model.generate_content(prompt)
            response_text = response.text.strip()
            
            # Nettoyer la réponse (enlever les marqueurs markdown si présents)
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            if response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            # Parser la réponse JSON
            gemini_response = json.loads(response_text)
            
            # Vérifier si l'indicateur a été trouvé
            if not gemini_response.get('success', False):
                return {
                    'success': False,
                    'message': gemini_response.get('message', 'Je ne sais pas.'),
                    'data': [],
                    'chart_type': 'none'
                }
            
            indicator_code = gemini_response.get('indicator_code')
            start_year = gemini_response.get('start_year')
            end_year = gemini_response.get('end_year')
            calculation = gemini_response.get('calculation_requested')
            
            if not indicator_code:
                return {
                    'success': False,
                    'message': 'Je ne sais pas. Aucun indicateur correspondant trouvé.',
                    'data': [],
                    'chart_type': 'none'
                }
            
            # Récupérer les données de l'indicateur
            indicator_data = data_service.get_indicator_data_for_query(
                indicator_code, 
                start_year, 
                end_year
            )
            
            if not indicator_data or not indicator_data.get('values'):
                return {
                    'success': False,
                    'message': 'Je ne sais pas. Aucune donnée disponible pour cet indicateur sur la période demandée.',
                    'data': [],
                    'chart_type': 'none'
                }
            
            # Préparer les données pour la réponse
            values = indicator_data['values']
            
            # Effectuer le calcul si demandé et possible
            calculation_result = None
            calculation_formula = None
            
            if calculation and values:
                if calculation == 'moyenne' or calculation == 'average':
                    total = sum(v['value'] for v in values)
                    calculation_result = total / len(values)
                    calculation_formula = f"({' + '.join(str(v['value']) for v in values)}) / {len(values)}"
                
                elif calculation == 'variation' and len(values) >= 2:
                    first_value = values[0]['value']
                    last_value = values[-1]['value']
                    calculation_result = ((last_value - first_value) / first_value) * 100
                    calculation_formula = f"(({last_value} - {first_value}) / {first_value}) × 100"
            
            # Générer un message textuel clair
            message = self._generate_response_message(
                indicator_data['name'],
                values,
                indicator_data['unit'],
                start_year,
                end_year,
                calculation_result,
                calculation_formula
            )
            
            # Déterminer le type de graphique
            chart_type = 'line' if len(values) > 1 else 'bar'
            
            return {
                'success': True,
                'message': message,
                'indicator_code': indicator_code,
                'indicator_name': indicator_data['name'],
                'data': values,
                'unit': indicator_data['unit'],
                'source': indicator_data['source'],
                'source_link': indicator_data['source_link'],
                'calculation_result': calculation_result,
                'calculation_formula': calculation_formula,
                'chart_type': chart_type
            }
            
        except json.JSONDecodeError as e:
            return {
                'success': False,
                'message': f'Je ne sais pas. Erreur d\'interprétation de la requête.',
                'data': [],
                'chart_type': 'none',
                'error': str(e)
            }
        except Exception as e:
            return {
                'success': False,
                'message': 'Je ne sais pas. Une erreur s\'est produite lors du traitement de votre requête.',
                'data': [],
                'chart_type': 'none',
                'error': str(e)
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


def init_gemini_service(api_key: str):
    """Initialise le service Gemini avec la clé API"""
    global gemini_service
    gemini_service = GeminiService(api_key)
    return gemini_service
