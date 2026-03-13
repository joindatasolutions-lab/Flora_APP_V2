const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwdixPJBCFos9aUaUT_NDxQ2ZMW3s2CXoQ0KRNVNe8aYmaXtTSONvKgPRXIFcFpSSmO/exec";

const STORE_COORDS = {
  lat: Number(globalThis.STORE_COORDS?.lat ?? 10.998455),
  lng: Number(globalThis.STORE_COORDS?.lng ?? -74.806981)
};

const GOOGLE_MAPS_API_KEY = (globalThis.GOOGLE_MAPS_API_KEY || '').toString().trim();

const getById = id => document.getElementById(id);

const dom = {
  viewContainer: getById('viewContainer'),
  toast: getById('toast'),
  buscar: getById('buscarPedido'),
  filtroEstado: getById('filtroEstado'),
  filtroDomiciliario: getById('filtroDomiciliario'),
  btnRefresh: getById('btnRefresh'),
  btnOptimizeRoute: getById('btnOptimizeRoute'),
  btnViewTable: getById('btnViewTable'),
  btnViewRoute: getById('btnViewRoute'),
  btnViewMap: getById('btnViewMap'),
  statsCount: getById('statsCount'),
  statsInfo: getById('statsInfo'),
  lastUpdate: getById('lastUpdate')
};

const state = {
  cache: [],
  timer: null,
  currentView: 'table',
  sortKey: 'time',
  sortDirection: 'asc',
  optimizedCourier: null,
  routeMetrics: {},
  optimizedPath: [],
  map: null,
  mapMarkers: [],
  mapPolyline: null,
  infoWindow: null,
  mapsReady: false
};

function mostrarToast(msg) {
  if (!dom.toast) return;
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  setTimeout(() => dom.toast.classList.remove('show'), 2400);
}

