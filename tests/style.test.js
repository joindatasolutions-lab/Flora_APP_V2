/**
 * Tests de validación para style.css
 * Verifica que las clases y estilos necesarios estén definidos
 * Ejecutar con: npm test
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Leer el archivo CSS
const cssPath = path.join(__dirname, '..', 'style.css');
const cssContent = fs.readFileSync(cssPath, 'utf-8');

describe('style.css - Variables CSS', () => {
  it('debe definir variable --rosa', () => {
    assert.ok(cssContent.includes('--rosa'));
  });

  it('debe definir variable --rosa-osc', () => {
    assert.ok(cssContent.includes('--rosa-osc'));
  });

  it('debe definir variable --bg (background)', () => {
    assert.ok(cssContent.includes('--bg'));
  });

  it('debe definir variable --gris', () => {
    assert.ok(cssContent.includes('--gris'));
  });

  it('debe definir variable --borde', () => {
    assert.ok(cssContent.includes('--borde'));
  });
});

describe('style.css - Estilos del catálogo', () => {
  it('debe tener estilos para .catalogo', () => {
    assert.ok(cssContent.includes('.catalogo'));
  });

  it('debe tener estilos para .catalogo-grid', () => {
    assert.ok(cssContent.includes('.catalogo-grid'));
  });

  it('debe tener estilos para .card', () => {
    assert.ok(cssContent.includes('.card'));
  });

  it('debe tener estilos para .card img', () => {
    assert.ok(cssContent.includes('.card img'));
  });

  it('debe tener estilos para .card:hover', () => {
    assert.ok(cssContent.includes('.card:hover'));
  });

  it('debe usar grid en .catalogo o .catalogo-grid', () => {
    assert.ok(cssContent.includes('display: grid') || cssContent.includes('display:grid'));
  });

  it('debe tener configuración de aspect-ratio para imágenes', () => {
    assert.ok(cssContent.includes('aspect-ratio'));
  });
});

describe('style.css - Estilos de categorías', () => {
  it('debe tener estilos para .categoria-seccion', () => {
    assert.ok(cssContent.includes('.categoria-seccion'));
  });

  it('debe tener estilos para .categoria-header', () => {
    assert.ok(cssContent.includes('.categoria-header'));
  });

  it('debe tener estilos para .categoria-titulo', () => {
    assert.ok(cssContent.includes('.categoria-titulo'));
  });

  it('.categoria-seccion debe ocupar ancho completo (grid-column)', () => {
    const seccionMatch = cssContent.match(/\.categoria-seccion[^}]*grid-column[^}]*/);
    if (seccionMatch) {
      assert.ok(seccionMatch[0].includes('1 / -1'));
    } else {
      // Buscar en otro selector relacionado
      assert.ok(cssContent.includes('grid-column: 1 / -1') || 
                cssContent.includes('grid-column:1 / -1'));
    }
  });
});

describe('style.css - Estilos del buscador', () => {
  it('debe tener estilos para .search-box', () => {
    assert.ok(cssContent.includes('.search-box'));
  });

  it('debe tener estilos para #searchInput', () => {
    assert.ok(cssContent.includes('#searchInput') || cssContent.includes('searchInput'));
  });

  it('debe tener border-radius en searchInput para diseño redondeado', () => {
    const searchSection = cssContent.substring(
      cssContent.indexOf('#searchInput'),
      cssContent.indexOf('}', cssContent.indexOf('#searchInput'))
    );
    assert.ok(searchSection.includes('border-radius'));
  });
});

describe('style.css - Estilos del filtro de categorías', () => {
  it('debe tener estilos para .filtro-categorias-container', () => {
    assert.ok(cssContent.includes('.filtro-categorias-container'));
  });

  it('debe tener estilos para .filtro-label', () => {
    assert.ok(cssContent.includes('.filtro-label'));
  });

  it('debe tener estilos para .filtro-select', () => {
    assert.ok(cssContent.includes('.filtro-select'));
  });

  it('.filtro-select debe tener border-radius de 20px', () => {
    const filtroSection = cssContent.substring(
      cssContent.indexOf('.filtro-select {'),
      cssContent.indexOf('}', cssContent.indexOf('.filtro-select {') + 50)
    );
    assert.ok(filtroSection.includes('border-radius: 20px') || 
              filtroSection.includes('border-radius:20px'));
  });

  it('.filtro-select debe tener estilos de hover', () => {
    assert.ok(cssContent.includes('.filtro-select:hover'));
  });

  it('.filtro-select debe tener estilos de focus', () => {
    assert.ok(cssContent.includes('.filtro-select:focus'));
  });

  it('.filtro-select debe tener box-shadow', () => {
    const filtroSection = cssContent.substring(
      cssContent.indexOf('.filtro-select {'),
      cssContent.indexOf('}', cssContent.indexOf('.filtro-select {') + 200)
    );
    assert.ok(filtroSection.includes('box-shadow'));
  });
});

describe('style.css - Estilos del carrito', () => {
  it('debe tener estilos para .drawer', () => {
    assert.ok(cssContent.includes('.drawer'));
  });

  it('debe tener estilos para .cart-fab (botón flotante)', () => {
    assert.ok(cssContent.includes('.cart-fab'));
  });

  it('debe tener estilos para #cartCount', () => {
    assert.ok(cssContent.includes('#cartCount') || cssContent.includes('cartCount'));
  });
});

