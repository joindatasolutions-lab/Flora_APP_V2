/**
 * Tests para el módulo de categorías (categorias.js)
 * Ejecutar con: npm test
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  CATEGORIAS_MAP,
  obtenerCategoria,
  obtenerTodasLasCategorias,
  enriquecerCatalogoCategorias,
  agruparPorCategoria,
  filtrarPorCategoria
} = require('../categorias.js');

describe('obtenerCategoria', () => {
  it('debe retornar "Personalizados" para el número 95', () => {
    assert.strictEqual(obtenerCategoria(95), 'Personalizados');
  });

  it('debe retornar "Flora boxes" para números 1-32', () => {
    assert.strictEqual(obtenerCategoria(1), 'Flora boxes');
    assert.strictEqual(obtenerCategoria(16), 'Flora boxes');
    assert.strictEqual(obtenerCategoria(32), 'Flora boxes');
  });

  it('debe retornar "Flora canasto" para números 33-41', () => {
    assert.strictEqual(obtenerCategoria(33), 'Flora canasto');
    assert.strictEqual(obtenerCategoria(41), 'Flora canasto');
  });

  it('debe retornar "Flora bouquets" para números 42-53', () => {
    assert.strictEqual(obtenerCategoria(42), 'Flora bouquets');
    assert.strictEqual(obtenerCategoria(53), 'Flora bouquets');
  });

  it('debe retornar "Adicionales" para números 80-94', () => {
    assert.strictEqual(obtenerCategoria(80), 'Adicionales');
    assert.strictEqual(obtenerCategoria(94), 'Adicionales');
  });

  it('debe retornar "Sin categoría" para números fuera de rango', () => {
    assert.strictEqual(obtenerCategoria(0), 'Sin categoría');
    assert.strictEqual(obtenerCategoria(96), 'Sin categoría');
    assert.strictEqual(obtenerCategoria(200), 'Sin categoría');
  });

  it('debe manejar strings numéricos convirtiéndolos', () => {
    assert.strictEqual(obtenerCategoria('95'), 'Personalizados');
    assert.strictEqual(obtenerCategoria('1'), 'Flora boxes');
  });

  it('debe retornar "Sin categoría" para valores no numéricos', () => {
    assert.strictEqual(obtenerCategoria('abc'), 'Sin categoría');
    assert.strictEqual(obtenerCategoria(NaN), 'Sin categoría');
    assert.strictEqual(obtenerCategoria(null), 'Sin categoría');
  });
});

describe('obtenerTodasLasCategorias', () => {
  it('debe retornar array con todas las categorías ordenadas', () => {
    const categorias = obtenerTodasLasCategorias();
    assert.strictEqual(Array.isArray(categorias), true);
    assert.strictEqual(categorias.length, 10);
    assert.strictEqual(categorias[0], 'Personalizados');
    assert.strictEqual(categorias[1], 'Flora boxes');
  });

  it('debe incluir todas las categorías definidas', () => {
    const categorias = obtenerTodasLasCategorias();
    assert.ok(categorias.includes('Personalizados'));
    assert.ok(categorias.includes('Flora boxes'));
    assert.ok(categorias.includes('Adicionales'));
    assert.ok(categorias.includes('Condolencias'));
  });
});

describe('enriquecerCatalogoCategorias', () => {
  it('debe agregar campo "categoria" a cada producto', () => {
    const catalogo = [
      { id: 1, name: 'Producto 1', price: 100 },
      { id: 95, name: 'Producto 95', price: 200 }
    ];

    const enriquecido = enriquecerCatalogoCategorias(catalogo);
    
    assert.strictEqual(enriquecido[0].categoria, 'Flora boxes');
    assert.strictEqual(enriquecido[1].categoria, 'Personalizados');
  });

  it('no debe modificar el catálogo original', () => {
    const catalogo = [{ id: 1, name: 'Producto 1', price: 100 }];
    const original = JSON.parse(JSON.stringify(catalogo));

    enriquecerCatalogoCategorias(catalogo);
    
    assert.deepStrictEqual(catalogo, original);
  });

  it('debe preservar todas las propiedades originales', () => {
    const catalogo = [
      { 
        id: 42, 
        name: 'Bouquet Rosa', 
        price: 150, 
        img: 'img.jpg',
        stock: 10 
      }
    ];

    const enriquecido = enriquecerCatalogoCategorias(catalogo);
    
    assert.strictEqual(enriquecido[0].id, 42);
    assert.strictEqual(enriquecido[0].name, 'Bouquet Rosa');
    assert.strictEqual(enriquecido[0].price, 150);
    assert.strictEqual(enriquecido[0].img, 'img.jpg');
    assert.strictEqual(enriquecido[0].stock, 10);
    assert.strictEqual(enriquecido[0].categoria, 'Flora bouquets');
  });
});

describe('agruparPorCategoria', () => {
  it('debe agrupar productos por categoría correctamente', () => {
    const catalogo = [
      { id: 1, name: 'Box 1', categoria: 'Flora boxes' },
      { id: 2, name: 'Box 2', categoria: 'Flora boxes' },
      { id: 95, name: 'Personalizado', categoria: 'Personalizados' }
    ];

    const grupos = agruparPorCategoria(catalogo);
    
    assert.strictEqual(grupos['Flora boxes'].length, 2);
    assert.strictEqual(grupos['Personalizados'].length, 1);
  });

  it('debe inicializar todas las categorías aunque estén vacías', () => {
    const catalogo = [
      { id: 1, name: 'Box 1', categoria: 'Flora boxes' }
    ];

    const grupos = agruparPorCategoria(catalogo);
    
    assert.ok(grupos.hasOwnProperty('Personalizados'));
    assert.ok(grupos.hasOwnProperty('Flora canasto'));
    assert.ok(grupos.hasOwnProperty('Adicionales'));
    assert.strictEqual(Array.isArray(grupos['Personalizados']), true);
    assert.strictEqual(grupos['Personalizados'].length, 0);
  });

  it('debe inferir categoría si no está presente en el producto', () => {
    const catalogo = [
      { id: 42, name: 'Bouquet' }
    ];

    const grupos = agruparPorCategoria(catalogo);
    
    assert.strictEqual(grupos['Flora bouquets'].length, 1);
  });

  it('debe manejar productos sin categoría', () => {
    const catalogo = [
      { id: 999, name: 'Producto desconocido' }
    ];

    const grupos = agruparPorCategoria(catalogo);
    
    assert.ok(grupos['Sin categoría']);
    assert.strictEqual(grupos['Sin categoría'].length, 1);
  });
});

describe('filtrarPorCategoria', () => {
  const catalogo = [
    { id: 1, name: 'Box 1', categoria: 'Flora boxes' },
    { id: 95, name: 'Personalizado', categoria: 'Personalizados' },
    { id: 80, name: 'Adicional', categoria: 'Adicionales' }
  ];

  it('debe filtrar por una sola categoría (string)', () => {
    const filtrado = filtrarPorCategoria(catalogo, 'Flora boxes');
    
    assert.strictEqual(filtrado.length, 1);
    assert.strictEqual(filtrado[0].name, 'Box 1');
  });

  it('debe filtrar por múltiples categorías (array)', () => {
    const filtrado = filtrarPorCategoria(catalogo, ['Flora boxes', 'Personalizados']);
    
    assert.strictEqual(filtrado.length, 2);
  });

  it('debe retornar todo el catálogo si no se pasa categoría', () => {
    const filtrado = filtrarPorCategoria(catalogo, null);
    
    assert.strictEqual(filtrado.length, 3);
  });

  it('debe inferir categoría si no está presente en el producto', () => {
    const catalogoSinCat = [
      { id: 1, name: 'Box 1' },
      { id: 95, name: 'Personalizado' }
    ];

    const filtrado = filtrarPorCategoria(catalogoSinCat, 'Personalizados');
    
    assert.strictEqual(filtrado.length, 1);
    assert.strictEqual(filtrado[0].id, 95);
  });

  it('debe retornar array vacío si ninguna coincide', () => {
    const filtrado = filtrarPorCategoria(catalogo, 'Condolencias');
    
    assert.strictEqual(filtrado.length, 0);
  });
});

describe('CATEGORIAS_MAP', () => {
  it('debe tener 10 categorías definidas', () => {
    assert.strictEqual(CATEGORIAS_MAP.length, 10);
  });

  it('debe tener "Personalizados" como primera categoría', () => {
    assert.strictEqual(CATEGORIAS_MAP[0].nombre, 'Personalizados');
  });

  it('debe tener rangos correctos para cada categoría', () => {
    const personalizados = CATEGORIAS_MAP.find(c => c.nombre === 'Personalizados');
    assert.deepStrictEqual(personalizados.rango, [95, 95]);

    const boxes = CATEGORIAS_MAP.find(c => c.nombre === 'Flora boxes');
    assert.deepStrictEqual(boxes.rango, [1, 32]);

    const adicionales = CATEGORIAS_MAP.find(c => c.nombre === 'Adicionales');
    assert.deepStrictEqual(adicionales.rango, [80, 94]);
  });

  it('no debe tener rangos solapados', () => {
    for (let i = 0; i < CATEGORIAS_MAP.length; i++) {
      for (let j = i + 1; j < CATEGORIAS_MAP.length; j++) {
        const [min1, max1] = CATEGORIAS_MAP[i].rango;
        const [min2, max2] = CATEGORIAS_MAP[j].rango;
        
        // Verificar que no se solapen
        const solapa = !(max1 < min2 || max2 < min1);
        assert.strictEqual(solapa, false, 
          `Rangos solapados: ${CATEGORIAS_MAP[i].nombre} [${min1},${max1}] y ${CATEGORIAS_MAP[j].nombre} [${min2},${max2}]`
        );
      }
    }
  });
});
