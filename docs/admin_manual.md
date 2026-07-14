# Manual del Administrador

Este documento explica cómo operar la Porra Mensual utilizando Google Sheets como panel de control. Todo el backend lee de las hojas de Google, por lo que la administración consiste en editar las celdas adecuadas.

## Checklist de Primera Puesta en Marcha

Para iniciar un proyecto nuevo o un nuevo mes de porra, sigue estos pasos rigurosamente:

1. [ ] **Crear Google Sheet:** Crear una nueva hoja de cálculo en Google Sheets.
2. [ ] **Crear Pestañas:** Crear exactamente las 11 pestañas nombradas en `sheet_schema.md` (respetando mayúsculas y guiones bajos).
3. [ ] **Configurar Cabeceras:** En la fila 1 de cada pestaña, introducir los nombres de columnas definidos en `sheet_schema.md`. No usar negritas ni formatos especiales que puedan romper la lectura en texto plano del Script, aunque Apps Script suele ignorar el formato visual.
4. [ ] **Completar Config Inicial (`Config`):**
    - `active_month_id`: El ID del primer mes (ej. `2026-09`).
    - `pin_enabled`: `true` o `false`.
    - `site_title`: El título de la app (ej. `Porra Mensual`).
    - `show_predictions_before_lock`: `false`.
    - `registration_enabled`: `true` si permites alta desde web.
    - `registration_code`: Código de invitación opcional (ej. `PORRA2026`).
    - `pin_length`: Longitud del PIN generado (por defecto `4`).
5. [ ] **Cargar Participantes (`Participants`):** Añadir a todos los participantes con su `user_id` único, nombre para mostrar, `email`, `pin` y marcar `active` como `true`. Si el autoregistro web está activado, los usuarios aparecerán aquí automáticamente. **Importante:** Asegúrate de que las columnas `user_id`, `email` y `pin` tengan formato de **Texto Plano** (`@`) para evitar que se pierdan los ceros iniciales de los PINs.
6. [ ] **Crear Mes (`Months`):** Definir el mes inicial con estado `open` y su `lock_at` (fecha límite de apuestas en formato ISO 8601, ej. `2026-09-14T20:00:00Z`).
7. [ ] **Cargar Partidos (`Matches`):** Añadir los partidos del mes, asegurándose de que la columna `month_id` coincida con el mes creado.
8. [ ] **Desplegar Apps Script:** Ir a Extensiones > Apps Script, pegar `Code.gs`, realizar una "Nueva Implementación" como "Aplicación web" ejecutada como "Tú" y accesible para "Cualquiera".
9. [ ] **Conectar Frontend:** Copiar la URL del Web App de Apps Script y pegarla en la configuración de la web (`src/config.js` o similar).
10. [ ] **Prueba End-to-End:** Intentar hacer una predicción desde la web y verificar que se inscribe correctamente en `Predictions_Current` y genera log en `Predictions_Log`.

---

## Administración desde la Web (Novedad V2.8)

A partir de la versión 2.8, se puede gestionar la porra directamente desde la web (pestaña **Admin**) sin necesidad de abrir Google Sheets.

### Requisitos previos
En la pestaña `Config` de Google Sheets deben existir estas dos filas:
- `admin_enabled`: `true`
- `admin_token`: `<tu-codigo-secreto>`

*Importante: Este código es como una contraseña. Nunca lo compartas ni lo incluyas en archivos `.js` o `.html` del proyecto.*

### Uso del Panel Web
1. Entra a la pestaña **Admin** en la web.
2. Introduce tu `admin_token` (Código admin).
3. Selecciona el mes a administrar (por defecto carga el activo).
4. **Abrir / Cerrar Porra:** Utiliza los botones superiores para cambiar el estado de las apuestas de forma inmediata.
5. **Guardar Resultados:** Introduce los goles y selecciona el status (`pending`, `final` o `cancelled`). Solo los resultados en status `final` sumarán puntos.
6. Pulsa **Guardar Resultados**. El backend actualizará Google Sheets, recalculará los rankings automáticamente y refrescará la vista.

