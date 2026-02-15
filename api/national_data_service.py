"""
Service de chargement des données nationales (TOFE, Douanes, Financements, Base Éco).
Ces fichiers ont une structure différente de data.xlsx (Banque Mondiale).
Singleton pattern identique à data_service.py.
"""
import os
import logging
import pandas as pd
from pathlib import Path

logger = logging.getLogger('api')

BASE_DIR = Path(__file__).resolve().parent.parent


def _safe_float(val):
    """Convertit une valeur en float, retourne None si impossible ou NaN/Inf."""
    if val is None or val == '' or val == '-' or val == '…':
        return None
    try:
        import math
        s = str(val).replace('\xa0', '').replace('\u202f', '').replace(' ', '').replace(',', '.')
        f = float(s)
        if math.isnan(f) or math.isinf(f):
            return None
        return round(f, 4)
    except (ValueError, TypeError):
        return None


def _read_table(filepath, sheet_name, header_row=1, data_start_row=2, max_row=None):
    """
    Lit un tableau avec structure standard :
    - header_row (0-indexed) : ligne des en-têtes (Années, 2019, 2020, ...)
    - data_start_row (0-indexed) : première ligne de données
    - Retourne un dict {label: {years: [...], values: [...]}}
    """
    try:
        df = pd.read_excel(filepath, sheet_name=sheet_name, header=None)
    except Exception as e:
        logger.warning(f"Impossible de lire {filepath} / {sheet_name}: {e}")
        return {}

    if max_row and max_row < len(df):
        df = df.iloc[:max_row]

    # Extraire les années depuis la ligne d'en-tête
    header = df.iloc[header_row]
    years = []
    year_cols = []
    for col_idx, val in enumerate(header):
        if col_idx == 0:
            continue  # Skip label column
        y = _safe_float(val)
        if y and 2000 <= y <= 2030:
            years.append(int(y))
            year_cols.append(col_idx)

    if not years:
        return {}

    result = {}
    for row_idx in range(data_start_row, len(df)):
        row = df.iloc[row_idx]
        label = row.iloc[0]
        if pd.isna(label) or str(label).strip() == '':
            continue
        label = str(label).strip()

        values = []
        row_years = []
        for yi, col_idx in enumerate(year_cols):
            v = _safe_float(row.iloc[col_idx]) if col_idx < len(row) else None
            if v is not None:
                row_years.append(years[yi])
                values.append(v)

        if values:
            # Détecter le niveau hiérarchique via l'indentation
            raw_label = str(df.iloc[row_idx, 0])
            indent = len(raw_label) - len(raw_label.lstrip())
            result[label] = {
                'years': row_years,
                'values': values,
                'level': indent,  # 0 = total, >0 = sous-catégorie
            }

    return result


