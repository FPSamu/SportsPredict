const firebaseConfig = {
    apiKey: "AIzaSyCILjXMxLC-s99Z46CCD-LucJm6GnSgjHk",
    authDomain: "statspredict.firebaseapp.com",
    projectId: "statspredict",
    storageBucket: "statspredict.firebasestorage.app",
    messagingSenderId: "661481770829",
    appId: "1:661481770829:web:ec5aa48849eedc15f67104",
};

const loginPage = '/FRONTEND/views/login.html';

// --- Variables Globales para Firebase ---
let auth; // Se inicializará después de cargar el script

// --- Inicialización de Firebase ---
try {
    // Inicializar solo si no existe ya una instancia
    if (!firebase?.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log("Dashboard: Firebase Inicializado.");
    } else {
        firebase.app(); // Obtener la instancia existente
        console.log("Dashboard: Firebase ya estaba inicializado.");
    }
    // Obtener el servicio de autenticación
    auth = firebase.auth();
    console.log("Dashboard: Servicio Firebase Auth listo.");

} catch (e) {
    console.error("Dashboard: CRITICAL Error inicializando Firebase:", e);
    // Podríamos mostrar un mensaje de error permanente en la página aquí
    // alert("Error crítico al cargar componentes esenciales. Intenta refrescar.");
}


// --- Esperar a que el DOM esté listo para añadir listeners ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("Dashboard DOM Cargado. Añadiendo listeners...");

    // Verificar si Firebase Auth se inicializó correctamente
    if (!auth) {
        console.error("Error: Firebase Auth no está disponible en DOMContentLoaded para el dashboard. Logout no funcionará.");
        // Opcional: Deshabilitar el botón/link de logout si auth falló
        const logoutTriggerLink = document.querySelector('a[data-bs-target="#confirmLogoutModal"]');
        if(logoutTriggerLink) {
            logoutTriggerLink.style.pointerEvents = 'none';
            logoutTriggerLink.style.opacity = '0.5';
            logoutTriggerLink.title = 'Error de autenticación';
        }
        // Podrías también intentar deshabilitar el botón dentro del modal
        const confirmBtn = document.getElementById('confirmLogoutBtn');
        if(confirmBtn) confirmBtn.disabled = true;

        return; // Detener si no hay auth
    }

    // --- Lógica de Logout (Asignada al botón del Modal) ---
    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener('click', () => {
            console.log('Botón Confirmar Logout presionado.');

            // Indicar progreso (opcional, ya que la página cambiará rápido)
            confirmLogoutBtn.disabled = true;
            confirmLogoutBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cerrando...';

            // Intentar cerrar sesión en Firebase
            auth.signOut().then(() => {
                console.log('Cierre de sesión en Firebase exitoso.');
                // Limpiar el estado local (tokens, info de usuario)
                localStorage.removeItem('authToken');
                localStorage.removeItem('userInfo');
                // sessionStorage.removeItem('authToken'); // Si usaste sessionStorage
                // sessionStorage.removeItem('userInfo');
                console.log('Tokens/Info local eliminada.');

                // Redirigir a la página de login
                console.log(`Redirigiendo a ${loginPage}...`);
                window.location.href = loginPage;

            }).catch((error) => {
                // Error al cerrar sesión en Firebase (raro, pero posible)
                console.error('Error al cerrar sesión en Firebase:', error);
                alert(`Ocurrió un error al cerrar sesión: ${error.message}. Se limpiará localmente.`);
                // Aunque falle el signOut de Firebase, limpiamos localmente y redirigimos
                localStorage.removeItem('authToken');
                localStorage.removeItem('userInfo');
                // sessionStorage.removeItem('authToken');
                // sessionStorage.removeItem('userInfo');
                window.location.href = loginPage;
            });
        });
        console.log('Listener de clic añadido al botón de confirmar logout.');
    } else {
        console.warn('Botón Confirmar Logout (id="confirmLogoutBtn") no encontrado en el modal.');
    }

    // --- Otro código JS específico del Dashboard ---

    // Inicializar tooltips de Bootstrap (ejemplo)
    try {
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
        const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))
        console.log('Tooltips del dashboard inicializados.');
    } catch(e) {
        console.error("Error inicializando tooltips de Bootstrap:", e);
    }
});

function handleFirebaseAuthResult(result) {
    if (!result || !result.user) { console.error("Resultado Firebase inválido"); return; }
    const user = result.user;
    console.log("Usuario Firebase Auth OK:", user.email);

    // <<<--- AÑADE ESTA LÍNEA --- >>>
    console.log(">>> Intentando llamar a user.getIdToken(true)...");
    // <<<--- FIN LÍNEA A AÑADIR --- >>>

    user.getIdToken(true)
        .then(idToken => {
            console.log("Obtained Firebase ID Token:", idToken); // El log que buscas
            // ... resto del .then
        })
        .catch(error => {
            console.error("Error obteniendo ID token:", error); // El posible error
            // ...
        });
}