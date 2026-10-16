#!/usr/bin/env node
// Test suite for the bus-mode Stop hook + toggle (decisions 022, 024, 025).
// Zero dependencies. Exit 0 with "OK: <n> cases" or exit 1 naming the failure.
// Every case runs against a fresh temp CLAUDE_PROJECT_DIR; the repo's own
// .claude/ state is never read.

'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK = path.join(__dirname, 'stop-hook.cjs');
const TOGGLE = path.join(__dirname, 'toggle.cjs');
let passed = 0;

// The suite runs from a fresh temp directory, never from the repo it lives in. When the defect class under
// test is "acts on the wrong directory", the harness's own cwd is part of the blast radius: a toggle
// regression toward cwd-resolution would otherwise arm whatever repo ran the tests - and the tool's own working
// tree is the fleet's live install (demonstrated on a copy by the 1.7.0 gatekeeper review).
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'bus-mode-suite-')));

function tempProject(markerOn, legacy) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bus-mode-test-'));
  if (markerOn) {
    fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.claude', legacy ? 'auto-mode.on' : 'bus-mode.on'), 'on\n');
  }
  return dir;
}

function writeTranscript(dir, records) {
  const p = path.join(dir, 'transcript.jsonl');
  fs.writeFileSync(p, records.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return p;
}

function runHook(dir, stdinValue) {
  return spawnSync('node', [HOOK], {
    input: stdinValue,
    encoding: 'utf8',
    env: isolatedEnv({ CLAUDE_PROJECT_DIR: dir }),
  });
}

// Every session variable the harness might have handed the process running this suite, removed, plus a
// private config dir - so no case can resolve to the real session that happens to be running the tests.
function isolatedEnv(extra) {
  const env = Object.assign({}, process.env);
  for (const k of ['CLAUDE_PROJECT_DIR', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_CODE_CHILD_SESSION',
    'CLAUDECODE', 'BUS_MODE_MAX_CONTINUATIONS', 'BUS_MODE_DEBUG',
    'BUS_MODE_WINDDOWN', 'BUS_MODE_WINDDOWN_MAX_AGE_S', 'BUS_MODE_CONTEXT_DIR']) delete env[k];
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'bus-mode-cfg-'));
  env.CLAUDE_CONFIG_DIR = cfg;
  env.BUS_MODE_SETTINGS_MANAGED = path.join(cfg, 'no-managed.json');
  return Object.assign(env, extra || {});
}

function assert(name, cond) {
  if (!cond) {
    console.error('FAIL: ' + name);
    process.exit(1);
  }
  passed++;
}

const human = (text) => ({ type: 'user', message: { role: 'user', content: text } });
const humanBlocks = (text) => ({
  type: 'user',
  message: { role: 'user', content: [{ type: 'text', text: text }] },
});
const toolResult = () => ({
  type: 'user',
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] },
});
const assistantText = () => ({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'text', text: 'answer' }] },
});
const assistantTool = () => ({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'tool_use', id: 'x', name: 'Bash', input: {} }] },
});

// The companion `mcp_tool` Stop hook's whats_new result, as the harness records it. Verified against a
// real transcript before this shape was relied on.
const busReading = (openTasks, unread, unassigned) => ({
  type: 'attachment',
  attachment: {
    type: 'hook_success',
    hookEvent: 'Stop',
    hookName: 'Stop',
    stdout: JSON.stringify({
      since_event_id: 1,
      events: [],
      unread_posts: unread || 0,
      my_open_tasks: Array.from({ length: openTasks }, (_, i) => ({ task_id: i + 1, title: 't' })),
      open_unassigned: unassigned || 0,
    }),
  },
});
const busEmpty = () => busReading(0, 0, 0);

// Same digest, but with an explicit `status` per task, so the blocked-vs-actionable split can be
// exercised. `busReading` above deliberately omits status - that is the older shape, and case 26
// pins that it still counts as work.
const busReadingWithStatuses = (statuses, unread, unassigned) => ({
  type: 'attachment',
  attachment: {
    type: 'hook_success',
    hookEvent: 'Stop',
    hookName: 'Stop',
    stdout: JSON.stringify({
      since_event_id: 1,
      events: [],
      unread_posts: unread || 0,
      my_open_tasks: statuses.map((status, i) => ({ task_id: i + 1, title: 't', status })),
      open_unassigned: unassigned || 0,
    }),
  },
});
const busWork = () => busReading(1, 0, 0);

// 1. Guard 1: a continuation (stop_hook_active) is never blocked.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [human('do it'), assistantTool()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: true, transcript_path: t }));
  assert('1 loop brake: continuation allowed', r.status === 0 && r.stdout.trim() === '');
}

// 2. Toggle off (no marker): allowed even after a working turn.
{
  const dir = tempProject(false);
  const t = writeTranscript(dir, [human('do it'), assistantTool()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('2 toggle off: allowed', r.status === 0 && r.stdout.trim() === '');
}

// 3. Working turn, marker on, AND the board has work: blocked with a reason.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText(), busWork()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  let out = null;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    out = null;
  }
  assert(
    '3 working turn: blocked',
    r.status === 0 && out && out.decision === 'block' && typeof out.reason === 'string' && out.reason.length > 0
  );
}

// 4. Prose turn (no tool use, array-content human message): allowed.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [humanBlocks('what is x?'), assistantText()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('4 prose turn: allowed', r.status === 0 && r.stdout.trim() === '');
}

// 5. The subtle one: a tool_result record (type "user") after the tool use
// must NOT be counted as the human message. Naive last-user logic would see
// only assistant text after it and allow; correct logic still blocks.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    human('fix the bug'),
    assistantTool(),
    toolResult(),
    assistantText(),
    busWork(),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  let out = null;
  try {
    out = JSON.parse(r.stdout);
  } catch {
    out = null;
  }
  assert('5 tool_result-as-user record: still blocked', r.status === 0 && out && out.decision === 'block');
}

// 6. Missing transcript file: fail open.
{
  const dir = tempProject(true);
  const r = runHook(
    dir,
    JSON.stringify({ stop_hook_active: false, transcript_path: path.join(dir, 'nope.jsonl') })
  );
  assert('6 missing transcript: allowed', r.status === 0 && r.stdout.trim() === '');
}

// 7. Unparseable stdin: fail open.
{
  const dir = tempProject(true);
  const r = runHook(dir, 'not json{');
  assert('7 garbage stdin: allowed', r.status === 0 && r.stdout.trim() === '');
}

// 8. Missing transcript_path field: fail open.
{
  const dir = tempProject(true);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false }));
  assert('8 missing field: allowed', r.status === 0 && r.stdout.trim() === '');
}

// 9. Toggle round-trip: on creates the marker, status reports, off removes it.
{
  const dir = tempProject(false);
  const env = isolatedEnv({ CLAUDE_PROJECT_DIR: dir });
  const marker = path.join(dir, '.claude', 'bus-mode.on');
  const on = spawnSync('node', [TOGGLE, 'on'], { encoding: 'utf8', env: env, cwd: dir });
  assert('9a toggle on: marker created', on.status === 0 && fs.existsSync(marker));
  const st = spawnSync('node', [TOGGLE, 'status'], { encoding: 'utf8', env: env, cwd: dir });
  assert('9b toggle status: reports on', st.status === 0 && st.stdout.includes('bus mode: on'));
  const off = spawnSync('node', [TOGGLE, 'off'], { encoding: 'utf8', env: env, cwd: dir });
  assert('9c toggle off: marker removed', off.status === 0 && !fs.existsSync(marker));
  const bad = spawnSync('node', [TOGGLE, 'sideways'], { encoding: 'utf8', env: env, cwd: dir });
  assert('9d toggle unknown arg: usage + exit 1', bad.status === 1);
}

// ── Guard 2: the board check (2026-08-31) ────────────────────────────────────
// This guard exists because the work test (guard 3) is a PROXY: it reads "this turn used tools" as
// "this turn was work", so a conversational turn answered with tool calls scored as work and the hook
// woke the agent to discover an empty board. A full context load to find nothing, charged to whoever
// was in the chat.

// 10. THE CASE THE GUARD WAS BUILT FOR: a working turn, marker on, but the board is EMPTY.
// Without guard 2 this blocks (and that is exactly the reported bug).
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText(), busEmpty()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('10 empty board after a working turn: allowed', r.status === 0 && r.stdout.trim() === '');
}

// 11. Unread mail alone is work, with no assigned task.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), busReading(0, 3, 0)]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('11 unread posts count as work: blocked', r.status === 0 && r.stdout.includes('block'));
}

// 12. NO READING IS NOT AN EMPTY READING. With no companion hook result in the transcript the guard
// cannot tell, and an unknown must never block. This is the difference between a check and a coin flip.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('12 no board reading available: allowed (fails open)', r.status === 0 && r.stdout.trim() === '');
}

// 13. Another hook's stdout must not be mistaken for a board reading - it is shape-checked, not
// position-checked. A PostToolUse echo sitting later in the transcript must not win.
{
  const dir = tempProject(true);
  const noise = {
    type: 'attachment',
    attachment: { type: 'hook_success', hookEvent: 'PostToolUse', hookName: 'PostToolUse:Edit', stdout: 'file changed' },
  };
  const t = writeTranscript(dir, [human('do it'), assistantTool(), busWork(), noise]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('13 unrelated hook stdout ignored, real reading still used', r.status === 0 && r.stdout.includes('block'));
}

// ── The rename migration (2026-08-31) ────────────────────────────────────────
// Dropping the old marker name outright would have switched the tool silently OFF on every rig still
// holding one - which reads exactly like a quiet board.

// 14. A rig that never migrated still works off the legacy marker.
{
  const dir = tempProject(true, true); // legacy .claude/auto-mode.on
  const t = writeTranscript(dir, [human('do it'), assistantTool(), busWork()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('14 legacy auto-mode.on marker still honoured', r.status === 0 && r.stdout.includes('block'));
}

// 15. `on` migrates a legacy rig; `off` clears BOTH names, because a stale legacy marker would leave
// the hook armed after the operator said stop - the one failure worse than not working.
{
  const dir = tempProject(true, true);
  const env = isolatedEnv({ CLAUDE_PROJECT_DIR: dir });
  const legacy = path.join(dir, '.claude', 'auto-mode.on');
  const marker = path.join(dir, '.claude', 'bus-mode.on');
  const st = spawnSync('node', [TOGGLE, 'status'], { encoding: 'utf8', env: env, cwd: dir });
  assert('15a status sees a legacy-only rig as on', st.stdout.includes('bus mode: on') && st.stdout.includes('legacy'));
  spawnSync('node', [TOGGLE, 'on'], { encoding: 'utf8', env: env, cwd: dir });
  assert('15b on: migrates to the new marker', fs.existsSync(marker) && !fs.existsSync(legacy));
  fs.writeFileSync(legacy, 'stale\n');
  spawnSync('node', [TOGGLE, 'off'], { encoding: 'utf8', env: env, cwd: dir });
  assert('15c off: clears BOTH markers', !fs.existsSync(marker) && !fs.existsSync(legacy));
}

// ── The build-floor fallback (2026-09-01) ────────────────────────────────────
// `mcp_tool` is a documented hook type that older builds do not have, and an unknown hook type voids
// the ENTIRE settings file rather than degrading. A rig on such a build would read null forever, and a
// guard that always answers "no reading" is not conservative, it is absent. So the agent's OWN
// whats_new result - which section 13's loop already requires it to fetch - is accepted as a reading.

// The agent's own whats_new tool result, in both shapes the harness records content in.
const busToolResult = (payload, asString) => ({
  type: 'user',
  message: {
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: 'bus1',
        content: asString
          ? JSON.stringify(payload)
          : [{ type: 'text', text: JSON.stringify(payload) }],
      },
    ],
  },
});
const digest = (openTasks, unread, unassigned) => ({
  since_event_id: 1,
  events: [],
  unread_posts: unread || 0,
  my_open_tasks: Array.from({ length: openTasks }, (_, i) => ({ task_id: i + 1, title: 't' })),
  open_unassigned: unassigned || 0,
});

// 16. THE CASE THE FALLBACK WAS BUILT FOR: no companion hook result anywhere, but the agent read the
// board itself this turn and it has work. Without the fallback this reads null and never continues.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), busToolResult(digest(2, 0, 0))]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('16 fallback reading (agent own whats_new): blocked', r.status === 0 && r.stdout.includes('block'));
}

