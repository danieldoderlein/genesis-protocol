#!/usr/bin/env node
// bus-mode status-line helper (1.9.0): records this session's context use for the Stop hook's wind-down.
//
//   node tools/bus-mode/statusline.cjs                     prints "ctx 63%"
//   node tools/bus-mode/statusline.cjs -- <command> [args]  runs <command> on the same input and prints
//                                                           ITS output instead, so an existing status
//                                                           line keeps working unchanged. No shell: a
//                                                           pipeline or `~` needs `-- sh -c '...'`
//
// Wired as a Claude Code `statusLine` command (see README, "Context wind-down"). Nothing here installs
// it. The status line receives JSON on stdin; this reads `session_id` and `context_window.used_percentage`
// and writes them to the per-session file described in context-file.cjs. It writes on every refresh,
// whether or not the wind-down is switched on: the switch lives in the Stop hook, which alone decides.
//
// FAIL-OPEN: exits 0 on every path. A status line that crashes shows nothing; one that hangs would be
// worse, so the wrapped command gets a hard timeout.

'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const WRAP_TIMEOUT_MS = 3000;
// Files of sessions not seen for a week are removed when a NEW session's file is first written, so the
// directory stays small without a sweep of its own.
const PRUNE_AFTER_MS = 7 * 24 * 3600 * 1000;

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function prune(cf, now) {
  try {
    const dir = cf.contextDir();
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      const p = path.join(dir, name);
      try {
        if (now - fs.statSync(p).mtimeMs > PRUNE_AFTER_MS) fs.unlinkSync(p);
      } catch {
        // another session pruning at the same moment: fine
      }
    }
  } catch {
    // no directory yet, or unreadable: nothing to prune
  }
}

function record(raw) {
  let pct = null;
  try {
    const cf = require(path.join(__dirname, 'context-file.cjs'));
    const input = JSON.parse(raw);
    pct = cf.usedPercentage(input);
    if (pct !== null) {
      const file = cf.fileFor(input.session_id);
      const isNew = file !== null && !fs.existsSync(file);
      const now = Date.now();
      if (cf.write(input.session_id, pct, now) && isNew) prune(cf, now);
    }
  } catch {
    // unparseable input or a missing module: record nothing, still print a line
  }
  return pct;
}

function main() {
  const raw = readStdin();
  const pct = record(raw);
  const sep = process.argv.indexOf('--');
  const wrapped = sep === -1 ? [] : process.argv.slice(sep + 1);
  if (wrapped.length > 0) {
    try {
      const r = spawnSync(wrapped[0], wrapped.slice(1), {
        input: raw,
        encoding: 'utf8',
        timeout: WRAP_TIMEOUT_MS,
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      if (typeof r.stdout === 'string') process.stdout.write(r.stdout);
    } catch {
      // the wrapped command failed to start: print nothing rather than our own line, so a broken
      // wrap is visible as an empty status line
    }
    return;
  }
  process.stdout.write('ctx ' + (pct === null ? '-' : pct + '%') + '\n');
}

// exitCode, not process.exit(): exit() can cut off stdout still draining into a pipe (a wrapped line over
// 64 KiB was truncated on macOS, gatekeeper finding on 1.9.0). Nothing here holds the process open.
process.exitCode = 0;
try {
  main();
} catch {
  // fail open
}
