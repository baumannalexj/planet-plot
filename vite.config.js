import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

// Path aliases mirror the architecture: @api = interfaces only, @core = domain
// (depends on @api + shared utils, never on @adapters), @adapters = concrete
// implementations of @api's interfaces (three.js overlays + plot
// corrections), @viewport = the composition/mounting code that wires
// adapters in. Dependency direction is enforced by convention here, not by
// tooling — see CLAUDE.md/WORK_ITEMS.md if that ever needs a real lint rule.
function srcPath(sub) {
  return fileURLToPath(new URL(`./src/${sub}`, import.meta.url));
}

// Dev-only endpoint the browser's CsvFileLogger (@adapters/loggers) POSTs
// plain CSV text to. The browser has no filesystem access, so this is the
// only way sim-tick data can land on disk — only exists while `yarn dev` is
// running; a production build has no server to receive it.
const LOG_DIR = fileURLToPath(new URL('./log', import.meta.url));
const sessionStamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFilePath = path.join(LOG_DIR, `${sessionStamp}-data-output.csv`);

function simCsvLoggerPlugin() {
  return {
    name: 'sim-csv-logger',
    configureServer(server) {
      server.middlewares.use('/__sim-log', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            fs.mkdirSync(LOG_DIR, { recursive: true });
            fs.appendFileSync(logFilePath, body);
          } catch {
            // Logging must never break the sim — swallow write errors.
          }
          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [simCsvLoggerPlugin()],
  resolve: {
    alias: {
      '@api': srcPath('api'),
      '@core': srcPath('core'),
      '@adapters': srcPath('adapters'),
      '@viewport': srcPath('viewport'),
      '@app': srcPath('app'),
      '@plots': srcPath('plots'),
    },
  },
  server: {
    // Same reasoning as test.exclude below: nested git worktrees under
    // .worktrees/ and .claude/worktrees/ are full checkouts of this same
    // project. Without excluding them, Vite's dev-server file watcher walks
    // into them too — confusing its module graph (it was seen serving a
    // request for a path INSIDE a worktree) and burning through OS file
    // watcher limits with every worktree that gets created.
    watch: {
      ignored: ['**/.worktrees/**', '**/.claude/**'],
    },
  },
  test: {
    // Exclude nested git worktrees — several worker/session dispatches this
    // project uses land under .worktrees/ and .claude/worktrees/, each a full
    // checkout with its own copy of test/. Without this, vitest's default
    // recursive glob finds and runs every worktree's copy of the same test
    // files too, silently multiplying the reported pass count per worktree.
    exclude: ['**/node_modules/**', '**/.worktrees/**', '**/.claude/**'],
  },
});
