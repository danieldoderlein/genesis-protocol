#!/usr/bin/env node
// bus-mode falling-edge Stop hook (decision 022, renamed + third guard 2026-08-31).
// Pattern source: the falling-edge pattern document (archived with decision 022).
//
// WHY "BUS MODE" AND NOT "AUTO MODE": Claude Code itself ships `--permission-mode auto` AND a
// `claude auto-mode` subcommand ("Inspect auto mode classifier configuration"). Two different systems
// answering to one name, and the collision had already produced confused prose in a live operator
// queue - one entry blamed "auto mode's classifier" (Claude Code's) for refusing a write, two
// paragraphs from another describing "auto mode" (this tool). The new name says what actually drives
// the agent. The legacy `.claude/auto-mode.on` marker is still honoured; see markerPaths().
//
// Fail-open by design: every error path exits 0 with no output (allow).
// Contract (Claude Code Stop hook, as of 2026-08-22): stdin carries JSON with
// session_id, transcript_path, stop_hook_active; printing
// {"decision":"block","reason":"..."} and exiting 0 blocks the stop and feeds
// the reason to the agent as its next instruction; exiting 0 with no output
// allows the stop. Tool results appear in the transcript as type:"user"
// records. Harness-volatile: re-check on the section 06 triggers.

'use strict';
const fs = require('fs');
const path = require('path');

// Bump on any behaviour change. `node stop-hook.cjs --version` prints it, so an agent can be asked
// what it is running without reading the file. On a single machine every rig points at ONE copy and
// this is only ever informational; it earns its keep the day a second machine holds a second copy.
// 1.10.0 (dev-hub P2, ruling 2026-10-15-8): the adoption block names the toggle home-relative, so one
// text works on a machine whose home differs in letter-case, and resolve-root.cjs compares paths by
// their native realpath. Nothing in this hook's own behaviour changed.
const VERSION = '1.10.0';
if (process.argv.includes('--version')) {
  process.stdout.write(VERSION + '\n');
  process.exit(0);
}

// CUSTOMIZE: point this wording at your rig's own coordination rules.
// Note this only ever fires when the board ALREADY has work (guard 2), so it never needs to say
// "check whether there is anything" - there is.
// 1.7.1: it does need to say what the NEXT wake runs on. Guard 2 decides it from a whats_new reading
// taken after the turn's last board change, so a woken agent that ships a task and ends its turn there
// lets the session stop with work left - and nothing told it so (found 2026-09-12 writing the fleet
// adoption prompt; the live end-to-end run passed only because the agent under test knew). The old
// closing line named a repo-relative toggle path most rigs do not have. The first 48 characters, which
// the brake counts on (REASON_FINGERPRINT), are unchanged.
// 1.9.1 (task 3750): "is NOT empty" became "has startable work", the rule guard 2 has counted
// since 1.8.2. That moves the first 48 characters, so the old prefix stays recognised as this hook's
// voice (LEGACY_REASON_FINGERPRINTS): a session that spans the upgrade still has the old wakes in its
// transcript, and on harness builds that write no isMeta (where the fingerprint is the fallback), read
// as the operator they would restart the brake's count. Both texts begin
// "Bus mode is on, and your board", which is what a field report counts wakes by.
// 1.9.2 (task 3765): guard 2 also wakes on unread posts addressed to the agent, and then "has
// startable work" was false (seen live 2026-10-14). The text now names both triggers and lists an
// unread post among the next items. The 1.9.1 prefix joins the legacy fingerprints; all three texts
// begin "Bus mode is on, and your board".
const REASON =
  'Bus mode is on, and your board has work for you (a startable task or an unread post) - that was ' +
  'checked before you were woken, so do not treat this as a speculative nudge. Read what is there and ' +
  'take the next actionable item: an unread post, what is assigned to you, or anything unassigned and ' +
  'in bounds. If everything on it is in fact waiting on ' +
  'someone else, do not spin - reassign it to whoever owes the next move, so your plate reflects what ' +
  'you can actually do. Make whats_new the LAST bus call of this turn: the next wake is decided from ' +
  'the latest reading alone, and any task or read_posts call after it spends that reading, which can ' +
  'let this session stop with work still on the board. Only the operator leaves bus mode ("bus mode off").';

// BOTH names are honoured, and the legacy one is not a courtesy - dropping it would have switched the
// tool silently OFF on every rig still holding the old marker, which reads exactly like a quiet board.
// toggle.cjs migrates a rig on its next `on`.
// The repo this Stop belongs to, resolved once per invocation in main() (1.7.0, bus 2181).
let RESOLVED_ROOT = null;
// The wind-down's setting for this invocation (1.9.0), or null when off. Set in main() before the
// transcript is read, because it decides whether the ceremony text counts as this hook's voice.
let WINDDOWN_CFG = null;

function markerPaths() {
  if (!RESOLVED_ROOT) return [];
  return [
    path.join(RESOLVED_ROOT, '.claude', 'bus-mode.on'),
    path.join(RESOLVED_ROOT, '.claude', 'auto-mode.on'), // legacy (pre-2026-08-31)
  ];
}

