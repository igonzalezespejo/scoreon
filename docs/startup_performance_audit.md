# Auditoría de Rendimiento — Carga Inicial (Home)

**Fecha:** 2026-07-15
**Alcance:** Solo análisis. No se ha modificado ningún archivo de `src/`, `apps-script/`, `styles/`, `index.html`, `tests/` ni `config.js`.
**Archivo:** `docs/startup_performance_audit.md`

---

## 1. Resumen ejecutivo

La percepción de lentitud es real y tiene una causa concreta y verificable: **`homeView.js` ya no es estática**. Aunque `app.js` pinta la vista Home de forma síncrona nada más cargar el DOM (sin `await`), `homeView.render()` comprueba `state.coreLoaded` y, si es `false` (que lo es hasta que responde `bootstrapLight`), muestra únicamente `"Cargando la temporada..."` en vez de las cajitas de meses.

Esto contradice explícitamente lo documentado en `roadmap.md` (V2.6 "Inicio estático instantáneo" y V2.12 "Home multi-mes") y en `docs/progressive_loading_plan.md` §12, que afirman que Home renderiza instantáneamente sin esperar red. Todo indica que esta garantía se perdió al implementar el rediseño de tarjetas por mes (`V2.11`/`V2.12`), que necesita `state.months` — un dato que **solo llega dentro de `bootstrapLight`**, no antes.

En segundo lugar, aunque no es el cuello de botella dominante, `app.js` importa estáticamente las 5 vistas (`home`, `betting`, `ranking`, `status`, `admin`) en el módulo de entrada, así que el navegador debe descargar y parsear todo el JS de la aplicación (~80 KB sin comprimir) antes de poder pintar nada, incluida la Home.

En tercer lugar, `bootstrapLight` en el backend (Apps Script) lee 6 hojas completas de Google Sheets (`Config`, `Participants`, `Months`, `Matches` — todas, no solo del mes activo —, `Predictions_Current` — todas —, `Results`) para poder calcular `matches_count`/`submitted_count` de **todos** los meses de la temporada, no solo del mes activo. Esa es la razón funcional de por qué "aligerar" bootstrapLight es más difícil de lo que parece: las propias cajitas de Home (vía `homeView.js:43-56`) necesitan esos contadores por mes, y hoy solo bootstrapLight los provee.

**La causa raíz no es "Apps Script es lento" (que también), sino que Home depende de Apps Script para pintar, cuando el diseño documentado decía que no debía depender de él.**

---

## 2. Ruta crítica actual (medida en código, no en Network)

```
DOMContentLoaded
  → init() [src/app.js:20]
    → setupNavigation()
    → navigateTo('home')                    // síncrono, sin await
        → homeView.render()                 // [homeView.js:8] state.coreLoaded === false
            → return "Cargando la temporada..."   ← esto es lo que ve el usuario primero
    → loadBootstrapLight()                  // fetch a Apps Script, ?action=bootstrapLight
        .then(data => {
            state.initializeLight(data)      // coreLoaded = true
            navigateTo('home')  otra vez     // [app.js:37-40] SOLO si currentView sigue siendo home/betting/status/admin
                → homeView.render()          // ahora sí pinta las cajitas
            loadRankingsData()               // fetch en paralelo, ?action=rankings (no bloquea Home)
        })
```

Es decir: **Home se pinta dos veces**. La primera vez (instantánea) es un placeholder de texto, no las cajitas. La segunda vez (tras `bootstrapLight`, varios segundos después) es cuando aparecen las cajitas reales. Esto es justo lo que se observa como "carga inicial lenta" — el usuario ve "Cargando la temporada..." durante el tiempo que tarda Apps Script.

### Respuestas directas

