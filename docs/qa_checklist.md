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
| Cambiar goles actualiza `Ranking_Monthly` y `Global` | Pendiente | Validable visualmente en Sheets. |
| Ranking se actualiza en web tras F5 | Pendiente | Probar tras el paso anterior. |
| Fallback: Poner `ranking_dirty=true` fuerza recálculo | Pendiente | Al hacer F5 en la web, se auto-limpia a `false`. |
| Diagnóstico de scoring partido activo | Pendiente | Muestra los cálculos por consola/alert correctamente. |
| Validar Test Mode (m001=5-0) | Pendiente | Angel: 15, Juan: 5, test: 5, Israel: 0. |
