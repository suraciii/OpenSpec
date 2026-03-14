## Context

当前的 ralph-driven schema 使用 prd.json 作为任务追踪。每个 task 有 `acceptanceCriteria` 数组，但这与 spec 中定义的 scenarios 重复，且缺乏结构化关联。

## Goals / Non-Goals

**Goals:**
- 让 spec 成为验收的 single source of truth
- 简化 prd.json 编写 - 有 spec 时无需重复验收标准
- Ralph 执行时能自动获取 spec scenarios 作为验收标准
- 保持向后兼容 - 无 spec 的 task 仍可使用 acceptanceCriteria

**Non-Goals:**
- 修改 spec-driven schema
- 改变交互式 apply 工作流
- 自动从 spec 生成 tasks

## Decisions

### D1: Task 结构扩展

**Decision:** 在 task 中新增可选的 `spec` 字段，格式为 `specs/<capability>/spec.md#REQ-ID`。

**Rationale:**
- 明确追溯：task → spec requirement
- 支持部分 task 有 spec，部分没有
- URL 片段格式 (#REQ-ID) 精确定位到具体 requirement

**新结构:**
```typescript
interface Task {
  id: string;
  title: string;
  spec?: string;           // 可选：引用 spec requirement
  description: string;
  acceptanceCriteria: string[];  // 额外检查项（无 spec 时为全部）
  priority: number;
  passes: boolean;
  notes?: string;
}
```

### D2: acceptanceCriteria 语义变更

**Decision:** `acceptanceCriteria` 从"全部验收标准"变为"额外检查项"。

**规则:**
- 有 `spec` → scenarios 自动作为功能验收 + acceptanceCriteria 作为额外检查
- 无 `spec` → acceptanceCriteria 就是全部验收标准

**Rationale:**
- 避免重复
- spec 中的 scenarios 更详细、更规范
- acceptanceCriteria 用于补充 spec 未覆盖的检查（Tests pass, Typecheck, Lint 等）

### D3: Ralph Instructions 生成优化

**Decision:** 生成指令时，内联引用的 spec requirement 内容。

**当前输出:**
```json
{
  "contextFiles": { "specs": "path/to/specs/**/*.md" },
  "tasks": [...]
}
```

**新输出:**
```json
{
  "task": {
    "id": "T-001",
    "spec": "specs/export/spec.md#REQ-001",
    "description": "...",
    "acceptanceCriteria": [...]
  },
  "specContent": "### Requirement: Export\n#### Scenario: ...",
  "contextFiles": { ... },
  "instruction": "..."
}
```

**Rationale:**
- Ralph 不需要自己读 spec 文件并筛选
- 只包含相关的 requirement，节省 context window
- 验收标准明确可见

### D4: 向后兼容

**Decision:** 旧格式 prd.json（无 spec 字段）继续工作。

**兼容逻辑:**
```typescript
// 读取 task 时
if (task.spec) {
  // 新模式：从 spec 提取 scenarios + acceptanceCriteria
} else {
  // 旧模式：acceptanceCriteria 就是全部验收标准
}
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| spec 引用失效 | CLI 验证 spec 路径存在 |
| requirement ID 变化 | 使用相对路径 + name 匹配作为 fallback |
| 用户不理解新语义 | 文档说明 + prd.json 模板注释 |

## Migration Plan

1. 更新 prd.json 模板，添加 `spec` 字段示例和注释
2. 更新 schema.yaml 的 prd instruction，说明新用法
3. 修改 `generateRalphInstructions()` 支持 spec 内联
4. 保持旧格式兼容

无需迁移现有 prd.json 文件 - 它们继续工作。
