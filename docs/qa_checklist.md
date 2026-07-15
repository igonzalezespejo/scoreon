# QA Checklist - Porra Mensual MVP

Este documento detalla las validaciones End-to-End realizadas sobre el frontend conectado al backend de producción (Google Apps Script) para garantizar la solidez de la aplicación antes de su publicación en GitHub Pages.

## Entorno de Pruebas
- **Modo:** `USE_MOCK = false` (Conexión Real)
- **API_URL:** Configurado hacia Apps Script.
- **Usuario de prueba:** `juan`
- **PIN:** `1234`
- **Mes activo:** `2026-09`

## 1. Configuración de Entorno
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| `src/config.js` usa `USE_MOCK = false` | ✅ OK | |
| `src/config.js` tiene `API_URL` real | ✅ OK | |
| `src/config.example.js` usa placeholders | ✅ OK | No se exponen datos reales. |
| Scripts `test-*` en Node.js saneados | ✅ OK | Usan `process.env` para secretos. |
| Ejecución exitosa de `npm test` | ✅ OK | 18 tests (scoring/validation) pasando. |

## 2. Inicialización y Carga de Datos (Frontend)
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| Carga inicial de datos desde Apps Script | ✅ OK | |
| Selectores de Participantes poblados | ✅ OK | Solo se muestran usuarios con `active: true`. |
| Listado de partidos (mes `2026-09`) | ✅ OK | |
| Vista "Home" muestra título del mes activo | ✅ OK | |
| Vista "Estado" (Status) renderiza sin errores | ✅ OK | |
| Vista "Ranking" renderiza sin errores | ✅ OK | |

## 3. Flujo de Apuesta y Persistencia
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| UI muestra campos de goles y botón de guardado | ✅ OK | |
| UI muestra campo para PIN (`pin_enabled: true`) | ✅ OK | Integrado en `bettingView.js`. |
| Enviar apuesta con datos y PIN correctos | ✅ OK | |
| Notificación (Toast) de éxito mostrada | ✅ OK | Muestra "¡Apuesta guardada correctamente!". |
| App recarga el estado del servidor silenciosamente | ✅ OK | La vista actualiza y bloquea el form con badge verde. |
| La apuesta persiste tras recargar (F5) | ✅ OK | El backend devuelve status "submitted" en bootstrap. |
| Impacto real en Google Sheets | ✅ OK | `Predictions_Current` y `Predictions_Log` actualizados. |

## 4. Validación y Manejo de Errores (UI + Backend)
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| Enviar PIN incorrecto | ✅ OK | Backend rechaza, Toast muestra error claro y form no se bloquea. |
| Enviar Goles negativos o inválidos | ✅ OK | Evitado por `<input min="0">` en frontend y rechazado en backend si se evade. |
| Seleccionar sin participante | ✅ OK | El select principal deshabilita la vista de formulario. |
| Campo PIN vacío | ✅ OK | Interceptado por `required` en HTML. |

## 5. Bloqueo de Mes y Usabilidad
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| Responsive Design / Móvil | ✅ OK | Flexbox y layout adaptable aseguran legibilidad en pantallas pequeñas. |
| Seguridad Práctica | ✅ OK | No dependencias externas inseguras. Secretos fuera de código rastreable. |
| Interfaz en mes cerrado o pasado `lock_at` | ⚠️ Pendiente | Verificación visual de inputs deshabilitados dependiente del estado del mes. (Probado a nivel backend, pendiente a nivel frontend forzando cierre de mes). |

## 6. Resumen de Bugs
- **Bugs encontrados en QA E2E:** 
  - (Corregido en integración) El frontend no enviaba `pin` ni `month_id` en el POST real.
  - (Corregido en integración) Apps Script requería cabecera `text/plain` para sortear restricciones de preflight en CORS.
  - (Corregido en testing local) `app.js` fallaba al inicio con un `TypeError: Cannot read properties of null (reading 'content')` porque los `<template id="loading-template">` y `<error-template>` no existían en `index.html`. Se han añadido correctamente.
  - (Nota) Error `404 favicon.ico` en consola es inofensivo y esperado al no existir dicho archivo aún.
