const API_BASE_URL_TRENDING = 'http://localhost:5000/api';

const topTeamConfigs = [
    { apiTeamId: 86, sport: 'Football', name: 'FC Barcelona' },
    { apiTeamId: 81, sport: 'Football', name: 'Real Madrid CF' },
    { apiTeamId: 92, sport: 'Football', name: 'Sevilla FC' },
    { apiTeamId: 65, sport: 'Football', name: 'Manchester City FC' },
    { apiTeamId: 64, sport: 'Football', name: 'Liverpool FC' },
    { apiTeamId: 57, sport: 'Football', name: 'Arsenal FC' },
    { apiTeamId: 108, sport: 'Football', name: 'Inter Milan' },
    { apiTeamId: 109, sport: 'Football', name: 'Juventus FC' },
    { apiTeamId: 100, sport: 'Football', name: 'AC Milan' },
    { apiTeamId: 529, sport: 'Football', name: 'Paris Saint-Germain FC' },
    { apiTeamId: 524, sport: 'Football', name: 'Olympique Lyonnais' },
    { apiTeamId: 548, sport: 'Football', name: 'AS Monaco FC'},
    { apiTeamId: 5, sport: 'Football', name: 'FC Bayern München' },
    { apiTeamId: 4, sport: 'Football', name: 'Borussia Dortmund' },
    { apiTeamId: 18, sport: 'Football', name: 'Bayer 04 Leverkusen'},

    { apiTeamId: 2, sport: 'Basketball', name: 'Boston Celtics' },
    { apiTeamId: 6, sport: 'Basketball', name: 'Cleveland Cavaliers' }, 
    { apiTeamId: 14, sport: 'Basketball', name: 'Los Angeles Lakers' },
    { apiTeamId: 10, sport: 'Basketball', name: 'Golden State Warriors' },
    { apiTeamId: 21, sport: 'Basketball', name: 'Oklahoma City Thunder' },
    { apiTeamId: 8, sport: 'Basketball', name: 'Denver Nuggets' }      
];

