# Specification: Ralph CLI Completion Detection

## Overview

This specification defines the CLI-controlled completion detection mechanism for the Ralph autonomous workflow. It replaces the dual detection mechanism (CLI task status + agent promise) with a single, reliable source of truth: the CLI reading structured task status from prd.json.

## Glossary

- **Ralph**: The autonomous task execution workflow in OpenSpec
- **prd.json**: Product Requirements Document - structured JSON file containing task definitions and completion status
- **Task**: A single unit of work defined in prd.json with id, title, description, acceptanceCriteria, priority, and passes fields
- **CLI**: The openspec command-line interface, specifically the `openspec ralph` command
- **Agent**: The AI coding agent (opencode, claude-code, etc.) spawned by the CLI to implement tasks

## Requirements

### REQ-001: CLI-Owned Task Selection

The CLI **MUST** read prd.json at the start of each iteration to determine:
- Which tasks have `passes: false` (pending)
- The pending task with lowest `priority` number (next task to implement)
- Total count of pending tasks (`remaining`)

**Scenario 1.1: Single pending task**
Given prd.json contains:
```json
{"tasks": [
  {"id": "T-001", "priority": 1, "passes": true},
  {"id": "T-002", "priority": 2, "passes": false}
]}
```
When the loop starts an iteration
Then the CLI selects T-002 as the next task
And includes only T-002 in the agent prompt

**Scenario 1.2: Multiple pending tasks**
Given prd.json contains:
```json
{"tasks": [
  {"id": "T-001", "priority": 1, "passes": false},
  {"id": "T-002", "priority": 2, "passes": false}
]}
```
When the loop starts an iteration
Then the CLI selects T-001 as the next task (lower priority number)
And T-002 remains pending for future iterations

**Scenario 1.3: All tasks complete**
Given prd.json contains:
```json
{"tasks": [
  {"id": "T-001", "priority": 1, "passes": true},
  {"id": "T-002", "priority": 2, "passes": true}
]}
```
When the loop starts an iteration
Then the CLI detects `remaining === 0`
And exits immediately without spawning an agent

### REQ-002: Agent Prompt Simplification

The agent prompt **MUST NOT** contain:
- References to `<promise>COMPLETE</promise>`
- Instructions to verify all tasks are complete
- Instructions to output any completion signal

The agent prompt **MUST** contain:
- Clear identification of ONE task to implement
- Context file paths to read
- Steps: implement → test → update prd.json → commit
- Explicit instruction to update `passes: true` for the current task only

**Scenario 2.1: Prompt content verification**
Given the CLI constructs a prompt for task T-003
When the prompt is generated
Then it contains the task title and description for T-003
And it contains steps to implement and update prd.json
And it does NOT contain the text "<promise>"
And it does NOT contain "verify all tasks"

### REQ-003: CLI-Owned Completion Detection

The CLI **MUST** determine completion solely by reading prd.json.

The CLI **MUST NOT** rely on parsing agent stdout for completion signals.

**Scenario 3.1: Normal completion flow**
Given iteration N has just finished
And the agent updated prd.json setting `passes: true` for T-001
When iteration N+1 starts
Then the CLI reads prd.json
And detects remaining === 0 (if T-001 was last task)
And exits successfully

**Scenario 3.2: Promise output ignored**
Given the agent outputs "<promise>COMPLETE</promise>" in its stdout
When the CLI scans the output
Then the CLI ignores this signal
And proceeds to the next iteration
And the next iteration's pre-flight check determines actual completion

### REQ-004: Safety Mechanisms

The CLI **MUST** implement max-iterations as a hard safety limit.

If `remaining === 0` is never detected within `maxIterations`:
- The CLI **MUST** exit with error code 1
- The CLI **SHOULD** display a warning message

**Scenario 4.1: Max iterations reached**
Given `maxIterations = 5`
And prd.json always has at least one task with `passes: false`
When the loop completes iteration 5
Then the CLI exits with code 1
And prints "Max iterations reached (5). Some tasks may remain incomplete."

**Scenario 4.2: Completion before max**
Given `maxIterations = 10`
And all tasks have `passes: true` after iteration 3
When iteration 4 starts
Then the pre-flight check detects completion
And the CLI exits with code 0

### REQ-005: Optional No-Progress Signal

The CLI **MAY** support an optional `<promise>NO_PROGRESS</promise>` signal.

If detected, the CLI **SHOULD**:
- Print a warning: "Agent reported no progress this iteration"
- Continue to the next iteration (do not exit)
- Include the warning in iteration summary

**Scenario 5.1: Agent signals no progress**
Given the agent outputs "<promise>NO_PROGRESS</promise>"
When the CLI scans the output
Then the CLI prints a warning about no progress
And continues to iteration N+1

**Scenario 5.2: No signal means normal progress**
Given the agent does NOT output "<promise>NO_PROGRESS</promise>"
When the CLI scans the output
Then no warning is printed
And the loop continues normally

## Constraints

- The prd.json schema **MUST NOT** change
- Task priority ordering **MUST NOT** change
- Subprocess spawning and iteration timing **MUST NOT** change
- Error handling for subprocess failures **MUST NOT** change

## Acceptance Criteria

1. Ralph loop completes successfully when all tasks have `passes: true` in prd.json
2. Agent prompts contain no references to `<promise>COMPLETE</promise>`
3. Agent stdout is not scanned for completion signals
4. Completion is detected by reading prd.json at iteration start
5. Max-iterations safety limit still functions correctly
6. All existing ralph-driven changes can still be executed
