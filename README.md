# Ask For Data - Cote d'Ivoire

Plateforme web intelligente qui vulgarise l'acces aux statistiques ivoiriennes grace a l'IA (Google Gemini).

## Fonctionnalites

- **Recherche en langage naturel** — posez des questions comme *"Quel est le PIB de 2015 a 2024 ?"*
- **Dashboard interactif** — 12 sections thematiques (macro, demo, education, sante, emploi, international...) alimentees par les donnees reelles de la Banque mondiale
- **Catalogue de 1 521 indicateurs** — filtrable, avec detail par code
- **Chat IA** — interpretation des requetes via Gemini, reponse structuree (texte + tableau + graphique + source)
- **Authentification** — inscription/connexion email + Google OAuth, quota de requetes, cle API personnelle

## Stack technique

| Couche | Technologie |
|--------|------------|
| Backend | Django 5.2, Django REST Framework |
| IA | Google Gemini API (`gemini-2.5-flash`) |
| Donnees | Excel (`data.xlsx`) lu en memoire via pandas |
| Frontend | HTML / CSS / JavaScript, ECharts, Leaflet |
| Auth | django-allauth (email + Google) |
| Static | WhiteNoise (compression + cache) |
| Serveur | Gunicorn |

## Structure du projet

```
webapp/
├── api/
│   ├── data_service.py        # Lecture Excel, cache singleton
│   ├── gemini_service.py      # Integration Gemini
│   ├── models.py              # UserProfile, QueryCache
│   ├── views.py               # Vues pages + API REST
│   ├── urls.py                # Routes /api/*
│   ├── authentication.py      # CSRF-exempt session auth
│   ├── static/
│   │   ├── css/               # dashboard-v3.css, home-v2.css, style.css
│   │   ├── js/                # dashboard-v3.js, home-v2.js, chat.js, sectors.js
│   │   └── img/               # logo.png, photos
│   └── templates/             # home_v2, dashboard_v3, chat, about, account/*
├── askfordata/
│   ├── settings.py            # Config Django (env vars)
│   ├── urls.py                # Routes principales
│   └── wsgi.py
├── data.xlsx                  # 1 521 indicateurs Banque mondiale
├── requirements.txt
├── Procfile                   # Deploiement Heroku/Render/Railway
├── ecosystem.config.cjs       # Deploiement PM2
├── start.sh                   # Script de demarrage production
├── .env.example               # Variables d'environnement requises
└── README.md
```

## Installation

```bash
# 1. Cloner et entrer dans le projet
git clone <repo-url> && cd webapp

# 2. Creer un environnement virtuel
python -m venv .venv
source .venv/bin/activate   # Linux/Mac
.venv\Scripts\activate      # Windows

# 3. Installer les dependances
pip install -r requirements.txt

# 4. Configurer les variables d'environnement
cp .env.example .env
# Editer .env avec vos valeurs (SECRET_KEY, GEMINI_API_KEY, etc.)

# 5. Migrations
python manage.py migrate

# 6. Collecter les fichiers statiques
python manage.py collectstatic --noinput
```

## Lancement

### Developpement

```bash
DJANGO_DEBUG=True python manage.py runserver 8000
```

### Production

```bash
# Option 1 : Script direct
bash start.sh

# Option 2 : PM2
pm2 start ecosystem.config.cjs

# Option 3 : Procfile (Heroku/Render)
# Automatique via le Procfile
```

## Variables d'environnement

| Variable | Requis | Description |
|----------|--------|-------------|
| `DJANGO_SECRET_KEY` | Oui | Cle secrete Django (50+ caracteres aleatoires) |
| `DJANGO_DEBUG` | Non | `True` pour dev, `False` par defaut |
| `DJANGO_ALLOWED_HOSTS` | Oui | Domaines autorises, separes par virgule |
| `GEMINI_API_KEY` | Oui | Cle API Google Gemini |
| `FERNET_KEY` | Oui | Cle de chiffrement pour les cles API utilisateurs |
| `GOOGLE_CLIENT_ID` | Non | OAuth Google (optionnel) |
| `GOOGLE_CLIENT_SECRET` | Non | OAuth Google (optionnel) |

## API REST

| Methode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/query` | Requete en langage naturel |
| `GET` | `/api/indicators` | Liste des indicateurs (`?search=...`) |
| `GET` | `/api/indicator/<code>` | Detail d'un indicateur |
| `GET` | `/api/dashboard-data` | Donnees KPI + series pour les dashboards |
| `GET` | `/api/suggest?q=...` | Autocompletion |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/user-status` | Statut utilisateur (quota, cle) |
| `POST` | `/api/save-api-key` | Sauvegarder sa cle Gemini |
| `POST` | `/api/delete-api-key` | Supprimer sa cle Gemini |

## Pages

| URL | Description |
|-----|-------------|
| `/` | Page d'accueil avec recherche |
| `/dashboard/` | Dashboard interactif (12 sections) |
| `/chat/` | Interface chat IA (auth requise) |
| `/sectors/` | Explorateur de secteurs |
| `/about/` | A propos |
| `/setup-api-key/` | Configuration cle API personnelle |
| `/accounts/login/` | Connexion |
| `/accounts/signup/` | Inscription |

## Donnees

- **Source** : Banque mondiale (World Development Indicators)
- **Fichier** : `data.xlsx` (feuilles `Data` + `Series - Metadata`)
- **Indicateurs** : 1 521
- **Periode** : 2000-2024

## Licence

Donnees sous licence Creative Commons Attribution 4.0 (CC BY 4.0) — Banque mondiale.