const leagueMappingsTrending = {
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

let activeTrendingFilters = {
    sport: null,
    leagueId: null,
    favoritesOnly: false,
    searchedTeam: null
};
let userFavoritesTrending = [];

function getAuthTokenTrending() { return localStorage.getItem('authToken'); }

async function fetchDataTrending(endpoint, method = 'GET', body = null) {
    const authToken = getAuthTokenTrending();
    if (!authToken) { console.error('Trending: No auth token.'); window.location.href = 'login.html'; return null; }
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` };
    const config = { method, headers };
    if (body && (method === 'POST' || method === 'PUT' || method === 'DELETE')) { config.body = JSON.stringify(body); }
    try {
        const response = await fetch(`${API_BASE_URL_TRENDING}${endpoint}`, config);
        if (!response.ok) {
            if (response.status === 401) { console.error('Trending: Unauthorized (401).'); localStorage.removeItem('authToken'); localStorage.removeItem('userInfo'); window.location.href = 'login.html'; }
            throw new Error(`HTTP error! status: ${response.status}, message: ${await response.text()}`);
        }
        return await response.json();
    } catch (error) { console.error('Trending: Error fetching data:', error); return null; }
}

async function fetchUserFavoritesTrending() {
    const result = await fetchDataTrending('/users/me/favorites');
    if (result && Array.isArray(result)) { userFavoritesTrending = result; console.log('Trending: User favorites loaded.'); } 
    else { userFavoritesTrending = []; console.error('Trending: Failed to load user favorites or format is incorrect.'); }
}

function createTrendingMatchCardHTML(match) {
    if (!match || !match.teams || !match.teams.home || !match.teams.away || !match.league) {
        console.warn('Datos incompletos para renderizar tarjeta de partido trending:', match);
        return '';
    }
    let statusDisplay = ''; let scoreOrTime = '-- : --'; let statusDetails = '';
    const matchDateTime = new Date(match.matchDate);
    switch (match.status ? match.status.toUpperCase() : 'UNKNOWN') {
        case 'LIVE': case 'IN_PLAY': case '1H': case 'HT': case '2H': case 'ET': case 'PEN_LIVE':
            statusDisplay = `<small class="text-danger fw-bold"><i class="bi bi-broadcast me-1"></i> LIVE</small>`;
            scoreOrTime = `${match.scores?.home ?? '?'} - ${match.scores?.away ?? '?'}`;
            if (match.status.toUpperCase() === 'HT') { statusDetails = `<small class="match-status">Medio Tiempo</small>`; } 
            else { statusDetails = `<small class="match-status">${match.minute ? `Minuto: ${match.minute}'` : 'En vivo'}</small>`;}
            break;
        case 'SCHEDULED': case 'TIMED': case 'NS':
            statusDisplay = `<small class="text-warning fw-bold"><i class="bi bi-clock-history me-1"></i> Próximo</small>`;
            scoreOrTime = `${matchDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
            statusDetails = `<small class="match-status">${matchDateTime.toLocaleDateString([], { day: 'numeric', month: 'short' })}</small>`;
            break;
        case 'FINISHED': case 'FT': case 'AET':
            statusDisplay = `<small class="text-success fw-bold"><i class="bi bi-check-circle me-1"></i> Finalizado</small>`;
            scoreOrTime = `${match.scores?.home ?? '?'} - ${match.scores?.away ?? '?'}`;
            statusDetails = `<small class="match-status">${matchDateTime.toLocaleDateString([], { day: 'numeric', month: 'short' })}</small>`;
            break;
        default:
            statusDisplay = `<small class="text-muted">${match.status || 'Desconocido'}</small>`;
            scoreOrTime = `${matchDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
            statusDetails = `<small class="match-status">${matchDateTime.toLocaleDateString([], { day: 'numeric', month: 'short' })}</small>`;
            break;
    }
    let leagueBadgeColor = "bg-secondary";
    if (match.league.name) {
        if (match.league.name.toLowerCase().includes("nba")) leagueBadgeColor = "bg-info";
        else if (match.league.name.toLowerCase().includes("premier league")) leagueBadgeColor = "bg-primary";
        else if (match.league.name.toLowerCase().includes("champions league")) leagueBadgeColor = "bg-warning text-dark";
    }
    return `
        <div class="col-md-6 col-lg-4">
            <div class="card h-100 bg-dark text-light shadow-sm hover-card trending-card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <span class="badge ${leagueBadgeColor} rounded-pill text-truncate" title="${match.league.name || ''}">${match.league.name || 'Liga Desconocida'}</span>
                    ${statusDisplay}
                </div>
                <div class="card-body text-center">
                    <div class="d-flex justify-content-around align-items-center mb-3">
                        <div class="text-center team-container">
                            <img src="${match.teams.home.logo || 'https://via.placeholder.com/60?text=L'}" class="rounded-circle team-logo p-1" alt="${match.teams.home.name || 'Local'}">
                            <p class="mt-2 mb-0 team-name text-truncate" title="${match.teams.home.name || ''}">${match.teams.home.name || 'Local'}</p>
                        </div>
                        <div class="text-light-emphasis fw-bold display-6 align-self-center">VS</div>
                        <div class="text-center team-container">
                            <img src="${match.teams.away.logo || 'https://via.placeholder.com/60?text=V'}" class="rounded-circle team-logo p-1" alt="${match.teams.away.name || 'Visitante'}">
                            <p class="mt-2 mb-0 team-name text-truncate" title="${match.teams.away.name || ''}">${match.teams.away.name || 'Visitante'}</p>
                        </div>
                    </div>
                    <h4 class="match-score mb-1">${scoreOrTime}</h4>
                    ${statusDetails}
                </div>
            </div>
        </div>`;
}
// ... (después de createTrendingMatchCardHTML) ...

function isTeamFavoriteTrending(apiTeamId, sport) {
    if (!userFavoritesTrending || userFavoritesTrending.length === 0) return false;
    return userFavoritesTrending.some(fav => 
        fav.apiTeamId?.toString() === apiTeamId?.toString() && 
        fav.sport?.toLowerCase() === sport?.toLowerCase()
    );
}

async function toggleFavoriteTeamTrending(team, starIcon) {
    if (!team || !team.apiTeamId || !team.sport) {
        console.error("Trending: Datos incompletos del equipo para favorito:", team);
        return;
    }
    const currentlyFavorite = isTeamFavoriteTrending(team.apiTeamId, team.sport);
    const method = currentlyFavorite ? 'DELETE' : 'POST';
    const endpoint = '/users/me/favorites'; // Endpoint global de favoritos
    const body = { apiTeamId: team.apiTeamId, sport: team.sport };
    const response = await fetchDataTrending(endpoint, method, body);

    if (response && response.favorites) {
        userFavoritesTrending = response.favorites;
        console.log('Trending: Favoritos actualizados:', userFavoritesTrending);
        if (isTeamFavoriteTrending(team.apiTeamId, team.sport)) {
            starIcon.classList.remove('bi-star');
            starIcon.classList.add('bi-star-fill', 'text-warning');
            starIcon.setAttribute('title', 'Quitar de favoritos');
        } else {
            starIcon.classList.remove('bi-star-fill', 'text-warning');
            starIcon.classList.add('bi-star');
            starIcon.setAttribute('title', 'Añadir a favoritos');
        }
        // Si el filtro "Favorites" está activo, recargar
        if (activeTrendingFilters.favoritesOnly) {
            loadTrendingMatches();
        }
    } else {
        alert(`Hubo un error al actualizar tus favoritos.`);
    }
}

// ... (después de toggleFavoriteTeamTrending) ...

/**
 * Actualiza el texto del botón del dropdown de filtros de liga.
 * @param {string} [text=null] - El texto a mostrar. Si es null, usa el texto por defecto.
 */
function updateLeagueDropdownButtonTextTrending(text = null) {
    const leagueFilterSection = document.querySelector('h2.text-light + .dropdown'); // Selector para trending.html
    const leagueDropdownButton = leagueFilterSection ? leagueFilterSection.querySelector('.dropdown-toggle.btn-sm') : null;
    if (leagueDropdownButton) {
        if (text) {
            leagueDropdownButton.textContent = text;
        } else {
            leagueDropdownButton.innerHTML = '<i class="bi bi-filter me-1"></i>Filter';
        }
    }
}


function setupTeamSearchTrending() {
    console.log("DEBUG: setupTeamSearchTrending() se está ejecutando.");
    const searchInput = document.getElementById('teamSearchInput'); // Asume el mismo ID que en matches.html
    const searchResultsContainer = document.getElementById('searchResults');
    const offcanvasElement = document.getElementById('offcanvasSearch');
    const offcanvasSearchInstance = offcanvasElement ? (bootstrap.Offcanvas.getInstance(offcanvasElement) || new bootstrap.Offcanvas(offcanvasElement)) : null;

    if (!searchInput || !searchResultsContainer) { console.warn('Trending Search: Elementos UI no encontrados.'); return; }
    console.log("DEBUG: Trending Search: Elementos (input y results container) encontrados.");

    let searchTimeout;
    searchInput.addEventListener('input', (event) => {
        clearTimeout(searchTimeout);
        const query = event.target.value.trim();
        if (query.length < 3) { searchResultsContainer.innerHTML = '<p class="text-muted p-3 small">Escribe al menos 3 caracteres.</p>'; return; }
        searchResultsContainer.innerHTML = '<div class="p-3 text-center"><div class="spinner-border spinner-border-sm" role="status"><span class="visually-hidden">Buscando...</span></div></div>';

        searchTimeout = setTimeout(async () => {
            let searchApiEndpoint = `/teams/search?name=${encodeURIComponent(query)}`;
            // Opcional: Añadir filtro de deporte si está activo en los pills
            if (activeTrendingFilters.sport) {
                searchApiEndpoint += `&sport=${encodeURIComponent(activeTrendingFilters.sport)}`;
            }
            console.log("Trending Search: Buscando equipos con endpoint:", API_BASE_URL_TRENDING + searchApiEndpoint);
            const response = await fetchDataTrending(searchApiEndpoint); 
            searchResultsContainer.innerHTML = ''; 
            if (response && response.data && response.data.length > 0) {
                response.data.forEach(team => { // team debe tener {apiTeamId, name, sport, logoUrl}
                    const isFav = isTeamFavoriteTrending(team.apiTeamId, team.sport);
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
                        console.log('Trending Search: Equipo seleccionado:', team);
                        activeTrendingFilters.searchedTeam = { apiTeamId: team.apiTeamId, name: team.name, sport: team.sport };
                        activeTrendingFilters.sport = team.sport; // Forzar el filtro de deporte al del equipo buscado
                        activeTrendingFilters.leagueId = null;      
                        activeTrendingFilters.favoritesOnly = false; 
                        
                        updateLeagueDropdownButtonTextTrending(`${team.name}`); // Mostrar nombre del equipo en el botón de filtro
                        // Actualizar UI de botones pill de deporte
                        const sportButtonsContainer = document.querySelector('div.filter-container');
                        if(sportButtonsContainer){
                            const sportButtons = sportButtonsContainer.querySelectorAll('button');
                            sportButtons.forEach(btn => {
                                btn.classList.remove('btn-primary', 'text-white'); btn.classList.add('btn-outline-light');
                                const btnTextLower = btn.textContent.trim().toLowerCase();
                                if (team.sport === 'Football' && btnTextLower.includes('futbol')) { btn.classList.add('btn-primary', 'text-white'); btn.classList.remove('btn-outline-light');} 
                                else if (team.sport === 'Basketball' && btnTextLower.includes('basketball')) { btn.classList.add('btn-primary', 'text-white'); btn.classList.remove('btn-outline-light');}
                            });
                        }
                        
                        loadTrendingMatches(); // Recargar la vista de trending

                        if(offcanvasSearchInstance) offcanvasSearchInstance.hide();
                        searchInput.value = ''; 
                        searchResultsContainer.innerHTML = '';
                    });

                    starIcon.addEventListener('click', (e) => {
                        e.stopPropagation(); 
                        toggleFavoriteTeamTrending(team, starIcon);
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

async function getNClosestUpcomingTopMatchesForSport(specificSportTopTeams, sportName, count, excludeMatchIdsSet, activeLeagueId, daysToFetch = 14) {
    if (!specificSportTopTeams || specificSportTopTeams.length === 0) return [];
    let params = new URLSearchParams();
    params.append('days', daysToFetch.toString());
    params.append('sport', sportName);
    const relevantLeagueFilter = Object.values(leagueMappingsTrending).find(mapping => mapping.leagueId === activeLeagueId);
    if (activeLeagueId && relevantLeagueFilter && relevantLeagueFilter.sport === sportName) {
        params.append('leagueId', activeLeagueId);
    }
    const response = await fetchDataTrending(`/matches/upcoming?${params.toString()}`);
    let topTeamMatches = [];
    if (response && response.data) {
        topTeamMatches = response.data.filter(match => {
            const isTopTeam = specificSportTopTeams.some(topTeam =>
                (topTeam.apiTeamId.toString() === match.teams.home.apiTeamId?.toString() ||
                 topTeam.apiTeamId.toString() === match.teams.away.apiTeamId?.toString())
            );
            const status = match.status ? match.status.toUpperCase() : '';
            return isTopTeam && !excludeMatchIdsSet.has(match._id || match.id) && ['SCHEDULED', 'TIMED', 'NS'].includes(status);
        });
    }
    topTeamMatches.sort((a, b) => new Date(a.matchDate) - new Date(b.matchDate));
    return topTeamMatches.slice(0, count);
}

// En trending-script.js

async function loadTrendingMatches() {
    console.log("DEBUG: loadTrendingMatches() llamada con filtros:", JSON.parse(JSON.stringify(activeTrendingFilters)));
    const trendingMatchesContainer = document.getElementById('trending-matches');
    if (!trendingMatchesContainer) { console.error("Trending: Contenedor 'trending-matches' no encontrado."); return; }
    trendingMatchesContainer.innerHTML = `<div class="col-12 text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Cargando...</span></div><p class="mt-2">Cargando partidos trending...</p></div>`;

    let finalMatchesToShow = [];
    let fetchedMatchIds = new Set(); // Para evitar duplicados

    // --- 1. Obtener Partidos "En Vivo" ---
    let liveParams = new URLSearchParams();
    if (activeTrendingFilters.sport) { // Si hay filtro de deporte, pasarlo a /trending
        liveParams.append('sport', activeTrendingFilters.sport);
    }
    // Si el backend /trending soporta leagueId y un filtro de liga está activo, se puede pasar.
    // if (activeTrendingFilters.leagueId) { liveParams.append('leagueId', activeTrendingFilters.leagueId); }

    const liveEndpoint = '/matches/trending' + (liveParams.toString() ? `?${liveParams.toString()}` : '');
    console.log("Trending: Fetching live/trending matches from", liveEndpoint);
    const trendingResponse = await fetchDataTrending(liveEndpoint); 
    
    if (trendingResponse && trendingResponse.data) {
        let potentialLiveMatches = trendingResponse.data;
        // Aplicar filtro de liga en cliente si no se envió a la API y está activo
        if (activeTrendingFilters.leagueId && !liveParams.has('leagueId')) { 
            potentialLiveMatches = potentialLiveMatches.filter(match => match.league?.apiLeagueId === activeTrendingFilters.leagueId);
        }

        potentialLiveMatches.forEach(match => {
            const status = match.status ? match.status.toUpperCase() : '';
            if (['LIVE', 'IN_PLAY', '1H', 'HT', '2H', 'ET', 'PEN_LIVE'].includes(status)) {
                if (!fetchedMatchIds.has(match._id || match.id)) {
                    finalMatchesToShow.push(match);
                    fetchedMatchIds.add(match._id || match.id);
                }
            }
        });
    }
    console.log("Trending: Partidos 'en vivo' (o de /trending filtrados como en vivo) encontrados:", finalMatchesToShow.length);

    // --- 2. Obtener Próximos Partidos (Equipos Top o Equipo Buscado) ---
    if (activeTrendingFilters.searchedTeam) {
        const searchedSport = activeTrendingFilters.searchedTeam.sport;
        // Solo mostrar partidos del equipo buscado si el filtro de deporte es "Todos" o coincide con el deporte del equipo buscado
        if (!activeTrendingFilters.sport || activeTrendingFilters.sport === searchedSport) {
            const upcomingForSearchedTeam = await getNClosestUpcomingTopMatchesForSport(
                [activeTrendingFilters.searchedTeam], // Lista con solo el equipo buscado
                searchedSport,
                2, // Los 2 más próximos
                fetchedMatchIds,
                activeTrendingFilters.leagueId // Pasa el leagueId si está activo (para filtrar aun más si es de ese equipo y esa liga)
            );
            upcomingForSearchedTeam.forEach(match => { 
                if (!fetchedMatchIds.has(match._id || match.id)) {
                    finalMatchesToShow.push(match); fetchedMatchIds.add(match._id || match.id);
                }
            });
            console.log(`Trending: Próximos para equipo buscado (${activeTrendingFilters.searchedTeam.name}) añadidos:`, upcomingForSearchedTeam.length);
        }
        // Si el filtro de deporte es "Todos" y se buscó un equipo, mostrar también los top del otro deporte
        if (!activeTrendingFilters.sport) { 
            if (searchedSport === 'Football') {
                const basketballTopTeams = topTeamConfigs.filter(t => t.sport === 'Basketball');
                const topBasketball = await getNClosestUpcomingTopMatchesForSport(basketballTopTeams, 'Basketball', 2, fetchedMatchIds, null); // Para NBA, leagueId es null en mapping general
                topBasketball.forEach(match => { if (!fetchedMatchIds.has(match._id || match.id)) { finalMatchesToShow.push(match); fetchedMatchIds.add(match._id || match.id); } });
            } else if (searchedSport === 'Basketball') {
                const footballTopTeams = topTeamConfigs.filter(t => t.sport === 'Football');
                const topFootball = await getNClosestUpcomingTopMatchesForSport(footballTopTeams, 'Football', 2, fetchedMatchIds, activeTrendingFilters.leagueId); // Aquí el leagueId podría ser de una liga de fútbol
                topFootball.forEach(match => { if (!fetchedMatchIds.has(match._id || match.id)) { finalMatchesToShow.push(match); fetchedMatchIds.add(match._id || match.id); } });
            }
        }

    } else { // Si no hay equipo buscado, mostrar top 2 de cada deporte (si el filtro lo permite)
        const footballTopTeamsFromConfig = topTeamConfigs.filter(t => t.sport === 'Football');
        if (footballTopTeamsFromConfig.length > 0 && (!activeTrendingFilters.sport || activeTrendingFilters.sport === 'Football')) {
            const topFootballUpcoming = await getNClosestUpcomingTopMatchesForSport(footballTopTeamsFromConfig, 'Football', 2, fetchedMatchIds, activeTrendingFilters.leagueId);
            topFootballUpcoming.forEach(match => { if (!fetchedMatchIds.has(match._id || match.id)) { finalMatchesToShow.push(match); fetchedMatchIds.add(match._id || match.id); } });
            console.log("Trending: Top Próximos Fútbol (general) añadidos:", topFootballUpcoming.length);
        }

        const basketballTopTeamsFromConfig = topTeamConfigs.filter(t => t.sport === 'Basketball');
        if (basketballTopTeamsFromConfig.length > 0 && (!activeTrendingFilters.sport || activeTrendingFilters.sport === 'Basketball')) {
            const topBasketballUpcoming = await getNClosestUpcomingTopMatchesForSport(basketballTopTeamsFromConfig, 'Basketball', 2, fetchedMatchIds, null); // Para NBA general, leagueId es null
            topBasketballUpcoming.forEach(match => { if (!fetchedMatchIds.has(match._id || match.id)) { finalMatchesToShow.push(match); fetchedMatchIds.add(match._id || match.id); } });
            console.log("Trending: Top Próximos Basketball (general) añadidos:", topBasketballUpcoming.length);
        }
    }
    
    // --- 3. Ordenar y Filtrar por Favoritos ---
    finalMatchesToShow.sort((a, b) => {
        const isALive = ['LIVE', 'IN_PLAY', '1H', 'HT', '2H', 'ET', 'PEN_LIVE'].includes(a.status?.toUpperCase());
        const isBLive = ['LIVE', 'IN_PLAY', '1H', 'HT', '2H', 'ET', 'PEN_LIVE'].includes(b.status?.toUpperCase());
        if (isALive && !isBLive) return -1; if (!isALive && isBLive) return 1;
        return new Date(a.matchDate) - new Date(b.matchDate);
    });

    let matchesToDisplayAfterFavorites = finalMatchesToShow;
    if (activeTrendingFilters.favoritesOnly) {
        if (userFavoritesTrending.length === 0) { await fetchUserFavoritesTrending(); }
        matchesToDisplayAfterFavorites = finalMatchesToShow.filter(match => userFavoritesTrending.some(fav =>
            (fav.apiTeamId.toString() === match.teams.home.apiTeamId?.toString() || fav.apiTeamId.toString() === match.teams.away.apiTeamId?.toString()) &&
            fav.sport.toLowerCase() === match.sport?.toLowerCase()
        ));
    }
    
    // --- 4. Renderizar ---
    trendingMatchesContainer.innerHTML = ''; 
    if (matchesToDisplayAfterFavorites.length > 0) {
        matchesToDisplayAfterFavorites.forEach(match => { trendingMatchesContainer.innerHTML += createTrendingMatchCardHTML(match); });
    } else {
        trendingMatchesContainer.innerHTML = '<div class="col-12 text-center p-5"><i class="bi bi-calendar-x fs-1 text-muted mb-3"></i><p class="text-muted">No hay partidos trending que coincidan con tus filtros.</p></div>';
    }
}

function setupSportFilterButtonsTrending() {
    console.log("DEBUG: setupSportFilterButtonsTrending() se está ejecutando.");
    const filterContainer = document.querySelector('div.filter-container'); 
    console.log("DEBUG: Sport filterContainer:", filterContainer);
    if (!filterContainer) { console.warn("Trending: Contenedor de botones de filtro de deporte no encontrado."); return; }
    
    const buttons = filterContainer.querySelectorAll('button');
    console.log("DEBUG: Sport filter buttons encontrados:", buttons.length);
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            console.log("DEBUG: Botón de filtro de DEPORTE clickeado:", button.textContent);
            buttons.forEach(btn => { btn.classList.remove('btn-primary', 'text-white'); btn.classList.add('btn-outline-light'); });
            button.classList.remove('btn-outline-light'); button.classList.add('btn-primary', 'text-white');
            
            const filterText = button.textContent.trim().toLowerCase();
            if (filterText.includes('futbol')) { activeTrendingFilters.sport = 'Football'; } 
            else if (filterText.includes('basketball')) { activeTrendingFilters.sport = 'Basketball'; } 
            else { activeTrendingFilters.sport = null; }
            
            activeTrendingFilters.leagueId = null; 
            activeTrendingFilters.favoritesOnly = false; 
            activeTrendingFilters.searchedTeam = null; // <<< AÑADIR: Limpiar equipo buscado
            
            // Ajustar el selector para el botón del dropdown de ligas.
            // Asumimos que el dropdown está después del H2 "Trending Matches"
            const leagueFilterSection = document.querySelector('h2.text-light + .dropdown');
            const leagueDropdownButton = leagueFilterSection ? leagueFilterSection.querySelector('.dropdown-toggle.btn-sm') : null;
            if (leagueDropdownButton) leagueDropdownButton.innerHTML = '<i class="bi bi-filter me-1"></i>Filter';
            
            updateLeagueDropdownButtonTextTrending();
            loadTrendingMatches();
        });
    });
}

