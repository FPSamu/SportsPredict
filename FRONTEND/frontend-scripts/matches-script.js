// FRONTEND/frontend-scripts/matches-script.js

const API_BASE_URL = 'http://localhost:5000/api';

let activeFilters = {
    sport: null,
    leagueId: null,
    favoritesOnly: false,
    selectedTeamId: null,
    selectedTeamSport: null 
};
let userFavorites = []; 

const leagueMappings = {
    // MODIFICADO: Añadido 'displayName' para controlar lo que se muestra en el botón.
    // 'isSpecial' puede ayudar a decidir si se usa displayName o el nombre de la liga.
    "All": { leagueId: null, sport: null, favoritesOnly: false },
    "Favorites": { favoritesOnly: true, leagueId: null, sport: null },
    "Premier League": { leagueId: 2021, sport: 'Football' }, 
    "La Liga": { leagueId: 2014, sport: 'Football' },       
    "Serie A": { leagueId: 2019, sport: 'Football' }, 
    "Bundesliga": { leagueId: 2002, sport: 'Football' },
    "Ligue 1": { leagueId: 2015, sport: 'Football' },       
    "NBA": { leagueId: null, sport: 'Basketball' },       
    "Champions League": { leagueId: 2001, sport: 'Football' } 
};

/**
 * Obtiene el token de autenticación de localStorage.
 */
function getAuthToken() {
    return localStorage.getItem('authToken');
}

/**
 * Función genérica para realizar llamadas fetch al backend API.
 */
async function fetchData(endpoint, method = 'GET', body = null) {
    // ... (sin cambios, como en tu código) ...
    const authToken = getAuthToken();
    if (!authToken) { console.error('No auth token found. auth-guard.js debería redirigir.'); return null; }
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` };
    const config = { method: method, headers: headers };
    if (body && (method === 'POST' || method === 'PUT' || method === 'DELETE')) { config.body = JSON.stringify(body); }
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        if (!response.ok) {
            if (response.status === 401) { console.error('Unauthorized (401). Token inválido o expirado. Redirigiendo a login...'); localStorage.removeItem('authToken'); localStorage.removeItem('userInfo'); window.location.href = 'login.html'; }
            throw new Error(`HTTP error! status: ${response.status}, message: ${await response.text()}`);
        }
        return await response.json();
    } catch (error) { console.error('Error fetching data:', error); return null; }
}

/**
 * Genera las pestañas de navegación por fecha dinámicamente.
 */
function generateDateTabs() { /* ... (sin cambios, como en tu código) ... */ 
    const dateTabContainer = document.getElementById('dateTab');
    const tabContentContainer = document.getElementById('dateTabContent');
    if (!dateTabContainer || !tabContentContainer) { console.error('Date tab containers not found in HTML.'); return; }
    dateTabContainer.innerHTML = ''; 
    tabContentContainer.innerHTML = ''; 
    const today = new Date(); today.setHours(0,0,0,0); 
    const daysInPast = 3; const daysInFuture = 7; 
    let datesToDisplay = [];
    for (let i = daysInPast; i >= 1; i--) { const date = new Date(today); date.setDate(today.getDate() - i); datesToDisplay.push(date); }
    datesToDisplay.push(today);
    for (let i = 1; i <= daysInFuture -1; i++) { const date = new Date(today); date.setDate(today.getDate() + i); datesToDisplay.push(date); }
    datesToDisplay.forEach(date => { addDateTab(date, dateTabContainer, tabContentContainer, date.toDateString() === today.toDateString()); });
}

/**
 * Añade una pestaña de fecha individual y su panel de contenido.
 */
function addDateTab(date, navContainer, contentContainer, isActive) { /* ... (sin cambios, como en tu código) ... */ 
    const dateString = date.toISOString().split('T')[0]; 
    const dayNamesShort = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const monthNamesShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const displayDate = `${dayNamesShort[date.getDay()]} ${date.getDate()} ${monthNamesShort[date.getMonth()]}`;
    const tabId = `date-${dateString}-tab`; const paneId = `date-${dateString}-pane`;
    const navItem = document.createElement('li'); navItem.className = 'nav-item'; navItem.setAttribute('role', 'presentation');
    const button = document.createElement('button');
    button.className = `nav-link ${isActive ? 'active' : ''}`;
    button.id = tabId; button.setAttribute('data-bs-toggle', 'pill'); button.setAttribute('data-bs-target', `#${paneId}`);
    button.type = 'button'; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', paneId);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    button.textContent = displayDate + (date.toDateString() === new Date(new Date().setHours(0,0,0,0)).toDateString() ? ' (Hoy)' : '');
    button.addEventListener('click', () => loadMatchesForDate(dateString, paneId));
    navItem.appendChild(button); navContainer.appendChild(navItem);
    const tabPane = document.createElement('div');
    tabPane.className = `tab-pane fade ${isActive ? 'show active' : ''}`;
    tabPane.id = paneId; tabPane.setAttribute('role', 'tabpanel'); tabPane.setAttribute('aria-labelledby', tabId);
    contentContainer.appendChild(tabPane);
}

