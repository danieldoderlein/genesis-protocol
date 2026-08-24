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
| [claude-code.md](claude-code.md) | Claude Code (Anthropic) projects | v1.7 |
| [antigravity.md](antigravity.md) | Antigravity (Google) projects | v4.5 |
| [commercialization.md](commercialization.md) | Marketing and commercialization work, on the same substrate | v0.9 |

**What's new in v1.7 (and its marketing mirror, v0.9): the lean harness.** Field measurement
across production projects showed the always-loaded rule files these protocols generate tend to
grow until agents start ignoring them. v1.7 turns that finding into method: an attention budget
with a mechanically checked line ceiling; one rule, one home (no restating); incident lessons kept
as short tagged rules with the story in a decision file; a capability discipline that stops rules
from mandating tools that no longer exist; and test-then-delete measurement, so every removal is
an experiment with a recorded result rather than deletion on faith. Coordination is rewritten on
the LLM Bus v2 task graph with an autonomous board-is-the-loop model: agents check the shared
board at the natural boundaries of their work - no polling, no cron timers.

## Quick start

Bootstrapping a new project: open the protocol that matches your agent, copy its full contents,
paste it as the first message of a fresh session, and answer the discovery interview. The agent
scaffolds a compliant, drift-resistant environment for you.

## Upgrading an existing project

Already running a project bootstrapped on an earlier version? Two upgrade (migration) prompts
bring a live workspace forward in place - code, decisions, and local rules survive:

- [claude-code-upgrade.md](claude-code-upgrade.md) - entry paths from v1.3 through v1.6
- [commercialization-upgrade.md](commercialization-upgrade.md) - entry paths from v0.4 through v0.8

Paste the upgrade prompt to the agent that operates the workspace, and provide the current
protocol text alongside it. The core operation is compression of your always-loaded rules, not
addition - and every removal is recorded, so the upgrade is measurable and reversible. Projects
older than the entry paths are best re-bootstrapped from the current protocol file.

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
