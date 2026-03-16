# E2E QA Test Plan: Spec Field Integration

## Role
You are a QA Engineer validating the `spec` field feature in OpenSpec's ralph-driven schema.

## Test Objective
Verify that tasks can reference spec requirements via the `spec` field, and that:
1. Tasks WITH `spec` use spec scenarios as primary verification + acceptanceCriteria as supplementary
2. Tasks WITHOUT `spec` use acceptanceCriteria as complete verification
3. The Ralph skill template includes logic to handle both cases

## Test Project Scenario

**Project**: `calculator-lib` - A simple TypeScript calculator library
**Change**: `add-advanced-operations` - Add power and factorial functions
**Schema**: `ralph-driven`

The change has TWO tasks:
- **Task 1** (WITH spec): Add power function, references spec for detailed scenarios
- **Task 2** (WITHOUT spec): Add factorial function, uses only acceptanceCriteria

This tests both code paths in one execution.

## Prerequisites

You are running in a container with:
- OpenSpec CLI available
- OpenCode/opencode CLI available with API access
- Working directory: `/app/test-workspace`

## Test Execution Steps

### Phase 1: Project Setup

**Step 1.1: Create test project**
```bash
mkdir -p /app/test-workspace
cd /app/test-workspace
npm init -y
npm install typescript @types/node --save-dev
npx tsc --init
mkdir -p src
```

**Step 1.2: Create base calculator**
```bash
cat > src/calc.ts << 'EOF'
export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}
EOF
```

**Step 1.3: Initialize OpenSpec**
```bash
openspec init --tools opencode --schema ralph-driven --force
```

**Verification 1.1**: Check `openspec/config.yaml` contains `schema: ralph-driven`

---

### Phase 2: Create Change Artifacts

**Step 2.1: Create proposal**

Create `openspec/changes/add-advanced-operations/proposal.md`:

```markdown
## Why
The calculator library currently only supports basic operations. 
Users need power and factorial functions for advanced calculations.

## What Changes
- **ADDED**: Power function (x^y)
- **ADDED**: Factorial function (n!)

## Capabilities
- **New Capabilities**: math-operations

## Impact
- No breaking changes
- New exports from calc.ts
```

**Step 2.2: Create design**

Create `openspec/changes/add-advanced-operations/design.md`:

```markdown
# Design

## Context
Add power and factorial to calculator.

## Implementation
- power: Use Math.pow or ** operator
- factorial: Iterative or recursive implementation

## Decisions
- Handle edge cases (0^0, negative factorial)
- Return numbers (not BigInt for simplicity)
```

**Step 2.3: Create spec WITH requirement**

Create `openspec/changes/add-advanced-operations/specs/math-operations/spec.md`:

```markdown
# Math Operations Spec

## ADDED Requirements

### Requirement: REQ-001 Power function
The system SHALL provide a power function that calculates base^exponent.

#### Scenario: Positive exponent
- **WHEN** power(2, 3) is called
- **THEN** it SHALL return 8

#### Scenario: Zero exponent
- **WHEN** power(5, 0) is called
- **THEN** it SHALL return 1

#### Scenario: Negative base
- **WHEN** power(-2, 3) is called
- **THEN** it SHALL return -8
```

**Step 2.4: Create prd.json with MIXED tasks**

Create `openspec/changes/add-advanced-operations/prd.json`:

```json
{
  "project": "calculator-lib",
  "description": "Add power and factorial functions",
  "tasks": [
    {
      "id": "T-001",
      "title": "Implement power function",
      "spec": "specs/math-operations/spec.md#REQ-001",
      "description": "Add power(base, exponent) function to calc.ts. Must handle positive, zero, and negative exponents.",
      "acceptanceCriteria": [
        "TypeScript compiles without errors",
        "Function exported from calc.ts"
      ],
      "priority": 1,
      "passes": false
    },
    {
      "id": "T-002",
      "title": "Implement factorial function",
      "description": "Add factorial(n) function to calc.ts. Must handle 0! = 1 and reject negative inputs.",
      "acceptanceCriteria": [
        "factorial(0) returns 1",
        "factorial(5) returns 120",
        "factorial(-1) throws error",
        "TypeScript compiles without errors",
        "Function exported from calc.ts"
      ],
      "priority": 2,
      "passes": false
    }
  ]
}
```

**Key Point**: 
- T-001 has `spec` field referencing REQ-001
- T-002 has NO `spec` field, only `acceptanceCriteria`

**Verification 2.1**: All files created in correct locations

---

### Phase 3: Verify Spec Field in Output

**Step 3.1: Get Ralph instructions**
```bash
openspec instructions ralph --change add-advanced-operations --json > /tmp/ralph-instructions.json
```

**Step 3.2: Verify T-001 has spec field**
```bash
cat /tmp/ralph-instructions.json | jq '.tasks[0].spec'
```