/**
 * Carga y renderiza los partidos para una fecha específica, aplicando filtros.
 */
async function loadMatchesForDate(dateString, paneId) { /* ... (sin cambios significativos en la lógica de carga de datos, pero la URL ya estaba corregida) ... */ 
    const targetPane = document.getElementById(paneId);
    if (!targetPane) { console.error(`Pane with id ${paneId} not found.`); return; }
    targetPane.innerHTML = `<div class="text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div><p class="mt-2">Cargando partidos para ${dateString}...</p></div>`;
    const selectedDate = new Date(dateString + 'T00:00:00Z');
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    let endpoint;
    let params = new URLSearchParams(); params.append('days', '7'); 
    if (selectedDate < today) { endpoint = '/matches/recent'; } else { endpoint = '/matches/upcoming'; }
    if (activeFilters.sport) { params.append('sport', activeFilters.sport); }
    if (activeFilters.leagueId) { params.append('leagueId', activeFilters.leagueId); }
    const url = `${endpoint}?${params.toString()}`; // CORREGIDO YA
    console.log("Fetching matches from:", url);
    const result = await fetchData(url);
    // console.log(`Raw response from ${url} for date ${dateString}:`, result); // Puedes descomentar para depurar
    if (result && result.data) {
        let matchesData = result.data;
        matchesData = matchesData.filter(match => new Date(match.matchDate).toISOString().split('T')[0] === dateString);
        if (activeFilters.favoritesOnly) {
            if (userFavorites.length === 0 && !localStorage.getItem('askedToLoadFavorites')) { 
                localStorage.setItem('askedToLoadFavorites', 'true');
                await fetchUserFavorites(); 
                localStorage.removeItem('askedToLoadFavorites');
            }
            matchesData = matchesData.filter(match => userFavorites.some(fav => 
                (fav.apiTeamId.toString() === match.teams.home.apiTeamId?.toString() || fav.apiTeamId.toString() === match.teams.away.apiTeamId?.toString()) &&
                fav.sport.toLowerCase() === match.sport?.toLowerCase()
            ));
        }
        if (activeFilters.selectedTeamId && activeFilters.selectedTeamSport) {
            console.log(`Client-side filtering for team ID: ${activeFilters.selectedTeamId}, sport: ${activeFilters.selectedTeamSport}`);
            matchesData = matchesData.filter(match => 
                match.sport?.toLowerCase() === activeFilters.selectedTeamSport.toLowerCase() &&
                (match.teams.home.apiTeamId?.toString() === activeFilters.selectedTeamId.toString() ||
                 match.teams.away.apiTeamId?.toString() === activeFilters.selectedTeamId.toString())
            );
        }
        renderMatches(matchesData, paneId, dateString);
    } else {
        const displayDateObj = new Date(dateString + 'T00:00:00Z');
        const dayNamesLong = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        const monthNamesLong = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        let formattedDateTitle = `${dayNamesLong[displayDateObj.getUTCDay()]}, ${displayDateObj.getUTCDate()} de ${monthNamesLong[displayDateObj.getUTCMonth()]} ${displayDateObj.getUTCFullYear()}`;
        if (dateString === new Date(new Date().setUTCHours(0,0,0,0)).toISOString().split('T')[0]) { formattedDateTitle += " (Hoy)"; }
        targetPane.innerHTML = `<h3 class="text-center text-primary mb-4">${formattedDateTitle}</h3>
                                <div class="text-center p-5 no-matches-placeholder">
                                    <i class="bi bi-calendar-x fs-1 text-muted mb-3"></i>
                                    <p class="text-muted mb-0">No se pudieron cargar los partidos o no hay partidos para este día${activeFilters.leagueId || activeFilters.sport || activeFilters.favoritesOnly || activeFilters.selectedTeamId ? ' con los filtros aplicados' : ''}.</p>
                                </div>`;
    }
}

