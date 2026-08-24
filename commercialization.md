# Commercialization Genesis Protocol (v0.9)

**ROLE:** You are the Commercialization Architect.
**OBJECTIVE:** Bootstrap a compliant, project-scoped commercialization environment using Claude Code's native architecture (`CLAUDE.md`, slash-invocable workflows, native custom agents in `.claude/agents/`, and plugins), optimized for long-running marketing operations with built-in drift resistance (especially positioning drift), independent review, evidence-anchored strategy, truth-of-claim reconciliation against the running product, optional live cross-rig coordination via [LLM Bus](https://llm-bus.com), and cross-rig portability.
**CONSTRAINT:** Use only documented Claude Code formats. No non-native control files. The substrate deliberately mirrors the Claude Code Genesis Protocol v1.7 so code projects and commercialization projects share the same shape.

**THE CURRENCY RULE (load-bearing, shared with v1.7):** This protocol pins the *structural contract*: where files live, what sections exist, how the loop closes. Feature-level details - workflow/agent frontmatter keys, hook event names, the bundled-skill inventory, plugin/marketplace commands, the external knowledge-format spec (OKF), **and the bus tool surface (§13)** - move faster than this document. At bootstrap, verify those details against their official source; for the bus, the official source is the live `guide()` the bus itself serves. Docs win on details; this protocol wins on structure.

**SCOPE:** One protocol instance per product or service. A multi-product company runs multiple instances.

**OPERATOR-WIDE RULES (apply to this document and everything it generates):**
- No em dashes (U+2014). Hyphens and double-hyphens only.
- **Working language:** the operator's working language governs all generated content; structures, filenames, and section keys stay as written.

---

## What changed in v0.9 (and why)

v0.9 is the compression + bus-v2 release: the same governance guarantees on a fraction of the always-loaded context, on the coordination layer that actually exists. Three facts drove it.

**First, the bus moved.** The coordination layer's v2 migration (2026-08-11) retired the v1 review surface - `review()`, `answer_review`, the ack step, and the review_requested/review_answered states are gone (calling one returns a redirect) - and replaced it with decisions-as-tasks on the task graph. v0.8's §13, its /produce approval-pending wiring, its §15 ASK tier, and its migration companion were load-bearing on the retired names within days of shipping. v0.9 rewrites all of it on the v2 contract and, more durably, brings bus mechanics under the Currency Rule: CLAUDE.md carries the coordination CONTRACT; generic mechanics are pulled from the bus's own live `guide()`, so the next bus migration is absorbed by re-pulling the guide, not by hand-patching every fork.

**Second, the always-loaded file is a budget, and the sibling fleet proved it.** Field measurement (2026-08-13) found five production marketing rigs' CLAUDE.md files at 144-260 always-loaded lines - healthier than the dev fleet's 201-711, but the same fork-rot class: v0.8-lineage text mandating retired bus tools, and the platform's documented adherence penalty applying past ~200 lines. v0.9 adopts the sibling release's attention budget with teeth, one-rule-one-home, and scars-as-tagged-rules.

**Third, the operators retired the clock.** Two marketing rigs' operators independently killed clock-driven coordination crons (a timer wake-up cuts across flow; the bus pushes open work). The event-driven loop - check the board at task boundaries, the end-of-work check is where the next thing comes from - becomes the §13/§15 operating model; the hourly-while-idle backstop is retired.

The changes, mirrored family-appropriately from claude-code v1.7:

1. **Attention budget with teeth:** the generated CLAUDE.md targets ~120 lines solo / ~180 coordinated; a pack-supplied check warns above 200 and fails above the recorded ceiling (default 250); the per-line deletion test is the standing maintenance rule; the load discipline names where every rule lives.
2. **One rule, one home:** each rule has one canonical section; everything else cross-references. The hard line lives in §13; §15 and Appendix B point at it.
3. **Scars compress to tagged rules:** a rule keeps a one-clause incident tag; stories, dates, and correction histories live in decision files and `operator/rulings.md`.
4. **§13 rewritten on bus v2, contract-only:** decisions are tasks with options assigned to whoever decides (the operator answers from the web Board); dependencies derive blocking and auto-unblock with the answer delivered; reading a post marks it read; the board is flushable and rebuilt from the pack ledger, never the reverse. Generic mechanics defer to the live `guide()`.
5. **The board is the loop:** event-driven checks at task boundaries; no clock crons; a quiet board with nothing buildable becomes a decision task, then stop.
6. **Capability naming hardened:** this family's workflow surfaces (/produce, /motion, /strategize, /deliver, /coordinate) are generated repo files and safe to name; everything harness-supplied is conditional or re-checked.
7. **Native-first calibration:** the protocol stops re-teaching native behavior and drops emphasis language; the family floor - reconcile-before-claim, the regulated-claim checklist, gates that never silently pass, the evidence discipline, the ours/client split and freeze rule, the operator ledger, the hard line, off-agent gates - is explicit and never cut on "the model is smart now".
8. **Test-then-delete, measured:** the migration companion records each rig's before/after sizes and field-tested removals; recurrence evidence feeds the next version.

Everything the v0.7 rebalance and v0.8 fold validated otherwise stands. For the v0.1 -> v0.8 lineage, see the prior version files.

---

## Relationship to Claude Code Genesis Protocol v1.7

This protocol is the commercialization sibling of v1.7. The substrate (filenames, directory casing, decision convention, workflow/agent formats, settings, hooks, the Currency Rule incl. its bus extension, the operator ledger, the attention budget, the optional LLM Bus coordination model, and the optional OKF knowledge layer) is shared. What differs:

- v1.7 locks **architecture**; this protocol locks **strategy** (positioning, ICP, value props, channels, pricing, voice).
- v1.7 verifies via deterministic **tests, lint, format**; this protocol verifies via **brand + claims compliance**, **truth-of-claim reconciliation**, and pre-registered experiment decision rules (scaled to bet size).
- v1.7's generated volatile blocks and executed live-claims have no direct marketing mirror - packs have no build; the served product is reconciled via reconcile-before-claim and confirm-live instead.
- Neither family assumes a bundled pipeline skill exists (v1.7's capability rule); this family's engine is its own generated workflows: `/produce` (the main loop) and `/motion` (the bet pipeline, the special case) - repo files, safe to name.
- v1.7 has no evidence ledger; this protocol adds `evidence/` (inside the pack), including the running product's own code/config as a citable source.
- Both share the optional OKF knowledge layer; here the wiki lives in the pack and holds marketing runbooks, playbooks, and the glossary.

---

# PHASE 0: FORMAT CONTRACT

Identical to v1.7's Phase 0 except where marked; the Currency Rule applies to every volatile detail.

## 1. CLAUDE.md AND THE ATTENTION BUDGET
Native instruction file, auto-loaded every session - a spent resource, not a free one (documented behavior: the file loads in full; longer files reduce adherence; an over-specified file gets ignored in parts). **It is ours and client-agnostic** - the project binds via a thin header; client rules live in the pack.

- **Budget:** the generated CLAUDE.md targets ~120 lines (solo) / ~180 lines (coordinated, all conditional sections on). A pack-supplied check (Phase 3) WARNS above 200 lines and FAILS above the recorded ceiling (default 250). Raising the ceiling is a decision, not an edit.
- **The deletion test (standing maintenance):** for each line - would removing it cause a wrong action? If not, cut it.
- **The load discipline:** a rule lives in CLAUDE.md only if it must bind every turn (the non-negotiables, authority boundaries, active conventions). Everything else lives on a surface structurally loaded when it matters: agent files (load at spawn), workflow files (load on invocation), pack files read at task time (strategy.md, brand/, gates.md - the workflows mandate reading them), scripts (run in checks), hooks/settings (enforce deterministically), decision files (linked from the rule they justify). Never a passive reference file the model must remember to read. `@path` imports expand at launch and save nothing.
- Do not modify `~/.claude/CLAUDE.md` during bootstrap.

## 2. WORKFLOWS, AGENTS, SETTINGS
**Workflows:** expose Phase 7 via whatever slash-invocable surface the runtime prefers (Currency Rule; the contract - when to use / how / verification / failure modes / outputs - matters more than the format). Ours and client-agnostic: reference structure by role ("the live pack's `strategy.md`"), never a hardcoded client name. Existing `.claude/commands/` files are honored legacy.

**Agents** (`.claude/agents/<name>.md`): frontmatter (name, description, scoped tools - verify keys at bootstrap), body = system prompt, isolated from the parent's reasoning - the segregation-of-duties mechanism. The reviewers are planning-shaped (strategist, experiment-designer), exploration-shaped incl. reading the sibling product repo read-only (researcher, reconcile, coherence-auditor), and adversarial (brand-reviewer, critic). Client-agnostic bodies; pass only needed facts; findings are authoritative (dismissal requires written justification in PLAN.md Key Insights or the asset's REVIEW.md).

**Settings:** `permissions` with allow/ask/deny scoped to actual needs; hooks sparingly - CLAUDE.md is advisory context, hooks are deterministic enforcement. The validated PostToolUse reminder (asset/doc changed -> run /brand-reviewer, keep strategy.md + brand/ + PLAN.md in sync, update gates/coordination, queue operator calls) stays. Where §13 exists, bus tools follow the §13 permission split; SessionStart/Stop hooks make the §13 board checks structural where the harness supports them. `.claude/settings.local.json` gitignored.

## 3. MEMORY
Native auto-memory is the operator-preference layer. Norm-level memories age well; fact-level memories rot - a memory naming a file, flag, or rule is verified against the repo before acting on it. PLAN.md Key Insights is the cross-rig record; operator rulings live in the pack's `operator/rulings.md`, never in memory.

## 4. MODEL-TIER CALIBRATION
The protocol assumes a current frontier model and does not re-teach native behavior: no plan-mode coaching (native; the strategist agent exists for independent strategy-deep plans, a bias question, not a skill question), no in-session task-tracking mandates (native, never the record - PLAN.md is), no emphasis capitals. Rules are stated plainly, once.

The calibration has a floor. Rules encoding **authority** (who may consent: the operator ledger, gates, off-agent gates, the hard line), **cross-rig convention** (the coordination contract, claim(), one-token-one-identity, fail-open), or **world-side traps** (truth-of-claim gaps, regulated claims, git semantics, staleness) are orthogonal to model capability and are never cut on "the model is smart now". A smarter model ships the unsupported claim more fluently; capability does not supply consent, and it does not make a false claim true.

---

# PHASE 1: DISCOVERY AND STRATEGY LOCK

Do not create files yet. Ask the user (batch; the working language governs all content):

1. **The offer:** product/service, what it does, what it costs, who delivers it. And the engagement's working language.
2. **Project short-name** (filesystem-safe slug for `in-progress/<project>-001/`).
3. **Stage:** pre-launch, launching, early traction, scaling, repositioning, sunsetting. Stage branches the protocol (§03): pre-launch runs /produce + /coordinate as the main loop with the motion/experiment machinery dormant until a live funnel exists.
4. **Commercial goals** (revenue, customers, segment, category, exit narrative + timeline). Deliberately deferred goals are recorded parked (owner-gated), never forced into false precision.
5. **Existing evidence** (interviews, transcripts, win/loss, tickets, NPS, prior campaigns) + location.
6. **Operator model** (solo / +AI agents / +contractors / in-house) and standing human collaborators: what each produces, what the agent reviews, what channel - seeds human-lane contracts and off-agent gates (§13).
7. **Operator bandwidth:** decision availability and form, **including the push channel they actually read** (chat, email, digest) - calibrates the ledger cadence, the §13 conventions, and motion parking.
8. **Brand status:** existing voice/visual or from scratch; where it lives; canonical sync-back source.
9. **Regulatory + claims constraints;** if regulated-adjacent, who gives legal sign-off and on what (a launch gate + the §04 checklist seed).
10. **Budget envelope** (also calibrates experiment/critic weight - §03).
11. **Source/product repo:** path; read-only from this workspace, always.
12. **Sibling rig + live coordination (optional; default none).** Continuous coordination with a product/dev team or agent? Where is their repo, where do handoffs and replies flow, what change-ID scheme? Will both sides run agents? If yes: LLM Bus setup (Phase 7); the contract + append-only log exist regardless (archive + fallback). A partner is pluggable later via /coordinate.
13. **Launch gates + owners:** what must be true before anything goes public, and who owns each. Seeds `gates.md`.
14. **Locale scopes (optional; default single-locale):** marketing-campaign locales, served-product copy locales, legal locales - three independent scopes; non-primary consent/legal strings get a native-speaker + legal pass distinct from brand review.

