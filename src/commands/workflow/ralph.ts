import ora from 'ora';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { spawn } from 'cross-spawn';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import { validateChangeExists } from './shared.js';
import { loadChangeContext } from '../../core/artifact-graph/index.js';
import {
  generateRalphInstructions,
  type RalphInstructions,
  type RalphTask,
} from './instructions.js';

export interface RalphOptions {
  change?: string;
  maxIterations?: number;
  model?: string;
}

export interface Executor {
  executeOpenCode(cmd: string, args: string[]): Promise<string>;
}

export class RealExecutor implements Executor {
  async executeOpenCode(cmd: string, args: string[]): Promise<string> {
    // Check if command exists before spawning
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore' });
    } catch {
      throw new Error(`${cmd} not found in PATH. Please install ${cmd} to use ralph command.`);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        stdio: ['inherit', 'pipe', 'inherit']
      });
      
      let fullOutput = '';
      let childPid: number | undefined;
      
      try {
        childPid = child.pid;
      } catch {
        // pid might not be available on some platforms
      }
      
      child.stdout?.on('data', (data: Buffer) => {
        process.stdout.write(data);
        fullOutput += data.toString();
      });
      
      child.on('error', (err) => {
        if (childPid) {
          try {
            process.kill(childPid);
          } catch {
            // Process might already be dead
          }
        }
        reject(new Error(`Failed to spawn process: ${err.message}`));
      });
      
      child.on('close', (code) => {
        if (code === 0) {
          resolve(fullOutput);
        } else {
          reject(new Error(`OpenCode process exited with code ${code}`));
        }
      });
    });
  }
}

let executor: Executor = new RealExecutor();

export function setExecutor(e: Executor): void {
  executor = e;
}

export function buildIterationPrompt(
  projectRoot: string,
  instructions: RalphInstructions
): string {
  const pendingTasks = instructions.tasks
    .filter((t) => !t.done)
    .sort((a, b) => a.priority - b.priority);

  if (pendingTasks.length === 0) {
    return 'All tasks are complete. No further action needed.';
  }

  const task = pendingTasks[0];
  const changeDir = path.join(
    projectRoot,
    'openspec',
    'changes',
    instructions.changeName
  );

  const contextFileLines: string[] = [];
  for (const [artifactId, filePath] of Object.entries(instructions.contextFiles)) {
    const absPath = path.resolve(projectRoot, filePath);
    if (artifactId === 'specs') {
      contextFileLines.push(`  - Spec files in: ${absPath}`);
    } else {
      contextFileLines.push(`  - ${artifactId}: ${absPath}`);
    }
  }

  const hasSpec = !!task.spec;
  const specSection = hasSpec
    ? formatSpecSection(task.spec!, changeDir)
    : '';

  const criteriaLines = task.acceptanceCriteria
    .map((c) => `  - ${c}`)
    .join('\n');

  const steps = [
    '1. Read all context files listed above',
  ];
  if (hasSpec) {
    steps.push('2. Read the spec file referenced above for detailed requirements');
    steps.push('3. Implement the task');
    steps.push('4. Run typecheck/tests to verify');
    steps.push(`5. Update ${path.resolve(changeDir, 'prd.json')}: set passes:true for ${task.id}`);
    steps.push(`6. Append to ${path.resolve(changeDir, 'progress.txt')} with:`);
    steps.push('   - Timestamp, task ID, what was done, any learnings, next steps');
    steps.push(`7. Run: git add -A && git commit -m "ralph(${instructions.changeName}): ${task.id} ${task.title}"`);
  } else {
    steps.push('2. Implement the task');
    steps.push('3. Run typecheck/tests to verify');
    steps.push(`4. Update ${path.resolve(changeDir, 'prd.json')}: set passes:true for ${task.id}`);
    steps.push(`5. Append to ${path.resolve(changeDir, 'progress.txt')} with:`);
    steps.push('   - Timestamp, task ID, what was done, any learnings, next steps');
    steps.push(`6. Run: git add -A && git commit -m "ralph(${instructions.changeName}): ${task.id} ${task.title}"`);
  }

  return `You are executing one Ralph iteration for change "${instructions.changeName}".

## Context Files
Read ALL of these files before starting:
${contextFileLines.join('\n')}

## Progress
${instructions.progress.completed}/${instructions.progress.total} tasks complete

## Task to Implement
- ID: ${task.id}
- Priority: ${task.priority}
- Title: ${task.title}
${hasSpec ? `  - Spec: ${task.spec}\n` : ''}
### Description
${task.description}

${specSection}
### Acceptance Criteria
${criteriaLines}

## Steps
${steps.join('\n')}

## Guidelines
- Focus on ONE task only
- Make minimal, focused changes
- Keep changes focused on the task description`;
}

