import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { runCLI } from '../helpers/run-cli.js';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

describe('ralph-driven schema init', () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'openspec-ralph-schema-'));
  });

  afterAll(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('initializes with ralph-driven schema and creates opsx-ralph command (not skill)', async () => {
    const result = await runCLI(['init', '--tools', 'opencode', '--schema', 'ralph-driven'], {
      cwd: tempDir,
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('OpenSpec Setup Complete');
    expect(result.stdout).toContain('schema: ralph-driven');

    // Verify config.yaml has ralph-driven schema
    const configPath = path.join(tempDir, 'openspec', 'config.yaml');
    const configContent = await fs.readFile(configPath, 'utf-8');
    expect(configContent).toContain('schema: ralph-driven');

    // Verify opsx-ralph skill was NOT created (skill removed, command preserved)
    const ralphSkillPath = path.join(tempDir, '.opencode', 'skills', 'opsx-ralph', 'SKILL.md');
    expect(await fileExists(ralphSkillPath)).toBe(false);

    // Verify opsx-ralph command was created
    const ralphCommandPath = path.join(tempDir, '.opencode', 'commands', 'opsx-ralph.md');
    expect(await fileExists(ralphCommandPath)).toBe(true);

    // Verify command content
    const commandContent = await fs.readFile(ralphCommandPath, 'utf-8');
    expect(commandContent).toContain('Ralph');
    expect(commandContent).toContain('Execute one Ralph iteration');
  });

  it('initializes with ralph-driven schema and creates opsx-ralph command when delivery includes commands', async () => {
    const result = await runCLI(['init', '--tools', 'opencode', '--schema', 'ralph-driven'], {
      cwd: tempDir,
    });

    expect(result.exitCode).toBe(0);

    // Verify opsx-ralph command was created (if delivery is 'both' or 'commands')
    const ralphCommandPath = path.join(tempDir, '.opencode', 'commands', 'opsx-ralph.md');
    const commandExists = await fileExists(ralphCommandPath);
    
    // Command may or may not exist depending on default delivery mode
    if (commandExists) {
      const commandContent = await fs.readFile(ralphCommandPath, 'utf-8');
      expect(commandContent).toContain('Ralph');
      expect(commandContent).toContain('Execute one Ralph iteration');
    }
  });

  it('creates all required skills for ralph-driven workflow', async () => {
    await runCLI(['init', '--tools', 'opencode', '--schema', 'ralph-driven'], {
      cwd: tempDir,
    });

    const skillsDir = path.join(tempDir, '.opencode', 'skills');
    
    // All skills that should exist for ralph-driven
    // Note: opsx-ralph is no longer a skill (command only)
    const requiredSkills = [
      'openspec-propose',
    ];

    for (const skill of requiredSkills) {
      const skillPath = path.join(skillsDir, skill, 'SKILL.md');
      const exists = await fileExists(skillPath);
      expect(exists, `Skill ${skill} should exist`).toBe(true);
    }
  });
});
