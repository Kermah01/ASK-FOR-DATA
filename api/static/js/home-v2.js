/**
 * Home V2 - Premium Homepage JavaScript
 * Handles search, animations, and interactions
 */

// =============================================
// INITIALIZATION
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    initAnimationsOnScroll();
    initCounterAnimation();
    initExampleChips();
    initSearchForm();
    initScrollIndicator();
    initParallax();
    initParticles();
    initMouseTracker();
});

// =============================================
// PARALLAX EFFECT
// =============================================
function initParallax() {
    const parallaxLayers = document.querySelectorAll('.parallax-layer');
    
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        
        parallaxLayers.forEach(layer => {
            const speed = parseFloat(layer.dataset.speed) || 0.1;
            const yPos = -(scrollY * speed);
            layer.style.transform = `translate3d(0, ${yPos}px, 0)`;
        });
    }, { passive: true });
}

// =============================================
// PARTICLES GENERATION
// =============================================
function initParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    
    const particleCount = 40;
    const colors = [
        'rgba(255, 107, 53, 0.6)',
        'rgba(16, 185, 129, 0.6)',
        'rgba(255, 138, 92, 0.5)',
        'rgba(52, 211, 153, 0.5)'
    ];
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random position
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        
        // Random size (slightly larger)
        const size = Math.random() * 6 + 3;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        
        // Random color with gradient
        const colorIndex = Math.floor(Math.random() * colors.length);
        particle.style.background = colors[colorIndex];
        particle.style.boxShadow = `0 0 ${size * 2}px ${colors[colorIndex]}`;
        
        // Random animation delay and duration
        particle.style.animationDelay = (Math.random() * 8) + 's';
        particle.style.animationDuration = (Math.random() * 12 + 10) + 's';
        
        // Random opacity
        particle.style.opacity = Math.random() * 0.5 + 0.3;
        
        container.appendChild(particle);
    }
}

// =============================================
// MOUSE TRACKER (Subtle parallax on mouse move)
// =============================================
function initMouseTracker() {
    const hero = document.querySelector('.hero-v2');
    if (!hero) return;
    
    const layers = hero.querySelectorAll('.parallax-layer');
    const glassPanels = hero.querySelectorAll('.glass-panel');
    const orbs = hero.querySelectorAll('.gradient-orb');
    const shapes = hero.querySelectorAll('.floating-shape');
    
    let mouseX = 0, mouseY = 0;
    let currentX = 0, currentY = 0;
    
    // Smooth interpolation
    function animate() {
        currentX += (mouseX - currentX) * 0.08;
        currentY += (mouseY - currentY) * 0.08;
        
        layers.forEach((layer, index) => {
            const depth = (index + 1) * 12;
            const moveX = currentX * depth;
            const moveY = currentY * depth;
            layer.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
        });
        
        glassPanels.forEach((panel, index) => {
            const depth = (index + 1) * 18;
            const moveX = currentX * depth;
            const moveY = currentY * depth;
            const currentTransform = panel.style.transform.match(/rotate\([^)]+\)/) || [''];
            panel.style.transform = `translate3d(${moveX}px, ${moveY}px, 0) ${currentTransform[0]}`;
        });
        
        orbs.forEach((orb, index) => {
            const depth = (index + 1) * 8;
            const moveX = currentX * depth * -1;
            const moveY = currentY * depth * -1;
            orb.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
        });
        
        shapes.forEach((shape, index) => {
            const depth = (index + 1) * 6;
            const moveX = currentX * depth;
            const moveY = currentY * depth;
            const rotation = shape.style.transform.match(/rotate\([^)]+\)/) || [''];
            shape.style.transform = `translate3d(${moveX}px, ${moveY}px, 0) ${rotation[0]}`;
        });
        
        requestAnimationFrame(animate);
    }
    
    hero.addEventListener('mousemove', (e) => {
        const rect = hero.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) / rect.width - 0.5;
        mouseY = (e.clientY - rect.top) / rect.height - 0.5;
    });
    
    hero.addEventListener('mouseleave', () => {
        mouseX = 0;
        mouseY = 0;
    });
    
    animate();
    
    // Reset on mouse leave
    hero.addEventListener('mouseleave', () => {
        layers.forEach(layer => {
            layer.style.transform = 'translate3d(0, 0, 0)';
        });
        glassPanels.forEach(panel => {
            const currentRotate = panel.style.transform.match(/rotate\([^)]+\)/) || [''];
            panel.style.transform = currentRotate[0];
        });
    });
}

