type Task<T> = () => Promise<T>;

interface QueuedTask<T = any> {
  task: Task<T>;
  priority: number;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}

export class RateLimitedPromiseQueue {
  private queue: QueuedTask[] = [];
  private running = false;
  private lastRunTime = 0;

  constructor(private rateLimitMs: number) {}

  enqueue<T>(task: Task<T>, priority: number = 0): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queuedTask: QueuedTask = { task, priority, resolve, reject };

      // Insert task by priority: higher values are higher priority
      const index = this.queue.findIndex(q => q.priority < priority);
      if (index === -1) {
        this.queue.push(queuedTask);
      } else {
        this.queue.splice(index, 0, queuedTask);
      }

      this.runNext();
    });
  }

  private async runNext() {
    if (this.running || this.queue.length === 0) {
      return;
    }

    this.running = true;
    const { task, resolve, reject } = this.queue.shift()!;

    try {
      const now = Date.now();
      const waitTime = Math.max(0, this.rateLimitMs - (now - this.lastRunTime));
      if (waitTime > 0) {
        await this.delay(waitTime);
      }

      this.lastRunTime = Date.now();
      const result = await task();
      resolve(result);
    } catch (err) {
      reject(err);
    } finally {
      this.running = false;
      this.runNext();
    }
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
