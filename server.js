const express = require("express");
const session = require("express-session");
const fs = require("fs");
const axios = require("axios");

const app = express();
const PORT = 7897;
const API_BASE = "http://192.168.1.36:7895";

// Middlewares
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'supersecretkey',
  resave: false,
  saveUninitialized: true
}));

// Utils
function readUsers() {
  return JSON.parse(fs.readFileSync("users.json", "utf-8"));
}

function writeUsers(users) {
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
}

function readMachines() {
  try {
    const content = fs.readFileSync("machines.json", "utf-8");
    return JSON.parse(content || "[]");
  } catch (e) {
    console.error("Erreur lecture machines.json :", e.message);
    return [];
  }
}

function writeMachines(machines) {
  fs.writeFileSync("machines.json", JSON.stringify(machines, null, 2));
}

function logAdmin(action) {
  const line = `[${new Date().toISOString()}] ${action}\n`;
  fs.appendFileSync("admin.log", line);
}

// Auth middlewares
function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect("/login.html");
}

function isAdmin(req, res, next) {
  if (req.session?.user?.role === "admin") return next();
  return res.status(403).send("⛔ Accès refusé (admin uniquement)");
}

// Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) return res.status(401).send("Identifiants invalides");

  req.session.user = {
    username: user.username,
    role: user.role,
    machines: user.machines
  };

  res.redirect(user.role === "admin" ? "/admin.html" : "/dashboard.html");
});

// Infos utilisateur
app.get("/me", isAuthenticated, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.username === req.session.user.username);
  if (!user) return res.status(401).send("Utilisateur introuvable");

  let machines = user.machines;

  // 👇 Si admin ou seeAllMachines → récupérer toutes les machines des utilisateurs
  if (user.role === "admin" || user.seeAllMachines === true) {
    const allMachines = [];
    users.forEach(u => {
      if (Array.isArray(u.machines)) {
        u.machines.forEach(m => {
          if (!allMachines.some(x => x.id === m.id)) {
            allMachines.push(m);
          }
        });
      }
    });
    machines = allMachines;
  }

  res.json({
    username: user.username,
    role: user.role,
    seeAllMachines: user.seeAllMachines,
    machines
  });
});


// Machine sélectionnée
app.post("/set-machine", (req, res) => {
  if (req.session && req.body.machine) {
    req.session.selectedMachine = req.body.machine;
    return res.sendStatus(200);
  }
  res.sendStatus(400);
});

app.get("/get-machine", (req, res) => {
  return res.json({ machine: req.session?.selectedMachine || null });
});

// API proxy
app.get("/feedback-results/:machineID", isAuthenticated, async (req, res) => {
  try {
    const response = await axios.get(`${API_BASE}/feedback-results/${req.params.machineID}`);
    res.json(response.data);
  } catch (err) {
    console.error("❌ API feedback error:", err.message);
    res.status(500).json({ error: "Erreur proxy feedback" });
  }
});

app.get("/temperatures/:machineID", isAuthenticated, async (req, res) => {
  try {
    const response = await axios.get(`${API_BASE}/temperatures/${req.params.machineID}`);
    res.json(response.data);
  } catch (err) {
    console.error("❌ API temperature error:", err.message);
    res.status(500).json({ error: "Erreur proxy température" });
  }
});

app.get("/payment-requests/:machineID", isAuthenticated, async (req, res) => {
  try {
    const response = await axios.get(`${API_BASE}/payment-requests/${req.params.machineID}`);
    res.json(response.data);
  } catch (err) {
    console.error("❌ API stock error:", err.message);
    res.status(500).json({ error: "Erreur proxy stock" });
  }
});

// Logs
app.get("/admin/logs", isAdmin, (req, res) => {
  const logs = fs.readFileSync("admin.log", "utf-8");
  res.send(logs);
});

app.delete("/admin/logs", isAdmin, (req, res) => {
  fs.writeFileSync("admin.log", "");
  logAdmin(`${req.session.user.username} a vidé les logs`);
  res.sendStatus(200);
});

// Machines
app.get("/admin/machines", isAuthenticated, (req, res) => {
  const machines = readMachines();
  res.json(machines);
});

app.post("/admin/machines", isAdmin, (req, res) => {
  const machines = readMachines();
  const { id, name } = req.body;

  if (!id || !name) return res.status(400).send("Champs manquants");
  if (machines.find(m => m.id === id)) {
    return res.status(409).send("Machine déjà existante");
  }

  machines.push({ id, name });
  writeMachines(machines);
  logAdmin(`Ajout machine ${name} (${id})`);
  res.sendStatus(201);
});

// Utilisateurs
app.get("/admin/users", isAdmin, (req, res) => {
  res.json(readUsers());
});

app.post("/admin/users", isAdmin, (req, res) => {
  const { username, password, role, machines } = req.body;
  const users = readUsers();

  if (users.find(u => u.username === username)) {
    return res.status(409).send("Utilisateur déjà existant");
  }

  users.push({ username, password, role, machines });
  writeUsers(users);
  logAdmin(`Ajout utilisateur : ${username}`);
  res.sendStatus(201);
});

app.delete("/admin/users/:username", isAdmin, (req, res) => {
  let users = readUsers();
  users = users.filter(u => u.username !== req.params.username);
  writeUsers(users);
  logAdmin(`Suppression utilisateur : ${req.params.username}`);
  res.sendStatus(200);
});

app.post("/admin/upsert-user-machine", isAdmin, (req, res) => {
  const { username, password, role = "user", machine } = req.body;
  if (!username || !password || !machine?.id || !machine?.name) {
    return res.status(400).send("Champs manquants !");
  }

  const users = readUsers();
  const user = users.find(u => u.username === username);

  if (user) {
    if (!user.machines.some(m => m.id === machine.id)) {
      user.machines.push(machine);
      writeUsers(users);
      logAdmin(`Ajout machine ${machine.name} (${machine.id}) à ${username}`);
      return res.status(200).send("Machine ajoutée au compte");
    } else {
      return res.status(409).send("Machine déjà présente");
    }
  } else {
    users.push({
      username,
      password,
      role,
      machines: [machine]
    });
    writeUsers(users);
    logAdmin(`Création utilisateur ${username} avec machine ${machine.name}`);
    return res.status(201).send("Utilisateur créé");
  }
});

// Logout
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Serveur en ligne sur http://localhost:${PORT}`);

});


