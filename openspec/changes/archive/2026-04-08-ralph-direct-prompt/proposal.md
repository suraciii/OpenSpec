## Why

`openspec ralph` 当前通过 `opencode run --command opsx-ralph` 委托 AI agent 执行迭代。但 AI agent 在解释 SKILL.md 语义时行为不确定——它会自行搜索文件或猜测 CLI 路径，导致执行不可靠。根本原因是存在两层间接：ralph.ts → opencode+skill → AI 解释 skill → AI 执行命令，其中后两步非确定性。

## What Changes

- **ralph.ts 迭代循环重构**：每次迭代直接调用 `generateRalphInstructions()` 获取最新状态，由 CLI 端拼装完整 prompt（含绝对路径、任务详情、执行步骤），通过 `opencode run "<prompt>"` 发送给 AI，消除 skill 间接层
- **保留 opsx-ralph 命令**：用户仍可通过 `/opsx-ralph` 手动执行单次 ralph 迭代（用于调试或单步执行）
- **边界处理**：当所有任务已完成时，跳过 opencode 调用直接退出

## Capabilities

### Modified Capabilities

- `ralph-cli-command`: 迭代循环从 `--command opsx-ralph` 改为直接 prompt 模式，新增全量完成检测，但保留 `/opsx-ralph` 命令供手动迭代使用

### New Capabilities

- `ralph-prompt-builder`: CLI 端 prompt 生成逻辑——从 `generateRalphInstructions()` 输出中筛选下一个待做任务，拼装纯自然语言迭代 prompt

## Impact

- `src/commands/workflow/ralph.ts`：核心改动，新增 `buildIterationPrompt()`，修改迭代循环为直接 prompt 模式
- `.opencode/skills/opsx-ralph/SKILL.md`：保留，用于手动迭代触发
- `test/commands/ralph.test.ts`：更新 mock 验证 prompt 内容
- `test/cli-e2e/ralph-schema.test.ts`：更新断言（保留 opsx-ralph skill）
- `test/core/init.test.ts`：保留 opsx-ralph 相关断言
