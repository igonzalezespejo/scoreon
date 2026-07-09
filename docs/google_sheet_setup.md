# Configuración de Google Sheets para Porra Mensual

Este documento describe paso a paso cómo montar la base de datos de Google Sheets utilizando las plantillas CSV generadas, y cómo conectarla con el backend en Google Apps Script.

## 1. Crear el Google Sheet

1. Ve a [Google Sheets](https://sheets.google.com) y crea una nueva hoja de cálculo en blanco.
2. Nómbrala `Porra Mensual DB` (o el nombre que prefieras, el script accede por ID).
3. Copia el **Spreadsheet ID** desde la URL.
   - Ejemplo URL: `https://docs.google.com/spreadsheets/d/1BxiMVs0X_xxxxx_xxxxx/edit`
   - El ID es: `1BxiMVs0X_xxxxx_xxxxx`
4. Guarda este ID para usarlo en el código de Google Apps Script.

## 2. Importar las Pestañas (CSV)

Es crucial que **los nombres de las pestañas** y **las cabeceras de las columnas** coincidan *exactamente* (respetando mayúsculas y minúsculas) con lo que espera el sistema.

Para cada archivo dentro de la carpeta `docs/sheet_templates/`:
1. Crea una nueva pestaña en el documento.
2. Haz doble clic en el nombre de la pestaña abajo y nómbrala **exactamente** igual que el archivo CSV (sin la extensión `.csv`).
3. Importa el archivo CSV en esa pestaña (puedes abrir el CSV en tu editor y copiar/pegar el contenido directamente desde la celda `A1`, o usar la función de `Archivo > Importar`).

### Pestañas necesarias:
- `Config`
- `Participants`
- `Months`
- `Matches`
- `Predictions_Current`
- `Predictions_Log`
- `Results`
- `Scoring_Rules`
- `Ranking_Monthly`
- `Ranking_Global`
- `Admin_Actions`

> [!WARNING]
> La hoja por defecto que crea Google Sheets (normalmente "Hoja 1") debe ser renombrada a una de las de arriba o eliminada. No puede faltar ninguna pestaña.

## 3. Enlazar con Google Apps Script

1. Abre el documento de Google Sheets.
2. En el menú superior, ve a **Extensiones > Apps Script**.
3. Se abrirá el editor de código. Borra el código por defecto (`function myFunction() {}`).
4. Copia todo el contenido del archivo `apps-script/Code.gs` de este repositorio.
5. Pégalo en el editor de Apps Script.
6. Dale un nombre al proyecto arriba a la izquierda (ej. "Backend Porra Mensual").
7. Guarda el archivo (icono de disquete o `Ctrl+S`).

## 4. Desplegar la Aplicación Web (Backend)

1. En el editor de Apps Script, haz clic en el botón azul **Implementar > Nueva implementación** (Deploy > New deployment).
2. Haz clic en el engranaje junto a "Seleccionar tipo" (Select type) y elige **Aplicación web** (Web app).
3. Configura los campos:
   - **Descripción**: v1.0 (o similar).
   - **Ejecutar como**: `Yo` (tu cuenta de Google).
   - **Quién tiene acceso**: `Cualquier persona` (Anyone). *Importante para que el frontend pueda hacer llamadas sin pedir login de Google.*
4. Haz clic en **Implementar**.
5. Te pedirá **Autorizar el acceso** (Authorize access) porque el script necesita permiso para leer y escribir en tus hojas de cálculo. Acepta los permisos (puede que tengas que ir a "Avanzado" > "Ir a Backend Porra Mensual (inseguro)").
6. Se generará una URL de aplicación web.
   - Ejemplo: `https://script.google.com/macros/s/AKfycby.../exec`
7. Esta URL es tu **API_URL** que tendrás que configurar en el frontend (en `src/config.js` o `src/config.local.js`).

## 5. Validación final

1. Revisa que todas las cabeceras estén en la **fila 1** de cada pestaña.
2. Asegúrate de que no haya espacios en blanco en los nombres de las pestañas ni de las columnas.
3. El frontend ya estará listo para llamar al backend una vez configurada la URL.
