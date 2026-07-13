# Porra Mensual

Aplicación web para gestionar una porra mensual de resultados de fútbol para un grupo de 40-60 participantes.

> **Estado:** MVP publicado y operativo. V2.1 (Alta desde la web) completado.

## Características
- Autoregistro de participantes desde la web con código de invitación y PIN autogenerado.
- Protección mediante PIN y cierre automático según fecha.

## Arquitectura

- **Frontend**: HTML/JS/CSS vainilla, desplegado en GitHub Pages.
- **Backend**: Google Apps Script + Google Sheets.
- **Base de Datos**: Google Sheets.

## Enlace Público
🔗 **[URL de Producción](https://igonzalezespejo.github.io/porra-mensual/)**

## Operación Mensual Básica
Para lanzar una nueva porra cada mes:
1. En Google Sheets, ve a la pestaña `Months` y añade la nueva fila del mes (ej. `2026-10`) con estado `open` y su fecha de cierre (`lock_at`).
2. En la pestaña `Matches`, añade los partidos asignándoles el nuevo `month_id`.
3. En la pestaña `Config`, actualiza la clave `active_month_id` al nuevo mes.
¡Listo! La web cargará automáticamente el nuevo mes para todos los participantes.

## Roadmap

Consulta el archivo [roadmap.md](roadmap.md) para ver el plan de desarrollo completo.

## Desarrollo Local

1. Clona el repositorio.
2. Revisa `src/config.js`. 
   - Por defecto en producción (GitHub Pages) usamos `USE_MOCK = false` y asignamos `API_URL` con el backend de Apps Script.
   - Para desarrollo local desconectado o pruebas estáticas, cambia a `USE_MOCK = true`. La app utilizará datos simulados (`mock-bootstrap.json`).
   - `API_URL` **no es un secreto**, es necesario que esté en el frontend.
   - Si necesitas evitar subir temporalmente tu configuración, puedes usar `src/config.local.js` (ignorado en git), ajustando tus imports manualmente.
3. Instala las dependencias (opcional, para usar el script local):
   ```bash
   npm install
   ```
4. Arranca el servidor local usando el script proporcionado:
   ```bash
   npm run serve
   ```
   (Alternativamente, puedes usar `npx serve .` o `python -m http.server`)
5. Abre `http://localhost:3000` (o el puerto indicado) en tu navegador.

## Pruebas de Backend (Aisladas)

Para validar que el backend (Google Apps Script) funciona correctamente de forma independiente del frontend, se han creado scripts locales de Node.js. 

Para ejecutarlas necesitas configurar la variable de entorno `APPS_SCRIPT_URL` (y opcionalmente `TEST_USER_ID`, `TEST_PIN`, `TEST_MONTH_ID`, `TEST_MATCH_ID`). 

Ejemplo (en Windows PowerShell):
```powershell
$env:APPS_SCRIPT_URL="https://script.google.com/macros/s/XXXX/exec"
npm run test:backend:bootstrap
npm run test:backend:save
npm run test:backend:invalid
```

## Licencia

Privado.
