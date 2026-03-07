## ADDED Requirements

### Requirement: Schema Definition

The system SHALL provide a `ralph-driven` schema that defines artifacts for Ralph autonomous execution.

The schema SHALL define the following artifacts:
- `proposal.md` - What and why of the change
- `specs/**/*.md` - Detailed specifications
- `design.md` - Technical design
- `prd.json` - Structured task list for Ralph execution

The schema's apply phase SHALL track `prd.json` instead of `tasks.md`.

#### Scenario: User initializes change with ralph-driven schema

- **WHEN** user runs `openspec new change <name> --schema ralph-driven`
- **THEN** system creates change directory with `.openspec.yaml` specifying `schema: ralph-driven`
- **AND** the change uses `prd.json` for task tracking

#### Scenario: Schema defines prd.json as tracking file

- **WHEN** system loads ralph-driven schema
- **THEN** `apply.tracks` is set to `prd.json`
- **AND** `apply.requires` includes `prd` artifact

---

### Requirement: prd.json Artifact

The system SHALL support `prd.json` as a valid artifact type in schemas.

The `prd.json` artifact SHALL be generated from proposal, specs, and design artifacts.

The prd.json format SHALL include:
- `project`: Project name
- `description`: One-sentence summary
- `tasks`: Array of task objects with id, title, description, acceptanceCriteria, priority, passes, notes

#### Scenario: Generate prd.json via artifact workflow

- **GIVEN** change uses ralph-driven schema with prd artifact defined
- **AND** proposal, specs, and design artifacts are complete
- **WHEN** AI agent processes prd artifact via `openspec instructions prd --change <name>`
- **THEN** AI reads instructions, template, and dependencies
- **AND** AI generates `prd.json` with tasks extracted from specs and design

#### Scenario: Convert existing spec-driven change to prd.json

- **GIVEN** existing change uses spec-driven schema with tasks.md
- **WHEN** user runs `/opsx-prd <change>` command
- **THEN** command reads tasks.md, proposal, specs, and design
- **AND** converts task list to prd.json format with Ralph-compatible structure

#### Scenario: prd.json structure validation

- **WHEN** prd.json is generated
- **THEN** each task has required fields: id, title, description, acceptanceCriteria (array), priority (number), passes (boolean)
- **AND** task IDs follow pattern T-001, T-002, etc.

---

### Requirement: Task Size Constraints

Each task in prd.json SHALL be sized to be completable in ONE Ralph iteration.

Tasks SHALL represent smallest independently testable units that deliver value.

If completing a task does not add any capability, it SHALL be considered too granular and merged.

#### Scenario: Task is right-sized

- **WHEN** prd.json is generated
- **THEN** each task can be described in 2-3 sentences
- **AND** each task includes "Tests pass" or "Typecheck passes" in acceptance criteria

#### Scenario: Task includes DTO with usage

- **WHEN** task involves creating DTOs
- **THEN** DTO definition is grouped with the API integration task
- **AND** DTO is NOT a standalone task

---

### Requirement: Task Priority Ordering

Tasks SHALL be ordered by priority (lower number = higher priority).

Earlier tasks SHALL NOT depend on later tasks.

#### Scenario: Dependency order is correct

- **WHEN** prd.json is generated
- **THEN** task with priority 1 has no dependencies on tasks with priority > 1
- **AND** task ordering enables sequential implementation

---

### Requirement: Acceptance Criteria from Specs

Acceptance criteria SHALL be extracted from `specs/*/spec.md` SHALL/SHOULD requirements.

Each criterion SHALL verify a capability works, not just that code exists.

Standard criteria SHALL be included:
- "Typecheck passes" for all tasks
- "Tests pass" for tasks with testable logic
- "Verify in browser" for UI tasks

#### Scenario: Extract acceptance criteria from spec

- **GIVEN** spec contains "System SHALL use agentOrdId as unique order identifier"
- **WHEN** prd.json is generated
- **THEN** relevant task includes criterion "Can query order using agentOrdId and receive correct status"

---

### Requirement: Progress Tracking via passes Field

The `passes` boolean field in each task SHALL indicate completion status.

Ralph agent SHALL update `passes: true` after successful implementation and commit.

CLI commands SHALL read `passes` field to calculate progress.

#### Scenario: Ralph marks task complete

- **WHEN** Ralph successfully implements task T-003
- **AND** quality checks pass
- **THEN** Ralph updates prd.json setting `tasks[2].passes = true`
- **AND** commits the change

#### Scenario: CLI shows progress from prd.json

- **WHEN** user runs `openspec list --json`
- **AND** change uses ralph-driven schema
- **THEN** progress is calculated from `prd.json` tasks where `passes: true`
