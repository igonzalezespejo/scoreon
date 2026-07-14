# Auditoría de Arquitectura de Ranking y Puntuación

## 1. Resumen ejecutivo
En la versión actual de *Porra Mensual*, la arquitectura del ranking ha mutado: inicialmente se pensaba usar Google Sheets como panel de administración visible donde los rankings se almacenarían y serían auditables, pero el desarrollo actual en `Code.gs` calcula dinámicamente los rankings (mensual y global) en memoria (on-the-fly) cada vez que el frontend solicita el estado inicial (`action=bootstrap`).
Esto provoca que las pestañas `Ranking_Monthly` y `Ranking_Global` de Google Sheets hayan quedado obsoletas y su contenido sea ignorado, perdiendo la característica de usar Google Sheets como un panel auditable real. 
Esta auditoría recomienda migrar a un modelo híbrido (Opción C) donde Apps Script asume el coste del cálculo para evitar fórmulas frágiles en Sheets, pero persiste el resultado en las pestañas `Ranking_Monthly` y `Ranking_Global`, permitiendo que Sheets vuelva a ser la fuente de verdad visual y auditable para el administrador.

> **Nota:** La recomendación final (Opción C) **ha sido implementada**. Google Sheets vuelve a ser la fuente de verdad para la lectura, y Apps Script actualiza las tablas automáticamente mediante un menú personalizado o como mecanismo de seguridad al arrancar.

## 2. Estado actual

**¿De dónde lee actualmente el frontend el ranking mensual y global?**
El frontend lee ambos rankings exclusivamente de la respuesta JSON generada por el endpoint `bootstrap` de Apps Script, el cual contiene los objetos `rankingMonthly` y `rankingGlobal`.

**¿Apps Script calcula rankings o solo lee pestañas?**
Apps Script **calcula** dinámicamente todos los rankings en el momento de la petición (usando las funciones `buildMonthlyRanking` y `buildGlobalRanking`). No lee las pestañas `Ranking_Monthly` ni `Ranking_Global`.

**¿src/scoring.js se usa en producción o solo en tests/mock?**
Se usa principalmente en pruebas o proyecciones del lado del cliente, pero la **fuente de verdad** que afecta la vista del ranking que se muestra en producción proviene de la lógica de puntuación implementada directamente en `Code.gs` (función `scorePrediction`). 

**¿Ranking_Monthly y Ranking_Global siguen teniendo utilidad real?**
Actualmente, **ninguna utilidad técnica real**. Según `docs/sheet_schema.md`, el backend las ignora y solo se sugiere mantenerlas como "histórico o caché", pero no son la fuente de verdad.

**¿Los usuarios nuevos aparecen automáticamente en ranking?**
Sí. Como el script de `Code.gs` itera sobre la lista de todos los `Participants` activos al calcular, los usuarios nuevos aparecen automáticamente en los resultados JSON, recibiendo 0 puntos si no tienen apuestas históricas.

**¿Qué pasa si un usuario está en Participants pero no en Ranking_Monthly? / ¿Qué pasa si Ranking_Monthly tiene usuarios antiguos o inactivos?**
Dado que la pestaña `Ranking_Monthly` de Google Sheets es ignorada por Apps Script, cualquier discrepancia visual que exista allí no afecta a la web en absoluto. Si el usuario está activo en `Participants`, la web lo mostrará; si está inactivo, no.

## 3. Reglas de puntuación

**¿Dónde están definidas actualmente?**
Están definidas en la pestaña `Scoring_Rules` de Google Sheets y duplicadas como constantes por defecto (`DEFAULT_RULES`) en `src/scoring.js` y como validación de fallback en `Code.gs`.

**¿Scoring_Rules en Google Sheets controla realmente algo?**
Sí. La función de Apps Script lee esta pestaña y pasa esas reglas a la función `scorePrediction` para determinar los puntos de cada apuesta evaluada, sobreescribiendo los fallbacks.

**¿El código depende de rule_id concretos? / ¿La regla simplificada 20/5/0 sigue en algún sitio?**
El código backend depende estrictamente de los siguientes `rule_id`: `exact_draw`, `exact_non_draw`, `draw_not_exact`, `winner_not_exact`, y `wrong`. La regla simplificada no está en uso; el sistema espera y aplica la regla definitiva **20/15/10/5/0**.

## 4. Comparativa de opciones A/B/C/D

* **Opción A (Sheets calcula con fórmulas, Apps Script lee):**
  * *Pros:* Sheets es la fuente de verdad total e instantánea.
  * *Contras:* Las fórmulas de ranking, desempate y cruces relacionales entre resultados y apuestas son inmensamente complejas de mantener en Sheets (especialmente con 40-60 usuarios y ranking global acumulado). Muy alto riesgo de que alguien rompa una fórmula accidentalmente.

* **Opción B (Apps Script calcula en bootstrap, Sheets es solo BD) [ESTADO ACTUAL]:**
  * *Pros:* Fácil de implementar, cálculo rápido para volúmenes bajos de datos, sin riesgo de fórmulas rotas.
  * *Contras:* Google Sheets pierde su rol como panel visual auditable para el administrador respecto a las clasificaciones.

