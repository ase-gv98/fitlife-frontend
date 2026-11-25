(function (global) {
    "use strict";

    const config = global.FitLifeConfig;
    const ACCESS_KEY = "fitlife.access";
    const REFRESH_KEY = "fitlife.refresh";

    class ApiError extends Error {
        constructor(message, status, details) {
            super(message);
            this.name = "ApiError";
            this.status = status;
            this.details = details;
        }
    }

    function clearSession() {
        sessionStorage.removeItem(ACCESS_KEY);
        sessionStorage.removeItem(REFRESH_KEY);
        sessionStorage.removeItem("fitlife.username");
    }

    function saveTokens(tokens) {
        if (!tokens || !tokens.access || !tokens.refresh) {
            throw new ApiError("La respuesta de autenticación no contiene los tokens requeridos.", 0);
        }
        // sessionStorage se limita a esta pestaña y se elimina al cerrarla; localStorage persistiría el JWT más tiempo ante un XSS.
        sessionStorage.setItem(ACCESS_KEY, tokens.access);
        sessionStorage.setItem(REFRESH_KEY, tokens.refresh);
    }

    function flattenDetails(value, prefix) {
        if (typeof value === "string") {
            return (prefix ? prefix + ": " : "") + value;
        }
        if (Array.isArray(value)) {
            return value.map(function (item) {
                return flattenDetails(item, prefix);
            }).filter(Boolean).join(" ");
        }
        if (value && typeof value === "object") {
            return Object.keys(value).map(function (key) {
                return flattenDetails(value[key], key);
            }).filter(Boolean).join(" ");
        }
        return "";
    }

    function messageFor(status, payload) {
        if (status === 400) {
            const details = flattenDetails(payload, "");
            return details || "Revisa los datos ingresados.";
        }
        if (status === 401) {
            return "Tu sesión expiró. Vuelve a ingresar.";
        }
        if (status === 403) {
            return "No tienes permiso para realizar esta acción.";
        }
        if (status === 404) {
            return "No se encontró el recurso solicitado.";
        }
        if (status === 429) {
            return "Demasiadas solicitudes, espera unos segundos";
        }
        if (status >= 500) {
            return "El servicio no está disponible en este momento. Inténtalo más tarde.";
        }
        return flattenDetails(payload, "") || "Ocurrió un error al procesar la solicitud.";
    }

    async function readPayload(response) {
        if (response.status === 204) {
            return null;
        }
        const text = await response.text();
        if (!text) {
            return null;
        }
        const contentType = response.headers.get("content-type") || "";
        if (contentType.indexOf("application/json") !== -1) {
            try {
                return JSON.parse(text);
            } catch (error) {
                throw new ApiError("El servidor devolvió una respuesta JSON inválida.", response.status);
            }
        }
        return { detail: text };
    }

    function redirectToLogin() {
        clearSession();
        global.location.replace("login.html");
    }

    async function renewAccessToken() {
        const refresh = sessionStorage.getItem(REFRESH_KEY);
        if (!refresh) {
            return false;
        }

        const response = await fetch(config.API_BASE + "/api/token/refresh/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh: refresh })
        });
        const payload = await readPayload(response);
        if (!response.ok || !payload || !payload.access) {
            return false;
        }
        sessionStorage.setItem(ACCESS_KEY, payload.access);
        if (payload.refresh) {
            sessionStorage.setItem(REFRESH_KEY, payload.refresh);
        }
        return true;
    }

    async function apiFetch(ruta, opciones) {
        const options = Object.assign({}, opciones || {});
        const skipAuth = options.skipAuth === true;
        const skipRefresh = options.skipRefresh === true;
        delete options.skipAuth;
        delete options.skipRefresh;

        const headers = new Headers(options.headers || {});
        const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
        if (!isFormData && !headers.has("Content-Type")) {
            headers.set("Content-Type", "application/json");
        }
        if (!isFormData && options.body && typeof options.body !== "string") {
            options.body = JSON.stringify(options.body);
        }
        if (!skipAuth) {
            const access = sessionStorage.getItem(ACCESS_KEY);
            if (access) {
                headers.set("Authorization", "Bearer " + access);
            }
        }
        options.headers = headers;

        let response;
        try {
            response = await fetch(config.API_BASE + ruta, options);
        } catch (error) {
            throw new ApiError("No fue posible conectar con el servicio. Verifica tu conexión e inténtalo nuevamente.", 0);
        }

        if (response.status === 401 && !skipRefresh && ruta.indexOf("/api/token/") !== 0) {
            let renewed = false;
            try {
                renewed = await renewAccessToken();
            } catch (error) {
                renewed = false;
            }
            if (renewed) {
                const retryHeaders = new Headers(headers);
                retryHeaders.set("Authorization", "Bearer " + sessionStorage.getItem(ACCESS_KEY));
                const retryOptions = Object.assign({}, options, { headers: retryHeaders });
                try {
                    response = await fetch(config.API_BASE + ruta, retryOptions);
                } catch (error) {
                    throw new ApiError("No fue posible conectar con el servicio. Verifica tu conexión e inténtalo nuevamente.", 0);
                }
            } else {
                redirectToLogin();
                throw new ApiError("Tu sesión expiró. Vuelve a ingresar.", 401);
            }
            if (response.status === 401) {
                redirectToLogin();
                throw new ApiError("Tu sesión expiró. Vuelve a ingresar.", 401);
            }
        }

        const payload = await readPayload(response);
        if (!response.ok) {
            throw new ApiError(messageFor(response.status, payload), response.status, payload);
        }
        return payload;
    }

    async function logout() {
        const refresh = sessionStorage.getItem(REFRESH_KEY);
        let revoked = true;
        if (refresh) {
            try {
                const response = await fetch(config.API_BASE + "/api/token/blacklist/", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ refresh: refresh })
                });
                revoked = response.ok;
            } catch (error) {
                revoked = false;
            }
        }
        clearSession();
        global.location.replace(revoked ? "login.html" : "login.html?logout=failed");
    }

    global.FitLifeApi = Object.freeze({
        apiFetch: apiFetch,
        clearSession: clearSession,
        logout: logout,
        saveTokens: saveTokens,
        getAccessToken: function () { return sessionStorage.getItem(ACCESS_KEY); },
        getRefreshToken: function () { return sessionStorage.getItem(REFRESH_KEY); },
        ApiError: ApiError
    });
}(window));
