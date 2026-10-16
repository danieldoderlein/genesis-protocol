# Genesis Protocol

Open protocols that turn a blank repo into a disciplined, drift-resistant project for AI coding
agents. A Genesis Protocol is a prompt you give an agent before any code exists: it acts as a
solutions architect and walks a structured setup - a discovery interview, scaffolding, the four
core documents that hold the project together, behavioral rules, and the review and verification
loop that keeps a long-running project from drifting.

The jump to working at 10x is not a bigger model. It is a way of working. These are the protocols
we use to build our own software, opened up so you can use them too.

## The protocols

| Protocol | For | Current |
|----------|-----|---------|
| [claude-code.md](claude-code.md) | Claude Code (Anthropic) projects | v1.13 |
| [antigravity.md](antigravity.md) | Antigravity (Google) projects | v4.5 |
| [commercialization.md](commercialization.md) | Marketing and commercialization work, on the same substrate | v0.9 |

And one tool: [bus-mode/](bus-mode/README.md), which keeps a Claude Code session working its
coordination board after you leave (see "Bus mode" below).

**What's new in Claude Code since v1.7.** Six versions of field use on our own projects, folded in:

- **An unattended posture that does not freeze.** An `ask` permission rule stops the session for
  approval in every permission mode, Bypass included, so a session left running carries no `ask`
  rules anywhere in its merged settings. Unattended means Bypass chosen at launch plus a mandatory
  deny floor derived from what the machine can reach; `auto` is the attended posture, because it
  falls back to prompting. A tool cannot set the mode for you, and the agent never asks a question
  nobody is there to answer: it files a decision task instead.
- **Load proofs.** A settings file with an error is skipped whole, and the protocol says how to prove
  your settings actually loaded, against the build you have installed.
- **The lead and its helpers.** One lead session per project runs the reviews and checks every
  helper's "done"; helpers get a five-part brief and return a file plus five lines; model choice is
  made by kind of work and named by tier, never by model version. One project, one repo, with a
  stage question (shaping, building, commercial) and a conditional commercial section.
- **One handover shape.** A dated handoff block at the top of PLAN.md, written on clear triggers, so
  any session can pick the work up.
- **Coordination.** Section 13 points at the LLM Bus's own live `guide()` for mechanics instead of
  restating them, and an answer the operator gives in a session is recorded on the bus as theirs.
- **Machines and identity.** Every project names one home machine (a workstation or an always-on
  hub) where its agents live; collaborators work from any other clone as themselves; the start
  interview settles the identities (repo owner, git author, cloud and service accounts) and pins them
  per project.
- **Unattended chains.** A step handed to an agent needs that agent's wake test on record, passed only
  when the woken session actually performed the step, or a deadline that escalates to the operator.

## Correction: commercialization v0.9 and ask rules

`commercialization.md` (v0.9) says, in section 13's permission split, to put identity-class bus admin
tools (provisioning, revocation, rotation, invites, sequence seeding) "on ask, never deny", because an
ask "never fires unattended". That is wrong. Measured on Claude Code: an `ask` rule blocks in every
permission mode, `bypassPermissions` included, so an unattended session that reaches one stops and
waits for an answer nobody gives.

The correct rule:

- A session that runs unattended carries zero `ask` rules across its merged settings (managed, user,
  project and local).
- Put identity-class tools on `deny`. A deny binds in every mode and protects without asking; the
  operator lifts it deliberately, in an attended session, when the action is wanted.
- Attended sessions may keep `ask` rules where a person is present to answer them.

`claude-code.md` v1.13 carries this rule in its text. For commercialization v0.9, apply it when you
bootstrap or upgrade a project.

## Quick start

Bootstrapping a new project: open the protocol that matches your agent, copy its full contents,
paste it as the first message of a fresh session, and answer the discovery interview. The agent
scaffolds a compliant, drift-resistant environment for you.

## Upgrading an existing project

Already running a project bootstrapped on an earlier version? The upgrade (migration) prompts bring a
live workspace forward in place - code, decisions, and local rules survive:

- [claude-code-upgrade.md](claude-code-upgrade.md) - for workspaces on v1.8 through v1.12, straight to v1.13
- [commercialization-upgrade.md](commercialization-upgrade.md) - entry paths from v0.4 through v0.8 (unchanged)

Paste the upgrade prompt to the agent that operates the workspace, and provide the current protocol
text alongside it. Every change is recorded, so the upgrade is measurable and reversible.

**On v1.7 or older (including the previous public release)?** There is no in-place upgrade from here:
re-bootstrap from the current [claude-code.md](claude-code.md), carrying your decisions and PLAN
forward. The same holds for commercialization projects older than v0.4.

## Bus mode

[bus-mode/](bus-mode/README.md) is a small, zero-dependency Stop hook with a spoken toggle. Say "bus
mode on" when you leave a session: whenever a turn ends and the [LLM Bus](https://llm-bus.com) board
has work for that session, the hook wakes it instead of letting it go idle, and the session rests when
nothing is left that it can take. Install it once per machine by cloning this repository to
`~/genesis-protocol` and pointing one user-level Stop hook at `~/genesis-protocol/bus-mode/`; each repo
then adopts it with one pasted line. Its README has the install, the adoption prompt and the posture
an unattended run needs.

## The circularity loop

The heart of every Genesis Protocol is four documents that form a closed system: `README.md`,
`PLAN.md`, `docs/architecture.md`, and `docs/decisions/`. Every change traces to PLAN.md; every
architectural change is recorded in `docs/decisions/` and reflected in `architecture.md`; every
user-facing change updates README.md. No document may contradict another. That is the primary
drift-prevention mechanism: the agent cannot wander, because the documents keep each other honest.

## And then you need coordination

A single agent improvising is the floor. The moment you run more than one agent, or more than one
person each driving agents, they start to collide and re-derive each other's context, and you become
the bridge between them. That is the wall these protocols carry you to.

[LLM Bus](https://llm-bus.com) is the live coordination layer that removes it - atomic work-claiming,
a shared event ledger, decisions as answerable tasks on a task graph, presence, and an attributable
handoff channel, all over MCP, so your agents coordinate instead of colliding. It is open source
(AGPL-3.0) and self-hostable. The Claude Code and Commercialization protocols here wire it in
directly.

## License

MIT - see [LICENSE](LICENSE). Use them, adapt them, ship with them.

Created by Daniel R. Doderlein / DRD AS.