- **Bugs pendientes:** Ninguno crítico que bloquee el MVP.

## 7. Smoke Test de Producción (Validación Final)
La app ha sido publicada en: `https://igonzalezespejo.github.io/porra-mensual/`

| Acción | Resultado | Notas |
|--------|-----------|-------|
| Abrir `https://igonzalezespejo.github.io/porra-mensual/` | Carga `index.html` sin errores 404 de scripts/css | ✅ OK |
| Verificar llamadas de red (Network) | La app hace GET a la URL de Apps Script real | ✅ OK |
| Mostrar datos reales | Aparecen participantes, partidos y estado "open" | ✅ OK |
| Persistencia tras apuesta con usuario autorizado | ✅ OK | Validado manualmente por el administrador. |
| Actualización del estado (Status view) | ✅ OK | El estado cambia correctamente tras confirmación de guardado. |

### Prueba de Bloqueo
**Resultado**: ✅ OK
- Validado manualmente por el administrador cambiando temporalmente el mes a `locked` y restaurándolo después. Los inputs quedan deshabilitados y el backend rechaza intentos de apuesta.

### Validación Multiusuario
**Resultado**: ✅ OK
- Probado con otros usuarios; las apuestas se guardan correctamente de forma concurrente en Google Sheets.

## Recomendación Final
**LISTO PARA DESPLIEGUE EN GITHUB PAGES.**

La arquitectura híbrida (GitHub Pages + Apps Script + Sheets) ha demostrado ser robusta y estable para el flujo básico. La validación en servidor es hermética contra manipulación cliente, y la UI ofrece retroalimentación adecuada a los usuarios en todas las ramificaciones.

## 8. QA Checklist V2.1 (Alta de Participantes)
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| UI muestra botón "Crear participante" | ✅ OK | |
| Formulario requiere nombre visible (mín. 2 chars) | ✅ OK | |
| Formulario requiere código si está configurado | ✅ OK | |
| Error al enviar código incorrecto | ✅ OK | Backend devuelve error VALIDATION_ERROR. |
| Error al usar nombre duplicado (ignorando min/mayus) | ✅ OK | |
| Generación exitosa de slug (`user_id`) y PIN | ✅ OK | Backend devuelve slug único y PIN aleatorio. |
| Fila creada en `Participants` con status activo | ✅ OK | |
| Toast/Alert muestra PIN autogenerado | ✅ OK | |
| Tras el registro, el selector marca al nuevo usuario | ✅ OK | |
| Posibilidad de apostar con el nuevo usuario y PIN | ✅ OK | |

## 9. QA Checklist V2.2 (Consulta y Edición de Apuestas)
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| UI muestra botón "Cargar apuesta" con input de PIN | Pendiente | Tras seleccionar usuario. |
| Backend valida PIN antes de devolver apuestas (getUserPredictions) | Pendiente | |
| Inputs se rellenan con apuesta existente | Pendiente | |
| Badges muestran estado Completa/Parcial/Pendiente por usuario | Pendiente | |
| Badges muestran estado Guardado/Pendiente por partido | Pendiente | |
| Guardar apuesta parcial no borra otras apuestas en backend | Pendiente | |
| Guardar solo envía partidos con ambos goles | Pendiente | |
| Mes cerrado impide edición pero permite consulta | Pendiente | |

## 10. QA Checklist V2.3 (Recálculo Robusto de Ranking y Scoring Test Mode)
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| Instalar trigger de ranking (Porra Admin) | Pendiente | Requiere validación de permisos en Apps Script. |
| Cambiar goles en `Results` lanza Toast verde | Pendiente | Debe disparar `handleRankingEdit`. |
| Cambiar goles actualiza `Ranking_Monthly` y `Global` | Pendiente | Validar visualmente cambios | Pendiente | Tras hacer deploy. |
| Corregir posibles desajustes en flexbox o márgenes | Pendiente | Tras testear en resolución 375px. |

