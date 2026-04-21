export function flattenProp(v) {
  if (!v || typeof v !== 'object' || !('type' in v)) return v;
  switch (v.type) {
    case 'title':             return v.title.map(t => t.plain_text).join('');
    case 'rich_text':         return v.rich_text.map(t => t.plain_text).join('');
    case 'select':            return v.select?.name ?? null;
    case 'multi_select':      return v.multi_select.map(s => s.name);
    case 'date':              return v.date?.start ?? null;
    case 'checkbox':          return v.checkbox;
    case 'number':            return v.number;
    case 'people':            return v.people.map(p => p.id);
    case 'relation':          return v.relation.map(r => r.id);
    case 'url':               return v.url;
    case 'email':             return v.email;
    case 'phone_number':      return v.phone_number;
    case 'created_time':      return v.created_time;
    case 'last_edited_time':  return v.last_edited_time;
    case 'unique_id':         return v.unique_id
                                  ? `${v.unique_id.prefix ?? ''}${v.unique_id.number}`
                                  : null;
    case 'formula':           return v.formula?.[v.formula.type] ?? null;
    case 'rollup':
      if (!v.rollup) return null;
      if (v.rollup.type === 'array') return v.rollup.array.map(item => flattenProp(item));
      return v.rollup[v.rollup.type] ?? null;
    case 'status':            return v.status?.name ?? null;
    default:                  return v;
  }
}

/**
 * Normalize a user-supplied data source identifier to a dashed UUID.
 * Accepts: bare UUID (dashed or undashed 32-hex), or collection://UUID URI.
 * Rejects: plain database URLs (multi-source handling is out of scope).
 */
export function normalizeDataSourceId(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('data_source_id is required (string)');
  }
  const trimmed = input.trim();

  // Strip collection:// prefix if present
  const stripped = trimmed.replace(/^collection:\/\//, '');

  // Must look like a UUID — 32 hex chars with or without dashes
  const undashed = stripped.replace(/-/g, '');
  if (!/^[0-9a-f]{32}$/i.test(undashed)) {
    throw new Error(
      `invalid data_source_id: expected a UUID or collection:// URI, got ${JSON.stringify(input)}. ` +
      `For a multi-source database, pass the data source UUID directly (not the database URL).`
    );
  }

  // Return canonical dashed form
  return [
    undashed.slice(0, 8),
    undashed.slice(8, 12),
    undashed.slice(12, 16),
    undashed.slice(16, 20),
    undashed.slice(20, 32),
  ].join('-').toLowerCase();
}

const NOTION_API_VERSION = '2025-09-03';
const NOTION_PAGE_SIZE = 100;

/**
 * Paginate a Notion data source exhaustively via the REST API.
 * Returns { rows, partial } — partial is true if pagination terminated on a
 * retried-but-persistent 429 / 5xx mid-loop.
 *
 * @param {object} opts
 * @param {string} opts.dataSourceId - dashed UUID
 * @param {object|null} opts.filter - Notion filter JSON (shape per /v1/data_sources/{id}/query)
 * @param {string} opts.token - Notion integration token
 * @param {function} [opts.fetchImpl] - fetch to use (for tests). Defaults to global fetch.
 * @param {number} [opts.retryDelayMs] - delay between retry attempts. Defaults to 2000.
 */
export async function paginateDataSource({
  dataSourceId,
  filter,
  token,
  fetchImpl = globalThis.fetch,
  retryDelayMs = 2000,
}) {
  const rows = [];
  let cursor = null;
  let partial = false;

  while (true) {
    const body = { page_size: NOTION_PAGE_SIZE };
    if (filter) body.filter = filter;
    if (cursor) body.start_cursor = cursor;

    const resp = await fetchWithRetry({
      url: `https://api.notion.com/v1/data_sources/${dataSourceId}/query`,
      body,
      token,
      fetchImpl,
      retryDelayMs,
    });

    if (!resp.ok) {
      // 401/403 are hard errors — surface immediately
      if (resp.status === 401 || resp.status === 403) {
        const text = await safeText(resp);
        throw new Error(
          `Notion API ${resp.status}: the integration lacks access to this data source. ` +
          `Grant access via the Notion UI: open the DB → ••• → Connections → Add luke-notion. ` +
          `Raw response: ${text}`
        );
      }
      // 429/5xx after retry — partial return
      if (resp.status === 429 || resp.status >= 500) {
        partial = true;
        break;
      }
      // Other 4xx — hard error
      throw new Error(`Notion API ${resp.status}: ${await safeText(resp)}`);
    }

    const data = await resp.json();
    rows.push(...data.results);
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }

  return { rows, partial };
}

