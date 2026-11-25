(function () {
    "use strict";
    const access = sessionStorage.getItem("fitlife.access");
    const refresh = sessionStorage.getItem("fitlife.refresh");
    window.location.replace(access || refresh ? "dashboard.html" : "login.html");
}());
