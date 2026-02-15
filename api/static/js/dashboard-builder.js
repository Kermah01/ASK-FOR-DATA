/* ============================================================
   DASHBOARD BUILDER — Custom Dashboard Creator  v2.0
   Features: drag-and-drop panels, 21+ chart types, undo/redo,
   download w/ watermark, resizable sidebar, interactive year
   range, rich styling.  Uses ECharts for rendering.
   ============================================================ */

const DashboardBuilder = {

    // ── State ──────────────────────────────────────────────
    panels: [],
    allIndicators: [],
    nextPanelId: 1,
    activePanelId: null,
    dragSrcId: null,

    // Undo / Redo
    _history: [],
    _historyIdx: -1,
    _maxHistory: 50,
    _skipHistory: false,

    // Sidebar resize
    _sidebarWidth: 300,
    _sidebarMinW: 200,
    _sidebarMaxW: 500,

    // ── Chart Type Catalogue ──────────────────────────────
    CHART_CATEGORIES: [
        {
            id: 'evolution', label: 'Évolution temporelle',
            types: [
                { id: 'line',         icon: '📈', label: 'Courbe',              desc: 'Évolution dans le temps' },
                { id: 'area',         icon: '🏔️', label: 'Aire',                desc: 'Courbe avec remplissage' },
                { id: 'area_stacked', icon: '📊', label: 'Aires empilées',      desc: 'Composition dans le temps' },
                { id: 'step',         icon: '📶', label: 'En escalier',         desc: 'Paliers successifs' },
            ]
        },
        {
            id: 'comparison', label: 'Comparaison',
            types: [
                { id: 'bar',            icon: '📊', label: 'Histogramme',         desc: 'Barres verticales' },
                { id: 'bar_horizontal', icon: '📋', label: 'Barres horiz.',       desc: 'Barres horizontales' },
                { id: 'bar_grouped',    icon: '📊', label: 'Barres groupées',     desc: 'Séries côte à côte' },
                { id: 'bar_stacked',    icon: '📚', label: 'Barres empilées',     desc: 'Empilées par catégorie' },
                { id: 'waterfall',      icon: '🏗️', label: 'Cascade',             desc: 'Variations cumulées' },
                { id: 'polar_bar',      icon: '🎯', label: 'Barres polaires',     desc: 'Barres en cercle' },
            ]
        },
        {
            id: 'proportion', label: 'Proportion & Répartition',
            types: [
                { id: 'pie',      icon: '🥧', label: 'Camembert',     desc: 'Parts du total' },
                { id: 'donut',    icon: '🍩', label: 'Anneau',        desc: 'Camembert creux' },
                { id: 'treemap',  icon: '🟩', label: 'Treemap',       desc: 'Rectangles imbriqués' },
                { id: 'sunburst', icon: '☀️', label: 'Sunburst',      desc: 'Hiérarchie radiale' },
                { id: 'funnel',   icon: '🔽', label: 'Entonnoir',     desc: 'Étapes décroissantes' },
            ]
        },
        {
            id: 'correlation', label: 'Corrélation & Distribution',
            types: [
                { id: 'scatter',  icon: '⚬', label: 'Nuage de points',     desc: 'Relation entre 2 variables' },
                { id: 'bubble',   icon: '🫧', label: 'Bulles',              desc: 'Points à 3 dimensions' },
                { id: 'heatmap',  icon: '🌡️', label: 'Carte de chaleur',    desc: 'Matrice de valeurs' },
                { id: 'boxplot',  icon: '📦', label: 'Boîte à moustaches',  desc: 'Distribution statistique' },
            ]
        },
        {
            id: 'multiaxes', label: 'Multi-axes & Spécialisé',
            types: [
                { id: 'radar',       icon: '🕸️', label: 'Radar',           desc: 'Profil multidimensionnel' },
                { id: 'gauge',       icon: '🎛️', label: 'Jauge',           desc: 'Valeur vs objectif' },
                { id: 'candlestick', icon: '🕯️', label: 'Chandelier',     desc: 'Min/Max/Ouv/Ferm' },
                { id: 'sankey',      icon: '🔀', label: 'Sankey',          desc: 'Flux entre catégories' },
            ]
        }
    ],

    COLOR_PALETTES: {
        vibrant:   ['#FF6B00','#00B894','#6C5CE7','#E17055','#00CEC9','#FDCB6E','#E84393','#0984E3','#55EFC4','#FAB1A0'],
        ocean:     ['#0077B6','#00B4D8','#90E0EF','#CAF0F8','#023E8A','#0096C7','#48CAE4','#ADE8F4','#03045E','#468FAF'],
        earth:     ['#606C38','#283618','#DDA15E','#BC6C25','#FEFAE0','#8B9556','#4A5524','#E8D5A3','#9B7E53','#3D3522'],
        sunset:    ['#F94144','#F3722C','#F8961E','#F9C74F','#90BE6D','#43AA8B','#577590','#F9844A','#4D908E','#277DA1'],
        monochrome:['#1a1a2e','#3d3d5c','#5e5e8a','#8888b0','#a5a5c8','#c2c2de','#ddddef','#16213E','#0F3460','#533483'],
        ci:        ['#FF8200','#009E49','#F5F5F5','#E8E8E8','#1B4332','#FF6B00','#00B894','#2D6A4F','#FFB347','#40916C'],
    },

    DEFAULT_COLORS: ['#FF6B00','#00B894','#6C5CE7','#E17055','#00CEC9','#FDCB6E','#E84393','#0984E3'],

    // ── Init ──────────────────────────────────────────────
    async init() {
        this.bindEvents();
        this._initSidebarResize();
        this.renderGrid();
        await this.loadIndicators();
        this.renderSidebar();
        this.loadFromStorage();
        this._pushHistory();
    },

    // ── Undo / Redo ──────────────────────────────────────
    _snapshotState() {
        return JSON.stringify(this.panels.map(p => ({
            id: p.id, colSpan: p.colSpan, rowSpan: p.rowSpan,
            indicators: (p.indicators || []).map(i => ({ code: i.code, name: i.name })),
            chartType: p.chartType, title: p.title, colors: p.colors,
            fontFamily: p.fontFamily, fontSize: p.fontSize,
            showLegend: p.showLegend, showGrid: p.showGrid, smooth: p.smooth,
            axisXLabel: p.axisXLabel, axisYLabel: p.axisYLabel,
            yearStart: p.yearStart, yearEnd: p.yearEnd,
        })));
    },

    _pushHistory() {
        if (this._skipHistory) return;
        const snap = this._snapshotState();
        // Trim forward history
        this._history = this._history.slice(0, this._historyIdx + 1);
        this._history.push({ panels: snap, nextPanelId: this.nextPanelId });
        if (this._history.length > this._maxHistory) this._history.shift();
        this._historyIdx = this._history.length - 1;
        this._updateUndoRedoButtons();
    },

    async _restoreSnapshot(entry) {
        this._skipHistory = true;
        const panels = JSON.parse(entry.panels);
        this.nextPanelId = entry.nextPanelId;
        this.panels = panels.map(p => ({ ...p, dataCache: {} }));
        await Promise.all(this.panels.map(p => this._fetchPanelData(p)));
        this.renderGrid();
        this.saveToStorage();
        this._skipHistory = false;
    },

    async undo() {
        if (this._historyIdx <= 0) return;
        this._historyIdx--;
        await this._restoreSnapshot(this._history[this._historyIdx]);
        this._updateUndoRedoButtons();
    },

    async redo() {
        if (this._historyIdx >= this._history.length - 1) return;
        this._historyIdx++;
        await this._restoreSnapshot(this._history[this._historyIdx]);
        this._updateUndoRedoButtons();
    },

    _updateUndoRedoButtons() {
        const undoBtn = document.getElementById('builder-undo-btn');
        const redoBtn = document.getElementById('builder-redo-btn');
        if (undoBtn) undoBtn.disabled = this._historyIdx <= 0;
        if (redoBtn) redoBtn.disabled = this._historyIdx >= this._history.length - 1;
    },

    // ── Sidebar Resize ───────────────────────────────────
    _initSidebarResize() {
        const handle = document.getElementById('builder-sidebar-resize');
        const sidebar = document.getElementById('builder-sidebar');
        if (!handle || !sidebar) return;

        let startX, startW;
        const onMouseMove = (e) => {
            const newW = Math.min(this._sidebarMaxW, Math.max(this._sidebarMinW, startW + (e.clientX - startX)));
            sidebar.style.width = newW + 'px';
            this._sidebarWidth = newW;
            // Resize all charts
            this.panels.forEach(p => {
                const chartEl = document.getElementById(`panel-chart-${p.id}`);
                if (chartEl) { const inst = echarts.getInstanceByDom(chartEl); if (inst) inst.resize(); }
            });
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startX = e.clientX;
            startW = sidebar.offsetWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Double-click to collapse/expand
        handle.addEventListener('dblclick', () => {
            sidebar.classList.toggle('collapsed');
            if (sidebar.classList.contains('collapsed')) {
                sidebar.style.width = '0px';
            } else {
                sidebar.style.width = this._sidebarWidth + 'px';
            }
            setTimeout(() => {
                this.panels.forEach(p => {
                    const chartEl = document.getElementById(`panel-chart-${p.id}`);
                    if (chartEl) { const inst = echarts.getInstanceByDom(chartEl); if (inst) inst.resize(); }
                });
            }, 350);
        });
    },

    async loadIndicators() {
        try {
            const res = await fetch('/api/indicators');
            const data = await res.json();
            if (data.success) {
                this.allIndicators = data.indicators.sort((a, b) =>
                    a.name.localeCompare(b.name, 'fr')
                );
            }
        } catch (e) {
            console.error('Failed to load indicators:', e);
        }
    },

    // ── Sidebar Rendering ─────────────────────────────────
    renderSidebar() {
        const list = document.getElementById('builder-var-list');
        if (!list) return;
        list.innerHTML = '';

        const indicators = this._filteredIndicators || this.allIndicators;

        // Group by first letter
        const groups = {};
        indicators.forEach(ind => {
            const letter = (ind.name || '?')[0].toUpperCase();
            if (!groups[letter]) groups[letter] = [];
            groups[letter].push(ind);
        });

        const sortedLetters = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'fr'));

        sortedLetters.forEach(letter => {
            const groupEl = document.createElement('div');
            groupEl.className = 'builder-var-group';
            groupEl.innerHTML = `<div class="builder-var-group-title">${letter}</div>`;

            groups[letter].forEach(ind => {
                const isNat = ind.code && ind.code.startsWith('NAT.');
                const item = document.createElement('div');
                item.className = 'builder-var-item';
                item.dataset.code = ind.code;
                item.innerHTML = `
                    <input type="checkbox" data-code="${ind.code}">
                    <span class="builder-var-name" title="${ind.name}">${ind.name}</span>
                    ${isNat ? '<span class="builder-var-badge">National</span>' : ''}
                `;
                item.addEventListener('click', (e) => {
                    if (e.target.tagName === 'INPUT') return;
                    const cb = item.querySelector('input[type="checkbox"]');
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event('change'));
                });
                const cb = item.querySelector('input[type="checkbox"]');
                cb.addEventListener('change', () => {
                    item.classList.toggle('selected', cb.checked);
                    this._updateSidebarFooter();
                });
                groupEl.appendChild(item);
            });
            list.appendChild(groupEl);
        });
    },

    _filteredIndicators: null,

    filterSidebar(query) {
        if (!query || query.length < 2) {
            this._filteredIndicators = null;
        } else {
            const q = query.toLowerCase();
            this._filteredIndicators = this.allIndicators.filter(ind =>
                ind.name.toLowerCase().includes(q) ||
                ind.code.toLowerCase().includes(q) ||
                (ind.description || '').toLowerCase().includes(q)
            );
        }
        this.renderSidebar();
    },

    _getSelectedSidebarCodes() {
        const codes = [];
        document.querySelectorAll('#builder-var-list input[type="checkbox"]:checked').forEach(cb => {
            codes.push(cb.dataset.code);
        });
        return codes;
    },

    _updateSidebarFooter() {
        const codes = this._getSelectedSidebarCodes();
        const btn = document.getElementById('builder-assign-btn');
        if (btn) {
            btn.disabled = codes.length === 0;
            btn.textContent = codes.length > 0
                ? `Affecter ${codes.length} variable${codes.length > 1 ? 's' : ''} au cadran`
                : 'Sélectionner des variables';
        }
    },

    _clearSidebarSelection() {
        document.querySelectorAll('#builder-var-list input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
            cb.closest('.builder-var-item')?.classList.remove('selected');
        });
        this._updateSidebarFooter();
    },

    // ── Grid Rendering ────────────────────────────────────
    renderGrid() {
        const grid = document.getElementById('builder-grid');
        if (!grid) return;

        // Dispose existing ECharts instances before clearing DOM
        grid.querySelectorAll('.panel-chart').forEach(el => {
            const inst = echarts.getInstanceByDom(el);
            if (inst) inst.dispose();
        });
        grid.innerHTML = '';

        this.panels.forEach(panel => {
            grid.appendChild(this._createPanelEl(panel));
        });

        // Always show the "add" card at the end
        const addCard = document.createElement('div');
        addCard.className = 'builder-add-card';
        addCard.innerHTML = `<div class="plus-icon"><i class="fas fa-plus"></i></div>`;
        addCard.addEventListener('click', () => this.addPanel());
        grid.appendChild(addCard);
    },

    _createPanelEl(panel) {
        const el = document.createElement('div');
        el.className = `builder-panel span-${panel.colSpan || 4}`;
        if (panel.rowSpan > 1) el.classList.add(`rows-${panel.rowSpan}`);
        el.dataset.panelId = panel.id;
        el.id = `builder-panel-${panel.id}`;

        // Drag attributes
        el.draggable = true;
        el.addEventListener('dragstart', (e) => this._onDragStart(e, panel.id));
        el.addEventListener('dragover', (e) => this._onDragOver(e));
        el.addEventListener('drop', (e) => this._onDrop(e, panel.id));
        el.addEventListener('dragend', (e) => this._onDragEnd(e));

        if (panel.indicators && panel.indicators.length > 0 && panel.chartType) {
            // Configured panel — compute year bounds from data
            const allYears = panel.indicators
                .map(i => panel.dataCache[i.code])
                .filter(Boolean)
                .flatMap(d => (d.values || []).map(v => v.year));
            const minY = allYears.length ? Math.min(...allYears) : 2000;
            const maxY = allYears.length ? Math.max(...allYears) : 2024;
            const ys = panel.yearStart || minY;
            const ye = panel.yearEnd || maxY;

            el.innerHTML = `
                <div class="panel-header">
                    <i class="fas fa-grip-vertical panel-drag-handle"></i>
                    <input class="panel-title-input" value="${this._escHtml(panel.title || panel.indicators.map(i => i.name).join(' / '))}" 
                           data-panel-id="${panel.id}" placeholder="Titre du graphique">
                    <div class="panel-year-range">
                        <input type="number" class="year-input" value="${ys}" min="${minY}" max="${maxY}" data-panel-id="${panel.id}" data-bound="start" title="Année début">
                        <span class="year-sep">—</span>
                        <input type="number" class="year-input" value="${ye}" min="${minY}" max="${maxY}" data-panel-id="${panel.id}" data-bound="end" title="Année fin">
                    </div>
                    <div class="panel-size-controls">
                        ${[3,4,6,8,12].map(s => `<button class="panel-size-btn ${panel.colSpan === s ? 'active-size' : ''}" data-span="${s}" data-panel-id="${panel.id}" title="${s}/12">${s}</button>`).join('')}
                    </div>
                    <div class="panel-actions">
                        <button class="panel-action-btn" title="Télécharger le graphique" data-action="download" data-panel-id="${panel.id}"><i class="fas fa-download"></i></button>
                        <button class="panel-action-btn" title="Changer le graphique" data-action="chart-type" data-panel-id="${panel.id}"><i class="fas fa-chart-pie"></i></button>
                        <button class="panel-action-btn" title="Personnaliser" data-action="customize" data-panel-id="${panel.id}"><i class="fas fa-palette"></i></button>
                        <button class="panel-action-btn" title="Ajouter/Modifier indicateurs" data-action="indicators" data-panel-id="${panel.id}"><i class="fas fa-database"></i></button>
                        <button class="panel-action-btn delete" title="Supprimer" data-action="delete" data-panel-id="${panel.id}"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
                <div class="panel-body">
                    <div class="panel-chart" id="panel-chart-${panel.id}"></div>
                </div>
                <div class="panel-footer" id="panel-footer-${panel.id}"></div>
                <div class="panel-resize-corner" data-panel-id="${panel.id}"></div>
            `;
        } else {
            // Empty panel — show "+"
            el.innerHTML = `
                <div class="panel-header">
                    <i class="fas fa-grip-vertical panel-drag-handle"></i>
                    <span class="panel-title">Cadran ${panel.id}</span>
                    <div class="panel-size-controls">
                        ${[3,4,6,8,12].map(s => `<button class="panel-size-btn ${panel.colSpan === s ? 'active-size' : ''}" data-span="${s}" data-panel-id="${panel.id}" title="${s}/12">${s}</button>`).join('')}
                    </div>
                    <div class="panel-actions">
                        <button class="panel-action-btn delete" title="Supprimer" data-action="delete" data-panel-id="${panel.id}"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
                <div class="panel-body">
                    <div class="panel-placeholder" data-panel-id="${panel.id}">
                        <div class="plus-icon"><i class="fas fa-plus"></i></div>
                        <span>Ajouter un graphique</span>
                    </div>
                </div>
                <div class="panel-resize-corner" data-panel-id="${panel.id}"></div>
            `;
        }

        // Bind panel events
        setTimeout(() => this._bindPanelEvents(el, panel), 0);

        return el;
    },

    _bindPanelEvents(el, panel) {
        // Placeholder click → open indicator picker
        el.querySelectorAll('.panel-placeholder').forEach(ph => {
            ph.addEventListener('click', () => this.showIndicatorModal(panel.id));
        });

        // Size buttons
        el.querySelectorAll('.panel-size-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const span = parseInt(btn.dataset.span);
                this._resizePanel(panel.id, span);
            });
        });

        // Action buttons
        el.querySelectorAll('.panel-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const pid = parseInt(btn.dataset.panelId);
                if (action === 'delete') this.removePanel(pid);
                else if (action === 'chart-type') this.showChartTypeModal(pid);
                else if (action === 'customize') this.showCustomizeModal(pid);
                else if (action === 'indicators') this.showIndicatorModal(pid);
                else if (action === 'download') this.downloadChart(pid);
            });
        });

        // Title input
        const titleInput = el.querySelector('.panel-title-input');
        if (titleInput) {
            titleInput.addEventListener('change', () => {
                panel.title = titleInput.value;
                this.saveToStorage();
                this._pushHistory();
            });
        }

        // Corner resize handle
        el.querySelectorAll('.panel-resize-corner').forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const pid = parseInt(handle.dataset.panelId);
                const p = this._getPanel(pid);
                if (!p) return;
                const panelEl = document.getElementById(`builder-panel-${pid}`);
                if (!panelEl) return;

                const startX = e.clientX, startY = e.clientY;
                const startW = panelEl.offsetWidth, startH = panelEl.offsetHeight;

                const onMove = (ev) => {
                    const newW = Math.max(200, startW + (ev.clientX - startX));
                    const newH = Math.max(200, startH + (ev.clientY - startY));
                    panelEl.style.width = newW + 'px';
                    panelEl.style.height = newH + 'px';
                    panelEl.style.minHeight = newH + 'px';
                    // Resize chart
                    const chartEl = document.getElementById(`panel-chart-${pid}`);
                    if (chartEl) {
                        const inst = echarts.getInstanceByDom(chartEl);
                        if (inst) inst.resize();
                    }
                };
                const onUp = () => {
                    document.removeEventListener('mousemove', onMove);
                    document.removeEventListener('mouseup', onUp);
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    // Store custom height
                    p._customHeight = panelEl.offsetHeight;
                    this.saveToStorage();
                    this._pushHistory();
                };
                document.body.style.cursor = 'nwse-resize';
                document.body.style.userSelect = 'none';
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
            });
        });

        // Year range inputs
        el.querySelectorAll('.year-input').forEach(input => {
            input.addEventListener('change', () => {
                const pid = parseInt(input.dataset.panelId);
                const p = this._getPanel(pid);
                if (!p) return;
                if (input.dataset.bound === 'start') p.yearStart = parseInt(input.value);
                else p.yearEnd = parseInt(input.value);
                this.renderChart(pid);
                this.saveToStorage();
                this._pushHistory();
            });
        });

        // Render chart if configured
        if (panel.indicators && panel.indicators.length > 0 && panel.chartType) {
            setTimeout(() => this.renderChart(panel.id), 50);
        }
    },

    // ── Panel Management ──────────────────────────────────
    addPanel(config = {}) {
        const panel = {
            id: this.nextPanelId++,
            colSpan: config.colSpan || 4,
            rowSpan: config.rowSpan || 1,
            indicators: config.indicators || [],
            chartType: config.chartType || null,
            title: config.title || '',
            colors: config.colors || [...this.DEFAULT_COLORS],
            fontFamily: config.fontFamily || 'Inter',
            fontSize: config.fontSize || 12,
            showLegend: config.showLegend !== false,
            showGrid: config.showGrid !== false,
            smooth: config.smooth || false,
            axisXLabel: config.axisXLabel || '',
            axisYLabel: config.axisYLabel || '',
            yearStart: config.yearStart || null,
            yearEnd: config.yearEnd || null,
            dataCache: {},
        };
        this.panels.push(panel);
        this.renderGrid();
        this.saveToStorage();
        this._pushHistory();

        // If indicators passed, open chart type modal
        if (panel.indicators.length > 0 && !panel.chartType) {
            this.showChartTypeModal(panel.id);
        }
        return panel;
    },

    removePanel(id) {
        const chartEl = document.getElementById(`panel-chart-${id}`);
        if (chartEl) {
            const instance = echarts.getInstanceByDom(chartEl);
            if (instance) instance.dispose();
        }
        this.panels = this.panels.filter(p => p.id !== id);
        this.renderGrid();
        this.saveToStorage();
        this._pushHistory();
    },

    _resizePanel(id, colSpan) {
        const panel = this.panels.find(p => p.id === id);
        if (!panel) return;
        panel.colSpan = colSpan;

        const el = document.getElementById(`builder-panel-${id}`);
        if (el) {
            el.className = `builder-panel span-${colSpan}`;
            if (panel.rowSpan > 1) el.classList.add(`rows-${panel.rowSpan}`);
            // Update active size button
            el.querySelectorAll('.panel-size-btn').forEach(btn => {
                btn.classList.toggle('active-size', parseInt(btn.dataset.span) === colSpan);
            });
            // Resize chart
            const chartEl = document.getElementById(`panel-chart-${id}`);
            if (chartEl) {
                const instance = echarts.getInstanceByDom(chartEl);
                if (instance) setTimeout(() => instance.resize(), 100);
            }
        }
        this.saveToStorage();
        this._pushHistory();
    },

    _getPanel(id) {
        return this.panels.find(p => p.id === id);
    },

    // ── Drag & Drop ───────────────────────────────────────
    _onDragStart(e, panelId) {
        this.dragSrcId = panelId;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', panelId);
        document.getElementById('builder-grid')?.classList.add('dragging-active');
    },

    _onDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const panel = e.target.closest('.builder-panel');
        if (panel && parseInt(panel.dataset.panelId) !== this.dragSrcId) {
            panel.classList.add('drag-over');
        }
    },

    _onDrop(e, targetId) {
        e.preventDefault();
        const target = e.target.closest('.builder-panel');
        if (target) target.classList.remove('drag-over');

        if (this.dragSrcId === null || this.dragSrcId === targetId) return;

        const srcIdx = this.panels.findIndex(p => p.id === this.dragSrcId);
        const tgtIdx = this.panels.findIndex(p => p.id === targetId);
        if (srcIdx < 0 || tgtIdx < 0) return;

        // Swap positions
        const [moved] = this.panels.splice(srcIdx, 1);
        this.panels.splice(tgtIdx, 0, moved);

        this.renderGrid();
        this.saveToStorage();
        this._pushHistory();
    },

    _onDragEnd(e) {
        e.target.classList.remove('dragging');
        document.querySelectorAll('.builder-panel').forEach(p => p.classList.remove('drag-over'));
        document.getElementById('builder-grid')?.classList.remove('dragging-active');
        this.dragSrcId = null;
    },

    // ── Indicator Selection Modal ─────────────────────────
    showIndicatorModal(panelId) {
        this.activePanelId = panelId;
        const panel = this._getPanel(panelId);
        const existing = panel ? (panel.indicators || []).map(i => i.code) : [];

        const overlay = document.createElement('div');
        overlay.className = 'builder-modal-overlay';
        overlay.innerHTML = `
        <div class="builder-modal wide">
            <div class="modal-header">
                <h3><i class="fas fa-database"></i> Sélectionner les indicateurs</h3>
                <button class="modal-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <div class="indicator-picker-selected" id="modal-selected-tags"></div>
                <div class="indicator-picker-search">
                    <i class="fas fa-search"></i>
                    <input type="text" id="modal-indicator-search" placeholder="Rechercher un indicateur..." autofocus>
                </div>
                <div class="indicator-picker-list" id="modal-indicator-list"></div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn" id="modal-cancel-ind">Annuler</button>
                <button class="modal-btn primary" id="modal-confirm-ind">Valider la sélection</button>
            </div>
        </div>`;

        document.body.appendChild(overlay);

        // State
        const selected = new Map();
        existing.forEach(code => {
            const ind = this.allIndicators.find(i => i.code === code);
            if (ind) selected.set(code, ind);
        });

        const renderList = (query = '') => {
            const listEl = document.getElementById('modal-indicator-list');
            const q = query.toLowerCase();
            const filtered = q.length >= 2
                ? this.allIndicators.filter(ind =>
                    ind.name.toLowerCase().includes(q) ||
                    ind.code.toLowerCase().includes(q) ||
                    (ind.description || '').toLowerCase().includes(q)
                )
                : this.allIndicators;

            listEl.innerHTML = filtered.slice(0, 200).map(ind => `
                <div class="indicator-picker-item ${selected.has(ind.code) ? 'checked' : ''}" data-code="${ind.code}">
                    <input type="checkbox" ${selected.has(ind.code) ? 'checked' : ''} data-code="${ind.code}">
                    <span class="ind-name">${this._escHtml(ind.name)}</span>
                    <span class="ind-code">${ind.code}</span>
                </div>
            `).join('');

            listEl.querySelectorAll('.indicator-picker-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.tagName === 'INPUT') return;
                    const cb = item.querySelector('input[type="checkbox"]');
                    cb.checked = !cb.checked;
                    cb.dispatchEvent(new Event('change'));
                });
                const cb = item.querySelector('input[type="checkbox"]');
                cb.addEventListener('change', () => {
                    const code = cb.dataset.code;
                    if (cb.checked) {
                        const ind = this.allIndicators.find(i => i.code === code);
                        if (ind) selected.set(code, ind);
                        item.classList.add('checked');
                    } else {
                        selected.delete(code);
                        item.classList.remove('checked');
                    }
                    renderTags();
                });
            });
        };

        const renderTags = () => {
            const tagsEl = document.getElementById('modal-selected-tags');
            tagsEl.innerHTML = '';
            selected.forEach((ind, code) => {
                const tag = document.createElement('span');
                tag.className = 'indicator-tag';
                tag.innerHTML = `${this._escHtml(ind.name)} <span class="remove-tag" data-code="${code}">×</span>`;
                tag.querySelector('.remove-tag').addEventListener('click', () => {
                    selected.delete(code);
                    renderTags();
                    renderList(document.getElementById('modal-indicator-search').value);
                });
                tagsEl.appendChild(tag);
            });
        };

        renderList();
        renderTags();

        // Search
        document.getElementById('modal-indicator-search').addEventListener('input', (e) => {
            renderList(e.target.value);
        });

        // Close
        const close = () => overlay.remove();
        overlay.querySelector('.modal-close').addEventListener('click', close);
        document.getElementById('modal-cancel-ind').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        // Confirm
        document.getElementById('modal-confirm-ind').addEventListener('click', () => {
            if (selected.size === 0) return;
            const indicators = Array.from(selected.values());
            if (panel) {
                panel.indicators = indicators;
                // Fetch data then show chart type picker
                this._fetchPanelData(panel).then(() => {
                    close();
                    if (!panel.chartType) {
                        this.showChartTypeModal(panel.id);
                    } else {
                        this.renderGrid();
                        this._pushHistory();
                    }
                });
            } else {
                close();
                const newPanel = this.addPanel({ indicators });
                this._fetchPanelData(newPanel).then(() => {
                    this.showChartTypeModal(newPanel.id);
                });
            }
        });
    },

    // ── Chart Type Modal ──────────────────────────────────
    showChartTypeModal(panelId) {
        const panel = this._getPanel(panelId);
        if (!panel) return;
        this.activePanelId = panelId;

        let selectedType = panel.chartType || 'line';
        const multiSeries = panel.indicators && panel.indicators.length > 1;

        const overlay = document.createElement('div');
        overlay.className = 'builder-modal-overlay';
        overlay.innerHTML = `
        <div class="builder-modal wide">
            <div class="modal-header">
                <h3><i class="fas fa-chart-pie"></i> Choisir le type de graphique</h3>
                <button class="modal-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                ${multiSeries ? '<p style="font-size:.82rem;color:#64748b;margin:0 0 12px;">💡 <strong>Analyse croisée</strong> — Plusieurs indicateurs seront superposés sur le même repère.</p>' : ''}
                <div class="chart-type-grid" id="chart-type-grid"></div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn" id="modal-cancel-ct">Annuler</button>
                <button class="modal-btn primary" id="modal-confirm-ct">Appliquer</button>
            </div>
        </div>`;

        document.body.appendChild(overlay);

        const grid = document.getElementById('chart-type-grid');
        this.CHART_CATEGORIES.forEach(cat => {
            grid.innerHTML += `<div class="chart-type-category">${cat.label}</div>`;
            cat.types.forEach(t => {
                grid.innerHTML += `
                    <div class="chart-type-card ${t.id === selectedType ? 'selected' : ''}" data-type="${t.id}">
                        <span class="chart-icon">${t.icon}</span>
                        <span class="chart-label">${t.label}</span>
                        <span class="chart-desc">${t.desc}</span>
                    </div>`;
            });
        });

        grid.querySelectorAll('.chart-type-card').forEach(card => {
            card.addEventListener('click', () => {
                grid.querySelectorAll('.chart-type-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                selectedType = card.dataset.type;
            });
        });

        const close = () => overlay.remove();
        overlay.querySelector('.modal-close').addEventListener('click', close);
        document.getElementById('modal-cancel-ct').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        document.getElementById('modal-confirm-ct').addEventListener('click', () => {
            panel.chartType = selectedType;
            close();
            this.renderGrid();
            this.saveToStorage();
            this._pushHistory();
        });
    },

    // ── Customize Modal ───────────────────────────────────
    showCustomizeModal(panelId) {
        const panel = this._getPanel(panelId);
        if (!panel) return;

        const overlay = document.createElement('div');
        overlay.className = 'builder-modal-overlay';
        overlay.innerHTML = `
        <div class="builder-modal">
            <div class="modal-header">
                <h3><i class="fas fa-palette"></i> Personnaliser le graphique</h3>
                <button class="modal-close"><i class="fas fa-times"></i></button>
            </div>
            <div class="modal-body">
                <div class="customize-grid">
                    <div class="customize-group full-width">
                        <span class="customize-label">Titre du graphique</span>
                        <input class="customize-input" id="cust-title" value="${this._escHtml(panel.title || '')}">
                    </div>
                    <div class="customize-group">
                        <span class="customize-label">Titre axe X</span>
                        <input class="customize-input" id="cust-xaxis" value="${this._escHtml(panel.axisXLabel || '')}">
                    </div>
                    <div class="customize-group">
                        <span class="customize-label">Titre axe Y</span>
                        <input class="customize-input" id="cust-yaxis" value="${this._escHtml(panel.axisYLabel || '')}">
                    </div>
                    <div class="customize-group">
                        <span class="customize-label">Police</span>
                        <select class="customize-select" id="cust-font">
                            ${['Inter','Arial','Georgia','Courier New','Verdana','Trebuchet MS','Palatino','Garamond'].map(f =>
                                `<option value="${f}" ${panel.fontFamily === f ? 'selected' : ''}>${f}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="customize-group">
                        <span class="customize-label">Taille de police</span>
                        <input type="number" class="customize-input" id="cust-fontsize" value="${panel.fontSize || 12}" min="8" max="24">
                    </div>
                    <div class="customize-group">
                        <span class="customize-label">Afficher la légende</span>
                        <div class="customize-toggle">
                            <input type="checkbox" id="cust-legend" ${panel.showLegend ? 'checked' : ''}>
                            <label for="cust-legend">Oui</label>
                        </div>
                    </div>
                    <div class="customize-group">
                        <span class="customize-label">Afficher la grille</span>
                        <div class="customize-toggle">
                            <input type="checkbox" id="cust-grid" ${panel.showGrid ? 'checked' : ''}>
                            <label for="cust-grid">Oui</label>
                        </div>
                    </div>
                    <div class="customize-group">
                        <span class="customize-label">Courbes lissées</span>
                        <div class="customize-toggle">
                            <input type="checkbox" id="cust-smooth" ${panel.smooth ? 'checked' : ''}>
                            <label for="cust-smooth">Oui</label>
                        </div>
                    </div>
                    <div class="customize-group">
                        <span class="customize-label">Palette de couleurs</span>
                        <select class="customize-select" id="cust-palette">
                            <option value="">Personnalisée</option>
                            ${Object.keys(this.COLOR_PALETTES).map(k =>
                                `<option value="${k}">${k.charAt(0).toUpperCase() + k.slice(1)}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="customize-group full-width">
                        <span class="customize-label">Couleurs des séries</span>
                        <div class="series-color-list" id="cust-series-colors"></div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="modal-btn" id="modal-cancel-cust">Annuler</button>
                <button class="modal-btn primary" id="modal-confirm-cust">Appliquer</button>
            </div>
        </div>`;

        document.body.appendChild(overlay);

        // Render series color pickers
        const renderSeriesColors = () => {
            const container = document.getElementById('cust-series-colors');
            if (!container) return;
            container.innerHTML = '';
            (panel.indicators || []).forEach((ind, idx) => {
                const color = (panel.colors && panel.colors[idx]) || this.DEFAULT_COLORS[idx % this.DEFAULT_COLORS.length];
                const row = document.createElement('div');
                row.className = 'series-color-row';
                row.innerHTML = `
                    <span class="series-name">${this._escHtml(ind.name)}</span>
                    <div class="color-input-wrap">
                        <input type="color" value="${color}" data-idx="${idx}">
                    </div>
                `;
                container.appendChild(row);
            });
        };
        renderSeriesColors();

        // Palette change
        document.getElementById('cust-palette').addEventListener('change', (e) => {
            const pal = e.target.value;
            if (pal && this.COLOR_PALETTES[pal]) {
                panel.colors = [...this.COLOR_PALETTES[pal]];
                renderSeriesColors();
            }
        });

        const close = () => overlay.remove();
        overlay.querySelector('.modal-close').addEventListener('click', close);
        document.getElementById('modal-cancel-cust').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        document.getElementById('modal-confirm-cust').addEventListener('click', () => {
            panel.title = document.getElementById('cust-title').value;
            panel.axisXLabel = document.getElementById('cust-xaxis').value;
            panel.axisYLabel = document.getElementById('cust-yaxis').value;
            panel.fontFamily = document.getElementById('cust-font').value;
            panel.fontSize = parseInt(document.getElementById('cust-fontsize').value) || 12;
            panel.showLegend = document.getElementById('cust-legend').checked;
            panel.showGrid = document.getElementById('cust-grid').checked;
            panel.smooth = document.getElementById('cust-smooth').checked;

            // Collect series colors
            document.querySelectorAll('#cust-series-colors input[type="color"]').forEach(input => {
                const idx = parseInt(input.dataset.idx);
                if (!panel.colors) panel.colors = [...this.DEFAULT_COLORS];
                panel.colors[idx] = input.value;
            });

            close();
            this.renderGrid();
            this.saveToStorage();
            this._pushHistory();
        });
    },

    // ── Data Fetching ─────────────────────────────────────
    async _fetchPanelData(panel) {
        if (!panel.indicators || panel.indicators.length === 0) return;

        const promises = panel.indicators.map(async (ind) => {
            if (panel.dataCache[ind.code]) return;
            try {
                const res = await fetch(`/api/indicator/${ind.code}`);
                const data = await res.json();
                if (data.success && data.indicator) {
                    panel.dataCache[ind.code] = data.indicator;
                }
            } catch (e) {
                console.error(`Failed to fetch ${ind.code}:`, e);
            }
        });

        await Promise.all(promises);
    },

    // ── Chart Rendering ───────────────────────────────────
    renderChart(panelId) {
        const panel = this._getPanel(panelId);
        if (!panel || !panel.chartType || !panel.indicators?.length) return;

        const chartEl = document.getElementById(`panel-chart-${panelId}`);
        if (!chartEl) return;

        // Dispose existing
        let chart = echarts.getInstanceByDom(chartEl);
        if (chart) chart.dispose();

        chart = echarts.init(chartEl);
        const option = this._buildChartOption(panel);
        if (option) {
            chart.setOption(option);
        }

        // Auto-resize
        const observer = new ResizeObserver(() => chart.resize());
        observer.observe(chartEl);

        // Render sources
        this._renderSources(panel);
    },

    _buildChartOption(panel) {
        const type = panel.chartType;
        const raw = panel.indicators.map(ind => panel.dataCache[ind.code]).filter(Boolean);
        if (raw.length === 0) return null;

        // Filter out null/undefined values and apply year range
        const ys = panel.yearStart, ye = panel.yearEnd;
        const data = raw.map(d => ({
            ...d,
            values: (d.values || []).filter(v =>
                v.value !== null && v.value !== undefined &&
                (!ys || v.year >= ys) && (!ye || v.year <= ye)
            )
        })).filter(d => d.values.length > 0);
        if (data.length === 0) return null;

        const fontFamily = panel.fontFamily || 'Inter';
        const fontSize = panel.fontSize || 12;
        const colors = panel.colors || this.DEFAULT_COLORS;

        // Common text style
        const textStyle = { fontFamily, fontSize };

        // Title
        const title = {
            text: panel.title || panel.indicators.map(i => i.name).join(' / '),
            left: 'center',
            textStyle: { fontFamily, fontSize: fontSize + 2, fontWeight: 600, color: '#1a1a2e' },
            top: 8,
        };

        // Legend
        const legend = panel.showLegend && panel.indicators.length > 1 ? {
            bottom: 5,
            textStyle: { fontFamily, fontSize: fontSize - 1 },
            type: 'scroll',
        } : undefined;

        // Tooltip
        const tooltip = { trigger: 'axis', textStyle: { fontFamily } };

        switch (type) {
            case 'line': case 'area': case 'area_stacked': case 'step':
                return this._cartesianOption(panel, data, type, { title, legend, tooltip, textStyle, colors, fontFamily, fontSize });
            case 'bar': case 'bar_horizontal': case 'bar_grouped': case 'bar_stacked':
                return this._barOption(panel, data, type, { title, legend, tooltip, textStyle, colors, fontFamily, fontSize });
            case 'pie': case 'donut':
                return this._pieOption(panel, data, type, { title, legend, textStyle, colors, fontFamily, fontSize });
            case 'scatter': case 'bubble':
                return this._scatterOption(panel, data, type, { title, legend, tooltip, textStyle, colors, fontFamily, fontSize });
            case 'radar':
                return this._radarOption(panel, data, { title, legend, textStyle, colors, fontFamily, fontSize });
            case 'gauge':
                return this._gaugeOption(panel, data, { title, textStyle, colors, fontFamily, fontSize });
            case 'heatmap':
                return this._heatmapOption(panel, data, { title, textStyle, colors, fontFamily, fontSize });
            case 'treemap':
                return this._treemapOption(panel, data, { title, textStyle, colors, fontFamily, fontSize });
            case 'sunburst':
                return this._sunburstOption(panel, data, { title, textStyle, colors, fontFamily, fontSize });
            case 'funnel':
                return this._funnelOption(panel, data, { title, legend, textStyle, colors, fontFamily, fontSize });
            case 'boxplot':
                return this._boxplotOption(panel, data, { title, textStyle, colors, fontFamily, fontSize });
            case 'waterfall':
                return this._waterfallOption(panel, data, { title, tooltip, textStyle, colors, fontFamily, fontSize });
            case 'candlestick':
                return this._candlestickOption(panel, data, { title, tooltip, textStyle, colors, fontFamily, fontSize });
            case 'polar_bar':
                return this._polarBarOption(panel, data, { title, legend, textStyle, colors, fontFamily, fontSize });
            case 'sankey':
                return this._sankeyOption(panel, data, { title, textStyle, colors, fontFamily, fontSize });
            default:
                return this._cartesianOption(panel, data, 'line', { title, legend, tooltip, textStyle, colors, fontFamily, fontSize });
        }
    },

    // ── Chart Type Builders ───────────────────────────────

    _cartesianOption(panel, data, type, opts) {
        const years = data[0].values.map(v => v.year);
        const series = data.map((d, i) => {
            const base = {
                name: d.name,
                data: d.values.map(v => v.value),
                type: 'line',
                smooth: panel.smooth,
                itemStyle: { color: opts.colors[i % opts.colors.length] },
                lineStyle: { width: 2.5 },
            };
            if (type === 'area' || type === 'area_stacked') {
                base.areaStyle = { opacity: type === 'area_stacked' ? 0.8 : 0.3 };
                if (type === 'area_stacked') base.stack = 'total';
            }
            if (type === 'step') {
                base.step = 'middle';
            }
            return base;
        });

        const hasZoom = years.length > 8;
        return {
            title: opts.title,
            tooltip: { ...opts.tooltip, trigger: 'axis' },
            legend: opts.legend,
            color: opts.colors,
            textStyle: opts.textStyle,
            grid: { left: 60, right: 30, top: 50, bottom: hasZoom ? 75 : (panel.showLegend && data.length > 1 ? 60 : 35), containLabel: false },
            dataZoom: hasZoom ? [
                { type: 'slider', start: 0, end: 100, bottom: panel.showLegend && data.length > 1 ? 30 : 5, height: 18, borderColor: 'transparent', backgroundColor: '#f1f3f5', fillerColor: 'rgba(255,107,0,.15)', handleStyle: { color: '#FF6B00' } },
                { type: 'inside' },
            ] : [{ type: 'inside' }],
            xAxis: {
                type: 'category',
                data: years,
                name: panel.axisXLabel || '',
                nameLocation: 'center',
                nameGap: 28,
                axisLabel: { fontFamily: opts.fontFamily, fontSize: opts.fontSize - 1 },
                splitLine: { show: panel.showGrid },
            },
            yAxis: {
                type: 'value',
                name: panel.axisYLabel || '',
                nameLocation: 'center',
                nameGap: 50,
                axisLabel: { fontFamily: opts.fontFamily, fontSize: opts.fontSize - 1 },
                splitLine: { show: panel.showGrid },
            },
            series,
        };
    },

    _barOption(panel, data, type, opts) {
        const years = data[0].values.map(v => v.year);
        const isHorizontal = type === 'bar_horizontal';
        const isStacked = type === 'bar_stacked';

        const series = data.map((d, i) => ({
            name: d.name,
            data: d.values.map(v => v.value),
            type: 'bar',
            stack: isStacked ? 'total' : undefined,
            barMaxWidth: 40,
            itemStyle: {
                color: opts.colors[i % opts.colors.length],
                borderRadius: isStacked ? 0 : [3, 3, 0, 0],
            },
        }));

        const catAxis = {
            type: 'category',
            data: years,
            name: panel.axisXLabel || '',
            axisLabel: { fontFamily: opts.fontFamily, fontSize: opts.fontSize - 1 },
        };
        const valAxis = {
            type: 'value',
            name: panel.axisYLabel || '',
            axisLabel: { fontFamily: opts.fontFamily, fontSize: opts.fontSize - 1 },
            splitLine: { show: panel.showGrid },
        };

        const hasZoom = years.length > 8 && !isHorizontal;
        return {
            title: opts.title,
            tooltip: { ...opts.tooltip, trigger: 'axis' },
            legend: opts.legend,
            color: opts.colors,
            textStyle: opts.textStyle,
            grid: { left: 60, right: 30, top: 50, bottom: hasZoom ? 75 : (panel.showLegend && data.length > 1 ? 60 : 35) },
            dataZoom: hasZoom ? [
                { type: 'slider', start: 0, end: 100, bottom: panel.showLegend && data.length > 1 ? 30 : 5, height: 18, borderColor: 'transparent', backgroundColor: '#f1f3f5', fillerColor: 'rgba(255,107,0,.15)', handleStyle: { color: '#FF6B00' } },
                { type: 'inside' },
            ] : [{ type: 'inside' }],
            xAxis: isHorizontal ? valAxis : catAxis,
            yAxis: isHorizontal ? catAxis : valAxis,
            series,
        };
    },

    _pieOption(panel, data, type, opts) {
        const d = data[0];
        // Use last N years as segments, or if multi-indicator use latest value per indicator
        let pieData;
        if (data.length > 1) {
            pieData = data.map((d, i) => {
                const lastVal = d.values[d.values.length - 1];
                return { name: d.name, value: Math.abs(lastVal?.value || 0) };
            });
        } else {
            const vals = d.values.slice(-10);
            pieData = vals.map(v => ({ name: String(v.year), value: Math.abs(v.value) }));
        }

        return {
            title: opts.title,
            tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
            legend: { bottom: 5, type: 'scroll', textStyle: { fontFamily: opts.fontFamily, fontSize: opts.fontSize - 1 } },
            color: opts.colors,
            textStyle: opts.textStyle,
            series: [{
                type: 'pie',
                radius: type === 'donut' ? ['40%', '70%'] : '70%',
                center: ['50%', '50%'],
                data: pieData,
                label: { fontFamily: opts.fontFamily, fontSize: opts.fontSize - 1 },
                emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,.2)' } },
            }],
        };
    },

    _scatterOption(panel, data, type, opts) {
        let series;
        if (data.length >= 2) {
            // Cross analysis: X = first indicator, Y = second indicator
            const d1 = data[0], d2 = data[1];
            const years1 = new Map(d1.values.map(v => [v.year, v.value]));
            const points = d2.values
                .filter(v => years1.has(v.year))
                .map(v => [years1.get(v.year), v.value, v.year]);

            series = [{
                type: 'scatter',
                data: points.map(p => type === 'bubble' ? [p[0], p[1], Math.abs(p[1]) / 10] : [p[0], p[1]]),
                symbolSize: type === 'bubble' ? (val) => Math.max(8, Math.min(40, val[2])) : 10,
                label: { show: true, formatter: (p) => points[p.dataIndex]?.[2] || '', position: 'top', fontSize: 9 },
                itemStyle: { color: opts.colors[0] },
            }];

            return {
                title: opts.title,
                tooltip: {
                    formatter: (p) => {
                        const pt = points[p.dataIndex];
                        return `${pt?.[2]}<br>${d1.name}: ${p.value[0]}<br>${d2.name}: ${p.value[1]}`;
                    }
                },
                color: opts.colors,
                textStyle: opts.textStyle,
                grid: { left: 60, right: 30, top: 50, bottom: 35 },
                xAxis: { type: 'value', name: panel.axisXLabel || d1.name, nameLocation: 'center', nameGap: 28, splitLine: { show: panel.showGrid } },
                yAxis: { type: 'value', name: panel.axisYLabel || d2.name, nameLocation: 'center', nameGap: 50, splitLine: { show: panel.showGrid } },
                series,
            };
        } else {
            const d = data[0];
            series = [{
                type: 'scatter',
                data: d.values.map(v => [v.year, v.value]),
                symbolSize: 10,
                itemStyle: { color: opts.colors[0] },
            }];
            return {
                title: opts.title,
                tooltip: opts.tooltip,
                color: opts.colors,
                textStyle: opts.textStyle,
                grid: { left: 60, right: 30, top: 50, bottom: 35 },
                xAxis: { type: 'value', name: panel.axisXLabel || 'Année', splitLine: { show: panel.showGrid } },
                yAxis: { type: 'value', name: panel.axisYLabel || d.name, splitLine: { show: panel.showGrid } },
                series,
            };
        }
    },

    _radarOption(panel, data, opts) {
        // Use last 5 years as dimensions
        const d = data[0];
        const lastVals = d.values.slice(-8);
        const maxVal = Math.max(...lastVals.map(v => Math.abs(v.value)));

        const indicator = lastVals.map(v => ({ name: String(v.year), max: maxVal * 1.2 }));
        const seriesData = data.map((d, i) => ({
            name: d.name,
            value: d.values.slice(-8).map(v => v.value),
            areaStyle: { opacity: 0.15 },
            lineStyle: { color: opts.colors[i % opts.colors.length] },
            itemStyle: { color: opts.colors[i % opts.colors.length] },
        }));

        return {
            title: opts.title,
            legend: opts.legend,
            color: opts.colors,
            textStyle: opts.textStyle,
            tooltip: {},
            radar: { indicator, shape: 'polygon' },
            series: [{ type: 'radar', data: seriesData }],
        };
    },

    _gaugeOption(panel, data, opts) {
        const d = data[0];
        const lastVal = d.values[d.values.length - 1];
        const vals = d.values.map(v => v.value);
        const min = Math.min(...vals);
        const max = Math.max(...vals);

        return {
            title: opts.title,
            textStyle: opts.textStyle,
            series: [{
                type: 'gauge',
                min: Math.floor(min * 0.8),
                max: Math.ceil(max * 1.2),
                detail: { formatter: '{value}', fontFamily: opts.fontFamily, fontSize: opts.fontSize + 6, color: opts.colors[0] },
                data: [{ value: lastVal?.value?.toFixed(2) || 0, name: lastVal?.year || '' }],
                axisLine: {
                    lineStyle: {
                        width: 15,
                        color: [[0.3, '#67e0e3'], [0.7, opts.colors[0]], [1, '#fd666d']],
                    }
                },
                pointer: { width: 5 },
            }],
        };
    },

    _heatmapOption(panel, data, opts) {
        // X = years, Y = indicators, value = normalized
        const years = [...new Set(data.flatMap(d => d.values.map(v => v.year)))].sort();
        const names = data.map(d => d.name);
        const heatData = [];
        data.forEach((d, yi) => {
            const vals = d.values.map(v => v.value);
            const min = Math.min(...vals), max = Math.max(...vals);
            const range = max - min || 1;
            d.values.forEach(v => {
                const xi = years.indexOf(v.year);
                if (xi >= 0) heatData.push([xi, yi, +((v.value - min) / range).toFixed(2)]);
            });
        });

        return {
            title: opts.title,
            tooltip: { position: 'top' },
            textStyle: opts.textStyle,
            grid: { left: 120, right: 30, top: 50, bottom: 35 },
            xAxis: { type: 'category', data: years, splitArea: { show: true } },
            yAxis: { type: 'category', data: names, splitArea: { show: true } },
            visualMap: { min: 0, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 5, inRange: { color: ['#f8f9fb', opts.colors[0]] } },
            series: [{ type: 'heatmap', data: heatData, label: { show: false } }],
        };
    },

    _treemapOption(panel, data, opts) {
        const treeData = data.map((d, i) => {
            const lastVal = d.values[d.values.length - 1];
            return {
                name: d.name,
                value: Math.abs(lastVal?.value || 0),
                itemStyle: { color: opts.colors[i % opts.colors.length] },
            };
        });
        if (treeData.length === 1) {
            const d = data[0];
            const vals = d.values.slice(-10);
            treeData.length = 0;
            vals.forEach((v, i) => {
                treeData.push({
                    name: String(v.year),
                    value: Math.abs(v.value),
                    itemStyle: { color: opts.colors[i % opts.colors.length] },
                });
            });
        }
        return {
            title: opts.title,
            tooltip: { formatter: '{b}: {c}' },
            textStyle: opts.textStyle,
            series: [{
                type: 'treemap',
                data: treeData,
                label: { fontFamily: opts.fontFamily, fontSize: opts.fontSize - 1 },
                breadcrumb: { show: false },
            }],
        };
    },

    _sunburstOption(panel, data, opts) {
        const children = data.map((d, i) => {
            const lastVals = d.values.slice(-5);
            return {
                name: d.name,
                itemStyle: { color: opts.colors[i % opts.colors.length] },
                children: lastVals.map(v => ({ name: String(v.year), value: Math.abs(v.value) })),
            };
        });
        return {
            title: opts.title,
            textStyle: opts.textStyle,
            series: [{
                type: 'sunburst',
                data: children,
                radius: ['15%', '80%'],
                label: { fontFamily: opts.fontFamily, fontSize: opts.fontSize - 2, rotate: 'tangential' },
            }],
        };
    },

    _funnelOption(panel, data, opts) {
        let funnelData;
        if (data.length > 1) {
            funnelData = data.map((d, i) => ({
                name: d.name,
                value: Math.abs(d.values[d.values.length - 1]?.value || 0),
            })).sort((a, b) => b.value - a.value);
        } else {
            const vals = data[0].values.slice(-8);
            funnelData = vals.map(v => ({ name: String(v.year), value: Math.abs(v.value) })).sort((a, b) => b.value - a.value);
        }
        return {
            title: opts.title,
            tooltip: { trigger: 'item', formatter: '{b}: {c}' },
            legend: { bottom: 5, type: 'scroll', textStyle: { fontFamily: opts.fontFamily } },
            color: opts.colors,
            textStyle: opts.textStyle,
            series: [{
                type: 'funnel',
                data: funnelData,
                label: { fontFamily: opts.fontFamily, fontSize: opts.fontSize - 1, position: 'inside' },
                gap: 2,
            }],
        };
    },

    _boxplotOption(panel, data, opts) {
        const names = data.map(d => d.name);
        const boxData = data.map(d => {
            const vals = d.values.map(v => v.value).sort((a, b) => a - b);
            const q1 = vals[Math.floor(vals.length * 0.25)];
            const q2 = vals[Math.floor(vals.length * 0.5)];
            const q3 = vals[Math.floor(vals.length * 0.75)];
            const min = vals[0];
            const max = vals[vals.length - 1];
            return [min, q1, q2, q3, max];
        });
        return {
            title: opts.title,
            tooltip: {},
            textStyle: opts.textStyle,
            grid: { left: 60, right: 30, top: 50, bottom: 35 },
            xAxis: { type: 'category', data: names, axisLabel: { fontSize: opts.fontSize - 1, rotate: names.length > 4 ? 30 : 0 } },
            yAxis: { type: 'value', splitLine: { show: panel.showGrid } },
            series: [{
                type: 'boxplot',
                data: boxData,
                itemStyle: { color: opts.colors[0], borderColor: opts.colors[1] || '#333' },
            }],
        };
    },

    _waterfallOption(panel, data, opts) {
        const d = data[0];
        const vals = d.values;
        const years = vals.map(v => String(v.year));
        const values = vals.map(v => v.value);

        // Build waterfall: base (invisible) + positive + negative
        const baseData = [], posData = [], negData = [];
        let running = 0;

        values.forEach((val, i) => {
            if (i === 0) {
                baseData.push(0);
                posData.push(val);
                negData.push('-');
                running = val;
            } else {
                const diff = val - values[i - 1];
                if (diff >= 0) {
                    baseData.push(running);
                    posData.push(diff);
                    negData.push('-');
                } else {
                    baseData.push(running + diff);
                    posData.push('-');
                    negData.push(Math.abs(diff));
                }
                running = val;
            }
        });

        return {
            title: opts.title,
            tooltip: opts.tooltip,
            textStyle: opts.textStyle,
            color: opts.colors,
            grid: { left: 60, right: 30, top: 50, bottom: 35 },
            xAxis: { type: 'category', data: years },
            yAxis: { type: 'value', splitLine: { show: panel.showGrid } },
            series: [
                { type: 'bar', stack: 'waterfall', data: baseData, itemStyle: { color: 'transparent' }, emphasis: { itemStyle: { color: 'transparent' } } },
                { type: 'bar', stack: 'waterfall', name: 'Hausse', data: posData, itemStyle: { color: opts.colors[0] || '#00B894' } },
                { type: 'bar', stack: 'waterfall', name: 'Baisse', data: negData, itemStyle: { color: opts.colors[1] || '#E17055' } },
            ],
        };
    },

    _candlestickOption(panel, data, opts) {
        // Simulate OHLC from yearly data: use rolling 4 values
        const d = data[0];
        const vals = d.values;
        const years = [];
        const ohlc = [];
        for (let i = 3; i < vals.length; i++) {
            years.push(String(vals[i].year));
            const window = [vals[i-3].value, vals[i-2].value, vals[i-1].value, vals[i].value];
            ohlc.push([window[0], window[3], Math.min(...window), Math.max(...window)]);
        }
        return {
            title: opts.title,
            tooltip: opts.tooltip,
            textStyle: opts.textStyle,
            grid: { left: 60, right: 30, top: 50, bottom: 35 },
            xAxis: { type: 'category', data: years },
            yAxis: { type: 'value', splitLine: { show: panel.showGrid } },
            series: [{
                type: 'candlestick',
                data: ohlc,
                itemStyle: { color: opts.colors[0] || '#00B894', color0: opts.colors[1] || '#E17055', borderColor: opts.colors[0], borderColor0: opts.colors[1] },
            }],
        };
    },

    _polarBarOption(panel, data, opts) {
        const d = data[0];
        const lastVals = d.values.slice(-10);
        return {
            title: opts.title,
            tooltip: {},
            textStyle: opts.textStyle,
            angleAxis: { type: 'category', data: lastVals.map(v => String(v.year)) },
            radiusAxis: {},
            polar: {},
            series: [{
                type: 'bar',
                data: lastVals.map((v, i) => ({ value: v.value, itemStyle: { color: opts.colors[i % opts.colors.length] } })),
                coordinateSystem: 'polar',
            }],
        };
    },

    _sankeyOption(panel, data, opts) {
        // Build links from first indicator years to second indicator years
        if (data.length < 2) {
            return this._cartesianOption(panel, data, 'line', opts);
        }
        const d1 = data[0], d2 = data[1];
        const lastVals = d1.values.slice(-5);
        const nodes = [];
        const links = [];
        lastVals.forEach(v => {
            const srcName = `${d1.name} ${v.year}`;
            const tgtName = `${d2.name} ${v.year}`;
            const d2Val = d2.values.find(v2 => v2.year === v.year);
            nodes.push({ name: srcName });
            nodes.push({ name: tgtName });
            links.push({ source: srcName, target: tgtName, value: Math.abs(d2Val?.value || v.value) });
        });
        return {
            title: opts.title,
            tooltip: { trigger: 'item' },
            textStyle: opts.textStyle,
            color: opts.colors,
            series: [{
                type: 'sankey',
                data: nodes,
                links,
                label: { fontSize: opts.fontSize - 2 },
                lineStyle: { color: 'gradient', curveness: 0.5 },
            }],
        };
    },

    // ── Download ──────────────────────────────────────────
    // Matches the home-page AI chart download watermark style:
    // single centered diagonal text + subtle footer branding
    _addWatermark(canvas) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;

        // Single centered diagonal watermark (same as home-v2.js)
        ctx.save();
        ctx.fillStyle = 'rgba(255, 107, 0, 0.07)';
        ctx.font = 'bold 60px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.translate(w / 2, h / 2);
        ctx.rotate(-Math.PI / 6);
        ctx.fillText('Ask For Data', 0, 0);
        ctx.restore();

        // Subtle footer branding (same as home-v2.js)
        ctx.fillStyle = '#D1D5DB';
        ctx.font = 'bold 10px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('Ask For Data \u2014 askfordata.ci', w - 15, h - 10);
    },

    async downloadChart(panelId) {
        const panel = this._getPanel(panelId);
        if (!panel) return;
        const chartEl = document.getElementById(`panel-chart-${panelId}`);
        if (!chartEl) return;

        const instance = echarts.getInstanceByDom(chartEl);
        if (!instance) return;

        const indicatorName = panel.title || panel.indicators?.map(i => i.name).join(' / ') || 'Graphique';

        // Get chart as base64
        const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const padding = { top: 70, bottom: 50, left: 20, right: 20 };
            const canvas = document.createElement('canvas');
            canvas.width = img.width + padding.left + padding.right;
            canvas.height = img.height + padding.top + padding.bottom;
            const ctx = canvas.getContext('2d');

            // White background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Title
            ctx.fillStyle = '#1F2937';
            ctx.font = 'bold 16px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(indicatorName, canvas.width / 2, 28);

            // Subtitle (period)
            const allYears = panel.indicators
                .map(i => panel.dataCache[i.code])
                .filter(Boolean)
                .flatMap(d => (d.values || []).map(v => v.year));
            if (allYears.length) {
                ctx.fillStyle = '#6B7280';
                ctx.font = '12px Inter, sans-serif';
                ctx.fillText(`${Math.min(...allYears)} \u2014 ${Math.max(...allYears)}`, canvas.width / 2, 48);
            }

            // Draw the chart
            ctx.drawImage(img, padding.left, padding.top);

            // Source line
            const sources = [];
            panel.indicators.forEach(ind => {
                const cached = panel.dataCache[ind.code];
                if (cached) {
                    const src = cached.source_link || cached.source || '';
                    if (src && !sources.includes(src)) sources.push(src);
                }
            });
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(sources.length ? `Source : ${sources.join(', ')}` : 'Source : Banque Mondiale / ANStat', padding.left, canvas.height - 30);

            // Watermark (same as home page)
            this._addWatermark(canvas);

            const link = document.createElement('a');
            link.download = `Ask_For_Data_${indicatorName.replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, '').trim().replace(/\s+/g, '_')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        img.src = url;
    },

    async downloadDashboard() {
        const grid = document.getElementById('builder-grid');
        if (!grid || this.panels.length === 0) return;

        try {
            const html2canvas = window.html2canvas;
            if (!html2canvas) {
                alert('html2canvas non disponible. Veuillez recharger la page.');
                return;
            }

            const canvas = await html2canvas(grid, {
                scale: 2,
                backgroundColor: '#f8f9fb',
                logging: false,
                useCORS: true,
                allowTaint: true,
                width: grid.scrollWidth,
                height: grid.scrollHeight,
            });

            // Add padding for title + footer
            const final = document.createElement('canvas');
            final.width = canvas.width;
            final.height = canvas.height + 90;
            const ctx = final.getContext('2d');

            // White background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, final.width, final.height);

            // Title
            ctx.fillStyle = '#1F2937';
            ctx.font = 'bold 20px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Dashboard personnalis\u00e9', final.width / 2, 30);

            // Subtitle / date
            ctx.fillStyle = '#6B7280';
            ctx.font = '12px Inter, sans-serif';
            ctx.fillText(new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }), final.width / 2, 50);

            // Draw grid snapshot
            ctx.drawImage(canvas, 0, 60);

            // Watermark (same as home page)
            this._addWatermark(final);

            const link = document.createElement('a');
            link.download = `Ask_For_Data_Dashboard_${new Date().toISOString().slice(0, 10)}.png`;
            link.href = final.toDataURL('image/png');
            link.click();
        } catch (e) {
            console.error('Download failed:', e);
            alert('Erreur lors du t\u00e9l\u00e9chargement. R\u00e9essayez.');
        }
    },

    // ── Sources ───────────────────────────────────────────
    _renderSources(panel) {
        const footer = document.getElementById(`panel-footer-${panel.id}`);
        if (!footer) return;

        const sources = [];
        panel.indicators.forEach(ind => {
            const cached = panel.dataCache[ind.code];
            if (cached) {
                const src = cached.source_link || cached.source || '';
                if (src && !sources.includes(src)) sources.push(src);
            }
        });

        if (sources.length > 0) {
            footer.innerHTML = `<i class="fas fa-link" style="margin-right:4px"></i> Sources : ${sources.map(s =>
                s.startsWith('http') ? `<a href="${s}" target="_blank" rel="noopener">${new URL(s).hostname}</a>` : s
            ).join(', ')}`;
        } else {
            footer.innerHTML = '<i class="fas fa-link" style="margin-right:4px"></i> Source : Banque Mondiale / Données nationales';
        }
    },

    // ── Sidebar Assign ────────────────────────────────────
    assignSidebarToPanel() {
        const codes = this._getSelectedSidebarCodes();
        if (codes.length === 0) return;

        const indicators = codes.map(code => this.allIndicators.find(i => i.code === code)).filter(Boolean);

        // Find active panel or create a new one
        let targetPanel = null;
        if (this.activePanelId) {
            targetPanel = this._getPanel(this.activePanelId);
        }

        if (!targetPanel) {
            targetPanel = this.addPanel({ indicators });
        } else {
            targetPanel.indicators = indicators;
        }

        this._fetchPanelData(targetPanel).then(() => {
            this._clearSidebarSelection();
            if (!targetPanel.chartType) {
                this.showChartTypeModal(targetPanel.id);
            } else {
                this.renderGrid();
            }
        });
    },

    // ── Persistence ───────────────────────────────────────
    saveToStorage() {
        try {
            const serializable = this.panels.map(p => ({
                id: p.id,
                colSpan: p.colSpan,
                rowSpan: p.rowSpan,
                indicators: (p.indicators || []).map(i => ({ code: i.code, name: i.name })),
                chartType: p.chartType,
                title: p.title,
                colors: p.colors,
                fontFamily: p.fontFamily,
                fontSize: p.fontSize,
                showLegend: p.showLegend,
                showGrid: p.showGrid,
                smooth: p.smooth,
                axisXLabel: p.axisXLabel,
                axisYLabel: p.axisYLabel,
                yearStart: p.yearStart,
                yearEnd: p.yearEnd,
            }));
            localStorage.setItem('dashboardBuilder', JSON.stringify({
                panels: serializable,
                nextPanelId: this.nextPanelId,
            }));
        } catch (e) {
            console.warn('Failed to save dashboard:', e);
        }
    },

    loadFromStorage() {
        try {
            const raw = localStorage.getItem('dashboardBuilder');
            if (!raw) return;
            const saved = JSON.parse(raw);
            if (saved.panels && saved.panels.length > 0) {
                this.nextPanelId = saved.nextPanelId || 1;
                this.panels = saved.panels.map(p => ({
                    ...p,
                    dataCache: {},
                }));
                // Fetch all data then render
                Promise.all(this.panels.map(p => this._fetchPanelData(p))).then(() => {
                    this.renderGrid();
                });
            }
        } catch (e) {
            console.warn('Failed to load dashboard:', e);
        }
    },

    resetDashboard() {
        this.panels.forEach(p => {
            const chartEl = document.getElementById(`panel-chart-${p.id}`);
            if (chartEl) {
                const instance = echarts.getInstanceByDom(chartEl);
                if (instance) instance.dispose();
            }
        });
        this.panels = [];
        this.nextPanelId = 1;
        this.activePanelId = null;
        localStorage.removeItem('dashboardBuilder');
        this.renderGrid();
    },

    // ── Events ────────────────────────────────────────────
    bindEvents() {
        // Sidebar search
        const searchInput = document.getElementById('builder-sidebar-search');
        if (searchInput) {
            let timeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => this.filterSidebar(searchInput.value), 200);
            });
        }

        // Assign button
        const assignBtn = document.getElementById('builder-assign-btn');
        if (assignBtn) {
            assignBtn.addEventListener('click', () => this.assignSidebarToPanel());
        }

        // Clear button
        const clearBtn = document.getElementById('builder-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this._clearSidebarSelection());
        }

        // Toolbar: add panel
        document.getElementById('builder-add-panel-btn')?.addEventListener('click', () => this.addPanel());

        // Toolbar: reset
        document.getElementById('builder-reset-btn')?.addEventListener('click', () => {
            if (confirm('Réinitialiser le dashboard ? Toutes les modifications seront perdues.')) {
                this.resetDashboard();
            }
        });

        // Toolbar: toggle sidebar
        document.getElementById('builder-toggle-sidebar')?.addEventListener('click', () => {
            const sb = document.getElementById('builder-sidebar');
            if (!sb) return;
            sb.classList.toggle('collapsed');
            if (sb.classList.contains('collapsed')) {
                sb.style.width = '0px';
            } else {
                sb.style.width = this._sidebarWidth + 'px';
            }
            setTimeout(() => {
                this.panels.forEach(p => {
                    const chartEl = document.getElementById(`panel-chart-${p.id}`);
                    if (chartEl) { const inst = echarts.getInstanceByDom(chartEl); if (inst) inst.resize(); }
                });
            }, 350);
        });

        // Toolbar: undo / redo
        document.getElementById('builder-undo-btn')?.addEventListener('click', () => this.undo());
        document.getElementById('builder-redo-btn')?.addEventListener('click', () => this.redo());

        // Toolbar: download dashboard
        document.getElementById('builder-download-btn')?.addEventListener('click', () => this.downloadDashboard());

        // Keyboard shortcuts: Ctrl+Z = undo, Ctrl+Y / Ctrl+Shift+Z = redo
        document.addEventListener('keydown', (e) => {
            // Only when builder is visible
            const section = document.getElementById('section-custom-dashboard');
            if (!section || section.classList.contains('hidden')) return;
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                this.redo();
            }
        });

        // Window resize → resize all charts
        window.addEventListener('resize', () => {
            this.panels.forEach(p => {
                const chartEl = document.getElementById(`panel-chart-${p.id}`);
                if (chartEl) {
                    const instance = echarts.getInstanceByDom(chartEl);
                    if (instance) instance.resize();
                }
            });
        });
    },

    // ── Helpers ────────────────────────────────────────────
    _escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    },

    _safeNum(v, fallback = 0) {
        return (v !== null && v !== undefined && isFinite(v)) ? v : fallback;
    },
};
