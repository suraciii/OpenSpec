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

The command SHALL be a **pure loop controller** that delegates all task execution logic to the AI tool.

#### Scenario: Execute ralph command with valid change

- **GIVEN** a change named "my-feature" using ralph-driven schema
- **AND** `prd.json` exists with pending tasks
- **WHEN** user runs `openspec ralph --change my-feature`
- **THEN** command validates the environment
- **AND** command spawns AI tool: `opencode run --command opsx-ralph -- my-feature`
- **AND** command waits for AI tool completion
- **AND** command checks output for `<promise>COMPLETE</promise>` signal

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

**Note:** The CLI only archives old progress. The AI tool (opsx-ralph) is responsible for appending new entries to progress.txt.

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
- AI tool outputs `<promise>COMPLETE</promise>` signal
- Maximum iterations reached
- Fatal error occurs

Each iteration SHALL:
1. Spawn AI tool: `opencode run --command opsx-ralph -- <change-name>`
2. Wait for AI tool to complete
3. Check for completion signal `<promise>COMPLETE</promise>` in output
4. If completion signal found, exit loop successfully
5. Otherwise, continue to next iteration

The command SHALL wait between iterations to avoid overwhelming AI services.

**Note:** The CLI does NOT read prd.json, select tasks, or update progress. All task logic is delegated to the AI tool.

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
- **AND** AI tool completes one task per iteration
- **THEN** command runs 3 iterations
- **AND** exits successfully after all tasks complete

#### Scenario: Reach max iterations without completion

- **GIVEN** prd.json with 5 pending tasks
- **AND** max-iterations set to 3
- **WHEN** command executes 3 iterations
- **AND** not all tasks complete
- **THEN** command outputs incomplete status
- **AND** lists remaining tasks (by reading prd.json for final status)
- **AND** exit code is 1

---

### Requirement: AI Tool Integration

The command SHALL spawn OpenCode as the AI tool for task execution.

The AI tool SHALL be invoked via opencode command:
- **opencode**: `opencode run --command opsx-ralph -- <change-name>`

The command SHALL execute the AI tool from the **project root directory** (not the change directory).

The command SHALL NOT use `shell: true` when spawning the AI tool.

The command SHALL detect OpenCode availability (in PATH) and provide helpful error if not found.

Future versions MAY support additional AI tools (amp, claude, etc.).

#### Scenario: Use opsx-ralph command

- **GIVEN** OpenCode is installed and in PATH
- **AND** change "my-feature" has pending tasks
- **WHEN** user runs `openspec ralph --change my-feature`
- **THEN** command spawns OpenCode with opsx-ralph command
- **AND** passes change name as argument
- **AND** waits for OpenCode to complete
- **AND** stdout/stderr are streamed to console

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
- AI tool returns non-zero exit code (but process started)
- AI tool output parsing fails
- Network errors during AI tool execution

For fatal errors, the command SHALL output clear error message and exit immediately.

For recoverable errors, the command SHALL:
- Log warning to stderr
- Continue to next iteration after delay

**Note:** The CLI does NOT append errors to progress.txt. The AI tool manages progress.txt.

#### Scenario: Fatal error stops execution

- **GIVEN** change directory does not exist
- **WHEN** command starts
- **THEN** command outputs error message
- **AND** exits immediately with code 1
- **AND** no iterations are attempted

#### Scenario: Recoverable error continues

- **GIVEN** iteration 2 encounters network error
- **WHEN** AI tool fails with non-zero exit code
- **THEN** command logs warning to stderr
- **AND** continues to iteration 3 after delay

---

### Requirement: CLI Does NOT Manage Tasks

The command SHALL NOT:
- Read or parse prd.json for task selection
- Select which task to execute next
- Generate prompts or instructions for the AI
- Update prd.json (set passes: true)
- Append to progress.txt

All task-related logic SHALL be handled by the AI tool (opsx-ralph command).

The CLI SHALL only:
- Validate environment
- Archive previous progress
- Loop and spawn AI tool
- Detect completion signal

#### Scenario: CLI remains agnostic to task logic

- **GIVEN** prd.json structure changes in future version
- **WHEN** user runs `openspec ralph --change my-feature`
- **THEN** command continues to work unchanged
- **AND** AI tool (opsx-ralph) handles new prd.json format

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
- **THEN** command executes all tasks via iterative AI tool calls
- **AND** archives progress after completion
- **AND** user can run `openspec archive my-feature` to finalize
