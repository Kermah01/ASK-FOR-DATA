/**
 * Dashboard V3 - Executive Logic
 * Comprehensive Chart Rendering & Data Management
 */

const DashboardV3 = {
    charts: {},
    map: null,
    mapLayerGroup: null,
    
    // Mock Data for Map
    mapData: [
        { pos: [5.36, -4.01], title: "Métro d'Abidjan", type: "infra", category: "Transport", status: "En cours", budget: "1 364 Mrd", progress: 45 },
        { pos: [6.82, -5.27], title: "Technopole Yamoussoukro", type: "tech", category: "Innovation", status: "Planification", budget: "450 Mrd", progress: 15 },
        { pos: [4.75, -6.64], title: "Port de San-Pédro (Extension)", type: "infra", category: "Transport", status: "Livré", budget: "600 Mrd", progress: 100 },
        { pos: [9.45, -5.63], title: "Zone Agro-Industrielle Korhogo", type: "agri", category: "Industrie", status: "En cours", budget: "85 Mrd", progress: 60 },
        { pos: [5.30, -3.90], title: "Centrale Solaire Assinie", type: "energy", category: "Énergie", status: "En cours", budget: "25 Mrd", progress: 30 },
        { pos: [7.54, -5.55], title: "Barrage de Soubré", type: "energy", category: "Énergie", status: "Livré", budget: "331 Mrd", progress: 100 },
        { pos: [6.13, -3.97], title: "Stade d'Ebimpé", type: "infra", category: "Sport", status: "Livré", budget: "143 Mrd", progress: 100 },
        { pos: [8.03, -7.03], title: "Mine d'Or Ity", type: "agri", category: "Mines", status: "Extension", budget: "Private", progress: 80 }
    ],

    // Theme Colors (Côte d'Ivoire Identity)
    colors: {
        orange: '#FF8200',
        white: '#FFFFFF',
        green: '#009A44',
        slate: '#1F2937',
        gray: '#6B7280',
        blue: '#3b82f6',
        purple: '#8b5cf6',
        red: '#ef4444'
    },

    dbData: null, // Real data from API

    init() {
        console.log("Dashboard V3 Initializing...");
        this.setupNavigation();
        this.setupFilters();
        this.setupMobileMenu();
        this.setupSidebarSearch();

        // Fetch real data from API then render
        fetch('/api/dashboard-data')
            .then(r => r.json())
            .then(data => {
                this.dbData = data;
                console.log("Dashboard data loaded from API", data);
                this.loadOverviewData();
                this.renderMiniCharts();
                const activeSection = document.querySelector('.sidebar-item.active');
                if(activeSection) {
                    const targetId = activeSection.getAttribute('data-target');
                    this.handleSectionChange(targetId);
                }
            })
            .catch(err => {
                console.error("Failed to fetch dashboard data:", err);
                // Fallback: render with defaults
                this.loadOverviewData();
                this.renderMiniCharts();
            });

        window.addEventListener('resize', () => this.resizeAll());
    },

    resizeAll() {
        Object.values(this.charts).forEach(c => c && c.resize());
        if(this.map) this.map.invalidateSize();
    },

    renderMiniCharts() {
        // Macro - real data from DB
        this.createMiniChart('mini-macro-1', this.sv('gdp_growth', 6) || [6.2, 2.0, 7.4, 6.7, 6.5, 5.9], 'line', this.colors.orange);
        this.createMiniChart('mini-macro-2', this.sv('inflation', 6) || [0.8, 2.4, 4.2, 5.2, 4.4, 3.5], 'bar', this.colors.slate);
        this.createMiniChart('mini-macro-3', this.sv('fdi_pct', 5) || [1.1, 1.4, 1.9, 2.3, 2.2], 'line', this.colors.purple);
        this.createMiniChart('mini-macro-4', this.sv('exports_pct', 4) || [21, 22, 24, 28], 'bar', this.colors.green);

        // Finance - real data from TOFE/financements
        this.createMiniChart('mini-fin-1', this.nv('solde_budgetaire_pct_pib') || [-2.9, -2.2, -5.4, -4.9, -6.7], 'bar', this.colors.red);
        this.createMiniChart('mini-fin-2', this.nv('recettes_et_dons', 5) || [4764, 5158, 5289, 6140, 6684], 'line', this.colors.green);
        this.createMiniChart('mini-fin-3', this.nv('depenses_totales', 5) || [5708, 5944, 7255, 8102, 9666], 'line', this.colors.slate);
        this.createMiniChart('mini-fin-4', this.nv('dette_pct_pib_fin') || [46.3, 50.2, 56.6, 58.1], 'bar', this.colors.orange);

        // Demo - real data
        this.createMiniChart('mini-demo-1', this.sv('fertility', 5) || [5.0, 4.9, 4.5, 4.4, 4.3], 'bar', this.colors.blue);
        this.createMiniChart('mini-demo-2', this.sv('urban_pct', 5) || [49.4, 50.3, 51.2, 52.2, 53.6], 'line', this.colors.orange);
        this.createMiniChart('mini-demo-3', this.sv('pop_growth', 4) || [2.5, 2.5, 2.5, 2.4], 'line', this.colors.green);
        this.createMiniChart('mini-demo-4', this.sv('birth_rate', 4) || [34, 33, 32, 32], 'bar', this.colors.purple);

        // Primary - real data from base éco
        this.createMiniChart('mini-prim-1', this.nv('cacao_production', 5) || [2154000, 2180000, 2105000, 2248000, 2200000], 'bar', this.colors.orange);
        this.createMiniChart('mini-prim-2', this.nv('cacao_taux_transfo', 5) || [30, 32, 34, 33, 35], 'line', this.colors.green);
        this.createMiniChart('mini-prim-3', this.nv('pib_primaire_pct', 5) || [17.9, 15.7, 16.9, 16.2, 16.6], 'line', this.colors.blue);
        this.createMiniChart('mini-prim-4', this.sv('arable_land_pct', 4) || [12.5, 13.0, 13.4, 13.5], 'bar', this.colors.slate);

        // Secondary - real data where available
        this.createMiniChart('mini-sec-1', this.sv('electricity_consumption', 4) || [250, 280, 310, 324], 'line', this.colors.orange);
        this.createMiniChart('mini-sec-2', this.sv('electricity_access', 4) || [69, 71, 72, 72], 'bar', this.colors.blue);
        this.createMiniChart('mini-sec-3', [8, 10, 15, 12], 'line', this.colors.slate);
        this.createMiniChart('mini-sec-4', [20, 25, 30, 45], 'bar', this.colors.purple);

        // Tertiary - real data where available
        this.createMiniChart('mini-tert-1', this.sv('internet_users', 4) || [36, 36, 38, 41], 'line', this.colors.blue);
        this.createMiniChart('mini-tert-2', this.sv('mobile_subscriptions', 4) || [140, 155, 162, 172], 'bar', this.colors.green);
        this.createMiniChart('mini-tert-3', [20, 25, 30, 45], 'line', this.colors.orange);
        this.createMiniChart('mini-tert-4', [0.5, 0.8, 1.2, 1.8], 'bar', this.colors.purple);

        // Education - real data
        this.createMiniChart('mini-edu-1', this.sv('primary_enroll', 4) || [93, 93, 95, 102], 'line', this.colors.blue);
        this.createMiniChart('mini-edu-2', this.sv('secondary_enroll', 4) || [54, 57, 55, 66], 'bar', this.colors.green);
        this.createMiniChart('mini-edu-3', this.sv('tertiary_enroll', 4) || [9, 10, 11, 11], 'line', this.colors.orange);
        this.createMiniChart('mini-edu-4', this.sv('literacy', 4) || [44, 50, 90, 50], 'bar', this.colors.slate);

        // Sante - real data
        this.createMiniChart('mini-sante-1', this.sv('life_expectancy', 4) || [60.1, 60.3, 61.6, 61.9], 'line', this.colors.green);
        this.createMiniChart('mini-sante-2', this.sv('infant_mortality', 4) || [50.9, 49.2, 47.9, 46.6], 'line', this.colors.red);
        this.createMiniChart('mini-sante-3', this.sv('health_expenditure', 4) || [3.2, 3.6, 3.8, 3.6], 'bar', this.colors.blue);
        this.createMiniChart('mini-sante-4', this.sv('physicians', 4) || [0.12, 0.14, 0.16, 0.18], 'bar', this.colors.orange);

        // Territory - real data where available
        this.createMiniChart('mini-terr-1', this.sv('gdp_per_capita', 4) || [2180, 2456, 2333, 2710], 'bar', this.colors.orange);
        this.createMiniChart('mini-terr-2', this.sv('electricity_access', 4) || [69, 71, 72, 72], 'line', this.colors.green);
        this.createMiniChart('mini-terr-3', [5000, 5500, 6000, 7000], 'bar', this.colors.slate);
        this.createMiniChart('mini-terr-4', [10, 15, 25, 40], 'line', this.colors.purple);

        // Emploi - real data
        this.createMiniChart('mini-emp-1', this.sv('unemployment', 4) || [2.6, 2.6, 2.3, 2.3], 'line', this.colors.green);
        this.createMiniChart('mini-emp-2', (this.sv('labor_force', 4) || []).length ? this.sv('labor_force', 4).map(v => Math.round(v / 1e6 * 10) / 10) : [11.4, 11.8, 12.2, 12.6], 'bar', this.colors.orange);
        this.createMiniChart('mini-emp-3', [90, 88, 86, 85], 'line', this.colors.slate);
        this.createMiniChart('mini-emp-4', [80, 95, 110], 'bar', this.colors.blue);

        // Politique (données de gouvernance non dans la BDD, conservées telles quelles)
        this.createMiniChart('mini-pol-1', [35, 36, 37, 38], 'line', this.colors.orange);
        this.createMiniChart('mini-pol-2', [52, 53, 54], 'bar', this.colors.green);
        this.createMiniChart('mini-pol-3', [115, 112, 110], 'line', this.colors.blue);
        this.createMiniChart('mini-pol-4', [53, 47], 'bar', this.colors.purple);

        // Culture (données culturelles non dans la BDD, conservées telles quelles)
        this.createMiniChart('mini-cult-1', [0, 0, 1200], 'bar', this.colors.orange);
        this.createMiniChart('mini-cult-2', [1.2, 1.5, 1.8], 'line', this.colors.green);
        this.createMiniChart('mini-cult-3', [30, 35, 40], 'line', this.colors.purple);
        this.createMiniChart('mini-cult-4', [4, 5, 6], 'bar', this.colors.slate);

        // International - real data from douanes
        this.createMiniChart('mini-int-1', this.nv('solde_commercial', 5) || [1308, 1055, 732, -1011, -290], 'bar', this.colors.green);
        this.createMiniChart('mini-int-2', this.nv('exports_fob', 5) || [6578, 6370, 7284, 8148, 9455], 'line', this.colors.blue);
        this.createMiniChart('mini-int-3', this.sv('fdi_pct', 4) || [1.1, 1.9, 2.3, 2.2], 'line', this.colors.orange);
        this.createMiniChart('mini-int-4', this.nv('imports_caf', 5) || [5271, 5316, 6552, 9158, 9745], 'bar', this.colors.slate);
    },

    createMiniChart(domId, data, type, color) {
        const el = document.getElementById(domId);
        if(!el) return;
        
        // Ensure data is array of numbers
        const numData = data.map(Number);
        const minVal = Math.min(...numData);
        
        const chart = echarts.init(el);
        const option = {
            color: [color],
            grid: { left: 0, right: 0, top: 2, bottom: 2 },
            xAxis: { show: false, type: 'category' },
            yAxis: { show: false, type: 'value', min: minVal > 0 ? minVal * 0.9 : 0 },
            tooltip: { show: false },
            series: [{
                type: type === 'gauge' ? 'bar' : type,
                data: numData,
                smooth: true,
                symbol: 'none',
                lineStyle: { width: 2 },
                areaStyle: type === 'line' ? { opacity: 0.2 } : null,
                itemStyle: { borderRadius: 2 },
                barWidth: '60%'
            }]
        };
        
        chart.setOption(option);
        this.charts[domId] = chart;
    },

    // --- UI & UX ---
    setupMobileMenu() {
        const toggleBtn = document.getElementById('sidebar-toggle');
        const sidebar = document.querySelector('.dash-sidebar');
        const overlay = document.querySelector('.sidebar-overlay');

        if(toggleBtn && sidebar && overlay) {
            const closeMenu = () => {
                sidebar.classList.remove('mobile-open');
                overlay.classList.remove('active');
            };

            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                sidebar.classList.toggle('mobile-open');
                overlay.classList.toggle('active');
            });

            overlay.addEventListener('click', closeMenu);

            // Close on item click (mobile only)
            document.querySelectorAll('.sidebar-item, .sidebar-sub-item').forEach(item => {
                item.addEventListener('click', () => {
                    if(window.innerWidth <= 768) closeMenu();
                });
            });
        }
    },

    setupSidebarSearch() {
        const searchInput = document.getElementById('sidebar-search');
        if(!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const topItems = document.querySelectorAll('.sidebar-item');
            const subItems = document.querySelectorAll('.sidebar-sub-item');

            if(term.length === 0) {
                // Reset all
                topItems.forEach(el => el.style.display = '');
                subItems.forEach(el => el.style.display = '');
                // Collapse all sub-menus unless they were active? 
                // For simplicity, we just leave them as they were or collapse them. 
                // Actually, let's just reset display property.
                return;
            }

            // Hide all first
            topItems.forEach(el => el.style.display = 'none');
            subItems.forEach(el => el.style.display = 'none');

            // Check Top Items
            topItems.forEach(item => {
                if(item.textContent.toLowerCase().includes(term)) {
                    item.style.display = 'flex';
                }
            });

            // Check Sub Items
            subItems.forEach(item => {
                if(item.textContent.toLowerCase().includes(term)) {
                    item.style.display = 'block';
                    // Show Parent
                    const parentMenu = item.closest('.sidebar-sub-menu');
                    if(parentMenu && parentMenu.previousElementSibling) {
                        const parentTrigger = parentMenu.previousElementSibling;
                        parentTrigger.style.display = 'flex';
                        if(!parentTrigger.classList.contains('open')) {
                            parentTrigger.click(); // Trigger toggle to open
                        }
                    }
                }
            });
        });
    },

    // --- DATA MANAGEMENT ---
    loadOverviewData() {
        const d = this.dbData;
        if (d && d.kpis) {
            const k = d.kpis;
            // Values
            this.updateElement('kpi-gdp-val', k.gdp ? k.gdp.value : 'N/A');
            this.updateElement('kpi-gdp-trend', k.gdp ? (k.gdp.dir === 'up' ? '<i class="fas fa-arrow-up"></i> ' : '') + k.gdp.trend : '');
            this.updateElement('kpi-inf-val', k.inflation ? k.inflation.value : 'N/A');
            this.updateElement('kpi-inf-trend', k.inflation ? (k.inflation.dir === 'up' ? '<i class="fas fa-arrow-down"></i> ' : '<i class="fas fa-arrow-up"></i> ') + k.inflation.trend : '');
            this.updateElement('kpi-pop-val', k.pop ? k.pop.value : 'N/A');
            this.updateElement('kpi-pop-trend', k.pop ? k.pop.trend : '');
            this.updateElement('kpi-life-val', k.life ? k.life.value : 'N/A');
            this.updateElement('kpi-life-trend', k.life ? (k.life.dir === 'up' ? '<i class="fas fa-arrow-up"></i> ' : '') + k.life.trend : '');
            this.updateElement('kpi-unemp-val', k.unemp ? k.unemp.value : 'N/A');
            this.updateElement('kpi-unemp-trend', k.unemp ? k.unemp.trend : '');
            // Dynamic year labels
            if (k.gdp && k.gdp.year) this.updateElement('kpi-gdp-label', `PIB Nominal (${k.gdp.year})`);
            if (k.inflation && k.inflation.year) this.updateElement('kpi-inf-label', `Inflation (${k.inflation.year})`);
            if (k.pop && k.pop.year) this.updateElement('kpi-pop-label', `Population (${k.pop.year})`);
            if (k.life && k.life.year) this.updateElement('kpi-life-label', `Espérance de Vie (${k.life.year})`);
            if (k.unemp && k.unemp.year) this.updateElement('kpi-unemp-label', `Taux Chômage (${k.unemp.year})`);
        }
        // Rating is not in DB - leave as-is (BB- / Perspective Positive)
    },

    updateElement(id, value) {
        const el = document.getElementById(id);
        if(el) el.innerHTML = value;
    },

    // Helper: get last N values from a series key (returns null if empty so || fallback works)
    sv(key, n) {
        if (!this.dbData || !this.dbData.series || !this.dbData.series[key]) return null;
        const vals = this.dbData.series[key].values;
        if (!vals || vals.length === 0) return null;
        const result = n ? vals.slice(-n) : vals;
        return result.length > 0 ? result : null;
    },

    // Helper: get national data series {years, values, name} or null
    nd(key) {
        if (!this.dbData || !this.dbData.national || !this.dbData.national[key]) return null;
        const s = this.dbData.national[key];
        if (!s.values || s.values.length === 0) return null;
        return s;
    },

    // Helper: get last N values from national data
    nv(key, n) {
        const s = this.nd(key);
        if (!s) return null;
        const result = n ? s.values.slice(-n) : s.values;
        return result.length > 0 ? result : null;
    },

    // Helper: get last N years from national data
    ny(key, n) {
        const s = this.nd(key);
        if (!s) return null;
        const result = n ? s.years.slice(-n).map(String) : s.years.map(String);
        return result.length > 0 ? result : null;
    },

    // --- INTERACTIVITY & FILTERS ---
    setupFilters() {
        // Handle Dropdown Changes
        document.querySelectorAll('.filter-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const section = e.target.closest('.content-section');
                
                // Map specific filter
                if (e.target.classList.contains('map-filter')) {
                    this.updateMapMarkers(e.target.value);
                    return;
                }

                const filterType = e.target.classList.contains('year-filter') ? 'Année' : 'Filtre';
                const value = e.target.options[e.target.selectedIndex].text;
                
                this.handleFilterChange(section, filterType, value);
            });
        });

        // Handle Export Buttons
        document.querySelectorAll('.btn-export').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.closest('.content-section');
                this.showToast('Préparation du fichier...', 'info');
                
                setTimeout(() => {
                    this.downloadMockCSV(section ? section.id : 'dashboard');
                    this.showToast('Le fichier a été téléchargé avec succès.', 'success');
                }, 1000);
            });
        });
    },

    handleFilterChange(section, type, value) {
        // Simulate data loading
        if(section) {
            section.style.opacity = '0.7';
            this.showToast(`Mise à jour des données: ${type} ${value}`, 'info');
            
            setTimeout(() => {
                section.style.opacity = '1';
                // Trigger a mock refresh of charts in this section
                this.refreshCharts(section.id);
            }, 600);
        }
    },

    refreshCharts(sectionId) {
        // This is a mock function to demonstrate interactivity
        // In production, this would fetch new data from the API based on filters
        
        // Find charts in this section
        const chartContainers = document.querySelectorAll(`#${sectionId} .chart-container`);
        chartContainers.forEach(container => {
            const chartInstance = echarts.getInstanceByDom(container);
            if(chartInstance) {
                const option = chartInstance.getOption();
                // Randomize data slightly to show change
                if(option.series && option.series[0] && option.series[0].data) {
                    const data = option.series[0].data;
                    // Simple randomization for demo
                    const newData = data.map(val => {
                        if(typeof val === 'number') return val * (0.9 + Math.random() * 0.2); // +/- 10%
                        if(typeof val === 'object' && val.value) {
                            val.value = val.value * (0.9 + Math.random() * 0.2);
                            return val;
                        }
                        return val;
                    });
                    
                    chartInstance.setOption({
                        series: [{
                            data: newData
                        }]
                    });
                }
            }
        });
    },

    updateMapMarkers(filter) {
        if (!this.map || !this.mapLayerGroup) return;
        
        this.mapLayerGroup.clearLayers();
        
        const filteredData = filter === 'all' || !filter 
            ? this.mapData 
            : this.mapData.filter(item => {
                // Group 'tech' under 'infra' for the filter
                if (filter === 'infra') return item.type === 'infra' || item.type === 'tech';
                return item.type === filter;
            });

        filteredData.forEach(p => {
            // Use Theme Colors
            let color = this.colors.blue; // Default/Infra
            if (p.type === 'agri') color = this.colors.green;
            else if (p.type === 'energy') color = this.colors.orange;
            else if (p.type === 'tech') color = this.colors.purple;
            
            // Create custom marker style
            L.circleMarker(p.pos, { 
                radius: 10, 
                color: 'white', 
                weight: 2,
                fillColor: color, 
                fillOpacity: 0.9 
            })
             .bindPopup(`
                <div style="font-family:'Inter',sans-serif; width:220px;">
                    <h4 style="margin:0 0 8px; color:#1F2937; font-size:1rem;">${p.title}</h4>
                    <span style="background:${color}; color:white; padding:3px 8px; border-radius:12px; font-size:0.75rem; font-weight:600;">${p.category}</span>
                    <div style="margin-top:12px; font-size:0.85rem; color:#6B7280; display:flex; flex-direction:column; gap:4px;">
                        <div style="display:flex; justify-content:space-between;"><span>Status:</span> <span style="color:#1F2937; font-weight:600;">${p.status || 'N/A'}</span></div>
                        <div style="display:flex; justify-content:space-between;"><span>Budget:</span> <span style="color:#1F2937; font-weight:600;">${p.budget || 'N/A'}</span></div>
                        <div style="margin-top:6px; display:flex; align-items:center; gap:8px;">
                            <div style="flex:1; height:6px; background:#E5E7EB; border-radius:3px; overflow:hidden;">
                                <div style="width:${p.progress || 0}%; height:100%; background:${color}; border-radius:3px;"></div>
                            </div>
                            <span style="font-size:0.75rem; font-weight:700; color:${color};">${p.progress || 0}%</span>
                        </div>
                    </div>
                </div>
             `)
             .addTo(this.mapLayerGroup);
        });
    },

    downloadMockCSV(sectionId) {
        const title = sectionId.replace('section-', '').toUpperCase();
        let headers = "Indicateur,Valeur,Annee\n";
        let csvContent = "";

        // Context-aware headers and data
        if(sectionId.includes('finance')) {
            headers = "Rubrique,Montant (Mds FCFA),Variation,Annee\n";
            csvContent += `Recettes Fiscales,8500,+5%,2024\n`;
            csvContent += `Dépenses Publiques,9800,+3%,2024\n`;
            csvContent += `Dette Publique,58.1%,+1.3pt,2024\n`;
        } 
        else if(sectionId.includes('macro')) {
            headers = "Indicateur,Valeur (%),Variation,Annee\n";
            csvContent += `Croissance PIB,6.8%,+0.3pt,2024\n`;
            csvContent += `Inflation,3.8%,-0.6pt,2024\n`;
            csvContent += `Investissement,25.5%,+1.4pt,2024\n`;
        }
        else if(sectionId.includes('demo')) {
            headers = "Indicateur,Valeur,Zone,Annee\n";
            csvContent += `Population Totale,30.2M,National,2024\n`;
            csvContent += `Densité Abidjan,3000 hab/km2,Abidjan,2024\n`;
            csvContent += `Taux Urbanisation,54%,National,2024\n`;
        }
        else if(sectionId.includes('sec-primary')) {
            headers = "Filiere,Production (Tonnes),Export,Annee\n";
            csvContent += `Cacao,2200000,95%,2024\n`;
            csvContent += `Anacarde,1100000,90%,2024\n`;
            csvContent += `Riz,1500000,10%,2024\n`;
        }
        else if(sectionId.includes('sec-secondary')) {
            headers = "Branche,Indice IPI,Croissance,Annee\n";
            csvContent += `Industrie Extractive,145,+5%,2024\n`;
            csvContent += `Energie,120,+8%,2024\n`;
            csvContent += `BTP,135,+12%,2024\n`;
        }
        else if(sectionId.includes('sec-tertiary')) {
            headers = "Secteur,Valeur (Mds FCFA),Croissance,Annee\n";
            csvContent += `Commerce,4500,+4%,2024\n`;
            csvContent += `Télécoms,1200,+10%,2024\n`;
            csvContent += `Tourisme,800,+15%,2024\n`;
        }
        else if(sectionId.includes('education')) {
            headers = "Niveau,Taux Scolarisation (%),Budget (Mds FCFA),Annee\n";
            csvContent += `Primaire,92%,400,2024\n`;
            csvContent += `Secondaire,55%,350,2024\n`;
            csvContent += `Supérieur,12%,250,2024\n`;
        }
        else if(sectionId.includes('emploi')) {
            headers = "Indicateur,Valeur,Secteur,Annee\n";
            csvContent += `Taux Chômage,2.6%,Global,2024\n`;
            csvContent += `Emploi Informel,85%,Global,2024\n`;
            csvContent += `Emplois Créés,110000,Privé,2024\n`;
        }
        else if(sectionId.includes('sante')) {
            headers = "Indicateur,Valeur,Cible,Annee\n";
            csvContent += `Espérance Vie,59.2,65,2024\n`;
            csvContent += `Mortalité Infantile,52,30,2024\n`;
            csvContent += `Couverture CMU,12%,40%,2024\n`;
        }
        else if(sectionId.includes('politique')) {
            headers = "Indicateur,Score,Rang,Annee\n";
            csvContent += `Corruption (CPI),38,N/A,2024\n`;
            csvContent += `Gouvernance (IIAG),54,N/A,2024\n`;
            csvContent += `Climat Affaires,N/A,110,2024\n`;
        }
        else if(sectionId.includes('culture')) {
            headers = "Domaine,Impact (Mds FCFA),Visiteurs,Annee\n";
            csvContent += `CAN 2023,1200,2000000,2024\n`;
            csvContent += `Tourisme,150,1800000,2024\n`;
            csvContent += `Arts,50,N/A,2024\n`;
        }
        else if(sectionId.includes('inter')) {
            headers = "Partenaire,Flux (Mds FCFA),Type,Annee\n";
            csvContent += `Pays-Bas,1200,Export,2024\n`;
            csvContent += `France,900,Import,2024\n`;
            csvContent += `IDE,1100,Entrant,2024\n`;
        }
        else if(sectionId.includes('territory')) {
            headers = "Region,PIB Regional (%),Acces Elec (%),Annee\n";
            csvContent += `Abidjan,40%,98%,2024\n`;
            csvContent += `Nord,10%,75%,2024\n`;
            csvContent += `Ouest,15%,70%,2024\n`;
        }
        else {
            // Default
            csvContent += `Donnée Exemple 1,1234,N/A,2024\n`;
            csvContent += `Donnée Exemple 2,5678,N/A,2024\n`;
            csvContent += `Donnée Exemple 3,9012,N/A,2024\n`;
        }

        const finalCsv = "data:text/csv;charset=utf-8," + headers + csvContent;
        const encodedUri = encodeURI(finalCsv);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Rapport_${title}_CIV_2024.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    // --- UI UTILS ---
    showToast(message, type = 'success') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const iconClass = type === 'success' ? 'fa-check-circle' : (type === 'warning' ? 'fa-exclamation-triangle' : 'fa-info-circle');
        
        toast.innerHTML = `
            <i class="fas ${iconClass} toast-icon"></i>
            <div class="toast-content">
                <div class="toast-title">${type === 'success' ? 'Succès' : 'Information'}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;

        container.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    setupNavigation() {
        // Sidebar Click Handler
        const handleNavClick = (item) => {
            // UI Updates
            document.querySelectorAll('.sidebar-item, .sidebar-sub-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            
            // Parent Active State (for sub-items)
            if(item.classList.contains('sidebar-sub-item')) {
                const parentMenu = item.closest('.sidebar-sub-menu');
                if (parentMenu && parentMenu.previousElementSibling) {
                    parentMenu.previousElementSibling.classList.add('active');
                    // Ensure parent is open
                    if (!parentMenu.previousElementSibling.classList.contains('open')) {
                        parentMenu.previousElementSibling.classList.add('open');
                        // Rotate arrow if present
                        const arrow = parentMenu.previousElementSibling.querySelector('.arrow-icon');
                        if(arrow) arrow.style.transform = 'rotate(180deg)';
                    }
                }
            }

            // Section Visibility
            const targetId = item.getAttribute('data-target');
            if(targetId) this.handleSectionChange(targetId);
        };

        // Bind Events - Sidebar Items
        document.querySelectorAll('.sidebar-item:not(.has-sub)').forEach(el => {
            el.addEventListener('click', () => handleNavClick(el));
        });

        // Bind Events - Sub-items
        document.querySelectorAll('.sidebar-sub-item').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                handleNavClick(el);
            });
        });

        // Sub-menu Toggle (Accordion)
        document.querySelectorAll('.has-sub').forEach(el => {
            el.addEventListener('click', () => {
                el.classList.toggle('open');
                const icon = el.querySelector('.arrow-icon');
                if(icon) icon.style.transform = el.classList.contains('open') ? 'rotate(180deg)' : 'rotate(0deg)';
            });
        });

        // Sub-Navbar Interaction
        document.querySelectorAll('.sub-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const subtab = tab.dataset.subtab;
                
                // Update active state
                document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                if(subtab === 'dashboards') {
                    // Show dashboards view - activate overview in sidebar
                    const overviewItem = document.querySelector('.sidebar-item[data-target="section-overview"]');
                    if(overviewItem) overviewItem.click();
                    // Show sidebar
                    document.querySelector('.dash-sidebar').style.display = '';
                    return;
                }
                
                if(subtab === 'explorer') {
                    // Show explorer section
                    this.handleSectionChange('section-explorer');
                    // Reset sidebar active states
                    document.querySelectorAll('.sidebar-item, .sidebar-sub-item').forEach(el => el.classList.remove('active'));
                    // Hide sidebar for explorer view (full width)
                    document.querySelector('.dash-sidebar').style.display = 'none';
                    return;
                }

                if(subtab === 'custom') {
                    // Show custom dashboard builder
                    this.handleSectionChange('section-custom-dashboard');
                    document.querySelectorAll('.sidebar-item, .sidebar-sub-item').forEach(el => el.classList.remove('active'));
                    document.querySelector('.dash-sidebar').style.display = 'none';
                    // Initialize builder once
                    if (!DashboardBuilder._initialized) {
                        DashboardBuilder._initialized = true;
                        DashboardBuilder.init();
                    }
                    return;
                }

                // For other tabs, show "Coming Soon"
                this.showToast('Cette fonctionnalité sera bientôt disponible.', 'warning');
                // Revert to previous active tab
                document.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
                document.querySelector('.sub-tab[data-subtab="dashboards"]').classList.add('active');
            });
        });

        // Preview Cards Link Logic
        document.querySelectorAll('.preview-card-v2').forEach(card => {
            card.addEventListener('click', () => {
                const target = card.getAttribute('data-target');
                // Try finding a direct sidebar link
                let sidebarItem = document.querySelector(`.sidebar-item[data-target="${target}"]`);
                
                // If not found, try finding a sub-item
                if(!sidebarItem) {
                    sidebarItem = document.querySelector(`.sidebar-sub-item[data-target="${target}"]`);
                }

                if(sidebarItem) {
                    // If it's a sub-item, ensure parent is open is handled by handleNavClick
                    // Trigger click
                    sidebarItem.click();
                }
            });
        });
    },

    handleSectionChange(sectionId) {
        // Hide all
        document.querySelectorAll('.content-section').forEach(el => el.classList.add('hidden'));
        
        // Show target
        const target = document.getElementById(sectionId);
        if(!target) return;
        target.classList.remove('hidden');

        // Initialize Charts for this section
        setTimeout(() => {
            this.initSectionCharts(sectionId);
        }, 50); // Small delay for layout to stabilize
    },

    initSectionCharts(sectionId) {
        switch(sectionId) {
            case 'section-macro': this.renderMacroCharts(); break;
            case 'section-finance': this.renderFinanceCharts(); break;
            case 'section-demo': this.renderDemoCharts(); break;
            case 'section-sec-primary': this.renderPrimaryCharts(); break;
            case 'section-sec-secondary': this.renderSecondaryCharts(); break;
            case 'section-sec-tertiary': this.renderTertiaryCharts(); break;
            case 'section-education': this.renderEducationCharts(); break;
            case 'section-emploi': this.renderEmploiCharts(); break;
            case 'section-sante': this.renderSanteCharts(); break;
            case 'section-politique': this.renderPolitiqueCharts(); break;
            case 'section-culture': this.renderCultureCharts(); break;
            case 'section-territory': this.renderTerritoryMap(); this.renderTerritoryCharts(); break;
            case 'section-inter': this.renderInterCharts(); break;
        }
    },

    // --- CHART FACTORY ---
    createChart(domId, option) {
        const el = document.getElementById(domId);
        if(!el) return;
        
        // Dispose existing if needed to avoid dupes
        if(this.charts[domId]) this.charts[domId].dispose();

        const chart = echarts.init(el);
        
        // Show Loading State
        chart.showLoading({
            text: 'Chargement...',
            color: this.colors.orange,
            textColor: this.colors.slate,
            maskColor: 'rgba(255, 255, 255, 0.8)',
            zlevel: 0
        });

        // Enhanced Defaults
        const baseOption = {
            color: [this.colors.orange, this.colors.green, this.colors.blue, this.colors.purple, this.colors.slate],
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderColor: '#E5E7EB',
                borderWidth: 1,
                textStyle: { color: '#1F2937', fontFamily: 'Inter' },
                extraCssText: 'box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border-radius: 8px;'
            },
            grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
            toolbox: {
                show: true,
                feature: {
                    saveAsImage: { show: true, title: 'Sauvegarder' },
                    dataZoom: { show: true, title: { zoom: 'Zoom', back: 'Reset' } },
                    restore: { show: true, title: 'Restaurer' }
                },
                iconStyle: { borderColor: '#9CA3AF' },
                right: '2%'
            },
            textStyle: { fontFamily: 'Inter' }
        };

        // Merge defaults
        const finalOption = { ...baseOption, ...option };
        if(option.tooltip) finalOption.tooltip = { ...baseOption.tooltip, ...option.tooltip };
        if(option.grid) finalOption.grid = { ...baseOption.grid, ...option.grid };
        if(option.color) finalOption.color = option.color;

        // Simulate Network Latency for "Live" feel
        setTimeout(() => {
            chart.hideLoading();
            chart.setOption(finalOption);
        }, 400 + Math.random() * 400);

        this.charts[domId] = chart;
        return chart;
    },

    // --- RENDER FUNCTIONS ---

    renderMacroCharts() {
        const s = this.dbData ? this.dbData.series : null;
        const gdpG = s ? s.gdp_growth : null;
        const infl = s ? s.inflation : null;
        const fdi  = s ? s.fdi_pct : null;

        // 1. GDP Growth - Croissance du PIB Réel
        this.createChart('chart-macro-gdp', {
            title: { text: '', left: 'center', top: 0, textStyle: { fontSize: 12, color: '#6B7280' } },
            tooltip: { 
                trigger: 'axis', 
                valueFormatter: (value) => value.toFixed(1) + ' %',
                backgroundColor: 'rgba(255,255,255,0.95)',
                borderColor: '#e5e7eb',
                textStyle: { color: '#1f2937' }
            },
            xAxis: { 
                type: 'category', 
                data: gdpG ? gdpG.years.slice(-6).map(String) : ['2019', '2020', '2021', '2022', '2023', '2024'],
                name: 'Année',
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' },
                axisLine: { lineStyle: { color: '#E5E7EB' } },
                axisLabel: { color: '#374151' }
            },
            yAxis: { 
                type: 'value', 
                name: 'Taux de croissance (%)',
                nameLocation: 'middle',
                nameGap: 45,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' },
                axisLabel: { formatter: '{value}%', color: '#374151' },
                splitLine: { lineStyle: { color: '#F3F4F6', type: 'dashed' } }
            },
            series: [{ 
                name: 'Croissance PIB',
                data: gdpG ? gdpG.values.slice(-6).map(v => Math.round(v * 10) / 10) : [6.7, 0.7, 7.1, 6.4, 6.5, 6.0], 
                type: 'line', 
                smooth: true, 
                symbolSize: 10,
                lineStyle: { width: 3, color: this.colors.orange },
                itemStyle: { color: this.colors.orange },
                areaStyle: { opacity: 0.15, color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{offset: 0, color: this.colors.orange}, {offset: 1, color: 'rgba(255,130,0,0)'}]) }, 
                markPoint: { data: [{type: 'max', name: 'Maximum', symbolSize: 50}], label: { formatter: '{c}%' } },
                markLine: { data: [{type: 'average', name: 'Moyenne'}], label: { formatter: '{c}%' } }
            }]
        });
        
        // 2. Inflation - IPC Moyenne Annuelle
        this.createChart('chart-macro-inflation', {
            tooltip: { 
                trigger: 'axis', 
                axisPointer: { type: 'shadow' }, 
                valueFormatter: (value) => value.toFixed(1) + ' %' 
            },
            xAxis: { 
                type: 'category', 
                data: infl ? infl.years.slice(-6).map(String) : ['2019', '2020', '2021', '2022', '2023', '2024'],
                name: 'Année',
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' }
            },
            yAxis: { 
                type: 'value', 
                name: 'Inflation (%)',
                nameLocation: 'middle',
                nameGap: 40,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' },
                axisLabel: { formatter: '{value}%' },
                splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } }
            },
            series: [{ 
                name: 'Inflation IPC',
                data: infl ? infl.values.slice(-6).map(v => Math.round(v * 10) / 10) : [-1.1, 2.4, 4.1, 5.3, 4.4, 3.5], 
                type: 'bar', 
                barWidth: '50%',
                itemStyle: { 
                    borderRadius: [6,6,0,0], 
                    color: (params) => params.value > 4 ? this.colors.red : this.colors.slate
                },
                label: { show: true, position: 'top', formatter: '{c}%', fontSize: 10 }
            }]
        });

        // 3. Structure du PIB par Secteur (données réelles base éco)
        const prim = this.nv('pib_primaire_pct', 1);
        const sec = this.nv('pib_secondaire_pct', 1);
        const tert = this.nv('pib_tertiaire_pct', 1);
        const primVal = prim ? Math.round(prim[0] * 10) / 10 : 22;
        const secVal = sec ? Math.round(sec[0] * 10) / 10 : 28;
        const tertVal = tert ? Math.round(tert[0] * 10) / 10 : 50;
        this.createChart('chart-macro-contrib', {
            tooltip: { 
                trigger: 'item', 
                formatter: (params) => `<strong>${params.name}</strong><br/>Part: ${params.value}% (${params.percent}%)`
            },
            legend: { bottom: 5, itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 11 } },
            series: [{ 
                type: 'pie', 
                radius: ['35%', '65%'], 
                center: ['50%', '45%'],
                itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 3 },
                label: { show: true, formatter: '{b}\n{d}%', fontSize: 11 },
                emphasis: { label: { fontSize: 13, fontWeight: 'bold' } },
                data: [
                    { value: primVal, name: 'Primaire', itemStyle: { color: this.colors.green } },
                    { value: secVal, name: 'Secondaire', itemStyle: { color: this.colors.orange } },
                    { value: tertVal, name: 'Tertiaire', itemStyle: { color: this.colors.blue } }
                ] 
            }]
        });

        // 4. IDE - Investissements Directs Étrangers (% PIB)
        this.createChart('chart-macro-invest', {
            tooltip: { trigger: 'axis', valueFormatter: (value) => value.toFixed(2) + '% du PIB' },
            xAxis: { 
                type: 'category', 
                data: fdi ? fdi.years.slice(-5).map(String) : ['2019', '2020', '2021', '2022', '2023'],
                name: 'Année',
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' }
            },
            yAxis: { 
                type: 'value', 
                name: '% du PIB',
                nameLocation: 'middle',
                nameGap: 40,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' },
                axisLabel: { formatter: '{value}%' },
                splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } }
            },
            series: [{ 
                name: 'IDE (% PIB)',
                data: fdi ? fdi.values.slice(-5).map(v => Math.round(v * 100) / 100) : [1.41, 1.13, 1.91, 2.26, 2.20], 
                type: 'line', 
                smooth: true,
                symbolSize: 10,
                lineStyle: { width: 3, color: this.colors.blue },
                itemStyle: { color: this.colors.blue },
                areaStyle: { opacity: 0.15 },
                label: { show: true, formatter: '{c}%', position: 'top', fontSize: 10 }
            }]
        });

        // 5. Dette Publique (% PIB) - données réelles financements
        const dettePib = this.nd('dette_pct_pib_fin');
        this.createChart('chart-macro-debt-gdp', {
            tooltip: { trigger: 'axis', valueFormatter: (v) => v.toFixed(1) + '% du PIB' },
            xAxis: { 
                type: 'category', 
                data: dettePib ? dettePib.years.map(String) : ['2020', '2021', '2022', '2023'],
                name: 'Année',
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' }
            },
            yAxis: { 
                type: 'value', 
                min: 40, 
                max: 70,
                name: '% du PIB',
                nameLocation: 'middle',
                nameGap: 40,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' },
                axisLabel: { formatter: '{value}%' },
                splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } }
            },
            series: [{ 
                name: 'Dette/PIB',
                data: dettePib ? dettePib.values.map(v => Math.round(v * 10) / 10) : [46.3, 50.2, 56.6, 58.1], 
                type: 'bar',
                barWidth: '50%',
                itemStyle: { 
                    borderRadius: [6,6,0,0],
                    color: (params) => params.value > 55 ? this.colors.red : this.colors.purple
                },
                label: { show: true, position: 'top', formatter: '{c}%', fontSize: 10 }
            }]
        });

        // 6. Balance Commerciale (données réelles Douanes - Mds FCFA)
        const soldeComm = this.nd('solde_commercial');
        this.createChart('chart-macro-trade-balance', {
            tooltip: { trigger: 'axis', valueFormatter: (v) => v.toFixed(1) + ' Mds FCFA' },
            xAxis: { 
                type: 'category', 
                data: soldeComm ? soldeComm.years.map(String) : ['2019', '2020', '2021', '2022', '2023'],
                name: 'Année',
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' }
            },
            yAxis: { 
                type: 'value',
                name: 'Mds FCFA',
                nameLocation: 'middle',
                nameGap: 50,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' },
                axisLabel: { formatter: (v) => v.toFixed(0) },
                splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } }
            },
            series: [{ 
                name: 'Solde commercial',
                data: soldeComm ? soldeComm.values.map(v => Math.round(v * 10) / 10) : [1307.5, 1054.5, 731.5, -1010.5, -290.2], 
                type: 'bar',
                barWidth: '50%',
                itemStyle: { 
                    borderRadius: [6,6,0,0],
                    color: (params) => params.value >= 0 ? this.colors.green : this.colors.red
                },
                label: { show: true, position: (params) => params.value >= 0 ? 'top' : 'bottom', formatter: (p) => p.value.toFixed(0), fontSize: 10 }
            }]
        });

        // 7. TOFE - Recettes vs Dépenses (données réelles)
        const recettes = this.nd('recettes_et_dons');
        const depenses = this.nd('depenses_totales');
        const tofeYears = recettes ? recettes.years.map(String) : ['2018', '2019', '2020', '2021', '2022', '2023'];
        this.createChart('chart-macro-reserv', {
            tooltip: { trigger: 'axis', valueFormatter: (v) => v.toFixed(0) + ' Mds FCFA' },
            legend: { bottom: 0, textStyle: { fontSize: 10 } },
            xAxis: { 
                type: 'category', 
                data: tofeYears,
                name: 'Année',
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' }
            },
            yAxis: { 
                type: 'value',
                name: 'Mds FCFA',
                nameLocation: 'middle',
                nameGap: 55,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' },
                axisLabel: { formatter: (v) => (v/1000).toFixed(0) + 'k' },
                splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } }
            },
            series: [
                { 
                    name: 'Recettes & Dons',
                    data: recettes ? recettes.values.map(v => Math.round(v)) : [4764, 5158, 5289, 6140, 6684, 7771], 
                    type: 'bar', 
                    barWidth: '35%',
                    itemStyle: { borderRadius: [4,4,0,0], color: this.colors.green },
                },
                { 
                    name: 'Dépenses',
                    data: depenses ? depenses.values.map(v => Math.round(v)) : [5708, 5944, 7255, 8102, 9666, 10279], 
                    type: 'bar', 
                    barWidth: '35%',
                    itemStyle: { borderRadius: [4,4,0,0], color: this.colors.red },
                }
            ]
        });

        // 8. Solde budgétaire (% PIB) - données réelles calculées
        const soldePib = this.nd('solde_budgetaire_pct_pib');
        this.createChart('chart-macro-credit', {
            tooltip: { trigger: 'axis', valueFormatter: (v) => v.toFixed(1) + '% du PIB' },
            xAxis: { 
                type: 'category', 
                data: soldePib ? soldePib.years.map(String) : ['2018', '2019', '2020', '2021', '2022'],
                name: 'Année',
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' }
            },
            yAxis: { 
                type: 'value',
                name: '% du PIB',
                nameLocation: 'middle',
                nameGap: 45,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' },
                axisLabel: { formatter: '{value}%' },
                splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } }
            },
            series: [{ 
                name: 'Solde budgétaire',
                data: soldePib ? soldePib.values.map(v => Math.round(v * 10) / 10) : [-2.9, -2.2, -5.4, -4.9, -6.7], 
                type: 'bar',
                barWidth: '50%',
                itemStyle: { 
                    borderRadius: [6,6,0,0],
                    color: (params) => params.value >= -3 ? this.colors.orange : this.colors.red
                },
                label: { show: true, position: 'bottom', formatter: '{c}%', fontSize: 10 }
            }]
        });

        // 9. Pression Fiscale (données réelles calculées)
        const pf = this.nd('pression_fiscale');
        const pfValue = pf ? Math.round(pf.values[pf.values.length - 1] * 10) / 10 : 13.5;
        this.createChart('chart-macro-tax', {
            series: [{ 
                type: 'gauge',
                center: ['50%', '60%'],
                radius: '80%',
                min: 0,
                max: 25,
                progress: { show: true, width: 12 },
                axisLine: { lineStyle: { width: 12, color: [[0.5, '#E5E7EB'], [0.7, this.colors.orange], [1, this.colors.green]] } },
                axisTick: { show: false },
                splitLine: { length: 8, lineStyle: { width: 2, color: '#999' } },
                axisLabel: { distance: 20, color: '#6B7280', fontSize: 10, formatter: '{value}%' },
                anchor: { show: true, size: 15, itemStyle: { borderWidth: 2 } },
                title: { show: true, offsetCenter: [0, '70%'], fontSize: 12, color: '#6B7280' },
                detail: { 
                    valueAnimation: true, 
                    formatter: '{value}%', 
                    fontSize: 20,
                    fontWeight: 'bold',
                    offsetCenter: [0, '40%'],
                    color: this.colors.slate
                }, 
                data: [{ value: pfValue, name: 'Objectif UEMOA: 20%' }] 
            }]
        });

        // 10. Climat des Affaires (Doing Business)
        this.createChart('chart-macro-business', {
            tooltip: { trigger: 'item' },
            radar: { 
                indicator: [
                    {name: 'Création\nentreprise', max: 100},
                    {name: 'Permis\nconstruire', max: 100},
                    {name: 'Raccordement\nélectricité', max: 100},
                    {name: 'Transfert\npropriété', max: 100},
                    {name: 'Obtention\ncrédit', max: 100},
                    {name: 'Paiement\nimpôts', max: 100}
                ],
                center: ['50%', '55%'],
                radius: '65%',
                axisName: { color: '#6B7280', fontSize: 9 },
                splitArea: { areaStyle: { color: ['#fff', '#F9FAFB'] } }
            },
            series: [{ 
                type: 'radar', 
                data: [{ 
                    value: [82, 58, 72, 48, 65, 78], 
                    name: 'Score 2020',
                    areaStyle: { opacity: 0.2, color: this.colors.orange },
                    lineStyle: { width: 2, color: this.colors.orange },
                    itemStyle: { color: this.colors.orange }
                }],
                emphasis: { lineStyle: { width: 3 } }
            }]
        });
    },

    renderFinanceCharts() {
        // 1. Solde Budgétaire Global (données réelles TOFE)
        const soldePib = this.nd('solde_budgetaire_pct_pib');
        this.createChart('chart-fin-balance', {
            tooltip: { trigger: 'axis', valueFormatter: (value) => value.toFixed(1) + '% du PIB' },
            xAxis: { 
                type: 'category',
                data: soldePib ? soldePib.years.map(String) : ['2018', '2019', '2020', '2021', '2022'],
                name: 'Année',
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' }
            },
            yAxis: { 
                name: '% du PIB', 
                nameLocation: 'middle',
                nameGap: 45,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' },
                axisLabel: { formatter: '{value}%' },
                splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } }
            },
            series: [{ 
                name: 'Solde budgétaire',
                type: 'bar', 
                barWidth: '50%',
                data: soldePib ? soldePib.values.map(v => Math.round(v * 10) / 10) : [-2.9, -2.2, -5.4, -4.9, -6.7], 
                itemStyle: { 
                    color: (params) => params.value < -5 ? this.colors.red : this.colors.orange, 
                    borderRadius: [6,6,0,0] 
                },
                label: { show: true, position: 'bottom', formatter: '{c}%', fontSize: 10 }
            }]
        });

        // 2. Recettes vs Dépenses (données réelles TOFE)
        const recettes = this.nd('recettes_et_dons');
        const depenses = this.nd('depenses_totales');
        const tofeYears = recettes ? recettes.years.map(String) : ['2018', '2019', '2020', '2021', '2022', '2023'];
        this.createChart('chart-fin-rev-exp', {
            legend: { top: 0, itemWidth: 12, itemHeight: 12 },
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => Math.round(v).toLocaleString() + ' Mds' },
            xAxis: { 
                data: tofeYears,
                name: 'Année',
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' }
            },
            yAxis: { 
                name: 'Milliards FCFA',
                nameLocation: 'middle',
                nameGap: 55,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' },
                axisLabel: { formatter: (v) => (v/1000).toFixed(0) + 'k' },
                splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } }
            },
            series: [
                { name: 'Recettes & Dons', type: 'bar', data: recettes ? recettes.values.map(v => Math.round(v)) : [4764, 5158, 5289, 6140, 6684, 7771], itemStyle: { color: this.colors.green, borderRadius: [6,6,0,0] } },
                { name: 'Dépenses', type: 'bar', data: depenses ? depenses.values.map(v => Math.round(v)) : [5708, 5944, 7255, 8102, 9666, 10279], itemStyle: { color: this.colors.red, borderRadius: [6,6,0,0] } }
            ]
        });

        // 3. Évolution de la Dette Publique (données réelles financements)
        const dettePib = this.nd('dette_pct_pib_fin');
        this.createChart('chart-fin-debt', {
            tooltip: { trigger: 'axis', valueFormatter: (value) => value.toFixed(1) + '% du PIB' },
            xAxis: { 
                data: dettePib ? dettePib.years.map(String) : ['2020', '2021', '2022', '2023'],
                name: 'Année',
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' }
            },
            yAxis: { 
                min: 30, 
                max: 70, 
                name: '% du PIB',
                nameLocation: 'middle',
                nameGap: 40,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' },
                axisLabel: { formatter: '{value}%' },
                splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } }
            },
            series: [{ 
                name: 'Dette/PIB',
                type: 'line', 
                data: dettePib ? dettePib.values.map(v => Math.round(v * 10) / 10) : [46.3, 50.2, 56.6, 58.1], 
                smooth: true, 
                symbolSize: 10,
                lineStyle: { width: 3, color: this.colors.purple },
                itemStyle: { color: this.colors.purple },
                areaStyle: { opacity: 0.1 },
                label: { show: true, formatter: '{c}%', position: 'top', fontSize: 10 },
                markLine: { data: [{yAxis: 70, name: 'Seuil UEMOA'}], label: { formatter: 'Seuil 70%' }, lineStyle: { color: this.colors.red, type: 'dashed' } }
            }]
        });

        // 4. Service de la Dette (données réelles - intérêts/recettes)
        const intRecettes = this.nd('interets_pct_recettes');
        const intRecValue = intRecettes ? Math.round(intRecettes.values[intRecettes.values.length - 1] * 10) / 10 : 16.6;
        this.createChart('chart-fin-service', {
            series: [{ 
                type: 'gauge',
                center: ['50%', '60%'],
                radius: '80%',
                min: 0,
                max: 100,
                progress: { show: true, width: 12 }, 
                axisLine: { lineStyle: { width: 12, color: [[0.3, this.colors.green], [0.5, this.colors.orange], [1, this.colors.red]] } },
                axisTick: { show: false },
                splitLine: { length: 8, lineStyle: { width: 2, color: '#999' } },
                axisLabel: { distance: 20, color: '#6B7280', fontSize: 10, formatter: '{value}%' },
                title: { show: true, offsetCenter: [0, '70%'], fontSize: 11, color: '#6B7280' },
                detail: { valueAnimation: true, formatter: '{value}%', fontSize: 22, fontWeight: 'bold', offsetCenter: [0, '35%'], color: this.colors.slate }, 
                data: [{ value: intRecValue, name: 'Intérêts / Recettes' }] 
            }]
        });

        // 5. Masse Salariale (données réelles TOFE - rémunération / recettes)
        const remun = this.nd('remuneration_salaries');
        const rec = this.nd('recettes_et_dons');
        let masseSalYears = ['2018', '2019', '2020', '2021', '2022', '2023'];
        let masseSalData = [34.0, 33.0, 34.6, 30.3, 30.0, 28.9];
        if (remun && rec && remun.values.length === rec.values.length) {
            masseSalYears = remun.years.map(String);
            masseSalData = remun.values.map((v, i) => rec.values[i] > 0 ? Math.round(v / rec.values[i] * 1000) / 10 : 0);
        }
        this.createChart('chart-fin-wage-bill', {
            tooltip: { trigger: 'axis', valueFormatter: (v) => v + '% des recettes' },
            xAxis: { 
                data: masseSalYears,
                name: 'Année',
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' }
            },
            yAxis: { 
                name: '% des recettes',
                nameLocation: 'middle',
                nameGap: 45,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' },
                min: 20,
                max: 45,
                axisLabel: { formatter: '{value}%' },
                splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } }
            },
            series: [{ 
                name: 'Masse salariale',
                type: 'line', 
                data: masseSalData, 
                itemStyle: { color: this.colors.blue },
                lineStyle: { width: 3 },
                symbolSize: 10,
                smooth: true,
                label: { show: true, formatter: '{c}%', position: 'top', fontSize: 10 },
                markLine: { data: [{yAxis: 35, name: 'Norme UEMOA'}], label: { formatter: 'Norme 35%' }, lineStyle: { color: this.colors.green, type: 'dashed' } }
            }]
        });

        // 6. Dépenses d'Investissement (données réelles TOFE)
        const invest = this.nd('depenses_investissement');
        this.createChart('chart-fin-investment-budget', {
            tooltip: { trigger: 'axis', valueFormatter: (v) => Math.round(v).toLocaleString() + ' Mds FCFA' },
            xAxis: { 
                data: invest ? invest.years.map(String) : ['2018', '2019', '2020', '2021', '2022', '2023'],
                name: 'Année',
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' }
            },
            yAxis: { 
                name: 'Milliards FCFA',
                nameLocation: 'middle',
                nameGap: 50,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' },
                splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } }
            },
            series: [{ 
                name: 'Investissement',
                type: 'bar', 
                data: invest ? invest.values.map(v => Math.round(v)) : [1547, 1499, 1914, 2172, 3141, 3258], 
                itemStyle: { color: this.colors.green, borderRadius: [6,6,0,0] },
                label: { show: true, position: 'top', formatter: '{c}', fontSize: 10 }
            }]
        });

        // 7. Structure des Dépenses TOFE (données réelles)
        const remunVal = remun ? remun.values[remun.values.length - 1] : 2246;
        const investVal = invest ? invest.values[invest.values.length - 1] : 3258;
        const interets = this.nd('interets_dette');
        const interetsVal = interets ? interets.values[interets.values.length - 1] : 1239;
        const fonct = this.nd('depenses_fonctionnement');
        const fonctVal = fonct ? fonct.values[fonct.values.length - 1] : 1635;
        const subv = this.nd('subventions_transferts') || {};
        const subvVal = subv.values ? subv.values[subv.values.length - 1] : 695;
        this.createChart('chart-fin-subsidy', {
            tooltip: { trigger: 'item', formatter: '{b}: {c} Mds FCFA ({d}%)' },
            legend: { bottom: 5, itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 9 } },
            series: [{ 
                type: 'pie', 
                radius: ['35%', '60%'],
                center: ['50%', '42%'],
                itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
                label: { show: true, formatter: '{b}\n{d}%', fontSize: 9 },
                data: [
                    { value: Math.round(remunVal), name: 'Salaires', itemStyle: { color: this.colors.blue } },
                    { value: Math.round(investVal), name: 'Investissement', itemStyle: { color: this.colors.green } },
                    { value: Math.round(interetsVal), name: 'Intérêts dette', itemStyle: { color: this.colors.red } },
                    { value: Math.round(fonctVal), name: 'Fonctionnement', itemStyle: { color: this.colors.slate } },
                    { value: Math.round(subvVal), name: 'Subventions', itemStyle: { color: this.colors.orange } }
                ] 
            }]
        });

        // 8. Financement du Déficit (données réelles TOFE)
        const finInt = this.nd('financement_interieur') || {};
        const finExt = this.nd('financement_exterieur') || {};
        const finIntVal = finInt.values ? Math.round(finInt.values[finInt.values.length - 1]) : 490;
        const finExtVal = finExt.values ? Math.round(finExt.values[finExt.values.length - 1]) : 2005;
        const finTotal = Math.abs(finIntVal) + Math.abs(finExtVal);
        const finIntPct = finTotal > 0 ? Math.round(Math.abs(finIntVal) / finTotal * 100) : 20;
        const finExtPct = finTotal > 0 ? Math.round(Math.abs(finExtVal) / finTotal * 100) : 80;
        this.createChart('chart-fin-deficit-financing', {
            tooltip: { trigger: 'axis', valueFormatter: (v) => v + '%' },
            xAxis: { 
                data: ['Intérieur', 'Extérieur'],
                axisLabel: { fontWeight: 'bold' }
            },
            yAxis: { 
                name: '% du financement',
                nameLocation: 'middle',
                nameGap: 45,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' },
                max: 100,
                axisLabel: { formatter: '{value}%' },
                splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } }
            },
            series: [{ 
                name: 'Part',
                type: 'bar', 
                barWidth: '50%',
                data: [finIntPct, finExtPct], 
                itemStyle: { color: (p) => p.dataIndex === 0 ? this.colors.green : this.colors.blue, borderRadius: [6,6,0,0] },
                label: { show: true, position: 'top', formatter: '{c}%', fontSize: 12, fontWeight: 'bold' }
            }]
        });

        // 9. Structure des Recettes Fiscales (données réelles TOFE)
        const impDir = this.nd('impots_directs');
        const impBS = this.nd('impots_biens_services');
        const droitsImp = this.nd('droits_importation');
        const taxExp = this.nd('taxes_exportation');
        const impDirVal = impDir ? Math.round(impDir.values[impDir.values.length - 1]) : 3639;
        const impBSVal = impBS ? Math.round(impBS.values[impBS.values.length - 1]) : 1705;
        const droitsImpVal = droitsImp ? Math.round(droitsImp.values[droitsImp.values.length - 1]) : 1825;
        const taxExpVal = taxExp ? Math.round(taxExp.values[taxExp.values.length - 1]) : 445;
        this.createChart('chart-fin-tax-structure', {
            tooltip: { trigger: 'item', formatter: '{b}: {c} Mds FCFA ({d}%)' },
            legend: { bottom: 5, itemWidth: 12, itemHeight: 12 },
            series: [{ 
                type: 'pie', 
                radius: ['35%', '60%'],
                center: ['50%', '45%'],
                itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
                label: { show: true, formatter: '{b}\n{d}%', fontSize: 10 },
                data: [
                    { value: impDirVal, name: 'Impôts directs', itemStyle: { color: this.colors.blue } },
                    { value: impBSVal, name: 'Biens & services', itemStyle: { color: this.colors.orange } },
                    { value: droitsImpVal, name: 'Droits import', itemStyle: { color: this.colors.green } },
                    { value: taxExpVal, name: 'Taxes export', itemStyle: { color: this.colors.purple } }
                ] 
            }]
        });

        // 10. Composition de la Dette (données réelles base éco)
        const detteExt = this.nd('dette_exterieure_mds');
        const detteInt = this.nd('dette_interieure_mds');
        const detteYears = detteExt ? detteExt.years.slice(-5).map(String) : ['2019', '2020', '2021', '2022', '2023'];
        this.createChart('chart-fin-ext-debt', {
            tooltip: { trigger: 'axis', valueFormatter: (v) => Math.round(v).toLocaleString() + ' Mds FCFA' },
            legend: { top: 0, itemWidth: 12, itemHeight: 12 },
            xAxis: { 
                data: detteYears,
                name: 'Année',
                nameLocation: 'middle',
                nameGap: 30,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' }
            },
            yAxis: { 
                name: 'Mds FCFA',
                nameLocation: 'middle',
                nameGap: 55,
                nameTextStyle: { fontWeight: 'bold', color: '#6B7280' },
                axisLabel: { formatter: (v) => (v/1000).toFixed(0) + 'k' },
                splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } }
            },
            series: [
                { name: 'Extérieure', type: 'bar', stack: 'dette', data: detteExt ? detteExt.values.slice(-5).map(v => Math.round(v)) : [10757, 12311, 15069, 17156, 18623], itemStyle: { color: this.colors.blue, borderRadius: [0,0,0,0] } },
                { name: 'Intérieure', type: 'bar', stack: 'dette', data: detteInt ? detteInt.values.slice(-5).map(v => Math.round(v)) : [6046, 7959, 9705, 10626, 11787], itemStyle: { color: this.colors.green, borderRadius: [6,6,0,0] } }
            ]
        });
    },

    renderDemoCharts() {
        const s = this.dbData ? this.dbData.series : null;
        const urbPct = s ? s.urban_pct : null;
        const popGr = s ? s.pop_growth : null;
        const fert = s ? s.fertility : null;
        const lifeExp = s ? s.life_expectancy : null;
        const birthR = s ? s.birth_rate : null;
        const deathR = s ? s.death_rate : null;
        const pop = s ? s.population : null;

        this.createChart('chart-demo-pyramid', {
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (params) => {
                let res = params[0].name + '<br/>';
                params.forEach(p => {
                    res += p.marker + p.seriesName + ': ' + Math.abs(p.value) + '%<br/>';
                });
                return res;
            }},
            legend: { top: 0, data: ['Hommes', 'Femmes'] },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
            xAxis: { type: 'value', axisLabel: { formatter: (v) => Math.abs(v) + '%' } },
            yAxis: { type: 'category', data: ['0-4','5-9','10-14','15-19','20-24','25-29','30-34','35-39','40+'] },
            series: [
                { name: 'Hommes', type: 'bar', stack: 'total', label: { show: false }, data: [-14, -13, -12, -10, -9, -8, -7, -6, -15], itemStyle: { color: this.colors.blue } },
                { name: 'Femmes', type: 'bar', stack: 'total', label: { show: false }, data: [13, 12, 11, 10, 9, 8, 7, 6, 16], itemStyle: { color: this.colors.orange } }
            ]
        });

        // Urbanisation (données réelles)
        const urbYears = urbPct ? urbPct.years.filter((_, i) => i % 2 === 0 || i === urbPct.years.length - 1).map(String) : ['2015', '2018', '2020', '2022', '2024'];
        const urbVals = urbPct ? urbPct.values.filter((_, i) => i % 2 === 0 || i === urbPct.values.length - 1).map(v => Math.round(v * 10) / 10) : [49.4, 50.8, 51.7, 52.7, 53.6];
        this.createChart('chart-demo-urban', {
            tooltip: { trigger: 'axis' },
            legend: { top: 0 },
            xAxis: { data: urbYears },
            yAxis: { max: 100, axisLabel: { formatter: '{value} %' } },
            series: [
                { name: 'Urbain', type: 'line', stack: 'Total', areaStyle: {}, data: urbVals, smooth: true },
                { name: 'Rural', type: 'line', stack: 'Total', areaStyle: {}, data: urbVals.map(v => Math.round((100 - v) * 10) / 10), smooth: true }
            ]
        });
        
        this.createChart('chart-demo-density', {
            tooltip: { trigger: 'axis' },
            grid: { left: '3%', right: '15%', bottom: '3%', containLabel: true },
            yAxis: { type: 'category', data: ['Abidjan', 'Gôh-Djiboua', 'Sassandra-Marahoué'], inverse: true },
            xAxis: { type: 'value', name: 'Hab/km²' },
            series: [{ 
                type: 'bar', 
                data: [3000, 250, 180],
                label: { show: true, position: 'right' },
                itemStyle: { color: (params) => params.dataIndex === 0 ? this.colors.orange : this.colors.slate }
            }]
        });

        // Population totale (données réelles, convertie en millions)
        const popLatest = pop ? pop.values[pop.values.length - 1] : 31934230;
        this.createChart('chart-demo-proj', {
            tooltip: { trigger: 'axis' },
            xAxis: { data: pop ? pop.years.slice(-6).map(String) : ['2019','2020','2021','2022','2023','2024'] },
            yAxis: { name: 'Millions' },
            series: [{ 
                type: 'line', 
                data: pop ? pop.values.slice(-6).map(v => Math.round(v / 1e6 * 10) / 10) : [28.2, 28.9, 29.6, 30.4, 31.2, 31.9], 
                smooth: true, 
                lineStyle: { width: 3, color: this.colors.green },
                label: { show: true, formatter: '{c}M', position: 'top', fontSize: 10 }
            }]
        });

        // Taux de fécondité (données réelles)
        this.createChart('chart-demo-fertility', {
            xAxis: { data: fert ? fert.years.slice(-5).map(String) : ['2019','2020','2021','2022','2023'] },
            yAxis: { min: 3 },
            series: [{ type: 'line', data: fert ? fert.values.slice(-5).map(v => Math.round(v * 100) / 100) : [4.52, 4.46, 4.41, 4.35, 4.28], itemStyle: {color: this.colors.purple}, smooth: true }]
        });
        // Espérance de vie H/F (estimation basée sur la valeur globale)
        const lifeLatest = lifeExp ? lifeExp.values[lifeExp.values.length - 1] : 61.9;
        this.createChart('chart-demo-life-exp-gender', {
            xAxis: { data: ['Hommes', 'Femmes'] },
            yAxis: { min: 50 },
            series: [{ type: 'bar', data: [Math.round((lifeLatest - 1.5) * 10) / 10, Math.round((lifeLatest + 1.5) * 10) / 10], itemStyle: {color: (p) => p.dataIndex === 0 ? this.colors.blue : this.colors.orange} }]
        });
        this.createChart('chart-demo-migration', {
            xAxis: { data: ['2020', '2021', '2022'] },
            series: [{ type: 'bar', data: [-10000, -8000, -5000], itemStyle: {color: this.colors.red} }]
        });
        this.createChart('chart-demo-households', {
            tooltip: { trigger: 'item' },
            series: [{ type: 'pie', radius: '60%', data: [{value: 60, name: 'Nucléaire'}, {value: 30, name: 'Élargie'}, {value: 10, name: 'Monoparentale'}] }]
        });
        // Taux de croissance population (données réelles)
        this.createChart('chart-demo-growth-rate', {
            xAxis: { data: popGr ? popGr.years.slice(-5).map(String) : ['2020','2021','2022','2023','2024'] },
            series: [{ type: 'line', data: popGr ? popGr.values.slice(-5).map(v => Math.round(v * 100) / 100) : [2.53, 2.47, 2.52, 2.50, 2.44], itemStyle: {color: this.colors.green}, smooth: true }]
        });
        this.createChart('chart-demo-school-pop', {
            xAxis: { data: ['6-11 ans', '12-18 ans'] },
            series: [{ type: 'bar', data: [5.2, 4.8], name: 'Millions', itemStyle: {color: this.colors.orange} }]
        });
    },

    renderPrimaryCharts() {
        // 1. Production Cacao (données réelles base éco)
        const cacaoProd = this.nd('cacao_production');
        const cacaoTransfo = this.nd('cacao_transforme');
        this.createChart('chart-prim-cash-crops', {
            legend: { top: 0, textStyle: { fontSize: 10 } },
            tooltip: { trigger: 'axis', valueFormatter: (v) => Math.round(v).toLocaleString() + ' t' },
            xAxis: { data: cacaoProd ? cacaoProd.years.slice(-6).map(String) : ['2018', '2019', '2020', '2021', '2022', '2023'] },
            yAxis: { name: 'Tonnes', axisLabel: { formatter: (v) => (v/1000).toFixed(0) + 'k' } },
            series: [
                { name: 'Production', type: 'bar', data: cacaoProd ? cacaoProd.values.slice(-6).map(v => Math.round(v)) : [2154000, 2180000, 2105000, 2248000, 2200000, 2300000], itemStyle: { color: '#8B4513', borderRadius: [4,4,0,0] } },
                { name: 'Transformé', type: 'bar', data: cacaoTransfo ? cacaoTransfo.values.slice(-6).map(v => Math.round(v)) : [660000, 700000, 720000, 750000, 780000, 800000], itemStyle: { color: '#F4A460', borderRadius: [4,4,0,0] } }
            ]
        });

        // 2. Taux de transformation cacao (données réelles)
        const cacaoTaux = this.nd('cacao_taux_transfo');
        this.createChart('chart-prim-food-crops', {
            tooltip: { trigger: 'axis', valueFormatter: (v) => v.toFixed(1) + '%' },
            xAxis: { data: cacaoTaux ? cacaoTaux.years.slice(-6).map(String) : ['2018', '2019', '2020', '2021', '2022', '2023'] },
            yAxis: { name: 'Taux (%)', max: 50, axisLabel: { formatter: '{value}%' } },
            series: [{ type: 'line', data: cacaoTaux ? cacaoTaux.values.slice(-6).map(v => Math.round(v * 10) / 10) : [30, 32, 34, 33, 35, 35], name: 'Taux transformation', smooth: true, symbolSize: 10, lineStyle: { width: 3, color: this.colors.green }, itemStyle: { color: this.colors.green }, areaStyle: { opacity: 0.1 }, label: { show: true, formatter: '{c}%', position: 'top', fontSize: 10 } }]
        });

        // 3. Part du PIB primaire (données réelles)
        const pibPrim = this.nd('pib_primaire_pct');
        const lastPrim = pibPrim ? Math.round(pibPrim.values[pibPrim.values.length - 1] * 10) / 10 : 16.6;
        this.createChart('chart-prim-export-share', {
            tooltip: { trigger: 'item', formatter: '{b}: {d}%' },
            series: [{ 
                type: 'pie', 
                radius: ['40%', '70%'],
                itemStyle: { borderRadius: 5, borderColor: '#fff', borderWidth: 2 },
                data: [{value: lastPrim, name: 'Secteur Primaire', itemStyle: {color: this.colors.green}}, {value: 100 - lastPrim, name: 'Autres secteurs', itemStyle: {color: '#E5E7EB'}}] 
            }]
        });

        // 4. Emploi dans le primaire (données réelles)
        const empPrim = this.nd('emploi_primaire');
        const empTotal = this.nd('emploi_total');
        let empYears = ['2015', '2018', '2021', '2023'];
        let empData = [46, 45, 46, 46];
        if (empPrim && empTotal && empPrim.values.length > 0) {
            empYears = empPrim.years.map(String);
            empData = empPrim.values.map((v, i) => empTotal.values[i] > 0 ? Math.round(v / empTotal.values[i] * 1000) / 10 : 0);
        }
        this.createChart('chart-prim-employment', {
            tooltip: { trigger: 'axis', valueFormatter: (v) => v + '%' },
            xAxis: { data: empYears },
            yAxis: { max: 60, min: 30, axisLabel: { formatter: '{value}%' } },
            series: [{ type: 'line', data: empData, name: '% Emploi Total', smooth: true, symbolSize: 10, lineStyle: { width: 3, color: this.colors.blue }, itemStyle: { color: this.colors.blue }, areaStyle: { opacity: 0.1 }, label: { show: true, formatter: '{c}%', position: 'top', fontSize: 10 } }]
        });

        // New Primary Sector Charts
        this.createChart('chart-prim-rubber-palm', {
            xAxis: { data: ['Hévéa', 'Palmier'] },
            series: [{ type: 'bar', data: [900000, 600000], itemStyle: {color: this.colors.green} }]
        });
        this.createChart('chart-prim-fishery', {
            xAxis: { data: ['2020', '2021', '2022'] },
            series: [{ type: 'line', data: [80000, 85000, 90000], itemStyle: {color: this.colors.blue} }]
        });
        this.createChart('chart-prim-livestock', {
            xAxis: { data: ['Bovins', 'Ovins', 'Caprins'] },
            series: [{ type: 'bar', data: [1.6, 2.3, 2.5], name: 'Millions de têtes', itemStyle: {color: '#8B4513'} }]
        });
        this.createChart('chart-prim-cocoa-price', {
            xAxis: { data: ['2022', '2023', '2024'] },
            series: [{ type: 'line', data: [2200, 2600, 3500], itemStyle: {color: this.colors.orange}, smooth: true }]
        });
        this.createChart('chart-prim-land-use', {
            tooltip: { trigger: 'item' },
            series: [{ type: 'pie', radius: '60%', data: [{value: 40, name: 'Cacao/Café'}, {value: 20, name: 'Anacarde'}, {value: 30, name: 'Vivrier'}, {value: 10, name: 'Autres'}] }]
        });
        this.createChart('chart-prim-farmers-income', {
            xAxis: { data: ['2020', '2023'] },
            series: [{ type: 'bar', data: [900, 1100], name: 'FCFA/Kg (Cacao)', itemStyle: {color: this.colors.green} }]
        });
    },

    renderSecondaryCharts() {
        this.createChart('chart-sec-ipi', {
            xAxis: { data: ['Q1', 'Q2', 'Q3', 'Q4'] },
            yAxis: { scale: true },
            series: [{ type: 'line', data: [102, 105, 108, 110], name: 'Indice', smooth: true, areaStyle: { opacity: 0.1 } }]
        });
        this.createChart('chart-sec-mining', {
            tooltip: { trigger: 'axis' },
            xAxis: { data: ['2020', '2021', '2022', '2023'] },
            series: [{ type: 'bar', data: [38, 42, 48, 50], itemStyle: {color: '#FFD700'}, name: 'Or (Tonnes)' }]
        });
        this.createChart('chart-sec-energy', {
            tooltip: { trigger: 'item' },
            series: [{ 
                type: 'pie', 
                radius: '70%',
                data: [
                    {value: 70, name: 'Thermique', itemStyle: {color: this.colors.slate}}, 
                    {value: 30, name: 'Hydraulique', itemStyle: {color: this.colors.blue}}
                ] 
            }]
        });
        this.createChart('chart-sec-btp', {
            xAxis: { data: ['2021', '2022', '2023'] },
            yAxis: { name: '% Croissance' },
            series: [{ type: 'line', data: [12, 15, 18], smooth: true, symbolSize: 8, lineStyle: {width: 3} }]
        });

        // New Secondary Sector Charts
        this.createChart('chart-sec-oil', {
            xAxis: { data: ['2020', '2021', '2022', '2023'] },
            series: [{ type: 'bar', data: [25000, 28000, 30000, 45000], itemStyle: {color: this.colors.slate} }]
        });
        this.createChart('chart-sec-cement', {
            xAxis: { data: ['2020', '2021', '2022'] },
            series: [{ type: 'line', data: [4.5, 5.0, 5.8], name: 'Mio Tonnes', itemStyle: {color: this.colors.gray} }]
        });
        this.createChart('chart-sec-elec-consumption', {
            xAxis: { data: ['2020', '2021', '2022'] },
            series: [{ type: 'bar', data: [5000, 5500, 6000], itemStyle: {color: this.colors.orange} }]
        });
        this.createChart('chart-sec-agro-trans', {
            series: [{ type: 'gauge', detail: {formatter: '{value}%'}, data: [{value: 35, name: 'Transformation Cacao'}] }]
        });
        this.createChart('chart-sec-ippi', {
            xAxis: { data: ['Q1', 'Q2', 'Q3'] },
            series: [{ type: 'line', data: [105, 108, 110], name: 'Indice Prix', itemStyle: {color: this.colors.purple} }]
        });
        this.createChart('chart-sec-ind-jobs', {
            xAxis: { data: ['2021', '2022'] },
            series: [{ type: 'bar', data: [350000, 380000], itemStyle: {color: this.colors.blue} }]
        });
    },

    renderTertiaryCharts() {
        const s = this.dbData ? this.dbData.series : null;
        const internet = s ? s.internet_users : null;
        const mobile = s ? s.mobile_subscriptions : null;
        const mobileLatest = mobile ? Math.round(mobile.values[mobile.values.length - 1]) : 172;
        const internetLatest = internet ? Math.round(internet.values[internet.values.length - 1]) : 41;

        this.createChart('chart-tert-trade', {
            xAxis: { data: ['2020', '2023'] },
            series: [{ type: 'bar', data: [15, 18], name: '% PIB', itemStyle: {color: this.colors.purple} }]
        });
        // Télécoms (données réelles: abonnés mobile et internet pour 100 hab)
        this.createChart('chart-tert-telecom', {
            tooltip: { trigger: 'item', formatter: '{b}: {c} pour 100 hab ({d}%)' },
            series: [{ 
                type: 'pie', 
                radius: ['40%', '70%'],
                data: [{value: mobileLatest, name: 'Abonnés Mobile', itemStyle: {color: this.colors.orange}}, {value: internetLatest, name: 'Utilisateurs Internet', itemStyle: {color: this.colors.blue}}] 
            }]
        });
        this.createChart('chart-tert-tourism', {
            xAxis: { data: ['2019', '2020', '2021', '2022', '2023'] },
            series: [{ type: 'line', data: [2.0, 0.5, 0.9, 1.5, 2.3], name: 'Mio Visiteurs', smooth: true, areaStyle: {} }]
        });
        this.createChart('chart-tert-banking', {
            xAxis: { data: ['2018', '2022'] },
            yAxis: { max: 100 },
            series: [{ type: 'bar', barWidth: 40, data: [22, 45], name: 'Taux Bancarisation (%)', label: {show: true, position: 'top', formatter: '{c}%'} }]
        });

        // New Tertiary Sector Charts
        this.createChart('chart-tert-retail', {
            xAxis: { data: ['Q1', 'Q2', 'Q3'] },
            series: [{ type: 'line', data: [110, 115, 120], itemStyle: {color: this.colors.green}, smooth: true }]
        });
        this.createChart('chart-tert-ict-growth', {
            xAxis: { data: ['2020', '2021', '2022', '2023'] },
            series: [{ type: 'bar', data: [8, 9, 10, 12], itemStyle: {color: this.colors.purple} }]
        });
        this.createChart('chart-tert-transport-air', {
            xAxis: { data: ['2021', '2022', '2023'] },
            series: [{ type: 'bar', data: [1.2, 2.0, 2.3], name: 'Mio Passagers', itemStyle: {color: this.colors.blue} }]
        });
        this.createChart('chart-tert-transport-port', {
            xAxis: { data: ['2021', '2022', '2023'] },
            series: [{ type: 'line', data: [28, 30, 32], name: 'Mio Tonnes', itemStyle: {color: this.colors.slate} }]
        });
        this.createChart('chart-tert-services-export', {
            xAxis: { data: ['2020', '2022'] },
            series: [{ type: 'bar', data: [500, 700], itemStyle: {color: this.colors.orange} }]
        });
        this.createChart('chart-tert-credit-private', {
            xAxis: { data: ['2020', '2021', '2022', '2023'] },
            series: [{ type: 'line', data: [10, 12, 15, 14], name: '% Croissance', itemStyle: {color: this.colors.green} }]
        });
    },

    renderEducationCharts() {
        const s = this.dbData ? this.dbData.series : null;
        const primEnr = s ? s.primary_enroll : null;
        const secEnr = s ? s.secondary_enroll : null;
        const terEnr = s ? s.tertiary_enroll : null;
        const lit = s ? s.literacy : null;

        // Données réelles: dernière valeur connue pour le radar
        const primLatest = primEnr ? Math.round(primEnr.values[primEnr.values.length - 1]) : 102;
        const secLatest = secEnr ? Math.round(secEnr.values[secEnr.values.length - 1]) : 66;
        const terLatest = terEnr ? Math.round(terEnr.values[terEnr.values.length - 1]) : 11;

        this.createChart('chart-edu-rates', {
            radar: { indicator: [{name: 'Primaire', max: 120}, {name: 'Secondaire', max: 120}, {name: 'Supérieur', max: 120}] },
            tooltip: { trigger: 'item' },
            series: [{ 
                type: 'radar', 
                data: [{value: [primLatest, secLatest, terLatest], name: 'Taux Brut (%)'}],
                areaStyle: { opacity: 0.2, color: this.colors.orange },
                itemStyle: { color: this.colors.orange }
            }]
        });
        this.createChart('chart-edu-budget', {
            series: [{ 
                type: 'gauge', 
                progress: { show: true }, 
                detail: {valueAnimation: true, formatter: '{value}%', fontSize: 16}, 
                data: [{value: 23, name: '% Budget État', itemStyle: {color: this.colors.green}}] 
            }]
        });
        // Alphabétisation (dernière donnée BDD : ~50%)
        const litLatest = lit ? Math.round(lit.values[lit.values.length - 1]) : 50;
        this.createChart('chart-edu-literacy', {
            tooltip: { trigger: 'axis', valueFormatter: (v) => v + '%' },
            xAxis: { data: ['Hommes', 'Femmes'] },
            yAxis: { max: 100 },
            series: [{ type: 'bar', barWidth: 50, data: [Math.round(litLatest * 1.15), Math.round(litLatest * 0.85)], itemStyle: { color: (p) => p.dataIndex === 0 ? this.colors.blue : this.colors.purple } }]
        });
        this.createChart('chart-edu-distribution', {
            tooltip: { trigger: 'item' },
            series: [{ 
                type: 'pie', 
                radius: ['40%', '70%'],
                data: [{value: 80, name: 'Public', itemStyle: {color: this.colors.blue}}, {value: 20, name: 'Privé', itemStyle: {color: this.colors.orange}}] 
            }]
        });

        // Scolarisation primaire évolution (données réelles)
        this.createChart('chart-edu-completion', {
            xAxis: { data: primEnr ? [primEnr.years[0], primEnr.years[primEnr.years.length - 1]].map(String) : ['2015', '2023'] },
            yAxis: { max: 120 },
            series: [{ type: 'bar', data: primEnr ? [Math.round(primEnr.values[0]), Math.round(primEnr.values[primEnr.values.length - 1])] : [86, 102], itemStyle: {color: this.colors.green}, label: {show: true, position: 'top', formatter: '{c}%'} }]
        });
        this.createChart('chart-edu-gender-parity', {
            xAxis: { data: ['Primaire', 'Secondaire'] },
            yAxis: { max: 1.2 },
            series: [{ type: 'bar', data: [0.98, 0.85], itemStyle: {color: this.colors.purple} }]
        });
        this.createChart('chart-edu-teachers', {
            xAxis: { data: ['Primaire', 'Secondaire'] },
            series: [{ type: 'bar', data: [42, 25], name: 'Élèves par Prof', itemStyle: {color: this.colors.slate} }]
        });
        this.createChart('chart-edu-uni-graduates', {
            tooltip: { trigger: 'item' },
            series: [{ type: 'pie', radius: '60%', data: [{value: 40, name: 'Lettres/SHS'}, {value: 25, name: 'Eco/Droit'}, {value: 35, name: 'Sciences/Tech'}] }]
        });
        this.createChart('chart-edu-vocational', {
            xAxis: { data: ['2020', '2023'] },
            series: [{ type: 'bar', data: [60000, 95000], itemStyle: {color: this.colors.orange} }]
        });
        this.createChart('chart-edu-infra', {
            xAxis: { data: ['2021', '2022', '2023'] },
            series: [{ type: 'line', data: [2000, 2500, 3000], name: 'Salles construites', itemStyle: {color: this.colors.blue} }]
        });
    },

    renderEmploiCharts() {
        const s = this.dbData ? this.dbData.series : null;
        const unemp = s ? s.unemployment : null;
        const unempLatest = unemp ? Math.round(unemp.values[unemp.values.length - 1] * 10) / 10 : 2.3;

        this.createChart('chart-emp-unemployment', {
            series: [{ 
                type: 'gauge', 
                min: 0, max: 10, 
                detail: { formatter: '{value}%' },
                data: [{value: unempLatest, name: 'Chômage', itemStyle: {color: this.colors.green}}] 
            }]
        });
        this.createChart('chart-emp-sectors', {
            tooltip: { trigger: 'item' },
            series: [{ 
                type: 'pie', 
                radius: '60%',
                data: [
                    {value: 46, name: 'Agri', itemStyle: {color: this.colors.green}}, 
                    {value: 14, name: 'Indus', itemStyle: {color: this.colors.orange}}, 
                    {value: 40, name: 'Services', itemStyle: {color: this.colors.blue}}
                ] 
            }]
        });
        this.createChart('chart-emp-informal', {
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'value', max: 100 },
            yAxis: { type: 'category', data: ['Informel', 'Formel'] },
            series: [{ type: 'bar', data: [85, 15], itemStyle: { color: (p) => p.dataIndex === 0 ? this.colors.slate : this.colors.blue } }]
        });
        this.createChart('chart-emp-creation', {
            tooltip: { trigger: 'axis' },
            xAxis: { data: ['2021', '2022', '2023'] },
            series: [{ type: 'line', data: [80000, 95000, 110000], areaStyle: { opacity: 0.1 }, smooth: true, itemStyle: {color: this.colors.green} }]
        });

        // New Employment Charts
        this.createChart('chart-emp-youth', {
            series: [{ type: 'gauge', max: 10, detail: {formatter: '{value}%'}, data: [{value: 4.5, name: 'Chômage Jeunes'}] }]
        });
        this.createChart('chart-emp-gender', {
            xAxis: { data: ['Hommes', 'Femmes'] },
            series: [{ type: 'bar', data: [2.0, 3.5], itemStyle: {color: (p) => p.dataIndex === 0 ? this.colors.blue : this.colors.purple} }]
        });
        this.createChart('chart-emp-wages', {
            xAxis: { data: ['2020', '2023'] },
            series: [{ type: 'bar', data: [150000, 180000], name: 'Salaire Moyen', itemStyle: {color: this.colors.green} }]
        });
        this.createChart('chart-emp-public', {
            xAxis: { data: ['2015', '2023'] },
            series: [{ type: 'line', data: [200000, 280000], itemStyle: {color: this.colors.slate}, smooth: true }]
        });
        this.createChart('chart-emp-skills', {
            tooltip: { trigger: 'item' },
            series: [{ type: 'pie', radius: '60%', data: [{value: 40, name: 'Adapté'}, {value: 60, name: 'Inadapté'}] }]
        });
        this.createChart('chart-emp-underemployment', {
            series: [{ type: 'gauge', detail: {formatter: '{value}%'}, data: [{value: 12, name: 'Sous-emploi'}] }]
        });
    },

    renderSanteCharts() {
        const s = this.dbData ? this.dbData.series : null;
        const lifeExp = s ? s.life_expectancy : null;
        const infMort = s ? s.infant_mortality : null;
        const healthExp = s ? s.health_expenditure : null;
        const phys = s ? s.physicians : null;

        // Espérance de vie (données réelles)
        this.createChart('chart-health-life-exp', {
            tooltip: { trigger: 'axis' },
            xAxis: { data: lifeExp ? lifeExp.years.slice(-6).map(String) : ['2018','2019','2020','2021','2022','2023'] },
            yAxis: { min: 50 },
            series: [{ type: 'line', data: lifeExp ? lifeExp.values.slice(-6).map(v => Math.round(v * 10) / 10) : [59.8, 60.3, 60.1, 60.3, 61.6, 61.9], smooth: true, markPoint: {data: [{type: 'max'}]} }]
        });
        // Mortalité infantile (données réelles)
        const imFirst = infMort ? Math.round(infMort.values[0] * 10) / 10 : 91.4;
        const imLast = infMort ? Math.round(infMort.values[infMort.values.length - 1] * 10) / 10 : 46.6;
        this.createChart('chart-health-infant', {
            tooltip: { trigger: 'axis' },
            xAxis: { data: infMort ? [String(infMort.years[0]), String(infMort.years[infMort.years.length - 1])] : ['2000', '2023'] },
            series: [{ type: 'bar', data: [imFirst, imLast], name: 'Pour 1000', itemStyle: {color: this.colors.red}, label: {show: true, position: 'top'} }]
        });
        this.createChart('chart-health-access', {
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: ['2015', '2023'] },
            yAxis: {},
            series: [{ type: 'bar', data: [1.2, 1.8], name: 'Infra/10k', itemStyle: {color: this.colors.blue} }] 
        });
        this.createChart('chart-health-cmu', {
            tooltip: { trigger: 'item' },
            series: [{ 
                type: 'pie', 
                radius: ['50%', '70%'],
                label: { show: true, position: 'center', formatter: '{d}%', fontSize: 20, fontWeight: 'bold' },
                data: [{value: 12, name: 'Enrôlés actifs', itemStyle: {color: this.colors.green}}, {value: 88, name: 'Reste', itemStyle: {color: '#eee'}}] 
            }]
        });

        this.createChart('chart-health-hiv', {
            xAxis: { data: ['2010', '2023'] },
            yAxis: { name: '%' },
            series: [{ type: 'line', data: [3.5, 1.9], itemStyle: {color: this.colors.red} }]
        });
        this.createChart('chart-health-malaria', {
            xAxis: { data: ['2015', '2023'] },
            series: [{ type: 'bar', data: [250, 150], name: 'Incidence/1000', itemStyle: {color: this.colors.orange} }]
        });
        // Médecins pour 1000 hab (données réelles)
        const physFirst = phys && phys.values.length ? Math.round(phys.values[0] * 1000) / 100 : 1.1;
        const physLast = phys && phys.values.length ? Math.round(phys.values[phys.values.length - 1] * 1000) / 100 : 1.8;
        this.createChart('chart-health-doctors', {
            xAxis: { data: phys ? [String(phys.years[0]), String(phys.years[phys.years.length - 1])] : ['2004', '2022'] },
            series: [{ type: 'bar', data: [physFirst, physLast], name: 'Médecins/10k', itemStyle: {color: this.colors.blue}, label: {show: true, position: 'top'} }]
        });
        // Dépenses de santé (% PIB, données réelles)
        const healthLatest = healthExp ? Math.round(healthExp.values[healthExp.values.length - 1] * 10) / 10 : 3.6;
        this.createChart('chart-health-budget', {
            series: [{ type: 'gauge', detail: {formatter: '{value}%'}, data: [{value: healthLatest, name: '% du PIB', itemStyle: {color: this.colors.green}}] }]
        });
        this.createChart('chart-health-vaccination', {
            series: [{ type: 'gauge', detail: {formatter: '{value}%'}, data: [{value: 85, name: 'DTP3', itemStyle: {color: this.colors.purple}}] }]
        });
        this.createChart('chart-health-malnutrition', {
            xAxis: { data: ['Aiguë', 'Chronique'] },
            series: [{ type: 'bar', data: [6, 20], name: '% Enfants', itemStyle: {color: this.colors.red} }]
        });
    },

    renderPolitiqueCharts() {
        this.createChart('chart-gov-cpi', {
            tooltip: { trigger: 'axis' },
            xAxis: { data: ['2020', '2021', '2022', '2023'] },
            yAxis: { min: 0, max: 100 },
            series: [{ type: 'line', data: [36, 36, 37, 38], name: 'Score/100', itemStyle: {color: this.colors.orange} }]
        });
        this.createChart('chart-gov-ibrahim', {
            series: [{ 
                type: 'gauge', 
                min: 0, max: 100, 
                splitNumber: 5,
                detail: {formatter: '{value}'},
                data: [{value: 54, name: 'Score IIAG'}] 
            }]
        });
        this.createChart('chart-gov-business', {
            tooltip: { trigger: 'axis' },
            xAxis: { data: ['2015', '2020'] }, 
            yAxis: { inverse: true, min: 100, max: 150 },
            series: [{ type: 'bar', data: [140, 110], name: 'Rang (Inversé)', itemStyle: {color: this.colors.blue} }]
        });
        this.createChart('chart-gov-votes', {
            tooltip: { trigger: 'item' },
            series: [{ 
                type: 'pie', 
                radius: '60%',
                data: [{value: 53, name: 'Votants', itemStyle: {color: this.colors.green}}, {value: 47, name: 'Abstention', itemStyle: {color: this.colors.slate}}] 
            }]
        });

        // New Politics Charts
        this.createChart('chart-gov-press', {
            xAxis: { data: ['2020', '2023'] },
            yAxis: { inverse: true },
            series: [{ type: 'bar', data: [68, 54], name: 'Rang RSF', itemStyle: {color: this.colors.blue} }]
        });
        this.createChart('chart-gov-women', {
            xAxis: { data: ['Assemblée', 'Sénat', 'Gouv'] },
            series: [{ type: 'bar', data: [15, 20, 25], name: '% Femmes', itemStyle: {color: this.colors.purple} }]
        });
        this.createChart('chart-gov-efficiency', {
            series: [{ type: 'gauge', detail: {formatter: '{value}'}, data: [{value: 45, name: 'Score'}] }]
        });
        this.createChart('chart-gov-stability', {
            xAxis: { data: ['2015', '2023'] },
            series: [{ type: 'line', data: [40, 55], itemStyle: {color: this.colors.green} }]
        });
        this.createChart('chart-gov-law', {
            series: [{ type: 'gauge', detail: {formatter: '{value}'}, data: [{value: 48, name: 'Score'}] }]
        });
        this.createChart('chart-gov-transparency', {
            series: [{ type: 'gauge', detail: {formatter: '{value}'}, data: [{value: 50, name: 'Score'}] }]
        });
    },

    renderCultureCharts() {
        this.createChart('chart-cult-can', {
            tooltip: { trigger: 'item' },
            xAxis: { type: 'category', data: ['Impact Est.'] },
            yAxis: { name: 'Mds FCFA' },
            series: [{ type: 'bar', barWidth: 50, data: [1200], name: 'Mds FCFA', itemStyle: {color: this.colors.orange} }]
        });
        this.createChart('chart-cult-tourism', {
            tooltip: { trigger: 'axis' },
            xAxis: { data: ['2023', '2024'] },
            series: [{ type: 'line', data: [1.2, 1.8], name: 'Millions', smooth: true, areaStyle: {} }]
        });
        this.createChart('chart-cult-creative', {
            tooltip: { trigger: 'item' },
            series: [{ type: 'pie', radius: '60%', data: [{value: 40, name: 'Musique'}, {value: 30, name: 'Mode'}, {value: 30, name: 'Art'}] }]
        });
        this.createChart('chart-cult-infra', {
            tooltip: { trigger: 'axis' },
            xAxis: { data: ['Stades', 'Musées'] },
            series: [{ type: 'bar', data: [6, 4], itemStyle: {color: this.colors.purple} }]
        });

        // New Culture Charts
        this.createChart('chart-cult-museums', {
            xAxis: { data: ['2021', '2023'] },
            series: [{ type: 'bar', data: [50000, 150000], name: 'Visiteurs', itemStyle: {color: this.colors.blue} }]
        });
        this.createChart('chart-cult-tourism-jobs', {
            xAxis: { data: ['2020', '2024'] },
            series: [{ type: 'bar', data: [200000, 300000], itemStyle: {color: this.colors.green} }]
        });
        this.createChart('chart-cult-revenue', {
            xAxis: { data: ['2021', '2023'] },
            series: [{ type: 'line', data: [500, 1000], itemStyle: {color: this.colors.orange} }]
        });
        this.createChart('chart-cult-cinema', {
            xAxis: { data: ['2020', '2023'] },
            series: [{ type: 'bar', data: [5, 15], name: 'Films produits', itemStyle: {color: this.colors.red} }]
        });
        this.createChart('chart-cult-events', {
            xAxis: { data: ['Abidjan', 'Intérieur'] },
            series: [{ type: 'pie', radius: '50%', data: [{value: 70, name: 'Abidjan'}, {value: 30, name: 'Intérieur'}] }]
        });
        this.createChart('chart-cult-unesco', {
            xAxis: { data: ['Sites'] },
            series: [{ type: 'bar', data: [5], itemStyle: {color: this.colors.slate}, label: {show:true, position:'top'} }]
        });
    },

    renderInterCharts() {
        const s = this.dbData ? this.dbData.series : null;
        const fdi = s ? s.fdi_pct : null;

        // 1. Balance commerciale (données réelles Douanes - Mds FCFA)
        const soldeComm = this.nd('solde_commercial');
        const impsCaf = this.nd('imports_caf');
        const expsFob = this.nd('exports_fob');
        const tradeYears = soldeComm ? soldeComm.years.map(String) : ['2019', '2020', '2021', '2022', '2023'];
        this.createChart('chart-int-balance', {
            tooltip: { trigger: 'axis', valueFormatter: (v) => Math.round(v).toLocaleString() + ' Mds FCFA' },
            legend: { bottom: 0, textStyle: { fontSize: 10 } },
            xAxis: { data: tradeYears },
            yAxis: { axisLabel: { formatter: (v) => (v/1000).toFixed(0) + 'k' }, splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } } },
            series: [
                { name: 'Exports FOB', type: 'bar', data: expsFob ? expsFob.values.map(v => Math.round(v)) : [6578, 6370, 7284, 8148, 9455], itemStyle: { color: this.colors.green, borderRadius: [4,4,0,0] } },
                { name: 'Imports CAF', type: 'bar', data: impsCaf ? impsCaf.values.map(v => Math.round(v)) : [5271, 5316, 6552, 9158, 9745], itemStyle: { color: this.colors.red, borderRadius: [4,4,0,0] } },
                { name: 'Solde', type: 'line', data: soldeComm ? soldeComm.values.map(v => Math.round(v)) : [1308, 1055, 732, -1011, -290], itemStyle: { color: this.colors.slate }, lineStyle: { width: 2, type: 'dashed' }, symbolSize: 8 }
            ]
        });

        // 2. Exports par zone géographique (données réelles Douanes)
        const expEurope = this.nd('export_europe');
        const expAfrique = this.nd('export_afrique');
        const expAsie = this.nd('export_asie');
        const expAmerique = this.nd('export_amerique');
        const lastExpEurope = expEurope ? Math.round(expEurope.values[expEurope.values.length - 1]) : 3600;
        const lastExpAfrique = expAfrique ? Math.round(expAfrique.values[expAfrique.values.length - 1]) : 2000;
        const lastExpAsie = expAsie ? Math.round(expAsie.values[expAsie.values.length - 1]) : 2200;
        const lastExpAmerique = expAmerique ? Math.round(expAmerique.values[expAmerique.values.length - 1]) : 600;
        this.createChart('chart-int-partners-exp', {
            tooltip: { trigger: 'item', formatter: '{b}: {c} Mds FCFA ({d}%)' },
            legend: { bottom: 5, itemWidth: 12, itemHeight: 12 },
            series: [{ type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
                itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
                label: { show: true, formatter: '{b}\n{d}%', fontSize: 10 },
                data: [
                    { value: lastExpEurope, name: 'Europe', itemStyle: { color: this.colors.blue } },
                    { value: lastExpAfrique, name: 'Afrique', itemStyle: { color: this.colors.green } },
                    { value: lastExpAsie, name: 'Asie', itemStyle: { color: this.colors.orange } },
                    { value: lastExpAmerique, name: 'Amérique', itemStyle: { color: this.colors.purple } }
                ]
            }]
        });

        // 3. IDE (données réelles Banque Mondiale)
        this.createChart('chart-int-fdi', {
            tooltip: { trigger: 'axis', valueFormatter: (v) => v.toFixed(2) + '% du PIB' },
            xAxis: { data: fdi ? fdi.years.slice(-5).map(String) : ['2019', '2020', '2021', '2022', '2023'] },
            yAxis: { axisLabel: { formatter: '{value}%' }, splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } } },
            series: [{ type: 'line', data: fdi ? fdi.values.slice(-5).map(v => Math.round(v * 100) / 100) : [1.41, 1.13, 1.91, 2.26, 2.20], name: 'IDE (% PIB)', smooth: true, symbolSize: 10, lineStyle: { width: 3 }, itemStyle: {color: this.colors.blue}, areaStyle: {opacity: 0.1}, label: { show: true, formatter: '{c}%', position: 'top', fontSize: 10 } }]
        });

        // 4. Appuis budgétaires (données réelles TOFE)
        const appuis = this.nd('dons');
        this.createChart('chart-int-donors', {
            tooltip: { trigger: 'axis', valueFormatter: (v) => Math.round(v) + ' Mds FCFA' },
            xAxis: { data: appuis ? appuis.years.map(String) : ['2018', '2019', '2020', '2021', '2022', '2023'] },
            yAxis: { axisLabel: { formatter: (v) => v.toFixed(0) }, splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } } },
            series: [{ type: 'bar', data: appuis ? appuis.values.map(v => Math.round(v)) : [246, 275, 193, 185, 234, 317], name: 'Dons reçus', itemStyle: { color: this.colors.green, borderRadius: [6,6,0,0] }, label: { show: true, position: 'top', formatter: '{c}', fontSize: 10 } }]
        });

        // 5. Top Produits Exportés (données réelles Douanes)
        const topExpData = [];
        for (let i = 0; i < 10; i++) {
            const s = this.nd('top_export_' + i);
            if (s) topExpData.push({ name: s.name.substring(0, 20), value: Math.round(s.values[s.values.length - 1]) });
        }
        this.createChart('chart-int-products-exp', {
            tooltip: { trigger: 'item', formatter: '{b}: {c} Mds FCFA ({d}%)' },
            legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 8 } },
            series: [{ type: 'pie', radius: ['30%', '60%'], center: ['50%', '42%'],
                itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 1 },
                label: { show: false },
                data: topExpData.length > 0 ? topExpData : [{value: 40, name: 'Cacao'}, {value: 20, name: 'Pétrole'}, {value: 10, name: 'Or'}]
            }]
        });

        // 6. Top Produits Importés (données réelles Douanes)
        const topImpData = [];
        for (let i = 0; i < 10; i++) {
            const s = this.nd('top_import_' + i);
            if (s) topImpData.push({ name: s.name.substring(0, 20), value: Math.round(s.values[s.values.length - 1]) });
        }
        this.createChart('chart-int-products-imp', {
            tooltip: { trigger: 'item', formatter: '{b}: {c} Mds FCFA ({d}%)' },
            legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { fontSize: 8 } },
            series: [{ type: 'pie', radius: ['30%', '60%'], center: ['50%', '42%'],
                itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 1 },
                label: { show: false },
                data: topImpData.length > 0 ? topImpData : [{value: 25, name: 'Pétrole'}, {value: 15, name: 'Riz'}, {value: 10, name: 'Véhicules'}]
            }]
        });

        // 7. Service dette extérieure par créancier (données réelles financements)
        const sExtBil = this.nd('service_ext_bilateral');
        const sExtMul = this.nd('service_ext_multilateral');
        const sExtObl = this.nd('service_ext_obligations');
        const lastBil = sExtBil ? Math.round(sExtBil.values[sExtBil.values.length - 1]) : 276;
        const lastMul = sExtMul ? Math.round(sExtMul.values[sExtMul.values.length - 1]) : 423;
        const lastObl = sExtObl ? Math.round(sExtObl.values[sExtObl.values.length - 1]) : 597;
        this.createChart('chart-int-debt-creditors', {
            tooltip: { trigger: 'item', formatter: '{b}: {c} Mds FCFA ({d}%)' },
            legend: { bottom: 5, itemWidth: 12, itemHeight: 12 },
            series: [{ type: 'pie', radius: ['40%', '70%'], center: ['50%', '45%'],
                itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
                label: { show: true, formatter: '{b}\n{d}%', fontSize: 10 },
                data: [
                    { value: lastBil, name: 'Bilatéral', itemStyle: { color: this.colors.green } },
                    { value: lastMul, name: 'Multilatéral', itemStyle: { color: this.colors.blue } },
                    { value: lastObl, name: 'Obligations', itemStyle: { color: this.colors.orange } }
                ]
            }]
        });

        // 8. IDE reçus en volume (données réelles base éco)
        const ideTotal = this.nd('ide_total_mds');
        this.createChart('chart-int-remittances', {
            tooltip: { trigger: 'axis', valueFormatter: (v) => Math.round(v) + ' Mds FCFA' },
            xAxis: { data: ideTotal ? ideTotal.years.map(String) : ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023'] },
            yAxis: { axisLabel: { formatter: (v) => v.toFixed(0) }, splitLine: { lineStyle: { type: 'dashed', color: '#F3F4F6' } } },
            series: [{ type: 'bar', data: ideTotal ? ideTotal.values.map(v => Math.round(v)) : [292, 342, 566, 345, 497, 410, 772, 998, 1507], name: 'IDE (Mds FCFA)', itemStyle: { color: this.colors.green, borderRadius: [6,6,0,0] }, label: { show: true, position: 'top', formatter: '{c}', fontSize: 9 } }]
        });

        // 9. Taux de couverture (données réelles Douanes)
        const tauxCouv = this.nd('taux_couverture');
        const tauxCouvVal = tauxCouv ? Math.round(tauxCouv.values[tauxCouv.values.length - 1] * 10) / 10 : 97.0;
        this.createChart('chart-int-passport', {
            series: [{ type: 'gauge', min: 50, max: 150, center: ['50%', '60%'], radius: '80%',
                progress: { show: true, width: 12 },
                axisLine: { lineStyle: { width: 12, color: [[0.33, this.colors.red], [0.66, this.colors.orange], [1, this.colors.green]] } },
                axisTick: { show: false },
                splitLine: { length: 8, lineStyle: { width: 2, color: '#999' } },
                axisLabel: { distance: 20, color: '#6B7280', fontSize: 10, formatter: '{value}%' },
                detail: { valueAnimation: true, formatter: '{value}%', fontSize: 20, fontWeight: 'bold', offsetCenter: [0, '40%'], color: this.colors.slate },
                data: [{ value: tauxCouvVal, name: 'Exports/Imports' }]
            }]
        });

        // 10. Exports par catégorie de marchandises (données réelles Douanes)
        const expAgri = this.nd('export_agri_industrielle');
        const expTransfo = this.nd('export_premiere_transfo');
        const expManuf = this.nd('export_manufactures');
        const expMin = this.nd('export_miniers');
        const lastAgri = expAgri ? Math.round(expAgri.values[expAgri.values.length - 1]) : 2500;
        const lastTransfo = expTransfo ? Math.round(expTransfo.values[expTransfo.values.length - 1]) : 2000;
        const lastManuf = expManuf ? Math.round(expManuf.values[expManuf.values.length - 1]) : 1500;
        const lastMin = expMin ? Math.round(expMin.values[expMin.values.length - 1]) : 1000;
        this.createChart('chart-int-uemoa-share', {
            tooltip: { trigger: 'item', formatter: '{b}: {c} Mds FCFA ({d}%)' },
            legend: { bottom: 5, itemWidth: 12, itemHeight: 12 },
            series: [{ type: 'pie', radius: ['35%', '65%'], center: ['50%', '42%'],
                itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
                label: { show: true, formatter: '{b}\n{d}%', fontSize: 9 },
                data: [
                    { value: lastAgri, name: 'Agri. industrielle', itemStyle: { color: this.colors.green } },
                    { value: lastTransfo, name: '1ère transfo.', itemStyle: { color: this.colors.orange } },
                    { value: lastManuf, name: 'Manufacturés', itemStyle: { color: this.colors.blue } },
                    { value: lastMin, name: 'Miniers', itemStyle: { color: this.colors.purple } }
                ]
            }]
        });
    },

    renderTerritoryCharts() {
        const s = this.dbData ? this.dbData.series : null;
        const elecAccess = s ? s.electricity_access : null;
        const elecLatest = elecAccess ? Math.round(elecAccess.values[elecAccess.values.length - 1] * 10) / 10 : 72;

        this.createChart('chart-terr-gdp-reg', {
            tooltip: { trigger: 'item' },
            series: [{ type: 'pie', radius: '60%', data: [{value: 40, name: 'Abidjan', itemStyle: {color: this.colors.orange}}, {value: 60, name: 'Intérieur', itemStyle: {color: this.colors.green}}] }]
        });
        // Accès électricité par région (national réel: ~72%, estimation régionale)
        this.createChart('chart-terr-elec', {
            tooltip: { trigger: 'axis', valueFormatter: (v) => v + '%' },
            xAxis: { data: ['Abidjan', 'Nord', 'Ouest', 'Est', 'Centre'] },
            yAxis: { max: 100 },
            series: [{ type: 'bar', data: [Math.min(99, Math.round(elecLatest * 1.36)), Math.round(elecLatest * 0.85), Math.round(elecLatest * 0.78), Math.round(elecLatest * 0.83), Math.round(elecLatest * 0.97)], name: '%', itemStyle: {color: '#FFD700'}, label: {show: true, position: 'top', formatter: '{c}%', fontSize: 10} }]
        });

        // New Territory Charts
        this.createChart('chart-terr-roads', {
            xAxis: { data: ['2020', '2023'] },
            series: [{ type: 'bar', data: [6500, 7500], name: 'Km Bitumés', itemStyle: {color: this.colors.slate} }]
        });
        this.createChart('chart-terr-water', {
            xAxis: { data: ['Urbain', 'Rural'] },
            series: [{ type: 'bar', data: [95, 80], name: '% Accès', itemStyle: {color: this.colors.blue} }]
        });
        this.createChart('chart-terr-health-density', {
            xAxis: { data: ['Abidjan', 'Nord', 'Ouest'] },
            series: [{ type: 'bar', data: [3, 1, 1], name: 'Médecins/10k', itemStyle: {color: this.colors.red} }]
        });
        this.createChart('chart-terr-bank-rate', {
            xAxis: { data: ['Abidjan', 'Intérieur'] },
            series: [{ type: 'bar', data: [50, 15], name: '% Bancarisation', itemStyle: {color: this.colors.purple} }]
        });
        this.createChart('chart-terr-digital', {
            xAxis: { data: ['2020', '2023'] },
            series: [{ type: 'line', data: [3000, 5000], name: 'Km Fibre', itemStyle: {color: this.colors.orange} }]
        });
        this.createChart('chart-terr-invest', {
            series: [{ type: 'pie', radius: '50%', data: [{value: 50, name: 'Abidjan'}, {value: 50, name: 'Intérieur'}] }]
        });
        this.createChart('chart-terr-agri-map', {
            series: [{ type: 'pie', radius: '60%', data: [{value: 30, name: 'Cacao (Sud/Ouest)'}, {value: 20, name: 'Coton/Anacarde (Nord)'}, {value: 50, name: 'Autres'}] }]
        });
        this.createChart('chart-terr-companies', {
            series: [{ type: 'pie', radius: '60%', data: [{value: 85, name: 'Abidjan'}, {value: 15, name: 'Intérieur'}] }]
        });
    },

    renderTerritoryMap() {
        if(this.map) return; // Already inited
        const mapContainer = document.getElementById('map-territory');
        if(!mapContainer) return;

        // Fix Leaflet Icons
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        this.map = L.map('map-territory').setView([7.54, -5.55], 7);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: 'OpenStreetMap',
            maxZoom: 19
        }).addTo(this.map);

        // Initialize Layer Group for Markers
        this.mapLayerGroup = L.layerGroup().addTo(this.map);

        // Initial Render
        this.updateMapMarkers('all');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    DashboardV3.init();
});

/**
 * Explorer Module - Data Explorer Functionality
 */
const ExplorerModule = {
    allIndicators: [],
    filteredIndicators: [],
    currentTheme: null,
    currentIndicator: null,
    detailChart: null,
    chartType: 'line',
    
    // Theme configuration with keywords for categorization
    themes: {
        macro: {
            title: 'Macro-économie',
            description: 'PIB, croissance, inflation, investissements et indicateurs macro-économiques',
            icon: 'fa-chart-line',
            color: 'linear-gradient(135deg, #FF8200 0%, #FF6B00 100%)',
            keywords: ['pib', 'gdp', 'croissance', 'growth', 'inflation', 'investissement', 'investment', 'économi', 'econom', 'prix', 'price', 'monnaie', 'currency', 'taux de change', 'exchange rate', 'réserve', 'reserve', 'compte courant', 'current account', 'balance des paiements']
        },
        finance: {
            title: 'Finances Publiques',
            description: 'Budget de l\'État, recettes, dépenses, dette publique',
            icon: 'fa-coins',
            color: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            keywords: ['budget', 'dette', 'debt', 'fiscal', 'recette', 'revenue', 'dépense', 'expenditure', 'impôt', 'tax', 'déficit', 'surplus', 'service de la dette', 'debt service', 'gouvernement', 'government']
        },
        demo: {
            title: 'Démographie',
            description: 'Population, urbanisation, migrations et dynamiques démographiques',
            icon: 'fa-users',
            color: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
            keywords: ['population', 'naissance', 'birth', 'mortalité', 'mortality', 'espérance de vie', 'life expectancy', 'urbain', 'urban', 'rural', 'migration', 'densité', 'density', 'fertilité', 'fertility', 'ménage', 'household', 'âge', 'age']
        },
        primary: {
            title: 'Secteur Primaire',
            description: 'Agriculture, cacao, café, élevage, pêche et ressources naturelles',
            icon: 'fa-leaf',
            color: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
            keywords: ['agriculture', 'agricole', 'cacao', 'café', 'coffee', 'coton', 'cotton', 'riz', 'rice', 'anacarde', 'cashew', 'pêche', 'fish', 'élevage', 'livestock', 'forêt', 'forest', 'terre', 'land', 'céréale', 'cereal', 'igname', 'manioc', 'vivrier', 'food crop']
        },
        secondary: {
            title: 'Secteur Secondaire',
            description: 'Industrie, énergie, BTP, mines et transformation',
            icon: 'fa-industry',
            color: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
            keywords: ['industrie', 'industry', 'manufacture', 'énergie', 'energy', 'électricité', 'electric', 'pétrole', 'oil', 'gaz', 'gas', 'mine', 'mining', 'or', 'gold', 'construction', 'btp', 'ciment', 'cement', 'production industrielle']
        },
        tertiary: {
            title: 'Secteur Tertiaire',
            description: 'Services, commerce, tourisme, télécoms et TIC',
            icon: 'fa-store',
            color: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
            keywords: ['service', 'commerce', 'trade', 'tourisme', 'tourism', 'hôtel', 'hotel', 'transport', 'télécom', 'telecom', 'internet', 'mobile', 'banque', 'bank', 'assurance', 'insurance', 'financier', 'financial']
        },
        education: {
            title: 'Éducation',
            description: 'Scolarisation, alphabétisation, formation et enseignement',
            icon: 'fa-graduation-cap',
            color: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
            keywords: ['éducation', 'education', 'école', 'school', 'scolarisation', 'enrollment', 'alphabétisation', 'literacy', 'enseignant', 'teacher', 'étudiant', 'student', 'primaire', 'primary', 'secondaire', 'secondary', 'supérieur', 'tertiary', 'université', 'university']
        },
        emploi: {
            title: 'Emploi',
            description: 'Marché du travail, chômage, salaires et emploi',
            icon: 'fa-briefcase',
            color: 'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
            keywords: ['emploi', 'employment', 'chômage', 'unemployment', 'travail', 'labor', 'salaire', 'wage', 'main d\'oeuvre', 'workforce', 'actif', 'active', 'informel', 'informal']
        },
        sante: {
            title: 'Santé',
            description: 'Espérance de vie, mortalité, maladies et système de santé',
            icon: 'fa-heartbeat',
            color: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
            keywords: ['santé', 'health', 'médecin', 'doctor', 'hôpital', 'hospital', 'mortalité', 'mortality', 'maladie', 'disease', 'vaccination', 'vih', 'hiv', 'sida', 'aids', 'paludisme', 'malaria', 'nutrition', 'malnutrition', 'infantile', 'infant', 'maternel', 'maternal']
        },
        politique: {
            title: 'Politique & Gouvernance',
            description: 'Gouvernance, corruption, institutions et stabilité',
            icon: 'fa-landmark',
            color: 'linear-gradient(135deg, #64748B 0%, #475569 100%)',
            keywords: ['gouvernance', 'governance', 'corruption', 'politique', 'politic', 'démocratie', 'democracy', 'institution', 'état de droit', 'rule of law', 'transparence', 'transparency', 'élection', 'election', 'parlement', 'parliament']
        },
        culture: {
            title: 'Sport & Culture',
            description: 'Tourisme, événements culturels, sports et patrimoine',
            icon: 'fa-futbol',
            color: 'linear-gradient(135deg, #A855F7 0%, #9333EA 100%)',
            keywords: ['sport', 'culture', 'tourisme', 'tourism', 'patrimoine', 'heritage', 'musée', 'museum', 'festival', 'art', 'musique', 'music', 'cinéma', 'cinema']
        },
        territory: {
            title: 'Territoire & Environnement',
            description: 'Infrastructures, régions, environnement et climat',
            icon: 'fa-map-marked-alt',
            color: 'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
            keywords: ['territoire', 'territory', 'région', 'region', 'infrastructure', 'route', 'road', 'eau', 'water', 'assainissement', 'sanitation', 'environnement', 'environment', 'climat', 'climate', 'co2', 'émission', 'emission', 'forêt', 'forest', 'déforestation']
        },
        inter: {
            title: 'International',
            description: 'Commerce extérieur, IDE, partenariats et positionnement mondial',
            icon: 'fa-globe-africa',
            color: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
            keywords: ['export', 'import', 'commerce extérieur', 'external trade', 'ide', 'fdi', 'investissement étranger', 'foreign investment', 'balance commerciale', 'trade balance', 'partenaire', 'partner', 'aide', 'aid', 'diaspora', 'remittance', 'transfert']
        }
    },

    init() {
        console.log("ExplorerModule Initializing...");
        this.loadIndicators();
        this.setupEventListeners();
    },

    async loadIndicators() {
        try {
            const response = await fetch('/api/indicators');
            const data = await response.json();
            
            if (data.success) {
                this.allIndicators = data.indicators;
                this.categorizeIndicators();
                this.updateThemeCounts();
                document.getElementById('explorer-total-indicators').textContent = this.allIndicators.length;
            }
        } catch (error) {
            console.error('Failed to load indicators:', error);
        }
    },

    categorizeIndicators() {
        // Categorize each indicator by theme
        this.allIndicators.forEach(ind => {
            ind.themes = [];
            const nameLower = (ind.name || '').toLowerCase();
            const codeLower = (ind.code || '').toLowerCase();
            const descLower = (ind.description || ind.definition || '').toLowerCase();
            const searchText = nameLower + ' ' + codeLower + ' ' + descLower;
            
            // Special mapping for NAT. codes by source
            if (codeLower.startsWith('nat.tofe.')) {
                ind.themes.push('finance');
            } else if (codeLower.startsWith('nat.douanes.')) {
                ind.themes.push('inter');
            } else if (codeLower.startsWith('nat.financements.')) {
                ind.themes.push('finance');
            }
            
            for (const [themeKey, theme] of Object.entries(this.themes)) {
                if (ind.themes.includes(themeKey)) continue;
                const match = theme.keywords.some(kw => searchText.includes(kw.toLowerCase()));
                if (match) {
                    ind.themes.push(themeKey);
                }
            }
            
            // If no theme matched, put in 'macro' as default
            if (ind.themes.length === 0) {
                ind.themes.push('macro');
            }
        });
    },

    updateThemeCounts() {
        for (const themeKey of Object.keys(this.themes)) {
            const count = this.allIndicators.filter(ind => ind.themes.includes(themeKey)).length;
            const countEl = document.querySelector(`[data-theme-count="${themeKey}"]`);
            if (countEl) {
                countEl.textContent = count;
            }
        }
    },

    setupEventListeners() {
        // Global search
        const globalSearch = document.getElementById('explorer-global-search');
        if (globalSearch) {
            let debounceTimer;
            globalSearch.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.handleGlobalSearch(e.target.value);
                }, 300);
            });
        }

        // Indicators search within theme
        const indicatorsSearch = document.getElementById('indicators-search');
        if (indicatorsSearch) {
            indicatorsSearch.addEventListener('input', (e) => {
                this.filterIndicatorsList(e.target.value);
            });
        }

        // Sort
        const sortSelect = document.getElementById('indicators-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.sortIndicators();
                this.renderIndicatorsList();
            });
        }

        // Keyboard shortcut Ctrl+K
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                const searchInput = document.getElementById('explorer-global-search');
                if (searchInput && document.getElementById('section-explorer') && !document.getElementById('section-explorer').classList.contains('hidden')) {
                    searchInput.focus();
                }
            }
        });
    },

    _scoreMatch(ind, queryLower) {
        const name = (ind.name || '').toLowerCase();
        const code = (ind.code || '').toLowerCase();
        const desc = (ind.description || ind.definition || '').toLowerCase();
        let score = 0;

        // Name starts with query → highest priority
        if (name.startsWith(queryLower)) score += 1000;
        // Name contains query as a whole word
        else if (name.includes(queryLower)) {
            score += 500;
            // Bonus: query appears earlier in name
            score += Math.max(0, 100 - name.indexOf(queryLower));
        }
        // Code match
        if (code.includes(queryLower)) score += 200;
        // Description match
        if (desc.includes(queryLower)) score += 50;

        return score;
    },

    handleGlobalSearch(query) {
        const resultsContainer = document.getElementById('explorer-search-results');
        const resultsList = document.getElementById('search-results-list');
        const resultsCount = document.getElementById('search-results-count');
        
        if (!query || query.length < 2) {
            resultsContainer.classList.add('hidden');
            return;
        }

        const queryLower = query.toLowerCase();
        const results = this.allIndicators
            .map(ind => ({ ind, score: this._scoreMatch(ind, queryLower) }))
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(r => r.ind)
            .slice(0, 50);

        resultsCount.textContent = `${results.length} résultat${results.length > 1 ? 's' : ''}`;
        
        resultsList.innerHTML = results.map(ind => `
            <div class="search-result-item" onclick="ExplorerModule.showIndicatorDetail('${ind.code}')">
                <div class="result-icon"><i class="fas fa-chart-bar"></i></div>
                <div class="result-content">
                    <div class="result-name">${this.highlightMatch(ind.name, query)}</div>
                    <div class="result-code">${ind.code}</div>
                </div>
                <i class="fas fa-arrow-right result-arrow"></i>
            </div>
        `).join('');

        resultsContainer.classList.remove('hidden');
    },

    highlightMatch(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark style="background:#FFF7ED;color:#FF8200;padding:0 2px;border-radius:2px;">$1</mark>');
    },

    clearSearch() {
        document.getElementById('explorer-global-search').value = '';
        document.getElementById('explorer-search-results').classList.add('hidden');
    },

    showTheme(themeKey) {
        this.currentTheme = themeKey;
        const theme = this.themes[themeKey];
        
        // Update header
        const iconLarge = document.getElementById('theme-icon-large');
        iconLarge.innerHTML = `<i class="fas ${theme.icon}"></i>`;
        iconLarge.style.background = theme.color;
        
        document.getElementById('theme-title').textContent = theme.title;
        document.getElementById('theme-description').textContent = theme.description;
        
        // Filter indicators for this theme
        this.filteredIndicators = this.allIndicators.filter(ind => ind.themes.includes(themeKey));
        this.sortIndicators();
        this.renderIndicatorsList();
        
        // Switch views
        document.getElementById('explorer-themes-view').classList.add('hidden');
        document.getElementById('explorer-indicators-view').classList.remove('hidden');
        document.getElementById('explorer-detail-view').classList.add('hidden');
        
        // Clear search
        document.getElementById('indicators-search').value = '';
    },

    backToThemes() {
        document.getElementById('explorer-themes-view').classList.remove('hidden');
        document.getElementById('explorer-indicators-view').classList.add('hidden');
        document.getElementById('explorer-detail-view').classList.add('hidden');
    },

    backToIndicators() {
        document.getElementById('explorer-themes-view').classList.add('hidden');
        document.getElementById('explorer-indicators-view').classList.remove('hidden');
        document.getElementById('explorer-detail-view').classList.add('hidden');
    },

    sortIndicators() {
        const sortValue = document.getElementById('indicators-sort')?.value || 'name-asc';
        
        this.filteredIndicators.sort((a, b) => {
            if (sortValue === 'name-asc') {
                return (a.name || '').localeCompare(b.name || '');
            } else if (sortValue === 'name-desc') {
                return (b.name || '').localeCompare(a.name || '');
            } else if (sortValue === 'code') {
                return (a.code || '').localeCompare(b.code || '');
            }
            return 0;
        });
    },

    filterIndicatorsList(query) {
        if (!query) {
            this.filteredIndicators = this.allIndicators.filter(ind => ind.themes.includes(this.currentTheme));
            this.sortIndicators();
        } else {
            const queryLower = query.toLowerCase();
            this.filteredIndicators = this.allIndicators
                .filter(ind => ind.themes.includes(this.currentTheme))
                .map(ind => ({ ind, score: this._scoreMatch(ind, queryLower) }))
                .filter(r => r.score > 0)
                .sort((a, b) => b.score - a.score)
                .map(r => r.ind);
        }
        this.renderIndicatorsList();
    },

    renderIndicatorsList() {
        const container = document.getElementById('indicators-list');
        
        if (this.filteredIndicators.length === 0) {
            container.innerHTML = `
                <div class="explorer-empty-state" style="grid-column: 1/-1;">
                    <i class="fas fa-search"></i>
                    <h4>Aucun indicateur trouvé</h4>
                    <p>Essayez de modifier votre recherche</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredIndicators.map(ind => {
            const isNational = (ind.code || '').startsWith('NAT.');
            const badge = isNational ? '<span class="indicator-badge-nat">National</span>' : '';
            const desc = ind.description || ind.definition || 'Pas de définition disponible';
            return `
            <div class="indicator-card" onclick="ExplorerModule.showIndicatorDetail('${ind.code}')">
                <div class="indicator-card-header">
                    <div class="indicator-card-name">${ind.name} ${badge}</div>
                    <span class="indicator-card-code">${ind.code}</span>
                </div>
                <div class="indicator-card-meta">${desc}</div>
                <div class="indicator-card-footer">
                    <span class="indicator-card-unit">
                        <i class="fas fa-ruler"></i>
                        ${ind.unit || 'N/A'}
                    </span>
                    <span class="indicator-card-action">
                        Analyser <i class="fas fa-arrow-right"></i>
                    </span>
                </div>
            </div>
        `;}).join('');
    },

    async showIndicatorDetail(code) {
        try {
            // Show loading
            document.getElementById('explorer-themes-view').classList.add('hidden');
            document.getElementById('explorer-indicators-view').classList.add('hidden');
            document.getElementById('explorer-detail-view').classList.remove('hidden');

            const response = await fetch(`/api/indicator/${code}`);
            const data = await response.json();
            
            if (!data.success || !data.indicator) {
                DashboardV3.showToast('Indicateur non trouvé', 'warning');
                return;
            }

            this.currentIndicator = data.indicator;
            
            // Update header
            document.getElementById('detail-indicator-name').textContent = data.indicator.name;
            document.getElementById('detail-indicator-code').textContent = data.indicator.code;
            
            // Update metadata
            document.getElementById('meta-unit').textContent = data.indicator.unit || '-';
            document.getElementById('meta-source').textContent = data.indicator.source || '-';
            document.getElementById('meta-definition').textContent = data.indicator.definition || data.indicator.description || 'Pas de définition disponible';
            
            const metaLink = document.getElementById('meta-link');
            if (data.indicator.source_link) {
                metaLink.href = data.indicator.source_link;
                metaLink.style.display = 'flex';
            } else {
                metaLink.style.display = 'none';
            }

            // Render chart
            this.renderDetailChart(data.indicator);
            
            // Render table
            this.renderDetailTable(data.indicator);

        } catch (error) {
            console.error('Failed to load indicator detail:', error);
            DashboardV3.showToast('Erreur lors du chargement', 'warning');
        }
    },

    renderDetailChart(indicator) {
        const container = document.getElementById('explorer-detail-chart');
        if (!container) return;

        if (this.detailChart) {
            this.detailChart.dispose();
        }

        this.detailChart = echarts.init(container);
        
        const values = indicator.values || [];
        const years = values.map(v => v.year);
        const data = values.map(v => v.value);

        const option = {
            color: ['#FF8200'],
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderColor: '#E5E7EB',
                borderWidth: 1,
                textStyle: { color: '#1F2937', fontFamily: 'Inter' },
                formatter: (params) => {
                    const p = params[0];
                    return `<strong>${p.name}</strong><br/>${indicator.name}: <strong>${this.formatValue(p.value)}</strong> ${indicator.unit || ''}`;
                }
            },
            grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
            xAxis: {
                type: 'category',
                data: years,
                axisLine: { lineStyle: { color: '#E5E7EB' } },
                axisLabel: { color: '#6B7280' }
            },
            yAxis: {
                type: 'value',
                axisLine: { show: false },
                splitLine: { lineStyle: { color: '#F3F4F6' } },
                axisLabel: { color: '#6B7280', formatter: (val) => this.formatValue(val) }
            },
            series: [{
                name: indicator.name,
                type: this.chartType,
                data: data,
                smooth: true,
                symbol: 'circle',
                symbolSize: 8,
                lineStyle: { width: 3 },
                areaStyle: this.chartType === 'line' ? { 
                    opacity: 0.1,
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#FF8200' },
                        { offset: 1, color: 'rgba(255, 130, 0, 0)' }
                    ])
                } : null,
                itemStyle: { borderRadius: this.chartType === 'bar' ? [4, 4, 0, 0] : 0 },
                barWidth: '60%'
            }]
        };

        this.detailChart.setOption(option);
        
        // Resize handler
        window.addEventListener('resize', () => {
            if (this.detailChart) this.detailChart.resize();
        });
    },

    setChartType(type) {
        this.chartType = type;
        
        // Update button states
        document.querySelectorAll('.chart-type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        if (this.currentIndicator) {
            this.renderDetailChart(this.currentIndicator);
        }
    },

    renderDetailTable(indicator) {
        const tbody = document.getElementById('indicator-table-body');
        const rangeEl = document.getElementById('table-years-range');
        
        const values = indicator.values || [];
        
        if (values.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#6B7280;">Aucune donnée disponible</td></tr>';
            rangeEl.textContent = '-';
            return;
        }

        // Sort by year descending
        values.sort((a, b) => b.year - a.year);
        
        rangeEl.textContent = `${values[values.length - 1].year} - ${values[0].year}`;

        tbody.innerHTML = values.map((v, i) => {
            let variation = '-';
            let variationClass = 'variation-neutral';
            
            if (i < values.length - 1) {
                const prevValue = values[i + 1].value;
                if (prevValue !== 0) {
                    const change = ((v.value - prevValue) / Math.abs(prevValue)) * 100;
                    variation = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
                    variationClass = change > 0 ? 'variation-positive' : change < 0 ? 'variation-negative' : 'variation-neutral';
                }
            }

            return `
                <tr>
                    <td><strong>${v.year}</strong></td>
                    <td>${this.formatValue(v.value)} ${indicator.unit || ''}</td>
                    <td class="${variationClass}">${variation}</td>
                </tr>
            `;
        }).join('');
    },

    formatValue(value) {
        if (value === null || value === undefined) return '-';
        
        const absVal = Math.abs(value);
        if (absVal >= 1e9) {
            return (value / 1e9).toFixed(2) + ' Mrd';
        } else if (absVal >= 1e6) {
            return (value / 1e6).toFixed(2) + ' M';
        } else if (absVal >= 1e3) {
            return (value / 1e3).toFixed(2) + ' K';
        } else if (Number.isInteger(value)) {
            return value.toLocaleString('fr-FR');
        } else {
            return value.toFixed(2);
        }
    },

    downloadIndicatorCSV() {
        if (!this.currentIndicator) return;

        const ind = this.currentIndicator;
        let csv = 'Année,Valeur,Unité\n';
        
        (ind.values || []).forEach(v => {
            csv += `${v.year},${v.value},"${ind.unit || ''}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${ind.code}_data.csv`;
        link.click();
        
        DashboardV3.showToast('Fichier CSV téléchargé', 'success');
    },

    downloadIndicatorExcel() {
        // For simplicity, download as CSV with .xls extension (Excel can open it)
        if (!this.currentIndicator) return;

        const ind = this.currentIndicator;
        let csv = 'Année\tValeur\tUnité\n';
        
        (ind.values || []).forEach(v => {
            csv += `${v.year}\t${v.value}\t${ind.unit || ''}\n`;
        });

        const blob = new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${ind.code}_data.xls`;
        link.click();
        
        DashboardV3.showToast('Fichier Excel téléchargé', 'success');
    }
};

// Initialize Explorer when section becomes visible
const originalHandleSectionChange = DashboardV3.handleSectionChange.bind(DashboardV3);
DashboardV3.handleSectionChange = function(sectionId) {
    originalHandleSectionChange(sectionId);
    
    if (sectionId === 'section-explorer') {
        if (ExplorerModule.allIndicators.length === 0) {
            ExplorerModule.init();
        }
    }
};
