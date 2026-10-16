# The bus-mode adoption prompt (one paste per repo)

Every repo gets the same prompt, and nothing in it is adapted per repo. It is safe to run twice. HUMAN
pastes this one line into a session opened in the repo:

> Read `~/genesis-protocol/bus-mode/adopt-prompt.md` (expand `~` to this machine's
> home) and carry out the section headed "The prompt" in this repo, exactly as written, then report back
> in the format in its step 6.

## For HUMAN (not part of the prompt)

**The prompt adds no tool to the repo.** The Stop hook is one entry in `~/.claude/settings.json` pointing
at the shared copy, so the current version already runs in every repo on this machine. The prompt stops
each repo contradicting that setup: its own copies of the tool, its own `ask` rules and ask-answering
hooks, its own bus-mode prose. Repos differ in how they record and merge changes, so some reports will
list a change as waiting on HUMAN: that is the prompt declining to answer a decision that is HUMAN's.

**Running bus mode after adoption:**

1. In VS Code, pick **Bypass permissions** in the mode picker (offered once the setting
   `claudeCode.allowDangerouslySkipPermissions` is on).
2. Say **"bus mode on"**. A bare "on" allows 25 wakes per message from HUMAN; for a night, say
   **"bus mode on 100"**.
3. Leave. The session works the board and stops by itself when nothing is left that it can take.
4. **"bus mode off"** ends it.

A repo whose own hook asks before the toggle runs (some do) shows one approval prompt at
step 2 or 4, even under Bypass, which HUMAN is there to answer (measured 2026-10-14, VS Code
extension 2.1.296; an earlier build showed no prompt on 2026-10-09). If it refuses instead, run `node ~/genesis-protocol/bus-mode/toggle.cjs on --repo <that repo's path>`
(or `off`) from a terminal. In Auto or Manual the loop still runs, but whatever those modes ask about
waits for HUMAN, and every wake-up then carries a POSTURE WARNING, which the agent passes on.

**The cost:** an `ask` rule turned
into a `deny` (step 3a), and a `--settings` deny carried into the always-loaded settings (step 2c),
refuse that action in attended sessions too, with no way to approve it on the spot. Lifting one means
editing that repo's settings.

**What can still end a night early:** nothing left on the board that the session can take (correct); the wake limit; an API error or a
rate or usage limit (the harness documents those as a separate `StopFailure` event rather than a
`Stop`, so the Stop hook most likely gets no chance to wake the session - inferred from the
documentation, not yet measured); and anything outside this setup, such as an MCP server that asks for
input.

**Field report:** after a run, paste the prompt in the last section of this file into the same session.
It answers in a fixed format the tool's maintainer can diagnose from.

---

## The prompt

**Adopt the one bus-mode setup in THIS repo. Every repo gets these same steps; do not adapt them.**

Bus mode means: once HUMAN says "bus mode on", this session keeps working its board, with nobody
present, until nothing on it is left for the session, instead of stopping at the end of every turn. Three things have
broken that on a measured rig: a copy of the tool that differs from the shared one; anything in settings
or hooks that asks for approval, because unattended a question is a freeze; and an agent that ends its
turn on a spent board reading. Steps 2 and 3 remove the first two from this repo; step 4 installs the
rule for the third.

**Scope.** THIS repo is the directory this session was launched from, with its own `.claude/` files. A
nested repo with its own `.claude/` directory is a separate repo: list it in the report, and it gets its
own paste. Change nothing outside this repo: `~/.claude/settings.json` and every other user-level file
are HUMAN's, so report what is found there and leave it.

**Process.** This prompt says WHAT to change. HOW the change is made and recorded follows this repo's
own rules: its plan item, decision record or dated note, the reviews
and the verification it requires. Commit on a branch and merge it the way this repo normally merges
(its git rules; if it has none, what its history shows). Do not stage, stash or revert anyone's
uncommitted work. Never answer a decision assigned to HUMAN, even one this change would settle: commit
only that part on a branch of its own, never leave that branch checked out, merge the rest as usual,
and list the held part under "waiting on HUMAN" in the report. When done, return the working tree to
the branch it started on, and make sure that branch contains the adoption (step 5): a checked-out
branch is live - hooks and CLAUDE.md are read from the working tree - so an adoption merged into main
does nothing for a session that is on a branch without it. If returning would touch someone's
uncommitted work, stay where it is and say so in the report. Never
add or change a permission mode (`defaultMode`) in any settings file; the mode is HUMAN's choice at
launch.

