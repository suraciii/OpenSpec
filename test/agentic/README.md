# Agentic Testing

Agentic Testing is a paradigm where AI Agents (like OpenCode, Claude, etc.) execute test plans as intelligent actors rather than following rigid scripts.

## Philosophy

Traditional E2E tests:
- Hard-coded assertions: `assertEquals(actual, expected)`
- Brittle selectors: `await page.click('#btn-submit')`
- Deterministic execution paths

Agentic Tests:
- Natural language instructions: "Verify that the power function handles edge cases"
- Flexible verification: LLM understands intent, tolerates format variations
- Adaptive execution: Agent can handle unexpected states intelligently

## Structure

```
test/agentic/
├── README.md                    # This file
├── verify-spec-field/          # Test scenario: spec field integration
│   ├── TESTPLAN.md             # Natural language test plan for Agent
│   ├── Containerfile           # Isolated test environment
│   ├── run.sh                  # Launch script
│   └── fixtures/               # Test configuration
├── verify-<feature>/           # Future test scenarios
└── ...
```

## How It Works

1. **Test Plan**: Written in natural language (markdown) with clear goals and verification criteria
2. **Container**: Provides isolated environment with OpenSpec + Agent tools
3. **Agent Execution**: LLM reads test plan, executes steps, makes judgments
4. **Reporting**: Agent outputs structured results with reasoning

## Running Tests

```bash
# Set API key
export OPENCODE_API_KEY="sk-..."

# Run specific test
cd test/agentic/verify-spec-field
./run.sh

# Or run manually
podman run -it openspec-agentic-test opencode
# Then read TESTPLAN.md and execute
```

## When to Use

Use Agentic Testing when:
- Testing complex workflows with multiple decision points
- Verification requires semantic understanding (not exact string matching)
- System behavior is non-deterministic (AI-powered features)
- Test maintenance cost of traditional E2E is too high

## Best Practices

1. **Clear Intent**: Test plans should explain WHAT to verify, not HOW
2. **Phased Approach**: Break complex tests into logical phases
3. **Observable State**: Provide commands to check system state
4. **Flexible Assertions**: Let Agent judge success based on intent, not exact values
5. **Idempotent**: Tests should clean up or use fresh containers

## Example

See `verify-spec-field/TESTPLAN.md` for a complete example testing the Ralph spec field integration.

## Future Directions

- Self-healing tests: Agent suggests test plan updates when code changes
- Test generation: Agent creates test plans from code changes
- Multi-agent testing: Multiple Agents test concurrently and compare results