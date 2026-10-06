import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
assert.equal(typeof worker.fetch,'function');
const home=await worker.fetch(new Request('https://example.workers.dev/'));
assert.equal(home.status,200);
assert.match(await home.text(),/市價觀測站/);
assert.equal((await worker.fetch(new Request('https://example.workers.dev/api/search'))).status,400);
assert.equal((await worker.fetch(new Request('https://example.workers.dev/api/history?q=test&currency=invalid'))).status,400);
console.log('Independent homepage and API parameter validation passed');