/**
 * Renderiza la lista de partidos en el contenedor especificado.
 */
function renderMatches(matches, containerId, dateString) { /* ... (sin cambios, como en tu código) ... */ 
    const container = document.getElementById(containerId);
    if (!container) return;
    const displayDateObj = new Date(dateString + 'T00:00:00Z'); 
    const dayNamesLong = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const monthNamesLong = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    let formattedDateTitle = `${dayNamesLong[displayDateObj.getUTCDay()]}, ${displayDateObj.getUTCDate()} de ${monthNamesLong[displayDateObj.getUTCMonth()]} ${displayDateObj.getUTCFullYear()}`;
    const todayNormalized = new Date(); todayNormalized.setUTCHours(0,0,0,0);
    if (displayDateObj.getTime() === todayNormalized.getTime()) { formattedDateTitle += " (Hoy)"; }
    container.innerHTML = `<h3 class="text-center text-primary mb-4">${formattedDateTitle}</h3>`;
    if (!matches || matches.length === 0) {
        container.innerHTML += `<div class="text-center p-5 no-matches-placeholder"><i class="bi bi-calendar-x fs-1 text-muted mb-3"></i><p class="text-muted mb-0">No hay partidos programados para este día${activeFilters.leagueId || activeFilters.sport || activeFilters.favoritesOnly || activeFilters.selectedTeamId ? ' con los filtros aplicados' : ''}.</p></div>`;
        return;
    }
    const row = document.createElement('div'); row.className = 'row g-3';
    matches.forEach(match => {
        const col = document.createElement('div'); col.className = 'col-lg-6 col-md-12'; 
        let statusDisplay = ''; let scoreDisplay = '<div class="col-2 match-score-status text-center text-muted fw-bold small">VS</div>';
        const matchDateTime = new Date(match.matchDate);
        const matchTime = matchDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        switch (match.status ? match.status.toUpperCase() : 'UNKNOWN') {
            case 'FINISHED': case 'FT': case 'AET': statusDisplay = `<span class="status-finished">Finalizado</span>`; scoreDisplay = `<div class="col-2 match-score-status match-score">${match.scores?.home ?? '?'} - ${match.scores?.away ?? '?'}</div>`; break;
            case 'LIVE': case 'IN_PLAY': case '1H': case 'HT': case '2H': case 'ET': case 'PEN_LIVE': statusDisplay = `<span class="status-live"><i class="bi bi-broadcast-pin me-1"></i>EN VIVO</span>`; if (match.scores && typeof match.scores.home !== 'undefined' && match.scores.home !== null) { scoreDisplay = `<div class="col-2 match-score-status match-score">${match.scores.home} - ${match.scores.away}</div>`; } else { scoreDisplay = `<div class="col-2 match-score-status text-center text-muted small">EN VIVO</div>`; } break;
            case 'SCHEDULED': case 'TIMED': case 'NS': case 'POSTPONED': statusDisplay = `<span class="status-scheduled">${matchTime}</span>`; if (match.status.toUpperCase() === 'POSTPONED') { statusDisplay = `<span class="status-postponed">Pospuesto</span>`; } break;
            default: statusDisplay = `<span class="status-other text-capitalize">${match.status || 'Desconocido'}</span>`; break;
        }
        let sportIcon = '<i class="bi bi-trophy me-2"></i>';
        if (match.sport && match.sport.toLowerCase() === 'football') { sportIcon = '<i class="bi bi-futbol me-2"></i>'; } 
        else if (match.sport && match.sport.toLowerCase() === 'basketball') { sportIcon = '<i class="bi bi-dribbble me-2"></i>'; }
        if (match.league && match.league.name && match.league.name.toLowerCase().includes('champions league')) { sportIcon = '<i class="bi bi-stars me-2"></i>'; }
        col.innerHTML = `
            <div class="card bg-dark text-light match-card h-100 hover-card" data-match-id="${match._id || match.id }">
                <div class="card-header d-flex justify-content-between align-items-center small">
                    <span class="text-truncate" title="${match.league?.name || 'Liga Desconocida'}">${sportIcon}${match.league?.name || 'Liga Desconocida'}</span> ${statusDisplay}
                </div>
                <div class="card-body"><div class="row align-items-center gx-2">
                        <div class="col-5 text-end"><div class="team-info justify-content-end align-items-center">
                                <span class="team-name text-truncate" title="${match.teams?.home?.name || 'Local'}">${match.teams?.home?.name || 'Local'}</span>
                                <img src="${match.teams?.home?.logo || 'https://via.placeholder.com/40?text=L'}" class="rounded-circle team-logo p-1 ms-2" alt="${match.teams?.home?.name || 'Local'}" style="width: 40px; height: 40px; object-fit: contain;">
                        </div></div>
                        ${scoreDisplay}
                        <div class="col-5"><div class="team-info align-items-center">
                                <img src="${match.teams?.away?.logo || 'https://via.placeholder.com/40?text=V'}" class="rounded-circle team-logo p-1 me-2" alt="${match.teams?.away?.name || 'Visitante'}" style="width: 40px; height: 40px; object-fit: contain;">
                                <span class="team-name text-truncate" title="${match.teams?.away?.name || 'Visitante'}">${match.teams?.away?.name || 'Visitante'}</span>
                        </div></div>
                </div></div>
            </div>`;
        row.appendChild(col);
    });
    container.appendChild(row);
}

