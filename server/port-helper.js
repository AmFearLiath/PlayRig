/**
 * PLAYRIG - PORT CONFLICT RESOLVER & PROCESS MANAGER
 * Automatically detects existing processes occupying the server port,
 * prompts the user with an interactive terminal confirmation (TTY),
 * or cleans up leftover processes cleanly.
 *
 * Author: Liath • Copyright: © GameChiller
 */

const { execSync } = require('child_process');
const readline = require('readline');
const os = require('os');

/**
 * Find PIDs listening on a specific TCP port
 * @param {number} port
 * @returns {number[]} array of PIDs
 */
function findPIDsOnPort(port) {
  const pids = new Set();
  const currentPid = process.pid;

  if (process.platform === 'win32') {
    try {
      const output = execSync('netstat -ano -p tcp', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = output.split(/\r?\n/);
      for (const line of lines) {
        // Look for lines containing :<port> and LISTENING / ABHÖREN
        const isTargetPort = line.includes(`:${port} `) || line.includes(`:${port}\t`);
        const isListening = /LISTENING|ABHÖREN|ABH/i.test(line);
        if (isTargetPort && isListening) {
          const parts = line.trim().split(/\s+/);
          const pid = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(pid) && pid > 0 && pid !== currentPid) {
            pids.add(pid);
          }
        }
      }
    } catch (e) {
      // Netstat error or empty
    }
  } else {
    // Linux / macOS
    try {
      const output = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = output.trim().split(/\r?\n/);
      for (const line of lines) {
        const pid = parseInt(line.trim(), 10);
        if (!isNaN(pid) && pid > 0 && pid !== currentPid) {
          pids.add(pid);
        }
      }
    } catch (e) {
      // lsof returned non-zero (no processes found)
    }
  }

  return Array.from(pids);
}

/**
 * Get human-readable process name from PID
 * @param {number} pid
 * @returns {string}
 */
function getProcessName(pid) {
  if (process.platform === 'win32') {
    try {
      const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      const match = out.match(/^"([^"]+)"/);
      if (match) return match[1];
    } catch (e) {}
  } else {
    try {
      const out = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (out) return out;
    } catch (e) {}
  }
  return 'Unbekannt';
}

/**
 * Kill a process by PID
 * @param {number} pid
 * @returns {boolean} success
 */
function killProcess(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /PID ${pid}`, { stdio: ['pipe', 'pipe', 'ignore'] });
    } else {
      process.kill(pid, 'SIGKILL');
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Ask user via terminal prompt with an optional timeout
 * @param {string} question
 * @param {number} timeoutMs
 * @returns {Promise<string>}
 */
function askQuestion(question, timeoutMs = 25000) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    let timer = null;
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        rl.close();
        console.log('\n[PlayRig] Zeitüberschreitung – Standardaktion (Ja) wird ausgeführt...');
        resolve('j');
      }, timeoutMs);
    }

    rl.question(question, (answer) => {
      if (timer) clearTimeout(timer);
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Main function: Ensure port is available before server listens.
 * If occupied:
 *  - Interactively asks user in terminal (TTY) whether to terminate the old process.
 *  - In non-TTY environments (or with --force flag), terminates leftover node process automatically.
 * @param {number} port
 * @param {object} options
 */
async function ensurePortAvailable(port, options = {}) {
  const pids = findPIDsOnPort(port);
  if (pids.length === 0) return true;

  const isForce = process.argv.includes('--force') || process.argv.includes('-f') || options.force;
  const isTTY = Boolean(process.stdin && process.stdin.isTTY);

  console.log(`\n  ┌─────────────────────────────────────────────────────────────┐`);
  console.log(`  │ ⚠️  PORT-KONFLIKT: Port ${port} ist bereits belegt!            │`);
  console.log(`  ├─────────────────────────────────────────────────────────────┤`);
  for (const pid of pids) {
    const name = getProcessName(pid);
    console.log(`  │ • Belegender Prozess: PID ${pid.toString().padEnd(6)} (${name})`.padEnd(64) + '│');
  }
  console.log(`  └─────────────────────────────────────────────────────────────┘\n`);

  let shouldKill = false;

  if (isForce) {
    console.log(`[PlayRig] Start-Option --force erkannt: Beende blockierende Prozesse...`);
    shouldKill = true;
  } else if (isTTY) {
    const answer = await askQuestion(`  Möchtest du den/die alten Prozess(e) beenden und fortfahren? [J/n]: `, 25000);
    const normalized = answer.toLowerCase();
    if (normalized === '' || normalized === 'j' || normalized === 'ja' || normalized === 'y' || normalized === 'yes') {
      shouldKill = true;
    } else {
      console.log(`\n[PlayRig] Abbruch durch Benutzer. Der bestehende Prozess bleibt aktiv.`);
      process.exit(0);
    }
  } else {
    // Non-interactive (e.g. background task, IDE run, container)
    console.log(`[PlayRig] Nicht-interaktiver Modus: Beende alten Server-Prozess automatisch...`);
    shouldKill = true;
  }

  if (shouldKill) {
    for (const pid of pids) {
      const name = getProcessName(pid);
      process.stdout.write(`  ➜ Beende Prozess PID ${pid} (${name})... `);
      const ok = killProcess(pid);
      if (ok) {
        console.log(`[OK]`);
      } else {
        console.log(`[FEHLGESCHLAGEN]`);
      }
    }

    // Wait for OS socket release
    await sleep(600);

    // Verify release
    const remaining = findPIDsOnPort(port);
    if (remaining.length > 0) {
      console.error(`[PlayRig] Warnung: Port ${port} konnte nicht vollständig freigegeben werden (Verbleibend: ${remaining.join(', ')}).`);
      return false;
    } else {
      console.log(`  ✨ Port ${port} ist jetzt frei.\n`);
      return true;
    }
  }

  return false;
}

module.exports = {
  findPIDsOnPort,
  getProcessName,
  killProcess,
  ensurePortAvailable
};
