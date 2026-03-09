import ora from 'ora';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import { validateChangeExists } from './shared.js';
import { loadChangeContext } from '../../core/artifact-graph/index.js';

export interface RalphOptions {
  change?: string;
  maxIterations?: number;
}

export interface Executor {
  executeOpenCode(command: string): string;
}

class RealExecutor implements Executor {
  executeOpenCode(command: string): string {
    return execSync(command, {
      stdio: 'pipe',
      encoding: 'utf-8',
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
        const output = executor.executeOpenCode('opencode run --command opsx-ralph -- ' + changeName);
        
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
