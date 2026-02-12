/**
 * Memory Monitor Service
 *
 * Monitors RSS memory usage and triggers alerts/actions at configurable thresholds.
 * Designed for 1GB RAM VPS environments.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("memory");

export interface MemoryMonitorConfig {
  /**
   * How often to check memory (milliseconds)
   * @default 60000 (1 minute)
   */
  checkInterval?: number;

  /**
   * Log memory stats every N checks
   * @default 1 (every check)
   */
  logEvery?: number;

  /**
   * Thresholds in MB
   */
  thresholds?: {
    /** Warn when RSS exceeds this (MB) */
    warning?: number;
    /** Critical - trigger GC when RSS exceeds this (MB) */
    critical?: number;
    /** Emergency - shutdown when RSS exceeds this (MB) */
    emergency?: number;
  };

  /**
   * Enable automatic GC at critical threshold
   * @default true
   */
  autoGc?: boolean;

  /**
   * Enable emergency shutdown at emergency threshold
   * @default true
   */
  emergencyShutdown?: boolean;
}

export interface MemoryStats {
  /** Resident Set Size (total memory used by process) */
  rss: number;
  /** V8 heap used */
  heapUsed: number;
  /** V8 heap total allocated */
  heapTotal: number;
  /** External memory (C++ objects) */
  external: number;
  /** Array buffers */
  arrayBuffers: number;
  /** Timestamp */
  timestamp: number;
}

export class MemoryMonitor {
  private config: Required<MemoryMonitorConfig>;
  private intervalHandle?: Timer;
  private checkCount = 0;
  private lastStats?: MemoryStats;

  constructor(config: MemoryMonitorConfig = {}) {
    this.config = {
      checkInterval: config.checkInterval ?? 60000, // 1 minute
      logEvery: config.logEvery ?? 1,
      thresholds: {
        warning: config.thresholds?.warning ?? 850, // MB
        critical: config.thresholds?.critical ?? 900, // MB
        emergency: config.thresholds?.emergency ?? 950, // MB
      },
      autoGc: config.autoGc ?? true,
      emergencyShutdown: config.emergencyShutdown ?? true,
    };
  }

  /**
   * Start memory monitoring
   */
  start(): void {
    if (this.intervalHandle) {
      log.warn("Memory monitor already started");
      return;
    }

    log.info(
      `Starting memory monitor (check every ${this.config.checkInterval / 1000}s, thresholds: warn=${this.config.thresholds.warning}MB, critical=${this.config.thresholds.critical}MB, emergency=${this.config.thresholds.emergency}MB)`,
    );

    // Initial check immediately
    this.check();

    // Then periodic checks
    this.intervalHandle = setInterval(() => {
      this.check();
    }, this.config.checkInterval);
  }

  /**
   * Stop memory monitoring
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
      log.info("Memory monitor stopped");
    }
  }

  /**
   * Get current memory stats
   */
  getStats(): MemoryStats {
    const mem = process.memoryUsage();
    return {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
      timestamp: Date.now(),
    };
  }

  /**
   * Format bytes to MB string
   */
  private formatMB(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }

  /**
   * Perform memory check
   */
  private check(): void {
    this.checkCount++;
    const stats = this.getStats();
    this.lastStats = stats;

    const rssMB = stats.rss / 1024 / 1024;
    const heapMB = stats.heapUsed / 1024 / 1024;

    // Log stats periodically
    if (this.checkCount % this.config.logEvery === 0) {
      log.info(
        `RSS: ${this.formatMB(stats.rss)}, Heap: ${this.formatMB(stats.heapUsed)}/${this.formatMB(stats.heapTotal)}, External: ${this.formatMB(stats.external)}`,
      );
    }

    // Check thresholds
    this.checkThresholds(rssMB, stats);
  }

  /**
   * Check memory thresholds and take action
   */
  private checkThresholds(rssMB: number, stats: MemoryStats): void {
    const { warning, critical, emergency } = this.config.thresholds;

    // Emergency threshold - shutdown to prevent OOM killer
    if (rssMB > emergency) {
      log.error(
        `💀 Memory EMERGENCY (${rssMB.toFixed(1)}MB > ${emergency}MB) - RSS: ${this.formatMB(stats.rss)}, Heap: ${this.formatMB(stats.heapUsed)}`,
      );

      if (this.config.emergencyShutdown) {
        log.error("Initiating emergency shutdown to prevent OOM kill");
        // Give time for log to flush
        setTimeout(() => {
          process.exit(1);
        }, 100);
      }
      return;
    }

    // Critical threshold - trigger GC
    if (rssMB > critical) {
      log.error(
        `🚨 Memory CRITICAL (${rssMB.toFixed(1)}MB > ${critical}MB) - RSS: ${this.formatMB(stats.rss)}, Heap: ${this.formatMB(stats.heapUsed)}`,
      );

      if (this.config.autoGc && global.gc) {
        log.warn("Triggering manual garbage collection");
        try {
          global.gc();
        } catch (err) {
          log.error("Failed to trigger GC:", err);
        }
      } else if (this.config.autoGc && !global.gc) {
        log.warn("GC not available (run with --expose-gc to enable)");
      }
      return;
    }

    // Warning threshold
    if (rssMB > warning) {
      log.warn(
        `⚠️  Memory HIGH (${rssMB.toFixed(1)}MB > ${warning}MB) - RSS: ${this.formatMB(stats.rss)}, Heap: ${this.formatMB(stats.heapUsed)}`,
      );
    }
  }

  /**
   * Get last recorded stats
   */
  getLastStats(): MemoryStats | undefined {
    return this.lastStats;
  }

  /**
   * Force an immediate memory check
   */
  forceCheck(): MemoryStats {
    const stats = this.getStats();
    const rssMB = stats.rss / 1024 / 1024;
    this.checkThresholds(rssMB, stats);
    return stats;
  }
}

// Singleton instance
let monitorInstance: MemoryMonitor | null = null;

/**
 * Get or create the global memory monitor instance
 */
export function getMemoryMonitor(config?: MemoryMonitorConfig): MemoryMonitor {
  if (!monitorInstance) {
    monitorInstance = new MemoryMonitor(config);
  }
  return monitorInstance;
}

/**
 * Start the global memory monitor
 */
export function startMemoryMonitor(config?: MemoryMonitorConfig): MemoryMonitor {
  const monitor = getMemoryMonitor(config);
  monitor.start();
  return monitor;
}

/**
 * Stop the global memory monitor
 */
export function stopMemoryMonitor(): void {
  if (monitorInstance) {
    monitorInstance.stop();
  }
}
