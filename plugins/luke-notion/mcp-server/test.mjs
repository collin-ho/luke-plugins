import { test } from 'node:test';
import assert from 'node:assert/strict';
import { flattenProp } from './notion-dump.mjs';

test('flattenProp: title → concatenated plain_text', () => {
  const v = { type: 'title', title: [{ plain_text: 'Hello ' }, { plain_text: 'world' }] };
  assert.equal(flattenProp(v), 'Hello world');
});

test('flattenProp: rich_text → concatenated plain_text', () => {
  const v = { type: 'rich_text', rich_text: [{ plain_text: 'a' }, { plain_text: 'b' }] };
  assert.equal(flattenProp(v), 'ab');
});

test('flattenProp: select → name or null', () => {
  assert.equal(flattenProp({ type: 'select', select: { name: 'Backlog' } }), 'Backlog');
  assert.equal(flattenProp({ type: 'select', select: null }), null);
});

test('flattenProp: multi_select → array of names', () => {
  const v = { type: 'multi_select', multi_select: [{ name: 'a' }, { name: 'b' }] };
  assert.deepEqual(flattenProp(v), ['a', 'b']);
});

test('flattenProp: date → start string or null', () => {
  assert.equal(flattenProp({ type: 'date', date: { start: '2026-04-21' } }), '2026-04-21');
  assert.equal(flattenProp({ type: 'date', date: null }), null);
});

test('flattenProp: checkbox → boolean', () => {
  assert.equal(flattenProp({ type: 'checkbox', checkbox: true }), true);
  assert.equal(flattenProp({ type: 'checkbox', checkbox: false }), false);
});

test('flattenProp: number → value or null', () => {
  assert.equal(flattenProp({ type: 'number', number: 42 }), 42);
  assert.equal(flattenProp({ type: 'number', number: null }), null);
});

test('flattenProp: people → array of ids', () => {
  const v = { type: 'people', people: [{ id: 'p1' }, { id: 'p2' }] };
  assert.deepEqual(flattenProp(v), ['p1', 'p2']);
});

test('flattenProp: relation → array of ids', () => {
  const v = { type: 'relation', relation: [{ id: 'r1' }, { id: 'r2' }] };
  assert.deepEqual(flattenProp(v), ['r1', 'r2']);
});

test('flattenProp: url/email/phone_number → scalar', () => {
  assert.equal(flattenProp({ type: 'url', url: 'https://x' }), 'https://x');
  assert.equal(flattenProp({ type: 'email', email: 'a@b' }), 'a@b');
  assert.equal(flattenProp({ type: 'phone_number', phone_number: '555' }), '555');
});

test('flattenProp: unique_id → prefix+number string', () => {
  const v = { type: 'unique_id', unique_id: { prefix: 'CTX', number: 42 } };
  assert.equal(flattenProp(v), 'CTX42');
  const v2 = { type: 'unique_id', unique_id: { prefix: null, number: 7 } };
  assert.equal(flattenProp(v2), '7');
  assert.equal(flattenProp({ type: 'unique_id', unique_id: null }), null);
});

test('flattenProp: formula → inner value of formula.type', () => {
  const v = { type: 'formula', formula: { type: 'string', string: 'computed' } };
  assert.equal(flattenProp(v), 'computed');
  const v2 = { type: 'formula', formula: { type: 'number', number: 5 } };
  assert.equal(flattenProp(v2), 5);
});

test('flattenProp: rollup → inner value of rollup.type', () => {
  const v = { type: 'rollup', rollup: { type: 'number', number: 10 } };
  assert.equal(flattenProp(v), 10);
});

test('flattenProp: rollup type=array → recursively flattened array', () => {
  const v = {
    type: 'rollup',
    rollup: {
      type: 'array',
      array: [
        { type: 'select', select: { id: 'x', name: 'Coresynq', color: 'blue' } },
        { type: 'select', select: { id: 'y', name: 'Rezzy', color: 'green' } }
      ]
    }
  };
  assert.deepEqual(flattenProp(v), ['Coresynq', 'Rezzy']);
});

test('flattenProp: rollup type=array with null items → nulls preserved', () => {
  const v = {
    type: 'rollup',
    rollup: {
      type: 'array',
      array: [
        { type: 'select', select: null },
        { type: 'select', select: { name: 'Cogent' } }
      ]
    }
  };
  assert.deepEqual(flattenProp(v), [null, 'Cogent']);
});

test('flattenProp: rollup type=array empty → empty array', () => {
  const v = { type: 'rollup', rollup: { type: 'array', array: [] } };
  assert.deepEqual(flattenProp(v), []);
});

test('flattenProp: status → name or null', () => {
  assert.equal(flattenProp({ type: 'status', status: { name: 'Done' } }), 'Done');
  assert.equal(flattenProp({ type: 'status', status: null }), null);
});

test('flattenProp: unknown type → passed through unchanged', () => {
  const v = { type: 'some_future_type', custom: 'data' };
  assert.deepEqual(flattenProp(v), v);
});

import { normalizeDataSourceId } from './notion-dump.mjs';

test('normalizeDataSourceId: accepts dashed UUID', () => {
  assert.equal(
    normalizeDataSourceId('b0d00fd8-eebb-434d-84c1-a652260fbe79'),
    'b0d00fd8-eebb-434d-84c1-a652260fbe79'
  );
});

