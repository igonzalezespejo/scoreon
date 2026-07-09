/**
 * Porra Mensual - Backend (Google Apps Script)
 */

function doGet(e) {
  return handleRequest(e.parameter);
}

function doPost(e) {
  let params = {};
  if (e.postData && e.postData.contents) {
    try {
      params = JSON.parse(e.postData.contents);
    } catch (err) {
      return buildErrorResponse("INVALID_JSON", "Cuerpo JSON inválido");
    }
  } else {
    params = e.parameter;
  }
  return handleRequest(params);
}

function handleRequest(params) {
  const action = params.action;
  if (!action) {
    return buildErrorResponse("NO_ACTION", "No action specified");
  }

  try {
    switch (action) {
      case "bootstrap":
        return actionBootstrap();
      case "savePrediction":
        return actionSavePrediction(params);
      default:
        return buildErrorResponse("UNKNOWN_ACTION", "Action not supported: " + action);
    }
  } catch (error) {
    return buildErrorResponse("SERVER_ERROR", "Error interno: " + error.message);
  }
}

// ==========================================
// ACTIONS
// ==========================================

function actionBootstrap() {
  const configRows = getSheetData("Config");
  let config = {};
  configRows.forEach(r => {
    let val = r.value;
    if (val === "true" || val === true) val = true;
    else if (val === "false" || val === false) val = false;
    config[r.key] = val;
  });

  const participants = getSheetData("Participants").map(p => {
    // Eliminar PIN por seguridad
    delete p.pin;
    p.active = (p.active === true || p.active === "true" || p.active === "TRUE");
    return p;
  });

  const months = getSheetData("Months");
  const activeMonthId = config.active_month_id;
  const activeMonth = months.find(m => m.month_id === activeMonthId) || null;

  const matches = getSheetData("Matches").filter(m => m.month_id === activeMonthId);
  const rankingMonthly = getSheetData("Ranking_Monthly");
  const rankingGlobal = getSheetData("Ranking_Global");
  const results = getSheetData("Results");
  const scoringRules = getSheetData("Scoring_Rules");

  // Predicciones actuales (Resumen)
  const currentPredictions = getSheetData("Predictions_Current");
  const predictionsSummary = {};
  currentPredictions.forEach(p => {
    if (!predictionsSummary[p.user_id]) {
      predictionsSummary[p.user_id] = { status: "submitted", submitted_at: p.submitted_at };
    } else {
      let currentSub = new Date(predictionsSummary[p.user_id].submitted_at);
      let newSub = new Date(p.submitted_at);
      if (newSub > currentSub) {
         predictionsSummary[p.user_id].submitted_at = p.submitted_at;
      }
    }
  });

  return buildSuccessResponse({
    code: "SUCCESS",
    message: "Data loaded",
    config: config,
    activeMonth: activeMonth,
    participants: participants,
    matches: matches,
    predictionsSummary: predictionsSummary,
    rankingMonthly: rankingMonthly,
    rankingGlobal: rankingGlobal,
    results: results,
    scoringRules: scoringRules
  });
}

