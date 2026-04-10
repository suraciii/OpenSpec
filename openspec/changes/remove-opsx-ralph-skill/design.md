# Design: Remove opsx-ralph Skill While Keeping Command

## Context

The `opsx-ralph` skill was originally created when the `openspec ralph` command invoked the agent via `--command opsx-ralph`. After the `cli-owned-ralph-completion` refactor, the CLI generates prompts directly and no longer uses the skill path.

Current architecture:
```
┌─────────────────────────────────────────────────────────────┐
│  Automated `openspec ralph`                                  │
│  └─ buildIterationPrompt() → spawn agent directly           │
│     (NEVER invokes opsx-ralph skill)                        │
├─────────────────────────────────────────────────────────────┤
│  Manual `/opsx-ralph`                                        │
│  └─ Uses command template directly                          │
│     (Does NOT depend on skill content)                      │
└─────────────────────────────────────────────────────────────┘
```

## Goals / Non-Goals

**Goals:**
- Remove skill generation for `opsx-ralph`
- Keep command generation for `opsx-ralph`
- Clean up all skill references in template/sync/init code
- Ensure backward compatibility for manual command usage

**Non-Goals:**
- Remove the `opsx-ralph` command template
- Change the behavior of `openspec ralph` command
- Affect other skills or commands

## Decisions

### Decision 1: Keep command, remove skill

**Rationale:** The command template is self-contained and contains all instructions needed for manual single-iteration debugging. The skill file duplicates this information and adds maintenance overhead.

### Decision 2: Do not auto-delete existing skill files

**Rationale:** Let users clean up manually. Auto-deletion is risky and outside the scope of this change.

### Decision 3: Remove from `WORKFLOW_TO_SKILL_DIR` in both init and profile-sync-drift

**Rationale:** This is the authoritative mapping that drives generation and drift detection.

## Implementation Plan

1. **Update `src/core/templates/workflows/ralph.ts`**:
   - Remove `getOpsxRalphSkillTemplate()` function entirely
   - Update `getOpsxRalphCommandTemplate()` to remove `<promise>COMPLETE</promise>` references

2. **Update `src/core/templates/skill-templates.ts`**:
   - Remove `getOpsxRalphSkillTemplate` from exports

3. **Update `src/core/shared/skill-generation.ts`**:
   - Remove `{ template: getOpsxRalphSkillTemplate(), dirName: 'opsx-ralph', workflowId: 'ralph' }` from `getSkillTemplates()`
   - Keep command in `getCommandTemplates()`

4. **Update `src/core/init.ts`**:
   - Remove `'ralph': 'opsx-ralph'` from `WORKFLOW_TO_SKILL_DIR`

5. **Update `src/core/profile-sync-drift.ts`**:
   - Remove `'ralph': 'opsx-ralph'` from `WORKFLOW_TO_SKILL_DIR`

6. **Clean up existing skill file**:
   - Remove `.opencode/skills/opsx-ralph/SKILL.md` from repo
   - Or mark as deprecated if we want a grace period

7. **Update tests**:
   - `test/commands/workflow/ralph.test.ts` (if skill assertions exist)
   - `test/core/init.test.ts`
   - `test/cli-e2e/ralph-schema.test.ts`
   - `test/core/profile-sync-drift.test.ts`

## Migration

**For existing projects:** No immediate action required. Existing skill files will not be deleted by OpenSpec.

**For new projects:** Skill will not be generated.

**For template regeneration (`openspec init`):** If user runs init again, the skill will not be re-generated.