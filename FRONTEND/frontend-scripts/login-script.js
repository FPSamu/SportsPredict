const firebaseConfig = {
    apiKey: "AIzaSyCILjXMxLC-s99Z46CCD-LucJm6GnSgjHk",
    authDomain: "statspredict.firebaseapp.com",
    projectId: "statspredict",
    storageBucket: "statspredict.firebasestorage.app",
    messagingSenderId: "661481770829",
    appId: "1:661481770829:web:ec5aa48849eedc15f67104",
};

const BACKEND_URL = 'http://localhost:5000';

let auth, googleProvider, githubProvider;

try {
    if (!firebase?.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app();
    }
    auth = firebase.auth();
    googleProvider = new firebase.auth.GoogleAuthProvider();
    githubProvider = new firebase.auth.GithubAuthProvider();
} catch (e) {
    console.error("CRITICAL: Error inicializando Firebase o sus servicios:", e);
    alert("No se pudo inicializar el sistema de autenticación. Revisa la consola (F12) y la configuración de Firebase.");
    document.body.innerHTML = "<h1>Error Crítico</h1><p>Fallo al inicializar Firebase. Revisa la configuración.</p>"
}

document.addEventListener('DOMContentLoaded', () => {
    if (!auth) {
        console.error("Error fatal: Firebase Auth no se inicializó correctamente. No se pueden añadir listeners.");
        const body = document.querySelector('body');
        if (body) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-danger m-3';
            errorDiv.textContent = "Error crítico al cargar el sistema de autenticación. Intenta refrescar la página.";
            body.prepend(errorDiv);
        }
        return;
    }

    const loginFormElement = document.querySelector('.login-form form');
    const registerFormElement = document.querySelector('.register-form form');
    const loginCardEl = document.querySelector('.login-form');
    const registerCardEl = document.querySelector('.register-form');
    const loginGoogleBtn = loginFormElement?.querySelector('.btn-outline-danger');
    const loginGithubBtn = loginFormElement?.querySelector('.btn-outline-secondary');
    const registerGoogleBtn = registerFormElement?.querySelector('.btn-outline-danger');
    const registerGithubBtn = registerFormElement?.querySelector('.btn-outline-secondary');
    const registerLink = document.querySelector('.register-now-link');
    const signInLink = document.querySelector('.signin-link');

    if (!loginFormElement || !registerFormElement || !loginCardEl || !registerCardEl) {
        console.error("Error Crítico: No se encontraron .login-form o .register-form o sus <form>. Verifica HTML/Selectores CSS.");
        return;
    }

    loginCardEl.style.display = 'block';
    registerCardEl.style.display = 'none';

    function showLoading(button) {
        if (!button) return;
        button.disabled = true;
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cargando...';
    }

    function hideLoading(button) {
        if (!button) return;
        button.innerHTML = button.dataset.originalText || (button.closest('.login-form') ? 'Sign In' : 'Create Account');
        button.disabled = false;
    }

    function displayError(formElement, message) {
        if (!formElement) return;
        clearError(formElement);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger mt-3 auth-error-message';
        errorDiv.setAttribute('role', 'alert');
        errorDiv.textContent = message;
        const submitButton = formElement.querySelector('button[type="submit"]');
        if (submitButton) {
            formElement.insertBefore(errorDiv, submitButton);
        } else {
            formElement.appendChild(errorDiv);
        }
    }

    function clearError(formElement) {
        if (!formElement) return;
        const errorDiv = formElement.querySelector('.auth-error-message');
        if (errorDiv) {
            errorDiv.remove();
        }
    }

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(String(email).toLowerCase());
    }

    function validatePassword(password) {
        return password && password.length >= 8;
    }

    function togglePassword(inputId) {
        const passwordInput = document.getElementById(inputId);
        if (passwordInput) {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
        }
    }

    function toggleForm(event) {
        if (event) {
            event.preventDefault();
        }
        const isLoginVisible = loginCardEl.style.display !== 'none';
        clearError(loginFormElement);
        clearError(registerFormElement);
        if (isLoginVisible) {
            loginCardEl.style.display = 'none';
            registerCardEl.style.display = 'block';
        } else {
            registerCardEl.style.display = 'none';
            loginCardEl.style.display = 'block';
        }
    }

    async function verifyTokenWithBackend(idToken) {
        try {
            const response = await fetch(`${BACKEND_URL}/api/auth/verify-token`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${idToken}`,
                    'Content-Type': 'application/json'
                },
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `Error del servidor: ${response.status}`);
            }

            if (data.token) {
                localStorage.setItem('authToken', data.token);
                if (data.user) {
                    localStorage.setItem('userInfo', JSON.stringify(data.user));
                }
                const redirectTo = '/FRONTEND/views/dashboard.html';
                window.location.href = redirectTo;
            } else {
                throw new Error("Respuesta exitosa del backend pero no se recibió token interno.");
            }
        } catch (error) {
            const visibleForm = loginCardEl.style.display !== 'none' ? loginFormElement : registerFormElement;
            displayError(visibleForm, `Error de conexión o verificación: ${error.message}`);
            localStorage.removeItem('authToken');
            localStorage.removeItem('userInfo');
        }
    }

    function handleFirebaseAuthResult(result) {
        if (!result || !result.user) {
            displayError(loginFormElement, "Error inesperado durante la autenticación.");
            displayError(registerFormElement, "Error inesperado durante la autenticación.");
            return;
        }
        const user = result.user;
        const visibleForm = loginCardEl.style.display !== 'none' ? loginFormElement : registerFormElement;
        displayError(visibleForm, "Autenticación exitosa. Verificando con el servidor...");
        user.getIdToken(true).then(verifyTokenWithBackend).catch(error => {
            displayError(visibleForm, `Error interno obteniendo credencial: ${error.message}`);
        });
    }

    function handleSignIn(provider) {
        clearError(loginFormElement);
        clearError(registerFormElement);
        if (!auth) {
            return;
        }
        auth.signInWithPopup(provider)
            .then(handleFirebaseAuthResult)
            .catch((error) => {
                const visibleForm = loginCardEl.style.display !== 'none' ? loginFormElement : registerFormElement;
                if (error.code === 'auth/popup-closed-by-user') {
                    displayError(visibleForm, "Proceso cancelado por el usuario.");
                } else if (error.code === 'auth/account-exists-with-different-credential') {
                    displayError(visibleForm, "Ya existe una cuenta con este email usando otro método de inicio de sesión.");
                } else {
                    displayError(visibleForm, `Error: ${error.message}`);
                }
            });
    }

    if (registerLink) {
        registerLink.addEventListener('click', toggleForm);
    }
    if (signInLink) {
        signInLink.addEventListener('click', toggleForm);
    }

    if (loginFormElement) {
        loginFormElement.addEventListener('submit', (e) => {
            e.preventDefault();
            clearError(loginFormElement);
            const email = loginFormElement.querySelector('#email').value;
            const password = loginFormElement.querySelector('#password').value;
            const submitButton = loginFormElement.querySelector('button[type="submit"]');

            if (!email || !password) {
                displayError(loginFormElement, "Email y contraseña son requeridos.");
                return;
            }
            if (!validateEmail(email)) {
                displayError(loginFormElement, 'Email inválido.');
                return;
            }

            if (!submitButton) {
                return;
            }
            showLoading(submitButton);

            auth.signInWithEmailAndPassword(email, password)
                .then(handleFirebaseAuthResult)
                .catch((error) => {
                    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                        displayError(loginFormElement, "Credenciales inválidas. Verifica tu email y contraseña.");
                    } else {
                        displayError(loginFormElement, `Error: ${error.message}`);
                    }
                })
                .finally(() => {
                    hideLoading(submitButton);
                });
        });
    }

    if (registerFormElement) {
        registerFormElement.addEventListener('submit', (e) => {
            e.preventDefault();
            clearError(registerFormElement);
            const email = registerFormElement.querySelector('#registerEmail').value;
            const password = registerFormElement.querySelector('#registerPassword').value;
            const confirmPassword = registerFormElement.querySelector('#confirmPassword').value;
            const displayName = registerFormElement.querySelector('#fullName').value.trim();
            const submitButton = registerFormElement.querySelector('button[type="submit"]');
            if (!submitButton) {
                return;
            }

            if (!validateEmail(email)) {
                displayError(registerFormElement, 'Email inválido.');
                return;
            }
            if (!validatePassword(password)) {
                displayError(registerFormElement, "La contraseña debe tener al menos 8 caracteres.");
                return;
            }
            if (password !== confirmPassword) {
                displayError(registerFormElement, "Las contraseñas no coinciden.");
                return;
            }
            if (!displayName) {
                displayError(registerFormElement, "El nombre completo es requerido.");
                return;
            }

            showLoading(submitButton);

            auth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    if (userCredential.user) {
                        return userCredential.user.updateProfile({ displayName: displayName })
                            .then(() => {
                                return userCredential;
                            })
                            .catch(profileError => {
                                return userCredential;
                            });
                    }
                    return userCredential;
                })
                .then(handleFirebaseAuthResult)
                .catch((error) => {
                    if (error.code === 'auth/email-already-in-use') {
                        displayError(registerFormElement, "Este correo electrónico ya está registrado.");
                    } else if (error.code === 'auth/weak-password') {
                        displayError(registerFormElement, "La contraseña es demasiado débil.");
                    } else {
                        displayError(registerFormElement, `Error: ${error.message}`);
                    }
                })
                .finally(() => {
                    hideLoading(submitButton);
                });
        });
    }

    if (loginGoogleBtn) loginGoogleBtn.addEventListener('click', () => handleSignIn(googleProvider));
    if (registerGoogleBtn) registerGoogleBtn.addEventListener('click', () => handleSignIn(googleProvider));
    if (loginGithubBtn) loginGithubBtn.addEventListener('click', () => handleSignIn(githubProvider));
    if (registerGithubBtn) registerGithubBtn.addEventListener('click', () => handleSignIn(githubProvider));
});