function actionSavePrediction(params) {
  const lock = LockService.getScriptLock();
  // Esperar hasta 10 segundos por el lock
  if (!lock.tryLock(10000)) {
    return buildErrorResponse("LOCK_TIMEOUT", "Sistema ocupado guardando otras predicciones, intenta en unos segundos.");
  }

  try {
    const { user_id, pin, month_id, predictions } = params;
    const serverTime = new Date();

    // 1. Cargar contexto y validar usuario/PIN
    const configRows = getSheetData("Config");
    let config = {};
    configRows.forEach(r => {
      let val = r.value;
      if (val === "true" || val === true) val = true;
      else if (val === "false" || val === false) val = false;
      config[r.key] = val;
    });

    const participants = getSheetData("Participants");
    const user = participants.find(p => p.user_id === user_id);

    if (!user) return buildErrorResponse("VALIDATION_ERROR", "Usuario no existe");
    
    let isActive = (user.active === true || user.active === "true" || user.active === "TRUE");
    if (!isActive) return buildErrorResponse("VALIDATION_ERROR", "Usuario inactivo");
    
    if (config.pin_enabled) {
      if (String(user.pin) !== String(pin)) {
        return buildErrorResponse("VALIDATION_ERROR", "PIN incorrecto");
      }
    }

    // 2. Validar mes
    const months = getSheetData("Months");
    const month = months.find(m => m.month_id === month_id);
    if (!month) return buildErrorResponse("VALIDATION_ERROR", "Mes no encontrado");
    if (month.status !== "open") return buildErrorResponse("VALIDATION_ERROR", "El mes no está abierto para predicciones");
    
    const lockAt = new Date(month.lock_at);
    if (serverTime >= lockAt) return buildErrorResponse("VALIDATION_ERROR", "El plazo del mes ha cerrado");

    // 3. Validar partidos
    const matches = getSheetData("Matches").filter(m => m.month_id === month_id);
    const matchMap = {};
    matches.forEach(m => matchMap[m.match_id] = m);

    if (!Array.isArray(predictions) || predictions.length === 0) {
      return buildErrorResponse("VALIDATION_ERROR", "No se enviaron predicciones válidas");
    }

    const validPredictionsToSave = [];
    for (let p of predictions) {
      const match = matchMap[p.match_id];
      if (!match) return buildErrorResponse("VALIDATION_ERROR", `Partido ${p.match_id} no pertenece al mes`);
      
      const matchLockAt = match.kickoff_at ? new Date(match.kickoff_at) : null;
      if (match.lock_at) {
        if (serverTime >= new Date(match.lock_at)) return buildErrorResponse("VALIDATION_ERROR", `Partido ${p.match_id} ya cerró`);
      } else if (matchLockAt && serverTime >= matchLockAt) {
        return buildErrorResponse("VALIDATION_ERROR", `Partido ${p.match_id} ya comenzó`);
      }

      const hg = parseInt(p.home_goals, 10);
      const ag = parseInt(p.away_goals, 10);

      if (isNaN(hg) || hg < 0 || isNaN(ag) || ag < 0) {
        return buildErrorResponse("VALIDATION_ERROR", `Goles inválidos para el partido ${p.match_id}`);
      }

      validPredictionsToSave.push({
        user_id: user_id,
        match_id: p.match_id,
        home_goals: hg,
        away_goals: ag,
        submitted_at: serverTime.toISOString()
      });
    }

    // 4. Guardar predicciones
    const sheetPreds = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Predictions_Current");
    if (!sheetPreds) return buildErrorResponse("SERVER_ERROR", "No existe la hoja Predictions_Current");

    let currentData = sheetPreds.getDataRange().getValues();
    if (currentData.length === 0) {
      // Si la hoja está vacía por completo (ni cabeceras)
      currentData = [["user_id", "match_id", "home_goals", "away_goals", "submitted_at"]];
    }
    
    const headers = currentData[0];
    const userIdx = headers.indexOf("user_id");
    const matchIdx = headers.indexOf("match_id");
    const homeIdx = headers.indexOf("home_goals");
    const awayIdx = headers.indexOf("away_goals");
    const subIdx = headers.indexOf("submitted_at");

    if (userIdx === -1 || matchIdx === -1) return buildErrorResponse("SERVER_ERROR", "Estructura incorrecta en Predictions_Current");

    let newData = [];
    newData.push(headers);
    
    const updatingMatchIds = validPredictionsToSave.map(vp => vp.match_id);
    
    // Mantener las predicciones que NO estamos actualizando
    for (let i = 1; i < currentData.length; i++) {
      const row = currentData[i];
      const rUser = row[userIdx];
      const rMatch = row[matchIdx];
      
      if (rUser === user_id && updatingMatchIds.includes(rMatch)) {
        continue; // Descartamos la anterior porque la vamos a sobreescribir
      }
      newData.push(row);
    }

    // Agregar las nuevas predicciones
    for (let vp of validPredictionsToSave) {
      let newRow = new Array(headers.length).fill("");
      newRow[userIdx] = vp.user_id;
      newRow[matchIdx] = vp.match_id;
      newRow[homeIdx] = vp.home_goals;
      newRow[awayIdx] = vp.away_goals;
      newRow[subIdx] = vp.submitted_at;
      newData.push(newRow);
    }

    sheetPreds.clearContents();
    sheetPreds.getRange(1, 1, newData.length, headers.length).setValues(newData);

    // 5. Registrar log
    logAction(user_id, "SAVE_PREDICTION", `Guardadas ${validPredictionsToSave.length} predicciones.`, serverTime);

    return buildSuccessResponse({
      code: "SAVED",
      message: "Predicciones guardadas correctamente"
    });

  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// UTILS
// ==========================================

function getSheetData(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = data[i][j];
    }
    rows.push(obj);
  }
  return rows;
}

function logAction(userId, action, details, serverTime) {
  try {
    const sheetLog = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Predictions_Log");
    if (sheetLog) {
      sheetLog.appendRow([serverTime.toISOString(), userId, action, details]);
    }
  } catch (e) {
    // Silencioso
  }
}

function buildSuccessResponse(data) {
  const response = {
    ok: true,
    serverTime: new Date().toISOString()
  };
  Object.assign(response, data);
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildErrorResponse(code, message) {
  const response = {
    ok: false,
    code: code,
    message: message,
    serverTime: new Date().toISOString()
  };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}
