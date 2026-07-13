# Auditoría Visual: Referencia Mundial 2026

Este documento resume el análisis visual del proyecto de referencia `ref/mundial-2026` y propone cómo adaptar la estética del proyecto `porra-mensual` (actualmente con tema oscuro/glassmorphism) a un estilo claro, limpio y deportivo similar al del mundial, **sin alterar la funcionalidad actual**.

## 1. Resumen Visual del Estilo Mundial-2026

El tema de referencia es un diseño **claro (Light Theme)** con un encabezado muy contrastado y acentos vibrantes.

*   **Colores Principales:**
    *   Fondo general: `#f8fafc` (Gris azulado muy claro)
    *   Fondo tarjetas: `#ffffff` (Blanco puro)
    *   Texto principal: `#020F2A` (Azul marino muy oscuro)
    *   Texto secundario: `#64748b` (Gris pizarra)
    *   Acento principal: `#E50046` (Rojo carmesí/rosado)
    *   Header: Fondo `#020F2A` con texto `#ffffff` y borde inferior grueso `#E50046`.
*   **Tipografía:**
    *   Cuerpo: `Noto Sans`
    *   Títulos (h1-h6, navegación, tablas): `Poppins`
*   **Componentes Clave:**
    *   **Navegación (Header):** Botones estilo "píldora" (`border-radius: 40px`), fondo semitransparente oscuro, estado activo en color acento.
    *   **Tarjetas (Cards):** Bordes suaves (`12px`), línea sutil (`1px solid #e2e8f0`), sombra muy ligera (`box-shadow: 0 4px 6px -1px rgba(...)`).
    *   **Tablas:** Encabezados en mayúsculas, fuente `Poppins`, fondo gris claro (`#f8fafc`), filas con efecto hover (`#f1f5f9`).
    *   **Estado/Badges:** Colores semánticos definidos (Éxito: verde `#00A651`, Peligro: rojo `#E50046`, Pendiente/Aviso: amarillo `#FFB800`).

## 2. Recomendaciones de Adaptación

### Elementos a Copiar/Adaptar
1.  **Paleta de Colores Clara:** Migrar el tema oscuro actual (`#0f172a`) al tema claro de la referencia (`#f8fafc`).
2.  **Encabezado (Header):** Aplicar el fondo azul marino oscuro (`#020F2A`) y la franja inferior roja (`#E50046`).
3.  **Botones de Navegación:** Cambiar el estilo de los `.btn-nav` para que parezcan píldoras flotantes dentro del header.
4.  **Tipografía:** Reemplazar `Inter` por `Noto Sans` en el cuerpo general del CSS y en la importación de fuentes del HTML.
5.  **Estilos de Tarjetas y Tablas:** Quitar el glassmorphism y los bordes transparentes; aplicar fondo blanco y bordes grises con sombras suaves.

### Elementos que NO se deben copiar
1.  **Estructura del HTML (Layout):** No alterar las vistas completas de la referencia (como los grids específicos o el sistema de tabs de los participantes), ya que `porra-mensual` tiene sus propias vistas (home, apuestas, ranking, estado, admin).
2.  **Lógica o IDs de DOM:** Mantener los mismos IDs y clases funcionales (ej. `[data-target="home"]`) en el HTML para no romper los eventos JS actuales.
3.  **Iconografía / Logos:** Evitar la copia directa de imágenes o logos del mundial si no corresponden conceptualmente.

## 3. Propuesta de Paleta CSS para `porra-mensual`

Reemplazar las variables de `:root` en `styles/main.css`:

