import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronsUp,
  Equal,
  ExternalLink,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import { ApiError, openLink, type SourceReport, type StatusCategory } from '../services/api';

export function Card({
  title,
  icon,
  actions,
  children,
  className = '',
  footer,
}: {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-header">
          <h2 className="card-title">
            {icon}
            {title}
          </h2>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className="card-body">{children}</div>
      {footer && <footer className="card-footer">{footer}</footer>}
    </section>
  );
}

const CATEGORY_CLASS: Record<StatusCategory, string> = {
  todo: 'lozenge-default',
  in_progress: 'lozenge-inprogress',
  done: 'lozenge-success',
  unknown: 'lozenge-default',
};

export function StatusLozenge({ status, category }: { status: string; category: StatusCategory }) {
  return <span className={`lozenge ${CATEGORY_CLASS[category]}`}>{status}</span>;
}

export function PriorityIndicator({ priority }: { priority?: string }) {
  if (!priority) return null;
  const p = priority.toLowerCase();
  let icon = <Equal size={14} aria-hidden />;
  let tone = 'prio-medium';
  if (['highest', 'blocker', 'critical'].includes(p)) {
    icon = <ChevronsUp size={14} aria-hidden />;
    tone = 'prio-highest';
  } else if (['high', 'major'].includes(p)) {
    icon = <ArrowUp size={14} aria-hidden />;
    tone = 'prio-high';
  } else if (['low', 'lowest', 'minor', 'trivial'].includes(p)) {
    icon = <ArrowDown size={14} aria-hidden />;
    tone = 'prio-low';
  }
  return (
    <span className={`priority ${tone}`} title={`Priority: ${priority}`}>
      {icon}
      <span className="priority-label">{priority}</span>
    </span>
  );
}

export function IssueKeyLink({ issueKey, url }: { issueKey: string; url?: string }) {
  if (!url) return <span className="issue-key">{issueKey}</span>;
  return (
    <a
      className="issue-key"
      href={url}
      onClick={(e) => {
        e.preventDefault();
        openLink(url);
      }}
    >
      {issueKey}
    </a>
  );
}

export function ExternalAnchor({ url, children }: { url: string; children: ReactNode }) {
  return (
    <a
      className="ext-link"
      href={url}
      onClick={(e) => {
        e.preventDefault();
        openLink(url);
      }}
    >
      {children}
      <ExternalLink size={12} aria-hidden />
    </a>
  );
}

const SOURCE_LABEL: Record<SourceReport['source'], string> = {
  teamworkGraph: 'Teamwork Graph',
  jira: 'Jira',
  confluence: 'Confluence',
};

/** Shows where the data on a card came from, so provenance is always visible. */
export function SourceBadges({ sources }: { sources: SourceReport[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="sources" aria-label="Data sources">
      {sources.map((s, i) => (
        <span
          key={`${s.source}-${i}`}
          className={`source source-${s.status}`}
          title={`${SOURCE_LABEL[s.source]}: ${s.purpose}${s.detail ? `. ${s.detail}` : ''}`}
        >
          <span className="source-dot" aria-hidden />
          {SOURCE_LABEL[s.source]}
          <span className="sr-only">
            {' '}
            ({s.status}): {s.purpose}
          </span>
        </span>
      ))}
    </div>
  );
}

export function Notes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="notes">
      {notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );
}

export function LoadingRows({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div className="skeleton-list" role="status" aria-live="polite">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row">
          <span className="skeleton skeleton-key" />
          <span className="skeleton skeleton-text" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Inbox size={20} aria-hidden />
      <div>
        <p className="empty-title">{title}</p>
        {children && <p className="empty-text">{children}</p>}
      </div>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div className="error" role="alert">
      <AlertTriangle size={18} aria-hidden />
      <div className="error-body">
        <p>{error.message}</p>
        {onRetry && error.code !== 'INVALID_INPUT' && (
          <button type="button" className="btn btn-subtle btn-sm" onClick={onRetry}>
            <RefreshCw size={14} aria-hidden /> Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase();
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  // Deterministic hue from the name, so avatars are stable without fetching profile images.
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className={`avatar avatar-${size} avatar-hue-${hash % 6}`} aria-hidden>
      {initials(name)}
    </span>
  );
}