function normalizarTexto(value) {
  return (value ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replaceAll(/[\u0300-\u036f]/g, '');
}

function limpiarTelefono(telefono) {
  return (telefono || '').toString().replaceAll(/\D/g, '');
}

function telefonoTelHref(telefono) {
  const raw = (telefono || '').toString().trim();
  if (!raw) return '';
  const tel = raw.startsWith('+') ? `+${limpiarTelefono(raw)}` : limpiarTelefono(raw);
  return tel ? `tel:${tel}` : '';
}

function telefonoWhatsAppHref(telefono) {
  const limpio = limpiarTelefono(telefono);
  return limpio ? `https://wa.me/${limpio}` : '';
}

function mapsHref(direccion) {
  const dir = (direccion || '').toString().trim();
  return dir ? `https://maps.google.com/?q=${encodeURIComponent(dir)}` : '';
}

function toCoord(value) {
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value).replaceAll(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function getOrderId(pedido) {
  return String(
    pedido.order_id || pedido['N°Pedido'] || pedido.pedido || pedido.id || ''
  ).trim();
}

function getCourier(pedido) {
  return (pedido.courier || pedido.domiciliario || 'Sin asignar').toString().trim();
}

function getAddress(pedido) {
  return (pedido.address || pedido.direccion || '').toString().trim();
}

function getCustomer(pedido) {
  return (pedido.customer || pedido.destinatario || '').toString().trim();
}

function getNeighborhood(pedido) {
  return (pedido.neighborhood || pedido.barrio || '').toString().trim();
}

function getPhone(pedido) {
  return (pedido.telefonoDestino || pedido.telefono || pedido.phone || '').toString().trim();
}

function getLatitude(pedido) {
  return toCoord(pedido.latitude ?? pedido.latitud ?? pedido.lat);
}

function getLongitude(pedido) {
  return toCoord(pedido.longitude ?? pedido.longitud ?? pedido.lng);
}

function getDeliveryDateRaw(pedido) {
  return (
    pedido.delivery_date ||
    pedido.fechaEntrega ||
    pedido.fecha_entrega ||
    pedido.fecha ||
    pedido['FechaEntrega'] ||
    pedido['Fecha Entrega'] ||
    pedido['Fecha de entrega'] ||
    ''
  );
}

function getDeliveryTimeRaw(pedido) {
  return (
    pedido.delivery_time ||
    pedido.horaEntrega ||
    pedido.hora ||
    pedido['Hora Entrega'] ||
    ''
  );
}

function esFechaHoy(fecha) {
  if (!fecha) return false;
  const texto = fecha.toString().trim().replaceAll(' - ', ' ');
  const f = new Date(texto);
  const hoy = new Date();
  if (Number.isNaN(f.getTime())) return false;
  return (
    f.getFullYear() === hoy.getFullYear() &&
    f.getMonth() === hoy.getMonth() &&
    f.getDate() === hoy.getDate()
  );
}

function formatearFechaEntrega(pedido) {
  const rawDate = getDeliveryDateRaw(pedido);
  const rawTime = getDeliveryTimeRaw(pedido);
  const compuesto = `${rawDate || ''} ${rawTime || ''}`.trim();
  const parsed = new Date(compuesto || String(rawDate || '').trim());

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  if (compuesto) return compuesto;
  return '';
}

function timestampEntrega(pedido) {
  const rawDate = getDeliveryDateRaw(pedido);
  const rawTime = getDeliveryTimeRaw(pedido);
  const compuesto = `${rawDate || ''} ${rawTime || ''}`.trim();
  const parsed = new Date(compuesto.replaceAll(' - ', ' '));
  return Number.isNaN(parsed.getTime()) ? Number.MAX_SAFE_INTEGER : parsed.getTime();
}

function ordenarUnicos(valores) {
  return Array.from(new Set(valores)).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

function fillSelect(select, options, defaultLabel) {
  if (!select) return;
  const current = select.value || 'Todos';
  select.innerHTML = '';
  const opDefault = document.createElement('option');
  opDefault.value = 'Todos';
  opDefault.textContent = defaultLabel;
  select.appendChild(opDefault);
  options.forEach(value => {
    const op = document.createElement('option');
    op.value = value;
    op.textContent = value;
    if (value === current) op.selected = true;
    select.appendChild(op);
  });
}

function actualizarFiltros(data) {
  const estados = ordenarUnicos(data.map(p => (p.estado || 'Pendiente').toString().trim()));
  const domiciliarios = ordenarUnicos(data.map(p => getCourier(p)));
  fillSelect(dom.filtroEstado, estados, 'Todos los estados');
  fillSelect(dom.filtroDomiciliario, domiciliarios, 'Todos los domiciliarios');
}

function actualizarStats(total, visibles) {
  if (dom.statsCount) dom.statsCount.textContent = String(visibles);
  if (dom.statsInfo) dom.statsInfo.textContent = total === visibles ? '' : `Mostrando ${visibles} de ${total}`;
}

function actualizarUltimaActualizacion() {
  if (!dom.lastUpdate) return;
  const now = new Date();
  dom.lastUpdate.textContent = `Actualizado: ${now.toLocaleString('es-CO', { hour12: false })}`;
}

function actualizarEnCache(pedidoId, patch) {
  const id = String(pedidoId ?? '');
  const item = state.cache.find(p => getOrderId(p) === id);
  if (item) Object.assign(item, patch);
}

function filtrarData(data) {
  let filtrados = [...data];

  filtrados = filtrados.filter(p => !/entregado/i.test((p.estado || '').toString().trim()));
  filtrados = filtrados.filter(p => !((p.zona || '').toString().toLowerCase()).includes('recoger'));

  const estado = dom.filtroEstado?.value || 'Todos';
  const domiciliario = dom.filtroDomiciliario?.value || 'Todos';

  if (estado !== 'Todos') {
    filtrados = filtrados.filter(p => normalizarTexto(p.estado) === normalizarTexto(estado));
  }
  if (domiciliario !== 'Todos') {
    filtrados = filtrados.filter(p => normalizarTexto(getCourier(p)) === normalizarTexto(domiciliario));
  }

  const q = normalizarTexto(dom.buscar?.value || '').trim();
  if (q) {
    filtrados = filtrados.filter(pedido => {
      const campos = [
        getOrderId(pedido),
        getCustomer(pedido),
        getNeighborhood(pedido),
        pedido.zona,
        getAddress(pedido),
        getPhone(pedido),
        getCourier(pedido),
        pedido.estado
      ];
      return campos.some(campo => normalizarTexto(campo).includes(q));
    });
  }

  return ordenarData(filtrados);
}

function comparar(a, b) {
  return state.sortDirection === 'asc' ? a - b : b - a;
}

function compararTexto(a, b) {
  return state.sortDirection === 'asc'
    ? a.localeCompare(b, 'es', { sensitivity: 'base' })
    : b.localeCompare(a, 'es', { sensitivity: 'base' });
}

function getRouteMetric(pedido) {
  const id = getOrderId(pedido);
  return state.routeMetrics[id] || null;
}

function ordenarData(data) {
  const out = [...data];
  const activeCourier = dom.filtroDomiciliario?.value || 'Todos';

  if (state.optimizedCourier && activeCourier === state.optimizedCourier) {
    out.sort((a, b) => {
      const ma = getRouteMetric(a);
      const mb = getRouteMetric(b);
      if (ma && mb) return ma.sortIndex - mb.sortIndex;
      if (ma) return -1;
      if (mb) return 1;
      return comparar(timestampEntrega(a), timestampEntrega(b));
    });
    return out;
  }

  out.sort((a, b) => {
    if (state.sortKey === 'time') {
      return comparar(timestampEntrega(a), timestampEntrega(b));
    }
    if (state.sortKey === 'neighborhood') {
      return compararTexto(getNeighborhood(a), getNeighborhood(b));
    }
    const pa = Number(getOrderId(a) || 0);
    const pb = Number(getOrderId(b) || 0);
    return comparar(pa, pb);
  });
  return out;
}

function badgeClass(estado) {
  const e = normalizarTexto(estado || 'pendiente');
  if (e.includes('problema') || e.includes('incidencia') || e.includes('error')) return 'status-pill status-problem';
  if (e.includes('en ruta')) return 'status-pill status-en-ruta';
  if (e.includes('entregado')) return 'status-pill status-entregado';
  return 'status-pill status-pendiente';
}

function actionLink(label, href) {
  if (!href) return `<span class="action-link" aria-disabled="true">${label}</span>`;
  return `<a class="action-link" href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function metricChip(text) {
  return `<span class="metric-chip">${text || ''}</span>`;
}

function renderTableView(data) {
  if (!data.length) {
    dom.viewContainer.innerHTML = '<div class="empty">No hay entregas para mostrar.</div>';
    return;
  }

  const cards = data.map(p => {
    const pedido = getOrderId(p) || '';
    const address = getAddress(p) || 'Sin direccion';
    const customer = getCustomer(p) || 'Sin cliente';
    const neighborhood = getNeighborhood(p) || 'Sin barrio';
    const status = p.estado || 'Pendiente';
    const phone = getPhone(p);

    return `
      <article class="order-card">
        <header class="order-card-header">
          <strong class="order-number">Pedido #${pedido}</strong>
          <span class="${badgeClass(status)}">${status}</span>
        </header>
        <div class="order-card-body">
          <p><strong>Cliente:</strong> ${customer}</p>
          <p><strong>Barrio:</strong> ${neighborhood}</p>
          <p><strong>Direccion:</strong> ${address}</p>
        </div>
        <div class="actions order-card-actions">
          ${actionLink('📍 Mapa', mapsHref(address))}
          ${actionLink('📞 Llamar', telefonoTelHref(phone))}
          <button class="action-btn deliver" data-action="deliver" data-pedido="${pedido}">✔ Entregado</button>
        </div>
      </article>
    `;
  }).join('');

  dom.viewContainer.innerHTML = `<section class="orders-cards">${cards}</section>`;
}

function renderRouteView(data) {
  if (!data.length) {
    dom.viewContainer.innerHTML = '<div class="empty">No hay entregas para enrutar.</div>';
    return;
  }

  const items = data.map((p, idx) => {
    const pedido = getOrderId(p) || '';
    const address = getAddress(p) || '';
    const customer = getCustomer(p) || '';
    const neighborhood = getNeighborhood(p) || '';
    const time = formatearFechaEntrega(p);
    const phone = getPhone(p);
    const metric = getRouteMetric(p);
    const routePos = metric?.routePosition || idx + 1;

    return `
      <article class="route-item">
        <div class="route-position">${routePos}</div>
        <div class="route-main">
          <div class="route-address">${address}</div>
          <div class="route-meta">Barrio: ${neighborhood} | Cliente: ${customer}</div>
          <div class="route-meta">Pedido #${pedido} | Entrega: ${time}</div>
          <div class="route-meta">Distancia: ${metric?.distanceText || ''} | Duracion: ${metric?.durationText || ''}</div>
        </div>
        <div class="route-actions">
          ${actionLink('WhatsApp', telefonoWhatsAppHref(phone))}
          ${actionLink('Llamar', telefonoTelHref(phone))}
          ${actionLink('Abrir ruta', mapsHref(address))}
        </div>
      </article>
    `;
  }).join('');

  dom.viewContainer.innerHTML = `<section class="route-list">${items}</section>`;
}

function renderMapView(data) {
  dom.viewContainer.innerHTML = `
    <section class="map-layout">
      <div class="map-banner">
        <strong>Mapa operativo</strong>
        <span>Marcadores con acciones y trazo de ruta optimizada.</span>
      </div>
      <div id="mapView"></div>
      <div id="mapMessage" class="empty" style="display:none;"></div>
    </section>
  `;

  drawMap(data);
}

function renderCurrentView(data) {
  if (state.currentView === 'route') {
    renderRouteView(data);
  } else if (state.currentView === 'map') {
    renderMapView(data);
  } else {
    renderTableView(data);
  }
}

function marcarActiva(view) {
  [dom.btnViewTable, dom.btnViewRoute, dom.btnViewMap].forEach(btn => {
    if (!btn) return;
    btn.classList.toggle('active', btn.dataset.view === view);
  });
}

async function parseResponse(res) {
  const raw = await res.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('Respuesta no JSON desde API de domicilios', err);
    data = null;
  }
  return { raw, data };
}

function isOkResponse(res, data, keywords) {
  const statusValue = (data?.status || data?.result || data?.message || '').toString().toLowerCase();
  const flag = data?.success === true || data?.ok === true;
  const text = keywords.test(statusValue);
  return res.ok && (flag || text || data === null || statusValue === '');
}

async function actualizarEstado(pedido, nuevoEstado, btnRef) {
  const originalText = btnRef?.textContent || 'Entregado';
  if (btnRef) {
    btnRef.disabled = true;
    btnRef.textContent = 'Actualizando...';
  }

  try {
    const body = new URLSearchParams({
      accion: 'actualizarEstado',
      hoja: 'Domicilios',
      pedido: String(pedido),
      estado: nuevoEstado
    });

    const res = await fetch(SCRIPT_URL, { method: 'POST', body });
    const { data } = await parseResponse(res);
    const ok = isOkResponse(res, data, /ok|success|actualizado|actualizada/);

    if (ok) {
      actualizarEnCache(pedido, { estado: nuevoEstado });
      mostrarToast(nuevoEstado === 'Entregado' ? 'Pedido entregado' : 'Estado actualizado');
      aplicarFiltros();
      return true;
    }

    mostrarToast(data?.message || 'No se pudo actualizar');
    return false;
  } catch (err) {
    console.error(err);
    mostrarToast('Error de conexion');
    return false;
  } finally {
    if (btnRef) {
      btnRef.disabled = false;
      btnRef.textContent = originalText;
    }
  }
}

function aplicarFiltros() {
  const filtrados = filtrarData(state.cache);
  renderCurrentView(filtrados);
  actualizarStats(state.cache.length, filtrados.length);
}

async function cargarDomicilios() {
  try {
    dom.viewContainer.innerHTML = '<div class="empty">Cargando pedidos...</div>';
    const res = await fetch(`${SCRIPT_URL}?hoja=Domicilios`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    state.cache = Array.isArray(data) ? data : [];
    state.cache = state.cache.filter(p => esFechaHoy(getDeliveryDateRaw(p)));

    actualizarFiltros(state.cache);
    aplicarFiltros();
    actualizarUltimaActualizacion();
  } catch (err) {
    console.error(err);
    dom.viewContainer.innerHTML = '<div class="empty">No se pudo cargar la informacion.</div>';
    mostrarToast('Error cargando pedidos');
  }
}

function getCurrentCourier() {
  const selected = dom.filtroDomiciliario?.value || 'Todos';
  return selected === 'Todos' ? '' : selected;
}

function listCourierOrdersForOptimization() {
  const courier = getCurrentCourier();
  if (!courier) {
    mostrarToast('Selecciona un domiciliario para optimizar ruta');
    return [];
  }

  const current = filtrarData(state.cache)
    .filter(p => normalizarTexto(getCourier(p)) === normalizarTexto(courier))
    .sort((a, b) => timestampEntrega(a) - timestampEntrega(b));

  const withCoords = current
    .map(p => ({
      pedido: p,
      id: getOrderId(p),
      lat: getLatitude(p),
      lng: getLongitude(p)
    }))
    .filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));

  if (!withCoords.length) {
    mostrarToast('No hay coordenadas validas para optimizar');
  }

  return withCoords;
}

function buildDirectionsUrl(waypoints) {
  const origin = `${STORE_COORDS.lat},${STORE_COORDS.lng}`;
  const destination = origin;
  const wp = waypoints.map(w => `${w.lat},${w.lng}`).join('|');
  const waypointsParam = `optimize:true|${wp}`;
  const params = new URLSearchParams({
    origin,
    destination,
    waypoints: waypointsParam,
    key: GOOGLE_MAPS_API_KEY
  });
  return `https://maps.googleapis.com/maps/api/directions/json?${params.toString()}`;
}

async function optimizeViaDirectionsRest(waypoints) {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Falta GOOGLE_MAPS_API_KEY');
  }
  const url = buildDirectionsUrl(waypoints);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Directions API HTTP ${res.status}`);
  const payload = await res.json();
  if (payload.status !== 'OK') {
    throw new Error(payload.status || 'Directions API error');
  }

  const route = payload.routes?.[0] || {};
  return {
    waypointOrder: route.waypoint_order || [],
    legs: route.legs || [],
    overviewPolyline: route.overview_polyline?.points || ''
  };
}

async function ensureGoogleMapsLoaded() {
  if (globalThis.google?.maps) {
    state.mapsReady = true;
    return true;
  }

  if (!GOOGLE_MAPS_API_KEY) return false;

  await new Promise((resolve, reject) => {
    const existing = document.getElementById('googleMapsScript');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Google Maps')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = 'googleMapsScript';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&libraries=geometry`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Maps'));
    document.head.appendChild(script);
  });

  state.mapsReady = Boolean(globalThis.google?.maps);
  return state.mapsReady;
}

