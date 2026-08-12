# API Contract - ScoreOn Backend

## Endpoint
El backend se expone a través de una URL de Google Apps Script (Web App) publicada para acceso público.

## Acciones Soportadas

El parámetro `action` determina la operación. Todas las respuestas incluyen:
- `ok` (boolean)
- `code` (string)
- `message` (string)
- `serverTime` (ISO string, siempre UTC con sufijo `Z` — es `new Date().toISOString()` del lado servidor. El frontend es responsable de convertirlo a hora española (`Europe/Madrid`) para mostrarlo; ver `src/utils/dates.js`)

---

### 1. Bootstrap (`action=bootstrap`)
**Método:** `GET` o `POST`

**Descripción:** Obtiene los datos iniciales necesarios para cargar la aplicación (Completo). **Nota (V2.5)**: Este endpoint se mantiene como fallback o para propósito de debug. El frontend utiliza `bootstrapLight` y `rankings` de forma progresiva. En multi-mes, se recomienda usar `bootstrapLight` + `monthData`.
Los arreglos `rankingMonthly` y `rankingGlobal` **se leen directamente de las pestañas `Ranking_Monthly` y `Ranking_Global` de Google Sheets**, que actúan como la fuente visual auditable. 
Como medida de seguridad, si estas pestañas están vacías, falta algún participante activo en ellas, o la variable `ranking_dirty` en la pestaña `Config` está en `true`, el backend invoca automáticamente una función de recálculo que actualiza las hojas antes de enviar la respuesta, garantizando así la coherencia de los datos en el frontend, y luego limpia la variable `ranking_dirty`.
**Respuesta Exitosa:**
```json
{
  "ok": true,
  "code": "SUCCESS",
  "message": "Data loaded",
  "serverTime": "2026-07-09T16:00:00.000Z",
  "config": {
    "active_month_id": "2026-09",
    "pin_enabled": true,
    "site_title": "ScoreOn",
    "show_predictions_before_lock": false
  },
  "activeMonth": {
    "month_id": "2026-09",
    "title": "Porra Septiembre 2026",
    "status": "open",
    "lock_at": "2026-09-14T20:00:00Z"
  },
  "participants": [
    {
      "user_id": "juan",
      "display_name": "Juan Pérez",
      "active": true
      // El PIN no se envía al frontend por seguridad.
    }
  ],
  "matches": [
    {
      "match_id": "m001",
      "month_id": "2026-09",
      "home_team": "Real Madrid",
      "away_team": "Barcelona",
      "kickoff_at": "2026-09-15T21:00:00Z",
      "status": "scheduled"
    }
  ],
  "predictionsSummary": {
    "juan": { "status": "submitted", "submitted_at": "2026-09-02T10:00:00Z", "submitted_count": 4, "total_matches": 4 },
    "maria": { "status": "partial", "submitted_at": "2026-09-01T15:00:00Z", "submitted_count": 2, "total_matches": 4 },
    "pedro": { "status": "pending", "submitted_at": null, "submitted_count": 0, "total_matches": 4 }
  },
  "rankingMonthly": [
    // Derivado: incluye todos los usuarios activos automáticamente. Contiene s1_points, s2_points, s3_points, s4_points, etc.
  ],
  "rankingGlobal": [
    // Derivado: incluye todos los usuarios activos automáticamente, incluso si no tienen histórico (con 0 puntos).
  ]
}
```

---

### 2. Save Prediction (`action=savePrediction`)
**Método:** `POST`

**Descripción:** Guarda o actualiza las predicciones de un usuario para los partidos abiertos de un mes. **El backend es la autoridad sobre qué cambió de verdad**: compara cada predicción recibida contra lo que ya hay en `Predictions_Current` para ese usuario (normalizando `user_id`/`match_id` con `normalizeId()` y los goles a `Number`) y solo escribe las filas que realmente difieren. Enviar un valor idéntico al ya guardado —incluido un cliente antiguo que reenvíe el lote entero sin filtrar— no genera escritura, ni fila de log, ni recálculo de ranking; ver `code: "NO_CHANGES"` más abajo.

**Payload:**
```json
{
  "action": "savePrediction",
  "token": "SESSION_TOKEN",
  "month_id": "2026-09",
  "predictions": [
    { "match_id": "m001", "home_goals": 2, "away_goals": 1 },
    { "match_id": "m002", "home_goals": 0, "away_goals": 0 }
  ],
  "request_id": "uuid-o-similar (opcional pero recomendado, ver Idempotencia)"
}
```

