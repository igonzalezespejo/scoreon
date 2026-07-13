const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
const TEST_USER_ID = process.env.TEST_USER_ID || "juan";
const TEST_PIN = process.env.TEST_PIN || "1234";
const TEST_MONTH_ID = process.env.TEST_MONTH_ID || "2026-09";
const TEST_MATCH_ID = process.env.TEST_MATCH_ID || "m001";

if (!APPS_SCRIPT_URL) {
  console.error("Falta la variable de entorno APPS_SCRIPT_URL");
  process.exit(1);
}

const payload = {
  action: "savePrediction",
  user_id: TEST_USER_ID,
  pin: TEST_PIN,
  month_id: TEST_MONTH_ID,
  predictions: [
    {
      match_id: TEST_MATCH_ID,
      home_goals: 2,
      away_goals: 1
    }
  ]
};

async function run() {
  console.log("Testing POST action=savePrediction (Valid)...");
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response OK:", data.ok);
    console.log("Message:", data.message);
    
    if (!data.ok) {
        console.error("Failed payload response:", data);
        process.exit(1);
    }
  } catch (err) {
    console.error("Fetch error:", err);
    process.exit(1);
  }
}

run();
