// Which repo does bus mode act on? ONE answer, shared by the hook and the toggle (1.7.0, bus 2181).
//
// Until 1.7.0 both sides computed `CLAUDE_PROJECT_DIR || process.cwd()`. That reads as one rule and
// is two, because the harness sets CLAUDE_PROJECT_DIR for HOOKS and leaves it unset in the agent's
// Bash tool (measured 2026-09-11 in VS Code and in a clean CLI launch). So the hook resolved the
// session's launch directory while the toggle resolved the shell's cwd - which persists between Bash
// calls and moves with every `cd`. "bus mode off" removed a marker from wherever the shell had last
// been, printed "off", and the session kept being woken.
//
// The fix is not a better guess at the repo. It is to ask the question the hook already answers.
// The session's launch directory is recoverable from the shell: CLAUDE_CODE_SESSION_ID names the
// transcript, and the transcript's FIRST `cwd` is the launch directory - equal to the hook's
// CLAUDE_PROJECT_DIR in every probe (root launch, subdirectory launch, after a cd). The FIRST one
// only: later records track the shell's cd, and that is the drift itself.
//
// Why not the git root, the option first recommended on bus 2181: from a cwd drifted into ANOTHER
// repo it names that repo - on the reported case it would have disarmed the tool's own repo and left the reporting repo armed -
// and a session launched from a subdirectory has a hook root that is not its git root at all. The git
// root is used only where there is no session to ask: a human at a terminal.
//
// Zero dependencies. Nothing here throws: every function answers null on anything it cannot read.

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { StringDecoder } = require('string_decoder');
// Required, not assumed global: a repo that vendors this directory may lint `.cjs` with only the
// CommonJS globals declared (one rig's does), and a bare `Buffer` then fails its lint (found 2026-09-12).
const { Buffer } = require('buffer');

const MARKER_NAMES = ['bus-mode.on', 'auto-mode.on']; // legacy name last; see stop-hook.cjs

// A session id is a NAME, never a path. Without this, an id of "../x" walks out of the projects dir.
const SESSION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function configDir(env) {
  return env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

// 'none' when the record carries no cwd; 'bad' when it carries one that cannot be trusted (unparseable,
// relative, not a string); otherwise the absolute cwd. A 'bad' record STOPS the search. Skipping it would
// hand back the NEXT cwd, which may already have drifted - the exact fallback this module exists to remove
// (found by the 1.7.0 gatekeeper review: a malformed or relative first record resolved a drifted repo).
function cwdOf(line) {
  if (!line || line.indexOf('"cwd"') === -1) return 'none';
  let r;
  try {
    r = JSON.parse(line);
  } catch {
    return 'bad';
  }
  if (!r || typeof r !== 'object' || !Object.prototype.hasOwnProperty.call(r, 'cwd')) return 'none';
  return typeof r.cwd === 'string' && path.isAbsolute(r.cwd) ? r.cwd : 'bad';
}

// The FIRST `cwd` in a transcript, read in chunks rather than whole: a live transcript runs to many
// megabytes and the answer is on its first few lines. Capped, so a pathological file costs a bounded
// read and answers null rather than hanging a Stop.
function firstCwd(file, capBytes) {
  if (typeof file !== 'string' || file === '') return null;
  let fd;
  try {
    fd = fs.openSync(file, 'r');
  } catch {
    return null;
  }
  try {
    const cap = capBytes || 8 * 1024 * 1024;
    const buf = Buffer.alloc(256 * 1024);
    const dec = new StringDecoder('utf8'); // a multibyte character split across chunks stays whole
    let carry = '';
    let read = 0;
    let head = true;
    while (read < cap) {
      const n = fs.readSync(fd, buf, 0, buf.length, null);
      if (n <= 0) break;
      read += n;
      let text = carry + dec.write(buf.subarray(0, n));
      if (head) {
        text = text.replace(/^\uFEFF/, ''); // a byte-order mark must not make line 1 unparseable
        head = false;
      }
      const lines = text.split('\n');
      carry = lines.pop();
      for (const line of lines) {
        const c = cwdOf(line);
        if (c === 'bad') return null;
        if (c !== 'none') return c;
      }
    }
    const last = cwdOf(carry + dec.end());
    return last === 'none' || last === 'bad' ? null : last;
  } catch {
    return null;
  } finally {
    try {
      fs.closeSync(fd);
    } catch {
      // nothing to do
    }
  }
}

// <config>/projects/<encoded-launch-dir>/<session-id>.jsonl. The encoded directory name is lossy
// (every character that is not a letter or digit becomes "-"), so it is never decoded: the file is found by its session id and the
// root read from inside it.
// Returns { file } for exactly one match, { matches: [...] } when the id is found under more than one
// project dir (refused - two candidate roots is not an answer), or null.
function sessionTranscript(env) {
  const sid = env.CLAUDE_CODE_SESSION_ID;
  if (typeof sid !== 'string' || !SESSION_ID_RE.test(sid)) return null;
  const projects = path.join(configDir(env), 'projects');
  let dirs;
  try {
    dirs = fs.readdirSync(projects, { withFileTypes: true });
  } catch {
    return null;
  }
  const found = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const p = path.join(projects, d.name, sid + '.jsonl');
    try {
      if (fs.statSync(p).isFile()) found.push(p);
    } catch {
      // not in this project dir
    }
  }
  if (found.length === 1) return { file: found[0] };
  return found.length ? { matches: found } : null;
}