// =============================================
// ANIMATIONS ON SCROLL
// =============================================
function initAnimationsOnScroll() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('aos-animate');
            }
        });
    }, observerOptions);

    document.querySelectorAll('[data-aos]').forEach(el => {
        observer.observe(el);
    });
}

// =============================================
// COUNTER ANIMATION
// =============================================
function initCounterAnimation() {
    const counters = document.querySelectorAll('[data-count]');
    
    const observerOptions = {
        root: null,
        threshold: 0.5
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const countTo = parseInt(target.getAttribute('data-count'));
                animateCounter(target, countTo);
                observer.unobserve(target);
            }
        });
    }, observerOptions);

    counters.forEach(counter => observer.observe(counter));
}

function animateCounter(element, target) {
    const duration = 2000;
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target.toLocaleString('fr-FR');
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current).toLocaleString('fr-FR');
        }
    }, 16);
}

// =============================================
// EXAMPLE CHIPS
// =============================================
function initExampleChips() {
    document.querySelectorAll('.example-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const query = chip.getAttribute('data-query');
            document.getElementById('query-input').value = query;
            document.getElementById('query-input').focus();
        });
    });
}

// =============================================
// SCROLL INDICATOR
// =============================================
function initScrollIndicator() {
    const scrollIndicator = document.querySelector('.scroll-indicator');
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', () => {
            const statsSection = document.querySelector('.stats-section');
            if (statsSection) {
                statsSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
}

// =============================================
// SEARCH FORM
// =============================================
let loadingInterval = null;

function initSearchForm() {
    const form = document.getElementById('search-form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const query = document.getElementById('query-input').value.trim();
        if (!query) return;

        // Show inline loading
        showLoading();

        try {
            const response = await fetch('/api/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query })
            });

            const data = await response.json();

            // Stop loading animation
            stopLoadingAnimation();

            if (data.success) {
                hideLoading();
                displayResults(data);
            } else if (data.needs_login) {
                hideLoading();
                showError(data.message + ' <a href="/accounts/login/" style="color: var(--primary); font-weight: 700; text-decoration: underline;">Se connecter</a> ou <a href="/accounts/signup/" style="color: var(--primary); font-weight: 700; text-decoration: underline;">Créer un compte</a>');
            } else {
                hideLoading();
                showError(data.message || 'Une erreur est survenue. Veuillez reformuler votre question.');
            }
        } catch (error) {
            console.error('Error:', error);
            stopLoadingAnimation();
            hideLoading();
            showError('Impossible de se connecter au serveur. Veuillez réessayer.');
        }
    });
}

function showLoading() {
    const loader = document.getElementById('inline-loading');
    loader.style.display = 'block';
    
    // Reset steps
    document.querySelectorAll('.loader-steps .step').forEach(step => {
        step.classList.remove('active', 'completed');
    });
    document.querySelector('.loader-steps .step[data-step="1"]').classList.add('active');
    
    // Animate steps
    let currentStep = 1;
    loadingInterval = setInterval(() => {
        if (currentStep < 3) {
            document.querySelector(`.loader-steps .step[data-step="${currentStep}"]`).classList.remove('active');
            document.querySelector(`.loader-steps .step[data-step="${currentStep}"]`).classList.add('completed');
            currentStep++;
            document.querySelector(`.loader-steps .step[data-step="${currentStep}"]`).classList.add('active');
        }
    }, 1200);
}

