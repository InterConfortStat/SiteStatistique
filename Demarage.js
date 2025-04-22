const express = require('express');
const path = require('path');
const app = express();

const PORT = 7895; // Tu peux modifier si besoin

// Sert tous les fichiers (HTML, CSS, JS...) dans le dossier actuel
app.use(express.static(path.join(__dirname)));

// Lance le serveur sur toutes les interfaces réseau (utile pour accès via IP)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur démarré sur : http://localhost:${PORT}`);
  console.log(`🌐 Ou sur réseau : http://<IP-Locale>:${PORT}`);
});
