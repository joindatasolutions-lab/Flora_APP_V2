const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizarTexto,
  obtenerNombreExterno,
  obtenerTelefonoExterno,
  formatearFechaEntrega,
  ordenarUnicos,
  isOkResponse
} = require('../domicilios-web.js');

test('normalizarTexto elimina tildes y pasa a minúsculas', () => {
  assert.equal(normalizarTexto('ÓSCAR Núñez'), 'oscar nunez');
});

test('obtenerNombreExterno prioriza campos válidos', () => {
  const pedido = {
    nombre_externo: '  ',
    NombreExterno: 'Laura Gómez'
  };
  assert.equal(obtenerNombreExterno(pedido), 'Laura Gómez');
});

test('obtenerTelefonoExterno detecta variantes de campo', () => {
  const pedido = {
    'Teléfono Externo': '3001234567'
  };
  assert.equal(obtenerTelefonoExterno(pedido), '3001234567');
});

test('formatearFechaEntrega devuelve guion cuando no hay fecha', () => {
  assert.equal(formatearFechaEntrega({}), '—');
});

test('formatearFechaEntrega conserva texto cuando la fecha es inválida', () => {
  assert.equal(formatearFechaEntrega({ fechaEntrega: 'fecha-rara' }), 'fecha-rara');
});

test('ordenarUnicos elimina duplicados y ordena alfabéticamente', () => {
  const out = ordenarUnicos(['Oscar', 'Elvis', 'Oscar', 'Externo']);
  assert.deepEqual(out, ['Elvis', 'Externo', 'Oscar']);
});

test('isOkResponse interpreta respuesta ok por keyword', () => {
  const ok = isOkResponse({ ok: true }, { message: 'asignado correctamente' }, /ok|success|asignado/);
  assert.equal(ok, true);
});

test('isOkResponse retorna false cuando no hay señal de éxito', () => {
  const ok = isOkResponse({ ok: true }, { message: 'falló la operación' }, /ok|success|asignado/);
  assert.equal(ok, false);
});