**Validaciones Realizadas (Backend / Code.gs):**
1. **Sesión:** `token` debe corresponder a una sesión válida y no caducada (`validateSession`).
2. **Mes:** `month_id` debe existir y su `status` ser "open". `status` es la única autoridad sobre si se puede apostar en un mes (la controla el admin con los botones Abrir/Cerrar Porra); `lock_at` ya no se compara en vivo aquí — en su lugar, `autoCloseExpiredMonths()` cierra automáticamente (`status` → `locked`) cualquier mes `open` cuyo `lock_at` ya haya pasado, de un solo disparo (marca `auto_closed_at` para no repetir el cierre si el admin lo reabre a mano después). Ver `apps-script/README_APPS_SCRIPT.md`.
3. **Partidos:**
   - Cada `match_id` proporcionado en el payload debe existir y corresponder al `month_id`.
   - **No puede haber `match_id` repetidos dentro del mismo envío** — se rechaza con `VALIDATION_ERROR` antes de comparar o escribir nada.
   - El partido no puede haber comenzado: esta sí es una comparación en vivo, `serverTime >= match.lock_at` (si está definido) o si no `serverTime >= kickoff_at`.
4. **Estructura de Goles:** `home_goals` y `away_goals` deben ser números enteros y >= 0.
5. **Comparación contra `Predictions_Current`:** para cada predicción ya validada, se busca la fila existente de ese usuario+partido. Si no existe (o sus goles no son legibles), cuenta como predicción **nueva**; si existe con otro valor, cuenta como **cambio**; si existe con el mismo valor, no cuenta como cambio. Solo las filas realmente nuevas/cambiadas se reescriben — las demás conservan su `home_goals`/`away_goals`/`submitted_at` original, aunque hayan venido incluidas en el payload.

**Respuesta cuando hay cambios reales (`code: "SAVED"`):**
```json
{
  "ok": true,
  "code": "SAVED",
  "message": "Predicciones guardadas correctamente",
  "serverTime": "2026-07-09T16:05:00.000Z",
  "changed_count": 2,
  "changes": [
    {
      "match_id": "m001",
      "previous": { "home_goals": 1, "away_goals": 0 },
      "new": { "home_goals": 2, "away_goals": 1 },
      "submitted_at": "2026-07-09T16:05:00.000Z"
    },
    {
      "match_id": "m002",
      "previous": null,
      "new": { "home_goals": 0, "away_goals": 0 },
      "submitted_at": "2026-07-09T16:05:00.000Z"
    }
  ],
  "confirmed_predictions": [
    { "match_id": "m001", "home_goals": 2, "away_goals": 1, "submitted_at": "2026-07-09T16:05:00.000Z" },
    { "match_id": "m002", "home_goals": 0, "away_goals": 0, "submitted_at": "2026-07-09T16:05:00.000Z" }
  ]
}
```

- **`changed_count` / `changes`**: solo las predicciones que realmente cambiaron respecto a `Predictions_Current` — pensado para auditoría (es lo que también se escribe, agregado, en `Predictions_Log`). `previous: null` indica que el partido no tenía predicción previa (nueva), a diferencia de una predicción existente en `0-0` (que sí trae `previous: { home_goals: 0, away_goals: 0 }`).
- **`confirmed_predictions`**: el estado **ya confirmado en Sheets** para **cada** `match_id` recibido en el payload, haya cambiado o no en esta llamada. **El frontend debe fusionar esto en su caché local, no `changes`**: si una pestaña con datos desactualizados envía un valor que coincide con lo que *otra* pestaña ya había guardado, el backend responde `NO_CHANGES` para ese partido (no hay "cambio" desde su punto de vista), pero la pestaña que llamó seguía sin saber cuál era el valor/`submitted_at` reales — sin `confirmed_predictions` su caché se quedaría mostrando el valor viejo indefinidamente.

**Respuesta cuando NO hay cambios reales (`code: "NO_CHANGES"`):**
```json
{
  "ok": true,
  "code": "NO_CHANGES",
  "message": "No hay cambios que guardar",
  "serverTime": "2026-07-09T16:05:00.000Z",
  "changed_count": 0,
  "changes": [],
  "confirmed_predictions": [
    { "match_id": "m001", "home_goals": 2, "away_goals": 1, "submitted_at": "2026-07-08T09:00:00.000Z" }
  ]
}
```
No se toca `Predictions_Current`, no se añade ninguna fila a `Predictions_Log`, y no se recalcula ni se marca sucio (`ranking_dirty`) el ranking. `confirmed_predictions` sigue trayendo, para cada partido del payload, el valor real y el `submitted_at` original tal como estaban en Sheets (nunca uno generado en esta llamada).

