/**
 * Tests para agrupamiento y filtrado de categorías (categorias.js)
 * Ejecutar con: npm test
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  agruparPorCategoria,
  filtrarPorCategoria
} = require('../categorias.js');

describe('agruparPorCategoria', () => {
  it('debe agrupar usando exactamente Categoria/categoria', () => {
    const productos = [
      { id: 1, name: 'A', Categoria: 'Flora boxes' },
      { id: 2, name: 'B', Categoria: 'Flora boxes' },
      { id: 3, name: 'C', categoria: 'Rosas Premium' }
    ];

    const grupos = agruparPorCategoria(productos);

    assert.strictEqual(grupos['Flora boxes'].length, 2);
    assert.strictEqual(grupos['Rosas Premium'].length, 1);
  });

  it('debe respetar el valor exacto sin transformar', () => {
    const productos = [
      { id: 1, name: 'A', Categoria: '  CATEGORÍA X  ' },
      { id: 2, name: 'B', Categoria: 'categoría x' }
    ];

    const grupos = agruparPorCategoria(productos);

    assert.ok(grupos.hasOwnProperty('  CATEGORÍA X  '));
    assert.ok(grupos.hasOwnProperty('categoría x'));
    assert.strictEqual(Object.keys(grupos).length, 2);
  });

  it('debe asignar "Sin categoría" si no viene Categoria/categoria', () => {
    const productos = [
      { id: 1, name: 'Sin cat 1' },
      { id: 2, name: 'Sin cat 2', Categoria: '' }
    ];

    const grupos = agruparPorCategoria(productos);

    assert.strictEqual(grupos['Sin categoría'].length, 2);
  });
});

describe('filtrarPorCategoria', () => {
  const productos = [
    { id: 1, name: 'A', Categoria: 'Flora boxes' },
    { id: 2, name: 'B', categoria: 'Rosas Premium' },
    { id: 3, name: 'C' }
  ];

  it('debe filtrar por coincidencia exacta de Categoria/categoria', () => {
    const filtrado = filtrarPorCategoria(productos, 'Flora boxes');

    assert.strictEqual(filtrado.length, 1);
    assert.strictEqual(filtrado[0].id, 1);
  });

  it('debe usar "Sin categoría" al filtrar productos sin categoría', () => {
    const filtrado = filtrarPorCategoria(productos, 'Sin categoría');

    assert.strictEqual(filtrado.length, 1);
    assert.strictEqual(filtrado[0].id, 3);
  });

  it('debe retornar vacío cuando no hay coincidencias exactas', () => {
    const filtrado = filtrarPorCategoria(productos, 'flora boxes');

    assert.strictEqual(filtrado.length, 0);
  });
});
