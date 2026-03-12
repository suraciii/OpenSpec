# Streaming Ralph Output 功能测试

**在 WSL Linux 环境** 测试 ralph 命令的实时输出流功能，验证从 `execSync` 切换到 `cross-spawn` 后的实时输出表现。

## 环境

- WSL Ubuntu 22.04/24.04
- OpenCode 1.2.15+
- Node.js 20.19.0+
- OpenSpec 本地构建版本（`/mnt/c/Users/szf/repos/OpenSpec`）

## 测试准备

**重要**：本测试验证 `ralph` 命令的实时输出流功能。

**前置条件**：
1. OpenSpec 代码库已克隆到 Windows 路径 `C:\Users\szf\repos\OpenSpec`
2. 在 Windows 中已执行构建：`pnpm build`
3. `cross-spawn` 依赖已安装
4. WSL 中可访问 `/mnt/c/Users/szf/repos/OpenSpec`

**Step 0: 安装开发版本到 WSL**

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

# 4. 验证开发版本
openspec --version
```

**期望输出**：显示 OpenSpec 版本号

**Step 0b: 验证代码已更新**

```bash
# 确认 ralph.ts 包含 cross-spawn
grep -n "cross-spawn" /mnt/c/Users/szf/repos/OpenSpec/src/commands/workflow/ralph.ts

# 确认使用了 spawn 而不是 execSync
grep -n "spawn" /mnt/c/Users/szf/repos/OpenSpec/src/commands/workflow/ralph.ts
```

**期望输出**：
- `cross-spawn` 找到匹配
- `spawn` 找到匹配（说明已替换 execSync）

---

## Step 1: 准备测试用的 Ralph-Driven Change

**执行**：

```bash
cd ~

# 清理旧测试目录
rm -rf ~/test-stream-output

# 创建测试项目
mkdir -p ~/test-stream-output && cd ~/test-stream-output
npm init -y
npm install typescript @types/node --save-dev
npx tsc --init

# 创建简单的源文件
mkdir -p src
echo 'export function add(a: number, b: number): number { return a + b; }' > src/calc.ts

# 初始化 OpenSpec（使用 ralph-driven schema）
openspec init --tools opencode --schema ralph-driven --force
```

**验证项**：

| 验证项 | 命令 | 期望 |
|--------|------|------|
| 项目目录 | `ls ~/test-stream-output` | 存在 src/, package.json |
| OpenSpec 初始化 | `ls ~/test-stream-output/openspec/` | 目录存在 |
| Schema 配置 | `cat ~/test-stream-output/openspec/config.yaml \| grep schema` | `schema: ralph-driven` |
| 命令文件 | `ls ~/test-stream-output/.opencode/commands/` | opsx-propose.md 等文件存在 |

**如果没有 change，创建一个新的**：

```bash
cd ~/test-stream-output

# 使用 opencode 创建 change（可能需要多次运行）
timeout 120 opencode run --command -- "/opsx-propose Add multiply function to calculator"

