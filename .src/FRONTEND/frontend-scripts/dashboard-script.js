// FRONTEND/frontend-scripts/dashboard-script.js

// Configuración de Firebase (ya la tenías)
const firebaseConfig = {
    apiKey: "AIzaSyCILjXMxLC-s99Z46CCD-LucJm6GnSgjHk",
    authDomain: "statspredict.firebaseapp.com",
    projectId: "statspredict",
    storageBucket: "statspredict.firebasestorage.app",
    messagingSenderId: "661481770829",
    appId: "1:661481770829:web:ec5aa48849eedc15f67104",
};
const loginPage = '/FRONTEND/views/login.html';
const API_BASE_URL_DASHBOARD = 'http://localhost:5000/api';
let auth;
try {
    if (!firebase?.apps.length) { firebase.initializeApp(firebaseConfig); console.log("Dashboard: Firebase Inicializado."); } 
    else { firebase.app(); console.log("Dashboard: Firebase ya estaba inicializado."); }
    auth = firebase.auth(); console.log("Dashboard: Servicio Firebase Auth listo.");
} catch (e) { console.error("Dashboard: CRITICAL Error inicializando Firebase:", e); }

const topTeamConfigsDashboard = [ /* ... Tu lista de equipos top ... */
    { apiTeamId: 86, sport: 'Football', name: 'FC Barcelona' }, { apiTeamId: 81, sport: 'Football', name: 'Real Madrid CF' },
    { apiTeamId: 65, sport: 'Football', name: 'Manchester City FC' }, { apiTeamId: 64, sport: 'Football', name: 'Liverpool FC' },
    { apiTeamId: 5, sport: 'Football', name: 'FC Bayern München' }, { apiTeamId: 529, sport: 'Football', name: 'Paris Saint-Germain FC' },
    { apiTeamId: 108, sport: 'Football', name: 'Inter Milan' },
    { apiTeamId: 2, sport: 'Basketball', name: 'Boston Celtics' }, { apiTeamId: 14, sport: 'Basketball', name: 'Los Angeles Lakers' },
    { apiTeamId: 10, sport: 'Basketball', name: 'Golden State Warriors' }, { apiTeamId: 8, sport: 'Basketball', name: 'Denver Nuggets' }
];

let activeDashboardFilters = {
    type: 'all', 
    sport: null, 
    selectedTeam: null
};

