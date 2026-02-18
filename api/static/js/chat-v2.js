// =============================================
// Chat V2 — ChatGPT-like Conversational Interface
// =============================================

function getCSRFToken() {
    const el = document.querySelector('[name=csrfmiddlewaretoken]');
    if (el) return el.value;
    const match = document.cookie.match(/csrftoken=([^;]+)/);
    return match ? match[1] : '';
}

const ChatApp = {
    currentConversationId: null,
    isLoading: false,
    _chartIdCounter: 0,
    _chartColors: [
        { bg: 'rgba(249,115,22,0.15)', border: '#f97316' },
        { bg: 'rgba(59,130,246,0.15)', border: '#3b82f6' },
        { bg: 'rgba(16,185,129,0.15)', border: '#10b981' },
        { bg: 'rgba(168,85,247,0.15)', border: '#a855f7' },
        { bg: 'rgba(239,68,68,0.15)', border: '#ef4444' },
    ],

    // ─── Init ────────────────────────────────
    init() {
        // Add class to body for CSS targeting (fallback for :has())
        document.body.classList.add('chat-active');
        this.bindEvents();
        this.loadConversations();
        this.autoResizeTextarea();
        this.textarea = document.getElementById('chat-input');
        this.textarea.focus();
    },

    // ─── Events ──────────────────────────────
    bindEvents() {
        // Send message
        document.getElementById('chat-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        // Enter to send (Shift+Enter for newline)
        document.getElementById('chat-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // New chat
        document.getElementById('new-chat-btn').addEventListener('click', () => {
            this.newConversation();
        });

        // Mobile sidebar toggle
        document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Sidebar overlay close
        document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
            this.closeSidebar();
        });

        // Suggestion cards
        document.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', () => {
                const text = card.dataset.query;
                if (text) {
                    document.getElementById('chat-input').value = text;
                    this.sendMessage();
                }
            });
        });
    },

    // ─── Textarea Auto-Resize ────────────────
    autoResizeTextarea() {
        const textarea = document.getElementById('chat-input');
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 200) + 'px';
        });
    },

    // ─── Send Message ────────────────────────
    async sendMessage() {
        const textarea = document.getElementById('chat-input');
        const message = textarea.value.trim();
        if (!message || this.isLoading) return;

        // Hide welcome, show messages
        this.hideWelcome();

        // Add user message to UI
        this.appendMessage('user', message);

        // Clear input
        textarea.value = '';
        textarea.style.height = 'auto';

        // Show typing indicator
        this.showTyping();
        this.isLoading = true;
        this.updateSendButton();

        try {
            const response = await fetch('/api/chat/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken(),
                },
                body: JSON.stringify({
                    message: message,
                    conversation_id: this.currentConversationId,
                }),
            });

            const data = await response.json();
            this.hideTyping();
            this.isLoading = false;
            this.updateSendButton();

            if (data.success) {
                this.currentConversationId = data.conversation_id;
                this.appendMessage('assistant', data.message.content, data.message.data_contexts || data.message.data_context || []);

                // Update sidebar
                if (data.conversation_title) {
                    this.updateConversationInSidebar(data.conversation_id, data.conversation_title);
                }

                // Update quota
                if (data.remaining !== undefined && data.remaining >= 0) {
                    this.updateQuota(data.remaining);
                }
            } else {
                this.appendMessage('assistant', data.message || 'Une erreur est survenue.');
                if (data.needs_key) {
                    this.appendMessage('assistant',
                        '🔑 **Ajoutez votre propre clé API Gemini** pour des requêtes illimitées → [Configurer ma clé](/setup-api-key/)');
                }
            }
        } catch (error) {
            this.hideTyping();
            this.isLoading = false;
            this.updateSendButton();
            console.error('Chat error:', error);
            this.appendMessage('assistant', '❌ Impossible de se connecter au serveur. Veuillez réessayer.');
        }
    },

    // ─── Append Message to UI ────────────────
    appendMessage(role, content, dataContexts) {
        const container = document.getElementById('messages-wrapper');
        const msgDiv = document.createElement('div');
        msgDiv.className = `msg ${role}`;

        const avatarIcon = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
        const roleName = role === 'user' ? 'Vous' : 'Ask For Data AI';
        const renderedContent = role === 'assistant' ? this.renderMarkdown(content) : this.escapeHtml(content).replace(/\n/g, '<br>');

        msgDiv.innerHTML = `
            <div class="msg-avatar">${avatarIcon}</div>
            <div class="msg-body">
                <div class="msg-role">${roleName}</div>
                <div class="msg-content">${renderedContent}</div>
            </div>
        `;

        container.appendChild(msgDiv);

        // Render charts + source links for data contexts
        if (role === 'assistant' && dataContexts && dataContexts.length > 0) {
            // Normalize: handle both list and legacy single-dict format
            const ctxList = Array.isArray(dataContexts) ? dataContexts : [dataContexts];
            const validContexts = ctxList.filter(dc => dc && dc.values && dc.values.length > 0);
            if (validContexts.length > 0) {
                this.renderDataCards(msgDiv.querySelector('.msg-body'), validContexts);
            }
        }

        this.scrollToBottom();
    },

    // ─── Render Data Cards (charts + source links) ───
    renderDataCards(msgBody, dataContexts) {
        const wrapper = document.createElement('div');
        wrapper.className = 'data-cards-wrapper';

        dataContexts.forEach((dc, idx) => {
            const card = document.createElement('div');
            card.className = 'data-card';

            // Chart canvas
            const chartId = `chat-chart-${++this._chartIdCounter}`;
            const color = this._chartColors[idx % this._chartColors.length];

            card.innerHTML = `
                <div class="data-card-header">
                    <i class="fas fa-chart-line"></i>
                    <span>${this.escapeHtml(dc.name)}</span>
                </div>
                <div class="data-card-chart">
                    <canvas id="${chartId}"></canvas>
                </div>
                <div class="data-card-footer">
                    <span class="data-source-label">
                        <i class="fas fa-database"></i>
                        ${this.escapeHtml(dc.source_label || 'Source non précisée')}
                    </span>
                    ${dc.source_link ? `<a href="${this.escapeHtml(dc.source_link)}" target="_blank" rel="noopener" class="data-source-link">
                        <i class="fas fa-external-link-alt"></i> Voir les données
                    </a>` : ''}
                </div>
            `;

            wrapper.appendChild(card);

            // Render Chart.js after DOM insertion
            requestAnimationFrame(() => {
                const canvas = document.getElementById(chartId);
                if (!canvas || typeof Chart === 'undefined') return;

                const labels = dc.values.map(v => v.year);
                const values = dc.values.map(v => v.value);

                new Chart(canvas, {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [{
                            label: dc.name,
                            data: values,
                            borderColor: color.border,
                            backgroundColor: color.bg,
                            borderWidth: 2,
                            pointRadius: values.length > 30 ? 0 : 3,
                            pointHoverRadius: 5,
                            fill: true,
                            tension: 0.3,
                        }],
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => {
                                        const val = ctx.parsed.y;
                                        if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(2) + ' Mds';
                                        if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(2) + ' M';
                                        if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(1) + ' k';
                                        return val.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
                                    },
                                },
                            },
                        },
                        scales: {
                            x: { grid: { display: false }, ticks: { maxTicksLimit: 10, font: { size: 11 } } },
                            y: {
                                grid: { color: 'rgba(0,0,0,0.06)' },
                                ticks: {
                                    font: { size: 11 },
                                    callback: (val) => {
                                        if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(1) + ' Mds';
                                        if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(1) + ' M';
                                        if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(0) + ' k';
                                        return val.toLocaleString('fr-FR');
                                    },
                                },
                            },
                        },
                    },
                });
            });
        });

        msgBody.appendChild(wrapper);
    },

    // ─── Markdown Rendering ──────────────────
    renderMarkdown(text) {
        if (!text) return '';
        let html = text;

        // Code blocks (```lang\n...\n```)
        html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
            return `<pre><code class="language-${lang}">${this.escapeHtml(code.trim())}</code></pre>`;
        });

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Tables (simple markdown tables)
        html = html.replace(/^\|(.+)\|\s*\n\|[-| :]+\|\s*\n((?:\|.+\|\s*\n?)*)/gm, (match, header, rows) => {
            const headers = header.split('|').map(h => h.trim()).filter(Boolean);
            const rowLines = rows.trim().split('\n');
            let table = '<table><thead><tr>';
            headers.forEach(h => { table += `<th>${h}</th>`; });
            table += '</tr></thead><tbody>';
            rowLines.forEach(row => {
                const cells = row.split('|').map(c => c.trim()).filter(Boolean);
                table += '<tr>';
                cells.forEach(c => { table += `<td>${c}</td>`; });
                table += '</tr>';
            });
            table += '</tbody></table>';
            return table;
        });

        // Headers
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');

        // Bold & italic
        html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

        // Blockquotes
        html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

        // Unordered lists
        html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/gs, (match) => `<ul>${match}</ul>`);

        // Ordered lists
        html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

        // Paragraphs — split by double newline
        html = html.split(/\n\n+/).map(block => {
            block = block.trim();
            if (!block) return '';
            if (block.startsWith('<h') || block.startsWith('<pre') || block.startsWith('<table') ||
                block.startsWith('<ul') || block.startsWith('<ol') || block.startsWith('<blockquote')) {
                return block;
            }
            return `<p>${block.replace(/\n/g, '<br>')}</p>`;
        }).join('\n');

        return html;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // ─── Typing Indicator ────────────────────
    showTyping() {
        let typing = document.getElementById('typing-msg');
        if (!typing) {
            typing = document.createElement('div');
            typing.id = 'typing-msg';
            typing.className = 'msg assistant';
            typing.innerHTML = `
                <div class="msg-avatar"><i class="fas fa-robot"></i></div>
                <div class="msg-body">
                    <div class="msg-role">Ask For Data AI</div>
                    <div class="msg-content">
                        <div class="typing-indicator">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('messages-wrapper').appendChild(typing);
        }
        typing.style.display = 'flex';
        this.scrollToBottom();
    },

    hideTyping() {
        const typing = document.getElementById('typing-msg');
        if (typing) typing.remove();
    },

    // ─── Scroll ──────────────────────────────
    scrollToBottom() {
        const container = document.getElementById('chat-messages-container');
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
        });
    },

    // ─── Welcome Screen ──────────────────────
    hideWelcome() {
        const welcome = document.getElementById('chat-welcome');
        if (welcome) welcome.style.display = 'none';
    },

    showWelcome() {
        const welcome = document.getElementById('chat-welcome');
        if (welcome) welcome.style.display = 'flex';
        // Clear messages
        const wrapper = document.getElementById('messages-wrapper');
        wrapper.innerHTML = '';
        wrapper.appendChild(welcome || document.createElement('div'));
    },

    // ─── Send Button State ───────────────────
    updateSendButton() {
        const btn = document.getElementById('send-btn');
        btn.disabled = this.isLoading;
    },

    // ─── Quota Update ────────────────────────
    updateQuota(remaining) {
        const badge = document.getElementById('quota-badge');
        if (badge && remaining >= 0) {
            badge.innerHTML = `<i class="fas fa-bolt"></i> <span class="badge-text">${remaining} restantes</span>`;
        }
    },

    // ─── Sidebar: Conversations ──────────────
    async loadConversations() {
        try {
            const response = await fetch('/api/chat/conversations');
            const data = await response.json();
            if (data.success) {
                this.renderConversationList(data.conversations);
            }
        } catch (e) {
            console.error('Failed to load conversations:', e);
        }
    },

    renderConversationList(conversations) {
        const container = document.getElementById('convo-list');
        container.innerHTML = '';

        if (conversations.length === 0) {
            container.innerHTML = '<div style="padding: 1rem; text-align: center; color: rgba(255,255,255,0.3); font-size: 0.85rem;">Aucune conversation</div>';
            return;
        }

        // Group by date
        const today = new Date();
        const groups = { today: [], yesterday: [], week: [], older: [] };

        conversations.forEach(c => {
            const date = new Date(c.updated_at);
            const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
            if (diffDays === 0) groups.today.push(c);
            else if (diffDays === 1) groups.yesterday.push(c);
            else if (diffDays < 7) groups.week.push(c);
            else groups.older.push(c);
        });

        const labels = {
            today: "Aujourd'hui",
            yesterday: 'Hier',
            week: '7 derniers jours',
            older: 'Plus ancien',
        };

        for (const [key, convos] of Object.entries(groups)) {
            if (convos.length === 0) continue;
            const section = document.createElement('div');
            section.innerHTML = `<div class="sidebar-section-title">${labels[key]}</div>`;
            convos.forEach(c => {
                const item = document.createElement('div');
                item.className = `convo-item${c.id === this.currentConversationId ? ' active' : ''}`;
                item.dataset.id = c.id;
                item.innerHTML = `
                    <i class="fas fa-comment convo-icon"></i>
                    <span class="convo-title">${this.escapeHtml(c.title)}</span>
                    <div class="convo-actions">
                        <button class="convo-action-btn" onclick="event.stopPropagation(); ChatApp.renameConversation(${c.id})" title="Renommer">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="convo-action-btn delete" onclick="event.stopPropagation(); ChatApp.deleteConversation(${c.id})" title="Supprimer">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                item.addEventListener('click', () => this.loadConversation(c.id));
                section.appendChild(item);
            });
            container.appendChild(section);
        }
    },

    updateConversationInSidebar(id, title) {
        // Reload the sidebar to reflect the new/updated conversation
        this.loadConversations();
    },

    // ─── Load Conversation ───────────────────
    async loadConversation(id) {
        try {
            const response = await fetch(`/api/chat/conversations/${id}/messages`);
            const data = await response.json();
            if (!data.success) return;

            this.currentConversationId = id;
            this.hideWelcome();

            // Clear and render messages
            const wrapper = document.getElementById('messages-wrapper');
            wrapper.innerHTML = '';

            data.messages.forEach(msg => {
                // data_context may be a list or a single dict (legacy)
                const dc = msg.data_context || [];
                this.appendMessage(msg.role, msg.content, dc);
            });

            // Update active state in sidebar
            document.querySelectorAll('.convo-item').forEach(el => {
                el.classList.toggle('active', parseInt(el.dataset.id) === id);
            });

            this.closeSidebar();
        } catch (e) {
            console.error('Failed to load conversation:', e);
        }
    },

    // ─── New Conversation ────────────────────
    newConversation() {
        this.currentConversationId = null;

        // Reset UI
        const wrapper = document.getElementById('messages-wrapper');
        const welcome = document.getElementById('chat-welcome');
        wrapper.innerHTML = '';
        if (welcome) {
            welcome.style.display = 'flex';
            wrapper.appendChild(welcome);
        }

        // Deactivate sidebar items
        document.querySelectorAll('.convo-item').forEach(el => el.classList.remove('active'));

        document.getElementById('chat-input').focus();
        this.closeSidebar();
    },

    // ─── Delete Conversation ─────────────────
    async deleteConversation(id) {
        if (!confirm('Supprimer cette conversation ?')) return;

        try {
            await fetch(`/api/chat/conversations/${id}/delete`, {
                method: 'DELETE',
                headers: { 'X-CSRFToken': getCSRFToken() },
            });
            if (this.currentConversationId === id) {
                this.newConversation();
            }
            this.loadConversations();
        } catch (e) {
            console.error('Delete failed:', e);
        }
    },

    // ─── Rename Conversation ─────────────────
    async renameConversation(id) {
        const newTitle = prompt('Nouveau titre :');
        if (!newTitle) return;

        try {
            await fetch(`/api/chat/conversations/${id}/rename`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken(),
                },
                body: JSON.stringify({ title: newTitle }),
            });
            this.loadConversations();
        } catch (e) {
            console.error('Rename failed:', e);
        }
    },

    // ─── Sidebar Toggle (mobile) ─────────────
    toggleSidebar() {
        const sidebar = document.getElementById('chat-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    },

    closeSidebar() {
        const sidebar = document.getElementById('chat-sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    },
};

// ─── Boot ────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => ChatApp.init());