function stopLoadingAnimation() {
    if (loadingInterval) {
        clearInterval(loadingInterval);
        loadingInterval = null;
    }
    // Mark all as completed
    document.querySelectorAll('.loader-steps .step').forEach(step => {
        step.classList.remove('active');
        step.classList.add('completed');
    });
}

function hideLoading() {
    setTimeout(() => {
        document.getElementById('inline-loading').style.display = 'none';
    }, 300);
}


// =============================================
// MARKDOWN TO HTML CONVERTER
// =============================================
function markdownToHtml(text) {
    if (!text) return '';
    
    // Split into paragraphs on double newlines
    let html = text
        .split(/\n\n+/)
        .filter(p => p.trim())
        .map(paragraph => {
            let p = paragraph.trim();
            // Convert **bold** to <strong>
            p = p.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            // Convert *italic* to <em>
            p = p.replace(/\*(.+?)\*/g, '<em>$1</em>');
            // Convert single newlines to <br>
            p = p.replace(/\n/g, '<br>');
            return `<p>${p}</p>`;
        })
        .join('');
    
    return html;
}

// =============================================
// DISPLAY RESULTS
// =============================================
let currentChart = null;
let currentChartData = null;
let currentChartType = 'line';
let currentQueryHash = null;

function displayResults(data) {
    // Hide hero and features, show results
    document.querySelector('.hero-v2').style.display = 'none';
    document.querySelector('.stats-section').style.display = 'none';
    document.querySelector('.features-section').style.display = 'none';
    document.querySelector('.cta-section').style.display = 'none';
    
    const resultsSection = document.getElementById('results-section');
    resultsSection.style.display = 'block';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Update title
    document.getElementById('result-title').textContent = data.indicator_name || 'Analyse des Données';
    
    // Update code tag
    document.getElementById('result-code').textContent = data.indicator_code || '';
    
    // Update source link button
    const sourceLinkBtn = document.getElementById('result-source-link');
    if (data.source_link) {
        sourceLinkBtn.href = data.source_link;
        sourceLinkBtn.style.display = 'inline-flex';
    } else {
        sourceLinkBtn.style.display = 'none';
    }
    
    // Update AI message (convert markdown to HTML)
    const messageEl = document.getElementById('result-message');
    if (data.message) {
        messageEl.innerHTML = markdownToHtml(data.message);
    } else {
        messageEl.textContent = '';
    }
    
    // Update metadata
    let metaHtml = `<p><strong>Code indicateur :</strong> ${data.indicator_code || 'N/A'}</p>`;
    if (data.source_link) {
        metaHtml += `<p><strong>Source :</strong> <a href="${data.source_link}" target="_blank" style="color: var(--green-600); text-decoration: none;">Accéder aux données sources <i class="fas fa-external-link-alt" style="font-size: 0.75rem;"></i></a></p>`;
    }
    document.getElementById('result-source').innerHTML = metaHtml;
    
    // Show source card if link exists
    const sourceCard = document.getElementById('source-card');
    if (data.source_link) {
        sourceCard.style.display = 'block';
        document.getElementById('source-card-link').href = data.source_link;
        // Extract domain from URL for display
        try {
            const url = new URL(data.source_link);
            document.getElementById('source-card-text').textContent = url.hostname.replace('www.', '');
        } catch {
            document.getElementById('source-card-text').textContent = 'Accéder à la source';
        }
    } else {
        sourceCard.style.display = 'none';
    }
    
    // Update table
    const tbody = document.querySelector('#result-table tbody');
    tbody.innerHTML = '';
    
    if (data.data && data.data.length > 0) {
        data.data.forEach(row => {
            const tr = document.createElement('tr');
            const formattedValue = typeof row.value === 'number' 
                ? row.value.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) 
                : row.value;
            tr.innerHTML = `
                <td><strong>${row.year}</strong></td>
                <td>${formattedValue}</td>
            `;
            tbody.appendChild(tr);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">Aucune donnée disponible</td></tr>';
    }
    
    // Store data for chart type switching
    currentChartData = data;
    
    // Determine initial chart type: bar for single data point, line otherwise
    if (data.data && data.data.length === 1) {
        currentChartType = 'bar';
    } else {
        currentChartType = 'line';
    }
    
    // Update chart type buttons
    updateChartTypeButtons(currentChartType);
    
    // Initialize chart type selector
    initChartTypeSelector();
    
    // Render chart
    renderChart(data, currentChartType);
    
    // Initialize download buttons
    initDownloadButtons(data);
    
    // Display recommendations
    if (data.related_indicators && data.related_indicators.length > 0) {
        displayRecommendations(data.related_indicators);
    } else {
        document.getElementById('recommendations-section').style.display = 'none';
    }
    
    // Initialize feedback buttons
    currentQueryHash = data.query_hash || null;
    initFeedbackButtons();
}

// =============================================
// FEEDBACK FUNCTIONALITY
// =============================================
function initFeedbackButtons() {
    const positiveBtn = document.getElementById('feedback-positive');
    const negativeBtn = document.getElementById('feedback-negative');
    const feedbackMsg = document.getElementById('feedback-message');
    
    // Reset state
    positiveBtn.classList.remove('active');
    negativeBtn.classList.remove('active');
    positiveBtn.disabled = false;
    negativeBtn.disabled = false;
    feedbackMsg.textContent = '';
    feedbackMsg.classList.remove('visible');
    
    positiveBtn.onclick = () => submitFeedback('positive');
    negativeBtn.onclick = () => submitFeedback('negative');
}

async function submitFeedback(type) {
    if (!currentQueryHash) return;
    
    const positiveBtn = document.getElementById('feedback-positive');
    const negativeBtn = document.getElementById('feedback-negative');
    const feedbackMsg = document.getElementById('feedback-message');
    
    // Disable both buttons immediately
    positiveBtn.disabled = true;
    negativeBtn.disabled = true;
    
    // Highlight selected
    if (type === 'positive') {
        positiveBtn.classList.add('active');
    } else {
        negativeBtn.classList.add('active');
    }
    
    try {
        const response = await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query_hash: currentQueryHash,
                feedback: type
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            feedbackMsg.textContent = data.message;
            feedbackMsg.classList.add('visible');
        }
    } catch (error) {
        console.error('Feedback error:', error);
        feedbackMsg.textContent = 'Erreur lors de l\'envoi';
        feedbackMsg.classList.add('visible');
    }
}