**Respuestas de Error Posibles:**
```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "Partido m002 está duplicado en el envío",
  "serverTime": "2026-07-09T16:05:00.000Z"
}
```
*(Otros errores comunes: `SESSION_INVALID` (token caducado o inexistente), `LOCK_TIMEOUT`, `SERVER_ERROR`.)*

**Log (`Predictions_Log`):** una sola fila por operación, solo cuando `changed_count > 0`, enumerando exclusivamente los cambios reales:
```
Mes 2026-09. Cambios (2): m001: 1-0 → 2-1; m002: nueva → 0-0
```

**Idempotencia:** si se envía `request_id`, una segunda llamada con el mismo id devuelve exactamente la misma respuesta cacheada (`withIdempotency` en Code.gs) sin volver a comparar ni escribir — pensado para los reintentos del cliente ante el 404 intermitente de Apps Script (ver `apps-script/README_APPS_SCRIPT.md`).

---

### 3. Register Participant (`action=registerParticipant`)
**Método:** `POST`

**Descripción:** Permite a un usuario registrarse y obtener su PIN y `user_id` único automáticamente.

**Payload:**
```json
{
  "action": "registerParticipant",
  "display_name": "Juan Pérez",
  "email": "juan@email.com",
  "registration_code": "PORRA2026"
}
```

**Validaciones Realizadas (Backend / Code.gs):**
1. **Configuración:** `config.registration_enabled` debe ser `true`. Si `config.registration_code` existe, debe coincidir.
2. **Nombre:** `display_name` debe tener entre 2 y 60 caracteres y no estar duplicado.
3. **Email:** `email` es obligatorio, debe tener formato válido y no estar duplicado.
4. **Generación:** Genera un `user_id` limpio y único y un `pin` aleatorio en formato de texto.

**Respuesta Exitosa:**
```json
{
  "ok": true,
  "code": "REGISTERED",
  "message": "Participante creado correctamente",
  "serverTime": "2026-07-13T08:00:00.000Z",
  "participant": {
    "user_id": "juan-perez",
    "display_name": "Juan Pérez",
    "pin": "4827",
    "active": true
  }
}
}
```

---

### 4. Get User Predictions (`action=getUserPredictions`)
**Método:** `POST`

**Descripción:** Obtiene las predicciones actuales de un usuario para un mes específico, tras validar su PIN.

**Payload:**
```json
{
  "action": "getUserPredictions",
  "user_id": "juan",
  "pin": "1234",
  "month_id": "2026-09"
}
```

**Validaciones Realizadas (Backend / Code.gs):**
1. **Usuario:** `user_id` debe existir y tener `active=true`.
2. **PIN:** Si `config.pin_enabled` es true, el PIN enviado debe coincidir.
3. **Mes:** Devuelve únicamente apuestas correspondientes a `month_id` y `user_id`. (El backend filtra `Predictions_Current` usando ambos campos).

**Respuesta Exitosa:**
```json
{
  "ok": true,
  "code": "USER_PREDICTIONS",
  "message": "Apuestas cargadas",
  "user_id": "juan",
  "month_id": "2026-09",
  "predictions": [
    {
      "match_id": "m001",
      "home_goals": 2,
      "away_goals": 1,
      "submitted_at": "2026-08-20T10:15:00Z"
    }
  ]
}
```

---

## Endpoints de Diagnóstico y Administración (Solo Desarrolladores)

Estos endpoints están diseñados estrictamente para depuración, QA o uso de administradores mediante llamadas manuales (ej. Postman o `curl`). **No deben integrarse en el frontend público.**

**Requisitos Comunes:**
- `debug_endpoints_enabled` en la pestaña `Config` debe ser `true`.
- Se debe enviar el parámetro `admin_token` con el mismo valor configurado en la pestaña `Config`.
- Si fallan las validaciones, devuelven:
```json
{
  "ok": false,
  "code": "UNAUTHORIZED",
  "message": "Acción admin no autorizada"
}
```

### 5. Debug Live Ranking (`action=debugLiveRanking`)
**Método:** `POST`

**Descripción:** Ejecuta el recálculo de ranking en memoria, sin modificar Google Sheets, y devuelve el ranking calculado junto con el ranking actualmente persistido en base de datos. Sirve para detectar desfases. Además incluye un desglose (`scoringDebug`) para un partido específico.

**Payload:**
```json
{
  "action": "debugLiveRanking",
  "admin_token": "MI_TOKEN_SECRETO",
  "match_id": "m001"
}
```

### 6. Forzar Recálculo (`action=recalculateRankings`)
**Método:** `POST`

**Descripción:** Obliga a Apps Script a recalcular el ranking mensual y global y escribirlos en `Ranking_Monthly` y `Ranking_Global`.

