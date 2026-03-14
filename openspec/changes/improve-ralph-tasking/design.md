## Context

当前的 ralph-driven schema 使用 prd.json 作为任务追踪。每个 task 有 `acceptanceCriteria` 数组，但这与 spec 中定义的 scenarios 重复，且缺乏结构化关联。

## Goals / Non-Goals

**Goals:**
- 让 spec 成为验收的 single source of truth
- 简化 prd.json 编写 - 有 spec 时无需重复验收标准
- Ralph 执行时能从 task.spec 读取验收标准
- 保持向后兼容 - 无 spec 的 task 仍可使用 acceptanceCriteria

**Non-Goals:**
- 修改 spec-driven schema
- 改变交互式 apply 工作流
- 自动从 spec 生成 tasks
- CLI 决定当前 task（这是 LLM 的责任）

## Decisions

### D1: Task 结构扩展

**Decision:** 在 task 中新增可选的 `spec` 字段，格式为 `specs/<capability>/spec.md#REQ-ID`。

**Rationale:**
- 明确追溯：task → spec requirement
- 支持部分 task 有 spec，部分没有
- URL 片段格式 (#REQ-ID) 精确定位到具体 requirement

**限制:** spec 只支持单个 requirement。如果需要多个，应拆分成多个 task。

**新结构:**
```typescript
interface Task {
  id: string;
  title: string;
  spec?: string;           // 可选：引用单个 spec requirement
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
- 有 `spec` → spec scenarios 作为功能验收 + acceptanceCriteria 作为额外检查
- 无 `spec` → acceptanceCriteria 就是全部验收标准

**Rationale:**
- 避免重复
- spec 中的 scenarios 更详细、更规范
- acceptanceCriteria 用于补充 spec 未覆盖的检查（Tests pass, Typecheck, Lint 等）

### D3: CLI 不决定当前 task

**Decision:** CLI 只输出 tasks 数组，不提供 currentTask 或 currentTaskIndex。LLM 负责选择合适的 pending task。

**Rationale:**
- 信任 LLM 能智能选择（可能考虑依赖关系、上下文等）
- 简化 CLI 实现
- 符合 Ralph "自主" 理念

### D4: CLI 保留 spec 字段到 tasks 输出

**Decision:** `parsePrdForRalph()` 保留 task 的 `spec` 字段，让 LLM 可以读取。

**改动:**
```typescript
// 当前
return prd.tasks.map((task) => ({
  id, title, description, acceptanceCriteria, priority, done
}));

// 新增
return prd.tasks.map((task) => ({
  id, title, description, acceptanceCriteria, priority, done,
  spec: task.spec  // 新增
}));
```

### D5: Instruction 文本更新

**Decision:** 更新 instruction 文本，引用 tasks 数组而非 prd.json。

**当前:**
```
2. Read prd.json to find the highest priority pending task...
```

**改为:**
```
2. Select a pending task (done: false) from tasks array
```

### D6: 空验收标准通过规范保证

**Decision:** 不在 CLI 代码中处理空验收标准，通过 schema.yaml 的 prd instruction 规范保证。

**规范要求:**
- 有 spec → acceptanceCriteria 可空，spec scenarios 覆盖验收
- 无 spec → acceptanceCriteria 必须包含可验证项
- 所有 task 必须可验证（有测试用例覆盖）

### D7: contextFiles.specs 保留 glob

**Decision:** 保持现有 `specs/**/*.md` glob pattern，不做修改。

**Rationale:**
- 简单，无需改动
- LLM 可自行选择读取哪些 spec 文件

### D8: 向后兼容

**Decision:** 旧格式 prd.json（无 spec 字段）继续工作。

**兼容逻辑:**
- 有 `spec` → Ralph 读取 spec scenarios + acceptanceCriteria 作为额外检查
- 无 `spec` → acceptanceCriteria 就是全部验收标准

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| spec 引用失效 | CLI 验证 spec 路径存在 |
| requirement ID 变化 | 使用相对路径 + name 匹配作为 fallback |
| 用户不理解新语义 | 文档说明 + prd.json 模板注释 |
| LLM 选错 task | 信任 LLM，priority 字段提供指导 |

## Migration Plan

1. 更新 prd.json 模板，添加 `spec` 字段示例和注释
2. 更新 schema.yaml 的 prd instruction，说明新用法
3. 更新 TaskItem 接口添加 `spec` 字段
4. 修改 `parsePrdForRalph()` 保留 `spec` 字段
5. 更新 instruction 文本引用 tasks 数组
6. 更新 opsx-ralph skill 读取 task.spec

无需迁移现有 prd.json 文件 - 它们继续工作。