* **Opción C (Apps Script calcula y ESCRIBE en Sheets, Frontend lee Sheets a través de Apps Script):**
  * *Pros:* Se mantienen cálculos en código (robusto, testeable y cero complejidad en celdas), y las hojas `Ranking_Monthly` y `Ranking_Global` se vuelven el panel visual oficial, auditable y fácilmente corregible manualmente si existiera necesidad.
  * *Contras:* Requiere invocar o disparar un proceso de actualización (ya sea mediante un disparador de Apps Script `onEdit`, botones manuales de recalculado o periódicamente).

* **Opción D (Híbrido: Sheets usa fórmulas de puntuación auxiliar y Apps Script lee para rankear):**
  * *Pros:* Despeja cálculo matemático.
  * *Contras:* Introduce complejidad doble y fragmenta la lógica en dos lugares. 

## 5. Recomendación final

Se recomienda la **Opción C**. 
Apps Script debe ser el motor de cálculo porque manejar las reglas de desempate, sumas y ordenamientos lógicos es mucho más robusto en código que en complejas fórmulas matriciales de Sheets. Sin embargo, para cumplir con el requisito de que el administrador audite y corrija los rankings de un vistazo, **Apps Script debe persistir (escribir) los resultados en las pestañas `Ranking_Monthly` y `Ranking_Global`**.

El frontend entonces deberá recibir los rankings que `Code.gs` directamente *lea* desde esas pestañas (en lugar de calcularlos en caliente).

## 6. Arquitectura propuesta (Basada en Opción C)

**Pestañas de Google Sheets:**
- Las pestañas se mantienen igual que en `sheet_schema.md`.
- `Ranking_Monthly` y `Ranking_Global` se usarán activamente y contendrán los campos existentes: `user_id`, `display_name`, `points`, `exact_scores`, etc.

**Ciclo de recálculo (Apps Script):**
En `Code.gs` existirá una función aislada `updateRankingsInSheets()`. Esta función podrá ser disparada de tres modos:
1. **Periódicamente (Time-driven trigger):** Por ejemplo cada hora.
2. **Por evento:** Cada vez que el administrador modifica `Results` (usando un evento `onEdit`).
3. **Manual:** A través de un menú personalizado de Google Sheets ("Porra Admin" -> "Recalcular Rankings") para forzar una sincronización en cualquier momento.

**Usuarios nuevos y meses nuevos:**
Cuando un usuario se inscribe, la tabla `Participants` se actualiza. La próxima vez que corra el recálculo, el backend insertará a este usuario en las tablas de Ranking con 0 puntos, garantizando que el usuario aparezca visible en Google Sheets y por consiguiente en el frontend.
Del mismo modo se procesan los usuarios inactivos (se purgan de las tablas del Ranking).

## 7. Plan de migración

1. **Refactorización de Code.gs (Cálculo a Escritura):**
   - Extraer el código actual que calcula los rankings y colocarlo en un método `recalculateAndPersistRankings()`.
   - Modificar este método para que en lugar de devolver arrays en memoria, los grabe usando `.setValues()` en las pestañas `Ranking_Monthly` y `Ranking_Global`.

2. **Adaptación de Code.gs (Lectura):**
   - Modificar `actionBootstrap` para que ya no genere clasificaciones dinámicamente, sino que llame a `getSheetData('Ranking_Monthly')` y `getSheetData('Ranking_Global')` para despacharlos al frontend.

3. **Creación de triggers:**
   - Crear un menú personalizado en la hoja (función `onOpen`) que permita al administrador ejecutar el recálculo a demanda.
   - Opcionalmente, agregar un trigger temporal para mantener el panel siempre al día sin intervención.

4. **Despliegue y validación:**
   - Ejecutar la función de recálculo para popular las hojas vacías.
   - Comprobar que el frontend sigue mostrándolos correctamente sin haber tocado nada en `src/`.
   - Modificar `docs/sheet_schema.md` para reflejar que estas pestañas ahora **sí** son fuente visible.

## 8. Prompt recomendado para el siguiente agente
*(Para cuando se desee implementar la recomendación)*

> "Implementa la arquitectura de ranking (Opción C) según la auditoría `docs/ranking_architecture_audit.md`. 
> 1. Modifica `apps-script/Code.gs` para que incluya una función `updateRankingsInSheets()` que calcule los rankings mensuales y globales como lo hace hoy, pero que escriba el resultado en las hojas de Sheets (`Ranking_Monthly` y `Ranking_Global`).
> 2. Añade un menú `onOpen()` en `Code.gs` para disparar esta función manualmente desde Sheets.
> 3. Modifica `actionBootstrap` para que devuelva los datos directamente leídos de las hojas de Google en vez de recalcularlos al vuelo.
> 4. Asegúrate de vaciar las hojas antes de escribir los datos nuevos, preservando la fila de las cabeceras.
> 5. Actualiza `docs/sheet_schema.md` eliminando la nota de que las hojas de ranking son ignoradas y declarando que ahora son la fuente de lectura final. 
> Valida tu plan antes de escribir el código."