function setupLeagueFilterDropdownTrending() {
    console.log("DEBUG: setupLeagueFilterDropdownTrending() se está ejecutando.");
    // Selector ajustado: busca el div.dropdown que es hermano adyacente (+) al h2 que contiene "Trending"
    const leagueFilterSection = document.querySelector('h2.text-light + .dropdown');
    console.log("DEBUG: League filter section (div.dropdown):", leagueFilterSection);

    const leagueFilterDropdownItems = leagueFilterSection ? leagueFilterSection.querySelectorAll('.dropdown-menu .dropdown-item') : [];
    const leagueDropdownButton = leagueFilterSection ? leagueFilterSection.querySelector('.dropdown-toggle.btn-sm') : null;
    
    if (!leagueDropdownButton) { console.warn("Trending: Botón del dropdown de filtros de liga no encontrado con selector ajustado."); }
    if (leagueFilterDropdownItems.length === 0) { console.warn("Trending: Items del dropdown de filtros de liga no encontrados con selector ajustado."); return; }
    console.log("DEBUG: League dropdown button:", leagueDropdownButton);
    console.log("DEBUG: League dropdown items encontrados:", leagueFilterDropdownItems.length);

    leagueFilterDropdownItems.forEach(item => {
        item.addEventListener('click', async (event) => {
            console.log("DEBUG: Item de dropdown de LIGA clickeado:", event.target.textContent);
            event.preventDefault();
            const filterName = event.target.textContent.trim();
            const filterConfig = leagueMappingsTrending[filterName];

            if (leagueDropdownButton) leagueDropdownButton.textContent = filterName; 
            activeTrendingFilters.searchedTeam = null;
            
            if (filterConfig) {
                activeTrendingFilters.leagueId = filterConfig.leagueId;
                if (filterConfig.sport) { 
                     activeTrendingFilters.sport = filterConfig.sport;
                     const sportButtonsContainer = document.querySelector('div.filter-container'); // El div que contiene los pills de deporte
                     if (sportButtonsContainer) {
                         const sportButtons = sportButtonsContainer.querySelectorAll('button');
                         sportButtons.forEach(btn => {
                            btn.classList.remove('btn-primary', 'text-white'); btn.classList.add('btn-outline-light');
                            const btnTextLower = btn.textContent.trim().toLowerCase();
                            if (filterConfig.sport === 'Football' && btnTextLower.includes('futbol')) { btn.classList.add('btn-primary', 'text-white'); btn.classList.remove('btn-outline-light');} 
                            else if (filterConfig.sport === 'Basketball' && btnTextLower.includes('basketball')) { btn.classList.add('btn-primary', 'text-white'); btn.classList.remove('btn-outline-light');} 
                            else if (!filterConfig.sport && btnTextLower.includes('todos')){ btn.classList.add('btn-primary', 'text-white'); btn.classList.remove('btn-outline-light');}
                         });
                     }
                } else if (filterName === "All" || filterName === "Favorites") {
                    // No se cambia el filtro de deporte si se selecciona "All" o "Favorites" del dropdown de liga
                }
                activeTrendingFilters.favoritesOnly = !!filterConfig.favoritesOnly;
            } else { 
                activeTrendingFilters.leagueId = null;
                activeTrendingFilters.favoritesOnly = false;
            }
            if (activeTrendingFilters.favoritesOnly && userFavoritesTrending.length === 0) { await fetchUserFavoritesTrending(); }
            loadTrendingMatches();
        });
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DEBUG: DOMContentLoaded para trending-script.js");
    if (!getAuthTokenTrending()) { console.warn("Trending: No auth token al cargar DOM..."); return; }
    
    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener('click', () => {
            try {
                if (typeof firebase !== 'undefined' && firebase.auth && typeof firebase.auth === 'function') {
                     firebase.auth().signOut().then(() => { localStorage.removeItem('authToken'); localStorage.removeItem('userInfo'); window.location.href = 'login.html'; })
                     .catch((error) => { console.error('Trending Logout Error:', error); localStorage.removeItem('authToken'); localStorage.removeItem('userInfo'); window.location.href = 'login.html';});
                } else { localStorage.removeItem('authToken'); localStorage.removeItem('userInfo'); window.location.href = 'login.html';}
            } catch (e) { localStorage.removeItem('authToken'); localStorage.removeItem('userInfo'); window.location.href = 'login.html'; }
        });
    } else {
        console.warn("Trending: Botón de logout no encontrado en DOMContentLoaded.");
    }

    await fetchUserFavoritesTrending();
    setupSportFilterButtonsTrending(); 
    setupLeagueFilterDropdownTrending(); 
    setupTeamSearchTrending();
    
    loadTrendingMatches(); 
});