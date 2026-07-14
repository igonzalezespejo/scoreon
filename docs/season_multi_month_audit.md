# Auditoría: Multi-mes y Temporada Completa

Este documento detalla el análisis y el plan de migración para convertir la aplicación Porra Mensual en un sistema que soporte toda una temporada con múltiples meses, permitiendo a los usuarios navegar, consultar y apostar en diferentes meses sin perder el historial.

## 1. Resumen Ejecutivo
Actualmente, el sistema está fuertemente acoplado a un único `active_month_id` que se define en la configuración global. Aunque algunas entidades (como `Matches` y el Admin panel) ya consideran el `month_id`, gran parte de la experiencia de usuario y endpoints (como `bootstrapLight`) asumen que solo existe un mes activo. Para soportar una temporada completa, es necesario transformar el concepto de "mes activo único" a un "mes seleccionado por defecto", cargar la lista de todos los meses disponibles para la navegación, y endurecer el esquema de base de datos para evitar colisiones de IDs entre meses.

## 2. Estado Actual

### ¿Dónde se asume que solo hay un activeMonth?
- **Backend (`Code.gs`)**: La función `actionBootstrap` y `actionBootstrapLight` leen `config.active_month_id`, filtran los partidos (`activeMatches = matches.filter(m => m.month_id === activeMonthId)`) y basan el resumen de predicciones (`predictionsSummary`) únicamente en ese mes.
- **Frontend (`state.js`)**: El estado guarda un único `state.activeMonth`.
- **Vistas**: 
  - `homeView.js`: Muestra información basada en `state.activeMonth`.
  - `bettingView.js`: Usa `state.activeMonth` para saber qué título mostrar, qué partidos renderizar y qué apuestas cargar/guardar.
  - `rankingView.js` y `statusView.js`: Muestran el título y datos basados en `state.activeMonth`.

### ¿Qué endpoints devuelven solo el mes activo?
- `bootstrap` y `bootstrapLight` devuelven `activeMonth`, `matches` (filtrados al mes activo) y `predictionsSummary` (del mes activo).

### ¿Qué endpoints ya soportan month_id?
- `getUserPredictions`, `savePrediction`, `adminGetMonthMatches`, `adminSaveResults`, `adminSetMonthStatus`.

### ¿Qué hace Admin actualmente bien para multi-mes?
- `adminView.js` ya dispone de un selector de meses. Utiliza `adminGetMonths` para listar los meses y `adminGetMonthMatches` para cargar los partidos específicos de ese mes, logrando aislar la vista de administración por mes.

### Problemas detectados
- Si un usuario quiere ver las apuestas del mes pasado o el ranking de otro mes, no puede hacerlo a menos que el admin cambie globalmente el `active_month_id`, afectando a todos los usuarios.
- El resumen de estado (`predictionsSummary`) solo muestra información de un mes.
- `Predictions_Current` y `Results` no guardan la referencia al `month_id`, dependiendo enteramente de la unicidad del `match_id`.

## 3. Modelo de Datos Propuesto y Riesgos

### El problema del `match_id`
Actualmente, `Predictions_Current` y `Results` no tienen una columna `month_id`. Solo tienen `match_id`.
**Riesgo:** Si en agosto tenemos `m001` y en septiembre también usamos `m001`, los resultados y apuestas se sobrescribirán de forma cruzada provocando corrupción de datos.

### Decisión Recomendada
**Opción C (Ambas): Añadir `month_id` y exigir `match_id` global único.**
1. Actualizar el esquema de `Predictions_Current` y `Results` para incluir la columna `month_id`. Esto robustece el sistema y permite consultas filtradas más eficientes en el backend (por ejemplo, buscar resultados de un mes sin tener que hacer un JOIN lógico con la pestaña de Matches).
2. Adoptar una convención de `match_id` único por temporada (ej: `2026-08-m001`). Esto previene cualquier error humano en Sheets.

## 4. Endpoints Propuestos

En lugar de crear endpoints excesivamente granulados, se propone adaptar el flujo actual:

- **`bootstrapLight`**: Modificar para que devuelva un array `months` con todos los meses visibles/activos (ej. status no sea `draft`). Debe seguir devolviendo `config.active_month_id` para saber cuál seleccionar por defecto.
- **`monthData` (NUEVO)**: Un endpoint que dado un `month_id` devuelve: `matches`, `results` y `predictionsSummary` de ese mes en particular. Esto aligera la carga inicial.
- **`rankings`**: Modificar para que `rankingMonthly` agrupe o devuelva la información de rankings de todos los meses de la temporada, o crear un `rankingsByMonth` específico.
- **`getUserPredictions` y `savePrediction`**: Mantener como están, ya obligan a pasar `month_id`.
- **Admin Endpoints**: Mantener como están.

## 5. Cambios Frontend Propuestos

- **`state.js`**:
  - `state.months = []` (lista de todos los meses).
  - `state.selectedMonthId = null` (por defecto, el `active_month_id` de la configuración global).
  - Los datos que dependen del mes (partidos, apuestas resumen, ranking mensual) se deberían almacenar bajo el `selectedMonthId` o solicitarse al cambiar de mes.
- **`homeView.js`**:
  - Cambiar a un diseño de tarjetas (Cards) por cada mes disponible en `state.months`.
  - Al hacer click en una tarjeta, se actualiza `state.selectedMonthId` y navega a Apuestas o Ranking de ese mes.
- **`bettingView.js` / `statusView.js` / `rankingView.js`**:
  - Incluir un componente selector de mes (dropdown o tabs) en la parte superior.
  - Al cambiar de mes, pedir los datos correspondientes si no están cacheados, y re-renderizar.
  - Reglas de lectura/escritura en `bettingView`: Si `status === 'open'` y `serverTime < lock_at`, permitir editar. Si `status === 'locked' | 'scored' | 'archived'`, interfaz de solo lectura (cargar apuestas previas).

## 6. Ranking

- **Mensual**: `Ranking_Monthly` ya contiene la columna `month_id`. El backend calcula correctamente el mes activo. Deberá calcular el ranking de todos los meses no archivados.
- **Global**: `Ranking_Global` ya suma los puntos usando `matchToMonth`. Solo hay que asegurar que al recalcular, se carguen los partidos y resultados de toda la temporada (o de meses no archivados) para sumar correctamente.

## 7. Plan de Migración

- **Fase 1: Auditoría y Documentación.** (Completada en este documento).
- **Fase 2: Actualizar Schema en Sheets.** 
  - Añadir columna `month_id` a `Predictions_Current` y `Results`.
  - Migrar los datos existentes: asegurar que los `match_id` sigan un patrón global (ej: `2608-m01`) para evitar colisiones futuras.
- **Fase 3: Actualizar Backend (`Code.gs`).**
  - Modificar las funciones de guardado para incluir `month_id` en `Predictions_Current` y `Results`.
  - Adaptar `bootstrapLight` para devolver la lista de meses.
  - Crear endpoint `monthData`.
  - Ajustar el recálculo dinámico de ranking para iterar y persistir múltiples meses.
- **Fase 4: Adaptar Frontend.**
  - Modificar `state.js` y `api.js`.
  - Implementar tarjetas en Home.
  - Implementar selector de meses en el resto de vistas.
- **Fase 5: QA y Testing.**
  - Simular dos meses simultáneos (uno bloqueado, uno abierto).
  - Verificar que las apuestas de un mes no afectan a otro.
- **Fase 6: Limpieza.**

## 8. QA Propuesta
1. Crear dos meses (Agosto y Septiembre). Agosto cerrado, Septiembre abierto.
2. Verificar que en Home salen dos tarjetas.
3. Al entrar en Agosto, ver apuestas como solo lectura.
4. Al entrar en Septiembre, poder guardar apuestas.
5. Ver ranking mensual de Agosto y Septiembre cambiando el selector.
6. Ver ranking global acumulando ambos.

## 9. Prompt Recomendado para Fase 1 de Implementación
```text
Inicia la Fase 2 y 3 del plan de migración multi-mes:
1. Actualiza `docs/sheet_schema.md` añadiendo la columna `month_id` a `Predictions_Current` y `Results`.
2. Modifica `apps-script/Code.gs` para:
   - Que `bootstrapLight` devuelva el array completo de `Months` en lugar de solo `activeMonth`.
   - Que las funciones `scorePrediction`, `buildMonthlyRanking` y `buildGlobalRanking` soporten un modelo donde `Results` y `Predictions_Current` tienen `month_id` incorporado.
   - Modifica `actionSavePrediction` y `actionAdminSaveResults` para que persistan el `month_id` explícitamente.
```
