# ROADMAP MASTER — PORRA MENSUAL

> **Estado:** MVP publicado y validado en producción. V2.1 completado (Alta desde web).

## V2.1 Novedades
- Añadido endpoint `registerParticipant`.
- Formulario de registro en web, protegido por código de invitación opcional.
- Generación automática de PIN y persistencia en Sheets.
- Datos derivados (predictionsSummary, rankingMonthly, rankingGlobal) actualizados automáticamente con nuevos usuarios activos.

## V2.2 Novedades (Rediseño visual)
- Auditoría visual completada (`docs/theme_mundial_reference.md`).
- Aplicado tema visual claro inspirado en `mundial-2026`.
- Actualizado CSS y limpiadas las vistas HTML/JS.
- Validado (QA en `docs/visual_qa.md`). Pendiente de hacer push/deploy para verlo en producción.

## V2.3 Novedades (Cálculo Dinámico y Reglas Definitivas)
- Reglas de puntuación definitivas implementadas: exact_draw (20), exact_non_draw (15), draw_not_exact (10), winner_not_exact (5), wrong (0).
- El backend (`Code.gs`) ahora calcula de forma dinámica `Ranking_Monthly` y `Ranking_Global` basándose en las apuestas actuales y los resultados. Las pestañas de Google Sheets ya no necesitan cálculo manual.

## Objetivo del archivo

Crear y mantener este archivo como `roadmap.md` en la raíz del proyecto. Este documento será la hoja de ruta principal para Antigravity 2.0 y para cualquier agente que trabaje en paralelo.

El objetivo es construir una aplicación web de porra mensual para 40–60 participantes, gratuita, sencilla de administrar y suficientemente robusta para un grupo de confianza.

La app debe usar:

* GitHub Pages como frontend.
* Google Sheets como base de datos y panel de administración manual.
* Google Apps Script como backend mínimo.
* Selector de participante + PIN corto opcional.
* Bloqueo real de apuestas en backend por fecha/hora y estado.
* Ranking mensual y ranking global.
* Logs de todos los intentos de apuesta.

---

# 0. Decisión de arquitectura

## 0.1. Crear proyecto nuevo

Crear un proyecto nuevo, independiente del repo actual del Mundial 2026.

Nombre sugerido:

```text
porra-mensual
```

No desarrollar la nueva porra mensual dentro del código principal del proyecto `mundial-2026`, salvo que se decida expresamente más adelante.

## 0.2. Carpeta de referencias

Crear una carpeta:

```text
ref/
```

Dentro de `ref/` copiar proyectos de referencia completos para consulta:

```text
ref/
  mundial-2026/
  porra-mundial-evaristosaa/
```

Reglas:

* `ref/` es solo referencia.
* No modificar archivos dentro de `ref/`.
* No importar código directamente desde `ref/`.
* No depender de rutas dentro de `ref/`.
* Si se reutiliza algo, copiarlo/adaptarlo a `src/`, `styles/`, `docs/` o `apps-script/`.

## 0.3. Uso de cada referencia

### `ref/mundial-2026/`

Usar como referencia para:

* Estructura modular.
* Organización de `src/`, `data/`, `scripts/`.
* Estilo visual.
* Ranking.
* Carga de datos.
* Validaciones y disciplina de proyecto.

### `ref/porra-mundial-evaristosaa/`

Usar como referencia para:

* Flujo simple de usuario.
* Selector de nombre.
* Vista de “mis apuestas”.
* Vista de “quién falta por apostar”.
* Panel admin básico.
* Concepto de porra activa.
* Estados de porra.

No copiar como arquitectura final:

* JSONBin.
* Claves públicas en frontend.
* `index.html` monolítico.
* Admin protegido solo con JavaScript.
* Persistencia directa desde navegador a un JSON remoto.

---

# 1. Producto final esperado

La app final debe permitir:

1. Entrar en una web pública.
2. Seleccionar participante.
3. Introducir PIN corto si está activado.
4. Ver la porra mensual activa.
5. Apostar resultados de los partidos del mes.
6. Guardar apuesta online.
7. Ver confirmación de apuesta guardada.
8. Ver si la porra está abierta, cerrada o resuelta.
9. Ver quién ha apostado y quién falta.
10. Ver ranking mensual.
11. Ver ranking global acumulado.
12. Bloquear automáticamente al llegar la fecha límite.
13. Permitir correcciones manuales desde Google Sheets.
14. Registrar logs de apuestas aceptadas y rechazadas.
15. Funcionar bien en móvil.

---

# 2. No objetivos de la primera versión

No implementar en MVP:

* Login completo con usuario y contraseña.
* Recuperación de contraseña.
* Emails automáticos.
* Pasarela de pagos.
* Notificaciones push.
* Panel admin completo dentro de la web.
* Multi-admin avanzado.
* Roles complejos.
* Base de datos externa tipo Supabase/Firebase.
* Backend Node propio.
* Escritura directa a GitHub desde la web.
* Guardado solo en `localStorage`.

---

# 3. Arquitectura objetivo

```text
porra-mensual/
  index.html
  package.json
  README.md
  roadmap.md
  .gitignore

  ref/
    mundial-2026/
    porra-mundial-evaristosaa/

  src/
    app.js
    api.js
    state.js
    config.example.js
    config.js
    scoring.js

    views/
      homeView.js
      bettingView.js
      rankingView.js
      statusView.js
      adminView.js

    utils/
      dates.js
      validation.js
      dom.js

  styles/
    main.css

  data/
    mock-bootstrap.json
    mock-ranking.json

  apps-script/
    Code.gs
    README_APPS_SCRIPT.md

  tests/
    scoring.test.js
    validation.test.js

  docs/
    sheet_schema.md
    deployment.md
    admin_manual.md
    api_contract.md
    ux_flow.md
```

---

# 4. Modelo de datos en Google Sheets

Crear una Google Sheet que actuará como base de datos y panel admin.

Pestañas necesarias:

```text
Config
Participants
Months
Matches
Predictions_Current
Predictions_Log
Results
Scoring_Rules
Ranking_Monthly
Ranking_Global
Admin_Actions
```

---

## 4.1. `Config`

Columnas:

```text
key
value
description
```

Ejemplo:

```text
active_month_id | 2026-09 | Mes activo actual
pin_enabled | true | Activa o desactiva PIN por usuario
site_title | Porra Mensual | Nombre mostrado en la web
show_predictions_before_lock | false | Mostrar apuestas antes del cierre
```

---

## 4.2. `Participants`

Columnas:

```text
user_id
display_name
pin
active
created_at
notes
```

Ejemplo:

```text
juan
Juan
1234
TRUE
2026-07-09T10:00:00+02:00
-
```

Notas:

* Para MVP se acepta PIN plano por simplicidad.
* Si se quiere mejorar, sustituir por hash más adelante.
* `user_id` debe ser estable y sin espacios.

---

## 4.3. `Months`

Columnas:

```text
month_id
title
status
open_at
lock_at
scored_at
archived_at
notes
```

Estados válidos:

```text
draft
open
locked
scored
archived
```

Ejemplo:

```text
2026-09
Porra Septiembre 2026
open
2026-09-01T00:00:00+02:00
2026-09-14T20:00:00+02:00
-
-
-
```

Reglas:

* Solo puede haber un mes activo principal.
* El frontend debe cargar `active_month_id` desde `Config`.
* El backend debe rechazar apuestas si `status !== open`.
* El backend debe rechazar apuestas si la hora servidor es posterior a `lock_at`.

---

## 4.4. `Matches`

Columnas:

```text
match_id
month_id
competition
home_team
away_team
kickoff_at
lock_at
status
display_order
notes
```

Estados:

```text
scheduled
locked
played
cancelled
```

Notas:

* `lock_at` individual permite bloquear un partido antes que el mes completo.
* Si `lock_at` de partido está vacío, se usa `lock_at` del mes.
* `display_order` controla el orden visual.

---

## 4.5. `Predictions_Current`

Una fila por usuario, mes y partido.

Columnas:

```text
user_id
match_id
home_goals
away_goals
submitted_at
```

