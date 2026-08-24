# MIGRATION PROMPT: bring this workspace to Claude Code Genesis Protocol v1.7

**Paste this prompt to the agent that operates an EXISTING development workspace** governed by Genesis v1.3 through v1.6 (or a local variant). It upgrades the workspace's governance in place. It is NOT a fresh bootstrap: the code, decisions, PLAN, and local rules already exist and must survive. A workspace on v1.2 or earlier is best re-bootstrapped from the current protocol ([claude-code.md](claude-code.md)), carrying its decisions and PLAN forward.

**INPUT:** alongside this prompt, the operator provides the full v1.7 protocol text (or a local path to it). Read it before planning. The workspace's working language governs generated content; structures and filenames stay as written.

**THE POINT OF v1.7 - and the expected shape of the work:** v1.7 is the compression release. Its core finding, measured across four production rigs: always-loaded CLAUDE.md files grew to 1.3-3.5x the platform's documented adherence threshold, and the forks rotted - three of four rigs mandated capabilities or bus tools that no longer exist. **The core operation of this migration is therefore COMPRESSION of your own CLAUDE.md, not addition** - and because several rigs already self-corrected parts of this locally (bus v2 wording, retired crons, pipeline-not-command rules), ALREADY-LOCAL is an expected classification: where a local correction exists, keep its wording and record the equivalence. This is a test-then-delete migration, not deletion on faith: every removal is recorded, and its incident recurring is a finding for the next protocol version.

**Entry paths:**
- **From v1.6:** run Phase A, then Phase B (all items; several will be ALREADY-LOCAL).
- **From v1.5:** run Phase A, then the v1.6 layer summary in B0, then Phase B.
- **From v1.3/v1.4:** run Phase A, then B0 (both prior layers), then Phase B.
- **From v1.2 or earlier:** re-bootstrap from the current protocol ([claude-code.md](claude-code.md)) instead.

---

## Prime directives (read before touching anything)

1. **Branch first.** All work on `feature/genesis-v1.7-migration`; nothing lands on `main` until verification passes and the operator approves.
2. **Local inventions are protected.** On conflict between v1.7 and a local rule, the local rule wins and you FLAG it to the operator. Compression relocates local rules; it never deletes or weakens them.
3. **Governance only.** This migration touches CLAUDE.md, `.claude/`, root docs, and document scaffolding - never code, never decision-file meaning (Status-header repairs excepted, as mechanical corrections).
4. **Plan, then gate.** Operator GO before any file modification.
5. **Your own rules still apply:** verification after changes, atomic commits, explicit pathspecs, staged-scope check before every commit.

## Phase A: Audit (read-only)

1. **Measure the load.** Record CLAUDE.md's line and byte counts (plus any auto-loaded imports). This is the BEFORE figure for the migration decision.
2. **Classify every CLAUDE.md line** into exactly one class:
   - **KEEP (always-loaded):** rules that must bind every turn - authority boundaries and owner-gates, active conventions, verification pointers, the coordination contract.
   - **SCAR-NARRATIVE:** dated incident stories, correction histories, "measured here" paragraphs. Destination: the decision file or ruling that owns the incident; the rule keeps a one-clause tag.
   - **BUS-MECHANICS:** generic tool signatures, ritual details, limits the bus's live guide() serves. Destination: deleted; §13 keeps the contract and defers mechanics to guide().
   - **VOLATILE:** counts, statuses, route tables, tool inventories. Destination: generated blocks with a failing regeneration check, or deletion.
   - **STALE-CAPABILITY:** any named skill, command, or bus tool that does not resolve against the live build or the live guide(). Destination: fixed to the conditional form, or removed. (Verify against the LIVE surfaces, not memory - this includes tool names your settings allowlist carries.)
   - **DUPLICATE:** a rule stated more than once in the file. Destination: one canonical home, cross-references elsewhere.
   - **OPS-REFERENCE:** project stack/deployment/schema material. Destination: the architecture doc or wiki, per the workspace's doc model.
3. **Bus reality check (coordinated rigs):** pull the bus's live guide(). Diff it against CLAUDE.md §13 and the settings allowlist. List every tool name that no longer exists on the live surface and every live tool the allowlist is missing. List every bus task currently blocked whose real dependency is a human decision. List any clock-driven bus cron and the operator ruling (if any) that governs it.
4. **Capability resolution:** every skill, command, or agent named in CLAUDE.md, resolved against the live build. Mandated-but-missing and stale-shadowing entries are STALE-CAPABILITY.
5. **Checks inventory:** which of the mechanical checks exist in the verify suite (decisions index, supersession Status parse, volatile-block regeneration, and now the CLAUDE.md size check)? Prose may only leave where the corresponding check exists.

## Phase B0: Prior layers (v1.3/v1.4/v1.5 entrants only)

