import api, { route } from '@forge/api';
import { requestJson } from '../http';
import { quoteQueryString } from '../../utils/validation';
import type { RelatedDocument } from '../../types/domain';

interface ConfluenceSearchResult {
  content?: { id?: string; title?: string; type?: string };
  title?: string;
  excerpt?: string;
  url?: string;
  lastModified?: string;
  resultGlobalContainer?: { title?: string };
}

interface ConfluenceSearchResponse {
  results?: ConfluenceSearchResult[];
  _links?: { base?: string };
}

/**
 * Words that carry no search signal. Kept short on purpose: CQL `text ~` already ignores common
 * stop words; this only strips Jira-ticket boilerplate.
 */
const NOISE = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'for',
  'to',
  'of',
  'in',
  'on',
  'with',
  'is',
  'are',
  'be',
  'add',
  'fix',
  'update',
  'implement',
  'create',
  'make',
  'write',
  'new',
  'task',
  'bug',
  'story',
]);

/** Builds a short search phrase from an issue summary (max 5 meaningful words). */
export function searchTermsFromText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !NOISE.has(w))
    .slice(0, 5)
    .join(' ');
}

function cleanExcerpt(excerpt: string | undefined): string | undefined {
  if (!excerpt) return undefined;
  const text = excerpt
    .replace(/@@@(end)?hl@@@/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 220 ? `${text.slice(0, 217)}...` : text || undefined;
}

/**
 * CQL search over pages the user can see (GET /wiki/rest/api/search, scope `search:confluence`).
 * Runs `asUser()`. Requires the app to also be installed on the site's Confluence; when it isn't,
 * the request fails and callers report Confluence as unavailable.
 */
export async function searchConfluencePages(text: string, limit = 6): Promise<RelatedDocument[]> {
  const cql = `type = page AND text ~ ${quoteQueryString(text)} ORDER BY lastmodified DESC`;
  const res = await requestJson<ConfluenceSearchResponse>('Confluence search', () =>
    api
      .asUser()
      .requestConfluence(route`/wiki/rest/api/search?cql=${cql}&limit=${limit}&excerpt=indexed`, {
        headers: { Accept: 'application/json' },
      }),
  );
  const base = res._links?.base ?? '';
  const docs: RelatedDocument[] = [];
  for (const r of res.results ?? []) {
    const title = r.content?.title ?? r.title;
    if (!title || !r.url) continue;
    docs.push({
      title,
      url: /^https?:\/\//.test(r.url) ? r.url : `${base}${r.url}`,
      excerpt: cleanExcerpt(r.excerpt),
      space: r.resultGlobalContainer?.title,
      lastModified: r.lastModified,
      via: 'confluence_search',
    });
  }
  return docs;
}
