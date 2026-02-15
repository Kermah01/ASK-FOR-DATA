// Chat Page Logic - Conversational AI Interface

let conversationHistory = [];
let messageCount = 1; // Start at 1 for welcome message

// Set suggested question
function setSuggestion(text) {
    document.getElementById('chat-input').value = text;
    document.getElementById('chat-input').focus();
}

// Clear chat
function clearChat() {
    if (confirm('Êtes-vous sûr de vouloir effacer toute la conversation ?')) {
        conversationHistory = [];
        messageCount = 1;

        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = `
            <div class="message ai">
                <div class="message-avatar">🤖</div>
                <div class="message-bubble">
                    <strong>IA DataCôte - Assistant Intelligent</strong><br><br>
                    Alimenté par GPT-4 & Machine Learning<br><br>
                    Je peux vous aider avec des analyses prédictives, des insights économiques, des corrélations démographiques et bien plus !<br><br>
                    💬 <em>Posez-moi vos questions les plus complexes !</em> 🚀
                </div>
            </div>
        `;

        updateMessageCount();
    }
}

// Export chat
function exportChat() {
    const messages = document.querySelectorAll('.message');
    let exportText = 'Conversation Ask For Data - ' + new Date().toLocaleDateString() + '\n\n';

    messages.forEach(msg => {
        const isUser = msg.classList.contains('user');
        const text = msg.querySelector('.message-bubble').innerText;
        exportText += (isUser ? 'Vous: ' : 'IA: ') + text + '\n\n';
    });

    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'conversation-askfordata.txt';
    a.click();
    URL.revokeObjectURL(url);
}

// Update message count
function updateMessageCount() {
    document.getElementById('message-count').textContent = messageCount;
}

