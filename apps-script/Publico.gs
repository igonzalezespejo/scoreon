/**
 * Copia pública de los datos de la web, para leer sin pasar por /exec.
 *
 * Por qué existe: /exec tarda de 2 a 80 s en entregar la respuesta y falla
 * con 404 en ~20 % de las peticiones aunque el script haya terminado en 1-5 s
 * (medido 2026-10-06; es la infraestructura de Google, no el código). Leer una
 * hoja compartida por enlace mediante la consulta gviz tarda ~0,3 s y no ha
 * fallado en las pruebas.
 *
 * Cómo funciona: cada escritura de la web (apuesta, resultados, estado de mes,
 * registro) vuelve a generar aquí TODO lo que la web enseña —meses, partidos,
 * resultados, contadores y ranking— y lo escribe de una vez en la hoja
 * pública. La web la lee al cargar. Un trigger cada 5 min hace de red de
 * seguridad para lo que no pasa por la web (ediciones a mano en la hoja,
 * cierre automático de meses) o si alguna publicación falló.
 *
 * Qué NO va en la copia (es pública): PIN, emails, is_admin, columnas
 * privadas de Participants, código admin, código de registro, ni las apuestas
 * individuales de nadie (solo contadores por persona, como hasta ahora).
 *
 * Formato en la hoja, todo en la columna A y todo como TEXTO (gviz deduce un
 * tipo por columna y vacía las celdas del tipo minoritario si se mezclan):
 *   A1      -> "|" + {"version","published_at","length","chunks"}
 *   A2..An  -> "|" + trozos del JSON (máx. 45.000 caracteres por celda; el
 *              límite de Sheets es 50.000)
 * El "|" evita que un trozo que empiece por "=", "+" o "-" se interprete como
 * fórmula o número. Todo se escribe en UNA llamada setValues, para que nunca se
 * lea la cabecera de una versión con los trozos de otra (la web lo verifica).
 */

const PUBLIC_SPREADSHEET_ID = '1YnqE5xAaQeXG1Bkh-D1rkvYLlz0CgbzfpjsbzSTQGwA';
const PUBLIC_SHEET_NAME = 'Publico';
const PUBLIC_CHUNK_SIZE = 45000;
const PUBLIC_VERSION_PROPERTY = 'public_snapshot_version';

// Únicas claves de Config que lee la web.
const PUBLIC_CONFIG_KEYS = [
  'active_month_id', 'site_title', 'pin_enabled', 'pin_length',
  'show_predictions_before_lock', 'registration_enabled', 'session_ttl_days'
];

// Para el trigger de 5 min y el menú: toma el lock como cualquier escritura,
// así nunca publica a la vez que otra operación está modificando la hoja.
function publishPublicSnapshot() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('Sistema ocupado; se volverá a intentar en la siguiente ejecución.');
  }
  try {
    // Antes la carga de la web cerraba los meses caducados (bootstrapLight);
    // la web ya no llama a bootstrapLight, así que lo hace la red de seguridad.
    autoCloseExpiredMonths();
    return publishPublicSnapshotUnsafe_();
  } finally {
    lock.releaseLock();
  }
}

// Desde las acciones de escritura, que YA tienen el lock. Nunca lanza: si la
// copia falla, la escritura del usuario ya está hecha y no se debe perder ni
// devolver como error; el trigger de 5 min la repara.
function publishPublicSnapshotSafe_(origin) {
  try {
    return publishPublicSnapshotUnsafe_();
  } catch (e) {
    console.error('No se pudo publicar la copia pública (' + origin + '): ' + e.message);
    return null;
  }
}

function publishPublicSnapshotUnsafe_() {
  return writePublicSnapshot_(buildPublicSnapshot_());
}

function buildPublicSnapshot_() {
  const config = getConfigMap();
  const activeMonthId = normalizeMonthId(config.active_month_id);

  const publicConfig = {};
  PUBLIC_CONFIG_KEYS.forEach(key => {
    if (config[key] !== undefined) publicConfig[key] = config[key];
  });
  // En la hoja Config la clave está escrita "pin_lenght".
  if (publicConfig.pin_length === undefined && config.pin_lenght !== undefined) {
    publicConfig.pin_length = config.pin_lenght;
  }
  // La web solo necesita saber si debe pedir el código, no el código.
  publicConfig.registration_code_required = !!(config.registration_code && String(config.registration_code).trim() !== '');

  const participants = getSheetData("Participants").map(p => ({
    user_id: normalizeId(p.user_id),
    display_name: p.display_name,
    active: (p.active === true || p.active === "true" || p.active === "TRUE")
  }));

  const months = getSheetData("Months").map(m => {
    m.month_id = normalizeMonthId(m.month_id);
    m.title = sanitizeMonthTitle(m.title, m.month_id);
    return m;
  });
  const matches = getSheetData("Matches").map(m => {
    m.month_id = normalizeMonthId(m.month_id);
    return m;
  });
  const predictions = getSheetData("Predictions_Current");
  const results = getSheetData("Results");
  const scoringRulesRows = getSheetData("Scoring_Rules");

  // Mismo mapa { rule_id: points } que manda bootstrapLight a la web.
  const scoringRules = {};
  scoringRulesRows.forEach(r => {
    const isActive = (r.active === true || r.active === "true" || r.active === "TRUE");
    if (isActive) scoringRules[r.rule_id] = Number(r.points);
  });

  const monthsData = {};
  months.forEach(m => {
    const detail = computeMonthDetail(m.month_id, matches, results, predictions, participants);
    monthsData[m.month_id] = detail;
    m.matches_count = detail.matches.length;
    m.submitted_count = Object.values(detail.predictionsSummary).filter(p => p.status === 'submitted').length;
  });

  const activeMonth = months.find(m => m.month_id === activeMonthId) || null;
  const rankings = buildPublicRankings_(participants, matches, predictions, results, scoringRulesRows);

  return {
    // La web rechaza cualquier copia sin esta marca (p. ej. los datos
    // inventados de la prueba de lectura, que usan el mismo formato).
    app: 'scoreon',
    config: publicConfig,
    months: months,
    activeMonth: activeMonth,
    participants: participants,
    monthsData: monthsData,
    scoringRules: scoringRules,
    rankingMonthly: rankings.monthly,
    rankingGlobal: rankings.global
  };
}