// =============================================
// DOWNLOAD FUNCTIONALITY
// =============================================
function initDownloadButtons(data) {
    // Download chart as PNG
    const chartBtn = document.getElementById('download-chart-btn');
    chartBtn.onclick = () => downloadChartAsPNG(data);
    
    // Download table as CSV
    const csvBtn = document.getElementById('download-csv-btn');
    csvBtn.onclick = () => downloadTableAsCSV(data);
    
    // Download table as Excel (TSV)
    const excelBtn = document.getElementById('download-excel-btn');
    excelBtn.onclick = () => downloadTableAsExcel(data);
}

function downloadChartAsPNG(data) {
    const chartCanvas = document.getElementById('result-chart');
    if (!chartCanvas || !currentChart) return;
    
    const indicatorName = data.indicator_name || 'Indicateur';
    const indicatorCode = data.indicator_code || '';
    const years = data.data ? data.data.map(d => d.year) : [];
    const periodStr = years.length > 1 ? `${years[0]} - ${years[years.length - 1]}` : (years[0] || '');
    
    // Dimensions
    const padding = { top: 80, bottom: 70, left: 20, right: 20 };
    const totalWidth = chartCanvas.width + padding.left + padding.right;
    const totalHeight = chartCanvas.height + padding.top + padding.bottom;
    
    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    tempCanvas.width = totalWidth;
    tempCanvas.height = totalHeight;
    
    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, totalWidth, totalHeight);
    
    // Title
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(indicatorName, totalWidth / 2, 30);
    
    // Subtitle (code + period)
    ctx.fillStyle = '#6B7280';
    ctx.font = '12px Inter, sans-serif';
    const subtitle = [indicatorCode, periodStr].filter(Boolean).join(' — ');
    if (subtitle) ctx.fillText(subtitle, totalWidth / 2, 50);
    
    // Axis label: Y
    ctx.fillStyle = '#6B7280';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Valeur', padding.left + 5, padding.top - 8);
    
    // Axis label: X
    ctx.textAlign = 'right';
    ctx.fillText('Année', totalWidth - padding.right - 5, padding.top + chartCanvas.height + 18);
    
    // Draw the chart
    ctx.drawImage(chartCanvas, padding.left, padding.top);
    
    // Source line
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';
    const sourceText = data.source_link ? `Source : ${data.source_link}` : 'Source : Côte d\'Ivoire - Données statistiques';
    ctx.fillText(sourceText, padding.left, totalHeight - 35);
    
    // Watermark "Ask For Data"
    ctx.save();
    ctx.fillStyle = 'rgba(255, 107, 0, 0.07)';
    ctx.font = 'bold 60px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.translate(totalWidth / 2, totalHeight / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.fillText('Ask For Data', 0, 0);
    ctx.restore();
    
    // Footer branding
    ctx.fillStyle = '#D1D5DB';
    ctx.font = 'bold 10px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Ask For Data — askfordata.ci', totalWidth - padding.right, totalHeight - 12);
    
    const link = document.createElement('a');
    const fileName = indicatorName.replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, '').trim().replace(/\s+/g, '_');
    link.download = `${fileName}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
}

function downloadTableAsCSV(data) {
    if (!data.data || data.data.length === 0) return;
    
    const indicatorName = data.indicator_name || 'donnees';
    const indicatorCode = data.indicator_code || '';
    const years = data.data.map(d => d.year);
    const periodStr = years.length > 1 ? `${years[0]} - ${years[years.length - 1]}` : (years[0] || '');
    
    let csv = '\uFEFF'; // BOM for Excel UTF-8 compatibility
    csv += `Indicateur;${indicatorName}\n`;
    csv += `Code;${indicatorCode}\n`;
    csv += `Période;${periodStr}\n`;
    if (data.source_link) csv += `Source;${data.source_link}\n`;
    csv += `Nombre d'observations;${data.data.length}\n`;
    csv += `Généré par;Ask For Data (askfordata.ci)\n`;
    csv += '\n';
    csv += 'Année;Valeur\n';
    
    data.data.forEach(row => {
        csv += `${row.year};${row.value}\n`;
    });
    
    csv += '\n';
    csv += '© Ask For Data - Toute reproduction doit mentionner la source\n';
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const fileName = indicatorName.replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, '').trim().replace(/\s+/g, '_');
    link.download = `${fileName}.csv`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
}

