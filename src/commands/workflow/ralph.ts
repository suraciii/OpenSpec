import ora from 'ora';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { spawn } from 'cross-spawn';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import { validateChangeExists } from './shared.js';
import { loadChangeContext } from '../../core/artifact-graph/index.js';

export interface RalphOptions {
  change?: string;
  maxIterations?: number;
  model?: string;
}

export interface Executor {
  executeOpenCode(command: string): Promise<string>;
}

export class RealExecutor implements Executor {
  async executeOpenCode(command: string): Promise<string> {
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    
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

    try {
      execSync('opencode --version', { stdio: 'ignore' });
    } catch {
      spinner.stop();
      throw new Error('OpenCode not found in PATH. Please install OpenCode to use ralph command.');
    }

    spinner.stop();

    const maxIterations = options.maxIterations || 10;

    console.log(`Starting Ralph execution for change: ${changeName}`);
    console.log(`Max iterations: ${maxIterations}`);
    console.log();

    for (let i = 1; i <= maxIterations; i++) {
      console.log(chalk.cyan(`\n## Iteration ${i}/${maxIterations}`));

      try {
        const modelArg = options.model ? `--model ${options.model}` : '';

        const output = await executor.executeOpenCode(
          `opencode run ${modelArg} --command opsx-ralph -- ${changeName}`
        );
        
        if (output.includes('<promise>COMPLETE</promise>')) {
          console.log(chalk.green('\n✓ All tasks complete!'));
          return;
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
