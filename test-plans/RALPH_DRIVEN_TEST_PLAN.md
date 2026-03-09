# Ralph-Driven 工作流测试

** 使用 WSL 环境 ** 测试 ralph-driven 工作流，验证 opsx-propose 生成 ralph-driven artifacts。

## 环境

- WSL Ubuntu
- OpenCode 1.2.15
- OpenSpec 本地构建版本（`/mnt/c/Users/szf/repos/OpenSpec/dist/cli/index.js`）

## 测试准备

**重要**：本测试使用开发中的 OpenSpec 版本，包含 `ralph-driven` schema。

**前置条件**：
1. OpenSpec 代码库已克隆到 `/mnt/c/Users/szf/repos/OpenSpec`
2. 已执行构建：`npm run build`（在 Windows 环境中）
3. `dist/cli/index.js` 文件存在

**Step 0: 安装开发版本**

在 WSL 中安装开发版本的 openspec 命令：

```bash
# 1. 清理全局配置（避免 delivery 设置影响测试）
rm -f ~/.config/openspec/config.json

# 2. 创建 wrapper 脚本指向开发版本
sudo tee /usr/local/bin/openspec > /dev/null << 'EOF'
#!/bin/bash
node /mnt/c/Users/szf/repos/OpenSpec/dist/cli/index.js "$@"
EOF

# 3. 添加执行权限
sudo chmod +x /usr/local/bin/openspec
```

**验证开发版本**：
```bash
openspec schemas | grep ralph-driven
```
期望输出：包含 `ralph-driven` schema

**如果 ralph-driven 不存在**：
- 确认代码库包含 ralph-driven schema 实现
- 在 Windows 环境重新构建：`cd /mnt/c/Users/szf/repos/OpenSpec && npm run build`
- 检查 `schemas/ralph-driven/schema.yaml` 文件存在

**验证全局配置已清理**：
```bash
ls ~/.config/openspec/config.json
```
期望输出：`No such file or directory`（确保使用默认配置 delivery: both）

---

## Step 1: 初始化测试环境

**执行**：
```bash
rm -rf ~/test-ralph-driven
mkdir test-ralph-driven && cd test-ralph-driven
npm init -y && npm install typescript @types/node --save-dev && npx tsc --init
mkdir -p src && echo 'export function add(a: number, b: number): number { return a + b; }' > src/calc.ts
node /mnt/c/Users/szf/repos/OpenSpec/dist/cli/index.js init --tools opencode --schema ralph-driven
```

**验证项**：

| 验证项 | 命令 | 期望 |
|--------|------|------|
| src/calc.ts | `ls ~/test-ralph-driven/src/calc.ts` | 存在 |
| openspec/ | `ls -d ~/test-ralph-driven/openspec/` | 存在 |
| .opencode/commands/ | `ls ~/test-ralph-driven/.opencode/commands/` | 存在且有文件 |
| opsx-propose.md | `ls ~/test-ralph-driven/.opencode/commands/opsx-propose.md` | 存在 |
| **关键** config.yaml schema | `grep "^schema:" ~/test-ralph-driven/openspec/config.yaml` | `schema: ralph-driven` |
| **关键** opsx-propose.md 提及 prd.json | `grep -i "prd.json" ~/test-ralph-driven/.opencode/commands/opsx-propose.md` | 有匹配 |
| **关键** opsx-propose.md 提及 openspec ralph | `grep -i "openspec ralph" ~/test-ralph-driven/.opencode/commands/opsx-propose.md` | 有匹配 |

---

## Step 2: opsx-propose 创建 Change

**前置**：Step 1 所有验证通过

**执行**：
```bash
cd ~/test-ralph-driven && timeout 120 opencode run --command -- "/opsx-propose Add multiply function to calculator"
```
*如 AI 询问细节："添加 multiply 函数，接收两个数字参数，返回乘积"*

**重要**：如果一次 propose 未完成所有工件（proposal.md, design.md, specs/, prd.json），重复运行 propose 命令直到所有工件创建完成。

**验证项**：

| 验证项 | 命令 | 期望 |
|--------|------|------|
| change 目录 | `ls ~/test-ralph-driven/openspec/changes/` | 有目录 |
| proposal.md | `find ~/test-ralph-driven/openspec/changes -name "proposal.md"` | 找到 |
| specs/ | `find ~/test-ralph-driven/openspec/changes -type d -name "specs"` | 找到 |
| design.md | `find ~/test-ralph-driven/openspec/changes -name "design.md"` | 找到 |
| **关键** prd.json | `find ~/test-ralph-driven/openspec/changes -name "prd.json"` | 找到 |
| **关键** tasks.md 不存在 | `find ~/test-ralph-driven/openspec/changes -name "tasks.md"` | **无输出** |
| prd.json 有效 JSON | `find ~/test-ralph-driven/openspec/changes -name "prd.json" -exec cat {} \; | jq '.tasks' | head -5` | 显示 tasks |

---

## Step 3: 验证 Ralph Instructions

**前置**：Step 2 所有验证通过（prd.json 存在且 tasks.md 不存在）

**执行**：
```bash
cd ~/test-ralph-driven && openspec instructions ralph --change $(ls openspec/changes/ | grep -v archive | head -1) --json
```

**验证项**：

| 验证项 | 命令 | 期望 |
|--------|------|------|
| JSON 有效 | `... --json | jq .` | 成功解析 |
| schemaName | `... --json | jq '.schemaName'` | `"ralph-driven"` |
| contextFiles | `... --json | jq '.contextFiles'` | 包含 proposal、specs、design、prd |
| tasks 数组 | `... --json | jq '.tasks'` | 非空数组 |
| instruction | `... --json | jq '.instruction'` | 非空字符串 |

---

## Step 4: 执行 Ralph 工作流

**前置**：Step 3 所有验证通过

**执行**：
```bash
cd ~/test-ralph-driven && openspec ralph --change $(ls openspec/changes/ | grep -v archive | head -1) --max-iterations 3
```

**验证项**：

| 验证项 | 命令 | 期望 |
|--------|------|------|
| 正常退出 | 检查退出码 | `exit code = 0` |
| 完成 iteration | `grep -i "iteration" .test-diagnostics/step4-ralph.log` | 有匹配 |
| progress.txt | `find ~/test-ralph-driven/openspec/changes -name "progress.txt"` | 找到 |

---

## Step 5: 验证最终结果

**前置**：Step 4 所有验证通过

**执行**：
```bash
CHANGE_NAME=$(ls ~/test-ralph-driven/openspec/changes/ | grep -v archive | head -1)
cat ~/test-ralph-driven/openspec/changes/$CHANGE_NAME/prd.json | jq '.tasks[] | {id, passes}'
cat ~/test-ralph-driven/src/calc.ts
cd ~/test-ralph-driven && npx tsc --noEmit
cat ~/test-ralph-driven/openspec/changes/$CHANGE_NAME/progress.txt
```

**验证项**：

| 验证项 | 命令 | 期望 |
|--------|------|------|
| 所有任务通过 | `cat .../prd.json | jq '.tasks[].passes' | grep -c true` | 计数 = 任务总数 |
| multiply 函数 | `grep -i "multiply" ~/test-ralph-driven/src/calc.ts` | 找到 |
| TypeScript 编译 | `cd ~/test-ralph-driven && npx tsc --noEmit` | exit code = 0 |

---

## 关键验证点

- Step 1: `openspec/config.yaml` schema = `ralph-driven`
- Step 1: `opsx-propose.md` 提及 `prd.json` 和 `openspec ralph`
- Step 2: 生成 `prd.json`，**不生成** `tasks.md`