// Without CLAUDE_PROJECT_DIR, the root is this session's launch dir: its transcript's FIRST cwd. The
// resolver is required LAZILY and inside a try, so on the path every build actually takes (the env var
// set) it is never loaded, and a missing or broken module fails OPEN like everything else here.
function rootFromTranscript(transcriptPath) {
  try {
    return require(path.join(__dirname, 'resolve-root.cjs')).firstCwd(transcriptPath);
  } catch {
    return null;
  }
}

// Debug-only canary. The toggle now trusts that a session's transcript records its launch dir first and
// that it equals CLAUDE_PROJECT_DIR - measured across every transcript on the machine, but measured is
// not guaranteed across builds. The hook is the one place both values are visible at once, so under
// BUS_MODE_DEBUG it says whether they still agree. Stderr, like every debug line: stdout is the protocol.
function rootCanary(envRoot, input) {
  try {
    const r = require(path.join(__dirname, 'resolve-root.cjs'));
    const t = r.firstCwd(input && input.transcript_path);
    debugLog({
      rootCheck: t === null ? 'no-transcript-cwd' : r.realOr(t) === r.realOr(envRoot) ? 'agree' : 'DISAGREE',
      envRoot: envRoot,
      transcriptRoot: t,
    });
  } catch {
    // diagnostics never break the hook
  }
}

// This hook's OWN block reason comes back into the transcript as a type:"user" record with STRING
// content - the same shape as a message typed by the operator, with nothing in it to tell them apart
// (field-found on a production rig, 2026-09-01). Left unhandled, the hook mistakes its own voice for the
// operator's: "the last human message" moves to the injection, and every turn boundary computed from
// it is wrong. Latent while guard 1 blocks at one continuation; load-bearing the moment it does not.
// Matched on a prefix of REASON so a rig that CUSTOMIZEs the wording keeps the detection for free.
const REASON_FINGERPRINT = REASON.slice(0, 48);
// The 48-character prefixes of earlier wake texts: 1.9.0 and before, then 1.9.1. Append, never replace.
const LEGACY_REASON_FINGERPRINTS = [
  'Bus mode is on, and your board is NOT empty - th',
  'Bus mode is on, and your board has startable wor',
];

function hasReasonFingerprint(s) {
  return s.indexOf(REASON_FINGERPRINT) !== -1 || LEGACY_REASON_FINGERPRINTS.some((f) => s.indexOf(f) !== -1);
}

// 1.9.0: the context wind-down's closing-ceremony instruction is this hook's voice too, and is recognised
// the same way: by a constant prefix that no percentage or threshold precedes. ONLY WHILE THE WIND-DOWN
// IS ON (gatekeeper finding on 1.9.0): recognised unconditionally, a transcript that merely QUOTED the
// sentence - an operator message, a sub-agent's report - would be read as the hook's voice with the
// wind-down off, and off would no longer be identical to 1.8.2. WINDDOWN_CFG is set once per invocation
// in main(), before the transcript is read.
const CEREMONY_PREFIX = 'Context wind-down: the closing ceremony is due now.';
const CEREMONY_FINGERPRINT = CEREMONY_PREFIX.slice(0, 48);

function isCeremonyText(s) {
  return typeof s === 'string' && s.indexOf(CEREMONY_FINGERPRINT) !== -1;
}

function isInjectedReason(s) {
  return typeof s === 'string' && (hasReasonFingerprint(s) || (WINDDOWN_CFG !== null && isCeremonyText(s)));
}

// NOT EVERY STRING-CONTENT USER RECORD IS THE OPERATOR (1.8.0, bus 2857). A finished background agent
// or a Monitor event is recorded as type:"user" with STRING content "<task-notification>...", the same
// shape as a typed message. Each one became "the last human message", continuationsSoFar() restarted
// from 0, and the brake never reached its limit: measured on a real session, 375 wakes in about two
// hours against a marker limit of 25. Builds that write `version` on records also say who spoke:
// the operator is origin.kind "human"; a notification is "task-notification" (a peer session's message
// is "peer"); and this hook's own injected feedback carries isMeta:true with no origin. So a record
// whose origin.kind is present and not "human", or that is isMeta, is not the operator. Older builds
// have neither field; there the fingerprint and tool_result checks below stay the fallback, plus the
// notification's own prefix, which no operator types.
const TASK_NOTIFICATION_PREFIX = '<task-notification>';

function hasNonHumanOrigin(r) {
  if (r.isMeta === true) return true;
  const o = r.origin;
  return !!(o && typeof o === 'object' && o.kind !== undefined && o.kind !== null && o.kind !== 'human');
}

// 1.8.1 (gatekeeper findings on 1.8.0, measured against ~300 real transcripts):
//   - A COMPACTION SUMMARY IS NOT THE OPERATOR. After a compaction the harness writes the summary as a
//     type:"user" record with string content, no origin and no isMeta - only `isCompactSummary: true`
//     tells it apart. Counted as human, every compaction reset the brake and a long run never reached
//     its limit. The records before it stay in the same transcript, so skipping it lets the count run
//     on from the operator's real last message.
//   - AN EXPLICIT HUMAN ORIGIN WINS. An operator who pastes a wake message is still the operator; the
//     fingerprint and notification-prefix checks are the fallback for builds that write no origin.
function hasHumanOrigin(r) {
  const o = r.origin;
  return !!(o && typeof o === 'object' && o.kind === 'human');
}