test('normalizeDataSourceId: accepts undashed 32-char hex', () => {
  assert.equal(
    normalizeDataSourceId('b0d00fd8eebb434d84c1a652260fbe79'),
    'b0d00fd8-eebb-434d-84c1-a652260fbe79'
  );
});

test('normalizeDataSourceId: extracts from collection:// URI', () => {
  assert.equal(
    normalizeDataSourceId('collection://b0d00fd8-eebb-434d-84c1-a652260fbe79'),
    'b0d00fd8-eebb-434d-84c1-a652260fbe79'
  );
});

test('normalizeDataSourceId: extracts from collection:// URI (undashed inside)', () => {
  assert.equal(
    normalizeDataSourceId('collection://b0d00fd8eebb434d84c1a652260fbe79'),
    'b0d00fd8-eebb-434d-84c1-a652260fbe79'
  );
});

test('normalizeDataSourceId: rejects plain database URL (multi-source out of scope)', () => {
  // A plain database URL (notion.so/<db-id>) without collection:// prefix
  // should error — multi-source handling is out of scope for v0.2.0.
  assert.throws(
    () => normalizeDataSourceId('https://www.notion.so/4de35153f31d4427bc5a1c3b1c08648e'),
    /data source|collection/i
  );
});

test('normalizeDataSourceId: rejects garbage', () => {
  assert.throws(() => normalizeDataSourceId('not-a-uuid'), /invalid|data source|collection/i);
  assert.throws(() => normalizeDataSourceId(''), /required|empty|invalid/i);
});

import { paginateDataSource } from './notion-dump.mjs';

function mockFetch(responses) {
  let i = 0;
  return async (url, opts) => {
    const body = JSON.parse(opts.body);
    const resp = responses[i++];
    if (typeof resp === 'function') return resp(body);
    return {
      ok: resp.ok ?? true,
      status: resp.status ?? 200,
      async json() { return resp.json; },
      async text() { return JSON.stringify(resp.json); },
    };
  };
}

test('paginateDataSource: single page', async () => {
  const fetch = mockFetch([
    { json: { results: [{ id: 'a' }, { id: 'b' }], has_more: false, next_cursor: null } },
  ]);
  const result = await paginateDataSource({
    dataSourceId: 'b0d00fd8-eebb-434d-84c1-a652260fbe79',
    filter: null,
    token: 'ntn_fake',
    fetchImpl: fetch,
  });
  assert.equal(result.rows.length, 2);
  assert.equal(result.partial, false);
});

test('paginateDataSource: three pages with cursor progression', async () => {
  const fetch = mockFetch([
    { json: { results: Array(100).fill(0).map((_,i) => ({id:`p1-${i}`})), has_more: true, next_cursor: 'c1' } },
    { json: { results: Array(100).fill(0).map((_,i) => ({id:`p2-${i}`})), has_more: true, next_cursor: 'c2' } },
    { json: { results: Array(50).fill(0).map((_,i) => ({id:`p3-${i}`})), has_more: false, next_cursor: null } },
  ]);
  const result = await paginateDataSource({
    dataSourceId: 'b0d00fd8-eebb-434d-84c1-a652260fbe79',
    filter: null,
    token: 'ntn_fake',
    fetchImpl: fetch,
  });
  assert.equal(result.rows.length, 250);
  assert.equal(result.partial, false);
});

test('paginateDataSource: filter is passed through verbatim', async () => {
  const filter = { property: 'Status', select: { equals: 'Backlog' } };
  let capturedBody = null;
  const fetch = mockFetch([
    (body) => { capturedBody = body; return { ok: true, status: 200, async json() { return { results: [], has_more: false, next_cursor: null }; } }; },
  ]);
  await paginateDataSource({
    dataSourceId: 'b0d00fd8-eebb-434d-84c1-a652260fbe79',
    filter,
    token: 'ntn_fake',
    fetchImpl: fetch,
  });
  assert.deepEqual(capturedBody.filter, filter);
});

test('paginateDataSource: 401 returns clear error', async () => {
  const fetch = mockFetch([{ ok: false, status: 401, json: { message: 'Unauthorized' } }]);
  await assert.rejects(
    () => paginateDataSource({
      dataSourceId: 'b0d00fd8-eebb-434d-84c1-a652260fbe79',
      filter: null,
      token: 'ntn_bad',
      fetchImpl: fetch,
    }),
    /integration|access|401|unauthorized/i
  );
});

test('paginateDataSource: 403 returns clear error', async () => {
  const fetch = mockFetch([{ ok: false, status: 403, json: { message: 'Forbidden' } }]);
  await assert.rejects(
    () => paginateDataSource({
      dataSourceId: 'b0d00fd8-eebb-434d-84c1-a652260fbe79',
      filter: null,
      token: 'ntn_bad',
      fetchImpl: fetch,
    }),
    /integration|access|403|connections/i
  );
});

test('paginateDataSource: 429 retries once, then returns partial', async () => {
  let call = 0;
  const fetch = async () => {
    call++;
    if (call === 1) {
      return { ok: true, status: 200, async json() { return { results: [{id:'a'}], has_more: true, next_cursor: 'c1' }; } };
    }
    // Page 2 + retry both 429
    return { ok: false, status: 429, async json() { return {}; }, async text() { return 'rate limited'; } };
  };
  const result = await paginateDataSource({
    dataSourceId: 'b0d00fd8-eebb-434d-84c1-a652260fbe79',
    filter: null,
    token: 'ntn_fake',
    fetchImpl: fetch,
    retryDelayMs: 0,  // don't wait in tests
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.partial, true);
});
