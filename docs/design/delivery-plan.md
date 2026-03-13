# Shipyard Delivery Plan

## Version: 1.0 | Date: 2026-03-13

---

## Executive Summary

The Shipyard has 14 working patterns extracted from a real product, a custom framework (Moribashi), a 12-step manual recipe for adding domain services, and a fully wired DevContainer harness. The hard engineering is done. What remains is **formalization and automation** -- turning implicit knowledge into machine-readable structures that AI agents can act on.

This plan is designed for a solo developer with AI agent assistance. The guiding principle is: **get to a working first ship in weeks, not months.** Every milestone produces usable output. Nothing is built speculatively.

---

## 1. Work Breakdown Structure

### WS1: Foundation (Schemas & Formats)

| ID | Task | Effort | AI-delegable |
|----|------|--------|--------------|
| WS1.1 | Decide manifest format (YAML vs JSON) | 1h | No -- design decision |
| WS1.2 | Define `shipyard.manifest` JSON Schema | 2-4h | Yes |
| WS1.3 | Define catalog entry JSON Schema | 2-4h | Yes |
| WS1.4 | Write manifest for aegir itself (the "ship zero") | 2h | Yes, with review |
| WS1.5 | Create `catalog/` directory structure | 1h | Yes |
| WS1.6 | Set up schema validation (ajv or similar) | 2h | Yes |

### WS2: Catalog Formalization

| ID | Task | Effort | AI-delegable |
|----|------|--------|--------------|
| WS2.1 | Formalize `build.pnpm-turbo` | 2h | Yes |
| WS2.2 | Formalize `db.postgres-isolated` | 2h | Yes |
| WS2.3 | Formalize `harness.devcontainer` | 3h | Yes |
| WS2.4 | Formalize `auth.oidc-keycloak` | 3h | Yes |
| WS2.5 | Formalize `tenancy.org-based` | 3h | Yes |
| WS2.6 | Formalize `api.graphql-federation` | 3h | Yes |
| WS2.7 | Formalize `frontend.nuxt-spa` | 2h | Yes |
| WS2.8 | Formalize `observability.grafana-stack` | 2h | Yes |
| WS2.9 | Formalize `orchestration.conductor` | 3h | Yes |
| WS2.10 | Formalize `cdc.debezium-kafka` | 2h | Yes |
| WS2.11 | Formalize `storage.s3` | 1h | Yes |
| WS2.12 | Formalize `email.smtp` | 1h | Yes |
| WS2.13 | Formalize `agents.ai-conversation` | 3h | Yes |
| WS2.14 | Formalize `infra.aws-eks-gitops` | 2h | Yes |
| WS2.15 | Formalize `service.domain-subgraph` (the 12-step recipe) | 4h | Yes |

### WS3: Scaffolder

| ID | Task | Effort | AI-delegable |
|----|------|--------|--------------|
| WS3.1 | Define scaffolder CLI interface (commands, flags, prompts) | 2h | No -- design decision |
| WS3.2 | Build `shipyard init` -- create a new ship from a profile | 8-12h | Partially |
| WS3.3 | Build profile system (which patterns compose a "baseline") | 4h | Yes |
| WS3.4 | Template engine for parameterized pattern files | 4-6h | Partially |
| WS3.5 | Manifest generation on scaffold | 2h | Yes |
| WS3.6 | End-to-end test: scaffold a ship, verify it builds | 4h | Yes |

### WS4: Applicator

| ID | Task | Effort | AI-delegable |
|----|------|--------|--------------|
| WS4.1 | Define Applicator agent prompt structure | 4h | Partially |
| WS4.2 | Build manifest reader/parser for agent context | 2h | Yes |
| WS4.3 | Build catalog search/match logic | 3h | Yes |
| WS4.4 | Build precondition checker | 3h | Yes |
| WS4.5 | Build manifest updater (post-application) | 2h | Yes |
| WS4.6 | Agent workflow: read manifest -> find pattern -> check preconditions -> apply -> update manifest | 8h | Partially |
| WS4.7 | Test: apply `service.domain-subgraph` to aegir via Applicator | 4h | Partially |

### WS5: Drift Detection & Catalog Management

