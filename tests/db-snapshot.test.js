const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { connection, syncDatabase } = require('../scripts/db-snapshot');

test('rejects remote restore targets and ambiguous connections before invoking tools', () => {
  assert.throws(() => connection('postgresql://user:pass@prod.example/db', true), /localhost/);
  assert.throws(() => connection('postgresql://user:pass@localhost/db?host=prod.example', true), /overrides/);
  assert.throws(() => syncDatabase('postgresql://u:p@localhost:5433/prod', 'postgresql://u:p@127.0.0.1:5433/dev'), /different/);
});

test('uses a new local database, read-only dump, atomic restore, and publishes only after validation', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yangcheng-sync-'));
  try {
    const calls = [];
    const run = (...args) => calls.push(args);
    const snapshot = syncDatabase('postgresql://u:p@prod.example/prod', 'postgresql://u:p@localhost:5433/dev', run, dir);
    assert.deepEqual(calls.map(call => call[0]), ['pg_dump', 'pg_restore', 'createdb', 'pg_restore', 'psql']);
    assert.equal(calls[0][3].readOnly, true);
    for (const call of calls.slice(1)) assert.equal(call[1].hostname, 'localhost');
    assert.ok(calls[3][2].includes('--single-transaction'));
    assert.equal(calls[3][1].pathname, snapshot.pathname);
    assert.match(fs.readFileSync(path.join(dir, 'snapshot.env'), 'utf8'), /yangcheng_snapshot_/);
    const before = fs.readFileSync(path.join(dir, 'snapshot.env'), 'utf8');
    for (const failAt of [0, 1, 2, 3, 4]) {
      let index = 0;
      assert.throws(() => syncDatabase('postgresql://u:p@prod.example/prod', 'postgresql://u:p@localhost:5433/dev', () => {
        if (index++ === failAt) throw new Error('simulated failure');
      }, dir), /simulated failure/);
      assert.equal(fs.readFileSync(path.join(dir, 'snapshot.env'), 'utf8'), before);
    }
  } finally {
    // Only remove the exact temporary directory created by this test.
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
