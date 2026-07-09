# Plan de Reutilización de Referencias

Este documento resume los elementos de los proyectos de referencia (`mundial-2026` y `porra-mundial-evaristosaa`) que se reutilizarán, adaptarán o descartarán para el desarrollo de `porra-mensual`.

## 1. Reutilización de `mundial-2026`

Podemos aprovechar de manera significativa la base del proyecto `mundial-2026`, específicamente:
- **Estructura del Proyecto**: Mantener la organización en `src/`, `data/`, `styles/` y `scripts/`.
- **Formatos JSON**: Reutilizar el esquema de los datos para mantener la consistencia en el backend y el frontend.
- **Ranking**: Lógica y estructura visual para la clasificación de los participantes.
- **Estilos**: Reutilizar las variables CSS, diseño de contenedores y componentes generales.
- **Validaciones**: Lógica de verificación y reglas de negocio para asegurar la integridad de los datos.

## 2. Reutilización de `porra-mundial-evaristosaa`

Del proyecto `porra-mundial-evaristosaa` podemos extraer e integrar las siguientes funcionalidades:
- **Selector de Nombre**: La interfaz y lógica para que cada usuario elija su perfil antes de participar.
- **Flujo de Apuestas**: La experiencia de usuario al ingresar resultados y guardar sus pronósticos.
- **Estado de "Quién falta"**: Indicadores para mostrar qué participantes aún no han enviado o completado sus apuestas.
- **UX de Admin**: Elementos de la interfaz y usabilidad general del panel de administración (adaptado a nuestra nueva arquitectura).

## 3. Elementos a NO Copiar (Descartados)

Se debe evitar expresamente la copia o reutilización de los siguientes elementos de los proyectos de referencia:
- **JSONBin**: No usaremos JSONBin para el almacenamiento; la nueva arquitectura utiliza Google Sheets + Google Apps Script.
- **Claves Públicas**: No migrar credenciales, tokens o keys de entornos antiguos ni exponerlos en el frontend.
- **index.html monolítico**: Evitar un único archivo HTML gigante (como el de `porra-mundial-evaristosaa`). La estructura debe ser modular.
- **Admin solo frontend**: El panel de administración no será un simple control del lado del cliente sin validación en el servidor; se integrará de forma segura con el backend en Google Sheets.

## 4. Equivalencias de Datos

Para migrar y adaptar la estructura de datos, usaremos las siguientes equivalencias desde `mundial-2026` hacia `porra-mensual`:

- `mundial-2026 participants.json` ➔ `porra-mensual participants` (dentro del proceso de bootstrap/Google Sheets)
- `mundial-2026 matches.json` ➔ `porra-mensual matches`
- `mundial-2026 predictions.json` ➔ `porra-mensual predictionsCurrent`
- `mundial-2026 ranking.json` ➔ `porra-mensual rankingMonthly` / `rankingGlobal`