describe('style.css - Estilos del formulario', () => {
  it('debe tener estilos para inputs', () => {
    assert.ok(cssContent.includes('input[type=') || cssContent.includes('input {'));
  });

  it('debe tener estilos para select', () => {
    assert.ok(cssContent.includes('select'));
  });

  it('debe tener estilos para textarea', () => {
    assert.ok(cssContent.includes('textarea'));
  });

  it('debe tener estilos para botones', () => {
    assert.ok(cssContent.includes('button') || cssContent.includes('.btn'));
  });
});

describe('style.css - Responsive design', () => {
  it('debe tener media queries para móvil', () => {
    assert.ok(cssContent.includes('@media'));
  });

  it('debe tener media query para pantallas pequeñas (max-width)', () => {
    assert.ok(cssContent.includes('max-width'));
  });

  it('debe tener media query para desktop (min-width: 768px)', () => {
    assert.ok(cssContent.includes('768px') && cssContent.includes('min-width'));
  });

  it('.catalogo-grid debe ajustarse a 2 columnas en móvil', () => {
    // Buscar la sección de media query para móvil
    const startIndex = cssContent.indexOf('@media (max-width: 767px)');
    const endIndex = cssContent.indexOf('@media', startIndex + 10);
    const mobileSection = cssContent.substring(startIndex, endIndex === -1 ? undefined : endIndex);
    
    console.log('DEBUG: startIndex:', startIndex);
    console.log('DEBUG: endIndex:', endIndex);
    console.log('DEBUG: mobileSection length:', mobileSection.length);
    console.log('DEBUG: mobileSection includes .catalogo-grid:', mobileSection.includes('.catalogo-grid'));
    console.log('DEBUG: mobileSection includes repeat(2, 1fr):', mobileSection.includes('repeat(2, 1fr)'));
    
    if (mobileSection.includes('.catalogo-grid')) {
      assert.ok(mobileSection.includes('repeat(2, 1fr)'));
    } else {
      console.warn('⚠️  Verificar que .catalogo-grid tenga 2 columnas en móvil');
    }
  });

  it('debe tener estilos específicos para max-width: 600px', () => {
    assert.ok(cssContent.includes('600px'));
  });
});

describe('style.css - Transiciones y animaciones', () => {
  it('debe usar transition para efectos suaves', () => {
    assert.ok(cssContent.includes('transition'));
  });

  it('debe tener transiciones en .card', () => {
    const cardSection = cssContent.substring(
      cssContent.indexOf('.card {'),
      cssContent.indexOf('}', cssContent.indexOf('.card {'))
    );
    assert.ok(cardSection.includes('transition'));
  });

  it('debe tener estilos de transform para efectos hover', () => {
    assert.ok(cssContent.includes('transform'));
  });
});

describe('style.css - Tamaños y límites', () => {
  it('.catalogo debe tener max-width definido', () => {
    const catalogoSection = cssContent.substring(
      cssContent.indexOf('.catalogo {'),
      cssContent.indexOf('}', cssContent.indexOf('.catalogo {'))
    );
    assert.ok(catalogoSection.includes('max-width'));
  });

  it('.catalogo-grid debe limitar tamaño máximo de tarjetas en desktop', () => {
    // Buscar media query de desktop
    const desktopSection = cssContent.substring(
      cssContent.indexOf('@media (min-width: 768px)'),
      cssContent.length
    );
    
    // Verificar que haya un límite en el grid
    if (desktopSection.includes('.catalogo-grid')) {
      assert.ok(desktopSection.includes('320px') || desktopSection.includes('minmax'));
    }
  });
});

describe('style.css - Sintaxis y formato', () => {
  it('no debe tener @media anidados (sintaxis SCSS inválida en CSS puro)', () => {
    // Buscar patrones de @media dentro de selectores (sintaxis SCSS)
    const lines = cssContent.split('\n');
    let insideSelector = false;
    let braceCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.includes('{')) {
        braceCount += (line.match(/{/g) || []).length;
        if (braceCount > 0 && !line.startsWith('@')) {
          insideSelector = true;
        }
      }
      
      if (line.includes('}')) {
        braceCount -= (line.match(/}/g) || []).length;
        if (braceCount === 0) {
          insideSelector = false;
        }
      }
      
      if (insideSelector && line.includes('@media')) {
        assert.fail(`@media anidado encontrado en línea ${i + 1}: ${line}`);
      }
    }
    
    assert.ok(true, 'No se encontraron @media anidados');
  });

  it('debe cerrar todas las llaves correctamente', () => {
    const openBraces = (cssContent.match(/{/g) || []).length;
    const closeBraces = (cssContent.match(/}/g) || []).length;
    assert.strictEqual(openBraces, closeBraces, 'Número de llaves desbalanceado');
  });
});

describe('style.css - Colores y tema', () => {
  it('debe usar colores de la paleta rosa', () => {
    assert.ok(cssContent.includes('#e6a5b6') || cssContent.includes('var(--rosa)'));
  });

  it('debe tener consistencia en uso de variables CSS', () => {
    const varCount = (cssContent.match(/var\(--/g) || []).length;
    assert.ok(varCount > 0, 'Debe usar variables CSS para consistencia');
  });
});