- **¿`app.js` importa todas las vistas al inicio?** Sí. [app.js:1-7](src/app.js#L1-L7) tiene imports estáticos de las 5 vistas. No hay ningún `import()` dinámico en `app.js`. Esto obliga al navegador a descargar y parsear `bettingView.js` (21 KB), `adminView.js` (12.6 KB), `rankingView.js` y `statusView.js` aunque el usuario solo vaya a ver Home.
- **¿Se descargan vistas que no hacen falta para Home?** Sí, las 4 restantes, siempre, en cada carga.
- **¿`homeView` depende de `bootstrapLight` o puede pintar sin API?** Depende. Ver hallazgo H1 abajo — es el hallazgo principal de esta auditoría.
- **¿`staticDescriptions.js` se carga siempre? ¿pesa mucho? ¿bloquea algo?** Se importa siempre desde `homeView.js:4` (import estático, no lazy), pero solo pesa ~18.7 KB (143 líneas) — no es significativo frente al resto. No bloquea el pintado porque es contenido estático en memoria, no red.
- **¿Las fonts de Google afectan a la percepción?** Hay `preconnect` a `fonts.googleapis.com`/`fonts.gstatic.com` y una hoja `<link rel="stylesheet">` con `display=swap` ([index.html:8-10](index.html#L8-L10)). `display=swap` evita el bloqueo de renderizado del texto (usa fuente de sistema mientras carga), así que el impacto es bajo/moderado, no crítico. No es la causa de los "varios segundos" reportados.

---

## 3. Backend (Apps Script) — hallazgos

### `actionBootstrapLight` ([Code.gs:780-931](apps-script/Code.gs#L780-L931))

Lee, sin caché, 6 hojas completas vía `getSheetData()`:
`Config`, `Participants`, `Months`, `Matches` (**todas**, todos los meses), `Predictions_Current` (**todas**), `Results` (**todas**).

`getSheetData()` ([Code.gs:1482-1509](apps-script/Code.gs#L1482-L1509)) hace, por cada hoja, **dos lecturas**: `range.getValues()` y `range.getDisplayValues()` — duplicando el coste de I/O de Sheets por cada llamada. No hay `CacheService` en ningún punto de `bootstrapLight`.

El motivo por el que lee TODO `Matches` y TODO `Predictions_Current` (no solo el mes activo) es que necesita calcular `matches_count`/`submitted_count` por mes para las cajitas de Home ([Code.gs:844-857]). Esto es una consecuencia directa del rediseño multi-mes (`season_multi_month_audit.md` §5) que pidió que Home muestre tarjetas con datos por mes.

- **¿Sigue leyendo más hojas de las necesarias?** No hay hojas obviamente redundantes, pero sí hace *doble lectura* de cada una (values + displayValues) y lee la temporada completa de `Matches`/`Predictions_Current` para poder alimentar los contadores de todas las cajitas — cuando en el diseño original "ligero" (`progressive_loading_plan.md`) solo se pretendía traer datos del mes activo.
- **¿Puede reducirse aún más?** Sí — ver opciones D/E en la sección 5.
- **¿Debe llamarse antes de pintar Home?** Según el diseño documentado (V2.6/V2.12): **no**. Según el código actual: **sí**, porque `matches_count`/`submitted_count` por mes solo existen tras esta llamada.
- **¿`rankings` bloquea indirectamente?** No bloquea Home ni Apuestas — se dispara `.then()` de `bootstrapLight` sin `await` ([app.js:42-56]), y solo re-renderiza si `currentView === VIEWS['ranking']`. Correcto según diseño.
- **¿`monthData` se carga bajo demanda o demasiado pronto?** Bajo demanda: solo se invoca al pulsar "INFO" en una cajita de un mes no cacheado ([homeView.js:146-148]). Correcto.
- **¿Hay recálculos de ranking durante la carga normal?** No en `bootstrapLight`. Sí puede haberlos en `actionRankings` ([Code.gs:1077-1107]) si `ranking_dirty`, sheets vacías, o faltan participantes — pero eso ocurre en la llamada `rankings`, que es en background y no bloquea Home/Apuestas.

---

## 4. Diseño actual de Home — qué es realmente dinámico

Mirando [homeView.js:22-65], cada cajita de mes usa:

| Dato | Fuente | ¿Puede ser estático? |
|---|---|---|
| `title`, `month_id` | `state.months[]` (bootstrapLight) | Sí — casi no cambia, se define al crear el mes |
| `status` (open/locked/scored/archived) | `state.months[]` | **No** — cambia con acciones de admin, debe ser real |
| `lock_at` | `state.months[]` | Cuasi-estático, pero afecta a badge "Cerrada" — mejor real |
| `matches_count` | `bootstrapLight` (contado en backend) o `monthDataById` | Podría precalcularse como estático mensual si el calendario no cambia tras publicarlo |
| `submitted_count` / `totalCount` | `bootstrapLight` (contado en backend) | **No** — cambia en tiempo real conforme la gente apuesta |
| Descripción/calendario (al pulsar INFO) | `staticDescriptions.js` (local) + `monthData` bajo demanda | Ya es híbrido: la parte de texto ya es estática hoy |

Conclusión: **el esqueleto de la cajita (título, badge de estado, botones) puede pintarse con datos 100% locales**; solo los contadores (`submitted_count`, `totalCount`) son intrínsecamente dinámicos y pueden llegar después sin bloquear.

---

## 5. Opciones comparadas

| Opción | Descripción | Pros | Contras |
|---|---|---|---|
| **A** — Optimizar Apps Script sin tocar el flujo | Cachear con `CacheService`, evitar doble lectura (values+displayValues), leer solo `Matches`/`Predictions_Current` del mes activo | Cambio acotado al backend | No resuelve el problema real: Home seguiría bloqueada por `coreLoaded` mientras Apps Script tenga cualquier latencia (cold start incluido) |
| **B** — Home 100% estática con datos locales + actualización en background | Restaurar el contrato documentado en V2.6: `homeView.render()` no debe mirar `state.coreLoaded` para pintar el esqueleto de las cajitas; usar una lista estática de meses (nombre/mes/orden) y placeholders para contadores, luego sustituir cuando llegue `bootstrapLight` | Resuelve la causa raíz directamente; alinea código con lo ya documentado; bajo riesgo si se hace con cuidado de re-renderizar al llegar datos | Requiere mantener manualmente una lista mínima de meses en el frontend (nombre + orden), o derivarla de `staticDescriptions.js` |
| **C** — Lazy-load de vistas no iniciales | `import()` dinámico para `bettingView`/`rankingView`/`statusView`/`adminView` en vez de import estático en `app.js` | Reduce JS descargado/parseado en la primera carga | Complementario, no resuelve el bloqueo de Home por `coreLoaded` — solo ataca el peso de JS, que hoy es secundario |
| **D** — Endpoints más granulares (`seasonStatic`, `monthStats`, `rankings`, `userPredictions`) | Separar aún más bootstrapLight en piezas | Podría reducir la lectura de Sheets por request | Más complejidad de orquestación en frontend; sobre-ingeniería para 40-60 usuarios; no ataca la causa raíz (Home seguiría esperando red si no se combina con B |
| **E** — Cache (frontend localStorage o backend `CacheService`) | Cachear respuesta de `bootstrapLight` unos segundos/minutos | Mitiga cold start / peticiones repetidas | No resuelve la primera carga en frío (peor caso, cuando más importa la percepción) |

---

## 6. Recomendación final

**Combinar B (prioritario) + C (complementario) + A parcial (limpieza backend sin riesgo).**

1. **B es la que resuelve el síntoma reportado.** Restaurar el contrato ya documentado en `roadmap.md` V2.6/V2.12: Home debe pintar el esqueleto de las cajitas (título, badge, botones) con datos locales/estáticos, sin esperar `state.coreLoaded`. Los contadores dinámicos (`submitted_count`/`totalCount`) se muestran como placeholder (`-`/`···`) y se actualizan in-place cuando `bootstrapLight` resuelve — el mismo patrón que ya usa `rankingView` para el ranking en segundo plano (patrón ya validado en el propio código).
2. **C es barata y reduce peso de red/parseo** sin tocar el problema de percepción, pero contribuye a que el "instantáneo" lo sea también en conexiones lentas o dispositivos modestos.
3. **A (partes de bajo riesgo)**: eliminar la doble lectura `getValues()`+`getDisplayValues()` en `getSheetData()` cuando no hace falta, y evaluar si `bootstrapLight` necesita leer *todos* los meses de `Matches`/`Predictions_Current` o si se puede precomputar/cachear ese conteo — pero esto es una optimización de "cuánto tarda el fondo", no de "qué ve el usuario primero", así que es de menor prioridad que B.
4. **D y E** no se recomiendan ahora: D añade complejidad desproporcionada para 40-60 usuarios; E solo ayuda en visitas repetidas, no en la primera carga (que es el caso más visible).

Esto respeta las restricciones dadas: GitHub Pages ya sirve HTML/JS rápido (no es el problema), Apuestas/Ranking/Estado seguirán usando datos reales sin cambios, y no se rompe el sistema actual — es literalmente volver a lo que ya está documentado como objetivo en V2.6.

---

## 7. Plan de implementación por fases (para una futura sesión — NO ejecutar en esta auditoría)

### Fase 1 — Medición y confirmación
- **Archivos a tocar:** ninguno (solo instrumentación temporal opcional con `console.time`/Network tab).
- **Riesgo:** ninguno.
- **Beneficio:** confirmar con números reales (no solo lectura de código) cuánto tarda cada tramo: JS parse, `bootstrapLight`, `rankings`.
- **Cómo probarlo:** abrir DevTools → Network + Performance en localhost y en GitHub Pages; anotar tiempos de: primer paint, `bootstrapLight` (TTFB y total), `rankings`.

### Fase 2 — Home estática/local sin esperar `bootstrapLight` — ✅ IMPLEMENTADA (2026-07-15, V2.12.1)
- **Archivos tocados:** `src/views/homeView.js` (se eliminó el `if (!state.coreLoaded) return "Cargando..."` como bloqueo total; se añadió `getDisplayMonths()` que mezcla `staticSeason` con `state.months` por `month_id`, priorizando siempre los datos reales cuando existen), `src/data/staticSeason.js` (nuevo, lista mínima `month_id`/`title`/`display_order`), `roadmap.md`, `docs/qa_checklist.md`.
- **Riesgo:** medio, mitigado — la lista estática (`staticSeason.js`) es solo el esqueleto visual (título/orden); en cuanto llega `bootstrapLight` los datos reales (`state.months`) sustituyen status, `lock_at` y contadores. Un mes del fallback ausente en `state.months` se marca como "Configuración pendiente" en vez de romper el render.
- **Beneficio obtenido:** Home pinta las cajitas (con badges "Cargando..." y contadores "···") en el primer render, sin esperar red.
- **Cómo probarlo:** ver checklist V2.12.1 en `docs/qa_checklist.md` — simular latencia con Network throttling y confirmar que las cards aparecen antes de que responda `bootstrapLight`, y que se hidratan sin duplicarse al llegar.

### Fase 3 — Lazy imports de vistas no iniciales
- **Archivos a tocar:** `src/app.js` (reemplazar imports estáticos de `bettingView`, `rankingView`, `statusView`, `adminView` por `import()` dinámico dentro de `navigateTo()`).
- **Riesgo:** bajo-medio — cuidado con referencias cruzadas (p. ej. `homeView.js` importa `navigateTo` de `app.js`; verificar que no haya ciclos de import que compliquen el bundling dinámico).
- **Beneficio esperado:** menos JS descargado/parseado antes del primer paint de Home.
- **Cómo probarlo:** Network tab — confirmar que `bettingView.js`, `adminView.js`, etc. no se descargan hasta pulsar la pestaña correspondiente.

### Fase 4 — `bootstrapLight` solo para datos dinámicos mínimos
- **Archivos a tocar:** `apps-script/Code.gs` (`actionBootstrapLight`), y ajuste correspondiente en `src/state.js`/`homeView.js` para consumir contadores parciales.
- **Riesgo:** medio-alto si se toca la lógica de conteo por mes (usada también en Admin) — requiere pruebas exhaustivas de multi-mes.
- **Beneficio esperado:** menor tiempo de respuesta de `bootstrapLight` (menos lecturas de Sheets, sin doble lectura values/displayValues donde no se necesite texto formateado).
- **Cómo probarlo:** comparar `debug.timings.total_ms` (ya instrumentado en la respuesta, ver [Code.gs:911-916]) antes/después.

### Fase 5 — Cache y limpieza
- **Archivos a tocar:** `apps-script/Code.gs` (posible `CacheService` para `Months`/`Config`, que cambian poco), limpieza de código muerto si Fase 2-4 dejan ramas obsoletas.
- **Riesgo:** bajo si el TTL de caché es corto y hay invalidación clara en escrituras admin.
- **Beneficio esperado:** mitigar cold starts repetidos y peticiones concurrentes de varios usuarios.
- **Cómo probarlo:** medir tiempo de `bootstrapLight` en peticiones consecutivas cercanas en el tiempo.

---

## 8. Checklist QA (para cuando se implemente)

- [ ] Las cajitas de mes aparecen sin esperar red (probar con Network throttling "Slow 3G" o Apps Script caído).
- [ ] Los contadores (`submitted_count`/`totalCount`) se actualizan correctamente al llegar `bootstrapLight`, sin parpadeo brusco ni duplicar tarjetas.
- [ ] El mes activo mostrado en las cajitas estáticas coincide con `active_month_id` real una vez llega el dato del backend (evitar mostrar un mes "adivinado" que luego cambie de forma confusa).
- [ ] Apuestas/Ranking/Estado siguen sin poder abrirse con datos incompletos sin mostrar su propio loading (ya implementado, no romperlo).
- [ ] Botón "Apostar"/"INFO" de una cajita sigue funcionando igual que hoy.
- [ ] Lazy imports (si se implementan) no rompen la navegación directa a Apuestas/Ranking/Estado/Admin en el primer clic.
- [ ] No se han tocado `scoring.js` ni las reglas de puntuación.
- [ ] No se han tocado los endpoints `savePrediction`, `getUserPredictions`, `adminSaveResults` (fuera de alcance).
- [ ] Comparar tiempos localhost vs GitHub Pages tras el cambio (Fase 1 como baseline, repetir tras Fase 2 y Fase 4).

---

## 9. Riesgos identificados

- **Datos estáticos desactualizados en Home**: si se mantiene una lista local de meses/orden como fallback, puede desincronizarse de `Months` en Sheets si el admin añade/cambia meses sin actualizar el frontend. Mitigación: los datos estáticos son solo el *esqueleto visual* (para no bloquear pintado); en cuanto llega `bootstrapLight`, siempre gana el dato real.
- **Apuestas se abre antes de `coreLoaded`**: ya mitigado hoy — `bettingView`/`statusView`/`adminView` comprueban `state.coreLoaded`/`coreLoading` (confirmado en `app.js:37` que re-renderiza esas vistas al llegar `bootstrapLight`).
- **El mes activo mostrado en cajitas estáticas no coincide con el real** hasta que llega `bootstrapLight`: mitigar mostrando el badge de estado como "cargando…" en vez de asumir "Abierta" por defecto.
- **Duplicar datos entre `staticDescriptions.js` y Sheets**: ya existe hoy (la descripción de partidos es manual y separada del calendario real en `Matches`) — es un riesgo aceptado y preexistente, no introducido por este plan.
- **Dynamic imports rompen navegación**: mitigar con pruebas de todas las pestañas tras el cambio, especialmente flujos donde `homeView.js` llama a `navigateTo('betting')` mediante el botón "Apostar" de una cajita.
- **Cache (backend) sirve datos viejos tras una acción admin** (p. ej. tras `adminSaveResults` o `adminSetMonthStatus`): si se implementa Fase 5, es imprescindible invalidar la caché en esas escrituras.

---

## 10. Prompt recomendado para la siguiente fase de implementación

```text
Implementa la Fase 2 del plan de docs/startup_performance_audit.md:

Contexto: homeView.js actualmente bloquea el render de las cajitas de mes 
detrás de `state.coreLoaded` (ver homeView.js línea 8), lo que contradice 
el diseño ya documentado en roadmap.md (V2.6 "Inicio estático instantáneo" 
y V2.12) donde Home debía pintar instantáneamente sin esperar a bootstrapLight.

Tarea:
1. Modifica src/views/homeView.js para que el esqueleto de las cajitas 
   (título del mes, badge de estado, botones INFO/Apostar) se pinte 
   inmediatamente sin depender de state.coreLoaded, usando una fuente 
   de datos local mínima para la lista de meses (decide si reutilizar 
   staticDescriptions.js o crear un nuevo src/data/staticSeason.js).
2. Los contadores dinámicos (matches_count, submitted_count, totalCount) 
   deben mostrarse como placeholder ("···" o "-") hasta que bootstrapLight 
   responda, y actualizarse in situ sin duplicar tarjetas ni parpadear, 
   reutilizando el mecanismo de re-render que ya usa app.js tras 
   loadBootstrapLight().
3. NO toques src/scoring.js, apps-script/Code.gs, ni los endpoints de 
   guardado (savePrediction, adminSaveResults, etc.).
4. Actualiza roadmap.md añadiendo una entrada de versión que documente 
   la corrección de esta regresión respecto a V2.6/V2.12.
5. Verifica manualmente con Network throttling que las cajitas aparecen 
   antes de que responda bootstrapLight.
```
