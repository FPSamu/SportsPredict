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
// let userFavoritesDashboard = []; // Descomentar si añades filtro de favoritos al dashboard

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

/**
 * Renderiza una tarjeta de predicción en el dashboard.
 * AHORA ASUME que `match.fetchedPredictions` es el array de predicciones para este partido.
 * Y que cada predicción en ese array tiene { market, value, confidence }
 */
function renderPredictionCard(match, prediction) { // Recibe el partido y UNA predicción específica a renderizar
    if (!match || !match.teams?.home || !match.teams?.away || !match.league || !prediction) {
        console.warn('Datos incompletos para renderizar tarjeta de predicción:', match, prediction);
        return '';
    }
    
    const confidencePercent = prediction.confidence ? Math.round(prediction.confidence * 100) : 0;
    let progressBarClass = 'bg-danger';
    if (confidencePercent >= 75) progressBarClass = 'bg-success';
    else if (confidencePercent >= 50) progressBarClass = 'bg-warning';

    const matchDateTime = new Date(match.matchDate);
    const timeOrStatus = (match.status?.toUpperCase() === 'FINISHED') ? 'Finalizado' : 
                         (match.status?.toUpperCase().includes('LIVE') || match.status?.toUpperCase().includes('IN_PLAY')) ? 'EN VIVO' :
                         matchDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

    return `
        <div class="col-md-6">
            <div class="card h-100 bg-dark text-light shadow-sm hover-card">
                <div class="pt-2 ps-3 d-flex justify-content-between align-items-center">
                    <span class="badge bg-secondary rounded-pill">${match.league.name || 'N/A'}</span>
                    <small class="pe-3 text-muted">${timeOrStatus} - ${matchDateTime.toLocaleDateString([], {day: 'numeric', month:'short'})}</small>
                </div>
                <div class="card-body">
                    <div class="d-flex justify-content-around align-items-center mb-4">
                        <div class="text-center">
                            <img src="${match.teams.home.logo || 'https://via.placeholder.com/50?text=H'}" class="rounded-circle team-logo bg-light p-1" alt="${match.teams.home.name}">
                            <p class="mt-2 mb-0 fw-medium small">${match.teams.home.name || 'Local'}</p>
                        </div>
                        <div class="text-muted fw-bold small">VS</div>
                        <div class="text-center">
                            <img src="${match.teams.away.logo || 'https://via.placeholder.com/50?text=A'}" class="rounded-circle team-logo bg-light p-1" alt="${match.teams.away.name}">
                            <p class="mt-2 mb-0 fw-medium small">${match.teams.away.name || 'Visitante'}</p>
                        </div>
                    </div>
                    <span class="badge bg-primary mb-3 fw-normal">${prediction.market || 'Predicción'}</span>
                    <div class="mb-3">
                        <div class="d-flex justify-content-between align-items-center mb-1 small">
                            <span class="fw-medium">Confianza</span> <span>${confidencePercent}%</span>
                        </div>
                        <div class="progress" style="height: 6px;" role="progressbar" aria-label="Confidence ${confidencePercent}%" aria-valuenow="${confidencePercent}" aria-valuemin="0" aria-valuemax="100">
                            <div class="progress-bar ${progressBarClass}" style="width: ${confidencePercent}%"></div>
                        </div>
                    </div>
                    <p class="fw-medium text-info mb-1"> 
                        <i class="bi bi-graph-up-arrow me-1"></i>
                        ${prediction.value || 'N/A'}
                    </p>
                </div>
            </div>
        </div>
    `;
}

/**
 * REESCRITA: Carga y muestra las "Top Predictions".
 */
