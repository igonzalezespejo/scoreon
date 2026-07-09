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
2. Revisa `src/config.js`. Por defecto usa `USE_MOCK = true` para desarrollo local usando datos estáticos.
   - Para producción (GitHub Pages) pon `USE_MOCK = false` y asigna `API_URL` con tu backend de Apps Script.
   - `API_URL` **no es un secreto**, es necesario que esté en el frontend.
   - Si necesitas evitar subir temporalmente tu configuración, puedes usar `src/config.local.js` (ignorado en git), ajustando tus imports manualmente.
3. Instala las dependencias (opcional, para usar el script local):
   ```bash
   npm install
   ```
3. Arranca el servidor local usando el script proporcionado:
   ```bash
   npm run serve
   ```
   (Alternativamente, puedes usar `npx serve .` o `python -m http.server`)
4. Abre `http://localhost:3000` (o el puerto indicado) en tu navegador.

## Licencia

Privado.
