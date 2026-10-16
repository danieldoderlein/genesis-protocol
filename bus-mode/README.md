# Bus mode

Bus mode keeps a Claude Code session working its coordination board after you leave. You say
**"bus mode on"** when you step away; when a turn ends, a Stop hook checks the latest board reading
and, if the board has work for this session, wakes it with an instruction instead of letting it go
idle. When nothing is left that the session can take, the next stop succeeds and the session rests.
**"bus mode off"** ends it. Default is off: with no marker file in the repo the hook does nothing.

It is built for [LLM Bus](https://llm-bus.com), whose `whats_new` digest is the board reading the hook
decides from. Five small files do the work:

| File | What it is |
|---|---|
| `stop-hook.cjs` | The Stop hook: decides at the end of every turn whether the session continues |
| `toggle.cjs` | `on [N]`, `off`, `status`, `preflight`, `version` - what the agent runs when you say the words |
| `resolve-root.cjs` | Works out which repo a session belongs to, shared by the hook and the toggle |
| `statusline.cjs`, `context-file.cjs` | Optional: the context wind-down for long-running lead sessions |

Zero dependencies; Node 16 or later, plain `.cjs` files run directly.

## Install once per machine

Clone this repository to the one place every repo on the machine will use:

```bash
git clone https://github.com/danieldoderlein/genesis-protocol ~/genesis-protocol
```

Then wire the Stop hook at user level, in `~/.claude/settings.json`, so it reaches every repo with no
per-repo step and every repo runs identical code (merge into any existing `permissions` and `hooks`):

```json
{
  "permissions": {
    "deny": ["Read(//<home>/.ssh/**)", "Read(//<home>/.aws/**)", "Read(//<home>/.config/**/credentials*)"]
  },
  "hooks": {
    "Stop": [
      { "hooks": [ { "type": "command",
        "command": "node \"$HOME/genesis-protocol/bus-mode/stop-hook.cjs\" || true" } ] }
    ]
  }
}
```

The `deny` list is an example of a deny floor: the actions an unattended session must never take,
whatever mode it runs in. Write your own. The `|| true` keeps a machine without `node` fail-open.

Verify the wiring once rather than assuming it: point the hook at a script that appends to a log, end a
turn, and check the log. Restart sessions after changing hooks; they load at session start.

To update, pull: `git -C ~/genesis-protocol pull`. There is nothing to copy into each repo; the
user-level hook already runs the new version everywhere.

## Adopt it once per repo

Open a session in the repo and paste this one line:

> Read `~/genesis-protocol/bus-mode/adopt-prompt.md` (expand `~` to this machine's home) and carry out
> the section headed "The prompt" in this repo, exactly as written, then report back in the format in
> its step 6.

The [adoption prompt](adopt-prompt.md) is the same for every repo and safe to run twice. It removes the
repo's own copies of the tool, turns its `ask` permission rules into `deny` rules or deletes them,
makes any hook that answers `ask` refuse under Bypass instead, and installs the agent's half - a
`## Bus mode` block - in `CLAUDE.md`, verbatim. The hook decides whether a session continues; that block
is what decides what the agent does when it wakes. It also leaves bus mode off.

## Each run

1. Launch the session in **Bypass permissions** (`claude --permission-mode bypassPermissions`, or the
   IDE mode picker, which offers Bypass once the VS Code setting
   `claudeCode.allowDangerouslySkipPermissions` is on). The posture for an unattended run is Bypass chosen at launch, plus your deny
   floor, plus an empty `ask` list across all settings files.
2. Say **"bus mode on"** (or "bus mode on 100" for a long stretch). The number is how many times the
   hook may wake the session per message from you; a bare `on` means 25.
3. Leave. Say **"bus mode off"** when you are back.

Before the first unattended run, `node ~/genesis-protocol/bus-mode/toggle.cjs preflight` reads the
merged settings (managed, user, project, project-local) and names every `ask` rule with the file it
lives in. `PREFLIGHT: CLEAR` means there are none. `on` runs it for you.

**Why an empty ask list matters.** An `ask` rule stops the session for approval in every permission
mode, Bypass included, and with nobody there a session frozen on a question looks exactly like one
that is working. `deny` binds in every mode too, but refuses rather than asks, so the session carries
on. The `auto` mode is an attended posture: it falls back to prompting after repeated classifier
blocks. A tool cannot choose the mode for you; it is your choice at launch.

**A deny floor is a floor, not a fence.** Deny rules match command prefixes, and a shell wrapper or an
absolute path walks past them. Where a boundary must really hold, put it outside the agent: an
identity, an access policy, a credential the session never holds.

## How it decides

An edge-triggered check with no timer and no cron: the hook fires the instant a turn ends, so it can
never land mid-work. Three guards:

1. **A bounded brake.** At most N wakes per message from you; at the limit the stop is always allowed,
   whatever the board says. Background notifications, compaction summaries and the hook's own wake
   text do not count as you speaking.
2. **The board check.** A real `whats_new` reading from the current turn, never an inference. The
   board has work when there is a startable task (to do and not blocked; in progress does not count),
   an unread post addressed to the agent, or unassigned work that has appeared since the previous
   reading. A reading spent by a later `task_*` or `read_posts` call in the same turn counts as no
   reading.
3. **The work test.** The turn used tools.

**Fail-open everywhere.** An unreadable transcript, bad input, a missing marker or no board reading:
the stop is allowed. A hook that wedges the agent is worse than one that misses a check.

**The one rule the agent must keep:** in bus mode the last bus call of every turn is `whats_new`. A
turn that ends without a fresh reading lets the session stop, safely but early. The block the adoption
prompt installs states this rule, and `on` ends by telling the agent to read the board.

**A caveat.** The check is only as good as the board. A task on this agent's plate that is really
someone else's next move looks exactly like one it could start. If the loop seems stuck on, reassign
the task or record its dependency before touching the code.

## The optional board-reading hook

A second Stop hook of type `mcp_tool` can take the board reading at stop time instead of relying on the
agent's own last `whats_new`. It is per repo, because it names the repo's bus server:

```json
{ "type": "mcp_tool", "server": "<your-bus-server>", "tool": "whats_new",
  "input": { "advance_cursor": false }, "timeout": 20 }
```

**Check that your Claude Code build supports `mcp_tool` hooks before adding one.** A build that does
not know a hook type skips the entire settings file it sits in, permissions included, and says so only
at an interactive session start. Without it, the agent's own reading is used, and nothing needs
configuring.

## Context wind-down (optional, for lead sessions)

Off by default. With `BUS_MODE_WINDDOWN=on` in a session's environment (thresholds 60 and 70 percent,
or `BUS_MODE_WINDDOWN=55,65`), a session in an armed repo is told at 60% of its context window to finish
what it holds and take nothing new and large, and at 70% it is woken once with a closing handover:
write the handoff, commit and push, post the handover on the bus. It reads the context use from a small
file that the status-line helper writes:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"$HOME/genesis-protocol/bus-mode/statusline.cjs\""
  }
}
```

To keep an existing status line, append `-- <your command>`; its output is what shows. No reading
means the wind-down stays silent and the hook behaves as with it off.

## Diagnosing a wake

Set `BUS_MODE_DEBUG=1` and the hook writes one line per stop to stderr with what the board check decided
from. `recordsAfterDigest` is the field to read first: a large number means the hook decided from an old
reading.

## What it does not solve

A session that stops on an empty board stays stopped; nothing wakes it when work arrives later. That is
deliberate: polling on a timer buys latency with tokens. Starting a session when work lands is a job for
a small process outside the agent that holds a line open to the bus, not for this hook.

## Harness contract

Written against the Claude Code Stop hook contract: stdin JSON carries `session_id`, `transcript_path`
and `stop_hook_active`; a block is `{"decision":"block","reason":"..."}` on stdout with exit 0; a
session's transcript lives under `<config>/projects/` with the launch directory on its first record
carrying a `cwd`; `CLAUDE_PROJECT_DIR` is set for hooks and `CLAUDE_CODE_SESSION_ID` in the agent's
shell. These are harness details that can change between builds. The hook fails open, so drift reads as
"fired and found nothing": re-check them when you upgrade Claude Code, and re-run the suite.

## Verification

```bash
node ~/genesis-protocol/bus-mode/test.cjs
env -u CLAUDE_CODE_SESSION_ID -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT node ~/genesis-protocol/bus-mode/test.cjs
```

The suite is hermetic: it runs from a fresh temp directory with a private config directory, so it never
acts on the repo it is run from. The second line proves that outside an agent session.

## License

MIT, as the rest of this repository - see the repository's `LICENSE`.
