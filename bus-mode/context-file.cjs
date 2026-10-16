// bus-mode context wind-down: the per-session context file (1.9.0).
//
// One small JSON file per session, written by statusline.cjs (the status-line helper) and read by the
// Stop hook at turn end. Shared by both, the way resolve-root.cjs is shared by the hook and the toggle.
//
//   <dir>/<session_id>.json  =  { "session_id": "...", "used_percentage": 63, "updated_at": 1760000000000 }
//
// <dir> is BUS_MODE_CONTEXT_DIR, else <CLAUDE_CONFIG_DIR or ~/.claude>/bus-mode/context. One directory
// per machine, one file per session, so two sessions in the same repo never read each other's number.
//
// The field the file records is the status-line input's `context_window.used_percentage`. Verified in
// the installed binary (2.1.285): the status-line payload carries `context_window` built from the
// current usage, `{ total_input_tokens, total_output_tokens, context_window_size, current_usage,
// used_percentage, remaining_percentage }`, where used_percentage is an integer clamped to 0..100, or
// null before the first response. `rate_limits.*.used_percentage` is a different number (plan usage),
// and is never read here.
//
// Every reader fails open: anything unexpected returns a state, never throws.

'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

function contextDir(env) {
  const e = env || process.env;
  if (e.BUS_MODE_CONTEXT_DIR) return e.BUS_MODE_CONTEXT_DIR;
  const cfg = e.CLAUDE_CONFIG_DIR || path.join(e.HOME || os.homedir(), '.claude');
  return path.join(cfg, 'bus-mode', 'context');
}

// A session id becomes a file name, so it is checked, never sanitised into something else: a mangled id
// could collide with another session's file. Claude Code ids are UUIDs; anything outside this set is
// refused.
function safeId(sessionId) {
  return typeof sessionId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(sessionId) ? sessionId : null;
}

function fileFor(sessionId, env) {
  const id = safeId(sessionId);
  return id ? path.join(contextDir(env), id + '.json') : null;
}

// The status line's used_percentage, or null when absent or not a number in 0..100.
function usedPercentage(statusInput) {
  const cw = statusInput && statusInput.context_window;
  const v = cw && typeof cw === 'object' ? cw.used_percentage : undefined;
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 ? v : null;
}

// Write atomically (temp file + rename), so the hook never reads half a file. Returns true on success.
function write(sessionId, pct, now, env) {
  const file = fileFor(sessionId, env);
  if (!file || typeof pct !== 'number') return false;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ session_id: sessionId, used_percentage: pct, updated_at: now }));
    fs.renameSync(tmp, file);
    return true;
  } catch {
    return false;
  }
}

// Returns one of:
//   { state: 'ok', pct, ageMs }
//   { state: 'missing' }  no file for this session (status line not wired, or not yet run)
//   { state: 'stale', ageMs }  older than maxAgeMs, or dated in the future
//   { state: 'bad' }  unreadable, unparseable, wrong session, or no usable number
// Only 'ok' carries a percentage; every other state means "no reading", and the hook says nothing.
function read(sessionId, now, maxAgeMs, env) {
  const file = fileFor(sessionId, env);
  if (!file) return { state: 'bad' };
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return { state: e && e.code === 'ENOENT' ? 'missing' : 'bad' };
  }
  let j;
  try {
    j = JSON.parse(raw);
  } catch {
    return { state: 'bad' };
  }
  if (!j || j.session_id !== sessionId) return { state: 'bad' };
  const pct = j.used_percentage;
  if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 100) return { state: 'bad' };
  const at = j.updated_at;
  if (typeof at !== 'number' || !Number.isFinite(at)) return { state: 'bad' };
  const ageMs = now - at;
  // A file dated in the future is as untrustworthy as an old one: the clock moved, or it was not ours.
  if (ageMs < -60000 || ageMs > maxAgeMs) return { state: 'stale', ageMs: ageMs };
  return { state: 'ok', pct: pct, ageMs: ageMs };
}

module.exports = { contextDir, fileFor, safeId, usedPercentage, write, read };
