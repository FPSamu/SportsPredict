const API_BASE_URL = 'http://localhost:5000/api';


let activeFilters = {
    sport: null,       
    leagueId: null,    
    teamId: null,    
    favoritesOnly: false 
};
let userFavorites = []; 


const leagueMappings = {
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
 * @returns {string|null}
 */
function getAuthToken() {
    return localStorage.getItem('authToken');
}

/**
 * Función genérica para realizar llamadas fetch al backend API.
 * @param {string} endpoint El endpoint de la API (ej. '/matches/upcoming').
 * @param {string} [method='GET'] El método HTTP.
 * @param {object|null} [body=null] El cuerpo de la petición para POST/PUT.
 * @returns {Promise<object|null>} La respuesta JSON de la API o null en caso de error.
 */
async function fetchData(endpoint, method = 'GET', body = null) {
    const authToken = getAuthToken();
    if (!authToken) {
        console.error('No auth token found. auth-guard.js debería redirigir.');
        return null;
    }

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };

    const config = {
        method: method,
        headers: headers
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        if (!response.ok) {
            if (response.status === 401) {
                console.error('Unauthorized (401). Token inválido o expirado. Redirigiendo a login...');
                localStorage.removeItem('authToken');
                localStorage.removeItem('userInfo');
                window.location.href = 'login.html';
            }
            throw new Error(`HTTP error! status: ${response.status}, message: ${await response.text()}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}

/**
 * Genera las pestañas de navegación por fecha dinámicamente.
 */
function generateDateTabs() {
    const dateTabContainer = document.getElementById('dateTab');
    const tabContentContainer = document.getElementById('dateTabContent');
    
    if (!dateTabContainer || !tabContentContainer) {
        console.error('Date tab containers not found in HTML.');
        return;
    }
    dateTabContainer.innerHTML = ''; 
    tabContentContainer.innerHTML = ''; 


    const today = new Date();
    today.setHours(0,0,0,0); 
    const daysInPast = 3; 
    const daysInFuture = 7; 

    let datesToDisplay = [];

    for (let i = daysInPast; i >= 1; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        datesToDisplay.push(date);
    }
    datesToDisplay.push(today);
    for (let i = 1; i <= daysInFuture -1; i++) { 
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        datesToDisplay.push(date);
    }
    
    datesToDisplay.forEach(date => {
        const isActive = date.toDateString() === today.toDateString();
        addDateTab(date, dateTabContainer, tabContentContainer, isActive);
    });
}

/**
 * Añade una pestaña de fecha individual y su panel de contenido.
 */
function addDateTab(date, navContainer, contentContainer, isActive) {
    const dateString = date.toISOString().split('T')[0]; 
    const dayNamesShort = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const monthNamesShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    
    const displayDate = `${dayNamesShort[date.getDay()]} ${date.getDate()} ${monthNamesShort[date.getMonth()]}`;
    const tabId = `date-${dateString}-tab`;
    const paneId = `date-${dateString}-pane`;

    const navItem = document.createElement('li');
    navItem.className = 'nav-item';
    navItem.setAttribute('role', 'presentation');

    const button = document.createElement('button');
    button.className = `nav-link ${isActive ? 'active' : ''}`;
    button.id = tabId;
    button.setAttribute('data-bs-toggle', 'pill');
    button.setAttribute('data-bs-target', `#${paneId}`);
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', paneId);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    button.textContent = displayDate + (date.toDateString() === new Date(new Date().setHours(0,0,0,0)).toDateString() ? ' (Hoy)' : '');
    
    button.addEventListener('click', () => loadMatchesForDate(dateString, paneId));

    navItem.appendChild(button);
    navContainer.appendChild(navItem);

    const tabPane = document.createElement('div');
    tabPane.className = `tab-pane fade ${isActive ? 'show active' : ''}`;
    tabPane.id = paneId;
    tabPane.setAttribute('role', 'tabpanel');
    tabPane.setAttribute('aria-labelledby', tabId);
    contentContainer.appendChild(tabPane);
}

/**
 * MODIFICADO: Carga y renderiza los partidos para una fecha específica, aplicando filtros.
 */
async function loadMatchesForDate(dateString, paneId) {
    const targetPane = document.getElementById(paneId);
    if (!targetPane) {
        console.error(`Pane with id ${paneId} not found.`);
        return;
    }
    targetPane.innerHTML = `<div class="text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div><p class="mt-2">Cargando partidos para ${dateString}...</p></div>`;

    const selectedDate = new Date(dateString + 'T00:00:00Z');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let endpoint;
    let params = new URLSearchParams();
    // Siempre pedimos un rango, el filtrado de fecha exacta se hace en frontend.
    // El backend usa 'days' para indicar el rango desde HOY.
    // Si es una fecha pasada, days indica cuántos días hacia atrás desde hoy.
    // Si es futura (o hoy), days indica cuántos días hacia adelante desde hoy.
    // Usaremos un valor fijo y filtraremos por `dateString` en el frontend.
    params.append('days', '7'); 


    if (selectedDate < today) {
        endpoint = '/matches/recent';
    } else { 
        endpoint = '/matches/upcoming';
    }

    // NUEVO: Aplicar filtros de la variable global activeFilters a los parámetros de la API
    if (activeFilters.sport) {
        params.append('sport', activeFilters.sport);
    }
    if (activeFilters.leagueId) { // Solo si leagueId está presente y no es null
        params.append('leagueId', activeFilters.leagueId);
    }
    // El filtro de favoritesOnly se aplicará en el frontend.

    const url = `${endpoint}?${params.toString()}`;
    console.log("Fetching matches from:", url); // Para depuración
    const result = await fetchData(url);

    if (result && result.data) {
        let matchesData = result.data;

        // 1. Filtrar por fecha específica (ya que pedimos un rango)
        matchesData = matchesData.filter(match => {
            const matchDateOnly = new Date(match.matchDate).toISOString().split('T')[0];
            return matchDateOnly === dateString;
        });

        // 2. NUEVO: Filtrar por favoritos (si está activo)
        if (activeFilters.favoritesOnly) {
            if (userFavorites.length === 0) { // Cargar favoritos si aún no se han cargado
                await fetchUserFavorites();
            }
            matchesData = matchesData.filter(match => {
                return userFavorites.some(fav => 
                    (fav.apiTeamId.toString() === match.teams.home.apiTeamId.toString() || fav.apiTeamId.toString() === match.teams.away.apiTeamId.toString()) &&
                    fav.sport.toLowerCase() === match.sport.toLowerCase()
                );
            });
        }
        
        renderMatches(matchesData, paneId, dateString);
    } else {
        const displayDateObj = new Date(dateString + 'T00:00:00Z');
        const dayNamesLong = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        const monthNamesLong = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        let formattedDateTitle = `${dayNamesLong[displayDateObj.getUTCDay()]}, ${displayDateObj.getUTCDate()} de ${monthNamesLong[displayDateObj.getUTCMonth()]} ${displayDateObj.getUTCFullYear()}`;
        if (dateString === new Date(new Date().setUTCHours(0,0,0,0)).toISOString().split('T')[0]) {
            formattedDateTitle += " (Hoy)";
        }
        targetPane.innerHTML = `<h3 class="text-center text-primary mb-4">${formattedDateTitle}</h3>
                                <div class="text-center p-5 no-matches-placeholder">
                                    <i class="bi bi-calendar-x fs-1 text-muted mb-3"></i>
                                    <p class="text-muted mb-0">No se pudieron cargar los partidos o no hay partidos para este día${activeFilters.leagueId || activeFilters.sport || activeFilters.favoritesOnly ? ' con los filtros aplicados' : ''}.</p>
                                </div>`;
    }
}

/**
 * Renderiza la lista de partidos en el contenedor especificado.
 */
function renderMatches(matches, containerId, dateString) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const displayDateObj = new Date(dateString + 'T00:00:00Z'); 
    const dayNamesLong = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const monthNamesLong = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    let formattedDateTitle = `${dayNamesLong[displayDateObj.getUTCDay()]}, ${displayDateObj.getUTCDate()} de ${monthNamesLong[displayDateObj.getUTCMonth()]} ${displayDateObj.getUTCFullYear()}`;
    
    const todayNormalized = new Date();
    todayNormalized.setUTCHours(0,0,0,0);
    if (displayDateObj.getTime() === todayNormalized.getTime()) {
        formattedDateTitle += " (Hoy)";
    }

    container.innerHTML = `<h3 class="text-center text-primary mb-4">${formattedDateTitle}</h3>`;

    if (!matches || matches.length === 0) {
        container.innerHTML += `
            <div class="text-center p-5 no-matches-placeholder">
                <i class="bi bi-calendar-x fs-1 text-muted mb-3"></i>
                <p class="text-muted mb-0">No hay partidos programados para este día${activeFilters.leagueId || activeFilters.sport || activeFilters.favoritesOnly ? ' con los filtros aplicados' : ''}.</p>
            </div>`;
        return;
    }

    const row = document.createElement('div');
    row.className = 'row g-3';

    matches.forEach(match => {
        const col = document.createElement('div');
        col.className = 'col-lg-6 col-md-12'; 

        let statusDisplay = '';
        let scoreDisplay = '<div class="col-2 match-score-status text-center text-muted fw-bold small">VS</div>';

        const matchDateTime = new Date(match.matchDate);
        const matchTime = matchDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        switch (match.status ? match.status.toUpperCase() : 'UNKNOWN') {
            case 'FINISHED': case 'FT': case 'AET':
                statusDisplay = `<span class="status-finished">Finalizado</span>`;
                scoreDisplay = `<div class="col-2 match-score-status match-score">${match.scores.home} - ${match.scores.away}</div>`;
                break;
            case 'LIVE': case 'IN_PLAY': case '1H': case 'HT': case '2H': case 'ET': case 'PEN_LIVE':
                statusDisplay = `<span class="status-live"><i class="bi bi-broadcast-pin me-1"></i>EN VIVO</span>`;
                if (match.scores && typeof match.scores.home !== 'undefined' && match.scores.home !== null) {
                    scoreDisplay = `<div class="col-2 match-score-status match-score">${match.scores.home} - ${match.scores.away}</div>`;
                } else {
                     scoreDisplay = `<div class="col-2 match-score-status text-center text-muted small">EN VIVO</div>`
                }
                break;
            case 'SCHEDULED': case 'TIMED': case 'NS': case 'POSTPONED':
                 statusDisplay = `<span class="status-scheduled">${matchTime}</span>`;
                 if (match.status.toUpperCase() === 'POSTPONED') {
                    statusDisplay = `<span class="status-postponed">Pospuesto</span>`;
                 }
                break;
            default:
                statusDisplay = `<span class="status-other text-capitalize">${match.status || 'Desconocido'}</span>`;
                break;
        }
        
        let sportIcon = '<i class="bi bi-trophy me-2"></i>';
        if (match.sport && match.sport.toLowerCase() === 'football') {
            sportIcon = '<i class="bi bi-futbol me-2"></i>'; 
        } else if (match.sport && match.sport.toLowerCase() === 'basketball') {
            sportIcon = '<i class="bi bi-dribbble me-2"></i>';
        }
        
        if (match.league && match.league.name && match.league.name.toLowerCase().includes('champions league')) {
             sportIcon = '<i class="bi bi-stars me-2"></i>';
        }

        col.innerHTML = `
            <div class="card bg-dark text-light match-card h-100 hover-card" data-match-id="${match._id || match.id }">
                <div class="card-header d-flex justify-content-between align-items-center small">
                    <span class="text-truncate" title="${match.league.name || 'Liga Desconocida'}">${sportIcon}${match.league.name || 'Liga Desconocida'}</span>
                    ${statusDisplay}
                </div>
                <div class="card-body">
                    <div class="row align-items-center gx-2">
                        <div class="col-5 text-end">
                            <div class="team-info justify-content-end align-items-center">
                                <span class="team-name text-truncate" title="${match.teams.home.name}">${match.teams.home.name}</span>
                                <img src="${match.teams.home.logo || 'https://via.placeholder.com/40?text=L'}" class="rounded-circle team-logo p-1 ms-2" alt="${match.teams.home.name}" style="width: 40px; height: 40px; object-fit: contain;">
                            </div>
                        </div>
                        ${scoreDisplay}
                        <div class="col-5">
                            <div class="team-info align-items-center">
                                <img src="${match.teams.away.logo || 'https://via.placeholder.com/40?text=L'}" class="rounded-circle team-logo p-1 me-2" alt="${match.teams.away.name}" style="width: 40px; height: 40px; object-fit: contain;">
                                <span class="team-name text-truncate" title="${match.teams.away.name}">${match.teams.away.name}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        row.appendChild(col);
    });
    container.appendChild(row);
}

/**
 * Configura el botón de logout.
 */
function setupLogoutButton() {
    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener('click', () => {
            // Reemplaza esta sección con tu lógica real de Firebase si es necesario
            // Actualmente, el logout de Firebase se está intentando/manejando en firebase-config.js o dashboard-script.js
            // según los errores previos. Aquí solo limpiamos localmente como fallback.
            try {
                if (typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function') { // Verifica si firebase.auth es una función
                     firebase.auth().signOut().then(() => {
                        console.log('User signed out successfully from Firebase.');
                        localStorage.removeItem('authToken');
                        localStorage.removeItem('userInfo'); 
                        window.location.href = 'login.html'; 
                    }).catch((error) => {
                        console.error('Firebase sign out error:', error);
                        localStorage.removeItem('authToken');
                        localStorage.removeItem('userInfo');
                        window.location.href = 'login.html';
                    });
                } else {
                    console.warn('Firebase auth object not available or not a function for logout. Cleaning up locally.');
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('userInfo');
                    window.location.href = 'login.html';
                }
            } catch (e) {
                console.error("Error during logout process:", e);
                localStorage.removeItem('authToken');
                localStorage.removeItem('userInfo');
                window.location.href = 'login.html';
            }
        });
    } else {
        console.warn('Botón de logout (confirmLogoutBtn) no encontrado.');
    }
}

// --- NUEVAS FUNCIONES PARA FILTROS Y BÚSQUEDA ---

/**
 * Obtiene y almacena los equipos favoritos del usuario desde la API.
 */
async function fetchUserFavorites() {
    const result = await fetchData('/users/me/favorites'); // Endpoint del PDF
    if (result && Array.isArray(result)) {
        userFavorites = result;
        console.log('Favoritos del usuario cargados:', userFavorites);
    } else {
        console.error('No se pudieron cargar los favoritos o el formato es incorrecto.');
        userFavorites = []; 
    }
}

/**
 * Configura los listeners para los botones de filtro del dropdown.
 */
function setupFilterButtons() {
    const filterDropdownItems = document.querySelectorAll('.dropdown-menu .dropdown-item'); // Selector más específico para los items del filtro
    
    if (filterDropdownItems.length === 0) {
        console.warn('Items del dropdown de filtros no encontrados. Asegúrate que tu HTML tiene items con la clase "dropdown-item" dentro de un elemento con clase "dropdown-menu".');
        return;
    }

    filterDropdownItems.forEach(item => {
        item.addEventListener('click', async (event) => {
            event.preventDefault(); // Prevenir cualquier acción por defecto del link/botón
            const filterName = event.target.textContent.trim();
            const filterConfig = leagueMappings[filterName]; // Busca en el objeto de mapeos

            console.log(`Filtro seleccionado: ${filterName}`);

            if (filterConfig) {
                activeFilters.leagueId = filterConfig.leagueId;
                activeFilters.sport = filterConfig.sport; // Puede ser null si el filtro no es específico de deporte
                activeFilters.favoritesOnly = !!filterConfig.favoritesOnly;
            } else {
                console.warn(`Configuración de filtro no encontrada para: ${filterName}. Se mostrarán todos.`);
                activeFilters.leagueId = null;
                activeFilters.sport = null;
                activeFilters.favoritesOnly = false;
            }

            // Si se selecciona "Favorites" y no se han cargado, cargarlos ahora.
            if (activeFilters.favoritesOnly && userFavorites.length === 0) {
               await fetchUserFavorites();
            }

            // Volver a cargar los partidos para la pestaña de fecha activa actual con los nuevos filtros
            const activeDateTabButton = document.querySelector('#dateTab .nav-link.active');
            if (activeDateTabButton) {
                const dateString = activeDateTabButton.id.replace('-tab', '').replace('date-', '');
                const paneId = activeDateTabButton.getAttribute('data-bs-target').substring(1);
                loadMatchesForDate(dateString, paneId);
            } else {
                console.warn("No hay pestaña de fecha activa para recargar con filtros.");
            }
        });
    });
}

/**
 * Configura la funcionalidad de búsqueda de equipos.
 * ¡IMPORTANTE! Esta función asume un endpoint de backend /api/teams/search?name=QUERY
 * que debe ser implementado. Si no existe, la búsqueda no traerá resultados del backend.
 */
function setupTeamSearch() {
    const searchInput = document.getElementById('teamSearchInput');
    const searchResultsContainer = document.getElementById('searchResults');
    
    if (!document.getElementById('offcanvasSearch')) {
        console.warn('Offcanvas para búsqueda no encontrado.');
        return;
    }
    const offcanvasSearchInstance = new bootstrap.Offcanvas(document.getElementById('offcanvasSearch'));

    if (!searchInput || !searchResultsContainer) {
        console.warn('Elementos de UI para búsqueda de equipo (searchInput o searchResultsContainer) no encontrados.');
        return;
    }

    let searchTimeout;
    searchInput.addEventListener('input', (event) => {
        clearTimeout(searchTimeout);
        const query = event.target.value.trim();

        if (query.length < 3) {
            searchResultsContainer.innerHTML = '<p class="text-muted p-3 small">Escribe al menos 3 caracteres.</p>';
            return;
        }

        searchResultsContainer.innerHTML = '<div class="p-3 text-center"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Buscando...</span></div></div>';

        searchTimeout = setTimeout(async () => {
            // ASUNCIÓN CRÍTICA: Endpoint /api/teams/search?name=query. El PDF indica /teams?sport...&leagueId... como "Por Implementar".
            // Este endpoint es necesario para una búsqueda de equipos real.
            const searchApiEndpoint = `/teams/search?name=${encodeURIComponent(query)}`; 
            console.log("Buscando equipos con endpoint:", searchApiEndpoint);
            const response = await fetchData(searchApiEndpoint); // fetchData ya añade /api

            searchResultsContainer.innerHTML = ''; 
            if (response && response.data && response.data.length > 0) {
                response.data.forEach(team => {
                    const teamElement = document.createElement('a');
                    teamElement.href = '#'; 
                    teamElement.className = 'list-group-item list-group-item-action bg-dark text-light d-flex align-items-center py-2';
                    teamElement.innerHTML = `
                        <img src="${team.logoUrl || 'https://via.placeholder.com/30?text=L'}" alt="${team.name}" class="rounded-circle me-3" style="width: 30px; height: 30px; object-fit: contain;">
                        <span class="flex-grow-1">${team.name} <small class="text-muted">(${team.sport || 'Deporte desc.'})</small></span>
                    `;
                    teamElement.addEventListener('click', (e) => {
                        e.preventDefault();
                        console.log('Equipo seleccionado para filtrar (implementación pendiente):', team);
                        
                        // QUÉ HACER AQUÍ:
                        // 1. Cerrar el offcanvas.
                        // 2. Limpiar el input de búsqueda y los resultados.
                        // 3. Idealmente, filtrar los partidos para mostrar solo los de este equipo.
                        //    Esto es complejo con la API actual de /matches, que no toma teamId.
                        //    - Podrías tener un endpoint /api/teams/:teamId/matches.
                        //    - O filtrar en el frontend, pero necesitarías una estrategia para cargar suficientes partidos.
                        //    - O podrías redirigir a una página de detalles del equipo si la tienes.
                        
                        alert(`Has seleccionado ${team.name}. La funcionalidad para mostrar solo sus partidos aún no está completamente implementada en el frontend con la API de partidos actual.`);
                        
                        // Ejemplo: Intentar filtrar los partidos actuales por el deporte del equipo y recargar la fecha actual
                        activeFilters.sport = team.sport;
                        activeFilters.leagueId = null; // Limpiar filtro de liga para ver todos los partidos de ese deporte
                        activeFilters.favoritesOnly = false;
                        
                        const activeDateTabButton = document.querySelector('#dateTab .nav-link.active');
                        if (activeDateTabButton) {
                            const dateString = activeDateTabButton.id.replace('-tab', '').replace('date-', '');
                            const paneId = activeDateTabButton.getAttribute('data-bs-target').substring(1);
                            // Aquí necesitarías una forma de decirle a loadMatchesForDate que también filtre por team.apiTeamId
                            // o que renderMatches lo haga. Es una capa adicional de filtrado en cliente.
                            console.log(`Se recargarán partidos para ${dateString}, deporte: ${team.sport}. Filtrado específico por equipo (${team.name}) requerirá lógica adicional en renderMatches o un nuevo endpoint.`);
                            loadMatchesForDate(dateString, paneId); // Esto recargará, pero no filtrará por equipo todavía.
                        }

                        if(offcanvasSearchInstance) offcanvasSearchInstance.hide();
                        searchInput.value = ''; 
                        searchResultsContainer.innerHTML = '';
                    });
                    searchResultsContainer.appendChild(teamElement);
                });
            } else if (response && response.data && response.data.length === 0) {
                searchResultsContainer.innerHTML = '<p class="text-muted p-3">No se encontraron equipos con ese nombre.</p>';
            } else {
                 searchResultsContainer.innerHTML = '<p class="text-danger p-3">Error al buscar equipos. Es posible que el endpoint de búsqueda no esté disponible en el backend.</p>';
            }
        }, 500);
    });
}


// --- INICIALIZACIÓN CUANDO EL DOM ESTÁ LISTO ---
document.addEventListener('DOMContentLoaded', async () => { // Hacer async para await fetchUserFavorites
    if (!getAuthToken() && window.location.pathname.includes('matches.html')) {
        console.warn('No auth token found on matches.html, auth-guard should have redirected.');
        return;
    }

    // Primero, cargar datos necesarios como los favoritos
    await fetchUserFavorites(); 

    generateDateTabs(); // Luego generar UI dependiente

    // Cargar partidos para la pestaña activa inicial
    const activeTabButton = document.querySelector('#dateTab .nav-link.active');
    if (activeTabButton) {
        const initialDateString = activeTabButton.id.replace('-tab', '').replace('date-', '');
        const initialPaneId = activeTabButton.getAttribute('data-bs-target').substring(1);
        loadMatchesForDate(initialDateString, initialPaneId);
    } else {
        console.warn('No active date tab found on initial load.');
    }

    setupLogoutButton();
    setupFilterButtons(); // NUEVO
    setupTeamSearch();    // NUEVO
});