function isHumanMessage(r) {
  // Tool results are recorded as type "user" too and MUST NOT count.
  if (!r || r.type !== 'user' || !r.message) return false;
  if (r.isCompactSummary === true) return false;
  if (hasNonHumanOrigin(r)) return false;
  const explicitHuman = hasHumanOrigin(r);
  const c = r.message.content;
  if (typeof c === 'string') {
    if (explicitHuman) return true;
    if (c.trimStart().startsWith(TASK_NOTIFICATION_PREFIX)) return false;
    return !isInjectedReason(c);
  }
  if (Array.isArray(c)) {
    if (c.some((b) => b && b.type === 'tool_result')) return false;
    if (explicitHuman) return true;
    return !c.some((b) => b && b.type === 'text' && isInjectedReason(b.text));
  }
  return false;
}

// How many times this hook has already woken the agent since the operator last spoke.
function continuationsSoFar(records, lastHuman) {
  let n = 0;
  for (let i = lastHuman + 1; i < records.length; i++) {
    const r = records[i];
    if (!r || r.type !== 'user' || !r.message) continue;
    const c = r.message.content;
    if (typeof c === 'string' && isInjectedReason(c)) n++;
    else if (Array.isArray(c) && c.some((b) => b && b.type === 'text' && isInjectedReason(b.text))) n++;
  }
  return n;
}

// GUARD 1 IS BOUNDED, NOT REMOVED (2026-09-01). Its original rationale - "without this the block has
// no exit" - predates guard 2, and a rig reasonably asked whether guard 2 is now the exit. It is not:
// guard 2 stops only when the BOARD empties, and a plate can still fail to empty - excluding blocked
// and in_progress tasks (tasks 1631, 3670) catches work the bus KNOWS is waiting, but not work that is merely mis-assigned.
// That exit is data-dependent; this one is structural, and replacing a
// structural brake with a data-dependent one is how a loop becomes unbounded in exactly the case
// nobody tests. So the brake stays and gains a dial: N continuations per operator message, default 1,
// which is precisely the behaviour every rig has today.
function continuationLimit() {
  const raw = process.env.BUS_MODE_MAX_CONTINUATIONS;
  const fromEnv = raw === undefined ? NaN : parseInt(raw, 10);
  if (Number.isFinite(fromEnv) && fromEnv >= 1) return fromEnv;
  for (const p of markerPaths()) {
    try {
      const n = parseInt(String(fs.readFileSync(p, 'utf8')).trim(), 10);
      if (Number.isFinite(n) && n >= 1) return n;
    } catch {
      // marker unreadable or not a number: fall through to the default
    }
  }
  return 1;
}

function hasToolUse(r) {
  const c = r && r.message && r.message.content;
  return Array.isArray(c) && c.some((b) => b && b.type === 'tool_use');
}

