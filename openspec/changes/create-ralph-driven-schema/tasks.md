## 1. Schema Structure

- [x] 1.1 Create `schemas/ralph-driven/schema.yaml` with prd artifact and apply.tracks config
- [x] 1.2 Create `schemas/ralph-driven/templates/` directory with symlinks to shared templates
- [x] 1.3 Create `schemas/ralph-driven/templates/prd.json` template file

## 2. Task Parser Refactoring

- [x] 2.1 Create `PrdJsonTaskParser` class in `src/utils/task-progress.ts`
- [x] 2.2 Create `MarkdownTaskParser` class in `src/utils/task-progress.ts`
- [x] 2.3 Implement `getTaskProgressForChange()` with format auto-detection
- [x] 2.4 Add `parsePrdFile()` function for JSON task extraction in `src/commands/workflow/instructions.ts`

## 3. Remove Duplicate Logic

- [x] 3.1 Remove duplicate `countTasks()` method from `src/commands/change.ts`
- [x] 3.2 Update `src/commands/change.ts` to use `getTaskProgressForChange()`
- [x] 3.3 Verify `src/core/archive.ts` uses unified parser (already does)

## 4. Schema Discovery

- [x] 4.1 Create `schemas/ralph-driven/schema.yaml` (resolver auto-discovers schemas by directory name)
- [x] 4.2 Verify `openspec new change --schema ralph-driven` works with new schema

## 5. Tests

- [x] 5.1 Add unit tests for `PrdJsonTaskParser` class
- [x] 5.2 Add unit tests for `getTaskProgressForChange()` with both formats
- [x] 5.3 Add integration test for `openspec new change --schema ralph-driven`
- [x] 5.4 Add cross-platform path tests for prd.json parsing

## 6. Config Integration

- [x] 6.1 Add `schema` field support to `openspec/config.yaml` parsing
- [x] 6.2 Update `openspec init` to accept `--schema <name>` option
- [x] 6.3 Update `openspec new change` to use config default schema
- [x] 6.4 Update schema list command to show ralph-driven option

## 7. Ralph CLI Command

- [x] 7.1 Create `src/commands/workflow/ralph.ts` with command implementation
- [x] 7.2 Implement prd.json validation and task loading
- [x] 7.3 Implement progress.txt archiving to `openspec/changes/<name>/archive/<timestamp>/`
- [x] 7.4 Implement iteration loop with AI tool spawning
- [x] 7.5 Implement completion detection via `<promise>COMPLETE</promise>`
- [x] 7.6 Add support for multiple AI tools (opencode, amp, claude)
- [x] 7.7 Register command in `src/cli/index.ts`
- [x] 7.8 Add `--max-iterations`, `--tool`, `--json` options

## 8. Tests for Ralph Command

- [x] 8.1 Add unit tests for Ralph command core logic
- [x] 8.2 Add integration tests for AI tool spawning
- [x] 8.3 Add tests for progress archiving
- [x] 8.4 Add tests for completion detection

## 9. Documentation

- [x] 9.1 Add ralph-driven schema description in schema.yaml
- [x] 9.2 Update README with ralph-driven workflow guide
- [x] 9.3 Document `openspec ralph` command usage