function downloadTableAsExcel(data) {
    if (!data.data || data.data.length === 0) return;
    
    const indicatorName = data.indicator_name || 'donnees';
    const indicatorCode = data.indicator_code || '';
    const years = data.data.map(d => d.year);
    const periodStr = years.length > 1 ? `${years[0]} - ${years[years.length - 1]}` : (years[0] || '');
    
    let html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
    html += '<head><meta charset="utf-8"><style>';
    html += 'body{font-family:Calibri,sans-serif;} ';
    html += 'td,th{padding:6px 12px;border:1px solid #D1D5DB;} ';
    html += 'th{background:#F3F4F6;font-weight:bold;color:#1F2937;} ';
    html += '.header{font-size:14pt;font-weight:bold;color:#FF6B00;} ';
    html += '.meta{color:#6B7280;font-size:9pt;} ';
    html += '.watermark{color:#FFD4C4;font-size:18pt;font-weight:bold;text-align:center;} ';
    html += '.footer{color:#9CA3AF;font-size:8pt;font-style:italic;} ';
    html += '</style></head>';
    html += '<body>';
    html += `<table>`;
    html += `<tr><td class="header" colspan="2">${indicatorName}</td></tr>`;
    html += `<tr><td class="meta">Code</td><td class="meta">${indicatorCode}</td></tr>`;
    html += `<tr><td class="meta">Période</td><td class="meta">${periodStr}</td></tr>`;
    if (data.source_link) html += `<tr><td class="meta">Source</td><td class="meta">${data.source_link}</td></tr>`;
    html += `<tr><td class="meta">Observations</td><td class="meta">${data.data.length}</td></tr>`;
    html += `<tr><td colspan="2"></td></tr>`;
    html += `<tr><th>Année</th><th>Valeur</th></tr>`;
    
    data.data.forEach(row => {
        html += `<tr><td>${row.year}</td><td>${row.value}</td></tr>`;
    });
    
    html += `<tr><td colspan="2"></td></tr>`;
    html += `<tr><td class="watermark" colspan="2">Ask For Data</td></tr>`;
    html += `<tr><td class="footer" colspan="2">© Ask For Data (askfordata.ci) - Toute reproduction doit mentionner la source</td></tr>`;
    html += '</table></body></html>';
    
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement('a');
    const fileName = indicatorName.replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, '').trim().replace(/\s+/g, '_');
    link.download = `${fileName}.xls`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
}

