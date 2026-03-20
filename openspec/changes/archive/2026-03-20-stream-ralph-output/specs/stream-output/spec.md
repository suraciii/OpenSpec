# Spec: Stream Output

## ADDED Requirements

### Requirement: Real-time streaming with completion detection

The Ralph command SHALL stream OpenCode subprocess output to stdout in real-time while capturing the complete output for detecting the `<promise>COMPLETE</promise>` signal.

#### Scenario: Output streams during execution
- **WHEN** user runs `openspec ralph --change my-feature`
- **THEN** OpenCode output appears on console immediately as generated (not buffered)
- **AND** user sees progress indication throughout long-running iterations
- **AND** completion signal is detected from the full captured output

#### Scenario: Process errors are handled gracefully
- **WHEN** subprocess exits with non-zero code
- **THEN** Promise rejects with error message including exit code
- **AND** any partial output already streamed to console is preserved

### Requirement: Cross-platform spawn compatibility

The spawn implementation SHALL work correctly on Windows, macOS, and Linux using cross-spawn to handle platform differences automatically.

#### Scenario: Windows spawn executes correctly
- **WHEN** running on Windows platform
- **THEN** spawn executes the command without shell noise (no cmd.exe prompt)
- **AND** output is captured and streamed correctly
- **AND** completion signal detection works

### Requirement: Async executor interface

The Executor interface SHALL be updated to return `Promise<string>` instead of `string` to support the async spawn pattern.

#### Scenario: Executor returns Promise
- **WHEN** `executeOpenCode` is called
- **THEN** it returns `Promise<string>` that resolves with full output when subprocess completes
- **AND** calling code can use `await` to get the result
