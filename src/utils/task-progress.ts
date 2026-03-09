import { promises as fs } from 'fs';
import path from 'path';

const TASK_PATTERN = /^[-*]\s+\[[\sx]\]/i;
const COMPLETED_TASK_PATTERN = /^[-*]\s+\[x\]/i;

export interface TaskProgress {
  total: number;
  completed: number;
}

export interface TaskItem {
  id: string;
  description: string;
  done: boolean;
  priority?: number;
  acceptanceCriteria?: string[];
}

export interface TaskParser {
  parse(content: string): TaskProgress;
  parseTasks?(content: string): TaskItem[];
  supports(filePath: string): boolean;
}

export class MarkdownTaskParser implements TaskParser {
  parse(content: string): TaskProgress {
    const lines = content.split('\n');
    let total = 0;
    let completed = 0;
    for (const line of lines) {
      if (line.match(TASK_PATTERN)) {
        total++;
        if (line.match(COMPLETED_TASK_PATTERN)) {
          completed++;
        }
      }
    }
    return { total, completed };
  }

  parseTasks(content: string): TaskItem[] {
    const lines = content.split('\n');
    const tasks: TaskItem[] = [];
    let taskCounter = 0;

    for (const line of lines) {
      if (line.match(TASK_PATTERN)) {
        taskCounter++;
        const isCompleted = line.match(COMPLETED_TASK_PATTERN) !== null;
        const description = line.replace(TASK_PATTERN, '').trim();

        tasks.push({
          id: `T-${String(taskCounter).padStart(3, '0')}`,
          description,
          done: isCompleted
        });
      }
    }

    return tasks;
  }

  supports(filePath: string): boolean {
    return filePath.endsWith('.md');
  }
}

interface PrdTask {
  id?: string;
  title?: string;
  description?: string;
  passes?: boolean;
  priority?: number;
  acceptanceCriteria?: string[];
}

export class PrdJsonTaskParser implements TaskParser {
  parse(content: string): TaskProgress {
    try {
      const prd = JSON.parse(content);
      if (!prd.tasks || !Array.isArray(prd.tasks)) {
        return { total: 0, completed: 0 };
      }

      const total = prd.tasks.length;
      const completed = prd.tasks.filter((task: PrdTask) => task.passes === true).length;
      return { total, completed };
    } catch {
      return { total: 0, completed: 0 };
    }
  }

  parseTasks(content: string): TaskItem[] {
    try {
      const prd = JSON.parse(content);
      if (!prd.tasks || !Array.isArray(prd.tasks)) {
        return [];
      }

      return prd.tasks.map((task: PrdTask) => ({
        id: task.id || 'T-000',
        description: task.title || task.description || '',
        done: task.passes === true,
        priority: task.priority,
        acceptanceCriteria: task.acceptanceCriteria
      }));
    } catch {
      return [];
    }
  }

  supports(filePath: string): boolean {
    return filePath.endsWith('.json');
  }
}

const PARSERS: TaskParser[] = [
  new PrdJsonTaskParser(),
  new MarkdownTaskParser(),
];

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getTaskProgressForChange(
  changesDir: string,
  changeName: string,
  tracksFile?: string
): Promise<TaskProgress> {
  if (tracksFile) {
    const filePath = path.join(changesDir, changeName, tracksFile);
    if (await fileExists(filePath)) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parser = PARSERS.find(p => p.supports(filePath));
        if (parser) {
          return parser.parse(content);
        }
      } catch {
        return { total: 0, completed: 0 };
      }
    }
  }

  for (const parser of PARSERS) {
    const fileName = parser instanceof PrdJsonTaskParser ? 'prd.json' : 'tasks.md';
    const filePath = path.join(changesDir, changeName, fileName);
    if (await fileExists(filePath)) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        return parser.parse(content);
      } catch {
        continue;
      }
    }
  }

  return { total: 0, completed: 0 };
}

export async function getTaskItemsForChange(
  changesDir: string,
  changeName: string,
  tracksFile?: string
): Promise<TaskItem[]> {
  if (tracksFile) {
    const filePath = path.join(changesDir, changeName, tracksFile);
    if (await fileExists(filePath)) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parser = PARSERS.find(p => p.supports(filePath));
        if (parser && parser.parseTasks) {
          return parser.parseTasks(content);
        }
      } catch {
        return [];
      }
    }
  }

  for (const parser of PARSERS) {
    const fileName = parser instanceof PrdJsonTaskParser ? 'prd.json' : 'tasks.md';
    const filePath = path.join(changesDir, changeName, fileName);
    if (await fileExists(filePath)) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        if (parser.parseTasks) {
          return parser.parseTasks(content);
        }
      } catch {
        continue;
      }
    }
  }

  return [];
}

export function countTasksFromContent(content: string): TaskProgress {
  const lines = content.split('\n');
  let total = 0;
  let completed = 0;
  for (const line of lines) {
    if (line.match(TASK_PATTERN)) {
      total++;
      if (line.match(COMPLETED_TASK_PATTERN)) {
        completed++;
      }
    }
  }
  return { total, completed };
}

export function formatTaskStatus(progress: TaskProgress): string {
  if (progress.total === 0) return 'No tasks';
  if (progress.completed === progress.total) return '✓ Complete';
  return `${progress.completed}/${progress.total} tasks`;
}