// =============================================
// CHART TYPE SELECTOR
// =============================================
function initChartTypeSelector() {
    const buttons = document.querySelectorAll('.chart-type-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            if (type !== currentChartType && currentChartData) {
                currentChartType = type;
                updateChartTypeButtons(type);
                renderChart(currentChartData, type);
            }
        });
    });
}

function updateChartTypeButtons(type) {
    document.querySelectorAll('.chart-type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });
}

// =============================================
// RENDER CHART
// =============================================
function renderChart(data, chartType = 'line') {
    const canvas = document.getElementById('result-chart');
    const ctx = canvas.getContext('2d');
    
    // Destroy previous chart
    if (currentChart) {
        currentChart.destroy();
    }
    
    if (!data.data || data.data.length === 0) {
        canvas.style.display = 'none';
        return;
    }
    
    canvas.style.display = 'block';
    
    const labels = data.data.map(d => d.year);
    const values = data.data.map(d => d.value);
    
    // Colors
    const primaryColor = '#FF6B00';
    const secondaryColor = '#00A854';
    
    // Dataset configuration based on chart type
    let datasetConfig;
    
    if (chartType === 'bar') {
        // Bar chart config
        datasetConfig = {
            label: data.indicator_name || 'Valeur',
            data: values,
            backgroundColor: values.map((_, i) => i % 2 === 0 ? primaryColor : secondaryColor),
            borderColor: values.map((_, i) => i % 2 === 0 ? primaryColor : secondaryColor),
            borderWidth: 0,
            borderRadius: 6,
            maxBarThickness: 60
        };
    } else {
        // Line chart config
        const gradient = ctx.createLinearGradient(0, 0, 0, 350);
        gradient.addColorStop(0, 'rgba(255, 107, 0, 0.12)');
        gradient.addColorStop(1, 'rgba(255, 107, 0, 0)');
        
        datasetConfig = {
            label: data.indicator_name || 'Valeur',
            data: values,
            borderColor: primaryColor,
            backgroundColor: gradient,
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: primaryColor,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 3,
            pointRadius: 6,
            pointHoverRadius: 9,
            pointHoverBackgroundColor: secondaryColor,
            pointHoverBorderColor: '#ffffff',
            pointHoverBorderWidth: 3
        };
    }
    
    currentChart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: [datasetConfig]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#ffffff',
                    titleColor: '#0F172A',
                    bodyColor: '#334155',
                    borderColor: '#E2E8F0',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false,
                    titleFont: {
                        family: 'Inter, sans-serif',
                        size: 13,
                        weight: 600
                    },
                    bodyFont: {
                        family: 'Inter, sans-serif',
                        size: 12
                    },
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y.toLocaleString('fr-FR');
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: chartType === 'bar',
                    grid: {
                        color: '#F1F5F9',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#64748B',
                        font: {
                            family: 'Inter, sans-serif',
                            size: 11
                        },
                        callback: function(value) {
                            return value.toLocaleString('fr-FR');
                        }
                    },
                    border: {
                        display: false
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#64748B',
                        font: {
                            family: 'Inter, sans-serif',
                            size: 11
                        }
                    },
                    border: {
                        display: false
                    }
                }
            },
            animation: {
                duration: 600,
                easing: 'easeOutQuart'
            }
        }
    });
}

