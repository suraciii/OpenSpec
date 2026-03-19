# Agentic Testing

AI Agents execute test plans as intelligent actors rather than following rigid scripts.

## Philosophy

**Traditional E2E:**
- Hard-coded assertions
- Brittle selectors
- Deterministic paths

**Agentic Tests:**
- Natural language instructions
- Flexible verification (LLM understands intent)
- Adaptive execution (handles unexpected states)

## Structure

```
test/agentic/
├── README.md                    # This file
├── AGENTS.md                    # Context for OpenCode
├── shared/
│   ├── Containerfile            # Universal container
│   └── fixtures/
│       └── opencode-config.json # Test-specific config
└── verify-<feature>/
    └── TESTPLAN.md              # Test content (agent instructions)
```

## Running Tests

```bash
# Option 1: Using skill (recommended)
opencode run --skill execute-agentic-test -- verify-<feature>

# Option 2: Manual
# API key is read from ~/.local/share/opencode/auth.json
podman build -t openspec-agentic-test \
  --build-arg USER_ID=$(id -u) \
  --build-arg GROUP_ID=$(id -g) \
  -f test/agentic/shared/Containerfile \
  .

podman run --rm -it \
  --user $(id -u):$(id -g) \
  -e OPENCODE_API_KEY="$(jq -r '.["zhipuai-coding-plan"].key' ~/.local/share/opencode/auth.json)" \
  -e OPENCODE_MODEL="zhipuai-coding-plan" \
  -v "$(pwd)/test/agentic/verify-<feature>/TESTPLAN.md:/app/TESTPLAN.md:ro,Z" \
  -v "$(pwd)/test/agentic/shared/fixtures/opencode-config.json:/home/opentest/.config/opencode/opencode.json:ro,Z" \
  -v "$(pwd):/opt/openspec:ro,Z" \
  -w /app \
  openspec-agentic-test \
  opencode run --file /app/TESTPLAN.md
```

## Creating a New Test

1. Create directory: `mkdir -p test/agentic/verify-<feature>`
2. Write `TESTPLAN.md` with:
   - Test scenario description
   - Phases with steps and verification points
   - Success criteria
   - Report template

### Test Plan Template

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
# Commands for agent
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

Output structured report after all phases.
```

## Best Practices

1. **Clear Intent**: Explain WHAT to verify, not HOW
2. **Phased Approach**: Break complex tests into phases
3. **Observable State**: Provide commands to check state
4. **Flexible Assertions**: Let Agent judge success

## Shared Resources

**Containerfile** provides:
- Node.js 20
- OpenCode CLI
- OpenSpec from source
- Workspace at `/app/workspace`
- Generates auth.json from `OPENCODE_API_KEY` and `OPENCODE_MODEL` env vars at runtime

**Fixtures** (`shared/fixtures/`):
- `opencode-config.json` - Minimal test-specific config (no MCP, no skills)