// 17. Same path, empty board: the fallback must be able to say "empty", not only "work".
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), busToolResult(digest(0, 0, 0))]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('17 fallback reading, empty board: allowed', r.status === 0 && r.stdout.trim() === '');
}

// 18. String-form tool_result content is the same reading.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), busToolResult(digest(1, 0, 0), true)]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('18 fallback reading, string content: blocked', r.status === 0 && r.stdout.includes('block'));
}

// 19. TURN BOUNDARY. A reading that sits BEFORE the last human message describes a board that has
// since been worked and a conversation that has since moved on. Stale is not fresh; it reads as null.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    human('first task'),
    assistantTool(),
    busToolResult(digest(3, 0, 0)), // work, but last turn
    human('now do something else'),
    assistantTool(),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('19 stale reading from a previous turn: allowed (fails open)', r.status === 0 && r.stdout.trim() === '');
}

// 20. Some other tool's JSON result must not pass as a board reading - shape-checked, not
// position-checked, on this path too.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    human('do it'),
    assistantTool(),
    busToolResult({ files: ['a.md', 'b.md'], count: 2 }),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('20 non-bus JSON tool result ignored: allowed', r.status === 0 && r.stdout.trim() === '');
}

// 21. Latest reading in the turn wins, whichever source it came from: the companion hook runs at stop
// time, so when both exist its result is the newer one and it decides.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    human('do it'),
    assistantTool(),
    busToolResult(digest(0, 0, 0)), // agent saw an empty board mid-turn
    busWork(),                      // the stop-time hook reading found work
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('21a stop-time hook reading wins over an older own reading: blocked', r.status === 0 && r.stdout.includes('block'));

  const dir2 = tempProject(true);
  const t2 = writeTranscript(dir2, [
    human('do it'),
    assistantTool(),
    busToolResult(digest(2, 0, 0)), // agent saw work mid-turn
    busEmpty(),                     // the board was cleared by the time the turn ended
  ]);
  const r2 = runHook(dir2, JSON.stringify({ stop_hook_active: false, transcript_path: t2 }));
  assert('21b a board emptied by the end of the turn: allowed', r2.status === 0 && r2.stdout.trim() === '');
}

// -- The hook's own voice, and the bounded brake (2026-09-01, a production rig) ------
// The block reason comes back as a type:"user" record with STRING content - identical in shape to a
// message from the operator. Unhandled, the hook mistakes itself for the human and every turn
// boundary computed from that is wrong.
const REASON_HEAD =
  'Bus mode is on, and your board has work for you (a startable task or an unread post) - that was ' +
  'checked before you were woken, so do not ';
// The wake text of 1.9.0 and before, still recognised as the hook's voice (1.9.1, case 103).
const LEGACY_REASON_HEAD =
  'Bus mode is on, and your board is NOT empty - that was checked before you were woken, so do not ';
// The wake text of 1.9.1, still recognised as the hook's voice (1.9.2, case 105).
const LEGACY_REASON_HEAD_191 =
  'Bus mode is on, and your board has startable work - that was checked before you were woken, so do not ';
const injected = () => ({ type: 'user', message: { role: 'user', content: REASON_HEAD + 'treat this as a nudge.' } });

// 22. The injected reason must NOT count as a human message. With it miscounted as the human, the
// board reading below it falls outside the turn and the hook goes quiet on a board that has work.
// (1.8.0: the brake now also applies to a stop that is not a continuation, so the limit is raised to 2
// here to keep this case about the turn boundary rather than the brake.)
{
  const dir = tempProject(true);
  fs.writeFileSync(path.join(dir, '.claude', 'bus-mode.on'), '2\n');
  const t = writeTranscript(dir, [human('do it'), busWork(), assistantTool(), injected(), assistantTool()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('22 injected reason is not a human message: still blocked', r.status === 0 && r.stdout.includes('block'));
}

// 23. Default limit is 1: a continuation is allowed, exactly as the one-shot brake behaved.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), injected(), assistantTool(), busWork()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: true, transcript_path: t }));
  assert('23 default limit 1: continuation allowed', r.status === 0 && r.stdout.trim() === '');
}

// 24. Raised limit keeps going while under it, and stops at it.
{
  const dir = tempProject(true);
  const base = [human('do it'), assistantTool(), injected(), assistantTool(), busWork()];
  const t = writeTranscript(dir, base);
  const env3 = Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: dir, BUS_MODE_MAX_CONTINUATIONS: '3' });
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ stop_hook_active: true, transcript_path: t }), encoding: 'utf8', env: env3,
  });
  assert('24a limit 3, one continuation done: blocked again', r.status === 0 && r.stdout.includes('block'));

  const t2 = writeTranscript(dir, [human('do it'), assistantTool(), injected(), injected(), injected(), assistantTool(), busWork()]);
  const r2 = spawnSync('node', [HOOK], {
    input: JSON.stringify({ stop_hook_active: true, transcript_path: t2 }), encoding: 'utf8', env: env3,
  });
  assert('24b limit 3 reached: allowed', r2.status === 0 && r2.stdout.trim() === '');
}

// 25. THE FAIL-SAFE FLOOR. If detection sees nothing at all, stop_hook_active alone must still end the
// loop at the default limit - a broken detector may end the loop early, never extend it.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), busWork()]); // no injected record
  const r = runHook(dir, JSON.stringify({ stop_hook_active: true, transcript_path: t }));
  assert('25 no detectable continuation: stop_hook_active still allows at default', r.status === 0 && r.stdout.trim() === '');
}


// ─── Bus task 1631: a blocked task is not work ──────────────────────────────────────────────────
//
// The hook's wake-up says the board is not empty; its closing line says "Stop when the board is
// genuinely empty ... Do not invent work to stay awake." On a fully blocked plate both fired at
// once, so an agent obeying the wake-up literally was pushed toward the one thing the same text
// forbids. Ruled by the operator on task 1631, option 1.

// 26. A plate of ONLY blocked tasks is not work: the session may idle.
{
  const dir = tempProject(true);
  const reading = busReadingWithStatuses(['blocked', 'blocked', 'blocked'], 0, 0);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText(), reading]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('26 fully blocked plate: allowed to idle', r.status === 0 && r.stdout.trim() === '');
}

// 27. One actionable task among blocked ones IS work - the whole point is not to go quiet on a
//     plate that still has something on it.
{
  const dir = tempProject(true);
  const reading = busReadingWithStatuses(['blocked', 'todo', 'blocked'], 0, 0);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText(), reading]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('27 one todo among blocked: blocked', r.status === 0 && r.stdout.includes('block'));
}

// 28. in_progress is NOT work (1.8.2, tasks 3670 and 3498): someone is already on it,
//     usually a background helper whose completion wakes the session anyway. Until 1.8.2 this case
//     asserted the opposite, and one rig measured 15-20 empty wakes in a row from it.
{
  const dir = tempProject(true);
  const reading = busReadingWithStatuses(['blocked', 'in_progress', 'in_progress'], 0, 0);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText(), reading]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('28 in_progress and blocked only: allowed to idle', r.status === 0 && r.stdout.trim() === '');
}

// 28b. A todo task beside in-progress ones IS work - the exclusion must not swallow the plate.
{
  const dir = tempProject(true);
  const reading = busReadingWithStatuses(['in_progress', 'todo'], 0, 0);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText(), reading]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('28b one todo among in_progress: blocked', r.status === 0 && r.stdout.includes('block'));
}

// 28c. An UNKNOWN status still counts, the same safer failure as an absent one: a bus that adds a
//      status this hook has never seen keeps waking the agent rather than going quiet.
{
  const dir = tempProject(true);
  const reading = busReadingWithStatuses(['in_progress', 'review'], 0, 0);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText(), reading]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('28c unknown status counts as work: blocked', r.status === 0 && r.stdout.includes('block'));
}

// 28d. In-progress plate plus unread mail still wakes - mail is independent of the task count.
{
  const dir = tempProject(true);
  const reading = busReadingWithStatuses(['in_progress'], 1, 0);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText(), reading]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('28d in_progress plate + unread posts: blocked', r.status === 0 && r.stdout.includes('block'));
}

// 29. UNREAD MAIL IS INDEPENDENT of the task count. A blocked plate with unread posts must still
//     wake the session - the mail may be the very thing that unblocks it.
{
  const dir = tempProject(true);
  const reading = busReadingWithStatuses(['blocked', 'blocked'], 2, 0);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText(), reading]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('29 blocked plate + unread posts: blocked', r.status === 0 && r.stdout.includes('block'));
}

// 30. So is grabbable unassigned work.
{
  const dir = tempProject(true);
  const reading = busReadingWithStatuses(['blocked'], 0, 1);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText(), reading]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('30 blocked plate + unassigned work: blocked', r.status === 0 && r.stdout.includes('block'));
}

// 31. A TASK WITH NO `status` FIELD STILL COUNTS. A digest from a bus version that does not report
//     status must keep waking the agent rather than silently going quiet - the safer failure.
//     `busWork()` builds exactly that older shape.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText(), busWork()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('31 task with no status field: still counts as work', r.status === 0 && r.stdout.includes('block'));
}

// ── 1.4.0: guard-2 diagnostics (BUS_MODE_DEBUG) ──────────────────────────────
//
// The defect these exist for could not be reproduced from outside the hook: it woke a session whose
// board was measurably empty, and re-running it minutes later against the SAME transcript declined
// to fire. These pin the instrumentation that turns that into a log line.

function runHookDebug(dir, stdinValue) {
  return spawnSync('node', [HOOK], {
    input: stdinValue,
    encoding: 'utf8',
    env: Object.assign({}, process.env, { CLAUDE_PROJECT_DIR: dir, BUS_MODE_DEBUG: '1' }),
  });
}

// 32. SILENT BY DEFAULT. Diagnostics that print unasked are diagnostics someone turns off.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText(), busWork()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert(
    '32 no debug output without BUS_MODE_DEBUG',
    r.status === 0 && !r.stderr.includes('[bus-mode '),
  );
}

// 33. THE ONE THAT MATTERS. This hook's STDOUT IS ITS PROTOCOL CHANNEL - the harness parses it as
//     the decision JSON. A debug line written there would not be noise, it would corrupt the
//     decision. So stdout must remain exactly parseable JSON with debug on.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText(), busWork()]);
  const r = runHookDebug(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  let parsed = null;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    parsed = null;
  }
  // Matched on the DEBUG PREFIX, not on the string "bus-mode": the reason text itself names
  // `tools/bus-mode/toggle.cjs`, so a looser check passes for the wrong reason and would keep
  // passing if the debug line ever did leak into stdout.
  const DEBUG_PREFIX = '[bus-mode ';
  assert(
    '33 debug goes to stderr and leaves stdout valid decision JSON',
    r.status === 0 &&
      parsed !== null &&
      parsed.decision === 'block' &&
      r.stderr.includes(DEBUG_PREFIX) &&
      !r.stdout.includes(DEBUG_PREFIX),
  );
}

// 34. The staleness signal itself. `recordsAfterDigest` is the number that tests the suspected
//     cause: a healthy read finds the newest digest near the end of the transcript.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), busWork(), assistantText()]);
  const r = runHookDebug(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  const line = r.stderr.split('\n').find((l) => l.includes('guard2'));
  const fields = JSON.parse(line.slice(line.indexOf('{')));
  assert(
    '34 reports the digest index and its distance from the end',
    fields.guard2 === 'work' && fields.digestIndex === 2 && fields.recordsAfterDigest === 1,
  );
}

// 35. An idle board is logged too, with the statuses that produced the verdict - otherwise a
//     correct idle and a missed wake look identical in the log.
{
  const dir = tempProject(true);
  const reading = busReadingWithStatuses(['blocked', 'blocked'], 0, 0);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText(), reading]);
  const r = runHookDebug(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  const line = r.stderr.split('\n').find((l) => l.includes('guard2'));
  const fields = JSON.parse(line.slice(line.indexOf('{')));
  assert(
    '35 an idle verdict is logged with its statuses',
    r.status === 0 &&
      r.stdout === '' &&
      fields.guard2 === 'idle' &&
      fields.actionable === 0 &&
      fields.statuses.join(',') === 'blocked,blocked',
  );
}

// 36. No digest at all is its own logged case, distinct from an idle one: guard 2 fails OPEN on a
//     missing reading, and that must not be mistaken in a log for "the board was empty".
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText()]);
  const r = runHookDebug(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert(
    '36 a missing digest is logged distinctly from an idle board',
    r.status === 0 && r.stderr.includes('no-digest-found'),
  );
}