Estados:

```text
valid
admin_modified
cancelled
```

Reglas:

* Si el usuario guarda antes del cierre, se actualiza su apuesta actual.
* Después del cierre, solo el admin puede cambiarla manualmente desde Sheets.
* La web no debe permitir edición cuando esté cerrado.
* El backend tampoco debe permitir edición cuando esté cerrado.

---

## 4.6. `Predictions_Log`

Guardar todos los intentos.

Columnas:

```text
timestamp
action
user_id
month_id
match_id
payload_json
result
reason
user_agent
```

Resultados posibles:

```text
accepted
rejected_locked
rejected_invalid_pin
rejected_invalid_user
rejected_invalid_month
rejected_invalid_match
rejected_invalid_payload
error
```

Objetivo:

* Trazabilidad.
* Resolver disputas.
* Ver si alguien intentó apostar tarde.
* Ver errores de uso.

---

## 4.7. `Results`

Columnas:

```text
match_id
home_goals
away_goals
status
updated_at
updated_by
notes
```

Estados:

```text
pending
final
cancelled
```

---

## 4.8. `Scoring_Rules`

Columnas:

```text
rule_id
description
points
active
```

Reglas iniciales sugeridas:

```text
exact_score | Resultado exacto | 20 | TRUE
correct_sign | Signo acertado | 5 | TRUE
wrong | Fallo | 0 | TRUE
```

Opcionales futuras:

```text
exact_draw
goal_difference
monthly_bonus
```

---

## 4.9. `Ranking_Monthly`

Columnas:

```text
month_id
user_id
display_name
points
exact_scores
correct_signs
failed
played_matches
position
updated_at
```

---

## 4.10. `Ranking_Global`

Columnas:

```text
user_id
display_name
total_points
months_played
monthly_wins
exact_scores
correct_signs
position
updated_at
```

---

## 4.11. `Admin_Actions`

Columnas:

```text
timestamp
admin_action
month_id
user_id
details_json
```

Ejemplos:

```text
lock_month
open_month
set_result
admin_modify_prediction
recalculate_ranking
```

---

# 5. Backend Google Apps Script

Crear:

```text
apps-script/Code.gs
apps-script/README_APPS_SCRIPT.md
```

El Apps Script es el backend real del sistema.

## 5.1. Configuración interna

En `Code.gs`, definir:

```javascript
const SPREADSHEET_ID = 'PEGAR_ID_DE_GOOGLE_SHEET';
const PIN_ENABLED = true;
```

No poner secretos importantes en frontend.

La URL del Apps Script será pública. No asumir que está oculta.

La seguridad real debe estar en:

* Validaciones del Apps Script.
* Bloqueo por servidor.
* PIN.
* Logs.
* Control manual en Sheets.

---

## 5.2. Endpoints

Implementar:

```javascript
function doGet(e) {}
function doPost(e) {}
```

---

## 5.3. `doGet(e)`

Acciones:

```text
?action=bootstrap
?action=ranking
?action=monthState
?action=userPredictions&user_id=juan&month_id=2026-09
```

### `bootstrap`

Debe devolver:

```json
{
  "ok": true,
  "serverTime": "2026-07-09T18:00:00+02:00",
  "config": {},
  "activeMonth": {},
  "participants": [],
  "matches": [],
  "predictionsSummary": {},
  "rankingMonthly": [],
  "rankingGlobal": []
}
```

### `ranking`

Devuelve ranking mensual y global.

### `monthState`

Devuelve estado del mes activo.

### `userPredictions`

Devuelve apuestas actuales del usuario para el mes indicado.

---

## 5.4. `doPost(e)`

Acciones:

```text
savePrediction
adminSetResult
adminLockMonth
adminOpenMonth
adminRecalculateRanking
```

Para MVP, implementar primero solo:

```text
savePrediction
```

---

## 5.5. Payload de `savePrediction`

```json
{
  "action": "savePrediction",
  "user_id": "juan",
  "pin": "1234",
  "month_id": "2026-09",
  "predictions": [
    {
      "match_id": "m001",
      "home_goals": 2,
      "away_goals": 1
    },
    {
      "match_id": "m002",
      "home_goals": 0,
      "away_goals": 0
    }
  ]
}
```

