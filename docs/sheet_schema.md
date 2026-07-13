# Google Sheets Schema

Este documento detalla la estructura exacta de la base de datos en Google Sheets.
Para que `Code.gs` funcione sin ambigüedad, los nombres de las pestañas y las columnas (primera fila) deben coincidir exactamente con los descritos aquí.

## Leyenda
- **Obligatorio:** Si la columna debe tener un valor válido para que el sistema no falle.
- **Admin Manual:** Si el administrador edita manualmente esta columna.
- **Apps Script:** Si el script escribe automáticamente en esta columna.

---

## Config
Configuraciones globales del sistema.

| Columna | Obligatorio | Admin Manual | Apps Script | Descripción |
|---|---|---|---|---|
| `key` | Sí | Sí | No | Clave de la configuración (ej. `active_month_id`) |
| `value` | Sí | Sí | No | Valor de la configuración |
| `description` | No | Sí | No | Descripción para el administrador |

**Ejemplo de fila:**
| key | value | description |
|---|---|---|
| active_month_id | 2026-09 | Mes activo actual |

---

## Participants
Lista de usuarios permitidos para apostar.

| Columna | Obligatorio | Admin Manual | Apps Script | Descripción |
|---|---|---|---|---|
| `user_id` | Sí | Sí | No | ID único del usuario (sin espacios) |
| `display_name` | Sí | Sí | No | Nombre a mostrar en la interfaz |
| `pin` | No | Sí | No | PIN de acceso numérico (si `pin_enabled=true`) |
| `active` | Sí | Sí | No | `true` o `false` para permitir acceso |
| `created_at` | No | Sí | No | Fecha de creación del usuario |
| `notes` | No | Sí | No | Notas internas del admin |

**Ejemplo de fila:**
| user_id | display_name | pin | active | created_at | notes |
|---|---|---|---|---|---|
| juan | Juan Pérez | 1234 | true | 2026-07-09T10:00:00Z | - |

---

## Months
Definición de los meses de competición.

| Columna | Obligatorio | Admin Manual | Apps Script | Descripción |
|---|---|---|---|---|
| `month_id` | Sí | Sí | No | ID del mes (ej. `2026-09`) |
| `title` | Sí | Sí | No | Título visible (ej. `Septiembre 2026`) |
| `status` | Sí | Sí | No | `open`, `locked`, `scored`, `archived` |
| `open_at` | No | Sí | No | Fecha de apertura (informativa) |
| `lock_at` | Sí | Sí | No | Fecha de cierre estricto (ISO 8601) |
| `scored_at` | No | Sí | No | Fecha de última puntuación |
| `archived_at` | No | Sí | No | Fecha de archivado |
| `notes` | No | Sí | No | Notas internas |

**Ejemplo de fila:**
| month_id | title | status | open_at | lock_at | scored_at | archived_at | notes |
|---|---|---|---|---|---|---|---|
| 2026-09 | Septiembre 2026 | open | 2026-09-01T00:00:00Z | 2026-09-30T23:59:59Z | - | - | - |

---

## Matches
Partidos de cada mes.

| Columna | Obligatorio | Admin Manual | Apps Script | Descripción |
|---|---|---|---|---|
| `match_id` | Sí | Sí | No | ID único del partido (ej. `m001`) |
| `month_id` | Sí | Sí | No | ID del mes al que pertenece |
| `competition` | Sí | Sí | No | Competición (ej. `LaLiga`) |
| `home_team` | Sí | Sí | No | Equipo local |
| `away_team` | Sí | Sí | No | Equipo visitante |
| `kickoff_at` | No | Sí | No | Hora de inicio (ISO 8601) |
| `lock_at` | No | Sí | No | Cierre específico de este partido |
| `status` | Sí | Sí | No | `scheduled`, `locked`, `played`, `cancelled` |
| `display_order` | No | Sí | No | Orden numérico para la vista |
| `notes` | No | Sí | No | Notas |

**Ejemplo de fila:**
| match_id | month_id | competition | home_team | away_team | kickoff_at | lock_at | status | display_order | notes |
|---|---|---|---|---|---|---|---|---|---|
| m001 | 2026-09 | LaLiga | Real Madrid | Barcelona | 2026-09-15T21:00:00Z | - | scheduled | 1 | - |

---

## Predictions_Current
Apuestas actuales (sobreescritas en cada envío válido).

| Columna | Obligatorio | Admin Manual | Apps Script | Descripción |
|---|---|---|---|---|
| `user_id` | Sí | Sí | Sí | ID del usuario |
| `match_id` | Sí | Sí | Sí | ID del partido |
| `home_goals` | Sí | Sí | Sí | Goles locales apostados |
| `away_goals` | Sí | Sí | Sí | Goles visitantes apostados |
| `submitted_at` | Sí | Sí | Sí | Fecha de la última apuesta |

*Nota:* `Code.gs` depende exactamente de estos nombres de columna: `user_id`, `match_id`, `home_goals`, `away_goals`, `submitted_at`. Todo en la primera fila.

**Ejemplo de fila:**
| user_id | match_id | home_goals | away_goals | submitted_at |
|---|---|---|---|---|
| juan | m001 | 2 | 1 | 2026-09-02T10:00:00Z |

---

## Predictions_Log
Registro inmutable (append-only) de todo lo que Apps Script hace.

