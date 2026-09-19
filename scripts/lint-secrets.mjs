// Lightweight, dependency-free secrets/PII scanner. No new npm package —
// this repo keeps deps minimal, and installing a scanner (gitleaks etc.)
// needs an explicit yes first. Run: `node scripts/lint-secrets.mjs [paths...]`
// (defaults to .WORK_ITEMS/ — the coordination docs this was written for,
// since they're free-form text a human or agent writes into directly).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DEFAULT_TARGETS = ['.WORK_ITEMS'];
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.vite']);

// High-confidence secret shapes only — false positives on relative paths,
// commit-identity emails (e.g. baumannalexj@users.noreply.github.com,
// alexander.baumann@toasttab.com), or plain URLs are explicitly NOT the
// goal here; this flags things that look like live credentials.
const PATTERNS = [
  { name: 'AWS Access Key ID', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'AWS Secret Access Key (assignment)', re: /\baws_secret_access_key\s*[=:]\s*['"][A-Za-z0-9/+=]{40}['"]/gi },
  { name: 'Private key block', re: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { name: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: 'Generic API key/secret/token assignment', re: /\b(api[_-]?key|secret|token|password|passwd)\s*[=:]\s*['"][A-Za-z0-9_\-]{20,}['"]/gi },
  { name: 'Stripe live key', re: /\bsk_live_[A-Za-z0-9]{16,}\b/g },
];

// Not flagged as PII: relative file paths, git-identity emails already
// present in this repo's own commit history (they're the point of the
// coordination docs — "who claimed this task"), and generic example.com
// style addresses. Only flag an email if it's NOT one of the known
// committer identities and looks like it was pasted from something else
// (e.g. a personal Gmail/Outlook address, which has no reason to appear
// in a task doc).
const KNOWN_IDENTITIES = new Set([
  'baumannalexj@users.noreply.github.com',
  'alexander.baumann@toasttab.com',
]);
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (st.isFile()) files.push(full);
  }
  return files;
}

function scanFile(path) {
  const text = readFileSync(path, 'utf8');
  const findings = [];
  for (const { name, re } of PATTERNS) {
    const matches = text.match(re);
    if (matches) findings.push({ name, count: matches.length });
  }
  const emails = text.match(EMAIL_RE) || [];
  const unknown = emails.filter((e) => !KNOWN_IDENTITIES.has(e.toLowerCase()) && !KNOWN_IDENTITIES.has(e));
  if (unknown.length) {
    findings.push({ name: `Unrecognized email address(es): ${[...new Set(unknown)].join(', ')}`, count: unknown.length });
  }
  return findings;
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_TARGETS;
let hasFindings = false;

for (const target of targets) {
  const files = walk(target);
  for (const file of files) {
    const findings = scanFile(file);
    if (findings.length) {
      hasFindings = true;
      console.error(`\n${relative(process.cwd(), file)}:`);
      for (const f of findings) console.error(`  - ${f.name} (${f.count} match${f.count > 1 ? 'es' : ''})`);
    }
  }
}

if (hasFindings) {
  console.error('\nSecrets/PII scan FAILED — review the findings above before committing.');
  process.exit(1);
} else {
  console.log(`Secrets/PII scan passed (${targets.join(', ')}).`);
}