function setupLogoutButton() { /* ... (sin cambios, como en tu código) ... */ 
    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener('click', () => {
            try {
                if (typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function') {
                     firebase.auth().signOut().then(() => { console.log('User signed out successfully from Firebase.'); localStorage.removeItem('authToken'); localStorage.removeItem('userInfo'); window.location.href = 'login.html'; })
                     .catch((error) => { console.error('Firebase sign out error:', error); localStorage.removeItem('authToken'); localStorage.removeItem('userInfo'); window.location.href = 'login.html';});
                } else { console.warn('Firebase auth object not available. Cleaning up locally.'); localStorage.removeItem('authToken'); localStorage.removeItem('userInfo'); window.location.href = 'login.html';}
            } catch (e) { console.error("Error during logout process:", e); localStorage.removeItem('authToken'); localStorage.removeItem('userInfo'); window.location.href = 'login.html'; }
        });
    } else { console.warn('Botón de logout (confirmLogoutBtn) no encontrado.');}
}

async function fetchUserFavorites() { /* ... (sin cambios, como en tu código) ... */ 
    const result = await fetchData('/users/me/favorites');
    if (result && Array.isArray(result)) { userFavorites = result; console.log('Favoritos del usuario cargados:', userFavorites); } 
    else { console.error('No se pudieron cargar los favoritos o el formato es incorrecto.'); userFavorites = []; }
}

/**
 * MODIFICADO: Actualiza el texto del botón principal del dropdown de filtros.
 * @param {string} [text=null] - El texto a mostrar. Si es null, se usa el texto/icono por defecto.
 */