Classify each APPLY / ALREADY-LOCAL / N/A, one line each. The v1.5 layer: the `docs/operator/` ledger (open-items + rulings, seeded from existing content only); PLAN compaction + parked (owner-gated); the doc model by decision; generated-or-checked indexes; the §01 authority axis + conditional §15; the git guards (explicit pathspecs, staged-scope, hygiene-as-sweep); memory as operator-preference layer. The v1.6 layer: generated volatile blocks with a failing regeneration check; the supersession Status check (repair stale headers found in A, then wire the check); the wrong-surface + window discipline into §06 and the drift-checker; capability resolution at generation time; executed live-claims (optional, live-infra rigs, by decision).

## Phase B: The v1.7 delta (all entrants)

Classify each APPLY / ALREADY-LOCAL / N/A:

1. **The compression itself:** rewrite CLAUDE.md per the Phase A classification - scars to their decision files (create them where missing; the rule keeps its one-clause tag), bus mechanics deleted in favor of the guide() deferral, volatile blocks generated or dropped, duplicates collapsed to one home, ops reference relocated, stale capabilities fixed or removed. Target the v1.7 budget (~120 solo / ~180 coordinated); the ceiling is recorded, and raising it is a decision.
2. **The size check:** wire the line-count check into the verify suite (warn above 200, fail above the ceiling). Wire it at the protocol default ceiling (250): a higher initial ceiling is a FLAG in the Phase C plan with written reasoning, never a silent choice - a generous ceiling at wiring time is how this check gets gamed into a no-op. Mutation-verify it (a padded file must fail) before trusting it.
3. **§13 rewritten as CONTRACT + guide() deferral (coordinated rigs):** decisions-as-tasks with options assigned to the decider; dependency-derived blocking that auto-unblocks with the answer delivered; the read-marks-read post semantics; flush semantics (board rebuilt from the git ledger, never the reverse); the task-vs-post rule; qualified ids for cross-project citations; lanes as rooms with path-anchored write authority. Take the current mechanics from the live guide(), not from any remembered tool list.
4. **Queue reconciliation, one pass:** every blocked-on-a-human task from A.3 re-files as a decision task with options assigned to the operator; work that waits on it gains a dependency so the answer auto-resumes it; open-items entries gain their task cross-references.
5. **The settings rename:** rebuild the bus allowlist from the live guide()'s tool surface (work tools on allow; identity-class admin tools on ask, never deny). Add the standing rule: when the bus changes shape, this list is re-checked against the live tool names.
6. **The loop (coordinated rigs):** board check before starting and at the end of every unit of work; build in-bounds work when the board is quiet; a quiet board with nothing buildable becomes a decision task, then stop. Retire any clock-driven cron where the operator has so ruled (three had, at measurement time); wire SessionStart/Stop hooks for the two checks where the harness supports them. Record the operator's restart word if one is agreed.
7. **Capability naming:** every remaining named capability satisfies the §09 rule (repo file, conditional reference, or re-checked); pipeline-not-entry-point wording replaces any mandate of a specific pipeline skill.
8. **Native-first trims:** in-session task-tracking mandates, plan-coaching beyond the gate, and emphasis language go; the §15 three-tier gate, the hard line, and every floor rule (authority, convention, world-side traps) stay verbatim or stronger.

## Phase C: Migration plan -> operator gate

The plan lists: the A.2 classification totals (lines per class and destination), each B delta with its exact files/sections, protected local rules and where each lands, the A.3 re-filing list, the settings diff, and the checks to be wired **including the size-check ceiling value (anything above the 250 default carries its written reasoning here)**. **Operator GO before applying.**

## Phase D: Apply and record

1. Apply per the plan, preserving local rules verbatim or relocated.
2. **Record the migration as a decision file** in YOUR `docs/decisions/` (local numbering unless shared): migrated to v1.7; the BEFORE and AFTER line/byte counts; the classification totals; which rules moved to which surface; which removals are being field-tested; flagged conflicts; which local inventions v1.7 formalized.
3. Update README/PLAN where they name the version or migrated conventions.

## Phase E: Verify and land

1. Run the full verification suite; **mutation-verify every newly wired check** (a padded CLAUDE.md, a seeded unindexed decision, a seeded false supersession must each fail before the checks are trusted).
2. Run the gatekeeper on the migration diff. Self-check: every APPLY landed; every protected local rule survives; no em dashes introduced; nothing in CLAUDE.md or settings names a tool or skill the live surfaces do not serve; **the AFTER line count is at or under the budget target (~120 solo / ~180 coordinated), or the migration decision records why not**; the document loop closes.
3. Operator approves; merge; prune the branch on the next hygiene sweep. End by refreshing `docs/operator/open-items.md` and checking the board for decision tasks awaiting the operator.
4. **The measurement stands ready for the fleet:** when the operator later circulates the v1.7 follow-up questionnaire, the migration decision's before/after figures and field-tested-removal list are its input. If a removed rule's incident recurs before then, record it in Key Insights immediately - that recurrence is exactly the evidence the next version needs.
