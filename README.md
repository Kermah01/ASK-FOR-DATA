# Ask For Data — Côte d'Ivoire

Plateforme web qui démocratise l'accès aux statistiques économiques et sociales de la Côte d'Ivoire. Posez une question en langage naturel — *« Quel est le PIB de 2015 à 2024 ? »* — et l'assistant IA (Claude, d'Anthropic) identifie l'indicateur pertinent, affiche les données sous forme de tableau et de graphique, puis en propose une analyse rédigée en français.

## Fonctionnalités

- **Assistant IA en langage naturel** — interprétation des questions via l'API Claude d'Anthropic : identification de l'indicateur, récupération des données réelles, analyse rédigée (aucun chiffre inventé : le modèle ne commente que les données fournies)
- **Chat IA multi-tours** — conversations persistantes avec contexte, injection automatique des séries de données pertinentes dans la discussion
- **Dashboard interactif** — 12 sections thématiques (macroéconomie, démographie, finances publiques, commerce extérieur, santé, éducation…) alimentées par les données réelles
- **Catalogue de plus de 1 500 indicateurs** — Banque mondiale (WDI) + sources nationales (TOFE, Douanes, DGE, DGF), filtrable avec autocomplétion
- **Robustesse** — cache des réponses avec système de feedback, recherche par mots-clés en secours si l'appel IA échoue, quotas par utilisateur
- **Authentification** — email + Google OAuth (django-allauth), quota de requêtes gratuites, possibilité d'utiliser sa propre clé API Anthropic (chiffrée en base avec Fernet/AES)

## Stack technique

| Couche | Technologie |
|--------|------------|
| Backend | Django 5.2, Django REST Framework |
| IA | API Claude d'Anthropic (SDK `anthropic`, modèle `claude-sonnet-5-5`) |
| Données | Fichiers Excel lus en mémoire via pandas / openpyxl |
| Frontend | HTML / CSS / JavaScript, ECharts, Leaflet |
| Auth | django-allauth (email + Google OAuth) |
| Sécurité | Chiffrement Fernet des clés utilisateurs, clés en variables d'environnement |
| Déploiement | Gunicorn + WhiteNoise, prêt pour Render (`render.yaml`) / Heroku (`Procfile`) / PM2 |

## Architecture de l'assistant IA

L'intégration IA (`api/ai_service.py`) fonctionne en deux phases pour garantir des réponses fiables :

1. **Phase 1 — Identification** : la question est enrichie par un dictionnaire de synonymes métier, puis Claude sélectionne le code de l'indicateur le plus pertinent dans un catalogue pré-filtré (réponse JSON structurée).
2. **Phase 2 — Analyse** : les données réelles de l'indicateur (plus des statistiques pré-calculées : min, max, moyenne, variation) sont fournies à Claude, qui rédige une analyse d'économiste sans jamais inventer de chiffres.

En cas d'indisponibilité de l'API (clé absente, quota), l'application reste pleinement utilisable : messages d'erreur clairs côté interface et repli sur une recherche par mots-clés.

## Installation

```bash
# 1. Cloner le projet
git clone <repo-url> && cd ASK-FOR-DATA

# 2. Créer un environnement virtuel
python -m venv .venv
source .venv/bin/activate   # Linux/Mac
.venv\Scripts\activate      # Windows

# 3. Installer les dépendances
pip install -r requirements.txt

# 4. Configurer les variables d'environnement
cp .env.example .env
# Éditer .env : DJANGO_SECRET_KEY, ANTHROPIC_API_KEY, FERNET_KEY...

# 5. Migrations + fichiers statiques
python manage.py migrate
python manage.py collectstatic --noinput
```

### Obtenir une clé API Anthropic

1. Créer un compte sur [platform.claude.com](https://platform.claude.com/)
2. Ajouter quelques crédits (facturation à l'usage — une question coûte une fraction de centime)
3. **Settings → API Keys → Create Key**, puis copier la clé (`sk-ant-...`) dans `.env` :

```bash
ANTHROPIC_API_KEY=sk-ant-votre-cle
```

Sans clé configurée, le site fonctionne (dashboard, catalogue, données) mais l'assistant IA affiche un message explicite au lieu de répondre.

## Lancement

```bash
# Développement
DJANGO_DEBUG=True python manage.py runserver 8000

# Production
bash start.sh                        # Gunicorn
# ou : pm2 start ecosystem.config.cjs
# ou : déploiement Render automatique via render.yaml
```

## Variables d'environnement

| Variable | Requis | Description |
|----------|--------|-------------|
| `DJANGO_SECRET_KEY` | Oui | Clé secrète Django (50+ caractères aléatoires) |
| `ANTHROPIC_API_KEY` | Oui (pour l'IA) | Clé API Anthropic (Claude) — `sk-ant-...` |
| `CLAUDE_MODEL` | Non | Modèle Claude (défaut : `claude-sonnet-5-5`) |
| `FERNET_KEY` | Oui | Clé de chiffrement des clés API utilisateurs |
| `DJANGO_DEBUG` | Non | `True` en dev, `False` par défaut |
| `DJANGO_ALLOWED_HOSTS` | Oui (prod) | Domaines autorisés, séparés par des virgules |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Non | OAuth Google (optionnel) |
| `FREE_QUERIES_PER_DAY` / `ANONYMOUS_QUERIES_LIMIT` | Non | Quotas de requêtes IA |

Générer une clé Fernet :

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## API REST

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/query` | Question en langage naturel → données + graphique |
| `POST` | `/api/query-analysis` | Analyse IA détaillée (chargée en différé) |
| `POST` | `/api/chat/send` | Message dans une conversation IA |
| `GET` | `/api/indicators` | Catalogue des indicateurs (`?search=...`) |
| `GET` | `/api/indicator/<code>` | Détail d'un indicateur |
| `GET` | `/api/dashboard-data` | KPIs + séries pour les dashboards |
| `GET` | `/api/suggest?q=...` | Autocomplétion |
| `POST` | `/api/feedback` | Feedback sur une réponse IA |
| `GET` | `/api/health` | Health check |
| `POST` | `/api/save-api-key` | Enregistrer sa clé Anthropic personnelle |

## Données

Toutes les données embarquées sont des **statistiques macroéconomiques publiques et agrégées** :

- **`data.xlsx`** — 1 521 indicateurs de la Banque mondiale (World Development Indicators), 2000-2024, licence CC BY 4.0
- **`TOFE.xlsx`** — Tableau des Opérations Financières de l'État (Ministère des Finances et du Budget)
- **`douanes.xlsx`** — Commerce extérieur et recettes douanières (Direction Générale des Douanes)
- **`financements.xlsx`** — Dette publique et financements (Direction Générale des Financements)
- **`Données de la base éco.xlsx`** — Structure de l'économie, agro-industrie (DGE / ANStat)

Aucune donnée personnelle ou confidentielle n'est incluse.

## Licence

Code sous licence MIT. Données Banque mondiale sous licence Creative Commons Attribution 4.0 (CC BY 4.0).
