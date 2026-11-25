import { useState, type FormEvent } from 'react';
import {
  AlertOctagon,
  ArrowUpCircle,
  CircleDot,
  ClipboardList,
  Lightbulb,
  Search,
  Users,
  UsersRound,
} from 'lucide-react';
import { api, type MyWorkResult, type TeamRef } from '../services/api';
import { useAsync } from '../hooks/useAsync';
import { Card, EmptyState, ErrorState, LoadingRows } from './ui';
import { FocusContent, MyWorkContent } from './MyWork';
import { TeamWorkloadContent } from './TeamWorkload';
import { PeopleContent, RelatedContent } from './IssueContext';
import type { AsyncState } from '../hooks/useAsync';

export function StatTiles({
  myWork,
  teamOpen,
}: {
  myWork: AsyncState<MyWorkResult>;
  teamOpen?: number;
}) {
  const t = myWork.data?.totals;
  const tiles = [
    {
      label: 'My open issues',
      value: t?.open,
      icon: <ClipboardList size={16} />,
      tone: 'tile-blue',
    },
    {
      label: 'High priority',
      value: t?.highPriority,
      icon: <ArrowUpCircle size={16} />,
      tone: 'tile-orange',
    },
    { label: 'Overdue', value: t?.overdue, icon: <AlertOctagon size={16} />, tone: 'tile-red' },
    {
      label: 'In progress',
      value: t?.inProgress,
      icon: <CircleDot size={16} />,
      tone: 'tile-teal',
    },
    {
      label: 'Team open issues',
      value: teamOpen,
      icon: <UsersRound size={16} />,
      tone: 'tile-purple',
    },
  ];
  return (
    <div className="tiles">
      {tiles.map((tile) => (
        <div key={tile.label} className={`tile ${tile.tone}`}>
          <span className="tile-icon" aria-hidden>
            {tile.icon}
          </span>
          <span className="tile-value">
            {myWork.loading && tile.value === undefined ? (
              <span className="skeleton skeleton-num" />
            ) : (
              (tile.value ?? '–')
            )}
          </span>
          <span className="tile-label">{tile.label}</span>
        </div>
      ))}
    </div>
  );
}

export function MyWorkCard({ state }: { state: AsyncState<MyWorkResult> }) {
  return (
    <Card title="My work" icon={<ClipboardList size={16} aria-hidden />} className="span-2">
      {state.loading && !state.data && <LoadingRows rows={5} label="Loading your work" />}
      {state.error && <ErrorState error={state.error} onRetry={state.reload} />}
      {state.data && <MyWorkContent data={state.data} max={12} />}
    </Card>
  );
}

export function FocusCard({ state }: { state: AsyncState<MyWorkResult> }) {
  return (
    <Card title="Suggested focus" icon={<Lightbulb size={16} aria-hidden />}>
      {state.loading && !state.data && <LoadingRows rows={3} />}
      {state.error && <ErrorState error={state.error} onRetry={state.reload} />}
      {state.data && <FocusContent data={state.data} />}
    </Card>
  );
}

export function TeamCard({ onTotal }: { onTotal: (n: number | undefined) => void }) {
  const [scope, setScope] = useState<{ teamId?: string; projectKey?: string }>({});
  const [projectInput, setProjectInput] = useState('');
  const [knownTeams, setKnownTeams] = useState<TeamRef[]>([]);

  const state = useAsync(async () => {
    const result = await api.getTeamWorkload(scope);
    if (result.status !== 'ok' && result.teams.length > 0) setKnownTeams(result.teams);
    onTotal(result.status === 'ok' ? result.totals.open : undefined);
    return result;
  }, [scope.teamId, scope.projectKey]);

  const onProject = (e: FormEvent) => {
    e.preventDefault();
    const key = projectInput.trim().toUpperCase();
    if (key) setScope({ projectKey: key });
  };

  return (
    <Card
      title="Team workload"
      icon={<Users size={16} aria-hidden />}
      className="span-2"
      actions={
        <div className="team-controls">
          {knownTeams.length > 1 && (
            <select
              className="select"
              aria-label="Choose team"
              value={scope.teamId ?? ''}
              onChange={(e) => setScope(e.target.value ? { teamId: e.target.value } : {})}
            >
              <option value="">Choose a team…</option>
              {knownTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <form onSubmit={onProject} className="inline-form">
            <input
              className="input input-sm"
              aria-label="Project key"
              placeholder="Project key"
              value={projectInput}
              maxLength={20}
              onChange={(e) => setProjectInput(e.target.value)}
            />
            <button type="submit" className="btn btn-subtle btn-sm">
              View project
            </button>
          </form>
        </div>
      }
    >
      {state.loading && <LoadingRows rows={4} label="Loading team workload" />}
      {!state.loading && state.error && <ErrorState error={state.error} onRetry={state.reload} />}
      {!state.loading && state.data && (
        <TeamWorkloadContent data={state.data} onSelectTeam={(t) => setScope({ teamId: t.id })} />
      )}
    </Card>
  );
}

export function IssueLookupCard({ initialKey }: { initialKey?: string }) {
  const [input, setInput] = useState(initialKey ?? '');
  const [issueKey, setIssueKey] = useState(initialKey);
  const [tab, setTab] = useState<'people' | 'related'>('people');
  const state = useAsync(() => api.getIssueContext(issueKey!), [issueKey], !!issueKey);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const key = input.trim().toUpperCase();
    if (key) setIssueKey(key);
  };

  return (
    <Card title="Issue context" icon={<Search size={16} aria-hidden />}>
      <form className="ask-form" onSubmit={onSubmit}>
        <label htmlFor="issue-key" className="sr-only">
          Issue key
        </label>
        <input
          id="issue-key"
          className="input"
          placeholder="Issue key, e.g. MKT-21"
          value={input}
          maxLength={40}
          onChange={(e) => setInput(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!input.trim()}>
          Look up
        </button>
      </form>
      {!issueKey && (
        <EmptyState title="Look up any issue">
          See who is involved and how it connects to other work.
        </EmptyState>
      )}
      {issueKey && state.loading && <LoadingRows rows={4} label="Loading issue context" />}
      {issueKey && !state.loading && state.error && (
        <ErrorState error={state.error} onRetry={state.reload} />
      )}
      {issueKey && !state.loading && state.data && (
        <IssueTabs
          tab={tab}
          onTab={setTab}
          people={state.data.people}
          related={state.data.related}
        />
      )}
    </Card>
  );
}

export function IssueTabs({
  tab,
  onTab,
  people,
  related,
}: {
  tab: 'people' | 'related';
  onTab: (t: 'people' | 'related') => void;
  people: Parameters<typeof PeopleContent>[0]['data'];
  related: Parameters<typeof RelatedContent>[0]['data'];
}) {
  const relatedCount = related.links.length + related.children.length + (related.parent ? 1 : 0);
  return (
    <div className="stack">
      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'people'}
          className={`tab ${tab === 'people' ? 'tab-active' : ''}`}
          onClick={() => onTab('people')}
        >
          People
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'related'}
          className={`tab ${tab === 'related' ? 'tab-active' : ''}`}
          onClick={() => onTab('related')}
        >
          Related work {relatedCount > 0 && <span className="count">{relatedCount}</span>}
        </button>
      </div>
      {tab === 'people' ? <PeopleContent data={people} /> : <RelatedContent data={related} />}
    </div>
  );
}