## 15. QA Checklist V2.9 (Email y PIN con Ceros)
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| Registro sin email falla | Pendiente | Debería ser rechazado en backend o frontend. |
| Registro con email inválido falla | Pendiente | Formato erróneo rechazado. |
| Registro con email válido crea participante | Pendiente | Se añade a Sheets correctamente. |
| Email duplicado falla | Pendiente | No permite registrarse si ya existe en `Participants`. |
| Nombre duplicado falla | Pendiente | Regla original sigue funcionando. |
| PIN generado tiene longitud `pin_length` | Pendiente | Debe tener longitud exacta y rellenar con ceros si es necesario. |
| PIN con cero inicial se conserva en Google Sheets | Pendiente | Se guarda como texto y visualmente mantiene el `0` inicial (ej. `0838`). |
| `bootstrapLight` no devuelve email | Pendiente | Al cargar la página, el objeto `participants` no tiene propiedad `email`. |
| `bootstrapLight` no devuelve pin | Pendiente | El pin debe estar oculto. |
| Usuario nuevo puede apostar con su PIN | Pendiente | El flujo de apuesta para los nuevos funciona. |
| Usuarios antiguos sin email siguen funcionando | Pendiente | Pueden cargar predicciones y apostar. |
| Fallback: Poner `ranking_dirty=true` fuerza recálculo | Pendiente | Al hacer F5 en la web, se auto-limpia a `false`. |
| Diagnóstico de scoring partido activo | Pendiente | Muestra los cálculos por consola/alert correctamente. |
| Validar Test Mode (m001=5-0) | Pendiente | Angel: 15, Juan: 5, test: 5, Israel: 0. |

## 11. QA Checklist V2.4 (Optimización de Tiempos de Carga)
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| `testing_force_recalc_on_bootstrap=true` recalcula siempre | Pendiente | `debug.ranking_recalculated` debe ser `true`. |
| `testing_force_recalc_on_bootstrap=false` carga rápido | Pendiente | No recalcula, devuelve cache. |
| `ranking_dirty=true` fuerza recálculo 1 vez | Pendiente | Luego lo deja en `false`. |
| `getUserPredictions` no lee ranking ni recalcula | Pendiente | Tiempo muy bajo en `debug.timings.total_ms`. |
| `savePrediction` no bloquea recálculo | Pendiente | Con `recalculate_after_prediction=false`. |

## 12. QA Checklist V2.5 (Carga Progresiva)
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| Carga inicial rápida con `bootstrapLight` | Pendiente | Inicio debe pintarse antes de que llegue el ranking. |
| Ranking carga en segundo plano | Pendiente | Network muestra request `action=rankings` posterior a `action=bootstrapLight`. |
| Vista Apuestas funciona antes de ranking | Pendiente | Se puede entrar y ver dropdown de usuarios de inmediato. |
| Vista Estado funciona antes de ranking | Pendiente | Se puede entrar y ver listado de status de inmediato. |
| Ranking muestra "Cargando ranking..." si entramos rápido | Pendiente |  |
| Guardar apuesta usa carga ligera para refrescar | Pendiente | No debe bloquear interfaz esperando recálculo global. |
| App no se rompe si `action=rankings` falla | Pendiente | Debería mostrar un mensaje de error suave en la pestaña Ranking. |

## 13. QA Checklist V2.6 (Inicio Estático Instantáneo)
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| Carga inicial instantánea | Pendiente | Inicio debe renderizarse inmediatamente, con `bootstrapLight` en background. |
| Loading en Apuestas si datos no han llegado | Pendiente | Pulsar Apuestas rápido debe mostrar "Cargando datos de la porra...". |
| Loading en Estado si datos no han llegado | Pendiente | Pulsar Estado rápido debe mostrar "Cargando estado de apuestas...". |
| Auto-refresco al recibir datos | Pendiente | Las vistas Apuestas y Estado deben pintarse automáticamente cuando acabe `bootstrapLight` si el usuario está en ellas. |
| Fallo en `bootstrapLight` no rompe Inicio | Pendiente | Si falla la red, Inicio sigue visible y Apuestas/Estado muestran error suave con botón de reintento. |