# 如果一次未完成，检查状态并继续
ls -la ~/test-stream-output/openspec/changes/
```

**验证 change 创建成功**：

```bash
# 检查所有 artifacts 存在
CHANGE_DIR=$(ls -d ~/test-stream-output/openspec/changes/*/ 2>/dev/null | head -1)

if [ -d "$CHANGE_DIR" ]; then
    echo "Change directory: $CHANGE_DIR"
    ls -la "$CHANGE_DIR"
    
    # 检查关键文件
    test -f "$CHANGE_DIR/prd.json" && echo "✓ prd.json exists"
    test -f "$CHANGE_DIR/proposal.md" && echo "✓ proposal.md exists"
    test -f "$CHANGE_DIR/design.md" && echo "✓ design.md exists"
    test -d "$CHANGE_DIR/specs" && echo "✓ specs/ exists"
else
    echo "✗ No change directory found"
fi
```

---

## Step 2: 测试实时输出流（核心功能）

**前置**：Step 1 通过，已存在 ralph-driven change

**执行**：

```bash
cd ~/test-stream-output

# 获取 change 名称
CHANGE_NAME=$(ls openspec/changes/ | grep -v archive | head -1)
echo "Testing with change: $CHANGE_NAME"

# 运行 ralph 命令，观察输出是否实时显示
openspec ralph --change "$CHANGE_NAME" --max-iterations 1
```

**人工观察验证**：

| 验证项 | 观察方法 | 期望行为 |
|--------|----------|----------|
| 输出实时性 | 观察终端 | **Before**: 30+ 秒无输出，然后一次性显示所有内容<br>**After**: 输出逐行/逐段实时出现 |
| 迭代标题 | 观察终端 | 看到 `## Iteration 1/X` 后立即看到后续输出 |
| OpenCode 输出 | 观察终端 | 能看到 OpenCode 的思考过程、工具调用等中间输出 |
| 进度指示 | 观察终端 | 可以看到 AI 正在处理任务，不会觉得"卡住" |

**客观验证 - 时间戳对比**：

```bash
cd ~/test-stream-output
CHANGE_NAME=$(ls openspec/changes/ | grep -v archive | head -1)

# 创建带时间戳的输出日志
echo "Starting ralph with timestamp logging..."
openspec ralph --change "$CHANGE_NAME" --max-iterations 1 2>&1 | while IFS= read -r line; do
    echo "[$(date '+%H:%M:%S.%3N')] $line"
done | tee /tmp/ralph-timestamp.log

echo ""
echo "Log saved to: /tmp/ralph-timestamp.log"
```

**验证项**：

| 验证项 | 检查方法 | 期望 |
|--------|----------|------|
| 时间戳分布 | `cat /tmp/ralph-timestamp.log` | 时间戳应该分散在 5-30 秒内，而不是全部集中在最后 1-2 秒 |
| 首行输出时间 | 查看第一行时间戳 | 在命令执行后 1-3 秒内就有输出 |
| 最后输出时间 | 查看最后行时间戳 | 在进程结束前 1-2 秒还有输出 |

**分析时间戳分布**：

```bash
# 提取时间戳并计算间隔
cat /tmp/ralph-timestamp.log | grep -oE '\[([0-9]{2}:){2}[0-9]{2}\.[0-9]{3}\]' | \
awk -F'[][]' '{print $2}' | \
awk -F: '{print ($1*3600 + $2*60 + $3)*1000}' | \
awk 'NR==1{start=$1} {printf "Line %d: +%d ms\n", NR, $1-start}'
```

**通过标准**：输出分布在至少 5000ms（5秒）以上的时间窗口内，而不是集中在最后 1000ms 内。

---

## Step 3: 验证完成信号检测

**前置**：Step 2 通过

**执行**：

```bash
cd ~/test-stream-output
CHANGE_NAME=$(ls openspec/changes/ | grep -v archive | head -1)

# 运行 ralph，观察是否能正确检测到 COMPLETE 信号
openspec ralph --change "$CHANGE_NAME" --max-iterations 2

echo "Exit code: $?"
```

**验证项**：

| 验证项 | 观察内容 | 期望 |
|--------|----------|------|
| 完成信号检测 | 终端输出 | 如果 OpenCode 输出 `<promise>COMPLETE</promise>`，看到 "✓ All tasks complete!" |
| 提前退出 | 观察行为 | 检测到 COMPLETE 后立即退出，不执行后续 iterations |
| 无信号继续 | 终端输出 | 如果没有 COMPLETE，看到 "→ Iteration completed, continuing..." |
| Exit code | `echo $?` | 成功完成 = 0，达到最大 iterations = 1 |

**手动测试完成信号（可选）**：

如果需要验证完成信号检测逻辑，可以检查 progress.txt：

```bash
cd ~/test-stream-output
CHANGE_NAME=$(ls openspec/changes/ | grep -v archive | head -1)

# 查看 progress.txt
cat "openspec/changes/$CHANGE_NAME/progress.txt"

# 检查是否包含 COMPLETE 信号
grep -c "COMPLETE" "openspec/changes/$CHANGE_NAME/progress.txt" || echo "No COMPLETE signal found"
```

---

## Step 4: 测试错误处理

**前置**：Step 2-3 通过

**执行**：

```bash
# 测试 1: 使用不存在的 change
cd ~/test-stream-output
openspec ralph --change "non-existent-change-12345"
echo "Exit code for invalid change: $?"

# 期望：报错并退出（非零 exit code）
```

**验证项**：

| 验证项 | 命令 | 期望 |
|--------|------|------|
| 无效 change | `openspec ralph --change "invalid"` | 报错信息清晰，exit code ≠ 0 |

**测试 2: 子进程行为**（观察性测试）

```bash
cd ~/test-stream-output
CHANGE_NAME=$(ls openspec/changes/ | grep -v archive | head -1)

# 在另一个终端窗口运行，观察进程树
# 终端 1：运行 ralph
openspec ralph --change "$CHANGE_NAME" --max-iterations 3

# 终端 2：观察子进程（在 ralph 运行时执行）
ps aux | grep -E "(opencode|openspec)" | grep -v grep
```

**验证项**：

| 验证项 | 观察方法 | 期望 |
|--------|----------|------|
| 子进程创建 | `ps aux` | ralph 运行时能看到 opencode 子进程 |
| 子进程清理 | ralph 结束后 `ps aux` | ralph 结束后无残留 opencode 进程 |

---

## Step 5: 长时间运行稳定性

**前置**：Step 2-4 通过

**执行**：

```bash
cd ~/test-stream-output
CHANGE_NAME=$(ls openspec/changes/ | grep -v archive | head -1)

# 运行多个 iterations 测试稳定性
echo "Starting stability test with 3 iterations..."
time openspec ralph --change "$CHANGE_NAME" --max-iterations 3

echo "Exit code: $?"
```

**验证项**：

| 验证项 | 观察方法 | 期望 |
|--------|----------|------|
| 多 iteration 输出 | 观察终端 | 每个 iteration 都实时显示输出 |
| 内存稳定性 | `top` 或 `htop` | 内存使用稳定，无持续增长 |
| 无输出乱码 | 观察终端 | 无乱码、无 ANSI 转义序列残留 |
| 执行时间 | `time` 命令 | 总时间合理（与迭代数成正比） |

---

## Step 6: 对比测试 - 验证改进效果

**目的**：对比旧实现（execSync）和新实现（cross-spawn）的差异

**注意**：此测试需要理解旧行为，用于验证改进效果。

### 6.1 输出实时性对比

**新实现（当前）**：
```bash
cd ~/test-stream-output
CHANGE_NAME=$(ls openspec/changes/ | grep -v archive | head -1)

# 记录开始时间
start_time=$(date +%s)

# 运行并观察
openspec ralph --change "$CHANGE_NAME" --max-iterations 1 | while read line; do
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))
    echo "[${elapsed}s] $line"
done
```

**期望**：
- 0-3 秒：第一行输出出现
- 3-30 秒：持续有输出
- 不是前 28 秒无输出，最后 2 秒爆发式输出

### 6.2 用户体验对比

| 维度 | 旧实现 (execSync) | 新实现 (cross-spawn) | 验证方法 |
|------|-------------------|----------------------|----------|
| 反馈延迟 | 30+ 秒无反馈 | 3 秒内有反馈 | 秒表计时 |
| 进度感知 | 无法知道是否卡住 | 能看到实时进展 | 主观观察 |
| 调试能力 | 困难 | 容易（能看到中间步骤） | 观察输出内容 |
| 信任度 | 低（不知道是否在运行） | 高（能看到活动） | 主观感受 |

---

## 关键验证点总结

| 功能 | 验证方法 | 通过标准 |
|------|----------|----------|
| **实时输出** | 时间戳日志分析 | 输出分布在 ≥5 秒的时间窗口内 |
| **首行延迟** | 秒表/时间戳 | 命令执行后 ≤3 秒出现第一行输出 |
| **完成检测** | 观察终端输出 | 正确识别 `<promise>COMPLETE</promise>` |
| **错误处理** | 无效 change 测试 | 清晰的错误信息，非零 exit code |
| **进程管理** | `ps aux` 观察 | 无僵尸进程，子进程正确清理 |
| **稳定性** | 3 iterations 测试 | 无内存泄漏，无乱码 |

## 故障排查

### 问题 1: 输出仍然缓冲（非实时）

**检查**：
```bash
# 确认使用了 cross-spawn
grep -n "cross-spawn" /mnt/c/Users/szf/repos/OpenSpec/src/commands/workflow/ralph.ts

# 确认 stdio 配置
grep -A2 "stdio" /mnt/c/Users/szf/repos/OpenSpec/src/commands/workflow/ralph.ts
```

**解决**：
- 在 Windows 中重新构建：`cd /mnt/c/Users/szf/repos/OpenSpec && pnpm build`
- 确认 `dist/commands/workflow/ralph.js` 包含新代码
- 重启 WSL 会话：`wsl --shutdown`

### 问题 2: 完成信号未检测到

**检查**：
```bash
cd ~/test-stream-output
CHANGE_NAME=$(ls openspec/changes/ | grep -v archive | head -1)

# 手动检查 OpenCode 输出是否包含信号
opencode run --command opsx-ralph -- "$CHANGE_NAME" 2>&1 | grep -i "COMPLETE"
```

**诊断**：
- 如果有输出：检查 ralph.ts 中的信号检测逻辑
- 如果无输出：OpenCode 可能没有发送完成信号（检查 prd.json 任务状态）

### 问题 3: 子进程残留

**检查**：
```bash
# ralph 结束后检查残留进程
ps aux | grep opencode | grep -v grep

# 如果有残留，手动清理
killall opencode 2>/dev/null || true
```

**检查代码**：确认 `ralph.ts` 中有适当的错误处理和进程清理逻辑。

### 问题 4: 路径或权限问题

**检查**：
```bash
# 确认可以访问 Windows 路径
ls -la /mnt/c/Users/szf/repos/OpenSpec/dist/cli/index.js

# 确认 openspec wrapper 正确
which openspec
cat /usr/local/bin/openspec
```

---

## 测试完成标准

所有 Step 的验证项都通过：
- ✅ Step 1: Change 准备就绪
- ✅ Step 2: 输出实时显示（时间戳分散 ≥5 秒）
- ✅ Step 3: 完成信号正确检测
- ✅ Step 4: 错误处理正常，无残留进程
- ✅ Step 5: 长时间运行稳定（3 iterations）

**测试通过后可归档 change**：
```bash
# 在 Windows 环境执行
cd /mnt/c/Users/szf/repos/OpenSpec
openspec change archive stream-ralph-output
```

或者使用命令：`/opsx-archive stream-ralph-output`
