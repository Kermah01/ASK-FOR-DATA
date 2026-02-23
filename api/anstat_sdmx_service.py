"""
Service de chargement des données ANStat OpenData (format SDMX XML).
Parse les 18 fichiers XML du portail nso-cotedivoire.opendataforafrica.org
et expose les séries annualisées dans un format compatible NationalDataService.

Source: Page Nationale Récapitulative des Données (PNRD) - ANStat / FMI
"""
import xml.etree.ElementTree as ET
import os
import glob
import math
import logging
from pathlib import Path
from collections import defaultdict

logger = logging.getLogger('api')

BASE_DIR = Path(__file__).resolve().parent.parent


# ─────────────────────────────────────────────────────
# XML FILE → THEME MAPPING
# ─────────────────────────────────────────────────────
FILE_THEMES = {
    'Avoirs de réserves officielles.xml': 'reserves',
    'Balance des paiements.xml': 'balance_paiements',
    'Commerce des marchandises.xml': 'commerce',
    'Dette brute de l\u2019administration centrale.xml': 'dette_admin',
    'Dette extérieure.xml': 'dette_ext',
    'Indicateurs sociaux démographiques.xml': 'social',
    'Indice de production.xml': 'production',
    'Indice des prix à la consommation.xml': 'ipc',
    'Indice des prix à la production.xml': 'ipp',
    'Marché du travail.xml': 'emploi',
    'Opérations de l’administration centrale.xml': 'tofe_sdmx',
    'Opérations des administrations publiques.xml': 'admin_publiques',
    'Population.xml': 'population',
    'Position extérieure globale.xml': 'position_ext',
    'Situation de la banque centrale.xml': 'banque_centrale',
    'Situation des institutions de dépôt.xml': 'institutions_depot',
    'Taux de change.xml': 'taux_change',
    'Taux d’intérêt.xml': 'taux_interet',
}

# ─────────────────────────────────────────────────────
# AGGREGATION STRATEGIES
# Monthly/Quarterly → Annual
# ─────────────────────────────────────────────────────
# 'avg' = average (rates, prices, indices, stocks at point in time)
# 'sum' = sum (flows: trade, fiscal operations, employment counts per period)
# 'last' = end of year value (stocks, positions, reserves at a date)
# Default: 'avg' for most indicators
AGG_STRATEGY_BY_THEME = {
    'reserves': 'last',
    'balance_paiements': 'sum',
    'commerce': 'sum',
    'dette_admin': 'last',
    'dette_ext': 'last',
    'social': 'avg',
    'production': 'avg',
    'ipc': 'avg',
    'ipp': 'avg',
    'emploi': 'sum',
    'tofe_sdmx': 'sum',
    'admin_publiques': 'sum',
    'population': 'avg',
    'position_ext': 'last',
    'banque_centrale': 'last',
    'institutions_depot': 'last',
    'taux_change': 'avg',
    'taux_interet': 'avg',
}

# Override for specific indicators (code prefix → strategy)
AGG_OVERRIDE = {
    # Stock variables should use 'last' even in flow-themed files
    'BFDA': 'sum',   # IDE (flow)
    'BFDL': 'sum',   # IDE passif (flow)
    # Interest rates, exchange rates, indices → always average
    'ENDA_': 'avg', 'ENDE_': 'avg', 'ESNA_': 'avg',
    'FILR_': 'avg', 'FIDR_': 'avg', 'FII_': 'avg', 'FIMM_': 'avg', 'FPOLM_': 'avg',
    # Reserves: end of year
    'MAU_RAFA': 'last', 'MAU_RAGO': 'last', 'MAU_RASD': 'last',
    # Debt stocks: end of year
    'GGD': 'last', 'GGD_': 'last',
    # Monetary stocks
    'FASF_': 'last', 'FASMB_': 'last', 'FDSF_': 'last', 'FDSB_': 'last',
    'FDSAD_': 'last', 'FDSDG_': 'last', 'FDSAO_': 'last',
    'FASAF_': 'last', 'FASLF_': 'last', 'FASG_': 'last', 'FASAO_': 'last',
    'FDSAF_': 'last', 'FDSLF_': 'last',
    # Budget % PIB → average
    '_GDP': 'avg',
}


def _get_agg_strategy(code, theme):
    """Determine aggregation strategy for a given indicator code and theme."""
    for prefix, strat in AGG_OVERRIDE.items():
        if prefix in code:
            return strat
    return AGG_STRATEGY_BY_THEME.get(theme, 'avg')