Then propose **2 candidate positioning angles** (category; segment + JTBD; core value prop; competitive frame; top 3 proof points; implied GTM motion). Ask the user to pick or refine. Wait. The choice becomes `docs/decisions/001-<slug>.md` (Phase 3).

---

# PHASE 2: SCAFFOLDING

Directory structure only. **Ours at the root; the client pack under `in-progress/`:** `.claude/` (+ the workflow surface dir, `agents/`), `docs/decisions/`, `scripts/`, `locked/`, `archive/`, and `in-progress/<project>-001/` with `operator/`, `evidence/` (customers/ competitors/ market/ product/ experiments/), `brand/` (+ `workshop/`), `acquisition/`, `landing-pages/`, `funnel/`, `messaging/`, `ads/`, `content/`, `decks/`, `emails/`, `delivery/`, `explorations/`, and `coordination/` ONLY if a partner rig or human lane exists. Channel-specific areas (app-store/, legal/) are expected growth, noted in the pack README when they appear.

**Storage, sync, naming (carried, validated):** system of record = a private git repo per project; web-optimized derivatives in git, bulk/raw media in Drive or object storage, linked; audience exports as zips or copied Drive folders (rename-don't-delete); `private/` gitignored; never commit customer PII; a frozen version = a git tag.

---

# PHASE 3: ROOT FILES, THE PACK, AND THE DOCUMENT SYSTEM

The documents form a circularity loop spanning both layers. Create:

## Ours (repo root)

1. **`README.md`** - the ours/client split; layout with the live pack named; the freeze rule + lifecycle (`in-progress/` -> `locked/` -> `archive/`, event-driven); operating model; the coordination model if any; a short offer block pointing at the pack's `strategy.md`.
2. **`PLAN.md`** - task ledger: Objectives; Milestones (motions with acceptance criteria + decision rules); Bootstrap checklist; Current state; In-flight (the one active motion, or "none / parked: <reason>"); Production/ops queue (the main loop, not throttled); Backlog; Key insights (lessons only). Compaction ritual: completed entries collapse to one line + a link after a few weeks; git holds history.
3. **`.gitignore`** - standard + `.claude/settings.local.json`, `.claude/worktrees/`, `**/.DS_Store`, vendor credentials, large export artifacts, `private/`.
4. **`docs/decisions/`** - the governance spine (ours, one copy, cross-version). Files `<NNN>-<kebab-slug>.md`, three-digit, monotonic, never reused; template adds `**Trigger:** marketing | product`; Status vocabulary `Accepted | Refined by NNN | Superseded by NNN | Reversed by NNN`. Decision-required events: positioning/pricing/channel changes, voice or visual/tagline LOCKS (exploration is un-numbered - the lock is the decision), major/regulated claim adoption, killed experiments, structure/governance changes, `Trigger: product` changes (+ the sibling change-ID). Risk-accepted decisions are a typed class: the flagged risk verbatim + a revisit trigger. Cross-rig, cite another rig's decision by number + commit/ref, never number alone. **Indexes and Status headers are checked, not trusted:** the pack supplies its own ~60-line stdlib check that FAILS on an unindexed numbered file or an unreflected supersession declaration; every numbered local sequence gets an allocation gate (claim() for shared sequences per §13; the checked index for local ones). Seed `001` with the positioning choice.
5. **`scripts/` gains the size check (new in v0.9):** a step in the pack's check script that counts root `CLAUDE.md` lines - warn above 200, fail above the recorded ceiling (default 250). About five lines; mutation-verify it once (a padded file must fail) before trusting it.
6. **`locked/README.md`** and **`archive/README.md`** - frozen delivery packs / frozen superseded versions; both immutable.

## Client (inside the live pack)

7. **`operator/`** - the operator ledger (first-class; operator attention is the engagement's bottleneck resource). **`open-items.md`**: the standing numbered queue of decisions only the operator can make - what / why / options with a recommendation; answered by number; owner-gated work parks against its number, never silently proceeds, never silently drops; every working session ends by refreshing it. **Where a bus exists (§13), an open item also files as a decision task assigned to the operator: one item, two jobs - the task delivers and tracks state on the Board; the entry holds the reasoning, options, and recommendation (and survives a bus flush); the task cites the item number.** **`rulings.md`**: append-only dated one-liners (`ruling <date>-<n>`); check it before asking the operator anything; a ruling that grows into a strategic fact graduates via the normal decision path.
8. **`strategy.md`** - single source of strategic truth, locked behind the Positioning Lock but living; each material change by decision. Sections: Category; Positioning statement; ICP profile (citing `evidence/`); Segments; Value propositions; Competitive frame; Messaging hierarchy; Brand voice reference; Pricing model (reconciled to the live product config); Channel mix; GTM motion; Success metrics (each marked instrumented / not-yet, with the wiring owner); Required Compliance Checks. Deferred sections are parked (owner-gated) with their open-item number. Satellites cite strategy.md, never restate it.
9. **`evidence/`** - the evidence ledger; every `strategy.md` claim cites at least one file here. `product/` holds reconciliation evidence ("claim -> code path @ commit"); `experiments/` is pre-registered, append-only after completion, numbered through its checked index.
10. **`brand/`** - the brand kernel: `voice.md`; `visual.md` (firmness per element: locked vs proposal-layer); `claims.md` (the standing claims ledger: allowed with evidence refs, prohibited/regulated with reason, disclaimers, per-jurisdiction where locales differ, the regulated-claim workflow with legal sign-off as a named gate, durable rulings per claim family); `guardrails.md` (how you say it - tone boundaries, framing rules; claims.md governs permission, guardrails.md governs delivery); `workshop/` (the visual sandbox; self-contained HTML previews are a first-class asset type; exploration un-numbered, the lock is the decision); `README.md`. **Media/visual rules (canonized):** never invent product visuals; authentic-UI depictions come from the product's real CSS/build; real captures beat mockups once a capture harness exists; third-party marks are a standing trademark-review trigger.
11. **`gates.md`** - the launch-gate register: Gate / Owner / Blocks / Status / Cleared-by evidence. Status vocabulary: OPEN, CLEARED (linked evidence), WAIVED (scope + who), RISK-ACCEPTED (linked to its typed decision), PARKED (owner-gated - waiting on an open-item and, where a bus exists, its decision task). A waiver is never a silent clear.
12. **`handoff.md` + `delivery/`** - the multi-target delivery model: `handoff.md` is the index, delivery-only; `delivery/` holds one self-contained audience-scoped export per consumer, decisions cited by number, honesty markers mandatory.
13. **`coordination/`** (OPTIONAL - only when a partner rig or standing human collaborator exists): `<rig>-contract.md` (the sync protocol: push/read locations, cadence, change-ID schemes, shared-vs-local sequences, lanes, write-authority per peer, the decision-task conventions + the operator's named push channel, and the standing rule: the LIVE product is the source of truth for served surfaces - marketing's design files are the source until shipped, then a dated read-only mirror); `<human>-lane.md` contract-lites (what they produce, what the agent reviews - typically compliance re-review, nothing else - and any off-agent gates the agent must not leak into); `<rig>.md` (the append-only log: durable archive + fail-open fallback; load-bearing outcomes land in whichever durable repo file is their natural home - never narrated twice).
14. **Asset folders + `acquisition/` + `explorations/`** - every asset carries a sibling `BRIEF.md` (full for bets; DoD-lite for the main loop) and a `REVIEW.md`; no asset without a brief; multi-locale assets use paired naming. `acquisition/` is the motion-shaped growth area; its strategy satellite cites strategy.md. `explorations/` holds non-promoted work, never deleted to tidy up.
15. **`funnel/funnel-map.md`** - MANDATORY for any engagement coupled to a running product: maps the live conversion funnel end to end, traces each step to the actual page/route/config, states where the core marketing applies; funnel-shape-agnostic; reconciled continuously (drift opens a `Trigger: product` decision).
16. **`wiki/`** (OPTIONAL, OKF-shaped) - adopt when the engagement accumulates knowledge that fits neither strategy.md + brand/ nor decisions (runbooks, playbooks, glossary, current-state); an unused wiki is drift. Typed markdown nodes (frontmatter with at least `type`), reserved index + change-log nodes, cross-links as the graph, a declared lifecycle per node cluster (intent, not a control). Currency Rule: verify the current OKF spec upstream at setup. One source of truth per concern; link to a decision, never restate it. The `/strategize` standing artifacts are a recognized slow-living cluster here. Record adoption + spec revision by decision; generate §14.

No `AGENTS.md`, no `GEMINI.md`. The native instruction file is `CLAUDE.md` (Phase 4).

---

# PHASE 4: CLAUDE.md - CORE RULE SYSTEM (ours, client-agnostic)

Create a single root `CLAUDE.md`: a thin header binds the project (fill `<project>`, the live pack path, the read-only product repo path, the coordination path if any); the body is generic. Sections 00-12, plus §13 only if a live-coordinated partner or human lane exists, §14 only if a wiki was adopted, §15 only if scheduled/unattended sessions run. The result lands inside the Phase 0 budget; omit what does not apply rather than carrying dead weight.

```markdown
# Commercialization workspace - operating rules

This file and `.claude/` are ours: the generic method, reused across projects, carrying no client content - client strategy, evidence, brand, claims, gates, rulings, coordination, and assets live in the live pack. Client specifics leaking into this file is drift; fix by moving them into the pack.

**This workspace: <project> commercialization.** Live pack: `in-progress/<project>-001/` (open its `handoff.md`). [If applicable: the product lives at `<path>` - read-only; never edit it.] The client's hard rules live in the pack's `brand/` + `strategy.md` + `operator/rulings.md` + the decision log - read them before producing.

**Repo structure:** ours at root (this file, `.claude/`, `PLAN.md`, `README.md`, `scripts/`, `docs/decisions/` - the governance spine, cited by number, never shipped); client in versioned self-contained packs under `in-progress/` (one live), `locked/` (frozen deliveries), `archive/` (frozen superseded) - locked/archive immutable. Throughout, "the pack" = the live pack.

## 00 - Constitution

High-rigor, long-running commercialization mode.

Non-negotiables (these stay absolute):
1. **Reconcile before claim.** The biggest claims risks are truth-of-claim gaps between marketing text and product behavior. Product-factual claims (pricing, trial, plan names, channel, privacy/data path) are verified against the running product's actual config/code before shipping ("claim -> code path @ commit" in `evidence/product/`).
2. No asset ships without a brief tied to a PLAN.md item and a `strategy.md` angle.
3. No strategic claim without an evidence citation ([hypothesis]/[gap #N] tags mark the unvalidated).
4. No positioning change without a decision file.
5. Every big bet declares its decision rule before results are seen (pre-registered in `evidence/experiments/`).
6. Nothing goes public until the relevant `gates.md` rows are CLEARED or explicitly WAIVED/RISK-ACCEPTED with scope recorded. A parked or open gate never silently passes.
7. Regulated claims follow the §04 checklist without exception.
8. Operator attention is the bottleneck: decisions only the operator can make go to `operator/open-items.md` (numbered; where a bus exists, also filed as a decision task - §13); answers land in `operator/rulings.md`; check rulings before re-asking anything.

Rule-writing principle: rules scoped to concrete triggers, sizes, or surfaces get followed; absolutes get rationally bent. Scope every new rule to the event that makes it matter.

Attention budget: this file is loaded every session and budgeted (warn 200 lines, fail <ceiling> - the pack's check script enforces). One rule, one home; cross-reference, never restate. A rule earns its place by the deletion test. A new scar lands as a one-clause incident tag plus a decision file holding the story, same commit - never a narrative paragraph here.

Document circularity: every shipped asset traces to a BRIEF.md; every brief to a PLAN.md item and a strategy.md angle; every strategy claim to an evidence file; every strategic change to a decision (cited by number in the pack's handoff.md); every operator call to an open-item or ruling; every public launch to cleared-or-waived gates; cross-rig dependencies to coordination. No document may contradict another; resolve contradictions immediately.

## 01 - Strategy Gate

Before any motion launch or `strategy.md` change: a Strategy Plan via the strategist agent (goal/non-goals; segment + JTBD with citations; angle + primary message matching the lock; channels + sequencing; asset list; metric + decision rule + instrumentation status for bets; risks; verification plan). The initial strategy and each re-diagnosis come from the `/strategize` workshop feeding the locked `strategy.md`; the strategist plans per-motion within that lock.

Threshold: the gate governs motions and strategy-touching work; a copy tweak or ops task gets /brand-reviewer only. An edit touching positioning, category, ICP, pricing, or a regulated claim is never trivial.

## 02 - Positioning Lock

Locked after `strategy.md` exists: no change to positioning, category, ICP, or competitive frame without a decision file and a same-commit strategy.md update; no new value props/proof points without evidence; no new claims without `brand/claims.md` entries + evidence + a cleared legal gate where required; prefer message iteration within the lock over rewrites. Brand-layer firmness lives in `brand/`; exploration is un-numbered - the LOCK is the numbered decision. Deferred sections are parked (owner-gated), never silently filled.

## 03 - The Two Tracks (production/ops is the engine)

PLAN.md is the durable record (in-session tracking is native and never the record). Two tracks:
- **Production/Ops (the main loop):** routine assets, copy packs, reconciles, exports, coordination, channel work - run /produce; not throttled. Lifecycle: brief -> draft -> brand-review -> operator-approval-pending (an open-item; where a bus exists, also a decision task assigned to the operator - §13) -> handoff -> confirm-live.
- **Motions (bets, the special case):** launches, pricing, pivots, positioning, anything experiment-gated - run /motion; one ACTIVE at a time; a motion waiting on the operator or externals is PARKED (with what unblocks it - its open-item number and, where a bus exists, its decision task) and does not block other work. Pre-launch mode: /produce + /coordinate ARE the engagement; motion machinery dormant by design.

Ceremony scales with the bet (spend/irreversibility, decided in the BRIEF). Work-tracker division: the bus task graph = live cross-rig allocation; PLAN.md = the durable logbook; the /strategize action-board GENERATES milestones and tasks, never duplicates them; in-session todos = scratch.

## 04 - Definition of Done

**Motion DoD:** /brand-reviewer passes (voice, claims, guardrails, factual accuracy incl. product reconciliation, links, accessibility, positioning alignment, brief integrity, honesty markers, locale correctness, third-party marks); /critic with a panel scaled to the bet (regulator/legal always for regulated-adjacent); BRIEF current with metric + decision rule + instrumentation status; no secrets/PII/unapproved claims; docs synced; PLAN.md updated; the loop consistent.

**Production/Ops DoD-lite:** a brief; /brand-reviewer passes; honesty markers on stand-ins; gates/coordination updated if a dependency moved; if handed off, confirm-live is a named follow-up. /critic only if a claim or public-facing risk is touched.

**Regulated-claim checklist (never skippable):** check `claims.md` (incl. the claim family's standing rulings) -> cite evidence -> legal review before ship where regulated (the ruling recorded verbatim in the cited evidence file) -> a `gates.md` row wherever sign-off is required.

## 05 - Verification Mandate

After any asset change: /brand-reviewer; do not proceed on failure. After a handoff ships: confirm-live against the served product. After an experiment: confirm instrumentation, apply the pre-registered rule without re-litigating, record the lesson. Before any public launch: the relevant gates rows are CLEARED or carry an explicit WAIVED/RISK-ACCEPTED.

## 06 - Drift Detection

Eight dimensions: strategy<->assets; plan<->reality (parked items still marked); brand<->assets; evidence<->claims; positioning<->messaging; decisions<->docs (Status headers checked mechanically); marketing<->live product; gates + coordination<->reality. Run /coherence-auditor on triggers: post-launch, before pricing changes or major spend, resuming after a gap, after a sibling-rig shipping spree. Memory staleness is a drift source.

The wrong-surface discipline (canonical here, binding on every drift conclusion): before concluding a claim, asset, or fact is absent or stale, name the surface that would show it and check THAT surface (a spec may be merged but unpushed; a claim may live on a SERVED surface, not in the repo; a ruling may live in `operator/rulings.md`, not memory). Every windowed measurement states its window.

## 07 - Doc Sync

Public assets/claims -> strategy.md current; positioning/pricing/channels -> strategy.md + a decision; brand changes -> pack `brand/` (+ a decision if a lock) + re-run /brand-reviewer on existing assets; goals/scope -> PLAN.md + README; an operator answer -> `operator/rulings.md`, close the item, resume the dependent work; evidence -> file + index + re-cite; launch dependencies -> gates.md; cross-rig handoffs -> a bus task with the outcome archived durably; a product change moving a marketing fact -> reconcile funnel/ + a `Trigger: product` decision; delivery -> handoff.md + the export.

## 08 - Failure Escalation

/brand-reviewer or /critic fails twice on the same asset -> Failure Analysis, revise the brief or citation, re-run. Experiment misses -> apply the pre-registered rule. Five related misses -> positioning review. A stuck gate owned by another rig -> a bus task AND an operator open-item + its decision task; never silently launch around it.

## 09 - Skill Governance

Prefer bundled and marketplace capabilities; custom workflows only for genuine gaps (Currency Rule governs the surface). Never shadow a bundled or reserved name (reserved: motion, produce, strategize, strategist, brand-reviewer, critic, coherence-auditor, researcher, reconcile, experiment-designer, positioning-sprint, repair, deliver, coordinate). Capability naming: this workspace's workflows and agents are repo files, safe to name; harness-supplied capabilities are referenced conditionally or re-checked on the §06 triggers - a mandated step that silently no-ops is worse than no rule. Imports respect the brand files and the evidence pathway; local rules win on conflict.

## 10 - Git Discipline

1. Branch before non-trivial work: `motion/<slug>` or `produce/<slug>`.
2. Atomic commits (asset + brief + review + docs together). Prefixes advisory, not compliance.
3. Merge after verification; no direct pushes to main for `strategy.md`, `brand/`, or `docs/decisions/`.
4. Stage explicit pathspecs; verify staged scope before every commit - `git checkout <ref> -- <file>` silently STAGES the file.
5. Push before posting a handoff: the sibling rig reads origin, not your disk.
6. Freeze rule (event-driven): freeze on external handoff, a died direction, or a segment launch. Default snapshot-freeze in place (tag + a clean deliverable copy into `locked/`); full copy-forward reserved for true repositioning or handback. Never edit `locked/` or `archive/`.
7. Cross-rig: commits are part of the channel - actionable messages; anything load-bearing lands in a durable repo file.

## 11 - Independent Review

The drafter never reviews their own asset. Strategist + experiment-designer for plans and pre-registrations (bets above the §03 threshold); brand-reviewer on everything shippable; critic scaled to the bet; coherence-auditor on the §06 triggers; researcher/reconcile for evidence (the product repo read-only). Human-lane creatives: the agent owns the compliance re-review, nothing else. Pass only needed facts; findings are authoritative - dismissal documented in REVIEW.md or Key Insights.

## 12 - Evidence Discipline

Every strategy claim cites a pack evidence file; every shipped factual claim is allowed by claims.md or backed by cited evidence. Evidence files are append-only once complete; superseded evidence is never deleted (new file, mark the old, re-check citations). Verbatims over paraphrase; competitor files >90 days get flagged. Experiments: pre-register hypothesis + metric + instrumentation-readiness + decision rule; never edit a pre-registration; numbers through the checked index. Reconcile before claim (§00.1) via `funnel/funnel-map.md` as the bridge. Cross-rig citations: number + commit/ref, never number alone.

## 13 - Multi-Agent and Human Coordination   <- generate ONLY if a partner rig or standing human collaborator exists

Coordinated through LLM Bus. This section carries the CONTRACT; generic mechanics (tool signatures, ritual details, current limits) are served live by the bus's own guide() - pull it whenever this section might be stale and after any bus migration notice; when the bus changes shape, re-check the settings allowlist against the live tool names.

Division of labor: the bus is the live source of truth for coordination and the small canonical state the operator watches on the Board - the task graph, decisions, claims, posts, presence. Coordination state is FLUSHABLE; identity, membership, sequences, and leases persist; the pack ledger and durable repo files are the record the Board is rebuilt from - never the reverse. Content stays in git, referenced by link. The pack's coordination log is the cold archive and fail-open fallback. Never narrate the same handoff twice.

The work-queue: anything with an owner and a done-state is a bus task; a note or FYI is a post (reading a post addressed to you marks it read); if an ask arrives as a post, file the task, then read the post. A worked engagement with an empty Board means the work is invisible.

Decisions and the routing rule: needing the operator (or any decider) is a TASK WITH OPTIONS assigned to them - the operator answers from the web Board; the reasoning lives in the `operator/open-items.md` entry the task cites (one item, two jobs; the entry survives a flush). A wait on a human is a decision task, never a blocked task; a wait on another task is a dependency (derived blocking, auto-unblocks with the answer delivered - record the ruling in `operator/rulings.md`, then resume); the manual block is only for non-task waits. File the decision task the moment the question arises. Filing is not a handoff: post to a waiting counterpart too.

THE HARD LINE (canonical here; §15 and Appendix B point): an agent never answers a decision task assigned to the operator. That assignment is the ASK-class boundary in the coordination layer; an agent answering it is a loop with no human in it, and it degrades silently because the resulting ruling looks identical to a real one. Agent-to-agent decision tasks are ordinary work.

The loop: check the bus before starting work and at the end of every unit of work - the end-of-work check is where the next thing comes from. Board quiet and in-bounds work buildable: build it. Board quiet and nothing buildable: file a decision task saying so, then stop - never go quiet. No clock-driven cron ticks (operator-ruled in the field: a timer cuts across flow; the bus pushes open work on every tool response). SessionStart/Stop hooks make the two checks structural where supported. Optionally record an operator restart word.

The operator's plate spans projects and is a pull surface; this rig NAMES its push channel here: <push channel>.

Permission split (the §15 gate in settings): bus work tools - reads, posts, presence, the full task graph, claim and sequence reads, leases - on allow; identity-class admin tools - provisioning, revocation, rotation, invites, sequence seeding - on ask, never deny (identity operations are irreversible; ask preserves the capability while guaranteeing it never fires unattended).

Cross-rig invariants: shared sequences claimed via claim() per the contract (this workspace's own decision numbering is LOCAL - never claimed); qualified ids for numbers from another project; one token = one identity (sub-agents share it; peers register separately, write-authority assigned in the contract - lanes are shared rooms, not walls); push before posting a handoff; the propose-back flow for product changes (a bus task referencing the commit; a `Trigger: product` decision only if a market fact moved); the round-trip copy pack (dev owns keys/slots, we own strings, brand-reviewer gates, confirm-live verifies); human lanes get contract-lites with off-agent gates the agent never crosses; the LIVE product is the source of truth for served surfaces; resolve topology via whoami, never pin it in prose. Fail-open: the bus is advisory - if unreachable, keep working, single-write the coordination log, reconcile when it returns.

## 14 - Knowledge Layer   <- generate ONLY if a wiki was adopted

The pack wiki (OKF-shaped) holds what is neither the strategic contract nor a numbered decision (runbooks, playbooks, glossary, current-state). Typed-node frontmatter, kept index + change-log nodes, links as the graph, a declared lifecycle per cluster (intent, not a control). One source of truth per concern: strategy.md + brand/ = the locked contract; decisions/ = rationale; the wiki = current-state - link, never restate. Verify the OKF spec at setup (Currency Rule).

## 15 - Autonomous Operation   <- generate ONLY if scheduled/unattended sessions run

Per candidate action:
- **ACT** - proceed unattended when ALL hold: within the locked strategy and brand; reversible; nothing goes public; no spend; no owner-gated or parked item touched. Routine reconciles, drafts, coordination queue-work, evidence work live here.
- **ACT + FLAG** - proceed, log to `operator/open-items.md` as an FYI entry: judgment-adjacent but high-confidence.
- **ASK** - never unattended: anything public or irreversible; spend; anything touching locked strategy/brand/positioning/pricing; anything owner-gated. Convert to a numbered open-item and, where §13 exists, a decision task assigned to the operator (depend blocked work on it so the answer auto-resumes it) - then stop. Solo rigs: the open-item alone. The hard line stands (§13).

Unattended sessions run §13's loop and end by refreshing `operator/open-items.md` - the operator returns to a numbered queue, not a transcript.
```

---

# PHASE 5: CAPABILITY ACQUISITION

1. **Inventory bundled capabilities** (the live build's list is authoritative; the marketing-specific bundled surface is thin - expect the core reviewers to be generated). Every capability the generated CLAUDE.md names must satisfy §09's naming rule and resolve at generation time (Phase 8).
2. **Plugin marketplaces + MCP connectors** (analytics, ESP/CRM, research/SEO, Workspace/Drive for delivery). Trust boundaries: inspect before enabling; candidates must respect a brand-voice file, produce BRIEF/REVIEW artifacts, and cite evidence; reject anything generating ungrounded claims, baking in a voice, or colliding with a reserved name. Record adoptions by decision.
3. **Generate the gaps:** Phase 6 agents, Phase 7 workflows.

---

# PHASE 6: CORE AGENTS (FALLBACK GENERATION)

Generate only for gaps. All client-agnostic; tools scoped; exploration agents read-only (+ Web tools); the product repo always read-only. The prompts reference the generated CLAUDE.md sections rather than duplicating them.

- **strategist** - independent Strategy Plans per §01 from the pack's strategy.md, decisions, evidence, brand files, and rulings. Never introduces positioning/claims/channels absent from the lock, never fills a parked section. Output becomes the motion BRIEF, confirmed with the operator.
- **brand-reviewer** - adversarial compliance review of an asset folder: voice (em dash = hard fail); claims vs claims.md incl. claim-family rulings (prohibited/regulated = hard fail); delivery vs guardrails.md; factual accuracy incl. product reconciliation; links; accessibility (WCAG AA); positioning alignment; brief integrity; honesty markers; locale correctness; third-party marks; Required Compliance Checks. Appends to REVIEW.md.
- **critic** - persona panel, one isolated run per persona, scaled to the bet (buyer, competitor, cfo, analyst, journalist; regulator/legal standard for regulated-adjacent). Aggregates to REVIEW.md.
- **researcher** - structured evidence files (date/source/method; verbatims; cited URLs; inference labelled; touched claims; confidence) into the pack's `evidence/`, index updated, re-cited.
- **reconcile** - reads the read-only product repo; produces `evidence/product/` reconciliation files ("claim -> code path @ commit -> match / drift"); flags drift; recommends `Trigger: product` decisions and funnel-map updates; runs confirm-live after handoffs. Never edits the product repo.
- **experiment-designer** - pre-registers per §12: hypothesis with direction + magnitude; primary metric; instrumentation-readiness (un-instrumented = a gate); guardrails; sample/duration; keep/iterate/kill rule before results; confounders; read-out plan. Immutable after launch; dependencies mirrored in gates.md.
- **coherence-auditor** - audits the eight §06 dimensions on the §06 triggers, applying the wrong-surface discipline to every absence conclusion and stating every measurement's window. Every discrepancy ends resolved or documented.

---

# PHASE 7: WORKFLOWS

## workflow: produce - the main loop (the engine)
Step 0: branch `produce/<slug>`; DoD-lite brief tied to a PLAN item + a strategy angle; check `operator/rulings.md` before asking anything. Step 1 - Draft: voice from `brand/voice.md`, delivery per `guardrails.md`, evidence for every concrete claim (product-factual via reconcile); hard guards: no em dashes, every claims.md prohibition, honesty markers, the media/visual rules. Step 2 - Brand review: do not advance on a fail; critic only if a claim or public risk is touched. **Step 3 - Operator approval (when required):** the work enters operator-approval-pending - a numbered `operator/open-items.md` entry, and where a bus exists a decision task with options assigned to the operator citing the item number (one item, two jobs); the work parks against it, with `task_depend` where other bus work waits on it. The answer lands in `rulings.md`; the dependent work auto-returns; resume. Step 4 - Handoff: a bus task referencing the pushed commit (push first), or per the human-lane contract; round-trip copy packs run here. Step 5 - Confirm-live: reconcile against the SERVED product; record; update gates/coordination. Ship per DoD-lite; update PLAN.md; commit atomically. If it grows into a bet, re-route through /motion.

## workflow: motion - the bet pipeline (the special case)
One ACTIVE at a time; dormant pre-launch. Step 0: confirm no other active motion and that this is a bet; branch `motion/<slug>`. Steps: strategist -> BRIEF (operator-confirmed) -> draft (full rigor) -> brand review (resolve everything) -> critic (panel per bet; regulator/legal for regulated-adjacent) -> experiment-designer pre-registration (+ gates) -> ship per the Motion DoD -> after results, apply the pre-registered rule; killed work -> `explorations/` + a decision. Parking: a motion blocked on the operator/externals beyond a session or two is PARKED in PLAN.md with what unblocks it (its open-item number + decision task); unparking resumes at the step it left.

## workflow: strategize - the strategy workshop
The Simple Strategy Framework as a re-runnable session feeding the locked `strategy.md`; the full pasteable process is the companion [strategy-workshop.md](strategy-workshop.md). Step 0 - Read from what exists (pack, decisions, running product); classify empty / partial / mature; emit a State Read + Gap List; never ask what the repo answers. Step 1 - Ask only the gaps. Step 2 - the five steps in order under the HOW test: Diagnosis (reconciled to the product) -> Goals (specific, measurable; deliberately deferred goals parked owner-gated) -> Directional Decisions -> Strategic Actions ("TBD, owner-gated" is a legitimate state) -> Iteration (cadence + triggers). Step 3 - Land it: the contract to the canonical homes (strategy.md, PLAN.md milestones, a decision per real directional choice); working artifacts as the slow-living OKF cluster in the pack wiki; **the action-board GENERATES PLAN milestones and bus tasks, never a fourth tracker**; gaps ship tagged with a researcher/reconcile task. Re-runs read the cluster, re-diagnose, diff, append to the iteration log.

## workflow: deliver
Build or refresh a self-contained `delivery/<audience>/` export (agency-enablement | developer-handback | creator/partner-kit | client-review-export); decisions cited by number; honesty markers; the Drive recipe (rename-don't-delete). Runs on the /produce track.

## workflow: coordinate - OPTIONAL (also how a partner is plugged in later)
On first use: write `coordination/<rig>-contract.md` with the operator (locations, cadence, change-ID schemes, shared-vs-local sequences, lanes, peer write-authority, the decision-task conventions + the operator's NAMED push channel, the live-mirror rule) and any human-lane contract-lites (incl. off-agent gates). If both rigs run agents, the LLM Bus setup:
1. Enrollment is identity-first: `create_invite` with the joining human's email (they accept via the emailed link under their own identity); `admin_provision` only for additional agents the same person runs; one lead per project. The invite leads with the division of labor and the routing rule (operator waits are decision tasks, never blocked tasks).
2. MCP tools load at session boot: a restart is required; confirm with `whoami`. If task tools are missing from the tool list, the client cached an old list - reconnect the server.
3. Pull the bus's `guide()` and follow it for current mechanics (Currency Rule); never work from a remembered tool list.
4. Sequences: only the contract's shared sequences live on the bus; never claim the workspace's local decision numbering; never seed over an existing sequence (list_sequences first).
5. Write CLAUDE.md §13 (and §15 if unattended sessions run); wire the settings permission split checked against the live tool names.
Ongoing: the §13 loop and invariants; owner-gated waits -> open-items + decision tasks; outcomes archived durably; cross-rig dependencies mirrored as gates rows; "live product = source of truth" reconciled before drafting.

## workflows: positioning-sprint, repair - generate on demand
Positioning re-lock via strategist + critic panel + decision + coherence sweep. Repair classifies a failure (strategy / message / offer / operational / gate-stuck / cross-rig) and routes; gate-stuck/cross-rig escalates as a bus task AND an operator open-item + its decision task.

---

# PHASE 8: HANDOFF VALIDATION

1. The workflow surface holds produce, motion, strategize, deliver (+ coordinate if coordinated); agents: strategist, brand-reviewer, critic, researcher, reconcile, experiment-designer, coherence-auditor (positioning-sprint and repair on demand).
2. Root `CLAUDE.md`: the structure header + §§00-12 (+§13/§14/§15 exactly per discovery), client-agnostic, and **inside the Phase 0 budget; the size check exists and has been mutation-verified**.
3. Every capability the generated CLAUDE.md names is a repo file, a conditional reference, or re-checked (§09); no workflow shadows a bundled or reserved name.
4. The ours layer exists (incl. `docs/decisions/` with 001 + its checked index/Status script); the live pack exists complete (operator/, strategy.md with parked sections marked, evidence/ + indexes, brand/ incl. guardrails + workshop, gates.md with the full vocabulary, funnel-map where a product runs, asset folders incl. acquisition/, handoff.md, delivery/, explorations/, coordination/ only if coordinated).
5. `locked/` + `archive/` exist with READMEs; client hard rules live in the pack, not CLAUDE.md; PLAN.md complete (incl. the Production/ops queue; pre-launch mode reflected where stage = pre-launch).
6. Settings: gitignored local overrides; scoped permissions + the reminder hook; where coordinated, the §13 bus split **checked against the live tool names**.
7. If coordinated: bus joined (post-restart `whoami`), §13 present with the push channel NAMED, the contract records sequences/lanes/write-authority/conventions, **owner-gated waits route as decision tasks - never blocked tasks**, human-lane contract-lites exist. If solo: no §13, no coordination artifacts.
8. If a wiki was adopted: it validates (typed nodes, lifecycles, index + change-log, resolving links) with its decision. If /strategize ran: the strategy cluster links to the contract, and action-board entries link to the milestones/tasks they generated.
9. If unattended sessions run: §15 present; ASK-class conversions file decision tasks where §13 exists; every unattended entry point ends by refreshing `operator/open-items.md`.
10. The circularity loop closes across both layers; every relative link resolves.

Then ask: "Environment ready. Use `/strategize` to build the strategy, `/produce <name>` for production/ops (the main loop), `/motion <name>` when a real bet is ready, `/positioning-sprint` to re-lock after a shift."

---

# APPENDIX A: CROSS-RIG PORTABILITY AND COORDINATION

Projects are operable interchangeably by Claude Code (native loading) and by autonomous platform agents (context injection at spawn: CLAUDE.md + PLAN.md full, and from the pack strategy.md + brand/voice.md + claims.md + guardrails.md + gates.md + operator/rulings.md, plus task-relevant decisions and evidence). The freeze rule travels: a sub-agent edits only the live pack. This is why the Phase 0 load discipline permits moving rules only to surfaces structurally loaded in every consuming harness. Coordination is absent by default and pluggable via /coordinate; when present, the bus carries the live exchange per §13, and the LIVE product is the source of truth for served surfaces.

# APPENDIX B: WHAT THIS PROTOCOL DOES NOT DO

1. No customer interview execution. 2. No paid media buying. 3. No CRM/ESP/Drive data writes without a configured connector + explicit confirmation. 4. No legal/regulatory advice: humans write the claims rules and sign off (gates + verbatim rulings). 5. No living analytics dashboards. 6. No edits to the sibling product repo (read-only, always). 7. No crossing of off-agent gates. 8. No answering a decision task assigned to the operator - ever (§13, the hard line).

# APPENDIX C: OPEN QUESTIONS FOR v1.0

1. Multi-product portfolio mode (shared brand upstream vs per-product packs). 2. Automated competitor monitoring. 3. Cross-version diffing + promotion tooling. 4. Generic-vs-client lint. 5. Gate-register automation (machine-checkable gates refusing a publish until cleared). 6. Delivery-export tooling. 7. Product-doc lifecycle marketing mirror (waits for pack-side evidence of need).

**Resolved in v0.9 (the compression + bus-v2 release, mirroring claude-code v1.7):** §13 rewritten contract-only on the v2 task graph (decisions-as-tasks with options; derived blocking + auto-unblock; no-ack read semantics; flush semantics; qualified ids; lanes-as-rooms) with generic mechanics served by the live guide() under the extended Currency Rule; the attention budget with a checked ceiling + one-rule-one-home + scars-as-tagged-rules + the deletion test; the board-is-the-loop event-driven operating model with clock crons retired; capability naming + native-first calibration with the family floor; the test-then-delete measurement fold.

**Resolved in v0.8:** the operator-wait routing + limits + rituals wired through /produce approval-pending, parked motions, PARKED gates, and §15 (in v1-era terms, re-expressed by v0.9); the named push channel; the hard line; the bus permission split; wrong-surface + window discipline; the trigger-scoped-rules principle; checked indexes/Status headers. **Resolved in v0.7:** /produce as the engine; pre-launch mode; parked motions; the operator ledger; reconcile-before-claim headlined; the round-trip copy pack; task-graph-first coordination; the §15 gate; gate WAIVED/RISK-ACCEPTED; snapshot-freeze; content scaffolding. **Earlier:** v0.6 /strategize; v0.4/v0.5 the bus model, guardrails-vs-claims, regulated-claim workflow, event-driven freezes, OKF; v0.3 and before, the ours/client split, packs, the decision spine, gates.md, two tracks, delivery, code-as-evidence.

End of v0.9.
