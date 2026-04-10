import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { runCLI } from '../helpers/run-cli.js';
import { createOpenPrdData, createCompletedPrdData } from '../factories/ralph.js';

describe('ralph instructions command', () => {
  let tempDir: string;
  let changesDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-ralph-instructions-'));
    changesDir = path.join(tempDir, 'openspec', 'changes');
    await fs.mkdir(changesDir, { recursive: true });
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  function getOutput(result: { stdout: string; stderr: string }): string {
    return result.stdout + result.stderr;
  }

  function extractJson(output: string): string {
    const lines = output.split('\n');
    const startIdx = lines.findIndex(line => line.trim().startsWith('{'));
    const endIdx = lines.findLastIndex(line => line.trim().startsWith('}') || line.trim() === '}');
    if (startIdx === -1 || endIdx === -1) {
      throw new Error('Could not find JSON boundaries in output');
    }
    return lines.slice(startIdx, endIdx + 1).join('\n');
  }

  async function createRalphDrivenChange(
    changeName: string,
    options: { prdData?: any; includeSpecs?: boolean } = {}
  ): Promise<string> {
    const changeDir = path.join(changesDir, changeName);
    await fs.mkdir(changeDir, { recursive: true });

    await fs.writeFile(
      path.join(changeDir, '.openspec.yaml'),
      JSON.stringify({ schema: 'ralph-driven', created: '2024-01-01' })
    );

    await fs.writeFile(
      path.join(changeDir, 'proposal.md'),
      '## Why\nTest proposal\n\n## What Changes\n- **test:** Something'
    );

    await fs.writeFile(
      path.join(changeDir, 'design.md'),
      '# Design\n\n## Overview\nTest design'
    );

    if (options.includeSpecs) {
      const specsDir = path.join(changeDir, 'specs', 'test-capability');
      await fs.mkdir(specsDir, { recursive: true });
      await fs.writeFile(
        path.join(specsDir, 'spec.md'),
        '# Test Capability Spec\n\n### Requirement: Test\nTest requirement'
      );
    }

    if (options.prdData) {
      await fs.writeFile(
        path.join(changeDir, 'prd.json'),
        JSON.stringify(options.prdData)
      );
    }

    return changeDir;
  }

  describe('generateRalphInstructions', () => {
    it('fails for non-existent change', async () => {
      const result = await runCLI(
        ['instructions', 'ralph', '--change', 'non-existent'],
        { cwd: tempDir }
      );
      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('not found');
    });

    it('fails for spec-driven schema', async () => {
      const changeDir = path.join(changesDir, 'spec-change');
      await fs.mkdir(changeDir, { recursive: true });
      await fs.writeFile(
        path.join(changeDir, '.openspec.yaml'),
        JSON.stringify({ schema: 'spec-driven', created: '2024-01-01' })
      );
      await fs.writeFile(path.join(changeDir, 'proposal.md'), '## Why\nTest');

      const result = await runCLI(
        ['instructions', 'ralph', '--change', 'spec-change'],
        { cwd: tempDir }
      );
      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('spec-driven');
    });

    it('fails when prd.json is missing', async () => {
      await createRalphDrivenChange('no-prd');
      const result = await runCLI(
        ['instructions', 'ralph', '--change', 'no-prd'],
        { cwd: tempDir }
      );
      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('prd.json not found');
    });

    it('outputs JSON with correct structure', async () => {
      await createRalphDrivenChange('test-json', {
        prdData: createOpenPrdData(2),
      });
      const result = await runCLI(
        ['instructions', 'ralph', '--change', 'test-json', '--json'],
        { cwd: tempDir }
      );
      expect(result.exitCode).toBe(0);
      const output = JSON.parse(extractJson(getOutput(result)));
      expect(output.changeName).toBe('test-json');
      expect(output.schemaName).toBe('ralph-driven');
      expect(output.contextFiles).toBeDefined();
      expect(output.tasks).toBeDefined();
      expect(output.progress).toBeDefined();
      expect(output.instruction).toBeDefined();
    });

    it('outputs text format correctly', async () => {
      await createRalphDrivenChange('test-text', {
        prdData: createOpenPrdData(2),
      });
      const result = await runCLI(
        ['instructions', 'ralph', '--change', 'test-text'],
        { cwd: tempDir }
      );
      expect(result.exitCode).toBe(0);
      expect(getOutput(result)).toContain('## Ralph: test-text');
      expect(getOutput(result)).toContain('Schema: ralph-driven');
      expect(getOutput(result)).toContain('Context Files');
      expect(getOutput(result)).toContain('Progress');
      expect(getOutput(result)).toContain('Tasks');
      expect(getOutput(result)).toContain('Instruction');
    });

    it('calculates progress correctly', async () => {
      await createRalphDrivenChange('test-progress', {
        prdData: createCompletedPrdData(2),
      });
      const result = await runCLI(
        ['instructions', 'ralph', '--change', 'test-progress', '--json'],
        { cwd: tempDir }
      );
      expect(result.exitCode).toBe(0);
      const output = JSON.parse(extractJson(getOutput(result)));
      expect(output.progress.total).toBe(2);
      expect(output.progress.completed).toBe(2);
      expect(output.progress.remaining).toBe(0);
    });

    it('includes specs files in contextFiles when specs directory exists (glob pattern support)', async () => {
      await createRalphDrivenChange('test-specs-context', {
        prdData: createOpenPrdData(1),
        includeSpecs: true,
      });
      const result = await runCLI(
        ['instructions', 'ralph', '--change', 'test-specs-context', '--json'],
        { cwd: tempDir }
      );
      expect(result.exitCode).toBe(0);
      const output = JSON.parse(extractJson(getOutput(result)));
      
      expect(output.contextFiles).toBeDefined();
      expect(output.contextFiles.proposal).toBeDefined();
      expect(output.contextFiles.design).toBeDefined();
      expect(output.contextFiles.prd).toBeDefined();
      
      expect(output.contextFiles.specs).toBeDefined();
      expect(output.contextFiles.specs).toMatch(/specs/);
    });

    it('includes spec field in task output when present in prd.json', async () => {
      const prdData = createOpenPrdData(2);
      prdData.tasks[0].spec = 'specs/test-capability/spec.md#REQ-001';
      prdData.tasks[1].spec = 'specs/test-capability/spec.md#REQ-002';
      
      await createRalphDrivenChange('test-spec-field', { prdData });
      const result = await runCLI(
        ['instructions', 'ralph', '--change', 'test-spec-field', '--json'],
        { cwd: tempDir }
      );
      expect(result.exitCode).toBe(0);
      const output = JSON.parse(extractJson(getOutput(result)));
      
      expect(output.tasks).toHaveLength(2);
      expect(output.tasks[0].spec).toBe('specs/test-capability/spec.md#REQ-001');
      expect(output.tasks[1].spec).toBe('specs/test-capability/spec.md#REQ-002');
    });

    it('maintains backward compatibility for tasks without spec field', async () => {
      const prdData = createOpenPrdData(2);
      delete prdData.tasks[0].spec;
      delete prdData.tasks[1].spec;
      
      await createRalphDrivenChange('test-no-spec-field', { prdData });
      const result = await runCLI(
        ['instructions', 'ralph', '--change', 'test-no-spec-field', '--json'],
        { cwd: tempDir }
      );
      expect(result.exitCode).toBe(0);
      const output = JSON.parse(extractJson(getOutput(result)));
      
      expect(output.tasks).toHaveLength(2);
      expect(output.tasks[0]).not.toHaveProperty('spec');
      expect(output.tasks[1]).not.toHaveProperty('spec');
      expect(output.progress.total).toBe(2);
      expect(output.progress.remaining).toBe(2);
    });
  });
});
