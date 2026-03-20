# Design: Stream Ralph Output

## Context

The `openspec ralph` command executes OpenCode as a subprocess to run autonomous task iterations. Currently, it uses Node.js `execSync` which buffers all output until completion, providing no feedback to users during potentially long-running operations.

**Current State:**
- `RealExecutor` uses `execSync` with `stdio: 'pipe'`
- All output appears at once after each iteration completes
- Users experience 30+ seconds of silence with no progress indication

**Constraints:**
- Must detect `<promise>COMPLETE</promise>` signal for completion
- Must work on Windows, macOS, and Linux
- Must maintain backward compatibility with existing tests

## Goals / Non-Goals

**Goals:**
- Stream OpenCode output in real-time to stdout
- Preserve completion signal detection capability
- Maintain Windows platform compatibility via cross-spawn
- Update Executor interface to async

**Non-Goals:**
- JSON event stream parsing (Phase 2)
- Tool call statistics display (Phase 2)
- Heartbeat/spinner during sparse output
- ACP protocol integration

## Decisions

### Decision 1: Use cross-spawn instead of native spawn

**Rationale:**
- Windows handles shell commands differently (cmd.exe vs bash)
- `cross-spawn` handles platform-specific edge cases automatically
- Avoids `shell: true` which introduces cmd.exe prompt noise

**Alternative Considered:**
- Native `spawn` with `shell: true` - rejected due to cmd.exe output pollution
- Platform detection + conditional handling - rejected as more complex

### Decision 2: stdio configuration ['inherit', 'pipe', 'inherit']

**Rationale:**
- `stdin: 'inherit'` - allows user interaction if OpenCode needs input
- `stdout: 'pipe'` - capture for completion detection + stream to console
- `stderr: 'inherit'` - errors display directly without buffering

**Alternative Considered:**
- `stdio: 'inherit'` - rejected, cannot detect completion signal
- `stdio: 'pipe'` for all - rejected, stderr would be buffered

### Decision 3: Async Executor interface

**Rationale:**
- `spawn` is inherently async (event-based)
- Promise-based API is cleaner than callback-based
- `ralphCommand` is already async, minimal changes needed

**Interface Change:**
```typescript
// Before
interface Executor {
  executeOpenCode(command: string): string;
}

// After
interface Executor {
  executeOpenCode(command: string): Promise<string>;
}
```

### Decision 4: Add cross-spawn as dependency

**Rationale:**
- Zero-dependency alternative is complex platform handling
- cross-spawn is well-maintained and widely used
- Small package size (~10KB)

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Windows spawn behavior differs from Unix | Use cross-spawn, add Windows-specific tests |
| Async migration breaks existing tests | Update all mocks to use `mockResolvedValue` |
| Output encoding issues on Windows | Pass Buffer directly, avoid premature string conversion |
| Child process not killed on error | Add try-finally with process.kill() |
| cross-spawn adds dependency | Acceptable - small, stable package |