// ---------------------------------------------------------------------------
// GUARD 0 - the posture note (1.5.0, decision 027). A DIAGNOSTIC, not a guard:
// it decorates a block, and must never change a decision.
// ---------------------------------------------------------------------------

const workingTurn = (mode) => {
  const dir = tempProject(true);
  const reading = busReadingWithStatuses(['todo'], 0, 0);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText(), reading]);
  const input = { stop_hook_active: false, transcript_path: t };
  if (mode !== undefined) input.permission_mode = mode;
  return runHook(dir, JSON.stringify(input));
};

// 37. bypassPermissions is the posture the night run is supposed to be in, so it gets no warning.
//     If this ever fires, every wake-up carries noise and the operator stops reading the reason.
{
  const r = workingTurn('bypassPermissions');
  assert(
    '37 bypassPermissions draws no posture warning',
    r.status === 0 && r.stdout !== '' && !r.stdout.includes('POSTURE WARNING'),
  );
}

// 38. `auto` is the mode v1.9 recommended for unattended rigs and the one the operator had selected
//     when the night run died. It must warn, and it must name the mode - "some mode" is unactionable.
{
  const r = workingTurn('auto');
  const reason = r.stdout ? JSON.parse(r.stdout).reason : '';
  assert(
    '38 auto draws a posture warning naming the mode',
    r.status === 0 && reason.includes('POSTURE WARNING') && reason.includes('"auto"'),
  );
}

// 39. `default` is the freeze-capable mode nobody argues about.
{
  const r = workingTurn('default');
  assert('39 default draws a posture warning', r.status === 0 && r.stdout.includes('POSTURE WARNING'));
}

// 40. SILENCE ON UNKNOWN. A build that stops sending permission_mode must not make the hook invent a
//     finding. Absent field, no warning, everything else unchanged.
{
  const r = workingTurn(undefined);
  assert(
    '40 an absent permission_mode draws no warning',
    r.status === 0 && r.stdout !== '' && !r.stdout.includes('POSTURE WARNING'),
  );
}

// 41. THE FINGERPRINT INVARIANT, and the reason the note is appended rather than prepended.
//     REASON_FINGERPRINT is REASON.slice(0, 48) and is how the hook recognises its own injected voice;
//     that recognition is what continuationsSoFar() counts, which is what the bounded brake depends
//     on. Prepend the warning and the brake breaks at a raised limit - the night-run configuration.
{
  const r = workingTurn('auto');
  const reason = JSON.parse(r.stdout).reason;
  assert(
    '41 the posture note is appended, leaving the fingerprint intact',
    reason.startsWith(REASON_HEAD) && reason.includes('POSTURE WARNING'),
  );
}

// 42. GUARD 0 CHANGES NO DECISION. An empty board in a freeze-capable mode is still a stop: the note
//     decorates a block, it never creates one.
{
  const dir = tempProject(true);
  const reading = busReadingWithStatuses(['blocked'], 0, 0);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), assistantText(), reading]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t, permission_mode: 'default' }));
  assert('42 guard 0 never turns an allowed stop into a block', r.status === 0 && r.stdout === '');
}

// ---------------------------------------------------------------------------
// PREFLIGHT (1.5.0). Read-only, always exit 0, machine-independent: the managed
// and user sources are redirected so the suite never depends on this machine.
// ---------------------------------------------------------------------------

function runToggle(dir, args, extraEnv) {
  return spawnSync('node', [TOGGLE].concat(args), {
    encoding: 'utf8',
    cwd: dir,
    env: isolatedEnv(
      Object.assign(
        { CLAUDE_PROJECT_DIR: dir, CLAUDE_CONFIG_DIR: path.join(dir, 'nope'), BUS_MODE_SETTINGS_MANAGED: path.join(dir, 'nope.json') },
        extraEnv || {},
      ),
    ),
  });
}

function withProjectSettings(json) {
  const dir = tempProject(false);
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.claude', 'settings.json'), json);
  return dir;
}

// 43. The whole point of the subcommand: an ask rule is named, WITH the file it lives in. "You have an
//     ask rule somewhere" is not something an operator can act on at 23:00.
//     TWO sources hold DIFFERENT rules, and the assertion is on the PAIRING on one line. An earlier
//     version of this case asserted the rule and the path independently and passed a mutation that
//     removed the pairing entirely, because the per-source status line prints the same path - a test
//     that could not fail, guarding the tool's entire value proposition.
{
  const dir = withProjectSettings(JSON.stringify({ permissions: { ask: ['Bash(touch:*)'], deny: [] } }));
  const userCfg = path.join(dir, 'usercfg');
  fs.mkdirSync(userCfg, { recursive: true });
  fs.writeFileSync(path.join(userCfg, 'settings.json'), JSON.stringify({ permissions: { ask: ['Bash(stripe:*)'] } }));
  const r = runToggle(dir, ['preflight'], { CLAUDE_CONFIG_DIR: userCfg });
  const projectPair = 'Bash(touch:*)   <- ' + path.join(dir, '.claude', 'settings.json');
  const userPair = 'Bash(stripe:*)   <- ' + path.join(userCfg, 'settings.json');
  assert(
    '43 preflight pairs each freeze source with the file it lives in',
    r.status === 0 &&
      r.stdout.includes('FREEZE RISK - 2') &&
      r.stdout.includes(projectPair) &&
      r.stdout.includes(userPair),
  );
}

// 44. The clear path. Redirected sources make this independent of the machine running the suite.
{
  const dir = withProjectSettings(JSON.stringify({ permissions: { ask: [], deny: ['Read(./.env)'] } }));
  const r = runToggle(dir, ['preflight']);
  assert(
    '44 preflight reports CLEAR with no ask rules anywhere',
    r.status === 0 && r.stdout.includes('PREFLIGHT: CLEAR') && !r.stdout.includes('FREEZE RISK'),
  );
}

// 45. Decision 025's scar: the harness discards an unparseable settings file ENTIRELY and silently, so
//     a rig can lose its whole deny floor and still look configured. The reporter must say so, and
//     must not crash while doing it.
{
  const dir = withProjectSettings('{ this is not json ');
  const r = runToggle(dir, ['preflight']);
  assert(
    '45 preflight reports an unparseable file without throwing',
    r.status === 0 && r.stdout.includes('UNPARSEABLE') && !r.stderr.includes('Error'),
  );
}

// 45b. And it must NOT then print CLEAR. An unparseable file is exactly the state where the deny floor
//      is silently gone too, so a green all-clear there is the most dangerous line the tool can print.
{
  const dir = withProjectSettings('{ this is not json ');
  const r = runToggle(dir, ['preflight']);
  assert(
    '45b an unreadable source makes the verdict UNKNOWN, never CLEAR',
    r.status === 0 && r.stdout.includes('PREFLIGHT: UNKNOWN') && !r.stdout.includes('PREFLIGHT: CLEAR'),
  );
}

// 45c. `ask` present but not an array cannot be read, so it is UNKNOWN rather than zero.
{
  const dir = withProjectSettings(JSON.stringify({ permissions: { ask: 'Bash(touch:*)' } }));
  const r = runToggle(dir, ['preflight']);
  assert(
    '45c a non-array ask list is UNKNOWN, not silently zero',
    r.status === 0 && r.stdout.includes('PREFLIGHT: UNKNOWN') && !r.stdout.includes('PREFLIGHT: CLEAR'),
  );
}

// 45d. Valid JSON, invalid VALUE on a known key. The harness discards the whole file silently - deny
//      rules and hooks included - so a reporter that says "ok" here is reporting a floor that is not in
//      effect. Found by adversarial review 2026-09-08, not by the suite.
{
  const dir = withProjectSettings(JSON.stringify({ permissions: { defaultMode: 'notARealMode', deny: ['Bash(rm:*)'] } }));
  const r = runToggle(dir, ['preflight']);
  assert(
    '45d an unknown defaultMode makes the source unreadable, not healthy',
    r.status === 0 && r.stdout.includes('NOT a known mode') && r.stdout.includes('PREFLIGHT: UNKNOWN'),
  );
}

// 45e. ...and a KNOWN mode must not trip it, or every healthy rig reports UNKNOWN forever.
{
  const dir = withProjectSettings(JSON.stringify({ permissions: { defaultMode: 'bypassPermissions', ask: [], deny: [] } }));
  const r = runToggle(dir, ['preflight']);
  assert(
    '45e a known defaultMode still reports CLEAR',
    r.status === 0 && r.stdout.includes('PREFLIGHT: CLEAR') && !r.stdout.includes('NOT a known mode'),
  );
}

// 46. `on` must still arm bus mode when the preflight is unhappy. A reporter that could block arming
//     would be a second failure mode bolted onto the first.
{
  const dir = withProjectSettings(JSON.stringify({ permissions: { ask: ['Bash(touch:*)'] } }));
  const r = runToggle(dir, ['on']);
  assert(
    '46 `on` arms the marker and still runs the preflight',
    r.status === 0 &&
      fs.existsSync(path.join(dir, '.claude', 'bus-mode.on')) &&
      r.stdout.includes('PREFLIGHT:'),
  );
}

// 47. The preflight NEVER writes. An agent that could set its own permission mode is the section 01
//     authority axis; this pins that the tool only ever reads.
{
  const dir = withProjectSettings(JSON.stringify({ permissions: { ask: ['Bash(touch:*)'] } }));
  const before = fs.readFileSync(path.join(dir, '.claude', 'settings.json'), 'utf8');
  runToggle(dir, ['preflight']);
  const after = fs.readFileSync(path.join(dir, '.claude', 'settings.json'), 'utf8');
  assert(
    '47 preflight writes nothing and arms nothing',
    before === after && !fs.existsSync(path.join(dir, '.claude', 'bus-mode.on')),
  );
}

// 48. The version the fleet checks against.
{
  const r = spawnSync('node', [HOOK, '--version'], { encoding: 'utf8' });
  assert('48 the hook reports 1.10.0', r.status === 0 && r.stdout.trim() === '1.10.0');
}

// ── Guard 2 staleness (1.6.0, bus 1802) ────────────────────────────────────────
// A reading taken BEFORE the board was worked describes a board that no longer exists. Measured on
// a real production session: the two fires that woke the agent on nothing had read digests 221 and 88
// records old, and the 221 case had eleven board-mutating bus calls after it.
//
// These cases pin the three things that could each break it silently:
//   49 - a mutation after the reading suppresses the wake (the fix itself)
//   50 - a NON-mutating bus call does NOT suppress (the over-suppression that would make a rig
//        go quiet, which is the failure mode worth fearing more than the spurious wake)
//   51 - the suppression applies to a companion-hook attachment too, not only the agent's own
//        digest; a stale attachment is stale on identical evidence

// An assistant tool_use record for a named bus tool. Doubles as the working-turn evidence guard 3
// wants, so these cases exercise guard 2 rather than accidentally tripping guard 3.
const busToolUse = (name) => ({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'tool_use', id: 'b1', name: name, input: {} }] },
});

// 49. Work on the board, then a task shipped: the reading is spent, so do not wake.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    human('do it'),
    busToolResult(digest(1, 0, 0)),
    busToolUse('mcp__llm-bus__task_ship'),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('49 a task shipped after the reading suppresses the wake', r.stdout.trim() === '');
}

// 50. A read-only bus call is not a board change. This one guards the guard: if the pattern ever
//     widens to "any bus tool", every healthy turn stops waking and bus mode dies quietly - which is
//     a worse failure than the spurious wake it replaced, and a silent one.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    human('do it'),
    busToolResult(digest(1, 0, 0)),
    busToolUse('mcp__llm-bus__list_tasks'),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('50 a read-only bus call still wakes', r.stdout.includes('block'));
}

// 51. Same rule for the companion hook's attachment. Freshness is a property of WHEN the reading was
//     taken relative to the work, never of which hook took it.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    human('do it'),
    busWork(),
    busToolUse('mcp__llm-bus__task_resolve'),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('51 a stale attachment is suppressed on the same evidence', r.stdout.trim() === '');
}

// 52. THE REGRESSION THAT MATTERS MOST: a mutation BEFORE the reading is not staleness. The agent
//     shipped a task and THEN checked the board, which is the ritual the whole loop is built on
//     (task_ship, then whats_new). Suppressing that would silence every correct wake there is.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    human('do it'),
    busToolUse('mcp__llm-bus__task_ship'),
    busToolResult(digest(1, 0, 0)),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('52 a mutation before the reading is not staleness', r.stdout.includes('block'));
}