### 1. Check the shared install (read-only)

Run these three and keep the output for the report:

    node ~/genesis-protocol/bus-mode/toggle.cjs version
    node ~/genesis-protocol/bus-mode/toggle.cjs status
    node ~/genesis-protocol/bus-mode/toggle.cjs preflight

Then confirm the user-level Stop hook points at that copy:

    grep -c "genesis-protocol/bus-mode/stop-hook.cjs" ~/.claude/settings.json

- `version` must print `1.10.0` or later, and the `grep` must print `1` or more.
- `status` must print a `repo:` line naming the directory this session was launched from. If it prints
  `UNKNOWN`, has no `repo:` line, or names any other directory, stop here and report that output:
  nothing else in this prompt is safe to do then.
- If `status` prints `bus mode: on`, run the `off` command from step 5 now, before changing anything:
  an armed repo can wake this session onto board work before the adoption is finished.
- If `~/genesis-protocol` does not exist in this machine's home, this machine has no
  shared install. Stop and report.

### 2. Remove this repo's own variants of the tool

a. **Project-level Stop hooks.** In `.claude/settings.json` and `.claude/settings.local.json`, remove
every Stop hook of `"type": "command"` that runs a bus-mode or auto-mode stop hook, and any Stop command
that can exit 2. The shared hook already runs in this repo, so a project copy either runs it twice or
runs an older version in front of it. KEEP a Stop hook of `"type": "mcp_tool"` that calls `whats_new`:
that is a board reading, not a copy of the tool. KEEP hooks that only `echo`.

b. **A local `tools/bus-mode/` directory.**
   - Keep it ONLY if this repo's own records say the repo is also worked on from a machine that does not
     have the shared copy of the tool. Then make it identical to the shared copy: copy every file from
     `~/genesis-protocol/bus-mode/` into it and remove any file the shared copy
     does not have. Prove it: `diff -r ~/genesis-protocol/bus-mode tools/bus-mode`
     prints nothing, `node tools/bus-mode/test.cjs` passes, and this repo's own lint and checks pass. If
     one of them fails on the shared copy's files, do not edit the files; report it, and the shared copy is fixed at its source.
   - With no such record, delete the directory.
   - Either way, remove live references to a local copy that no longer exists (in settings, scripts and
     CLAUDE.md); decision records stay as they are.

c. **Settings files loaded only with `--settings`** (such as `.claude/unattended.settings.json`). Bus mode
no longer uses one: its unattended posture is Bypass, chosen by HUMAN at launch, over this repo's
always-loaded settings - so a `deny` that lives only in such a file protects nothing in a bus-mode run.
Copy every `deny` rule found only there into `.claude/settings.json` - except one that this repo's own
records deliberately allow when HUMAN is present (a ruling, a decision, or an ask rule deleted on
purpose rather than converted): hold that one back, and list it under "waiting on HUMAN" with its
record. Sort every `ask` rule found only there as in step 3a. Leave the file itself, its allow rules and its mode as they are: they are
inert unless a session is launched with it. Correct every instruction in this repo - CLAUDE.md, docs,
comments in that file - that tells a session to launch bus mode with `--settings`.

### 3. Make this repo freeze-free

Measured on one rig, each against a control: an `ask` permission rule stops the session for
approval in EVERY mode, Bypass included (2026-09-08); and a PreToolUse hook that answers
`"permissionDecision": "ask"` stopped the tool under Bypass too (2026-09-12, in print mode, where it
shows as a refusal; in an interactive session it is an approval prompt, measured 2026-10-14 in the
VS Code extension 2.1.296 under Bypass, where an earlier build showed none). Unattended,
either one is a question nobody is there to answer, and a session frozen on one looks exactly like one
that is working. `deny` also binds in every mode, but it refuses rather than asks, so the session
carries on.

a. **Empty this repo's `ask` lists** in `.claude/settings.json` and `.claude/settings.local.json`.
   Decide each rule removed:
   - **must never run unattended** (money, production, credentials, destructive, identity, admin-class
     MCP tools): add it to `deny` with the same pattern;
   - **routine work this repo does all the time**: delete it;
   - **not sure**: add it to `deny`, and list it in the report for HUMAN to confirm. A wrong `deny`
     costs a refusal that gets filed as a task; a wrong deletion lets it run unwatched at 03:00.

   Keep every existing `deny` entry.

