## ADDED Requirements

### Requirement: Unified Task Parser Interface

The system SHALL provide a unified task parsing interface that supports multiple file formats.

The parser SHALL support:
- Markdown format (`tasks.md` with checkbox syntax)
- JSON format (`prd.json` with passes field)

The parser SHALL automatically detect format based on file extension.

#### Scenario: Parse markdown tasks.md

- **WHEN** parser reads `tasks.md` with content `- [x] Task 1\n- [ ] Task 2`
- **THEN** parser returns `{ total: 2, completed: 1 }`

#### Scenario: Parse prd.json format

- **WHEN** parser reads `prd.json` with tasks array
- **THEN** parser counts `passes: true` as completed
- **AND** parser counts total tasks in array

#### Scenario: Format auto-detection

- **WHEN** `getTaskProgressForChange()` is called
- **THEN** system checks for `prd.json` first if schema specifies it
- **AND** falls back to `tasks.md` if prd.json not found
- **AND** returns `{ total: 0, completed: 0 }` if neither exists

---

### Requirement: Schema-Aware Track File Resolution

Task progress functions SHALL read schema configuration to determine tracking file.

The function SHALL use `schema.apply.tracks` to locate the tracking file.

If schema is not available, the function SHALL probe both formats.

#### Scenario: Read tracks from schema

- **GIVEN** change uses ralph-driven schema with `apply.tracks: prd.json`
- **WHEN** `getTaskProgressForChange()` is called
- **THEN** system reads `prd.json` for progress calculation

#### Scenario: Fallback to probe mode

- **GIVEN** change has no schema metadata
- **WHEN** `getTaskProgressForChange()` is called
- **THEN** system checks for `prd.json` first
- **AND** falls back to `tasks.md`
- **AND** returns progress from whichever exists

---

### Requirement: Consolidated Task Counting Logic

The system SHALL eliminate duplicate task counting implementations.

`src/commands/change.ts` SHALL use `getTaskProgressForChange()` from `task-progress.ts`.

`src/core/archive.ts` SHALL use the same function.

`src/core/list.ts` SHALL use the same function.

#### Scenario: Single source of truth for task counting

- **WHEN** code needs task progress
- **THEN** it imports from `src/utils/task-progress.ts`
- **AND** does not implement inline counting logic

---

### Requirement: JSON Task Item Structure

When parsing `prd.json`, the system SHALL extract additional metadata beyond completion status.

Task items parsed from JSON SHALL include:
- `id`: Task identifier (e.g., "T-001")
- `description`: Task title
- `done`: Boolean (mapped from `passes`)
- `priority`: Task priority number (optional)
- `acceptanceCriteria`: Array of criteria (optional)

#### Scenario: Parse full task details

- **WHEN** `parsePrdFile()` reads prd.json
- **THEN** returned task items include all metadata
- **AND** `done` is mapped from `passes` field

#### Scenario: Instructions command uses parsed metadata

- **WHEN** `openspec instructions apply` is called for ralph-driven change
- **THEN** task list includes priority ordering
- **AND** acceptance criteria are available for context

---

### Requirement: Cross-Platform Path Handling

All file path operations SHALL use `path.join()` or `path.resolve()`.

Path handling SHALL work correctly on Windows, macOS, and Linux.

Tests SHALL use `path.join()` for expected path values.

#### Scenario: Windows path compatibility

- **WHEN** system runs on Windows
- **THEN** file paths use backslash separators correctly
- **AND** no hardcoded forward slashes in path construction

#### Scenario: Case-insensitive file lookup

- **WHEN** looking for tracking file on case-insensitive filesystem (Windows, macOS)
- **THEN** `prd.json` and `PRD.JSON` are treated equivalently