**Payload:**
```json
{
  "action": "recalculateRankings",
  "admin_token": "MI_TOKEN_SECRETO"
}
```

---

## Endpoints de Administración (Panel Web - V2.8)

Estos endpoints dan soporte a la funcionalidad real de administración desde la web.

**Requisitos Comunes:**
- Se deben invocar exclusivamente por el método `POST`.
- Se requiere el parámetro `admin_token` en el payload, el cual debe coincidir con `Config.admin_token`.
- En caso de fallo de autenticación devuelven:
```json
{
  "ok": false,
  "code": "UNAUTHORIZED",
  "message": "Código admin incorrecto"
}
```

### 7. Obtener Meses Admin (`action=adminGetMonths`)
**Método:** `POST`

**Descripción:** Devuelve la lista de todos los meses configurados y el mes activo actual, útil para popular el selector en el panel.

**Payload:**
```json
{
  "action": "adminGetMonths",
  "admin_token": "MI_TOKEN_SECRETO"
}
```

### 8. Obtener Partidos y Resultados del Mes (`action=adminGetMonthMatches`)
**Método:** `POST`

**Descripción:** Devuelve los partidos del mes seleccionado y el estado de resultados actual registrado en la hoja `Results`.

**Payload:**
```json
{
  "action": "adminGetMonthMatches",
  "admin_token": "MI_TOKEN_SECRETO",
  "month_id": "2026-09"
}
```

### 9. Guardar Resultados Admin (`action=adminSaveResults`)
**Método:** `POST`

**Descripción:** Realiza un upsert en la hoja `Results` para los partidos editados usando la clave compuesta `month_id + match_id`. Solo los partidos con status `final` o `cancelled` actualizan de forma definitiva; si se mandan con goles vacíos o status `pending`, no computan. Al guardar, automáticamente dispara `updateRankingsInSheets()` para actualizar `Ranking_Monthly` y `Ranking_Global`.

**Payload:**
```json
{
  "action": "adminSaveResults",
  "admin_token": "MI_TOKEN_SECRETO",
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

### 10. Cambiar Estado del Mes (`action=adminSetMonthStatus`)
**Método:** `POST`

**Descripción:** Permite bloquear (`locked`) o abrir (`open`) las apuestas para un mes determinado desde el panel.

**Payload:**
```json
{
  "action": "adminSetMonthStatus",
  "admin_token": "MI_TOKEN_SECRETO",
  "month_id": "2026-09",
  "status": "locked"
}
```

---

## Endpoints de Carga Progresiva (V2.5)

Los siguientes endpoints están activos en producción para optimizar la carga:

### 7. Bootstrap Light (`action=bootstrapLight`)
**Método:** `GET` o `POST`

**Descripción:** Obtiene los datos iniciales mínimos para cargar la aplicación rápidamente. A diferencia del bootstrap completo, **no incluye rankings y no dispara el recálculo síncrono** incluso si el flag `ranking_dirty` es `true`. Devuelve la lista completa de meses configurados (array `months`) y por compatibilidad legacy los datos del `active_month_id`.

**Respuesta Exitosa:**
```json
{
  "ok": true,
  "code": "SUCCESS",
  "message": "Light data loaded",
  "serverTime": "...",
  "config": { ... },
  "months": [ ... ],
  "activeMonth": { ... },
  "participants": [ ... ],
  "matches": [ ... ],
  "results": [ ... ],
  "predictionsSummary": { ... }
}
```

### 8. Datos de Mes (`action=monthData`)
**Método:** `GET` o `POST`

**Descripción:** Obtiene los partidos, resultados y resumen de predicciones para un `month_id` específico. Utilizado para cargar los datos cuando el usuario selecciona un mes diferente al default en la UI.

**Payload:**
```json
{
  "action": "monthData",
  "month_id": "2026-09"
}
```

**Respuesta Exitosa:**
```json
{
  "ok": true,
  "month": { ... },
  "matches": [ ... ],
  "results": [ ... ],
  "predictionsSummary": { ... }
}
```

### 9. Rankings (`action=rankings`)
**Método:** `GET` o `POST`

**Descripción:** Obtiene exclusivamente los arrays de rankings. Si la variable `ranking_dirty` en la pestaña `Config` está en `true`, ejecuta el recálculo de forma síncrona antes de devolver los resultados.

**Respuesta Exitosa:**
```json
{
  "ok": true,
  "code": "SUCCESS",
  "message": "Rankings loaded",
  "serverTime": "...",
  "rankingMonthly": [ ... ],
  "rankingGlobal": [ ... ]
}
```
