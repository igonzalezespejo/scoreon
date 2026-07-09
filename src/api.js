import { state } from './state.js';
import { USE_MOCK, API_URL } from './config.js';

/**
 * API layer
 */

export async function loadBootstrapData() {
    try {
        let data;
        if (USE_MOCK) {
            // En entorno local usando ES Modules y un servidor dev (ej. npx serve),
            // fetch a un archivo JSON local funciona.
            const response = await fetch('./data/mock-bootstrap.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            data = await response.json();
        } else {
            const response = await fetch(`${API_URL}?action=bootstrap`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            data = await response.json();
        }
        
        if (data.ok) {
            state.initialize(data);
            return data;
        } else {
            throw new Error("Data was not ok");
        }
    } catch (error) {
        console.error("Error loading data:", error);
        throw error;
    }
}

export async function savePrediction(userId, predictions) {
    if (USE_MOCK) {
        // Simulamos un delay de red
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                try {
                    // Validación básica
                    if (!userId || !predictions || predictions.length === 0) {
                        throw new Error("Datos inválidos");
                    }
                    
                    // Si llegamos aquí, simulamos éxito actualizando el estado local
                    state.updatePredictionStatus(userId, 'submitted');
                    resolve({ ok: true, message: "Apuesta guardada con éxito (Mock)" });
                } catch (err) {
                    reject(err);
                }
            }, 800);
        });
    } else {
        const payload = {
            action: 'savePrediction',
            user_id: userId,
            predictions: predictions
        };
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        if (result.ok) {
            state.updatePredictionStatus(userId, 'submitted');
        }
        return result;
    }
}
