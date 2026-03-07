## Why

OpenSpec currently uses `tasks.md` with markdown checkboxes for tracking implementation progress. This format is designed for interactive, continuous implementation by a single agent session. 

However, the Ralph autonomous agent system uses `prd.json` - a structured JSON format with richer metadata (acceptance criteria, priority, pass/fail status). Users want to use Ralph's iterative execution model with OpenSpec's proposal workflow.

We need to create a new `ralph-driven` schema that generates `prd.json` instead of `tasks.md`, enabling seamless integration with the Ralph autonomous execution loop.

## What Changes

- **NEW**: `ralph-driven` schema that uses `prd.json` as the task tracking artifact
- **NEW**: `prd.json` template with Ralph-compatible structure (id, title, acceptanceCriteria, priority, passes)
- **MODIFIED**: Task progress utilities to support both markdown and JSON formats
- **NEW**: `openspec ralph` CLI command for autonomous task execution
  - Uses OpenCode as primary AI tool
  - Includes built-in prompt based on `opsx-ralph.md` format
- **REMOVED**: Dependency on external `opsx-ralph.ps1` script (replaced by native CLI)

## Capabilities

### New Capabilities

- `ralph-driven-workflow`: Schema and artifacts for Ralph autonomous execution model
- `prd-task-format`: JSON-based task tracking with acceptance criteria and priority ordering
- `multi-format-task-parsing`: Support for both tasks.md (markdown) and prd.json (JSON) in CLI
- `ralph-cli-command`: Native `openspec ralph --change <name>` for autonomous task execution

### Modified Capabilities

None - this is an additive change. The existing `spec-driven` schema remains unchanged for backward compatibility.

## Impact

### New Files
- `schemas/ralph-driven/schema.yaml` - New schema definition
- `schemas/ralph-driven/templates/prd.json` - prd.json template
- `schemas/ralph-driven/templates/proposal.md` - proposal template (inherited from spec-driven)
- `schemas/ralph-driven/templates/spec.md` - spec template (inherited from spec-driven)
- `schemas/ralph-driven/templates/design.md` - design template (inherited from spec-driven)
- `src/commands/workflow/ralph.ts` - Ralph CLI command implementation

### Modified Files
- `src/utils/task-progress.ts` - Add prd.json parsing support
- `src/commands/workflow/instructions.ts` - Extend parseTasksFile for JSON
- `src/commands/change.ts` - Remove duplicate countTasks logic, use unified parser
- `src/cli/index.ts` - Register `openspec ralph` command

### Dependencies
- Node.js built-in `child_process` module for spawning OpenCode
- OpenCode CLI installed and available in PATH
- Built-in prompt based on `opsx-ralph.md` format (embedded in CLI)