| ID | Task | Effort | AI-delegable |
|----|------|--------|--------------|
| WS5.1 | Define drift detection strategy | 2h | No -- design decision |
| WS5.2 | Build `shipyard status` -- compare manifest to reality | 6h | Partially |
| WS5.3 | Build `shipyard catalog add` -- propose new catalog entry | 4h | Yes |
| WS5.4 | Build `shipyard catalog list/show` -- browse catalog | 2h | Yes |
| WS5.5 | Catalog versioning strategy (semver, changelog) | 2h | No -- design decision |

### WS6: CLI & Interface Polish

| ID | Task | Effort | AI-delegable |
|----|------|--------|--------------|
| WS6.1 | CLI framework setup (commander, citty, or similar) | 2h | Yes |
| WS6.2 | `shipyard init` command wiring | 2h | Yes |
| WS6.3 | `shipyard apply <pattern>` command wiring | 2h | Yes |
| WS6.4 | `shipyard status` command wiring | 2h | Yes |
| WS6.5 | `shipyard catalog` subcommands | 2h | Yes |
| WS6.6 | Error handling, help text, validation | 3h | Yes |

---

## 2. Milestone Plan

### M0: Foundation -- "The schemas exist and aegir describes itself"

**Target: 1-2 days**

| Deliverable | Definition of Done |
|---|---|
| Manifest format decision made | Documented in decision log |
| `shipyard.manifest` JSON Schema | Validates against test data, covers all PRD Section 3.1 fields |
| Catalog entry JSON Schema | Validates against test data, covers all PRD Section 3.2 fields |
| `shipyard.manifest` for aegir | aegir's own manifest passes schema validation |
| 3 catalog entries formalized | At minimum: `build.pnpm-turbo`, `db.postgres-isolated`, `harness.devcontainer` |
| `catalog/` directory exists with structure | Convention established, README in place |

**Exit criteria:** You can point at aegir's manifest and three catalog entries, all machine-readable and schema-valid.

**Tasks:** WS1.1-WS1.6, WS2.1-WS2.3

---

### M1: First Ship -- "I can scaffold a new project and it builds"

**Target: 1-2 weeks after M0**

| Deliverable | Definition of Done |
|---|---|
| All 14+1 catalog entries formalized | Every pattern from the audit has a structured catalog entry |
| Scaffolder CLI (`shipyard init`) | Running `shipyard init my-project --profile=saas` produces a buildable project |
| At least one profile defined | The "saas" profile selects a baseline set of patterns |
| Scaffolded ship builds and starts | `pnpm install && pnpm build` succeeds; devcontainer starts; gateway responds |
| Scaffolded ship has a valid manifest | Manifest reflects exactly what was applied |

**Exit criteria:** A new developer (or the founder starting a new product) can run one command and get a working, documented, convention-following project in under 5 minutes.

**Tasks:** WS2.4-WS2.15, WS3.1-WS3.6, WS6.1-WS6.2

---

### M2: Pattern Application -- "I can add capabilities to an existing ship"

**Target: 1-2 weeks after M1**

| Deliverable | Definition of Done |
|---|---|
| Applicator agent workflow | Agent reads manifest, finds pattern, checks preconditions, applies, updates manifest |
| `shipyard apply <pattern>` works | Running `shipyard apply service.domain-subgraph --name=billing` on a ship produces a working billing subgraph |
| Manifest updated automatically | After applying, manifest reflects new capabilities and catalog refs |
| Precondition checking | Applicator refuses to apply a pattern whose preconditions aren't met, with a clear message |
| Tested on aegir | Successfully apply a new domain service to aegir via Applicator |

**Exit criteria:** Natural language request ("add a billing service to my project") results in working code, updated manifest, and passing tests.

**Tasks:** WS4.1-WS4.7, WS6.3

---

### M3: Full Loop -- "The Shipyard manages its own catalog and detects drift"

**Target: 2-4 weeks after M2**

| Deliverable | Definition of Done |
|---|---|
| `shipyard status` | Shows which patterns are applied, which are outdated, what drifted |
| Drift detection | Compares manifest claims to actual file state; reports discrepancies |
| `shipyard catalog add` | Agent-assisted workflow to extract a new pattern from existing code |
| Catalog versioning | Patterns have semver, ships can pin or float versions |
| `shipyard catalog list/show` | Browse and inspect available patterns |

**Exit criteria:** The Shipyard is self-sustaining -- new patterns discovered in ships get promoted back to the catalog, and ships can be audited for conformance.

**Tasks:** WS5.1-WS5.5, WS6.4-WS6.6

---

## 3. Critical Path