function displayRecommendations(indicators) {
    const container = document.getElementById('recommendations-container');
    const section = document.getElementById('recommendations-section');
    
    container.innerHTML = indicators.map(name => `
        <button class="recommendation-chip" onclick="searchRecommendation('${name.replace(/'/g, "\\'")}')">
            ${name}
        </button>
    `).join('');
    
    section.style.display = 'block';
}

function searchRecommendation(query) {
    document.getElementById('query-input').value = query;
    clearResults();
    document.getElementById('search-form').dispatchEvent(new Event('submit'));
}

// =============================================
// CLEAR RESULTS
// =============================================
function clearResults() {
    // Show hero and features
    document.querySelector('.hero-v2').style.display = 'flex';
    document.querySelector('.stats-section').style.display = 'block';
    document.querySelector('.features-section').style.display = 'block';
    document.querySelector('.cta-section').style.display = 'block';
    
    // Hide results
    document.getElementById('results-section').style.display = 'none';
    
    // Clear input and focus
    document.getElementById('query-input').value = '';
    document.getElementById('query-input').focus();
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================
// SHOW ERROR
// =============================================
function showError(message) {
    // Hide hero sections
    document.querySelector('.hero-v2').style.display = 'none';
    document.querySelector('.stats-section').style.display = 'none';
    document.querySelector('.features-section').style.display = 'none';
    document.querySelector('.cta-section').style.display = 'none';
    
    const resultsSection = document.getElementById('results-section');
    resultsSection.style.display = 'block';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Update title
    document.getElementById('result-title').innerHTML = '<i class="fas fa-exclamation-triangle" style="color: #F59E0B;"></i> Aucun résultat trouvé';
    document.getElementById('result-code').textContent = '';
    
    // Update message with suggestions
    document.getElementById('result-message').innerHTML = `
        <div style="background: linear-gradient(135deg, #FEF3C7, #FEF9C3); padding: 1.25rem; border-radius: 12px; border-left: 4px solid #F59E0B; margin-bottom: 1.5rem;">
            <strong style="color: #92400E;">${message}</strong>
        </div>
        <p style="margin-bottom: 1rem;"><strong>💡 Suggestions :</strong></p>
        <ul style="list-style: none; padding: 0; margin: 0;">
            <li style="padding: 0.5rem 0; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-check-circle" style="color: #22C55E;"></i>
                Utilisez des termes plus généraux (ex: "PIB", "population", "inflation")
            </li>
            <li style="padding: 0.5rem 0; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-check-circle" style="color: #22C55E;"></i>
                Précisez une période (ex: "PIB 2020-2023")
            </li>
            <li style="padding: 0.5rem 0; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-check-circle" style="color: #22C55E;"></i>
                Essayez les exemples de la page d'accueil
            </li>
        </ul>
    `;
    
    // Hide chart and clear table
    document.getElementById('result-chart').style.display = 'none';
    document.querySelector('#result-table tbody').innerHTML = '<tr><td colspan="2" style="text-align: center; color: var(--text-muted);">-</td></tr>';
    document.getElementById('result-source').innerHTML = '<p style="color: var(--text-muted);">Aucune donnée disponible</p>';
    
    // Hide recommendations
    document.getElementById('recommendations-section').style.display = 'none';
}

// Make clearResults globally available
window.clearResults = clearResults;
