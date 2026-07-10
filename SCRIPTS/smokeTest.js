/**
 * Lightweight smoke checks against production API.
 * Usage: node SCRIPTS/smokeTest.js
 */
const BASE = process.env.API_BASE || 'https://knight-kings-api-361196162422.us-central1.run.app';

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}:`, e.message);
    process.exitCode = 1;
  }
}

async function main() {
  await check('health', async () => {
    const r = await fetch(`${BASE}/health`);
    if (!r.ok) throw new Error(`status ${r.status}`);
    const j = await r.json();
    if (j.status !== 'ok') throw new Error(JSON.stringify(j));
  });

  await check('plans public', async () => {
    const r = await fetch(`${BASE}/subscription/plans`);
    if (!r.ok) throw new Error(`status ${r.status}`);
  });

  await check('bunny locked', async () => {
    const r = await fetch(`${BASE}/bunny/`);
    if (r.status !== 401 && r.status !== 403) {
      throw new Error(`expected 401/403 got ${r.status}`);
    }
  });

  await check('subscribe disabled', async () => {
    const r = await fetch(`${BASE}/subscription/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid' },
      body: JSON.stringify({ planId: 'x', paymentMethod: 'card', transactionId: 'y', amountPaid: 1 }),
    });
    // 401 without valid session is OK; 403 if somehow authenticated
    if (![401, 403].includes(r.status)) throw new Error(`unexpected ${r.status}`);
  });

  console.log('Smoke done');
}

main();
