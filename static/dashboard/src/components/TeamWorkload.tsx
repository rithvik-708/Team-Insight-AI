import { Flame, Info, UserMinus } from 'lucide-react';
import type { MemberWorkload, TeamRef, TeamWorkloadResult } from '../services/api';
import { Avatar, EmptyState, ExternalAnchor, Notes, SourceBadges } from './ui';
import { WorkItemList } from './WorkItemList';

function MemberBar({ member, max }: { member: MemberWorkload; max: number }) {
  const pct = (n: number) => (max > 0 ? (n / max) * 100 : 0);
  const other = member.openCount - member.inProgressCount - member.todoCount;
  return (
    <li className="member-row">
      <div className="member-name">
        <Avatar name={member.displayName} size="sm" />
        <span title={member.displayName}>{member.displayName}</span>
        {member.loadFlag === 'high' && (
          <span className="flag flag-high" title="Well above the team average">
            <Flame size={12} aria-hidden /> High
          </span>
        )}
        {member.loadFlag === 'none' && (
          <span className="flag flag-none" title="No open assigned issues">
            <UserMinus size={12} aria-hidden /> None
          </span>
        )}
      </div>
      <div
        className="bar"
        role="img"
        aria-label={`${member.openCount} open: ${member.inProgressCount} in progress, ${member.todoCount} to do`}
      >
        {/* Width is set through the CSSOM (style prop), which Forge's CSP allows. */}
        <span
          className="bar-seg seg-progress"
          style={{ width: `${pct(member.inProgressCount)}%` }}
        />
        <span className="bar-seg seg-todo" style={{ width: `${pct(member.todoCount)}%` }} />
        {other > 0 && <span className="bar-seg seg-other" style={{ width: `${pct(other)}%` }} />}
      </div>
      <span className="member-count">{member.openCount}</span>
    </li>
  );
}

export function TeamSelectionList({
  teams,
  onSelect,
}: {
  teams: TeamRef[];
  onSelect?: (team: TeamRef) => void;
}) {
  return (
    <ul className="team-choices">
      {teams.map((t) => (
        <li key={t.id}>
          {onSelect ? (
            <button type="button" className="btn btn-subtle" onClick={() => onSelect(t)}>
              {t.name}
            </button>
          ) : (
            <span>{t.name}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function TeamWorkloadContent({
  data,
  onSelectTeam,
}: {
  data: TeamWorkloadResult;
  onSelectTeam?: (team: TeamRef) => void;
}) {
  if (data.status === 'needs_team_selection') {
    return (
      <>
        <p>{data.message}</p>
        <TeamSelectionList teams={data.teams} onSelect={onSelectTeam} />
        <SourceBadges sources={data.sources} />
      </>
    );
  }
  if (data.status === 'no_team') {
    return (
      <>
        <EmptyState title="No team found">{data.message}</EmptyState>
        {data.teams.length > 0 && <TeamSelectionList teams={data.teams} onSelect={onSelectTeam} />}
        <SourceBadges sources={data.sources} />
      </>
    );
  }

  const max = Math.max(1, ...data.members.map((m) => m.openCount));
  const scopeName =
    data.scope.kind === 'team' ? data.scope.team.name : `Project ${data.scope.project.key}`;
  const distribution = Object.entries(data.totals.statusDistribution).sort((a, b) => b[1] - a[1]);

  return (
    <div className="team">
      <div className="team-summary">
        <div>
          <p className="team-name">
            {scopeName}
            {data.scope.kind === 'team' && data.scope.team.url && (
              <ExternalAnchor url={data.scope.team.url}>Team profile</ExternalAnchor>
            )}
          </p>
          <p className="muted small">
            {data.totals.open} open issues across {data.totals.members} people · average{' '}
            {data.totals.averagePerMember}
            {data.totals.unassignedOpen ? ` · ${data.totals.unassignedOpen} unassigned` : ''}
          </p>
        </div>
        <div className="legend" aria-hidden>
          <span>
            <i className="swatch seg-progress" />
            In progress
          </span>
          <span>
            <i className="swatch seg-todo" />
            To do
          </span>
        </div>
      </div>

      {data.members.length === 0 ? (
        <EmptyState title="No visible members" />
      ) : (
        <ul className="member-list">
          {data.members.map((m) => (
            <MemberBar key={m.accountId} member={m} max={max} />
          ))}
        </ul>
      )}

      {distribution.length > 0 && (
        <div className="distribution">
          {distribution.map(([status, count]) => (
            <span key={status} className="chip">
              {status} <strong>{count}</strong>
            </span>
          ))}
        </div>
      )}

      {data.topPriorityItems.length > 0 && (
        <>
          <h3 className="subheading">High priority and overdue</h3>
          <WorkItemList items={data.topPriorityItems} showAssignee />
        </>
      )}

      <p className="disclaimer">
        <Info size={13} aria-hidden /> {data.disclaimer}
      </p>
      <Notes notes={data.notes} />
      <SourceBadges sources={data.sources} />
    </div>
  );
}
