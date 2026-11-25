import { useEffect, useState } from 'react';
import { view } from '@forge/bridge';
import { Bot, FileText, RefreshCw } from 'lucide-react';
import { api, askRovo, isRovoEnabled } from './services/api';
import { useAsync } from './hooks/useAsync';
import { AskPanel } from './components/AskPanel';
import {
  FocusCard,
  IssueLookupCard,
  IssueTabs,
  MyWorkCard,
  StatTiles,
  TeamCard,
} from './components/Sections';
import { DocsContent } from './components/IssueContext';
import { ErrorState, LoadingRows } from './components/ui';

const SUGGESTIONS = [
  'What am I working on?',
  'What should I focus on next?',
  'What is my team working on?',
  'Which issues are blocked?',
];

interface ForgeContext {
  moduleKey?: string;
  extension?: { type?: string; issue?: { key?: string } };
}

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="7" className="logo-bg" />
      <circle cx="10" cy="11" r="3.2" fill="#fff" />
      <circle cx="22" cy="11" r="3.2" fill="#fff" />
      <circle cx="16" cy="22" r="3.2" fill="#fff" />
      <path
        d="M10 11 L22 11 M10 11 L16 22 M22 11 L16 22"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StatusPills({ rovoEnabled }: { rovoEnabled: boolean | undefined }) {
  const status = useAsync(() => api.getStatus(), []);
  const graph = status.data?.teamworkGraph.status;
  const graphClass = status.loading
    ? 'pill-pending'
    : graph === 'connected'
      ? 'pill-ok'
      : 'pill-warn';
  const graphText = status.loading
    ? 'Checking…'
    : graph === 'connected'
      ? 'Connected'
      : graph === 'degraded'
        ? 'Degraded'
        : 'Unavailable';
  return (
    <div className="pills">
      <span
        className={`pill ${graphClass}`}
        title={status.data?.teamworkGraph.detail ?? status.error?.message}
      >
        <span className="pill-dot" aria-hidden /> Teamwork Graph: {graphText}
      </span>
      <span
        className={`pill ${rovoEnabled === undefined ? 'pill-pending' : rovoEnabled ? 'pill-ok' : 'pill-warn'}`}
      >
        <span className="pill-dot" aria-hidden /> Rovo:{' '}
        {rovoEnabled === undefined ? 'Checking…' : rovoEnabled ? 'Enabled' : 'Not enabled'}
      </span>
    </div>
  );
}

function Dashboard({ rovoEnabled }: { rovoEnabled: boolean | undefined }) {
  const myWork = useAsync(() => api.getMyWork(), []);
  const [teamOpen, setTeamOpen] = useState<number | undefined>();

  return (
    <div className="page">
      <header className="app-header">
        <div className="brand">
          <Logo />
          <div>
            <h1>Teamwork Insight</h1>
            <p className="muted">
              Your work, your team and the context around it, from Jira and Teamwork Graph.
            </p>
          </div>
        </div>
        <div className="header-right">
          <StatusPills rovoEnabled={rovoEnabled} />
          <button
            type="button"
            className="btn btn-subtle btn-sm"
            onClick={myWork.reload}
            aria-label="Refresh my work"
          >
            <RefreshCw size={14} aria-hidden /> Refresh
          </button>
          {rovoEnabled && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void askRovo()}>
              <Bot size={14} aria-hidden /> Ask Context Guide
            </button>
          )}
        </div>
      </header>

      <StatTiles myWork={myWork} teamOpen={teamOpen} />

      <div className="grid">
        <MyWorkCard state={myWork} />
        <AskPanel suggestions={SUGGESTIONS} rovoEnabled={!!rovoEnabled} />
        <TeamCard onTotal={setTeamOpen} />
        <div className="stack">
          <FocusCard state={myWork} />
          <IssueLookupCard />
        </div>
      </div>
    </div>
  );
}

/** Compact view rendered in the Jira issue view (jira:issueContext). */
function IssuePanel({
  issueKey,
  rovoEnabled,
}: {
  issueKey: string;
  rovoEnabled: boolean | undefined;
}) {
  const [tab, setTab] = useState<'people' | 'related'>('people');
  const [showDocs, setShowDocs] = useState(false);
  const ctx = useAsync(() => api.getIssueContext(issueKey), [issueKey]);
  const docs = useAsync(() => api.getRelatedDocs({ issueKey }), [issueKey, showDocs], showDocs);

  return (
    <div className="panel">
      {ctx.loading && <LoadingRows rows={4} label="Loading issue context" />}
      {ctx.error && <ErrorState error={ctx.error} onRetry={ctx.reload} />}
      {ctx.data && (
        <IssueTabs tab={tab} onTab={setTab} people={ctx.data.people} related={ctx.data.related} />
      )}
      <div className="panel-actions">
        {!showDocs && (
          <button type="button" className="btn btn-subtle btn-sm" onClick={() => setShowDocs(true)}>
            <FileText size={14} aria-hidden /> Find related docs
          </button>
        )}
        {rovoEnabled && (
          <button
            type="button"
            className="btn btn-subtle btn-sm"
            onClick={() =>
              void askRovo(`Who is involved in ${issueKey} and what work is related to it?`)
            }
          >
            <Bot size={14} aria-hidden /> Ask Rovo about {issueKey}
          </button>
        )}
      </div>
      {showDocs && docs.loading && <LoadingRows rows={2} label="Searching documents" />}
      {showDocs && docs.error && <ErrorState error={docs.error} onRetry={docs.reload} />}
      {showDocs && docs.data && <DocsContent data={{ ...docs.data, issue: undefined }} />}
    </div>
  );
}

export default function App() {
  const [context, setContext] = useState<ForgeContext | null>(null);
  const [rovoEnabled, setRovoEnabled] = useState<boolean | undefined>();

  useEffect(() => {
    view
      .getContext()
      .then((c) => setContext(c as ForgeContext))
      .catch(() => setContext({}));
    isRovoEnabled().then(setRovoEnabled);
  }, []);

  if (!context) return <LoadingRows rows={3} label="Starting Teamwork Insight" />;

  const issueKey = context.extension?.issue?.key;
  if (context.extension?.type === 'jira:issueContext' && issueKey) {
    return <IssuePanel issueKey={issueKey} rovoEnabled={rovoEnabled} />;
  }
  return <Dashboard rovoEnabled={rovoEnabled} />;
}
