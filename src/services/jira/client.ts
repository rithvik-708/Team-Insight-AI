import api, { route } from '@forge/api';
import { requestJson } from '../http';
import type { JiraServerInfo } from '../../types/jira';

type Route = ReturnType<typeof route>;

/**
 * All Jira calls run as the invoking user (`asUser`) so results honour that user's Jira
 * permissions. Never switch these to `asApp()`.
 */
export function jiraGet<T>(path: Route, label: string): Promise<T> {
  return requestJson<T>(label, () =>
    api.asUser().requestJira(path, { headers: { Accept: 'application/json' } }),
  );
}

let cachedSiteInfo: Promise<JiraServerInfo> | undefined;

/**
 * Site base URL (for browse links) and the linked Confluence URL. Cached per warm runtime
 * instance; a failure is not cached so the next invocation retries.
 */
export function getSiteInfo(): Promise<JiraServerInfo> {
  if (!cachedSiteInfo) {
    cachedSiteInfo = jiraGet<JiraServerInfo>(route`/rest/api/3/serverInfo`, 'Jira site info').catch(
      (err) => {
        cachedSiteInfo = undefined;
        throw err;
      },
    );
  }
  return cachedSiteInfo;
}

export async function getSiteUrl(): Promise<string | undefined> {
  try {
    const info = await getSiteInfo();
    return info.displayUrl ?? info.baseUrl;
  } catch {
    // Links are a convenience; callers still return data without them.
    return undefined;
  }
}

/** Test hook: clears the per-instance cache. */
export function resetSiteInfoCache(): void {
  cachedSiteInfo = undefined;
}