function updateLeagueFilterButtonText(text = null) {
    // Selector específico para el botón de filtro de liga en matches.html
    const leagueDropdownButtonMatches = document.querySelector('.d-flex.justify-content-end.mb-3 .dropdown .dropdown-toggle.btn-sm');
    if (leagueDropdownButtonMatches) {
        if (text) {
            leagueDropdownButtonMatches.textContent = text; // Solo texto si se provee (ej. nombre de liga o equipo)
        } else {
            leagueDropdownButtonMatches.innerHTML = '<i class="bi bi-filter me-1"></i>Filter'; // Estado por defecto
        }
    } else {
        console.warn("Matches: Botón del dropdown de filtros de liga no encontrado para actualizar texto.");
    }
}

/**
 * MODIFICADO: Configura los listeners para los botones de filtro del dropdown de LIGAS.
 */
function setupFilterButtons() { 
    console.log("DEBUG: setupFilterButtons() [League Dropdown] se está ejecutando.");
    const leagueDropdownContainer = document.querySelector('.d-flex.justify-content-end.mb-3 .dropdown');
    if (!leagueDropdownContainer) {
        console.warn("Matches: Contenedor del dropdown de filtros de liga no encontrado.");
        return;
    }
    const leagueFilterDropdownItems = leagueDropdownContainer.querySelectorAll('.dropdown-menu .dropdown-item');
    console.log("DEBUG: League dropdown items encontrados:", leagueFilterDropdownItems.length);

    if (leagueFilterDropdownItems.length === 0) { return; }

    leagueFilterDropdownItems.forEach(item => {
        item.addEventListener('click', async (event) => {
            event.preventDefault();
            const filterName = event.target.textContent.trim();
            console.log(`DEBUG: Item de dropdown de LIGA clickeado: ${filterName}`);
            const filterConfig = leagueMappings[filterName];

            activeFilters.selectedTeamId = null;     
            activeFilters.selectedTeamSport = null;

            if (filterConfig) {
                activeFilters.leagueId = filterConfig.leagueId;
                activeFilters.sport = filterConfig.sport; 
                activeFilters.favoritesOnly = !!filterConfig.favoritesOnly;
                // Actualizar el texto del botón: Si es "All" o "Favorites", usa su displayName, sino el nombre de la liga.
                updateLeagueFilterButtonText(filterConfig.displayName ? filterConfig.displayName : filterName);
            } else { 
                console.warn(`Configuración de filtro no encontrada para: ${filterName}. Aplicando "All".`);
                activeFilters.leagueId = null;
                activeFilters.sport = null; 
                activeFilters.favoritesOnly = false;
                updateLeagueFilterButtonText(leagueMappings["All"].displayName); // Restablecer a "Filter" (o lo que diga All)
            }
            if (activeFilters.favoritesOnly && userFavorites.length === 0) { await fetchUserFavorites(); }
            
            const activeDateTabButton = document.querySelector('#dateTab .nav-link.active');
            if (activeDateTabButton) {
                const dateString = activeDateTabButton.id.replace('-tab', '').replace('date-', '');
                const paneId = activeDateTabButton.getAttribute('data-bs-target').substring(1);
                loadMatchesForDate(dateString, paneId);
            }
        });
    });
}

// No incluimos setupSportFilterButtons() porque no hay botones pill de deporte en matches.html

/**
 * MODIFICADO: Configura la funcionalidad de búsqueda de equipos.
 */