```css
:root {
  /* Premium Light Theme Variables (Mundial Style) */
  --bg-dark: #f8fafc; /* Fondo general claro */
  --bg-card: #ffffff;
  --bg-card-hover: #f1f5f9;
  --text-main: #020F2A;
  --text-muted: #64748b;
  
  /* Accents */
  --accent-primary: #E50046; /* Rojo/Rosa principal */
  --accent-primary-hover: #C4003C;
  --accent-secondary: #FFB800; /* Oro/Amarillo para highlights */
  --accent-secondary-hover: #E6A600;
  --accent-danger: #E50046;
  --accent-info: #3b82f6; 
  --success-color: #00A651;

  /* Header */
  --header-bg: #020F2A;
  --header-text: #ffffff;

  /* Structural */
  --border-light: #e2e8f0;
  --border-radius: 12px;
  --border-radius-sm: 8px;
  
  /* Typography */
  --font-main: 'Noto Sans', sans-serif;
  --font-heading: 'Poppins', sans-serif;
  
  /* Eliminar variables de glassmorphism o convertirlas en color sólido */
  --glass-bg: #020F2A;
  --glass-border: transparent;
}
```

## 4. Lista de clases CSS actuales a modificar (`styles/main.css`)

*   **`body`**: Asegurar el nuevo color de fondo claro y texto oscuro.
*   **`.app-header`**: Quitar `backdrop-filter`, aplicar fondo `--header-bg` y añadir `border-bottom: 4px solid var(--accent-primary)`.
*   **`.btn-nav`**: Cambiar el `border-radius` a `40px` (estilo píldora). Modificar el estado `.active` para que coincida con el acento rojo sin transparencias del fondo.
*   **`.card`**: Cambiar a fondo blanco y aplicar un `box-shadow` muy sutil en vez del efecto actual. Eliminar el borde translúcido blanco.
*   **`table`, `th`, `td`**: Limpiar estilos para modo claro. Poner `th` en mayúsculas (`text-transform: uppercase`), letra un poco más pequeña y borde inferior fuerte.
*   **`.form-select`, `.form-input`**: Aplicar fondo `#ffffff` (en lugar del semitransparente oscuro), bordes claros y efecto *focus* con sombra coloreada en lugar del actual.
*   **`.badge-*`**: Ajustar los colores de fondo translúcido a verde/amarillo/rojo con texto de contraste alto sobre fondo blanco.

## 5. Vistas que necesitan retoques mínimos de markup (HTML/JS)

Existen estilos *inline* inyectados por JS o puestos en el HTML que chocarán con el modo claro:

*   **`index.html`**:
    *   Actualizar los `<link>` de Google Fonts para importar `Noto Sans` en vez de `Inter`.
    *   Verificar los *templates* `<template id="loading-template">` y `<template id="error-template">` para que el texto cargando o el error se vean bien en modo claro (actualmente podrían estar forzando colores fijos).
*   **`src/views/homeView.js`**:
    *   Eliminar el `background: linear-gradient(135deg, var(--bg-card) 0%, rgba(16, 185, 129, 0.1) 100%)` *inline* de la tarjeta principal para dejar que la clase `.card` lo gestione o adaptarlo a los colores de `--accent-primary`.
    *   Revisar el uso de `--accent-*` en las métricas (por ejemplo, el texto de las estadísticas que usa `--accent-info` y `--accent-secondary`) para garantizar buen contraste.
*   **`src/views/rankingView.js`**:
    *   El círculo de la posición tiene colores fijos y opacidades *inline* (ej. `rgba(255,255,255,0.1)` o texto negro condicional `#000` si `i < 3`). Hay que cambiar esto para que contraste correctamente sobre fondo blanco (por ejemplo, un fondo gris claro `#f1f5f9` para el resto).
    *   La puntuación de aciertos de signos tiene colores *hardcodeados* (`#10b981` y `#f59e0b`). Sustituir por `--success-color` y `--accent-secondary` respectivamente.

## 6. Riesgos de romper funcionalidad

*   **Bajo Riesgo**: Cambiar `styles/main.css` y las fuentes en `index.html` es puramente estético.
*   **Riesgo Medio-Bajo**: Modificar los archivos `View.js` para limpiar estilos *inline*. La precaución debe estar en no borrar expresiones JS (`${...}`) ni cambiar interpolación de variables al limpiar los atributos `style=""`. Si se modifica la estructura del HTML, se puede romper el re-renderizado o el enganche a eventos. La acción debe ser estrictamente de limpieza CSS en línea.
