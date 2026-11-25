import { CalendarClock } from 'lucide-react';
import type { WorkItem } from '../services/api';
import { Avatar, IssueKeyLink, PriorityIndicator, StatusLozenge } from './ui';

export function WorkItemRow({
  item,
  showAssignee = false,
}: {
  item: WorkItem;
  showAssignee?: boolean;
}) {
  return (
    <li className="work-row">
      <div className="work-main">
        <IssueKeyLink issueKey={item.key} url={item.url} />
        <span className="work-summary" title={item.summary}>
          {item.summary}
        </span>
      </div>
      <div className="work-meta">
        {item.isOverdue && (
          <span className="overdue" title={`Due ${item.dueDate?.slice(0, 10)}`}>
            <CalendarClock size={13} aria-hidden /> Overdue
          </span>
        )}
        {item.project?.key && <span className="muted project-tag">{item.project.key}</span>}
        <PriorityIndicator priority={item.priority} />
        <StatusLozenge status={item.status} category={item.statusCategory} />
        {showAssignee && item.assignee && (
          <span className="assignee" title={item.assignee.displayName}>
            <Avatar name={item.assignee.displayName} size="sm" />
          </span>
        )}
      </div>
    </li>
  );
}

export function WorkItemList({
  items,
  showAssignee,
}: {
  items: WorkItem[];
  showAssignee?: boolean;
}) {
  return (
    <ul className="work-list">
      {items.map((item) => (
        <WorkItemRow key={item.key} item={item} showAssignee={showAssignee} />
      ))}
    </ul>
  );
}
