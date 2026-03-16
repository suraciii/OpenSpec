---
name: execute-agentic-test
description: 执行 Agentic 测试计划。当需要在容器化环境中运行 TESTPLAN.md，验证 OpenSpec 功能，或作为 QA 工程师执行端到端测试时使用。
allowed-tools: Bash(podman *), Bash(ls *), Bash(cat *), Bash(grep *), Bash(jq *), Read, Glob
---

# Execute Agentic Test

作为 QA 工程师执行 Agentic 测试计划，在隔离的容器环境中验证 OpenSpec 功能。

## 使用场景

- 运行已有的 TESTPLAN.md 验证功能
- 执行端到端的 Ralph workflow 测试
- 在隔离环境中重现用户场景
- 作为发布前的验收测试
- 验证 PR 中的功能变更

## 执行步骤

### 1. 准备工作

**检查环境**：
- Podman 已安装并可运行
- OpenSpec 代码库在预期位置
- API key 已设置

**设置环境变量**（如果不存在）：
```bash
export OPENCODE_API_KEY="your-api-key"
export OPENCODE_MODEL="zhipuai-coding-plan"  # 或其他模型
```

### 2. 导航到测试目录

找到要执行的测试：

```bash
ls test/agentic/
```

进入具体测试目录：

```bash
cd test/agentic/verify-<feature>/
```

### 3. 阅读测试计划

在执行前，完整阅读 `TESTPLAN.md`：

```bash
cat TESTPLAN.md
```

**理解要点**：
- 测试场景是什么？
- 涉及哪些阶段？
- 成功标准是什么？
- 需要什么资源？

### 4. 执行测试

运行启动脚本：

```bash
./run.sh
```

或者手动启动容器：

```bash
# 构建镜像（如果需要）
podman build -t openspec-agentic-qa \
    --build-arg USER_ID=$(id -u) \
    --build-arg GROUP_ID=$(id -g) \
    -f Containerfile.e2e \
    ../../../

# 运行测试
podman run --rm -it \
    --user $(id -u):$(id -g) \
    -e OPENCODE_API_KEY="${OPENCODE_API_KEY}" \
    -e OPENCODE_MODEL="${OPENCODE_MODEL:-zhipuai-coding-plan}" \
    -v "./fixtures/opencode-config.json:/home/opentest/.config/opencode/opencode.json:ro,Z" \
    -v "./fixtures/auth.json:/home/opentest/.local/share/opencode/auth.json:ro,Z" \
    -v "./TESTPLAN.md:/app/TESTPLAN.md:ro,Z" \
    -v "../../../:/opt/openspec:ro,Z" \
    -w /app \
    openspec-agentic-qa \
    opencode run --file /app/TESTPLAN.md
```

### 5. 观察执行

**在容器内**，你应该：
1. 阅读挂载的 TESTPLAN.md
2. 按照 Phase 1, 2, 3... 的顺序执行
3. 在每个阶段执行验证检查
4. 记录结果和观察

**如果容器启动的是交互式 shell**：
```bash
# 在容器内
cat /app/TESTPLAN.md
# 然后手动执行各个阶段
```

**如果容器自动运行 opencode**：
- 等待 OpenCode Agent 执行测试计划
- 观察输出和日志

### 6. 验证结果

**容器内验证**：
- 按照 TESTPLAN.md 中的 Success Criteria 逐一检查
- 记录每个检查项的结果（✅/❌）
- 如果有失败，记录详细原因

**常见检查**：
- 文件是否创建？
- JSON 输出是否正确？
- 函数是否实现？
- TypeScript 是否编译？

### 7. 生成报告

根据 TESTPLAN.md 的 Reporting 部分，输出结构化报告：

```markdown
## Test Results: [场景名称]

### Phase Summary
| Phase | Status | Notes |
|-------|--------|-------|
| 1. ... | ✅/❌ | ... |
| ... | ... | ... |

### Key Findings
- **Feature works**: [Yes/No]
- **Issues found**: [描述]
- **Unexpected behavior**: [描述]

### Conclusion
[PASS/FAIL] - [总结]
```

### 8. 清理（如果需要）

测试完成后：

```bash
# 退出容器
exit

# 可选：清理镜像
podman rmi openspec-agentic-qa

# 可选：清理构建缓存
podman system prune
```

## 故障排除

### 镜像构建失败

**检查**：
- Dockerfile 路径是否正确
- OpenSpec 源码是否完整
- npm install 是否有错误

**解决**：
```bash
# 清理并重建
podman rmi openspec-agentic-qa
./run.sh
```

### 容器无法启动

**检查**：
- OPENCODE_API_KEY 是否设置
- 挂载路径是否存在
- 权限是否正确

**解决**：
```bash
# 检查 API key
echo $OPENCODE_API_KEY

# 检查文件存在
ls -la fixtures/

# 手动运行查看错误
podman run -it --rm openspec-agentic-qa bash
```

### 测试执行失败

**检查**：
- OpenSpec 是否正确安装 (`openspec --version`)
- 工作目录是否正确
- 网络是否可用（API 调用）

**调试**：
```bash
# 在容器内手动执行
opencode
# 然后逐步执行 TESTPLAN.md 的命令
```

### 权限问题

**症状**：无法写入文件、挂载失败

**解决**：
- 确保 `--user $(id -u):$(id -g)` 正确设置
- 检查宿主机文件权限
- 使用 `:Z` SELinux 标签

## 最佳实践

1. **先阅读再执行**：不要跳过阅读 TESTPLAN.md 的步骤
2. **记录详细日志**：保存所有命令输出
3. **截图关键状态**：如有 GUI 工具，截图验证点
4. **区分环境问题 vs 功能问题**：
   - 环境问题：配置、权限、网络
   - 功能问题：实际 Bug
5. **可重复执行**：确保测试可以多次运行
6. **干净环境**：每次测试前确保容器是新的

## 批量执行多个测试

如果要执行所有 agentic 测试：

```bash
cd test/agentic/

for test_dir in verify-*/; do
    echo "=== Running $test_dir ==="
    cd "$test_dir"
    ./run.sh 2>&1 | tee "test-result-$(date +%Y%m%d-%H%M%S).log"
    cd ..
done
```

## 与 CI/CD 集成

**GitHub Actions 示例**：

```yaml
name: Agentic Tests
on: [push, pull_request]

jobs:
  agentic-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Podman
        run: |
          sudo apt-get update
          sudo apt-get install -y podman
      
      - name: Run Agentic Tests
        env:
          OPENCODE_API_KEY: ${{ secrets.OPENCODE_API_KEY }}
        run: |
          cd test/agentic/verify-spec-field
          ./run.sh
```

## 示例

**输入**：
"执行 spec 字段验证测试"

**执行过程**：
1. 导航到 `test/agentic/verify-spec-field/`
2. 阅读 TESTPLAN.md
3. 运行 `./run.sh`
4. 在容器内执行所有 phases
5. 验证 string-utils 库被正确修改
6. 检查 spec 字段是否出现
7. 输出测试报告

**输出**：
```
## Test Results: First-Time User Experience

### Phase Summary
| Phase | Status | Notes |
|-------|--------|-------|
| 1. Project Setup | ✅ | string-utils created |
| 2. OpenSpec Init | ✅ | ralph-driven configured |
| ... | ... | ... |

### Key Findings
- Spec field observed: Yes
- Tasks created with spec: 2 of 3
- All phases completed: Yes

### Conclusion
PASS - Spec field integration works correctly
```