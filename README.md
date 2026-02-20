# Flora V2 · Catálogo Web + Domicilios

Este repositorio contiene dos vistas funcionales de Flora:

- **Catálogo web de tienda** (experiencia de compra y pedido).
- **Panel de domicilios** (operación logística y seguimiento de entregas).

## Alcance por módulo

### 1) Catálogo web (tienda Flora)

- Archivos:
	- `index.html`
	- `style.css`
	- `script.js`
- Funcionalidad principal:
	- Catálogo de productos con buscador.
	- Carrito de compras (drawer), subtotal, IVA y domicilio.
	- Flujo de pedido con formulario de cliente y entrega.
	- Integración con Google Apps Script para cargar catálogo/barrios y registrar pedidos.

### 2) Domicilios (operación logística)

- Archivos:
	- `domicilios-web.html`
	- `domicilios-web.css`
	- `domicilios-web.js`
	- `manifest.webmanifest`
	- `sw.js`
- Funcionalidad principal:
	- Búsqueda y filtros de pedidos.
	- Asignación de domiciliarios.
	- Registro de domiciliario externo (nombre/teléfono).
	- Cambio de estado (`Pendiente`, `En Ruta`, `Entregado`).
	- PWA instalable con caché offline básico.

## Estructura del proyecto

```text
flora_v2/
├─ index.html                  # Catálogo web
├─ style.css                   # Estilos catálogo
├─ script.js                   # Lógica catálogo
├─ domicilios-web.html
├─ domicilios-web.css
├─ domicilios-web.js
├─ manifest.webmanifest
├─ sw.js
└─ img/
```

## Requisitos

- Navegador moderno (Chrome, Edge, Firefox).
- Servir el proyecto desde `http://` o `https://` (no abrir con `file://`) para que funcione el Service Worker y la instalación PWA.

## Ejecutar en local

### Opción 1: VS Code Live Server

1. Instala la extensión **Live Server**.
2. Abre la vista que necesites:
	- `index.html` (Catálogo web)
	- `domicilios-web.html` (Domicilios)
3. Ejecuta **Open with Live Server**.

### Opción 2: Python

Desde la carpeta del proyecto:

```bash
python -m http.server 5500
```

Luego abre:

- `http://localhost:5500/index.html` (Catálogo web)
- `http://localhost:5500/domicilios-web.html` (Domicilios)

## Integración de datos

Ambos módulos consumen/actualizan datos mediante Google Apps Script.

- En `script.js` (catálogo): carga catálogo y barrios, y registra pedidos.
- En `domicilios-web.js` (domicilios): consulta pedidos y ejecuta acciones logísticas.

- `SCRIPT_URL`: endpoint de integración para las operaciones de ambos módulos.

Si cambias de backend o endpoint, actualiza esa constante.

## Flujo de domiciliario externo (módulo domicilios)

1. En la tarjeta del pedido, selecciona `Externo`.
2. Se abre el modal para diligenciar `Nombre` y `Teléfono`.
3. Al guardar, queda asignado como externo y el pedido se actualiza en UI.
4. El encabezado del grupo muestra nombre (y teléfono cuando exista) del externo.

## PWA (App instalable)

Actualmente se implementa para el módulo de **Domicilios**.

Incluye:

- `manifest.webmanifest` con nombre, íconos y modo `standalone`.
- `sw.js` para caché de recursos estáticos y fallback offline básico.
- Registro del service worker en `domicilios-web.js`.

Para instalar:

1. Abre la app desde servidor (`http/https`).
2. Recarga una vez.
3. Usa la opción del navegador: **Instalar app** / **Agregar a pantalla de inicio**.

## Despliegue

Puedes publicarla como sitio estático en:

- GitHub Pages
- Netlify
- Vercel (static)
- Cualquier hosting de archivos estáticos

Asegúrate de mantener accesibles:

- `manifest.webmanifest`
- `sw.js`
- `img/logo 2024 marca registrada-04.png`

## Notas

- Si actualizas `sw.js`, incrementa la versión de caché (`CACHE_VERSION`) para forzar renovación de archivos.
- El modo offline es básico (recursos estáticos y fallback de navegación).

## Autoría

Proyecto interno de Join Data / Flora App.
