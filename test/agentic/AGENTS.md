# Agentic Testing Context

## 概述

Agentic Testing 是让 AI Agent 在隔离容器中执行自然语言测试计划的测试范式。

## 目录结构

```
test/agentic/
├── README.md                    # 框架文档和模板
├── shared/
│   ├── Containerfile            # 通用容器定义
│   └── fixtures/                # 共享 OpenCode 配置
│       ├── opencode-config.json
│       └── auth.json
└── verify-<feature>/
    └── TESTPLAN.md              # 测试内容（Agent 执行）
```

## 运行测试

```bash
# 使用 skill 自动执行
opencode run --skill execute-agentic-test -- verify-<feature>

# 或者手动启动容器
export OPENCODE_API_KEY="sk-xxx"

podman build -t openspec-agentic-test \
  --build-arg USER_ID=$(id -u) \
  --build-arg GROUP_ID=$(id -g) \
  -f test/agentic/shared/Containerfile \
  .

podman run --rm -it \
  --user $(id -u):$(id -g) \
  -e OPENCODE_API_KEY="${OPENCODE_API_KEY}" \
  -v "$(pwd)/test/agentic/verify-<feature>/TESTPLAN.md:/app/TESTPLAN.md:ro,Z" \
  -v "$(pwd)/test/agentic/shared/fixtures/opencode-config.json:/home/opentest/.config/opencode/opencode.json:ro,Z" \
  -v "$(pwd)/test/agentic/shared/fixtures/auth.json:/home/opentest/.local/share/opencode/auth.json:ro,Z" \
  -v "$(pwd):/opt/openspec:ro,Z" \
  -w /app \
  openspec-agentic-test \
  opencode run --file /app/TESTPLAN.md
```

## 创建新测试

1. 创建目录: `mkdir -p test/agentic/verify-<feature>`
2. 编写 `TESTPLAN.md`:
   - Test Scenario: 测试场景描述
   - Prerequisites: 容器环境假设
   - Phases: 测试阶段（每个阶段包含命令和验证点）
   - Success Criteria: 成功标准
   - Reporting: 报告格式

## TESTPLAN.md 模板

```markdown
# Test Plan: <Feature>

## Test Scenario

<What you're testing>

## Prerequisites

Container environment with:
- Node.js, npm
- OpenSpec CLI
- OpenCode CLI with API access
- Working directory: `/app/workspace`

---

## Phase 1: <Name>

**What to do**:
```bash
# Commands
```

**Verification**:
- Check points

---

## Success Criteria

Test is **PASSED** if:
1. ✅ Criterion 1
2. ✅ Criterion 2

---

## Reporting

Output structured report.
```

## 关键约定

1. **共享资源**: 所有测试使用 `shared/Containerfile` 和 `shared/fixtures/`
2. **职责分离**: 
   - `README.md` = 框架文档
   - `TESTPLAN.md` = Agent 执行的测试内容
3. **容器环境**: 
   - 工作目录: `/app`
   - 测试项目: `/app/workspace/`
   - OpenSpec 源码: `/opt/openspec` (只读)

## 相关 Skills

- `execute-agentic-test`: 自动执行测试计划
- `openspec-explore`: 探索想法和需求
- `openspec-propose`: 创建新的 change proposal
