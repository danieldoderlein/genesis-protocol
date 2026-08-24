# MIGRATION PROMPT: bring this workspace to Commercialization Genesis Protocol v0.9

**Paste this prompt to the agent that operates an EXISTING commercialization workspace** bootstrapped under v0.4 through v0.8 (or a local variant). It upgrades the workspace's governance in place. It is NOT a fresh bootstrap: the packs, evidence, decisions, and local rules already exist and must survive. A workspace on v0.3 or earlier is best re-bootstrapped from the current protocol ([commercialization.md](commercialization.md)), carrying its packs and decisions forward.

**INPUT:** alongside this prompt, the operator provides the full v0.9 protocol text (or a local path to it). Read it before planning. The engagement's working language governs generated content; structures and filenames stay as written.

**THE POINT OF v0.9 - and the expected shape of the work:** v0.9 is the compression + bus-v2 release. The coordination layer migrated to v2 (2026-08-11): decisions are now tasks with options on the task graph, and the v1 review surface this family's v0.8 texts mandate was retired (calling a retired tool returns a redirect). Separately, field measurement (2026-08-13) found five production marketing rigs' always-loaded CLAUDE.md files at 144-260 lines against the platform's documented under-200 adherence threshold, carrying v0.8-lineage text that mandates tools the live bus no longer serves. **The core operations of this migration are therefore COMPRESSION of your own CLAUDE.md and RE-FITTING every operator-wait to the live bus contract - not addition.** Because these rigs invented the underlying conventions (items-for-you queues, event-driven checks), ALREADY-LOCAL is an expected classification: where a local correction or convention already matches v0.9, keep its wording and record the equivalence. This is test-then-delete, not deletion on faith: every removal is recorded, and a removed rule's incident recurring is a finding for the next version.

**Entry paths:**
- **From v0.8:** run Phase A, then Phase B (the operator-wait constructs re-fit to v2; several items ALREADY-LOCAL).
- **From v0.4-v0.7 (the primary path - most marketing workspaces are here):** run Phase A, then B0 (the prior layers, compact), then Phase B. Apply every v0.8-era operator-wait construct directly in its v0.9 form - never in the retired form the older texts describe.
- **From v0.3 or earlier:** re-bootstrap from the current protocol ([commercialization.md](commercialization.md)) instead.

---

## Prime directives (read before touching anything)

1. **Branch first.** All work on `produce/genesis-v0.9-migration`; nothing lands on `main` until verification passes and the operator approves.
2. **Local inventions are protected.** On conflict between v0.9 and a local rule, the local rule wins and you FLAG it. Compression relocates local rules; it never deletes or weakens them.
3. **The pack's content is client work, not governance.** This migration touches the OURS layer (CLAUDE.md, `.claude/`, root docs) and pack STRUCTURE only; it never rewrites strategy, evidence, brand content, assets, or anything in `locked/`/`archive/` (immutable, always). Exception: repairing a stale decision Status header found in the audit is a mechanical correction.
4. **Plan, then gate.** Operator GO before any file modification.
5. **Your own rules still apply:** brand-review anything shippable you touch, atomic commits, explicit pathspecs, staged-scope check before every commit.

## Phase A: Audit (read-only)