class NationalDataService:
    """Charge et expose les données des 4 fichiers nationaux."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._loaded = False
        return cls._instance

    def __init__(self):
        if not self._loaded:
            self._load_all()
            self._loaded = True

    def _load_all(self):
        """Charge les 4 fichiers."""
        self.tofe = {}
        self.douanes = {}
        self.base_eco = {}
        self.financements = {}

        self._load_tofe()
        self._load_douanes()
        self._load_base_eco()
        self._load_financements()

        logger.info(f"✓ Données nationales chargées: TOFE={len(self.tofe)} séries, "
                     f"Douanes={len(self.douanes)} séries, "
                     f"Base éco={len(self.base_eco)} séries, "
                     f"Financements={len(self.financements)} séries")

    # ──────────────────────────────────────────────
    # TOFE
    # ──────────────────────────────────────────────
    def _load_tofe(self):
        filepath = BASE_DIR / 'TOFE.xlsx'
        if not filepath.exists():
            logger.warning(f"TOFE.xlsx introuvable: {filepath}")
            return

        try:
            df = pd.read_excel(filepath, sheet_name='Haut du TOFE', header=None)
        except Exception as e:
            logger.warning(f"Erreur lecture TOFE: {e}")
            return

        # Ligne 0 = en-têtes (Catégorie, 2018, 2019, ..., 2023)
        header = df.iloc[0]
        years = []
        year_cols = []
        for ci, val in enumerate(header):
            y = _safe_float(val)
            if y and 2000 <= y <= 2030:
                years.append(int(y))
                year_cols.append(ci)

        # Mapping des lignes clés du TOFE
        tofe_keys = {
            'RECETTES ET DONS': 'recettes_et_dons',
            'RECETTES': 'recettes_totales',
            'Recettes fiscales': 'recettes_fiscales',
            'Impôts directs': 'impots_directs',
            'Impôts sur les biens et services': 'impots_biens_services',
            "Droits et taxes à l'importation": 'droits_importation',
            "Taxes à l'exportation": 'taxes_exportation',
            'Recettes non fiscales': 'recettes_non_fiscales',
            'Cotisations sociales': 'cotisations_sociales',
            'DONS': 'dons',
            'DEPENSES TOTALES ET PRETS NET': 'depenses_totales',
            'Rémunération des salariés': 'remuneration_salaries',
            'Prestations sociales': 'prestations_sociales',
            'Subventions et transferts': 'subventions_transferts',
            'Dépenses de fonctionnement': 'depenses_fonctionnement',
            'Intérêts': 'interets_dette',
            'Dette intérieure': 'interets_dette_interieure',
            'Dette extérieure': 'interets_dette_exterieure',
            "Dépenses d'investissement": 'depenses_investissement',
            'Financées sur ressources intérieures': 'invest_ressources_int',
            'Financées sur ressources extérieures': 'invest_ressources_ext',
            'SOLDE BUDGETAIRE GLOBAL': 'solde_budgetaire',
            'FINANCEMENT NET': 'financement_net',
            'Financement intérieur': 'financement_interieur',
            'Financement extérieur': 'financement_exterieur',
            'APPUIS BUDGETAIRES ATTENDUS/RECUS': 'appuis_budgetaires',
            'Dépenses pro-pauvres': 'depenses_pro_pauvres',
        }

        for row_idx in range(1, len(df)):
            label = df.iloc[row_idx, 0]
            if pd.isna(label):
                continue
            label_clean = str(label).strip()

            # Check exact match first, then startswith for partial matches
            key = None
            if label_clean in tofe_keys:
                key = tofe_keys[label_clean]
            else:
                for k, v in tofe_keys.items():
                    if label_clean.startswith(k):
                        key = v
                        break

            if key:
                row_years = []
                values = []
                for yi, ci in enumerate(year_cols):
                    val = _safe_float(df.iloc[row_idx, ci])
                    if val is not None:
                        row_years.append(years[yi])
                        values.append(val)
                if values:
                    self.tofe[key] = {'years': row_years, 'values': values, 'name': label_clean}

        # Calcul pression fiscale si données dispo
        if 'recettes_fiscales' in self.tofe:
            self.tofe['_years'] = years

    # ──────────────────────────────────────────────
    # DOUANES
    # ──────────────────────────────────────────────
    def _load_douanes(self):
        filepath = BASE_DIR / 'douanes.xlsx'
        if not filepath.exists():
            logger.warning(f"douanes.xlsx introuvable: {filepath}")
            return

        # Agrégats du commerce extérieur
        try:
            data = _read_table(filepath, 'Agrégats du commerce extérieur', header_row=1, data_start_row=2)
            for label, series in data.items():
                lbl = label.lower()
                if 'importation' in lbl:
                    self.douanes['imports_caf'] = {**series, 'name': label}
                elif 'exportation' in lbl:
                    self.douanes['exports_fob'] = {**series, 'name': label}
                elif 'taux de couverture' in lbl:
                    self.douanes['taux_couverture'] = {**series, 'name': label}
                elif 'solde' in lbl:
                    self.douanes['solde_commercial'] = {**series, 'name': label}
        except Exception as e:
            logger.warning(f"Erreur lecture Agrégats commerce: {e}")

        # Recettes douanières par taxe
        try:
            data = _read_table(filepath, 'recettes douanières1', header_row=1, data_start_row=2)
            for label, series in data.items():
                lbl = label.lower()
                if 'total base brute' in lbl:
                    self.douanes['recettes_brutes'] = {**series, 'name': label}
                elif 'total base tofe' in lbl:
                    self.douanes['recettes_tofe'] = {**series, 'name': label}
                elif 'tva' in lbl or 'taxe sur la valeur' in lbl:
                    self.douanes['recettes_tva'] = {**series, 'name': label}
                elif 'droits de douane' in lbl:
                    self.douanes['recettes_dd'] = {**series, 'name': label}
                elif 'droit unique de sortie' in lbl or 'dus' in lbl:
                    self.douanes['recettes_dus'] = {**series, 'name': label}
        except Exception as e:
            logger.warning(f"Erreur lecture recettes douanières: {e}")

        # Exportations par zone géo
        try:
            data = _read_table(filepath, 'exportations par zone géo', header_row=1, data_start_row=2)
            for label, series in data.items():
                lbl = label.lower()
                if lbl == 'europe':
                    self.douanes['export_europe'] = {**series, 'name': label}
                elif lbl.startswith('afrique'):
                    self.douanes['export_afrique'] = {**series, 'name': label}
                elif lbl.startswith('asie'):
                    self.douanes['export_asie'] = {**series, 'name': label}
                elif lbl.startswith('am'):
                    self.douanes['export_amerique'] = {**series, 'name': label}
                elif 'total' in lbl:
                    self.douanes['export_total'] = {**series, 'name': label}
        except Exception as e:
            logger.warning(f"Erreur lecture exports zone: {e}")

        # Exportations par catégorie de marchandise
        try:
            data = _read_table(filepath, 'Exportations des marchandises ', header_row=1, data_start_row=2)
            for label, series in data.items():
                lbl = label.lower()
                if 'agriculture industrielle' in lbl:
                    self.douanes['export_agri_industrielle'] = {**series, 'name': label}
                elif 'première transformation' in lbl:
                    self.douanes['export_premiere_transfo'] = {**series, 'name': label}
                elif 'manufacturé' in lbl:
                    self.douanes['export_manufactures'] = {**series, 'name': label}
                elif 'minier' in lbl:
                    self.douanes['export_miniers'] = {**series, 'name': label}
                elif 'total' in lbl:
                    self.douanes['export_marchandises_total'] = {**series, 'name': label}
        except Exception as e:
            logger.warning(f"Erreur lecture exports marchandises: {e}")

        # Top produits exportés (top 10)
        try:
            data = _read_table(filepath, 'Produits exportés', header_row=1, data_start_row=2)
            top_exports = []
            for label, series in data.items():
                if series.get('level', 0) > 0 and series['values']:
                    last_val = series['values'][-1]
                    top_exports.append((label, last_val, series))
            top_exports.sort(key=lambda x: x[1], reverse=True)
            for i, (label, _, series) in enumerate(top_exports[:10]):
                self.douanes[f'top_export_{i}'] = {**series, 'name': label}
        except Exception as e:
            logger.warning(f"Erreur lecture produits exportés: {e}")

        # Top produits importés (top 10)
        try:
            data = _read_table(filepath, 'Produits importés', header_row=1, data_start_row=2)
            top_imports = []
            for label, series in data.items():
                if series.get('level', 0) == 0 and series['values'] and 'total' not in label.lower():
                    last_val = series['values'][-1]
                    top_imports.append((label, last_val, series))
            top_imports.sort(key=lambda x: x[1], reverse=True)
            for i, (label, _, series) in enumerate(top_imports[:10]):
                self.douanes[f'top_import_{i}'] = {**series, 'name': label}
        except Exception as e:
            logger.warning(f"Erreur lecture produits importés: {e}")

    # ──────────────────────────────────────────────
    # BASE ÉCO
    # ──────────────────────────────────────────────
    def _load_base_eco(self):
        filepath = BASE_DIR / 'Données de la base éco.xlsx'
        if not filepath.exists():
            logger.warning(f"Données de la base éco.xlsx introuvable: {filepath}")
            return

        # --- Structure de l'Économie ---
        try:
            df = pd.read_excel(filepath, sheet_name=0, header=None)

            # Bloc 1: Structure PIB par secteur
            # Row 0=titre, 1=vide, 2=sous-titre, 3=header (Années, 2011, ...), 4+=data
            header_row = df.iloc[3]
            years1 = []
            ycols1 = []
            for ci, val in enumerate(header_row):
                y = _safe_float(val)
                if y and 2000 <= y <= 2030:
                    years1.append(int(y))
                    ycols1.append(ci)

            pib_structure_keys = {
                'Secteur Primaire': 'pib_primaire_pct',
                'Secteur Secondaire': 'pib_secondaire_pct',
                'Secteur Tertiaire': 'pib_tertiaire_pct',
                'Industries extractives': 'pib_extractives_pct',
                'Industries pétrolières': 'pib_petrole_pct',
                'Energie (gazeaulec)': 'pib_energie_pct',
                'BTP': 'pib_btp_pct',
                'Industries manufacturières': 'pib_manufacturier_pct',
                'Transports': 'pib_transports_pct',
                'Télecommunication': 'pib_telecom_pct',
                'Commerce': 'pib_commerce_pct',
                'Autres services': 'pib_autres_services_pct',
                "Services d'administration publique": 'pib_admin_publique_pct',
            }

            for row_idx in range(4, 30):
                if row_idx >= len(df):
                    break
                label = str(df.iloc[row_idx, 0]).strip() if not pd.isna(df.iloc[row_idx, 0]) else ''
                key = pib_structure_keys.get(label)
                if key:
                    row_years = []
                    values = []
                    for yi, ci in enumerate(ycols1):
                        v = _safe_float(df.iloc[row_idx, ci])
                        if v is not None:
                            row_years.append(years1[yi])
                            values.append(v)
                    if values:
                        self.base_eco[key] = {'years': row_years, 'values': values, 'name': label}

            # Bloc: PIB nominal, croissance, FBCF (L114-L121)
            # Header at row 113 (index)
            if len(df) > 114:
                header2 = df.iloc[113]
                years2 = []
                ycols2 = []
                for ci, val in enumerate(header2):
                    y = _safe_float(val)
                    if y and 2000 <= y <= 2030:
                        years2.append(int(y))
                        ycols2.append(ci)

                macro_keys = {
                    'Taux de croissance PIB réel': 'croissance_pib_reel',
                    'PIB en Millions XOF': 'pib_nominal_mxof',
                    'Formation Brute de Capital Fixe': 'fbcf_mxof',
                    "Taux d'investissement": 'taux_investissement',
                }

                for row_idx in range(114, min(122, len(df))):
                    label = str(df.iloc[row_idx, 0]).strip() if not pd.isna(df.iloc[row_idx, 0]) else ''
                    for prefix, key in macro_keys.items():
                        if label.startswith(prefix):
                            row_years = []
                            values = []
                            for yi, ci in enumerate(ycols2):
                                v = _safe_float(df.iloc[row_idx, ci])
                                if v is not None:
                                    row_years.append(years2[yi])
                                    values.append(v)
                            if values:
                                self.base_eco[key] = {'years': row_years, 'values': values, 'name': label}
                            break

            # IDE (L123-L135)
            if len(df) > 124:
                header3 = df.iloc[122]
                years3 = []
                ycols3 = []
                for ci, val in enumerate(header3):
                    y = _safe_float(val)
                    if y and 2000 <= y <= 2030:
                        years3.append(int(y))
                        ycols3.append(ci)

                for row_idx in range(123, min(136, len(df))):
                    label = str(df.iloc[row_idx, 0]).strip() if not pd.isna(df.iloc[row_idx, 0]) else ''
                    if label.startswith('Total IDE reçus'):
                        row_years = []
                        values = []
                        for yi, ci in enumerate(ycols3):
                            v = _safe_float(df.iloc[row_idx, ci])
                            if v is not None:
                                row_years.append(years3[yi])
                                values.append(v)
                        if values:
                            self.base_eco['ide_total_mds'] = {'years': row_years, 'values': values, 'name': label}

            # Effectifs employés (L52-L69)
            if len(df) > 52:
                header_emp = df.iloc[51]
                years_emp = []
                ycols_emp = []
                for ci, val in enumerate(header_emp):
                    y = _safe_float(val)
                    if y and 2000 <= y <= 2030:
                        years_emp.append(int(y))
                        ycols_emp.append(ci)

                emp_keys = {
                    'Primaire': 'emploi_primaire',
                    'Secondaire': 'emploi_secondaire',
                    'Tertiaire': 'emploi_tertiaire',
                    'Emploi total': 'emploi_total',
                }
                for row_idx in range(52, min(70, len(df))):
                    label = str(df.iloc[row_idx, 0]).strip() if not pd.isna(df.iloc[row_idx, 0]) else ''
                    key = emp_keys.get(label)
                    if key:
                        row_years = []
                        values = []
                        for yi, ci in enumerate(ycols_emp):
                            v = _safe_float(df.iloc[row_idx, ci])
                            if v is not None:
                                row_years.append(years_emp[yi])
                                values.append(v)
                        if values:
                            self.base_eco[key] = {'years': row_years, 'values': values, 'name': label}

        except Exception as e:
            logger.warning(f"Erreur lecture Structure Economie: {e}")

        # --- Agro-industrie ---
        try:
            df = pd.read_excel(filepath, sheet_name='Agro-industrie', header=None)
            header = df.iloc[1]
            years = []
            ycols = []
            for ci, val in enumerate(header):
                y = _safe_float(val)
                if y and 2000 <= y <= 2030:
                    years.append(int(y))
                    ycols.append(ci)

            agro_keys = {
                'Production de cacao (en tonnes)': 'cacao_production',
                'Quantité Cacao transformée (en tonnes)': 'cacao_transforme',
                'Taux de transformation de cacaco': 'cacao_taux_transfo',
            }
            for row_idx in range(2, min(7, len(df))):
                label = str(df.iloc[row_idx, 0]).strip() if not pd.isna(df.iloc[row_idx, 0]) else ''
                for prefix, key in agro_keys.items():
                    if label.startswith(prefix):
                        row_years = []
                        values = []
                        for yi, ci in enumerate(ycols):
                            v = _safe_float(df.iloc[row_idx, ci])
                            if v is not None:
                                row_years.append(years[yi])
                                values.append(v)
                        if values:
                            self.base_eco[key] = {'years': row_years, 'values': values, 'name': label}
                        break
        except Exception as e:
            logger.warning(f"Erreur lecture Agro-industrie: {e}")

        # --- Dette publique ---
        try:
            df = pd.read_excel(filepath, sheet_name='Dette publique', header=None)

            # Série longue (L15-L23, header at L15)
            header = df.iloc[15]
            years = []
            ycols = []
            for ci, val in enumerate(header):
                y = _safe_float(val)
                if y and 2000 <= y <= 2030:
                    years.append(int(y))
                    ycols.append(ci)

            dette_keys = {
                'Stock total dette': 'dette_stock_total',
                '% du PIB': None,  # handled specially
                'Extérieure': 'dette_exterieure',
                'Intérieure': 'dette_interieure',
                'PIB Nominal': 'pib_nominal_mds',
            }

            pib_pct_count = 0
            for row_idx in range(16, min(24, len(df))):
                label = str(df.iloc[row_idx, 0]).strip() if not pd.isna(df.iloc[row_idx, 0]) else ''
                matched = False
                for prefix, key in dette_keys.items():
                    if label.startswith(prefix):
                        if prefix == '% du PIB':
                            pib_pct_count += 1
                            if pib_pct_count == 1:
                                key = 'dette_pct_pib'
                            elif pib_pct_count == 2:
                                key = 'dette_ext_pct_pib'
                            elif pib_pct_count == 3:
                                key = 'dette_int_pct_pib'
                        if prefix == 'Extérieure':
                            key = 'dette_exterieure_mds'
                        if prefix == 'Intérieure':
                            key = 'dette_interieure_mds'
                        if key:
                            row_years = []
                            values = []
                            for yi, ci in enumerate(ycols):
                                v = _safe_float(df.iloc[row_idx, ci])
                                if v is not None:
                                    row_years.append(years[yi])
                                    values.append(v)
                            if values:
                                self.base_eco[key] = {'years': row_years, 'values': values, 'name': label}
                        matched = True
                        break
                # Handle "en % du PIB" lines
                if not matched and label.startswith('en % du PIB'):
                    pib_pct_count += 1
                    if pib_pct_count == 1:
                        key = 'dette_ext_pct_pib'
                    else:
                        key = 'dette_int_pct_pib'
                    row_years = []
                    values = []
                    for yi, ci in enumerate(ycols):
                        v = _safe_float(df.iloc[row_idx, ci])
                        if v is not None:
                            row_years.append(years[yi])
                            values.append(v)
                    if values:
                        self.base_eco[key] = {'years': row_years, 'values': values, 'name': label}

        except Exception as e:
            logger.warning(f"Erreur lecture Dette publique: {e}")

    # ──────────────────────────────────────────────
    # FINANCEMENTS
    # ──────────────────────────────────────────────
    def _load_financements(self):
        filepath = BASE_DIR / 'financements.xlsx'
        if not filepath.exists():
            logger.warning(f"financements.xlsx introuvable: {filepath}")
            return

        # Encours de la dette, tirages
        try:
            data = _read_table(filepath, 'Encours de la dette, tirages', header_row=1, data_start_row=2)
            fin_keys = {
                'Dette totale': 'dette_totale',
                'Dette extérieure': 'dette_exterieure',
                'Dette intérieure': 'dette_interieure',
                'Tirages / Émissions totaux': 'tirages_totaux',
                'Service total de la dette': 'service_dette_total',
                'Remboursement principal total': 'remboursement_principal',
                'Paiement intérêts total': 'paiement_interets',
            }
            for label, series in data.items():
                for prefix, key in fin_keys.items():
                    if label.startswith(prefix):
                        self.financements[key] = {**series, 'name': label}
                        break
        except Exception as e:
            logger.warning(f"Erreur lecture encours dette: {e}")

        # Ratios principaux
        try:
            data = _read_table(filepath, 'Ratios principaux et indicateur', header_row=1, data_start_row=2)
            ratio_keys = {
                'Dette du gouvernement central': 'dette_pct_pib',
                'Paiement des intérêts (% des recettes': 'interets_pct_recettes',
                'Paiement des intérêts (% du PIB)': 'interets_pct_pib',
                "Taux d'intérêt moyen pondéré de la dette (%)": 'taux_interet_moyen',
                "Durée de vie moyenne jusqu'à échéance (années": 'duree_vie_moyenne',
                'Dette à court terme (% du total)': 'dette_ct_pct',
                'Dette en devises étrangères (% du total)': 'dette_devises_pct',
                'Dette à taux fixe (% du total)': 'dette_taux_fixe_pct',
            }
            for label, series in data.items():
                for prefix, key in ratio_keys.items():
                    if label.startswith(prefix):
                        self.financements[key] = {**series, 'name': label}
                        break
        except Exception as e:
            logger.warning(f"Erreur lecture ratios financements: {e}")

        # Service dette extérieure par créancier
        try:
            data = _read_table(filepath, 'Service de la dette extérieure', header_row=1, data_start_row=2)
            for label, series in data.items():
                lbl = label.lower().strip()
                if lbl.startswith('bilatéraux') and series.get('level', 0) == 0:
                    self.financements['service_ext_bilateral'] = {**series, 'name': label}
                elif lbl.startswith('multilatéraux') and series.get('level', 0) == 0:
                    self.financements['service_ext_multilateral'] = {**series, 'name': label}
                elif "détenteurs d'obligations" in lbl and series.get('level', 0) == 0:
                    self.financements['service_ext_obligations'] = {**series, 'name': label}
                elif lbl.startswith('total service'):
                    self.financements['service_ext_total'] = {**series, 'name': label}
        except Exception as e:
            logger.warning(f"Erreur lecture service dette ext: {e}")

    # ──────────────────────────────────────────────
    # API publique
    # ──────────────────────────────────────────────
    def get_series(self, source, key):
        """
        Retourne une série : {'years': [...], 'values': [...], 'name': '...'}
        source: 'tofe', 'douanes', 'base_eco', 'financements'
        """
        store = getattr(self, source, {})
        return store.get(key, {'years': [], 'values': [], 'name': key})

    def get_all_series(self, source):
        """Retourne toutes les séries d'une source."""
        return getattr(self, source, {})

    def get_pression_fiscale(self):
        """Calcule la pression fiscale = recettes fiscales / PIB nominal * 100."""
        rf = self.tofe.get('recettes_fiscales', {})
        pib = self.base_eco.get('pib_nominal_mxof', {})
        if not rf.get('values') or not pib.get('values'):
            return {'years': [], 'values': [], 'name': 'Pression fiscale (% PIB)'}

        # Aligner les années communes
        rf_dict = dict(zip(rf['years'], rf['values']))
        pib_dict = dict(zip(pib['years'], pib['values']))
        common_years = sorted(set(rf['years']) & set(pib['years']))

        years = []
        values = []
        for y in common_years:
            pib_val = pib_dict[y]
            if pib_val and pib_val > 0:
                # rf en milliards FCFA, PIB en millions XOF → convertir PIB en milliards
                pib_mds = pib_val / 1000
                pf = (rf_dict[y] / pib_mds) * 100
                years.append(y)
                values.append(round(pf, 1))

        return {'years': years, 'values': values, 'name': 'Pression fiscale (% PIB)'}

    # ──────────────────────────────────────────────
    # Sources & métadonnées
    # ──────────────────────────────────────────────
    SOURCES = {
        'tofe': {
            'source': 'Ministère des Finances et du Budget (MFB)',
            'source_link': '',
            'methodology': 'Données issues du Tableau des Opérations Financières de l\'État (TOFE), publié par le Ministère en charge des Finances. Le TOFE retrace l\'ensemble des recettes et dépenses du budget de l\'État ainsi que le solde budgétaire global.',
        },
        'douanes': {
            'source': 'Direction Générale des Douanes',
            'source_link': 'https://www.douanes.ci/sites/default/files/annuaire_statistique_douanes_ivoiriennes_asdi_2024.pdf',
            'methodology': 'Données extraites de l\'Annuaire Statistique des Douanes Ivoiriennes (ASDI) 2024. Les importations sont en valeur CAF (Coût, Assurance et Fret) et les exportations en valeur FOB (Free On Board).',
        },
        'base_eco': {
            'source': 'Direction Générale de l\'Économie (DGE) / ANStat',
            'source_link': '',
            'methodology': 'Données compilées à partir de la base de données économiques de la DGE, incluant les comptes nationaux, la structure du PIB, les effectifs employés, les IDE, la production agro-industrielle et l\'encours de la dette publique. Sources primaires indiquées sous chaque tableau du classeur.',
        },
        'financements': {
            'source': 'Direction Générale des Financements (DGF)',
            'source_link': 'https://www.dgf.gouv.ci/publications/bulletins-statistiques',
            'methodology': 'Données provenant des bulletins statistiques de la Direction Générale des Financements. Couvrent l\'encours de la dette publique, le service de la dette (intérieure et extérieure), les ratios d\'endettement et les indicateurs de viabilité.',
        },
    }

    # Noms lisibles et descriptions pour chaque clé d'indicateur national
    INDICATOR_META = {
        # TOFE
        'tofe.recettes_et_dons':        {'name': 'Recettes et dons (TOFE)', 'unit': 'Mds FCFA', 'description': 'Total des recettes budgétaires et dons reçus par l\'État'},
        'tofe.recettes_totales':        {'name': 'Recettes totales (TOFE)', 'unit': 'Mds FCFA', 'description': 'Recettes totales de l\'État hors dons'},
        'tofe.recettes_fiscales':       {'name': 'Recettes fiscales (TOFE)', 'unit': 'Mds FCFA', 'description': 'Total des recettes fiscales collectées par l\'État (impôts directs, TVA, droits de douane, etc.)'},
        'tofe.impots_directs':          {'name': 'Impôts directs', 'unit': 'Mds FCFA', 'description': 'Impôts sur le revenu des personnes physiques et morales'},
        'tofe.impots_biens_services':   {'name': 'Impôts sur les biens et services', 'unit': 'Mds FCFA', 'description': 'TVA intérieure et taxes sur les biens et services'},
        'tofe.droits_importation':      {'name': 'Droits et taxes à l\'importation', 'unit': 'Mds FCFA', 'description': 'Droits de douane et taxes perçus sur les importations'},
        'tofe.taxes_exportation':       {'name': 'Taxes à l\'exportation', 'unit': 'Mds FCFA', 'description': 'Droit Unique de Sortie et autres taxes à l\'exportation'},
        'tofe.recettes_non_fiscales':   {'name': 'Recettes non fiscales', 'unit': 'Mds FCFA', 'description': 'Revenus non fiscaux de l\'État (dividendes, redevances, etc.)'},
        'tofe.dons':                    {'name': 'Dons reçus', 'unit': 'Mds FCFA', 'description': 'Dons et appuis budgétaires reçus des partenaires internationaux'},
        'tofe.depenses_totales':        {'name': 'Dépenses totales et prêts nets (TOFE)', 'unit': 'Mds FCFA', 'description': 'Total des dépenses publiques incluant fonctionnement, investissement et prêts nets'},
        'tofe.remuneration_salaries':   {'name': 'Rémunération des salariés (État)', 'unit': 'Mds FCFA', 'description': 'Masse salariale de la fonction publique'},
        'tofe.subventions_transferts':  {'name': 'Subventions et transferts', 'unit': 'Mds FCFA', 'description': 'Subventions aux entreprises publiques et transferts sociaux'},
        'tofe.depenses_fonctionnement': {'name': 'Dépenses de fonctionnement', 'unit': 'Mds FCFA', 'description': 'Dépenses courantes de fonctionnement de l\'État'},
        'tofe.interets_dette':          {'name': 'Intérêts de la dette publique', 'unit': 'Mds FCFA', 'description': 'Charge d\'intérêts sur la dette intérieure et extérieure'},
        'tofe.depenses_investissement': {'name': 'Dépenses d\'investissement (TOFE)', 'unit': 'Mds FCFA', 'description': 'Dépenses en capital financées sur ressources intérieures et extérieures'},
        'tofe.solde_budgetaire':        {'name': 'Solde budgétaire global', 'unit': 'Mds FCFA', 'description': 'Différence entre recettes totales (y.c. dons) et dépenses totales'},
        'tofe.financement_interieur':   {'name': 'Financement intérieur du déficit', 'unit': 'Mds FCFA', 'description': 'Financement du déficit par émission de titres publics sur le marché intérieur'},
        'tofe.financement_exterieur':   {'name': 'Financement extérieur du déficit', 'unit': 'Mds FCFA', 'description': 'Financement du déficit par emprunts extérieurs'},
        # Calculés
        'tofe.pression_fiscale':        {'name': 'Pression fiscale (% du PIB)', 'unit': '%', 'description': 'Ratio des recettes fiscales rapportées au PIB nominal. Indicateur clé de mobilisation des ressources internes.'},
        'tofe.solde_budgetaire_pct_pib': {'name': 'Solde budgétaire (% du PIB)', 'unit': '%', 'description': 'Solde budgétaire global rapporté au PIB nominal. Un solde négatif indique un déficit budgétaire.'},
        # Douanes
        'douanes.imports_caf':          {'name': 'Importations CAF', 'unit': 'Mds FCFA', 'description': 'Valeur totale des importations en Coût, Assurance et Fret'},
        'douanes.exports_fob':          {'name': 'Exportations FOB', 'unit': 'Mds FCFA', 'description': 'Valeur totale des exportations Free On Board'},
        'douanes.solde_commercial':     {'name': 'Solde commercial (Douanes)', 'unit': 'Mds FCFA', 'description': 'Différence entre exportations FOB et importations CAF'},
        'douanes.taux_couverture':      {'name': 'Taux de couverture commerciale', 'unit': '%', 'description': 'Ratio exportations/importations. Un taux > 100% signifie un excédent commercial.'},
        'douanes.export_europe':        {'name': 'Exportations vers l\'Europe', 'unit': 'Mds FCFA', 'description': 'Valeur des exportations à destination de l\'Europe'},
        'douanes.export_afrique':       {'name': 'Exportations vers l\'Afrique', 'unit': 'Mds FCFA', 'description': 'Valeur des exportations à destination du continent africain (CEDEAO, UEMOA, etc.)'},
        'douanes.export_asie':          {'name': 'Exportations vers l\'Asie', 'unit': 'Mds FCFA', 'description': 'Valeur des exportations à destination de l\'Asie'},
        'douanes.export_amerique':      {'name': 'Exportations vers les Amériques', 'unit': 'Mds FCFA', 'description': 'Valeur des exportations à destination des Amériques'},
        'douanes.export_agri_industrielle': {'name': 'Exports agriculture industrielle', 'unit': 'Mds FCFA', 'description': 'Exportations de produits de l\'agriculture industrielle (cacao, café, coton, etc.)'},
        'douanes.export_premiere_transfo':  {'name': 'Exports 1ère transformation', 'unit': 'Mds FCFA', 'description': 'Exportations de produits de première transformation'},
        'douanes.export_manufactures':      {'name': 'Exports produits manufacturés', 'unit': 'Mds FCFA', 'description': 'Exportations de produits manufacturés'},
        'douanes.export_miniers':           {'name': 'Exports produits miniers', 'unit': 'Mds FCFA', 'description': 'Exportations de produits miniers (or, manganèse, etc.)'},
        'douanes.recettes_brutes':          {'name': 'Recettes douanières brutes', 'unit': 'Mds FCFA', 'description': 'Total des recettes collectées par la Douane (base brute)'},
        # Base éco - Structure PIB
        'base_eco.pib_primaire_pct':       {'name': 'Part du secteur primaire dans le PIB', 'unit': '%', 'description': 'Contribution du secteur primaire (agriculture, élevage, pêche, forêt) au PIB'},
        'base_eco.pib_secondaire_pct':     {'name': 'Part du secteur secondaire dans le PIB', 'unit': '%', 'description': 'Contribution du secteur secondaire (industrie, BTP, énergie, mines) au PIB'},
        'base_eco.pib_tertiaire_pct':      {'name': 'Part du secteur tertiaire dans le PIB', 'unit': '%', 'description': 'Contribution du secteur tertiaire (services, commerce, transports, télécoms) au PIB'},
        'base_eco.pib_manufacturier_pct':  {'name': 'Part des industries manufacturières dans le PIB', 'unit': '%', 'description': 'Contribution des industries manufacturières au PIB'},
        'base_eco.pib_btp_pct':            {'name': 'Part du BTP dans le PIB', 'unit': '%', 'description': 'Contribution du Bâtiment et Travaux Publics au PIB'},
        'base_eco.pib_extractives_pct':    {'name': 'Part des industries extractives dans le PIB', 'unit': '%', 'description': 'Contribution des industries extractives (pétrole, gaz, mines) au PIB'},
        'base_eco.pib_commerce_pct':       {'name': 'Part du commerce dans le PIB', 'unit': '%', 'description': 'Contribution du secteur commerce au PIB'},
        'base_eco.pib_transports_pct':     {'name': 'Part des transports dans le PIB', 'unit': '%', 'description': 'Contribution du secteur transports au PIB'},
        # Base éco - Macro
        'base_eco.croissance_pib_reel':    {'name': 'Taux de croissance du PIB réel (DGE)', 'unit': '%', 'description': 'Taux de croissance annuel du PIB en termes réels, source DGE'},
        'base_eco.pib_nominal_mxof':       {'name': 'PIB nominal (millions XOF)', 'unit': 'Millions XOF', 'description': 'Produit intérieur brut à prix courants en millions de francs CFA'},
        'base_eco.fbcf_mxof':              {'name': 'Formation Brute de Capital Fixe', 'unit': 'Millions XOF', 'description': 'Investissements en capital fixe (constructions, équipements, etc.)'},
        'base_eco.taux_investissement':    {'name': 'Taux d\'investissement', 'unit': '%', 'description': 'Ratio FBCF/PIB. Mesure l\'effort d\'investissement de l\'économie.'},
        'base_eco.ide_total_mds':          {'name': 'Investissements Directs Étrangers reçus', 'unit': 'Mds FCFA', 'description': 'Flux nets d\'IDE reçus par la Côte d\'Ivoire'},
        # Base éco - Emploi
        'base_eco.emploi_primaire':        {'name': 'Emploi dans le secteur primaire', 'unit': 'Milliers', 'description': 'Effectifs employés dans le secteur primaire (agriculture, élevage, pêche)'},
        'base_eco.emploi_secondaire':      {'name': 'Emploi dans le secteur secondaire', 'unit': 'Milliers', 'description': 'Effectifs employés dans le secteur secondaire (industrie, BTP, énergie)'},
        'base_eco.emploi_tertiaire':       {'name': 'Emploi dans le secteur tertiaire', 'unit': 'Milliers', 'description': 'Effectifs employés dans le secteur tertiaire (services, commerce)'},
        'base_eco.emploi_total':           {'name': 'Emploi total', 'unit': 'Milliers', 'description': 'Effectifs totaux employés tous secteurs confondus'},
        # Base éco - Cacao
        'base_eco.cacao_production':       {'name': 'Production de cacao', 'unit': 'Tonnes', 'description': 'Production annuelle de cacao fèves en Côte d\'Ivoire (1er producteur mondial)'},
        'base_eco.cacao_transforme':       {'name': 'Quantité de cacao transformée', 'unit': 'Tonnes', 'description': 'Volume de cacao transformé localement (broyage)'},
        'base_eco.cacao_taux_transfo':     {'name': 'Taux de transformation du cacao', 'unit': '%', 'description': 'Part de la production de cacao transformée localement'},
        # Base éco - Dette
        'base_eco.dette_stock_total':      {'name': 'Stock total de la dette publique', 'unit': 'Mds FCFA', 'description': 'Encours total de la dette publique (intérieure + extérieure)'},
        'base_eco.dette_pct_pib':          {'name': 'Dette publique en % du PIB (DGE)', 'unit': '% du PIB', 'description': 'Ratio dette publique / PIB nominal'},
        'base_eco.dette_exterieure_mds':   {'name': 'Dette extérieure', 'unit': 'Mds FCFA', 'description': 'Encours de la dette extérieure'},
        'base_eco.dette_interieure_mds':   {'name': 'Dette intérieure', 'unit': 'Mds FCFA', 'description': 'Encours de la dette intérieure'},
        # Financements
        'financements.dette_pct_pib':      {'name': 'Dette du gouvernement central (% PIB)', 'unit': '% du PIB', 'description': 'Ratio dette du gouvernement central / PIB selon la DGF'},
        'financements.interets_pct_recettes': {'name': 'Intérêts de la dette (% des recettes)', 'unit': '%', 'description': 'Charge d\'intérêts rapportée aux recettes budgétaires'},
        'financements.interets_pct_pib':   {'name': 'Intérêts de la dette (% du PIB)', 'unit': '%', 'description': 'Charge d\'intérêts rapportée au PIB'},
        'financements.taux_interet_moyen': {'name': 'Taux d\'intérêt moyen pondéré de la dette', 'unit': '%', 'description': 'Taux d\'intérêt moyen pondéré sur l\'ensemble du portefeuille de dette'},
        'financements.duree_vie_moyenne':  {'name': 'Durée de vie moyenne de la dette', 'unit': 'Années', 'description': 'Durée de vie moyenne jusqu\'à échéance du portefeuille de dette'},
        'financements.dette_ct_pct':       {'name': 'Part de la dette à court terme', 'unit': '%', 'description': 'Proportion de la dette arrivant à échéance dans moins d\'un an'},
        'financements.dette_devises_pct':  {'name': 'Part de la dette en devises étrangères', 'unit': '%', 'description': 'Proportion de la dette libellée en devises (risque de change)'},
        'financements.service_dette_total': {'name': 'Service total de la dette', 'unit': 'Mds FCFA', 'description': 'Total des remboursements de principal et paiements d\'intérêts'},
        'financements.remboursement_principal': {'name': 'Remboursement du principal', 'unit': 'Mds FCFA', 'description': 'Amortissement du principal de la dette'},
        'financements.paiement_interets':  {'name': 'Paiement des intérêts', 'unit': 'Mds FCFA', 'description': 'Paiements d\'intérêts sur la dette'},
        'financements.service_ext_bilateral': {'name': 'Service dette ext. - Bilatéraux', 'unit': 'Mds FCFA', 'description': 'Service de la dette extérieure dû aux créanciers bilatéraux'},
        'financements.service_ext_multilateral': {'name': 'Service dette ext. - Multilatéraux', 'unit': 'Mds FCFA', 'description': 'Service de la dette extérieure dû aux créanciers multilatéraux'},
        'financements.service_ext_obligations': {'name': 'Service dette ext. - Obligations', 'unit': 'Mds FCFA', 'description': 'Service de la dette extérieure sur les euro-obligations'},
    }

    def get_all_indicators_for_explorer(self):
        """
        Retourne tous les indicateurs nationaux dans un format compatible avec
        l'Explorer et l'API /api/indicators.
        Format: [{code, name, source_link, methodology, unit, source, description}]
        """
        indicators = []
        for full_key, meta in self.INDICATOR_META.items():
            source_key, data_key = full_key.split('.', 1)
            src_meta = self.SOURCES.get(source_key, {})

            # Récupérer la série
            if data_key == 'pression_fiscale':
                series = self.get_pression_fiscale()
            elif data_key == 'solde_budgetaire_pct_pib':
                series = self.get_solde_budgetaire_pct_pib()
            else:
                store = getattr(self, source_key, {})
                series = store.get(data_key)

            if not series or not series.get('values'):
                continue

            indicators.append({
                'code': f'NAT.{full_key}',
                'name': meta['name'],
                'unit': meta.get('unit', ''),
                'source': src_meta.get('source', ''),
                'source_link': src_meta.get('source_link', ''),
                'methodology': src_meta.get('methodology', ''),
                'description': meta.get('description', ''),
            })

        # Add top products (dynamic)
        for i in range(10):
            exp_key = f'top_export_{i}'
            imp_key = f'top_import_{i}'
            if exp_key in self.douanes:
                indicators.append({
                    'code': f'NAT.douanes.{exp_key}',
                    'name': f'Top export #{i+1}: {self.douanes[exp_key]["name"]}',
                    'unit': 'Mds FCFA',
                    'source': self.SOURCES['douanes']['source'],
                    'source_link': self.SOURCES['douanes']['source_link'],
                    'methodology': self.SOURCES['douanes']['methodology'],
                    'description': f'Valeur des exportations du produit: {self.douanes[exp_key]["name"]}',
                })
            if imp_key in self.douanes:
                indicators.append({
                    'code': f'NAT.douanes.{imp_key}',
                    'name': f'Top import #{i+1}: {self.douanes[imp_key]["name"]}',
                    'unit': 'Mds FCFA',
                    'source': self.SOURCES['douanes']['source'],
                    'source_link': self.SOURCES['douanes']['source_link'],
                    'methodology': self.SOURCES['douanes']['methodology'],
                    'description': f'Valeur des importations du produit: {self.douanes[imp_key]["name"]}',
                })

        return indicators

    def get_indicator_detail_by_code(self, code):
        """
        Retourne le détail d'un indicateur national par son code NAT.xxx.yyy.
        Compatible avec le format attendu par l'API /api/indicator/<code>.
        """
        if not code.startswith('NAT.'):
            return None

        full_key = code[4:]  # Remove 'NAT.' prefix
        parts = full_key.split('.', 1)
        if len(parts) != 2:
            return None

        source_key, data_key = parts
        src_meta = self.SOURCES.get(source_key, {})
        meta = self.INDICATOR_META.get(full_key, {})

        # Récupérer la série
        if data_key == 'pression_fiscale':
            series = self.get_pression_fiscale()
        elif data_key == 'solde_budgetaire_pct_pib':
            series = self.get_solde_budgetaire_pct_pib()
        else:
            store = getattr(self, source_key, {})
            series = store.get(data_key)

        if not series or not series.get('values'):
            return None

        # Build values in {year, value} format
        values = [{'year': y, 'value': v} for y, v in zip(series['years'], series['values'])]

        return {
            'code': code,
            'name': meta.get('name', series.get('name', data_key)),
            'unit': meta.get('unit', ''),
            'source': src_meta.get('source', ''),
            'source_link': src_meta.get('source_link', ''),
            'methodology': src_meta.get('methodology', ''),
            'definition': meta.get('description', ''),
            'values': values,
        }

    def get_compact_indicator_list(self):
        """
        Retourne une liste compacte CODE|NOM|DESCRIPTION pour le prompt Gemini Phase 1.
        """
        lines = []
        for full_key, meta in self.INDICATOR_META.items():
            source_key, data_key = full_key.split('.', 1)
            if data_key == 'pression_fiscale':
                series = self.get_pression_fiscale()
            elif data_key == 'solde_budgetaire_pct_pib':
                series = self.get_solde_budgetaire_pct_pib()
            else:
                store = getattr(self, source_key, {})
                series = store.get(data_key)
            if not series or not series.get('values'):
                continue
            code = f'NAT.{full_key}'
            desc = meta.get('description', '')[:120]
            lines.append(f"{code}|{meta['name']}|{desc}")
        return "\n".join(lines)

    def search_indicators(self, query):
        """Recherche dans les indicateurs nationaux."""
        query_lower = query.lower().strip()
        results = []
        for full_key, meta in self.INDICATOR_META.items():
            source_key, data_key = full_key.split('.', 1)
            if data_key == 'pression_fiscale':
                series = self.get_pression_fiscale()
            elif data_key == 'solde_budgetaire_pct_pib':
                series = self.get_solde_budgetaire_pct_pib()
            else:
                store = getattr(self, source_key, {})
                series = store.get(data_key)
            if not series or not series.get('values'):
                continue

            name_lower = meta['name'].lower()
            desc_lower = meta.get('description', '').lower()
            score = 0
            if query_lower in name_lower:
                score = 300
            elif query_lower in desc_lower:
                score = 150
            else:
                words = [w for w in query_lower.split() if len(w) > 2]
                for w in words:
                    if w in name_lower:
                        score += 50
                    elif w in desc_lower:
                        score += 20
            if score > 0:
                results.append({
                    'code': f'NAT.{full_key}',
                    'name': meta['name'],
                    'score': score,
                })
        # Also search in top products
        for prefix, store_key in [('douanes', 'douanes')]:
            store = getattr(self, store_key, {})
            for k, s in store.items():
                if k.startswith('top_export_') or k.startswith('top_import_'):
                    name = s.get('name', k)
                    if query_lower in name.lower():
                        results.append({
                            'code': f'NAT.{store_key}.{k}',
                            'name': name,
                            'score': 200,
                        })
        results.sort(key=lambda x: x['score'], reverse=True)
        return [{'code': r['code'], 'name': r['name']} for r in results[:30]]

    def get_solde_budgetaire_pct_pib(self):
        """Retourne le solde budgétaire en % du PIB depuis le TOFE."""
        solde = self.tofe.get('solde_budgetaire', {})
        pib = self.base_eco.get('pib_nominal_mxof', {})
        if not solde.get('values') or not pib.get('values'):
            return {'years': [], 'values': [], 'name': 'Solde budgétaire (% PIB)'}

        solde_dict = dict(zip(solde['years'], solde['values']))
        pib_dict = dict(zip(pib['years'], pib['values']))
        common_years = sorted(set(solde['years']) & set(pib['years']))

        years = []
        values = []
        for y in common_years:
            pib_val = pib_dict[y]
            if pib_val and pib_val > 0:
                pib_mds = pib_val / 1000
                pct = (solde_dict[y] / pib_mds) * 100
                years.append(y)
                values.append(round(pct, 1))

        return {'years': years, 'values': values, 'name': 'Solde budgétaire (% PIB)'}


# Singleton instance
national_data_service = NationalDataService()
