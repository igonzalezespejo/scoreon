# Guía de Despliegue (Deployment)

Este documento describe cómo desplegar tanto el Backend (Google Apps Script) como el Frontend (GitHub Pages).

## 1. Backend: Google Apps Script

El backend es responsable de leer y escribir en Google Sheets aplicando reglas de negocio y seguridad. No necesita infraestructura extra, corre directamente en los servidores de Google.

### Pasos de despliegue:
1. Abre tu hoja de Google Sheets de administración.
2. En el menú superior, ve a **Extensiones > Apps Script**.
3. Se abrirá el editor. Reemplaza el código del archivo `Código.gs` (o `Code.gs`) con el contenido que hay en `apps-script/Code.gs`.
4. Guarda el proyecto (icono de disquete).
5. Arriba a la derecha, haz clic en **Implementar > Nueva implementación**.
6. Selecciona el tipo de implementación: **Aplicación web** (Web app).
7. Configuración requerida:
   - **Descripción:** "Versión 1 - Producción".
   - **Ejecutar como:** "Yo" (tu cuenta personal de Google). *Esto es vital para que el script pueda escribir en tu Sheets sin requerir que los visitantes se logueen con Google.*
   - **Quién tiene acceso:** "Cualquiera" (Any, everyone). La validación lógica (user_id y pin) se hace dentro de `Code.gs`.
8. Haz clic en **Implementar**.
9. Al ser la primera vez, Google te pedirá autorizar permisos. Haz clic en **Autorizar acceso**, selecciona tu cuenta y, en la advertencia de seguridad, ve a "Avanzado" y luego a "Ir a [nombre del proyecto] (no seguro)". Otorga el permiso de lectura/escritura sobre hojas de cálculo.
10. Se generará una **URL de la aplicación web**. Copia esa URL; es la que necesita el frontend.

> **Importante:** Si realizas cambios o correcciones posteriores en `Code.gs`, no basta con guardar. Debes ir a **Implementar > Gestionar implementaciones**, hacer clic en editar (el lápiz), seleccionar **"Nueva versión"** y volver a implementar.

---

## 2. Frontend: GitHub Pages

El frontend es una Single Page Application (SPA) en Vanilla JS, lo que significa que solo se necesitan archivos estáticos (HTML/CSS/JS).

### Pasos de despliegue:
1. **Crear Repositorio Remoto (si no existe):**
   - Entra en [GitHub](https://github.com/new) y crea un nuevo repositorio llamado `porra-mensual`.
   - Enlaza tu carpeta local con el remoto y súbelo (reemplazando `<tu-usuario>`):
     ```bash
     git remote add origin https://github.com/<tu-usuario>/porra-mensual.git
     git branch -M main
     git push -u origin main
     ```
2. Asegúrate de tener el código fuente del frontend pusheado a la rama principal (`main` o `master`) de tu repositorio.
3. Ve a `src/config.js` e introduce la URL de la aplicación web que obtuviste de Apps Script y pon `USE_MOCK = false`. Haz un commit y push de este cambio.
4. En la interfaz web de GitHub, ve a la pestaña **Settings** de tu repositorio.
5. En la barra lateral izquierda, selecciona **Pages**.
6. En la sección **Build and deployment**, asegúrate de que **Source** esté en `Deploy from a branch`.
7. Selecciona tu rama principal (`main`) y la carpeta `/root`.
8. Haz clic en **Save**. En unos minutos, GitHub mostrará la URL pública de tu aplicación.

🔗 **URL de Producción:** `https://igonzalezespejo.github.io/porra-mensual/`

### Verificación Post-Deploy
- [x] La URL pública carga el frontend (HTML, JS, CSS).
- [x] El frontend consume los datos reales de Google Apps Script.
- [x] Los intentos de apuesta se reflejan en Google Sheets.
- [x] Los cierres por límite de tiempo (`lock_at` o estado `locked`) impiden el guardado y bloquean la UI.

### Consideraciones de Seguridad
- Puesto que GitHub Pages es para contenido estático, **no hay variables de entorno ocultas**.
- La URL de Apps Script será visible en la consola del navegador. Esto es **normal y seguro** porque:
  - Apps Script implementa validación estricta de `user_id` y `pin` de manera interna.
  - Apps Script rechaza predicciones a partidos cerrados utilizando la hora de su propio servidor, impidiendo que el cliente envíe `timestamp` falsos.
  - Cualquier error o intento anómalo se traza en `Predictions_Log`.
