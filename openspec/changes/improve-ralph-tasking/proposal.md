## Why

当前的 prd.json 结构中，每个 task 有独立的 `acceptanceCriteria` 数组。但实际问题：

1. **重复定义**：spec 中已定义了 scenarios，acceptanceCriteria 需要重复描述相同内容
2. **缺乏追溯**：task 和 spec requirement 之间没有明确关联
3. **验证不系统**：Ralph 执行时没有结构化的方式从 spec 提取验收标准

根据 Ralph Loop 的理念，每个迭代应该完成"一个最小可验证的有价值的事项"，包含 implement + verify。我们需要让 spec 成为验收的 single source of truth。

## What Changes

- **MODIFIED**: prd.json task 结构，新增 `spec` 字段引用 spec requirement
- **MODIFIED**: `acceptanceCriteria` 语义变更 - 从"全部验收标准"变为"额外检查项"
- **MODIFIED**: Ralph instructions 生成逻辑 - 内联引用的 spec requirement 内容
- **NEW**: spec scenarios 自动作为验收标准的行为

## Capabilities

### Modified Capabilities

- `ralph-tasking`: 改进 task 结构，支持 spec 引用 + 验收标准分离

## Impact

### Modified Files

- `schemas/ralph-driven/templates/prd.json` - 新增 `spec` 字段
- `schemas/ralph-driven/schema.yaml` - 更新 prd artifact 的 instruction
- `src/commands/workflow/instructions.ts` - `generateRalphInstructions()` 内联 spec 内容
- `src/utils/task-progress.ts` - `TaskItem` 接口新增 `spec` 字段

### Behavior Changes

**旧的 prd.json:**
```json
{
  "tasks": [{
    "id": "T-001",
    "title": "Add export endpoint",
    "acceptanceCriteria": [
      "User can export CSV",
      "Export handles empty data",
      "Tests pass"
    ]
  }]
}
```

**新的 prd.json:**
```json
{
  "tasks": [{
    "id": "T-001",
    "title": "Add export endpoint",
    "spec": "specs/export/spec.md#REQ-001",
    "description": "Create /api/export endpoint",
    "acceptanceCriteria": [
      "Tests pass",
      "Typecheck passes"
    ],
    "passes": false
  }]
}
```

Ralph 执行时：
1. 读取 `spec` 引用的 requirement
2. 自动提取 spec 中的 scenarios 作为功能验收标准
3. `acceptanceCriteria` 作为额外检查项（无 spec 时则为全部验收标准）
4. 验证全部通过 → `passes: true`
