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
5. [ ] **Cargar Participantes (`Participants`):** Añadir a todos los participantes con su `user_id` único, nombre para mostrar, `pin` y marcar `active` como `true`.
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
  - Añadir nuevos usuarios (nuevas filas).
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
- **Pestaña:** `Results`, `Ranking_Monthly` y `Ranking_Global`
- **Acciones:**
  - Cuando terminen los partidos, el admin rellena `home_goals` y `away_goals` en `Results`.
  - El administrador debe calcular el ranking. Esto se puede hacer mediante una macro de Apps Script personalizada, fórmulas en las hojas, o un script externo local. Apps Script (backend) **no calcula rankings**, solo envía al frontend el contenido de `Ranking_Monthly` y `Ranking_Global`.

### 5. Correcciones de Apuestas (Excepciones)
- **Pestaña:** `Predictions_Current`
- **Acciones:**
  - Antes de la fecha límite, el usuario puede reenviar desde la web sin intervención del admin.
  - Después de la fecha límite, si el admin acepta una corrección excepcional por un error evidente, debe modificar `home_goals` y `away_goals` de la fila del `user_id` y `match_id` manualmente.

---

## Qué edita Apps Script Automáticamente

El backend de Apps Script tiene permisos limitados. Automáticamente modifica:

1. **`Predictions_Current`:**
   - Escribe o sobreescribe las apuestas activas con los campos: `user_id`, `match_id`, `home_goals`, `away_goals`, `submitted_at`.
   - Lee toda la hoja, actualiza las apuestas del usuario y reescribe las filas para mantener la estructura simple.
2. **`Predictions_Log`:**
   - Añade filas de forma inmutable (append) con las columnas: `timestamp`, `user_id`, `action`, `details`.
   - Deja traza de las predicciones exitosamente guardadas o errores si se configura para ello.
