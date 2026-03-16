# Agentic Test Plan: First-Time User Experience

## Test Scenario

You are a developer who has heard about OpenSpec and wants to try it on a real project. You have a simple TypeScript utility library and want to use OpenSpec's ralph-driven workflow to manage the development.

## Your Project

- **Project**: `string-utils` - A TypeScript string manipulation library
- **Current State**: Has basic functions (capitalize, reverse)
- **Goal**: Add slug generation and word count features
- **Workflow**: You want to use ralph-driven schema (autonomous task execution)

## Prerequisites

You are in a fresh container environment with:
- Node.js and npm installed
- OpenSpec CLI available (`openspec` command works)
- OpenCode/opencode CLI available with API access
- Working directory: `/app/workspace` (empty)

## Test Phases

### Phase 1: Project Setup

**Context**: You need to set up a TypeScript project from scratch.

**Steps**:
1. Create the project directory and initialize npm
2. Install TypeScript and set up basic structure
3. Create initial source file with basic functions

**What to do**:
```bash
# Create and enter project directory
mkdir -p /app/workspace/string-utils
cd /app/workspace/string-utils

# Initialize project
npm init -y
npm install typescript @types/node --save-dev
npx tsc --init

# Create source directory and initial file
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

**Verification**: 
- Does `src/index.ts` exist with the two functions?
- Does `package.json` exist?

---

### Phase 2: Initialize OpenSpec

**Context**: You want to set up OpenSpec with ralph-driven workflow for autonomous development.

**Steps**:
1. Initialize OpenSpec with ralph-driven schema
2. Verify the initialization worked

**What to do**:
```bash
cd /app/workspace/string-utils
openspec init --tools opencode --schema ralph-driven
```

**Verification**:
- Check that `.opencode/skills/` directory was created
- Check that `openspec/config.yaml` contains `schema: ralph-driven`
- Check that `openspec/` directory structure exists

**Key Check**: Look at `.opencode/skills/opsx-ralph/SKILL.md` - does it mention handling tasks with spec references?

---

### Phase 3: Start Your First Change

**Context**: You want to add slug generation and word count features. You'll use OpenCode to help create the proposal.

**Steps**:
1. Use OpenCode's propose command to start a change
2. Provide context about what you want to build

**What to do**:
```bash
cd /app/workspace/string-utils
opencode run --command opsx-propose -- "Add slug generation and word count functions to string-utils library"
```

**During execution**:
- OpenCode will ask you questions about the change
- Answer: "I need a slugify function that converts strings to URL-friendly slugs, and a wordCount function that counts words in a string"

**Verification**:
- Was a change directory created under `openspec/changes/`?
- Does it contain `proposal.md`?
- Read the proposal - does it describe adding slug and word count features?

---

### Phase 4: Create Design and Specifications

**Context**: You need to create technical design and specifications for the features.

**Steps**:
1. Continue the change to create design.md
2. Create spec files with detailed requirements
3. Create the task tracking file (prd.json)

**What to do**:
```bash
cd /app/workspace/string-utils
opencode run --command opsx-continue-change -- $(ls openspec/changes/ | grep -v archive | head -1)
```

**Alternative**: You can manually create the files if OpenCode doesn't complete them.

**Files to check for**:
- `openspec/changes/<name>/design.md` - Technical design
- `openspec/changes/<name>/specs/` - Specification directory with .md files
- `openspec/changes/<name>/prd.json` - Task tracking file

**Key Check**: Look at `prd.json` - does it have tasks? Do any tasks have a `spec` field?

---

### Phase 5: Examine the Ralph Instructions

**Context**: Before running Ralph, you want to see what instructions will be sent to the AI.

**Steps**:
1. Get the Ralph instructions for your change
2. Examine the output

**What to do**:
```bash
cd /app/workspace/string-utils
CHANGE_NAME=$(ls openspec/changes/ | grep -v archive | head -1)
openspec instructions ralph --change $CHANGE_NAME --json | jq .
```

**Verification**:
- Is the output valid JSON?
- Does it show `schemaName: "ralph-driven"`?
- Does it list context files (proposal, design, specs, prd)?
- Does it show tasks array with your tasks?
- **Important**: Look at the tasks - do any have a `spec` field? What does it reference?

---

### Phase 6: Execute Ralph Workflow

**Context**: Now you want Ralph to autonomously implement the tasks.

**Steps**:
1. Run Ralph to start autonomous execution
2. Observe the process

**What to do**:
```bash
cd /app/workspace/string-utils
CHANGE_NAME=$(ls openspec/changes/ | grep -v archive | head -1)
openspec ralph --change $CHANGE_NAME --max-iterations 5
```

**What should happen**:
- Ralph loads the instructions
- For each task, it reads context files
- If a task has a `spec` field, it reads the spec file for detailed requirements
- It implements the feature
- Updates prd.json to mark task complete
- Writes progress to progress.txt

**Verification**:
- Did Ralph complete any tasks?
- Check `prd.json` - are tasks marked as `passes: true`?
- Check `progress.txt` - are there entries for completed tasks?
- Check `src/index.ts` - were new functions added?

---

### Phase 7: Validate Results

**Context**: You want to verify the implementation is correct.

**Steps**:
1. Check that new functions were added
2. Verify TypeScript compiles
3. Test the functions work

**What to do**:
```bash
cd /app/workspace/string-utils

