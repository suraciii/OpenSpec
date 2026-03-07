import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { runCLI } from '../helpers/run-cli.js';
import {
  createPrdData,
  createCompletedPrdData,
  createOpenPrdData,
  createMixedPrdData,
} from '../factories/ralph.js';

describe('ralph command', () => {
  let tempDir: string;
  let changesDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-ralph-'));
    changesDir = path.join(tempDir, 'openspec', 'changes');
    await fs.mkdir(changesDir, { recursive: true });

    process.env.RALPH_TEST_MODE = 'true';
  });

  afterEach(async () => {
    delete process.env.RALPH_TEST_MODE;
    
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  function getOutput(result: { stdout: string; stderr: string }): string {
    return result.stdout + result.stderr;
  }

  async function createRalphDrivenChange(
    changeName: string,
    options: {
      prdData?: ReturnType<typeof createPrdData>;
      withTasks?: boolean;
    } = {}
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

    if (options.prdData) {
      await fs.writeFile(
        path.join(changeDir, 'prd.json'),
        JSON.stringify(options.prdData)
      );
    }

    if (options.withTasks) {
      await fs.writeFile(
        path.join(changeDir, 'tasks.md'),
        '## Tasks\n- [ ] Task 1\n- [ ] Task 2'
      );
    }

    return changeDir;
  }

  describe('validation', () => {
    it('requires --change option', async () => {
      const result = await runCLI(['ralph'], { cwd: tempDir });
      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('change');
    });

    it('fails for non-existent change', async () => {
      const result = await runCLI(['ralph', '--change', 'non-existent'], { cwd: tempDir });
      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('not found');
    });

    it('fails for spec-driven schema (not ralph-driven)', async () => {
      const changeDir = path.join(changesDir, 'spec-change');
      await fs.mkdir(changeDir, { recursive: true });
      await fs.writeFile(
        path.join(changeDir, '.openspec.yaml'),
        JSON.stringify({ schema: 'spec-driven', created: '2024-01-01' })
      );
      await fs.writeFile(path.join(changeDir, 'proposal.md'), '## Why\nTest');

      const result = await runCLI(['ralph', '--change', 'spec-change'], { cwd: tempDir });
      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('requires ralph-driven schema');
    });

    it('fails when prd.json is missing', async () => {
      await createRalphDrivenChange('no-prd');

      const result = await runCLI(['ralph', '--change', 'no-prd'], { cwd: tempDir });
      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('prd.json not found');
    });

    it('fails when prd.json has no tasks', async () => {
      await createRalphDrivenChange('empty-prd', {
        prdData: createPrdData({ tasks: [] }),
      });

      const result = await runCLI(['ralph', '--change', 'empty-prd'], { cwd: tempDir });
      expect(result.exitCode).toBe(1);
      expect(getOutput(result)).toContain('contains no tasks');
    });
  });

  describe('completion detection', () => {
    it('recognizes all tasks complete', async () => {
      await createRalphDrivenChange('complete-test', {
        prdData: createCompletedPrdData(2),
      });

      const result = await runCLI(['ralph', '--change', 'complete-test', '--json'], { cwd: tempDir });
      expect(result.exitCode).toBe(0);
      
      const output = getOutput(result);
      expect(output).toContain('All tasks already complete');
    });

    it('recognizes mixed completion status', async () => {
      await createRalphDrivenChange('mixed-test', {
        prdData: createMixedPrdData(1, 1),
      });

      const result = await runCLI(['ralph', '--change', 'mixed-test', '--max-iterations', '1'], { cwd: tempDir });
      expect(result.exitCode).toBe(0);
    });
  });

  describe('AI tool execution', () => {
    it('executes AI tool for incomplete tasks', async () => {
      await createRalphDrivenChange('exec-test', {
        prdData: createOpenPrdData(1),
      });

      const result = await runCLI(['ralph', '--change', 'exec-test', '--max-iterations', '1'], { cwd: tempDir });
      
      expect(result.exitCode).toBe(0);
    });

    it('handles task completion', async () => {
      await createRalphDrivenChange('complete-task-test', {
        prdData: createOpenPrdData(1),
      });

      const result = await runCLI(['ralph', '--change', 'complete-task-test', '--max-iterations', '1'], { cwd: tempDir });
      
      expect(result.exitCode).toBe(0);
    });
  });

  describe('options', () => {
    it('accepts --max-iterations option', async () => {
      await createRalphDrivenChange('max-iter-test', {
        prdData: createCompletedPrdData(1),
      });

      const result = await runCLI(
        ['ralph', '--change', 'max-iter-test', '--max-iterations', '5'],
        { cwd: tempDir }
      );
      
      expect(getOutput(result)).not.toContain('unknown option');
      expect(result.exitCode).toBe(0);
    });

    it('accepts --tool option', async () => {
      await createRalphDrivenChange('tool-test', {
        prdData: createCompletedPrdData(1),
      });

      const result = await runCLI(
        ['ralph', '--change', 'tool-test', '--tool', 'opencode'],
        { cwd: tempDir }
      );
      
      expect(getOutput(result)).not.toContain('unknown option');
      expect(result.exitCode).toBe(0);
    });

    it('accepts --json option', async () => {
      await createRalphDrivenChange('json-test', {
        prdData: createCompletedPrdData(1),
      });

      const result = await runCLI(
        ['ralph', '--change', 'json-test', '--json'],
        { cwd: tempDir }
      );
      
      expect(getOutput(result)).not.toContain('unknown option');
      expect(result.exitCode).toBe(0);
    });
  });
});