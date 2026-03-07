import ora from 'ora';
import chalk from 'chalk';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import {
  validateChangeExists,
  getAvailableChanges,
} from './shared.js';
import { getTaskItemsForChange, type TaskItem } from '../../utils/task-progress.js';
import { loadChangeContext } from '../../core/artifact-graph/index.js';

export interface RalphOptions {
  change?: string;
  maxIterations?: number;
  tool?: string;
  json?: boolean;
}

interface PrdTask {
  id: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string[];
  priority?: number;
  passes: boolean;
  notes?: string;
}

interface PrdJson {
  project: string;
  description: string;
  tasks: PrdTask[];
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

    const prdContent = await fs.readFile(prdPath, 'utf-8');
    let prd: PrdJson;
    try {
      prd = JSON.parse(prdContent);
    } catch (error) {
      spinner.stop();
      throw new Error(`Invalid prd.json format: ${(error as Error).message}`);
    }

    if (!prd.tasks || !Array.isArray(prd.tasks) || prd.tasks.length === 0) {
      spinner.stop();
      throw new Error('prd.json contains no tasks');
    }

    const tool = options.tool || 'opencode';
    if (tool === 'opencode') {
      try {
        await checkOpenCodeAvailable();
      } catch (error) {
        spinner.stop();
        throw new Error(
          'OpenCode not found in PATH. Please install OpenCode to use ralph command.'
        );
      }
    }

    const progressPath = path.join(changeDir, 'progress.txt');
    if (fsSync.existsSync(progressPath)) {
      const progressContent = await fs.readFile(progressPath, 'utf-8');
      if (progressContent.trim().length > 0) {
        await archiveProgress(changeDir, progressContent);
      }
    }

    // Initialize progress.txt
    const timestamp = new Date().toISOString();
    await fs.writeFile(
      progressPath,
      `# Ralph Execution Log\n\nStarted: ${timestamp}\nChange: ${changeName}\n\n---\n\n`
    );

    spinner.stop();

    // Get pending tasks
    const pendingTasks = prd.tasks
      .filter((task) => !task.passes)
      .sort((a, b) => (a.priority || 999) - (b.priority || 999));

    if (pendingTasks.length === 0) {
      console.log(chalk.green('All tasks already complete!'));
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              changeName,
              status: 'complete',
              totalTasks: prd.tasks.length,
              completedTasks: prd.tasks.length,
            },
            null,
            2
          )
        );
      }
      return;
    }

    const maxIterations = options.maxIterations || 10;
    const iterations = Math.min(pendingTasks.length, maxIterations);

    console.log(`Starting Ralph execution for change: ${changeName}`);
    console.log(`Pending tasks: ${pendingTasks.length}`);
    console.log(`Max iterations: ${iterations}`);
    console.log();

    // Execute iteration loop
    for (let i = 0; i < iterations; i++) {
      const task = pendingTasks[i];
      console.log(
        chalk.cyan(`\n## Iteration ${i + 1}/${iterations}`)
      );
      console.log(`Task: ${task.id} - ${task.title}`);
      console.log(`Priority: ${task.priority || 'N/A'}`);
      console.log();

      try {
        // Spawn AI tool
        const result = await spawnAITool(tool, {
          changeName,
          changeDir,
          task,
          contextFiles: context.graph.getAllArtifacts().map((a) => ({
            id: a.id,
            path: path.join(changeDir, a.generates),
          })),
        });

        // Check for completion signal
        if (result.includes('<promise>COMPLETE</promise>')) {
          console.log(chalk.green('\n✓ Task completed successfully'));
          await appendToProgressLog(progressPath, {
            iteration: i + 1,
            task,
            status: 'completed',
            output: result,
          });

          if (options.json) {
            console.log(
              JSON.stringify(
                {
                  changeName,
                  status: 'complete',
                  iterationsExecuted: i + 1,
                  completedTask: task.id,
                },
                null,
                2
              )
            );
          }
          return;
        }

        // Append to progress log
        await appendToProgressLog(progressPath, {
          iteration: i + 1,
          task,
          status: 'in-progress',
          output: result,
        });

        console.log(chalk.yellow('\n→ Task iteration completed'));
      } catch (error) {
        const errorMsg = (error as Error).message;
        console.error(chalk.red(`\n✗ Iteration failed: ${errorMsg}`));

        await appendToProgressLog(progressPath, {
          iteration: i + 1,
          task,
          status: 'error',
          error: errorMsg,
        });

        // Continue to next iteration on recoverable errors
        continue;
      }

      // Wait between iterations to avoid overwhelming AI services
      if (i < iterations - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Check final progress
    const updatedTasks = await getTaskItemsForChange(
      path.join(projectRoot, 'openspec', 'changes'),
      changeName,
      'prd.json'
    );
    const completedCount = updatedTasks.filter((t) => t.done).length;

    console.log(chalk.yellow(`\n\n## Execution Summary`));
    console.log(`Iterations completed: ${iterations}`);
    console.log(`Tasks completed: ${completedCount}/${prd.tasks.length}`);

    if (completedCount < prd.tasks.length) {
      console.log(chalk.yellow('\nSome tasks remain incomplete.'));
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              changeName,
              status: 'incomplete',
              iterationsExecuted: iterations,
              totalTasks: prd.tasks.length,
              completedTasks: completedCount,
            },
            null,
            2
          )
        );
      }
      process.exitCode = 1;
    } else {
      console.log(chalk.green('\nAll tasks completed!'));
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              changeName,
              status: 'complete',
              iterationsExecuted: iterations,
              totalTasks: prd.tasks.length,
              completedTasks: completedCount,
            },
            null,
            2
          )
        );
      }
    }
  } catch (error) {
    spinner.stop();
    throw error;
  }
}

