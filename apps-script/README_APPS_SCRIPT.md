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
   - **Participants**: `user_id`, `display_name`, `active`, `pin`
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
