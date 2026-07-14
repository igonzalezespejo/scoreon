# Plan de Implementación: Panel de Administración Real

## 1. Resumen
Actualmente la vista de Administración en la web es únicamente informativa. El objetivo de este plan es convertirla en un panel funcional, protegido por un código/token configurado en Google Sheets, desde el cual el administrador podrá gestionar la porra del mes: ver y establecer resultados de partidos, recalcular rankings y abrir o cerrar las apuestas del mes.

## 2. Estados Permitidos
- **Meses (Months.status):** `open` (apuestas abiertas), `locked` (apuestas cerradas).
- **Resultados (Results.status):** 
  - `pending`: sin jugar, o si el admin deja los goles vacíos. No computa para ranking.
  - `final`: partido finalizado con goles. Computa para ranking. (Se usa `final`, no `finalized`).
  - `cancelled`: partido cancelado. No computa para ranking aunque haya goles introducidos.

## 3. Endpoints Propuestos
Se añadirán 4 nuevos endpoints al backend en Apps Script. Todos requerirán que el payload se envíe por método `POST` y que incluyan el `admin_token`.

- `adminGetMonths`: Obtiene los meses disponibles, su estado y cuál es el `active_month_id`.
- `adminGetMonthMatches`: Obtiene los partidos de un mes seleccionado y su resultado o estado actual, consultando la hoja `Results`.
- `adminSaveResults`: Realiza un upsert en la hoja `Results` con los nuevos resultados, actualiza la metadata y recalcula los rankings.
- `adminSetMonthStatus`: Permite cambiar el estado de un mes a `open` o `locked` en la hoja `Months`.

## 4. Payloads de Endpoints

### 4.1 adminGetMonths
**Payload (POST):**
```json
{
  "action": "adminGetMonths",
  "admin_token": "TOKEN_SECRETO"
}
```

**Devuelve:**
- `months`: lista de meses disponibles.
- `active_month_id`: mes activo actual.

### 4.2 adminGetMonthMatches
**Payload (POST):**
```json
{
  "action": "adminGetMonthMatches",
  "admin_token": "TOKEN_SECRETO",
  "month_id": "2026-09"
}
```

**Devuelve:**
- Lista de partidos del mes.
- Resultados actuales si existen en la hoja `Results`.
- Status del resultado (`pending`, `final`, `cancelled`).

### 4.3 adminSaveResults
**Payload (POST):**
```json
{
  "action": "adminSaveResults",
  "admin_token": "TOKEN_SECRETO",
  "month_id": "2026-09",
  "results": [
    {
      "match_id": "m001",
      "home_goals": 2,
      "away_goals": 1,
      "status": "final"
    }
  ]
}
```

**Reglas de Backend:**
- Si goles vacíos, status será `pending` y no computará.
- Si status `cancelled`, no computa.
- Realiza `upsert` por `match_id` en `Results`.
- Establece `updated_at` a la hora del servidor y `updated_by` a "admin_web".
- Recalcula los rankings `Ranking_Monthly` y `Ranking_Global`.
- Devuelve un resumen de éxito y/o los rankings actualizados.

### 4.4 adminSetMonthStatus
**Payload (POST):**
```json
{
  "action": "adminSetMonthStatus",
  "admin_token": "TOKEN_SECRETO",
  "month_id": "2026-09",
  "status": "locked"
}
```

**Reglas de Backend:**
- Actualiza `Months.status` al nuevo estado (para la UI inicial solo `open` o `locked`).
- Registra la acción en `Admin_Actions`.

## 5. Seguridad: admin_token
- El código de administración (token) **no** debe estar hardcodeado en el frontend.
- Se lee desde Google Sheets > `Config` (`key: admin_token`). El panel web solo se habilitará si `Config.admin_enabled == true`.
- El administrador introduce el token manualmente en la vista Admin.
- Se envía el `admin_token` en el payload de cada acción (por `POST`, nunca `GET`).
- Apps Script valida este token recibido contra el de la configuración. Si es incorrecto devuelve código de no autorizado.

## 6. UI Propuesta (adminView.js)

### Vista 1: No Autenticado
- Mostrar formulario con input "Código admin" (tipo password o text).
- Botón "Entrar".

### Vista 2: Autenticado
- Si el token es correcto, se desbloquean las secciones:
  - **Selección de Mes:** Permite elegir qué mes se va a administrar (por defecto el activo).
  - **Sección "Abrir/Cerrar apuestas":** Botones para cambiar el estado del mes seleccionado a `open` o `locked`.
  - **Sección "Resultados":** Listado de partidos del mes. Inputs para goles locales y visitantes. Select para el status (`pending`, `final`, `cancelled`).
  - **Sección "Recalcular rankings":** Botón manual de recálculo (opcional, ya que guardar resultados debe recalcular automáticamente).
  - Botón principal "Guardar Resultados".

## 7. Plan de Implementación por Fases

1. **Backend API:** Crear endpoints en `Code.gs` (`adminGetMonths`, `adminGetMonthMatches`, `adminSaveResults`, `adminSetMonthStatus`), implementando validación de `admin_token` y `LockService`.
2. **Frontend UI Base:** Crear el esqueleto en `index.html` para la vista Admin, con estados "No autenticado" y "Autenticado".
3. **Frontend Lógica Base:** Conectar vista de autenticación y carga del listado de meses y partidos.
4. **Frontend Edición y Guardado:** Habilitar inputs de resultados y botones de abrir/cerrar mes. Conectar con el endpoint de guardado y manejar estado de carga/errores.
5. **Testing (QA):** Validar todas las casuísticas de seguridad, actualización de `Results`, cálculo de rankings y bloqueos de mes desde la web.

## 8. Riesgos y Mitigaciones
- **Riesgo:** Conflicto de recálculo si el guardado coincide con usuarios apostando.
  - **Mitigación:** Aplicar uso estricto de `LockService` en las operaciones del administrador al guardar resultados.
- **Riesgo:** Guardar estado "cancelled" pero recalcular por error si tiene goles.
  - **Mitigación:** Validaciones fuertes en la función de backend `scoring.js` para asegurar que partidos `cancelled` retornen puntos 0 independientemente de los goles insertados.
- **Riesgo:** Mes activo general distinto al editado.
  - **Mitigación:** Separar claramente en la UI que cambiar de mes en el dropdown de admin solo es a nivel de vista administrativa y no cambia el `Config.active_month_id` global.

## 9. Checklist QA
Añadida nueva sección a `docs/qa_checklist.md` documentando las pruebas a realizar para validar esta funcionalidad.
