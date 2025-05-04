function togglePassword(inputId) {
    const passwordInput = document.getElementById(inputId);
    const toggleButton = passwordInput.nextElementSibling;
    const eyeIcon = toggleButton.querySelector('svg');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        passwordInput.type = 'password';
        eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
}

function toggleForm(event) {
    if (event) {
        event.preventDefault();
    }
    
    const loginForm = document.querySelector('.login-form');
    const registerForm = document.querySelector('.register-form');
    
    if (loginForm.classList.contains('form-visible') || !loginForm.classList.contains('form-hidden')) {
        loginForm.classList.add('form-hidden');
        loginForm.classList.remove('form-visible');
        
        setTimeout(() => {
            registerForm.style.display = 'block';
            registerForm.classList.add('form-visible');
            registerForm.classList.remove('form-hidden');
            loginForm.style.display = 'none';
        }, 100);
    } else {
        // Switch to login form
        registerForm.classList.add('form-hidden');
        registerForm.classList.remove('form-visible');
        
        // Small delay before showing the login form for smoother transition
        setTimeout(() => {
            loginForm.style.display = 'block';
            loginForm.classList.add('form-visible');
            loginForm.classList.remove('form-hidden');
            registerForm.style.display = 'none';
        }, 100);
    }
}