// Signals that this process runs inside a Claude Code session. The session id is the one the resolver
// needs, but its ABSENCE is not proof of being outside one: treating one variable's absence as proof is
// the silent-fallback shape this module exists to remove. Any of the three means "ask the session".
function inSession(env) {
  return Boolean(env.CLAUDE_CODE_SESSION_ID || env.CLAUDECODE || env.CLAUDE_CODE_ENTRYPOINT);
}

// Path-segment containment on REAL paths: /tmp and /private/tmp are one place on macOS, so are two
// letter-cases of one path on a case-insensitive volume (see realOr), and "/a/repo2" is not inside
// "/a/repo".
function contains(parent, child) {
  const p = realOr(parent);
  const c = realOr(child);
  return c === p || c.startsWith(p.endsWith(path.sep) ? p : p + path.sep);
}

// Walk up for a `.git` entry (a directory, or a file in a worktree). No `git` process spawned.
function gitRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    try {
      fs.statSync(path.join(dir, '.git'));
      return dir;
    } catch {
      // keep walking
    }
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

// process.cwd() THROWS when the shell stands in a deleted directory (uv_cwd ENOENT) - a removed worktree
// is enough. Only the terminal path and a relative --repo need the cwd; they refuse without one.
function safeCwd() {
  try {
    return process.cwd();
  } catch {
    return null;
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// { root, source, detail } on success; { root: null, reason } on refusal.
//
// First, THE SESSION'S ROOT, if this is a session:
//   CLAUDE_PROJECT_DIR           - what the hook uses; set for hooks, unset in the Bash tool
//   else the session launch dir  - CLAUDE_CODE_SESSION_ID -> transcript -> FIRST cwd
//   in a session and neither works -> UNRESOLVED. There is no cwd fallback: that is the defect itself.
// Then:
//   --repo P      accepted only if it IS the session's root, or the session root is unresolved, or
//                 there is no session. An agent naming another rig's repo is refused, which is what
//                 keeps --repo from becoming "off --all" one repo at a time.
//   session root  -> the answer
//   UNRESOLVED    -> refuse, naming --repo
//   no session    -> a human at a terminal: the git root of the cwd, NARROWED to the deepest directory
//                    a session was ever launched from inside it (a session launched from repo/apps/web
//                    keeps its marker there, measured). Bounded BY the git root, so a session once
//                    launched from ~ can never capture a repo. No git root -> refuse.
function resolveRoot(opts) {
  const env = opts.env || process.env;
  const cwd = opts.cwd === undefined ? safeCwd() : opts.cwd;

  let session = null; // { root, source, detail } | { unresolved: reason } | null (not a session)
  if (env.CLAUDE_PROJECT_DIR) {
    session = { root: env.CLAUDE_PROJECT_DIR, source: 'CLAUDE_PROJECT_DIR' };
  } else if (inSession(env)) {
    const t = sessionTranscript(env);
    if (t && t.file) {
      const c = firstCwd(t.file);
      session = c
        ? { root: c, source: 'session', detail: t.file }
        : { unresolved: 'its transcript ' + t.file + ' records no launch directory' };
    } else if (t && t.matches) {
      session = { unresolved: 'its session id matches ' + t.matches.length + ' transcripts (' + t.matches.join(', ') + ')' };
    } else if (!env.CLAUDE_CODE_SESSION_ID) {
      session = { unresolved: 'CLAUDE_CODE_SESSION_ID is not set, so its launch directory cannot be looked up' };
    } else {
      session = { unresolved: 'no transcript for its session id under ' + path.join(configDir(env), 'projects') };
    }
  }

  if (opts.repo !== undefined) {
    if (typeof opts.repo !== 'string' || opts.repo === '') return { root: null, kind: 'bad-arg', reason: '--repo needs a path' };
    if (!path.isAbsolute(opts.repo) && cwd === null) {
      return { root: null, kind: 'bad-arg', reason: '--repo ' + opts.repo + ' is relative, and the current directory no longer exists' };
    }
    const r = path.resolve(cwd || path.sep, opts.repo);
    if (!isDir(r)) return { root: null, kind: 'bad-arg', reason: '--repo ' + r + ' is not a directory' };
    if (session && session.root && realOr(r) !== realOr(session.root)) {
      return {
        root: null,
        kind: 'mismatch',
        reason: 'this session belongs to ' + session.root + ', and --repo names a different repo (' + r + '). ' +
          'A session toggles its own repo; another rig is disarmed from that rig',
      };
    }
    return { root: r, source: 'argument', detail: '--repo' };
  }

  if (session && session.root) return session;
  if (session) {
    return { root: null, kind: 'unresolved', reason: 'this is a Claude Code session, but ' + session.unresolved };
  }

  if (!opts.allowGitRoot) return { root: null, kind: 'unresolved', reason: 'no CLAUDE_PROJECT_DIR and no session' };
  if (cwd === null) {
    return { root: null, kind: 'no-repo', reason: 'not in a Claude Code session, and the current directory no longer exists' };
  }
  const g = gitRoot(cwd);
  if (!g) return { root: null, kind: 'no-repo', reason: 'not in a Claude Code session, and ' + cwd + ' is not inside a git repository' };
  let best = null;
  for (const r of sessionRoots(env)) {
    if (contains(g, r) && contains(r, cwd) && (!best || realOr(r).length > realOr(best).length)) best = r;
  }
  return best && realOr(best) !== realOr(g)
    ? { root: best, source: 'session-history', detail: g }
    : { root: g, source: 'git-root', detail: cwd };
}

// The NATIVE realpath (1.10.0): on a case-insensitive volume (default APFS) it returns the case stored
// on disk, so a home spelled "alice" and the same home spelled "ALICE" canonicalise to one string. The JS
// realpathSync keeps the case it was given, and two spellings of one repo then compared unequal - a
// --repo refused as "a different repo", or a rig listed as armed elsewhere when it is this one. The
// dispatcher already canonicalises this way.
function realOr(p) {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return path.resolve(p);
  }
}

function armedMarkers(root) {
  const out = [];
  for (const name of MARKER_NAMES) {
    const m = path.join(root, '.claude', name);
    try {
      const st = fs.statSync(m);
      if (st.isFile()) out.push({ root: root, marker: m, since: st.mtime });
    } catch {
      // not armed under this name
    }
  }
  return out;
}

// Every directory a Claude Code session has been launched from on this machine, read from the first
// cwd of the newest transcripts in each project dir. No registry to keep in sync: the harness already
// writes this record. Only these roots can hold a marker that wakes anything, since the hook fires
// only inside a session.
function sessionRoots(env) {
  const projects = path.join(configDir(env), 'projects');
  let dirs;
  try {
    dirs = fs.readdirSync(projects, { withFileTypes: true });
  } catch {
    return [];
  }
  const roots = new Map();
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const pdir = path.join(projects, d.name);
    let files;
    try {
      files = fs.readdirSync(pdir).filter((f) => f.endsWith('.jsonl'));
    } catch {
      continue;
    }
    const dated = [];
    for (const f of files) {
      try {
        dated.push([fs.statSync(path.join(pdir, f)).mtimeMs, f]);
      } catch {
        // vanished mid-scan
      }
    }
    dated.sort((a, b) => b[0] - a[0]);
    for (const [, f] of dated.slice(0, 3)) {
      const c = firstCwd(path.join(pdir, f), 1024 * 1024);
      if (c) {
        roots.set(realOr(c), c);
        break;
      }
    }
  }
  return Array.from(roots.values());
}

// Markers armed in OTHER repos. Reported, never touched: each repo is its own rig's call.
function armedElsewhere(currentRoot, env) {
  const here = currentRoot ? realOr(currentRoot) : null;
  const out = [];
  for (const r of sessionRoots(env || process.env)) {
    if (here && realOr(r) === here) continue;
    out.push.apply(out, armedMarkers(r));
  }
  return out.sort((a, b) => a.root.localeCompare(b.root));
}

module.exports = { MARKER_NAMES, firstCwd, resolveRoot, armedElsewhere, realOr, contains, inSession, safeCwd };