## 14. QA Checklist V2.7 (Títulos Dinámicos y Formateo)
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| Título del mes en Inicio no es ISO ni hardcodeado | Pendiente | Debe mostrar e.g. "AGOSTO 2026". |
| Título del mes en Apuestas no es ISO | Pendiente | Debe mostrar "Participar en Agosto 2026". |
| Título del mes en Estado no es ISO | Pendiente | Debe mostrar "Resumen de participación para Agosto 2026". |
| Título del mes en Ranking no es ISO | Pendiente | Debe mostrar "Ranking Mensual (Agosto 2026)". |
| Fecha límite en Inicio (lock_at) parseada | Pendiente | Ej. "31 jul 23:59". No debe mostrar ISO. |

## 15. QA Checklist V2.8 (Panel Admin Funcional)
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| UI bloqueada si no hay token | Pendiente | Vista muestra input de "Código admin" y bloquea funcionalidades admin. |
| Iniciar sesión con token inválido rechaza | Pendiente | Frontend recibe error 401 y muestra alerta, no avanza. |
| Iniciar sesión con token válido permite acceso | Pendiente | Carga y muestra meses disponibles en un selector. |
| Selector de mes carga partidos del mes elegido | Pendiente | Muestra los partidos correctos tras llamar a `adminGetMonthMatches`. |
| Cambiar status a "locked" funciona y persiste | Pendiente | Usar el botón de cerrar mes envía `adminSetMonthStatus`, y mes se cierra para todos los usuarios. |
| Guardar resultado con "final" y goles | Pendiente | Hace upsert en hoja `Results`, actualiza estado del resultado en UI. |
| Guardar resultado "final" recalcula ranking | Pendiente | Las posiciones en `Ranking_Monthly` cambian según el nuevo resultado insertado. |
| Partidos con status "cancelled" no puntúan | Pendiente | Aunque tengan goles en backend, al guardar con status `cancelled` los puntos dados son 0. |
| Dejar goles en blanco envía "pending" | Pendiente | Se guarda como pending, no se evalúa. |
| Uso exclusivo de llamadas `POST` para admin | Pendiente | Comprobar en Network que el token nunca viaja en URL con `GET`. |

## 16. QA Checklist V2.9 (Email y PIN con Ceros)
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| Registro sin email falla | Pendiente | Debería ser rechazado en backend o frontend. |
| Registro con email inválido falla | Pendiente | Formato erróneo rechazado. |
| Registro con email válido crea participante | Pendiente | Se añade a Sheets correctamente. |
| Email duplicado falla | Pendiente | No permite registrarse si ya existe en `Participants`. |
| Nombre duplicado falla | Pendiente | Regla original sigue funcionando. |
| PIN generado tiene longitud `pin_length` | Pendiente | Debe tener longitud exacta y rellenar con ceros si es necesario. |
| PIN con cero inicial se conserva en Google Sheets | Pendiente | Se guarda como texto y visualmente mantiene el `0` inicial (ej. `0838`). |
| `bootstrapLight` no devuelve email | Pendiente | Al cargar la página, el objeto `participants` no tiene propiedad `email`. |
| `bootstrapLight` no devuelve pin | Pendiente | El pin debe estar oculto. |
| Usuario nuevo puede apostar con su PIN | Pendiente | El flujo de apuesta para los nuevos funciona. |
| Usuarios antiguos sin email siguen funcionando | Pendiente | Pueden cargar predicciones y apostar. |

