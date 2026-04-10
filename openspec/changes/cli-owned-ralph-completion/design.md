# Design: CLI-Owned Ralph Completion Detection

## Context

The current ralph command implementation in `src/commands/workflow/ralph.ts` has a dual completion detection mechanism:

1. **Pre-flight check** (line 242-245): CLI reads `prd.json` and checks if `instructions.progress.remaining === 0`
2. **Post-flight check** (line 258-261): CLI scans agent stdout for `<promise>COMPLETE</promise>`

This design was inherited from the open-ralph-wiggum pattern, where the agent is a "black box" and the only control surface is the prompt/stdout interface. However, OpenSpec's ralph workflow has structured state (`prd.json`) that the CLI fully controls.

The agent currently receives a prompt like:
```
Steps:
1. Read all context files
2. Implement the task
3. Run typecheck/tests
4. Update prd.json: set passes:true
5. Commit changes
6. If all tasks complete, output: <promise>COMPLETE</promise>
```

Step 6 is redundant because the CLI already knows (via pre-flight check) whether tasks remain. The agent is doing work that the CLI could do more reliably.

## Goals / Non-Goals

**Goals:**
- Make CLI the sole authority on task selection and completion detection
- Simplify agent prompt and responsibilities
- Remove fragile stdout parsing for completion signals
- Maintain safety mechanisms (max-iterations, error handling)

**Non-Goals:**
- Change the prd.json schema or task structure
- Modify how tasks are defined or prioritized
- Add new agent capabilities or tools
- Change the iteration timing or subprocess spawning logic

## Decisions

### Decision 1: Remove promise-based completion detection entirely

**Rationale:** The pre-flight check already provides reliable completion detection by reading prd.json from disk. The post-flight promise check is redundant and adds brittleness.

**Alternatives considered:**
- Keep promise as optional optimization: Rejected - adds complexity for marginal benefit (one iteration)
- Make promise configurable: Rejected - more config surface area for unclear benefit
- Only use promise, remove pre-flight check: Rejected - pre-flight is more reliable (structured data vs text parsing)

### Decision 2: Remove "verify all tasks" instruction from prompt

Current prompt includes:
> CRITICAL VERIFICATION STEP: Read prd.json and verify passes values

This asks the agent to do work the CLI already does. After this change, the agent implements ONE task and updates prd.json. The CLI handles verification on the next iteration.

**Rationale:** Single responsibility principle - agent implements, CLI orchestrates.

### Decision 3: Keep max-iterations as hard safety limit

Even with CLI-owned completion, we keep `maxIterations` to prevent infinite loops if:
- Agent fails to update prd.json
- prd.json becomes corrupted
- Filesystem issues prevent reading prd.json

**Rationale:** Defense in depth - multiple independent termination conditions.

### Decision 4: Optional "no-op" signal for stuck detection

Add support for `<promise>NO_PROGRESS</promise>` as an optional signal. This is NOT required but allows agents to indicate "I couldn't do anything this iteration" for better UX.

**Rationale:** Distinguish "working but not done" from "blocked and need help" without burning iterations.

## Risks / Trade-offs

**[Risk] Breaking change for existing workflows**
→ Mitigation: Workflows will still complete, just take +1 iteration. Update skill documentation.

**[Risk] Agent confusion if old training/instructions persist**
→ Mitigation: Clear documentation update in skill and command help text.

**[Risk] Users expect "instant" completion when last task done**
→ Mitigation: The extra iteration is usually <5 seconds. Acceptable tradeoff for simplicity.

**[Trade-off] Loss of "fast path" optimization**
→ Acceptance: One extra iteration is negligible compared to iteration time (typically 30s-5min).

## Implementation Plan

### Phase 1: Core Changes

1. Modify `buildIterationPrompt()` in `src/commands/workflow/ralph.ts`:
   - Remove steps referencing `<promise>COMPLETE</promise>`
   - Remove "CRITICAL VERIFICATION STEP" paragraph
   - Simplify final step to just "Commit changes and finish"

2. Modify `ralphCommand()` loop:
   - Remove `if (output.includes('<promise>COMPLETE</promise>'))` check (lines 258-261)
   - Keep pre-flight check `if (instructions.progress.remaining === 0)` as primary completion mechanism

3. Update skill documentation:
   - Modify `.opencode/skills/opsx-ralph/SKILL.md` to remove promise references
   - Update expected output format

### Phase 2: Enhancement (Optional)

4. Add optional `<promise>NO_PROGRESS</promise>` detection:
   - If detected, print warning and potentially offer to stop
   - Useful for debugging stuck agents

### Testing Strategy

- Unit tests: Update `test/commands/ralph.test.ts` to not expect promise in output
- Integration test: Run ralph on a test change, verify completes without promise
- Manual test: Run with `--max-iterations 3` on 2-task change, verify stops at iteration 3

## Open Questions

1. Should we keep promise support as opt-in for backward compatibility?
   → Recommendation: No, clean break simplifies mental model.

2. Should we add a `--require-promise` flag for users who want the old behavior?
   → Recommendation: No, adds complexity without clear use case.

3. How do we handle agents that still output promise out of habit?
   → Recommendation: Ignore it - harmless, and they'll adapt.

## Architecture Diagram

```
BEFORE (Dual Detection):
┌─────────────────────────────────────────────────────────────┐
│  FOR iteration in maxIterations:                            │
│    1. Read prd.json → select next task                      │
│    2. IF remaining == 0: EXIT                               │
│    3. Spawn agent with task prompt                          │
│    4. Agent: implement → update prd.json → output promise   │
│    5. IF stdout contains "<promise>COMPLETE</promise>": EXIT │
│    6. Continue to next iteration                            │
└─────────────────────────────────────────────────────────────┘

AFTER (CLI-Owned):
┌─────────────────────────────────────────────────────────────┐
│  FOR iteration in maxIterations:                            │
│    1. Read prd.json → select next task                      │
│    2. IF remaining == 0: EXIT                               │
│    3. Spawn agent with task prompt                          │
│    4. Agent: implement → update prd.json → done             │
│    5. Continue to next iteration                            │
│    6. (Loop will hit step 2 and exit if all tasks done)     │
└─────────────────────────────────────────────────────────────┘
```

## Migration

**For existing changes:** No action needed. They'll complete normally, just without the optimization.

**For users:** Update mental model - no need to wait for "promise detected" message.

**For skill users:** Skill instructions updated automatically when this change is applied.