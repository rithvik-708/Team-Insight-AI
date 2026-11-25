import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bot, CornerDownLeft, Loader2, MessageSquare, Sparkles } from 'lucide-react';
import { api, ApiError, askRovo, type AskResponse } from '../services/api';
import { Card, ErrorState } from './ui';
import { FocusContent, MyWorkContent } from './MyWork';
import { TeamWorkloadContent } from './TeamWorkload';
import { BlockedContent, DocsContent, PeopleContent, RelatedContent } from './IssueContext';

type Message =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'answer'; question: string; response: AskResponse }
  | { id: number; role: 'error'; question: string; error: ApiError };

const ACTION_LABEL: Record<AskResponse['intent'], string> = {
  myWork: 'get-my-work',
  focus: 'get-my-work (suggested focus)',
  teamWorkload: 'get-team-workload',
  issuePeople: 'get-issue-people',
  relatedWork: 'find-related-work',
  relatedDocs: 'find-related-docs',
  blockedWork: 'find-blocked-work',
  needsIssue: 'clarification',
  unknown: 'no matching action',
};

function Answer({ response, onAsk }: { response: AskResponse; onAsk: (q: string) => void }) {
  switch (response.intent) {
    case 'myWork':
      return <MyWorkContent data={response.result} max={10} />;
    case 'focus':
      return <FocusContent data={response.result} />;
    case 'teamWorkload':
      return (
        <TeamWorkloadContent
          data={response.result}
          onSelectTeam={(t) => onAsk(`What is the "${t.name}" team working on?`)}
        />
      );
    case 'issuePeople':
      return <PeopleContent data={response.result} />;
    case 'relatedWork':
      return <RelatedContent data={response.result} />;
    case 'relatedDocs':
      return <DocsContent data={response.result} />;
    case 'blockedWork':
      return <BlockedContent data={response.result} />;
    case 'needsIssue':
      return (
        <p>
          Which issue do you mean? Include an issue key, for example "Who is involved in MKT-21?"
        </p>
      );
    default:
      return (
        <p>
          Quick answers cover your work, team workload, issue people, related or blocked work and
          documents. For other questions, ask the Context Guide agent in Rovo.
        </p>
      );
  }
}

export function AskPanel({
  suggestions,
  rovoEnabled,
}: {
  suggestions: string[];
  rovoEnabled: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [messages, pending]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setInput('');
    setPending(true);
    setMessages((m) => [...m, { id: nextId.current++, role: 'user', text: q }]);
    try {
      const response = await api.ask(q);
      setMessages((m) => [...m, { id: nextId.current++, role: 'answer', question: q, response }]);
    } catch (err) {
      const error =
        err instanceof ApiError ? err : new ApiError('INTERNAL', 'Something went wrong.');
      setMessages((m) => [...m, { id: nextId.current++, role: 'error', question: q, error }]);
    } finally {
      setPending(false);
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void ask(input);
  };

  return (
    <Card
      className="ask-card"
      title="Ask Teamwork Insight"
      icon={<MessageSquare size={16} aria-hidden />}
      actions={
        rovoEnabled ? (
          <button type="button" className="btn btn-subtle btn-sm" onClick={() => void askRovo()}>
            <Bot size={14} aria-hidden /> Open in Rovo
          </button>
        ) : undefined
      }
    >
      <p className="muted small ask-intro">
        Quick answers run the same actions as the Rovo agent and show live Jira and Teamwork Graph
        data. No generated text.
      </p>

      <div className="messages" aria-live="polite">
        {messages.length === 0 && (
          <div className="suggestions">
            {suggestions.map((s) => (
              <button key={s} type="button" className="suggestion" onClick={() => void ask(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="msg msg-user">
              {m.text}
            </div>
          ) : (
            <div key={m.id} className="msg msg-answer">
              <div className="msg-meta">
                <span className="action-tag">
                  {m.role === 'answer' ? ACTION_LABEL[m.response.intent] : 'error'}
                </span>
                {rovoEnabled && (
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => void askRovo(m.question)}
                  >
                    <Sparkles size={12} aria-hidden /> Continue in Rovo
                  </button>
                )}
              </div>
              {m.role === 'answer' ? (
                <Answer response={m.response} onAsk={(q) => void ask(q)} />
              ) : (
                <ErrorState error={m.error} onRetry={() => void ask(m.question)} />
              )}
            </div>
          ),
        )}
        {pending && (
          <div className="msg msg-answer pending" role="status">
            <Loader2 size={14} className="spin" aria-hidden /> Fetching live data…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="ask-form" onSubmit={onSubmit}>
        <label htmlFor="ask-input" className="sr-only">
          Ask a question
        </label>
        <input
          id="ask-input"
          className="input"
          value={input}
          maxLength={300}
          placeholder="e.g. Who is involved in MKT-21?"
          onChange={(e) => setInput(e.target.value)}
          disabled={pending}
        />
        <button type="submit" className="btn btn-primary" disabled={pending || !input.trim()}>
          <CornerDownLeft size={14} aria-hidden /> Ask
        </button>
      </form>
    </Card>
  );
}
