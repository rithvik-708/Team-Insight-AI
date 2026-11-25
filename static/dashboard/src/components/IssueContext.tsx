import type { ReactNode } from 'react';
import { Ban, FileText, GitBranch, Link2 } from 'lucide-react';
import type {
  BlockedWorkResult,
  IssuePeopleResult,
  IssueSummary,
  RelatedDocsResult,
  RelatedIssue,
  RelatedWorkResult,
} from '../services/api';
import {
  Avatar,
  EmptyState,
  ExternalAnchor,
  IssueKeyLink,
  Notes,
  PriorityIndicator,
  SourceBadges,
  StatusLozenge,
} from './ui';
import { WorkItemList } from './WorkItemList';

export function IssueHeading({ issue }: { issue: IssueSummary }) {
  return (
    <div className="issue-heading">
      <div className="work-main">
        <IssueKeyLink issueKey={issue.key} url={issue.url} />
        <span className="issue-title">{issue.summary}</span>
      </div>
      <div className="work-meta">
        {issue.issueType && <span className="muted small">{issue.issueType}</span>}
        <PriorityIndicator priority={issue.priority} />
        <StatusLozenge status={issue.status} category={issue.statusCategory} />
      </div>
    </div>
  );
}

function PersonLine({ label, name, hint }: { label: string; name?: string; hint?: string }) {
  return (
    <div className="person-line">
      <span className="person-label">{label}</span>
      {name ? (
        <span className="person">
          <Avatar name={name} size="sm" />
          {name}
          {hint && <span className="muted small"> · {hint}</span>}
        </span>
      ) : (
        <span className="muted">{label === 'Assignee' ? 'Unassigned' : 'Not available'}</span>
      )}
    </div>
  );
}