// ── The board check (guard 2; two readings, 2026-09-01) ─────────────────────────
// This guard decides from an ACTUAL bus reading, never from an inference. It accepts the reading from
// either of two places in the transcript, and takes the most recent one in the CURRENT TURN:
//
//   (a) An `mcp_tool` Stop hook registered ahead of this one, calling whats_new(advance_cursor:false).
//       The harness records its result as an attachment:
//         { type: "attachment", attachment: { type: "hook_success", hookEvent: "Stop", stdout: "<json>" } }
//       Preferred where the build has it: the reading is taken at stop time, so it cannot be stale.
//
//   (b) THE BUILD-FLOOR FALLBACK: the agent's OWN whats_new tool result, recorded as a tool_result
//       block. `mcp_tool` is a documented hook type that older builds simply do not have - and an
//       unknown hook type does not degrade, it voids the ENTIRE settings file (see README). A rig on
//       such a build would otherwise read null forever: a guard that always answers "no reading" is
//       not a conservative guard, it is an absent one. The agent already checks the board at the end
//       of every unit of work (that is the rule this hook exists to enforce), so its own reading is
//       there to be used.
//
// BOUNDED TO THE CURRENT TURN. Only records after the last human message count. A reading from an
// earlier turn describes a board that has since been worked; acting on it is worse than no reading.
//
// Returns true (there is work), false (the queue is empty), or null (could not tell).
// NULL IS NOT FALSE: "no reading" and "read: empty" are different, and conflating them is how a check
// stops being a check. The caller fails open on null.
function readBusPayload(rec) {
  // (a) a companion hook's stdout.
  const att = rec && rec.attachment;
  if (att && att.type === 'hook_success' && typeof att.stdout === 'string') {
    try {
      return JSON.parse(att.stdout);
    } catch {
      return null;
    }
  }
  // (b) the agent's own tool result. Tool results are recorded as type "user".
  if (!rec || rec.type !== 'user' || !rec.message) return null;
  const content = rec.message.content;
  if (!Array.isArray(content)) return null;
  for (let i = content.length - 1; i >= 0; i--) {
    const block = content[i];
    if (!block || block.type !== 'tool_result') continue;
    let text = null;
    if (typeof block.content === 'string') text = block.content;
    else if (Array.isArray(block.content)) {
      for (const part of block.content) {
        if (part && part.type === 'text' && typeof part.text === 'string') {
          text = part.text;
          break;
        }
      }
    }
    if (typeof text !== 'string') continue;
    try {
      return JSON.parse(text);
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * A BLOCKED task is not work. It is a task waiting on someone else - an unmet dependency, or an
 * open manual block - and the agent woken for it can do nothing but look at it again.
 *
 * Counting it as available work made the hook contradict its own closing instruction. The
 * wake-up text said "your board is NOT empty ... do not treat this as a speculative nudge" and
 * ends "Stop when the board is genuinely empty ... Do not invent work to stay awake." With a
 * fully blocked plate both fire at once: the hook refuses the idle while the rule tells the
 * session to take it, so an agent obeying the wake-up literally is pushed toward inventing work.
 * Measured on a production rig over four consecutive wake-ups, where it nearly started a 767-line
 * redesign that a pending decision would have changed. Every one of those wake-ups is also a
 * full turn billed against a large context.
 *
 * Ruled by the operator on bus task 1631, option 1: exclude blocked from the count. Deliberately NOT
 * option 2 (also excluding tasks owned by another actor) - this tool is the shared
 * install, so the narrow change is the right one, and `my_open_tasks` is already the caller's
 * own plate.
 *
 * Absent status is counted as work: a digest from a bus version that does not report status
 * should keep waking the agent rather than silently going quiet, which is the safer failure.
 *
 * AN IN-PROGRESS TASK IS NOT WORK EITHER (1.8.2, tasks 3670 and 3498). Someone is already
 * on it - usually a background sub-agent this session launched, whose completion notification wakes
 * the session anyway. Counting it woke one rig's lead 15-20 times in a row on 2026-10-10, each wake one of the
 * 25 continuations, with every agent-owned task in_progress under a running helper and everything
 * still todo assigned to a person. Only todo work is startable, which is the rule llm-bus decision 093
 * uses for /api/wait. The exclusion is a short list rather than "todo only", so an unknown future
 * status still counts, the same safer failure as an absent one.
 */
const NOT_STARTABLE = ['blocked', 'in_progress'];
function actionableTaskCount(tasks) {
  return tasks.filter((t) => !t || typeof t !== 'object' || !NOT_STARTABLE.includes(t.status)).length;
}

/**
 * Diagnostics for guard 2, off unless BUS_MODE_DEBUG is set to a non-empty value.
 *
 * STDERR, NEVER STDOUT. This hook's stdout IS its protocol channel - the harness parses it as the
 * decision JSON - so a debug line written there would not merely be noise, it would corrupt the
 * decision. That is the whole reason this is not a console.log.
 *
 * Added in 1.4.0 for a defect that could not be reproduced from the outside: the hook woke a
 * session whose board was measurably empty, and running it again minutes later against the SAME
 * transcript declined to fire. The suspicion is that the transcript is not fully flushed when the
 * hook runs, so guard 2 reads a correct decision from a STALE digest. `recordsAfterDigest` is the
 * number that tests it: on a healthy read the newest digest is near the end of the transcript, and
 * a large distance means the hook decided from something old.
 */
function debugLog(fields) {
  if (!process.env.BUS_MODE_DEBUG) return;
  try {
    process.stderr.write('[bus-mode ' + VERSION + '] ' + JSON.stringify(fields) + '\n');
  } catch {
    // Diagnostics must never be able to break the hook they are diagnosing.
  }
}

/**
 * BOUNDED TO THE CURRENT BOARD, not merely the current turn (1.6.0, bus 1802).
 *
 * The turn bound above is the same idea one level coarser: a reading describes a board, and once
 * that board has been WORKED the reading is fiction. A turn boundary is a proxy for "the board
 * changed"; these calls are the thing itself. Shipping a task, filing one, or reading mail all move
 * exactly the numbers guard 2 counts - `read_posts` included, because reading mail is what clears
 * `unread_posts`.
 *
 * MEASURED, not reasoned. Replaying ten real fires from one production session: the two that woke the
 * agent on nothing had read a digest 221 and 88 records old, and the 221 case had ELEVEN of these
 * calls after it (read_posts, task_create, task_edit, task_start, task_ship). Every healthy read had
 * none. One suppression in twelve, and it was the right one.
 *
 * WHY NOT THE FIX THAT WAS APPROVED on bus 1830 ("prefer a Stop-event attachment, fall back to the
 * agent's own digest"): the same replay showed it changes NEITHER bad case. At the first Stop of a
 * turn the companion hook's attachment does not exist yet, so the preference has nothing to prefer
 * and falls straight back to the identical stale digest; attachments only appear on later stops
 * within an already-continued turn. It would have shipped as a no-op. This check subsumes it - a
 * stale attachment is suppressed on the same evidence as a stale digest - so no preference is
 * needed, and the coupling Paul wanted to avoid never arises.
 */
const MUTATING_BUS_TOOL =
  /task_(ship|resolve|create|cancel|assign|edit|start|block|answer|reopen|depend|undepend)|read_posts/;

// The narrower set that can move `open_unassigned` itself (see unassignedBaseline): a task enters the
// pool (create, reopen, an assign that unassigns, a resolve that lifts a block) or leaves it (start,
// assign, cancel).
// 1.9.3 (task 3710, llm-bus task 3459): since llm-bus 2.0.68 (its decision 093) the count holds
// only startable unassigned tasks, so three more calls can lower it: block, depend, and answer (an
// unassigned decision still to do leaves the pool when answered). A lowering by this agent can mask a
// task someone else filed ("30, this agent depends one (29), a new task arrives (30)": "30 then 30",
// the new task missed), so all three void the baseline. Ship and undepend can only raise the count
// (ship is legal only from in_progress, which is never counted; undepend only removes edges); a raise
// masks nothing and wakes the session for work that really became startable. Voiding on ship cost a
// standing backlog one empty wake on every turn that shipped a task (gatekeeper finding on 1.8.1's
// first cut), so ship and undepend stay out. Edit and read_posts leave the count alone.
const UNASSIGNED_MOVING_BUS_TOOL = /task_(create|start|assign|resolve|cancel|reopen|block|depend|answer)/;

// The first bus tool_use in (from, to) whose name matches `pattern`, or null. `to` defaults to the end.
function boardChangedAfter(records, from, to, pattern) {
  const end = to === undefined ? records.length : Math.min(to, records.length);
  const re = pattern || MUTATING_BUS_TOOL;
  for (let i = from + 1; i < end; i++) {
    const content = records[i] && records[i].message && records[i].message.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (!block || block.type !== 'tool_use') continue;
      if (typeof block.name === 'string' && re.test(block.name)) return block.name;
    }
  }
  return null;
}

/**
 * A STANDING BACKLOG IS NOT NEW WORK (1.8.0, bus 2293). Until 1.8.0 any `open_unassigned > 0` woke the
 * session. On a project that keeps a backlog - measured on one rig: some 30 unassigned items nobody on
 * that rig should grab - the count is never 0, so guard 2 never said idle and every stop was blocked
 * until the brake (which bus 2857 had also broken, see isHumanMessage). The operator's expectation: a
 * session is woken by NEW items, not by the same backlog read again. So unassigned counts as work only
 * when it INCREASED since the previous whats_new digest in the transcript - searched backwards past the
 * current one, across turns, because the backlog outlives any turn. With no earlier digest the old rule
 * holds and any unassigned wakes, so a first reading still starts the loop. `unread_posts` and the
 * actionable `my_open_tasks` (blocked and in_progress excluded, tasks 1631 and 3670) are unchanged: those are this actor's own.
 *
 * A BASELINE IS ONLY A BASELINE IF NOTHING MOVED IT (1.8.1, gatekeeper finding on 1.8.0). Comparing two
 * counts is blind to a change and its undo: previous 30, someone files one (31), this agent claims
 * another (30), and "30 then 30" reads as no new work - with the new item absorbed into the baseline
 * for good. So when a call that can move the count ran between the two digests, the baseline is
 * UNKNOWN and the first-reading rule applies (any unassigned wakes). The continuation brake bounds
 * what that costs. Changes by OTHER actors leave no trace in this transcript and stay invisible.
 * Returns { was, voidedBy }: `was` is the earlier digest's count, or null when there is none or when
 * `voidedBy` names the task call that made it unreliable.
 */
// The index of the assistant record that issued the tool call whose result is records[resultIdx], or
// resultIdx itself when there is none to find (a companion hook's attachment, or an unmatched id).
function callIndexOf(records, resultIdx) {
  const content = records[resultIdx] && records[resultIdx].message && records[resultIdx].message.content;
  if (!Array.isArray(content)) return resultIdx;
  const ids = content.filter((b) => b && b.type === 'tool_result' && b.tool_use_id).map((b) => b.tool_use_id);
  if (ids.length === 0) return resultIdx;
  for (let k = resultIdx - 1; k >= 0; k--) {
    const c = records[k] && records[k].type === 'assistant' && records[k].message && records[k].message.content;
    if (Array.isArray(c) && c.some((b) => b && b.type === 'tool_use' && ids.includes(b.id))) return k;
  }
  return resultIdx;
}

function unassignedBaseline(records, before) {
  for (let j = before - 1; j >= 0; j--) {
    const payload = readBusPayload(records[j]);
    if (!payload || !Array.isArray(payload.my_open_tasks)) continue;
    // The window opens at the digest's CALL, not its result: a claim issued in parallel with whats_new
    // is recorded between the two, and the count may or may not include it.
    const voidedBy = boardChangedAfter(records, callIndexOf(records, j) - 1, before, UNASSIGNED_MOVING_BUS_TOOL);
    if (voidedBy) return { was: null, voidedBy: voidedBy };
    return { was: Number(payload.open_unassigned) || 0, voidedBy: null };
  }
  return { was: null, voidedBy: null };
}

function busHasWork(records, lastHuman) {
  if (!Array.isArray(records) || lastHuman < 0) {
    debugLog({ guard2: 'no-transcript-or-no-human', lastHuman: lastHuman });
    return null;
  }
  for (let i = records.length - 1; i > lastHuman; i--) {
    const payload = readBusPayload(records[i]);
    // Shape-check before trusting it: a whats_new digest, not some other hook's stdout or some other
    // tool's JSON. Checked by shape, never by position.
    if (!payload || !Array.isArray(payload.my_open_tasks)) continue;
    const unread = Number(payload.unread_posts) || 0;
    const unassigned = Number(payload.open_unassigned) || 0;
    const baseline = unassignedBaseline(records, i);
    const unassignedWas = baseline.was;
    const newUnassigned = unassignedWas === null ? unassigned > 0 : unassigned > unassignedWas;
    const actionable = actionableTaskCount(payload.my_open_tasks);
    const decision = actionable > 0 || unread > 0 || newUnassigned;
    // Known-stale beats a confident answer from stale input. NULL, not false, and the difference
    // matters: null is "could not tell", which the caller already treats as do-not-fire, and it
    // stays honest if a future caller ever distinguishes the two.
    const changedBy = boardChangedAfter(records, i);
    debugLog({
      guard2: changedBy ? 'stale' : decision ? 'work' : 'idle',
      digestIndex: i,
      totalRecords: records.length,
      // The staleness signal. Near 0 means the hook read this turn's digest; a large number means
      // it decided from an older one, which is the failure this instrumentation exists to catch.
      recordsAfterDigest: records.length - 1 - i,
      staleBecause: changedBy,
      lastHuman: lastHuman,
      tasks: payload.my_open_tasks.length,
      actionable: actionable,
      statuses: payload.my_open_tasks.map((t) => (t && typeof t === 'object' ? t.status : null)),
      unread: unread,
      unassigned: unassigned,
      unassignedWas: unassignedWas,
      baselineVoidedBy: baseline.voidedBy,
      newUnassigned: newUnassigned,
    });
    if (changedBy) return null;
    return decision;
  }
  debugLog({ guard2: 'no-digest-found', lastHuman: lastHuman, totalRecords: records.length });
  return null;
}

// Read the transcript once: every guard below decides from the same parse.
// Returns { records, lastHuman }; lastHuman is -1 when no human message is found.
function readTranscript(transcriptPath) {
  if (typeof transcriptPath !== 'string' || transcriptPath === '') return null;
  let raw;
  try {
    raw = fs.readFileSync(transcriptPath, 'utf8');
  } catch {
    return null;
  }
  const records = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      // skip unparseable lines
    }
  }
  let lastHuman = -1;
  for (let i = records.length - 1; i >= 0; i--) {
    if (isHumanMessage(records[i])) {
      lastHuman = i;
      break;
    }
  }
  return { records: records, lastHuman: lastHuman };
}

