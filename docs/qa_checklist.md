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

## Recomendación Final
**LISTO PARA DESPLIEGUE EN GITHUB PAGES.**

La arquitectura híbrida (GitHub Pages + Apps Script + Sheets) ha demostrado ser robusta y estable para el flujo básico. La validación en servidor es hermética contra manipulación cliente, y la UI ofrece retroalimentación adecuada a los usuarios en todas las ramificaciones.
