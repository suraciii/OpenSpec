import type { PrdTask, PrdData } from '../../src/types/prd.js';

export const DEFAULT_PRD_TASK: PrdTask = {
  id: 'T-001',
  title: 'Test Task',
  priority: 1,
  passes: false,
  description: 'A test task for unit testing',
};

export function createPrdTask(overrides: Partial<PrdTask> = {}): PrdTask {
  return {
    ...DEFAULT_PRD_TASK,
    ...overrides,
  };
}

export function createPrdTasks(
  count: number,
  baseOverrides: Partial<PrdTask> = {}
): PrdTask[] {
  return Array.from({ length: count }, (_, i) =>
    createPrdTask({
      id: `T-${String(i + 1).padStart(3, '0')}`,
      title: `Task ${i + 1}`,
      priority: Math.min(i + 1, 4),
      ...baseOverrides,
    })
  );
}

export function createOpenTask(overrides: Partial<PrdTask> = {}): PrdTask {
  return createPrdTask({
    passes: false,
    ...overrides,
  });
}

export function createCompletedTask(overrides: Partial<PrdTask> = {}): PrdTask {
  return createPrdTask({
    passes: true,
    ...overrides,
  });
}

export function createTaskWithDependencies(
  dependsOn: string[],
  overrides: Partial<PrdTask> = {}
): PrdTask {
  return createPrdTask({
    dependsOn,
    ...overrides,
  });
}

export const DEFAULT_PRD_DATA: PrdData = {
  project: 'TestProject',
  description: 'Test change description',
  tasks: [DEFAULT_PRD_TASK],
};

export function createPrdData(overrides: Partial<PrdData> = {}): PrdData {
  return {
    ...DEFAULT_PRD_DATA,
    ...overrides,
  };
}

export function createCompletedPrdData(
  taskCount: number = 2,
  overrides: Partial<PrdData> = {}
): PrdData {
  return createPrdData({
    tasks: createPrdTasks(taskCount, { passes: true }),
    ...overrides,
  });
}

export function createOpenPrdData(
  taskCount: number = 2,
  overrides: Partial<PrdData> = {}
): PrdData {
  return createPrdData({
    tasks: createPrdTasks(taskCount, { passes: false }),
    ...overrides,
  });
}

export function createMixedPrdData(
  completedCount: number = 1,
  openCount: number = 1,
  overrides: Partial<PrdData> = {}
): PrdData {
  const completedTasks = createPrdTasks(completedCount, { passes: true });
  const openTasks = createPrdTasks(openCount, { passes: false }).map((t, i) => ({
    ...t,
    id: `T-${String(completedCount + i + 1).padStart(3, '0')}`,
  }));

  return createPrdData({
    tasks: [...completedTasks, ...openTasks],
    ...overrides,
  });
}
