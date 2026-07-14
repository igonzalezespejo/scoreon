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
      .addItem('Diagnóstico Migración Multi-mes', 'menuMigrateDryRun')
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

function menuMigrateDryRun() {
  try {
    const matches = getSheetData("Matches");
    const currentPredictions = getSpreadsheet().getSheetByName("Predictions_Current").getDataRange().getValues();
    const results = getSpreadsheet().getSheetByName("Results").getDataRange().getValues();
    
    let matchesToMigrate = 0;
    let predsMissingMonth = 0;
    let resultsMissingMonth = 0;
    
    matches.forEach(m => {
      let mId = normalizeId(m.match_id);
      if (mId && !mId.includes("-m0")) {
        matchesToMigrate++;
      }
    });
    
    const predHeaders = currentPredictions.length > 0 ? currentPredictions[0].map(h => String(h).trim().toLowerCase()) : [];
    if (!predHeaders.includes("month_id")) {
      predsMissingMonth = currentPredictions.length > 1 ? currentPredictions.length - 1 : 0;
    } else {
      let idxMonth = predHeaders.indexOf("month_id");
      for (let i = 1; i < currentPredictions.length; i++) {
        if (!normalizeId(currentPredictions[i][idxMonth])) predsMissingMonth++;
      }
    }
    
    const resHeaders = results.length > 0 ? results[0].map(h => String(h).trim().toLowerCase()) : [];
    if (!resHeaders.includes("month_id")) {
      resultsMissingMonth = results.length > 1 ? results.length - 1 : 0;
    } else {
      let idxMonth = resHeaders.indexOf("month_id");
      for (let i = 1; i < results.length; i++) {
        if (!normalizeId(results[i][idxMonth])) resultsMissingMonth++;
      }
    }
    
    let msg = `DIAGNÓSTICO MIGRACIÓN MULTI-MES\n\n`;
    msg += `Partidos con match_id legacy (ej. m001 en lugar de 2026-08-m001): ${matchesToMigrate}\n`;
    msg += `Predicciones sin month_id (o con columna faltante): ${predsMissingMonth}\n`;
    msg += `Resultados sin month_id (o con columna faltante): ${resultsMissingMonth}\n\n`;
    msg += `Si hay valores mayores a 0, necesitas hacer la migración manual en la hoja de cálculo.`;
    
    SpreadsheetApp.getUi().alert('Diagnóstico de Migración', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch(e) {
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
      case "bootstrapLight":
        return actionBootstrapLight();
      case "monthData":
        return actionMonthData(params);
      case "rankings":
        return actionRankings();
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
      case "adminGetMonths":
        return actionAdminGetMonths(params);
      case "adminGetMonthMatches":
        return actionAdminGetMonthMatches(params);
      case "adminSaveResults":
        return actionAdminSaveResults(params);
      case "adminSetMonthStatus":
        return actionAdminSetMonthStatus(params);
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

function buildMonthTitle(monthId) {
    if (!monthId) return 'Mes activo';
    const parts = String(monthId).split('-');
    if (parts.length !== 2) return monthId;
    const year = parts[0];
    const month = parseInt(parts[1], 10);
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    if (month >= 1 && month <= 12) {
        return months[month - 1] + ' ' + year;
    }
    return monthId;
}

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

function buildMonthlyRanking(participants, matches, predictionsCurrent, results, scoringRules, config = {}) {
    const rankingMap = {};
    
    const resultMap = {};
    results.forEach(r => resultMap[normalizeId(r.match_id)] = r);

    const matchMap = {};
    const matchToMonth = {};
    matches.forEach(m => {
        let mId = normalizeId(m.match_id);
        let monthId = normalizeId(m.month_id);
        matchMap[mId] = m;
        matchToMonth[mId] = monthId;
        
        participants.forEach(p => {
            if (p.active) {
                let key = monthId + "_" + normalizeId(p.user_id);
                if (!rankingMap[key]) {
                    rankingMap[key] = {
                        month_id: monthId,
                        user_id: normalizeId(p.user_id),
                        display_name: p.display_name,
                        points: 0,
                        s1_points: 0,
                        s2_points: 0,
                        s3_points: 0,
                        s4_points: 0,
                        exact_scores: 0,
                        correct_signs: 0,
                        failed: 0,
                        played_matches: 0
                    };
                }
            }
        });
    });

    predictionsCurrent.forEach(pred => {
        const matchId = normalizeId(pred.match_id);
        const monthId = matchToMonth[matchId];
        if (!monthId) return;
        
        const participantId = normalizeId(pred.user_id);
        const result = resultMap[matchId];
        const match = matchMap[matchId];

        if (!result || !match) return;
        let key = monthId + "_" + participantId;
        const rankEntry = rankingMap[key];
        if (!rankEntry) return;

        const scoreObj = scorePrediction(pred, result, scoringRules);
        if (!scoreObj.computable) return;

        let weekNo = match.week_no;
        if (!weekNo || isNaN(parseInt(weekNo))) {
            let displayOrder = parseInt(match.display_order) || 1;
            weekNo = Math.ceil(displayOrder / 6);
        } else {
            weekNo = parseInt(weekNo);
        }
        if (weekNo > 4) weekNo = 4;
        if (weekNo < 1) weekNo = 1;

        rankEntry.played_matches += 1;
        rankEntry.points += scoreObj.points;
        rankEntry[`s${weekNo}_points`] += scoreObj.points;

        if (scoreObj.rule_id === 'exact_draw' || scoreObj.rule_id === 'exact_non_draw') {
            rankEntry.exact_scores += 1;
        } else if (scoreObj.rule_id === 'draw_not_exact' || scoreObj.rule_id === 'winner_not_exact') {
            rankEntry.correct_signs += 1;
        } else if (scoreObj.rule_id === 'wrong') {
            rankEntry.failed += 1;
        }
    });

    const monthsObj = {};
    Object.values(rankingMap).forEach(r => {
       if (!monthsObj[r.month_id]) monthsObj[r.month_id] = [];
       monthsObj[r.month_id].push(r);
    });

    let finalArr = [];
    Object.keys(monthsObj).forEach(mId => {
        let arr = monthsObj[mId];
        arr.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.exact_scores !== a.exact_scores) return b.exact_scores - a.exact_scores;
            if (b.correct_signs !== a.correct_signs) return b.correct_signs - a.correct_signs;
            const aName = a.display_name || '';
            const bName = b.display_name || '';
            return aName.localeCompare(bName);
        });
        arr.forEach((r, i) => r.position = i + 1);
        finalArr = finalArr.concat(arr);
    });

    return finalArr;
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
  const startTotal = Date.now();
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
  const userPredictions = currentPredictions.filter(p => {
    if (p.user_id !== user_id) return false;
    if (p.month_id) {
      if (normalizeId(p.month_id) !== normalizeId(month_id)) return false;
    }
    return matchIds.includes(String(p.match_id));
  });

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
    predictions: predictions,
    debug: { timings: { total_ms: Date.now() - startTotal } }
  });
}

