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
export const API_URL = 'https://script.google.com/macros/s/AKfycbzZcyNFmGshh0omvAxO_GoVfX56NXYQX_nwlKLRyoN-MDfjSfpGRN-SSnfNgyzWgwn4PA/exec';
