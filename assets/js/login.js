(function () {
    "use strict";

    const form = document.getElementById("login-form");
    const alertBox = document.getElementById("page-alert");
    const submitButton = document.getElementById("login-submit");
    const query = new URLSearchParams(window.location.search);

    function showAlert(message) {
        alertBox.hidden = false;
        alertBox.textContent = message;
    }

    if (query.get("logout") === "failed") {
        showAlert("La sesión se cerró en este navegador, pero el servidor no confirmó la revocación del token.");
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        alertBox.hidden = true;
        submitButton.disabled = true;
        submitButton.textContent = "Ingresando...";

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;
        if (!username || !password) {
            showAlert("Ingresa tu usuario y contraseña.");
            submitButton.disabled = false;
            submitButton.textContent = "Ingresar al panel";
            return;
        }

        try {
            const tokens = await window.FitLifeApi.apiFetch("/api/token/", {
                method: "POST",
                body: { username: username, password: password },
                skipAuth: true,
                skipRefresh: true
            });
            window.FitLifeApi.saveTokens(tokens);
            sessionStorage.setItem("fitlife.username", username);
            window.location.replace("dashboard.html");
        } catch (error) {
            showAlert(error.status === 401 ? "Usuario o contraseña incorrectos." : error.message);
            submitButton.disabled = false;
            submitButton.textContent = "Ingresar al panel";
        }
    });
}());