function optimizeViaDirectionsJs(waypoints) {
  return new Promise((resolve, reject) => {
    if (!globalThis.google?.maps?.DirectionsService) {
      reject(new Error('Google Maps JS API no disponible'));
      return;
    }

    const service = new globalThis.google.maps.DirectionsService();
    service.route(
      {
        origin: STORE_COORDS,
        destination: STORE_COORDS,
        travelMode: globalThis.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true,
        waypoints: waypoints.map(w => ({ location: { lat: w.lat, lng: w.lng }, stopover: true }))
      },
      (result, status) => {
        if (status !== 'OK' || !result?.routes?.length) {
          reject(new Error(`Directions JS status: ${status}`));
          return;
        }
        const route = result.routes[0];
        resolve({
          waypointOrder: route.waypoint_order || [],
          legs: route.legs || [],
          overviewPath: (route.overview_path || []).map(p => ({ lat: p.lat(), lng: p.lng() }))
        });
      }
    );
  });
}

function buildMetricsFromDirections(ordered, waypointOrder, legs) {
  const metrics = {};
  waypointOrder.forEach((waypointIndex, routeIndex) => {
    const item = ordered[waypointIndex];
    if (!item) return;
    const leg = legs?.[routeIndex] || null;
    metrics[item.id] = {
      routePosition: routeIndex + 1,
      distanceText: leg?.distance?.text || '',
      durationText: leg?.duration?.text || '',
      sortIndex: routeIndex
    };
  });
  return metrics;
}