function setupTeamSearchDashboard() { /* ... (como en la respuesta anterior, pero llamando a loadTopPredictions y actualizando activeDashboardFilters.selectedTeam) ... */
    console.log("Dashboard DEBUG: setupTeamSearchDashboard() ejecutándose.");
    const searchInput = document.getElementById('teamSearchInput');
    const searchResultsContainer = document.getElementById('searchResults');
    const offcanvasElement = document.getElementById('offcanvasSearch');
    const offcanvasSearchInstance = offcanvasElement ? (bootstrap.Offcanvas.getInstance(offcanvasElement) || new bootstrap.Offcanvas(offcanvasElement)) : null;

    if (!searchInput || !searchResultsContainer) { console.warn('Dashboard Search: Elementos UI no encontrados.'); return; }

    let searchTimeout;
    searchInput.addEventListener('input', (event) => {
        clearTimeout(searchTimeout);
        const query = event.target.value.trim();
        if (query.length < 3) { searchResultsContainer.innerHTML = '<p class="text-muted p-3 small">Escribe al menos 3 caracteres.</p>'; return; }
        searchResultsContainer.innerHTML = '<div class="p-3 text-center"><div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span></div></div>';

        searchTimeout = setTimeout(async () => {
            let searchApiEndpoint = `/teams/search?name=${encodeURIComponent(query)}`;
            // No filtramos por deporte en la búsqueda de equipo, para que sea global.
            const response = await fetchDataDashboard(searchApiEndpoint);
            searchResultsContainer.innerHTML = '';
            if (response && response.data && response.data.length > 0) {
                response.data.forEach(team => { 
                    const teamElementWrapper = document.createElement('div');
                    teamElementWrapper.className = 'list-group-item list-group-item-action bg-dark text-light d-flex align-items-center justify-content-between py-2 search-result-item';
                    teamElementWrapper.innerHTML = `
                        <div class="d-flex align-items-center flex-grow-1" style="cursor:pointer;">
                            <img src="${team.logoUrl || 'https://via.placeholder.com/30?text=L'}" alt="${team.name}" class="rounded-circle me-3" style="width: 30px; height: 30px; object-fit: contain;">
                            <span class="flex-grow-1">${team.name} <small class="text-muted">(${team.sport || 'N/A'})</small></span>
                        </div>
                        `; // Sin estrella de favorito por ahora en dashboard search, a menos que se pida
                    teamElementWrapper.querySelector('.flex-grow-1').addEventListener('click', () => {
                        activeDashboardFilters.selectedTeam = { apiTeamId: team.apiTeamId, name: team.name, sport: team.sport };
                        activeDashboardFilters.sport = team.sport; 
                        activeDashboardFilters.type = 'all'; // Mostrar todas las predicciones para este equipo
                        
                        const sportPillsContainer = document.querySelector('.filter-buttons');
                        if (sportPillsContainer) {
                           sportPillsContainer.querySelectorAll('button').forEach(btn => {
                                btn.classList.remove('btn-primary'); btn.classList.add('btn-outline-light');
                                const sportText = btn.textContent.trim().toLowerCase();
                                if ((team.sport === 'Football' && (sportText.includes('soccer') || sportText.includes('fútbol'))) ||
                                    (team.sport === 'Basketball' && sportText.includes('basketball'))) {
                                    btn.classList.add('btn-primary'); btn.classList.remove('btn-outline-light');
                                }
                           });
                        }
                        const filterDropdownButton = document.querySelector('h2.text-light + .dropdown .dropdown-toggle.btn-sm');
                        if (filterDropdownButton) filterDropdownButton.textContent = `Equipo: ${team.name}`;

                        loadTopPredictions();
                        if (offcanvasSearchInstance) offcanvasSearchInstance.hide();
                        searchInput.value = ''; searchResultsContainer.innerHTML = '';
                    });
                    searchResultsContainer.appendChild(teamElementWrapper);
                });
            } else { 
                searchResultsContainer.innerHTML = response?.data?.length === 0 ? 
                    '<p class="text-muted p-3">No se encontraron equipos.</p>' :
                    '<p class="text-danger p-3">Error al buscar equipos.</p>';
            }
        }, 500);
    });
 }