def _safe_float(val):
    """Convert a string value to float, return None if invalid."""
    if val is None or val == '':
        return None
    try:
        f = float(val)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (ValueError, TypeError):
        return None


def _parse_time_period(tp):
    """
    Parse SDMX TIME_PERIOD into (year, sub_period).
    Returns (year_int, sub_key) where sub_key is:
      - None for annual ('2020')
      - month int for monthly ('2020-01' → 1)
      - quarter int for quarterly ('2020-Q1' → 1)
    """
    tp = str(tp).strip()
    if '-Q' in tp:
        parts = tp.split('-Q')
        return int(parts[0]), int(parts[1])
    elif '-' in tp:
        parts = tp.split('-')
        return int(parts[0]), int(parts[1])
    else:
        return int(tp), None


def _aggregate_to_annual(observations, strategy):
    """
    Aggregate sub-annual observations to annual values.
    observations: list of (year, sub_period, value)
    strategy: 'avg', 'sum', or 'last'
    Returns: dict {year: value}
    """
    by_year = defaultdict(list)
    for year, sub, val in observations:
        by_year[year].append((sub or 0, val))

    result = {}
    for year, entries in by_year.items():
        if not entries:
            continue
        values = [v for _, v in entries]
        if strategy == 'sum':
            result[year] = round(sum(values), 6)
        elif strategy == 'last':
            # Sort by sub-period, take last
            entries.sort(key=lambda x: x[0])
            result[year] = round(entries[-1][1], 6)
        else:  # avg
            result[year] = round(sum(values) / len(values), 6)

    return result


# ─────────────────────────────────────────────────────
# REDUNDANCY FILTER
# These SDMX codes overlap with existing data sources
# ─────────────────────────────────────────────────────
SKIP_CODES = set()
# We'll skip series with only 1 annual obs (not useful for trends)
MIN_ANNUAL_OBS = 2