// Ranking calculado en el momento con exactamente la misma lógica que
// updateRankingsInSheetsUnsafe (incluido el relleno de reglas obligatorias),
// para que coincida con el de las hojas Ranking_Monthly/Ranking_Global.
function buildPublicRankings_(participants, matches, predictions, results, scoringRulesRows) {
  const scoringRules = scoringRulesRows.slice();
  const requiredRules = {
    sign: 4,
    home_goals: 2,
    away_goals: 2,
    exact_bonus: 2
  };
  const rulesMap = {};
  scoringRules.forEach(r => rulesMap[normalizeId(r.rule_id)] = r);
  for (let key in requiredRules) {
    if (!rulesMap[key] || rulesMap[key].active === false || rulesMap[key].active === "false") {
      const existingIndex = scoringRules.findIndex(r => normalizeId(r.rule_id) === key);
      const newRule = { rule_id: key, points: requiredRules[key], active: true };
      if (existingIndex >= 0) scoringRules[existingIndex] = newRule;
      else scoringRules.push(newRule);
    }
  }

  const monthly = buildMonthlyRanking(participants, matches, predictions, results, scoringRules).map(r => ({
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
    position: r.position
  }));

  const global = buildGlobalRanking(participants, matches, predictions, results, scoringRules).map(r => ({
    user_id: r.user_id,
    display_name: r.display_name,
    total_points: r.total_points,
    months_played: r.months_played,
    monthly_wins: r.monthly_wins || 0,
    exact_scores: r.exact_scores,
    correct_signs: r.correct_signs,
    position: r.position
  }));

  return { monthly: monthly, global: global };
}

function writePublicSnapshot_(snapshot) {
  const props = PropertiesService.getScriptProperties();
  const version = Number(props.getProperty(PUBLIC_VERSION_PROPERTY) || 0) + 1;
  // Se guarda antes de escribir: si la escritura falla queda un hueco en la
  // numeración (inofensivo), nunca dos copias distintas con el mismo número.
  props.setProperty(PUBLIC_VERSION_PROPERTY, String(version));

  const publishedAt = new Date().toISOString();
  snapshot.version = version;
  snapshot.published_at = publishedAt;

  const json = JSON.stringify(snapshot);
  const chunks = [];
  for (let i = 0; i < json.length; i += PUBLIC_CHUNK_SIZE) {
    chunks.push(json.slice(i, i + PUBLIC_CHUNK_SIZE));
  }
  const meta = JSON.stringify({ version: version, published_at: publishedAt, length: json.length, chunks: chunks.length });

  const ss = SpreadsheetApp.openById(PUBLIC_SPREADSHEET_ID);
  let sheet = ss.getSheetByName(PUBLIC_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(PUBLIC_SHEET_NAME);
    sheet.getRange('A:A').setNumberFormat('@');
  }

  const values = [['|' + meta]].concat(chunks.map(c => ['|' + c]));
  // Si la versión anterior ocupaba más filas, se vacían en la misma llamada.
  const lastRow = sheet.getLastRow();
  while (values.length < lastRow) values.push(['']);

  sheet.getRange(1, 1, values.length, 1).setValues(values);
  SpreadsheetApp.flush();
  return version;
}

// Se puede ejecutar desde el editor de Apps Script (desplegable de funciones
// → Ejecutar) o desde el menú de la hoja. Volver a ejecutarla no duplica
// nada: borra el trigger anterior antes de crear el nuevo.
function installPublicSnapshotTrigger() {
  let removed = 0;
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'publishPublicSnapshot') {
      ScriptApp.deleteTrigger(t);
      removed++;
    }
  });
  ScriptApp.newTrigger('publishPublicSnapshot').timeBased().everyMinutes(5).create();
  notify_('Red de seguridad activada: la copia pública se regenera cada 5 min. Se eliminaron ' + removed + ' triggers antiguos.');
}

// Avisa con una ventana si se ejecuta desde la hoja, o en el registro de
// ejecución si se ejecuta desde el editor (ahí no hay ventanas).
function notify_(message) {
  console.log(message);
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    // Ejecutado desde el editor: el mensaje ya está en el registro.
  }
}

function menuPublishPublicSnapshot() {
  try {
    const version = publishPublicSnapshot();
    SpreadsheetApp.getUi().alert('Éxito', `Copia pública actualizada (versión ${version}).`, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getUi().alert('Error', e.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// Acción de diagnóstico: solo existe en el código nuevo, así que sirve para
// saber qué versión del backend hay detrás de una URL de /exec.
function actionPublicSnapshotInfo() {
  return buildSuccessResponse({
    code: "PUBLIC_SNAPSHOT_INFO",
    version: Number(PropertiesService.getScriptProperties().getProperty(PUBLIC_VERSION_PROPERTY) || 0),
    public_spreadsheet_id: PUBLIC_SPREADSHEET_ID,
    public_sheet_name: PUBLIC_SHEET_NAME
  });
}
