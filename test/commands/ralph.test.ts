import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { setExecutor, ralphCommand, type Executor } from '../../src/commands/workflow/ralph.js';
import { createPrdData, createCompletedPrdData, createOpenPrdData } from '../factories/ralph.js';

describe('ralph command', () => {
  let tempDir: string;
  let changesDir: string;
  let mockExecutor: Executor;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-ralph-'));
    changesDir = path.join(tempDir, 'openspec', 'changes');
    await fs.mkdir(changesDir, { recursive: true });

    mockExecutor = {
      executeOpenCode: vi.fn(),
    };
    setExecutor(mockExecutor);
  });

  afterEach(async () => {
    setExecutor({
      executeOpenCode: async (_cmd: string, _args: string[]) => '',
    });
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  async function createRalphDrivenChange(
    changeName: string,
    options: { prdData?: ReturnType<typeof createPrdData> } = {}
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

    return changeDir;
  }

  describe('validation', () => {
    it('throws when --change is missing', async () => {
      const originalCwd = process.cwd;
      process.cwd = () => tempDir;

      await expect(ralphCommand({})).rejects.toThrow('No changes found');

      process.cwd = originalCwd;
    });

    it('throws for non-existent change', async () => {
      const originalCwd = process.cwd;
      process.cwd = () => tempDir;

      await expect(ralphCommand({ change: 'non-existent' })).rejects.toThrow('not found');

      process.cwd = originalCwd;
    });

    it('throws for non-ralph-driven schema', async () => {
      const originalCwd = process.cwd;
      process.cwd = () => tempDir;

      const changeDir = path.join(changesDir, 'spec-change');
      await fs.mkdir(changeDir, { recursive: true });
      await fs.writeFile(
        path.join(changeDir, '.openspec.yaml'),
        JSON.stringify({ schema: 'spec-driven', created: '2024-01-01' })
      );
      await fs.writeFile(path.join(changeDir, 'proposal.md'), '## Why\nTest');

      await expect(ralphCommand({ change: 'spec-change' })).rejects.toThrow('requires ralph-driven schema');

      process.cwd = originalCwd;
    });

    it('throws when prd.json is missing', async () => {
      const originalCwd = process.cwd;
      process.cwd = () => tempDir;

      await createRalphDrivenChange('no-prd');

      await expect(ralphCommand({ change: 'no-prd' })).rejects.toThrow('prd.json not found');

      process.cwd = originalCwd;
    });
  });

  describe('loop controller', () => {
    it('exits successfully when all tasks complete via pre-flight check', async () => {
      const originalCwd = process.cwd;
      process.cwd = () => tempDir;

      await createRalphDrivenChange('completed-test', {
        prdData: createCompletedPrdData(1),
      });

      // Mock returns empty string (no completion signal needed)
      mockExecutor.executeOpenCode = vi.fn().mockResolvedValue('');

      await ralphCommand({ change: 'completed-test', maxIterations: 10 });
      // Should exit successfully without needing any iterations
      expect(mockExecutor.executeOpenCode).not.toHaveBeenCalled();

      process.cwd = originalCwd;
    });

    it('reaches max iterations when tasks remain incomplete', async () => {
      const originalCwd = process.cwd;
      process.cwd = () => tempDir;

      await createRalphDrivenChange('incomplete-test', {
        prdData: createOpenPrdData(1),
      });

      // Mock returns empty string (task not completed)
      mockExecutor.executeOpenCode = vi.fn().mockResolvedValue('');

      await ralphCommand({ change: 'incomplete-test', maxIterations: 1 });
      expect(process.exitCode).toBe(1);

      process.cwd = originalCwd;
    });

    it('ignores completion signal in agent output (CLI-owned detection)', async () => {
      const originalCwd = process.cwd;
      process.cwd = () => tempDir;

      await createRalphDrivenChange('ignore-signal-test', {
        prdData: createOpenPrdData(1),
      });

      // Mock returns completion signal but task is not actually done
      mockExecutor.executeOpenCode = vi.fn().mockResolvedValue('<promise>COMPLETE</promise>');

      await ralphCommand({ change: 'ignore-signal-test', maxIterations: 1 });
      // Should reach max iterations because task is still incomplete
      expect(process.exitCode).toBe(1);
      // But should have executed once
      expect(mockExecutor.executeOpenCode).toHaveBeenCalledTimes(1);

      process.cwd = originalCwd;
    });

    it('completes full workflow: agent executes task → updates prd.json → CLI detects completion', async () => {
      const originalCwd = process.cwd;
      process.cwd = () => tempDir;

      const changeDir = await createRalphDrivenChange('e2e-test', {
        prdData: createOpenPrdData(1),
      });

      let callCount = 0;
      mockExecutor.executeOpenCode = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // First iteration: agent completes the task by updating prd.json
          const prdPath = path.join(changeDir, 'prd.json');
          const prdContent = await fs.readFile(prdPath, 'utf-8');
          const prd = JSON.parse(prdContent);
          prd.tasks[0].passes = true;
          await fs.writeFile(prdPath, JSON.stringify(prd, null, 2));
          return 'Task completed';
        }
        return '';
      });

      await ralphCommand({ change: 'e2e-test', maxIterations: 10 });

      // Should have executed twice:
      // 1. First iteration to complete the task
      // 2. Second iteration to detect completion (but should exit before spawning agent)
      expect(callCount).toBe(1);

      process.cwd = originalCwd;
    });
  });

  describe('progress archiving', () => {
    it('archives existing progress.txt on new run', async () => {
      const originalCwd = process.cwd;
      process.cwd = () => tempDir;

      const changeDir = await createRalphDrivenChange('archive-test', {
        prdData: createCompletedPrdData(1),
      });
      const progressPath = path.join(changeDir, 'progress.txt');
      await fs.writeFile(progressPath, '# Ralph Progress Log\n\nSome previous content here that is long enough to trigger archiving\n\n---\n');

      mockExecutor.executeOpenCode = vi.fn().mockResolvedValue('');

      await ralphCommand({ change: 'archive-test', maxIterations: 1 });

      const archiveDirs = await fs.readdir(path.join(changeDir, 'archive'));
      expect(archiveDirs.length).toBe(1);

      process.cwd = originalCwd;
    });

    it('initializes progress.txt if not exists', async () => {
      const originalCwd = process.cwd;
      process.cwd = () => tempDir;

      const changeDir = await createRalphDrivenChange('init-test', {
        prdData: createCompletedPrdData(1),
      });

      mockExecutor.executeOpenCode = vi.fn().mockResolvedValue('');

      await ralphCommand({ change: 'init-test', maxIterations: 1 });

      const progressPath = path.join(changeDir, 'progress.txt');
      const content = await fs.readFile(progressPath, 'utf-8');
      expect(content).toContain('# Ralph Progress Log');

      process.cwd = originalCwd;
    });
  });

  describe('RealExecutor integration', () => {
    it('can execute a simple command using RealExecutor', async () => {
      const { RealExecutor } = await import('../../src/commands/workflow/ralph.js');
      const realExecutor = new RealExecutor();
      
      // Test with a simple command that works on both Windows and Unix
      const isWindows = process.platform === 'win32';
      const cmd = isWindows ? 'cmd' : 'echo';
      const args = isWindows ? ['/c', 'echo', 'hello'] : ['hello'];
      
      const output = await realExecutor.executeOpenCode(cmd, args);
      
      // The output should contain 'hello' (output is streamed to console, 
      // but we also capture it for return)
      expect(output.toLowerCase()).toContain('hello');
    }, 10000);
  });
});

