const firebaseConfig = {
    apiKey: "AIzaSyCILjXMxLC-s99Z46CCD-LucJm6GnSgjHk",
    authDomain: "statspredict.firebaseapp.com",
    projectId: "statspredict",
    storageBucket: "statspredict.firebasestorage.app",
    messagingSenderId: "661481770829",
    appId: "1:661481770829:web:ec5aa48849eedc15f67104",
};

const loginPage = '/FRONTEND/views/login.html';
const BACKEND_URL = 'http://localhost:5000'; 
let auth;
try {
    if (!firebase?.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log("Dashboard: Firebase Inicializado.");
    } else {
        firebase.app();
        console.log("Dashboard: Firebase ya estaba inicializado.");
    }
    auth = firebase.auth();
    console.log("Dashboard: Servicio Firebase Auth listo.");

} catch (e) {
    console.error("Dashboard: CRITICAL Error inicializando Firebase:", e);
}


document.addEventListener('DOMContentLoaded', () => {
    console.log("Dashboard DOM Cargado. Configurando listeners y cargando datos...");

    // Verificar que 'auth' de Firebase esté disponible
    if (!auth) {
        console.error("Error fatal: Firebase Auth no está disponible en DOMContentLoaded para el dashboard.");
        const body = document.querySelector('body');
        if (body) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-danger m-3 position-fixed top-0 start-50 translate-middle-x';
            errorDiv.style.zIndex = "2000";
            errorDiv.textContent = "Error crítico con el sistema de autenticación. Algunas funciones pueden no estar disponibles.";
            body.prepend(errorDiv);
            setTimeout(() => errorDiv.remove(), 5000);
        }
        // No detener todo, pero el logout y otras funciones de Firebase podrían no funcionar
    }

    // --- Elementos del DOM para Predicciones y Filtros ---
    const predictionsContainer = document.getElementById('predictions');
    const filterLinks = document.querySelectorAll('.dropdown-menu a[data-filter]');
    const filterButton = document.querySelector('.dropdown-toggle[data-bs-toggle="dropdown"]');


    if (!predictionsContainer) {
        console.error("Elemento con id='predictions' no encontrado. No se pueden mostrar predicciones.");
        return; // Salir si el contenedor principal de predicciones no existe
    }

    // --- Estado de la Aplicación para Filtros y Datos ---
    let allProcessedMatches = []; // Guardará todos los partidos con su 'topPrediction' calculada
    let currentActiveFilter = 'all'; // Filtro activo por defecto
    const HIGH_CONFIDENCE_THRESHOLD = 0.70; // 70% para "Alta Confianza" (ajusta según necesites)

    // --- Lógica de Logout (del Modal) ---
    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener('click', () => {
            console.log('Botón Confirmar Logout presionado.');
            if (!auth) {
                console.error("Logout falló: Firebase Auth no está disponible.");
                localStorage.removeItem('authToken'); localStorage.removeItem('userInfo');
                window.location.href = loginPage; return;
            }
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

    // --- Inicializar Tooltips de Bootstrap ---
    try {
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
        console.log('Tooltips del dashboard inicializados.');
    } catch(e) { console.error("Error inicializando tooltips de Bootstrap:", e); }


    // --- LÓGICA PARA PREDICCIONES Y FILTROS ---

    async function fetchMatchesWithPredictions() {
        const token = localStorage.getItem('authToken');
        if (!token) { return []; }
        predictionsContainer.innerHTML = '<div class="col-12 text-center mt-5"><div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status"><span class="visually-hidden">Loading...</span></div><p class="mt-2">Cargando predicciones...</p></div>';
        try {
            // Pide más partidos para tener suficientes para filtrar, ej. próximos 7 días, hasta 20
            // Puedes ajustar 'limit' y 'days' o añadir un parámetro de sport para más control
            const response = await fetch(`${BACKEND_URL}/api/matches/upcoming?limit=20&days=7`, {
                 headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const errData = await response.json().catch(() => ({ message: "Error de red o respuesta no JSON." }));
                throw new Error(errData.message || `Error del servidor: ${response.status}`);
            }
            const data = await response.json();
            console.log("Partidos con predicciones (potenciales) recibidos:", data.data);
            return data.data || [];
        } catch (error) {
            console.error("Error obteniendo partidos con predicciones:", error);
            predictionsContainer.innerHTML = `<div class="col-12"><p class="text-center text-danger">Error al cargar predicciones: ${error.message}</p></div>`;
            return [];
        }
    }

    function findTopPrediction(match) {
        if (!match || !match.predictions || Object.keys(match.predictions).length === 0 || match.predictions.error_fetching_data || match.predictions.no_sufficient_data) {
            return null;
        }
        const preds = match.predictions;
        let top = { type: "No hay predicción clara", outcome: "", confidence: 0, line: null, teamContext: null };

        const updateTop = (newType, newOutcome, newConfidence, newLine = null, newTeamContext = null) => {
            // Considerar solo si la confianza es significativamente alta, ej. > 50% o 60%
            // if (newConfidence && newConfidence > top.confidence && newConfidence >= 0.50) { // Umbral mínimo de confianza
            if (newConfidence && newConfidence > top.confidence) { // Por ahora, cualquier mejora
                top = { type: newType, outcome: newOutcome, confidence: newConfidence, line: newLine, teamContext: newTeamContext };
            }
        };

        // Fútbol
        if (preds.ft_winner_prob) {
            if (preds.ft_winner_prob.home) updateTop("Resultado Partido", `Gana ${match.teams.home.name}`, preds.ft_winner_prob.home, null, match.teams.home.name);
            if (preds.ft_winner_prob.draw) updateTop("Resultado Partido", "Empate", preds.ft_winner_prob.draw);
            if (preds.ft_winner_prob.away) updateTop("Resultado Partido", `Gana ${match.teams.away.name}`, preds.ft_winner_prob.away, null, match.teams.away.name);
        }
        if (preds.ft_ou_goals_prob && Array.isArray(preds.ft_ou_goals_prob)) {
            preds.ft_ou_goals_prob.forEach(ou => {
                if(ou.over) updateTop("Más/Menos Goles", `Más de ${ou.line}`, ou.over, ou.line);
                if(ou.under) updateTop("Más/Menos Goles", `Menos de ${ou.line}`, ou.under, ou.line);
            });
        }
        if (preds.ft_btts_prob) {
            if(preds.ft_btts_prob.yes) updateTop("Ambos Marcan", "Sí", preds.ft_btts_prob.yes);
            if(preds.ft_btts_prob.no) updateTop("Ambos Marcan", "No", preds.ft_btts_prob.no);
        }
        // Básquetbol
        if (preds.bk_winner_prob) {
            if (preds.bk_winner_prob.home) updateTop("Resultado Partido", `Gana ${match.teams.home.name}`, preds.bk_winner_prob.home, null, match.teams.home.name);
            if (preds.bk_winner_prob.away) updateTop("Resultado Partido", `Gana ${match.teams.away.name}`, preds.bk_winner_prob.away, null, match.teams.away.name);
        }
        if (preds.bk_total_pts_prob && Array.isArray(preds.bk_total_pts_prob)) {
            preds.bk_total_pts_prob.forEach(ou => {
                if(ou.over) updateTop("Más/Menos Puntos", `Más de ${ou.line}`, ou.over, ou.line);
                if(ou.under) updateTop("Más/Menos Puntos", `Menos de ${ou.line}`, ou.under, ou.line);
            });
        }
        return top.confidence > 0.01 ? top : null; // Devolver solo si hay alguna confianza
    }

    function createPredictionCardHTML(match, topPrediction) {
        if (!match || !topPrediction) return '';
        const matchDate = new Date(match.matchDate);
        const now = new Date();
        let timeLabel = matchDate.toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        if (match.status === 'finished') { /* ... lógica de timeLabel ... */ }
        else if (matchDate.toDateString() === now.toDateString()) { timeLabel = `Hoy ${matchDate.toLocaleTimeString('es-ES', {hour: 'numeric', minute: '2-digit'})}`; }
        else { /* ... lógica de timeLabel para mañana/otros ... */ }

        let confidencePercent = Math.round(topPrediction.confidence * 100);
        let confidenceBarColor = 'success';
        if (confidencePercent < 75 && confidencePercent >= 60) confidenceBarColor = 'warning';
        else if (confidencePercent < 60) confidenceBarColor = 'danger';

        let iconClass = "bi-flag-fill";
        if (topPrediction.type.toLowerCase().includes("más/menos")) { iconClass = topPrediction.outcome.toLowerCase().includes("más de") ? "bi-caret-up-fill" : "bi-caret-down-fill"; }
        else if (topPrediction.type.toLowerCase().includes("ambos marcan")){ iconClass = topPrediction.outcome.toLowerCase() === "sí" ? "bi-check-circle-fill" : "bi-x-circle-fill"; }

        let predictionTypeBadgeClass = 'bg-info'; // Default
        const typeLowerCase = topPrediction.type.toLowerCase();
        if (typeLowerCase.includes("más/menos goles")) predictionTypeBadgeClass = 'bg-success';
        else if (typeLowerCase.includes("resultado partido")) predictionTypeBadgeClass = 'bg-primary';
        else if (typeLowerCase.includes("ambos marcan")) predictionTypeBadgeClass = 'bg-dark-subtle text-dark border';
        else if (typeLowerCase.includes("más/menos puntos")) predictionTypeBadgeClass = 'bg-warning text-dark';
        
        const homeLogo = match.teams.home.logo || '../assets/images/default-badge.png';
        const awayLogo = match.teams.away.logo || '../assets.images/default-badge.png';

        return `
            <div class="col-md-6 mb-4">
                <div class="card h-100 bg-dark text-light shadow-sm hover-card">
                    <div class="pt-2 ps-3 d-flex justify-content-between align-items-center">
                        <span class="badge bg-secondary rounded-pill fw-normal small">${match.league.name}</span>
                        <small class="pe-3 text-light small">${timeLabel}</small>
                    </div>
                    <div class="card-body">
                        <div class="d-flex justify-content-around align-items-center mb-4">
                            <div class="text-center team-display-container">
                                <img src="${homeLogo}" class="rounded-circle team-logo bg-light p-1" alt="${match.teams.home.name}">
                                <p class="mt-2 mb-0 fw-medium small">${match.teams.home.name}</p>
                            </div>
                            <div class="text-muted fw-bold small">VS</div>
                            <div class="text-center team-display-container">
                                <img src="${awayLogo}" class="rounded-circle team-logo bg-light p-1" alt="${match.teams.away.name}">
                                <p class="mt-2 mb-0 fw-medium small">${match.teams.away.name}</p>
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
                            ${topPrediction.teamContext ? topPrediction.teamContext + ' ' : ''}${topPrediction.outcome}
                        </p>
                    </div>
                </div>
            </div>`;
    }

    function renderPredictions() {
        if (!predictionsContainer) return;
        let filteredMatches = allProcessedMatches; // Usa la lista global procesada

        if (currentActiveFilter === 'today') {
            const todayDateString = new Date().toDateString();
            filteredMatches = allProcessedMatches.filter(match => match.matchDate && new Date(match.matchDate).toDateString() === todayDateString);
            if (filterButton) filterButton.textContent = " Filters: Today's";
        } else if (currentActiveFilter === 'highConfidence') {
            filteredMatches = allProcessedMatches.filter(match => match.topPrediction && match.topPrediction.confidence >= HIGH_CONFIDENCE_THRESHOLD);
            if (filterButton) filterButton.textContent = " Filters: High Conf.";
        } else { // 'all'
            if (filterButton) filterButton.textContent = " Filters"; // Texto por defecto del botón
        }
        
        predictionsContainer.innerHTML = '';
        if (!filteredMatches || filteredMatches.length === 0) {
            predictionsContainer.innerHTML = '<div class="col-12"><p class="text-center text-secondary mt-4">No hay predicciones que coincidan con el filtro.</p></div>';
            return;
        }
        let cardsHTML = '';
        for (const match of filteredMatches) {
            if (match.topPrediction) { // Solo renderizar si hay una topPrediction
                cardsHTML += createPredictionCardHTML(match, match.topPrediction);
            }
        }
        if (cardsHTML === '') {
             predictionsContainer.innerHTML = '<div class="col-12"><p class="text-center text-secondary mt-4">No se encontraron predicciones claras para mostrar.</p></div>';
        } else {
            predictionsContainer.innerHTML = cardsHTML;
        }
    }

    async function loadAndDisplayPredictions() {
        const matchesFromAPI = await fetchMatchesWithPredictions();
        if (!matchesFromAPI || matchesFromAPI.length === 0) {
            allProcessedMatches = [];
            renderPredictions(); // Mostrará mensaje de "no hay predicciones"
            return;
        }
        allProcessedMatches = matchesFromAPI.map(match => {
            const topPred = findTopPrediction(match);
            return { ...match, topPrediction: topPred };
        });
        console.log("Partidos procesados con topPrediction:", allProcessedMatches);
        renderPredictions(); // Renderizar inicialmente con filtro 'all' (o el activo)
    }

    filterLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const filterValue = event.target.dataset.filter;
            if (filterValue) {
                console.log("Filtro seleccionado:", filterValue);
                currentActiveFilter = filterValue;
                renderPredictions();
            }
        });
    });
    
    loadAndDisplayPredictions(); // Cargar al inicio

}); // Fin de DOMContentLoaded

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
