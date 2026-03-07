## Context

OpenSpec currently uses a single schema (`spec-driven`) that generates `tasks.md` with markdown checkboxes for progress tracking. Users want an autonomous agent workflow that executes tasks iteratively using a structured JSON format (`prd.json`) with richer metadata (acceptance criteria, priority, pass/fail status).

Current architecture:
- `schemas/spec-driven/` - single schema with `tasks.md` tracking
- `src/utils/task-progress.ts` - hardcodes `tasks.md` path
- `src/commands/change.ts` - duplicate task counting logic
- `src/commands/workflow/instructions.ts` - uses `schema.apply.tracks` for flexibility

This change introduces `ralph-driven` schema and the `openspec ralph` CLI command to enable autonomous task execution without external scripts.

## Goals / Non-Goals

**Goals:**
- Create new `ralph-driven` schema that generates `prd.json` instead of `tasks.md`
- Abstract task parsing to support both markdown and JSON formats
- Maintain backward compatibility with existing `spec-driven` schema
- Enable `openspec list/status` to read progress from `prd.json`

**Non-Goals:**
- Migrating existing changes from tasks.md to prd.json
- Creating bidirectional sync between formats
- Changing the propose workflow UI/UX
- Providing built-in AI agent (ralph command spawns external tools)
- Supporting non-ralph-driven schemas with ralph command

## Decisions

### D1: Create New Schema vs Modify Existing

**Decision:** Create new `ralph-driven` schema alongside existing `spec-driven`.

**Rationale:**
- Backward compatibility: existing projects continue working unchanged
- User choice: teams can adopt Ralph workflow incrementally
- Clear separation: different execution models (interactive vs iterative)

**Alternatives considered:**
- Modifying spec-driven: breaks existing workflows, forces migration
- Auto-detecting format: ambiguous, could cause unexpected behavior

### D2: Unified Parser with Format Detection

**Decision:** Single `getTaskProgressForChange()` function with format auto-detection.

**Implementation:**
```typescript
// src/utils/task-progress.ts

interface TaskParser {
  parse(content: string): TaskProgress;
  supports(filePath: string): boolean;
}

class MarkdownTaskParser implements TaskParser { ... }
class PrdJsonTaskParser implements TaskParser { ... }

const PARSERS: TaskParser[] = [
  new PrdJsonTaskParser(),   // Try JSON first
  new MarkdownTaskParser(),  // Fallback to markdown
];

export async function getTaskProgressForChange(
  changesDir: string,
  changeName: string,
  tracksFile?: string
): Promise<TaskProgress> {
  if (tracksFile) {
    // Schema-specified tracking file
    const filePath = path.join(changesDir, changeName, tracksFile);
    return parseWithAutoDetect(filePath);
  }
  
  // Probe mode: try prd.json, then tasks.md
  for (const parser of PARSERS) {
    const fileName = parser === PARSERS[0] ? 'prd.json' : 'tasks.md';
    const filePath = path.join(changesDir, changeName, fileName);
    if (await fileExists(filePath)) {
      return parser.parse(await readFile(filePath));
    }
  }
  
  return { total: 0, completed: 0 };
}
```

**Rationale:**
- Schema-aware: uses `tracks` config when available
- Graceful fallback: probes both formats
- Single source of truth: eliminates duplicate logic

### D3: prd.json Task Structure

**Decision:** Use Ralph-compatible JSON structure with minimal extensions.

```json
{
  "project": "OpenSpec",
  "description": "One-line summary",
  "tasks": [
    {
      "id": "T-001",
      "title": "Task title",
      "description": "What to implement",
      "acceptanceCriteria": ["Criterion 1", "Tests pass"],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

**Rationale:**
- Compatible with existing `opsx-ralph.md` expectations
- `passes` field matches Ralph's completion signal
- `acceptanceCriteria` array enables richer verification
- `priority` enables ordered execution

### D4: Schema File Organization

**Decision:** Create `schemas/ralph-driven/` with copied templates.

```
schemas/ralph-driven/
├── schema.yaml          # Schema definition
└── templates/
    ├── proposal.md      # Copy from spec-driven
    ├── spec.md          # Copy from spec-driven
    ├── design.md        # Copy from spec-driven
    └── prd.json         # NEW: prd.json template
```

**Rationale:**
- Copies existing templates (not symlinks for cross-platform compatibility)
- Only `prd.json` is new
- Clear schema separation

### D5: prd.json Generation

**Decision:** prd.json is generated via artifact workflow, not CLI command.

**How it works:**
1. ralph-driven schema defines `prd` artifact with:
   - `generates: prd.json`
   - `template: prd.json`  
   - `requires: [specs, design]`
2. When specs and design are complete, `openspec status` shows prd as "ready"
3. AI agent runs `openspec instructions prd --change <name>` to get:
   - Template structure
   - Instruction on how to convert specs to tasks
   - Dependencies (proposal, specs, design paths)
4. AI generates prd.json based on instructions

**Rationale:**
- Consistent with existing artifact creation pattern (same as tasks.md)
- No new CLI command needed for schema-native workflow
- `/opsx-prd` command exists for migrating spec-driven changes only

### D6: Default Schema Configuration

**Decision:** Support project-level default schema in config.

**Proposed:**
```yaml
# openspec/config.yaml
schema: ralph-driven  # Project default schema
```

**Usage:**
```bash
# Set default during init
$ openspec init --schema ralph-driven

# Or change default later
$ openspec config set schema ralph-driven

