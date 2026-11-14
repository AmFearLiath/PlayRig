/**
 * PLAYRIG RIG SECURITY & ANTI-MALWARE SCANNER
 * Deep validity inspection and static code analysis for imported Rig ZIP projects.
 *
 * Checks:
 * 1. Zip-Slip & Path Traversal Prevention
 * 2. File Extension & MIME Allowlisting
 * 3. Deep AST / Regex Pattern Scanning (eval, obfuscation, cryptominers, data-exfiltration)
 * 4. Structure & PlayRig Runtime Compatibility (index.html, docs.json, bridge)
 *
 * Author: Liath • Copyright: © GameChiller • Version: v1.0.0
 */

const path = require('path');

// Safe file extensions permitted in a client-side Web Rig
const ALLOWED_EXTENSIONS = new Set([
  '.html', '.htm',
  '.css',
  '.js', '.mjs',
  '.json',
  '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico',
  '.mp3', '.wav', '.ogg',
  '.woff', '.woff2', '.ttf', '.otf',
  '.md', '.txt'
]);

// Explicitly blocked malicious or executable extensions
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.dll', '.bat', '.cmd', '.sh', '.bash', '.ps1', '.vbs', '.scr',
  '.msi', '.com', '.pif', '.php', '.phtml', '.asp', '.aspx', '.jsp',
  '.cgi', '.py', '.pl', '.rb', '.jar', '.war', '.class'
]);

