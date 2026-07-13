# Porra Mensual

Aplicación web para gestionar una porra mensual de resultados de fútbol para un grupo de 40-60 participantes.

## Arquitectura

- **Frontend**: HTML/JS/CSS vainilla, desplegado en GitHub Pages.
- **Backend**: Google Apps Script.
- **Base de Datos**: Google Sheets.

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
