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
1. Asegúrate de tener el código fuente del frontend pusheado a la rama principal (`main` o `master`) de tu repositorio en GitHub.
2. Ve a `src/config.js` (o donde se declare la URL base de tu backend) e introduce la URL de la aplicación web que obtuviste de Apps Script. Haz un commit y push de este cambio.
3. En la interfaz web de GitHub, ve a la pestaña **Settings** de tu repositorio.
4. En la barra lateral izquierda, selecciona **Pages**.
5. En la sección **Build and deployment**, asegúrate de que **Source** esté en `Deploy from a branch`.
6. Selecciona tu rama principal (`main`) y la carpeta `/root` (o `/docs` si prefieres mantener tu SPA dentro de una carpeta separada).
7. Haz clic en **Save**. En unos minutos (habitualmente 1-2 minutos), GitHub mostrará la URL pública de tu aplicación en la parte superior (ej. `https://tu-usuario.github.io/porra-mensual/`).

### Consideraciones de Seguridad
- Puesto que GitHub Pages es para contenido estático, **no hay variables de entorno ocultas**.
- La URL de Apps Script será visible en la consola del navegador. Esto es **normal y seguro** porque:
  - Apps Script implementa validación estricta de `user_id` y `pin` de manera interna.
  - Apps Script rechaza predicciones a partidos cerrados utilizando la hora de su propio servidor, impidiendo que el cliente envíe `timestamp` falsos.
  - Cualquier error o intento anómalo se traza en `Predictions_Log`.
