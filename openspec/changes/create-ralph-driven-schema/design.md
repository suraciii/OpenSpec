## Context

OpenSpec currently uses a single schema (`spec-driven`) that generates `tasks.md` with markdown checkboxes for progress tracking. The Ralph autonomous agent system, already integrated via `.opencode/command/opsx-ralph.md`, expects `prd.json` format with richer task metadata.

Current architecture:
- `schemas/spec-driven/` - single schema with `tasks.md` tracking
- `src/utils/task-progress.ts` - hardcodes `tasks.md` path
- `src/commands/change.ts` - duplicate task counting logic
- `src/commands/workflow/instructions.ts` - uses `schema.apply.tracks` for flexibility

## Goals / Non-Goals

**Goals:**
- Create new `ralph-driven` schema that generates `prd.json` instead of `tasks.md`
- Abstract task parsing to support both markdown and JSON formats
- Maintain backward compatibility with existing `spec-driven` schema
- Enable `openspec list/status` to read progress from `prd.json`

**Non-Goals:**
- Migrating existing changes from tasks.md to prd.json
- Modifying Ralph agent implementation (assumes existing opsx-ralph.md is correct)
- Creating bidirectional sync between formats
- Changing the propose workflow UI/UX

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

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Users confused by two schemas | Clear naming, documentation in schema descriptions |
| Duplicate template maintenance | Consider template inheritance in future |
| Format detection ambiguity | Prioritize schema-specified file over probe |
| prd.json drift from Ralph spec | Keep structure minimal, match opsx-ralph.md expectations |

## Migration Plan

1. **Phase 1:** Create ralph-driven schema (this change)
   - Schema definition with prd artifact
   - Task parser refactoring for JSON support
   - Template files (copied from spec-driven + prd.json)

2. **Phase 2:** Config-level schema default
   - Add `schema` field to openspec/config.yaml
   - Update `openspec init` with `--schema` flag
   - Update `openspec new change` to use config default

3. **Phase 3:** Workflow template updates
   - Update propose template to mention prd.json for ralph-driven
   - Update continue-change skill for prd artifact creation

**No migration needed for existing changes** - they continue using spec-driven.

**For migrating existing changes to Ralph:**
- Use existing `/opsx-prd <change>` command to convert tasks.md → prd.json
- Or keep using spec-driven for existing changes, use ralph-driven for new changes

## Open Questions

1. Should `openspec instructions apply` return task metadata (priority, criteria) for ralph-driven?
   - Current: returns basic task list
   - Option: extend TaskItem interface with optional fields

2. Should we validate prd.json structure on generation?
   - Zod schema for prd.json structure?
   - Or rely on template + instruction?