b. **Hooks that answer `ask`.** Read every PreToolUse hook in this repo's settings and the script each
   one runs. For every case in which a script can answer `"permissionDecision": "ask"`, ask who starts
   that action:
   - **AGENT, while working** (a command on a shared server, a write to `.env`, anything not run on
     HUMAN's spoken instruction): make the script answer `"deny"` instead when the `permission_mode`
     field of its stdin JSON is `bypassPermissions` or `dontAsk`, and keep `ask` in every other mode.
     Reword that deny's reason so it says to file a task and take the next item, not to stop.
   - **HUMAN, by speaking** - the bus-mode toggle itself is the case that matters: leave it `ask`. It
     runs only when HUMAN has just said the words and is there to answer; a `deny` would lock HUMAN out
     of bus mode too.

   Where the script cannot read the mode (unparseable input), keep its current answer. Prove the
   result: feed each hook a PreToolUse payload for the block's own `on`, `on 100`, `off` and
   `status` commands (step 4) with `"permission_mode": "bypassPermissions"`, before and after the
   change; its answers to those four must not change. Run the hook's own tests, and add a case for every new branch.

c. **Re-run the `preflight`.** This repo's own rows must show no ask rules. If the verdict is still not
   `PREFLIGHT: CLEAR` because of a user-level or managed file, name the rules and the file in the
   report and leave them alone.

### 4. Install the bus-mode block in CLAUDE.md, verbatim

Put the block below into CLAUDE.md, copied exactly: in place of this repo's `## Bus mode` section, or as
a new section if there is none. Then, elsewhere in CLAUDE.md and in this repo's docs, remove or correct
only what disagrees with the block: other phrase lists for the controls, other toggle paths or
continuation counts, instructions to launch bus mode with `--settings`, instructions to put a bus-mode
hook in the repo, and claims about the shared install or user-level settings that step 1 contradicts
(such as a count of user-level ask rules). Keep everything else, including this repo's permission and
deny-floor prose, its general board rules, and any rule that makes switching bus mode on HUMAN's call
alone. Where such a rule says to stop after filing a question, leave it: the block already says what
holds in bus mode.

The block's home-relative path is deliberate even where this repo prefers repo-relative paths or
variables: there is one shared install per machine, at the same home-relative path on every machine, and
the block says what a machine without it does.

Directly below the block, and never inside it, this repo may keep one paragraph headed
`Local to this repo:` holding only: other words HUMAN uses in this repo for these controls, links to
this repo's own decisions on bus mode, and - for a repo that keeps a synced copy - how the other
machine's user-level hook is wired.

If CLAUDE.md has a size limit and the block pushes it over, do not trim the block and do not raise the
limit: shorten this repo's other prose if its rules allow that, otherwise hold the whole adoption as the
Process paragraph says, and report it. Then make sure `.gitignore` covers `.claude/bus-mode.on` and `.claude/auto-mode.on`.

```markdown
## Bus mode

When HUMAN turns bus mode on, this session keeps working its board until nothing on it is left for this session instead of stopping at the end of each turn: a Stop hook checks the latest board reading when a turn ends and, if the board has work for this session (a startable task: to do and not blocked, an item already in progress does not count; an unread post addressed to it; or unassigned work that has appeared since its last reading), wakes this session with an instruction. A wake is never a speculative nudge; the board was read and had work.
- **Controls.** "bus mode on", "start bus mode" or "go into bus mode": AGENT runs `node ~/genesis-protocol/bus-mode/toggle.cjs on`, adding HUMAN's number if one was given (`on 100`: the wakes allowed per message from HUMAN; a bare `on` means 25). "bus mode off", "stop bus mode" or "exit bus mode": the same command with `off`; "bus mode status": with `status`. AGENT runs it exactly so, from any directory: it acts on the repo this session was launched from. On a machine without that path, the same commands run against the synced copy in this repo's `tools/bus-mode/` directory. AGENT never edits the marker by hand, never passes `--repo` unless the toggle has refused and HUMAN has named the directory, never adds a project-level Stop hook, and never creates or edits a local copy of the tool; a repo that keeps one for another machine only re-syncs it from the shared install.
- **The rule that keeps it running.** In bus mode the last bus call of every turn is `whats_new`. The hook decides the next wake from the latest reading, and a `task_*` or `read_posts` call after it spends that reading, which can let the session stop with work still on the board. The turn that switched bus mode on usually has no reading at all: right after `on`, AGENT calls `whats_new` and takes the next item.
- **Each turn.** AGENT takes the next actionable item (an unread post, an item assigned to AGENT, or one unassigned and in bounds); reassigns an item that is really someone else's move to whoever owes it, so a plate of other people's work does not keep the loop awake; and files what it cannot finish now as a bus task before moving on - owned by AGENT if AGENT will do it later, by the named person if they must, unassigned if anyone could. A finding left only in a transcript is lost when the session ends.
- **Never wait on HUMAN.** No `AskUserQuestion`: it prompts even under Bypass, and with nobody present that is a dead session that looks like a working one. A refusal from a permission check, and a question only HUMAN can answer, each become a bus task - a question as a decision task with options, assigned to HUMAN, citing this repo's open-item number where it keeps a ledger. AGENT never retries or routes around a refusal, and then takes the next item. In bus mode this holds over any rule in this file that says to stop after filing such a task.
- **A posture warning.** A wake-up carrying `POSTURE WARNING` means this session is not in Bypass, so a permission prompt can stop it: AGENT says so in the end-of-turn summary.
- **Stop when nothing is left that this session can take,** as the final `whats_new` shows. When the only thing left waits on a person, AGENT reassigns it to that person, says so once in the end-of-turn summary and suggests "bus mode off"; AGENT never invents work to stay awake.
```

### 5. Leave bus mode OFF, then verify

Run `node ~/genesis-protocol/bus-mode/toggle.cjs off`. If this repo's own
hook asks before the toggle runs, that is expected (step 3b): HUMAN is present and answers it. Keep the
output: the repo starts from a known state, and HUMAN arms it. If the output lists repos armed
elsewhere, leave them alone; each is disarmed from its own session.

Then run the verification this repo's rules name (if they name none, say so), and commit and merge as
the Process paragraph says.

Last, prove the adoption is live. On the branch the working tree ends on,
`git merge-base --is-ancestor <the merged adoption commit> HEAD` must succeed. If that branch lacks the
adoption (the session started on a feature branch and returned to it), merge the repo's main line into
it when this repo's rules let AGENT do that. If they do not, or the branch is someone else's work in
progress, leave it and list it under "waiting on HUMAN": until it takes the adoption, every session on
that branch runs the old setup.

### 6. Report back in exactly this format

```
BUS-MODE ADOPTION - <repo>
shared install: toggle <version>; user Stop hook -> shared copy: <grep count>; repo line: <as printed>
preflight: before <verdict> | after <verdict>
project Stop hooks: removed <list, or none>; kept <list, or none>
local tools/bus-mode: none | deleted | synced (record: <where it says so>; lint and checks: pass | fail <what>)
stale references removed: <list, or none>
--settings files: <file: denies carried over <n>; held for HUMAN <list>; asks sorted <n>; launch instructions corrected> | none
ask rules: <n> found; to deny <list>; deleted <list>; HUMAN to confirm <list>
hooks answering ask: <file: cases now deny under bypass; cases left ask, and why; on/on 100/off/status answers unchanged: yes | no; tests added> | none
CLAUDE.md: block installed (replaced | added); "Local to this repo" kept: <what, or nothing>; lines <n> against limits <warn>/<fail>, or no limit
other docs corrected: <list, or none>
.gitignore: already covered | added
bus mode at the end: <the first line `off` printed>
verification: <what this repo's rules name> pass | fail | none named; <branch> @ <sha>; merged yes | no (<why>)
live on the checked-out branch: yes (<branch>) | no (<branch>: listed under waiting on HUMAN)
waiting on HUMAN: <each item: its decision or open item, and the branch @ sha holding it> | none
nested repos not covered: <list, or none>
outside this repo, found and not touched: <list, or none>
```

---

## The field report prompt (paste after a run)

> Bus-mode field report. From this session's own history, answer in exactly this format. Facts only;
> write "unknown" wherever the history cannot tell.
>
> ```
> BUS-MODE FIELD REPORT - <repo>
> permission mode: bypass, or not reported (no wake carried a POSTURE WARNING) | <the mode a warning named> | unknown (no wakes)
> "bus mode on": <time>, limit <n>; "bus mode off": <time> | not said
> wakes by the Stop hook: <count of messages containing "Bus mode is on, and your board">
> tasks: shipped <ids>; filed <ids>; reassigned <ids>
> prompts or refusals met: <each: tool, command or path, the rule or hook that answered, whether anyone answered> | none
> the last stop: nothing left to take | wake limit | a turn ended on a spent reading (a task or read_posts call after the last whats_new) | error | unknown; the last whats_new showed <summary>
> compacted during the run: yes | no; kept going after: yes | no | n/a
> anything that looked like the loop ignoring the board: <describe> | none
> ```
