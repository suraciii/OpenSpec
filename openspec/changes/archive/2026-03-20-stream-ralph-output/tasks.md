# Tasks: Stream Ralph Output

## 1. Dependencies

- [x] 1.1 Add `cross-spawn` to package.json dependencies
- [x] 1.2 Run `pnpm install` to install cross-spawn

## 2. Interface Update

- [x] 2.1 Update `Executor` interface to return `Promise<string>` instead of `string`
- [x] 2.2 Update `RealExecutor` class to implement async `executeOpenCode`
- [x] 2.3 Update `setExecutor` parameter type to accept async Executor

## 3. Implementation

- [x] 3.1 Import `spawn` from `cross-spawn` in ralph.ts
- [x] 3.2 Rewrite `executeOpenCode` method to use spawn with Promise wrapper
- [x] 3.3 Configure stdio as `['inherit', 'pipe', 'inherit']`
- [x] 3.4 Stream stdout data to process.stdout in real-time
- [x] 3.5 Capture full output for completion signal detection
- [x] 3.6 Handle process errors with proper rejection
- [x] 3.7 Handle non-zero exit codes with descriptive error messages
- [x] 3.8 Add try-finally to ensure child process cleanup on error

## 4. ralphCommand Updates

- [x] 4.1 Add `await` to `executor.executeOpenCode()` call
- [x] 4.2 Verify completion signal detection still works with async flow

## 5. Test Updates

- [x] 5.1 Update mock executor to use `mockResolvedValue` instead of `mockReturnValue`
- [x] 5.2 Update test for completion signal detection (async)
- [x] 5.3 Update test for max iterations without completion (async)
- [x] 5.4 Update test for progress archiving (async)
- [x] 5.5 Add integration test for real spawn with simple command (echo/dir)