function wasWorkingTurn(records, lastHuman) {
  if (lastHuman < 0) return false;
  for (let i = lastHuman + 1; i < records.length; i++) {
    if (records[i] && records[i].type === 'assistant' && hasToolUse(records[i])) return true;
  }
  return false;
}

// GUARD 0 - THE POSTURE NOTE (decision 027, measured 2026-09-08). Not a guard: it never changes the
// block/allow decision, it only decorates a block this hook was already going to emit.
//
// Measured on build 2.1.236: an `ask` rule blocks in EVERY mode - `auto` does not neutralise it and
// `bypassPermissions` does not bypass it - and no hook can help. A PreToolUse hook returning
// permissionDecision:"allow" does not override an ask rule, and a hook cannot set the session's mode
// (SessionStart updatedPermissions/setMode was inert). What a hook CAN do is READ the posture:
// `permission_mode` arrives in this hook's own input. So the entire available response to a session
// that is about to freeze is to say so, out loud, in the text the agent reads next.
//
// APPENDED, NEVER PREPENDED, and that is load-bearing rather than cosmetic. REASON_FINGERPRINT is
// REASON.slice(0, 48), which is how the hook recognises its own injected voice in the transcript,
// which is what continuationsSoFar() counts, which is what the bounded brake depends on. Prepending
// would move those 48 bytes and break the brake at a raised limit - i.e. exactly the night-run
// configuration this whole change exists to make work. Case 41 pins it.
//
// SILENT ON UNKNOWN: an absent or non-string field says nothing. A diagnostic must not invent a
// finding. Phrased as "not bypassPermissions" rather than an enumerated list of freeze-capable modes,
// because mode names move between builds and an enumerated list would silently stop warning the day a
// new one appears - the silent-no-op failure this repo keeps scarring on.
function postureNote(input) {
  const mode = input && input.permission_mode;
  if (typeof mode !== 'string' || mode === 'bypassPermissions') return '';
  return (
    ' POSTURE WARNING: this session is running permission mode "' + mode + '". Measured 2026-09-08: an ' +
    'ask rule blocks in every mode, and in this one a classifier fallback can also stop the session on ' +
    'a question nobody is present to answer - and a frozen session looks identical to a working one. ' +
    'If a permission check blocks: do NOT retry it, file it as a task, take the next in-bounds item, ' +
    'and tell the operator in the end-of-turn summary that an unattended run needs bypassPermissions ' +
    'plus an empty ask list. The bus-mode toggle, run with "preflight", names the freeze sources.'
  );
}

