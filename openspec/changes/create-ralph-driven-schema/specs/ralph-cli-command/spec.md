## ADDED Requirements

### Requirement: Ralph CLI Command

The system SHALL provide a native `openspec ralph` CLI command for autonomous task execution.

The command SHALL require the `--change` argument specifying the change name to execute.

The command SHALL validate that:
- The change directory exists
- The change uses `ralph-driven` schema
- The `prd.json` file exists and contains tasks

The command SHALL support the following options:
- `--max-iterations <n>`: Maximum number of iterations (default: 10)

The command SHALL use built-in prompt based on `opsx-ralph.md` instruction format.

#### Scenario: Execute ralph command with valid change

- **GIVEN** a change named "my-feature" using ralph-driven schema
- **AND** `prd.json` exists with pending tasks
- **WHEN** user runs `openspec ralph --change my-feature`
- **THEN** command loads prd.json and identifies first pending task
- **AND** command spawns configured AI tool with task context
- **AND** command waits for AI tool completion

#### Scenario: Ralph command with missing prd.json

- **GIVEN** a change named "my-feature" using ralph-driven schema
- **AND** `prd.json` does not exist
- **WHEN** user runs `openspec ralph --change my-feature`
- **THEN** command exits with error: "prd.json not found. Generate it first via /opsx-propose"
- **AND** exit code is 1

#### Scenario: Ralph command with invalid change name

- **GIVEN** no change named "invalid-change" exists
- **WHEN** user runs `openspec ralph --change invalid-change`
- **THEN** command exits with error listing available changes
- **AND** exit code is 1



---

### Requirement: Progress Archiving

The system SHALL archive previous run progress before starting a new ralph execution.

Progress logs SHALL be stored at `openspec/changes/<name>/progress.txt`.

On new run, if `progress.txt` exists and contains content beyond the header:
- Create `openspec/changes/<name>/archive/<timestamp>/progress.txt`
- Copy current `progress.txt` to archive location
- Reset `progress.txt` with new run header

The timestamp SHALL be in format `YYYY-MM-DD-HHmmss`.

#### Scenario: Archive previous run

- **GIVEN** change "my-feature" with existing `progress.txt` containing iterations
- **WHEN** user runs `openspec ralph --change my-feature`
- **THEN** system creates `archive/2024-01-15-143022/progress.txt`
- **AND** copies current progress to archive location
- **AND** resets main progress.txt with new run timestamp

#### Scenario: First run without archive

- **GIVEN** change "my-feature" with no `progress.txt`
- **WHEN** user runs `openspec ralph --change my-feature`
- **THEN** system initializes `progress.txt` with header
- **AND** no archive is created

---

### Requirement: Iteration Loop

The command SHALL execute an iteration loop until:
- All tasks have `passes: true`
- Maximum iterations reached
- Fatal error occurs

Each iteration SHALL:
1. Find highest priority pending task (lowest priority number with `passes: false`)
2. Spawn AI tool with task context
3. Wait for AI tool to complete
4. Check for completion signal `<promise>COMPLETE</promise>` in output
5. Append iteration result to `progress.txt`
6. If completion signal found, exit loop successfully

The command SHALL wait between iterations to avoid overwhelming AI services.

#### Scenario: Complete all tasks in single iteration

- **GIVEN** prd.json with 1 pending task
- **WHEN** AI tool executes and completes task
- **AND** AI sets `passes: true` for the task
- **AND** AI outputs `<promise>COMPLETE</promise>`
- **THEN** command exits successfully after iteration 1
- **AND** exit code is 0

#### Scenario: Multiple iterations to complete

- **GIVEN** prd.json with 3 pending tasks
- **WHEN** command executes iteration loop
- **AND** each iteration completes one task
- **THEN** command runs 3 iterations
- **AND** exits successfully after all tasks complete

#### Scenario: Reach max iterations without completion

- **GIVEN** prd.json with 5 pending tasks
- **AND** max-iterations set to 3
- **WHEN** command executes 3 iterations
- **AND** not all tasks complete
- **THEN** command outputs incomplete status
- **AND** lists remaining tasks
- **AND** exit code is 1

