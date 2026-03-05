import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("memory");

export interface MemoryMonitorConfig {
  checkInterval?: number;
  logEvery?: number;
  thresholds?: {
    warning?: number;
    critical?: number;
    emergency?: number;
  };
  autoGc?: boolean;
  emergencyShutdown?: boolean;
}

export interface MemoryStats {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  timestamp: number;
}

export class MemoryMonitor {
  private config: Required<MemoryMonitorConfig>;
  private intervalHandle?: ReturnType<typeof setInterval>;
  private checkCount = 0;

  constructor(config: MemoryMonitorConfig = {}) {
    this.config = {
      checkInterval: config.checkInterval ?? 60000,
      logEvery: config.logEvery ?? 1,
      thresholds: {
        warning: config.thresholds?.warning ?? 850,
        critical: config.thresholds?.critical ?? 900,
        emergency: config.thresholds?.emergency ?? 950,
      },
      autoGc: config.autoGc ?? true,
      emergencyShutdown: config.emergencyShutdown ?? false,
    };
  }

  start(): void {
    if (this.intervalHandle) {
      return;
    }
    log.info(
      `memory monitor: interval=${this.config.checkInterval / 1000}s warn=${this.config.thresholds.warning}MB critical=${this.config.thresholds.critical}MB emergency=${this.config.thresholds.emergency}MB`,
    );
    this.check();
    this.intervalHandle = setInterval(() => {
      this.check();
    }, this.config.checkInterval);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
  }

  private formatMB(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }

  private check(): void {
    this.checkCount += 1;
    const memory = process.memoryUsage();
    const stats: MemoryStats = {
      rss: memory.rss,
      heapUsed: memory.heapUsed,
      heapTotal: memory.heapTotal,
      external: memory.external,
      arrayBuffers: memory.arrayBuffers,
      timestamp: Date.now(),
    };
    const rssMB = stats.rss / 1024 / 1024;

    if (this.checkCount % this.config.logEvery === 0) {
      log.info(
        `RSS=${this.formatMB(stats.rss)} Heap=${this.formatMB(stats.heapUsed)}/${this.formatMB(stats.heapTotal)} External=${this.formatMB(stats.external)}`,
      );
    }

    const { warning, critical, emergency } = this.config.thresholds;
    if (rssMB > emergency) {
      log.error(`memory emergency: ${rssMB.toFixed(1)}MB > ${emergency}MB`);
      if (this.config.emergencyShutdown) {
        setTimeout(() => process.exit(1), 100);
      }
      return;
    }
    if (rssMB > critical) {
      log.error(`memory critical: ${rssMB.toFixed(1)}MB > ${critical}MB`);
      if (this.config.autoGc && global.gc) {
        try {
          global.gc();
        } catch {
          log.warn("memory monitor: manual gc failed");
        }
      }
      return;
    }
    if (rssMB > warning) {
      log.warn(`memory high: ${rssMB.toFixed(1)}MB > ${warning}MB`);
    }
  }
}

let monitorInstance: MemoryMonitor | null = null;

export function startMemoryMonitor(config?: MemoryMonitorConfig): MemoryMonitor {
  if (!monitorInstance) {
    monitorInstance = new MemoryMonitor(config);
  }
  monitorInstance.start();
  return monitorInstance;
}

export function stopMemoryMonitor(): void {
  if (monitorInstance) {
    monitorInstance.stop();
  }
}
