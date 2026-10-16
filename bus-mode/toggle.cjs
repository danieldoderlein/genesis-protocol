#!/usr/bin/env node
// bus-mode toggle:
//   node tools/bus-mode/toggle.cjs on [N] | off | status | preflight | version   [--repo <path>]
//
// WHICH REPO (1.7.0, bus 2181): the one this SESSION was launched from - the directory the Stop hook
// reads - never the shell's cwd, which persists between Bash calls and moves with every `cd`. Until
// 1.7.0 it was the cwd, and "bus mode off" could remove nothing, print "off", and leave the session
// being woken. The resolution lives in resolve-root.cjs, shared with the hook. Every command prints the
// repo it acted on and where that answer came from; a command that cannot tell REFUSES and changes
// nothing. `off` and `status` also list repos armed elsewhere on the machine, never touching them.
//
// The marker file is LOCAL-ONLY (gitignored). Committing it would switch every clone into bus mode.
//
// MIGRATION: the marker used to be `.claude/auto-mode.on`. `on` writes the new name and removes the
// old; `off` removes BOTH, because a stale legacy marker would keep the hook armed after the operator
// said stop - the one failure here worse than not working at all.
//
// `on` runs the PREFLIGHT (1.5.0): the marker decides whether the session continues; the session's
// permission mode decides whether it can act once it does.
//
// `on` ENDS WITH "NEXT" (1.7.1): guard 2 wakes only from a whats_new reading taken in the current turn,
// after its last board change. The turn that says "bus mode on" usually holds none, so the first stop
// was allowed and bus mode sat armed and never started - an operator leaving for the night saw nothing.
//
// EXIT CODES: 0 done, 1 usage, 2 refused or not changed. `status` and `preflight` are reads: exit 0.

'use strict';
const fs = require('fs');
const path = require('path');
const { resolveRoot, armedElsewhere, contains, safeCwd } = require('./resolve-root.cjs');

// `--repo <path>` or `--repo=<path>` may appear anywhere; the rest is [command] [N].
const rawArgs = process.argv.slice(2);
const args = [];
let repoArg;
let badFlag = null;
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === '--repo') {
    repoArg = rawArgs[i + 1] === undefined ? '' : rawArgs[i + 1];
    i++;
  } else if (a.startsWith('--repo=')) {
    repoArg = a.slice('--repo='.length);
  } else if (a.startsWith('--')) {
    badFlag = a;
  } else {
    args.push(a);
  }
}
const cmd = args[0] || 'status';

// Resolved lazily: `version` and a usage error never need a repo.
let resolved = null;
let root = null;
let marker = null;
let legacy = null;

function rm(p) {
  try {
    fs.unlinkSync(p);
    return true;
  } catch {
    return false;
  }
}


// PREFLIGHT (1.5.0, decision 027). READ-ONLY, ALWAYS EXIT 0, NEVER THROWS.
//
// Measured 2026-09-08 on build 2.1.236: an `ask` rule blocks in every permission mode, including
// `auto` and `bypassPermissions`, even with a broad `Bash(*)` allow present. So an ask rule anywhere
// in the merged settings is a freeze source for an unattended run, and the mode picker cannot save it.
// This reports them, with the file each one lives in, because "somewhere in your settings" is not
// something an operator at 23:00 can act on.
//
// IT DOES NOT SET THE MODE, AND NO TOOL HERE EVER WILL. A project-level `defaultMode:
// "bypassPermissions"` does not take effect (measured on 2.1.285, Genesis v1.13 Phase 0 section 6), and
// writing one at user scope is still refused: an agent granting itself bypass is the CLAUDE.md section 01
// authority axis. The tool
// reports; the human picks the mode. Recorded as a rejected alternative in decision 027 so it does not
// get re-proposed every six weeks.
//
// EXIT 0 EVEN ON FREEZE RISK, deliberately. A read-only reporter that exits nonzero collects `|| true`
// wrappers, and then it reports to nobody. The verdict is a line on stdout; the tests assert on it.
function settingsSources() {
  const home = process.env.HOME || '';
  const cfg = process.env.CLAUDE_CONFIG_DIR || path.join(home, '.claude');
  const managed =
    process.env.BUS_MODE_SETTINGS_MANAGED ||
    '/Library/Application Support/ClaudeCode/managed-settings.json';
  return [
    ['managed', managed],
    ['user', path.join(cfg, 'settings.json')],
    ['project', root ? path.join(root, '.claude', 'settings.json') : null],
    ['project-local', root ? path.join(root, '.claude', 'settings.local.json') : null],
  ];
}

