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
    case 'rollup':            return v.rollup?.[v.rollup.type] ?? null;
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
