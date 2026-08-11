const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const TEST_USER_ID = process.env.TEST_USER_ID || "juan";
const TEST_PIN = process.env.TEST_PIN || "1234";
const TEST_MONTH_ID = process.env.TEST_MONTH_ID || "2026-09";
const TEST_MATCH_ID = process.env.TEST_MATCH_ID || "m001";

if (!APPS_SCRIPT_URL) {
  console.error("Falta la variable de entorno APPS_SCRIPT_URL");
  process.exit(1);
}

async function post(payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function testExpectFailure(name, payload) {
  console.log(`\nTesting (${name})...`);
  try {
    const data = await post(payload);
    console.log("Response OK:", data.ok, "Expected: false");
    console.log("Code:", data.code);
    console.log("Message:", data.message);

    if (data.ok) {
      console.error(`ERROR: ${name} should have failed!`);
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

async function run() {
  // El PIN y el user_id ahora solo se comprueban en el login, no en savePrediction.
  await testExpectFailure("Login con PIN incorrecto", {
    action: "login", user_id: TEST_USER_ID, pin: "9999"
  });

  await testExpectFailure("Login con usuario inexistente", {
    action: "login", user_id: "fakeuser", pin: TEST_PIN
  });

  await testExpectFailure("savePrediction con token inválido", {
    action: "savePrediction",
    token: "token-que-no-existe",
    month_id: TEST_MONTH_ID,
    predictions: [{ match_id: TEST_MATCH_ID, home_goals: 2, away_goals: 1 }]
  });

  console.log("\nObteniendo token válido para probar goles inválidos...");
  const loginData = await post({ action: "login", user_id: TEST_USER_ID, pin: TEST_PIN });
  if (!loginData.ok) {
    console.error("No se pudo iniciar sesión con credenciales válidas, abortando.", loginData);
    process.exit(1);
  }

  await testExpectFailure("savePrediction con goles inválidos", {
    action: "savePrediction",
    token: loginData.token,
    month_id: TEST_MONTH_ID,
    predictions: [{ match_id: TEST_MATCH_ID, home_goals: -1, away_goals: "a" }]
  });
}

run();