1. **Measure the load.** Record CLAUDE.md's line and byte counts - the BEFORE figure for the migration decision.
2. **Classify every CLAUDE.md line** into exactly one class: **KEEP** (binds every turn: the non-negotiables, authority and gates, active conventions, the coordination contract) / **SCAR-NARRATIVE** (dated stories and correction histories -> the decision file or ruling that owns them; the rule keeps a one-clause tag) / **BUS-MECHANICS** (generic tool signatures, ritual detail, limits the live guide() serves -> deleted in favor of the contract + guide() deferral; the rig's own topology facts - lanes, sequences, counterparts, push channel - are contract and stay) / **VOLATILE** (counts, statuses, inventories -> generated, relocated with a flagged-volatile note, or dropped) / **STALE-CAPABILITY** (any named tool, workflow, or bus verb the live surfaces do not serve -> conditional form or removed) / **DUPLICATE** (-> one canonical home, cross-references elsewhere) / **OPS-REFERENCE** (engagement/stack material -> the pack file that owns it).
3. **Bus reality check (coordinated rigs):** pull the bus's live guide(). Diff it against §13 and the settings allowlist: list every tool name the guide no longer serves and every live verb the allowlist is missing. List every bus task currently blocked whose real dependency is the OPERATOR, and every approval-pending item with no live delivery mechanism. List any clock-driven coordination cron and the operator ruling (if any) that governs it.
4. **Capability resolution:** every workflow, agent, or capability named in CLAUDE.md, resolved against the live build and the repo. Mandated-but-missing entries are STALE-CAPABILITY.
5. **Checks inventory:** which mechanical checks exist (the pack's index/Status script; now the size check)? Prose may leave only where the corresponding check exists.
6. **Ledger state:** open-items entries vs reality; supersession declarations vs Status headers; report silent mismatches.

## Phase B0: Prior layers (v0.4-v0.7 entrants only)

Classify each APPLY / ALREADY-LOCAL / N/A, one line each. The v0.7 layer: the pack `operator/` ledger seeded from what exists; reconcile-before-claim as non-negotiable #1; §03 re-centered on /produce lifecycle states + parked motions + pre-launch mode; gates status vocabulary reclassified honestly; risk-accepted decisions typed; §13 task-graph-first with propose-backs, human lanes, off-agent gates; the §15 three-tier gate; git guards; sequence indexes; pack scaffolding (acquisition/, brand/workshop/, media/visual rules, locale scopes); the standing claims ledger. The v0.8 layer: the operator-wait routing through /produce approval-pending, parked motions, PARKED gates, and §15; the named push channel; the hard line; the bus permission split; wrong-surface + window discipline; checked indexes/Status headers - **each applied directly in its v0.9/v2 form (Phase B below), never in the older texts' retired wording.**

## Phase B: The v0.9 delta (all entrants)

Classify each APPLY / ALREADY-LOCAL / N/A:

1. **The compression:** rewrite CLAUDE.md per the Phase A classification - scars to their decision files, bus mechanics to the guide() deferral, volatile relocated or dropped, duplicates to one home, ops reference to its pack home, stale capabilities fixed or removed. Target the v0.9 budget (~120 solo / ~180 coordinated).
2. **The size check:** wire the line-count step into the pack's check script (warn above 200, fail above the ceiling). **Wire it at the protocol default ceiling (250): a higher initial ceiling is a FLAG in the Phase C plan with written reasoning, never a silent choice.** Mutation-verify it (a padded file must fail).
3. **§13 rewritten as CONTRACT + guide() deferral (coordinated rigs):** decisions-as-tasks with options assigned to the decider; dependency-derived blocking that auto-unblocks with the answer delivered; read-marks-read post semantics; flush semantics (the Board is rebuilt from the pack ledger, never the reverse); qualified ids; lanes-as-rooms. Take current mechanics from the live guide(), never a remembered tool list.
4. **Queue re-file, one pass:** every blocked-on-operator task from A.3 re-files as a decision task with options assigned to the operator; every stale approval-pending item gets one; dependent work gains its dependency so the answer auto-resumes it; open-items entries gain their task cross-references. /produce Step 3, parked motions, PARKED gates, and §15 ASK now all route this way.
5. **The settings rename:** rebuild the bus allowlist from the live guide()'s tool surface (work tools on allow; identity-class admin on ask, never deny) + the standing rule: when the bus changes shape, re-check this list against the live tool names.
6. **The loop:** board checks at task boundaries canonized as event-driven; the hourly-while-idle clause deleted; clock crons retired where the operator has ruled (FLAG for the operator where no ruling exists yet); SessionStart/Stop hooks where the harness supports them; the operator restart word recorded where one is agreed.
7. **Capability naming:** the workspace's own workflows/agents are repo files, safe to name; every harness-supplied capability named in CLAUDE.md becomes conditional or re-checked.
8. **Native-first trims with the family floor kept verbatim or stronger:** reconcile-before-claim, the regulated-claim checklist, gates that never silently pass, the evidence discipline, the ours/client split and freeze rule, the operator ledger, the hard line (re-worded to task terms, never weakened), off-agent gates, one-token-one-identity, fail-open.

## Phase C: Migration plan -> operator gate

The plan lists: the A.2 classification totals (lines per class and destination), each B delta with exact files/sections, protected local rules and where each lands, the A.3 re-file list, the settings diff, **the size-check ceiling value (anything above the 250 default carries its written reasoning here)**, and (for B0 entrants) the `operator/` seed content. **Operator GO before applying.**

## Phase D: Apply and record

1. Apply per the plan, in the engagement's working language, preserving local rules verbatim or relocated.
2. Queue reconciliation: decision tasks filed, dependencies wired, open-items cross-referenced, the push channel named.
3. **Record the migration as a decision file** in YOUR `docs/decisions/` (local numbering - never claimed): migrated to v0.9; BEFORE/AFTER line+byte counts; classification totals; rules moved per surface; removals being field-tested; flagged conflicts; which local inventions v0.9 formalized.
4. Update README/PLAN where they name the version or migrated conventions.

## Phase E: Verify and land

1. Brand-review anything shippable you touched; run the pack's checks; **mutation-verify every newly wired check** (a padded CLAUDE.md and a seeded false supersession must each fail before the checks are trusted).
2. Self-check: every APPLY landed; every protected local rule survives; `locked/`/`archive/` untouched; no em dashes introduced; nothing in CLAUDE.md or settings names a tool the live surfaces do not serve; **the AFTER line count is at or under the budget target (~120 solo / ~180 coordinated), or the migration decision records why not**; the cross-layer circularity loop closes.
3. Operator approves; merge; prune the branch on the next hygiene sweep. End by refreshing `operator/open-items.md` and checking the Board for decision tasks awaiting the operator.
4. **The measurement stands ready:** the decision's before/after figures and field-tested-removal list feed the operator's follow-up questionnaire. A removed rule's incident recurring is recorded in Key Insights immediately - that recurrence is the next version's evidence.