## 17. QA Checklist V2.10 (Resultado Real y Ranking por Semanas)
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| `bootstrapLight` devuelve array `results` | Pendiente | Solo los resultados del mes activo. |
| Apuestas muestra "Resultado real" | Pendiente | Formato `X - Y` o `- -` si no hay. |
| Apuestas muestra badge Final/Cancelado | Pendiente | Depende de `status` en Google Sheets. |
| Resultado real es de solo lectura | Pendiente | El usuario no puede modificar el marcador real desde su vista de apuesta. |
| Ranking Mensual muestra columnas S1 a S4 | Pendiente | Las cabeceras y celdas deben reflejar S1, S2, S3, S4. |
| Ranking Mensual no muestra Exactos/Signos | Pendiente | Columna eliminada visualmente de la tabla mensual. |
| `TOTAL` coincide con suma S1+S2+S3+S4 | Pendiente | Si todos los partidos se puntúan y caen en semanas 1-4. |
| Partidos sin `week_no` usan `display_order` | Pendiente | Backend calcula `Math.ceil(display_order / 6)`. |
| Partidos con `week_no` usan su semana | Pendiente | El backend lee `week_no` y lo respeta. |
| Modificar resultados recalcula S1-S4 | Pendiente | Al guardar resultados desde Admin o editar en Sheets, se actualizan las columnas `sX_points`. |
| Alertas por falta de columnas S1-S4 | Pendiente | Backend en Code.gs lanza error claro si la pestaña Ranking_Monthly no tiene las cabeceras nuevas. |

## 18. QA Checklist V2.11 & V2.12 (Multi-mes)
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| Home no muestra bloque de stats globales | Pendiente | Se han eliminado los stats globales del layout superior. |
| Home muestra grid de cards de meses | Pendiente | Una card por cada mes en `state.months`. |
| Botón APOSTAR carga datos y navega | Pendiente | El botón de la card asigna `selectedMonthId`, carga `monthData` si hace falta y navega a `bettingView`. |
| Botón INFO despliega partidos | Pendiente | Muestra la lista de partidos agrupados; carga de caché o hace un fetch lazy load. |
| Carga progresiva mantenida | Pendiente | Inicio carga instantáneamente sin esperar datos de meses no activos. |
| Apuestas muestra dropdown de meses | Pendiente | Se puede cambiar de mes sin salir de la vista. |
| Ranking muestra dropdown de meses | Pendiente | Se puede cambiar el mes evaluado en Ranking Mensual. |
| Estado muestra dropdown de meses | Pendiente | El resumen de apuestas (Status) filtra por mes elegido. |
| Compatibilidad legacy | Pendiente | Apuestas legacy mantienen `month_id` implícito; el sistema permite migración manual diagnosticable en Admin. |

## 19. QA Checklist V2.12.1 (Corrección Home instantánea multi-mes)
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| Home muestra las cards de meses antes de que responda `bootstrapLight` | Pendiente | Usar Network throttling ("Slow 3G") o simular Apps Script lento; las cards deben aparecer inmediatamente con `staticSeason`, sin el texto "Cargando la temporada..." bloqueando toda la vista. |
| Badges de las cards muestran "Cargando..." mientras `state.coreLoaded=false` | Pendiente | Se sustituyen por el badge real (Abierta/Cerrada/Puntuada/Archivada) al llegar `bootstrapLight`. |
| Contadores (partidos/apuestas/participantes) muestran "···" antes de `bootstrapLight` | Pendiente | Se rellenan con los valores reales sin parpadeo brusco tras la respuesta. |
| No se duplica ninguna card al re-renderizar Home tras `bootstrapLight` | Pendiente | Debe seguir habiendo una sola card por `month_id` (mezcla de `staticSeason` + `state.months` sin repetir). |
| Un mes presente en `staticSeason` pero ausente en `state.months` se muestra como "Configuración pendiente" | Pendiente | No debe romper el render ni bloquear el resto de cards. |
| Botón INFO funciona antes de `coreLoaded` | Pendiente | Muestra la descripción estática (si existe) + "Cargando datos del mes..." sin intentar `loadMonthData` todavía. |
| Botón INFO funciona después de `coreLoaded` | Pendiente | Comportamiento igual al actual: usa caché de `monthDataById`/`state.matches` o hace fetch lazy con `loadMonthData`. |
| Botón APOSTAR funciona antes y después de `coreLoaded` | Pendiente | Asigna `selectedMonthId` y navega a Apuestas; Apuestas muestra su propio loading si los datos aún no han llegado. |
| `npm test` sigue en verde | Pendiente | Sin relación funcional con este cambio, pero confirma que no se rompió nada compartido. |