# ─────────────────────────────────────────────────────
# MAIN PARSER
# ─────────────────────────────────────────────────────
class AnstatSdmxService:
    """Parse and serve ANStat SDMX XML data."""

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
        """Parse all XML files and build the data store."""
        self.series = {}  # key → {years, values, name, code, theme, unit_mult, freq_orig}
        self.themes = defaultdict(list)  # theme → [key, ...]

        xml_dir = BASE_DIR
        xml_files = glob.glob(str(xml_dir / '*.xml'))

        if not xml_files:
            logger.warning("Aucun fichier XML ANStat trouvé dans %s", xml_dir)
            self._loaded = True
            return

        total_raw = 0
        total_kept = 0

        for filepath in sorted(xml_files):
            fname = os.path.basename(filepath)
            theme = FILE_THEMES.get(fname)
            if theme is None:
                continue  # Unknown XML file, skip

            try:
                series_from_file = self._parse_xml_file(filepath, theme)
                total_raw += len(series_from_file)

                for key, data in series_from_file.items():
                    if key not in self.series:
                        self.series[key] = data
                        self.themes[theme].append(key)
                        total_kept += 1
            except Exception as e:
                logger.warning("Erreur parsing %s: %s", fname, e)

        logger.info(
            "✓ ANStat SDMX chargé: %d séries annualisées à partir de %d séries brutes (%d fichiers XML)",
            total_kept, total_raw, len(xml_files)
        )
        self._loaded = True

    def _parse_xml_file(self, filepath, theme):
        """Parse a single SDMX XML file and return aggregated annual series."""
        tree = ET.parse(filepath)
        root = tree.getroot()

        # Collect all series, preferring annual > quarterly > monthly
        # For same code, we keep the highest-frequency data and aggregate
        raw_by_code = defaultdict(list)  # code → [(freq, name, unit_mult, observations)]

        for elem in root.iter():
            tag = elem.tag
            if not (tag.endswith('}Series') or tag == 'Series'):
                continue

            attrs = dict(elem.attrib)
            code = attrs.get('INDICATOR', '')
            name = attrs.get('NOMFR_INDICATOR', attrs.get('NOM_INDICATOR', ''))
            freq = attrs.get('FREQ', 'A')
            unit_mult = attrs.get('UNIT_MULT', '0')

            if not code or code in SKIP_CODES:
                continue

            # Parse observations
            observations = []
            for child in elem:
                if child.tag.endswith('}Obs') or child.tag == 'Obs':
                    tp = child.attrib.get('TIME_PERIOD', '')
                    val = _safe_float(child.attrib.get('OBS_VALUE'))
                    if tp and val is not None:
                        try:
                            year, sub = _parse_time_period(tp)
                            observations.append((year, sub, val))
                        except (ValueError, IndexError):
                            continue

            if observations:
                raw_by_code[code].append((freq, name, unit_mult, observations))

        # Now aggregate each code to annual
        result = {}
        for code, freq_variants in raw_by_code.items():
            # Priority: use annual data if available with enough obs, else aggregate monthly/quarterly
            # Sort by frequency priority: A > Q > M (annual preferred if enough data)
            freq_order = {'A': 0, 'Q': 1, 'M': 2}
            freq_variants.sort(key=lambda x: freq_order.get(x[0], 3))

            best_freq, best_name, best_unit_mult, best_obs = freq_variants[0]

            # If annual data exists but has very few obs, try to use sub-annual
            if best_freq == 'A' and len(best_obs) < MIN_ANNUAL_OBS and len(freq_variants) > 1:
                # Try the next variant (quarterly or monthly)
                _, best_name_alt, best_unit_mult_alt, best_obs_alt = freq_variants[1]
                strategy = _get_agg_strategy(code, theme)
                annual_vals = _aggregate_to_annual(best_obs_alt, strategy)
                if len(annual_vals) >= MIN_ANNUAL_OBS:
                    best_obs = best_obs_alt
                    best_freq = freq_variants[1][0]
                    best_name = best_name_alt or best_name
                    best_unit_mult = best_unit_mult_alt

            # Aggregate to annual
            if best_freq == 'A':
                # Already annual
                annual_vals = {year: val for year, _, val in best_obs}
            else:
                strategy = _get_agg_strategy(code, theme)
                annual_vals = _aggregate_to_annual(best_obs, strategy)

            if len(annual_vals) < MIN_ANNUAL_OBS:
                continue

            # Sort by year
            sorted_years = sorted(annual_vals.keys())
            years = sorted_years
            values = [annual_vals[y] for y in sorted_years]

            # Build unique key: theme.code
            key = f"{theme}.{code}"

            result[key] = {
                'years': years,
                'values': values,
                'name': best_name or code,
                'code': code,
                'theme': theme,
                'unit_mult': best_unit_mult,
                'freq_orig': best_freq,
            }

        return result

    # ─────────────────────────────────────────────────
    # PUBLIC API
    # ─────────────────────────────────────────────────
    def get_series(self, key):
        """Get a single series by its full key (theme.CODE)."""
        s = self.series.get(key)
        if not s:
            return {'years': [], 'values': [], 'name': key}
        return {'years': s['years'], 'values': s['values'], 'name': s['name']}

    def get_all_series_keys(self):
        """Return all series keys."""
        return list(self.series.keys())

    def get_series_by_theme(self, theme):
        """Return all series keys for a given theme."""
        return self.themes.get(theme, [])

    def get_series_count(self):
        """Return total number of loaded series."""
        return len(self.series)


# ─────────────────────────────────────────────────────
# INDICATOR METADATA
# Human-readable names, units, descriptions for each series
# ─────────────────────────────────────────────────────
ANSTAT_SOURCE = {
    'source': 'ANStat / FMI (PNRD)',
    'source_link': 'https://nso-cotedivoire.opendataforafrica.org/awirqrf',
    'methodology': 'Données extraites de la Page Nationale Récapitulative des Données (PNRD) de l\'ANStat, conformes aux normes SDMX du FMI. Couvrent les finances publiques, la balance des paiements, la monnaie, les prix, le commerce, la dette, la démographie et l\'emploi.',
}

