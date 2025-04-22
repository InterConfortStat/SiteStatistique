const MACHINE_ID = "2309190042"; // ← Remplace par ta vraie machine ID
const API_BASE = "http://192.168.1.36:7895";

async function fetchTemperature() {
  const res = await fetch(`${API_BASE}/temperatures/${MACHINE_ID}`);
  const data = await res.json();

  if (!data || !data.length) {
    document.getElementById("temperature-display").textContent = "Aucune température";
    return;
  }

  const last = data[data.length - 1];
  document.getElementById("temperature-display").textContent =
    `${last.temperature} °C - ${last.recorded_at}`;
}

async function fetchSales() {
  const res = await fetch(`${API_BASE}/feedback-results/${MACHINE_ID}`);
  const data = await res.json();

  const today = new Date().toISOString().slice(0, 10);
  const ventes = data.filter(s => s.Time.startsWith(today));

  const total = ventes.length;
  const list = ventes.map(v => `🧃 ${v.Name} – ${v.Amount}€`).join("<br>");
  document.getElementById("sales-display").innerHTML = `${total} vente(s)<br>${list}`;
}

// ⏱️ Refresh toutes les 15 sec
function refreshDashboard() {
  fetchTemperature();
  fetchSales();
}

refreshDashboard();
setInterval(refreshDashboard, 15000);