import { Lightbulb } from 'lucide-react';
import type { MyWorkResult } from '../services/api';
import { EmptyState, IssueKeyLink, Notes, SourceBadges } from './ui';
import { WorkItemList } from './WorkItemList';

export function MyWorkContent({ data, max = 25 }: { data: MyWorkResult; max?: number }) {
  if (data.items.length === 0) {
    return (
      <>
        <EmptyState title="No open issues assigned to you">
          Nothing in Jira is currently assigned to you and not done.
        </EmptyState>
        <SourceBadges sources={data.sources} />
      </>
    );
  }
  const shown = data.items.slice(0, max);
  const hidden = data.totals.open - shown.length;
  return (
    <>
      <WorkItemList items={shown} />
      {hidden > 0 && <p className="muted small more">+{hidden} more open issues</p>}
      <Notes notes={data.notes} />
      <SourceBadges sources={data.sources} />
    </>
  );
}

/** The focus list is a deterministic suggestion; the UI labels it that way and shows the reasons. */
export function FocusContent({ data }: { data: MyWorkResult }) {
  if (data.suggestedFocus.length === 0) {
    return <EmptyState title="Nothing to prioritise">You have no open assigned work.</EmptyState>;
  }
  return (
    <>
      <p className="suggestion-label">
        <Lightbulb size={14} aria-hidden /> Suggestion, based on due dates, priority and status
      </p>
      <ol className="focus-list">
        {data.suggestedFocus.map((f) => (
          <li key={f.key}>
            <div className="focus-title">
              <IssueKeyLink issueKey={f.key} url={f.url} />
              <span className="work-summary">{f.summary}</span>
            </div>
            <div className="focus-reasons">
              {f.reasons.map((r) => (
                <span key={r} className="chip">
                  {r}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