---

### Requirement: AI Tool Integration

The command SHALL spawn OpenCode as the AI tool for task execution.

The AI tool SHALL receive:
- Built-in prompt based on `opsx-ralph.md` instruction format
- Change context (change name, paths to context files)

Tool invocation:
- **opencode**: `opencode run --command opsx-ralph -- <change-name>`

The command SHALL detect OpenCode availability (in PATH) and provide helpful error if not found.

Future versions MAY support additional AI tools (amp, claude, etc.).

#### Scenario: Use built-in prompt

- **GIVEN** OpenCode is installed and in PATH
- **AND** change "my-feature" has pending tasks
- **WHEN** user runs `openspec ralph --change my-feature`
- **THEN** command loads built-in prompt from `opsx-ralph.md`
- **AND** spawns OpenCode with the prompt and change context
- **AND** waits for OpenCode to complete

#### Scenario: Missing OpenCode tool

- **GIVEN** OpenCode is not installed or not in PATH
- **WHEN** user runs `openspec ralph --change my-feature`
- **THEN** command exits with error: "OpenCode not found in PATH. Please install OpenCode to use ralph command."
- **AND** exit code is 1

---

### Requirement: Error Handling

The command SHALL distinguish between fatal and recoverable errors.

Fatal errors (immediate exit with code 1):
- Change directory not found
- prd.json not found
- AI tool not found in PATH
- Permission denied for file operations

Recoverable errors (log warning, continue to next iteration):
- AI tool returns non-zero exit code
- AI tool output parsing fails
- Network errors during AI tool execution

For fatal errors, the command SHALL output clear error message and exit immediately.

For recoverable errors, the command SHALL:
- Log warning to stderr
- Append error to progress.txt
- Continue to next iteration after delay

#### Scenario: Fatal error stops execution

- **GIVEN** change directory does not exist
- **WHEN** command starts
- **THEN** command outputs error message
- **AND** exits immediately with code 1
- **AND** no iterations are attempted

#### Scenario: Recoverable error continues

- **GIVEN** iteration 2 encounters network error
- **WHEN** AI tool fails
- **THEN** command logs warning to stderr
- **AND** appends error to progress.txt
- **AND** continues to iteration 3 after delay

---

### Requirement: Progress Tracking

The command SHALL append structured progress information to `progress.txt` after each iteration.

Progress entry format:
```
## [YYYY-MM-DD HH:mm:ss] - Iteration [N]

Task: [T-XXX] [Task Title]
Status: [completed|failed|error]

### What was implemented
[Description]

### Files changed
- [file path]

### Learnings
- [Pattern discovered]
- [Gotcha encountered]

---
```

The first section of `progress.txt` SHALL contain "Codebase Patterns" for accumulated learnings across iterations.

#### Scenario: Progress log after iteration

- **GIVEN** iteration completes successfully
- **WHEN** AI finishes task T-003
- **THEN** progress.txt appends entry with:
  - Timestamp
  - Iteration number
  - Task ID and title
  - Implementation summary
  - Files changed
  - Learnings

---

### Requirement: Workflow Integration

The ralph command SHALL be designed for the following user workflow:

1. Initialize project with ralph-driven schema:
   ```bash
   openspec init --schema ralph-driven
   ```

2. Create proposal and artifacts (AI generates prd.json):
   ```
   /opsx-propose
   ```

3. Execute tasks autonomously:
   ```bash
   openspec ralph --change <name>
   ```

The command SHALL NOT require external scripts or configuration files beyond the OpenSpec standard structure.

#### Scenario: Complete ralph-driven workflow

- **GIVEN** user initializes project with `openspec init --schema ralph-driven`
- **AND** user creates change via `/opsx-propose` (generates prd.json)
- **WHEN** user runs `openspec ralph --change my-feature`
- **THEN** command executes all tasks in prd.json
- **AND** archives progress after completion
- **AND** user can run `openspec archive my-feature` to finalize
