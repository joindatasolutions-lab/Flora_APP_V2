const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwdixPJBCFos9aUaUT_NDxQ2ZMW3s2CXoQ0KRNVNe8aYmaXtTSONvKgPRXIFcFpSSmO/exec";

const STORE_COORDS = {
  lat: Number(globalThis.STORE_COORDS?.lat ?? 10.998455),
  lng: Number(globalThis.STORE_COORDS?.lng ?? -74.806981)
};

const GOOGLE_MAPS_API_KEY = (globalThis.GOOGLE_MAPS_API_KEY || "").toString().trim();

const getById = id => document.getElementById(id);

const dom = {
  statsCount: getById("statsCount"),
  btnRefresh: getById("btnRefresh"),
  btnGenerateRoutes: getById("btnGenerateRoutes"),
  routeCourierSelect: getById("routeCourierSelect"),
  toast: getById("toast"),
  panelList: getById("panel-lista"),
  panelRoute: getById("panel-ruta"),
  panelMap: getById("panel-mapa"),
  chipButtons: Array.from(document.querySelectorAll(".filter-chip")),
  tabButtons: Array.from(document.querySelectorAll(".tab-button"))
};

const state = {
  cache: [],
  currentView: "list",
  activeFilter: "today",
  listSortKey: "time",
  listSortDirection: "asc",
  expandedRows: {},
  routeMetrics: {},
  optimizedPath: [],
  optimizedCourier: "",
  map: null,
  mapMarkers: [],
  mapPolyline: null,
  infoWindow: null,
  mapsReady: false,
  toastTimer: null,
  lastFiltered: []
};

function mostrarToast(msg) {
  if (!dom.toast) return;
  globalThis.clearTimeout(state.toastTimer);
  dom.toast.textContent = msg;
  dom.toast.classList.add("show");
  state.toastTimer = globalThis.setTimeout(() => {
    dom.toast.classList.remove("show");
  }, 2400);
}

