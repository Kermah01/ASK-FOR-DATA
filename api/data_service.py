"""
Service pour charger et gérer les données Excel
"""
import pandas as pd
import os
from typing import Dict, List, Optional, Tuple
from functools import lru_cache


class DataService:
    """Service singleton pour gérer les données de la Côte d'Ivoire"""
    
    _instance = None
    _data_df = None
    _excel_path = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DataService, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._data_df is None:
            self._load_data()
    
    def _load_data(self):
        """Charge les données Excel en mémoire"""
        # Chemin par défaut
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self._excel_path = os.path.join(base_dir, 'data.xlsx')
        
        print(f"Chargement des données depuis: {self._excel_path}")
        self._data_df = pd.read_excel(self._excel_path, sheet_name='Data')
        print(f"✓ Données chargées: {len(self._data_df)} indicateurs")
    
    def get_all_indicators(self) -> List[Dict]:
        """Retourne la liste de tous les indicateurs avec leurs métadonnées"""
        indicators = []
        
        for _, row in self._data_df.iterrows():
            series_code = row['Series Code']
            indicator_name = row['Indicateur']
            
            # Skip invalid rows
            if pd.isna(series_code) or pd.isna(indicator_name):
                continue

            series_code = str(series_code)
            indicator_name = str(indicator_name)
            
            source_link = row.get('Liens', '')
            methodology = row.get('Méthodologie', '')
            
            indicators.append({
                'code': series_code,
                'name': indicator_name,
                'source_link': str(source_link) if pd.notna(source_link) else '',
                'methodology': str(methodology) if pd.notna(methodology) else '',
            })
        
        return indicators
    
    def get_indicator_detail(self, code: str) -> Optional[Dict]:
        """Retourne les détails complets d'un indicateur avec toutes ses valeurs"""
        # Chercher l'indicateur dans les données
        indicator_data = self._data_df[self._data_df['Series Code'] == code]
        
        if indicator_data.empty:
            return None
        
        indicator_row = indicator_data.iloc[0]
        
        # Extraire les valeurs par année
        year_columns = [col for col in self._data_df.columns if isinstance(col, int)]
        year_columns.sort()  # Ensure chronological order
        values = []
        
        for year in year_columns:
            value = indicator_row[year]
            if pd.notna(value):
                values.append({
                    'year': int(year),
                    'value': float(value)
                })
        
        # Extraire les métadonnées directement depuis la feuille Data
        source_link = indicator_row.get('Liens', '')
        methodology = indicator_row.get('Méthodologie', '')
        
        return {
            'code': str(code),
            'name': str(indicator_row['Indicateur']),
            'source_link': str(source_link) if pd.notna(source_link) else '',
            'methodology': str(methodology) if pd.notna(methodology) else '',
            'values': values
        }
    
    def search_indicators(self, query: str) -> List[Dict]:
        """Recherche intelligente des indicateurs avec scoring de pertinence"""
        query_lower = query.lower().strip()
        query_words = [w for w in query_lower.split() if len(w) > 1]
        
        # Générer des variantes de recherche (stemming basique français)
        query_stems = set()
        for word in query_words:
            query_stems.add(word)
            # Stemming basique: enlever les terminaisons françaises courantes
            if len(word) > 4:
                for suffix in ['tion', 'ment', 'ance', 'ence', 'ique', 'aire', 'eur', 'euse', 'eux', 'aux', 'als', 'ons', 'ent', 'ant', 'ais', 'ait', 'ées', 'és', 'er', 'ir', 'es', 'le', 'ne']:
                    if word.endswith(suffix) and len(word) - len(suffix) >= 3:
                        query_stems.add(word[:-len(suffix)])
                        break
        
        matching_indicators = []
        
        for _, row in self._data_df.iterrows():
            # Skip invalid rows
            if pd.isna(row['Indicateur']) or pd.isna(row['Series Code']):
                continue

            indicator_name = str(row['Indicateur'])
            indicator_name_lower = indicator_name.lower()
            series_code = str(row['Series Code'])
            series_code_lower = series_code.lower()
            
            score = 0
            
            # Exact match (highest priority)
            if query_lower == indicator_name_lower:
                score = 1000
            elif query_lower == series_code_lower:
                score = 900
            # Starts with query (high priority)
            elif indicator_name_lower.startswith(query_lower):
                score = 500
            elif series_code_lower.startswith(query_lower):
                score = 450
            # Contains full query (medium-high priority)
            elif query_lower in indicator_name_lower:
                score = 300
            elif query_lower in series_code_lower:
                score = 250
            else:
                # Word match - check each query word
                word_matches = 0
                for word in query_words:
                    if word in indicator_name_lower:
                        word_matches += 2  # Exact word match
                    elif word in series_code_lower:
                        word_matches += 1.5
                
                # Stem match - partial/root matching
                stem_matches = 0
                if word_matches == 0:
                    indicator_words = indicator_name_lower.split()
                    for stem in query_stems:
                        if len(stem) >= 3:
                            for iw in indicator_words:
                                if stem in iw or iw.startswith(stem):
                                    stem_matches += 1
                                    break
                
                if word_matches > 0:
                    score = 50 * word_matches
                    # Bonus if multiple words match (phrase relevance)
                    if word_matches >= len(query_words) and len(query_words) > 1:
                        score += 100
                elif stem_matches > 0:
                    score = 30 * stem_matches
            
            # Only add if there's a match
            if score > 0:
                matching_indicators.append({
                    'code': series_code,
                    'name': indicator_name,
                    'score': score
                })
        
        # Sort by score (descending) and return without score field
        matching_indicators.sort(key=lambda x: x['score'], reverse=True)
        
        # Remove score from final results
        return [{'code': ind['code'], 'name': ind['name']} for ind in matching_indicators]
    
    def get_related_indicators(self, code: str, limit: int = 5) -> List[str]:
        """
        Trouve des indicateurs connexes/similaires basés sur:
        - Même catégorie (préfixe du code similaire)
        - Mots-clés communs
        - Thématiques similaires
        """
        # Obtenir l'indicateur source
        source_indicator = self._data_df[self._data_df['Series Code'] == code]
        if source_indicator.empty:
            return []
        
        source_name = str(source_indicator.iloc[0]['Indicateur']).lower()
        source_code = str(code)
        
        # Extraire le préfixe du code (généralement la catégorie)
        code_prefix = source_code.split('.')[0] if '.' in source_code else source_code[:2]
        
        # Définir des groupes thématiques
        thematic_keywords = {
            'économie': ['pib', 'gdp', 'croissance', 'économique', 'inflation', 'commerce', 'export', 'import'],
            'santé': ['santé', 'health', 'mortalité', 'mortality', 'espérance', 'life expectancy', 'médical', 'hôpital'],
            'éducation': ['éducation', 'education', 'école', 'school', 'alphabét', 'literacy', 'étudiant', 'enrollment'],
            'énergie': ['énergie', 'energy', 'électricité', 'electric', 'renouvelable', 'renewable', 'combustible'],
            'démographie': ['population', 'démographie', 'naissance', 'birth', 'urbain', 'urban', 'rural', 'densité'],
            'emploi': ['emploi', 'employment', 'chômage', 'unemployment', 'travail', 'labor', 'salaire', 'wage'],
            'infrastructure': ['infrastructure', 'route', 'road', 'transport', 'eau', 'water', 'assainissement', 'sanitation']
        }
        
        # Identifier la thématique de l'indicateur source
        source_theme = None
        for theme, keywords in thematic_keywords.items():
            if any(keyword in source_name for keyword in keywords):
                source_theme = theme
                break
        
        related = []
        
        for _, row in self._data_df.iterrows():
            indicator_code = str(row['Series Code'])
            indicator_name = str(row['Indicateur']).lower()
            
            # Ne pas inclure l'indicateur source
            if indicator_code == code:
                continue
            
            score = 0
            
            # Même préfixe de code (forte corrélation)
            if indicator_code.startswith(code_prefix):
                score += 100
            
            # Mots communs dans le nom
            source_words = set(source_name.split())
            indicator_words = set(indicator_name.split())
            common_words = source_words.intersection(indicator_words)
            # Filtrer les mots trop courts ou courants
            meaningful_common = [w for w in common_words if len(w) > 3 and w not in ['dans', 'pour', 'avec', 'sans', 'plus']]
            score += len(meaningful_common) * 50
            
            # Même thématique
            if source_theme:
                theme_keywords = thematic_keywords[source_theme]
                if any(keyword in indicator_name for keyword in theme_keywords):
                    score += 30
            
            if score > 0:
                related.append({
                    'code': indicator_code,
                    'name': row['Indicateur'],
                    'score': score
                })
        
        # Trier par score et limiter
        related.sort(key=lambda x: x['score'], reverse=True)
        
        # Retourner uniquement les noms
        return [ind['name'] for ind in related[:limit]]
    
    
    def get_indicator_data_for_query(self, code: str, start_year: Optional[int] = None, 
                                     end_year: Optional[int] = None) -> Dict:
        """
        Récupère les données d'un indicateur pour une période donnée
        """
        indicator = self.get_indicator_detail(code)
        
        if not indicator:
            return None
        
        values = indicator['values']
        
        # Filtrer par période si spécifié
        if start_year or end_year:
            filtered_values = []
            for v in values:
                year = v['year']
                if start_year and year < start_year:
                    continue
                if end_year and year > end_year:
                    continue
                filtered_values.append(v)
            values = filtered_values
        
        return {
            'code': code,
            'name': indicator['name'],
            'source_link': indicator['source_link'],
            'methodology': indicator['methodology'],
            'values': values
        }
    
    def get_full_dataset_summary(self) -> str:
        """
        Génère un résumé complet des données pour Gemini
        Inclut tous les indicateurs avec leurs codes
        """
        summary = "# BASE DE DONNÉES COMPLÈTE - INDICATEURS CÔTE D'IVOIRE\n\n"
        summary += f"Total: {len(self._data_df)} indicateurs disponibles\n"
        summary += "Période: 2000-2024 (certaines valeurs peuvent être manquantes)\n\n"
        summary += "## LISTE COMPLÈTE DES INDICATEURS:\n\n"
        
        for idx, row in self._data_df.iterrows():
            series_code = row['Series Code']
            indicator_name = row['Indicateur']
            
            # Skip invalid rows
            if pd.isna(series_code) or pd.isna(indicator_name):
                continue
            
            summary += f"{idx+1}. Code: {series_code} | Nom: {indicator_name}\n"
        
        return summary
    
    def get_compact_indicator_list(self, search_terms: Optional[List[str]] = None, max_results: int = 80) -> str:
        """
        Génère une liste compacte code|nom|description pré-filtrée pour le prompt Gemini Phase 1.
        Inclut un extrait de méthodologie pour aider l'IA à comprendre ce que mesure chaque indicateur.
        Si search_terms fourni, ne retourne que les indicateurs pertinents (~2-3K tokens).
        Sinon, retourne les indicateurs les plus courants.
        """
        # Indicateurs essentiels toujours inclus
        essential_codes = {
            'SP.POP.TOTL', 'SP.POP.GROW', 'SP.DYN.LE00.IN', 'SP.DYN.CBRT.IN',
            'SP.DYN.CDRT.IN', 'SP.DYN.TFRT.IN', 'SP.DYN.IMRT.IN', 'SP.URB.TOTL.IN.ZS',
            'NY.GDP.MKTP.CD', 'NY.GDP.MKTP.KD.ZG', 'NY.GDP.PCAP.CD', 'NY.GDP.PCAP.KD.ZG',
            'NY.GNP.MKTP.CD', 'NY.GNP.PCAP.CD',
            'FP.CPI.TOTL.ZG', 'GC.DOD.TOTL.GD.ZS',
            'SL.UEM.TOTL.ZS', 'SL.UEM.TOTL.NE.ZS', 'SL.TLF.TOTL.IN',
            'SE.PRM.ENRR', 'SE.SEC.ENRR', 'SE.TER.ENRR', 'SE.ADT.LITR.ZS',
            'SH.XPD.CHEX.GD.ZS', 'SH.MED.PHYS.ZS',
            'IT.NET.USER.ZS', 'IT.CEL.SETS.P2',
            'EG.ELC.ACCS.ZS', 'EG.USE.ELEC.KH.PC',
            'AG.LND.ARBL.ZS', 'AG.LND.FRST.ZS',
            'EN.ATM.CO2E.PC', 'EN.ATM.CO2E.KT',
            'BX.KLT.DINV.WD.GD.ZS', 'NE.EXP.GNFS.ZS', 'NE.IMP.GNFS.ZS',
            'SI.POV.NAHC', 'SI.POV.GINI',
            'GC.TAX.TOTL.GD.ZS', 'GC.TAX.TOTL.CN', 'GC.REV.XGRT.GD.ZS',
            'GC.XPN.TOTL.GD.ZS', 'GC.NLD.TOTL.GD.ZS',
            'NE.CON.TOTL.ZS', 'NE.GDI.TOTL.ZS', 'NY.GDS.TOTL.ZS',
            'MS.MIL.XPND.GD.ZS',
        }
        
        def _short_description(row):
            """Extrait une description courte de la méthodologie pour aider le matching."""
            meth = row.get('Méthodologie', '')
            if pd.isna(meth) or not meth:
                return ''
            meth = str(meth).strip()
            # Prendre la première phrase ou les 120 premiers caractères
            first_sentence = meth.split('.')[0].strip()
            if len(first_sentence) > 120:
                first_sentence = first_sentence[:120].rsplit(' ', 1)[0]
            return first_sentence
        
        lines = []
        seen_codes = set()
        
        # 1. Always add essential indicators (with description)
        for _, row in self._data_df.iterrows():
            code = row['Series Code']
            name = row['Indicateur']
            if pd.isna(code) or pd.isna(name):
                continue
            if str(code) in essential_codes:
                desc = _short_description(row)
                entry = f"{code}|{name}"
                if desc:
                    entry += f"|{desc}"
                lines.append(entry)
                seen_codes.add(str(code))
        
        # 2. Add search-matching indicators (search name AND methodology)
        if search_terms:
            scored = []
            for _, row in self._data_df.iterrows():
                code = str(row['Series Code']) if pd.notna(row['Series Code']) else ''
                name = str(row['Indicateur']) if pd.notna(row['Indicateur']) else ''
                if not code or code in seen_codes:
                    continue
                name_lower = name.lower()
                meth_lower = str(row.get('Méthodologie', '')).lower() if pd.notna(row.get('Méthodologie', '')) else ''
                # Score: match in name (weight 2) + match in methodology (weight 1)
                score = sum(2 for t in search_terms if t.lower() in name_lower or t.lower() in code.lower())
                score += sum(1 for t in search_terms if t.lower() in meth_lower)
                if score > 0:
                    scored.append((score, code, name, row))
            scored.sort(key=lambda x: x[0], reverse=True)
            for _, code, name, row in scored[:max_results - len(lines)]:
                desc = _short_description(row)
                entry = f"{code}|{name}"
                if desc:
                    entry += f"|{desc}"
                lines.append(entry)
                seen_codes.add(code)
        
        return "\n".join(lines)


# Instance globale singleton
data_service = DataService()