async function loadTopPredictions() {
    console.log("Dashboard: loadTopPredictions() con filtros:", JSON.parse(JSON.stringify(activeDashboardFilters)));
    const predictionsContainer = document.getElementById('predictions');
    if (!predictionsContainer) { console.error("Dashboard: Contenedor #predictions no encontrado."); return; }
    predictionsContainer.innerHTML = `<div class="col-12 text-center p-5"><div class="spinner-border text-primary" role="status" aria-hidden="true"></span></div><p class="mt-2">Cargando predicciones...</p></div>`;

    let candidateMatches = [];
    let fetchEndpoint = '/matches/upcoming'; // Endpoint base para obtener partidos
    let params = new URLSearchParams();
    params.append('days', '7'); // Por defecto, próximos 7 días

    if (activeDashboardFilters.sport) {
        params.append('sport', activeDashboardFilters.sport);
    }

    // Si hay un equipo seleccionado por búsqueda, priorizar sus partidos
    if (activeDashboardFilters.selectedTeam) {
        // Idealmente, el backend soportaría teamId aquí. Como no lo hace (según match.controller.js),
        // filtramos por deporte del equipo y luego en cliente.
        if (!params.has('sport')) { // Si no hay filtro de sport, usar el del equipo
            params.set('sport', activeDashboardFilters.selectedTeam.sport);
        } else if (params.get('sport') !== activeDashboardFilters.selectedTeam.sport) {
            // Si el filtro de sport de los pills no coincide con el deporte del equipo buscado,
            // la búsqueda de equipo tiene precedencia.
            params.set('sport', activeDashboardFilters.selectedTeam.sport);
            console.warn("Dashboard: Filtro de deporte cambiado al del equipo buscado.");
        }
        // Podríamos pedir un rango mayor de días si buscamos un equipo específico para asegurar encontrar partidos.
        // params.set('days', '30'); // Por ejemplo
    }
    
    // Para "Today's Games", podríamos ajustar 'days' o filtrar después
    if (activeDashboardFilters.type === 'today') {
        // Para simplificar, obtendremos un rango y filtraremos por fecha exacta en cliente.
        // Podrías hacer dos llamadas (upcoming?days=0 y recent?days=0) y combinarlas para ser más preciso para "hoy".
        params.set('days', '1'); // Reduce la ventana para hoy, incluye mañana por zona horaria
    }

    const result = await fetchDataDashboard(`${fetchEndpoint}?${params.toString()}`);

    if (result && result.data) {
        candidateMatches = result.data;
    } else {
        console.log("Dashboard: No se recibieron partidos iniciales del backend.");
        predictionsContainer.innerHTML = `<div class="col-12 text-center p-5"><i class="bi bi-emoji-frown fs-1 text-muted mb-3"></i><p class="text-muted">No se pudieron cargar partidos base.</p></div>`;
        return;
    }

    // Filtrar por equipo seleccionado (si aplica) ANTES de buscar predicciones
    if (activeDashboardFilters.selectedTeam) {
        candidateMatches = candidateMatches.filter(match =>
            (match.teams.home.apiTeamId?.toString() === activeDashboardFilters.selectedTeam.apiTeamId?.toString() ||
             match.teams.away.apiTeamId?.toString() === activeDashboardFilters.selectedTeam.apiTeamId?.toString()) &&
            match.sport?.toLowerCase() === activeDashboardFilters.selectedTeam.sport?.toLowerCase()
        );
    }
    
    // Para "Today's Games", filtrar por fecha exacta
    if (activeDashboardFilters.type === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        candidateMatches = candidateMatches.filter(match => 
            new Date(match.matchDate).toISOString().split('T')[0] === todayStr
        );
    }

    console.log("Dashboard: Partidos candidatos después de filtros iniciales (equipo, hoy):", candidateMatches.length);

    // Ahora, para cada partido candidato, obtener sus predicciones
    const matchPredictionPromises = candidateMatches.map(match =>
        fetchDataDashboard(`/matches/${match._id}/predictions`)
            .then(predictionResponse => {
                if (predictionResponse && predictionResponse.data && predictionResponse.data.predictions) {
                    // Adjuntar las predicciones (el array) al objeto del partido
                    // Asumimos que la respuesta de Python es { "predictions": [...], ... }
                    // y el controlador lo pasa en 'data', entonces accedemos a response.data.predictions
                    match.fetchedPredictions = predictionResponse.data.predictions; 
                } else {
                    match.fetchedPredictions = []; // Sin predicciones o error
                    console.warn(`No se obtuvieron predicciones o formato incorrecto para matchId: ${match._id}`, predictionResponse);
                }
                return match; // Devolver el partido (modificado o no)
            })
            .catch(err => {
                console.error(`Error obteniendo predicciones para matchId ${match._id}:`, err);
                match.fetchedPredictions = []; // Marcar como sin predicciones en caso de error
                return match;
            })
    );

    const matchesWithFetchedPredictions = await Promise.all(matchPredictionPromises);
    console.log("Dashboard: Partidos con sus predicciones (o intento):", matchesWithFetchedPredictions.length);

    let finalFilteredMatches = matchesWithFetchedPredictions.filter(match => match.fetchedPredictions && match.fetchedPredictions.length > 0);
    console.log("Dashboard: Partidos que SÍ tienen predicciones:", finalFilteredMatches.length);


    // Aplicar filtros de tipo "High Probability" o "Popular"
    if (activeDashboardFilters.type === 'high_probability') {
        finalFilteredMatches = finalFilteredMatches.filter(match => 
            match.fetchedPredictions.some(p => p.confidence >= 0.75)
        );
    } else if (activeDashboardFilters.type === 'popular') {
        finalFilteredMatches = finalFilteredMatches.filter(match =>
            topTeamConfigsDashboard.some(topTeam => 
                (topTeam.apiTeamId.toString() === match.teams.home.apiTeamId?.toString() || 
                 topTeam.apiTeamId.toString() === match.teams.away.apiTeamId?.toString()) &&
                topTeam.sport.toLowerCase() === match.sport?.toLowerCase()
            )
        );
    }

    // Ordenar
    if (activeDashboardFilters.type === 'high_probability') {
        // Ordenar los partidos por la confianza de su predicción más alta que cumple el >=0.75
        finalFilteredMatches.sort((a, b) => {
            const confA = Math.max(...a.fetchedPredictions.filter(p => p.confidence >= 0.75).map(p => p.confidence), 0);
            const confB = Math.max(...b.fetchedPredictions.filter(p => p.confidence >= 0.75).map(p => p.confidence), 0);
            return confB - confA;
        });
    } else {
        finalFilteredMatches.sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));
    }

    // Renderizar
    predictionsContainer.innerHTML = '';
    if (finalFilteredMatches.length > 0) {
        finalFilteredMatches.forEach(match => {
            // Para cada partido, podrías mostrar todas sus predicciones o la más relevante/primera
            // o la que cumple con el "high probability"
            let predictionToDisplay = match.fetchedPredictions[0]; // Por defecto, la primera
            if (activeDashboardFilters.type === 'high_probability') {
                predictionToDisplay = match.fetchedPredictions.find(p => p.confidence >= 0.75) || match.fetchedPredictions[0];
            }
            if (predictionToDisplay) {
                 predictionsContainer.innerHTML += renderPredictionCard(match, predictionToDisplay);
            }
        });
    } else {
        predictionsContainer.innerHTML = `<div class="col-12 text-center p-5"><i class="bi bi-emoji-frown fs-1 text-muted mb-3"></i><p class="text-muted">No hay predicciones que coincidan con tus filtros.</p></div>`;
    }
}

