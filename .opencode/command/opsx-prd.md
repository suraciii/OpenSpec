---
description: Convert OpenSpec change to prd.json task list
agent: build
---

Convert OpenSpec change **$1** to `prd.json` format for Ralph autonomous execution.

## Your Task

Read all OpenSpec artifacts in `openspec/changes/$1/`:
- `proposal.md` - Why/What/Impact/Capabilities
- `design.md` - Technical design and architecture
- `specs/*/spec.md` - Detailed requirements per capability
- `tasks.md` - Reference only, reorganize as needed

Then generate `openspec/changes/$1/prd.json` following the rules below.

---

## Output Format

Write to: `openspec/changes/$1/prd.json`

```json
{
  "project": "[Project Name]",
  "description": "[One-sentence summary from proposal.md]",
  "tasks": [
    {
      "id": "T-001",
      "title": "[Task title]",
      "description": "[What will be implemented - concrete deliverable]",
      "acceptanceCriteria": [
        "[Verify capability works, not just code exists]",
        "Typecheck passes"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

---

## Task Size Rule

**Each task must be completable in ONE Ralph iteration (one context window).**

**A task = smallest independently testable unit that delivers value**

- **If completing a task doesn't add any capability, it's too granular**
- Every task must provide a concrete, verifiable capability
- If you can't test it independently, it's not a complete task

**Rule of thumb:** If you cannot describe the change in 2-3 sentences, it is too big.

### Grouping Rules

- ✅ **DTOs with their usage**: Define DTOs together with the API integration (never standalone)
- ✅ **Tests within tasks**: Every task includes "Tests pass" in acceptance criteria (never standalone)
- ✅ Related DTOs together (Request + Response = complete contract)
- ✅ Simple class with all methods (complete capability)
- ✅ Split by **value delivered**, not by arbitrary code structure

---

## Task Ordering

Order tasks by priority (lower number = higher priority).

**Rule**: Earlier tasks must not depend on later ones.

**Correct**: Database (priority 1) → Backend (priority 2) → UI (priority 3)

---

## Acceptance Criteria

Extract from `specs/*/spec.md` - convert SHALL/SHOULD requirements to verifiable criteria.

**Principle**: Each criterion verifies a **capability works**, not that code exists.

### How to extract from specs

**Spec requirement:**
```
System SHALL use agentOrdId as unique order identifier
Scenario: Query order using agentOrdId
  WHEN system calls order query API
  THEN system SHALL use agentOrdId as query parameter
```

**Becomes acceptance criterion:**
```
"Can query order using agentOrdId and receive correct status"
```

### Standard Criteria (Always Include)

Every task must include:
```
"Typecheck passes"
```

For tasks with testable logic:
```
"Tests pass"
```

For tasks that change UI:
```
"Verify in browser using dev-browser skill"
```

---

## Conversion Rules

1. **Output location**: `openspec/changes/$1/prd.json`
2. IDs: T-001, T-002, etc.
3. Priority: Dependency order (lower number first), then document order
4. All tasks: `passes: false`, empty `notes`
5. Description: Concrete deliverable, not rationale
   - ✅ Good: "Implement RsaHelper class with Encrypt/Decrypt/Sign/Verify methods"
   - ❌ Bad: "Implement RsaHelper class to support new API security"

---

## Before Writing prd.json

Check if `openspec/changes/$1/prd.json` already exists:

- If it exists with a `progress.txt` file containing execution history:
  - Backup both files with timestamp: `prd.json.backup-[timestamp]`
  - Then write new prd.json

---

## After Generation

Inform the user they can run Ralph with:

```
/opsx-ralph $1
```

$ARGUMENTS
