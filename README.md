# FitLife Frontend

Frontend estático en HTML, CSS, Bootstrap 5 por CDN y JavaScript clásico. No usa frameworks, módulos ni proceso de build. El diseño toma como referencia EVA3: navbar azul marino, fondo claro, tarjetas redondeadas, tablas suaves y formularios accesibles.

## Archivos y publicación

- `config.js` es la configuración central; reemplaza los dos valores de ejemplo por el dominio de API Gateway y el dominio de CloudFront.
- Nginx sirve los HTML y `config.js`.
- Publica el contenido de `assets/` en el prefijo `public/assets/` del bucket/origen de CloudFront. Así, por ejemplo, `assets/js/api.js` debe quedar en `public/assets/js/api.js`.
- Cada HTML carga `/config.js`; este añade el CSS y el JavaScript de la aplicación usando `ASSET_BASE`. No hay JavaScript ni estilos inline.
- Las páginas de administración usan el JWT para mostrar/ocultar la navegación y las acciones. La autorización real debe seguir aplicándose en la API; el navegador no es un límite de seguridad.

## Probar localmente

1. En `config.js`, configura temporalmente `ASSET_BASE` como `http://localhost:8000/assets` y `API_BASE` como la URL HTTPS de la API.
2. Desde esta carpeta ejecuta `python -m http.server 8000`.
3. Abre `http://localhost:8000/`. Se redirige a `login.html` o al panel según los tokens de la pestaña.
4. Inicia sesión con un usuario existente. Prueba listar/buscar/filtrar, crear/editar/eliminar con un usuario staff, y las vistas de solo lectura con un socio.
5. Para volver a producción, restaura en `config.js` el dominio CloudFront. Configura CORS en API Gateway para permitir el origen del frontend y los encabezados `Authorization` y `Content-Type`, además de los métodos usados.

No se necesita `npm install`, compilación ni servidor de desarrollo especial.

## Contrato de API esperado

Las rutas siguen el backend EVA3: `/api/token/`, `/api/token/refresh/`, `/api/token/blacklist/`, `/api/plans/`, `/api/members/`, `/api/memberships/`, `/api/payments/`, `/api/classes/`, `/api/bookings/` y `/api/auth/register/`. Se esperan respuestas REST tipo Django REST Framework (lista o `{ "results": [...] }`) y los campos definidos por sus modelos: `name`, `monthly_price`, `member`, `plan`, `start_date`, `end_date`, `estado`, `amount`, `reference`, `payment_method`, `status`, etc.

El socio se registra mediante `/api/auth/register/`; la edición/eliminación de su perfil usa `/api/members/{id}/`. La API debe devolver en pagos `receipt_url` cuando haya comprobante. El formulario envía el archivo como `multipart/form-data` en el campo `receipt` (PDF/PNG/JPG, hasta 2 MB), igual que el backend EVA3. El enlace se muestra solo si `receipt_url` es HTTPS; si el backend configura esa URL como prefirmada de S3, el botón abre el enlace prefirmado. El backend EVA3 inspeccionado no expone una ruta de carga directa a S3 prefirmada, por lo que la carga se realiza al endpoint de pagos; se requiere añadir ese contrato en backend para hacer PUT directo a S3.

Para habilitar los controles de staff, incluye `is_staff: true` (o `role: "staff"`) en las claims del JWT. El JWT SimpleJWT por defecto no incluye necesariamente ese dato. La API debe verificar permisos y filtrar los datos propios del socio independientemente de las restricciones visuales.

## Content Security Policy para Nginx

Sustituye los dominios de ejemplo por los reales y entrega estas directivas como cabecera HTTP (no como `<meta>`):

```nginx
add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://cdn.jsdelivr.net https://DOMINIO_CF; script-src-attr 'none'; style-src 'self' https://cdn.jsdelivr.net https://DOMINIO_CF; style-src-attr 'none'; img-src 'self' https://DOMINIO_CF; font-src 'self'; connect-src 'self' https://ID_API.execute-api.us-east-1.amazonaws.com" always;
```

La CSP no permite `unsafe-inline`; los únicos scripts de la aplicación se cargan desde CloudFront (y el cargador `config.js` desde Nginx). Bootstrap CSS se carga desde jsDelivr.