// Decision 025's sharper edge, re-found by adversarial review 2026-09-08: it is NOT only unparseable
// JSON that gets discarded. A file that is perfectly valid JSON with an INVALID VALUE on a KNOWN key -
// `defaultMode: "notARealMode"` - is discarded WHOLE, silently, rc=0, empty stderr: the deny rules
// vanish, the hooks in that file never fire, and the session falls back to the inherited mode. A
// reporter that parsed the JSON successfully and printed "ok" would be reporting a deny floor that is
// not in effect. So the mode value is validated against the known set, and an unrecognised one makes
// the whole source unreadable rather than healthy.
const KNOWN_MODES = ['default', 'manual', 'acceptEdits', 'plan', 'auto', 'dontAsk', 'bypassPermissions'];

function readSettings(file) {
  if (file === null) return { state: 'unresolved' };
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return { state: 'absent' };
  }
  try {
    const j = JSON.parse(raw);
    const perms = (j && j.permissions) || {};
    return {
      state: 'ok',
      mode: perms.defaultMode,
      // A present-but-not-an-array `ask` is UNKNOWN, never zero. Coercing it to [] would report
      // CLEAR for a file whose ask list cannot be read - the same silent all-clear as an unparseable
      // file, one layer down.
      malformed: (perms.ask !== undefined && !Array.isArray(perms.ask)),
      badMode: (perms.defaultMode !== undefined && KNOWN_MODES.indexOf(perms.defaultMode) === -1),
      ask: Array.isArray(perms.ask) ? perms.ask : [],
      deny: Array.isArray(perms.deny) ? perms.deny : [],
    };
  } catch {
    // decision 025: the harness discards a whole file it cannot parse, silently. A rig can therefore
    // lose its entire deny floor and look configured. That is worth a line of its own.
    return { state: 'unparseable' };
  }
}

function preflight() {
  const freeze = [];
  let denyTotal = 0;
  // Any source this tool could not fully read makes the verdict UNKNOWN rather than CLEAR. Decision
  // 025: an unparseable file is discarded ENTIRELY and silently by the harness, which is precisely the
  // state where the deny floor is gone too - so a green all-clear there is the most dangerous line the
  // tool could print.
  let unreadable = 0;
  console.log('--- bus-mode preflight (read-only) ---');
  for (const [label, file] of settingsSources()) {
    let r;
    try {
      r = readSettings(file);
    } catch {
      r = { state: 'unparseable' };
    }
    if (r.state === 'absent') {
      console.log('  ' + label + ': absent  (' + file + ')');
      continue;
    }
    if (r.state === 'unresolved') {
      // Before 1.7.0 these two rows read the DRIFTED cwd's settings, so `on` could report another repo's
      // ask list as this one's. Now an unresolved repo is simply unread - and unread is never CLEAR.
      unreadable++;
      console.log('  ' + label + ': UNKNOWN - the repo could not be resolved, so its settings were not read');
      continue;
    }
    if (r.state === 'unparseable') {
      unreadable++;
      console.log(
        '  ' + label + ': UNPARSEABLE - the harness discards this ENTIRE file, silently (' + file + ')'
      );
      continue;
    }
    if (r.badMode) {
      unreadable++;
      console.log(
        '  ' + label + ': defaultMode "' + r.mode + '" is NOT a known mode - the harness discards this ' +
          'ENTIRE file silently, so its deny rules and hooks are NOT in effect (' + file + ')'
      );
    }
    if (r.malformed) {
      unreadable++;
      console.log('  ' + label + ': `permissions.ask` is present but is not an array - cannot be read (' + file + ')');
    }
    denyTotal += r.deny.length;
    console.log(
      '  ' + label + ': ok  mode=' + (r.mode || '(unset)') + '  ask=' + r.ask.length + '  deny=' + r.deny.length + '  (' + file + ')'
    );
    for (const rule of r.ask) freeze.push([rule, file]);
  }

  if (freeze.length) {
    console.log('');
    console.log('FREEZE SOURCES (an ask rule blocks in EVERY mode - measured 2026-09-08):');
    for (const [rule, file] of freeze) console.log('  ' + rule + '   <- ' + file);
    console.log('');
    console.log(
      '  Each one stops an unattended session on a question nobody is there to answer, and the\n' +
        '  session then looks exactly like an agent still working. Convert each to a `deny` to keep\n' +
        '  the protection without the question: deny binds under bypassPermissions (measured), and a\n' +
        '  denial is a routing event - the agent files a task and takes the next item.'
    );
  }
  console.log('');
  console.log('  deny floor: ' + denyTotal + ' rule(s). Deny is the ONLY class that binds in every mode.');
  console.log('');
  console.log(
    freeze.length
      ? 'PREFLIGHT: FREEZE RISK - ' + freeze.length + ' ask rule(s) in the merged settings'
      : unreadable
        ? 'PREFLIGHT: UNKNOWN - ' + unreadable + ' settings source(s) could not be read; the ask list cannot be confirmed empty'
        : 'PREFLIGHT: CLEAR - no ask rules in the merged settings'
  );
  console.log('');
  console.log('  Unattended run (the operator chooses the mode, this tool never sets it):');
  console.log('    claude --permission-mode bypassPermissions');
  console.log('    in the IDE, pick "Bypass permissions" in the mode picker (shift+tab cycles)');
}

