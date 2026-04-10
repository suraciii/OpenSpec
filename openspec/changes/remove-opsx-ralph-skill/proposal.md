# Proposal: Remove opsx-ralph Skill While Keeping Command

## Why

After completing the `cli-owned-ralph-completion` refactor, the automated `openspec ralph` command no longer relies on the `opsx-ralph` skill. Instead, the CLI builds iteration prompts directly (`buildIterationPrompt()`) and spawns the agent with the prompt string.

The `opsx-ralph` skill currently serves two roles:
1. **Automated loop**: Used by `openspec ralph` via direct prompt (skill is never invoked)
2. **Manual debugging**: Used when users type `/opsx-ralph` for single-iteration execution

Since role #1 no longer exists, maintaining the skill file adds unnecessary complexity:
- Skill template requires updates alongside command template
- `openspec init` generates a skill directory that most users never use
- Profile sync and drift detection must account for the skill directory
- The skill and command contain duplicated instructional content

We should remove the skill entirely while preserving the `/opsx-ralph` command for manual single-iteration debugging.

## What Changes

1. **Remove `getOpsxRalphSkillTemplate()`** from `src/core/templates/workflows/ralph.ts`
2. **Remove skill export** from `src/core/templates/skill-templates.ts`
3. **Remove from `getSkillTemplates()`** in `src/core/shared/skill-generation.ts`
4. **Remove `ralph` → `opsx-ralph` mapping** from `WORKFLOW_TO_SKILL_DIR` in:
   - `src/core/init.ts`
   - `src/core/profile-sync-drift.ts`
5. **Update command template** in `src/core/templates/workflows/ralph.ts` to reflect the simplified agent contract without promise-based completion signals
6. **Update existing skill file** `.opencode/skills/opsx-ralph/SKILL.md` to add deprecation notice (or remove it from repo)
7. **Update tests** for init, skill-generation, and profile-sync-drift

## Capabilities

**Modified Capabilities:**
- `ralph-agent-interface`: Remove skill-based execution path, keep command-only manual path
- `openspec-init`: Skill generation excludes `opsx-ralph`
- `profile-sync`: Drift detection no longer checks for `opsx-ralph` skill

## Impact

- **New projects**: `openspec init` will not create `.opencode/skills/opsx-ralph/`
- **Existing projects**: Existing skill files remain on disk but are no longer updated
- **Manual debugging**: `/opsx-ralph` command continues to work via `.opencode/commands/`
- **Tests**: Multiple test files need assertion updates

## Success Criteria

- `openspec init` does not generate the `opsx-ralph` skill directory
- `/opsx-ralph` command file is still generated
- Profile sync no longer reports drift for missing `opsx-ralph` skill
- All existing tests pass after updates
- No references to `opsx-ralph` skill in template generation