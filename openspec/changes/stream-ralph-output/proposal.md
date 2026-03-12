# Stream Ralph Output

## Problem

When running `openspec ralph`, users cannot see real-time output from the AI agent (OpenCode). The current implementation uses `execSync` with `stdio: 'pipe'`, which buffers all output until the process completes. This creates a poor user experience because:

- Users see no progress indication during long-running iterations
- Users cannot tell if the agent is working or stuck
- Users have no feedback until iteration completes
- Debugging is difficult when you can't see what the agent is doing

## Solution

Change the Ralph command to use streaming output instead of buffered output:

1. Replace `execSync` with `spawn` (async)
2. Use `stdio: ['inherit', 'pipe', 'inherit']` to enable streaming
3. Stream stdout in real-time while capturing complete output for completion detection
4. Make the executor interface async to support the Promise-based approach

## User Experience Improvement

**Before:**
```
$ openspec ralph --change my-feature
Starting Ralph execution for change: my-feature
Max iterations: 10

## Iteration 1/10
[... 30 seconds of silence ...]
[All output appears at once]
```

**After:**
```
$ openspec ralph --change my-feature
Starting Ralph execution for change: my-feature
Max iterations: 10

## Iteration 1/10
|   Load ralph instructions...
|   Reading prd.json...
|   Selecting task T-001...
|   Implementing task...
|   Writing code...
|   Running tests...
|   Task completed!
   <promise>COMPLETE</promise>

Iteration 1 completed in 2:30
```

## Scope

**In Scope:**
- Change `RealExecutor` to use `spawn` instead of `execSync`
- Update `Executor` interface to be async
- Update `ralphCommand` to use `await` when calling the executor
- Ensure completion signal detection still works

**Out of Scope:**
- Heartbeat display (future enhancement)
- Tool call statistics (future enhancement)
- Tool call compression (future enhancement)
- Struggle detection (future enhancement)
- Status monitoring (future enhancement)
- Multi-agent support (already handled by opsx-ralph.ps1)

## Technical Approach

### Current Implementation (Buffered)
```typescript
class RealExecutor implements Executor {
  executeOpenCode(command: string): string {
    return execSync(command, {
      stdio: 'pipe',      // Buffers all output
      encoding: 'utf-8',
    });
  }
}
```

### New Implementation (Streaming)
```typescript
import spawn from 'cross-spawn';

class RealExecutor implements Executor {
  async executeOpenCode(command: string): Promise<string> {
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        stdio: ['inherit', 'pipe', 'inherit']
      });
      
      let fullOutput = '';
      
      child.stdout?.on('data', (data: Buffer) => {
        process.stdout.write(data);
        fullOutput += data.toString();
      });
      
      child.on('error', reject);
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve(fullOutput);
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });
    });
  }
}
```

### Cross-Platform Considerations

- Use `cross-spawn` package for Windows compatibility
- Handles shell differences between cmd.exe and bash
- No need for `shell: true` which can introduce cmd.exe noise

## Impact

- **User Experience**: Users see real-time progress, can tell agent is working
- **Debugging**: Easier to debug when you can see what's happening
- **Trust**: Users trust the tool more when they can see it working
- **Completion Detection**: Still works by checking full output for `<promise>COMPLETE</promise>`

## Risks

| Risk | Mitigation |
|------|------------|
| Async migration bugs | Thorough testing of error paths |
| Output encoding issues | Pass Buffer directly, convert only for capture |
| Process cleanup on errors | Ensure child process is killed on error |
| Breaking existing tests | Update tests to use async/await |

## Alternatives Considered

1. **Keep sync, use `stdio: 'inherit'`**
   - Pros: Simple change
   - Cons: Cannot detect completion signal (no output to check)
   - Decision: Rejected - completion detection is essential

2. **Use OpenCode's `--format json`**
   - Pros: Structured output, enables tool call stats, token usage, cost tracking
   - Cons: More complex parsing, requires understanding JSONL event format
   - Decision: Phase 2 enhancement - document available at takopi.dev

3. **Use ACP (Agent Client Protocol)**
   - Pros: Standardized JSON-RPC protocol, powerful features
   - Cons: Designed for editor integration (not CLI tools), complex implementation
   - Decision: Rejected - ACP is for interactive editor↔agent communication, not batch CLI execution

3. **Add heartbeat display**
   - Pros: Shows progress even when output is sparse
   - Cons: Adds complexity, may be noisy
   - Decision: Future enhancement - focus on core streaming first
