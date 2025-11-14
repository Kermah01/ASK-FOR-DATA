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
    _metadata_df = None
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
        
        # Charger les deux feuilles
        print(f"Chargement des données depuis: {self._excel_path}")
        self._data_df = pd.read_excel(self._excel_path, sheet_name='Data')
        self._metadata_df = pd.read_excel(self._excel_path, sheet_name='Series - Metadata')
        print(f"✓ Données chargées: {len(self._data_df)} indicateurs")
    
    def get_all_indicators(self) -> List[Dict]:
        """Retourne la liste de tous les indicateurs avec leurs métadonnées"""
        indicators = []
        
        for _, row in self._data_df.iterrows():
            series_code = row['Series Code']
            indicator_name = row['Indicateur']
            
            # Chercher les métadonnées correspondantes
            metadata = self._metadata_df[self._metadata_df['Code'] == series_code]
            
            if not metadata.empty:
                metadata_row = metadata.iloc[0]
                unit = metadata_row.get('Unit of measure', '')
                source = metadata_row.get('Source', '')
                definition = metadata_row.get("Définition de l'indicateur", '')
            else:
                unit = ''
                source = ''
                definition = ''
            
            indicators.append({
                'code': series_code,
                'name': indicator_name,
                'unit': unit if pd.notna(unit) else '',
                'source': source if pd.notna(source) else '',
                'definition': definition if pd.notna(definition) else ''
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
        values = []
        
        for year in year_columns:
            value = indicator_row[year]
            if pd.notna(value):
                values.append({
                    'year': int(year),
                    'value': float(value)
                })
        
        # Chercher les métadonnées
        metadata = self._metadata_df[self._metadata_df['Code'] == code]
        
        if not metadata.empty:
            metadata_row = metadata.iloc[0]
            unit = metadata_row.get('Unit of measure', '')
            source = metadata_row.get('Source', '')
            definition = metadata_row.get("Définition de l'indicateur", '')
            source_link = metadata_row.get('Related source links', '')
        else:
            unit = ''
            source = ''
            definition = ''
            source_link = ''
        
        # Générer le lien si source = Banque mondiale
        if pd.notna(source) and 'World Bank' in str(source) or 'Banque mondiale' in str(source):
            if pd.isna(source_link) or not source_link:
                source_link = f"https://data.worldbank.org/indicator/{code}"
        
        return {
            'code': code,
            'name': indicator_row['Indicateur'],
            'unit': unit if pd.notna(unit) else '',
            'source': source if pd.notna(source) else '',
            'source_link': source_link if pd.notna(source_link) else '',
            'definition': definition if pd.notna(definition) else '',
            'values': values
        }
    
    def search_indicators(self, query: str) -> List[Dict]:
        """Recherche des indicateurs par nom ou code"""
        query_lower = query.lower()
        
        matching_indicators = []
        
        for _, row in self._data_df.iterrows():
            indicator_name = str(row['Indicateur']).lower()
            series_code = str(row['Series Code']).lower()
            
            if query_lower in indicator_name or query_lower in series_code:
                matching_indicators.append({
                    'code': row['Series Code'],
                    'name': row['Indicateur']
                })
        
        return matching_indicators
    
    def get_data_context_for_gemini(self, max_indicators: int = 50) -> str:
        """
        Prépare un contexte textuel des données pour Gemini
        """
        context = "# DONNÉES DISPONIBLES - CÔTE D'IVOIRE\n\n"
        context += "## Structure des données\n"
        context += "- Pays: Côte d'Ivoire\n"
        context += f"- Nombre total d'indicateurs: {len(self._data_df)}\n"
        context += "- Années disponibles: 2000 à 2024\n\n"
        
        context += "## Liste des indicateurs (échantillon):\n\n"
        
        # Prendre un échantillon d'indicateurs pour ne pas surcharger
        sample = self._data_df.head(max_indicators)
        
        for idx, row in sample.iterrows():
            series_code = row['Series Code']
            indicator_name = row['Indicateur']
            
            # Trouver les métadonnées
            metadata = self._metadata_df[self._metadata_df['Code'] == series_code]
            
            unit = ''
            if not metadata.empty:
                unit = metadata.iloc[0].get('Unit of measure', '')
                if pd.notna(unit):
                    unit = f" ({unit})"
            
            context += f"- **{series_code}**: {indicator_name}{unit}\n"
        
        context += f"\n... et {len(self._data_df) - max_indicators} autres indicateurs.\n"
        
        return context
    
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
            'unit': indicator['unit'],
            'source': indicator['source'],
            'source_link': indicator['source_link'],
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
            
            # Trouver les métadonnées
            metadata = self._metadata_df[self._metadata_df['Code'] == series_code]
            
            unit = ''
            if not metadata.empty:
                unit_val = metadata.iloc[0].get('Unit of measure', '')
                if pd.notna(unit_val) and unit_val:
                    unit = f" | Unité: {unit_val}"
            
            summary += f"{idx+1}. Code: {series_code} | Nom: {indicator_name}{unit}\n"
        
        return summary


# Instance globale singleton
data_service = DataService()