**Expected**: `"specs/math-operations/spec.md#REQ-001"`

**Step 3.3: Verify T-002 does NOT have spec field**
```bash
cat /tmp/ralph-instructions.json | jq '.tasks[1].spec'
```

**Expected**: `null`

**Step 3.4: Verify contextFiles includes specs**
```bash
cat /tmp/ralph-instructions.json | jq '.contextFiles.specs'
```

**Expected**: Path to specs directory

**Verification 3.1**: T-001.spec = spec reference, T-002.spec = null

---

### Phase 4: Verify Template Has Spec Logic

**Step 4.1: Check SKILL.md content**
```bash
cat .opencode/skills/opsx-ralph/SKILL.md | grep -A 5 "If task has"
```

**Expected to find**:
- "If task has `spec` field:"
- Instructions to read spec file
- "If task has no `spec` field:"
- Instructions to use acceptanceCriteria

**Verification 4.1**: SKILL.md contains spec conditional logic

---

### Phase 5: Execute Ralph Workflow

**Step 5.1: Run Ralph for one iteration**
```bash
openspec ralph --change add-advanced-operations --max-iterations 1
```

**Note**: This should execute T-001 (highest priority)

**Step 5.2: Check prd.json after execution**
```bash
cat openspec/changes/add-advanced-operations/prd.json | jq '.tasks[0].passes'
```

**Expected**: `true` (if task completed successfully)

**Step 5.3: Verify power function was implemented**
```bash
grep -A 3 "export function power" src/calc.ts
```

**Expected**: Find power function implementation

**Verification 5.1**: T-001.passes = true, power function exists

---

### Phase 6: Verify Task 2 (No Spec Field)

**Step 6.1: Complete T-002**
```bash
openspec ralph --change add-advanced-operations --max-iterations 1
```

**Step 6.2: Verify T-002 completed**
```bash
cat openspec/changes/add-advanced-operations/prd.json | jq '.tasks[1].passes'
```

**Expected**: `true`

**Step 6.3: Verify factorial function**
```bash
grep -A 5 "export function factorial" src/calc.ts
```

**Verification 6.1**: T-002.passes = true, factorial function exists

---

### Phase 7: Final Validation

**Step 7.1: TypeScript compilation**
```bash
npx tsc --noEmit
```

**Expected**: No errors

**Step 7.2: Test power function**
```bash
node -e "const { power } = require('./src/calc.ts'); console.log('2^3 =', power(2, 3));"
```

**Expected**: `2^3 = 8`

**Step 7.3: Check progress.txt**
```bash
cat openspec/changes/add-advanced-operations/progress.txt
```

**Expected**: Contains entries for T-001 and T-002

---

## Test Results

### Requirements Coverage

| Requirement | Test Coverage | Status |
|-------------|---------------|--------|
| REQ-001 Task with spec | T-001 has spec field | ⬜ |
| REQ-001 Task without spec | T-002 has no spec | ⬜ |
| REQ-002 Spec + acceptanceCriteria | T-001 uses both | ⬜ |
| REQ-002 Only acceptanceCriteria | T-002 uses only criteria | ⬜ |
| REQ-003 Spec in output | Verified in Phase 3 | ⬜ |
| REQ-004 Template spec logic | Verified in Phase 4 | ⬜ |

### Final Report Format

```markdown
## E2E QA Test Report: Spec Field Integration

### Test Project
- Project: calculator-lib
- Change: add-advanced-operations
- Schema: ralph-driven

### Test Summary
| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Project Setup | ✅/❌ |
| Phase 2 | Create Artifacts | ✅/❌ |
| Phase 3 | Spec Field in Output | ✅/❌ |
| Phase 4 | Template Spec Logic | ✅/❌ |
| Phase 5 | Execute T-001 (with spec) | ✅/❌ |
| Phase 6 | Execute T-002 (no spec) | ✅/❌ |
| Phase 7 | Final Validation | ✅/❌ |

### Key Findings
1. T-001 spec field: [value found]
2. T-002 spec field: [null or missing]
3. SKILL.md has spec logic: [yes/no]
4. Both tasks completed: [yes/no]
5. TypeScript compiles: [yes/no]

### Conclusion
[PASS/FAIL] - Spec field integration works correctly / Has issues
```

## Success Criteria

**ALL of the following must be true**:
1. ✅ T-001 has spec field in prd.json and instructions output
2. ✅ T-002 does NOT have spec field
3. ✅ SKILL.md contains spec conditional logic
4. ✅ T-001 completes successfully (uses spec scenarios)
5. ✅ T-002 completes successfully (uses acceptanceCriteria)
6. ✅ Both functions implemented and TypeScript compiles
7. ✅ progress.txt contains execution history

If ANY check fails, report as FAILED with details.