// ---------------------------------------------------------------------------
// WHICH REPO (1.7.0, bus 2181). The toggle acts on the directory the SESSION was launched from - the one
// the hook reads - never the shell's cwd. Measured 2026-09-11: CLAUDE_PROJECT_DIR is set for hooks and
// UNSET in the agent's Bash tool; CLAUDE_CODE_SESSION_ID is set there; the transcript's FIRST cwd is the
// launch dir and later ones follow every cd.
// ---------------------------------------------------------------------------

// A config dir holding ONE session transcript whose first cwd is launchDir, then records whose cwd has
// drifted - the shape a real transcript has after the agent runs `cd`.
function fakeSession(launchDir, driftDirs) {
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'bus-mode-cfg-'));
  const sid = 'e2e00000-' + String(passed).padStart(4, '0') + '-4000-8000-' + String(Date.now()).slice(-12).padStart(12, '0');
  const pdir = path.join(cfg, 'projects', '-fake-' + path.basename(launchDir));
  fs.mkdirSync(pdir, { recursive: true });
  const recs = [
    { type: 'summary', summary: 'no cwd on this record' },
    { type: 'user', cwd: launchDir, message: { role: 'user', content: 'hi' } },
  ].concat(
    (driftDirs || []).map((c) => ({
      type: 'user',
      cwd: c,
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'ok' }] },
    })),
  );
  fs.writeFileSync(path.join(pdir, sid + '.jsonl'), recs.map((r) => JSON.stringify(r)).join('\n') + '\n');
  return { cfg: cfg, sid: sid, pdir: pdir };
}

// Exactly what the agent's Bash tool has (measured): a session id, CLAUDECODE, and NO CLAUDE_PROJECT_DIR.
function sessionEnv(sess) {
  return isolatedEnv({
    CLAUDE_CONFIG_DIR: sess.cfg,
    BUS_MODE_SETTINGS_MANAGED: path.join(sess.cfg, 'no-managed.json'),
    CLAUDE_CODE_SESSION_ID: sess.sid,
    CLAUDECODE: '1',
  });
}

function toggleAt(cwd, env, args) {
  return spawnSync('node', [TOGGLE].concat(args), { encoding: 'utf8', env: env, cwd: cwd });
}

// A DIFFERENT git repo, armed unless told otherwise: the reported case, where the shell's cwd had drifted
// into another repo (the shared install's tools/bus-mode/) whose own marker was armed.
function decoyRepo(armed) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bus-mode-decoy-'));
  fs.mkdirSync(path.join(d, '.git'));
  fs.mkdirSync(path.join(d, 'tools', 'bus-mode'), { recursive: true });
  if (armed !== false) {
    fs.mkdirSync(path.join(d, '.claude'));
    fs.writeFileSync(path.join(d, '.claude', 'bus-mode.on'), '25\n');
  }
  return d;
}
const armedAt = (d) => fs.existsSync(path.join(d, '.claude', 'bus-mode.on'));

// 53. BUS 2181, REPRODUCED AND FIXED. The shell sits in another repo's tools/bus-mode/. `on` and `off`
//     must act on the session's repo, and the other repo's marker must survive both. A resolver using the
//     cwd, the git root of the cwd, or the LAST transcript cwd fails this case - each for its own reason.
{
  const proj = tempProject(false);
  const decoy = decoyRepo();
  const drifted = path.join(decoy, 'tools', 'bus-mode');
  const env = sessionEnv(fakeSession(proj, [drifted]));
  const on = toggleAt(drifted, env, ['on']);
  assert(
    '53a `on` from a cwd drifted into ANOTHER repo arms the session repo, not that one',
    on.status === 0 && armedAt(proj) && on.stdout.includes('bus mode: on at ' + proj),
  );
  const off = toggleAt(drifted, env, ['off']);
  assert(
    '53b `off` from the same drifted cwd disarms the session repo and leaves the other armed',
    off.status === 0 && !armedAt(proj) && armedAt(decoy) && off.stdout.includes('bus mode: off at ' + proj + ' - removed'),
  );
}

// 54. The verdict the old toggle lacked. It always printed the path, but never whether anything was there.
{
  const proj = tempProject(false);
  const r = toggleAt(proj, sessionEnv(fakeSession(proj)), ['off']);
  assert(
    '54 `off` with nothing armed says so, and never claims a removal',
    r.status === 0 && r.stdout.includes('bus mode: off at ' + proj + ' - nothing was armed here') && !r.stdout.includes(' - removed'),
  );
}

// 55. A session whose launch dir cannot be recovered REFUSES. No cwd fallback: that fallback IS the defect.
{
  const decoy = decoyRepo();
  const drifted = path.join(decoy, 'tools', 'bus-mode');
  const env = isolatedEnv({ CLAUDE_CODE_SESSION_ID: 'e2e00000-0055-4000-8000-000000000055', CLAUDECODE: '1' });
  const off = toggleAt(drifted, env, ['off']);
  const on = toggleAt(drifted, env, ['on']);
  assert(
    '55 in a session whose launch dir cannot be recovered: refuse, exit 2, touch nothing, name --repo',
    off.status === 2 && on.status === 2 && off.stderr.includes('--repo') && armedAt(decoy) && !fs.existsSync(path.join(drifted, '.claude')),
  );
}

// 56. The ABSENCE of one variable is not proof of being outside a session.
{
  const decoy = decoyRepo(false);
  const r = toggleAt(decoy, isolatedEnv({ CLAUDECODE: '1' }), ['on']);
  assert('56 a session signal without a session id refuses rather than falling back to the git root', r.status === 2 && !armedAt(decoy));
}

// 57. --repo is not a way to reach another rig: that would be "off --all", one repo at a time.
{
  const proj = tempProject(false);
  const other = decoyRepo(false);
  const env = sessionEnv(fakeSession(proj));
  const bad = toggleAt(proj, env, ['on', '--repo', other]);
  const good = toggleAt(other, env, ['on', '--repo=' + proj]);
  assert(
    '57 --repo naming another rig is refused; naming the session repo itself is accepted',
    bad.status === 2 && !armedAt(other) && bad.stderr.includes('its own repo') && good.status === 0 && armedAt(proj),
  );
}

// 58. ...but when the session root is unrecoverable, --repo is the way through.
{
  const target = decoyRepo(false);
  const env = isolatedEnv({ CLAUDE_CODE_SESSION_ID: 'e2e00000-0058-4000-8000-000000000058', CLAUDECODE: '1' });
  const r = toggleAt(os.tmpdir(), env, ['on', '--repo', target]);
  assert('58 with the session root unresolvable, an explicit --repo is accepted', r.status === 0 && armedAt(target));
}

// 59. A human at a terminal. Probe M2: a session launched from repo/apps/web keeps its marker THERE, so
//     the git root alone would arm the wrong directory. Narrowed to the known launch dir inside it.
{
  const repo = decoyRepo(false);
  const web = path.join(repo, 'apps', 'web');
  fs.mkdirSync(path.join(web, 'src'), { recursive: true });
  const sess = fakeSession(web);
  const r = toggleAt(path.join(web, 'src'), isolatedEnv({ CLAUDE_CONFIG_DIR: sess.cfg }), ['on']);
  assert('59 at a terminal, a session launch dir inside the git root wins over the git root', r.status === 0 && armedAt(web) && !armedAt(repo));
}

// 60. ...and bounded BY the git root: a session once launched from above the repo (like ~) never
//     captures it, or a marker would land in ~/.claude.
{
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'bus-mode-parent-'));
  const repo = path.join(parent, 'repo');
  fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'sub'));
  const sess = fakeSession(parent);
  const r = toggleAt(path.join(repo, 'sub'), isolatedEnv({ CLAUDE_CONFIG_DIR: sess.cfg }), ['on']);
  assert('60 a launch dir ABOVE the git root never captures the repo', r.status === 0 && armedAt(repo) && !armedAt(parent));
}

// 61. No session and no repo: nothing to act on, so refuse.
{
  const nowhere = fs.mkdtempSync(path.join(os.tmpdir(), 'bus-mode-norepo-'));
  const r = toggleAt(nowhere, isolatedEnv(), ['on']);
  assert('61 at a terminal outside any git repo: refuse', r.status === 2 && !armedAt(nowhere));
}

// 62. Every command names the repo AND where that answer came from, and flags a drifted cwd.
{
  const proj = tempProject(false);
  const decoy = decoyRepo();
  const r = toggleAt(decoy, sessionEnv(fakeSession(proj)), ['status']);
  const line = r.stdout.split('\n').find((l) => l.startsWith('  repo: '));
  assert(
    '62 the repo and its source on one line, plus a note when the shell is elsewhere',
    r.status === 0 &&
      line === '  repo: ' + proj + "  [from this session's launch directory, read from its transcript]" &&
      r.stdout.includes("note: the shell's cwd is ") &&
      r.stdout.includes(path.basename(decoy)),
  );
}

