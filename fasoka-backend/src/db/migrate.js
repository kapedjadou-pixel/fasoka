const fs = require('fs');
const path = require('path');
const db = require('../config/database');

async function migrate() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    console.log('Application du schéma de base de données...');
    await db.query(schema);
    console.log('✅ Migration terminée avec succès.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur lors de la migration :', err.message);
    process.exit(1);
  }
}

migrate();