function normalizarTexto(value) {
  return (value ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function limpiarTelefono(telefono) {
  return (telefono || "").toString().replaceAll(/\D/g, "");
}

function telefonoTelHref(telefono) {
  const raw = (telefono || "").toString().trim();
  if (!raw) return "";
  const tel = raw.startsWith("+") ? `+${limpiarTelefono(raw)}` : limpiarTelefono(raw);
  return tel ? `tel:${tel}` : "";
}

function telefonoWhatsAppHref(telefono) {
  const limpio = limpiarTelefono(telefono);
  return limpio ? `https://wa.me/${limpio}` : "";
}

function mapsHref(direccion) {
  const dir = (direccion || "").toString().trim();
  return dir ? `https://maps.google.com/?q=${encodeURIComponent(dir)}` : "";
}

function toCoord(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replaceAll(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function getOrderId(pedido) {
  return String(
    pedido.order_id || pedido["N°Pedido"] || pedido.pedido || pedido.id || ""
  ).trim();
}

function getAddress(pedido) {
  return (pedido.address || pedido.direccion || "").toString().trim();
}

function getNeighborhood(pedido) {
  return (pedido.neighborhood || pedido.barrio || "").toString().trim();
}

function getPhone(pedido) {
  return (pedido.telefonoDestino || pedido.telefono || pedido.phone || "").toString().trim();
}

function getLatitude(pedido) {
  return toCoord(pedido.latitude ?? pedido.latitud ?? pedido.lat);
}

function getLongitude(pedido) {
  return toCoord(pedido.longitude ?? pedido.longitud ?? pedido.lng);
}

function getStatus(pedido) {
  return (pedido.estado || "Pendiente").toString().trim();
}

function getDeliveryDateRaw(pedido) {
  return (
    pedido.delivery_date ||
    pedido.fechaEntrega ||
    pedido.fecha_entrega ||
    pedido.fecha ||
    pedido["FechaEntrega"] ||
    pedido["Fecha Entrega"] ||
    pedido["Fecha de entrega"] ||
    ""
  );
}

function getDeliveryTimeRaw(pedido) {
  return (
    pedido.delivery_time ||
    pedido.horaEntrega ||
    pedido.hora ||
    pedido["Hora Entrega"] ||
    ""
  );
}

function getDeliveryType(pedido) {
  const raw =
    pedido.tipo_entrega ||
    pedido.tipoEntrega ||
    pedido["Tipo entrega"] ||
    pedido["TipoEntrega"] ||
    pedido["tipo entrega"] ||
    "";

  if (raw) return normalizarTexto(raw);

  const zone = normalizarTexto(pedido.zona || "");
  return zone.includes("recoger") ? "recoger" : "domicilio";
}

function getAssignedCourier(pedido) {
  return (
    pedido._assignedCourier ||
    pedido.courier ||
    pedido.domiciliario ||
    pedido["Domiciliario"] ||
    "Sin asignar"
  ).toString().trim();
}

function esFechaHoy(fecha) {
  if (!fecha) return false;
  const texto = fecha.toString().trim().replaceAll(" - ", " ");
  const parsed = new Date(texto);
  const hoy = new Date();
  if (Number.isNaN(parsed.getTime())) return false;
  return (
    parsed.getFullYear() === hoy.getFullYear() &&
    parsed.getMonth() === hoy.getMonth() &&
    parsed.getDate() === hoy.getDate()
  );
}

function timestampEntrega(pedido) {
  const rawDate = getDeliveryDateRaw(pedido);
  const rawTime = getDeliveryTimeRaw(pedido);
  const composed = `${rawDate || ""} ${rawTime || ""}`.trim().replaceAll(" - ", " ");
  const parsed = new Date(composed || String(rawDate || "").trim());
  return Number.isNaN(parsed.getTime()) ? Number.MAX_SAFE_INTEGER : parsed.getTime();
}

function formatDeliveryTime(pedido) {
  const stamp = timestampEntrega(pedido);
  if (!Number.isFinite(stamp) || stamp === Number.MAX_SAFE_INTEGER) {
    const raw = getDeliveryTimeRaw(pedido);
    return raw ? raw.toString().trim() : "Sin hora";
  }
  return new Date(stamp).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function getRouteMetric(pedido) {
  return state.routeMetrics[getOrderId(pedido)] || null;
}

function getUrgencyInfo(pedido) {
  const stamp = timestampEntrega(pedido);
  if (!Number.isFinite(stamp) || stamp === Number.MAX_SAFE_INTEGER) {
    return {
      cardClass: "urgency-unknown",
      pillClass: "unknown",
      label: "Sin hora"
    };
  }

  const diffMinutes = Math.round((stamp - Date.now()) / 60000);
  if (diffMinutes < 0) {
    return {
      cardClass: "urgency-late",
      pillClass: "late",
      label: `Tarde ${Math.abs(diffMinutes)} min`
    };
  }
  if (diffMinutes <= 30) {
    return {
      cardClass: "urgency-soon",
      pillClass: "soon",
      label: `En ${diffMinutes} min`
    };
  }
  return {
    cardClass: "urgency-safe",
    pillClass: "safe",
    label: `En ${diffMinutes} min`
  };
}

function actionLink(label, href, tone = "secondary") {
  if (!href) return `<span class="action-link ${tone}" aria-disabled="true">${label}</span>`;
  return `<a class="action-link ${tone}" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function parseResponse(res, raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Respuesta no JSON desde API", error);
    return null;
  }
}

function isOkResponse(res, data, keywords) {
  const statusValue = (data?.status || data?.result || data?.message || "").toString().toLowerCase();
  const flag = data?.success === true || data?.ok === true;
  const text = keywords.test(statusValue);
  return res.ok && (flag || text || data === null || statusValue === "");
}

function isDeliveryOrder(pedido) {
  return getDeliveryType(pedido) === "domicilio";
}

function getAvailableCouriers(data = state.cache) {
  return Array.from(new Set(
    data
      .map(pedido => getAssignedCourier(pedido))
      .filter(courier => courier && normalizarTexto(courier) !== "sin asignar")
  )).sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

function syncRouteCourierOptions() {
  if (!dom.routeCourierSelect) return;
  const available = getAvailableCouriers();
  const current = dom.routeCourierSelect.value;
  dom.routeCourierSelect.innerHTML = '<option value="">Selecciona un domiciliario</option>';
  available.forEach(courier => {
    const option = document.createElement("option");
    option.value = courier;
    option.textContent = courier;
    dom.routeCourierSelect.appendChild(option);
  });

  if (current && available.includes(current)) {
    dom.routeCourierSelect.value = current;
    state.optimizedCourier = current;
  } else if (state.optimizedCourier && available.includes(state.optimizedCourier)) {
    dom.routeCourierSelect.value = state.optimizedCourier;
  } else {
    dom.routeCourierSelect.value = "";
    if (!available.includes(state.optimizedCourier)) state.optimizedCourier = "";
  }
}

function actualizarEnCache(pedidoId, patch) {
  const id = String(pedidoId ?? "");
  const item = state.cache.find(pedido => getOrderId(pedido) === id);
  if (item) Object.assign(item, patch);
}

function matchesStatusFilter(pedido) {
  const status = normalizarTexto(getStatus(pedido));
  if (state.activeFilter === "pending") {
    return status.includes("pendiente") || status.includes("problema") || status.includes("incidencia") || status.includes("error");
  }
  if (state.activeFilter === "en-route") {
    return status.includes("en ruta");
  }
  if (state.activeFilter === "delivered") {
    return status.includes("entregado");
  }
  return true;
}

function ordenarData(data) {
  const ordered = [...data];
  ordered.sort((a, b) => {
    const metricA = getRouteMetric(a);
    const metricB = getRouteMetric(b);
    if (metricA && metricB) return metricA.sortIndex - metricB.sortIndex;
    if (metricA) return -1;
    if (metricB) return 1;
    return timestampEntrega(a) - timestampEntrega(b);
  });
  return ordered;
}

function filtrarData(data) {
  return ordenarData(data.filter(pedido => isDeliveryOrder(pedido) && matchesStatusFilter(pedido)));
}

function actualizarStats(total) {
  if (dom.statsCount) dom.statsCount.textContent = String(total);
}

function resetFilters() {
  state.activeFilter = "today";
  syncFilterChips();
  aplicarFiltros();
}

function emptyStateMarkup(title, description) {
  return `
    <div class="empty">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
      <div class="empty-actions">
        <a class="empty-link primary" href="index.html">Crear pedido</a>
        <button class="action-btn" type="button" data-action="clear-filters">Limpiar filtros</button>
      </div>
    </div>
  `;
}

function renderCourierOptions(pedido) {
  const current = getAssignedCourier(pedido);
  const options = ["Sin asignar", ...getAvailableCouriers()];
  if (current && !options.includes(current)) options.push(current);
  const uniqueOptions = Array.from(new Set(options));

  return uniqueOptions.map(courier => {
    const selected = courier === current ? " selected" : "";
    return `<option value="${escapeHtml(courier)}"${selected}>${escapeHtml(courier)}</option>`;
  }).join("");
}

function getStatusClass(status) {
  const normalized = normalizarTexto(status);
  if (normalized.includes("entregado")) return "status-delivered";
  if (normalized.includes("en ruta")) return "status-route";
  if (normalized.includes("problema") || normalized.includes("incidencia") || normalized.includes("error")) {
    return "status-late";
  }
  return "status-pending";
}

function parseDistanceToKm(distanceText) {
  const normalized = normalizarTexto(distanceText);
  if (!normalized) return Number.POSITIVE_INFINITY;

  if (normalized.includes("km")) {
    const value = Number(normalized.replaceAll("km", "").replaceAll(",", ".").trim());
    return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
  }
  if (normalized.includes("m")) {
    const value = Number(normalized.replaceAll("m", "").replaceAll(",", ".").trim());
    return Number.isFinite(value) ? value / 1000 : Number.POSITIVE_INFINITY;
  }

  return Number.POSITIVE_INFINITY;
}

function getSortableValue(pedido, key) {
  if (key === "route") {
    const metric = getRouteMetric(pedido);
    return metric?.routePosition ?? Number.POSITIVE_INFINITY;
  }
  if (key === "distance") {
    const metric = getRouteMetric(pedido);
    return parseDistanceToKm(metric?.distanceText || "");
  }
  return timestampEntrega(pedido);
}

function sortListData(data) {
  const sorted = [...data];
  sorted.sort((a, b) => {
    const va = getSortableValue(a, state.listSortKey);
    const vb = getSortableValue(b, state.listSortKey);
    if (va === vb) return timestampEntrega(a) - timestampEntrega(b);
    return state.listSortDirection === "asc" ? va - vb : vb - va;
  });
  return sorted;
}

function getSortIndicator(key) {
  if (state.listSortKey !== key) return "↕";
  return state.listSortDirection === "asc" ? "↑" : "↓";
}

function getSafeRowId(orderId, index) {
  const raw = String(orderId || index || "pedido").replaceAll(/[^a-zA-Z0-9_-]/g, "-");
  return `order-detail-${raw}-${index}`;
}

function renderListView(data) {
  if (!dom.panelList) return;

  if (!data.length) {
    const title = state.cache.length ? "No hay entregas para este filtro" : "No hay entregas para hoy";
    const description = state.cache.length
      ? "Prueba limpiando filtros o asigna un domiciliario para preparar rutas."
      : "No hay pedidos con entrega a domicilio para hoy. Puedes crear uno nuevo o revisar de nuevo en unos minutos.";
    dom.panelList.innerHTML = emptyStateMarkup(title, description);
    return;
  }

  const rows = sortListData(data).map((pedido, index) => {
    const orderId = getOrderId(pedido) || "-";
    const urgency = getUrgencyInfo(pedido);
    const metric = getRouteMetric(pedido);
    const phone = getPhone(pedido);
    const address = getAddress(pedido) || "Sin direccion";
    const neighborhood = getNeighborhood(pedido) || "Sin barrio";
    const routePosition = metric?.routePosition ? String(metric.routePosition) : "-";
    const distanceText = metric?.distanceText || "Sin estimar";
    const status = getStatus(pedido);
    const detailId = getSafeRowId(orderId, index);
    const expanded = Boolean(state.expandedRows[orderId]);
    let priorityClass = "";
    if (urgency.pillClass === "late") priorityClass = "priority-late";
    if (urgency.pillClass === "soon") priorityClass = "priority-soon";

    return `
      <tr class="ops-row ${priorityClass}" data-order-id="${escapeHtml(orderId)}">
        <td class="cell-pedido">
          <button
            class="row-expand"
            type="button"
            data-action="toggle-row"
            data-order-id="${escapeHtml(orderId)}"
            aria-expanded="${expanded ? "true" : "false"}"
            aria-controls="${escapeHtml(detailId)}">${expanded ? "−" : "+"}</button>
          <strong>#${escapeHtml(orderId)}</strong>
        </td>
        <td>${escapeHtml(formatDeliveryTime(pedido))}</td>
        <td>${escapeHtml(neighborhood)}</td>
        <td class="cell-address">${escapeHtml(address)}</td>
        <td>
          <select class="courier-select table-courier-select" data-order-id="${escapeHtml(orderId)}">
            ${renderCourierOptions(pedido)}
          </select>
        </td>
        <td>${escapeHtml(routePosition)}</td>
        <td>${escapeHtml(distanceText)}</td>
        <td>
          <span class="table-status ${getStatusClass(status)}">${escapeHtml(status)}</span>
        </td>
        <td class="table-actions">
          ${actionLink("Llamar", telefonoTelHref(phone))}
          ${actionLink("WhatsApp", telefonoWhatsAppHref(phone))}
          ${actionLink("Navegar", mapsHref(address), "primary")}
        </td>
      </tr>
      <tr id="${escapeHtml(detailId)}" class="ops-row-details" ${expanded ? "" : "hidden"}>
        <td colspan="9">
          <div class="ops-details-grid">
            <div class="meta-box">
              <span class="meta-label">Barrio</span>
              <span class="meta-value">${escapeHtml(neighborhood)}</span>
            </div>
            <div class="meta-box">
              <span class="meta-label">Dirección</span>
              <span class="meta-value">${escapeHtml(address)}</span>
            </div>
            <div class="meta-box">
              <span class="meta-label">Domiciliario</span>
              <select class="courier-select" data-order-id="${escapeHtml(orderId)}">
                ${renderCourierOptions(pedido)}
              </select>
            </div>
            <div class="meta-box">
              <span class="meta-label">Ruta</span>
              <span class="meta-value">${escapeHtml(routePosition)}</span>
            </div>
            <div class="meta-box">
              <span class="meta-label">Distancia</span>
              <span class="meta-value">${escapeHtml(distanceText)}</span>
            </div>
            <div class="meta-box">
              <span class="meta-label">Estado</span>
              <span class="meta-value">${escapeHtml(status)}</span>
            </div>
          </div>
          <div class="ops-details-actions">
            ${actionLink("Llamar", telefonoTelHref(phone))}
            ${actionLink("WhatsApp", telefonoWhatsAppHref(phone))}
            ${actionLink("Navegar", mapsHref(address), "primary")}
          </div>
        </td>
      </tr>
    `;
  }).join("");

  dom.panelList.innerHTML = `
    <section class="ops-table-wrap">
      <table class="ops-table">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>
              <button class="table-sort" type="button" data-sort="time">
                Hora entrega ${getSortIndicator("time")}
              </button>
            </th>
            <th>Barrio</th>
            <th>Dirección</th>
            <th>Domiciliario</th>
            <th>
              <button class="table-sort" type="button" data-sort="route">
                Ruta ${getSortIndicator("route")}
              </button>
            </th>
            <th>
              <button class="table-sort" type="button" data-sort="distance">
                Distancia ${getSortIndicator("distance")}
              </button>
            </th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `;
}

function renderRouteView(data) {
  if (!dom.panelRoute) return;

  if (!data.length) {
    dom.panelRoute.innerHTML = emptyStateMarkup(
      "No hay entregas para hoy",
      "No hay pedidos de domicilio visibles para construir rutas."
    );
    return;
  }

  const groups = new Map();
  data.forEach(pedido => {
    const courier = getAssignedCourier(pedido);
    if (!groups.has(courier)) groups.set(courier, []);
    groups.get(courier).push(pedido);
  });

  const groupMarkup = Array.from(groups.entries()).map(([courier, orders]) => {
    const items = ordenarData(orders).map((pedido, index) => {
      const metric = getRouteMetric(pedido);
      const position = metric?.routePosition || index + 1;
      const urgency = getUrgencyInfo(pedido);
      const phone = getPhone(pedido);
      const address = getAddress(pedido) || "Sin direccion";

      return `
        <article class="route-item">
          <div class="route-header">
            <div class="route-position">${escapeHtml(position)}</div>
            <span class="urgency-pill ${urgency.pillClass}">${escapeHtml(urgency.label)}</span>
          </div>
          <div class="route-address">${escapeHtml(address)}</div>
          <div class="route-meta-grid">
            <div class="meta-box">
              <span class="meta-label">Pedido</span>
              <span class="meta-value">#${escapeHtml(getOrderId(pedido))}</span>
            </div>
            <div class="meta-box">
              <span class="meta-label">Hora entrega</span>
              <span class="meta-value">${escapeHtml(formatDeliveryTime(pedido))}</span>
            </div>
            <div class="meta-box">
              <span class="meta-label">Distancia estimada</span>
              <span class="meta-value ${metric ? "" : "muted"}">${escapeHtml(metric?.distanceText || "Sin estimar")}</span>
            </div>
            <div class="meta-box">
              <span class="meta-label">Duración estimada</span>
              <span class="meta-value ${metric ? "" : "muted"}">${escapeHtml(metric?.durationText || "Sin estimar")}</span>
            </div>
          </div>
          <div class="route-actions">
            ${actionLink("Llamar", telefonoTelHref(phone))}
            ${actionLink("WhatsApp", telefonoWhatsAppHref(phone))}
            ${actionLink("Navegar", mapsHref(address), "primary")}
          </div>
        </article>
      `;
    }).join("");

    const heading = courier || "Sin asignar";
    const isSelected = state.optimizedCourier && normalizarTexto(heading) === normalizarTexto(state.optimizedCourier);

    return `
      <section class="route-group">
        <div class="route-group-header">
          <strong class="route-group-title">Ruta ${escapeHtml(heading)}</strong>
          <span class="route-group-meta">${escapeHtml(`${orders.length} pedidos${isSelected ? ' · seleccionada' : ''}`)}</span>
        </div>
        ${items}
      </section>
    `;
  }).join("");

  dom.panelRoute.innerHTML = `<section class="route-list">${groupMarkup}</section>`;
}

function getMapSourceData(data) {
  if (!state.optimizedCourier) return data;
  const selected = data.filter(pedido => normalizarTexto(getAssignedCourier(pedido)) === normalizarTexto(state.optimizedCourier));
  return selected.length ? selected : data;
}

function renderMapView(data) {
  if (!dom.panelMap) return;
  const mapData = getMapSourceData(data);

  dom.panelMap.innerHTML = `
    <section class="map-layout">
      <div class="map-banner">
        <strong>Mapa operativo</strong>
        <span>${escapeHtml(`${mapData.length} pedidos visibles`)}</span>
      </div>
      <div id="mapView"></div>
      <div id="mapMessage" class="map-placeholder" hidden></div>
    </section>
  `;

  drawMap(mapData);
}

function syncFilterChips() {
  dom.chipButtons.forEach(button => {
    const active = button.dataset.filter === state.activeFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function syncTabs() {
  dom.tabButtons.forEach(button => {
    const active = button.dataset.view === state.currentView;
    const panelId = button.getAttribute("aria-controls");
    const panel = panelId ? getById(panelId) : null;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
    button.tabIndex = active ? 0 : -1;
    if (panel) {
      panel.hidden = !active;
      panel.classList.toggle("is-active", active);
    }
  });
  document.body.classList.toggle("map-mode", state.currentView === "map");
}

function renderViews(data) {
  state.lastFiltered = data;
  renderListView(data);
  renderRouteView(data);
  if (state.currentView === "map") renderMapView(data);
  syncTabs();
}

function aplicarFiltros() {
  const filtered = filtrarData(state.cache);
  renderViews(filtered);
}

async function cargarDomicilios() {
  if (dom.panelList) {
    dom.panelList.innerHTML = emptyStateMarkup(
      "Cargando entregas",
      "Estamos consultando los pedidos de domicilio para preparar el despacho."
    );
  }

  try {
    const response = await fetch(`${SCRIPT_URL}?hoja=Domicilios`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    state.cache = Array.isArray(data)
      ? data.filter(pedido => esFechaHoy(getDeliveryDateRaw(pedido)) && isDeliveryOrder(pedido))
      : [];
    actualizarStats(state.cache.length);
    syncRouteCourierOptions();
    aplicarFiltros();
  } catch (error) {
    console.error(error);
    state.cache = [];
    actualizarStats(0);
    syncRouteCourierOptions();
    aplicarFiltros();
    mostrarToast("No se pudieron cargar los pedidos");
  }
}

async function asignarDomiciliario(orderId, courier) {
  if (!courier || normalizarTexto(courier) === "sin asignar") {
    actualizarEnCache(orderId, { _assignedCourier: "Sin asignar" });
    syncRouteCourierOptions();
    aplicarFiltros();
    mostrarToast("Pedido sin domiciliario asignado");
    return true;
  }

  actualizarEnCache(orderId, { _assignedCourier: courier, domiciliario: courier, courier });

  try {
    const body = new URLSearchParams({
      accion: "asignarDomiciliario",
      hoja: "Domicilios",
      pedido: String(orderId),
      domiciliario: courier
    });

    const res = await fetch(SCRIPT_URL, { method: "POST", body });
    const raw = await res.text();
    const data = parseResponse(res, raw);
    const ok = isOkResponse(res, data, /ok|success|asignado/);

    syncRouteCourierOptions();
    aplicarFiltros();

    if (ok) {
      mostrarToast("Domiciliario asignado");
      return true;
    }

    mostrarToast(data?.message || "Asignado solo en este panel");
    return false;
  } catch (error) {
    console.error(error);
    syncRouteCourierOptions();
    aplicarFiltros();
    mostrarToast("Asignado localmente en este panel");
    return false;
  }
}

function distanceKm(a, b) {
  const toRad = value => (value * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const haversine =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function formatDistanceText(km) {
  if (!Number.isFinite(km)) return "";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function formatDurationText(minutes) {
  if (!Number.isFinite(minutes)) return "";
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function decodePolyline(encoded) {
  if (!encoded) return [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = null;

    do {
      byte = (encoded.codePointAt(index) || 0) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = (result & 1) ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    shift = 0;
    result = 0;

    do {
      byte = (encoded.codePointAt(index) || 0) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = (result & 1) ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return coordinates;
}

function buildRoutingItems(data) {
  return data
    .map((pedido, inputIndex) => ({
      pedido,
      id: getOrderId(pedido),
      lat: getLatitude(pedido),
      lng: getLongitude(pedido),
      inputIndex
    }))
    .filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

function buildSequentialMetrics(data) {
  const metrics = {};
  data.forEach((pedido, index) => {
    metrics[getOrderId(pedido)] = {
      routePosition: index + 1,
      distanceText: "Sin estimar",
      durationText: "Sin estimar",
      sortIndex: index
    };
  });
  return metrics;
}

async function optimizeViaDirectionsRest(waypoints) {
  const origin = `${STORE_COORDS.lat},${STORE_COORDS.lng}`;
  const points = waypoints.map(item => `${item.lat},${item.lng}`).join("|");
  const params = new URLSearchParams({
    origin,
    destination: origin,
    waypoints: `optimize:true|${points}`,
    key: GOOGLE_MAPS_API_KEY
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`);
  if (!response.ok) throw new Error(`Directions API HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.status !== "OK") throw new Error(payload.status || "Directions API error");
  const route = payload.routes?.[0] || {};
  return {
    waypointOrder: route.waypoint_order || [],
    legs: route.legs || [],
    overviewPath: decodePolyline(route.overview_polyline?.points || "")
  };
}

async function ensureGoogleMapsLoaded() {
  if (globalThis.google?.maps) {
    state.mapsReady = true;
    return true;
  }
  if (!GOOGLE_MAPS_API_KEY) return false;

  await new Promise((resolve, reject) => {
    const existing = getById("googleMapsScript");
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar Google Maps")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = "googleMapsScript";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=geometry`;
    script.onload = resolve;
    script.onerror = () => reject(new Error("No se pudo cargar Google Maps"));
    document.head.appendChild(script);
  });

  state.mapsReady = Boolean(globalThis.google?.maps);
  return state.mapsReady;
}

function optimizeViaDirectionsJs(waypoints) {
  return new Promise((resolve, reject) => {
    if (!globalThis.google?.maps?.DirectionsService) {
      reject(new Error("Google Maps JS API no disponible"));
      return;
    }

    const service = new globalThis.google.maps.DirectionsService();
    service.route(
      {
        origin: STORE_COORDS,
        destination: STORE_COORDS,
        travelMode: globalThis.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true,
        waypoints: waypoints.map(item => ({
          location: { lat: item.lat, lng: item.lng },
          stopover: true
        }))
      },
      (result, status) => {
        if (status !== "OK" || !result?.routes?.length) {
          reject(new Error(`Directions JS status: ${status}`));
          return;
        }
        const route = result.routes[0];
        resolve({
          waypointOrder: route.waypoint_order || [],
          legs: route.legs || [],
          overviewPath: (route.overview_path || []).map(point => ({ lat: point.lat(), lng: point.lng() }))
        });
      }
    );
  });
}

function optimizeByNearestNeighbor(waypoints) {
  const remaining = [...waypoints];
  const waypointOrder = [];
  const legs = [];
  const overviewPath = [{ lat: STORE_COORDS.lat, lng: STORE_COORDS.lng }];
  let currentPoint = { lat: STORE_COORDS.lat, lng: STORE_COORDS.lng };

  while (remaining.length) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    remaining.forEach((item, index) => {
      const distance = distanceKm(currentPoint, item);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const next = remaining.splice(nearestIndex, 1)[0];
    waypointOrder.push(next.inputIndex);
    legs.push({
      distance: { text: formatDistanceText(nearestDistance) },
      duration: { text: formatDurationText((nearestDistance / 22) * 60) }
    });
    overviewPath.push({ lat: next.lat, lng: next.lng });
    currentPoint = { lat: next.lat, lng: next.lng };
  }

  return { waypointOrder, legs, overviewPath };
}

function buildMetricsFromDirections(orderedItems, waypointOrder, legs) {
  const metrics = {};
  waypointOrder.forEach((waypointIndex, routeIndex) => {
    const item = orderedItems[waypointIndex];
    if (!item) return;
    const leg = legs?.[routeIndex] || null;
    metrics[item.id] = {
      routePosition: routeIndex + 1,
      distanceText: leg?.distance?.text || "Sin estimar",
      durationText: leg?.duration?.text || "Sin estimar",
      sortIndex: routeIndex
    };
  });
  return metrics;
}

function clearMetricsForCourier(courier) {
  const normalized = normalizarTexto(courier);
  Object.keys(state.routeMetrics).forEach(orderId => {
    const pedido = state.cache.find(item => getOrderId(item) === orderId);
    if (!pedido) return;
    if (normalizarTexto(getAssignedCourier(pedido)) === normalized) {
      delete state.routeMetrics[orderId];
    }
  });
}

async function generateRoutes() {
  const selectedCourier = dom.routeCourierSelect?.value || "";
  if (!selectedCourier) {
    mostrarToast("Selecciona un domiciliario para generar la ruta");
    return;
  }

  const courierOrders = filtrarData(state.cache).filter(
    pedido => normalizarTexto(getAssignedCourier(pedido)) === normalizarTexto(selectedCourier)
  );

  if (!courierOrders.length) {
    mostrarToast("No hay pedidos de domicilio para ese domiciliario");
    return;
  }

  if (dom.btnGenerateRoutes) {
    dom.btnGenerateRoutes.disabled = true;
    dom.btnGenerateRoutes.textContent = "Generando rutas...";
  }

  try {
    const routingItems = buildRoutingItems(courierOrders);
    clearMetricsForCourier(selectedCourier);
    state.optimizedCourier = selectedCourier;

    if (routingItems.length < 2) {
      Object.assign(state.routeMetrics, buildSequentialMetrics(courierOrders));
      state.optimizedPath = routingItems.length
        ? [{ lat: STORE_COORDS.lat, lng: STORE_COORDS.lng }, ...routingItems.map(item => ({ lat: item.lat, lng: item.lng }))]
        : [];
      aplicarFiltros();
      mostrarToast(`Ruta ${selectedCourier} actualizada`);
      return;
    }

    let result = null;
    if (GOOGLE_MAPS_API_KEY) {
      try {
        result = await optimizeViaDirectionsRest(routingItems);
      } catch (restError) {
        console.warn("Directions REST no disponible, usando JS API", restError);
        const mapsReady = await ensureGoogleMapsLoaded();
        if (mapsReady) {
          result = await optimizeViaDirectionsJs(routingItems);
        }
      }
    }

    if (!result) {
      result = optimizeByNearestNeighbor(routingItems);
    }

    Object.assign(
      state.routeMetrics,
      buildMetricsFromDirections(routingItems, result.waypointOrder || [], result.legs || [])
    );
    state.optimizedPath = result.overviewPath || [];

    aplicarFiltros();
    mostrarToast(`Ruta ${selectedCourier} generada`);
  } catch (error) {
    console.error(error);
    mostrarToast(error.message || "No se pudieron generar las rutas");
  } finally {
    if (dom.btnGenerateRoutes) {
      dom.btnGenerateRoutes.disabled = false;
      dom.btnGenerateRoutes.textContent = "Generar rutas";
    }
  }
}

function clearMapObjects() {
  state.mapMarkers.forEach(marker => marker.setMap(null));
  state.mapMarkers = [];
  if (state.mapPolyline) {
    state.mapPolyline.setMap(null);
    state.mapPolyline = null;
  }
}

function markerInfoHtml(pedido) {
  const address = getAddress(pedido) || "Sin direccion";
  const phone = getPhone(pedido);
  return `
    <div style="min-width:220px; font-family: Manrope, sans-serif;">
      <strong>Pedido #${escapeHtml(getOrderId(pedido))}</strong>
      <div style="margin-top:4px; color:#475467;">${escapeHtml(address)}</div>
      <div style="margin-top:4px; color:#475467;">Entrega ${escapeHtml(formatDeliveryTime(pedido))}</div>
      <div style="margin-top:4px; color:#475467;">Domiciliario ${escapeHtml(getAssignedCourier(pedido))}</div>
      <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
        ${actionLink("Llamar", telefonoTelHref(phone))}
        ${actionLink("WhatsApp", telefonoWhatsAppHref(phone))}
        ${actionLink("Navegar", mapsHref(address), "primary")}
      </div>
    </div>
  `;
}

function buildMapData(data) {
  return ordenarData(data)
    .map(pedido => ({
      pedido,
      id: getOrderId(pedido),
      lat: getLatitude(pedido),
      lng: getLongitude(pedido)
    }))
    .filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

async function drawMap(data) {
  const mapDiv = getById("mapView");
  const mapMessage = getById("mapMessage");
  if (!mapDiv) return;

  const mapsReady = await ensureGoogleMapsLoaded();
  if (!mapsReady) {
    mapDiv.className = "map-placeholder";
    mapDiv.innerHTML = "<div><strong>Mapa no disponible</strong><p>Configura GOOGLE_MAPS_API_KEY para ver la ruta completa.</p></div>";
    return;
  }

  mapDiv.className = "";
  mapDiv.innerHTML = "";
  if (mapMessage) {
    mapMessage.hidden = true;
    mapMessage.textContent = "";
  }

  if (state.map) {
    state.map.setMapTypeId(globalThis.google.maps.MapTypeId.ROADMAP);
  } else {
    state.map = new globalThis.google.maps.Map(mapDiv, {
      center: STORE_COORDS,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false
    });
    state.infoWindow = new globalThis.google.maps.InfoWindow();
  }

  clearMapObjects();

  const points = buildMapData(data);
  if (!points.length) {
    if (mapMessage) {
      mapMessage.hidden = false;
      mapMessage.textContent = "No hay coordenadas disponibles para los pedidos visibles.";
    }
    return;
  }

  const bounds = new globalThis.google.maps.LatLngBounds();
  bounds.extend(STORE_COORDS);

  points.forEach(item => {
    const metric = state.routeMetrics[item.id];
    const marker = new globalThis.google.maps.Marker({
      map: state.map,
      position: { lat: item.lat, lng: item.lng },
      label: metric?.routePosition ? String(metric.routePosition) : undefined,
      title: `Pedido #${item.id}`
    });

    marker.addListener("click", () => {
      state.infoWindow.setContent(markerInfoHtml(item.pedido));
      state.infoWindow.open({ anchor: marker, map: state.map });
    });

    state.mapMarkers.push(marker);
    bounds.extend({ lat: item.lat, lng: item.lng });
  });

  if (state.optimizedPath.length > 1) {
    state.mapPolyline = new globalThis.google.maps.Polyline({
      map: state.map,
      path: state.optimizedPath,
      geodesic: true,
      strokeColor: "#0f766e",
      strokeOpacity: 0.9,
      strokeWeight: 4
    });
    state.optimizedPath.forEach(point => bounds.extend(point));
  }

  state.map.fitBounds(bounds);
}

function setupFilterChips() {
  dom.chipButtons.forEach(button => {
    button.addEventListener("click", () => {
      state.activeFilter = button.dataset.filter || "today";
      syncFilterChips();
      aplicarFiltros();
    });
  });
}

function focusTabByOffset(currentButton, offset) {
  const index = dom.tabButtons.indexOf(currentButton);
  if (index < 0) return;
  const nextIndex = (index + offset + dom.tabButtons.length) % dom.tabButtons.length;
  dom.tabButtons[nextIndex]?.focus();
}

function setupTabs() {
  dom.tabButtons.forEach(button => {
    button.addEventListener("click", () => {
      state.currentView = button.dataset.view || "list";
      aplicarFiltros();
    });

    button.addEventListener("keydown", event => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        focusTabByOffset(button, 1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        focusTabByOffset(button, -1);
      }
      if (event.key === "Home") {
        event.preventDefault();
        dom.tabButtons[0]?.focus();
      }
      if (event.key === "End") {
        event.preventDefault();
        dom.tabButtons.at(-1)?.focus();
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        button.click();
      }
    });
  });
}

function setupActions() {
  dom.btnRefresh?.addEventListener("click", () => cargarDomicilios());
  dom.btnGenerateRoutes?.addEventListener("click", () => generateRoutes());
  dom.routeCourierSelect?.addEventListener("change", () => {
    state.optimizedCourier = dom.routeCourierSelect.value || "";
    if (state.currentView === "map") aplicarFiltros();
  });

  document.addEventListener("click", event => {
    const sortButton = event.target.closest(".table-sort");
    if (sortButton) {
      const requested = sortButton.dataset.sort || "time";
      if (state.listSortKey === requested) {
        state.listSortDirection = state.listSortDirection === "asc" ? "desc" : "asc";
      } else {
        state.listSortKey = requested;
        state.listSortDirection = "asc";
      }
      renderListView(state.lastFiltered);
      return;
    }

    const toggleButton = event.target.closest('[data-action="toggle-row"]');
    if (toggleButton) {
      const orderId = toggleButton.dataset.orderId || "";
      state.expandedRows[orderId] = !state.expandedRows[orderId];
      renderListView(state.lastFiltered);
      return;
    }

    const clearButton = event.target.closest('[data-action="clear-filters"]');
    if (clearButton) {
      resetFilters();
    }
  });

  document.addEventListener("change", async event => {
    const select = event.target.closest(".courier-select");
    if (!select) return;
    await asignarDomiciliario(select.dataset.orderId || "", select.value || "Sin asignar");
  });
}

function init() {
  syncFilterChips();
  syncTabs();
  setupFilterChips();
  setupTabs();
  setupActions();
  cargarDomicilios();
}

if (typeof document !== "undefined") {
  init();
}