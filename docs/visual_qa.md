# Visual QA Report

**Fecha:** 2026-07-13

## Resumen de cambios visuales
- Migración de tema oscuro (Glassmorphism) a tema claro y deportivo inspirado en `mundial-2026`.
- Nueva paleta de colores: fondo `#f8fafc`, tarjetas blancas `#ffffff`, cabecera azul marino oscuro `#020F2A` y acentos en rojo/rosa `#E50046`.
- Sustitución de la fuente principal por `Noto Sans`, manteniendo `Poppins` para los títulos.
- Componentes rediseñados: tarjetas limpias sin transparencias, navegación superior en estilo píldora, inputs blancos con bordes sutiles y tablas con encabezados en mayúsculas sobre fondo claro.
- Limpieza de estilos *inline* (ej: fondos de tarjetas, colores fijos) en los archivos de vistas (`homeView.js`, `rankingView.js`, `bettingView.js`, `statusView.js`, `adminView.js`) para que se hereden los nuevos colores de `:root`.

## Vistas revisadas
- **Inicio (Home):** Tarjeta principal ahora usa fondo de clase `.card` en blanco. Textos y métricas mantienen contraste.
- **Apuestas:** Formulario de registro y cuadrícula de predicciones integrados en fondo blanco, inputs claros y botón de guardar en rojo vibrante.
- **Crear participante:** Opciones y formulario con contraste correcto y coherente.
- **Ranking:** Círculos de posición y estadísticas semánticas ahora lucen legibles contra el nuevo fondo blanco (gris muy claro para posiciones > 3).
- **Estado:** Tabla clara, etiquetas (badges) legibles con fondo blanco.
- **Admin:** Mensajes integrados en marco claro.

## Resultado escritorio
Correcto. El diseño adopta un estilo premium y deportivo, muy similar a la estructura de torneos. Tablas bien organizadas y header que destaca con alto contraste.

## Resultado móvil
Correcto. Los botones del navbar se desplazan horizontalmente de forma nativa sin romper la cabecera. Las tablas se mantienen en su contenedor con `overflow-x: auto` sin romper la vista principal.

## Errores encontrados
- Durante la refactorización, algunos gradientes y colores fijos (*inline*) en los archivos JS chocaban con el nuevo diseño claro.
- El círculo del número de posición en el Ranking podía no ser legible para posiciones fuera del Top 3 si usaba blanco semitransparente.
- Formularios en `bettingView` usaban una variable que no existía en el nuevo tema oscuro/claro.

## Correcciones aplicadas
- Eliminado el gradiente forzado de la vista de inicio.
- Se ajustaron los colores *inline* de las posiciones del ranking para usar fondos grises `#f1f5f9` para el resto de posiciones con texto oscuro heredado.
- Adaptado el `badge-warning` para quitar su fondo transparente oscuro.
- Modificado el fondo del contenedor de registro en `bettingView.js` para usar `--bg-dark`.

## Pendientes visuales recomendados
- Sustituir el emoji de logo genérico por un asset gráfico definitivo que case con el azul/rojo del tema.
- Considerar incluir iconos o escudos de equipos si en el futuro se amplía el listado de partidos.
