/**
 * Ralph Workflow Template Module
 *
 * Template for the opsx-ralph agent command that executes Ralph iterations.
 * Note: The automated `openspec ralph` loop uses direct prompt mode via buildIterationPrompt().
 * This command is retained for manual single-iteration execution via /opsx-ralph.
 */
import type { CommandTemplate } from '../types.js';

export function getOpsxRalphCommandTemplate(): CommandTemplate {
  return {
    name: 'OPSX: Ralph',
    description: 'Execute one Ralph iteration for autonomous task implementation',
    category: 'Workflow',
    tags: ['workflow', 'ralph', 'autonomous', 'iteration'],
    content: `Execute one Ralph iteration for autonomous task implementation.

I'll work through the prd.json tasks one at a time:
1. Read context files (proposal, design, specs, prd.json)
2. Find the highest priority pending task (passes: false with lowest priority number)
3. Implement that single task
4. Update prd.json: set passes: true for the completed task
5. Append progress to progress.txt with timestamp and learnings
6. Commit changes: git add -A && git commit

---

**Input**: The change name passed after the command.

**Steps**

1. **Load Ralph instructions**
   \`\`\`bash
   openspec instructions ralph --change "<change-name>" --json
   \`\`\`

2. **Read context files**
   - proposal.md: Understand the WHY
   - design.md: Understand the HOW
   - specs/**/*.md: Understand requirements
   - prd.json: Current task states
   - **If selected task has \`spec\` field:** Read the referenced spec file for acceptance criteria

3. **Identify next task**
   - Find tasks where \`passes: false\`
   - Select the one with lowest \`priority\` number

4. **Implement the task**
   - Follow the task's description and acceptanceCriteria
   - **If task has \`spec\` field:**
     - Read the spec file referenced by \`task.spec\` (format: \`specs/<capability>/spec.md#REQ-ID\`)
     - Find the requirement section matching the REQ-ID
     - Verify all scenarios in the requirement pass
     - Also verify all \`acceptanceCriteria\` (supplementary checks)
   - **If task has no \`spec\` field:**
     - Use \`acceptanceCriteria\` as the complete verification list
   - Make minimal, focused changes

5. **Update prd.json**
   - Set \`passes: true\` for the completed task

6. **Append to progress.txt**
    Add entry with timestamp, task ID, and learnings

7. **Commit changes**
    - Run \`git add -A && git commit -m "ralph(<change-name>): <task-id> <task title>"\`
    - Include all changes from this iteration`,
  };
}