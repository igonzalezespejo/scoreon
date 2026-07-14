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
5. [ ] **Cargar Participantes (`Participants`):** Añadir a todos los participantes con su `user_id` único, nombre para mostrar, `pin` y marcar `active` como `true`. Si el autoregistro web está activado, los usuarios aparecerán aquí automáticamente.
6. [ ] **Crear Mes (`Months`):** Definir el mes inicial con estado `open` y su `lock_at` (fecha límite de apuestas en formato ISO 8601, ej. `2026-09-14T20:00:00Z`).
7. [ ] **Cargar Partidos (`Matches`):** Añadir los partidos del mes, asegurándose de que la columna `month_id` coincida con el mes creado.
8. [ ] **Desplegar Apps Script:** Ir a Extensiones > Apps Script, pegar `Code.gs`, realizar una "Nueva Implementación" como "Aplicación web" ejecutada como "Tú" y accesible para "Cualquiera".
9. [ ] **Conectar Frontend:** Copiar la URL del Web App de Apps Script y pegarla en la configuración de la web (`src/config.js` o similar).
10. [ ] **Prueba End-to-End:** Intentar hacer una predicción desde la web y verificar que se inscribe correctamente en `Predictions_Current` y genera log en `Predictions_Log`.

---

## Qué edita el Administrador Manualmente

La gran mayoría de la gestión de la porra se realiza editando la Google Sheet manualmente.

### 1. Gestión de Usuarios
- **Pestaña:** `Participants`
- **Acciones:**
  - Añadir nuevos usuarios (nuevas filas). **Nota:** Si `registration_enabled` es `true`, los usuarios creados desde la web se añaden como nuevas filas automáticamente al final de la hoja.
  - Desactivar usuarios (cambiar `active` a `false`).
  - Resetear PIN (escribir un nuevo PIN en la columna `pin` e informarlo al usuario).

### 2. Gestión de Meses (Abrir/Cerrar Porra)
- **Pestaña:** `Months`
- **Acciones:**
  - Para iniciar el mes: Poner `status` = `open` y revisar la fecha `lock_at`. Asegurarse de que en `Config` el valor de `active_month_id` apunte a este mes.
  - Para cerrar el mes manual: Cambiar `status` a `locked`. (Aunque el backend rechaza apuestas automáticamente si la hora actual es superior a `lock_at`, cambiar el status bloquea el mes permanentemente).
  - Para archivar: Cambiar `status` a `archived`.

### 3. Gestión de Partidos
- **Pestaña:** `Matches`
- **Acciones:**
  - Añadir los partidos antes de abrir el mes.
  - Modificar un horario si hay cambios antes del cierre (`kickoff_at`).

### 4. Puntuaciones y Resultados
- **Pestaña:** `Results`, `Scoring_Rules`
- **Acciones:**
  - Cuando terminen los partidos, el admin rellena `home_goals` y `away_goals` en `Results`. Si por algún motivo se cancela el partido, se debe poner `cancelled` o `cancelado` en la columna `status` para que no compute. En cualquier otro caso, el sistema lo computará si los goles son válidos.
  - Las reglas de juego definitivas se configuran en `Scoring_Rules` (ej. exact_draw=20, exact_non_draw=15, draw_not_exact=10, winner_not_exact=5, wrong=0). Puedes cambiar los puntos asignados, pero **NUNCA debes renombrar los `rule_id`**, ya que el código del backend depende estrictamente de ellos.
  - El backend (Apps Script) calcula de forma automática los rankings mensual y global y los escribe en las pestañas `Ranking_Monthly` y `Ranking_Global`. Estas pestañas son la fuente de verdad visual y auditable que lee el frontend.
  - Al cambiar cualquier dato en `Results`, `Predictions_Current`, `Participants`, `Matches` o `Scoring_Rules`, el ranking debería recalcularse automáticamente y verás un mensaje flotante verde ("Rankings recalculados automáticamente").
- **Menú Porra Admin y Resolución de Problemas:**
  En la barra superior de Sheets dispones del menú "Porra Admin". Si editas un resultado y el ranking NO se actualiza (la web sigue igual o no ves el mensaje verde), debes:
  1. Usar **Porra Admin > Recalcular rankings** para forzar el recálculo manual.
  2. Si sigue sin funcionar, usar **Porra Admin > Diagnóstico ranking** para ver si faltan usuarios, ver por qué falló el guardado, etc.
  3. Asegúrate de haber ejecutado **Porra Admin > Instalar trigger de ranking** al menos una vez tras configurar el Script para que Apps Script tenga permiso total en segundo plano.
  4. Revisar que las cabeceras (fila 1) de `Ranking_Monthly` y `Ranking_Global` no han sido alteradas o reordenadas.
  5. Revisar que no haya reglas borradas en `Scoring_Rules`.
  6. **Importante sobre los IDs:** Google Sheets a veces convierte IDs como `2026-09` en fechas. Para evitar fallos en los cruces de datos, asegúrate de que columnas como `user_id`, `match_id`, `month_id`, `active_month_id` y `status` tienen **formato de Texto Sencillo** (puedes forzarlo escribiendo una comilla simple delante, ej. `'2026-09`).

### 5. Modo de Pruebas / Simulación (Opcional)
- **Pestaña:** `Config`
- **Acción:** Puedes añadir una fila con la clave `testing_allow_result_simulation` y valor `true`.
- **Efecto:** Permite a los administradores probar libremente el sistema de puntuación rellenando resultados en la pestaña `Results` (si hay goles numéricos computará automáticamente) y luego usar la herramienta **Porra Admin > Diagnóstico scoring partido activo**. 
- **Acción:** Puedes añadir una fila con la clave `testing_force_recalc_on_bootstrap` y valor `true`.
- **Efecto:** Fuerza un recálculo del ranking cada vez que la web carga los datos iniciales, útil para aislar problemas de caché durante desarrollo.
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

### 9. Operación Mensual (Cambio de ciclo)
Para lanzar una nueva porra cada mes:
1. **Crear nuevo mes:** En la pestaña `Months`, añadir fila (ej. `2026-10`) con `status = open` y definir su fecha de cierre (`lock_at`).
2. **Cargar partidos:** En la pestaña `Matches`, añadir los partidos asignándoles el nuevo `month_id`.
3. **Activar mes:** En la pestaña `Config`, actualizar `active_month_id` al nuevo mes.
4. **Cierre de ciclo (mes anterior):** Cambiar el status del mes anterior a `locked`, luego `scored` (tras calcular puntos), y finalmente `archived`.

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