```
M0: Foundation
  [manifest schema] ──→ [aegir manifest] ──→ [catalog schema] ──→ [first 3 entries]
                                                      │
M1: First Ship                                        ▼
  [remaining catalog entries] ──→ [template engine] ──→ [scaffolder] ──→ [e2e test]
                                                                            │
M2: Application                                                             ▼
  [applicator agent prompt] ──→ [precondition checker] ──→ [applicator workflow] ──→ [test on aegir]
                                                                                        │
M3: Full Loop                                                                           ▼
  [drift strategy] ──→ [status command] ──→ [catalog management]
```

**The critical path is:** manifest schema -> catalog schema -> catalog entries -> template engine -> scaffolder -> applicator -> drift detection.

**What can be parallelized:**
- Catalog entry formalization (WS2) can be done in parallel by multiple AI agents -- each entry is independent
- CLI framework setup (WS6.1) can happen in parallel with catalog formalization
- Applicator prompt design (WS4.1) can start during M1 once a few catalog entries exist
- Drift detection strategy design (WS5.1) can happen anytime after M0

---

## 4. Dependency Map

```
WS1.1 (format decision)
  └──→ WS1.2 (manifest schema)
        ├──→ WS1.4 (aegir manifest)
        └──→ WS1.3 (catalog entry schema)
              └──→ WS2.* (all catalog entries)  [parallelizable]
                    └──→ WS3.2 (scaffolder build)
                          ├──→ WS3.3 (profiles)
                          ├──→ WS3.4 (template engine)
                          └──→ WS3.6 (e2e test)
                                └──→ WS4.* (applicator)  [depends on working scaffold]
                                      └──→ WS5.* (drift)  [depends on working applicator]

WS6.1 (CLI framework)  ←── independent, start anytime
  └──→ WS6.2-WS6.6 (command wiring)  ←── wire up as features land
```

**Hard dependencies (cannot start until predecessor completes):**
- Catalog entries require catalog schema
- Scaffolder requires catalog entries (at least the baseline set)
- Applicator requires scaffolder (needs a ship to apply patterns to)
- Drift detection requires applicator (needs applied patterns to compare against)

**Soft dependencies (can start early with partial input):**
- Applicator prompt design can start once 3-4 catalog entries exist
- CLI framework is fully independent
- Profile design can start once catalog structure is decided

---

## 5. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| R1 | **Over-engineering the catalog format.** Spending weeks on the perfect schema before producing any ships. | High | High | Timebox M0 to 2 days. Start with a minimal schema that covers the 3 simplest patterns. Iterate the schema as you formalize more complex patterns. The schema is versioned -- it will evolve. |
| R2 | **Template complexity explosion.** The 14 patterns have deep interdependencies (e.g., auth requires DB isolation, federation requires gateway). Parameterizing all combinations becomes combinatorial. | Medium | High | Don't parameterize everything. Start with **profiles** (fixed bundles of patterns) rather than a la carte selection. The "saas" profile includes auth+tenancy+federation+DB+harness as a unit. Add granular selection later when you understand which combinations actually get used. |
| R3 | **Applicator reliability.** AI agents may produce inconsistent or broken code when applying patterns, especially for complex ones like `auth.oidc-keycloak`. | Medium | Medium | Write detailed `application_instructions` in catalog entries (the 12-step recipe is the gold standard). Include verification steps (`test_criteria`). Run the applicator against aegir itself as the first test -- you'll know immediately if output is wrong because you know what correct looks like. |
| R4 | **Shipyard becomes the product.** Solo developer spends all time building tooling instead of shipping products that generate revenue. | High | Critical | **M1 is the forcing function.** After M1, stop Shipyard development and build a real ship. Return to M2/M3 only when you hit friction that the Applicator would solve. Let real usage drive what gets built next. Set a hard calendar deadline: if M1 isn't done in 2 weeks, ship the product manually and formalize later. |
| R5 | **Moribashi coupling.** The catalog patterns are tightly coupled to Moribashi conventions. Ships that use different frameworks can't use the catalog. | Low (near-term) | Medium (long-term) | Accept this for now. The first 3-5 ships will all use Moribashi -- that's the point. When a non-Moribashi ship is needed, fork the relevant catalog entries with framework-specific variants. Don't build framework abstraction until you have at least 2 frameworks to abstract over. |

---

## 6. Resource Allocation

### What the solo developer should do (high-judgment, low-volume)

