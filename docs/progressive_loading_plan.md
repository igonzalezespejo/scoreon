# Plan de Carga Progresiva (V2.5)

## 1. Resumen ejecutivo
La aplicación actual bloquea la interfaz de usuario ("Cargando datos...") hasta que se completa la descarga de todos los datos iniciales, incluyendo los rankings mensuales y globales que pueden requerir un cálculo y descarga pesados. Este plan propone una arquitectura de carga progresiva para reducir el tiempo de carga inicial, cargando el ranking en segundo plano y mostrando estados de carga específicos por vista cuando sea necesario. **No se modificará la lógica de cálculo (scoring) ni las reglas de ranking.**

## 2. Estado actual
- Al iniciar, `app.js` invoca `loadBootstrapData()` que hace una petición a `?action=bootstrap`.
- `action=bootstrap` devuelve: config, activeMonth, participants, matches, predictionsSummary, rankingMonthly, y rankingGlobal.
- El backend puede disparar un recálculo síncrono si el ranking está marcado como sucio.
- La interfaz de Inicio no se pinta hasta que `loadBootstrapData()` finaliza completamente.

## 3. Qué datos necesita cada vista
- **Inicio**: config, activeMonth, participants, matches, predictionsSummary, serverTime.
- **Apuestas**: config, activeMonth, participants, matches, predictionsSummary.
- **Estado**: participants, predictionsSummary.
- **Ranking**: rankingMonthly, rankingGlobal.
- **Admin**: Casi estático, utiliza endpoints dedicados para acciones.

## 4. Endpoints propuestos
- `action=bootstrapLight`: Devuelve solo la configuración, mes activo, participantes, partidos, resumen de predicciones y tiempo del servidor. Omite los arrays de rankings. No dispara el recálculo síncrono de rankings.
- `action=rankings`: Devuelve exclusivamente `rankingMonthly` y `rankingGlobal`. Si la flag de ranking está sucia (`ranking_dirty`), ejecuta el recálculo y devuelve los datos actualizados.
- `action=bootstrap`: Se mantiene el endpoint actual completo como fallback y para propósitos de debug.

## 5. Cambios frontend propuestos
- **`api.js`**: Añadir métodos `loadBootstrapLight()` y `loadRankingsData()`.
- **`state.js`**: 
  - Añadir método `initializeLight(data)` para popular el estado inicial con los datos ligeros.
  - Añadir método `updateRankings(data)` para actualizar solo la porción de rankings del estado.
- **`app.js`**: 
  - Modificar el inicio para hacer `await loadBootstrapLight()`.
  - Inmediatamente después, iniciar la navegación rápida con `setupNavigation()` y `navigateTo("home")`.
  - Disparar en segundo plano la carga del ranking: `loadRankingsData().then(state.updateRankings)`.
- **Vistas**: Modificar `rankingView.js` para que verifique si los datos del ranking ya están en el estado. Si no, debe renderizar un mensaje de "Cargando ranking..." y actualizarse cuando lleguen.

## 6. Cambios backend propuestos
- **`Code.gs`**:
  - Implementar la función `actionBootstrapLight()` que retorne rápidamente sin leer las pestañas de ranking ni invocar recálculo síncrono.
  - Implementar la función `actionRankings()` que lea y devuelva los rankings, forzando un recálculo previo si `ranking_dirty` es `true`.
  - Mantener `actionBootstrap()` completo sin alteraciones.

## 7. Riesgos y Mitigaciones
- **Vistas que esperan ranking desde el inicio**: Si en el futuro Inicio muestra un Top 3, fallaría si espera datos inmediatos. **Mitigación**: Inicio no debe depender del ranking o debe manejar estados nulos.
- **Estado parcial**: Componentes que asumen que `state.rankingMonthly` existe podrían dar errores. **Mitigación**: Inicializar en el state `rankingMonthly: null` o `[]` temporal y validar antes de iterar.
- **Navegación rápida a Ranking**: El usuario entra a Ranking antes de que acabe la carga en background. **Mitigación**: `rankingView.render()` detecta la falta de datos y muestra loading.
- **Desincronización visual**: Si la carga ligera devuelve un estado (ej. un usuario hizo apuestas) y el ranking en background tarda y recalcula, es perfectamente normal y deseable separar estos tiempos de carga.

