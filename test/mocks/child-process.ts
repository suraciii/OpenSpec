import { EventEmitter } from 'node:events';

export interface MockProcessConfig {
  exitCode?: number;
  stdout?: string | string[];
  stderr?: string | string[];
  chunkDelay?: number;
  exitDelay?: number;
  error?: Error;
  hang?: boolean;
}

export class MockChildProcess extends EventEmitter {
  public readonly stdout: EventEmitter;
  public readonly stderr: EventEmitter;
  public readonly stdin: { write: () => void; end: () => void; destroy: () => void };
  public pid: number;
  public killed = false;
  public exitCode: number | null = null;

  private config: MockProcessConfig;
  private timeouts: NodeJS.Timeout[] = [];

  constructor(config: MockProcessConfig = {}) {
    super();
    this.config = config;
    this.stdout = this.createMockStream();
    this.stderr = this.createMockStream();
    this.stdin = {
      write: () => {},
      end: () => {},
      destroy: () => {},
    };
    this.pid = Math.floor(Math.random() * 100000);
  }

  private createMockStream(): EventEmitter & { setEncoding: () => void; destroy: () => void } {
    const stream = new EventEmitter() as EventEmitter & { setEncoding: () => void; destroy: () => void };
    stream.setEncoding = () => {};
    stream.destroy = () => {};
    return stream;
  }

  start(): void {
    if (this.config.error) {
      setImmediate(() => this.emit('error', this.config.error));
      return;
    }

    if (this.config.hang) {
      return;
    }

    const chunkDelay = this.config.chunkDelay ?? 10;
    const exitDelay = this.config.exitDelay ?? 50;

    const stdoutChunks = this.normalizeOutput(this.config.stdout);
    stdoutChunks.forEach((chunk, i) => {
      const timeout = setTimeout(
        () => this.stdout.emit('data', chunk),
        chunkDelay * i
      );
      this.timeouts.push(timeout);
    });

    const stderrChunks = this.normalizeOutput(this.config.stderr);
    stderrChunks.forEach((chunk, i) => {
      const timeout = setTimeout(
        () => this.stderr.emit('data', chunk),
        chunkDelay * i
      );
      this.timeouts.push(timeout);
    });

    const totalDelay = Math.max(
      chunkDelay * stdoutChunks.length,
      chunkDelay * stderrChunks.length
    );

    const exitTimeout = setTimeout(() => {
      this.exitCode = this.config.exitCode ?? 0;
      this.stdout.emit('close');
      this.stderr.emit('close');
      this.emit('close', this.exitCode, null);
      this.emit('exit', this.exitCode, null);
    }, totalDelay + exitDelay);

    this.timeouts.push(exitTimeout);
  }

  kill(signal?: string): boolean {
    this.killed = true;
    this.clearTimeouts();
    this.exitCode = signal === 'SIGKILL' ? 137 : 143;
    setImmediate(() => {
      this.stdout.emit('close');
      this.stderr.emit('close');
      this.emit('close', this.exitCode, signal ?? 'SIGTERM');
      this.emit('exit', this.exitCode, signal ?? 'SIGTERM');
    });
    return true;
  }

  unref(): void {}

  private normalizeOutput(output?: string | string[]): string[] {
    if (!output) return [];
    if (typeof output === 'string') return [output];
    return output;
  }

  private clearTimeouts(): void {
    for (const timeout of this.timeouts) {
      clearTimeout(timeout);
    }
    this.timeouts = [];
  }
}

export class MockSpawnFactory {
  private configs: MockProcessConfig[] = [];
  private callIndex = 0;
  public spawnCalls: Array<{ command: string; args: string[]; options: unknown }> = [];

  setNextConfig(config: MockProcessConfig): void {
    this.configs.push(config);
  }

  setConfigs(configs: MockProcessConfig[]): void {
    this.configs = [...configs];
    this.callIndex = 0;
  }

  reset(): void {
    this.configs = [];
    this.callIndex = 0;
    this.spawnCalls = [];
  }

  createSpawn(): (
    command: string,
    args: string[],
    options?: unknown
  ) => MockChildProcess {
    return (command: string, args: string[], options?: unknown) => {
      this.spawnCalls.push({ command, args, options });

      const config = this.configs[this.callIndex] ?? {};
      this.callIndex++;

      const process = new MockChildProcess(config);
      setImmediate(() => process.start());
      return process;
    };
  }
}

export function createMockSpawn(config: MockProcessConfig = {}) {
  const factory = new MockSpawnFactory();
  factory.setNextConfig(config);
  return factory.createSpawn();
}

export function createSuccessfulSpawn(stdout = '<promise>COMPLETE</promise>') {
  return createMockSpawn({
    exitCode: 0,
    stdout,
    stderr: '',
  });
}

export function createFailedSpawn(stderr = 'Error', exitCode = 1) {
  return createMockSpawn({
    exitCode,
    stdout: '',
    stderr,
  });
}

export function createHangingSpawn() {
  return createMockSpawn({ hang: true });
}

export function createSpawnError(message = 'spawn ENOENT') {
  return createMockSpawn({
    error: new Error(message),
  });
}