const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const TEST_USER_ID = process.env.TEST_USER_ID || "juan";
const TEST_PIN = process.env.TEST_PIN || "1234";
const TEST_MONTH_ID = process.env.TEST_MONTH_ID || "2026-09";
const TEST_MATCH_ID = process.env.TEST_MATCH_ID || "m001";

if (!APPS_SCRIPT_URL) {
  console.error("Falta la variable de entorno APPS_SCRIPT_URL");
  process.exit(1);
}

const payloadBadPin = {
  action: "savePrediction",
  user_id: TEST_USER_ID,
  pin: "9999",
  month_id: TEST_MONTH_ID,
  predictions: [
    { match_id: TEST_MATCH_ID, home_goals: 2, away_goals: 1 }
  ]
};

const payloadBadUser = {
  action: "savePrediction",
  user_id: "fakeuser",
  pin: TEST_PIN,
  month_id: TEST_MONTH_ID,
  predictions: [
    { match_id: TEST_MATCH_ID, home_goals: 2, away_goals: 1 }
  ]
};

const payloadBadGoals = {
  action: "savePrediction",
  user_id: TEST_USER_ID,
  pin: TEST_PIN,
  month_id: TEST_MONTH_ID,
  predictions: [
    { match_id: TEST_MATCH_ID, home_goals: -1, away_goals: "a" }
  ]
};

async function testPayload(name, payload) {
    console.log(`\nTesting POST action=savePrediction (${name})...`);
    try {
        const res = await fetch(APPS_SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        const data = await res.json();
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
    await testPayload("Bad PIN", payloadBadPin);
    await testPayload("Bad User", payloadBadUser);
    await testPayload("Bad Goals", payloadBadGoals);
}

run();