# Full metadata for curated indicators
# Format: 'theme.CODE': {'name': ..., 'unit': ..., 'description': ...}
ANSTAT_INDICATOR_META = {
    # ═══ RESERVES ═══
    'reserves.MAU_RAFA_XDC': {
        'name': 'Avoirs officiels de réserve (BCEAO)',
        'unit': 'Mds FCFA',
        'description': 'Total des avoirs officiels de réserve détenus par la BCEAO pour la Côte d\'Ivoire',
    },
    'reserves.MAU_RAFAFX_XDC': {
        'name': 'Réserves en devises convertibles',
        'unit': 'Mds FCFA',
        'description': 'Avoirs de réserve en devises étrangères convertibles',
    },
    'reserves.MAU_RAFAGOLD_XDC': {
        'name': 'Or monétaire (réserves)',
        'unit': 'Mds FCFA',
        'description': 'Valeur de l\'or monétaire dans les réserves officielles (y.c. dépôts et swaps)',
    },
    'reserves.MAU_RAFASDR_XDC': {
        'name': 'DTS (Droits de tirage spéciaux)',
        'unit': 'Mds FCFA',
        'description': 'Droits de tirage spéciaux alloués par le FMI',
    },
    'reserves.MAU_RAFAIMF_XDC': {
        'name': 'Position tranche de réserve au FMI',
        'unit': 'Mds FCFA',
        'description': 'Position dans la tranche de réserve du FMI',
    },

    # ═══ BALANCE DES PAIEMENTS ═══
    'balance_paiements.BCA_BP6_XDC': {
        'name': 'Compte courant (Balance des paiements)',
        'unit': 'Millions FCFA',
        'description': 'Solde du compte courant de la balance des paiements (biens, services, revenus, transferts)',
    },
    'balance_paiements.BG_BP6_XDC': {
        'name': 'Balance commerciale (biens)',
        'unit': 'Millions FCFA',
        'description': 'Solde des échanges de biens (exportations - importations)',
    },
    'balance_paiements.BXG_BP6_XDC': {
        'name': 'Exportations de biens (BdP)',
        'unit': 'Millions FCFA',
        'description': 'Exportations de biens enregistrées dans la balance des paiements',
    },
    'balance_paiements.BMG_BP6_XDC': {
        'name': 'Importations de biens (BdP)',
        'unit': 'Millions FCFA',
        'description': 'Importations de biens enregistrées dans la balance des paiements',
    },
    'balance_paiements.BS_BP6_XDC': {
        'name': 'Balance des services',
        'unit': 'Millions FCFA',
        'description': 'Solde des échanges de services (transports, tourisme, services financiers, etc.)',
    },
    'balance_paiements.BIP_BP6_XDC': {
        'name': 'Revenu primaire net',
        'unit': 'Millions FCFA',
        'description': 'Revenus primaires nets (rémunérations, revenus d\'investissements)',
    },
    'balance_paiements.BIS_BP6_XDC': {
        'name': 'Revenu secondaire net (transferts)',
        'unit': 'Millions FCFA',
        'description': 'Transferts courants nets (envois de fonds, aide, etc.)',
    },
    'balance_paiements.BK_BP6_XDC': {
        'name': 'Compte de capital',
        'unit': 'Millions FCFA',
        'description': 'Solde du compte de capital (transferts en capital, acquisitions d\'actifs non financiers)',
    },
    'balance_paiements.BF_BP6_XDC': {
        'name': 'Compte financier',
        'unit': 'Millions FCFA',
        'description': 'Solde du compte financier (IDE, investissements de portefeuille, autres investissements)',
    },
    'balance_paiements.BFDA_BP6_XDC': {
        'name': 'IDE nets (Balance des paiements)',
        'unit': 'Millions FCFA',
        'description': 'Investissements directs étrangers nets enregistrés dans la balance des paiements',
    },
    'balance_paiements.BFDL_BP6_XDC': {
        'name': 'IDE reçus (passif)',
        'unit': 'Millions FCFA',
        'description': 'Flux d\'investissements directs étrangers reçus par la Côte d\'Ivoire',
    },

    # ═══ COMMERCE DES MARCHANDISES ═══
    'commerce.TXG_FOB_XDC': {
        'name': 'Exportations de marchandises FOB (ANStat)',
        'unit': 'Millions FCFA',
        'description': 'Valeur totale des exportations de marchandises en valeur FOB',
    },
    'commerce.TMG_CIF_XDC': {
        'name': 'Importations de marchandises CIF (ANStat)',
        'unit': 'Millions FCFA',
        'description': 'Valeur totale des importations de marchandises en valeur CIF',
    },

    # ═══ DETTE ADMINISTRATION CENTRALE ═══
    'dette_admin.GCALOM_G01_AC_XDC': {
        'name': 'Dette brute de l\'administration centrale (hors actions)',
        'unit': 'Mds FCFA',
        'description': 'Encours total de la dette brute de l\'administration centrale, hors actions et parts de fonds',
    },
    'dette_admin.GCALND_G01_XDC': {
        'name': 'Dette intérieure (admin. centrale)',
        'unit': 'Mds FCFA',
        'description': 'Encours de la dette intérieure de l\'administration centrale',
    },
    'dette_admin.GCALNF_G01_XDC': {
        'name': 'Dette extérieure (admin. centrale)',
        'unit': 'Mds FCFA',
        'description': 'Encours de la dette extérieure de l\'administration centrale',
    },
    'dette_admin.GCAL_G01_L_NV_XDC': {
        'name': 'Dette long terme (admin. centrale)',
        'unit': 'Mds FCFA',
        'description': 'Encours de la dette à long terme de l\'administration centrale',
    },
    'dette_admin.GCAL_G01_S_NV_XDC': {
        'name': 'Dette court terme (admin. centrale)',
        'unit': 'Mds FCFA',
        'description': 'Encours de la dette à court terme de l\'administration centrale',
    },

    # ═══ DETTE EXTÉRIEURE ═══
    'dette_ext.D_BP6_XDC': {
        'name': 'Encours total de la dette extérieure brute',
        'unit': 'Millions FCFA',
        'description': 'Position de la dette extérieure brute totale de la Côte d\'Ivoire',
    },
    'dette_ext.DG_BP6_XDC': {
        'name': 'Dette extérieure - Administration publique',
        'unit': 'Millions FCFA',
        'description': 'Encours de la dette extérieure de l\'administration publique',
    },
    'dette_ext.DCB_BP6_XDC': {
        'name': 'Dette extérieure - Banque centrale',
        'unit': 'Millions FCFA',
        'description': 'Encours de la dette extérieure de la banque centrale',
    },
    'dette_ext.DODC_BP6_XDC': {
        'name': 'Dette extérieure - Institutions de dépôt',
        'unit': 'Millions FCFA',
        'description': 'Encours de la dette extérieure des sociétés de dépôt (hors banque centrale)',
    },
    'dette_ext.DODS_BP6_XDC': {
        'name': 'Dette extérieure - Autres secteurs',
        'unit': 'Millions FCFA',
        'description': 'Encours de la dette extérieure des autres secteurs (entreprises, ménages)',
    },
    'dette_ext.DUUGIL_BP6_XDC': {
        'name': 'Dette extérieure - Prêts interentreprises (IDE)',
        'unit': 'Millions FCFA',
        'description': 'Prêts interentreprises dans le cadre des investissements directs étrangers',
    },

    # ═══ INDICATEURS SOCIAUX DÉMOGRAPHIQUES ═══
    'social.I2': {
        'name': 'Taux net de scolarisation au Secondaire',
        'unit': '%',
        'description': 'Pourcentage des enfants en âge d\'aller au secondaire effectivement scolarisés',
    },
    'social.I3': {
        'name': 'Taux brut de scolarisation au Primaire',
        'unit': '%',
        'description': 'Ratio inscriptions au primaire / population en âge de scolarisation primaire',
    },
    'social.I4': {
        'name': 'Taux d\'achèvement au Primaire',
        'unit': '%',
        'description': 'Taux d\'achèvement ou de diplomation au cycle primaire',
    },
    'social.I5': {
        'name': 'Taux d\'achèvement au Secondaire',
        'unit': '%',
        'description': 'Taux d\'achèvement ou de diplomation au cycle secondaire',
    },
    'social.I7': {
        'name': 'Taux de croissance démographique',
        'unit': '%',
        'description': 'Taux de croissance annuel de la population',
    },
    'social.I9': {
        'name': 'Espérance de vie à la naissance (ANStat)',
        'unit': 'Années',
        'description': 'Nombre moyen d\'années de vie attendu à la naissance (totale)',
    },
    'social.I10': {
        'name': 'Taux d\'accroissement naturel',
        'unit': '%',
        'description': 'Différence entre le taux de natalité et le taux de mortalité',
    },
    'social.I12': {
        'name': 'Indice synthétique de fécondité',
        'unit': 'Enfants/femme',
        'description': 'Nombre moyen d\'enfants par femme en âge de procréer',
    },
    'social.I14': {
        'name': 'Taux brut de natalité',
        'unit': 'pour 1000',
        'description': 'Nombre de naissances pour 1000 habitants',
    },
    'social.I15': {
        'name': 'Taux brut de mortalité',
        'unit': 'pour 1000',
        'description': 'Nombre de décès pour 1000 habitants',
    },
    'social.I16': {
        'name': 'Taux de mortalité infantile',
        'unit': 'pour 1000',
        'description': 'Nombre de décès d\'enfants de moins d\'un an pour 1000 naissances vivantes',
    },

    # ═══ INDICE DE PRODUCTION ═══
    'production.AIP_IX': {
        'name': 'Indice de la production industrielle (total)',
        'unit': 'Indice',
        'description': 'Indice de la production industrielle totale, tous secteurs confondus',
    },
    'production.AIP_ISIC4_C10_IX': {
        'name': 'IPI - Produits alimentaires',
        'unit': 'Indice',
        'description': 'Indice de production industrielle du secteur fabrication de produits alimentaires',
    },
    'production.AIP_ISIC4_B07_IX': {
        'name': 'IPI - Extraction de minerais métalliques',
        'unit': 'Indice',
        'description': 'Indice de production du secteur extraction de minerais métalliques',
    },
    'production.AIP_ISIC4_C19_IX': {
        'name': 'IPI - Raffinage pétrolier',
        'unit': 'Indice',
        'description': 'Indice de production industrielle du secteur raffinage pétrolier et cokéfaction',
    },

    # ═══ INDICE DES PRIX À LA CONSOMMATION ═══
    'ipc.PCPI_IX': {
        'name': 'Indice des prix à la consommation (IPC)',
        'unit': 'Indice',
        'description': 'Indice général des prix à la consommation, mesure principale de l\'inflation en Côte d\'Ivoire',
    },
    'ipc.PCPI_CP_01_IX': {
        'name': 'IPC - Alimentation et boissons non alcoolisées',
        'unit': 'Indice',
        'description': 'Indice des prix à la consommation pour les produits alimentaires et boissons non alcoolisées',
    },
    'ipc.PCPI_CP_07_IX': {
        'name': 'IPC - Transports',
        'unit': 'Indice',
        'description': 'Indice des prix à la consommation pour le secteur des transports',
    },

    # ═══ INDICE DES PRIX À LA PRODUCTION ═══
    'ipp.PPPI_IX': {
        'name': 'Indice des prix à la production industrielle (total)',
        'unit': 'Indice',
        'description': 'Indice général des prix à la production pour le secteur industriel',
    },

    # ═══ MARCHÉ DU TRAVAIL ═══
    'emploi.LENE_VS_PE_NUM': {
        'name': 'Immatriculations CNPS (nouveaux emplois privés)',
        'unit': 'Personnes',
        'description': 'Nouvelles immatriculations à la CNPS, indicateur de création d\'emplois dans le secteur privé formel',
    },
    'emploi.LENE_PS_PE_NUM': {
        'name': 'Immatriculations CGREAE (emplois publics)',
        'unit': 'Personnes',
        'description': 'Nouvelles immatriculations à la CGREAE, indicateur de création d\'emplois dans le secteur public',
    },

    # ═══ TOFE SDMX (Opérations admin. centrale) ═══
    'tofe_sdmx.CIV_CGO_R_XDC': {
        'name': 'Recettes totales (TOFE SDMX)',
        'unit': 'Mds FCFA',
        'description': 'Total des recettes de l\'administration centrale selon le format SDMX/FMI',
    },
    'tofe_sdmx.CIV_CGO_RD_XDC': {
        'name': 'Recettes et dons (TOFE SDMX)',
        'unit': 'Mds FCFA',
        'description': 'Recettes totales et dons de l\'administration centrale',
    },
    'tofe_sdmx.CIV_CGO_RF_XDC': {
        'name': 'Recettes fiscales (TOFE SDMX)',
        'unit': 'Mds FCFA',
        'description': 'Recettes fiscales totales (DGI + DGD) selon le format SDMX/FMI',
    },
    'tofe_sdmx.CIV_CGO_RFI_XDC': {
        'name': 'Recettes DGI (impôts intérieurs)',
        'unit': 'Mds FCFA',
        'description': 'Recettes collectées par la Direction Générale des Impôts',
    },
    'tofe_sdmx.CIV_CGO_RFC_XDC': {
        'name': 'Recettes DGD (douanes)',
        'unit': 'Mds FCFA',
        'description': 'Recettes collectées par la Direction Générale des Douanes',
    },
    'tofe_sdmx.CIV_CGO_RFIBTVA_XDC': {
        'name': 'Recettes TVA (DGI)',
        'unit': 'Mds FCFA',
        'description': 'Recettes de la Taxe sur la Valeur Ajoutée collectées par la DGI',
    },
    'tofe_sdmx.CIV_CGO_DL_XDC': {
        'name': 'Dépenses totales et prêts nets (TOFE SDMX)',
        'unit': 'Mds FCFA',
        'description': 'Dépenses totales et prêts nets de l\'administration centrale',
    },
    'tofe_sdmx.CIV_CGO_SB_XDC': {
        'name': 'Solde budgétaire (TOFE SDMX)',
        'unit': 'Mds FCFA',
        'description': 'Solde budgétaire global base ordonnancement',
    },
    'tofe_sdmx.CIV_CGO_SB_GDP': {
        'name': 'Solde budgétaire (% du PIB, TOFE SDMX)',
        'unit': '% du PIB',
        'description': 'Solde budgétaire global en pourcentage du PIB',
    },
    'tofe_sdmx.CIV_CGO_DCP_XDC': {
        'name': 'Dépenses de personnel (TOFE SDMX)',
        'unit': 'Mds FCFA',
        'description': 'Masse salariale de la fonction publique',
    },
    'tofe_sdmx.CIV_CGO_DI_XDC': {
        'name': 'Dépenses d\'investissement (TOFE SDMX)',
        'unit': 'Mds FCFA',
        'description': 'Dépenses d\'investissement de l\'administration centrale',
    },
    'tofe_sdmx.CIV_CGO_IDP_XDC': {
        'name': 'Intérêts de la dette publique (TOFE SDMX)',
        'unit': 'Mds FCFA',
        'description': 'Charge d\'intérêts sur la dette publique (intérieure + extérieure)',
    },
    'tofe_sdmx.CIV_CGO_F_XDC': {
        'name': 'Financement net (TOFE SDMX)',
        'unit': 'Mds FCFA',
        'description': 'Financement net du déficit budgétaire',
    },
    'tofe_sdmx.CIV_CGO_FI_XDC': {
        'name': 'Financement intérieur (TOFE SDMX)',
        'unit': 'Mds FCFA',
        'description': 'Financement intérieur du déficit (système bancaire + non bancaire)',
    },
    'tofe_sdmx.CIV_CGO_FE_XDC': {
        'name': 'Financement extérieur (TOFE SDMX)',
        'unit': 'Mds FCFA',
        'description': 'Financement extérieur (tirages projets, autres tirages, amortissements)',
    },
    'tofe_sdmx.CIV_CGO_SPB_XDC': {
        'name': 'Solde primaire de base',
        'unit': 'Mds FCFA',
        'description': 'Solde budgétaire hors intérêts de la dette et hors dépenses financées sur ressources extérieures',
    },
    'tofe_sdmx.CIV_CGO_G_XDC': {
        'name': 'Dons reçus (TOFE SDMX)',
        'unit': 'Mds FCFA',
        'description': 'Dons reçus des partenaires internationaux',
    },
    'tofe_sdmx.CIV_CGO_RNF_XDC': {
        'name': 'Recettes non fiscales (TOFE SDMX)',
        'unit': 'Mds FCFA',
        'description': 'Recettes non fiscales de l\'État',
    },

    # ═══ OPÉRATIONS DES ADMINISTRATIONS PUBLIQUES ═══
    'admin_publiques.GR_G14_GG_XDC': {
        'name': 'Recettes des administrations publiques (GFS)',
        'unit': 'Mds FCFA',
        'description': 'Total des recettes des administrations publiques selon la norme GFS du FMI',
    },
    'admin_publiques.GE_G14_GG_XDC': {
        'name': 'Charges des administrations publiques (GFS)',
        'unit': 'Mds FCFA',
        'description': 'Total des charges des administrations publiques selon la norme GFS',
    },
    'admin_publiques.GXCNL_G14_GG_XDC': {
        'name': 'Capacité/besoin de financement (admin. publiques)',
        'unit': 'Mds FCFA',
        'description': 'Capacité (+) ou besoin (−) de financement des administrations publiques',
    },
    'admin_publiques.GX_G14_GG_XDC': {
        'name': 'Dépenses totales des admin. publiques',
        'unit': 'Mds FCFA',
        'description': 'Total des dépenses (charges + acquisitions d\'actifs non financiers)',
    },

    # ═══ POPULATION ═══
    'population.P1': {
        'name': 'Population masculine (ANStat)',
        'unit': 'Habitants',
        'description': 'Population masculine de la Côte d\'Ivoire',
    },
    'population.P2': {
        'name': 'Population féminine (ANStat)',
        'unit': 'Habitants',
        'description': 'Population féminine de la Côte d\'Ivoire',
    },
    'population.P3': {
        'name': 'Population totale (ANStat)',
        'unit': 'Habitants',
        'description': 'Population totale de la Côte d\'Ivoire selon l\'ANStat',
    },

    # ═══ POSITION EXTÉRIEURE GLOBALE ═══
    'position_ext.I_BP6_XDC': {
        'name': 'Position extérieure globale nette',
        'unit': 'Millions FCFA',
        'description': 'Différence entre les actifs et passifs extérieurs de la Côte d\'Ivoire',
    },
    'position_ext.IA_BP6_XDC': {
        'name': 'Actifs extérieurs totaux',
        'unit': 'Millions FCFA',
        'description': 'Total des actifs détenus par les résidents sur les non-résidents',
    },
    'position_ext.IL_BP6_XDC': {
        'name': 'Passifs extérieurs totaux',
        'unit': 'Millions FCFA',
        'description': 'Total des passifs des résidents envers les non-résidents',
    },

    # ═══ BANQUE CENTRALE ═══
    'banque_centrale.FASF_XDC': {
        'name': 'Actifs extérieurs nets (Banque centrale)',
        'unit': 'Mds FCFA',
        'description': 'Actifs extérieurs nets de la BCEAO (créances - engagements envers non-résidents)',
    },
    'banque_centrale.FASG_XDC': {
        'name': 'Créances nettes sur l\'État (Banque centrale)',
        'unit': 'Mds FCFA',
        'description': 'Créances nettes de la BCEAO sur l\'administration centrale',
    },
    'banque_centrale.FASMB_XDC': {
        'name': 'Base monétaire',
        'unit': 'Mds FCFA',
        'description': 'Base monétaire (billets et pièces + réserves bancaires à la BCEAO)',
    },

    # ═══ INSTITUTIONS DE DÉPÔT ═══
    'institutions_depot.FDSF_XDC': {
        'name': 'Actifs extérieurs nets (Institutions de dépôt)',
        'unit': 'Mds FCFA',
        'description': 'Actifs extérieurs nets des institutions de dépôt (banques commerciales + BCEAO)',
    },
    'institutions_depot.FDSAD_XDC': {
        'name': 'Créances intérieures',
        'unit': 'Mds FCFA',
        'description': 'Total des créances intérieures des institutions de dépôt',
    },
    'institutions_depot.FDSDG_XDC': {
        'name': 'Créances nettes sur l\'État (système bancaire)',
        'unit': 'Mds FCFA',
        'description': 'Créances nettes du système bancaire sur l\'administration centrale',
    },
    'institutions_depot.FDSAO_XDC': {
        'name': 'Créances sur les autres secteurs (crédit à l\'économie)',
        'unit': 'Mds FCFA',
        'description': 'Crédits accordés par les banques aux entreprises et ménages',
    },
    'institutions_depot.FDSB_XDC': {
        'name': 'Masse monétaire (M2)',
        'unit': 'Mds FCFA',
        'description': 'Passifs monétaires au sens large (monnaie fiduciaire + dépôts)',
    },

    # ═══ TAUX DE CHANGE ═══
    'taux_change.ENDA_XDC_USD_RATE': {
        'name': 'Taux de change XOF/USD (moyenne)',
        'unit': 'FCFA par USD',
        'description': 'Taux de change moyen de la période, FCFA par dollar américain',
    },
    'taux_change.ENDE_XDC_USD_RATE': {
        'name': 'Taux de change XOF/USD (fin de période)',
        'unit': 'FCFA par USD',
        'description': 'Taux de change en fin de période, FCFA par dollar américain',
    },

    # ═══ TAUX D'INTÉRÊT ═══
    'taux_interet.FILR_PA': {
        'name': 'Taux débiteur bancaire (crédit)',
        'unit': '%',
        'description': 'Taux d\'intérêt débiteur moyen pratiqué par les banques sur les crédits aux clients',
    },
    'taux_interet.FIDR_PA': {
        'name': 'Taux créditeur bancaire (dépôt)',
        'unit': '%',
        'description': 'Taux d\'intérêt moyen rémunérant les dépôts bancaires des clients',
    },
    'taux_interet.FII_1W_PA': {
        'name': 'Taux interbancaire à une semaine',
        'unit': '%',
        'description': 'Taux moyen pondéré du marché interbancaire à une semaine',
    },
    'taux_interet.FIMM_PA': {
        'name': 'Taux du marché monétaire',
        'unit': '%',
        'description': 'Taux moyen pondéré du marché monétaire',
    },
    'taux_interet.FPOLM_MIN_PA': {
        'name': 'Taux directeur BCEAO (minimum de soumission)',
        'unit': '%',
        'description': 'Taux minimum de soumission aux appels d\'offres de la BCEAO (taux directeur principal)',
    },
    'taux_interet.FPOLM_MAR_PA': {
        'name': 'Taux du guichet de prêt marginal (BCEAO)',
        'unit': '%',
        'description': 'Taux du guichet de prêt marginal de la BCEAO',
    },
}


# Singleton
anstat_sdmx_service = AnstatSdmxService()
