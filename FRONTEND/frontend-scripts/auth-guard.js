(function() {
    const loginPage = '/FRONTEND/views/login.html';
    const tokenKey = 'authToken';

    console.log("AuthGuard: Verificando autenticación...");

    const authToken = localStorage.getItem(tokenKey);
    let isTokenValid = false;

    if (authToken) {
        try {
            const payloadBase64Url = authToken.split('.')[1];
            if (!payloadBase64Url) {
                throw new Error("Formato de token inválido (sin payload).");
            }
            const payloadBase64 = payloadBase64Url.replace(/-/g, '+').replace(/_/g, '/');
            const decodedJson = atob(payloadBase64);
            const payload = JSON.parse(decodedJson);

            if (payload.exp) {
                const expirationTimeInSeconds = payload.exp;
                const nowInSeconds = Math.floor(Date.now() / 1000);

                if (expirationTimeInSeconds > nowInSeconds) {
                    isTokenValid = true;
                    console.log("AuthGuard: Token encontrado y válido (cliente).");
                } else {
                    console.log("AuthGuard: Token encontrado pero EXPIRADO.");
                    localStorage.removeItem(tokenKey);
                    localStorage.removeItem('userInfo');
                }
            } else {
                throw new Error("Token inválido (sin fecha de expiración).");
            }
        } catch (error) {
            console.error("AuthGuard: Error al procesar token o token inválido:", error);
            localStorage.removeItem(tokenKey);
            localStorage.removeItem('userInfo');
        }
    } else {
        console.log("AuthGuard: No se encontró token de autenticación.");
    }

    const currentPath = window.location.pathname;
    const normalizedLoginPage = loginPage.startsWith('/') ? loginPage : '/' + loginPage;

    if (!isTokenValid && currentPath !== normalizedLoginPage) {
        console.log(`AuthGuard: No autorizado. Redirigiendo a ${loginPage}...`);
        window.location.href = loginPage;
    } else if (isTokenValid) {
        console.log("AuthGuard: Usuario autorizado.");
    } else {
        console.log("AuthGuard: Ya está en la página de login o token no es necesario.");
    }
})();