---

## 5.6. Validaciones obligatorias en servidor

Antes de escribir:

```text
1. El payload existe y es JSON válido.
2. action === savePrediction.
3. user_id existe.
4. participante está activo.
5. PIN correcto si PIN_ENABLED = true.
6. month_id existe.
7. month.status === open.
8. serverTime < month.lock_at.
9. Cada partido existe.
10. Cada partido pertenece a month_id.
11. Cada partido no está locked/played/cancelled.
12. Si match.lock_at existe, serverTime < match.lock_at.
13. home_goals y away_goals son enteros.
14. Los goles son >= 0 y <= 20.
15. No hay datos extraños o corruptos.
```

Si falla algo:

* No escribir en `Predictions_Current`.
* Escribir intento rechazado en `Predictions_Log`.
* Devolver error claro al frontend.

---

## 5.7. Bloqueo real

El bloqueo no puede depender solo del frontend.

Regla de rechazo:

```text
Si month.status !== open → rechazar.
Si serverTime >= month.lock_at → rechazar.
Si match.lock_at existe y serverTime >= match.lock_at → rechazar.
```

---

## 5.8. Concurrencia

Toda escritura debe usar `LockService`.

Patrón:

```javascript
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    // parsear payload
    // validar
    // escribir
    // log
    // responder
  } catch (err) {
    // log error
    // responder error
  } finally {
    lock.releaseLock();
  }
}
```

---

## 5.9. Respuestas del backend

Éxito:

```json
{
  "ok": true,
  "message": "Apuesta guardada correctamente",
  "serverTime": "2026-07-09T18:00:00+02:00"
}
```

Error:

```json
{
  "ok": false,
  "code": "rejected_locked",
  "message": "La porra está cerrada",
  "serverTime": "2026-07-09T18:00:00+02:00"
}
```

---

# 6. Frontend

## 6.1. Estructura de frontend

```text
src/
  app.js
  api.js
  state.js
  config.example.js
  config.js
  scoring.js

  views/
    homeView.js
    bettingView.js
    rankingView.js
    statusView.js
    adminView.js

  utils/
    dates.js
    validation.js
    dom.js
```

---

## 6.2. `config.example.js`

Crear:

```javascript
export const API_URL = 'https://script.google.com/macros/s/XXXX/exec';
export const USE_MOCK = true;
```

## 6.3. `config.js`

Crear localmente a partir de `config.example.js`.

Reglas:

* `config.js` NO debe estar en `.gitignore` porque se importa en el frontend (ej. GitHub Pages).
* Si se necesita una configuración local ignorada, crear `config.local.js`.
* En despliegue real se puede publicar la URL del Apps Script.
* No asumir que la URL es secreta.
* No guardar tokens importantes en frontend.

---

## 6.4. `api.js`

Funciones necesarias:

```text
fetchBootstrap()
fetchRanking()
fetchUserPredictions(userId, monthId)
savePrediction(payload)
```

Si `USE_MOCK = true`, leer desde `data/mock-bootstrap.json`.

Si `USE_MOCK = false`, llamar a Apps Script.

Importante:

* Enviar POST como `text/plain;charset=utf-8` para evitar problemas CORS/preflight.
* Parsear JSON de respuesta.
* Manejar errores de red.
* Mostrar mensajes claros al usuario.

---

## 6.5. `state.js`

Estado global:

```text
bootstrapData
config
serverTime
activeMonth
participants
matches
selectedUser
selectedUserPin
userPredictions
rankingMonthly
rankingGlobal
isLocked
```

---

## 6.6. Vistas

### `homeView.js`

Mostrar:

```text
- Título de la porra.
- Mes activo.
- Estado: draft/open/locked/scored/archived.
- Fecha límite.
- Número de participantes.
- Número de usuarios que ya apostaron.
- Número de usuarios pendientes.
- Aviso de cierre.
```

### `bettingView.js`

Flujo:

