export function getRuntimeMetrics() {
  const memory = process.memoryUsage();

  return {
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssBytes: memory.rss,
      heapTotalBytes: memory.heapTotal,
      heapUsedBytes: memory.heapUsed,
      externalBytes: memory.external,
    },
    pid: process.pid,
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  };
}
