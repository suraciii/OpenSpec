import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import {
  MarkdownTaskParser,
  PrdJsonTaskParser,
  getTaskProgressForChange,
  getTaskItemsForChange,
  countTasksFromContent,
  type TaskProgress,
  type TaskItem,
} from '../../src/utils/task-progress.js';

describe('MarkdownTaskParser', () => {
  let parser: MarkdownTaskParser;

  beforeEach(() => {
    parser = new MarkdownTaskParser();
  });

  describe('parse', () => {
    it('should parse empty content', () => {
      const result = parser.parse('');
      expect(result).toEqual({ total: 0, completed: 0 });
    });

    it('should parse tasks with checkboxes', () => {
      const content = `- [ ] Task 1
- [x] Task 2
- [ ] Task 3
- [X] Task 4`;
      
      const result = parser.parse(content);
      expect(result).toEqual({ total: 4, completed: 2 });
    });

    it('should handle mixed list markers', () => {
      const content = `- [ ] Task 1
* [x] Task 2
- [X] Task 3`;
      
      const result = parser.parse(content);
      expect(result).toEqual({ total: 3, completed: 2 });
    });

    it('should ignore non-checkbox lines', () => {
      const content = `## Tasks

Some text

- [ ] Task 1
Regular text
- [x] Task 2`;
      
      const result = parser.parse(content);
      expect(result).toEqual({ total: 2, completed: 1 });
    });
  });

  describe('parseTasks', () => {
    it('should extract task items with IDs', () => {
      const content = `- [ ] Task 1
- [x] Task 2
- [ ] Task 3`;
      
      const tasks = parser.parseTasks(content);
      expect(tasks).toHaveLength(3);
      expect(tasks[0]).toEqual({
        id: 'T-001',
        description: 'Task 1',
        done: false,
      });
      expect(tasks[1]).toEqual({
        id: 'T-002',
        description: 'Task 2',
        done: true,
      });
      expect(tasks[2]).toEqual({
        id: 'T-003',
        description: 'Task 3',
        done: false,
      });
    });
  });

  describe('supports', () => {
    it('should support .md files', () => {
      expect(parser.supports('tasks.md')).toBe(true);
      expect(parser.supports('/path/to/tasks.md')).toBe(true);
    });

    it('should not support other extensions', () => {
      expect(parser.supports('prd.json')).toBe(false);
      expect(parser.supports('tasks.txt')).toBe(false);
    });
  });
});

