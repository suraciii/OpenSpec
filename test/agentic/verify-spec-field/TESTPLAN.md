# Test Plan: Spec Field Integration

## Test Scenario

You are a developer trying OpenSpec's ralph-driven workflow on a TypeScript utility library.

**Project**: `string-utils` - A string manipulation library
- **Current State**: Has basic functions (capitalize, reverse)
- **Goal**: Add slug generation and word count features
- **Workflow**: ralph-driven schema (autonomous task execution)

## Prerequisites

You are in a fresh container environment with:
- Node.js and npm installed
- OpenSpec CLI available (`openspec` command works)
- OpenCode CLI available with API access
- Working directory: `/app/workspace` (empty)

---

## Phase 1: Project Setup

**What to do**:
```bash
mkdir -p /app/workspace/string-utils
cd /app/workspace/string-utils

npm init -y
npm install typescript @types/node --save-dev
npx tsc --init

mkdir -p src
cat > src/index.ts << 'EOF'
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function reverse(str: string): string {
  return str.split('').reverse().join('');
}
EOF
```

**Verify**:
- `src/index.ts` exists with capitalize and reverse functions
- `package.json` exists

---

## Phase 2: Initialize OpenSpec

**What to do**:
```bash
cd /app/workspace/string-utils
openspec init --tools opencode --schema ralph-driven
```

**Verify**:
- `.opencode/skills/` directory exists
- `openspec/config.yaml` contains `schema: ralph-driven`
- **Key Check**: `.opencode/skills/opsx-ralph/SKILL.md` mentions handling tasks with spec references

---

## Phase 3: Propose Change

**What to do**:
```bash
cd /app/workspace/string-utils
opencode run --command opsx-propose -- "add-string-utils add slug generation and word count functions"
```

**Verify**:
- Change directory created under `openspec/changes/`
- Contains: `proposal.md`, `design.md`, `specs/`, `prd.json`
- **Key Check**: `prd.json` has tasks with `spec` field referencing spec files

---

## Phase 4: Examine Ralph Instructions

**What to do**:
```bash
cd /app/workspace/string-utils
CHANGE_NAME=$(ls openspec/changes/ | grep -v archive | head -1)
openspec instructions ralph --change $CHANGE_NAME --json | jq .
```

**Verify**:
- Valid JSON output
- `schemaName: "ralph-driven"`
- Tasks array includes `spec` fields

---

## Phase 5: Execute Ralph

**What to do**:
```bash
cd /app/workspace/string-utils
CHANGE_NAME=$(ls openspec/changes/ | grep -v archive | head -1)
openspec ralph --change $CHANGE_NAME --max-iterations 5
```

**Verify**:
- Tasks completed in `prd.json` (marked `passes: true`)
- `progress.txt` has entries
- `src/index.ts` has new functions

---

## Phase 6: Validate Results

**What to do**:
```bash
cd /app/workspace/string-utils

npx tsc --noEmit
grep -n "export function" src/index.ts
```

**Verify**:
- TypeScript compiles without errors
- `slugify` and `wordCount` functions exist

---

## Success Criteria

Test is **PASSED** if:

1. ✅ TypeScript project initialized
2. ✅ ralph-driven schema configured
3. ✅ All artifacts created via opsx-propose
4. ✅ Ralph instructions show tasks with `spec` field
5. ✅ Ralph completed tasks
6. ✅ New functions added and TypeScript compiles

---

## Report

Output:
```markdown
## Test Results

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Project Setup | ✅/❌ | |
| 2. OpenSpec Init | ✅/❌ | |
| 3. Propose Change | ✅/❌ | |
| 4. Ralph Instructions | ✅/❌ | |
| 5. Ralph Execution | ✅/❌ | |
| 6. Validation | ✅/❌ | |

### Key Findings
- Spec field observed: Yes/No
- Ralph skill logic: Yes/No
- Workflow completed: Yes/No
- Code compiles: Yes/No

### Conclusion
PASS/FAIL
```