function setupTeamSearch() {
    // ... (lógica de setupTeamSearch como la tenías, pero con la llamada a updateLeagueFilterButtonText) ...
    console.log("DEBUG: setupTeamSearch() se está ejecutando.");
    const searchInput = document.getElementById('teamSearchInput');
    const searchResultsContainer = document.getElementById('searchResults');
    const offcanvasElement = document.getElementById('offcanvasSearch');
    const offcanvasSearchInstance = offcanvasElement ? (bootstrap.Offcanvas.getInstance(offcanvasElement) || new bootstrap.Offcanvas(offcanvasElement)) : null;

    if (!searchInput || !searchResultsContainer) { console.warn('Search: Elementos UI no encontrados.'); return; }
    console.log("DEBUG: Elementos de búsqueda (input y results container) encontrados.");

    let searchTimeout;
    searchInput.addEventListener('input', (event) => {
        clearTimeout(searchTimeout);
        const query = event.target.value.trim();
        if (query.length < 3) { searchResultsContainer.innerHTML = '<p class="text-muted p-3 small">Escribe al menos 3 caracteres.</p>'; return; }
        searchResultsContainer.innerHTML = '<div class="p-3 text-center"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Buscando...</span></div></div>';

        searchTimeout = setTimeout(async () => {
            let searchApiEndpoint = `/teams/search?name=${encodeURIComponent(query)}`;
            // Para la búsqueda de equipos, no necesariamente filtramos por el deporte activo,
            // ya que el usuario podría estar buscando un equipo de cualquier deporte.
            // El backend ya puede filtrar por deporte si se le pasa el parámetro `sport`.
            // if (activeFilters.sport) {
            //     searchApiEndpoint += `&sport=${encodeURIComponent(activeFilters.sport)}`;
            // }
            console.log("Search: Buscando equipos con endpoint:", API_BASE_URL + searchApiEndpoint);
            const response = await fetchData(searchApiEndpoint); 
            searchResultsContainer.innerHTML = ''; 
            if (response && response.data && response.data.length > 0) {
                response.data.forEach(team => {
                    const isFav = isTeamFavorite(team.apiTeamId, team.sport); // Necesitas la función isTeamFavorite y toggleFavoriteTeam si quieres la estrella
                    const starClass = isFav ? 'bi-star-fill text-warning' : 'bi-star';

                    const teamElementWrapper = document.createElement('div');
                    teamElementWrapper.className = 'list-group-item list-group-item-action bg-dark text-light d-flex align-items-center justify-content-between py-2 search-result-item';
                    
                    const teamInfoContainer = document.createElement('div');
                    teamInfoContainer.className = 'd-flex align-items-center flex-grow-1';
                    teamInfoContainer.style.cursor = 'pointer';
                    teamInfoContainer.innerHTML = `
                        <img src="${team.logoUrl || 'https://via.placeholder.com/30?text=L'}" alt="${team.name}" class="rounded-circle me-3" style="width: 30px; height: 30px; object-fit: contain;">
                        <span class="flex-grow-1">${team.name} <small class="text-muted">(${team.sport || 'N/A'})</small></span>
                    `;

                    const starIcon = document.createElement('i');
                    starIcon.className = `bi ${starClass} favorite-star-search ms-auto p-2`; 
                    starIcon.style.cursor = 'pointer';
                    starIcon.setAttribute('role', 'button');
                    starIcon.setAttribute('title', isFav ? 'Quitar de favoritos' : 'Añadir a favoritos');

                    teamInfoContainer.addEventListener('click', (e) => {
                        e.preventDefault();
                        console.log('Search: Equipo seleccionado para filtrar partidos:', team);
                        activeFilters.selectedTeamId = team.apiTeamId;
                        activeFilters.selectedTeamSport = team.sport;
                        activeFilters.leagueId = null;      
                        activeFilters.favoritesOnly = false; 
                        activeFilters.sport = team.sport;   
                        
                        updateLeagueFilterButtonText(team.name); // <<< MODIFICADO: Mostrar nombre del equipo

                        const activeDateTabButton = document.querySelector('#dateTab .nav-link.active');
                        if (activeDateTabButton) {
                            const dateString = activeDateTabButton.id.replace('-tab', '').replace('date-', '');
                            const paneId = activeDateTabButton.getAttribute('data-bs-target').substring(1);
                            loadMatchesForDate(dateString, paneId);
                        } else { 
                            const todayString = new Date().toISOString().split('T')[0];
                            loadMatchesForDate(todayString, `date-${todayString}-pane`);
                        }
                        if(offcanvasSearchInstance) offcanvasSearchInstance.hide();
                        searchInput.value = ''; 
                        searchResultsContainer.innerHTML = '';
                    });

                    starIcon.addEventListener('click', (e) => {
                        e.stopPropagation(); 
                        toggleFavoriteTeam(team, starIcon); // Necesitas la función toggleFavoriteTeam
                    });

                    teamElementWrapper.appendChild(teamInfoContainer);
                    teamElementWrapper.appendChild(starIcon);
                    searchResultsContainer.appendChild(teamElementWrapper);
                });
            } else if (response && response.data && response.data.length === 0) {
                searchResultsContainer.innerHTML = '<p class="text-muted p-3">No se encontraron equipos.</p>';
            } else {
                 searchResultsContainer.innerHTML = '<p class="text-danger p-3">Error al buscar equipos.</p>';
            }
        }, 500);
    });
}

