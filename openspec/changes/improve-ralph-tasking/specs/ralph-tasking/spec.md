## ADDED Requirements

### Requirement: REQ-001 Task can reference spec requirement

The system SHALL allow prd.json tasks to reference a specific spec requirement via a `spec` field.

#### Scenario: Task with spec reference

- **WHEN** a task has `spec` field set to `specs/export/spec.md#REQ-001`
- **THEN** Ralph instructions include the content of that specific requirement
- **AND** scenarios from that requirement are treated as acceptance criteria

#### Scenario: Task without spec reference

- **WHEN** a task has no `spec` field
- **THEN** only `acceptanceCriteria` array is used for verification
- **AND** behavior is identical to current implementation

### Requirement: REQ-002 acceptanceCriteria serves as additional checks

The system SHALL treat `acceptanceCriteria` as supplementary verification items.

#### Scenario: Spec scenarios plus acceptanceCriteria

- **WHEN** a task has both `spec` and `acceptanceCriteria`
- **THEN** Ralph must verify all spec scenarios pass
- **AND** Ralph must verify all acceptanceCriteria pass
- **AND** task passes only when both are satisfied

#### Scenario: Only acceptanceCriteria

- **WHEN** a task has no `spec` but has `acceptanceCriteria`
- **THEN** acceptanceCriteria represents all verification items
- **AND** task passes when all criteria are satisfied

### Requirement: REQ-003 Ralph instructions include spec content inline

The system SHALL include referenced spec requirement content directly in Ralph instructions JSON.

#### Scenario: Spec content inlined in instructions

- **WHEN** `openspec instructions ralph --change <name> --json` is called
- **AND** current task has a `spec` reference
- **THEN** output includes `specContent` field with the requirement's markdown
- **AND** output includes `scenarios` array extracted from spec

#### Scenario: No spec reference

- **WHEN** current task has no `spec` reference
- **THEN** output does not include `specContent` field
- **AND** output uses `acceptanceCriteria` for verification instructions