// 63. The operator's intent is usually global ("bus mode off" = everywhere); the mechanism is per repo.
//     So the others are LISTED - with their limits - never touched, and never the repo acted on.
{
  const proj = tempProject(false);
  const decoy = decoyRepo();
  const sess = fakeSession(proj);
  const pdir2 = path.join(sess.cfg, 'projects', '-fake-decoy');
  fs.mkdirSync(pdir2);
  fs.writeFileSync(
    path.join(pdir2, 'e2e00000-0063-4000-8000-000000000063.jsonl'),
    JSON.stringify({ type: 'user', cwd: decoy, message: { role: 'user', content: 'hi' } }) + '\n',
  );
  fs.mkdirSync(path.join(proj, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(proj, '.claude', 'bus-mode.on'), '7\n');
  const r = toggleAt(proj, sessionEnv(sess), ['status']);
  const lines = r.stdout.split('\n');
  const i = lines.findIndex((l) => l.includes('armed elsewhere'));
  const tail = i >= 0 ? lines.slice(i) : [];
  assert(
    '63 status lists other armed repos with limits, excludes its own, and no listing line reads as a verdict',
    r.status === 0 &&
      lines[0].includes('limit=7') &&
      tail.some((l) => l.includes(decoy) && l.includes('limit=25')) &&
      !tail.some((l) => l.includes(proj)) &&
      !tail.some((l) => l.includes('bus mode: ')) &&
      armedAt(decoy),
  );
}

// 64. A subagent starts wherever the parent's shell stood when it was spawned: 142 real subagent
//     transcripts on the machine that measured this had a first cwd that was NOT the launch dir. The
//     resolver reads only <projects>/*/<session-id>.jsonl, the parent's main transcript.
{
  const proj = tempProject(false);
  const decoy = decoyRepo(false);
  const sess = fakeSession(proj);
  const sub = path.join(sess.pdir, sess.sid, 'subagents');
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(
    path.join(sub, 'agent-x.jsonl'),
    JSON.stringify({ type: 'user', cwd: decoy, sessionId: sess.sid, message: { role: 'user', content: 'x' } }) + '\n',
  );
  const r = toggleAt(decoy, sessionEnv(sess), ['on']);
  assert('64 a subagent transcript is never read as the session root', r.status === 0 && armedAt(proj) && !armedAt(decoy));
}

// 65. Before 1.7.0 the preflight read the DRIFTED repo's settings. Unresolved now means unread - never CLEAR.
{
  const env = isolatedEnv({ CLAUDE_CODE_SESSION_ID: 'e2e00000-0065-4000-8000-000000000065', CLAUDECODE: '1' });
  const r = toggleAt(os.tmpdir(), env, ['preflight']);
  assert(
    '65 preflight with an unresolved repo reports UNKNOWN, never CLEAR',
    r.status === 0 && r.stdout.includes('PREFLIGHT: UNKNOWN') && !r.stdout.includes('PREFLIGHT: CLEAR'),
  );
}

// 66. /tmp and /private/tmp are one place on macOS: a symlinked spelling is the same repo, not another rig.
{
  const proj = tempProject(false);
  const link = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bus-mode-link-')), 'proj');
  fs.symlinkSync(proj, link);
  const r = toggleAt(proj, sessionEnv(fakeSession(proj)), ['on', '--repo', link]);
  assert('66 a symlinked spelling of the session repo is accepted as the same repo', r.status === 0 && armedAt(proj));
}

// 67. A marker that survives `off` (permissions, a race) is STILL ON, exit 2 - never a silent "off".
//     Skipped as root, where the read-only directory does not stop the unlink.
if (!(process.getuid && process.getuid() === 0)) {
  const proj = tempProject(false);
  fs.mkdirSync(path.join(proj, '.claude'));
  fs.writeFileSync(path.join(proj, '.claude', 'bus-mode.on'), '25\n');
  fs.chmodSync(path.join(proj, '.claude'), 0o500);
  const r = toggleAt(proj, sessionEnv(fakeSession(proj)), ['off']);
  fs.chmodSync(path.join(proj, '.claude'), 0o700);
  assert(
    '67 a marker that survives `off` is reported STILL ON with exit 2',
    r.status === 2 && r.stderr.includes('STILL ON') && !r.stdout.includes('bus mode: off'),
  );
}

// --- the hook side ---------------------------------------------------------
function hookTranscript(dir, launchDir) {
  return writeTranscript(dir, [
    { type: 'user', cwd: launchDir, message: { role: 'user', content: 'do it' } },
    assistantTool(),
    assistantText(),
    busReadingWithStatuses(['todo'], 0, 0),
  ]);
}
const stopInput = (t) => JSON.stringify({ stop_hook_active: false, transcript_path: t });

// 68. Without CLAUDE_PROJECT_DIR the hook finds its repo from its own transcript, wherever it stands.
{
  const proj = tempProject(true);
  const decoy = decoyRepo(false);
  const r = spawnSync('node', [HOOK], { input: stopInput(hookTranscript(proj, proj)), encoding: 'utf8', env: isolatedEnv(), cwd: decoy });
  assert('68 without CLAUDE_PROJECT_DIR the hook resolves its repo from the transcript', r.status === 0 && r.stdout.includes('block'));
}

// 69. With CLAUDE_PROJECT_DIR set - every build measured - it alone decides, exactly as in 1.6.0.
{
  const armed = tempProject(true);
  const unarmed = tempProject(false);
  const r = spawnSync('node', [HOOK], {
    input: stopInput(hookTranscript(unarmed, armed)),
    encoding: 'utf8',
    env: isolatedEnv({ CLAUDE_PROJECT_DIR: unarmed }),
    cwd: armed,
  });
  assert('69 CLAUDE_PROJECT_DIR, when set, decides alone', r.status === 0 && r.stdout === '');
}

// 70. ...and NEVER the process cwd, which follows the shell's cd (probe M3).
{
  const unarmed = tempProject(false);
  const decoy = decoyRepo();
  const r = spawnSync('node', [HOOK], { input: stopInput(hookTranscript(unarmed, unarmed)), encoding: 'utf8', env: isolatedEnv(), cwd: decoy });
  assert('70 an armed repo the hook merely stands in does not wake it', r.status === 0 && r.stdout === '');
}

// 71. The resolver is loaded lazily and inside a try: a hook that lost it still works on the env path
//     every build takes, and fails OPEN - silently, exit 0 - without it.
{
  const lone = fs.mkdtempSync(path.join(os.tmpdir(), 'bus-mode-lone-'));
  fs.copyFileSync(HOOK, path.join(lone, 'stop-hook.cjs'));
  const proj = tempProject(true);
  const t = hookTranscript(proj, proj);
  const withEnv = spawnSync('node', [path.join(lone, 'stop-hook.cjs')], { input: stopInput(t), encoding: 'utf8', env: isolatedEnv({ CLAUDE_PROJECT_DIR: proj }) });
  const without = spawnSync('node', [path.join(lone, 'stop-hook.cjs')], { input: stopInput(t), encoding: 'utf8', env: isolatedEnv(), cwd: proj });
  assert(
    '71 a hook without its resolver works on the env path and fails open without it',
    withEnv.status === 0 && withEnv.stdout.includes('block') && without.status === 0 && without.stdout === '' && without.stderr === '',
  );
}

// 72. The debug canary: the hook is the one place CLAUDE_PROJECT_DIR and the transcript's first cwd are
//     both visible. It reports a disagreement on stderr and changes nothing on stdout.
{
  const armed = tempProject(true);
  const other = tempProject(false);
  const input = stopInput(hookTranscript(armed, other));
  const plain = spawnSync('node', [HOOK], { input: input, encoding: 'utf8', env: isolatedEnv({ CLAUDE_PROJECT_DIR: armed }) });
  const dbg = spawnSync('node', [HOOK], { input: input, encoding: 'utf8', env: isolatedEnv({ CLAUDE_PROJECT_DIR: armed, BUS_MODE_DEBUG: '1' }) });
  assert(
    '72 the root canary flags a disagreement on stderr and leaves stdout identical',
    dbg.stderr.includes('"rootCheck":"DISAGREE"') && dbg.stdout === plain.stdout && plain.stdout.includes('block'),
  );
}

// 73. A session id is a NAME, never a path: "../evil" must not walk out of the projects dir.
{
  const proj = tempProject(false);
  const decoy = decoyRepo(false);
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'bus-mode-cfg-'));
  fs.mkdirSync(path.join(cfg, 'projects', 'p'), { recursive: true });
  fs.writeFileSync(path.join(cfg, 'projects', 'evil.jsonl'), JSON.stringify({ type: 'user', cwd: decoy, message: { role: 'user', content: 'x' } }) + '\n');
  const r = toggleAt(proj, isolatedEnv({ CLAUDE_CONFIG_DIR: cfg, CLAUDE_CODE_SESSION_ID: '../evil', CLAUDECODE: '1' }), ['on']);
  assert('73 a path traversal in the session id is refused', r.status === 2 && !armedAt(decoy));
}

// 74. One session id under two project dirs is two candidate roots, and two is not an answer.
{
  const a = tempProject(false);
  const b = tempProject(false);
  const sess = fakeSession(a);
  const pdir2 = path.join(sess.cfg, 'projects', '-fake-b');
  fs.mkdirSync(pdir2);
  fs.writeFileSync(path.join(pdir2, sess.sid + '.jsonl'), JSON.stringify({ type: 'user', cwd: b, message: { role: 'user', content: 'x' } }) + '\n');
  const r = toggleAt(a, sessionEnv(sess), ['on']);
  assert('74 an ambiguous session id is refused', r.status === 2 && !armedAt(a) && !armedAt(b));
}


// 75. The FIRST cwd means the first cwd RECORD. One that cannot be trusted stops the search rather than
//     being skipped, because skipping hands back the next cwd - which may already have drifted.
function rawSession(lines) {
  const cfg = fs.mkdtempSync(path.join(os.tmpdir(), 'bus-mode-cfg-'));
  const sid = 'e2e00000-0075-4000-8000-' + String(passed).padStart(12, '0');
  const pdir = path.join(cfg, 'projects', '-fake-raw');
  fs.mkdirSync(pdir, { recursive: true });
  fs.writeFileSync(path.join(pdir, sid + '.jsonl'), lines.join('\n') + '\n');
  return { cfg: cfg, sid: sid, pdir: pdir };
}
{
  const proj = tempProject(false);
  const decoy = decoyRepo(false);
  const drift = JSON.stringify({ type: 'user', cwd: decoy, message: { role: 'user', content: 'x' } });
  const bom = rawSession(['﻿' + JSON.stringify({ type: 'user', cwd: proj, message: { role: 'user', content: 'hi' } }), drift]);
  const a = toggleAt(decoy, sessionEnv(bom), ['on']);
  assert('75a a byte-order mark on line 1 does not hide the first cwd', a.status === 0 && armedAt(proj) && !armedAt(decoy));
  const broken = rawSession(['{"type":"user","cwd":"' + proj + '","message":', drift]);
  const b = toggleAt(decoy, sessionEnv(broken), ['on']);
  assert('75b an unparseable first cwd record refuses instead of falling through to a drifted one', b.status === 2 && !armedAt(decoy));
  const rel = rawSession([JSON.stringify({ type: 'user', cwd: 'relative/dir', message: { role: 'user', content: 'hi' } }), drift]);
  const c = toggleAt(decoy, sessionEnv(rel), ['on']);
  assert('75c a relative first cwd refuses instead of falling through to a drifted one', c.status === 2 && !armedAt(decoy));
}

// 76. A shell standing in a DELETED directory (a removed worktree is enough) makes process.cwd() throw.
//     The session path never needed the cwd, so `off` must still disarm the session's repo.
{
  const proj = tempProject(false);
  fs.mkdirSync(path.join(proj, '.claude'));
  fs.writeFileSync(path.join(proj, '.claude', 'bus-mode.on'), '25\n');
  const env = sessionEnv(fakeSession(proj));
  const gone = path.join(os.tmpdir(), 'bus-mode-gone-' + process.pid + '-' + passed);
  const run = (verb) =>
    spawnSync('sh', ['-c', 'mkdir -p "$1" && cd "$1" && rmdir "$1" && exec node "$2" "$3"', 'sh', gone, TOGGLE, verb], { encoding: 'utf8', env: env });
  const off = run('off');
  const st = run('status');
  assert(
    '76 a deleted cwd does not stop `off` disarming the session repo, and `status` still exits 0',
    off.status === 0 && !armedAt(proj) && off.stdout.includes(' - removed') && st.status === 0 && st.stdout.includes('no longer exists'),
  );
}

// 77. A flag missing its value, or a limit that is not a whole number of 1 or more, is a usage error.
//     `on 0` used to write 25 without a word.
{
  const proj = tempProject(false);
  const env = sessionEnv(fakeSession(proj));
  const noval = toggleAt(proj, env, ['on', '--repo']);
  const zero = toggleAt(proj, env, ['on', '0']);
  const abc = toggleAt(proj, env, ['on', 'abc']);
  assert(
    '77 `--repo` without a path and a limit below 1 or not a number are usage errors, and arm nothing',
    noval.status === 1 && zero.status === 1 && abc.status === 1 && !armedAt(proj),
  );
}

// 78. (1.7.1) The wake text carries the rule the loop runs on. Guard 2 decides the NEXT wake from a
//     whats_new read after the turn's last board change, and nothing told a woken agent so: one that
//     shipped a task and ended its turn there let the session stop with work left.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [human('do it'), busWork(), assistantTool()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  let reason = '';
  try {
    reason = JSON.parse(r.stdout).reason;
  } catch {
    reason = '';
  }
  assert(
    '78 the wake text makes whats_new the LAST bus call, keeps its fingerprint, and names no repo-relative toggle',
    r.status === 0 && reason.startsWith(REASON_HEAD) && reason.includes('Make whats_new the LAST bus call of this turn') &&
      !reason.includes('node tools/bus-mode/toggle.cjs'),
  );
  // The posture note rides the same block, and it named the same repo-relative path.
  const rp = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t, permission_mode: 'acceptEdits' }));
  let noted = '';
  try {
    noted = JSON.parse(rp.stdout).reason;
  } catch {
    noted = '';
  }
  assert(
    '78b the POSTURE WARNING names no repo-relative toggle path either',
    noted.includes('POSTURE WARNING') && !noted.includes('node tools/bus-mode/toggle.cjs'),
  );
}

// 79. (1.7.1) `on` tells the agent to take a board reading NOW. The turn that says "bus mode on" usually
//     holds none, and with no reading guard 2 allows the stop: bus mode armed and never started.
{
  const proj = tempProject(false);
  const env = sessionEnv(fakeSession(proj));
  const on = toggleAt(proj, env, ['on']);
  const st = toggleAt(proj, env, ['status']);
  // ENDS with it, after the preflight: an instruction buried above the preflight's launch advice is the
  // one an agent skims past (a gatekeeper moved it there and a looser version of this case still passed).
  assert(
    '79 `on` ENDS with the instruction to call whats_new now, as the last bus call of every turn; `status` does not give it',
    on.status === 0 && armedAt(proj) && on.stdout.includes('NEXT, this turn: call whats_new') &&
      on.stdout.trimEnd().endsWith('so make whats_new the LAST bus call of every turn.') &&
      !st.stdout.includes('NEXT, this turn'),
  );
}

// ---------------------------------------------------------------------------
// 1.8.0 - WHO SPOKE (bus 2857) AND NEW WORK ONLY (bus 2293). Shapes measured on a real session whose
// build writes `version` on records: 375 wakes in about two hours against a marker limit of 25.
// ---------------------------------------------------------------------------

