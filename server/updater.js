/**
 * PLAYRIG GITHUB & SYSTEM UPDATER ENGINE
 * Automated synchronization with GitHub repository (https://github.com/AmFearLiath/PlayRig)
 *
 * Capabilities:
 * 1. Check for remote updates, commits behind, and changelog
 * 2. Safe 1-click update (Git pull rebase, database re-sync, stash guard)
 * 3. Push individual Rigs to dedicated GitHub feature branches for Pull Requests
 *
 * Author: Liath • Copyright: © GameChiller • Version: v1.0.0
 */

const { execFile } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');

const execFileAsync = util.promisify(execFile);
const ROOT_DIR = path.resolve(__dirname, '..');
const REPO_URL = 'https://github.com/AmFearLiath/PlayRig';
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

let cachedStatus = null;
let lastCheckTime = 0;

class PlayRigUpdater {
  /**
   * Helper to execute git commands in project root
   */
  static async runGit(args, options = {}) {
    const timeout = options.timeout || 30000;
    try {
      const { stdout, stderr } = await execFileAsync('git', args, {
        cwd: ROOT_DIR,
        timeout,
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024
      });
      return { stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (err) {
      const errMsg = err.stderr ? err.stderr.trim() : err.message;
      throw new Error(`Git Fehler [git ${args.join(' ')}]: ${errMsg}`);
    }
  }

  /**
   * Check update status against GitHub origin
   */
  static async checkStatus({ force = false } = {}) {
    const now = Date.now();
    if (!force && cachedStatus && (now - lastCheckTime) < CACHE_TTL_MS) {
      return cachedStatus;
    }

    try {
      // 1. Fetch remote silently
      await this.runGit(['fetch', 'origin', 'main', '--prune', '--quiet'], { timeout: 25000 });
    } catch (err) {
      console.warn('[Updater] Git fetch warn:', err.message);
    }

    // 2. Query branch & commit info
    const branchRes = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    const currentBranch = branchRes.stdout || 'main';

    const localCommitRes = await this.runGit(['log', '-1', '--pretty=format:%h|%s|%an|%cI']);
    const [localHash, localMsg, localAuthor, localDate] = localCommitRes.stdout.split('|');

    let remoteHash = localHash;
    let remoteMsg = localMsg;
    let remoteAuthor = localAuthor;
    let remoteDate = localDate;

    try {
      const remoteCommitRes = await this.runGit(['log', '-1', 'origin/main', '--pretty=format:%h|%s|%an|%cI']);
      const parts = remoteCommitRes.stdout.split('|');
      remoteHash = parts[0];
      remoteMsg = parts[1];
      remoteAuthor = parts[2];
      remoteDate = parts[3];
    } catch (e) {}

    // 3. Ahead / Behind calculation
    let ahead = 0;
    let behind = 0;
    try {
      const countRes = await this.runGit(['rev-list', '--left-right', '--count', 'HEAD...origin/main']);
      const counts = countRes.stdout.split(/\s+/);
      ahead = parseInt(counts[0], 10) || 0;
      behind = parseInt(counts[1], 10) || 0;
    } catch (e) {}

    // 4. Retrieve incoming commits list if behind
    let incomingCommits = [];
    if (behind > 0) {
      try {
        const logRes = await this.runGit(['log', 'HEAD..origin/main', '--pretty=format:%h|%an|%ar|%s', '-n', '30']);
        if (logRes.stdout) {
          incomingCommits = logRes.stdout.split('\n').filter(Boolean).map(line => {
            const [hash, author, relativeTime, ...msgParts] = line.split('|');
            return {
              hash,
              author,
              relativeTime,
              message: msgParts.join('|')
            };
          });
        }
      } catch (e) {}
    }

    // 5. Check local uncommitted files
    const statusRes = await this.runGit(['status', '--porcelain']);
    const modifiedLines = statusRes.stdout ? statusRes.stdout.split('\n').filter(Boolean) : [];
    const isClean = modifiedLines.length === 0;

    cachedStatus = {
      hasUpdate: behind > 0,
      behind,
      ahead,
      branch: currentBranch,
      repoUrl: REPO_URL,
      local: {
        hash: localHash,
        message: localMsg,
        author: localAuthor,
        date: localDate
      },
      remote: {
        hash: remoteHash,
        message: remoteMsg,
        author: remoteAuthor,
        date: remoteDate
      },
      incomingCommits,
      isClean,
      modifiedCount: modifiedLines.length,
      lastChecked: new Date().toISOString()
    };

    lastCheckTime = now;
    return cachedStatus;
  }

  /**
   * Apply update: Pull from GitHub, rebase, and re-sync database
   */
  static async applyUpdate({ db } = {}) {
    const logs = [];
    logs.push(`[${new Date().toLocaleTimeString()}] Starte Aktualisierung von ${REPO_URL}...`);

    // 1. Check local status
    const status = await this.checkStatus({ force: true });
    let stashed = false;

    if (!status.isClean) {
      logs.push(`[${new Date().toLocaleTimeString()}] ${status.modifiedCount} lokale Änderungen erkannt. Erstelle automatischen Sicherungs-Stash...`);
      const stashMsg = `Auto-Stash PlayRig Update ${new Date().toISOString()}`;
      await this.runGit(['stash', 'save', stashMsg]);
      stashed = true;
      logs.push(`[${new Date().toLocaleTimeString()}] Änderungen erfolgreich temporär gesichert.`);
    }

    try {
      // 2. Git pull rebase
      logs.push(`[${new Date().toLocaleTimeString()}] Ziehe Änderungen von origin/main per Rebase...`);
      const pullRes = await this.runGit(['pull', '--rebase', 'origin', 'main']);
      logs.push(`[${new Date().toLocaleTimeString()}] ${pullRes.stdout || 'Repository synchronisiert.'}`);

      // 3. Restore stash if we stashed
      if (stashed) {
        logs.push(`[${new Date().toLocaleTimeString()}] Stelle gesicherte lokale Änderungen wieder her...`);
        try {
          await this.runGit(['stash', 'pop']);
          logs.push(`[${new Date().toLocaleTimeString()}] Lokale Änderungen sauber wiederhergestellt.`);
        } catch (stashErr) {
          logs.push(`[${new Date().toLocaleTimeString()}] Warnung beim Wiederherstellen des Stash: ${stashErr.message}. Stash bleibt in 'git stash list' erhalten.`);
        }
      }

      // 4. Re-sync database if db instance provided
      if (db && typeof db.init === 'function') {
        logs.push(`[${new Date().toLocaleTimeString()}] Synchronisiere MySQL-Datenbank & Rigs...`);
        try {
          await db.init();
          if (typeof db.syncRigsFromDisk === 'function') {
            const syncRes = await db.syncRigsFromDisk();
            logs.push(`[${new Date().toLocaleTimeString()}] Rig-Katalog synchronisiert: ${syncRes.scanned} Rigs geprüft, ${syncRes.newlyRegistered.length} neu registriert (${syncRes.newlyRegistered.join(', ') || 'alle aktuell'}).`);
          } else {
            logs.push(`[${new Date().toLocaleTimeString()}] Datenbank-Migrationen & Rigs erfolgreich synchronisiert.`);
          }
        } catch (dbErr) {
          logs.push(`[${new Date().toLocaleTimeString()}] Hinweis DB-Sync: ${dbErr.message}`);
        }
      }

      // Invalidate cache
      cachedStatus = null;
      lastCheckTime = 0;

      const updatedStatus = await this.checkStatus({ force: true });
      logs.push(`[${new Date().toLocaleTimeString()}] System ist jetzt auf Stand: ${updatedStatus.local.hash} (${updatedStatus.local.message})`);

      return {
        success: true,
        status: updatedStatus,
        logs
      };
    } catch (err) {
      logs.push(`[${new Date().toLocaleTimeString()}] FEHLER bei Aktualisierung: ${err.message}`);
      if (stashed) {
        try { await this.runGit(['rebase', '--abort']); } catch (e) {}
        try { await this.runGit(['stash', 'pop']); } catch (e) {}
      }
      throw new Error(logs.join('\n'));
    }
  }

  /**
   * Push a specific Rig directory to a dedicated GitHub branch for Pull Requests
   */
  static async pushRigToBranch({ rigId, branchName, commitMessage, user, db }) {
    if (!rigId) {
      throw new Error('Keine Rig-ID angegeben.');
    }

    // 1. Locate Rig
    let rig = null;
    if (db && typeof db.getRigById === 'function') {
      rig = await db.getRigById(rigId);
    }

    // Determine directory
    let rigRelDir = null;
    if (rig && rig.path) {
      rigRelDir = path.dirname(rig.path).replace(/\\/g, '/');
    }

    // If not found in DB, check standard directories
    if (!rigRelDir) {
      const candidates = [
        path.join('rigs', 'Gaming', rigId),
        path.join('rigs', 'Animations', rigId),
        path.join('rigs', 'Creative', rigId),
        path.join('rigs', 'Helper', rigId)
      ];
      for (const cand of candidates) {
        if (fs.existsSync(path.join(ROOT_DIR, cand))) {
          rigRelDir = cand.replace(/\\/g, '/');
          break;
        }
      }
    }

    if (!rigRelDir || !fs.existsSync(path.join(ROOT_DIR, rigRelDir))) {
      throw new Error(`Verzeichnis für Rig '${rigId}' nicht auf der Festplatte gefunden.`);
    }

    // 2. Validate & sanitize branch name
    const safeSlug = rigId.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
    let targetBranch = branchName
      ? branchName.trim().replace(/[^a-zA-Z0-9_\-\/]/g, '-')
      : `rig/${safeSlug}-${Date.now().toString(36).slice(-4)}`;

    if (!targetBranch.startsWith('rig/') && !targetBranch.startsWith('feature/')) {
      targetBranch = `rig/${targetBranch}`;
    }

    const rigTitle = (rig && rig.title) ? rig.title : rigId;
    const authorName = user ? (user.name || user.username) : 'Creator';
    const finalCommitMsg = commitMessage && commitMessage.trim()
      ? commitMessage.trim()
      : `feat(rig): update ${rigTitle} (${rigId})\n\nAuthor: ${authorName}\nRef: ${rigRelDir}`;

    // 3. Save current branch
    const curBranchRes = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    const originalBranch = curBranchRes.stdout || 'main';

    try {
      // 4. Create and checkout new branch
      await this.runGit(['checkout', '-b', targetBranch]);

      // 5. Stage only this rig's directory
      await this.runGit(['add', rigRelDir]);

      // 6. Commit (use --allow-empty in case there are no uncommitted diffs yet)
      await this.runGit(['commit', '--allow-empty', '-m', finalCommitMsg]);

      // 7. Push to GitHub with upstream tracking
      await this.runGit(['push', '-u', 'origin', targetBranch]);

      // 8. Generate GitHub Pull Request creation URL
      const pullRequestUrl = `${REPO_URL}/pull/new/${encodeURIComponent(targetBranch)}`;

      return {
        success: true,
        branch: targetBranch,
        originalBranch,
        rig: {
          id: rigId,
          title: rigTitle,
          directory: rigRelDir
        },
        pullRequestUrl,
        commitMessage: finalCommitMsg
      };
    } finally {
      // Always switch back to the original branch
      try {
        await this.runGit(['checkout', originalBranch]);
      } catch (switchErr) {
        console.error('[Updater] Warnung beim Zurückwechseln auf Branch:', switchErr.message);
      }
    }
  }
}

module.exports = PlayRigUpdater;