const SOURCE_LABEL = {
  argument: 'the --repo argument',
  CLAUDE_PROJECT_DIR: 'CLAUDE_PROJECT_DIR',
  session: "this session's launch directory, read from its transcript",
  'session-history': 'a session launch directory inside the git root of the current directory',
  'git-root': 'the git root of the current directory (not in a Claude Code session)',
};

function usage() {
  console.error('usage: node tools/bus-mode/toggle.cjs on [max-continuations] | off | status | preflight | version  [--repo <path>]');
  process.exit(1);
}

function resolveForCommand() {
  resolved = resolveRoot({ repo: repoArg, env: process.env, cwd: safeCwd(), allowGitRoot: true });
  if (resolved.root) {
    root = resolved.root;
    marker = path.join(root, '.claude', 'bus-mode.on');
    legacy = path.join(root, '.claude', 'auto-mode.on');
  }
}

function refuse(verb) {
  console.error('bus mode: NOT CHANGED - `' + verb + '` refused: ' + resolved.reason + '.');
  if (resolved.kind === 'unresolved') {
    console.error(
      "  The shell's cwd is deliberately NOT a fallback: it persists between Bash calls and moves with every cd,\n" +
        '  which is how `off` once removed nothing and the session kept waking (bus 2181).\n' +
        '  AGENT: tell HUMAN. Re-run with --repo <the directory this session was launched from> only once HUMAN confirms it.'
    );
  } else if (resolved.kind === 'mismatch') {
    console.error('  AGENT: a session toggles only its own repo. Another rig is disarmed by HUMAN, from that rig.');
  } else if (resolved.kind === 'no-repo') {
    console.error('  Run it from inside the repo, or pass --repo <path>.');
  }
  process.exit(2);
}

function rootLine() {
  let s = '  repo: ' + root + '  [from ' + (SOURCE_LABEL[resolved.source] || resolved.source) + ']';
  const cwd = safeCwd();
  if (cwd === null) s += "\n  note: the shell's cwd no longer exists - ignored on purpose";
  else if (!contains(root, cwd)) s += "\n  note: the shell's cwd is " + cwd + ' - outside this repo, and ignored on purpose';
  return s;
}

function limitOf(p) {
  try {
    const n = parseInt(String(fs.readFileSync(p, 'utf8')).trim(), 10);
    return Number.isFinite(n) && n >= 1 ? 'limit=' + n : 'limit=1 (unparseable content)';
  } catch {
    return 'limit=?';
  }
}

function stamp(d) {
  const z = (x) => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + ' ' + z(d.getHours()) + ':' + z(d.getMinutes());
}

// Other repos with a marker, from session history. Printed after the primary action, and never fatal:
// the listing is a courtesy to the operator's global intent ("bus mode off" usually means everywhere),
// not part of the command. No line here contains "bus mode: ", so nothing can mistake one for a verdict.
function printElsewhere() {
  let others;
  try {
    others = armedElsewhere(root, process.env);
  } catch {
    console.log('  (could not scan for repos armed elsewhere)');
    return;
  }
  if (!others.length) {
    console.log('  armed elsewhere on this machine: none known to session history');
    return;
  }
  console.log('  armed elsewhere on this machine - NOT changed here; HUMAN disarms each from its own repo:');
  for (const o of others) {
    console.log(
      '    ' + o.root + '  ' + limitOf(o.marker) + '  armed since ' + stamp(o.since) +
        (o.marker.endsWith('auto-mode.on') ? '  [legacy marker name]' : '')
    );
  }
}