// Funciones de setup de filtros y búsqueda (setupDashboardFilters, setupSportPillsDashboard, setupTeamSearchDashboard)
// Deben actualizar `activeDashboardFilters` y llamar a `loadTopPredictions()`

function setupDashboardFilters() { /* ... (como en la respuesta anterior, asegurándose de llamar a loadTopPredictions) ... */ 
    console.log("Dashboard DEBUG: setupDashboardFilters() ejecutándose.");
    const filterDropdownContainer = document.querySelector('h2.text-light + .dropdown'); 
    if (!filterDropdownContainer) { console.warn("Dashboard: Contenedor del dropdown de filtros no encontrado."); return; }
    const filterItems = filterDropdownContainer.querySelectorAll('.dropdown-menu .dropdown-item');
    const filterButton = filterDropdownContainer.querySelector('.dropdown-toggle.btn-sm');
    console.log("Dashboard DEBUG: Filtros de dropdown encontrados:", filterItems.length);

    filterItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const filterText = e.target.textContent.trim();
            console.log("Dashboard DEBUG: Filtro de predicción seleccionado:", filterText);
            if (filterButton) filterButton.textContent = filterText;

            if (filterText === "Today's Games") activeDashboardFilters.type = 'today';
            else if (filterText === "High Probability") activeDashboardFilters.type = 'high_probability';
            else if (filterText === "Popular") activeDashboardFilters.type = 'popular';
            else activeDashboardFilters.type = 'all'; 

            activeDashboardFilters.selectedTeam = null; // Limpiar equipo buscado al cambiar filtro principal
            // No limpiamos activeDashboardFilters.sport aquí, se mantiene el de los pills
            loadTopPredictions();
        });
    });
}