// ── The context wind-down (1.9.0, locked design "Item 3", 2026-10-08) ────────────────────────────
// A lead manages its own context. The status line writes this session's context use to a per-session
// file (statusline.cjs, context-file.cjs); this hook reads it at turn end:
//   at or above the FINISH threshold (default 60): the wake it was already going to emit gains a note -
//     finish the task in hand, take nothing new and large;
//   at or above the STOP threshold (default 70): the closing ceremony, once per operator message, and
//     then the session is allowed to stop whatever the board says.
//
// OFF BY DEFAULT, and off means byte-identical: unless BUS_MODE_WINDDOWN is set, nothing is read and
// context-file.cjs is never loaded. It only ever acts in a repo that is already armed (the marker check
// in main() runs first). Set it in the environment of the session that is the lead - the dispatcher's
// launch, normally - to "on" (60,70) or to "<finish>,<stop>"; "off", "0" or empty is off. An unusable
// pair falls back to 60,70 rather than switching off, because whoever set the variable asked for it on.
// BUS_MODE_WINDDOWN_MAX_AGE_S (default 600) is how old the file may be before it counts as no reading.
//
// FAIL-OPEN like everything here: no file, a stale file, a file for another session, an unreadable one,
// or a broken module all mean "no reading", and with no reading the hook behaves exactly as it does
// with the wind-down off.
const WINDDOWN_DEFAULT_FINISH = 60;
const WINDDOWN_DEFAULT_STOP = 70;
const WINDDOWN_DEFAULT_MAX_AGE_S = 600;
// Read once per invocation in main(); null means off. Declared with the other module state.