# Check TypeScript compiles
npx tsc --noEmit

# Check functions exist
grep -n "export function" src/index.ts

# Quick test
cat > test.js << 'EOF'
const { slugify, wordCount } = require('./dist/index.js');
console.log('slugify:', slugify('Hello World'));
console.log('wordCount:', wordCount('Hello world test'));
EOF
```

**Verification**:
- Does `src/index.ts` now have `slugify` and `wordCount` functions?
- Does TypeScript compile without errors?
- Do the functions look correct based on the requirements?

---

## Success Criteria

The test is **PASSED** if:

1. ✅ **Project Setup**: TypeScript project initialized with initial functions
2. ✅ **OpenSpec Init**: ralph-driven schema configured correctly
3. ✅ **Change Created**: Proposal and artifacts created via opsx-propose/opsx-continue
4. ✅ **Ralph Instructions**: Valid JSON output with tasks array
5. ✅ **Spec Field Present**: At least one task has `spec` field referencing a spec file (demonstrating the feature)
6. ✅ **Ralph Execution**: Ralph ran and completed tasks
7. ✅ **Implementation**: New functions added to source code
8. ✅ **Quality**: TypeScript compiles without errors

The test is **FAILED** if any of the above are not met, with detailed explanation of what went wrong.

---

## What You're Actually Testing

This test validates the **spec field integration** feature by observing a natural workflow:

1. When OpenCode creates tasks during `opsx-continue-change`, it may add `spec` fields to reference detailed requirements
2. Ralph instructions must include these `spec` fields in the output
3. Ralph skill must handle tasks with `spec` by reading the referenced spec files
4. The workflow should complete successfully with working code

**Key Observation**: You shouldn't need to manually add `spec` fields - if the feature works, OpenCode will naturally create them when it generates specs and tasks.

---

## Reporting

After completing all phases, output a report:

```markdown
## Test Results: First-Time User Experience

### Phase Summary
| Phase | Status | Notes |
|-------|--------|-------|
| 1. Project Setup | ✅/❌ | ... |
| 2. OpenSpec Init | ✅/❌ | ... |
| 3. Propose Change | ✅/❌ | ... |
| 4. Design & Specs | ✅/❌ | ... |
| 5. Ralph Instructions | ✅/❌ | ... |
| 6. Ralph Execution | ✅/❌ | ... |
| 7. Validation | ✅/❌ | ... |

### Key Findings
- **Spec field observed**: [Yes/No] - Were any tasks created with `spec` fields?
- **Ralph skill logic**: [Yes/No] - Does SKILL.md mention reading spec files?
- **Workflow completed**: [Yes/No] - Did all tasks complete?
- **Code quality**: [Yes/No] - Does the generated code compile?

### Conclusion
[PASS/FAIL] - The spec field integration works in a real-world scenario / Issues found
```