// A finished background task or a Monitor event, exactly as that build records it.
const taskNotification = () => ({
  type: 'user',
  origin: { kind: 'task-notification' },
  promptSource: 'system',
  turnOrigin: 'task_notification',
  message: { role: 'user', content: '<task-notification>\n<task-id>b1</task-id>\n<status>completed</status>\n</task-notification>' },
});
// The hook's own feedback as that build records it: isMeta, no origin, the reason after a prefix.
const injectedMeta = () => ({
  type: 'user',
  isMeta: true,
  message: { role: 'user', content: 'Stop hook feedback:\n' + REASON_HEAD + 'treat this as a nudge.' },
});
const humanOrigin = (text) => ({ type: 'user', origin: { kind: 'human' }, promptSource: 'sdk', message: { role: 'user', content: text } });
const withLimit = (dir, n) => fs.writeFileSync(path.join(dir, '.claude', 'bus-mode.on'), n + '\n');

// 80a. THE 375-WAKE LOOP. Three injections since the operator spoke, a notification between each, limit
//      3: the brake must stop it. Before 1.8.0 each notification reset the count to 0 and this blocked.
{
  const dir = tempProject(true);
  withLimit(dir, 3);
  const t = writeTranscript(dir, [
    humanOrigin('work the board'), assistantTool(),
    injectedMeta(), assistantTool(), taskNotification(), assistantTool(),
    injectedMeta(), assistantTool(), taskNotification(), assistantTool(),
    injectedMeta(), assistantTool(), taskNotification(), assistantTool(), busWork(),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: true, transcript_path: t }));
  assert('80a a task notification does not reset the count: the brake stops at the limit', r.status === 0 && r.stdout.trim() === '');
  // 80b. The turn a notification starts is a FRESH stop to the harness (stop_hook_active false). The
  //      limit is per operator message, so it binds there too.
  const r2 = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('80b at the limit, a notification-started turn is not woken either', r2.status === 0 && r2.stdout.trim() === '');
}

// 80c. ...and under the limit, a notification-started turn with work on the board is still woken: the
//      notification is not a stop signal, only not a reset.
{
  const dir = tempProject(true);
  withLimit(dir, 3);
  const t = writeTranscript(dir, [
    humanOrigin('work the board'), assistantTool(), injectedMeta(), assistantTool(),
    taskNotification(), assistantTool(), busWork(),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('80c under the limit, a notification-started turn with work is woken', r.status === 0 && r.stdout.includes('block'));
}

// 81. An isMeta record is never the operator, even when nothing else in it would say so. Here its text
//     does NOT carry the fingerprint, so only isMeta can keep it from becoming the human: miscounted,
//     the digest before it falls outside the turn and the hook goes quiet on a board with work.
{
  const dir = tempProject(true);
  const meta = { type: 'user', isMeta: true, message: { role: 'user', content: 'Stop hook feedback:\nsomething else' } };
  const t = writeTranscript(dir, [humanOrigin('do it'), assistantTool(), busWork(), meta, assistantTool()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('81 an isMeta record is not a human message', r.status === 0 && r.stdout.includes('block'));
}

// 81b. origin.kind decides on its own: a non-"human" origin with plain text and no isMeta is still not
//      the operator (without this case only the notification prefix would be pinning 80a).
{
  const dir = tempProject(true);
  const other = { type: 'user', origin: { kind: 'task-notification' }, message: { role: 'user', content: 'plain words' } };
  const t = writeTranscript(dir, [humanOrigin('do it'), assistantTool(), busWork(), other, assistantTool()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('81b a non-human origin.kind is not a human message', r.status === 0 && r.stdout.includes('block'));
}

// 82. origin.kind "human" is the operator, and it still resets the count: at limit 1 with one injection
//     BEFORE it, the stop after it is a first wake and blocks.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    humanOrigin('first'), assistantTool(), injectedMeta(), assistantTool(),
    humanOrigin('now this'), assistantTool(), busWork(),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('82 an origin.kind "human" record resets the count', r.status === 0 && r.stdout.includes('block'));
}

// 82b. A notification with NO origin field (older builds) is caught by its own prefix.
{
  const dir = tempProject(true);
  const bare = { type: 'user', message: { role: 'user', content: '<task-notification>\n<status>completed</status>\n</task-notification>' } };
  const t = writeTranscript(dir, [human('do it'), assistantTool(), busWork(), bare, assistantTool()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('82b a notification without origin is not a human message', r.status === 0 && r.stdout.includes('block'));
}

// 83. A STANDING BACKLOG. Unassigned 30 in the previous digest and 30 now, nothing else: no wake.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    human('do it'), assistantTool(), busToolResult(digest(0, 0, 30)),
    human('carry on'), assistantTool(), busToolResult(digest(0, 0, 30)),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('83 unassigned unchanged across two digests does not wake', r.status === 0 && r.stdout.trim() === '');
}

// 84. A NEW unassigned item: 30 then 31 wakes.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    human('do it'), assistantTool(), busToolResult(digest(0, 0, 30)),
    human('carry on'), assistantTool(), busToolResult(digest(0, 0, 31)),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('84 unassigned increased since the previous digest wakes', r.status === 0 && r.stdout.includes('block'));
}

// 84b. Fewer than before is not new work either (the agent took one, or someone else did).
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    human('do it'), assistantTool(), busToolResult(digest(0, 0, 30)), assistantTool(), busToolResult(digest(0, 0, 29)),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('84b unassigned decreased does not wake', r.status === 0 && r.stdout.trim() === '');
}

// 85. A FIRST reading keeps the old rule: one digest, unassigned > 0, wakes - so a session armed on a
//     backlog still starts. (Case 30 pins the same with a blocked plate.)
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), busToolResult(digest(0, 0, 30))]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('85 a single first digest with unassigned > 0 still wakes', r.status === 0 && r.stdout.includes('block'));
}

// 85b. The standing backlog does not mask the actor's own work: unchanged unassigned plus unread mail
//      or an actionable task still wakes.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    human('do it'), assistantTool(), busToolResult(digest(0, 0, 30)), assistantTool(), busToolResult(digest(1, 2, 30)),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('85b unread posts or own tasks still wake beside an unchanged backlog', r.status === 0 && r.stdout.includes('block'));
}

// ---------------------------------------------------------------------------
// 1.8.1 - gatekeeper findings on 1.8.0, each verified against ~300 real transcripts.
// ---------------------------------------------------------------------------

// A compaction, as the harness records it: a compact_boundary system record, then the summary as a
// type:"user" record with string content, no origin, no isMeta - only isCompactSummary says what it is.
const compactBoundary = () => ({ type: 'system', subtype: 'compact_boundary', content: 'Conversation compacted' });
const compactSummary = () => ({
  type: 'user',
  isCompactSummary: true,
  isVisibleInTranscriptOnly: true,
  message: { role: 'user', content: 'This session is being continued from a previous conversation that ran out of context.' },
});

// 86. A COMPACTION DOES NOT RESET THE BRAKE. Limit 2; one injection before the compaction, one after:
//     the count is 2 and the stop is allowed. Counted as the operator, the summary restarted the count
//     at 1 and this blocked - on every compaction, so a long run never reached its limit.
{
  const dir = tempProject(true);
  withLimit(dir, 2);
  const t = writeTranscript(dir, [
    humanOrigin('work the board'), assistantTool(), injectedMeta(), assistantTool(),
    compactBoundary(), compactSummary(), assistantTool(), injectedMeta(), assistantTool(), busWork(),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: true, transcript_path: t }));
  assert('86 a compaction summary does not reset the continuation count', r.status === 0 && r.stdout.trim() === '');
}

// 87. A BOARD CHANGE BETWEEN THE TWO DIGESTS VOIDS THE BASELINE. 30, then a task call, then 30: a
//     filing and a claim cancel out in the counts, so the baseline is unknown and unassigned > 0 wakes
//     (the first-reading rule). Compared naively, the new item was absorbed into the baseline for good.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    human('do it'), assistantTool(), busToolResult(digest(0, 0, 30)),
    busToolUse('mcp__llm-bus__task_start'), busToolResult(digest(0, 0, 30)),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('87 a task call between the digests makes the baseline unknown: wakes', r.status === 0 && r.stdout.includes('block'));
}

// 87b. read_posts between the digests moves only unread_posts, so the baseline stands: no wake.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    human('do it'), assistantTool(), busToolResult(digest(0, 0, 30)),
    busToolUse('mcp__llm-bus__read_posts'), busToolResult(digest(0, 0, 30)),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('87b read_posts between the digests keeps the baseline: no wake', r.status === 0 && r.stdout.trim() === '');
}

// 87d. A PARALLEL claim: whats_new and task_start issued together, the claim recorded between the call
//      and its result. The digest may or may not include it, so the baseline is unknown: wakes.
{
  const dir = tempProject(true);
  const call = (id, name) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: id, name: name, input: {} }] } });
  const res = (id, payload) => ({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content: JSON.stringify(payload) }] } });
  const t = writeTranscript(dir, [
    human('do it'), call('w1', 'mcp__llm-bus__whats_new'), call('s1', 'mcp__llm-bus__task_start'),
    res('s1', { ok: true }), res('w1', digest(0, 0, 30)),
    call('w2', 'mcp__llm-bus__whats_new'), res('w2', digest(0, 0, 30)),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('87d a claim issued in parallel with the previous whats_new voids the baseline', r.status === 0 && r.stdout.includes('block'));
}

// 87e. task_ship can only raise open_unassigned (since llm-bus decision 093, by unblocking a dependent),
//      so it keeps the baseline: a standing backlog is not woken on every turn that ships a task.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    human('do it'), assistantTool(), busToolResult(digest(0, 0, 30)),
    busToolUse('mcp__llm-bus__task_ship'), busToolResult(digest(0, 0, 30)),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('87e task_ship between the digests keeps the baseline: no wake', r.status === 0 && r.stdout.trim() === '');
}

// 87c. A task call BEFORE the previous digest is already reflected in it: the baseline stands.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    human('do it'), assistantTool(), busToolResult(digest(0, 0, 30)), busToolUse('mcp__llm-bus__task_start'),
    busToolResult(digest(0, 0, 30)), assistantTool(), busToolResult(digest(0, 0, 30)),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('87c a task call before the previous digest does not void the baseline', r.status === 0 && r.stdout.trim() === '');
}

// 88. AN EXPLICIT HUMAN ORIGIN WINS OVER THE FINGERPRINT. Limit 1, one injection, then the operator
//     pastes the wake message: that paste is the operator's message, the count restarts at 0, and the
//     stop after it blocks. Read by fingerprint alone, the paste was the hook's own voice and the brake
//     held the session at the limit the operator had just reset.
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    humanOrigin('first'), assistantTool(), injectedMeta(), assistantTool(),
    humanOrigin('why did this say: ' + REASON_HEAD + 'treat this as a nudge.'), assistantTool(), busWork(),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('88 origin.kind "human" carrying the fingerprint is still the operator', r.status === 0 && r.stdout.includes('block'));
}

