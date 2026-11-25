const API_BASE = "https://ID_API.execute-api.us-east-1.amazonaws.com";
const ASSET_BASE = "https://DOMINIO_CF/public/assets";

window.FitLifeConfig = Object.freeze({ API_BASE: API_BASE, ASSET_BASE: ASSET_BASE });

(function () {
    "use strict";

    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = ASSET_BASE + "/css/app.css";
    document.head.appendChild(stylesheet);

    const page = document.body.dataset.page;
    const scriptsByPage = {
        index: ["js/index.js"],
        login: ["js/api.js", "js/login.js"],
        app: ["js/api.js", "js/app.js"]
    };
    const scripts = scriptsByPage[page] || [];

    function loadNext(index) {
        if (index >= scripts.length) {
            return;
        }

        const script = document.createElement("script");
        script.src = ASSET_BASE + "/" + scripts[index];
        script.onload = function () {
            loadNext(index + 1);
        };
        script.onerror = function () {
            const alert = document.getElementById("page-alert");
            if (alert) {
                alert.hidden = false;
                alert.className = "alert alert-danger shadow-sm";
                alert.textContent = "No se pudo cargar la aplicación. Revisa la publicación de recursos en CloudFront.";
            }
        };
        document.body.appendChild(script);
    }

    loadNext(0);
}());
