import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrderPagination} from '../src/order-pagination.js';

test('page changes wait for the active response, including rendering', async () => {
  const requests = [], shown = [];
  let receive, finishRendering;
  const pager = createOrderPagination(page => {
    requests.push(page);
    return new Promise(resolve => { receive = resolve; });
  }, (data, page) => {
    shown.push(page);
    return new Promise(resolve => { finishRendering = resolve; });
  });
  const first = pager.load();
  assert.equal(pager.loading, true);
  assert.equal(await pager.load(1), false);
  assert.equal(await pager.load(2), false);
  receive({hasMore: true});
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(await pager.load(1), false);
  finishRendering();
  assert.equal(await first, true);
  assert.deepEqual(requests, [0]);
  assert.deepEqual(shown, [0]);
  assert.equal(pager.page, 0);
  assert.equal(pager.hasMore, true);
  assert.equal(pager.loading, false);
});

test('failed navigation retains the visible page and permits a retry', async () => {
  const requests = [], shown = [];
  let fail = false;
  const pager = createOrderPagination(async page => {
    requests.push(page);
    if (fail) throw new Error('Order service unavailable.');
    return {hasMore: page === 0};
  }, (_, page) => { shown.push(page); });
  await pager.load();
  fail = true;
  await assert.rejects(pager.load(1), /unavailable/);
  assert.equal(pager.page, 0);
  assert.equal(pager.hasMore, true);
  assert.equal(pager.loading, false);
  assert.deepEqual(shown, [0]);
  fail = false;
  await pager.load(pager.page + 1);
  assert.deepEqual(requests, [0, 1, 1]);
  assert.deepEqual(shown, [0, 1]);
  assert.equal(pager.page, 1);
  assert.equal(pager.hasMore, false);
});
