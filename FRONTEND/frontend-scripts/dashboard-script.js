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
    console.log("Dashboard DOM Cargado. Añadiendo listeners...");

    if (!auth) {
        console.error("Error: Firebase Auth no está disponible en DOMContentLoaded para el dashboard. Logout no funcionará.");
        const logoutTriggerLink = document.querySelector('a[data-bs-target="#confirmLogoutModal"]');
        if(logoutTriggerLink) {
            logoutTriggerLink.style.pointerEvents = 'none';
            logoutTriggerLink.style.opacity = '0.5';
            logoutTriggerLink.title = 'Error de autenticación';
        }
        const confirmBtn = document.getElementById('confirmLogoutBtn');
        if(confirmBtn) confirmBtn.disabled = true;

        return;
    }

    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

    if (confirmLogoutBtn) {
        confirmLogoutBtn.addEventListener('click', () => {
            console.log('Botón Confirmar Logout presionado.');

            confirmLogoutBtn.disabled = true;
            confirmLogoutBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cerrando...';
            auth.signOut().then(() => {
                console.log('Cierre de sesión en Firebase exitoso.');
                localStorage.removeItem('authToken');
                localStorage.removeItem('userInfo');
                console.log('Tokens/Info local eliminada.');
                console.log(`Redirigiendo a ${loginPage}...`);
                window.location.href = loginPage;

            }).catch((error) => {
                console.error('Error al cerrar sesión en Firebase:', error);
                alert(`Ocurrió un error al cerrar sesión: ${error.message}. Se limpiará localmente.`);
                localStorage.removeItem('authToken');
                localStorage.removeItem('userInfo');
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

    const confirmDeleteAccountBtn = document.getElementById('confirmDeleteAccountBtn');

    if (confirmDeleteAccountBtn) {
        confirmDeleteAccountBtn.addEventListener('click', async () => {
            console.log("Botón Confirmar Eliminar Cuenta presionado.");

            const authToken = localStorage.getItem('authToken');
            if (!authToken) {
                alert("Error: No estás autenticado para realizar esta acción.");
                window.location.href = loginPage;
                return;
            }

            confirmDeleteAccountBtn.disabled = true;
            confirmDeleteAccountBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Eliminando...';

            try {
                const response = await fetch(`${BACKEND_URL}/api/users/me`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                const modalElement = document.getElementById('confirmDeleteModal');
                if (modalElement) {
                    const modalInstance = bootstrap.Modal.getInstance(modalElement);
                    if (modalInstance) {
                        modalInstance.hide();
                    }
                }


                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: "Error desconocido del servidor." }));
                    throw new Error(errorData.message || `Error del servidor: ${response.status}`);
                }

                const data = await response.json();
                console.log("Respuesta del backend (eliminar cuenta):", data.message);
                alert("Tu cuenta ha sido eliminada exitosamente.");

                if (auth) {
                    auth.signOut().catch(err => console.error("Error al cerrar sesión de Firebase tras eliminar cuenta:", err));
                }
                localStorage.removeItem('authToken');
                localStorage.removeItem('userInfo');
                window.location.href = loginPage;

            } catch (error) {
                console.error("Error al intentar eliminar la cuenta:", error);
                alert(`Error: ${error.message}`);
                confirmDeleteAccountBtn.disabled = false;
                 confirmDeleteAccountBtn.innerHTML = '<i class="bi bi-trash-fill me-2"></i>Sí, Eliminar Mi Cuenta';
            }
        });
        console.log("Listener de clic añadido al botón de confirmar eliminar cuenta.");
    } else {
        console.warn('Botón Confirmar Eliminar Cuenta (id="confirmDeleteAccountBtn") no encontrado.');
    }
});

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