describe('PrdJsonTaskParser', () => {
  let parser: PrdJsonTaskParser;

  beforeEach(() => {
    parser = new PrdJsonTaskParser();
  });

  describe('parse', () => {
    it('should parse valid prd.json', () => {
      const content = JSON.stringify({
        project: 'TestProject',
        description: 'Test description',
        tasks: [
          { id: 'T-001', title: 'Task 1', passes: false },
          { id: 'T-002', title: 'Task 2', passes: true },
          { id: 'T-003', title: 'Task 3', passes: false },
        ],
      });
      
      const result = parser.parse(content);
      expect(result).toEqual({ total: 3, completed: 1 });
    });

    it('should handle empty tasks array', () => {
      const content = JSON.stringify({
        project: 'TestProject',
        tasks: [],
      });
      
      const result = parser.parse(content);
      expect(result).toEqual({ total: 0, completed: 0 });
    });

    it('should handle missing tasks field', () => {
      const content = JSON.stringify({
        project: 'TestProject',
      });
      
      const result = parser.parse(content);
      expect(result).toEqual({ total: 0, completed: 0 });
    });

    it('should handle invalid JSON', () => {
      const result = parser.parse('not valid json');
      expect(result).toEqual({ total: 0, completed: 0 });
    });

    it('should count passes: true as completed', () => {
      const content = JSON.stringify({
        tasks: [
          { id: 'T-001', passes: true },
          { id: 'T-002', passes: false },
          { id: 'T-003', passes: true },
          { id: 'T-004', passes: undefined },
        ],
      });
      
      const result = parser.parse(content);
      expect(result).toEqual({ total: 4, completed: 2 });
    });
  });

  describe('parseTasks', () => {
    it('should extract task items with full metadata', () => {
      const content = JSON.stringify({
        tasks: [
          {
            id: 'T-001',
            title: 'Task 1',
            description: 'Description 1',
            acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
            priority: 1,
            passes: false,
          },
          {
            id: 'T-002',
            title: 'Task 2',
            passes: true,
          },
        ],
      });
      
      const tasks = parser.parseTasks(content);
      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toEqual({
        id: 'T-001',
        description: 'Task 1',
        done: false,
        priority: 1,
        acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
      });
      expect(tasks[1]).toEqual({
        id: 'T-002',
        description: 'Task 2',
        done: true,
        priority: undefined,
        acceptanceCriteria: undefined,
      });
    });

    it('should fallback to description if title missing', () => {
      const content = JSON.stringify({
        tasks: [
          {
            id: 'T-001',
            description: 'Description only',
            passes: false,
          },
        ],
      });
      
      const tasks = parser.parseTasks(content);
      expect(tasks[0].description).toBe('Description only');
    });

    it('should handle missing id', () => {
      const content = JSON.stringify({
        tasks: [
          { title: 'Task without ID', passes: false },
        ],
      });
      
      const tasks = parser.parseTasks(content);
      expect(tasks[0].id).toBe('T-000');
    });
  });

  describe('supports', () => {
    it('should support .json files', () => {
      expect(parser.supports('prd.json')).toBe(true);
      expect(parser.supports('/path/to/prd.json')).toBe(true);
    });

    it('should not support other extensions', () => {
      expect(parser.supports('tasks.md')).toBe(false);
      expect(parser.supports('data.txt')).toBe(false);
    });
  });
});