| Columna | Obligatorio | Admin Manual | Apps Script | Descripción |
|---|---|---|---|---|
| `timestamp` | Sí | No | Sí | Fecha del registro (server time) |
| `user_id` | Sí | No | Sí | Usuario que ejecutó la acción |
| `action` | Sí | No | Sí | Acción ejecutada (ej. `SAVE_PREDICTION`) |
| `details` | Sí | No | Sí | Detalles o resumen de la acción |

*Nota:* `Code.gs` inserta siempre 4 columnas: `[serverTime, userId, action, details]`. La pestaña en Sheets debe llamarse `Predictions_Log` y tener estos 4 encabezados en la fila 1.

**Ejemplo de fila:**
| timestamp | user_id | action | details |
|---|---|---|---|
| 2026-09-02T10:00:00Z | juan | SAVE_PREDICTION | Guardadas 2 predicciones. |

---

## Results
Resultados reales de los partidos para la puntuación.

| Columna | Obligatorio | Admin Manual | Apps Script | Descripción |
|---|---|---|---|---|
| `match_id` | Sí | Sí | No | ID del partido |
| `home_goals` | Sí | Sí | No | Goles locales reales |
| `away_goals` | Sí | Sí | No | Goles visitantes reales |
| `status` | Sí | Sí | No | `pending`, `final`, `cancelled` |
| `updated_at` | No | Sí | No | Fecha de actualización |
| `updated_by` | No | Sí | No | Admin que actualizó |
| `notes` | No | Sí | No | Notas adicionales |

**Ejemplo de fila:**
| match_id | home_goals | away_goals | status | updated_at | updated_by | notes |
|---|---|---|---|---|---|---|
| m001 | 2 | 2 | final | 2026-09-15T23:00:00Z | admin | - |

---

## Scoring_Rules
Reglas de puntuación (utilizadas por el backend para calcular el ranking dinámicamente).

| Columna | Obligatorio | Admin Manual | Apps Script | Descripción |
|---|---|---|---|---|
| `rule_id` | Sí | Sí | No | ID de la regla |
| `description` | Sí | Sí | No | Descripción |
| `points` | Sí | Sí | No | Puntos a otorgar |
| `active` | Sí | Sí | No | `true` o `false` |

**Ejemplo de fila:**
| rule_id | description | points | active |
|---|---|---|---|
| exact_draw | Resultado exacto con empate | 20 | true |

---

## Ranking_Monthly
Clasificación de cada mes (ya no es calculada a mano; el backend la calcula dinámicamente ignorando el contenido de esta hoja. Se puede mantener como histórico o caché).

| Columna | Obligatorio | Admin Manual | Apps Script | Descripción |
|---|---|---|---|---|
| `month_id` | Sí | Sí | No | Mes |
| `user_id` | Sí | Sí | No | Usuario |
| `display_name` | Sí | Sí | No | Nombre a mostrar |
| `points` | Sí | Sí | No | Puntos totales del mes |
| `exact_scores` | No | Sí | No | Resultados exactos acertados |
| `correct_signs` | No | Sí | No | Signos acertados |
| `failed` | No | Sí | No | Fallos |
| `played_matches` | No | Sí | No | Partidos jugados |
| `position` | Sí | Sí | No | Posición en el mes |
| `updated_at` | No | Sí | No | Fecha de cálculo |

**Ejemplo de fila:**
| month_id | user_id | display_name | points | exact_scores | correct_signs | failed | played_matches | position | updated_at |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09 | juan | Juan | 25 | 1 | 1 | 0 | 2 | 1 | 2026-09-15T23:05:00Z |

---

## Ranking_Global
Clasificación acumulada de todos los meses.

| Columna | Obligatorio | Admin Manual | Apps Script | Descripción |
|---|---|---|---|---|
| `user_id` | Sí | Sí | No | Usuario |
| `display_name` | Sí | Sí | No | Nombre |
| `total_points` | Sí | Sí | No | Puntos totales |
| `months_played` | No | Sí | No | Meses jugados |
| `monthly_wins` | No | Sí | No | Meses ganados |
| `exact_scores` | No | Sí | No | Plenos totales |
| `correct_signs` | No | Sí | No | Signos totales |
| `position` | Sí | Sí | No | Posición global |
| `updated_at` | No | Sí | No | Fecha de cálculo |

**Ejemplo de fila:**
| user_id | display_name | total_points | months_played | monthly_wins | exact_scores | correct_signs | position | updated_at |
|---|---|---|---|---|---|---|---|---|
| juan | Juan | 120 | 5 | 1 | 4 | 8 | 1 | 2026-09-15T23:05:00Z |

---

## Admin_Actions
Registro manual o automático de acciones de administración.

| Columna | Obligatorio | Admin Manual | Apps Script | Descripción |
|---|---|---|---|---|
| `timestamp` | Sí | Sí | No | Fecha |
| `admin_action` | Sí | Sí | No | Acción ejecutada |
| `month_id` | No | Sí | No | Mes |
| `user_id` | No | Sí | No | Administrador |
| `details_json` | No | Sí | No | Detalles adicionales |

**Ejemplo de fila:**
| timestamp | admin_action | month_id | user_id | details_json |
|---|---|---|---|---|
| 2026-09-01T00:00:00Z | open_month | 2026-09 | admin | {"status": "open"} |
