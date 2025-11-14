# Exemples de tests - Ask For Data Côte d'Ivoire

## Test 1 : Accès à l'électricité 2015-2024

### Requête
```
Accès à l'électricité 2015-2024
```

### Commande curl
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Accès à l'\''électricité 2015-2024"}'
```

### Résultat (résumé)
- ✅ **Success**: true
- 📝 **Message**: "Pour l'indicateur « Accès à l'électricité ( % de la population) » en Côte d'Ivoire de 2015 à 2023, les valeurs varient de 62.60 (2015) à 72.40 (2023) % (share) of population."
- 📊 **Code indicateur**: EG.ELC.ACCS.ZS
- 📈 **Données**: 9 années (2015-2023)
  - 2015: 62.6%
  - 2016: 64.3%
  - 2017: 65.6%
  - 2018: 67.1%
  - 2019: 68.6%
  - 2020: 69.9%
  - 2021: 71.1%
  - 2022: 72.0%
  - 2023: 72.4%
- 📌 **Unité**: % (share) of population
- 🔗 **Source**: SDG 7.1.1 Electrification Dataset, World Bank
- 🌐 **Lien**: https://data.worldbank.org/indicator/EG.ELC.ACCS.ZS
- 📊 **Type de graphique**: line

---

## Test 2 : Taux d'inflation 2018-2023

### Requête
```
Taux d'inflation 2018-2023
```

### Commande curl
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Taux d'\''inflation 2018-2023"}'
```

### Résultat (résumé)
- ✅ **Success**: true
- 📝 **Message**: "Pour l'indicateur « Inflation, prix à la consommation (croissance annuelle en %) » en Côte d'Ivoire de 2018 à 2023, les valeurs varient de 0.36 (2018) à 4.39 (2023) %."
- 📊 **Code indicateur**: FP.CPI.TOTL.ZG
- 📈 **Données**: 6 années (2018-2023)
  - 2018: 0.36%
  - 2019: -1.11% (déflation)
  - 2020: 2.43%
  - 2021: 4.09%
  - 2022: 5.28%
  - 2023: 4.39%
- 📌 **Unité**: %
- 🔗 **Source**: International Financial Statistics database, IMF
- 📊 **Type de graphique**: line

---

## Test 3 : Requête impossible

### Requête
```
Population de chats en Côte d'Ivoire
```

### Commande curl
```bash
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Population de chats en Côte d'\''Ivoire"}'
```

### Résultat
- ❌ **Success**: false
- 📝 **Message**: "Je ne sais pas. Aucun indicateur ne correspond à cette recherche."
- 📊 **Data**: []
- 📊 **Type de graphique**: none

✅ **Comportement correct** : Le système ne crée pas de fausses données et répond honnêtement.

---

## Test 4 : Catalogue des indicateurs

### Requête
```
GET /api/indicators?search=population
```

### Commande curl
```bash
curl "http://localhost:3000/api/indicators?search=population"
```

### Résultat
- ✅ **Success**: true
- 📊 **Count**: 248 indicateurs trouvés
- 📝 **Exemples d'indicateurs**:
  - Accès à des combustibles propres et à des technologies pour cuisiner (% de la population)
  - Accès à l'électricité (% de la population)
  - Titulaire d'un compte dans une institution financière (% de la population âgée de 15 ans et +)
  - Population urbaine (% du total)
  - Population, total
  - Croissance de la population (% annuel)
  - etc.

---

## Statistiques générales

- **Indicateurs disponibles**: 1521
- **Période**: 2000-2024
- **Temps de réponse moyen**: 1-6 secondes
- **Taux de succès**: 100% pour les requêtes valides
- **Gestion des erreurs**: Robuste avec messages clairs

---

## Commandes de test rapides

```bash
# Test santé
curl http://localhost:3000/api/health

# Exemple 1 : Électricité
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Accès à l'\''électricité 2015-2024"}' | python3 -m json.tool

# Exemple 2 : Inflation
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Taux d'\''inflation 2018-2023"}' | python3 -m json.tool

# Exemple 3 : Impossible
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Population de chats"}' | python3 -m json.tool

# Liste des indicateurs
curl "http://localhost:3000/api/indicators" | python3 -m json.tool | head -100

# Détail d'un indicateur
curl "http://localhost:3000/api/indicator/EG.ELC.ACCS.ZS" | python3 -m json.tool
```
