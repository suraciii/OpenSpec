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
      executeOpenCode: () => '',
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
    it('detects completion signal and exits successfully', async () => {
      const originalCwd = process.cwd;
      process.cwd = () => tempDir;

      await createRalphDrivenChange('exec-test', {
        prdData: createOpenPrdData(1),
      });

      mockExecutor.executeOpenCode = vi.fn().mockReturnValue('<promise>COMPLETE</promise>');

      await ralphCommand({ change: 'exec-test', maxIterations: 10 });

      process.cwd = originalCwd;
    });

    it('reaches max iterations when no completion signal', async () => {
      const originalCwd = process.cwd;
      process.cwd = () => tempDir;

      await createRalphDrivenChange('no-complete-test', {
        prdData: createOpenPrdData(1),
      });

      // Mock returns empty string (no completion signal)
      mockExecutor.executeOpenCode = vi.fn().mockReturnValue('');

      await ralphCommand({ change: 'no-complete-test', maxIterations: 1 });
      expect(process.exitCode).toBe(1);

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

      mockExecutor.executeOpenCode = vi.fn().mockReturnValue('');

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

      mockExecutor.executeOpenCode = vi.fn().mockReturnValue('');

      await ralphCommand({ change: 'init-test', maxIterations: 1 });

      const progressPath = path.join(changeDir, 'progress.txt');
      const content = await fs.readFile(progressPath, 'utf-8');
      expect(content).toContain('# Ralph Progress Log');

      process.cwd = originalCwd;
    });
  });
});

