#!/usr/bin/env node
/**
 * PlayRig - CLI Benutzer- und Administrator-Erstellung
 * Erstellt autorisierte Benutzerkonten (admin, creator, user) in der MySQL-Datenbank.
 *
 * Aufruf:
 *   node scripts/create-user.js <username> <password> [anzeigename] [rolle]
 *   oder interaktiv ohne Parameter:
 *   node scripts/create-user.js
 */

const readline = require('readline');
const db = require('../server/db');

async function prompt(question, isPassword = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  let username = args[0];
  let password = args[1];
  let name = args[2];
  let role = args[3];

  if (!username) {
    console.log('\n==============================================================');
    console.log(' 👤 PLAYRIG - BENUTZERKONTO ERSTELLEN');
    console.log('==============================================================\n');
    username = await prompt('Benutzername: ');
  }

  if (!username) {
    console.error('Fehler: Benutzername darf nicht leer sein.');
    process.exit(1);
  }

  if (!password) {
    password = await prompt('Passwort: ');
  }

  if (!password || password.length < 6) {
    console.error('Fehler: Passwort muss mindestens 6 Zeichen lang sein.');
    process.exit(1);
  }

  if (!name) {
    name = (await prompt(`Anzeigename (Standard: ${username}): `)) || username;
  }

  if (!role) {
    const roleInput = await prompt('Rolle (admin / creator / user) [Standard: admin]: ');
    role = roleInput ? roleInput.toLowerCase() : 'admin';
  }

  if (!['admin', 'creator', 'user'].includes(role)) {
    console.error("Fehler: Ungültige Rolle. Erlaubt sind: 'admin', 'creator', 'user'.");
    process.exit(1);
  }

  try {
    await db.init();
    const user = await db.registerUser(username, name, password, role);
    console.log('\n==============================================================');
    console.log(' 🎉 BENUTZERKONTO ERFOLGREICH ERSTELLT!');
    console.log('==============================================================');
    console.log(` • ID:           ${user.id}`);
    console.log(` • Benutzername: ${user.username}`);
    console.log(` • Anzeigename:  ${user.name}`);
    console.log(` • Rolle:        ${user.role}`);
    console.log('==============================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('\nFehler beim Erstellen des Benutzers:', err.message);
    process.exit(1);
  }
}

main();