- **All design decisions** (WS1.1, WS3.1, WS5.1, WS5.5) -- format choices, CLI UX, drift strategy
- **Review all AI-generated catalog entries** -- you know the patterns intimately; the AI doesn't
- **Applicator prompt engineering** (WS4.1) -- the quality of the applicator depends on the prompt
- **Profile design** (WS3.3) -- which patterns compose a baseline is a product decision
- **First scaffolder test** (WS3.6) -- manually verify the first scaffolded ship is correct
- **Risk monitoring** -- are you building tooling or shipping products?

### What AI agents should do (high-volume, lower-judgment)

- **Catalog entry formalization** (WS2.*) -- mechanical translation of existing code into structured format. Give the agent the schema, one example entry, and the source code for each pattern. Review output.
- **JSON Schema writing** (WS1.2, WS1.3) -- provide field lists from the PRD, agent produces schema
- **CLI boilerplate** (WS6.*) -- standard commander/citty setup, command wiring
- **Template file generation** (WS3.4) -- parameterize existing files with placeholders
- **Test writing** (WS3.6, WS4.7) -- agent writes tests, you run them
- **Manifest generation** (WS1.4, WS3.5) -- mechanical, schema-driven

### Suggested daily rhythm

1. **Morning (30 min):** Make one design decision. Write it in the decision log. Give AI agents their tasks for the day.
2. **Working session (2-4h):** AI agents produce catalog entries, templates, CLI code. You review in batches.
3. **End of day (30 min):** Review what landed. Update session log. Identify tomorrow's decision.

### Estimated total effort

| Milestone | Developer hours | AI agent hours | Calendar time |
|-----------|----------------|----------------|---------------|
| M0 | 4h | 8h | 1-2 days |
| M1 | 12h | 30h | 1-2 weeks |
| M2 | 10h | 20h | 1-2 weeks |
| M3 | 8h | 16h | 2-4 weeks |
| **Total** | **~34h** | **~74h** | **~5-8 weeks** |

These are working estimates, not commitments. The AI agent hours represent wall-clock time for agent sessions, not continuous human attention.

---

## 7. Decision Log Template

Track each open question using this format. Decisions should be recorded as they're made, with rationale preserved for future reference.

### Format

```
### DEC-NNN: [Decision Title]

**Status:** Open | Decided | Revisited
**Date opened:** YYYY-MM-DD
**Date decided:** YYYY-MM-DD
**Decider:** [who made the call]

**Context:**
[Why this decision matters. What depends on it.]

**Options considered:**
1. [Option A] -- [pros/cons]
2. [Option B] -- [pros/cons]
3. [Option C] -- [pros/cons]

**Decision:**
[What was decided and why]

**Consequences:**
[What this enables or constrains going forward]
```

### Open Decisions (as of 2026-03-13)

---

### DEC-001: Manifest Format

**Status:** Decided
**Date opened:** 2026-03-13
**Date decided:** 2026-03-13
**Decider:** Founder

**Context:**
The ship manifest is the agent's primary source of truth. Format affects tooling, readability, and parsing complexity. Everything downstream depends on this choice.

**Options considered:**
1. **YAML** -- Human-friendly, comment support, used by K8s/Helm/Docker Compose (team already familiar). Requires a YAML parser dependency.
2. **JSON** -- Zero-dependency parsing in Node.js, strict syntax, no comments. Noisy for humans.
3. **JSON with comments (JSONC)** -- Best of both. VS Code native support. Not standard JSON.

**Decision:** YAML. The Shipyard ecosystem already uses YAML extensively (docker-compose, Traefik config, Terraform). Comments in manifests will be valuable for documenting constraints and conventions inline. The `yaml` npm package is mature and tiny.

**Consequences:** All schemas (manifest, catalog entry) will use YAML. Zod validators will parse YAML input. The `yaml` npm package is added as a dependency.

---

### DEC-002: Catalog Storage

**Status:** Decided
**Date opened:** 2026-03-13
**Date decided:** 2026-03-13
**Decider:** Founder

**Context:**
Where do catalog entries live? This affects how agents discover patterns, how versioning works, and whether the catalog can be shared across Shipyard instances.

**Options considered:**
1. **Files in this repo** (`catalog/<pattern-id>/`) -- Simple, version-controlled, agent-readable. Scaling limit if catalog grows very large.
2. **Separate repo** -- Clean separation, independent versioning. Adds friction for development.
3. **Database/API** -- Rich querying. Massive overkill for the current scale.