## 8. Plan de migración por pasos
1. [x] Crear endpoints en backend (`actionBootstrapLight` y `actionRankings`) en `Code.gs`.
2. [x] Actualizar el frontend (`api.js` y `state.js`) para consumir los nuevos endpoints separadamente.
3. [x] Actualizar `rankingView.js` para soportar estados de carga (mostrar UI de carga si los datos son `null`).
4. [x] Cambiar el flujo principal de `app.js` para usar la carga progresiva.
5. [x] Optimizar llamadas de refresco (`savePrediction`, `registerParticipant`) para usar `bootstrapLight` en lugar de `bootstrap` completo, agilizando la UX tras guardar una acción.

## 9. Criterios de aceptación de la planificación
- No se ha cambiado código funcional.
- `roadmap.md` ha sido actualizado.
- `docs/progressive_loading_plan.md` creado.
- Queda explícitamente claro que no se toca scoring.
- Queda explícitamente claro que no se toca cálculo de ranking.
- Queda explícitamente claro que `bootstrapLight` no incluye `rankingMonthly` ni `rankingGlobal`.
- Queda explícitamente claro que Ranking se carga en segundo plano.

## 10. Prompt recomendado para la implementación backend
"Implementa los endpoints propuestos en el plan de carga progresiva (`action=bootstrapLight` y `action=rankings`) en `apps-script/Code.gs`. `bootstrapLight` debe devolver todo excepto los rankings y no debe bloquearse recalculando rankings. `rankings` debe devolver solo los arrays de ranking y debe ejecutar el recálculo si la flag dirty está activa. Mantén `action=bootstrap` original intacto. NO modifiques las reglas de scoring ni la lógica de cálculo del ranking."

## 11. Prompt recomendado para la implementación frontend
"Implementa los cambios frontend del plan de carga progresiva en `src/`. Modifica `api.js` y `state.js` para soportar la carga parcial mediante los nuevos endpoints `bootstrapLight` y `rankings`. Modifica `app.js` para que espere solo a `bootstrapLight` (montando la interfaz rápida) y dispare `rankings` en segundo plano sin `await`. Modifica `rankingView.js` para que muestre un estado de 'Cargando ranking...' si los datos aún no están en el state al visitar la pestaña. Asegúrate de que `savePrediction` y `registerParticipant` refresquen usando datos ligeros. No modifiques los diseños visuales de otras vistas."

## 12. V2.6 - Inicio Estático Instantáneo
El plan original de V2.5 se extendió con **V2.6**, donde se eliminó por completo la dependencia del frontend respecto a `bootstrapLight` para renderizar la pantalla inicial. 
- La vista de Inicio (Home) ahora es una landing page estática que se muestra instantáneamente al cargar el JavaScript, sin esperar a la red.
- `bootstrapLight` carga en background para proveer datos a las vistas de Apuestas y Estado.
- Las vistas de Apuestas y Estado cuentan con un estado visual de carga (`coreLoading` y `coreLoaded`) en caso de que el usuario haga clic en ellas antes de que finalice la solicitud en segundo plano.

## 13. Títulos Dinámicos y Formateo de Fechas
- **Los títulos visibles (del mes activo) deben venir siempre de `Months.title` o un fallback por `month_id` generado por backend/frontend.**
- **Nunca mostrar fechas ISO crudas como título de ninguna vista.**
- `getActiveMonthTitle` y `buildMonthTitle` garantizan que la presentación al usuario sea siempre legible (e.g. "Agosto 2026").