# New changes use default automatically
$ openspec new change my-feature  # Uses ralph-driven
```

**Rationale:**
- Most projects use one schema consistently
- Reduces repetition in `openspec new change` commands
- Backward compatible (defaults to spec-driven if not set)

### D7: Ralph CLI Command

**Decision:** Implement `openspec ralph` as a native CLI command for autonomous task execution.

**User Workflow:**
```
1. openspec init --schema ralph-driven
2. /opsx-propose                    # AI skill creates proposal, specs, design, prd.json
3. openspec ralph --change <name>   # CLI executes tasks iteratively
```

**Command Design:**
```bash
openspec ralph --change <name> [options]

Options:
  --change <name>         Change name (required)
  --max-iterations <n>    Maximum iterations (default: 10)
```

**Built-in Prompt:**
The command includes built-in prompt based on `.opencode/command/opsx-ralph.md` format:
- Reads OpenSpec context (proposal, specs, design)
- Reads prd.json and progress.txt
- Implements single user story per iteration
- Updates progress.txt and AGENTS.md
- Outputs `<promise>COMPLETE</promise>` when done

**Implementation Details:**

1. **Pre-execution Checks:**
   - Validate change directory exists
   - Validate prd.json exists (required for ralph-driven)
   - Read current progress from prd.json

2. **Progress Archiving:**
   - Progress log stored at `openspec/changes/<name>/progress.txt`
   - On new run, if progress.txt has content, archive to `openspec/changes/<name>/archive/<timestamp>/progress.txt`
   - Archive includes: timestamp, previous progress content
   - Reset progress.txt with new run header

3. **Iteration Loop:**
   ```typescript
   for (i = 1; i <= maxIterations; i++) {
     // Find highest priority task with passes: false
     const nextTask = getNextPendingTask(prdJson);
     
     // Spawn AI tool with task context
     const result = await spawnAITool(tool, {
       changeName,
       task: nextTask,
       contextFiles: [proposal, specs, design, prd.json]
     });
     
     // Check for completion signal
     if (result.output.includes('<promise>COMPLETE</promise>')) {
       logCompletion();
       break;
     }
     
     // Append iteration result to progress.txt
     appendToProgressLog(result);
   }
   ```

4. **AI Tool Integration:**
   - **Primary**: OpenCode via `opencode run --command opsx-ralph -- <change-name>`
   - Future support: Additional tools (amp, claude) can be added later
   - Built-in prompt: Based on `.opencode/command/opsx-ralph.md` format

5. **Completion Detection:**
   - AI sets `passes: true` for completed task in prd.json
   - AI appends progress to progress.txt
   - When all tasks complete, AI outputs `<promise>COMPLETE</promise>`
   - CLI detects this signal and terminates successfully

6. **Error Handling:**
   - Fatal errors (tool not found, permission denied): immediate exit with code 1
   - Recoverable errors: log warning, continue to next iteration
   - Partial completion: show completed vs remaining tasks on exit

**Rationale:**
- Native CLI integration: consistent with other OpenSpec commands
- No external dependencies: doesn't rely on opsx-ralph.ps1 or opsx-ralph.md
- Progress persistence: archive mechanism preserves history across runs
- Flexible AI tool support: works with any AI tool that can accept stdin/prompts
- Clear contract: AI knows exactly what to do via prd.json structure

**Note:** This command is specifically for ralph-driven schema. For spec-driven changes, users continue using interactive `/opsx-continue-change` workflow.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Users confused by two schemas | Clear naming, documentation in schema descriptions |
| Duplicate template maintenance | Consider template inheritance in future |
| Format detection ambiguity | Prioritize schema-specified file over probe |
| prd.json structure drift | Document schema in code, validate on read |
| AI tool compatibility | Support standard stdin/pipe interface |
| Progress archive bloat | Store in change-specific archive/, not global |

## Migration Plan

1. **Phase 1:** Create ralph-driven schema (this change)
   - Schema definition with prd artifact
   - Task parser refactoring for JSON support
   - Template files (copied from spec-driven + prd.json)

2. **Phase 2:** Config-level schema default
   - Add `schema` field to openspec/config.yaml
   - Update `openspec init` with `--schema` flag
   - Update `openspec new change` to use config default

3. **Phase 3:** Ralph CLI command
   - Implement `openspec ralph --change <name>` command
   - Support multiple AI tools (opencode, amp, claude)
   - Progress archiving to change-specific archive/
   - Completion detection via `<promise>COMPLETE</promise>`

4. **Phase 4:** Documentation
   - Update README with ralph-driven workflow
   - Document ralph command usage and options
   - Add examples for common workflows

**No migration needed for existing changes** - they continue using spec-driven.

**For migrating existing changes to Ralph:**
- Convert tasks.md → prd.json manually or via script
- Or keep using spec-driven for existing changes, use ralph-driven for new changes

**User Workflow (ralph-driven):**
```bash
# 1. Initialize with ralph-driven schema
openspec init --schema ralph-driven

# 2. Create proposal (AI creates all artifacts including prd.json)
/opsx-propose

# 3. Execute tasks autonomously
openspec ralph --change my-feature

# 4. Archive when complete
openspec archive my-feature
```

## Open Questions

1. ~~Should `openspec instructions apply` return task metadata (priority, criteria) for ralph-driven?~~
   - **Resolved:** `openspec ralph` command handles task execution natively, AI reads prd.json directly

2. Should we validate prd.json structure on read?
   - Zod schema for prd.json structure?
   - Or rely on JSON.parse and graceful degradation?

3. ~~Should ralph command support `--dry-run` mode?~~
   - **Decision**: Not in initial implementation. Can be added later if needed.

4. ~~How to handle AI tool installation detection?~~
   - **Resolved**: Check OpenCode in PATH, provide clear error message if missing.
   - Future tools will follow same pattern when supported.

5. ~~Should we support multiple AI tools initially?~~
   - **Decision**: Start with OpenCode only. Add amp/claude support in future iterations based on user demand.
