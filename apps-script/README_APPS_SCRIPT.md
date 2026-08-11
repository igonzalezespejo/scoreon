# Backend de Porra Mensual (Google Apps Script)

Este directorio contiene el código necesario para desplegar el backend de la Porra Mensual utilizando Google Apps Script.

## Archivos
- `Code.gs`: El script principal que maneja las peticiones GET y POST, validaciones y escritura/lectura en Google Sheets.

## Instrucciones de Despliegue

1. Crea una nueva hoja de cálculo en Google Sheets (Spreadsheet).
2. Crea las siguientes pestañas (hojas) con sus columnas respectivas en la primera fila:
   - **Config**: `key`, `value`
     - Ejemplo de fila 2: `active_month_id`, `2026-09`
     - Ejemplo de fila 3: `pin_enabled`, `true`
     - `session_ttl_days` (opcional, por defecto 30): días que dura la sesión de login antes de caducar. Se renueva automáticamente mientras el usuario siga usando la web.
   - **Participants**: `user_id`, `display_name`, `email`, `pin`, `active`, `is_admin`, `created_at`, `notes`
     - `is_admin` (`true`/`false`): marca qué usuario ve el menú Admin tras iniciar sesión. Solo debe haber `true` en la fila del administrador; el resto `false` o vacío.
   - **Sessions** (nueva, necesaria para el login persistente): `token`, `user_id`, `created_at`, `expires_at`, `last_seen_at`
     - El backend la rellena solo al iniciar sesión; no hace falta escribir nada a mano aquí.
   - **Months**: `month_id`, `title`, `status`, `open_at`, `lock_at`
   - **Matches**: `match_id`, `month_id`, `competition`, `home_team`, `away_team`, `kickoff_at`, `status`, `display_order`
   - **Predictions_Current**: `user_id`, `match_id`, `home_goals`, `away_goals`, `submitted_at`
   - **Predictions_Log**: `timestamp`, `user_id`, `action`, `details`
   - **Results**: (Columnas necesarias según la app)
   - **Scoring_Rules**: (Columnas necesarias según la app)
   - **Ranking_Monthly**: `user_id`, `display_name`, `points`, `exact_scores`, `correct_signs`, `failed`, `played_matches`, `position`
   - **Ranking_Global**: `user_id`, `display_name`, `total_points`, `months_played`, `position`

3. En el menú de la hoja de cálculo, ve a **Extensiones > Apps Script**.
4. Copia el contenido completo de `Code.gs` en el editor que aparece, reemplazando el contenido por defecto.
5. Haz clic en el botón de **Guardar** (icono de disquete).
6. Haz clic en **Implementar > Nueva implementación**.
7. Selecciona el tipo de implementación: **Aplicación web**.
8. Configura:
   - Descripción: `Backend Porra Mensual`
   - Ejecutar como: `Tú (tu email)`
   - Quién tiene acceso: `Cualquier persona`
9. Haz clic en **Implementar**. Se te pedirán permisos para acceder a tus hojas de cálculo. Acéptalos.
10. Copia la **URL de la aplicación web**. Esta es la URL que deberá usar tu frontend para las llamadas al backend.

## Notas de Seguridad y Validaciones
El código incluye `LockService` para prevenir condiciones de carrera al guardar predicciones simultáneas. Además, todas las validaciones (PIN, estado del mes, usuario activo, tiempos de cierre) se realizan *en el servidor*, garantizando que la API sea segura aunque la URL sea pública.

## Login persistente (sesiones)

Desde que se añadió el login obligatorio, el flujo es:

1. El usuario se identifica una vez (`action=login`) con su `user_id` y PIN. El backend valida y crea una fila en la hoja **Sessions** con un token aleatorio y una fecha de caducidad (`session_ttl_days`, 30 por defecto).
2. El frontend guarda ese token en `localStorage` del navegador. En visitas posteriores, llama a `action=resumeSession` con el token guardado para reanudar la sesión sin pedir PIN otra vez, siempre que no haya caducado.
3. Cada vez que el token se usa (para ver o guardar apuestas, o para reanudar sesión), su caducidad se renueva otros `session_ttl_days` días — una sesión activa nunca caduca por sí sola.
4. `action=logout` borra la fila de esa sesión en la hoja Sessions.
5. Las acciones `getUserPredictions` y `savePrediction` ya no requieren PIN por petición: requieren `token` y este debe corresponder a una sesión válida. La identidad del usuario la determina el token, no un `user_id` que envíe el cliente.

El menú **Porra Admin > Limpiar sesiones caducadas** (en el propio Google Sheet) borra las filas de Sessions ya caducadas, para que la hoja no crezca indefinidamente. Es opcional (las sesiones caducadas se ignoran igualmente al validarlas), pero es buena higiene ejecutarlo de tanto en tanto.

**El panel de Admin sigue protegido por el `admin_token` de la hoja Config, sin cambios.** El flag `is_admin` de Participants solo controla si el botón "Admin" aparece en el menú tras el login del usuario — no sustituye al código de administración, que se sigue pidiendo al entrar al panel (doble capa, a propósito).
