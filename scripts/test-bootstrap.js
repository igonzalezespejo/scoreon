const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;
if (!APPS_SCRIPT_URL) {
  console.error("Falta la variable de entorno APPS_SCRIPT_URL");
  process.exit(1);
}

async function run() {
  console.log("Testing GET action=bootstrap...");
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?action=bootstrap`);
    const data = await res.json();
    console.log("Status:", res.status);
    console.log("Response OK:", data.ok);
    console.log("Config loaded:", !!data.config);
    console.log("Active Month:", data.activeMonth ? data.activeMonth.month_id : null);
    console.log("Participants count:", data.participants ? data.participants.length : 0);
    console.log("Matches count:", data.matches ? data.matches.length : 0);
    
    if (!data.ok) {
        console.error("Error payload:", data);
        process.exit(1);
    }
  } catch (err) {
    console.error("Fetch error:", err);
    process.exit(1);
  }
}

run();