## 20. QA Checklist V2.12.2 (Cambio de mes no bloqueante en Apuestas/Ranking/Estado)
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| Cambiar de mes en Ranking es instantáneo | ✅ OK (verificado en navegador) | No dispara ninguna llamada `action=monthData`; solo filtra `state.rankingMonthly` por `month_id` en cliente. |
| Cambiar de mes en Apuestas no bloquea el selector de participante | ✅ OK (verificado en navegador) | El `<select>` de mes nunca se deshabilita; título, selector de participante y "Crear participante" se repintan al instante. |
| Cambiar de mes en Estado no bloquea el `<select>` de mes | ✅ OK (verificado en navegador) | La tabla muestra "Cargando resumen de participación de este mes..." acotado mientras el selector sigue interactivo. |
| Estado se hidrata con datos reales tras cargar en segundo plano | ✅ OK (verificado en navegador) | Contadores Completas/Parciales/Faltan y tabla de participantes pasan de "Cargando..." a valores reales. |
| Apuestas no muestra el badge de estado de un mes distinto tras cambiar de mes | ✅ OK (revisado en código) | Si `state.monthDataById[selectedMonthId]` no está cacheado, se muestra "Comprobando estado..." en vez de datos del mes anterior. |
| Apuestas resuelve los datos del mes al introducir el PIN aunque la precarga en segundo plano no haya terminado | ✅ OK (revisado en código) | El submit del formulario de PIN comprueba `state.monthDataById[monthId]` y llama a `loadMonthData` de forma síncrona si hace falta, antes de pedir las predicciones. |
| Cambiar de mes en una vista y navegar directamente a otra por el menú superior no dejaba la vista de destino "colgada" | ✅ OK (bug encontrado y corregido en esta misma sesión) | Reproducido cambiando el mes en Ranking y pulsando "Estado": antes se quedaba en "Cargando..." indefinidamente porque el fetch solo se disparaba en el evento `change` del propio selector; ahora `mount()` también dispara la carga si el mes seleccionado no está en caché. |
| PIN incorrecto en Apuestas tras cambiar de mes no rompe la vista | ✅ OK (verificado en navegador) | Muestra el error y reactiva el botón "Cargar apuesta" con normalidad. |
| No se ha tocado `apps-script/Code.gs` ni `src/scoring.js` | ✅ OK | Confirmado por `git status`/`git diff`. |

## 21. QA Checklist V2.12.3 (Revalidación de datos de mes)
| Prueba | Resultado | Notas |
|--------|-----------|-------|
| Entrar en Estado sin recargar la página muestra el estado real de participación | ✅ OK (verificado en navegador, con datos reales de producción) | Reproducido el bug reportado por el usuario: un participante había apostado y Estado seguía mostrando "Pendiente" porque el mes ya estaba cacheado desde la carga inicial. Ahora cada entrada a Estado vuelve a pedir `action=monthData`. |
| Entrar/salir/reentrar repetidamente en Estado no genera peticiones en bucle | ✅ OK (verificado en navegador, instrumentando `window.fetch`) | Exactamente 1 petición de red por cada entrada a la vista; sin crecimiento descontrolado. |
| Datos previos se muestran al instante mientras se revalida en segundo plano | ✅ OK (revisado en código) | `statusView.render()` pinta la última foto cacheada de inmediato; `repaint()` la sustituye en cuanto llega la respuesta fresca, sin pantalla de carga intermedia si ya había algo que mostrar. |
| Un fallo de red al revalidar con datos ya cacheados no borra la tabla | ✅ OK (revisado en código) | Si la petición falla pero ya había una foto cacheada, se mantiene visible en vez de sustituirla por el estado de error. |
| Apuestas revalida el badge de estado y el listado de partidos en cada entrada/cambio de mes | ✅ OK (revisado en código) | `prefetchMonthData` y el submit del PIN ya no comprueban caché antes de pedir `action=monthData`; siempre refrescan. |
| `npm test` sigue en verde | ✅ OK | 19/19 tests. |