**Decision:** Files in this repo. Start with `catalog/<pattern-id>/pattern.yaml` plus any template files. Move to a separate repo only if/when multiple Shipyard instances need to share a catalog.

**Consequences:** Catalog entries are version-controlled alongside the code. CI can validate all entries. No external dependencies for catalog access.

---

### DEC-003: Drift Handling Strategy

**Status:** Decided
**Date opened:** 2026-03-13
**Date decided:** 2026-03-13
**Decider:** Founder

**Context:**
Ships will inevitably diverge from their applied patterns. The question is how to detect this and what to do about it.

**Options considered:**
1. **Checksum-based** -- Hash key files when patterns are applied; compare later. Simple but brittle (any change = drift, even intentional ones).
2. **Structural comparison** -- Check that expected files/directories/configs exist and contain required elements. Tolerant of additions, flags missing pieces.
3. **Manifest-only** -- Trust the manifest. If the manifest says a pattern is applied, it is. Drift is a human problem.

**Decision:** Structural comparison (option 2) for M3. Defer to M3 entirely -- don't build it until ships exist that could actually drift. Start with manifest-only (option 3) for M1/M2.

**Consequences:** No drift detection work until M3. Manifest is trusted as source of truth for M0-M2.

---

### DEC-004: Catalog Granularity

**Status:** Decided
**Date opened:** 2026-03-13
**Date decided:** 2026-03-13
**Decider:** Founder

**Context:**
Should catalog entries be fine-grained (single files), feature slices (a vertical capability), or full capability bundles?

**Options considered:**
1. **Single files** -- Maximum composability, high assembly cost.
2. **Feature slices** -- One entry = one capability (e.g., "add a domain subgraph"). Matches how developers think.
3. **Full bundles** -- One entry = entire stack layer. Inflexible.

**Decision:** Feature slices (option 2). This matches the existing pattern audit -- each entry in the audit IS a feature slice. The 12-step recipe for adding a domain service is the archetype: it touches many files but delivers one coherent capability.

**Consequences:** Each catalog entry represents one coherent capability. Entries can depend on each other via `preconditions`.

---

### DEC-005: Profile Flexibility

**Status:** Decided
**Date opened:** 2026-03-13
**Date decided:** 2026-03-13
**Decider:** Founder

**Context:**
When scaffolding from a profile, can individual patterns be skipped? Or is a profile all-or-nothing?

**Options considered:**
1. **All-or-nothing** -- Profiles are opinionated bundles. Take it or leave it. Simplest to implement and test.
2. **Skip list** -- `shipyard init --profile=saas --skip=orchestration.conductor`. More flexible, but untested pattern combinations may break.
3. **Additive** -- Start minimal, add patterns one at a time. No profiles at all.

**Decision:** All-or-nothing for M1 (option 1). The first profile should be battle-tested as a unit. Add skip-list support in M2 once the Applicator exists to handle partial setups. Additive (option 3) becomes possible naturally once the Applicator works.

**Consequences:** M1 scaffolder produces one opinionated bundle. No conditional logic for pattern inclusion in v0.1.

---

## Appendix: Recommended Execution Order (First 2 Weeks)

### Day 1
- [ ] Make DEC-001 (manifest format)
- [ ] Make DEC-002 (catalog storage)
- [ ] Make DEC-004 (catalog granularity)
- [ ] AI agent: draft manifest JSON Schema
- [ ] AI agent: draft catalog entry JSON Schema

### Day 2
- [ ] Review and finalize both schemas
- [ ] Write aegir's own `shipyard.manifest`
- [ ] AI agent: formalize `build.pnpm-turbo`, `db.postgres-isolated`, `harness.devcontainer`
- [ ] Review catalog entries

### Days 3-5
- [ ] AI agents: formalize remaining 11 catalog entries (batch of 3-4 per session)
- [ ] Review each batch
- [ ] Make DEC-005 (profile flexibility)
- [ ] Design scaffolder CLI interface (WS3.1)

### Days 6-8
- [ ] Build template engine (WS3.4)
- [ ] Build scaffolder core (WS3.2)
- [ ] Define "saas" profile (WS3.3)

### Days 9-10
- [ ] End-to-end test: scaffold a ship (WS3.6)
- [ ] Fix issues found during testing
- [ ] **M1 complete -- stop and build a real ship**

### After real ship experience (return for M2)
- [ ] Design Applicator agent prompt based on friction encountered
- [ ] Build Applicator workflow
- [ ] Test on aegir