// Add message to chat with enhanced formatting
function addMessage(text, isUser = false, data = null) {
    const messagesContainer = document.getElementById('chat-messages');

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (isUser ? 'user' : 'ai');

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = isUser ? '👤' : '🤖';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    if (isUser) {
        // Simple user message
        bubble.innerHTML = text.replace(/\n/g, '<br>');
    } else {
        // Enhanced AI response with structured sections
        let formattedHTML = '';

        // Main response section
        // We use the full text as it is now a natural response
        formattedHTML += `
            <div class="response-main highlight-box">
                <div class="response-header">
                    <strong>💡 Analyse de l'IA</strong>
                </div>
                <div class="response-content">
                    ${formatText(text)}
                </div>
            </div>
        `;

        // Data section (if data is provided)
        if (data && data.data && data.data.length > 0) {
            formattedHTML += `
                <div class="data-highlight">
                    <h4 style="color: var(--primary); margin-bottom: 0.5rem; margin-top: 1rem;">📈 Données Clés</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Année</th>
                                <th>Valeur</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            data.data.slice(0, 5).forEach(d => {
                formattedHTML += `
                    <tr>
                        <td><strong>${d.year}</strong></td>
                        <td>${formatNumber(d.value)} ${data.unit || ''}</td>
                    </tr>
                `;
            });

            if (data.data.length > 5) {
                formattedHTML += `
                    <tr>
                        <td colspan="2" style="text-align: center; color: var(--text-muted); font-style: italic;">
                            ... et ${data.data.length - 5} autres années
                        </td>
                    </tr>
                `;
            }

            formattedHTML += `
                        </tbody>
                    </table>
                </div>
            `;
        }

        // Sources section (if source is provided)
        if (data && (data.source || data.source_link || data.url)) {
            formattedHTML += `
                <div class="source-links" style="margin-top: 1rem; padding-top: 0.5rem; border-top: 1px solid var(--border-light);">
                    <h4 style="font-size: 0.9rem; color: var(--text-muted);">🔗 Sources Vérifiées</h4>
            `;

            const linkUrl = data.source_link || data.url;
            const sourceName = data.source || 'Source Officielle';

            if (linkUrl) {
                formattedHTML += `
                    <a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="source-link btn-small btn-outline" style="display: inline-flex; align-items: center; gap: 5px; margin-top: 5px;">
                        🌍 Accéder à la source (${sourceName})
                    </a>
                `;
            } else if (data.source) {
                formattedHTML += `<p style="color: var(--text-muted); font-size: 0.9rem;">${data.source}</p>`;
            }

            // Add default sources if not specific
            if (!linkUrl) {
                formattedHTML += `
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <a href="https://data.worldbank.org/country/CI" target="_blank" rel="noopener noreferrer" class="source-link" style="font-size: 0.85rem;">
                            Banque Mondiale CI
                        </a>
                        <a href="https://www.anstat.gouv.ci" target="_blank" rel="noopener noreferrer" class="source-link" style="font-size: 0.85rem;">
                            ANStat Côte d'Ivoire
                        </a>
                    </div>
                `;
            }

            formattedHTML += `</div>`;
        }

        // Related Indicators section
        if (data && data.related_indicators && data.related_indicators.length > 0) {
            formattedHTML += renderRelatedIndicators(data.related_indicators);
        }

        bubble.innerHTML = formattedHTML;
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(bubble);

    messagesContainer.appendChild(messageDiv);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    messageCount++;
    updateMessageCount();
}

// Render chart in chat
function renderChatChart(canvasId, data, type, label, unit) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const labels = data.map(d => d.year);
    const values = data.map(d => d.value);

    // Dynamic colors
    const primaryColor = '#f97316'; // Orange
    let backgroundColor = 'rgba(249, 115, 22, 0.1)';
    let borderColor = primaryColor;

    if (type === 'line') {
        const gradient = ctx.createLinearGradient(0, 0, 0, 250);
        gradient.addColorStop(0, 'rgba(249, 115, 22, 0.4)');
        gradient.addColorStop(1, 'rgba(249, 115, 22, 0.05)');
        backgroundColor = gradient;
    }

    new Chart(ctx, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: label + (unit ? ` (${unit})` : ''),
                data: values,
                borderColor: borderColor,
                backgroundColor: backgroundColor,
                borderWidth: 2,
                tension: 0.3,
                fill: type === 'line',
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Hide legend to save space
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#0f172a',
                    bodyColor: '#334155',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    padding: 8,
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y.toLocaleString('fr-FR') + (unit ? ' ' + unit : '');
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10 } }
                },
                y: {
                    grid: { color: '#f1f5f9' },
                    ticks: { font: { size: 10 } },
                    border: { display: false }
                }
            }
        }
    });
}

// Helper function to format text with markdown-like syntax
function formatText(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

// Helper function to format numbers
function formatNumber(num) {
    if (typeof num === 'number') {
        return num.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    }
    return num;
}

// Show typing indicator
function showTyping() {
    document.getElementById('typing-indicator').style.display = 'flex';
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Hide typing indicator
function hideTyping() {
    document.getElementById('typing-indicator').style.display = 'none';
}

// Handle form submission
document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const input = document.getElementById('chat-input');
    const query = input.value.trim();

    if (!query) return;

    // Add user message
    addMessage(query, true);
    conversationHistory.push({ role: 'user', content: query });

    // Clear input and suggestions
    input.value = '';
    clearSuggestions();

    // Show typing indicator
    showTyping();

    try {
        // Call API
        const response = await fetch('/api/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: query,
                conversation_history: conversationHistory.slice(-5) // Send last 5 messages for context
            })
        });

        const data = await response.json();

        // Hide typing
        hideTyping();

        if (data.success) {
            // Enhanced AI response with structured data
            let aiMessage = data.message;

            // Add AI response with full data context
            addMessage(aiMessage, false, data);
            conversationHistory.push({ role: 'assistant', content: aiMessage });

        } else {
            addMessage('❌ ' + (data.message || 'Une erreur est survenue'), false, null);
        }

    } catch (error) {
        hideTyping();
        console.error('Error:', error);
        addMessage('❌ Impossible de se connecter au serveur. Veuillez réessayer.', false, null);
    }
});

// Auto-resize textarea
document.getElementById('chat-input').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';

    // Trigger autocomplete
    handleAutocomplete(this.value);
});

// Allow Enter to send (Shift+Enter for new line)
document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('chat-form').dispatchEvent(new Event('submit'));
    }
});

// ==========================================
// AUTOCOMPLETE & RECOMMENDATION SYSTEM
// ==========================================

let debounceTimer;

function handleAutocomplete(text) {
    clearTimeout(debounceTimer);

    if (text.length < 2) {
        clearSuggestions();
        return;
    }

    debounceTimer = setTimeout(async () => {
        try {
            const response = await fetch(`/api/suggest?q=${encodeURIComponent(text)}`);
            const data = await response.json();

            if (data.suggestions && data.suggestions.length > 0) {
                showSuggestions(data.suggestions);
            } else {
                clearSuggestions();
            }
        } catch (error) {
            console.error('Autocomplete error:', error);
        }
    }, 300);
}

function showSuggestions(suggestions) {
    const container = document.getElementById('suggestions-container');
    container.innerHTML = '';
    container.style.display = 'block';

    suggestions.forEach(item => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `
            <span class="suggestion-icon"><i class="fas fa-chart-bar"></i></span>
            <span class="suggestion-text">${item.name}</span>
        `;
        div.onclick = () => {
            document.getElementById('chat-input').value = item.name;
            clearSuggestions();
            document.getElementById('chat-input').focus();
        };
        container.appendChild(div);
    });
}

function clearSuggestions() {
    const container = document.getElementById('suggestions-container');
    if (container) {
        container.style.display = 'none';
        container.innerHTML = '';
    }
}

// Close suggestions when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.input-group')) {
        clearSuggestions();
    }
});

// Render related indicators in chat
function renderRelatedIndicators(indicators) {
    if (!indicators || indicators.length === 0) return '';

    let html = `
        <div class="related-indicators" style="margin-top: 1rem;">
            <h4 style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem;">💡 Variables recommandées :</h4>
            <div class="related-chips" style="display: flex; flex-wrap: wrap; gap: 8px;">
    `;

    indicators.forEach(ind => {
        html += `
            <button class="btn-outline btn-small" onclick="setSuggestion('${ind.replace(/'/g, "\\'")}')" style="border-radius: 20px; font-size: 0.8rem;">
                ${ind}
            </button>
        `;
    });

    html += `
            </div>
        </div>
    `;

    return html;
}

// Focus input on load and setup suggestions
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('chat-input').focus();

    // Create suggestions container
    const inputGroup = document.querySelector('.input-group');
    if (inputGroup) {
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.id = 'suggestions-container';
        suggestionsDiv.className = 'suggestions-container';
        inputGroup.appendChild(suggestionsDiv);
    }
});
