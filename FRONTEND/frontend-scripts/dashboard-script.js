document.addEventListener('DOMContentLoaded', () => {
    console.log("Dashboard DOM Cargado.");

    let auth;
    try {
        if (firebase?.app) {
            auth = firebase.auth();
            console.log("Dashboard: Servicio Firebase Auth listo.");
        } else {
            console.error("Dashboard: Firebase App no está inicializado. El logout podría fallar.");
        }
    } catch(e) {
        console.error("Dashboard: Error accediendo a Firebase Auth:", e);
    }

    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener('click', () => {
            console.log('Botón Confirmar Logout presionado.');

            if (!auth) {
                console.error("Logout falló: Firebase Auth no está disponible.");
                localStorage.removeItem('authToken');
                localStorage.removeItem('userInfo');
                window.location.href = '/FRONTEND/views/login.html';
                return;
            }

            confirmLogoutBtn.disabled = true;
            confirmLogoutBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cerrando...';

            auth.signOut().then(() => {
                console.log('Cierre de sesión en Firebase exitoso.');
                localStorage.removeItem('authToken');
                localStorage.removeItem('userInfo');
                console.log('localStorage limpiado.');
                const loginPage = '/FRONTEND/view/login.html';
                console.log(`Redirigiendo a ${loginPage}...`);
                window.location.href = loginPage;

            }).catch((error) => {
                console.error('Error al cerrar sesión en Firebase:', error);
                alert(`Ocurrió un error al cerrar sesión: ${error.message}. Se intentará limpiar localmente.`);
                localStorage.removeItem('authToken');
                localStorage.removeItem('userInfo');
                const loginPage = '/login.html';
                window.location.href = loginPage;
            });
        });
        console.log('Listener de clic añadido al botón de confirmar logout.');
    } else {
        console.warn('Botón Confirmar Logout (id="confirmLogoutBtn") no encontrado en el modal.');
    }

    try {
        const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
        const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))
        console.log('Tooltips del dashboard inicializados.');
    } catch(e) {
        console.error("Error inicializando tooltips de Bootstrap:", e);
    }
});