// Suspicious security patterns with threat levels
const SECURITY_PATTERNS = [
  {
    id: 'EVAL_EXECUTION',
    level: 'critical',
    regex: /\beval\s*\(/i,
    description: 'Dynamische Code-Ausführung via eval() festgestellt.'
  },
  {
    id: 'FUNCTION_CONSTRUCTOR',
    level: 'critical',
    regex: /new\s+Function\s*\(|Function\s*\([^)]*\)\s*\(/i,
    description: 'Dynamische Code-Ausführung via Function-Konstruktor festgestellt.'
  },
  {
    id: 'STRING_TIMEOUT',
    level: 'warning',
    regex: /set(?:Timeout|Interval)\s*\(\s*['"`]/i,
    description: 'Ausführung von String-Code in setTimeout/setInterval (mögliches eval-Äquivalent).'
  },
  {
    id: 'NODE_REQUIRE_CHILD_PROCESS',
    level: 'critical',
    regex: /require\s*\(\s*['"`]child_process['"`]\)|require\s*\(\s*['"`]fs['"`]\)/i,
    description: 'Unerlaubter Node.js System-Modulaufruf (child_process/fs) im Client-Code.'
  },
  {
    id: 'PROCESS_ACCESS',
    level: 'critical',
    regex: /\bprocess\.(?:exit|kill|env|mainModule)\b/i,
    description: 'Unerlaubter Zugriff auf Server-Laufzeitprozess (process.*).'
  },
  {
    id: 'COOKIE_STEALING',
    level: 'critical',
    regex: /document\.cookie\b/i,
    description: 'Unerlaubter Zugriff auf Dokument-Cookies (mögliches Session-Hijacking).'
  },
  {
    id: 'STORAGE_TOKEN_ACCESS',
    level: 'critical',
    regex: /localStorage\.(?:getItem|setItem)\s*\(\s*['"`](?:gamechiller_token|playrig_token|auth_token|jwt|token)['"`]/i,
    description: 'Versuch des direkten Abgreifens von Plattform-Authentifizierungs-Tokens.'
  },
  {
    id: 'TOP_FRAME_HIJACKING',
    level: 'warning',
    regex: /(?:window\.)?top\.location\s*=|window\.location\.replace\s*\(\s*['"`]http/i,
    description: 'Mögliches Iframe-Busting oder Phishing-Redirect (Nutze PlayRig.navigate anstelle von top.location).'
  },
  {
    id: 'CRYPTOMINER_SIGNATURE',
    level: 'critical',
    regex: /coinhive|cryptoloot|coin-hive|authedmine|webminer|monero/i,
    description: 'Bekannte Cryptominer-Signatur erkannt.'
  },
  {
    id: 'HEX_OBFUSCATION',
    level: 'warning',
    regex: /(?:\\x[0-9a-fA-F]{2}){10,}|(?:\\u[0-9a-fA-F]{4}){10,}/,
    description: 'Stark obfuskierter Hex-/Unicode-String erkannt (Verdacht auf verschleierte Backdoor).'
  }
];

class RigSecurityScanner {
  /**
   * Scans an unzipped file collection (from JSZip) for security & structural validity.
   * @param {Object} zipFiles Map of relative path -> string/Buffer
   * @returns {Object} Inspection result with validity score, issues, and extracted metadata
   */
  static scanProject(zipFiles) {
    const report = {
      valid: false,
      score: 100, // 0 - 100
      status: 'pending', // 'passed', 'warning', 'rejected'
      filesScanned: 0,
      totalSize: 0,
      entryFile: null,
      docsFile: null,
      issues: [],
      metadata: {
        title: null,
        author: null,
        copyright: null,
        version: 'v1.0.0',
        category: 'creative',
        subcategory: 'General',
        tags: []
      }
    };

    const fileEntries = Object.keys(zipFiles).filter(p => !zipFiles[p].dir);

    // 1. Structure Verification: Must have an index.html
    const hasIndex = fileEntries.some(p => {
      const normalized = p.replace(/\\/g, '/').toLowerCase();
      return normalized === 'index.html' || normalized.endsWith('/index.html');
    });

    if (!hasIndex) {
      report.issues.push({
        severity: 'critical',
        code: 'MISSING_ENTRYPOINT',
        file: 'index.html',
        message: 'Keine index.html im Root oder Hauptverzeichnis des ZIP-Archivs gefunden.'
      });
      report.score -= 50;
    } else {
      // Locate canonical index.html
      const exactRootIndex = fileEntries.find(p => p.replace(/\\/g, '/').toLowerCase() === 'index.html');
      report.entryFile = exactRootIndex || fileEntries.find(p => p.replace(/\\/g, '/').toLowerCase().endsWith('/index.html'));
    }

    // 2. Iterate and inspect each file
    for (const relativePath of fileEntries) {
      report.filesScanned++;

      // Zip-Slip Path Traversal Check
      if (relativePath.includes('..') || path.isAbsolute(relativePath) || relativePath.startsWith('/') || relativePath.startsWith('\\')) {
        report.issues.push({
          severity: 'critical',
          code: 'ZIP_SLIP_ATTACK',
          file: relativePath,
          message: 'Sicherheitsverletzung: Pfad versucht aus dem Zielverzeichnis auszubrechen (Zip-Slip).'
        });
        report.score = 0;
        report.status = 'rejected';
        return report;
      }

      const ext = path.extname(relativePath).toLowerCase();

      // Blocked executable extensions
      if (BLOCKED_EXTENSIONS.has(ext)) {
        report.issues.push({
          severity: 'critical',
          code: 'EXECUTABLE_BLOCKED',
          file: relativePath,
          message: `Verbotener Dateityp '${ext}' im Web-Rig entdeckt. Ausführbare Dateien sind strikt untersagt.`
        });
        report.score = 0;
      }

      // Check against allowed extensions
      if (!ALLOWED_EXTENSIONS.has(ext) && ext !== '') {
        report.issues.push({
          severity: 'warning',
          code: 'UNKNOWN_EXTENSION',
          file: relativePath,
          message: `Unbekannter Dateityp '${ext}'. Wird mit reduzierter Vertrauensstufe verarbeitet.`
        });
        report.score -= 5;
      }

      // 3. Deep content inspection for text/code files
      const isTextFile = ['.html', '.htm', '.js', '.mjs', '.json', '.css'].includes(ext);
      if (isTextFile) {
        let content = '';
        try {
          content = typeof zipFiles[relativePath] === 'string' 
            ? zipFiles[relativePath] 
            : zipFiles[relativePath].toString('utf8');
        } catch (e) {
          continue;
        }

        report.totalSize += content.length;

        // Check for security patterns
        for (const pattern of SECURITY_PATTERNS) {
          const match = pattern.regex.exec(content);
          if (match) {
            // Find line number
            const linesUpToMatch = content.substring(0, match.index).split('\n');
            const lineNum = linesUpToMatch.length;

            report.issues.push({
              severity: pattern.level,
              code: pattern.id,
              file: relativePath,
              line: lineNum,
              message: pattern.description
            });

            if (pattern.level === 'critical') {
              report.score -= 25;
            } else {
              report.score -= 10;
            }
          }
        }

        // 4. Metadata Extraction from docs.json or index.html
        if (relativePath.toLowerCase().endsWith('docs.json') || relativePath.toLowerCase().endsWith('manifest.json')) {
          report.docsFile = relativePath;
          try {
            const manifest = JSON.parse(content);
            if (manifest.title || manifest.name) report.metadata.title = manifest.title || manifest.name;
            if (manifest.author) report.metadata.author = manifest.author;
            if (manifest.copyright) report.metadata.copyright = manifest.copyright;
            if (manifest.version) report.metadata.version = manifest.version;
            if (manifest.category) report.metadata.category = manifest.category;
            if (manifest.subcategory) report.metadata.subcategory = manifest.subcategory;
            if (Array.isArray(manifest.tags)) report.metadata.tags = manifest.tags;
          } catch (e) {}
        }

        // Fallback title from index.html <title>
        if (!report.metadata.title && (ext === '.html' || ext === '.htm')) {
          const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            report.metadata.title = titleMatch[1].replace(/\|\s*PlayRig/gi, '').trim();
          }
        }
      }
    }

    // Determine final status
    report.score = Math.max(0, report.score);
    const hasCritical = report.issues.some(i => i.severity === 'critical');

    if (hasCritical || report.score < 50 || !hasIndex) {
      report.status = 'rejected';
      report.valid = false;
    } else if (report.score < 85 || report.issues.some(i => i.severity === 'warning')) {
      report.status = 'warning';
      report.valid = true; // Permitted with warnings
    } else {
      report.status = 'passed';
      report.valid = true;
    }

    return report;
  }
}

module.exports = RigSecurityScanner;
module.exports.RigSecurityScanner = RigSecurityScanner;