```text
1. Seleccionar participante.
2. Introducir PIN si está activado.
3. Mostrar partidos del mes activo.
4. Rellenar resultados.
5. Guardar.
6. Mostrar spinner.
7. Mostrar confirmación.
8. Recargar datos tras guardar.
```

Reglas UI:

* Si el mes está abierto, inputs activos.
* Si el mes está cerrado, inputs desactivados.
* Si ya apostó, mostrar valores guardados.
* Antes del cierre, permitir editar si todavía está abierto.
* Después del cierre, solo lectura.

### `rankingView.js`

Mostrar:

```text
- Ranking mensual.
- Ranking global.
- Puntos.
- Exactos.
- Signos acertados.
- Fallos.
- Partidos computados.
```

### `statusView.js`

Mostrar:

Antes del cierre:

```text
- Ha apostado / falta por apostar.
- No mostrar resultados apostados si show_predictions_before_lock = false.
```

Después del cierre:

```text
- Mostrar apuestas de cada usuario.
- Mostrar aciertos si hay resultados.
```

### `adminView.js`

MVP admin básico:

```text
- Mostrar estado del mes.
- Mostrar enlace a Google Sheets.
- Mostrar instrucciones operativas.
- Botón de refrescar datos.
```

No construir panel admin complejo en la web en primera versión.

---

# 7. Scoring

Crear:

```text
src/scoring.js
tests/scoring.test.js
```

Función principal:

```javascript
scorePrediction(prediction, result, rules)
```

Casos:

```text
Apuesta 2-1, real 2-1 → exact_score
Apuesta 2-1, real 1-0 → correct_sign
Apuesta 1-1, real 0-0 → correct_sign
Apuesta 2-1, real 1-2 → wrong
Apuesta incompleta → 0 / pending
Resultado no final → no computar
```

Primera puntuación sugerida:

```text
Resultado exacto: 20 puntos
Signo acertado: 5 puntos
Fallo: 0 puntos
```

Debe ser fácil cambiar puntos desde `Scoring_Rules`.

---

# 8. Modo mock/local

Antes de conectar con Google, desarrollar con datos mock.

Crear:

```text
data/mock-bootstrap.json
```

Debe incluir:

```text
- 5 participantes.
- 1 mes activo.
- 4 partidos.
- 2 usuarios con apuestas.
- 3 usuarios pendientes.
- Ranking mensual mock.
- Ranking global mock.
```

Objetivo:

* Desarrollar UI sin depender de Apps Script.
* Validar flujo de usuario.
* Validar responsive móvil.
* Validar ranking.

---

# 9. Deploy

## 9.1. Apps Script

Pasos:

```text
1. Crear Google Sheet real.
2. Crear Apps Script asociado o independiente.
3. Pegar Code.gs.
4. Configurar SPREADSHEET_ID.
5. Deploy como Web App.
6. Execute as: Me.
7. Who has access: Anyone.
8. Copiar URL.
9. Pegar URL en config.js.
```

## 9.2. GitHub Pages

Publicar desde:

```text
main branch / root
```

O configurar carpeta según repo.

Checklist:

```text
- La web carga.
- Bootstrap funciona.
- Selector de participante funciona.
- PIN correcto permite guardar.
- PIN incorrecto rechaza.
- Apuesta válida se guarda.
- Apuesta aparece tras recargar.
- Mes cerrado bloquea.
- Apps Script rechaza apuesta cerrada aunque se manipule frontend.
- Ranking se muestra.
- Móvil funciona.
```

---

# 10. Operativa mensual

Cada mes, el admin hará en Google Sheets:

```text
1. Crear nuevo registro en Months.
2. Crear partidos en Matches.
3. Poner month.status = draft.
4. Revisar participantes activos.
5. Poner month.status = open.
6. Config.active_month_id = nuevo mes.
7. Compartir enlace de la web.
8. Esperar apuestas.
9. lock_at bloquea automáticamente.
10. Cambiar status a locked si se quiere manualmente.
11. Introducir resultados en Results.
12. Recalcular ranking.
13. Poner status = scored.
14. Archivar cuando proceda.
```

