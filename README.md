# Ask For Data - Côte d'Ivoire 🇨🇮

Plateforme web intelligente qui vulgarise l'accès aux statistiques ivoiriennes en utilisant l'IA pour interpréter les questions en langage naturel.

## 🎯 Fonctionnalités

### ✅ Fonctionnalités complétées

- **Recherche en langage naturel** : Posez des questions comme "Quel est le taux d'accès à l'électricité de 2015 à 2023 ?"
- **Interprétation IA (Gemini)** : Analyse intelligente des requêtes pour identifier les indicateurs pertinents
- **Réponse structurée** :
  - Texte clair et neutre (2-4 phrases)
  - Tableau des données (Année | Valeur | Unité)
  - Graphique adapté (ligne ou barres)
  - Source avec lien (quand disponible)
- **Catalogue des indicateurs** : Liste filtrable de 1521 indicateurs avec recherche
- **Gestion des cas impossibles** : Répond "Je ne sais pas." sans inventer de données

### 📊 Données disponibles

- **Source** : Fichier Excel (Banque mondiale)
- **Pays** : Côte d'Ivoire
- **Indicateurs** : 1521 indicateurs économiques, sociaux, environnementaux
- **Période** : 2000-2024 (certaines valeurs peuvent être manquantes)
- **Feuilles** :
  - `Data` : Valeurs par année
  - `Series - Metadata` : Définitions, unités, sources

## 🚀 Démarrage rapide

### Prérequis

- Python 3.8+
- pip
- PM2 (pour la gestion du service)

### Installation

```bash
# Cloner le projet
cd /home/user/webapp

# Installer les dépendances
pip install django djangorestframework google-generativeai openpyxl pandas

# Le fichier Excel doit être présent : data.xlsx
```

### Configuration

Le fichier Excel par défaut est `data.xlsx` à la racine du projet. Pour utiliser un autre fichier, modifiez le chemin dans `api/data_service.py`.

La clé API Gemini est configurée dans `askfordata/settings.py` :

```python
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', 'votre-clé-par-défaut')
```

### Lancement

**Option 1 : Avec PM2 (recommandé pour production)**

```bash
# Nettoyer le port
fuser -k 3000/tcp 2>/dev/null || true

# Démarrer avec PM2
pm2 start ecosystem.config.cjs

# Vérifier le statut
pm2 list

# Voir les logs
pm2 logs askfordata --nostream
```

**Option 2 : Mode développement simple**

```bash
python manage.py runserver 0.0.0.0:3000
```

L'application sera accessible à : **http://localhost:3000**

## 📡 Endpoints REST API

### 1. Requête utilisateur

```bash
POST /api/query
Content-Type: application/json

{
  "query": "Accès à l'électricité 2015-2024"
}
```

**Réponse :**

```json
{
  "success": true,
  "message": "Pour l'indicateur « Accès à l'électricité... »",
  "indicator_code": "EG.ELC.ACCS.ZS",
  "indicator_name": "Accès à l'électricité (% de la population)",
  "data": [
    {"year": 2015, "value": 62.6},
    {"year": 2016, "value": 64.3},
    ...
  ],
  "unit": "% (share) of population",
  "source": "SDG 7.1.1 Electrification Dataset, World Bank...",
  "source_link": "https://data.worldbank.org/indicator/EG.ELC.ACCS.ZS",
  "chart_type": "line"
}
```

### 2. Liste des indicateurs

```bash
GET /api/indicators?search=population
```

**Réponse :**

```json
{
  "success": true,
  "count": 248,
  "indicators": [
    {
      "code": "SP.POP.TOTL",
      "name": "Population, total",
      "unit": "Number of people",
      "source": "World Bank",
      "definition": "..."
    }
  ]
}
```

### 3. Détail d'un indicateur

```bash
GET /api/indicator/EG.ELC.ACCS.ZS
```

**Réponse :**

```json
{
  "success": true,
  "indicator": {
    "code": "EG.ELC.ACCS.ZS",
    "name": "Accès à l'électricité...",
    "unit": "% (share) of population",
    "source": "...",
    "source_link": "https://data.worldbank.org/indicator/...",
    "definition": "...",
    "values": [...]
  }
}
```

### 4. Health check

```bash
GET /api/health
```

## 📋 Exemples testés

### ✅ Exemple 1 : Accès à l'électricité

**Question** : "Accès à l'électricité 2015-2024"

**Résultat** :
- ✅ Texte neutre : "Pour l'indicateur « Accès à l'électricité (% de la population) » en Côte d'Ivoire de 2015 à 2023..."
- ✅ Tableau : 9 années avec valeurs (2015: 62.6% → 2023: 72.4%)
- ✅ Graphique : Courbe ligne montrant la progression
- ✅ Source : "SDG 7.1.1 Electrification Dataset, World Bank"
- ✅ Lien : https://data.worldbank.org/indicator/EG.ELC.ACCS.ZS

### ✅ Exemple 2 : Taux d'inflation

**Question** : "Taux d'inflation 2018-2023"

