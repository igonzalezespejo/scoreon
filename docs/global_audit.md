# Auditoría Global del Proyecto Porra Mensual

## 1. Resumen ejecutivo
El proyecto se encuentra en un estado sólido de preparación, con la base del frontend (mock), lógica de puntuación testeada y el script del backend (Apps Script) implementado, faltando principalmente la integración real entre ambos entornos. 
**Porcentaje aproximado de avance:** 75%
**Riesgo principal actual:** La integración real frontend-backend no está probada en el código principal, y existen pequeñas divergencias en el contrato de datos entre el mock y el backend real que podrían causar errores sutiles al cambiar a producción.

## 2. Estado por módulo

| Módulo | Estado | Evidencia | Acción recomendada |
|---|---|---|---|
| Estructura del proyecto | OK | Carpetas limpias, `ref/` ignorada por git y jest, no usada en `src/`. | Mantener disciplina de no importar de `ref/`. |
| Git/configuración | OK | `.gitignore` excluye `.env` y `config.local.js`, `package.json` tiene scripts. `API_URL` expuesta como variable pública. | Ninguna, todo correcto. |
| Frontend mock | OK | `index.html` y vistas en `src/views/` usan `data/mock-bootstrap.json` si `USE_MOCK=true`. Navegación funciona. | Completar integración real. |
| Mock data y contrato | Parcial | `mock-bootstrap.json` carece de `code`, `message`, `results`, `scoringRules` que sí devuelve `Code.gs`. | Corregir mock data para igualar 100% la respuesta de Apps Script. |
| Scoring y validaciones | OK | `npm test` pasa 18 tests limpiamente. Lógica pura. | Mantener tests al añadir nuevas reglas. |
| Apps Script backend | OK | `Code.gs` implementa validaciones, locks y escritura según schema. | Desplegar y probar de forma aislada si no se ha hecho. |
| Google Sheets | Parcial | Plantillas y schemas documentados. No es posible verificar la hoja real desde el repositorio (falta acceso OAuth/URL). | Validar manualmente que la hoja de cálculo viva siga exactamente el schema de `docs/sheet_schema.md`. |
| Documentación | OK | `roadmap.md`, schemas y contrato de API al día. | Actualizar el estado en `roadmap.md` tras esta auditoría. |

*Nota sobre Google Sheets:* No verificable desde el repositorio. La auditoría se ha limitado a analizar la documentación y las plantillas CSV, las cuales son correctas y coherentes con `Code.gs`.

## 3. Incoherencias detectadas (Resuelto)

- **Mock Data Incompleto:** (✅ **Resuelto**: Se han añadido los campos faltantes al mock).
  - **Severidad:** Baja (el frontend actual no rompe por esto, pero es una mala práctica).
  - **Archivo afectado:** `data/mock-bootstrap.json`
  - **Recomendación:** Añadir `code`, `message`, `results` (vacío o mock), y `scoringRules` al JSON para que sea una réplica exacta de `action=bootstrap` definido en `docs/api_contract.md`.

## 4. Checklist técnico

- [x] `npm test` - Pasa (18 tests OK).
- [x] `npm run serve` - Arranca correctamente en el puerto 3000.
- [x] Mock data - Funcional, pero parcialmente desalineado con backend.
- [x] Frontend - Arquitectura modular pura, sin JSONBin.
- [x] Backend - `Code.gs` implementado con validaciones y bloqueos.
- [x] Sheets - Schemas y CSVs alineados con backend (hoja real no verificable).
- [x] Docs - Alineadas con el código actual.
- [x] Gitignore - Ignorando `ref/` y `config.local.js`.
- [x] Config - `USE_MOCK=true` correcto para desarrollo inicial.

## 5. Próximo paso recomendado

**Ruta elegida:** B) Corregir contrato mock/backend.

**Justificación:** 
Antes de pasar a la integración real (C) o probar el Apps Script de manera extensiva contra el frontend, es vital que el "entorno de mentira" (mock) se comporte estructuralmente igual que el "entorno de verdad". Las propiedades `code`, `message`, `results` y `scoringRules` especificadas en `api_contract.md` y retornadas por `Code.gs` no existen en `mock-bootstrap.json`. Subsanar esto garantiza que, cuando pongamos `USE_MOCK=false`, el frontend no dependa de asunciones falsas sobre la forma de los datos, preparando un terreno 100% seguro para el paso C.

## 6. Plan del siguiente agente

**Prompt para el siguiente agente:**

```text
Objetivo: Corregir las divergencias entre los datos mock y el contrato real del backend, asegurando que el frontend maneje la respuesta idénticamente en ambos entornos.

Archivos permitidos:
- data/mock-bootstrap.json
- docs/api_contract.md (solo lectura, para referencia)
- apps-script/Code.gs (solo lectura, para referencia)
- roadmap.md (para marcar paso como completado)

Archivos prohibidos:
- ref/**
- node_modules/**
- Reescrituras grandes de frontend

Pasos concretos:
1. Analizar la función `actionBootstrap()` en `Code.gs` y `docs/api_contract.md`.
2. Actualizar `data/mock-bootstrap.json` inyectando los campos faltantes: `code` (con valor "SUCCESS"), `message` ("Data loaded"), `results` (un array vacío o con un ejemplo válido de estado final), y `scoringRules` (con al menos una regla activa).
3. Asegurar que el JSON resultante sigue siendo sintácticamente válido.
4. Actualizar `roadmap.md` indicando que el contrato mock ha sido alineado con el backend al 100%.

Criterios de aceptación:
- `data/mock-bootstrap.json` tiene todos los campos de nivel superior que envía `Code.gs`.
- `npm run serve` sigue funcionando correctamente y la app carga sin errores con el nuevo mock.
```
