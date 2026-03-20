## ADDED Requirements

### Requirement: Ralph Instructions Command

The system SHALL provide a dedicated `openspec instructions ralph` command for Ralph-specific instruction generation.

The command SHALL be separate from `openspec instructions apply` to accommodate the different needs of the autonomous Ralph workflow vs. the interactive spec-driven workflow.

The command SHALL require the `--change` argument specifying the change name.

#### Scenario: Generate Ralph instructions

- **GIVEN** a change named "my-feature" using ralph-driven schema
- **AND** `prd.json` exists with tasks
- **WHEN** user runs `openspec instructions ralph --change my-feature`
- **THEN** command outputs structured information including:
  - Context file paths (proposal, specs, design, prd.json)
  - Task list with metadata from prd.json
  - Progress statistics
  - Instruction for the AI agent

---

### Requirement: Ralph Instructions JSON Output

The command SHALL support `--json` flag for machine-readable output.

The JSON output SHALL include:
- `changeName`: The change name
- `schemaName`: Always "ralph-driven"
- `contextFiles`: Object mapping artifact IDs to file paths
- `tasks`: Array of task objects from prd.json
- `progress`: Object with `total`, `completed`, `remaining` counts
- `instruction`: Text guidance for the AI agent

#### Scenario: JSON output for AI consumption

- **GIVEN** change "my-feature" with prd.json containing 3 tasks
- **WHEN** user runs `openspec instructions ralph --change my-feature --json`
- **THEN** output includes:
  ```json
  {
    "changeName": "my-feature",
    "schemaName": "ralph-driven",
    "contextFiles": {
      "proposal": "/path/to/proposal.md",
      "specs": "/path/to/specs/",
      "design": "/path/to/design.md",
      "prd": "/path/to/prd.json"
    },
    "tasks": [
      {
        "id": "T-001",
        "title": "...",
        "description": "...",
        "acceptanceCriteria": [...],
        "priority": 1,
        "done": false
      }
    ],
    "progress": {
      "total": 3,
      "completed": 0,
      "remaining": 3
    },
    "instruction": "Read context files, select highest priority pending task..."
  }
  ```

---

### Requirement: Context File Discovery

The command SHALL discover context files from the schema definition.

For ralph-driven schema, context files SHALL include:
- `proposal`: Path to `proposal.md`
- `specs`: Path to `specs/` directory
- `design`: Path to `design.md`
- `prd`: Path to `prd.json`

The command SHALL verify each file exists and only include existing files in output.

#### Scenario: All context files exist

- **GIVEN** change with complete artifacts
- **WHEN** command generates instructions
- **THEN** all four context files are listed

#### Scenario: Missing context files

- **GIVEN** change where `design.md` does not exist
- **WHEN** command generates instructions
- **THEN** design is omitted from contextFiles
- **AND** instruction text notes missing design file

---

### Requirement: Task Parsing from prd.json

The command SHALL read and parse `prd.json` to extract task information.

The command SHALL:
- Validate prd.json is valid JSON
- Extract task array
- Map prd.json fields to standard format:
  - `id` → `id`
  - `title` → `title`
  - `description` → `description`
  - `acceptanceCriteria` → `acceptanceCriteria`
  - `priority` → `priority`
  - `passes` → `done` (converted to boolean)

#### Scenario: Parse prd.json with tasks

- **GIVEN** prd.json with 5 tasks, 2 marked as passes: true
- **WHEN** command parses file
- **THEN** tasks array has 5 entries
- **AND** 2 tasks have `done: true`
- **AND** 3 tasks have `done: false`
- **AND** progress shows completed: 2, remaining: 3

#### Scenario: Invalid prd.json

- **GIVEN** prd.json with invalid JSON syntax
- **WHEN** command attempts to parse
- **THEN** command exits with error
- **AND** error message indicates file path and parsing error

---

### Requirement: AI Agent Instruction

The command SHALL generate instruction text for the AI agent.

The instruction SHALL include:
- How to read context files
- How to select the highest priority pending task
- How to implement the task
- How to update prd.json after completion
- How to append to progress.txt
- When to output completion signal

#### Scenario: Standard instruction text

- **GIVEN** change with pending tasks
- **WHEN** command generates instruction
- **THEN** instruction includes:
  ```
  1. Read all context files listed in contextFiles
  2. Read prd.json to find the highest priority pending task (lowest priority number with done: false)
  3. Implement that single task
  4. Update prd.json: set passes: true for the completed task
  5. Append progress to progress.txt with timestamp and learnings
  6. If all tasks are now complete, output: <promise>COMPLETE</promise>
  ```

---

### Requirement: Progress Information

The command SHALL calculate and return progress statistics.

Progress SHALL include:
- `total`: Total number of tasks in prd.json
- `completed`: Number of tasks with passes: true
- `remaining`: Number of tasks with passes: false

#### Scenario: Mixed completion status

- **GIVEN** prd.json with 5 tasks (2 complete, 3 pending)
- **WHEN** command generates instructions
- **THEN** progress shows:
  ```json
  {
    "total": 5,
    "completed": 2,
    "remaining": 3
  }
  ```

---

### Requirement: Error Handling

The command SHALL handle errors gracefully.

Error cases:
- Change not found: Exit with error message
- Not ralph-driven schema: Exit with error indicating wrong schema
- prd.json not found: Exit with helpful message
- Invalid prd.json: Exit with parsing error details

#### Scenario: Wrong schema

- **GIVEN** change using spec-driven schema
- **WHEN** user runs `openspec instructions ralph --change my-feature`
- **THEN** command exits with error: "Change uses spec-driven schema. Ralph instructions are only available for ralph-driven schema."
- **AND** suggests using `openspec instructions apply` instead