function windDownConfig() {
  const raw = process.env.BUS_MODE_WINDDOWN;
  if (raw === undefined) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === '' || v === '0' || v === 'off' || v === 'false' || v === 'no') return null;
  let finish = WINDDOWN_DEFAULT_FINISH;
  let stop = WINDDOWN_DEFAULT_STOP;
  const m = /^(\d{1,3})\s*,\s*(\d{1,3})$/.exec(v);
  if (m) {
    const f = parseInt(m[1], 10);
    const s = parseInt(m[2], 10);
    if (f >= 1 && s <= 100 && f < s) {
      finish = f;
      stop = s;
    }
  }
  const age = parseInt(process.env.BUS_MODE_WINDDOWN_MAX_AGE_S, 10);
  const maxAgeMs = (Number.isFinite(age) && age >= 1 ? age : WINDDOWN_DEFAULT_MAX_AGE_S) * 1000;
  return { finish: finish, stop: stop, maxAgeMs: maxAgeMs, raw: v };
}

// { level: 'stop' | 'finish', pct, finish, stop } or null (off, no reading, or below both thresholds).
function windDown(input) {
  const cfg = WINDDOWN_CFG;
  if (!cfg) return null;
  try {
    const cf = require(path.join(__dirname, 'context-file.cjs'));
    const r = cf.read(input && input.session_id, Date.now(), cfg.maxAgeMs);
    debugLog({ windDown: r.state, pct: r.pct, ageMs: r.ageMs, finish: cfg.finish, stop: cfg.stop, setting: cfg.raw });
    if (r.state !== 'ok') return null;
    const level = r.pct >= cfg.stop ? 'stop' : r.pct >= cfg.finish ? 'finish' : null;
    return level ? { level: level, pct: r.pct, finish: cfg.finish, stop: cfg.stop } : null;
  } catch {
    return null;
  }
}

// Was the ceremony already asked for since the operator last spoke? Then this stop is the session doing
// what it was told, and it is allowed. One ceremony per operator message is the structural bound on the
// ceremony's own wake, the same shape as guard 1's.
function ceremonyInjectedSince(records, lastHuman) {
  for (let i = lastHuman + 1; i < records.length; i++) {
    const r = records[i];
    if (!r || r.type !== 'user' || !r.message) continue;
    const c = r.message.content;
    if (typeof c === 'string' && isCeremonyText(c)) return true;
    if (Array.isArray(c) && c.some((b) => b && b.type === 'text' && isCeremonyText(b.text))) return true;
  }
  return false;
}

function ceremonyReason(wd) {
  return (
    CEREMONY_PREFIX +
    ' This session has used ' + wd.pct + '% of its context window, at or above the stop threshold of ' +
    wd.stop + '%. Take no new work and do not start another task. Run the closing ceremony, in order: ' +
    '(1) write the dated handoff block in PLAN.md - what is done, what is in flight, the next step - then ' +
    'commit and push it under the project\'s own git rules (a branch where main is protected); (2) post the handover on the bus, linking that block; (3) ship this session\'s ' +
    'lead-session task, if it runs under one. Then end the turn and stop: a fresh session picks the work ' +
    'up from the handover. This instruction comes once; the next stop is allowed whatever the board says.'
  );
}

// APPENDED to REASON, never prepended, for the same reason as the posture note: REASON_FINGERPRINT.
function finishNote(wd) {
  return (
    ' CONTEXT WIND-DOWN: this session has used ' + wd.pct + '% of its context window (finish threshold ' +
    wd.finish + '%, closing ceremony at ' + wd.stop + '%). Finish the task in hand, then take nothing new ' +
    'and large: a small item is fine, but leave anything large on the board for a fresh session.'
  );
}

