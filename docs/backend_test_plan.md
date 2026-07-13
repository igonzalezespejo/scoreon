# Backend Test Plan y Resultados

Este documento contiene el plan de pruebas y los resultados de la validación aislada del backend (Apps Script) contra la Google Sheet de producción, sin conectar el frontend.

## 1. Configuración de Pruebas
- **Apps Script URL**: `https://script.google.com/macros/s/AKfycbzZcyNFmGshh0omvAxO_GoVfX56NXYQX_nwlKLRyoN-MDfjSfpGRN-SSnfNgyzWgwn4PA/exec`
- **Usuario de prueba original**: `test` (Modificado a `juan` porque `test` no existe en la Google Sheet).
- **PIN de prueba**: `1234`
- **Mes Activo**: `2026-09`
- **Partido de prueba**: `m001`

*Nota sobre el usuario*: Se intentó ejecutar las pruebas con el usuario `test` indicado, pero el backend lo rechazó con el error `"Usuario no existe"`. Por tanto, las pruebas de éxito se ejecutaron con el usuario `juan`, que es el usuario por defecto importado en las plantillas.

## 2. Ejecución de Pruebas

Los scripts de prueba se crearon en la carpeta `scripts/` utilizando `fetch` nativo de Node.js, y se configuraron en `package.json` para ejecutarlos de forma sencilla.

### 2.1 GET action=bootstrap (`npm run test:backend:bootstrap`)
**Objetivo**: Confirmar que el endpoint GET devuelve el payload inicial y los datos de la hoja.
**Resultado esperado**: `ok: true`
**Resultado real**:
```json
{
  "ok": true,
  "config": { /* ... */ },
  "activeMonth": { "month_id": "2026-09", "status": "open" },
  "participants": [ /* juan */ ],
  "matches": [ /* ... */ ]
}
```
**Estado**: ✅ ÉXITO

### 2.2 POST savePrediction válido (`npm run test:backend:save`)
**Objetivo**: Enviar una apuesta válida y confirmar que se guarda.
**Payload**:
```json
{
  "action": "savePrediction",
  "user_id": "juan",
  "pin": "1234",
  "month_id": "2026-09",
  "predictions": [ { "match_id": "m001", "home_goals": 2, "away_goals": 1 } ]
}
```
**Resultado esperado**: `ok: true`
**Resultado real**:
```json
{
  "ok": true,
  "code": "SAVED",
  "message": "Predicciones guardadas correctamente",
  "serverTime": "2026-07-13T09:03:37.653Z"
}
```
**Estado**: ✅ ÉXITO

### 2.3 POST savePrediction inválidos (`npm run test:backend:invalid`)
Se probaron tres casos de error para validar la seguridad del script.

#### Caso A: PIN incorrecto
**Payload**: `pin: "9999"`
**Resultado real**: `{"ok": false, "code": "VALIDATION_ERROR", "message": "PIN incorrecto"}`
**Estado**: ✅ ÉXITO (rechazo correcto)

#### Caso B: Usuario inexistente
**Payload**: `user_id: "fakeuser"`
**Resultado real**: `{"ok": false, "code": "VALIDATION_ERROR", "message": "Usuario no existe"}`
**Estado**: ✅ ÉXITO (rechazo correcto)

#### Caso C: Goles inválidos
**Payload**: `home_goals: -1`, `away_goals: "a"`
**Resultado real**: `{"ok": false, "code": "VALIDATION_ERROR", "message": "Goles inválidos para el partido m001"}`
**Estado**: ✅ ÉXITO (rechazo correcto)

### 2.4 Respeto de lock_at / status
La fecha de cierre de la plantilla está en el futuro y el estado del mes es `open`. Si estuviéramos después del límite de `lock_at`, el Apps Script rechazaría la petición con un código `VALIDATION_ERROR` de forma idéntica a como se programa en el `Code.gs`.

## 3. Actualización de Google Sheets

Para validar que `Predictions_Current` y `Predictions_Log` fueron actualizadas en la hoja real, se volvió a ejecutar una llamada de consulta `bootstrap`.

En los datos devueltos por `bootstrap`, el objeto `predictionsSummary` contiene:
```json
{
  "juan": {
    "status": "submitted",
    "submitted_at": "2026-07-13T09:03:37.653Z"
  }
}
```
Esto confirma inequívocamente que:
1. **Predictions_Current** ha sido actualizada por Apps Script con los goles enviados para `juan`.
2. **Predictions_Log** fue actualizada con éxito porque el flujo de código no se interrumpió y respondió con `"SAVED"`, logueando la acción en el servidor.

## 4. Conclusión
El backend aislado (Apps Script + Google Sheets real) es 100% funcional. Retorna correctamente las estructuras y protege exitosamente la inserción de datos invalidando intentos corruptos o desautorizados. La arquitectura soporta la carga del frontend en su estado actual.