async function fetchDataDashboard(endpoint, method = 'GET', body = null) { /* ... (sin cambios) ... */ 
    const authToken = localStorage.getItem('authToken');
    if (!authToken) { console.error('Dashboard: No auth token.'); window.location.href = loginPage; return null; }
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` };
    const config = { method, headers };
    if (body && (method === 'POST' || method === 'PUT' || method === 'DELETE')) { config.body = JSON.stringify(body); }
    try {
        const response = await fetch(`${API_BASE_URL_DASHBOARD}${endpoint}`, config);
        if (!response.ok) {
            if (response.status === 401) { console.error('Dashboard: Unauthorized (401).'); localStorage.removeItem('authToken'); localStorage.removeItem('userInfo'); window.location.href = loginPage; }
            throw new Error(`HTTP error! status: ${response.status}, message: ${await response.text()}`);
        }
        return await response.json();
    } catch (error) { console.error('Dashboard: Error fetching data:', error); return null; }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("Dashboard DOM Cargado. Configurando UI y listeners...");

    if (!auth) {
        console.error("Error fatal: Firebase Auth no está disponible en DOMContentLoaded. Funcionalidad limitada.");
        // Podrías mostrar un mensaje de error más visible en la página aquí
        return;
    }

    // --- Elementos del DOM ---
    const predictionsContainer = document.getElementById('predictions');
    const dropdownFilterLinks = document.querySelectorAll('.dropdown-menu a[data-filter]');
    const dropdownFilterButton = document.querySelector('button[data-bs-toggle="dropdown"]'); // El botón del dropdown general
    const sportFilterButtons = document.querySelectorAll('.filter-buttons button[data-sport-filter]');
    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
    // const mainContentContainer = document.getElementById('main'); // Si lo necesitas

    if (!predictionsContainer) {
        console.error("Elemento con id='predictions' no encontrado. No se pueden mostrar predicciones.");
        return;
    }

    // --- Estado de la Aplicación para Filtros y Datos ---
    let allProcessedMatches = [];
    let currentActiveDropdownFilter = 'all';
    let currentActiveSportFilter = 'all';
    const HIGH_CONFIDENCE_THRESHOLD = 0.70; // 70% para "Alta Confianza"

    // --- Lógica de Logout ---
    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener('click', () => {
            console.log('Botón Confirmar Logout presionado.');
            confirmLogoutBtn.disabled = true;
            confirmLogoutBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cerrando...';
            auth.signOut().then(() => {
                localStorage.removeItem('authToken'); localStorage.removeItem('userInfo');
                window.location.href = loginPage;
            }).catch((error) => {
                console.error('Error al cerrar sesión en Firebase:', error);
                localStorage.removeItem('authToken'); localStorage.removeItem('userInfo');
                window.location.href = loginPage;
            });
        });
        console.log('Listener añadido al botón de confirmar logout.');
    } else { console.warn('Botón Confirmar Logout (id="confirmLogoutBtn") no encontrado.'); }

    // --- Inicializar Tooltips ---
    try {
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
        console.log('Tooltips del dashboard inicializados.');
    } catch(e) { console.error("Error inicializando tooltips de Bootstrap:", e); }

    // --- LÓGICA PARA PREDICCIONES Y FILTROS ---

    async function fetchMatchesWithPredictions() {
        const token = localStorage.getItem('authToken');
        if (!token) {
            console.log("fetchMatches: No hay token. auth-guard debería haber redirigido.");
            // auth-guard.js ya se encarga de redirigir si no hay token.
            return [];
        }
        predictionsContainer.innerHTML = '<div class="col-12 text-center mt-5"><div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">Cargando predicciones...</p></div>';
        console.log("fetchMatches: Iniciando fetch a /api/matches/upcoming...");
        try {
            // Pedir un buen número de partidos para tener con qué filtrar (ej. próximos 14 días, hasta 50 partidos)
            // Llama a /upcoming SIN filtro de deporte para obtener todo inicialmente
            const response = await fetch(`${BACKEND_URL}/api/matches/upcoming?limit=50&days=14`, {
                 headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log(`WorkspaceMatches: Respuesta recibida, status: ${response.status}`);
            if (!response.ok) {
                const errText = await response.text();
                console.error("fetchMatches: Error del backend - Status:", response.status, "Texto:", errText);
                throw new Error(`Error del servidor: ${response.status} - ${errText.substring(0,100)}`);
            }
            const data = await response.json();
            console.log("fetchMatches: Partidos recibidos:", data.data ? data.data.length : 0);
            return data.data || [];
        } catch (error) {
            console.error("fetchMatches: Error en fetch o parseo JSON:", error);
            predictionsContainer.innerHTML = `<div class="col-12"><p class="text-center text-danger">Error al cargar predicciones: ${error.message}</p></div>`;
            return [];
        }
    }

    function findTopPrediction(match) {
        if (!match || !match.predictions || Object.keys(match.predictions).length === 0 || match.predictions.error_fetching_data || match.predictions.no_sufficient_data) {
            console.debug(`findTopPrediction: No hay predicciones válidas o suficientes para ${match?._id || 'N/A'}`);
            return null;
        }
        const preds = match.predictions;
        let top = { type: "N/A", outcome: "Predicción no disponible", confidence: 0.00, line: null, teamContext: null };

        const updateTop = (newType, newOutcome, newConfidence, newLine = null, newTeamContext = null) => {
            if (newConfidence !== undefined && newConfidence !== null && parseFloat(newConfidence) > parseFloat(top.confidence)) {
                top = { type: newType, outcome: newOutcome, confidence: parseFloat(newConfidence), line: newLine, teamContext: newTeamContext };
            }
        };

        // Fútbol
        if (preds.ft_winner_prob) {
            if (preds.ft_winner_prob.home !== undefined) updateTop("Resultado Partido", `Gana ${match.teams.home.name}`, preds.ft_winner_prob.home, null, match.teams.home.name);
            if (preds.ft_winner_prob.draw !== undefined) updateTop("Resultado Partido", "Empate", preds.ft_winner_prob.draw);
            if (preds.ft_winner_prob.away !== undefined) updateTop("Resultado Partido", `Gana ${match.teams.away.name}`, preds.ft_winner_prob.away, null, match.teams.away.name);
        }
        if (preds.ft_ou_goals_prob && Array.isArray(preds.ft_ou_goals_prob)) {
            preds.ft_ou_goals_prob.forEach(ou => {
                if(ou.over !== undefined) updateTop("Más/Menos Goles", `Más de ${ou.line}`, ou.over, ou.line);
                if(ou.under !== undefined) updateTop("Más/Menos Goles", `Menos de ${ou.line}`, ou.under, ou.line);
            });
        }
        if (preds.ft_btts_prob) {
            if(preds.ft_btts_prob.yes !== undefined) updateTop("Ambos Marcan", "Sí", preds.ft_btts_prob.yes);
            if(preds.ft_btts_prob.no !== undefined) updateTop("Ambos Marcan", "No", preds.ft_btts_prob.no);
        }
        // Básquetbol
        if (preds.bk_winner_prob) {
            if (preds.bk_winner_prob.home !== undefined) updateTop("Resultado Partido", `Gana ${match.teams.home.name}`, preds.bk_winner_prob.home, null, match.teams.home.name);
            if (preds.bk_winner_prob.away !== undefined) updateTop("Resultado Partido", `Gana ${match.teams.away.name}`, preds.bk_winner_prob.away, null, match.teams.away.name);
        }
        if (preds.bk_total_pts_prob && Array.isArray(preds.bk_total_pts_prob)) {
            preds.bk_total_pts_prob.forEach(ou => {
                if(ou.over !== undefined) updateTop("Más/Menos Puntos", `Más de ${ou.line}`, ou.over, ou.line);
                if(ou.under !== undefined) updateTop("Más/Menos Puntos", `Menos de ${ou.line}`, ou.under, ou.line);
            });
        }
        return top.confidence > 0.01 ? top : null; // Solo devolver si hay alguna confianza mínima
    }

    function createPredictionCardHTML(match, topPrediction) {
        if (!match || !topPrediction || !match.teams || !match.teams.home || !match.teams.away || !match.league) {
            console.warn("Datos incompletos para crear tarjeta de predicción:", {match, topPrediction});
            return '';
        }

        const matchDate = new Date(match.matchDate);
        const now = new Date();
        let timeLabel = matchDate.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

        if (match.status === 'finished') {
            const diffTime = Math.abs(now - matchDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
            if (diffDays > 1) timeLabel = `Hace ${diffDays} días`;
            else if (diffHours > 0) timeLabel = `Hace ${diffHours}h`;
            else timeLabel = "Hace un momento";
        } else if (match.status === 'inprogress') {
            timeLabel = "En Vivo";
        } else if (matchDate.toDateString() === now.toDateString()) {
            timeLabel = `Hoy ${matchDate.toLocaleTimeString('es-ES', {hour: 'numeric', minute: '2-digit'})}`;
        } else {
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);
            if (matchDate.toDateString() === tomorrow.toDateString()) {
                timeLabel = `Mañana ${matchDate.toLocaleTimeString('es-ES', {hour: 'numeric', minute: '2-digit'})}`;
            }
        }

        let confidencePercent = Math.round(topPrediction.confidence * 100);
        let confidenceBarColor = 'success';
        if (confidencePercent < 75 && confidencePercent >= 60) confidenceBarColor = 'warning';
        else if (confidencePercent < 60) confidenceBarColor = 'danger';

        let iconClass = "bi-flag-fill";
        const topPredictionTypeLower = topPrediction.type.toLowerCase();
        const topPredictionOutcomeLower = topPrediction.outcome.toLowerCase();

        if (topPredictionTypeLower.includes("más/menos")) { iconClass = topPredictionOutcomeLower.includes("más de") ? "bi-caret-up-fill" : "bi-caret-down-fill"; }
        else if (topPredictionTypeLower.includes("ambos marcan")){ iconClass = topPredictionOutcomeLower === "sí" ? "bi-check-circle-fill" : "bi-x-circle-fill"; }
        else if (topPredictionTypeLower.includes("resultado partido") && !topPredictionOutcomeLower.includes("empate")) { iconClass = "bi-trophy-fill"; }


        let predictionTypeBadgeClass = 'bg-info'; // Default
        if (topPredictionTypeLower.includes("más/menos goles")) predictionTypeBadgeClass = 'bg-success';
        else if (topPredictionTypeLower.includes("resultado partido")) predictionTypeBadgeClass = 'bg-primary'; // Diferente a tu ejemplo, pero más estándar
        else if (topPredictionTypeLower.includes("ambos marcan")) predictionTypeBadgeClass = 'bg-secondary';
        else if (topPredictionTypeLower.includes("más/menos puntos")) predictionTypeBadgeClass = 'bg-warning text-dark';

        const homeLogo = match.teams.home.logo || '../assets/images/default-badge.png';
        const awayLogo = match.teams.away.logo || '../assets/images/default-badge.png';

        return `
            <div class="col-md-6 mb-4">
                <div class="card h-100 bg-dark text-light shadow-sm hover-card">
                    <div class="pt-2 ps-3 d-flex justify-content-between align-items-center">
                        <span class="badge bg-secondary rounded-pill fw-normal small">${match.league.name || 'N/A'}</span>
                        <small class="pe-3 text-light small">${timeLabel}</small>
                    </div>
                    <div class="card-body">
                        <div class="d-flex justify-content-around align-items-center mb-4">
                            <div class="text-center team-display-container">
                                <img src="${homeLogo}" class="rounded-circle team-logo bg-light p-1" alt="${match.teams.home.name || 'Local'}">
                                <p class="mt-2 mb-0 fw-medium small">${match.teams.home.name || 'Local'}</p>
                            </div>
                            <div class="text-muted fw-bold small">VS</div>
                            <div class="text-center team-display-container">
                                <img src="${awayLogo}" class="rounded-circle team-logo bg-light p-1" alt="${match.teams.away.name || 'Visitante'}">
                                <p class="mt-2 mb-0 fw-medium small">${match.teams.away.name || 'Visitante'}</p>
                            </div>
                        </div>
                        <span class="badge ${predictionTypeBadgeClass} mb-3 fw-normal">${topPrediction.type}</span>
                        <div class="mb-3">
                            <div class="d-flex justify-content-between align-items-center mb-1 small">
                                <span class="fw-medium">Confianza</span> <span>${confidencePercent}%</span>
                            </div>
                            <div class="progress" style="height: 6px;" role="progressbar" aria-label="Confidence ${confidencePercent}%" aria-valuenow="${confidencePercent}" aria-valuemin="0" aria-valuemax="100">
                                <div class="progress-bar bg-${confidenceBarColor}" style="width: ${confidencePercent}%"></div>
                            </div>
                        </div>
                        <p class="fw-medium text-info mb-1 prediction-outcome"> 
                            <i class="bi ${iconClass} me-1"></i> 
                            ${topPrediction.outcome}
                        </p>
                    </div>
                </div>
            </div>`;
    }

    function renderPredictions(matchesToRender) {
        if (!predictionsContainer) return;
        predictionsContainer.innerHTML = '';
        let cardsHTML = '';
        if (!matchesToRender || matchesToRender.length === 0) {
            predictionsContainer.innerHTML = '<div class="col-12"><p class="text-center text-secondary mt-4">No hay predicciones que coincidan con los filtros.</p></div>';
            return;
        }
        for (const match of matchesToRender) {
            if (match.topPrediction) {
                cardsHTML += createPredictionCardHTML(match, match.topPrediction);
            }
        }
        if (cardsHTML === '') {
             predictionsContainer.innerHTML = '<div class="col-12"><p class="text-center text-secondary mt-4">No se encontraron predicciones claras para mostrar con estos filtros.</p></div>';
        } else {
            predictionsContainer.innerHTML = cardsHTML;
        }
        console.log("Renderizado de predicciones completado.");
    }

    function applyFiltersAndRender() {
        console.log("applyFiltersAndRender: Aplicando filtros...");
        if (!allProcessedMatches) {
            console.warn("applyFiltersAndRender: allProcessedMatches no está definido todavía.");
            renderPredictions([]); // Llama a render con array vacío para mostrar mensaje
            return;
        }
        if (allProcessedMatches.length === 0 && predictionsContainer) {
            predictionsContainer.innerHTML = '<div class="col-12"><p class="text-center text-secondary mt-4">No hay predicciones cargadas para filtrar.</p></div>';
            return;
        }

        let filteredMatchesStep1; // Variable para el resultado del primer filtro (deporte)

        // 1. Aplicar Filtro de Deporte
        if (currentActiveSportFilter !== 'all') {
            filteredMatchesStep1 = allProcessedMatches.filter(match => match.sport === currentActiveSportFilter);
        } else {
            // Si el filtro de deporte es 'all', empezamos con todos los partidos procesados
            filteredMatchesStep1 = allProcessedMatches;
        }

        // 2. Aplicar Filtro del Dropdown sobre el resultado del filtro de deporte
        let finalFilteredMatches = filteredMatchesStep1; // Por defecto, si el filtro dropdown es 'all'
        
        // Para actualizar el texto del botón dropdown de filtros:
        // (Este selector es un poco frágil, idealmente el texto estaría en un <span> con ID)
        const filterButtonTextElement = dropdownFilterButton?.querySelector('.bi-funnel')?.nextSibling;


        if (currentActiveDropdownFilter === 'today') {
            const todayDateString = new Date().toDateString();
            finalFilteredMatches = filteredMatchesStep1.filter(match =>
                match.matchDate && new Date(match.matchDate).toDateString() === todayDateString
            );
            if (filterButtonTextElement && filterButtonTextElement.nodeType === Node.TEXT_NODE) {
                filterButtonTextElement.nodeValue = " Filters: Hoy ";
            }
        } else if (currentActiveDropdownFilter === 'highConfidence') {
            finalFilteredMatches = filteredMatchesStep1.filter(match =>
                match.topPrediction && match.topPrediction.confidence >= HIGH_CONFIDENCE_THRESHOLD
            );
            if (filterButtonTextElement && filterButtonTextElement.nodeType === Node.TEXT_NODE) {
                filterButtonTextElement.nodeValue = " Filters: Alta Conf. ";
            }
        } else { // 'all' para el filtro del dropdown
            // finalFilteredMatches ya es filteredMatchesStep1
            if (filterButtonTextElement && filterButtonTextElement.nodeType === Node.TEXT_NODE) {
                filterButtonTextElement.nodeValue = " Filters ";
            } else if (dropdownFilterButton && !filterButtonTextElement) { // Si no hay un nodo de texto como tal
                 // Esta es una forma más robusta de cambiar el texto si solo es el botón
                 // Encuentra el nodo de texto dentro del botón, excluyendo el icono
                 const textNode = Array.from(dropdownFilterButton.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0);
                 if (textNode) textNode.textContent = " Filters ";
                //  else dropdownFilterButton.innerHTML = '<i class="bi bi-funnel me-1"></i>Filters'; // Reconstruir si es necesario
            }
        }
        
        console.log(`Filtros aplicados: Dropdown='${currentActiveDropdownFilter}', Sport='${currentActiveSportFilter}'. Partidos para renderizar: ${finalFilteredMatches.length}`);
        renderPredictions(finalFilteredMatches);
    }

    function updateSportButtonActiveState() {
        if (!sportFilterButtons) return;
        sportFilterButtons.forEach(button => {
            if (button.dataset.sportFilter === currentActiveSportFilter) {
                button.classList.remove('btn-outline-light');
                button.classList.add('btn-primary');
            } else {
                button.classList.remove('btn-primary');
                button.classList.add('btn-outline-light');
            }
        });
    }
    
    async function loadAndDisplayPredictions() {
        console.log("Iniciando loadAndDisplayPredictions...");
        const matchesFromAPI = await fetchMatchesWithPredictions();
        if (!matchesFromAPI || matchesFromAPI.length === 0) {
            allProcessedMatches = [];
            console.log("loadAndDisplayPredictions: No se recibieron partidos de la API.");
        } else {
            allProcessedMatches = matchesFromAPI.map(match => {
                let topPred = null;
                try {
                    topPred = findTopPrediction(match);
                } catch (e) {
                    console.error(`Error en findTopPrediction para match ID ${match?._id || 'N/A'}:`, e);
                }
                return { ...match, topPrediction: topPred };
            });
        }
        console.log("loadAndDisplayPredictions: Partidos procesados con topPrediction:", allProcessedMatches.length);
        updateSportButtonActiveState();
        applyFiltersAndRender();
        console.log("loadAndDisplayPredictions: Carga y renderizado inicial completado.");
    }

    // --- Listeners para Filtros ---
    if (dropdownFilterLinks) {
        dropdownFilterLinks.forEach(link => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                const filterValue = event.target.dataset.filter || event.target.closest('a[data-filter]')?.dataset.filter;
                if (filterValue) {
                    console.log("Filtro dropdown seleccionado:", filterValue);
                    currentActiveDropdownFilter = filterValue;
                    applyFiltersAndRender();
                }
            });
        });
        console.log("Listeners añadidos a filtros del dropdown.");
    } else { console.warn("No se encontraron enlaces de filtro del dropdown."); }

    if (sportFilterButtons) {
        sportFilterButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                currentActiveSportFilter = event.currentTarget.dataset.sportFilter;
                console.log("Filtro de deporte seleccionado:", currentActiveSportFilter);
                updateSportButtonActiveState();
                applyFiltersAndRender();
            });
        });
        console.log("Listeners añadidos a botones de filtro de deporte.");
    } else { console.warn("No se encontraron botones de filtro de deporte."); }
    
    // Cargar datos iniciales
    loadAndDisplayPredictions();
    setupTeamSearchDashboard();

}); // --- FIN de DOMContentLoaded listener ---

function handleFirebaseAuthResult(result) {
    if (!result || !result.user) { console.error("Resultado Firebase inválido"); return; }
    const user = result.user;
    console.log("Usuario Firebase Auth OK:", user.email);

    user.getIdToken(true)
        .then(idToken => {
            console.log("Obtained Firebase ID Token:", idToken);
        })
        .catch(error => {
            console.error("Error obteniendo ID token:", error);
        });
}
