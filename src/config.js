/**
 * Main configuration file.
 * This file MUST be versioned in Git because it is imported by the frontend (e.g. GitHub Pages).
 * DO NOT put secrets here.
 * The API_URL (Google Apps Script Web App URL) is public by design.
 *
 * If you need to override values locally without committing them, you can create
 * `src/config.local.js` (which is ignored by Git) and change your imports temporarily,
 * or just modify this file without committing it.
 */

export const USE_MOCK = false;

// Apps Script: escrituras (apuestas, login, admin) y respaldo de lectura si
// la copia pública no responde.
export const API_URL = 'https://script.google.com/macros/s/AKfycbzZcyNFmGshh0omvAxO_GoVfX56NXYQX_nwlKLRyoN-MDfjSfpGRN-SSnfNgyzWgwn4PA/exec';

// Hoja pública ("cualquiera con el enlace") con la copia de los datos que
// enseña la web, regenerada en cada escritura por apps-script/Publico.gs. La
// web la lee al cargar (~0,3 s) en vez de esperar a /exec. null = leer todo
// por API_URL, como antes.
export const PUBLIC_SHEET_ID = '1YnqE5xAaQeXG1Bkh-D1rkvYLlz0CgbzfpjsbzSTQGwA';