async function fetchWithRetry({ url, body, token, fetchImpl, retryDelayMs }) {
  const doFetch = () => fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const first = await doFetch();
  if (first.ok || (first.status !== 429 && first.status < 500)) return first;

  // Retry once
  if (retryDelayMs > 0) await new Promise(r => setTimeout(r, retryDelayMs));
  return doFetch();
}

async function safeText(resp) {
  try { return await resp.text(); } catch { return '(no body)'; }
}

import { writeFileSync } from 'node:fs';

// -------- MCP protocol subset --------
// Reference: https://modelcontextprotocol.io/specification

const SERVER_INFO = { name: 'luke-notion-dump', version: '0.2.0' };
const PROTOCOL_VERSION = '2024-11-05';

const TOOL_SCHEMA = {
  name: 'dump-data-source',
  description: 'Exhaustively paginate a Notion data source via the REST API. Returns all matching rows, beyond the hosted MCP\'s 100-row cap. Supports filter passthrough, count-only mode, and output-to-file for large dumps.',
  inputSchema: {
    type: 'object',
    required: ['data_source_id'],
    properties: {
      data_source_id: {
        type: 'string',
        description: 'Data source UUID (e.g., "b0d00fd8-eebb-434d-84c1-a652260fbe79") or collection:// URI. Multi-source database IDs are not supported in v0.2.0.',
      },
      filter: {
        type: 'object',
        description: 'Notion filter JSON (shape per /v1/data_sources/{id}/query — may differ slightly from legacy /v1/databases/{id}/query).',
      },
      count_only: {
        type: 'boolean',
        description: 'If true, paginate fully but return only the total count. Recommended when caller only needs a number and a 900-row payload would overflow context.',
      },
      output_path: {
        type: 'string',
        description: 'If set, write the flattened JSON array to this absolute path and return {count, path}. Recommended for dumps of >200 rows to keep the tool response small.',
      },
    },
  },
};

async function handleToolCall(args) {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return {
      content: [{
        type: 'text',
        text: 'NOTION_TOKEN is not set. Either run `/plugin install luke-notion@luke-plugins` to re-prompt (the plugin stores the token in macOS Keychain via userConfig), or export NOTION_TOKEN=ntn_... in your shell env as a fallback.',
      }],
      isError: true,
    };
  }

  let dataSourceId;
  try {
    dataSourceId = normalizeDataSourceId(args.data_source_id);
  } catch (e) {
    return { content: [{ type: 'text', text: e.message }], isError: true };
  }

  let rows, partial;
  try {
    const result = await paginateDataSource({
      dataSourceId,
      filter: args.filter ?? null,
      token,
    });
    rows = result.rows;
    partial = result.partial;
  } catch (e) {
    return { content: [{ type: 'text', text: e.message }], isError: true };
  }

  const flat = rows.map(p => ({
    id: p.id,
    url: p.url,
    created_time: p.created_time,
    last_edited_time: p.last_edited_time,
    ...Object.fromEntries(
      Object.entries(p.properties ?? {}).map(([k, v]) => [k, flattenProp(v)])
    ),
  }));
  const count = flat.length;

  // Response shape by caller flags
  if (args.count_only) {
    return { content: [{ type: 'text', text: JSON.stringify({ count, partial: partial || undefined }) }] };
  }
  if (args.output_path) {
    writeFileSync(args.output_path, JSON.stringify(flat, null, 2));
    return { content: [{ type: 'text', text: JSON.stringify({ count, path: args.output_path, partial: partial || undefined }) }] };
  }
  return { content: [{ type: 'text', text: JSON.stringify({ count, rows: flat, partial: partial || undefined }) }] };
}

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}
function respondError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

async function handleMessage(msg) {
  if (msg.method === 'initialize') {
    return respond(msg.id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
  }
  if (msg.method === 'notifications/initialized') {
    // No response for notifications
    return;
  }
  if (msg.method === 'tools/list') {
    return respond(msg.id, { tools: [TOOL_SCHEMA] });
  }
  if (msg.method === 'tools/call') {
    if (msg.params?.name !== 'dump-data-source') {
      return respondError(msg.id, -32601, `Unknown tool: ${msg.params?.name}`);
    }
    const result = await handleToolCall(msg.params.arguments ?? {});
    return respond(msg.id, result);
  }
  if (msg.method === 'ping') {
    return respond(msg.id, {});
  }
  // Unknown method
  respondError(msg.id, -32601, `Method not found: ${msg.method}`);
}

async function main() {
  let buffer = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', async chunk => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        await handleMessage(msg);
      } catch (e) {
        process.stderr.write(`Error handling message: ${e.message}\n`);
      }
    }
  });
  process.stdin.on('end', () => process.exit(0));
}

// Only run main() when invoked directly (not imported for tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
