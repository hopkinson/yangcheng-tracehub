const { spawnSync, spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const snapshotEnv = path.join(root, 'data/db-sync/snapshot.env');

function loadConfig() {
  // Preserve explicit process variables; .env.local takes precedence over .env.
  for (const name of ['.env.local', '.env']) {
    const file = path.join(root, name);
    if (fs.existsSync(file)) process.loadEnvFile(file);
  }
}

function connection(value, local = false) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Missing or invalid PostgreSQL connection URL.'); }
  if (!['postgresql:', 'postgres:'].includes(url.protocol) || !url.pathname.slice(1)) {
    throw new Error('A PostgreSQL URL with a database name is required.');
  }
  if (local && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Snapshot target must use localhost, 127.0.0.1 or ::1.');
  }
  if (url.searchParams.has('host') || url.searchParams.has('hostaddr')) {
    throw new Error('Connection host overrides are not supported.');
  }
  return url;
}

function pg(tool, url, args, { readOnly = false, capture = false } = {}) {
  const env = { ...process.env, PGHOST: url.hostname.replace(/^\[|\]$/g, ''),
    PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGCONNECT_TIMEOUT: '15', PGSSLMODE: url.searchParams.get('sslmode') || 'prefer',
    PGOPTIONS: readOnly ? '-c default_transaction_read_only=on' : '' };
  let executable = process.env.PG_BIN ? path.join(process.env.PG_BIN, tool) : tool;
  if (process.env.PG_DOCKER_IMAGE) {
    // Docker Desktop clients reach both the SSH listener and local database through the host.
    if (['localhost', '127.0.0.1', '::1'].includes(env.PGHOST)) env.PGHOST = 'host.docker.internal';
    const dumpDir = path.dirname(snapshotEnv);
    const mappedArgs = args.map(arg => path.isAbsolute(arg) && path.dirname(arg) === dumpDir
      ? `/snapshots/${path.basename(arg)}` : arg);
    args = ['run', '--rm', '--add-host=host.docker.internal:host-gateway',
      '--volume', `${dumpDir}:/snapshots`,
      ...['PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGCONNECT_TIMEOUT', 'PGSSLMODE', 'PGOPTIONS']
        .flatMap(name => ['--env', name]), process.env.PG_DOCKER_IMAGE, tool, ...mappedArgs];
    executable = 'docker';
  }
  const result = spawnSync(executable, args, { env, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' });
  if (result.error || result.status !== 0) {
    throw new Error(`${tool} failed${result.error?.code === 'ENOENT' ? ': install PostgreSQL client tools or set PG_BIN' : ''}.`);
  }
  return result.stdout?.trim();
}

function syncDatabase(sourceValue, targetValue, run = pg, dir = path.dirname(snapshotEnv)) {
  const source = connection(sourceValue);
  const target = connection(targetValue, true);
  if (['localhost', '127.0.0.1', '[::1]'].includes(source.hostname) &&
      (source.port || '5432') === (target.port || '5432')) {
    throw new Error('Source and target must use different PostgreSQL servers.');
  }
  // Each run creates a fresh database; never drop or overwrite an existing database.
  const name = `yangcheng_snapshot_${Date.now()}_${randomBytes(4).toString('hex')}`;
  const snapshot = new URL(target);
  snapshot.pathname = `/${name}`;
  fs.mkdirSync(dir, { recursive: true });
  const dump = path.join(dir, `${name}.dump`);
  console.log('Exporting a consistent production snapshot (read-only)...');
  run('pg_dump', source, ['--no-password', '--format=custom', '--no-owner', '--no-acl', '--file', dump], { readOnly: true });
  run('pg_restore', target, ['--list', dump], { capture: true });
  run('createdb', target, ['--no-password', '--maintenance-db', decodeURIComponent(target.pathname.slice(1)), '--template=template0', name]);
  console.log(`Restoring into local database ${name}...`);
  run('pg_restore', snapshot, ['--no-password', '--no-owner', '--no-acl', '--exit-on-error', '--single-transaction', '--dbname', name, dump]);
  run('psql', snapshot, ['--no-password', '-X', '--set=ON_ERROR_STOP=1', '--command', 'SELECT count(*) AS outbound_orders FROM public."OutboundOrder";'], { readOnly: true });
  // Publish only after restore and schema validation succeed. Previous snapshot stays usable on failure.
  const envFile = path.join(dir, 'snapshot.env');
  fs.writeFileSync(`${envFile}.tmp`, `DATABASE_URL=${JSON.stringify(snapshot.toString())}\n`, { mode: 0o600 });
  fs.renameSync(`${envFile}.tmp`, envFile);
  console.log(`Snapshot ready. Dump: ${dump}\nRun: pnpm db:diagnose-outbound -- CK-20260930-005`);
  return snapshot;
}

async function syncWithTunnel() {
  const target = process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL;
  connection(target, true);
  if (!process.env.SSH_HOST) return syncDatabase(process.env.PROD_DATABASE_URL, target);
  const source = connection(process.env.PROD_DATABASE_URL);
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const args = ['-N', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'ExitOnForwardFailure=yes',
    '-o', 'StrictHostKeyChecking=yes', '-o', 'ServerAliveInterval=15', '-o', 'ServerAliveCountMax=2'];
  if (process.env.SSH_IDENTITY_FILE) args.push('-i', process.env.SSH_IDENTITY_FILE, '-o', 'IdentitiesOnly=yes');
  args.push('-L', `127.0.0.1:${port}:${source.hostname}:${source.port || '5432'}`, process.env.SSH_HOST);
  console.log('Opening SSH tunnel...');
  const ssh = spawn('ssh', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  let sshError;
  ssh.on('error', error => { sshError = error; });
  try {
    const deadline = Date.now() + 15000;
    while (true) {
      if (sshError || ssh.exitCode !== null) throw new Error('SSH tunnel failed. Check SSH_HOST and SSH_IDENTITY_FILE.');
      const ready = await new Promise(resolve => {
        const socket = net.connect({ host: '127.0.0.1', port });
        const done = value => { socket.destroy(); resolve(value); };
        socket.once('connect', () => done(true));
        socket.once('error', () => done(false));
        socket.setTimeout(300, () => done(false));
      });
      if (ready) break;
      if (Date.now() > deadline) throw new Error('SSH tunnel timed out.');
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    source.hostname = '127.0.0.1';
    source.port = String(port);
    return syncDatabase(source.toString(), target);
  } finally { ssh.kill(); }
}

async function diagnose(code) {
  if (!/^CK[-A-Za-z0-9]+$/.test(code || '')) throw new Error('Provide an outbound code, e.g. CK-20260930-005.');
  if (!fs.existsSync(snapshotEnv)) throw new Error('No local snapshot. Run pnpm db:sync:prod first.');
  // Override development DATABASE_URL explicitly, without changing .env or the running dev server.
  const env = require('node:util').parseEnv(fs.readFileSync(snapshotEnv, 'utf8'));
  const url = connection(env.DATABASE_URL, true);
  if (!/^\/yangcheng_snapshot_\d+_[a-f0-9]{8}$/.test(url.pathname)) throw new Error('Expected an isolated snapshot database.');
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    await db.$transaction(async tx => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const order = await tx.outboundOrder.findUnique({ where: { code }, select: {
        id: true, code: true, status: true, outboundTime: true, createdAt: true, approvedAt: true, updatedAt: true,
        lines: { select: { orderNo: true, order: { select: { code: true, deliveryDate: true } } } },
      } });
      if (!order) throw new Error(`Order ${code} not found in this snapshot.`);
      const format = date => date && ({ utc: date.toISOString(), beijing: new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
      }).format(date) });
      console.log(JSON.stringify({ ...order, outboundTime: format(order.outboundTime), createdAt: format(order.createdAt),
        approvedAt: format(order.approvedAt), updatedAt: format(order.updatedAt),
        lines: order.lines.map(line => ({ orderNo: line.orderNo, sourceOrder: line.order && {
          code: line.order.code, deliveryDate: format(line.order.deliveryDate),
        } })),
      }, null, 2));
      const logs = await tx.auditLog.findMany({ where: { OR: [{ entityId: order.id }, { details: { contains: order.id } },
        { details: { contains: code } }] }, orderBy: { createdAt: 'asc' }, select: {
        action: true, entityType: true, entityId: true, details: true, createdAt: true,
      } });
      console.log('Related audit logs (stored details, no inferred history):');
      console.log(JSON.stringify(logs.map(log => ({ ...log, createdAt: format(log.createdAt) })), null, 2));
      console.log('A current snapshot cannot recover overwritten values unless audit logs or older backups recorded them.');
    }, { timeout: 30000 });
  } finally { await db.$disconnect(); }
}

if (require.main === module) {
  loadConfig();
  const [command, ...args] = process.argv.slice(2).filter(arg => arg !== '--');
  Promise.resolve().then(() => {
    if (command === 'sync') return syncWithTunnel();
    if (command === 'diagnose') return diagnose(args[0]);
    throw new Error('Usage: node scripts/db-snapshot.js sync | diagnose CK-20260930-005');
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { connection, syncDatabase };
