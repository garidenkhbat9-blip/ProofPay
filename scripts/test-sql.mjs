import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
let phase = 'bootstrap';
try {
  await db.exec(await readFile('tests/sql/bootstrap.sql','utf8'));
  for (const migration of ['001_foundation.sql','002_agreements.sql','003_handoffs.sql','004_paypal_sandbox.sql','005_payment_claim_eligibility.sql','006_project_archive.sql']) {
    phase = migration;
    await db.exec(await readFile('migrations/'+migration,'utf8'));
    console.log('PASS migration '+migration);
  }
  for (const fixture of ['tests/payments-authorization.sql','tests/sql/evidence-authorization.sql','tests/sql/project-retention.sql','tests/sql/project-archive.sql']) {
    phase = fixture;
    await db.exec(await readFile(fixture,'utf8'));
    console.log('PASS '+fixture);
  }
  const result = await db.query('select count(*)::int as count from public.payments');
  assert.equal(result.rows[0].count,0,'Fixtures must roll back');
  console.log('PASS fixture rollback; isolated PostgreSQL only, no external connections');
} catch(error) {
  console.error('FAIL '+phase+': '+(error instanceof Error ? error.message : 'SQL error'));
  process.exitCode=1;
} finally {await db.close();}
