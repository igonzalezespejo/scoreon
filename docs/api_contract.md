# API Contract - Porra Mensual Backend

## Endpoint
El backend se expone a través de una URL de Google Apps Script (Web App) publicada para acceso público.

## Acciones Soportadas

El parámetro `action` determina la operación. Todas las respuestas incluyen:
- `ok` (boolean)
- `code` (string)
- `message` (string)
- `serverTime` (ISO string)

---

### 1. Bootstrap (`action=bootstrap`)
**Método:** `GET` o `POST`

**Descripción:** Obtiene los datos iniciales necesarios para cargar la aplicación. 
El objeto `predictionsSummary` devuelve el estado de todos los usuarios activos (`submitted` si han apostado y `pending` si no lo han hecho), incluyendo usuarios recién registrados. 
Los arreglos `rankingMonthly` y `rankingGlobal` son **calculados dinámicamente por el backend** usando las reglas de puntuación (`Scoring_Rules`), las apuestas actuales (`Predictions_Current`) y los resultados reales (`Results`). El backend asegura automáticamente que todos los participantes activos están presentes, asignando 0 puntos a aquellos sin histórico. Si faltan reglas en `Scoring_Rules`, el backend utiliza un fallback seguro de 20/15/10/5/0.

**Respuesta Exitosa:**
```json
{
  "ok": true,
  "code": "SUCCESS",
  "message": "Data loaded",
  "serverTime": "2026-07-09T18:00:00+02:00",
  "config": {
    "active_month_id": "2026-09",
    "pin_enabled": true,
    "site_title": "Porra Mensual",
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
    "juan": { "status": "submitted", "submitted_at": "2026-09-02T10:00:00Z" },
    "maria": { "status": "pending", "submitted_at": null }
  },
  "rankingMonthly": [
    // Derivado: incluye todos los usuarios activos automáticamente, incluso si no tienen apuestas (con 0 puntos).
  ],
  "rankingGlobal": [
    // Derivado: incluye todos los usuarios activos automáticamente, incluso si no tienen histórico (con 0 puntos).
  ]
}
```

---

### 2. Save Prediction (`action=savePrediction`)
**Método:** `POST`

**Descripción:** Guarda o actualiza las predicciones de un usuario.

**Payload:**
```json
{
  "action": "savePrediction",
  "user_id": "juan",
  "pin": "1234",
  "month_id": "2026-09",
  "predictions": [
    { "match_id": "m001", "home_goals": 2, "away_goals": 1 },
    { "match_id": "m002", "home_goals": 0, "away_goals": 0 }
  ]
}
```

**Validaciones Realizadas (Backend / Code.gs):**
1. **Usuario:** `user_id` debe existir y tener `active=true`.
2. **PIN:** Si `config.pin_enabled` es true, el PIN enviado debe coincidir exactamente con el del archivo de Google Sheets.
3. **Mes:** `month_id` debe existir y su `status` ser "open".
4. **Cierre de mes:** El `serverTime` de Google debe ser anterior a `month.lock_at`.
5. **Partidos:**
   - Cada `match_id` proporcionado en el payload debe existir y corresponder al `month_id`.
   - El partido no puede haber comenzado (`serverTime < match.lock_at` y `serverTime < kickoff_at`).
6. **Estructura de Goles:** `home_goals` y `away_goals` deben ser números enteros y >= 0.

**Respuesta Exitosa:**
```json
{
  "ok": true,
  "code": "SAVED",
  "message": "Predicciones guardadas correctamente",
  "serverTime": "2026-07-09T18:05:00+02:00"
}
```

**Respuestas de Error Posibles:**
```json
{
  "ok": false,
  "code": "VALIDATION_ERROR",
  "message": "PIN incorrecto",
  "serverTime": "2026-07-09T18:05:00+02:00"
}
```
*(Otros errores comunes pueden retornar `code: "LOCK_TIMEOUT"` o `"SERVER_ERROR"`).*

---

### 3. Register Participant (`action=registerParticipant`)
**Método:** `POST`

**Descripción:** Permite a un usuario registrarse y obtener su PIN y `user_id` único automáticamente.

**Payload:**
```json
{
  "action": "registerParticipant",
  "display_name": "Juan Pérez",
  "registration_code": "PORRA2026"
}
```

**Validaciones Realizadas (Backend / Code.gs):**
1. **Configuración:** `config.registration_enabled` debe ser `true`. Si `config.registration_code` existe, debe coincidir.
2. **Nombre:** `display_name` debe tener entre 2 y 60 caracteres y no estar duplicado.
3. **Generación:** Genera un `user_id` limpio y único y un `pin` aleatorio.

**Respuesta Exitosa:**
```json
{
  "ok": true,
  "code": "REGISTERED",
  "message": "Participante creado correctamente",
  "serverTime": "2026-07-13T10:00:00+02:00",
  "participant": {
    "user_id": "juan-perez",
    "display_name": "Juan Pérez",
    "pin": "4827",
    "active": true
  }
}
```
