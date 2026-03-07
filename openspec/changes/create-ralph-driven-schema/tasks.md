## 1. Schema Structure

- [ ] 1.1 Create `schemas/ralph-driven/schema.yaml` with prd artifact and apply.tracks config
- [ ] 1.2 Create `schemas/ralph-driven/templates/` directory with symlinks to shared templates
- [ ] 1.3 Create `schemas/ralph-driven/templates/prd.json` template file

## 2. Task Parser Refactoring

- [ ] 2.1 Create `PrdJsonTaskParser` class in `src/utils/task-progress.ts`
- [ ] 2.2 Create `MarkdownTaskParser` class in `src/utils/task-progress.ts`
- [ ] 2.3 Implement `getTaskProgressForChange()` with format auto-detection
- [ ] 2.4 Add `parsePrdFile()` function for JSON task extraction in `src/commands/workflow/instructions.ts`

## 3. Remove Duplicate Logic

- [ ] 3.1 Remove duplicate `countTasks()` method from `src/commands/change.ts`
- [ ] 3.2 Update `src/commands/change.ts` to use `getTaskProgressForChange()`
- [ ] 3.3 Verify `src/core/archive.ts` uses unified parser (already does)

## 4. Schema Discovery

- [ ] 4.1 Create `schemas/ralph-driven/schema.yaml` (resolver auto-discovers schemas by directory name)
- [ ] 4.2 Verify `openspec new change --schema ralph-driven` works with new schema

## 5. Tests

- [ ] 5.1 Add unit tests for `PrdJsonTaskParser` class
- [ ] 5.2 Add unit tests for `getTaskProgressForChange()` with both formats
- [ ] 5.3 Add integration test for `openspec new change --schema ralph-driven`
- [ ] 5.4 Add cross-platform path tests for prd.json parsing

## 6. Config Integration

- [ ] 6.1 Add `schema` field support to `openspec/config.yaml` parsing
- [ ] 6.2 Update `openspec init` to accept `--schema <name>` option
- [ ] 6.3 Update `openspec new change` to use config default schema
- [ ] 6.4 Update schema list command to show ralph-driven option

## 7. Documentation

- [ ] 7.1 Add ralph-driven schema description in schema.yaml
- [ ] 7.2 Update README with ralph-driven workflow guide
