# aegir - The Shipyard

This file is the entry point for any AI agent (or the developer) working on the Shipyard project.
Read this before making any changes.

---

# Iron clad rules

- Read and follow the `.agents/reference/operating-model.md` to start/resume each session. Don't edit that file unless you explicitly get approval.
- Otherwise, use `.agents/state` to track history in whatever files make sense so our experience together is consistent and relevant.
- Follow the GraphQL naming conventions and other practices from the Moribashi framework. Document conventions adopted there + in general in the state folder as needed.
- Before you scan and figure out what to do, consult easy wins in the `docs/design/` folder.
- Whenever we update patterns/blueprints/etc, make sure to track that in the "thing" itself so versioning is captured. Basically, enable the applicator to always get from A->B (or G, if it's been a while)
- **Always commit on a feature branch and open a PR** after completing work. Never push directly to `main`.

---

## What Is This Project?

The **Shipyard** is a software platform — a meta-project whose sole purpose is to make
building every future software project faster, more consistent, and less duplicative.

It is not an end-user product. Its output is other projects, often referred to as **ships**.

The Shipyard encodes expertise, standards, and reusable solutions in one place, then applies
them to individual ships on demand via AI agents.

---

## Reference Documents

| Document                                                                                                         | Description                                          |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [High-Level Overview](https://docs.google.com/document/d/10ySKUufzEIbg_0HVk_CiY3xx2x_mpIJy/edit)                 | Vision, mental model, the analogy, design principles |
| [Product Requirements Document (PRD)](https://docs.google.com/document/d/1NFMbLVWnr94vY71IQSCDELbDPEbzSymo/edit) | Formal requirements for all core components          |

Read the Overview first if you're getting oriented. Go to the PRD for specifics on schemas,
behavior requirements, and constraints.

---

## Core Mental Model

| Term           | Meaning                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Shipyard**   | This project. The platform that builds and maintains ships.                                                                 |
| **Ship**       | An individual software project produced by the Shipyard.                                                                    |
| **Dry Dock**   | A ship's receptiveness to Shipyard updates — a manifest + consistent structure that lets agents orient and act confidently. |
| **Catalog**    | The library of reusable patterns and solutions. The Shipyard's primary asset.                                               |
| **Scaffolder** | The tool that spins up a new ship pre-loaded with baseline catalog patterns.                                                |
| **Applicator** | The AI agent workflow that applies catalog patterns to a ship on request.                                                   |

**Key principle:** The Shipyard pushes to ships. Ships do not phone home. A ship must be fully
operable as a standalone project with no Shipyard dependency.

---

## How the Shipyard Works

1. Developer makes a natural language request: _"Add structured logging to my API project."_
2. The Applicator reads the target ship's `shipyard.manifest` file to understand its stack,
   conventions, and existing capabilities.
3. It searches the Catalog for a matching pattern (e.g., `logging.structured`).
4. It adapts the pattern to the ship and applies it.
5. It updates the ship's manifest and produces a change summary.

If no catalog entry matches, the Applicator implements from scratch — then prompts to add the
solution to the Catalog for future reuse.

---

## The Ship Manifest

Every ship has a `shipyard.manifest` file (YAML or JSON — TBD, see Open Questions) at its root.
This is the agent's primary source of truth about a ship. Key fields:

- `name` — project identifier
- `type` — web-app | api | cli | library
- `stack` — languages, frameworks, runtime
- `catalog_refs` — installed pattern IDs and versions
- `conventions` — file structure and naming rules
- `capabilities` — what has already been built
- `constraints` — what agents must never change
- `shipyard.dry_dock_version` — manifest schema version

Full schema is defined in the PRD (Section 3.1) and in `schemas/`.

---

## The Catalog

Each catalog entry is a versioned, self-describing pattern. Key fields an entry must have:

- `id` — stable identifier (e.g., `auth.jwt`, `logging.structured`)
- `version` — semver
- `preconditions` — what a ship needs before this can be applied
- `provides` — what capabilities the ship gains
- `application_instructions` — agent-legible steps to apply the pattern
- `test_criteria` — how to verify it worked

Full schema is in the PRD (Section 3.2).

---

## Agent Behavior Rules

If you are an AI agent working in this repo, follow these rules:

1. **Read the manifest first.** For any ship-targeted operation, parse the ship's manifest
   before taking any action. Do not guess at structure.
2. **Catalog before code.** Always search the catalog for an existing pattern before writing
   new code. Reuse is the point.
3. **Respect constraints.** Never modify files or directories listed in a ship's `constraints`
   field.
4. **Update the manifest.** After applying any pattern, update the ship's `catalog_refs` and
   `capabilities` fields to reflect the new state.
5. **Propose catalog additions.** If you implement something new that looks broadly reusable,
   flag it and propose a catalog entry.
6. **Idempotency.** Applying the same pattern twice must not break the ship. Check before writing.
7. **Summarize changes.** After any operation, produce a short summary suitable for a commit message.

---

## Open Questions (as of project start)

These are unresolved design decisions. Do not make assumptions about them — surface them for the
developer to decide.

1. **Manifest format** — YAML (human-friendly) or JSON (zero-dependency parsing)?
2. **Catalog storage** — files in this repo, or a separate structured store?
3. **Drift handling** — how to deal with ships that have diverged from their applied catalog patterns?
4. **Catalog granularity** — single files, feature slices, or full capability bundles?
5. **Profile flexibility** — can individual patterns within a baseline profile be skipped at scaffold time?

---

## Current Status

- [x] Vision and mental model defined
- [x] High-level overview written
- [x] PRD written (v0.1)
- [ ] Manifest schema formalized
- [ ] Catalog structure defined
- [ ] First catalog entries authored
- [ ] Scaffolder built
- [ ] Applicator workflow built
- [ ] First ship scaffolded

---

_This file should stay current. Update the status checklist and open questions as decisions are made._