function setupSportPillsDashboard() { /* ... (como en la respuesta anterior, llamando a loadTopPredictions) ... */
    console.log("Dashboard DEBUG: setupSportPillsDashboard() ejecutándose.");
    const sportPillsContainer = document.querySelector('.filter-buttons'); 
    if (!sportPillsContainer) { console.warn("Dashboard: Contenedor de pills de deporte no encontrado."); return; }
    const buttons = sportPillsContainer.querySelectorAll('button');
    console.log("Dashboard DEBUG: Botones pill de deporte encontrados:", buttons.length);

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            console.log("Dashboard DEBUG: Botón pill de deporte clickeado:", button.textContent);
            buttons.forEach(btn => { btn.classList.remove('btn-primary'); btn.classList.add('btn-outline-light');});
            button.classList.add('btn-primary'); button.classList.remove('btn-outline-light');

            const sportText = button.textContent.trim().toLowerCase();
            if (sportText.includes('soccer') || sportText.includes('fútbol')) activeDashboardFilters.sport = 'Football';
            else if (sportText.includes('basketball')) activeDashboardFilters.sport = 'Basketball';
            else activeDashboardFilters.sport = null; 

            activeDashboardFilters.selectedTeam = null;
            activeDashboardFilters.type = 'all'; 
            const filterDropdownButton = document.querySelector('h2.text-light + .dropdown .dropdown-toggle.btn-sm');
            if (filterDropdownButton) filterDropdownButton.innerHTML = '<i class="bi bi-funnel me-1"></i>Filters';
            loadTopPredictions();
        });
    });
 }

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

// --- Código existente de DOMContentLoaded (logout, delete account, tooltips) ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Dashboard DOM Cargado. StatsPredict añadiendo listeners...");
    if (!auth) { console.error("Error: Firebase Auth no está disponible..."); return; }

    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
    if (confirmLogoutBtn) { /* ... tu lógica de logout ... */ 
        confirmLogoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => { localStorage.removeItem('authToken'); localStorage.removeItem('userInfo'); window.location.href = loginPage; })
            .catch((error) => { console.error('Error logout:', error); localStorage.removeItem('authToken'); localStorage.removeItem('userInfo'); window.location.href = loginPage; });
        });
    }

    const confirmDeleteAccountBtn = document.getElementById('confirmDeleteAccountBtn');
    if (confirmDeleteAccountBtn) { /* ... tu lógica de delete account ... */ 
        confirmDeleteAccountBtn.addEventListener('click', async () => {
            const authToken = localStorage.getItem('authToken');
            if (!authToken) { alert("Error: No autenticado."); window.location.href = loginPage; return; }
            // ... resto de tu lógica de fetch DELETE /api/users/me ...
            try {
                const response = await fetch(`${API_BASE_URL_DASHBOARD}/users/me`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${authToken}`}});
                // ... manejo de respuesta y redirección ...
                if(response.ok) {
                    alert("Cuenta eliminada.");
                    if (auth) { auth.signOut(); }
                    localStorage.clear(); window.location.href = loginPage;
                } else { throw new Error("Fallo al eliminar cuenta");}
            } catch(error) { alert("Error: " + error.message); /* revertir UI botón */ }
        });
    }
    
    try { const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]'); [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl)); } 
    catch(e) { console.error("Error inicializando tooltips:", e); }

    // --- NUEVAS LLAMADAS DE SETUP ---
    setupDashboardFilters();
    setupSportPillsDashboard();
    setupTeamSearchDashboard();
    loadTopPredictions(); // Carga inicial
});