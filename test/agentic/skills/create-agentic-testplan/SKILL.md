---
name: create-agentic-testplan
description: 为 OpenSpec 功能创建 Agentic 测试计划。当需要为某个 feature 或 change 创建端到端的测试计划，或设计给 AI Agent 执行的自然语言测试流程时使用。
allowed-tools: Read, Write, Glob, Grep
---

# Create Agentic Test Plan

为 OpenSpec 功能创建自然语言测试计划，供 AI Agent 在隔离容器中执行。

## 使用场景

- 为新的 OpenSpec 功能创建端到端验证测试
- 为 Ralph workflow 创建用户场景测试
- 验证 spec 字段、schema 变更等核心功能
- 设计可重复执行的自动化验收测试

## 创建步骤

### 1. 理解被测功能

阅读相关文档了解要测试的功能：
- `openspec/changes/<name>/specs/` - 功能需求
- `openspec/changes/<name>/design.md` - 实现设计
- `src/` 中的相关代码

**关键问题**：
- 这个功能解决什么问题？
- 用户如何自然地使用它？
- 什么是成功的标志？
- 可能有哪些失败模式？

### 2. 设计测试场景

创建一个**真实用户场景**，而不是技术验证：

**好的场景**：
- "开发者第一次使用 OpenSpec 创建项目"
- "团队使用 Ralph workflow 实现新功能"
- "用户迁移从 spec-driven 到 ralph-driven"

**不好的场景**：
- "验证 parsePrdForRalph 函数"
- "测试 spec 字段 JSON 输出"
- "检查 TypeScript 接口定义"

### 3. 定义测试阶段

将测试分解为自然阶段（通常 5-7 个）：

```
Phase 1: 项目初始化
Phase 2: 配置设置
Phase 3: 功能使用
Phase 4: 验证结果
```

每个阶段应该：
- 有明确的目标
- 包含具体的命令
- 有验证检查点
- 模拟真实用户行为

### 4. 编写 TESTPLAN.md

创建文件：`test/agentic/verify-<feature>/TESTPLAN.md`

**结构**：

```markdown
# Agentic Test Plan: [场景名称]

## Test Scenario

[描述测试场景 - 你是谁，在做什么]

## Your Project

- **Project**: [项目名称]
- **Current State**: [初始状态]
- **Goal**: [目标]
- **Workflow**: [使用的工作流]

## Prerequisites

[容器环境假设]

## Test Phases

### Phase 1: [阶段名称]

**Context**: [为什么做这个阶段]

**Steps**:
1. [具体步骤]
2. [具体步骤]

**What to do**:
\`\`\`bash
[具体的命令]
\`\`\`

**Verification**:
- [检查点 1]
- [检查点 2]

---

### Phase 2: [下一个阶段]
...

## Success Criteria

测试 **PASSED** 如果：
- ✅ [标准 1]
- ✅ [标准 2]
- ...

测试 **FAILED** 如果任何标准不满足。

## What You're Actually Testing

[解释这个测试在验证什么功能]

## Reporting

[期望的输出格式]
```

### 5. 创建支持文件

在同一个目录创建：

```
test/agentic/verify-<feature>/
├── TESTPLAN.md              # 测试计划（你刚创建的）
├── Containerfile.e2e        # 容器定义
├── run.sh                   # 启动脚本
└── fixtures/                # 配置文件
    ├── opencode-config.json
    └── auth.json
```

**Containerfile.e2e** 模板：

```dockerfile
FROM node:20-slim

RUN apt-get update && apt-get install -y git curl jq \
    && rm -rf /var/lib/apt/lists/*

ARG USER_ID=1000
ARG GROUP_ID=1000
RUN groupadd -g ${GROUP_ID} opentest && \
    useradd -u ${USER_ID} -g opentest -m -s /bin/bash opentest

# Install OpenCode
RUN npm install -g opencode

# Copy and install OpenSpec from source
COPY --chown=opentest:opentest . /opt/openspec-src
WORKDIR /opt/openspec-src
RUN npm ci && npm run build && npm link

RUN mkdir -p /home/opentest/.config/opencode \
    && mkdir -p /home/opentest/.local/share/opencode \
    && chown -R opentest:opentest /home/opentest

USER opentest
WORKDIR /app

CMD ["opencode", "--help"]
```

**run.sh** 模板：

```bash
#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

IMAGE_NAME="openspec-agentic-qa"
USER_ID=$(id -u)
GROUP_ID=$(id -g)

if [ -z "${OPENCODE_API_KEY}" ]; then
    echo "Error: OPENCODE_API_KEY not set"
    exit 1
fi

if ! podman image inspect "${IMAGE_NAME}" &>/dev/null; then
    podman build -t "${IMAGE_NAME}" \
        --build-arg USER_ID="${USER_ID}" \
        --build-arg GROUP_ID="${GROUP_ID}" \
        -f "${SCRIPT_DIR}/Containerfile.e2e" \
        "${PROJECT_ROOT}"
fi

podman run --rm -it \
    --user "${USER_ID}:${GROUP_ID}" \
    -e OPENCODE_API_KEY="${OPENCODE_API_KEY}" \
    -e OPENCODE_MODEL="${OPENCODE_MODEL:-}" \
    -v "${SCRIPT_DIR}/fixtures/opencode-config.json:/home/opentest/.config/opencode/opencode.json:ro,Z" \
    -v "${SCRIPT_DIR}/fixtures/auth.json:/home/opentest/.local/share/opencode/auth.json:ro,Z" \
    -v "${SCRIPT_DIR}/TESTPLAN.md:/app/TESTPLAN.md:ro,Z" \
    -v "${PROJECT_ROOT}:/opt/openspec:ro,Z" \
    -w /app \
    "${IMAGE_NAME}" \
    opencode run --file /app/TESTPLAN.md
```

### 6. 验证测试计划

检查清单：
- [ ] 场景是否真实可信？
- [ ] 命令是否可以复制粘贴执行？
- [ ] 验证点是否明确可观察？
- [ ] 是否不依赖 OpenSpec 内部实现细节？
- [ ] 是否覆盖要测试的核心功能？
- [ ] 失败时能否清楚说明原因？

## 最佳实践

1. **用户视角**：描述用户想做什么，而不是系统如何工作
2. **完整流程**：从开始到结束，不跳过关键步骤
3. **可观察验证**：每个阶段都有明确的检查点
4. **自然语言**：Agent 应该能理解意图，而不只是命令
5. **合理假设**：容器预装了什么？API key 如何提供？
6. **灵活但不模糊**：给 Agent 自由度，但成功标准是明确的

## 示例

**输入**：
"为 spec 字段功能创建一个测试计划"

**输出**：
创建 `test/agentic/verify-spec-field/TESTPLAN.md`，包含：
- 场景：开发者首次使用 ralph-driven workflow
- 项目：string-utils 库
- 阶段：Setup → Init → Propose → Continue → Ralph → Validate
- 验证：观察 spec 字段是否自然出现并被使用

## 注意事项

- 测试计划应该放在 `test/agentic/verify-<feature>/` 目录
- 不要和现有的单元测试或集成测试重复
- 关注用户价值，不是代码覆盖率
- 保持测试计划可维护，定期更新