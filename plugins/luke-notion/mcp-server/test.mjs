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
