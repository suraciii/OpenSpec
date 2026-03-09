/**
 * Ralph Workflow Template Module
 *
 * Template for the opsx-ralph agent command that executes Ralph iterations.
 */
import type { SkillTemplate, CommandTemplate } from '../types.js';

export function getOpsxRalphSkillTemplate(): SkillTemplate {
  return {
    name: 'opsx-ralph',
    description: 'Execute one Ralph iteration for autonomous task implementation. Use when running openspec ralph command or when asked to work on prd.json tasks iteratively.',
    instructions: `Execute one Ralph iteration for autonomous task implementation.

I'll work through the prd.json tasks one at a time:
1. Read context files (proposal, design, specs, prd.json)
2. Find the highest priority pending task (passes: false with lowest priority number)
3. Implement that single task
4. Update prd.json: set passes: true for the completed task
5. Append progress to progress.txt with timestamp and learnings
6. If all tasks are now complete, output: <promise>COMPLETE</promise>

---

**Input**: The change name passed to the command.

**Steps**

1. **Load Ralph instructions**
   \`\`\`bash
   openspec instructions ralph --change "<change-name>" --json
   \`\`\`
   Parse the JSON to get:
   - \`contextFiles\`: paths to proposal, design, specs, prd.json
   - \`tasks\`: array of pending tasks with priority and done status
   - \`instruction\`: specific guidance for this iteration
   - \`progress\`: total/completed/remaining counts

2. **Read context files**
   - proposal.md: Understand the WHY
   - design.md: Understand the HOW (if exists)
   - specs/**/*.md: Understand requirements
   - prd.json: Current task states

3. **Identify next task**
   - Find tasks where \`passes: false\`
   - Select the one with lowest \`priority\` number
   - If no pending tasks, output \`<promise>COMPLETE</promise>\` and stop

4. **Implement the task**
   - Follow the task's \`description\` and \`acceptanceCriteria\`
   - Make minimal, focused changes
   - Ensure each acceptance criterion is satisfied
   - Run typecheck/tests to verify

5. **Update prd.json**
   - Set \`passes: true\` for the completed task
   - Keep other tasks unchanged

6. **Append to progress.txt**
   Add entry with:
   - Timestamp
   - Task ID completed
   - Brief description of what was done
   - Any blockers or learnings
   - Next steps

7. **Check completion**
   - If all tasks now have \`passes: true\`, output \`<promise>COMPLETE</promise>\`
   - Otherwise, iteration is complete (Ralph CLI will spawn next iteration)

---

**Output**

After completing the task:
- Updated prd.json with passes: true
- Updated progress.txt with entry
- If all tasks complete: output \`<promise>COMPLETE</promise>\`

---

**Guidelines**

- Focus on ONE task per iteration
- Tasks are ordered by priority - respect the order
- Each task should be completable in one iteration
- Verify acceptance criteria are met
- Keep changes minimal and focused
- Document learnings in progress.txt for future iterations`,
    license: 'MIT',
    compatibility: 'Requires openspec CLI with ralph-driven schema.',
    metadata: { author: 'openspec', version: '1.0' },
  };
}

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
6. If all tasks are now complete, output: <promise>COMPLETE</promise>

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

3. **Identify next task**
   - Find tasks where \`passes: false\`
   - Select the one with lowest \`priority\` number
   - If no pending tasks, output \`<promise>COMPLETE</promise>\` and stop

4. **Implement the task**
   - Follow the task's description and acceptanceCriteria
   - Make minimal, focused changes
   - Ensure each acceptance criterion is satisfied

5. **Update prd.json**
   - Set \`passes: true\` for the completed task

6. **Append to progress.txt**
   Add entry with timestamp, task ID, and learnings

7. **Check completion**
   - If all tasks complete: output \`<promise>COMPLETE</promise>\``,
  };
}
