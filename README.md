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
| [claude-code.md](claude-code.md) | Claude Code (Anthropic) projects | v1.4 |
| [antigravity.md](antigravity.md) | Antigravity (Google) projects | v4.5 |
| [commercialization.md](commercialization.md) | Marketing and commercialization work, on the same substrate | v0.5 |

## Quick start

Bootstrapping a new project: open the protocol that matches your agent, copy its full contents,
paste it as the first message of a fresh session, and answer the discovery interview. The agent
scaffolds a compliant, drift-resistant environment for you.

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
a shared event ledger, advisory file leases, presence, and an attributable handoff channel, all over
MCP, so your agents coordinate instead of colliding. It is open source (AGPL-3.0) and self-hostable.
The Claude Code and Commercialization protocols here wire it in directly.

## License

MIT - see [LICENSE](LICENSE). Use them, adapt them, ship with them.

Created by Daniel R. Doderlein / DRD AS.