function main() {
  if (badFlag) {
    console.error('bus mode: unknown flag ' + badFlag);
    usage();
  }
  if (repoArg === '') {
    console.error('bus mode: --repo needs a path');
    usage();
  }
  if (cmd === 'version') {
    const { spawnSync } = require('child_process');
    const r = spawnSync('node', [path.join(__dirname, 'stop-hook.cjs'), '--version'], { encoding: 'utf8' });
    process.stdout.write(r.stdout || 'unknown\n');
    return;
  }
  if (['on', 'off', 'status', 'preflight'].indexOf(cmd) === -1) usage();
  resolveForCommand();

  if (cmd === 'on') {
    if (!root) refuse('on');
    // `on [N]`: how many times the hook may wake the agent per operator message. A bare `on` writes 25,
    // because "go into bus mode" should mean a session that keeps working; only a hand-touched,
    // unparseable marker falls back to the hook's conservative 1.
    // An explicit limit that is not a whole number of 1 or more is a usage error. It used to fall back to
    // 25 without a word, so `on 0` meant the opposite of what it said.
    const DEFAULT_LIMIT = 25;
    if (args[1] !== undefined && !/^[1-9][0-9]*$/.test(args[1])) {
      console.error('bus mode: NOT CHANGED - the limit must be a whole number of 1 or more, got "' + args[1] + '"');
      process.exit(1);
    }
    const limit = args[1] === undefined ? DEFAULT_LIMIT : parseInt(args[1], 10);
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, String(limit) + '\n');
    let back;
    try {
      back = String(fs.readFileSync(marker, 'utf8')).trim();
    } catch {
      back = '(unreadable)';
    }
    if (back !== String(limit)) {
      console.error('bus mode: NOT CHANGED - wrote ' + marker + ' but read back "' + back + '"');
      process.exit(2);
    }
    const migrated = rm(legacy);
    console.log('bus mode: on at ' + root + '  limit=' + limit + (migrated ? '  [migrated from auto-mode.on]' : ''));
    console.log(rootLine());
    preflight();
    console.log('');
    console.log('NEXT, this turn: call whats_new and take the next item. The hook wakes this session only from a');
    console.log("whats_new reading taken since HUMAN's last message, and a task_* or read_posts call after it spends");
    console.log('that reading - so make whats_new the LAST bus call of every turn.');
  } else if (cmd === 'off') {
    if (!root) refuse('off');
    const had = [marker, legacy].filter((p) => fs.existsSync(p));
    for (const p of had) rm(p);
    // Checked on disk, not inferred from rm(): a marker that survives - permissions, a race - must never
    // be reported as off. That silent "off" is the exact failure this version exists to end.
    const still = [marker, legacy].filter((p) => fs.existsSync(p));
    if (still.length) {
      console.error('bus mode: STILL ON at ' + root + ' - could not remove ' + still.join(' and '));
      console.error(rootLine());
      process.exit(2);
    }
    console.log(
      had.length
        ? 'bus mode: off at ' + root + ' - removed ' + had.map((p) => path.relative(root, p)).join(' and ')
        : 'bus mode: off at ' + root + ' - nothing was armed here'
    );
    console.log(rootLine());
    printElsewhere();
  } else if (cmd === 'status') {
    if (!root) {
      console.log('bus mode: UNKNOWN - ' + resolved.reason);
      return;
    }
    const onNew = fs.existsSync(marker);
    const onOld = fs.existsSync(legacy);
    const state = onNew || onOld ? 'on' : 'off';
    const which = onOld && !onNew ? '  [legacy marker - run `on` to migrate]' : '';
    console.log('bus mode: ' + state + ' at ' + root + (onNew ? '  ' + limitOf(marker) : '') + which);
    console.log(rootLine());
    printElsewhere();
  } else {
    console.log(root ? rootLine() : '  repo: UNRESOLVED - ' + resolved.reason);
    preflight();
  }
}

try {
  main();
} catch (e) {
  console.error('bus mode: NOT CHANGED - internal error: ' + (e && e.message ? e.message : String(e)));
  process.exit(2);
}