function formatSpecSection(specRef: string, changeDir: string): string {
  const hashIndex = specRef.indexOf('#');
  const specFile = hashIndex >= 0 ? specRef.substring(0, hashIndex) : specRef;
  const reqId = hashIndex >= 0 ? specRef.substring(hashIndex + 1) : null;
  const absSpecPath = path.resolve(changeDir, specFile);

  let section = `\n### Spec Reference
  - File: ${absSpecPath}`;
  if (reqId) {
    section += `\n  - Focus on requirement: ${reqId}`;
  }
  return section;
}

export async function ralphCommand(options: RalphOptions): Promise<void> {
  const spinner = ora('Initializing Ralph execution...').start();

  try {
    const projectRoot = process.cwd();
    const changeName = await validateChangeExists(options.change, projectRoot);

    const context = loadChangeContext(projectRoot, changeName);

    if (context.schemaName !== 'ralph-driven') {
      spinner.stop();
      throw new Error(
        `Ralph command requires ralph-driven schema. Current schema: ${context.schemaName}`
      );
    }

    const changeDir = path.join(projectRoot, 'openspec', 'changes', changeName);
    const prdPath = path.join(changeDir, 'prd.json');

    if (!fsSync.existsSync(prdPath)) {
      spinner.stop();
      throw new Error(
        `prd.json not found. Generate it first via /opsx-propose`
      );
    }

    const progressPath = path.join(changeDir, 'progress.txt');
    if (fsSync.existsSync(progressPath)) {
      const progressContent = await fs.readFile(progressPath, 'utf-8');
      // Archive if there's actual content beyond the header
      const lines = progressContent.trim().split('\n');
      const hasContent = lines.length > 4; // header + started line + empty line + separator
      if (hasContent) {
        await archiveProgress(changeDir, progressContent);
      }
    }

    await fs.writeFile(
      progressPath,
      `# Ralph Progress Log\nStarted: ${new Date().toISOString()}\n\n---\n\n`
    );

    spinner.stop();

    const maxIterations = options.maxIterations || 10;

    console.log(`Starting Ralph execution for change: ${changeName}`);
    console.log(`Max iterations: ${maxIterations}`);
    console.log();

    for (let i = 1; i <= maxIterations; i++) {
      console.log(chalk.cyan(`\n## Iteration ${i}/${maxIterations}`));

      const instructions = await generateRalphInstructions(projectRoot, changeName);

      if (instructions.progress.remaining === 0) {
        console.log(chalk.green('\n✓ All tasks already complete!'));
        return;
      }

      const prompt = buildIterationPrompt(projectRoot, instructions);

      try {
        const args = ['run'];
        if (options.model) {
          args.push('--model', options.model);
        }
        args.push(prompt);

        const output = await executor.executeOpenCode('opencode', args);

        // Check for optional NO_PROGRESS signal
        if (output.includes('<promise>NO_PROGRESS</promise>')) {
          console.log(chalk.yellow('\n⚠️  Agent reported no progress this iteration'));
        }

        console.log(chalk.yellow('\n→ Iteration completed, continuing...'));
      } catch (error: any) {
        const errorMsg = error.message || '';
        console.error(chalk.red(`\n✗ Iteration ${i} failed: ${errorMsg}`));
      }

      if (i < maxIterations) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log(chalk.yellow(`\n\n## Max iterations reached (${maxIterations})`));
    console.log('Some tasks may remain incomplete.');
    process.exitCode = 1;
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

async function archiveProgress(changeDir: string, content: string): Promise<void> {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .substring(0, 19);
  const archiveDir = path.join(changeDir, 'archive', timestamp);

  await fs.mkdir(archiveDir, { recursive: true });
  await fs.writeFile(path.join(archiveDir, 'progress.txt'), content);
}
