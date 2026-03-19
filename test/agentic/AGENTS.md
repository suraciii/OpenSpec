# Agentic Testing Context

## 目录结构

```
test/agentic/
├── README.md
├── AGENTS.md
├── shared/
│   ├── Containerfile
│   └── fixtures/
│       └── opencode-config.json    # 测试专用配置
└── verify-<feature>/
    └── TESTPLAN.md
```

## 运行测试

```bash
# 可选：指定模型（默认 zhipuai-coding-plan）
export OPENCODE_MODEL="zhipuai-coding-plan"

podman build -t openspec-agentic-test \
  --build-arg USER_ID=$(id -u) \
  --build-arg GROUP_ID=$(id -g) \
  -f test/agentic/shared/Containerfile \
  .

# API key 从 ~/.local/share/opencode/auth.json 自动读取
# opencode-config.json 使用测试专用配置
podman run --rm \
  --user $(id -u):$(id -g) \
  -e OPENCODE_API_KEY="$(jq -r --arg m "${OPENCODE_MODEL:-zhipuai-coding-plan}" '.[$m].key' ~/.local/share/opencode/auth.json)" \
  -e OPENCODE_MODEL="${OPENCODE_MODEL:-zhipuai-coding-plan}" \
  -v "$(pwd)/test/agentic/verify-<feature>/TESTPLAN.md:/app/TESTPLAN.md:ro,Z" \
  -v "$(pwd)/test/agentic/shared/fixtures/opencode-config.json:/home/opentest/.config/opencode/opencode.json:ro,Z" \
  -v "$(pwd):/opt/openspec:ro,Z" \
  -w /app \
  openspec-agentic-test \
  opencode run --file /app/TESTPLAN.md
```

## 容器环境

- 用户: `opentest`
- 工作目录: `/app`
- 测试项目: `/app/workspace/`
- OpenSpec 源码: `/opt/openspec` (只读)
- opencode.json: 挂载测试专用配置
- auth.json: 从 `OPENCODE_API_KEY` 和 `OPENCODE_MODEL` 环境变量生成