function main() {
  // WHICH REPO (1.7.0, bus 2181). CLAUDE_PROJECT_DIR is set for hooks on every build measured, and while
  // it is this path is byte-identical to 1.6.0: the marker is checked before stdin is even read, so an
  // unarmed repo costs nothing. Only without it does anything new run - and then the root comes from the
  // session's own transcript, never from process.cwd(), which follows the shell's cd (probe M3) and would
  // arm the hook from wherever the agent last stood.
  const envRoot = process.env.CLAUDE_PROJECT_DIR;
  let input;
  if (envRoot) {
    RESOLVED_ROOT = envRoot;
    // Default OFF: without the local marker this hook does nothing at all.
    if (!markerPaths().some((p) => fs.existsSync(p))) return;
    try {
      input = JSON.parse(fs.readFileSync(0, 'utf8'));
    } catch {
      return;
    }
  } else {
    try {
      input = JSON.parse(fs.readFileSync(0, 'utf8'));
    } catch {
      return;
    }
    RESOLVED_ROOT = rootFromTranscript(input && input.transcript_path);
    if (!markerPaths().some((p) => fs.existsSync(p))) return; // no root, or not armed: fail open
  }
  if (process.env.BUS_MODE_DEBUG && envRoot) rootCanary(envRoot, input);

  WINDDOWN_CFG = windDownConfig();
  const transcript = readTranscript(input.transcript_path);
  if (!transcript) return; // unreadable transcript: fail open.

  // Guard 1 - the loop brake, now BOUNDED rather than one-shot. A stop that is already a continuation
  // is blocked again only while this hook has woken the agent fewer than `limit` times since the
  // operator last spoke. At the limit the stop is always allowed, whatever the board says: that is the
  // structural exit, and it does not depend on the board ever emptying.
  if (input.stop_hook_active) {
    if (transcript.lastHuman < 0) return;
    // FAIL-SAFE FLOOR. `stop_hook_active` is the harness stating that at least one continuation has
    // already happened, and it cannot be wrong; the transcript count can be, since it depends on
    // recognising this hook's own injected text. Taking the max means a detection that sees nothing
    // still allows the stop at the default limit - byte-identical to the old one-shot brake - and can
    // only ever end the loop EARLY, never extend it. A raised limit is therefore the one setting whose
    // correctness depends on detection working; see README before raising it.
    const done = Math.max(continuationsSoFar(transcript.records, transcript.lastHuman), 1);
    if (done >= continuationLimit()) return;
  } else if (
    transcript.lastHuman >= 0 &&
    continuationsSoFar(transcript.records, transcript.lastHuman) >= continuationLimit()
  ) {
    // THE LIMIT IS PER OPERATOR MESSAGE, NOT PER CONTINUATION CHAIN (1.8.0, bus 2857). A turn started by
    // a background-task notification is a fresh stop to the harness (stop_hook_active false), and until
    // 1.8.0 the brake was only consulted on continuations, so each notification after the limit bought
    // one more wake. Now that notifications no longer reset the count (isHumanMessage), the count alone
    // decides here. It can only end a loop earlier: with no injection since the operator spoke it is 0.
    return;
  }

  // The context wind-down (1.9.0). Off by default, and then wd is null and nothing below changes. It
  // sits AFTER guard 1, so "at the limit the stop is always allowed" stays unconditional: a lead that
  // reached its limit stops without the ceremony and is told on the next operator message instead. At
  // the stop threshold it decides ahead of guards 2 and 3: the ceremony is a handover, not board work,
  // so neither the board nor the work test gates it, and once it has been asked for since the operator
  // spoke the stop is allowed - waking a session just told to stop would contradict the instruction.
  const wd = windDown(input);
  if (wd && wd.level === 'stop') {
    if (ceremonyInjectedSince(transcript.records, transcript.lastHuman)) return;
    process.stdout.write(JSON.stringify({ decision: 'block', reason: ceremonyReason(wd) + postureNote(input) }));
    return;
  }

  // Guard 2 - AN EMPTY QUEUE IS NOT A REASON TO WAKE (2026-08-31). Decided from a real bus reading:
  // the companion mcp_tool hook's, or the agent's own from this turn (2026-09-01). The old behaviour
  // spent a full context load to discover there was nothing to do, and on 2026-08-30 it did that
  // repeatedly in the middle of the operator's own conversation. Fail OPEN on null (no reading) -
  // never block on an unknown.
  if (busHasWork(transcript.records, transcript.lastHuman) !== true) return;

  // Guard 3 - the work test, kept but DEMOTED, and it is a proxy rather than a fact: it reads "this
  // turn used tools" as "this turn was work". That is why it failed on 2026-08-30 - answering research
  // questions with database queries looks identical to doing work. Guard 2 is what actually catches that.
  if (!wasWorkingTurn(transcript.records, transcript.lastHuman)) return;

  const note = wd && wd.level === 'finish' ? finishNote(wd) : '';
  process.stdout.write(JSON.stringify({ decision: 'block', reason: REASON + note + postureNote(input) }));
}

try {
  main();
} catch {
  // fail open
}
process.exit(0);