describe('getTaskProgressForChange', () => {
  const testDir = path.join(process.cwd(), 'test-temp-task-progress');
  const changesDir = path.join(testDir, 'changes');

  beforeEach(async () => {
    await fs.mkdir(changesDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should read tasks.md when no tracksFile specified', async () => {
    const changeDir = path.join(changesDir, 'test-change');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(
      path.join(changeDir, 'tasks.md'),
      '- [ ] Task 1\n- [x] Task 2'
    );

    const result = await getTaskProgressForChange(changesDir, 'test-change');
    expect(result).toEqual({ total: 2, completed: 1 });
  });

  it('should read prd.json when specified as tracksFile', async () => {
    const changeDir = path.join(changesDir, 'test-change');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(
      path.join(changeDir, 'prd.json'),
      JSON.stringify({
        tasks: [
          { id: 'T-001', passes: false },
          { id: 'T-002', passes: true },
        ],
      })
    );

    const result = await getTaskProgressForChange(
      changesDir,
      'test-change',
      'prd.json'
    );
    expect(result).toEqual({ total: 2, completed: 1 });
  });

  it('should fallback to tasks.md when prd.json not found', async () => {
    const changeDir = path.join(changesDir, 'test-change');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(
      path.join(changeDir, 'tasks.md'),
      '- [x] Task 1\n- [x] Task 2'
    );

    const result = await getTaskProgressForChange(changesDir, 'test-change');
    expect(result).toEqual({ total: 2, completed: 2 });
  });

  it('should return zero progress when no tracking file exists', async () => {
    const changeDir = path.join(changesDir, 'test-change');
    await fs.mkdir(changeDir, { recursive: true });

    const result = await getTaskProgressForChange(changesDir, 'test-change');
    expect(result).toEqual({ total: 0, completed: 0 });
  });

  it('should prioritize prd.json over tasks.md when both exist', async () => {
    const changeDir = path.join(changesDir, 'test-change');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(
      path.join(changeDir, 'tasks.md'),
      '- [ ] Task 1\n- [ ] Task 2'
    );
    await fs.writeFile(
      path.join(changeDir, 'prd.json'),
      JSON.stringify({
        tasks: [
          { id: 'T-001', passes: true },
          { id: 'T-002', passes: true },
          { id: 'T-003', passes: false },
        ],
      })
    );

    const result = await getTaskProgressForChange(changesDir, 'test-change');
    expect(result).toEqual({ total: 3, completed: 2 });
  });
});

describe('getTaskItemsForChange', () => {
  const testDir = path.join(process.cwd(), 'test-temp-task-items');
  const changesDir = path.join(testDir, 'changes');

  beforeEach(async () => {
    await fs.mkdir(changesDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should extract task items from tasks.md', async () => {
    const changeDir = path.join(changesDir, 'test-change');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(
      path.join(changeDir, 'tasks.md'),
      '- [ ] Task 1\n- [x] Task 2'
    );

    const tasks = await getTaskItemsForChange(changesDir, 'test-change');
    expect(tasks).toHaveLength(2);
    expect(tasks[0].done).toBe(false);
    expect(tasks[1].done).toBe(true);
  });

  it('should extract task items from prd.json with metadata', async () => {
    const changeDir = path.join(changesDir, 'test-change');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(
      path.join(changeDir, 'prd.json'),
      JSON.stringify({
        tasks: [
          {
            id: 'T-001',
            title: 'Task 1',
            acceptanceCriteria: ['Criterion 1'],
            priority: 1,
            passes: false,
          },
          {
            id: 'T-002',
            title: 'Task 2',
            passes: true,
          },
        ],
      })
    );

    const tasks = await getTaskItemsForChange(changesDir, 'test-change');
    expect(tasks).toHaveLength(2);
    expect(tasks[0].acceptanceCriteria).toEqual(['Criterion 1']);
    expect(tasks[0].priority).toBe(1);
    expect(tasks[1].done).toBe(true);
  });

  it('should use specified tracksFile', async () => {
    const changeDir = path.join(changesDir, 'test-change');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(
      path.join(changeDir, 'prd.json'),
      JSON.stringify({
        tasks: [{ id: 'T-001', title: 'Task 1', passes: true }],
      })
    );

    const tasks = await getTaskItemsForChange(
      changesDir,
      'test-change',
      'prd.json'
    );
    expect(tasks).toHaveLength(1);
    expect(tasks[0].done).toBe(true);
  });
});

describe('countTasksFromContent (legacy)', () => {
  it('should maintain backward compatibility', () => {
    const content = `- [ ] Task 1
- [x] Task 2
- [ ] Task 3`;
    
    const result = countTasksFromContent(content);
    expect(result).toEqual({ total: 3, completed: 1 });
  });
});

describe('Cross-platform path handling', () => {
  const testDir = path.join(process.cwd(), 'test-temp-cross-platform');
  const changesDir = path.join(testDir, 'changes');

  beforeEach(async () => {
    await fs.mkdir(changesDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should handle Windows-style paths', async () => {
    const changeDir = path.join(changesDir, 'test-change');
    await fs.mkdir(changeDir, { recursive: true });
    await fs.writeFile(
      path.join(changeDir, 'prd.json'),
      JSON.stringify({
        tasks: [{ id: 'T-001', passes: true }],
      })
    );

    const result = await getTaskProgressForChange(changesDir, 'test-change');
    expect(result.total).toBe(1);
  });

  it('should use path.join for path construction', async () => {
    const changeDir = path.join(changesDir, 'test-change');
    await fs.mkdir(changeDir, { recursive: true });
    
    const expectedPath = path.join(changeDir, 'prd.json');
    await fs.writeFile(
      expectedPath,
      JSON.stringify({
        tasks: [{ id: 'T-001', passes: true }],
      })
    );

    const result = await getTaskProgressForChange(changesDir, 'test-change');
    expect(result.total).toBe(1);
  });
});
