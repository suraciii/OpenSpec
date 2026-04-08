## Context

`openspec ralph` spawns `opencode run --command opsx-ralph -- <changeName>` each iteration. The AI agent reads `.opencode/skills/opsx-ralph/SKILL.md`, interprets its semantics, then executes commands — including running `openspec instructions ralph --change ... --json`. This two-hop design (CLI → opencode+skill → AI interprets skill → AI runs CLI command) introduces non-determinism: the AI agent may search files with glob patterns instead of using exact paths, or guess CLI paths like `cd packages/cli && npm run opencode`.

Current flow:
```
ralph.ts → opencode run --command opsx-ralph → AI reads SKILL.md
         → AI interprets "run openspec instructions ralph" 
         → AI constructs command (non-deterministic)
```

## Goals / Non-Goals

**Goals:**
- Eliminate skill/command indirection — ralph.ts generates the complete prompt itself
- All file paths in prompt are absolute, resolved via `path.resolve()`
- Each iteration re-fetches latest state via `generateRalphInstructions()`
- Clean removal of opsx-ralph skill and command template from the codebase

**Non-Goals:**
- Changing `generateRalphInstructions()` or `ralphInstructionsCommand()` — these are reused as-is
- Changing the `opencode run` CLI interface or OpenCode itself
- Adding new features (model selection, parallel iteration, etc.)
- Modifying other skills or the skill generation system architecture

## Decisions

### D1: Prompt generation in ralph.ts, not a new module

**Decision:** Add `buildIterationPrompt()` directly in `src/commands/workflow/ralph.ts`.

**Rationale:** The function is small (~30 lines), tightly coupled to the iteration loop, and only called from one place. A separate module adds indirection without benefit. `generateRalphInstructions()` already lives in `instructions.ts` and is reused unchanged.

**Alternative considered:** Create `src/commands/workflow/prompt-builder.ts`. Rejected — premature abstraction for a function with one call site.

### D2: Pure natural language prompt format

**Decision:** Use unstructured natural language (not XML tags or JSON injection).

**Rationale:** LLMs respond best to natural language instructions. XML/JSON adds parsing burden on the AI side. The prompt is consumed by the AI agent, not by code — so human readability is the priority.

**Alternative considered:** Structured XML like `<task>...</task>`. Rejected — adds no benefit when the consumer is an LLM.

### D3: Remove both skill and command templates for ralph

**Decision:** Delete `getOpsxRalphSkillTemplate()` and `getOpsxRalphCommandTemplate()` entirely, along with all references.

**Rationale:** Since ralph no longer uses the skill/command system, keeping dead templates creates maintenance burden and confusion. Users running `openspec init` with ralph-driven schema will no longer generate `opsx-ralph` skill/command files — which is correct since they're unused.

### D4: Executor interface unchanged

**Decision:** Keep `Executor.executeOpenCode(command: string)` interface unchanged.

**Rationale:** The interface is generic enough. The `command` string changes from `opencode run --command opsx-ralph -- X` to `opencode run [model] "<prompt>"`, but the type signature is the same string-in-string-out contract.

### D5: All-tasks-complete early exit

**Decision:** Before entering the iteration loop, check if all tasks are already complete. If so, skip opencode invocation entirely.

**Rationale:** Avoids a wasted opencode spawn when resuming a fully completed change. The check uses `generateRalphInstructions()` which already exists.

## Risks / Trade-offs

**[Prompt length]** → Long prompts when many context files exist. Mitigation: this is inherent to giving the AI all needed context; better than having it search. OpenCode handles long prompts natively.

**[Breaking existing workflows]** → Users who reference `opsx-ralph` skill directly (e.g., via `opencode run --command opsx-ralph`) will lose access. Mitigation: this was an internal implementation detail, not a documented user-facing API. The canonical entry point is `openspec ralph`.

**[Prompt quality]** → The generated prompt quality determines iteration success. Mitigation: prompt structure is simple and explicit — absolute paths, single task, clear steps. Can be iterated on without code changes to the loop.

## Open Questions

None — the design is straightforward and constrained to the existing architecture.