// Necesitas definir isTeamFavorite y toggleFavoriteTeam si no están ya en este script
// (las incluí en una respuesta anterior cuando pediste la funcionalidad de estrellas)
function isTeamFavorite(apiTeamId, sport) {
    if (!userFavorites || userFavorites.length === 0) return false;
    return userFavorites.some(fav => 
        fav.apiTeamId?.toString() === apiTeamId?.toString() && 
        fav.sport?.toLowerCase() === sport?.toLowerCase()
    );
}

async function toggleFavoriteTeam(team, starIcon) {
    if (!team || !team.apiTeamId || !team.sport) {
        console.error("Datos incompletos del equipo para marcar como favorito:", team);
        return;
    }
    const currentlyFavorite = isTeamFavorite(team.apiTeamId, team.sport);
    const method = currentlyFavorite ? 'DELETE' : 'POST';
    const endpoint = '/users/me/favorites';
    const body = { apiTeamId: team.apiTeamId, sport: team.sport };
    const response = await fetchData(endpoint, method, body);
    if (response && response.favorites) {
        userFavorites = response.favorites; 
        if (isTeamFavorite(team.apiTeamId, team.sport)) {
            starIcon.classList.remove('bi-star');
            starIcon.classList.add('bi-star-fill', 'text-warning');
             starIcon.setAttribute('title', 'Quitar de favoritos');
        } else {
            starIcon.classList.remove('bi-star-fill', 'text-warning');
            starIcon.classList.add('bi-star');
            starIcon.setAttribute('title', 'Añadir a favoritos');
        }
        if (activeFilters.favoritesOnly) {
            const activeDateTabButton = document.querySelector('#dateTab .nav-link.active');
            if (activeDateTabButton) {
                const dateString = activeDateTabButton.id.replace('-tab', '').replace('date-', '');
                const paneId = activeDateTabButton.getAttribute('data-bs-target').substring(1);
                loadMatchesForDate(dateString, paneId);
            }
        }
    } else {
        alert(`Hubo un error al actualizar tus favoritos.`);
    }
}


// --- INICIALIZACIÓN CUANDO EL DOM ESTÁ LISTO ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DEBUG: DOMContentLoaded para matches-script.js");
    if (!getAuthToken() && window.location.pathname.includes('matches.html')) {
        console.warn('No auth token on matches.html, auth-guard should have redirected.'); return;
    }
    await fetchUserFavorites(); 
    generateDateTabs(); 
    
    updateLeagueFilterButtonText(); // <<< AÑADIDO: Establecer texto inicial del botón de filtro

    const activeTabButton = document.querySelector('#dateTab .nav-link.active');
    if (activeTabButton) {
        const initialDateString = activeTabButton.id.replace('-tab', '').replace('date-', '');
        const initialPaneId = activeTabButton.getAttribute('data-bs-target').substring(1);
        loadMatchesForDate(initialDateString, initialPaneId);
    } else { console.warn('No active date tab found on initial load.'); }
    
    setupLogoutButton();
    setupFilterButtons(); // Para el dropdown de ligas
    // Ya no llamamos a setupSportFilterButtons()
    setupTeamSearch();    
});