(function () {
    "use strict";

    const api = window.FitLifeApi;
    const config = window.FitLifeConfig;
    const content = document.getElementById("page-content");
    const alertBox = document.getElementById("page-alert");
    const resourceName = document.body.dataset.resource;
    const tokenClaims = decodeClaims(api.getAccessToken());
    const userName = sessionStorage.getItem("fitlife.username") || tokenClaims.username || "Socio";
    const staff = tokenClaims.is_staff === true || tokenClaims.is_staff === 1 ||
        tokenClaims.is_superuser === true ||
        tokenClaims.role === "staff" || tokenClaims.role === "admin" ||
        (Array.isArray(tokenClaims.groups) && tokenClaims.groups.indexOf("staff") !== -1);

    const resources = {
        plans: {
            endpoint: "/api/plans/",
            title: "Planes",
            singular: "plan",
            description: "Gestiona el catálogo de planes de FitLife.",
            columns: [["name", "Plan"], ["description", "Descripción"], ["monthly_price", "Precio mensual"], ["active", "Estado"]],
            filter: { key: "active", label: "Estado", values: [["true", "Activo"], ["false", "Inactivo"]] },
            fields: [
                { key: "name", label: "Nombre", required: true },
                { key: "description", label: "Descripción", type: "textarea" },
                { key: "monthly_price", label: "Precio mensual", type: "number", min: "1", step: "0.01", required: true },
                { key: "active", label: "Activo", type: "checkbox", defaultValue: true }
            ]
        },
        members: {
            endpoint: "/api/members/",
            title: "Socios",
            singular: "socio",
            description: "Consulta y administra los perfiles de socios.",
            columns: [["username", "Usuario"], ["rut", "RUT"], ["phone", "Teléfono"]],
            fields: [
                { key: "rut", label: "RUT", required: false },
                { key: "phone", label: "Teléfono", required: false }
            ],
            createFields: [
                { key: "username", label: "Usuario", required: true },
                { key: "password", label: "Contraseña (mínimo 8 caracteres)", type: "password", minLength: 8, required: true },
                { key: "first_name", label: "Nombre", required: true },
                { key: "last_name", label: "Apellido", required: true },
                { key: "email", label: "Correo electrónico", type: "email", required: true },
                { key: "rut", label: "RUT", required: false },
                { key: "phone", label: "Teléfono", required: false }
            ]
        },
        memberships: {
            endpoint: "/api/memberships/",
            title: "Membresías",
            singular: "membresía",
            description: "Revisa las membresías y su vigencia.",
            columns: [["member", "Socio"], ["plan", "Plan"], ["start_date", "Inicio"], ["end_date", "Término"], ["estado", "Estado"]],
            filter: { key: "estado", label: "Estado", values: [["ACTIVE", "Activa"], ["EXPIRED", "Vencida"], ["FROZEN", "Congelada"]] },
            fields: [
                { key: "member", label: "Socio", type: "select", endpoint: "/api/members/", optionLabel: "username", required: true },
                { key: "plan", label: "Plan", type: "select", endpoint: "/api/plans/", optionLabel: "name", required: true },
                { key: "start_date", label: "Fecha de inicio", type: "date", required: true },
                { key: "end_date", label: "Fecha de término", type: "date", required: true },
                { key: "estado", label: "Estado", type: "select-static", required: true, options: [["ACTIVE", "Activa"], ["EXPIRED", "Vencida"], ["FROZEN", "Congelada"]], defaultValue: "ACTIVE" }
            ]
        },
        payments: {
            endpoint: "/api/payments/",
            title: "Pagos",
            singular: "pago",
            description: "Registra pagos y consulta sus comprobantes.",
            columns: [["member", "Socio"], ["membership", "Membresía"], ["amount", "Monto"], ["paid_at", "Fecha"], ["reference", "Referencia"], ["payment_method", "Medio"], ["status", "Estado"], ["receipt_url", "Comprobante"]],
            filter: { key: "status", label: "Estado", values: [["PENDING", "Pendiente"], ["PAID", "Pagado"], ["REFUNDED", "Reembolsado"]] },
            fields: [
                { key: "member", label: "Socio", type: "select", endpoint: "/api/members/", optionLabel: "username", required: true },
                { key: "membership", label: "Membresía", type: "select", endpoint: "/api/memberships/", optionLabel: "id", required: true },
                { key: "amount", label: "Monto", type: "number", min: "0.01", step: "0.01", required: true },
                { key: "paid_at", label: "Fecha y hora de pago", type: "datetime-local" },
                { key: "reference", label: "Referencia", required: true },
                { key: "payment_method", label: "Medio de pago", type: "select-static", required: true, options: [["CASH", "Efectivo"], ["CARD", "Tarjeta"], ["TRANSFER", "Transferencia"]], defaultValue: "TRANSFER" },
                { key: "status", label: "Estado", type: "select-static", required: true, options: [["PENDING", "Pendiente"], ["PAID", "Pagado"], ["REFUNDED", "Reembolsado"]], defaultValue: "PAID" },
                { key: "receipt", label: "Comprobante (PDF, PNG o JPG; máximo 2 MB)", type: "file", accept: ".pdf,.png,.jpg,.jpeg" }
            ]
        },
        classes: {
            endpoint: "/api/classes/",
            title: "Clases grupales",
            description: "Consulta horarios, instructores y cupos disponibles.",
            columns: [["name", "Clase"], ["instructor", "Instructor"], ["starts_at", "Inicio"], ["ends_at", "Término"], ["capacity", "Capacidad"], ["available_spots", "Cupos disponibles"]],
            filter: { key: "active", label: "Estado", values: [["true", "Activa"], ["false", "Inactiva"]] },
            readOnly: true
        },
        bookings: {
            endpoint: "/api/bookings/",
            title: "Reservas",
            description: "Consulta tus reservas y su estado.",
            columns: [["group_class", "Clase"], ["status", "Estado"], ["created_at", "Fecha de reserva"]],
            filter: { key: "status", label: "Estado", values: [["CONFIRMED", "Confirmada"], ["WAITLIST", "Lista de espera"], ["CANCELLED", "Cancelada"]] },
            readOnly: true
        }
    };

    function decodeClaims(token) {
        if (!token || token.split(".").length < 2) {
            return {};
        }
        try {
            const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
            const padded = part + "=".repeat((4 - part.length % 4) % 4);
            return JSON.parse(window.atob(padded));
        } catch (error) {
            return {};
        }
    }

    function showAlert(message, kind) {
        alertBox.className = "alert alert-" + (kind || "danger") + " shadow-sm";
        alertBox.textContent = message;
        alertBox.hidden = false;
    }

    function hideAlert() {
        alertBox.hidden = true;
        alertBox.textContent = "";
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (text !== undefined && text !== null) {
            node.textContent = String(text);
        }
        return node;
    }

    function showErrorPage() {
        window.location.replace("403.html");
    }

    if (!api.getAccessToken() && !api.getRefreshToken()) {
        window.location.replace("login.html");
        return;
    }
    if (resourceName === "members" && !staff) {
        showErrorPage();
        return;
    }

    document.querySelectorAll('[data-role="staff"]').forEach(function (item) {
        item.hidden = !staff;
    });
    document.querySelectorAll(".navbar-toggler").forEach(function (button) {
        button.addEventListener("click", function () {
            const target = document.querySelector(button.dataset.bsTarget);
            if (target) {
                const expanded = target.classList.toggle("show");
                button.setAttribute("aria-expanded", String(expanded));
            }
        });
    });
    const greeting = document.getElementById("user-greeting");
    if (greeting) {
        greeting.textContent = "Hola, " + userName;
    }
    document.querySelectorAll('[data-action="logout"]').forEach(function (button) {
        button.addEventListener("click", function () {
            button.disabled = true;
            api.logout();
        });
    });

    if (resourceName === "dashboard") {
        renderDashboard();
    } else {
        renderResource(resources[resourceName]);
    }

    async function fetchCollection(endpoint) {
        let payload = await api.apiFetch(endpoint);
        let items = [];
        let next = null;
        if (Array.isArray(payload)) {
            items = payload;
        } else if (payload && Array.isArray(payload.results)) {
            items = payload.results;
            next = payload.next;
        } else if (payload && Array.isArray(payload.data)) {
            items = payload.data;
        }

        while (next) {
            const nextUrl = new URL(next, config.API_BASE);
            if (nextUrl.origin !== new URL(config.API_BASE).origin) {
                throw new Error("La paginación de la API devolvió un dominio inesperado.");
            }
            payload = await api.apiFetch(nextUrl.pathname + nextUrl.search);
            if (!payload || !Array.isArray(payload.results)) {
                break;
            }
            items = items.concat(payload.results);
            next = payload.next;
        }
        return items;
    }

    async function renderDashboard() {
        hideAlert();
        content.replaceChildren();
        showAlert("Cargando información del panel...", "info");
        const heading = element("div", "mb-4");
        heading.appendChild(element("p", "eyebrow mb-2", staff ? "Administración FitLife" : "Tu espacio FitLife"));
        heading.appendChild(element("h1", "display-6 fw-bold mb-2", staff ? "Panel de control" : "Mi panel"));
        heading.appendChild(element("p", "text-muted mb-0", staff ? "Un resumen de la actividad del centro deportivo." : "Consulta tus planes, clases y actividad."));
        content.appendChild(heading);

        const metricRow = element("div", "row g-4");
        content.appendChild(metricRow);
        const endpoints = staff
            ? [["Socios", "/api/members/", "icon-blue"], ["Membresías", "/api/memberships/", "icon-purple"], ["Pagos", "/api/payments/", "icon-orange"], ["Clases", "/api/classes/", "icon-blue"]]
            : [["Mis membresías", "/api/memberships/", "icon-purple"], ["Mis pagos", "/api/payments/", "icon-orange"], ["Clases", "/api/classes/", "icon-blue"], ["Mis reservas", "/api/bookings/", "icon-purple"]];

        try {
            const values = await Promise.all(endpoints.map(async function (entry) {
                return { label: entry[0], count: (await fetchCollection(entry[1])).length, icon: entry[2] };
            }));
            hideAlert();
            values.forEach(function (metric) {
                const col = element("div", "col-12 col-sm-6 col-xl-3");
                const card = element("article", "metric-card h-100");
                const body = element("div", "card-body p-4");
                const top = element("div", "d-flex justify-content-between align-items-start");
                top.appendChild(element("span", "metric-label", metric.label));
                top.appendChild(element("span", "metric-icon " + metric.icon, "•"));
                body.appendChild(top);
                body.appendChild(element("p", "metric-value mb-0 mt-3", metric.count));
                card.appendChild(body);
                col.appendChild(card);
                metricRow.appendChild(col);
            });
            renderDashboardLinks();
        } catch (error) {
            showAlert(error.message || "No se pudo cargar el panel.", "danger");
        }
    }

    function renderDashboardLinks() {
        const section = element("section", "card border-0 mt-4");
        const body = element("div", "card-body p-4");
        body.appendChild(element("h2", "h5 fw-bold mb-3", "Accesos rápidos"));
        const links = staff
            ? [["Planes", "plans.html"], ["Socios", "members.html"], ["Membresías", "memberships.html"], ["Pagos", "payments.html"], ["Clases", "classes.html"], ["Reservas", "bookings.html"]]
            : [["Planes", "plans.html"], ["Mis membresías", "memberships.html"], ["Clases", "classes.html"], ["Mis reservas", "bookings.html"]];
        const row = element("div", "d-flex flex-wrap gap-2");
        links.forEach(function (item) {
            const link = element("a", "btn btn-outline-primary", item[0]);
            link.href = item[1];
            row.appendChild(link);
        });
        body.appendChild(row);
        section.appendChild(body);
        content.appendChild(section);
    }

    function renderResource(resource) {
        if (!resource) {
            window.location.replace("404.html");
            return;
        }

        const canEdit = staff && !resource.readOnly;
        const header = element("div", "page-toolbar mb-4");
        const titleBlock = element("div");
        titleBlock.appendChild(element("p", "eyebrow mb-2", staff ? "Panel administrativo" : "Mi cuenta"));
        titleBlock.appendChild(element("h1", "display-6 fw-bold mb-2", resource.title));
        titleBlock.appendChild(element("p", "text-muted mb-0", resource.description));
        header.appendChild(titleBlock);

        const actions = element("div", "d-flex flex-wrap align-items-center gap-2");
        const search = element("input", "form-control search-control");
        search.type = "search";
        search.placeholder = "Buscar...";
        search.setAttribute("aria-label", "Buscar en " + resource.title.toLowerCase());
        actions.appendChild(search);
        if (resource.filter) {
            const filter = element("select", "form-select");
            filter.setAttribute("aria-label", "Filtrar por " + resource.filter.label.toLowerCase());
            addOption(filter, "", "Todos los estados");
            resource.filter.values.forEach(function (choice) {
                addOption(filter, choice[0], choice[1]);
            });
            actions.appendChild(filter);
            resource.filterControl = filter;
        }
        if (canEdit) {
            const addButton = element("button", "btn btn-primary", resourceName === "members" ? "Nuevo socio" : "Crear");
            addButton.type = "button";
            addButton.addEventListener("click", function () {
                openEditor(resource, null);
            });
            actions.appendChild(addButton);
        }
        header.appendChild(actions);
        content.replaceChildren(header);

        const card = element("section", "card border-0 overflow-hidden");
        const responsive = element("div", "table-responsive");
        const table = element("table", "table table-hover align-middle mb-0");
        const thead = element("thead");
        const headerRow = element("tr");
        resource.columns.forEach(function (column) {
            headerRow.appendChild(element("th", "", column[1]));
        });
        if (canEdit) {
            headerRow.appendChild(element("th", "text-end pe-4", "Acciones"));
        }
        thead.appendChild(headerRow);
        const tbody = element("tbody");
        table.append(thead, tbody);
        responsive.appendChild(table);
        card.appendChild(responsive);
        content.appendChild(card);

        let records = [];
        const empty = element("div", "alert alert-info mt-3 empty-state", "No hay registros para mostrar.");
        empty.hidden = true;
        content.appendChild(empty);
        search.addEventListener("input", renderRows);
        if (resource.filterControl) {
            resource.filterControl.addEventListener("change", renderRows);
        }

        async function reload() {
            hideAlert();
            empty.hidden = true;
            tbody.replaceChildren();
            showAlert("Cargando " + resource.title.toLowerCase() + "...", "info");
            try {
                records = await fetchCollection(resource.endpoint);
                hideAlert();
                renderRows();
            } catch (error) {
                showAlert(error.message || "No fue posible cargar los datos.", "danger");
            }
        }
        resource.reload = reload;

        function renderRows() {
            tbody.replaceChildren();
            const searchTerm = search.value.trim().toLocaleLowerCase("es");
            const filterValue = resource.filterControl ? resource.filterControl.value : "";
            const visible = records.filter(function (record) {
                const matchesSearch = !searchTerm || resource.columns.some(function (column) {
                    return displayValue(column[0], record[column[0]]).toLocaleLowerCase("es").includes(searchTerm);
                });
                const matchesFilter = !filterValue || String(record[resource.filter.key]) === filterValue;
                return matchesSearch && matchesFilter;
            });

            if (!visible.length) {
                empty.hidden = false;
                empty.textContent = records.length ? "No hay resultados que coincidan con la búsqueda o filtro." : "No hay registros para mostrar.";
                return;
            }
            empty.hidden = true;
            visible.forEach(function (record) {
                const row = element("tr");
                resource.columns.forEach(function (column) {
                    const cell = element("td");
                    if (column[0] === "receipt_url") {
                        const link = safeHttpsLink(record.receipt_url);
                        if (link) {
                            link.className = "btn btn-sm btn-outline-primary";
                            link.textContent = "Ver comprobante";
                            link.target = "_blank";
                            link.rel = "noopener noreferrer";
                            cell.appendChild(link);
                        } else {
                            cell.textContent = "—";
                        }
                    } else {
                        cell.textContent = displayValue(column[0], record[column[0]]);
                    }
                    row.appendChild(cell);
                });
                if (canEdit) {
                    const cell = element("td", "text-end pe-4");
                    const edit = element("button", "btn btn-sm btn-outline-primary me-1", "Editar");
                    edit.type = "button";
                    edit.addEventListener("click", function () { openEditor(resource, record); });
                    const remove = element("button", "btn btn-sm btn-outline-danger", "Eliminar");
                    remove.type = "button";
                    remove.addEventListener("click", function () { removeRecord(resource, record, reload); });
                    cell.append(edit, remove);
                    row.appendChild(cell);
                }
                tbody.appendChild(row);
            });
        }

        reload();
    }

    function safeHttpsLink(value) {
        if (typeof value !== "string" || !value) {
            return null;
        }
        try {
            const url = new URL(value, config.API_BASE);
            return url.protocol === "https:" ? url : null;
        } catch (error) {
            return null;
        }
    }

    function displayValue(key, value) {
        if (value === null || value === undefined || value === "") {
            return "—";
        }
        if (key === "active") {
            return value ? "Activo" : "Inactivo";
        }
        if (key === "monthly_price" || key === "amount") {
            const amount = Number(value);
            return Number.isFinite(amount) ? "$" + amount.toLocaleString("es-CL") : String(value);
        }
        if (key.endsWith("_at")) {
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("es-CL");
        }
        if (key.endsWith("_date")) {
            const date = new Date(value + "T00:00:00");
            return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("es-CL");
        }
        if (typeof value === "object") {
            return value.username || value.name || value.id || "—";
        }
        if (key === "estado") {
            return ({ ACTIVE: "Activa", EXPIRED: "Vencida", FROZEN: "Congelada" })[value] || String(value);
        }
        if (key === "status") {
            return ({ PENDING: "Pendiente", PAID: "Pagado", REFUNDED: "Reembolsado", CONFIRMED: "Confirmada", WAITLIST: "Lista de espera", CANCELLED: "Cancelada" })[value] || String(value);
        }
        if (key === "payment_method") {
            return ({ CASH: "Efectivo", CARD: "Tarjeta", TRANSFER: "Transferencia" })[value] || String(value);
        }
        return String(value);
    }

    function addOption(select, value, label) {
        const option = element("option", "", label);
        option.value = value;
        select.appendChild(option);
    }

    async function openEditor(resource, record) {
        const isCreate = !record;
        const fields = resourceName === "members" ? (isCreate ? resource.createFields : resource.fields) : resource.fields;
        const modalElement = element("div", "modal fade show d-block");
        modalElement.tabIndex = -1;
        modalElement.setAttribute("role", "dialog");
        modalElement.setAttribute("aria-modal", "true");
        const dialog = element("div", "modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable");
        const modalContent = element("div", "modal-content");
        const modalHeader = element("div", "modal-header");
        modalHeader.appendChild(element("h2", "modal-title fs-5 fw-bold", (isCreate ? "Crear " : "Editar ") + resource.singular));
        const close = element("button", "btn-close");
        close.type = "button";
        close.setAttribute("data-bs-dismiss", "modal");
        close.setAttribute("aria-label", "Cerrar");
        modalHeader.appendChild(close);

        const form = element("form", "needs-validation");
        form.noValidate = true;
        const modalBody = element("div", "modal-body");
        const formAlert = element("div", "alert alert-danger");
        formAlert.hidden = true;
        formAlert.setAttribute("role", "alert");
        modalBody.appendChild(formAlert);

        try {
            const controls = [];
            for (const field of fields) {
                const wrapper = element("div", "mb-3");
                const id = "field-" + field.key;
                if (field.type !== "checkbox") {
                    const label = element("label", "form-label fw-semibold", field.label);
                    label.htmlFor = id;
                    wrapper.appendChild(label);
                }
                const control = await createField(field, record, id);
                if (field.type === "checkbox") {
                    const check = element("div", "form-check");
                    control.className = "form-check-input";
                    const label = element("label", "form-check-label fw-semibold", field.label);
                    label.htmlFor = id;
                    check.append(control, label);
                    wrapper.appendChild(check);
                } else {
                    wrapper.appendChild(control);
                }
                if (field.required) {
                    control.required = true;
                }
                controls.push({ field: field, control: control });
                modalBody.appendChild(wrapper);
            }

            const modalFooter = element("div", "modal-footer");
            const cancel = element("button", "btn btn-outline-secondary", "Cancelar");
            cancel.type = "button";
            cancel.setAttribute("data-bs-dismiss", "modal");
            const submit = element("button", "btn btn-primary", isCreate ? "Crear" : "Guardar cambios");
            submit.type = "submit";
            modalFooter.append(cancel, submit);
            form.append(modalBody, modalFooter);
            modalContent.append(modalHeader, form);
            dialog.appendChild(modalContent);
            modalElement.appendChild(dialog);
            document.body.appendChild(modalElement);

            const backdrop = element("div", "modal-backdrop-custom");
            function closeModal() {
                modalElement.remove();
                backdrop.remove();
                document.removeEventListener("keydown", handleEscape);
            }
            function handleEscape(event) {
                if (event.key === "Escape") {
                    closeModal();
                }
            }
            document.body.appendChild(backdrop);
            modalElement.addEventListener("click", function (event) {
                if (event.target === modalElement) {
                    closeModal();
                }
            });
            modalElement.querySelectorAll('[data-bs-dismiss="modal"]').forEach(function (button) {
                button.addEventListener("click", closeModal);
            });
            document.addEventListener("keydown", handleEscape);

            form.addEventListener("submit", async function (event) {
                event.preventDefault();
                formAlert.hidden = true;
                if (!form.checkValidity()) {
                    form.classList.add("was-validated");
                    return;
                }
                submit.disabled = true;
                submit.textContent = "Guardando...";
                try {
                    const data = collectFormData(controls);
                    if (resourceName === "members" && isCreate) {
                        await api.apiFetch("/api/auth/register/", { method: "POST", body: data.json });
                    } else {
                        const method = isCreate ? "POST" : "PATCH";
                        const route = resource.endpoint + (isCreate ? "" : encodeURIComponent(record.id) + "/");
                        const body = resourceName === "payments" ? data.formData : data.json;
                        await api.apiFetch(route, { method: method, body: body });
                    }
                    closeModal();
                    if (typeof resource.reload === "function") {
                        await resource.reload();
                    }
                    showAlert("Los cambios se guardaron correctamente.", "success");
                } catch (error) {
                    formAlert.textContent = error.message || "No fue posible guardar los cambios.";
                    formAlert.hidden = false;
                    submit.disabled = false;
                    submit.textContent = isCreate ? "Crear" : "Guardar cambios";
                }
            });
        } catch (error) {
            showAlert(error.message || "No se pudo abrir el formulario.", "danger");
        }
    }

    async function createField(field, record, id) {
        let control;
        if (field.type === "textarea") {
            control = element("textarea", "form-control");
            control.rows = 3;
        } else if (field.type === "select" || field.type === "select-static") {
            control = element("select", "form-select");
            addOption(control, "", "Selecciona una opción");
            if (field.type === "select-static") {
                field.options.forEach(function (option) { addOption(control, option[0], option[1]); });
            } else {
                const options = await fetchCollection(field.endpoint);
                options.forEach(function (option) {
                    addOption(control, option.id, option[field.optionLabel] || option.id);
                });
            }
        } else {
            control = element("input", field.type === "checkbox" ? "form-check-input" : "form-control");
            control.type = field.type === "checkbox" ? "checkbox" : (field.type || "text");
        }
        control.id = id;
        control.name = field.key;
        if (field.type === "file") {
            control.accept = field.accept;
        }
        if (field.min !== undefined) {
            control.min = field.min;
        }
        if (field.step !== undefined) {
            control.step = field.step;
        }
        if (field.minLength !== undefined) {
            control.minLength = field.minLength;
        }
        if (field.type === "checkbox") {
            control.checked = record ? Boolean(record[field.key]) : Boolean(field.defaultValue);
        } else if (record && record[field.key] !== undefined && field.type !== "file") {
            const value = record[field.key];
            control.value = value && typeof value === "object" ? value.id : value;
        } else if (field.defaultValue !== undefined) {
            control.value = field.defaultValue;
        } else if (field.type === "datetime-local" && field.key === "paid_at") {
            control.value = new Date().toISOString().slice(0, 16);
        }
        return control;
    }

    function collectFormData(controls) {
        const json = {};
        const formData = new FormData();
        let hasFile = false;
        controls.forEach(function (entry) {
            const field = entry.field;
            const control = entry.control;
            if (field.type === "file") {
                const file = control.files && control.files[0];
                if (file) {
                    if (file.size > 2 * 1024 * 1024) {
                        throw new Error("El comprobante no puede superar 2 MB.");
                    }
                    const validType = ["application/pdf", "image/png", "image/jpeg"].indexOf(file.type) !== -1;
                    if (!validType) {
                        throw new Error("El comprobante debe ser PDF, PNG o JPG.");
                    }
                    formData.append(field.key, file);
                    hasFile = true;
                }
                return;
            }
            if (control.type === "checkbox") {
                json[field.key] = control.checked;
            } else if (control.value !== "") {
                let value = control.value;
                if (field.type === "number" || field.type === "select") {
                    value = field.type === "number" ? Number(value) : Number(value);
                } else if (field.type === "datetime-local") {
                    value = new Date(value).toISOString();
                }
                json[field.key] = value;
            }
        });
        Object.keys(json).forEach(function (key) {
            if (hasFile) {
                formData.append(key, String(json[key]));
            }
        });
        return { json: json, formData: hasFile ? formData : json };
    }

    async function removeRecord(resource, record, reload) {
        const label = record.name || record.username || record.reference || ("#" + record.id);
        if (!window.confirm("¿Eliminar " + label + "? Esta acción no se puede deshacer.")) {
            return;
        }
        try {
            await api.apiFetch(resource.endpoint + encodeURIComponent(record.id) + "/", { method: "DELETE" });
            showAlert("El registro se eliminó correctamente.", "success");
            await reload();
        } catch (error) {
            showAlert(error.message || "No fue posible eliminar el registro.", "danger");
        }
    }
}());