export function PeopleContent({
  data,
  showHeading = true,
}: {
  data: IssuePeopleResult;
  showHeading?: boolean;
}) {
  return (
    <div className="stack">
      {showHeading && <IssueHeading issue={data.issue} />}
      <div className="people-grid">
        <PersonLine label="Assignee" name={data.assignee?.displayName} hint="owner" />
        <PersonLine label="Reporter" name={data.reporter?.displayName} />
        {data.creator && <PersonLine label="Creator" name={data.creator.displayName} />}
        <div className="person-line">
          <span className="person-label">Watchers</span>
          {data.watchers.status === 'ok' ? (
            <span>{data.watchers.count ?? 0}</span>
          ) : (
            <span className="muted">Not visible to you</span>
          )}
        </div>
      </div>

      {data.commenters.length > 0 && (
        <div>
          <h3 className="subheading">In the discussion</h3>
          <ul className="chip-list">
            {data.commenters.slice(0, 8).map((c) => (
              <li key={c.accountId ?? c.displayName} className="chip person-chip">
                <Avatar name={c.displayName} size="sm" />
                {c.displayName}
                <span className="muted small">{c.commentCount}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">Commenting does not imply responsibility for the issue.</p>
        </div>
      )}

      {data.teams.length > 0 && (
        <div>
          <h3 className="subheading">Teams linked to this project</h3>
          <ul className="chip-list">
            {data.teams.map((t) => (
              <li key={t.id} className="chip">
                {t.url ? <ExternalAnchor url={t.url}>{t.name}</ExternalAnchor> : t.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.suggestedContacts.length > 0 && (
        <div>
          <h3 className="subheading">Who to contact</h3>
          <ul className="contact-list">
            {data.suggestedContacts.map((c) => (
              <li key={c.accountId ?? c.displayName}>
                <Avatar name={c.displayName} size="sm" />
                <div>
                  <strong>{c.displayName}</strong>
                  <p className="muted small">{c.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Notes notes={data.notes} />
      <SourceBadges sources={data.sources} />
    </div>
  );
}

function RelatedRow({ rel }: { rel: RelatedIssue }) {
  return (
    <li className="work-row">
      <div className="work-main">
        <span className="relationship">{rel.relationship}</span>
        <IssueKeyLink issueKey={rel.key} url={rel.url} />
        <span className="work-summary" title={rel.summary}>
          {rel.summary}
        </span>
      </div>
      <div className="work-meta">
        <PriorityIndicator priority={rel.priority} />
        <StatusLozenge status={rel.status} category={rel.statusCategory} />
      </div>
    </li>
  );
}

export function RelatedContent({
  data,
  showHeading = true,
}: {
  data: RelatedWorkResult;
  showHeading?: boolean;
}) {
  const otherLinks = data.links.filter(
    (l) => !data.blockedBy.includes(l) && !data.blocks.includes(l),
  );
  const hasAny =
    data.parent || data.children.length || data.links.length || data.remoteLinks.length;
  return (
    <div className="stack">
      {showHeading && <IssueHeading issue={data.issue} />}
      {data.isBlocked && (
        <div className="callout callout-warning">
          <Ban size={16} aria-hidden /> Blocked by{' '}
          {data.blockedBy.filter((b) => b.statusCategory !== 'done').length} unresolved issue(s)
        </div>
      )}
      {!hasAny && (
        <EmptyState title="No related work">
          This issue has no parent, children or links.
        </EmptyState>
      )}
      {data.blockedBy.length > 0 && (
        <Group icon={<Ban size={14} />} title="Blocked by" items={data.blockedBy} />
      )}
      {data.blocks.length > 0 && (
        <Group icon={<Ban size={14} />} title="Blocks" items={data.blocks} />
      )}
      {data.parent && <Group icon={<GitBranch size={14} />} title="Parent" items={[data.parent]} />}
      {data.children.length > 0 && (
        <Group
          icon={<GitBranch size={14} />}
          title={`Children (${data.children.length})`}
          items={data.children}
        />
      )}
      {otherLinks.length > 0 && (
        <Group icon={<Link2 size={14} />} title="Linked issues" items={otherLinks} />
      )}
      {data.remoteLinks.length > 0 && (
        <div>
          <h3 className="subheading">
            <Link2 size={14} aria-hidden /> Web links
          </h3>
          <ul className="doc-list">
            {data.remoteLinks.map((l) => (
              <li key={l.url}>
                <ExternalAnchor url={l.url}>{l.title}</ExternalAnchor>
                {l.application && <span className="muted small"> · {l.application}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Notes notes={data.notes} />
      <SourceBadges sources={data.sources} />
    </div>
  );
}

function Group({ icon, title, items }: { icon: ReactNode; title: string; items: RelatedIssue[] }) {
  return (
    <div>
      <h3 className="subheading">
        {icon} {title}
      </h3>
      <ul className="work-list">
        {items.map((r) => (
          <RelatedRow key={`${r.relationship}-${r.key}`} rel={r} />
        ))}
      </ul>
    </div>
  );
}

export function DocsContent({ data }: { data: RelatedDocsResult }) {
  const linked = data.documents.filter((d) => d.via === 'jira_remote_link');
  const found = data.documents.filter((d) => d.via === 'confluence_search');
  return (
    <div className="stack">
      {data.issue && <IssueHeading issue={data.issue} />}
      {data.documents.length === 0 && (
        <EmptyState title="No documents found">
          {data.query
            ? `Nothing matched "${data.query}".`
            : 'No documents are linked to this issue.'}
        </EmptyState>
      )}
      {linked.length > 0 && <DocGroup title="Linked from the issue" docs={linked} />}
      {found.length > 0 && (
        <DocGroup title={`Possibly related (search: "${data.query}")`} docs={found} />
      )}
      <Notes notes={data.notes} />
      <SourceBadges sources={data.sources} />
    </div>
  );
}

function DocGroup({ title, docs }: { title: string; docs: RelatedDocsResult['documents'] }) {
  return (
    <div>
      <h3 className="subheading">
        <FileText size={14} aria-hidden /> {title}
      </h3>
      <ul className="doc-list">
        {docs.map((d) => (
          <li key={d.url}>
            <ExternalAnchor url={d.url}>{d.title}</ExternalAnchor>
            {d.space && <span className="muted small"> · {d.space}</span>}
            {d.excerpt && <p className="muted small excerpt">{d.excerpt}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BlockedContent({ data }: { data: BlockedWorkResult }) {
  if (data.items.length === 0) {
    return (
      <>
        <EmptyState title="Nothing is blocked">
          {data.scope.kind === 'project'
            ? `No open issues in ${data.scope.projectKey} have "is blocked by" links.`
            : 'None of your open issues have "is blocked by" links.'}
        </EmptyState>
        <SourceBadges sources={data.sources} />
      </>
    );
  }
  return (
    <div className="stack">
      {data.items.map((item) => (
        <div key={item.key} className="blocked-item">
          <WorkItemList items={[item]} />
          <ul className="blocker-list">
            {item.blockers.map((b) => (
              <li key={b.key}>
                <span className="relationship">blocked by</span>
                <IssueKeyLink issueKey={b.key} url={b.url} />
                <span className="work-summary">{b.summary}</span>
                <StatusLozenge status={b.status} category={b.statusCategory} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      <Notes notes={data.notes} />
      <SourceBadges sources={data.sources} />
    </div>
  );
}