function actionBootstrap() {
  const startTotal = Date.now();
  let startReadConfig = Date.now();
  const configRows = getSheetData("Config");
  let config = {};
  configRows.forEach(r => {
    let val = r.value;
    if (val === "true" || val === true) val = true;
    else if (val === "false" || val === false) val = false;
    config[r.key] = val;
  });
  let readConfigMs = Date.now() - startReadConfig;

  let startReadCore = Date.now();
  const participants = getSheetData("Participants").map(p => {
    delete p.pin;
    delete p.email;
    p.active = (p.active === true || p.active === "true" || p.active === "TRUE");
    return p;
  });

  const activeMonthId = normalizeMonthId(config.active_month_id);
  const months = getSheetData("Months").map(m => {
    m.month_id = normalizeMonthId(m.month_id);
    return m;
  });
  
  let activeMonth = months.find(m => m.month_id === activeMonthId) || null;
  if (activeMonth) {
    activeMonth.month_id = activeMonthId;
    activeMonth.title = sanitizeMonthTitle(activeMonth.title, activeMonthId);
  }

  const matches = getSheetData("Matches").map(m => {
    m.month_id = normalizeMonthId(m.month_id);
    return m;
  });
  const activeMatches = matches.filter(m => m.month_id === activeMonthId);
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

  let readCoreMs = Date.now() - startReadCore;

  let rankingMonthly = [];
  let rankingGlobal = [];
  
  let debugInfo = {
    ranking_recalculated: false,
    ranking_recalc_reason: "",
    ranking_last_recalc_at: null,
    ranking_monthly_rows: 0,
    ranking_global_rows: 0,
    timings: {
      read_config_ms: readConfigMs,
      read_core_data_ms: readCoreMs,
      recalc_rankings_ms: 0,
      read_rankings_ms: 0,
      total_ms: 0
    }
  };

  let startReadRankings = Date.now();
  rankingMonthly = getSheetData("Ranking_Monthly").map(r => {
    if (r.month_id !== undefined) r.month_id = normalizeMonthId(r.month_id);
    return r;
  });
  rankingGlobal = getSheetData("Ranking_Global");
  debugInfo.timings.read_rankings_ms = Date.now() - startReadRankings;

  let forceRecalc = config.testing_force_recalc_on_bootstrap === true;
  let isDirty = config.ranking_dirty === true || config.ranking_dirty === "true";
  
  let isMissingParticipants = false;
  let activeParticipantIds = participants.filter(p => p.active).map(p => normalizeId(p.user_id));
  let monthlyParticipantIds = rankingMonthly.map(r => normalizeId(r.user_id));
  let globalParticipantIds = rankingGlobal.map(r => normalizeId(r.user_id));
  
  for (let pid of activeParticipantIds) {
    if (!monthlyParticipantIds.includes(pid) || !globalParticipantIds.includes(pid)) {
      isMissingParticipants = true;
      break;
    }
  }

  let isEmpty = rankingMonthly.length === 0 || rankingGlobal.length === 0;

  if (forceRecalc || isDirty || isEmpty || isMissingParticipants) {
      let startRecalc = Date.now();
      try {
          updateRankingsInSheets(); 
          rankingMonthly = getSheetData("Ranking_Monthly").map(r => {
            if (r.month_id !== undefined) r.month_id = normalizeMonthId(r.month_id);
            return r;
          });
          rankingGlobal = getSheetData("Ranking_Global");
          debugInfo.ranking_recalculated = true;
          
          if (forceRecalc) {
              debugInfo.ranking_recalc_reason = "testing_force_recalc_on_bootstrap";
          } else if (isDirty) {
              debugInfo.ranking_recalc_reason = "ranking_dirty";
          } else if (isEmpty) {
              debugInfo.ranking_recalc_reason = "rankings_empty";
          } else {
              debugInfo.ranking_recalc_reason = "missing_participants";
          }
          debugInfo.ranking_last_recalc_at = new Date().toISOString();
      } catch(e) {
          rankingMonthly = buildMonthlyRanking(participants, matches, currentPredictions, results, scoringRules, config);
          rankingGlobal = buildGlobalRanking(participants, matches, currentPredictions, results, scoringRules, config);
          debugInfo.ranking_recalculated = false;
          debugInfo.ranking_recalc_reason = "persist_failed_live_fallback: " + e.message;
      }
      debugInfo.timings.recalc_rankings_ms = Date.now() - startRecalc;
  } else {
      debugInfo.ranking_recalculated = false;
      debugInfo.ranking_recalc_reason = "none";
  }

  debugInfo.ranking_monthly_rows = rankingMonthly.length;
  debugInfo.ranking_global_rows = rankingGlobal.length;
  debugInfo.timings.total_ms = Date.now() - startTotal;

  const responsePayload = {
    code: "SUCCESS",
    message: "Data loaded",
    backend_version: "ranking-force-bootstrap-20260714-OPTIMIZED",
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

function actionBootstrapLight() {
  const startTotal = Date.now();
  let startReadConfig = Date.now();
  const configRows = getSheetData("Config");
  let config = {};
  configRows.forEach(r => {
    let val = r.value;
    if (val === "true" || val === true) val = true;
    else if (val === "false" || val === false) val = false;
    config[r.key] = val;
  });
  let readConfigMs = Date.now() - startReadConfig;

  let startReadCore = Date.now();
  const participants = getSheetData("Participants").map(p => {
    delete p.pin;
    delete p.email;
    p.active = (p.active === true || p.active === "true" || p.active === "TRUE");
    return p;
  });

  const raw_config_active_month_id = config.active_month_id;
  const activeMonthId = normalizeMonthId(config.active_month_id);
  const months = getSheetData("Months").map(m => {
    m.month_id = normalizeMonthId(m.month_id);
    return m;
  });
  
  let activeMonth = months.find(m => m.month_id === activeMonthId) || null;
  let active_month_raw_title = "";
  if (activeMonth) {
    active_month_raw_title = activeMonth.title;
    activeMonth.month_id = activeMonthId;
    activeMonth.title = sanitizeMonthTitle(activeMonth.title, activeMonthId);
  }

  const matches = getSheetData("Matches").map(m => {
    m.month_id = normalizeMonthId(m.month_id);
    return m;
  });
  const activeMatches = matches.filter(m => m.month_id === activeMonthId);
  const currentPredictions = getSheetData("Predictions_Current");

  const monthMatchesCount = activeMatches.length;
  const activeMonthMatchIds = activeMatches.map(m => normalizeId(m.match_id));
  const allResults = getSheetData("Results");
  const activeMonthResults = allResults.filter(r => activeMonthMatchIds.includes(normalizeId(r.match_id)));

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

  let readCoreMs = Date.now() - startReadCore;

  let debugInfo = {
    light: true,
    month_resolution: {
      raw_config_active_month_id: String(raw_config_active_month_id),
      normalized_active_month_id: activeMonthId,
      active_month_raw_title: String(active_month_raw_title),
      active_month_final_title: activeMonth ? activeMonth.title : ""
    },
    timings: {
      read_config_ms: readConfigMs,
      read_core_ms: readCoreMs,
      total_ms: Date.now() - startTotal
    }
  };

  return buildSuccessResponse({
    code: "SUCCESS",
    message: "Light data loaded",
    backend_version: "ranking-force-bootstrap-20260714-OPTIMIZED",
    config: config,
    months: months,
    activeMonth: activeMonth,
    participants: participants,
    matches: activeMatches,
    predictionsSummary: predictionsSummary,
    results: activeMonthResults,
    debug: debugInfo
  });
}

function actionMonthData(params) {
  const startTotal = Date.now();
  const reqMonthId = normalizeId(params.month_id);
  if (!reqMonthId) {
    return buildErrorResponse("VALIDATION_ERROR", "Falta month_id");
  }

  const months = getSheetData("Months").map(m => {
    m.month_id = normalizeMonthId(m.month_id);
    return m;
  });
  
  let month = months.find(m => m.month_id === reqMonthId) || null;
  if (!month) {
    return buildErrorResponse("NOT_FOUND", "Mes no encontrado");
  }
  month.title = sanitizeMonthTitle(month.title, month.month_id);

  const participants = getSheetData("Participants").map(p => {
    delete p.pin;
    delete p.email;
    p.active = (p.active === true || p.active === "true" || p.active === "TRUE");
    return p;
  });

  const matches = getSheetData("Matches").map(m => {
    m.month_id = normalizeMonthId(m.month_id);
    return m;
  });
  const monthMatches = matches.filter(m => m.month_id === reqMonthId);
  const monthMatchesCount = monthMatches.length;
  const monthMatchIds = monthMatches.map(m => normalizeId(m.match_id));

  const allResults = getSheetData("Results");
  const monthResults = allResults.filter(r => monthMatchIds.includes(normalizeId(r.match_id)));

  const currentPredictions = getSheetData("Predictions_Current");
  
  const userBetCounts = {};
  participants.forEach(p => userBetCounts[p.user_id] = { count: 0, latest_date: null });

  currentPredictions.forEach(p => {
    if (monthMatchIds.includes(normalizeId(p.match_id))) {
       let uId = normalizeId(p.user_id);
       if (userBetCounts[uId]) {
           userBetCounts[uId].count++;
           let newSub = new Date(p.submitted_at);
           let currentSub = userBetCounts[uId].latest_date ? new Date(userBetCounts[uId].latest_date) : new Date(0);
           if (newSub > currentSub) {
               userBetCounts[uId].latest_date = p.submitted_at;
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

  return buildSuccessResponse({
    code: "MONTH_DATA_LOADED",
    month: month,
    matches: monthMatches,
    results: monthResults,
    predictionsSummary: predictionsSummary,
    debug: { total_ms: Date.now() - startTotal }
  });
}

function actionRankings() {
  const startTotal = Date.now();
  let startReadConfig = Date.now();
  
  const configRows = getSheetData("Config");
  let config = {};
  configRows.forEach(r => {
    let val = r.value;
    if (val === "true" || val === true) val = true;
    else if (val === "false" || val === false) val = false;
    config[r.key] = val;
  });
  let readConfigMs = Date.now() - startReadConfig;

  let rankingMonthly = [];
  let rankingGlobal = [];
  
  let debugInfo = {
    rankings: true,
    ranking_recalculated: false,
    ranking_recalc_reason: "none",
    timings: {
      read_config_ms: readConfigMs,
      recalc_rankings_ms: 0,
      read_rankings_ms: 0,
      total_ms: 0
    }
  };

  let startReadRankings = Date.now();
  rankingMonthly = getSheetData("Ranking_Monthly").map(r => {
    if (r.month_id !== undefined) r.month_id = normalizeMonthId(r.month_id);
    return r;
  });
  rankingGlobal = getSheetData("Ranking_Global");
  debugInfo.timings.read_rankings_ms = Date.now() - startReadRankings;

  let forceRecalc = config.testing_force_recalc_on_bootstrap === true;
  let isDirty = config.ranking_dirty === true || config.ranking_dirty === "true";
  
  let isMissingParticipants = false;
  const participants = getSheetData("Participants").map(p => {
    p.active = (p.active === true || p.active === "true" || p.active === "TRUE");
    return p;
  });
  
  let activeParticipantIds = participants.filter(p => p.active).map(p => normalizeId(p.user_id));
  let monthlyParticipantIds = rankingMonthly.map(r => normalizeId(r.user_id));
  let globalParticipantIds = rankingGlobal.map(r => normalizeId(r.user_id));
  
  for (let pid of activeParticipantIds) {
    if (!monthlyParticipantIds.includes(pid) || !globalParticipantIds.includes(pid)) {
      isMissingParticipants = true;
      break;
    }
  }

  let isEmpty = rankingMonthly.length === 0 || rankingGlobal.length === 0;

  if (forceRecalc || isDirty || isEmpty || isMissingParticipants) {
      let startRecalc = Date.now();
      try {
          updateRankingsInSheets(); 
          rankingMonthly = getSheetData("Ranking_Monthly").map(r => {
            if (r.month_id !== undefined) r.month_id = normalizeMonthId(r.month_id);
            return r;
          });
          rankingGlobal = getSheetData("Ranking_Global");
          debugInfo.ranking_recalculated = true;
          
          if (forceRecalc) {
              debugInfo.ranking_recalc_reason = "testing_force_recalc_on_bootstrap";
          } else if (isDirty) {
              debugInfo.ranking_recalc_reason = "ranking_dirty";
          } else if (isEmpty) {
              debugInfo.ranking_recalc_reason = "rankings_empty";
          } else {
              debugInfo.ranking_recalc_reason = "missing_participants";
          }
      } catch(e) {
          debugInfo.ranking_recalculated = false;
          debugInfo.ranking_recalc_reason = "persist_failed_live_fallback: " + e.message;
          const activeMonthId = normalizeId(config.active_month_id);
          const matches = getSheetData("Matches");
          const results = getSheetData("Results");
          const scoringRules = getSheetData("Scoring_Rules");
          const currentPredictions = getSheetData("Predictions_Current");
          rankingMonthly = buildMonthlyRanking(participants, matches, currentPredictions, results, scoringRules, config);
          rankingGlobal = buildGlobalRanking(participants, matches, currentPredictions, results, scoringRules, config);
      }
      debugInfo.timings.recalc_rankings_ms = Date.now() - startRecalc;
  }

  debugInfo.timings.total_ms = Date.now() - startTotal;

  return buildSuccessResponse({
    code: "SUCCESS",
    message: "Rankings loaded",
    backend_version: "ranking-force-bootstrap-20260714-OPTIMIZED",
    rankingMonthly: rankingMonthly,
    rankingGlobal: rankingGlobal,
    debug: debugInfo
  });
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
        month_id: month_id,
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
      currentData = [["month_id", "user_id", "match_id", "home_goals", "away_goals", "submitted_at"]];
    }
    
    const headers = currentData[0].map(h => String(h).trim().toLowerCase());
    const monthIdx = headers.indexOf("month_id");
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
      const rMonth = monthIdx >= 0 ? normalizeId(row[monthIdx]) : null;
      
      // En legacy no hay month_id, pero el match_id ya lo identificaba si era m001.
      // Si estamos actualizando, borramos la fila antigua si coincide user y match.
      // También podríamos comprobar month_id, pero match_id debe ser único.
      if (rUser === user_id && updatingMatchIds.includes(rMatch)) {
        continue; 
      }
      newData.push(row);
    }

    for (let vp of validPredictionsToSave) {
      let newRow = new Array(headers.length).fill("");
      if (monthIdx >= 0) newRow[monthIdx] = vp.month_id;
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
      if (config.recalculate_after_prediction === true || config.recalculate_after_prediction === "true") {
        updateRankingsInSheetsUnsafe();
      } else {
        const results = getSheetData("Results");
        let hasValidResultForMonth = false;
        for (let r of results) {
          if (matchMap[r.match_id] && isFilledGoal(r.home_goals) && isFilledGoal(r.away_goals)) {
            let resultStatus = String(r.status || "").toLowerCase().trim();
            if (resultStatus !== 'cancelled' && resultStatus !== 'cancelado') {
                hasValidResultForMonth = true;
                break;
            }
          }
        }
        if (hasValidResultForMonth) {
          markRankingsDirty("savePrediction_with_results");
        }
      }
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
    const { display_name, email, registration_code } = params;
    
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

    if (!email || typeof email !== "string") {
      return buildErrorResponse("VALIDATION_ERROR", "El email es obligatorio");
    }
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return buildErrorResponse("VALIDATION_ERROR", "Formato de email inválido");
    }

    const cleanName = display_name.trim();
    
    const participants = getSheetData("Participants");
    const nameLower = cleanName.toLowerCase();
    
    for (let p of participants) {
      if (p.display_name && p.display_name.trim().toLowerCase() === nameLower) {
        return buildErrorResponse("VALIDATION_ERROR", "El nombre ya está en uso");
      }
      if (p.email && p.email.trim().toLowerCase() === cleanEmail) {
        return buildErrorResponse("VALIDATION_ERROR", "El email ya está en uso");
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
    let randomNumber = Math.floor(Math.random() * Math.pow(10, pinLength));
    const pin = String(randomNumber).padStart(pinLength, "0");
    
    const serverTime = new Date();
    
    const sheetPart = getSpreadsheet().getSheetByName("Participants");
    if (!sheetPart) return buildErrorResponse("SERVER_ERROR", "No existe la hoja Participants");
    
    const dataRange = sheetPart.getDataRange().getValues();
    const headers = dataRange.length > 0 ? dataRange[0] : ["user_id", "display_name", "email", "pin", "active", "created_at", "notes"];
    
    if (!headers.includes("email")) {
      return buildErrorResponse("SHEET_SCHEMA_ERROR", "Falta la columna email en Participants");
    }
    
    const newRow = new Array(headers.length).fill("");
    
    const newParticipantObj = {
      user_id: slug,
      display_name: cleanName,
      email: cleanEmail,
      pin: pin,
      active: true,
      created_at: serverTime.toISOString(),
      notes: "self_registered"
    };

    headers.forEach((h, i) => {
      if (newParticipantObj[h] !== undefined) {
        newRow[i] = String(newParticipantObj[h]);
      }
    });
    
    const pinColIndex = headers.indexOf("pin") + 1;
    if (pinColIndex > 0) {
      sheetPart.getRange(1, pinColIndex, sheetPart.getMaxRows() || 1000, 1).setNumberFormat("@");
    }
    
    const newRowIndex = sheetPart.getLastRow() + 1;
    sheetPart.getRange(newRowIndex, 1, 1, headers.length).setValues([newRow]);
    
    logAction(slug, "REGISTER_PARTICIPANT", `Registrado desde web con nombre ${cleanName}`, serverTime);
    
    try {
      markRankingsDirty("registerParticipant");
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

function normalizeMonthId(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) {
    let tz = Session.getScriptTimeZone();
    try { tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone() || tz; } catch(e) {}
    return Utilities.formatDate(value, tz, "yyyy-MM");
  }
  let str = String(value).trim();
  if (/^\\d{4}-\\d{2}-\\d{2}T/.test(str)) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      let tz = Session.getScriptTimeZone();
      try { tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone() || tz; } catch(e) {}
      return Utilities.formatDate(d, tz, "yyyy-MM");
    }
  }
  return str;
}

function buildMonthTitleFromMonthId(monthId) {
  if (!monthId) return 'Mes activo';
  const parts = String(monthId).split('-');
  if (parts.length !== 2) return monthId;
  const year = parts[0];
  const month = parseInt(parts[1], 10);
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  if (month >= 1 && month <= 12) {
      return months[month - 1] + ' ' + year;
  }
  return monthId;
}

function sanitizeMonthTitle(title, monthId) {
  if (!title) return buildMonthTitleFromMonthId(monthId);
  if (title instanceof Date) return buildMonthTitleFromMonthId(monthId);
  let str = String(title).trim();
  if (/^\\d{4}-\\d{2}-\\d{2}T/.test(str) || /^\\d{4}-\\d{2}$/.test(str)) {
      return buildMonthTitleFromMonthId(monthId);
  }
  return str;
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

  const rankingMonthly = buildMonthlyRanking(participants, matches, currentPredictions, results, scoringRules, config);
  const rankingGlobal = buildGlobalRanking(participants, matches, currentPredictions, results, scoringRules, config);

  const timestamp = new Date().toISOString();

  const monthlyRows = rankingMonthly.map(r => ({
      month_id: r.month_id,
      user_id: r.user_id,
      display_name: r.display_name,
      points: r.points,
      s1_points: r.s1_points || 0,
      s2_points: r.s2_points || 0,
      s3_points: r.s3_points || 0,
      s4_points: r.s4_points || 0,
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

  const monthlyHeaders = ["month_id", "user_id", "display_name", "points", "s1_points", "s2_points", "s3_points", "s4_points", "exact_scores", "correct_signs", "failed", "played_matches", "position", "updated_at"];
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
    const missingCols = headers.filter(h => !actualHeaders.includes(h));
    if (missingCols.length > 0) {
        throw new Error(`Faltan columnas en ${sheetName}: ${missingCols.join(", ")}. Por favor, actualiza las cabeceras en Google Sheets.`);
    }
    
    if (sheet.getLastRow() > 1) {
        sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
    }
    
    if (rows.length === 0) return;
    
    const dataToWrite = rows.map(rowObj => {
        return actualHeaders.map(h => rowObj[h] !== undefined ? rowObj[h] : "");
    });
    
    const targetRange = sheet.getRange(2, 1, dataToWrite.length, actualHeaders.length);
    if (sheetName === "Ranking_Monthly") {
        const monthCol = actualHeaders.indexOf("month_id") + 1;
        const userCol = actualHeaders.indexOf("user_id") + 1;
        if (monthCol > 0) sheet.getRange(2, monthCol, dataToWrite.length, 1).setNumberFormat("@");
        if (userCol > 0) sheet.getRange(2, userCol, dataToWrite.length, 1).setNumberFormat("@");
    } else if (sheetName === "Ranking_Global") {
        const userCol = actualHeaders.indexOf("user_id") + 1;
        if (userCol > 0) sheet.getRange(2, userCol, dataToWrite.length, 1).setNumberFormat("@");
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

  const liveMonthly = buildMonthlyRanking(participants, matches, currentPredictions, results, scoringRules, config);
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

// ==========================================
// ADMIN ACTIONS
// ==========================================

function validateAdminToken(params, config) {
  if (config.admin_enabled !== true && config.admin_enabled !== "true") {
    return false;
  }
  if (!params.admin_token || params.admin_token !== config.admin_token) {
    return false;
  }
  return true;
}

function actionAdminGetMonths(params) {
  const config = getConfigMap();
  if (!validateAdminToken(params, config)) {
    return buildErrorResponse("UNAUTHORIZED", "Código admin incorrecto");
  }

  const months = getSheetData("Months").map(m => {
    m.month_id = normalizeMonthId(m.month_id);
    m.title = sanitizeMonthTitle(m.title, m.month_id);
    return m;
  });

  return buildSuccessResponse({
    code: "ADMIN_MONTHS",
    months: months,
    active_month_id: normalizeMonthId(config.active_month_id)
  });
}

function actionAdminGetMonthMatches(params) {
  const config = getConfigMap();
  if (!validateAdminToken(params, config)) {
    return buildErrorResponse("UNAUTHORIZED", "Código admin incorrecto");
  }

  const monthId = normalizeId(params.month_id);
  if (!monthId) return buildErrorResponse("VALIDATION_ERROR", "Falta month_id");

  const matches = getSheetData("Matches").filter(m => normalizeId(m.month_id) === monthId);
  const results = getSheetData("Results");
  
  const matchIds = matches.map(m => normalizeId(m.match_id));
  const monthResults = results.filter(r => matchIds.includes(normalizeId(r.match_id)));

  return buildSuccessResponse({
    code: "ADMIN_MATCHES",
    matches: matches,
    results: monthResults
  });
}

function actionAdminSaveResults(params) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const config = getConfigMap();
    if (!validateAdminToken(params, config)) {
      return buildErrorResponse("UNAUTHORIZED", "Código admin incorrecto");
    }

    const monthId = normalizeId(params.month_id);
    const resultsToSave = params.results;
    if (!monthId || !Array.isArray(resultsToSave)) {
      return buildErrorResponse("VALIDATION_ERROR", "Falta month_id o results");
    }

    const matches = getSheetData("Matches");
    const validMatchIds = matches.filter(m => normalizeId(m.month_id) === monthId).map(m => normalizeId(m.match_id));

    const ss = getSpreadsheet();
    const sheetResults = ss.getSheetByName("Results");
    if (!sheetResults) throw new Error("Pestaña Results no encontrada");

    const data = sheetResults.getDataRange().getValues();
    let headers = data[0].map(h => String(h).trim().toLowerCase());
    
    // Si no hay datos, inicializamos con headers default incluyendo month_id
    if (data.length === 1 && !headers.includes("match_id")) {
       headers = ["month_id", "match_id", "home_goals", "away_goals", "status", "updated_at", "updated_by", "notes"];
       sheetResults.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    const idxMonthId = headers.indexOf("month_id");
    const idxMatchId = headers.indexOf("match_id");
    const idxHomeGoals = headers.indexOf("home_goals");
    const idxAwayGoals = headers.indexOf("away_goals");
    const idxStatus = headers.indexOf("status");
    const idxUpdatedAt = headers.indexOf("updated_at");
    const idxUpdatedBy = headers.indexOf("updated_by");

    if (idxMatchId < 0) throw new Error("Schema Results inválido");

    const now = new Date().toISOString();
    let updatedCount = 0;

    resultsToSave.forEach(res => {
      const matchId = normalizeId(res.match_id);
      if (!validMatchIds.includes(matchId)) return;
      
      let status = String(res.status || "").toLowerCase().trim();
      if (!["pending", "final", "cancelled"].includes(status)) return;
      
      let hG = res.home_goals;
      let aG = res.away_goals;
      
      if (status === "final") {
        hG = parseInt(hG, 10);
        aG = parseInt(aG, 10);
        if (isNaN(hG) || hG < 0 || hG > 20 || isNaN(aG) || aG < 0 || aG > 20) {
          return; 
        }
      } else if (status === "pending" || status === "cancelled") {
        if (hG === "" || hG === null || hG === undefined) hG = "";
        if (aG === "" || aG === null || aG === undefined) aG = "";
      }

      let rowFound = -1;
      for (let i = 1; i < data.length; i++) {
        if (normalizeId(data[i][idxMatchId]) === matchId) {
          rowFound = i + 1;
          break;
        }
      }

      const rowData = [];
      headers.forEach(h => rowData.push(""));
      if (idxMonthId >= 0) rowData[idxMonthId] = monthId;
      rowData[idxMatchId] = matchId;
      rowData[idxHomeGoals] = hG;
      rowData[idxAwayGoals] = aG;
      rowData[idxStatus] = status;
      rowData[idxUpdatedAt] = now;
      rowData[idxUpdatedBy] = "admin_web";

      if (rowFound > 0) {
        sheetResults.getRange(rowFound, 1, 1, headers.length).setValues([rowData]);
      } else {
        sheetResults.appendRow(rowData);
      }
      updatedCount++;
    });

    logAction("admin", "SAVE_RESULTS", `Admin guardó ${updatedCount} resultados del mes ${monthId}`, new Date());

    updateRankingsInSheetsUnsafe();

    return buildSuccessResponse({
      code: "ADMIN_RESULTS_SAVED",
      message: `Se actualizaron ${updatedCount} resultados`,
      updatedCount: updatedCount
    });

  } catch (err) {
    return buildErrorResponse("SERVER_ERROR", "Error al guardar resultados: " + err.message);
  } finally {
    lock.releaseLock();
  }
}

function actionAdminSetMonthStatus(params) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const config = getConfigMap();
    if (!validateAdminToken(params, config)) {
      return buildErrorResponse("UNAUTHORIZED", "Código admin incorrecto");
    }

    const monthId = normalizeId(params.month_id);
    let status = String(params.status || "").toLowerCase().trim();
    
    if (!monthId || !["open", "locked"].includes(status)) {
      return buildErrorResponse("VALIDATION_ERROR", "Parámetros inválidos");
    }

    const ss = getSpreadsheet();
    const sheetMonths = ss.getSheetByName("Months");
    const data = sheetMonths.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim().toLowerCase());
    
    const idxMonthId = headers.indexOf("month_id");
    const idxStatus = headers.indexOf("status");

    let updated = false;
    for (let i = 1; i < data.length; i++) {
      if (normalizeId(data[i][idxMonthId]) === monthId) {
        sheetMonths.getRange(i + 1, idxStatus + 1).setValue(status);
        updated = true;
        break;
      }
    }

    if (!updated) {
      return buildErrorResponse("VALIDATION_ERROR", "Mes no encontrado");
    }

    logAction("admin", "SET_MONTH_STATUS", `Admin cambió estado de ${monthId} a ${status}`, new Date());

    return buildSuccessResponse({
      code: "ADMIN_MONTH_STATUS_UPDATED",
      message: `Mes ${monthId} actualizado a ${status}`
    });

  } catch (err) {
    return buildErrorResponse("SERVER_ERROR", "Error al cambiar estado: " + err.message);
  } finally {
    lock.releaseLock();
  }
}
