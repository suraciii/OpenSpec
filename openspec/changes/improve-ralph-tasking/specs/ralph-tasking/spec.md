## ADDED Requirements

### Requirement: REQ-001 Task can reference spec requirement

The system SHALL allow prd.json tasks to reference a single spec requirement via a `spec` field.

#### Scenario: Task with spec reference

- **WHEN** a task has `spec` field set to `specs/export/spec.md#REQ-001`
- **THEN** the task output includes the `spec` field
- **AND** Ralph reads the spec file to find acceptance criteria

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

### Requirement: REQ-003 Tasks output includes spec field

The system SHALL include the `spec` field in tasks array output when generating Ralph instructions.

#### Scenario: Task with spec in output

- **WHEN** `openspec instructions ralph --change <name> --json` is called
- **AND** a task in prd.json has a `spec` field
- **THEN** the task in output includes the `spec` field
- **AND** Ralph can read the spec file to find the requirement

#### Scenario: Task without spec in output

- **WHEN** a task in prd.json has no `spec` field
- **THEN** the task in output does not include `spec` field
- **AND** task's `acceptanceCriteria` is used for verification
