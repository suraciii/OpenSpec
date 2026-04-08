## ADDED Requirements

### Requirement: Iteration Prompt Generation

The system SHALL provide a `buildIterationPrompt()` function in `src/commands/workflow/ralph.ts` that generates a complete natural language prompt for one Ralph iteration.

The function SHALL accept the change name and return a string prompt containing:
- Absolute paths to all context files (proposal, design, specs, prd.json)
- The next pending task (lowest priority number where `passes: false`)
- Full task details: id, title, description, acceptanceCriteria, spec reference
- Step-by-step execution instructions for the AI
- The completion signal `<promise>COMPLETE</promise>` instruction

All file paths in the prompt SHALL use absolute paths generated via `path.resolve()` to prevent AI agent from searching or guessing paths.

The prompt SHALL include the exact git commit command with message format `ralph(<change-name>): <task-id> <task title>`.

#### Scenario: Generate prompt with pending tasks

- **GIVEN** change "my-feature" with prd.json containing tasks T-001 (passes: true), T-002 (passes: false, priority 2), T-003 (passes: false, priority 1)
- **WHEN** `buildIterationPrompt()` is called
- **THEN** prompt contains absolute path to prd.json
- **AND** prompt contains task T-003 (lowest priority among pending)
- **AND** prompt does NOT contain task T-001 (already complete)
- **AND** prompt includes the spec reference path if task has `spec` field

#### Scenario: Generate prompt with spec reference

- **GIVEN** task T-002 has `spec: "specs/auth/spec.md#REQ-002"`
- **WHEN** `buildIterationPrompt()` selects T-002
- **THEN** prompt includes the absolute path to `specs/auth/spec.md`
- **AND** prompt instructs AI to focus on requirement REQ-002

#### Scenario: All tasks already complete

- **GIVEN** all tasks in prd.json have `passes: true`
- **WHEN** `buildIterationPrompt()` is called
- **THEN** function returns `<promise>COMPLETE</promise>` signal directly
- **AND** no opencode run invocation occurs

#### Scenario: Cross-platform path handling

- **GIVEN** project root is `/home/user/project` on Linux
- **WHEN** `buildIterationPrompt()` generates the prompt
- **THEN** all paths use `path.resolve()` output (platform-appropriate separators)
- **AND** no hardcoded forward slashes in path construction

---

### Requirement: Fresh State Per Iteration

The ralph iteration loop SHALL call `generateRalphInstructions()` at the start of each iteration to retrieve the latest prd.json state.

This ensures that:
- Tasks completed in previous iterations are reflected
- Newly discovered tasks (if any) are picked up
- Context file existence is re-checked each iteration

#### Scenario: Task completed in previous iteration is skipped

- **GIVEN** iteration 1 completes task T-001
- **AND** T-001 now has `passes: true` in prd.json
- **WHEN** iteration 2 starts
- **THEN** `generateRalphInstructions()` reflects T-001 as done
- **AND** `buildIterationPrompt()` selects the next pending task