---

# 11. Plan de agentes paralelos

Este proyecto puede dividirse en agentes independientes.

## Agente A — Documentación y modelo de datos

Tareas:

```text
- Crear docs/sheet_schema.md.
- Crear docs/api_contract.md.
- Crear docs/admin_manual.md.
- Crear docs/deployment.md.
- Revisar roadmap.md.
- Definir columnas exactas de Google Sheets.
- Crear ejemplos de filas para cada pestaña.
```

Entregables:

```text
docs/sheet_schema.md
docs/api_contract.md
docs/admin_manual.md
docs/deployment.md
```

No tocar:

```text
src/
apps-script/
styles/
```

---

## Agente B — Frontend mock

Tareas:

```text
- Crear index.html.
- Crear styles/main.css.
- Crear src/app.js.
- Crear src/state.js.
- Crear vistas home/betting/ranking/status/admin.
- Crear data/mock-bootstrap.json.
- Implementar navegación.
- Implementar selector de usuario.
- Implementar formulario de apuestas.
- Implementar bloqueo visual.
- Implementar ranking mock.
```

Entregables:

```text
index.html
styles/main.css
src/app.js
src/state.js
src/views/*.js
data/mock-bootstrap.json
```

No tocar:

```text
apps-script/
tests/
```

---

## Agente C — Scoring y validaciones

Tareas:

```text
- Crear src/scoring.js.
- Crear src/utils/validation.js.
- Crear tests/scoring.test.js.
- Crear tests/validation.test.js.
- Implementar reglas de puntuación.
- Implementar validación de payload.
- Añadir scripts npm para test.
```

Entregables:

```text
src/scoring.js
src/utils/validation.js
tests/scoring.test.js
tests/validation.test.js
package.json actualizado
```

No tocar:

```text
apps-script/Code.gs salvo coordinación posterior
```

---

## Agente D — Apps Script backend

Tareas:

```text
- Crear apps-script/Code.gs.
- Crear apps-script/README_APPS_SCRIPT.md.
- Implementar doGet.
- Implementar doPost.
- Implementar bootstrap.
- Implementar savePrediction.
- Implementar LockService.
- Implementar validación de bloqueo.
- Implementar validación de PIN.
- Implementar escritura en Predictions_Current.
- Implementar escritura en Predictions_Log.
- Implementar respuestas JSON.
```

Entregables:

```text
apps-script/Code.gs
apps-script/README_APPS_SCRIPT.md
```

No tocar:

```text
src/views/
styles/
```

---

## Agente E — Integración frontend/backend

Tareas:

```text
- Crear src/api.js.
- Crear src/config.example.js.
- Conectar frontend con Apps Script.
- Mantener USE_MOCK.
- Implementar savePrediction real.
- Implementar fetchBootstrap real.
- Manejar errores.
- Mostrar mensajes claros.
```

Entregables:

```text
src/api.js
src/config.example.js
src/config.js si procede
src/app.js actualizado
```

Depende de:

```text
Agente B
Agente D
```

---

## Agente F — QA y hardening

Tareas:

```text
- Probar flujo completo.
- Probar bloqueo.
- Probar PIN incorrecto.
- Probar participante inexistente.
- Probar apuesta después de lockAt.
- Probar concurrencia básica.
- Revisar responsive móvil.
- Revisar que no hay secretos en frontend.
- Revisar que ref/ no se usa como dependencia.
```

Entregables:

```text
docs/qa_checklist.md
Informe de bugs
Correcciones menores
```

---

# 12. Orden recomendado de ejecución

## Sprint 1 — Base local

```text
1. Crear estructura del proyecto.
2. Copiar referencias a ref/.
3. Crear roadmap.md.
4. Crear mock data.
5. Crear frontend mock.
6. Crear scoring y tests.
```

Resultado esperado:

```text
La web funciona localmente sin Google.
```

## Sprint 2 — Backend

```text
1. Crear Google Sheet.
2. Crear Apps Script.
3. Implementar bootstrap.
4. Implementar savePrediction.
5. Implementar logs.
6. Probar manualmente endpoints.
```

