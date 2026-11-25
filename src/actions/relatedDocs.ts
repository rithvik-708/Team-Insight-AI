import { getSiteUrl } from '../services/jira/client';
import { getIssueRemoteLinks, toIssueSummary } from '../services/jira/issues';
import { searchConfluencePages, searchTermsFromText } from '../services/confluence/search';
import { AppError, describeFailure } from '../utils/errors';
import { loadIssueDetail } from './shared';
import type {
  IssueSummary,
  RelatedDocument,
  RelatedDocsResult,
  SourceReport,
} from '../types/domain';

/**
 * "Are there documents related to this feature?"
 * 1. Documents explicitly linked from the Jira issue (remote links). These are facts.
 * 2. Confluence pages matching the issue summary or a free-text query (CQL search). These are
 *    search matches, so they are labelled `confluence_search` and presented as "possibly related".
 * Confluence is optional: if it is unavailable the action still returns the linked documents.
 */
export async function relatedDocs(input: {
  issueKey?: string;
  query?: string;
}): Promise<RelatedDocsResult> {
  if (!input.issueKey && !input.query) {
    throw new AppError(
      'INVALID_INPUT',
      'Provide an issue key or a search phrase to find related documents.',
    );
  }
  const sources: SourceReport[] = [];
  const notes: string[] = [];
  const documents: RelatedDocument[] = [];
  let issue: IssueSummary | undefined;
  let searchText = input.query;

  if (input.issueKey) {
    const [raw, siteUrl, links] = await Promise.all([
      loadIssueDetail(input.issueKey),
      getSiteUrl(),
      getIssueRemoteLinks(input.issueKey).catch((err: unknown) => {
        sources.push({
          source: 'jira',
          purpose: 'documents linked to the issue',
          status: 'error',
          detail: describeFailure(err),
        });
        return [];
      }),
    ]);
    issue = toIssueSummary(raw, siteUrl);
    for (const link of links) {
      const url = link.object?.url;
      if (!url || !/^https?:\/\//i.test(url)) continue;
      documents.push({
        title: link.object?.title ?? url,
        url,
        excerpt: link.object?.summary,
        space: link.application?.name,
        via: 'jira_remote_link',
      });
    }
    if (!sources.some((s) => s.purpose === 'documents linked to the issue')) {
      sources.push({
        source: 'jira',
        purpose: 'documents linked to the issue',
        status: documents.length > 0 ? 'ok' : 'empty',
      });
    }
    searchText = searchText ?? searchTermsFromText(issue.summary);
  }

  if (searchText) {
    try {
      const linkedUrls = new Set(documents.map((d) => d.url));
      const found = await searchConfluencePages(searchText);
      for (const doc of found) if (!linkedUrls.has(doc.url)) documents.push(doc);
      sources.push({
        source: 'confluence',
        purpose: `page search for "${searchText}"`,
        status: found.length > 0 ? 'ok' : 'empty',
      });
    } catch (err) {
      sources.push({
        source: 'confluence',
        purpose: 'page search',
        status: 'unavailable',
        detail: describeFailure(err),
      });
      notes.push(
        "Confluence search is unavailable. The app may not be installed on this site's Confluence, or you may not have access.",
      );
    }
  }

  return { query: searchText, issue, documents, sources, notes };
}
