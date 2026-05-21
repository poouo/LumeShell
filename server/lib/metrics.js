import { connectSsh, getConnection } from './connections.js';

function exec(client, command) {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }
      let stdout = '';
      let stderr = '';
      stream.on('data', (chunk) => { stdout += chunk.toString(); });
      stream.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
      stream.on('close', (code) => {
        if (code !== 0 && stderr.trim()) reject(new Error(stderr.trim()));
        else resolve(stdout.trim());
      });
    });
  });
}

function parseKeyValue(output) {
  const result = {};
  for (const line of output.split('\n')) {
    const index = line.indexOf('=');
    if (index > 0) result[line.slice(0, index)] = line.slice(index + 1);
  }
  return result;
}

function linuxMetricsCommand() {
  return String.raw`
set -e
echo "hostname=$(hostname 2>/dev/null || echo unknown)"
echo "kernel=$(uname -sr 2>/dev/null || echo unknown)"
awk '/^cpu / {print "cpu_total=" ($2+$3+$4+$5+$6+$7+$8+$9+$10) "\ncpu_idle=" ($5+$6)}' /proc/stat
awk '
/MemTotal/ {total=$2}
/MemAvailable/ {available=$2}
 /SwapTotal/ {swap_total=$2}
 /SwapFree/ {swap_free=$2}
END {print "mem_total_kb=" total "\nmem_available_kb=" available "\nswap_total_kb=" swap_total "\nswap_free_kb=" swap_free}
' /proc/meminfo
df -Pk / | awk 'NR==2 {print "disk_total_kb=" $2 "\ndisk_used_kb=" $3 "\ndisk_available_kb=" $4 "\ndisk_mount=" $6}'
awk '{print "uptime_seconds=" int($1)}' /proc/uptime
awk '{print "load_1=" $1 "\nload_5=" $2 "\nload_15=" $3}' /proc/loadavg
awk 'NR>2 {
  gsub(":", "", $1);
  rx += $2;
  tx += $10
} END {print "net_rx_bytes=" rx "\nnet_tx_bytes=" tx}' /proc/net/dev
uptime | sed 's/^/uptime=/'
`;
}

export async function readMetrics(connectionId) {
  const connection = getConnection(connectionId);
  const client = await connectSsh(connection);
  try {
    const output = await exec(client, linuxMetricsCommand());
    const kv = parseKeyValue(output);
    const memTotal = Number(kv.mem_total_kb || 0) * 1024;
    const memAvailable = Number(kv.mem_available_kb || 0) * 1024;
    const diskTotal = Number(kv.disk_total_kb || 0) * 1024;
    const diskUsed = Number(kv.disk_used_kb || 0) * 1024;
    const swapTotal = Number(kv.swap_total_kb || 0) * 1024;
    const swapFree = Number(kv.swap_free_kb || 0) * 1024;
    return {
      sampledAt: new Date().toISOString(),
      hostname: kv.hostname || connection.host,
      kernel: kv.kernel || '',
      uptime: kv.uptime || '',
      uptimeSeconds: Number(kv.uptime_seconds || 0),
      load: {
        one: Number(kv.load_1 || 0),
        five: Number(kv.load_5 || 0),
        fifteen: Number(kv.load_15 || 0)
      },
      cpu: {
        total: Number(kv.cpu_total || 0),
        idle: Number(kv.cpu_idle || 0)
      },
      memory: {
        total: memTotal,
        used: Math.max(0, memTotal - memAvailable),
        available: memAvailable
      },
      swap: {
        total: swapTotal,
        used: Math.max(0, swapTotal - swapFree),
        available: swapFree
      },
      disk: {
        mount: kv.disk_mount || '/',
        total: diskTotal,
        used: diskUsed,
        available: Number(kv.disk_available_kb || 0) * 1024
      },
      network: {
        rxBytes: Number(kv.net_rx_bytes || 0),
        txBytes: Number(kv.net_tx_bytes || 0)
      }
    };
  } finally {
    client.end();
  }
}