*Nota técnica: Por seguridad, todas las acciones del admin viajan por peticiones POST encriptadas.*

---

## Administración Manual Avanzada (Google Sheets)

Si prefieres o necesitas operar directamente en Google Sheets, a continuación se detalla el comportamiento de cada pestaña.

### 1. Gestión de Usuarios
- **Pestaña:** `Participants`
- **Acciones:**
  - Añadir nuevos usuarios (nuevas filas). **Nota:** Si `registration_enabled` es `true`, los usuarios creados desde la web se añaden como nuevas filas automáticamente al final de la hoja. Es obligatorio proporcionar un `email` válido para evitar duplicados. Los usuarios antiguos sin `email` seguirán funcionando con normalidad, pero el `email` es necesario para nuevos registros.
  - Desactivar usuarios (cambiar `active` a `false`).
  - Resetear PIN (escribir un nuevo PIN en la columna `pin` e informarlo al usuario). **Precaución:** Nunca cambies el formato de la columna PIN a "Número". Si un PIN generado empieza por cero (ej. `0838`), debe mantenerlo. Si vas a escribirlo manualmente y la columna no es de texto, usa un apóstrofe inicial (`'0838`).

### 2. Gestión de Meses (Abrir/Cerrar Porra)
- **Pestaña:** `Months`
- **Acciones:**
  - Para iniciar el mes: Poner `status` = `open` y revisar la fecha `lock_at`. Asegurarse de que en `Config` el valor de `active_month_id` apunte a este mes.
  - Para cerrar el mes manual: Cambiar `status` a `locked`. (Aunque el backend rechaza apuestas automáticamente si la hora actual es superior a `lock_at`, cambiar el status bloquea el mes permanentemente).
  - Para archivar: Cambiar `status` a `archived`.

### 3. Gestión de Partidos
- **Pestaña:** `Matches`
- **Acciones:**
  - Añadir los partidos antes de abrir el mes. **Regla de oro:** El `match_id` debe ser un identificador global único por temporada, no se puede repetir entre meses. Convención recomendada: `2026-08-m001`, `2026-09-m001`, etc.
  - Asignar la semana del partido en la columna opcional `week_no` (valores: 1, 2, 3 o 4) para el ranking por semanas. Si se deja vacío, el sistema asignará la semana automáticamente según el `display_order` (1-6 a S1, 7-12 a S2, etc.).
  - Modificar un horario si hay cambios antes del cierre (`kickoff_at`).

### 4. Puntuaciones y Resultados
- **Pestaña:** `Results`, `Scoring_Rules`
- **Acciones:**
  - Cuando terminen los partidos, el admin rellena `home_goals` y `away_goals` en `Results`. Si por algún motivo se cancela el partido, se debe poner `cancelled` o `cancelado` en la columna `status` para que no compute. En cualquier otro caso, el sistema lo computará si los goles son válidos.
  - **Novedad visual:** Cuando se guardan los resultados (sean parciales o finales), estos se mostrarán automáticamente en la pestaña de "Apuestas" para todos los usuarios.
  - Las reglas de juego definitivas se configuran en `Scoring_Rules` (ej. exact_draw=20, exact_non_draw=15, draw_not_exact=10, winner_not_exact=5, wrong=0). Puedes cambiar los puntos asignados, pero **NUNCA debes renombrar los `rule_id`**, ya que el código del backend depende estrictamente de ellos.
  - El backend (Apps Script) calcula de forma automática los rankings mensual y global y los escribe en las pestañas `Ranking_Monthly` y `Ranking_Global`. El ranking mensual reparte los puntos en las columnas S1, S2, S3 y S4 basándose en el `week_no` configurado en los partidos.
  - Al cambiar cualquier dato en `Results`, `Predictions_Current`, `Participants`, `Matches` o `Scoring_Rules`, el ranking debería recalcularse automáticamente y verás un mensaje flotante verde ("Rankings recalculados automáticamente").