Resultado esperado:

```text
Apps Script guarda apuestas en Google Sheets.
```

## Sprint 3 — Integración

```text
1. Conectar frontend a Apps Script.
2. Probar guardar apuesta real.
3. Probar recarga.
4. Probar bloqueo.
5. Probar PIN.
6. Probar ranking.
```

Resultado esperado:

```text
La web ya funciona contra Google Sheets.
```

## Sprint 4 — Publicación

```text
1. Publicar GitHub Pages.
2. Probar desde móvil.
3. Probar con 2–3 usuarios reales.
4. Corregir errores.
5. Preparar manual admin.
```

Resultado esperado:

```text
MVP listo para primera porra mensual.
```

---

# 13. Criterios de aceptación MVP

La versión MVP se considera terminada cuando:

```text
- La web carga en GitHub Pages.
- Carga participantes desde Apps Script.
- Carga mes activo desde Apps Script.
- Permite seleccionar usuario.
- Valida PIN.
- Muestra partidos del mes.
- Permite guardar apuesta antes del cierre.
- Rechaza guardar apuesta después del cierre.
- Registra cada intento en Predictions_Log.
- Muestra quién ha apostado.
- Muestra quién falta.
- Muestra ranking mensual.
- Muestra ranking global.
- Funciona en móvil.
- El admin puede corregir manualmente desde Google Sheets.
- No depende de archivos dentro de ref/.
```

---

# 14. Reglas críticas para todos los agentes

```text
1. No modificar ref/.
2. No introducir JSONBin.
3. No escribir directamente en GitHub desde el frontend.
4. No meter tokens privados en frontend.
5. La URL de Apps Script puede ser pública.
6. La seguridad real está en Apps Script.
7. El bloqueo debe validarse en backend.
8. Toda escritura debe usar LockService.
9. Todo intento debe registrarse en Predictions_Log.
10. Mantener USE_MOCK para desarrollo local.
11. Mantener código modular.
12. Evitar index.html monolítico.
13. Priorizar MVP funcional sobre extras.
14. Antes del cierre, mostrar solo quién ha apostado si show_predictions_before_lock = false.
15. Después del cierre, se pueden mostrar apuestas.
```

---

# 15. Primer prompt para el agente principal

Usar este prompt para iniciar el proyecto:

```text
Crea o actualiza el archivo roadmap.md en la raíz del proyecto con esta hoja de ruta completa.

Después, prepara la estructura inicial del proyecto porra-mensual.

Contexto:
- El proyecto será una web de porra mensual para 40–60 participantes.
- La app se desplegará en GitHub Pages.
- La persistencia será Google Sheets.
- El backend será Google Apps Script.
- No habrá login completo.
- Se usará selector de participante + PIN corto opcional.
- El bloqueo real de apuestas debe validarse en Apps Script.
- El admin principal será Google Sheets.
- Existe una carpeta ref/ con proyectos de referencia. No modificarla ni depender de ella.

Primera tarea:
1. Crear estructura de carpetas.
2. Crear archivos base vacíos o mínimos.
3. Crear data/mock-bootstrap.json.
4. Crear docs/sheet_schema.md inicial.
5. Crear src/config.example.js.
6. Crear README.md inicial.
7. No implementar todavía toda la lógica.
8. Dejar el proyecto preparado para que otros agentes trabajen en paralelo según roadmap.md.
```

---

# 16. Estado actual del proyecto

Actualizar manualmente esta sección conforme avance el desarrollo.

```text
[x] Proyecto creado
[x] Carpeta ref/ creada
[x] Referencias copiadas
[x] roadmap.md creado
[x] Estructura base creada
[x] Mock data creado
[x] Frontend mock creado
[x] Scoring creado
[x] Tests creados
[x] Google Sheet creada
[x] Apps Script creado
[x] Bootstrap backend funcionando
[x] SavePrediction funcionando
[x] Logs funcionando
[x] Frontend conectado a backend
[x] Bloqueo probado
[x] PIN probado
[x] Ranking probado
[x] GitHub Pages publicado
[x] MVP validado con usuarios reales
```