// 88b. The same with block content, the other shape a human-origin record is written in.
{
  const dir = tempProject(true);
  const pasted = { type: 'user', origin: { kind: 'human' }, message: { role: 'user', content: [{ type: 'text', text: REASON_HEAD + 'treat this as a nudge.' }] } };
  const t = writeTranscript(dir, [
    humanOrigin('first'), assistantTool(), injectedMeta(), assistantTool(), pasted, assistantTool(), busWork(),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('88b origin.kind "human" with a fingerprinted text block is still the operator', r.status === 0 && r.stdout.includes('block'));
}

// ── 1.9.0 - the context wind-down (locked design "Item 3", 2026-10-08) ──────────────────────────
// Off by default; on with BUS_MODE_WINDDOWN. The status line writes context use to a per-session file
// (statusline.cjs); the hook reads it at turn end. Every case uses a private context dir.
const STATUSLINE = path.join(__dirname, 'statusline.cjs');
const SID = '0b7c6a52-1f4e-4c11-9d2a-3e6f0c9a1b2d';
const CEREMONY_HEAD = 'Context wind-down: the closing ceremony is due now.';
const FINISH_HEAD = 'CONTEXT WIND-DOWN:';

function ctxDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bus-mode-ctx-'));
}
function writeCtx(dir, pct, ageMs, sid) {
  fs.writeFileSync(
    path.join(dir, (sid || SID) + '.json'),
    JSON.stringify({ session_id: sid || SID, used_percentage: pct, updated_at: Date.now() - (ageMs || 0) })
  );
}
function runWD(dir, ctx, stdinObj, extraEnv) {
  return spawnSync('node', [HOOK], {
    input: JSON.stringify(Object.assign({ session_id: SID }, stdinObj)),
    encoding: 'utf8',
    env: isolatedEnv(Object.assign({ CLAUDE_PROJECT_DIR: dir, BUS_MODE_CONTEXT_DIR: ctx }, extraEnv || {})),
  });
}
const reasonOf = (r) => {
  try {
    return JSON.parse(r.stdout).reason || '';
  } catch {
    return '';
  }
};
const ceremonyInjected = () => ({ type: 'user', isMeta: true, message: { role: 'user', content: 'Stop hook feedback:\n' + CEREMONY_HEAD + ' This session has used 72%.' } });
const workTurn = (dir) => writeTranscript(dir, [human('do it'), assistantTool(), busWork()]);
const idleTurn = (dir) => writeTranscript(dir, [human('do it'), assistantTool(), busEmpty()]);

// 89. SWITCHED OFF (no BUS_MODE_WINDDOWN): a file at 85% changes nothing. Board work -> the plain wake,
//     no note; an empty board -> allowed, no ceremony.
{
  const dir = tempProject(true);
  const ctx = ctxDir();
  writeCtx(ctx, 85);
  const r = runWD(dir, ctx, { stop_hook_active: false, transcript_path: workTurn(dir) });
  const reason = reasonOf(r);
  assert('89 wind-down off: the plain wake', r.status === 0 && reason.startsWith(REASON_HEAD) && !reason.includes(FINISH_HEAD) && !reason.includes(CEREMONY_HEAD));
  const r2 = runWD(dir, ctx, { stop_hook_active: false, transcript_path: idleTurn(dir) });
  assert('89 wind-down off: an empty board is still allowed', r2.status === 0 && r2.stdout.trim() === '');
}

// 89b. "off" and "0" are off too.
for (const v of ['off', '0', '']) {
  const dir = tempProject(true);
  const ctx = ctxDir();
  writeCtx(ctx, 85);
  const r = runWD(dir, ctx, { stop_hook_active: false, transcript_path: idleTurn(dir) }, { BUS_MODE_WINDDOWN: v });
  assert('89b BUS_MODE_WINDDOWN=' + JSON.stringify(v) + ' is off', r.status === 0 && r.stdout.trim() === '');
}

// 90-93. THE THRESHOLDS: 59 nothing, 60 the finish note, 69 still the note, 70 the ceremony.
for (const [pct, expect] of [[59, 'plain'], [60, 'finish'], [69, 'finish'], [70, 'ceremony']]) {
  const dir = tempProject(true);
  const ctx = ctxDir();
  writeCtx(ctx, pct);
  const r = runWD(dir, ctx, { stop_hook_active: false, transcript_path: workTurn(dir) }, { BUS_MODE_WINDDOWN: 'on' });
  const reason = reasonOf(r);
  const got = reason.startsWith(CEREMONY_HEAD) ? 'ceremony'
    : reason.startsWith(REASON_HEAD) && reason.includes(FINISH_HEAD) ? 'finish'
      : reason.startsWith(REASON_HEAD) ? 'plain' : 'none';
  assert('90-93 at ' + pct + '% the wake is ' + expect + ' (got ' + got + ')', r.status === 0 && got === expect);
  if (expect === 'finish') {
    assert('90-93 the finish note names the percentage', reason.includes(pct + '% of its context window'));
  }
}

// 93b. The ceremony does not need board work or a working turn: it is a handover, not board work.
{
  const dir = tempProject(true);
  const ctx = ctxDir();
  writeCtx(ctx, 70);
  const t = writeTranscript(dir, [human('hello'), assistantText(), busEmpty()]);
  const r = runWD(dir, ctx, { stop_hook_active: false, transcript_path: t }, { BUS_MODE_WINDDOWN: 'on' });
  assert('93b ceremony fires on an empty board and a conversational turn', r.status === 0 && reasonOf(r).startsWith(CEREMONY_HEAD));
}

// 94. ONCE PER OPERATOR MESSAGE. The ceremony was asked for since the operator spoke: the stop is
//     allowed, even as a continuation with work on the board. Counting the injected ceremony as the
//     operator would make it fire again here, forever. The limit is raised to 25 (what a bare `on`
//     writes) so guard 1 is not what allows these stops.
{
  const dir = tempProject(true);
  withLimit(dir, 25);
  const ctx = ctxDir();
  writeCtx(ctx, 75);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), ceremonyInjected(), assistantTool(), busWork()]);
  const r = runWD(dir, ctx, { stop_hook_active: true, transcript_path: t }, { BUS_MODE_WINDDOWN: 'on' });
  assert('94 ceremony already asked for: stop allowed', r.status === 0 && r.stdout.trim() === '');
  const r2 = runWD(dir, ctx, { stop_hook_active: false, transcript_path: t }, { BUS_MODE_WINDDOWN: 'on' });
  assert('94 ...also on a fresh stop', r2.status === 0 && r2.stdout.trim() === '');
}

// 94b. A ceremony from an EARLIER operator message does not count: the operator spoke since (the
//      dispatcher's "new task N", say), so a session still over the line is told again.
{
  const dir = tempProject(true);
  const ctx = ctxDir();
  writeCtx(ctx, 75);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), ceremonyInjected(), assistantTool(), human('new task 9'), assistantTool(), busWork()]);
  const r = runWD(dir, ctx, { stop_hook_active: false, transcript_path: t }, { BUS_MODE_WINDDOWN: 'on' });
  assert('94b a new operator message re-arms the ceremony', r.status === 0 && reasonOf(r).startsWith(CEREMONY_HEAD));
}

// 94c. The ceremony is the hook's own voice for the BRAKE too: at limit 2 with one plain wake and one
//      ceremony since the operator spoke, a stop below the stop threshold is allowed by guard 1.
{
  const dir = tempProject(true);
  withLimit(dir, 2);
  const ctx = ctxDir();
  writeCtx(ctx, 65);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), injected(), assistantTool(), ceremonyInjected(), assistantTool(), busWork()]);
  const r = runWD(dir, ctx, { stop_hook_active: true, transcript_path: t }, { BUS_MODE_WINDDOWN: 'on' });
  assert('94c the ceremony counts toward the continuation limit', r.status === 0 && r.stdout.trim() === '');
}

// 94d. GUARD 1 STILL BINDS: at the continuation limit the stop is allowed, ceremony or not. Below the
//      limit (raised to 3) the same transcript gets the ceremony.
{
  const dir = tempProject(true);
  const ctx = ctxDir();
  writeCtx(ctx, 80);
  const t = writeTranscript(dir, [human('do it'), assistantTool(), injected(), assistantTool(), busWork()]);
  const r = runWD(dir, ctx, { stop_hook_active: true, transcript_path: t }, { BUS_MODE_WINDDOWN: 'on' });
  assert('94d at the limit (1): stop allowed, no ceremony', r.status === 0 && r.stdout.trim() === '');
  withLimit(dir, 3);
  const r2 = runWD(dir, ctx, { stop_hook_active: true, transcript_path: t }, { BUS_MODE_WINDDOWN: 'on' });
  assert('94d below the limit (3): the ceremony', r2.status === 0 && reasonOf(r2).startsWith(CEREMONY_HEAD));
}

