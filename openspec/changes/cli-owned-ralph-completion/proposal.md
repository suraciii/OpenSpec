# Proposal: CLI-Owned Ralph Completion Detection

## Why

The current `openspec ralph` command uses **dual completion detection** that creates unnecessary complexity and redundancy:

1. CLI checks `prd.json` task status before each iteration (pre-flight check)
2. CLI scans agent stdout for `<promise>COMPLETE</promise>` after each iteration (post-flight check)

This dual mechanism creates fragile dependencies: the agent must output a specific text string, and the CLI must parse stdout reliably. Meanwhile, the CLI already has full authority over task selection—it reads `prd.json`, filters pending tasks, sorts by priority, and constructs a prompt for exactly one task.

The `<promise>COMPLETE</promise>` mechanism is merely a "fast path" optimization to avoid one extra iteration. But it adds cognitive overhead to the agent (must learn to output this specific format) and brittleness to the system (stdout parsing, ANSI codes, markdown formatting can all break it).

This change proposes making the CLI the **sole authority** on completion detection, simplifying the agent's responsibility and making the system more reliable.

## What Changes

**BREAKING: Agent interface simplification**

- Remove requirement for agents to output `<promise>COMPLETE</promise>`
- CLI becomes the single source of truth for task completion status
- Agent responsibility reduced to: "implement one task, update prd.json"
- Add option for agents to signal "I did nothing this iteration" to allow early exit

**Core implementation changes:**

1. **Modify `buildIterationPrompt()`** in `src/commands/workflow/ralph.ts`:
   - Remove all references to `<promise>COMPLETE</promise>` from prompt instructions
   - Simplify steps: implement → test → update prd.json → commit → done
   - Remove "CRITICAL VERIFICATION STEP" that asks agent to verify all tasks

2. **Modify `ralphCommand()` loop** in `src/commands/workflow/ralph.ts`:
   - Remove post-flight check for `<promise>COMPLETE</promise>` in agent output
   - Rely entirely on pre-flight check of `instructions.progress.remaining === 0`
   - Keep max-iterations as safety net

3. **Add "no-op" detection (optional enhancement)**:
   - Add `<promise>NO_PROGRESS</promise>` signal for when agent detects it cannot proceed
   - Allows graceful exit when stuck, rather than burning iterations

**Configuration changes:**

- None

## Capabilities

**New Capabilities:**
- `ralph-cli-completion`: CLI-controlled task completion detection for ralph workflow

**Modified Capabilities:**
- `ralph-agent-interface`: Simplified agent responsibilities (only implement and update prd.json)

**Impact:**

- **Code**: `src/commands/workflow/ralph.ts` - simplified prompt building and loop logic
- **Agent prompts**: Remove ~5 lines of instruction text per prompt
- **Tests**: Update test assertions to not expect `<promise>COMPLETE</promise>`
- **Documentation**: Update skill documentation to reflect simpler agent contract
- **Backward compatibility**: BREAKING - existing ralph workflows that rely on promise will need one extra iteration to complete

## Success Criteria

- Ralph loop completes successfully without `<promise>COMPLETE</promise>` output from agent
- Agent prompts contain no references to promise tags
- Loop correctly detects completion by reading prd.json task status
- Max-iterations safety net still works
- All existing ralph-driven changes continue to work (may take +1 iteration)