async function checkOpenCodeAvailable(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('opencode', ['--version'], {
      shell: true,
      stdio: 'ignore',
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error('OpenCode not found'));
      }
    });

    proc.on('error', () => {
      reject(new Error('OpenCode not found'));
    });
  });
}

async function archiveProgress(
  changeDir: string,
  content: string
): Promise<void> {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '-')
    .substring(0, 19);
  const archiveDir = path.join(changeDir, 'archive', timestamp);

  await fs.mkdir(archiveDir, { recursive: true });
  await fs.writeFile(path.join(archiveDir, 'progress.txt'), content);
}

async function appendToProgressLog(
  progressPath: string,
  entry: {
    iteration: number;
    task: PrdTask;
    status: string;
    output?: string;
    error?: string;
  }
): Promise<void> {
  const timestamp = new Date().toISOString();
  const lines: string[] = [
    `\n## [${timestamp}] - Iteration ${entry.iteration}`,
    '',
    `Task: ${entry.task.id} - ${entry.task.title}`,
    `Status: ${entry.status}`,
    '',
  ];

  if (entry.task.description) {
    lines.push('### Description');
    lines.push(entry.task.description);
    lines.push('');
  }

  if (entry.task.acceptanceCriteria && entry.task.acceptanceCriteria.length > 0) {
    lines.push('### Acceptance Criteria');
    entry.task.acceptanceCriteria.forEach((criterion) => {
      lines.push(`- ${criterion}`);
    });
    lines.push('');
  }

  if (entry.output) {
    lines.push('### Output');
    lines.push(entry.output.substring(0, 1000)); // Limit output size
    lines.push('');
  }

  if (entry.error) {
    lines.push('### Error');
    lines.push(entry.error);
    lines.push('');
  }

  lines.push('---');

  await fs.appendFile(progressPath, lines.join('\n'));
}

async function spawnAITool(
  tool: string,
  options: {
    changeName: string;
    changeDir: string;
    task: PrdTask;
    contextFiles: Array<{ id: string; path: string }>;
  }
): Promise<string> {
  // Test mode: return mock response without actually spawning
  if (process.env.RALPH_TEST_MODE === 'true') {
    return '<promise>COMPLETE</promise>';
  }

  return new Promise((resolve, reject) => {
    const builtInPrompt = generateRalphPrompt(options);

    let command: string;
    let args: string[];

    if (tool === 'opencode') {
      command = 'opencode';
      args = ['run', '--command', 'opsx-ralph', '--', options.changeName];
    } else {
      reject(new Error(`Unsupported AI tool: ${tool}`));
      return;
    }

    const proc = spawn(command, args, {
      shell: true,
      cwd: options.changeDir,
      env: {
        ...process.env,
        RALPH_TASK_ID: options.task.id,
        RALPH_TASK_TITLE: options.task.title,
        RALPH_PROMPT: builtInPrompt,
      },
    });

    let output = '';
    let error = '';

    proc.stdout.on('data', (data) => {
      const str = data.toString();
      output += str;
      process.stdout.write(str);
    });

    proc.stderr.on('data', (data) => {
      const str = data.toString();
      error += str;
      process.stderr.write(str);
    });

    proc.on('close', (code) => {
      if (code === 0 || output.length > 0) {
        resolve(output + error);
      } else {
        reject(new Error(`AI tool exited with code ${code}: ${error}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

function generateRalphPrompt(options: {
  changeName: string;
  changeDir: string;
  task: PrdTask;
  contextFiles: Array<{ id: string; path: string }>;
}): string {
  return `
# Ralph Autonomous Task Execution

You are executing task ${options.task.id} for change "${options.changeName}".

## Task Details

**ID:** ${options.task.id}
**Title:** ${options.task.title}
**Priority:** ${options.task.priority || 'N/A'}

${options.task.description ? `**Description:**\n${options.task.description}\n` : ''}

${
  options.task.acceptanceCriteria && options.task.acceptanceCriteria.length > 0
    ? `**Acceptance Criteria:**\n${options.task.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}\n`
    : ''
}

## Context Files

${options.contextFiles.map((f) => `- ${f.id}: ${f.path}`).join('\n')}

## Your Task

1. Read the context files to understand the change
2. Implement the required changes for this task
3. Update prd.json and mark this task as complete (set passes: true)
4. Append progress to progress.txt
5. Output \`<promise>COMPLETE</promise>\` when done

## Important

- Focus only on this task
- Follow the acceptance criteria
- Keep changes minimal and focused
- Update documentation as needed
`;
}