**Résultat** :
- ✅ Indicateur identifié : "Inflation, prix à la consommation (croissance annuelle en %)"
- ✅ Données : 6 années (2018-2023)
- ✅ Graphique : Courbe ligne avec variations
- ✅ Source : "International Financial Statistics database, IMF"

### ✅ Exemple 3 : Requête impossible

**Question** : "Population de chats en Côte d'Ivoire"

**Résultat** :
- ✅ Message : "Je ne sais pas. Aucun indicateur ne correspond à cette recherche."
- ✅ Aucune donnée inventée

## 🛡️ Règles non négociables (respectées)

- ✅ **Aucune invention** : Pas de valeurs, années ou sources non présentes dans l'Excel
- ✅ **Données insuffisantes** : Affiche "Je ne sais pas." proprement
- ✅ **Unité et période** : Toujours affichées
- ✅ **Citation de la source** : Nom + lien si disponible
- ✅ **Calculs** : Effectués seulement si toutes les valeurs nécessaires existent

## 🏗️ Architecture technique

### Backend

- **Framework** : Django 5.2 + Django REST Framework
- **Données** : Lecture Excel en mémoire avec pandas + cache singleton
- **IA** : Google Gemini API (gemini-2.5-flash)
- **API REST** : 4 endpoints (query, indicators, indicator/<code>, health)

### Frontend

- **Interface** : HTML/CSS/JavaScript
- **Style** : Tailwind CSS (CDN)
- **Graphiques** : Chart.js
- **Design** : Responsive, moderne, dégradé orange-vert (couleurs ivoiriennes)

### Structure du projet

```
webapp/
├── api/                          # Application Django
│   ├── data_service.py           # Service de gestion des données Excel
│   ├── gemini_service.py         # Intégration API Gemini
│   ├── views.py                  # Endpoints REST
│   ├── urls.py                   # Routes API
│   └── templates/
│       └── index.html            # Interface utilisateur
├── askfordata/                   # Configuration Django
│   ├── settings.py               # Configuration (apps, Gemini)
│   └── urls.py                   # Routes principales
├── data.xlsx                     # Fichier de données
├── ecosystem.config.cjs          # Configuration PM2
├── manage.py                     # CLI Django
└── README.md                     # Documentation
```

## 📊 Statistiques

- **Indicateurs disponibles** : 1521
- **Période couverte** : 2000-2024
- **Taux de réponse** : ~100% pour les indicateurs existants
- **Performance** : ~1-6 secondes par requête (incluant l'appel Gemini)

## 🎨 Interface utilisateur

L'interface comprend :

1. **Zone de recherche** : Champ texte multiligne avec bouton
2. **Exemples cliquables** : 3 suggestions de questions
3. **Catalogue modal** : Liste filtrable de tous les indicateurs
4. **Résultats** : Cartes structurées (message, tableau, graphique, source)
5. **États** : Loading spinner, messages d'erreur élégants

## 🔧 Gestion du service

```bash
# Démarrer
pm2 start ecosystem.config.cjs

# Arrêter
pm2 stop askfordata

# Redémarrer
pm2 restart askfordata

# Supprimer
pm2 delete askfordata

# Logs
pm2 logs askfordata --nostream

# Logs en temps réel
pm2 logs askfordata
```

## 🌐 URL publique

- **URL de démonstration** : https://3000-i50k8flr6z39jjpvb47ui-cc2fbc16.sandbox.novita.ai

## 🚧 Prochaines étapes possibles

- [ ] Ajouter le support des calculs avancés (moyenne mobile, tendances)
- [ ] Exporter les résultats en CSV/PDF
- [ ] Comparer plusieurs indicateurs sur un même graphique
- [ ] Historique des recherches
- [ ] Mode sombre
- [ ] Support multilingue (anglais)
- [ ] Cache des réponses Gemini pour réduire les coûts API

## 📝 Notes techniques

### Génération du lien source

Si la source contient "World Bank" ou "Banque mondiale" et qu'aucun lien n'est fourni dans les métadonnées, le système génère automatiquement le lien :

```
https://data.worldbank.org/indicator/{SeriesCode}
```

### Gestion des erreurs Gemini

Si l'API Gemini échoue ou renvoie une réponse invalide, le système retourne :

```json
{
  "success": false,
  "message": "Je ne sais pas. Une erreur s'est produite...",
  "data": [],
  "chart_type": "none"
}
```

## 👨‍💻 Développement

Pour modifier le comportement de l'interprétation des requêtes, éditer le prompt dans `api/gemini_service.py`, méthode `interpret_query()`.

Pour ajouter un nouvel endpoint, créer une fonction dans `api/views.py` et l'ajouter dans `api/urls.py`.

## 📄 Licence

Ce projet utilise des données de la Banque mondiale sous licence Creative Commons Attribution 4.0 (CC BY 4.0).

## ✨ Crédits

- **Données** : Banque mondiale
- **IA** : Google Gemini API
- **Frontend** : Tailwind CSS, Chart.js, Font Awesome
- **Backend** : Django, Django REST Framework

---

**Dernière mise à jour** : 2025-11-14
**Status** : ✅ MVP complet et fonctionnel