- **Menú Porra Admin y Resolución de Problemas:**
  En la barra superior de Sheets dispones del menú "Porra Admin". Si editas un resultado y el ranking NO se actualiza (la web sigue igual o no ves el mensaje verde), debes:
  1. Usar **Porra Admin > Recalcular rankings** para forzar el recálculo manual.
  2. Si sigue sin funcionar, usar **Porra Admin > Diagnóstico ranking** para ver si faltan usuarios, ver por qué falló el guardado, etc.
  3. Asegúrate de haber ejecutado **Porra Admin > Instalar trigger de ranking** al menos una vez tras configurar el Script para que Apps Script tenga permiso total en segundo plano.
  4. Revisar que las cabeceras (fila 1) de `Ranking_Monthly` y `Ranking_Global` no han sido alteradas o reordenadas.
  5. Revisar que no haya reglas borradas en `Scoring_Rules`.
  6. **Importante sobre los IDs y Fechas ISO:** Estas columnas deben tener formato texto plano:
     - `Config.value` cuando `key = active_month_id`
     - `Months.month_id`
     - `Matches.month_id`
     - `Ranking_Monthly.month_id`
     - `Results.match_id`
     - `Predictions_Current.match_id`
     - `Participants.user_id`

     Si Google Sheets convierte `2026-08` en fecha (provocando que el sistema muestre fechas ISO como "2026-07-31T22:00:00.000Z"), debes escribirlo obligatoriamente con una comilla simple delante:
     `'2026-08`
### 5. Configuración de Rendimiento y Modo de Pruebas (Opcional)
- **Pestaña:** `Config`
- **Acción:** Puedes añadir una fila con la clave `testing_allow_result_simulation` y valor `true`.
- **Efecto:** Permite a los administradores probar libremente el sistema de puntuación rellenando resultados en la pestaña `Results` (si hay goles numéricos computará automáticamente) y luego usar la herramienta **Porra Admin > Diagnóstico scoring partido activo**. 
- **Acción:** Puedes añadir las variables de optimización de carga:
  - `testing_force_recalc_on_bootstrap`: `false` para uso normal (carga rápida). `true` para pruebas intensivas donde quieras ver el ranking cambiar en vivo tras cada F5.
  - `recalculate_after_prediction`: `false` recomendado. Evita que la app espere a un recálculo al guardar apuestas.
  - `ranking_dirty`: El backend lo pondrá a `true` si detecta cambios. El siguiente usuario que cargue la web experimentará un pequeño retraso y desencadenará el recálculo y limpieza del flag.
- **Efecto:** Mantiene la web rápida leyendo la caché de `Ranking_Monthly` y `Ranking_Global`, a menos que haya cambios pendientes (`ranking_dirty=true`).
- **Restricción:** Este modo NO exime las fechas de bloqueo (`lock_at`); los usuarios no podrán modificar apuestas fuera de plazo. Solo sirve para que el backend calcule ránkings provisionales sin restricciones de "estado" de partido, útil para QA y simular quién ganará la porra. **Al terminar las pruebas, asegúrate de devolver `testing_force_recalc_on_bootstrap` a `false`.**

### 6. Endpoints API de Depuración (Opcional, Solo Desarrolladores)
- **Pestaña:** `Config`
- **Requisito previo:** Debes configurar `debug_endpoints_enabled` a `true` y establecer una contraseña segura en `admin_token`.
- **Uso:** El backend permite consultar los cálculos internos de ranking y forzar su escritura en Sheets haciendo llamadas POST directas (por ejemplo, desde Postman o `curl`).
- **Endpoints disponibles:** `action=debugLiveRanking` y `action=recalculateRankings`.
- **Ejemplo POST (debugLiveRanking):**
  ```json
  {
    "action": "debugLiveRanking",
    "admin_token": "MI_TOKEN_SECRETO",
    "match_id": "m001"
  }
  ```
- **Advertencia de Seguridad:** ¡NO compartas el `admin_token` ni lo incluyas en el código frontend de la aplicación web! Al terminar la fase de QA o desarrollo, asegúrate de establecer `debug_endpoints_enabled` a `false`.

