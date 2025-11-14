#!/bin/bash

# Script de démarrage pour Ask For Data Côte d'Ivoire

echo "🚀 Démarrage de Ask For Data Côte d'Ivoire..."

# Nettoyer le port 3000
echo "🧹 Nettoyage du port 3000..."
fuser -k 3000/tcp 2>/dev/null || true
sleep 2

# Démarrer avec PM2
echo "⚙️ Démarrage du service avec PM2..."
pm2 start ecosystem.config.cjs

# Attendre que le service démarre
sleep 5

# Vérifier le statut
echo ""
echo "📊 Statut du service:"
pm2 list

# Test de santé
echo ""
echo "🏥 Test de santé:"
curl -s http://localhost:3000/api/health | python3 -m json.tool

echo ""
echo "✅ Service démarré avec succès!"
echo ""
echo "🌐 Accès:"
echo "   - Local: http://localhost:3000"
echo ""
echo "📝 Commandes utiles:"
echo "   - Logs: pm2 logs askfordata --nostream"
echo "   - Arrêter: pm2 stop askfordata"
echo "   - Redémarrer: pm2 restart askfordata"