async function optimizeRouteForCourier() {
  const courier = getCurrentCourier();
  if (!courier) {
    mostrarToast('Selecciona un domiciliario para optimizar ruta');
    return;
  }

  const ordered = listCourierOrdersForOptimization();
  if (!ordered.length) return;

  if (dom.btnOptimizeRoute) {
    dom.btnOptimizeRoute.disabled = true;
    dom.btnOptimizeRoute.textContent = 'Optimizando...';
  }

  try {
    let result = null;

    try {
      result = await optimizeViaDirectionsRest(ordered);
    } catch (restErr) {
      console.warn('REST Directions no disponible, usando JS API', restErr);
      const mapsOk = await ensureGoogleMapsLoaded();
      if (!mapsOk) throw new Error('Configura GOOGLE_MAPS_API_KEY para optimizar ruta');
      result = await optimizeViaDirectionsJs(ordered);
    }

    const waypointOrder = result.waypointOrder || [];
    if (!waypointOrder.length) {
      throw new Error('No se recibio waypoint_order desde Google Directions');
    }

    state.optimizedCourier = courier;
    state.routeMetrics = buildMetricsFromDirections(ordered, waypointOrder, result.legs || []);

    if (result.overviewPath?.length) {
      state.optimizedPath = result.overviewPath;
    } else {
      state.optimizedPath = [];
    }

    aplicarFiltros();
    mostrarToast(`Ruta optimizada para ${courier}`);
  } catch (err) {
    console.error(err);
    mostrarToast(err.message || 'No se pudo optimizar la ruta');
  } finally {
    if (dom.btnOptimizeRoute) {
      dom.btnOptimizeRoute.disabled = false;
      dom.btnOptimizeRoute.textContent = 'Optimize Route';
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
  const id = getOrderId(pedido) || '';
  const address = getAddress(pedido) || 'Sin direccion';
  const time = formatearFechaEntrega(pedido);
  const phone = getPhone(pedido);
  const tel = telefonoTelHref(phone);
  const wa = telefonoWhatsAppHref(phone);
  const nav = mapsHref(address);

  return `
    <div style="min-width:220px; font-family: Manrope, sans-serif;">
      <strong>Pedido #${id}</strong>
      <div style="margin-top:4px; color:#4b5563;">${address}</div>
      <div style="margin-top:4px; color:#4b5563;">Entrega: ${time}</div>
      <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">
        ${actionLink('Llamar', tel)}
        ${actionLink('WhatsApp', wa)}
        ${actionLink('Navegar', nav)}
      </div>
    </div>
  `;
}

function buildMapData(data) {
  return data
    .map(p => ({ pedido: p, id: getOrderId(p), lat: getLatitude(p), lng: getLongitude(p) }))
    .filter(item => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

async function drawMap(data) {
  const mapDiv = getById('mapView');
  const mapMessage = getById('mapMessage');
  if (!mapDiv) return;

  const mapsOk = await ensureGoogleMapsLoaded();
  if (!mapsOk) {
    mapDiv.className = 'map-placeholder';
    mapDiv.innerHTML = '<div><strong>Mapa no disponible</strong><p>Define window.GOOGLE_MAPS_API_KEY para habilitar Google Maps.</p></div>';
    return;
  }

  mapDiv.className = '';
  mapDiv.innerHTML = '';
  if (mapMessage) {
    mapMessage.style.display = 'none';
    mapMessage.textContent = '';
  }

  if (!state.map) {
    state.map = new globalThis.google.maps.Map(mapDiv, {
      center: STORE_COORDS,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false
    });
    state.infoWindow = new globalThis.google.maps.InfoWindow();
  }

  clearMapObjects();

  const points = buildMapData(data);
  if (!points.length) {
    if (mapMessage) {
      mapMessage.style.display = 'block';
      mapMessage.textContent = 'No hay coordenadas para dibujar en el mapa.';
    }
    return;
  }

  const bounds = new globalThis.google.maps.LatLngBounds();
  bounds.extend(STORE_COORDS);

  points.forEach(item => {
    const metric = state.routeMetrics[item.id];
    const label = metric?.routePosition ? String(metric.routePosition) : '';
    const marker = new globalThis.google.maps.Marker({
      map: state.map,
      position: { lat: item.lat, lng: item.lng },
      label: label || undefined,
      title: `Pedido #${item.id}`
    });
    marker.addListener('click', () => {
      state.infoWindow.setContent(markerInfoHtml(item.pedido));
      state.infoWindow.open({ anchor: marker, map: state.map });
    });
    state.mapMarkers.push(marker);
    bounds.extend({ lat: item.lat, lng: item.lng });
  });

  if (state.optimizedPath?.length > 1) {
    state.mapPolyline = new globalThis.google.maps.Polyline({
      map: state.map,
      path: state.optimizedPath,
      geodesic: true,
      strokeColor: '#0f766e',
      strokeOpacity: 0.9,
      strokeWeight: 4
    });
    state.optimizedPath.forEach(p => bounds.extend(p));
  }

  state.map.fitBounds(bounds);
}

function setupSortListeners() {
  dom.viewContainer.addEventListener('click', async event => {
    const th = event.target.closest('th.sortable');
    if (th) {
      const requested = th.dataset.sort;
      const map = {
        time: 'time',
        neighborhood: 'neighborhood',
        order: 'order'
      };
      const key = map[requested] || 'time';
      if (state.sortKey === key) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortDirection = 'asc';
      }
      aplicarFiltros();
      return;
    }

    const deliverBtn = event.target.closest('button[data-action="deliver"]');
    if (deliverBtn) {
      const pedido = deliverBtn.dataset.pedido;
      await actualizarEstado(pedido, 'Entregado', deliverBtn);
    }
  });
}

function setupFiltersAndSearch() {
  if (dom.buscar) {
    dom.buscar.addEventListener('input', () => {
      clearTimeout(state.timer);
      state.timer = setTimeout(() => aplicarFiltros(), 150);
    });
  }

  if (dom.filtroEstado) {
    dom.filtroEstado.addEventListener('change', aplicarFiltros);
  }

  if (dom.filtroDomiciliario) {
    dom.filtroDomiciliario.addEventListener('change', () => {
      const selected = dom.filtroDomiciliario.value || 'Todos';
      if (selected !== state.optimizedCourier) {
        state.routeMetrics = {};
        state.optimizedPath = [];
      }
      aplicarFiltros();
    });
  }

  if (dom.btnRefresh) dom.btnRefresh.addEventListener('click', () => cargarDomicilios());
  if (dom.btnOptimizeRoute) dom.btnOptimizeRoute.addEventListener('click', () => optimizeRouteForCourier());
}

function setupViewSwitcher() {
  [dom.btnViewTable, dom.btnViewRoute, dom.btnViewMap].forEach(btn => {
    if (!btn) return;
    btn.addEventListener('click', () => {
      state.currentView = btn.dataset.view;
      marcarActiva(state.currentView);
      aplicarFiltros();
    });
  });
}

function init() {
  setupFiltersAndSearch();
  setupSortListeners();
  setupViewSwitcher();
  marcarActiva(state.currentView);
  cargarDomicilios();
}

if (typeof document !== 'undefined') {
  init();
}