### 7. Correcciones de Apuestas (Excepciones)
- **Pestaña:** `Predictions_Current`
- **Acciones:**
  - Mientras el mes esté abierto (`open` y antes de `lock_at`), los usuarios pueden usar su PIN en la web para consultar y modificar su propia apuesta. No es necesaria intervención del admin.
  - Si el mes está cerrado (`locked` o venció `lock_at`), el usuario solo podrá consultar su apuesta, pero el formulario se bloqueará.
  - Después de la fecha límite, si el admin acepta una corrección excepcional por un error evidente, debe modificar `home_goals` y `away_goals` de la fila del `user_id` y `match_id` manualmente.

### 8. Operación Diaria (Mantenimiento)
- **Revisar apuestas:** Consultar `Predictions_Current` para verificar qué usuarios ya han enviado.
- **Revisar trazabilidad:** Consultar `Predictions_Log` para ver los intentos (exitosos o fallidos) ordenados por fecha y hora.
- **Pruebas y Estados:** Cambiar `status` a `locked` u `open` si es necesario realizar comprobaciones. **Siempre restaurar** el status correcto (`open`) tras realizar pruebas.

### 9. Operación Mensual (Cambio de ciclo y Temporada)
La aplicación soporta navegación multi-mes, es decir, el usuario puede seleccionar otros meses para ver su ranking, resultados o hacer apuestas (si están abiertos).
Para lanzar un nuevo mes sin borrar el historial:
1. **Crear nuevo mes:** En la pestaña `Months`, añadir fila (ej. `2026-10`) con `status = open` y definir su fecha de cierre (`lock_at`).
2. **Cargar partidos:** En la pestaña `Matches`, añadir los partidos asignándoles el nuevo `month_id`. **Recuerda usar un `match_id` único global** (ej. `2026-10-m001`).
3. **Activar mes por defecto:** En la pestaña `Config`, actualizar `active_month_id` al nuevo mes. Esto solo define el mes que carga por defecto en la web, pero los demás meses configurados (si no son `draft`) seguirán accesibles para los usuarios desde un selector en la interfaz.
4. **Cierre de ciclo (mes anterior):** Cambiar el status del mes anterior a `locked`, luego `scored` (tras calcular puntos), y finalmente `archived`.

### 10. Migración Manual de Datos (De Legacy a Multi-mes)
Si tu hoja de cálculo tiene datos antiguos donde `match_id` es solo `m001`, `m002`, y las tablas de apuestas/resultados no tienen `month_id`, debes migrarlas manualmente así para evitar errores en futuros meses:
1. En `Matches`, cambia los `m001` al formato global, ej. `2026-08-m001`. (Asegúrate de que no se auto-conviertan a fecha, usa `'2026-08-m001`).
2. En `Predictions_Current`, añade la columna `month_id` en la primera fila, escribe el ID del mes correspondiente (ej. `2026-08`) para todas las apuestas antiguas y cambia los `match_id` para coincidir con el formato global (ej. `2026-08-m001`).
3. En `Results`, haz exactamente lo mismo: añade la columna `month_id`, rellenala y actualiza los `match_id` al nuevo formato global.

---

## Qué edita Apps Script Automáticamente

El backend de Apps Script tiene permisos limitados. Automáticamente modifica:

1. **`Participants`:**
   - Si se habilita el autoregistro web, añade nuevas filas para usuarios nuevos.
2. **`Predictions_Current`:**
   - Escribe o sobreescribe las apuestas activas con los campos: `user_id`, `match_id`, `home_goals`, `away_goals`, `submitted_at`.
   - Lee toda la hoja, actualiza las apuestas del usuario y reescribe las filas para mantener la estructura simple.
3. **`Predictions_Log`:**
   - Añade filas de forma inmutable (append) con las columnas: `timestamp`, `user_id`, `action`, `details`.
   - Deja traza de las predicciones exitosamente guardadas, registros de usuario o errores si se configura para ello.