// 94e. OFF MEANS IDENTICAL, EVEN FOR A QUOTE (gatekeeper finding on 1.9.0). An operator message (no
//      origin field) quoting the ceremony sentence, wind-down off: it is still the operator, so the turn
//      after it is conversational and the stop is allowed, exactly as on 1.8.2. Read as the hook's voice,
//      the earlier working turn would count and the session would be woken.
{
  const dir = tempProject(true);
  withLimit(dir, 25);
  const t = writeTranscript(dir, [human('first'), assistantTool(), injected(), assistantTool(),
    human('why did it say: ' + CEREMONY_HEAD), assistantText(), busWork()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('94e wind-down off: a quoted ceremony sentence is the operator', r.status === 0 && r.stdout.trim() === '');
}

// 104. A wrapped status line longer than a pipe buffer arrives whole.
{
  const ctx = ctxDir();
  const r = runStatus(ctx, { session_id: SID, context_window: { used_percentage: 1 } }, ['--', 'node', '-e', "process.stdout.write('x'.repeat(300000))"]);
  assert('104 wrapped output is not truncated', r.status === 0 && r.stdout.length === 300000);
}

// 95. MISSING FILE: no reading, so exactly the wind-down-off behaviour.
{
  const dir = tempProject(true);
  const ctx = ctxDir();
  const r = runWD(dir, ctx, { stop_hook_active: false, transcript_path: workTurn(dir) }, { BUS_MODE_WINDDOWN: 'on' });
  const reason = reasonOf(r);
  assert('95 missing file: the plain wake', r.status === 0 && reason.startsWith(REASON_HEAD) && !reason.includes(FINISH_HEAD));
  const r2 = runWD(dir, ctx, { stop_hook_active: false, transcript_path: idleTurn(dir) }, { BUS_MODE_WINDDOWN: 'on' });
  assert('95 missing file: an empty board is allowed', r2.status === 0 && r2.stdout.trim() === '');
}

// 96. STALE FILE: older than the max age (default 600 s) is no reading. So is a future-dated one.
{
  const dir = tempProject(true);
  const ctx = ctxDir();
  writeCtx(ctx, 90, 601 * 1000);
  const r = runWD(dir, ctx, { stop_hook_active: false, transcript_path: idleTurn(dir) }, { BUS_MODE_WINDDOWN: 'on' });
  assert('96 stale file: no ceremony', r.status === 0 && r.stdout.trim() === '');
  writeCtx(ctx, 90, 599 * 1000);
  const r2 = runWD(dir, ctx, { stop_hook_active: false, transcript_path: idleTurn(dir) }, { BUS_MODE_WINDDOWN: 'on' });
  assert('96 control: a 599 s old file is read', r2.status === 0 && reasonOf(r2).startsWith(CEREMONY_HEAD));
  writeCtx(ctx, 90, -3600 * 1000);
  const r3 = runWD(dir, ctx, { stop_hook_active: false, transcript_path: idleTurn(dir) }, { BUS_MODE_WINDDOWN: 'on' });
  assert('96 future-dated file: no ceremony', r3.status === 0 && r3.stdout.trim() === '');
}

// 96b. The max age is configurable.
{
  const dir = tempProject(true);
  const ctx = ctxDir();
  writeCtx(ctx, 90, 30 * 1000);
  const r = runWD(dir, ctx, { stop_hook_active: false, transcript_path: idleTurn(dir) }, { BUS_MODE_WINDDOWN: 'on', BUS_MODE_WINDDOWN_MAX_AGE_S: '20' });
  assert('96b BUS_MODE_WINDDOWN_MAX_AGE_S=20 makes a 30 s file stale', r.status === 0 && r.stdout.trim() === '');
}

// 97. CONFIGURABLE THRESHOLDS: "40,50" - 45 is the note, 50 the ceremony. An unusable pair falls back
//     to 60,70 rather than switching off.
{
  for (const [pct, setting, expect] of [[45, '40,50', 'finish'], [50, '40,50', 'ceremony'], [39, '40,50', 'plain'], [65, '70,60', 'finish'], [70, '70,60', 'ceremony']]) {
    const dir = tempProject(true);
    const ctx = ctxDir();
    writeCtx(ctx, pct);
    const r = runWD(dir, ctx, { stop_hook_active: false, transcript_path: workTurn(dir) }, { BUS_MODE_WINDDOWN: setting });
    const reason = reasonOf(r);
    const got = reason.startsWith(CEREMONY_HEAD) ? 'ceremony'
      : reason.includes(FINISH_HEAD) ? 'finish' : reason.startsWith(REASON_HEAD) ? 'plain' : 'none';
    assert('97 ' + setting + ' at ' + pct + '% is ' + expect + ' (got ' + got + ')', got === expect);
  }
}

// 98. A FILE FOR ANOTHER SESSION is not this session's reading: neither under this session's name with
//     another id inside, nor another session's own file.
{
  const dir = tempProject(true);
  const ctx = ctxDir();
  fs.writeFileSync(path.join(ctx, SID + '.json'), JSON.stringify({ session_id: 'someone-else', used_percentage: 95, updated_at: Date.now() }));
  writeCtx(ctx, 95, 0, 'another-session');
  const r = runWD(dir, ctx, { stop_hook_active: false, transcript_path: idleTurn(dir) }, { BUS_MODE_WINDDOWN: 'on' });
  assert('98 another session\'s number is ignored', r.status === 0 && r.stdout.trim() === '');
}

// 98b. Corrupt file, and a session id that is not a safe file name: no reading, no crash.
{
  const dir = tempProject(true);
  const ctx = ctxDir();
  fs.writeFileSync(path.join(ctx, SID + '.json'), '{not json');
  const r = runWD(dir, ctx, { stop_hook_active: false, transcript_path: idleTurn(dir) }, { BUS_MODE_WINDDOWN: 'on' });
  assert('98b corrupt file: fail open', r.status === 0 && r.stdout.trim() === '');
  const r2 = runWD(dir, ctx, { session_id: '../../etc/passwd', stop_hook_active: false, transcript_path: idleTurn(dir) }, { BUS_MODE_WINDDOWN: 'on' });
  assert('98b unsafe session id: fail open', r2.status === 0 && r2.stdout.trim() === '');
}

// 99. NOT ARMED: the wind-down never acts in a repo without the bus-mode marker.
{
  const dir = tempProject(false);
  const ctx = ctxDir();
  writeCtx(ctx, 95);
  const r = runWD(dir, ctx, { stop_hook_active: false, transcript_path: idleTurn(dir) }, { BUS_MODE_WINDDOWN: 'on' });
  assert('99 unarmed repo: wind-down does nothing', r.status === 0 && r.stdout.trim() === '');
}

// 99b. The posture note still rides on the ceremony, appended after it.
{
  const dir = tempProject(true);
  const ctx = ctxDir();
  writeCtx(ctx, 80);
  const r = runWD(dir, ctx, { permission_mode: 'auto', stop_hook_active: false, transcript_path: idleTurn(dir) }, { BUS_MODE_WINDDOWN: 'on' });
  const reason = reasonOf(r);
  assert('99b ceremony first, posture warning appended', reason.startsWith(CEREMONY_HEAD) && reason.includes('POSTURE WARNING'));
}

// 100. THE STATUS-LINE HELPER writes the context file and prints its line.
function runStatus(ctx, input, args) {
  return spawnSync('node', [STATUSLINE].concat(args || []), {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    env: isolatedEnv({ BUS_MODE_CONTEXT_DIR: ctx }),
  });
}
{
  const ctx = ctxDir();
  const r = runStatus(ctx, { session_id: SID, context_window: { used_percentage: 63, remaining_percentage: 37 }, rate_limits: { five_hour: { used_percentage: 99 } } });
  const j = JSON.parse(fs.readFileSync(path.join(ctx, SID + '.json'), 'utf8'));
  assert('100 statusline prints ctx 63%', r.status === 0 && r.stdout.trim() === 'ctx 63%');
  assert('100 statusline records context_window.used_percentage, not the rate limit', j.session_id === SID && j.used_percentage === 63 && Math.abs(Date.now() - j.updated_at) < 60000);
}

// 100b. End to end: what the helper writes is what the hook reads.
{
  const dir = tempProject(true);
  const ctx = ctxDir();
  runStatus(ctx, { session_id: SID, context_window: { used_percentage: 71 } });
  const r = runWD(dir, ctx, { stop_hook_active: false, transcript_path: idleTurn(dir) }, { BUS_MODE_WINDDOWN: 'on' });
  assert('100b helper then hook: the ceremony at 71%', reasonOf(r).startsWith(CEREMONY_HEAD) && reasonOf(r).includes('71%'));
}

// 101. No percentage yet (null before the first response), garbage input, an unsafe id: no file, exit 0.
{
  const ctx = ctxDir();
  const r1 = runStatus(ctx, { session_id: SID, context_window: { used_percentage: null } });
  const r2 = runStatus(ctx, 'not json');
  // The unsafe id is tried against a context dir NESTED in a fresh parent, so a write that escapes it
  // ('../x.json') lands where the assertion looks (gatekeeper finding on 1.9.0: listing the context dir
  // alone passed with the id check removed).
  const nested = path.join(ctxDir(), 'context');
  const r3 = runStatus(nested, { session_id: '../x', context_window: { used_percentage: 50 } });
  assert('101 null percentage prints ctx -', r1.status === 0 && r1.stdout.trim() === 'ctx -');
  assert('101 garbage input exits 0', r2.status === 0);
  assert('101 nothing written', fs.readdirSync(ctx).length === 0);
  assert('101 an unsafe id writes nothing, not even outside the dir', r3.status === 0 &&
    fs.readdirSync(path.dirname(nested)).every((n) => n === 'context') &&
    (!fs.existsSync(nested) || fs.readdirSync(nested).length === 0));
}

// 102. WRAP MODE: an existing status line keeps working - it gets the same input, and its output is
//      what is printed. The file is still written.
{
  const ctx = ctxDir();
  const inner = path.join(ctxDir(), 'inner.cjs');
  fs.writeFileSync(inner, "const j=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write('inner '+j.context_window.used_percentage+'\\n');");
  const r = runStatus(ctx, { session_id: SID, context_window: { used_percentage: 42 } }, ['--', 'node', inner]);
  assert('102 wrap prints the wrapped line', r.status === 0 && r.stdout.trim() === 'inner 42');
  assert('102 wrap still records', fs.existsSync(path.join(ctx, SID + '.json')));
}

// 103. (1.9.1, task 3750) THE WAKE TEXT CHANGED, THE OLD ONE IS STILL THE HOOK'S VOICE. A session
//      that spans the upgrade has 1.9.0's wakes ("is NOT empty") in its transcript. Limit 3, three old
//      wakes since the operator spoke: the brake must allow the stop. Read as the operator, the last old
//      wake would restart the count at 0 and this would block. The same three in the new text, as a
//      control, and the new text no longer says "NOT empty".
{
  const legacyInjected = () => ({ type: 'user', message: { role: 'user', content: LEGACY_REASON_HEAD + 'treat this as a nudge.' } });
  const dir = tempProject(true);
  withLimit(dir, 3);
  const old3 = writeTranscript(dir, [human('do it'), assistantTool(), legacyInjected(), legacyInjected(), legacyInjected(), assistantTool(), busWork()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: true, transcript_path: old3 }));
  assert('103a three 1.9.0 wakes reach limit 3: allowed', r.status === 0 && r.stdout.trim() === '');
  const new3 = writeTranscript(dir, [human('do it'), assistantTool(), injected(), injected(), injected(), assistantTool(), busWork()]);
  const r2 = runHook(dir, JSON.stringify({ stop_hook_active: true, transcript_path: new3 }));
  assert('103b control: three current wakes reach limit 3: allowed', r2.status === 0 && r2.stdout.trim() === '');
  const one = writeTranscript(dir, [human('do it'), busWork(), assistantTool()]);
  const r3 = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: one }));
  let reason = '';
  try {
    reason = JSON.parse(r3.stdout).reason;
  } catch {
    reason = '';
  }
  assert('103c the wake text no longer says "NOT empty"', reason.startsWith(REASON_HEAD) && !reason.includes('NOT empty'));
}

// 105. (1.9.2, task 3765) The 1.9.1 text is legacy too, and the new one is true for mail. Guard 2
//      also wakes on unread posts alone, where "has startable work" was false. Limit 3, three 1.9.1
//      wakes since the operator spoke: the brake must allow the stop, as in 103a. Then a wake whose only
//      trigger is unread posts must mention an unread post and not claim startable work.
//      (104 is taken by the status-line pipe-buffer case.)
{
  const injected191 = () => ({ type: 'user', message: { role: 'user', content: LEGACY_REASON_HEAD_191 + 'treat this as a nudge.' } });
  const dir = tempProject(true);
  withLimit(dir, 3);
  const old3 = writeTranscript(dir, [human('do it'), assistantTool(), injected191(), injected191(), injected191(), assistantTool(), busWork()]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: true, transcript_path: old3 }));
  assert('105a three 1.9.1 wakes reach limit 3: allowed', r.status === 0 && r.stdout.trim() === '');
  const mail = writeTranscript(dir, [human('do it'), assistantTool(), busReading(0, 2, 0)]);
  const r2 = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: mail }));
  let reason = '';
  try {
    reason = JSON.parse(r2.stdout).reason;
  } catch {
    reason = '';
  }
  assert('105b a wake on unread posts alone mentions an unread post, not only startable work',
    r2.status === 0 && reason.includes('unread post') && !reason.includes('has startable work'));
  assert('105c the next items begin with an unread post', reason.includes('next actionable item: an unread post'));
}

// 106. (1.9.3, task 3710, llm-bus task 3459) Since llm-bus decision 093 open_unassigned counts
//      only startable tasks, so task_depend and task_block can lower it. The failure llm-bus reported:
//      the reading is 30, this agent depends an unassigned task (29), someone files a new one (30);
//      "30 then 30" must not read as no new work. A lowering call voids the baseline, so the session
//      wakes. task_answer lowers it too (answering an unassigned decision still to do takes it out of the
//      pool), so it voids as well (106c). task_undepend can only raise the count, so it keeps the
//      baseline (106d).
{
  const dir = tempProject(true);
  const t = writeTranscript(dir, [
    human('do it'), assistantTool(), busToolResult(digest(0, 0, 30)),
    busToolUse('mcp__llm-bus__task_depend'), busToolResult(digest(0, 0, 30)),
  ]);
  const r = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t }));
  assert('106a task_depend between the digests voids the baseline: wakes', r.status === 0 && r.stdout.includes('block'));
  const t2 = writeTranscript(dir, [
    human('do it'), assistantTool(), busToolResult(digest(0, 0, 30)),
    busToolUse('mcp__llm-bus__task_block'), busToolResult(digest(0, 0, 30)),
  ]);
  const r2 = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t2 }));
  assert('106b task_block between the digests voids the baseline: wakes', r2.status === 0 && r2.stdout.includes('block'));
  const t3 = writeTranscript(dir, [
    human('do it'), assistantTool(), busToolResult(digest(0, 0, 30)),
    busToolUse('mcp__llm-bus__task_answer'), busToolResult(digest(0, 0, 30)),
  ]);
  const r3 = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t3 }));
  assert('106c task_answer between the digests voids the baseline: wakes', r3.status === 0 && r3.stdout.includes('block'));
  const t4 = writeTranscript(dir, [
    human('do it'), assistantTool(), busToolResult(digest(0, 0, 30)),
    busToolUse('mcp__llm-bus__task_undepend'), busToolResult(digest(0, 0, 30)),
  ]);
  const r4 = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t4 }));
  assert('106d task_undepend keeps the baseline: a standing backlog does not wake', r4.status === 0 && r4.stdout.trim() === '');
  const t5 = writeTranscript(dir, [
    human('do it'), assistantTool(), busToolResult(digest(0, 0, 30)),
    busToolUse('mcp__claude_ai_LLM_Bus__task_depend'), busToolResult(digest(0, 0, 30)),
  ]);
  const r5 = runHook(dir, JSON.stringify({ stop_hook_active: false, transcript_path: t5 }));
  assert('106e the claude.ai connector name for task_depend voids the baseline too', r5.status === 0 && r5.stdout.includes('block'));
}

// ── 1.10.0 - one repo, two letter-cases (dev-hub P2, ruling 2026-10-15-8) ──────────────────────────
// Two machines' home directories can differ only in letter-case on case-insensitive APFS, so one
// repo can reach the resolver spelled two ways. Runs only where the temp volume proves case-insensitive;
// on a case-sensitive volume the two spellings are two directories and there is nothing to assert.
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bus-mode-case-'));
  const lower = path.join(base, 'Repo-Case');
  fs.mkdirSync(path.join(lower, 'sub'), { recursive: true });
  const upper = path.join(base, 'REPO-CASE');
  let insensitive = false;
  try {
    insensitive = fs.statSync(upper).ino === fs.statSync(lower).ino;
  } catch {
    insensitive = false;
  }
  if (!insensitive) {
    console.log('note: case 107 skipped - ' + os.tmpdir() + ' is on a case-sensitive volume');
  } else {
    const rr = require('./resolve-root.cjs');
    const res = rr.resolveRoot({
      repo: upper,
      cwd: base,
      env: { CLAUDE_PROJECT_DIR: lower, CLAUDE_CONFIG_DIR: path.join(base, 'cfg') },
    });
    assert(
      '107 an upper-cased spelling of the session repo resolves equal (case-insensitive volume): --repo accepted, not refused as another repo',
      rr.realOr(upper) === rr.realOr(lower) && res.root === upper && rr.contains(lower, path.join(upper, 'sub')),
    );
  }
}

console.log('OK: ' + passed + ' cases');
