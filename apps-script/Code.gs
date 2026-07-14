/**
 * Porra Mensual - Backend (Google Apps Script)
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Porra Admin')
      .addItem('Recalcular rankings', 'menuRecalculateRankings')
      .addItem('Instalar trigger de ranking', 'installRankingTriggers')
      .addItem('Marcar ranking como sucio', 'menuMarkRankingsDirty')
      .addItem('Diagnóstico ranking', 'menuRankingDiagnostics')
      .addItem('Diagnóstico scoring partido activo', 'menuDebugScoring')
      .addToUi();
}

function installRankingTriggers() {
  const ss = SpreadsheetApp.getActive();
  const triggers = ScriptApp.getUserTriggers(ss);
  let removed = 0;
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'handleRankingEdit') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  ScriptApp.newTrigger('handleRankingEdit')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  SpreadsheetApp.getUi().alert('Éxito', `Trigger instalable creado correctamente. Se eliminaron ${removed} triggers antiguos.`, SpreadsheetApp.getUi().ButtonSet.OK);
}

function menuMarkRankingsDirty() {
  try {
    markRankingsDirty("admin_manual");
    SpreadsheetApp.getUi().alert('Éxito', 'Ranking marcado como sucio. Se recalculará en el próximo bootstrap o manualmente.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch(e) {
    SpreadsheetApp.getUi().alert('Error', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function menuRankingDiagnostics() {
  try {
    const diag = getRankingDiagnostics();
    let msg = `Dirty: ${diag.ranking_dirty}\n`;
    msg += `Razón: ${diag.ranking_dirty_reason}\n`;
    msg += `Último recálculo: ${diag.ranking_last_recalc_at}\n\n`;
    msg += `Mes Activo: ${diag.active_month_id}\n`;
    msg += `Participantes activos: ${diag.active_participants}\n`;
    msg += `Faltan en Monthly: ${diag.missing_in_monthly ? 'SÍ' : 'NO'}\n`;
    msg += `Faltan en Global: ${diag.missing_in_global ? 'SÍ' : 'NO'}\n`;
    msg += `Partidos finalizados (goles): ${diag.results_count}\n`;
    msg += `Apuestas totales: ${diag.predictions_count}\n`;
    SpreadsheetApp.getUi().alert('Diagnóstico Ranking', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch(e) {
    SpreadsheetApp.getUi().alert('Error', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function menuDebugScoring() {
  try {
    const config = getConfigMap();
    const activeMonthId = normalizeId(config.active_month_id);
    const matches = getSheetData("Matches").filter(m => normalizeId(m.month_id) === activeMonthId);
    
    if (matches.length === 0) {
      throw new Error("No hay partidos en el mes activo: " + activeMonthId);
    }
    
    let matchIdToDebug = normalizeId(matches[0].match_id);
    if (matches.length > 1) {
      const ui = SpreadsheetApp.getUi();
      const response = ui.prompt(
        'Diagnóstico de Scoring',
        'Hay varios partidos en este mes. Introduce el match_id que quieres depurar (ej. m001):',
        ui.ButtonSet.OK_CANCEL
      );
      if (response.getSelectedButton() !== ui.Button.OK) return;
      matchIdToDebug = normalizeId(response.getResponseText());
    }
    
    const results = getSheetData("Results");
    const result = results.find(r => normalizeId(r.match_id) === matchIdToDebug);
    
    const predictions = getSheetData("Predictions_Current").filter(p => normalizeId(p.match_id) === matchIdToDebug);
    
    const scoringRules = getSheetData("Scoring_Rules");
    
    let msg = `Diagnóstico para partido: ${matchIdToDebug}\n`;
    msg += `Mes Activo: ${activeMonthId}\n`;
    msg += `Testing Simulation: ${config.testing_allow_result_simulation === true}\n`;
    
    if (!result) {
      msg += `\nESTADO: No se encontró resultado para este partido en la pestaña Results.\n`;
    } else {
      msg += `Resultado leído: ${result.home_goals} - ${result.away_goals} (status: ${result.status})\n`;
      msg += `Goles válidos: home=${isFilledGoal(result.home_goals)}, away=${isFilledGoal(result.away_goals)}\n`;
    }
    
    msg += `Apuestas encontradas: ${predictions.length}\n\n`;
    
    predictions.forEach(p => {
      const pName = p.user_id;
      const scoreObj = scorePrediction(p, result, scoringRules);
      if (scoreObj.computable) {
         msg += `- ${pName}: apuesta ${p.home_goals}-${p.away_goals} -> ${scoreObj.rule_id} (${scoreObj.points} pts)\n`;
      } else {
         msg += `- ${pName}: apuesta ${p.home_goals}-${p.away_goals} -> NO COMPUTABLE (motivo: goles no válidos o partido no finalizado/cancelado)\n`;
      }
    });
    
    SpreadsheetApp.getUi().alert('Diagnóstico Scoring', msg, SpreadsheetApp.getUi().ButtonSet.OK);
    logAction("admin", "DEBUG_SCORING", `Diagnóstico consultado para ${matchIdToDebug}`, new Date());
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function onEdit(e) {
  if (!e) return;
  const sheetName = e.source.getActiveSheet().getName();
  const watched = ['Results', 'Predictions_Current', 'Participants', 'Matches', 'Scoring_Rules'];
  if (watched.includes(sheetName)) {
    try {
      markRankingsDirty("simple_edit:" + sheetName);
      if (e.source && e.source.toast) {
        e.source.toast('Cambio detectado. Ranking marcado como sucio (simple trigger).', 'Aviso', 3);
      }
    } catch(err) {}
  }
}

function handleRankingEdit(e) {
  if (!e) return;
  const sheetName = e.source.getActiveSheet().getName();
  const watched = ['Results', 'Predictions_Current', 'Participants', 'Matches', 'Scoring_Rules'];
  if (watched.includes(sheetName)) {
    try {
      markRankingsDirty("installable_edit:" + sheetName);
      updateRankingsInSheets();
      if (e.source && e.source.toast) {
        e.source.toast('Rankings recalculados automáticamente (Installable Trigger).', 'Éxito', 3);
      }
    } catch(err) {
      if (e.source && e.source.toast) {
        e.source.toast('Error al recalcular rankings: ' + err.message, 'Error', 10);
      }
    }
  }
}

function menuRecalculateRankings() {
  try {
    updateRankingsInSheets();
    SpreadsheetApp.getUi().alert('Éxito', 'Rankings recalculados y persistidos correctamente.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch(e) {
    SpreadsheetApp.getUi().alert('Error', 'Error al recalcular rankings: ' + e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

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
      case "getUserPredictions":
        return actionGetUserPredictions(params);
      case "registerParticipant":
        return actionRegisterParticipant(params);
      case "debugLiveRanking":
        return actionDebugLiveRanking(params);
      case "recalculateRankings":
        return actionRecalculateRankings(params);
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

function getSign(home, away) {
    if (home > away) return 1;
    if (home < away) return -1;
    return 0;
}

function scorePrediction(prediction, result, scoringRules) {
    const defaultPoints = { exact_draw: 20, exact_non_draw: 15, draw_not_exact: 10, winner_not_exact: 5, wrong: 0 };
    
    const rules = {};
    if (Array.isArray(scoringRules)) {
        scoringRules.forEach(r => rules[r.rule_id] = r.points);
    }

    const getPoint = (id) => rules[id] !== undefined ? Number(rules[id]) : defaultPoints[id];

    if (!prediction || !isFilledGoal(prediction.home_goals) || !isFilledGoal(prediction.away_goals)) {
        return { rule_id: 'pending', points: 0, computable: false };
    }
    
    let resultStatus = String(result.status || "").toLowerCase().trim();
    if (resultStatus === 'cancelled' || resultStatus === 'cancelado') {
        return { rule_id: 'pending', points: 0, computable: false };
    }
    
    if (!result || !isFilledGoal(result.home_goals) || !isFilledGoal(result.away_goals)) {
        return { rule_id: 'pending', points: 0, computable: false };
    }

    const pH = Number(prediction.home_goals);
    const pA = Number(prediction.away_goals);
    const rH = Number(result.home_goals);
    const rA = Number(result.away_goals);

    if (pH < 0 || pA < 0 || rH < 0 || rA < 0) {
        return { rule_id: 'pending', points: 0, computable: false };
    }

    const isDraw = (rH === rA);
    const isExact = (pH === rH && pA === rA);
    const correctSign = getSign(pH, pA) === getSign(rH, rA);

    let rule_id = 'wrong';
    if (isExact) {
        rule_id = isDraw ? 'exact_draw' : 'exact_non_draw';
    } else if (correctSign) {
        rule_id = isDraw ? 'draw_not_exact' : 'winner_not_exact';
    }

    return { rule_id, points: getPoint(rule_id), computable: true };
}

function buildMonthlyRanking(participants, matches, predictionsCurrent, results, scoringRules, activeMonthId, config = {}) {
    const rankingMap = {};
    
    participants.forEach(p => {
        if (p.active) {
            rankingMap[normalizeId(p.user_id)] = {
                user_id: normalizeId(p.user_id),
                display_name: p.display_name,
                points: 0,
                exact_scores: 0,
                correct_signs: 0,
                failed: 0,
                played_matches: 0
            };
        }
    });

    const resultMap = {};
    results.forEach(r => resultMap[normalizeId(r.match_id)] = r);

    const monthMatches = matches.filter(m => normalizeId(m.month_id) === activeMonthId);
    const monthMatchIds = monthMatches.map(m => normalizeId(m.match_id));

    predictionsCurrent.forEach(pred => {
        const matchId = normalizeId(pred.match_id);
        if (!monthMatchIds.includes(matchId)) return;
        
        const participantId = normalizeId(pred.user_id);
        const result = resultMap[matchId];

        if (!result) return;
        const rankEntry = rankingMap[participantId];
        if (!rankEntry) return;

        const scoreObj = scorePrediction(pred, result, scoringRules);
        if (!scoreObj.computable) return;

        rankEntry.played_matches += 1;
        rankEntry.points += scoreObj.points;

        if (scoreObj.rule_id === 'exact_draw' || scoreObj.rule_id === 'exact_non_draw') {
            rankEntry.exact_scores += 1;
        } else if (scoreObj.rule_id === 'draw_not_exact' || scoreObj.rule_id === 'winner_not_exact') {
            rankEntry.correct_signs += 1;
        } else if (scoreObj.rule_id === 'wrong') {
            rankEntry.failed += 1;
        }
    });

    const arr = Object.values(rankingMap).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.exact_scores !== a.exact_scores) return b.exact_scores - a.exact_scores;
        if (b.correct_signs !== a.correct_signs) return b.correct_signs - a.correct_signs;
        const aName = a.display_name || '';
        const bName = b.display_name || '';
        return aName.localeCompare(bName);
    });

    arr.forEach((r, i) => r.position = i + 1);
    return arr;
}

function buildGlobalRanking(participants, matches, predictionsCurrent, results, scoringRules, config = {}) {
    const rankingMap = {};
    
    participants.forEach(p => {
        if (p.active) {
            rankingMap[normalizeId(p.user_id)] = {
                user_id: normalizeId(p.user_id),
                display_name: p.display_name,
                total_points: 0,
                exact_scores: 0,
                correct_signs: 0,
                months_played: 0,
                _played_months_set: {} 
            };
        }
    });

    const resultMap = {};
    results.forEach(r => resultMap[normalizeId(r.match_id)] = r);

    const matchToMonth = {};
    matches.forEach(m => matchToMonth[normalizeId(m.match_id)] = normalizeId(m.month_id));

    predictionsCurrent.forEach(pred => {
        const participantId = normalizeId(pred.user_id);
        const matchId = normalizeId(pred.match_id);
        const monthId = matchToMonth[matchId];
        const result = resultMap[matchId];

        if (!result || !monthId) return;
        
        const rankEntry = rankingMap[participantId];
        if (!rankEntry) return;

        const scoreObj = scorePrediction(pred, result, scoringRules);
        if (!scoreObj.computable) return;

        rankEntry.total_points += scoreObj.points;
        rankEntry._played_months_set[monthId] = true;

        if (scoreObj.rule_id === 'exact_draw' || scoreObj.rule_id === 'exact_non_draw') {
            rankEntry.exact_scores += 1;
        } else if (scoreObj.rule_id === 'draw_not_exact' || scoreObj.rule_id === 'winner_not_exact') {
            rankEntry.correct_signs += 1;
        }
    });

    const arr = Object.values(rankingMap).map(r => {
        r.months_played = Object.keys(r._played_months_set).length;
        delete r._played_months_set;
        return r;
    });

    arr.sort((a, b) => {
        if (b.total_points !== a.total_points) return b.total_points - a.total_points;
        if (b.exact_scores !== a.exact_scores) return b.exact_scores - a.exact_scores;
        if (b.correct_signs !== a.correct_signs) return b.correct_signs - a.correct_signs;
        const aName = a.display_name || '';
        const bName = b.display_name || '';
        return aName.localeCompare(bName);
    });

    arr.forEach((r, i) => r.position = i + 1);
    return arr;
}

function actionGetUserPredictions(params) {
  const { user_id, pin, month_id } = params;

  if (!user_id || !month_id) {
    return buildErrorResponse("VALIDATION_ERROR", "Faltan parámetros requeridos");
  }

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

  const matches = getSheetData("Matches").filter(m => m.month_id === month_id);
  const matchIds = matches.map(m => String(m.match_id));

  const currentPredictions = getSheetData("Predictions_Current");
  const userPredictions = currentPredictions.filter(p => p.user_id === user_id && matchIds.includes(String(p.match_id)));

  const predictions = userPredictions.map(p => ({
    match_id: p.match_id,
    home_goals: p.home_goals,
    away_goals: p.away_goals,
    submitted_at: p.submitted_at
  }));

  return buildSuccessResponse({
    code: "USER_PREDICTIONS",
    message: "Apuestas cargadas",
    user_id: user_id,
    month_id: month_id,
    predictions: predictions
  });
}

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
    delete p.pin;
    p.active = (p.active === true || p.active === "true" || p.active === "TRUE");
    return p;
  });

  const months = getSheetData("Months");
  const activeMonthId = normalizeId(config.active_month_id);
  const activeMonth = months.find(m => normalizeId(m.month_id) === activeMonthId) || null;

  const matches = getSheetData("Matches");
  const activeMatches = matches.filter(m => normalizeId(m.month_id) === activeMonthId);
  const results = getSheetData("Results");
  let scoringRules = getSheetData("Scoring_Rules");

  const requiredRules = {
    exact_draw: { description: "Resultado exacto con empate", points: 20 },
    exact_non_draw: { description: "Resultado exacto sin empate", points: 15 },
    draw_not_exact: { description: "Empate acertado no exacto", points: 10 },
    winner_not_exact: { description: "Ganador acertado no exacto", points: 5 },
    wrong: { description: "Fallo", points: 0 }
  };

  const rulesMap = {};
  scoringRules.forEach(r => rulesMap[r.rule_id] = r);
  
  for (let key in requiredRules) {
    if (!rulesMap[key] || rulesMap[key].active === false || rulesMap[key].active === "false") {
      let existingIndex = scoringRules.findIndex(r => r.rule_id === key);
      let newRule = {
        rule_id: key,
        description: requiredRules[key].description,
        points: requiredRules[key].points,
        active: true
      };
      if (existingIndex >= 0) {
        scoringRules[existingIndex] = newRule;
      } else {
        scoringRules.push(newRule);
      }
    }
  }

  const monthMatchesCount = activeMatches.length;
  const activeMonthMatchIds = activeMatches.map(m => normalizeId(m.match_id));

  const currentPredictions = getSheetData("Predictions_Current");
  const userBetCounts = {};
  participants.forEach(p => userBetCounts[p.user_id] = { count: 0, latest_date: null });

  currentPredictions.forEach(p => {
    if (activeMonthMatchIds.includes(normalizeId(p.match_id))) {
       if (userBetCounts[normalizeId(p.user_id)]) {
           userBetCounts[normalizeId(p.user_id)].count++;
           let newSub = new Date(p.submitted_at);
           let currentSub = userBetCounts[normalizeId(p.user_id)].latest_date ? new Date(userBetCounts[normalizeId(p.user_id)].latest_date) : new Date(0);
           if (newSub > currentSub) {
               userBetCounts[normalizeId(p.user_id)].latest_date = p.submitted_at;
           }
       }
    }
  });

  const predictionsSummary = {};
  participants.forEach(p => {
    if (p.active) {
      const data = userBetCounts[p.user_id];
      let status = "pending";
      if (data.count > 0 && data.count < monthMatchesCount) status = "partial";
      else if (data.count >= monthMatchesCount && monthMatchesCount > 0) status = "submitted";

      predictionsSummary[p.user_id] = {
        user_id: p.user_id,
        display_name: p.display_name,
        status: status,
        submitted_at: data.latest_date,
        submitted_count: data.count,
        total_matches: monthMatchesCount
      };
    }
  });

  let rankingMonthly = [];
  let rankingGlobal = [];
  
  // ÚLTIMA ITERACIÓN / modo robusto:
  // Para evitar rankings persistidos obsoletos, bootstrap recalcula SIEMPRE antes de responder.
  // Con 40-60 usuarios el coste es bajo y elimina dependencia de triggers, ranking_dirty y caché.
  let debugInfo = {
    ranking_recalculated: false,
    ranking_recalc_reason: "bootstrap_always_recalc",
    ranking_last_recalc_at: null,
    ranking_monthly_rows: 0,
    ranking_global_rows: 0
  };

  try {
      updateRankingsInSheets();
      rankingMonthly = getSheetData("Ranking_Monthly");
      rankingGlobal = getSheetData("Ranking_Global");
      debugInfo.ranking_recalculated = true;
      debugInfo.ranking_last_recalc_at = new Date().toISOString();
      debugInfo.ranking_monthly_rows = rankingMonthly.length;
      debugInfo.ranking_global_rows = rankingGlobal.length;
  } catch(e) {
      // Si la persistencia falla por cabeceras/permisos, al menos devolver ranking vivo correcto a la web.
      rankingMonthly = buildMonthlyRanking(participants, matches, currentPredictions, results, scoringRules, normalizeId(activeMonthId), config);
      rankingGlobal = buildGlobalRanking(participants, matches, currentPredictions, results, scoringRules, config);
      debugInfo.ranking_recalculated = false;
      debugInfo.ranking_recalc_reason = "persist_failed_live_fallback: " + e.message;
      debugInfo.ranking_monthly_rows = rankingMonthly.length;
      debugInfo.ranking_global_rows = rankingGlobal.length;
  }

  const responsePayload = {
    code: "SUCCESS",
    message: "Data loaded",
    backend_version: "ranking-force-bootstrap-20260713-ULTIMA",
    config: config,
    activeMonth: activeMonth,
    participants: participants,
    matches: activeMatches,
    predictionsSummary: predictionsSummary,
    rankingMonthly: rankingMonthly,
    rankingGlobal: rankingGlobal,
    results: results,
    scoringRules: scoringRules
  };
  
  if (debugInfo) {
    responsePayload.debug = debugInfo;
  }

  return buildSuccessResponse(responsePayload);
}

function actionSavePrediction(params) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return buildErrorResponse("LOCK_TIMEOUT", "Sistema ocupado guardando otras predicciones, intenta en unos segundos.");
  }

  try {
    const { user_id, pin, month_id, predictions } = params;
    const serverTime = new Date();

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

    const months = getSheetData("Months");
    const month = months.find(m => m.month_id === month_id);
    if (!month) return buildErrorResponse("VALIDATION_ERROR", "Mes no encontrado");
    if (month.status !== "open") return buildErrorResponse("VALIDATION_ERROR", "El mes no está abierto para predicciones");
    
    const lockAt = new Date(month.lock_at);
    if (serverTime >= lockAt) return buildErrorResponse("VALIDATION_ERROR", "El plazo del mes ha cerrado");

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

    const sheetPreds = getSpreadsheet().getSheetByName("Predictions_Current");
    if (!sheetPreds) return buildErrorResponse("SERVER_ERROR", "No existe la hoja Predictions_Current");

    let currentData = sheetPreds.getDataRange().getValues();
    if (currentData.length === 0) {
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
    
    for (let i = 1; i < currentData.length; i++) {
      const row = currentData[i];
      const rUser = row[userIdx];
      const rMatch = row[matchIdx];
      
      if (rUser === user_id && updatingMatchIds.includes(rMatch)) {
        continue; 
      }
      newData.push(row);
    }

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

    logAction(user_id, "SAVE_PREDICTION", `Guardadas ${validPredictionsToSave.length} predicciones.`, serverTime);

    try {
      updateRankingsInSheetsUnsafe();
    } catch(e) {
      markRankingsDirty("savePrediction_error");
    }

    return buildSuccessResponse({
      code: "SAVED",
      message: "Predicciones guardadas correctamente"
    });

  } finally {
    lock.releaseLock();
  }
}

function actionRegisterParticipant(params) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return buildErrorResponse("LOCK_TIMEOUT", "Sistema ocupado, intenta en unos segundos.");
  }

  try {
    const { display_name, registration_code } = params;
    
    const configRows = getSheetData("Config");
    let config = {};
    configRows.forEach(r => {
      let val = r.value;
      if (val === "true" || val === true) val = true;
      else if (val === "false" || val === false) val = false;
      config[r.key] = val;
    });

    if (config.registration_enabled !== true) {
      return buildErrorResponse("REGISTRATION_DISABLED", "El registro no está habilitado");
    }
    
    if (config.registration_code && String(config.registration_code).trim() !== "") {
      if (String(registration_code) !== String(config.registration_code)) {
        return buildErrorResponse("VALIDATION_ERROR", "El código de invitación no es correcto");
      }
    }

    if (!display_name || typeof display_name !== "string" || display_name.trim().length < 2 || display_name.trim().length > 60) {
      return buildErrorResponse("VALIDATION_ERROR", "Nombre visible inválido (debe tener entre 2 y 60 caracteres)");
    }

    const cleanName = display_name.trim();
    
    const participants = getSheetData("Participants");
    const nameLower = cleanName.toLowerCase();
    
    for (let p of participants) {
      if (p.display_name && p.display_name.trim().toLowerCase() === nameLower) {
        return buildErrorResponse("VALIDATION_ERROR", "El nombre ya está en uso");
      }
    }
    
    let baseSlug = cleanName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!baseSlug) baseSlug = "user";
    
    let slug = baseSlug;
    let counter = 2;
    while (participants.find(p => p.user_id === slug)) {
      slug = baseSlug + "-" + counter;
      counter++;
    }
    
    const pinLength = config.pin_length || 4;
    let pin = "";
    for (let i=0; i<pinLength; i++) {
      pin += Math.floor(Math.random() * 10).toString();
    }
    
    const serverTime = new Date();
    
    const sheetPart = getSpreadsheet().getSheetByName("Participants");
    if (!sheetPart) return buildErrorResponse("SERVER_ERROR", "No existe la hoja Participants");
    
    const dataRange = sheetPart.getDataRange().getValues();
    const headers = dataRange.length > 0 ? dataRange[0] : ["user_id", "display_name", "pin", "active", "created_at", "notes"];
    
    const newRow = new Array(headers.length).fill("");
    
    const newParticipantObj = {
      user_id: slug,
      display_name: cleanName,
      pin: pin,
      active: true,
      created_at: serverTime.toISOString(),
      notes: "self_registered"
    };

    headers.forEach((h, i) => {
      if (newParticipantObj[h] !== undefined) {
        newRow[i] = newParticipantObj[h];
      }
    });
    
    sheetPart.appendRow(newRow);
    
    logAction(slug, "REGISTER_PARTICIPANT", `Registrado desde web con nombre ${cleanName}`, serverTime);
    
    try {
      updateRankingsInSheetsUnsafe();
    } catch(e) {
      markRankingsDirty("registerParticipant_error");
    }
    
    return buildSuccessResponse({
      code: "REGISTERED",
      message: "Participante creado correctamente",
      participant: newParticipantObj
    });

  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// UTILS
// ==========================================

const SPREADSHEET_ID = "";

function getSpreadsheet() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function normalizeId(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function isFilledGoal(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function getSheetData(sheetName) {
  const ss = getSpreadsheet();
  if (!ss) throw new Error("No se pudo acceder a la hoja de cálculo. Por favor configura SPREADSHEET_ID en Code.gs");
  
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const range = sheet.getDataRange();
  const data = range.getValues();
  const displayData = range.getDisplayValues();
  if (data.length < 2) return [];
  const headers = data[0];
  const stringColumns = ['user_id', 'match_id', 'month_id', 'active_month_id', 'rule_id', 'status'];
  
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    let obj = {};
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      if (stringColumns.includes(header)) {
        obj[header] = displayData[i][j];
      } else {
        obj[header] = data[i][j];
      }
    }
    rows.push(obj);
  }
  return rows;
}

function getConfigMap() {
  const configRows = getSheetData("Config");
  let config = {};
  configRows.forEach(r => {
    let val = r.value;
    if (val === "true" || val === true) val = true;
    else if (val === "false" || val === false) val = false;
    config[r.key] = val;
  });
  return config;
}

function setConfigValue(key, value, description) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName("Config");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(String(value));
      if (description) sheet.getRange(i + 1, 3).setValue(description);
      return;
    }
  }
  sheet.appendRow([key, String(value), description || ""]);
}

function markRankingsDirty(reason) {
  setConfigValue("ranking_dirty", "true", "Indica si el ranking necesita recálculo");
  setConfigValue("ranking_dirty_reason", reason || "unknown", "Motivo del estado dirty");
  setConfigValue("ranking_dirty_at", new Date().toISOString(), "Fecha en que se marcó sucio");
}

function markRankingsClean() {
  setConfigValue("ranking_dirty", "false", "Indica si el ranking necesita recálculo");
  setConfigValue("ranking_last_recalc_at", new Date().toISOString(), "Fecha del último recálculo");
}

function getRankingDiagnostics() {
  const config = getConfigMap();
  const participants = getSheetData("Participants").filter(p => p.active === true || p.active === "true" || p.active === "TRUE");
  const monthly = getSheetData("Ranking_Monthly");
  const global = getSheetData("Ranking_Global");
  const results = getSheetData("Results").filter(r => r.home_goals !== "" && r.home_goals !== undefined && r.away_goals !== "" && r.away_goals !== undefined);
  const predictions = getSheetData("Predictions_Current");
  return {
    ranking_dirty: config.ranking_dirty === true,
    ranking_dirty_reason: config.ranking_dirty_reason || "-",
    ranking_last_recalc_at: config.ranking_last_recalc_at || "-",
    active_month_id: config.active_month_id,
    active_participants: participants.length,
    missing_in_monthly: monthly.length < participants.length,
    missing_in_global: global.length < participants.length,
    results_count: results.length,
    predictions_count: predictions.length
  };
}

function logAction(userId, action, details, serverTime) {
  try {
    const sheetLog = getSpreadsheet().getSheetByName("Predictions_Log");
    if (sheetLog) {
      sheetLog.appendRow([serverTime.toISOString(), userId, action, details]);
    }
  } catch (e) {
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

function updateRankingsInSheets() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error("Sistema ocupado calculando rankings (timeout).");
  }
  try {
    updateRankingsInSheetsUnsafe();
  } finally {
    lock.releaseLock();
  }
}

function updateRankingsInSheetsUnsafe() {
  const configRows = getSheetData("Config");
  let config = {};
  configRows.forEach(r => config[r.key] = r.value);

  const participants = getSheetData("Participants").map(p => {
    p.active = (p.active === true || p.active === "true" || p.active === "TRUE");
    return p;
  });

  const activeMonthId = normalizeId(config.active_month_id);
  const matches = getSheetData("Matches");
  const results = getSheetData("Results");
  let scoringRules = getSheetData("Scoring_Rules");

  const requiredRules = {
    exact_draw: { description: "Resultado exacto con empate", points: 20 },
    exact_non_draw: { description: "Resultado exacto sin empate", points: 15 },
    draw_not_exact: { description: "Empate acertado no exacto", points: 10 },
    winner_not_exact: { description: "Ganador acertado no exacto", points: 5 },
    wrong: { description: "Fallo", points: 0 }
  };
  const rulesMap = {};
  scoringRules.forEach(r => rulesMap[normalizeId(r.rule_id)] = r);
  for (let key in requiredRules) {
    if (!rulesMap[key] || rulesMap[key].active === false || rulesMap[key].active === "false") {
      let existingIndex = scoringRules.findIndex(r => normalizeId(r.rule_id) === key);
      let newRule = { rule_id: key, points: requiredRules[key].points, active: true };
      if (existingIndex >= 0) scoringRules[existingIndex] = newRule;
      else scoringRules.push(newRule);
    }
  }

  const currentPredictions = getSheetData("Predictions_Current");

  const rankingMonthly = buildMonthlyRanking(participants, matches, currentPredictions, results, scoringRules, activeMonthId, config);
  const rankingGlobal = buildGlobalRanking(participants, matches, currentPredictions, results, scoringRules, config);

  const timestamp = new Date().toISOString();

  const monthlyRows = rankingMonthly.map(r => ({
      month_id: activeMonthId,
      user_id: r.user_id,
      display_name: r.display_name,
      points: r.points,
      exact_scores: r.exact_scores,
      correct_signs: r.correct_signs,
      failed: r.failed,
      played_matches: r.played_matches,
      position: r.position,
      updated_at: timestamp
  }));

  const globalRows = rankingGlobal.map(r => ({
      user_id: r.user_id,
      display_name: r.display_name,
      total_points: r.total_points,
      months_played: r.months_played,
      monthly_wins: r.monthly_wins || 0,
      exact_scores: r.exact_scores,
      correct_signs: r.correct_signs,
      position: r.position,
      updated_at: timestamp
  }));

  const monthlyHeaders = ["month_id", "user_id", "display_name", "points", "exact_scores", "correct_signs", "failed", "played_matches", "position", "updated_at"];
  const globalHeaders = ["user_id", "display_name", "total_points", "months_played", "monthly_wins", "exact_scores", "correct_signs", "position", "updated_at"];

  writeSheetRows("Ranking_Monthly", monthlyRows, monthlyHeaders);
  writeSheetRows("Ranking_Global", globalRows, globalHeaders);
  
  markRankingsClean();
}

function writeSheetRows(sheetName, rows, headers) {
    const ss = getSpreadsheet();
    if (!ss) throw new Error("No se pudo acceder a la hoja de cálculo.");
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error("No existe la hoja " + sheetName);
    
    const existingData = sheet.getDataRange().getValues();
    if (existingData.length === 0) throw new Error("La hoja " + sheetName + " está vacía, faltan cabeceras.");
    
    const actualHeaders = existingData[0];
    if (actualHeaders.join(",") !== headers.join(",")) {
        throw new Error("Las cabeceras de " + sheetName + " no coinciden con las esperadas. Esperadas: " + headers.join(",") + ". Encontradas: " + actualHeaders.join(","));
    }
    
    if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
    
    if (rows.length === 0) return;
    
    const dataToWrite = rows.map(rowObj => {
        return headers.map(h => rowObj[h] !== undefined ? rowObj[h] : "");
    });
    
    const targetRange = sheet.getRange(2, 1, dataToWrite.length, headers.length);
    if (sheetName === "Ranking_Monthly") {
        sheet.getRange(2, 1, dataToWrite.length, 2).setNumberFormat("@");
    } else if (sheetName === "Ranking_Global") {
        sheet.getRange(2, 1, dataToWrite.length, 1).setNumberFormat("@");
    }
    targetRange.setValues(dataToWrite);
}

function validateAdminToken(params, config) {
  if (config.debug_endpoints_enabled !== true && config.debug_endpoints_enabled !== "true") {
    return false;
  }
  if (!config.admin_token || String(config.admin_token).trim() === "") {
    return false;
  }
  if (String(params.admin_token) !== String(config.admin_token)) {
    return false;
  }
  return true;
}

function actionRecalculateRankings(params) {
  const configRows = getSheetData("Config");
  let config = {};
  configRows.forEach(r => config[r.key] = r.value);

  if (!validateAdminToken(params, config)) {
    return buildErrorResponse("UNAUTHORIZED", "Acción admin no autorizada");
  }

  updateRankingsInSheets();
  
  const rankingMonthly = getSheetData("Ranking_Monthly");
  const rankingGlobal = getSheetData("Ranking_Global");
  
  return buildSuccessResponse({
    code: "RECALCULATED",
    message: "Rankings recalculados exitosamente",
    backend_version: "ranking-force-bootstrap-20260713-ULTIMA",
    rankingMonthly: rankingMonthly,
    rankingGlobal: rankingGlobal
  });
}

function actionDebugLiveRanking(params) {
  const configRows = getSheetData("Config");
  let config = {};
  configRows.forEach(r => {
    let val = r.value;
    if (val === "true" || val === true) val = true;
    else if (val === "false" || val === false) val = false;
    config[r.key] = val;
  });

  if (!validateAdminToken(params, config)) {
    return buildErrorResponse("UNAUTHORIZED", "Acción admin no autorizada");
  }

  const participants = getSheetData("Participants").map(p => {
    p.active = (p.active === true || p.active === "true" || p.active === "TRUE");
    return p;
  });
  
  const activeMonthId = normalizeId(config.active_month_id);
  const matches = getSheetData("Matches");
  const results = getSheetData("Results");
  let scoringRules = getSheetData("Scoring_Rules");
  const currentPredictions = getSheetData("Predictions_Current");
  
  const requiredRules = {
    exact_draw: { description: "Resultado exacto con empate", points: 20 },
    exact_non_draw: { description: "Resultado exacto sin empate", points: 15 },
    draw_not_exact: { description: "Empate acertado no exacto", points: 10 },
    winner_not_exact: { description: "Ganador acertado no exacto", points: 5 },
    wrong: { description: "Fallo", points: 0 }
  };
  const rulesMap = {};
  scoringRules.forEach(r => rulesMap[normalizeId(r.rule_id)] = r);
  for (let key in requiredRules) {
    if (!rulesMap[key] || rulesMap[key].active === false || rulesMap[key].active === "false") {
      let existingIndex = scoringRules.findIndex(r => normalizeId(r.rule_id) === key);
      let newRule = { rule_id: key, points: requiredRules[key].points, active: true };
      if (existingIndex >= 0) scoringRules[existingIndex] = newRule;
      else scoringRules.push(newRule);
    }
  }

  const liveMonthly = buildMonthlyRanking(participants, matches, currentPredictions, results, scoringRules, activeMonthId, config);
  const liveGlobal = buildGlobalRanking(participants, matches, currentPredictions, results, scoringRules, config);
  
  const persistedMonthly = getSheetData("Ranking_Monthly");
  const persistedGlobal = getSheetData("Ranking_Global");
  
  let scoringDebug = [];
  
  const matchIdToDebug = params.match_id ? normalizeId(params.match_id) : "m001";
  const resultToDebug = results.find(r => normalizeId(r.match_id) === matchIdToDebug);
  
  if (resultToDebug) {
    const debugPreds = currentPredictions.filter(p => normalizeId(p.match_id) === matchIdToDebug);
    debugPreds.forEach(p => {
      const scoreObj = scorePrediction(p, resultToDebug, scoringRules);
      scoringDebug.push({
        user_id: p.user_id,
        rule_id: scoreObj.rule_id,
        points: scoreObj.points
      });
    });
  }

  const diag = getRankingDiagnostics();

  return buildSuccessResponse({
    code: "DEBUG_LIVE_RANKING",
    backend_version: "ranking-force-bootstrap-20260713-ULTIMA",
    liveMonthly: liveMonthly,
    liveGlobal: liveGlobal,
    persistedMonthly: persistedMonthly,
    persistedGlobal: persistedGlobal,
    scoringDebug: scoringDebug,
    ranking_dirty: diag.ranking_dirty,
    ranking_last_recalc_at: diag.ranking_last_recalc_at
  });
}
