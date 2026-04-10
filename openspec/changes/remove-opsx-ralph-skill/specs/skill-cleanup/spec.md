# Specification: Remove opsx-ralph Skill

## Overview

This specification defines the removal of the `opsx-ralph` skill generation while preserving the `opsx-ralph` command template for manual single-iteration debugging.

## Requirements

### REQ-001: Remove Skill Template Generation

The system **MUST NOT** generate an `opsx-ralph` skill file during `openspec init`.

**Scenario 1.1: Skill template function removed**
Given `src/core/templates/workflows/ralph.ts`
When inspected
Then `getOpsxRalphSkillTemplate()` function does not exist

**Scenario 1.2: Skill export removed**
Given `src/core/templates/skill-templates.ts`
When inspected
Then `getOpsxRalphSkillTemplate` is not exported

**Scenario 1.3: Skill generation excludes ralph**
Given `src/core/shared/skill-generation.ts`
When `getSkillTemplates()` is called
Then the returned array does not contain an entry with `dirName: 'opsx-ralph'`
And `getCommandTemplates()` still contains an entry with `id: 'ralph'`

### REQ-002: Remove Skill Directory Mapping

The system **MUST NOT** map the `ralph` workflow to a skill directory.

**Scenario 2.1: Init command mapping**
Given `src/core/init.ts`
When `WORKFLOW_TO_SKILL_DIR` is inspected
Then it does not contain a `'ralph'` key

**Scenario 2.2: Profile sync mapping**
Given `src/core/profile-sync-drift.ts`
When `WORKFLOW_TO_SKILL_DIR` is inspected
Then it does not contain a `'ralph'` key

### REQ-003: Preserve Command Template

The system **MUST** continue generating the `/opsx-ralph` command.

**Scenario 3.1: Command template exists**
Given `src/core/templates/workflows/ralph.ts`
When inspected
Then `getOpsxRalphCommandTemplate()` function exists and returns a valid `CommandTemplate`

**Scenario 3.2: Command generation includes ralph**
Given `src/core/shared/skill-generation.ts`
When `getCommandTemplates()` is called
Then the returned array contains an entry with `id: 'ralph'`

### REQ-004: Update Command Template Content

The `opsx-ralph` command template **MUST** reflect the simplified agent contract without promise-based completion signals.

**Scenario 4.1: No promise references in command**
Given `getOpsxRalphCommandTemplate()` output
When inspected
Then its content does not contain the text `<promise>COMPLETE</promise>`
And it does not instruct the agent to output completion signals

### REQ-005: Clean Up Existing Skill File

The existing `.opencode/skills/opsx-ralph/SKILL.md` **MUST** be removed from the repository.

**Scenario 5.1: Skill file removed**
Given the repository root
When `.opencode/skills/opsx-ralph/SKILL.md` is checked
Then the file does not exist

### REQ-006: Tests Updated

All tests involving skill generation and profile sync **MUST** be updated to reflect the removal.

**Scenario 6.1: Init tests updated**
Given `test/core/init.test.ts`
When executed
Then tests do not assert the presence of `opsx-ralph` skill
And tests still assert the presence of `opsx-ralph` command
And all tests pass

**Scenario 6.2: Ralph schema e2e tests updated**
Given `test/cli-e2e/ralph-schema.test.ts`
When executed
Then tests do not assert the generation of `opsx-ralph` skill
And all tests pass
