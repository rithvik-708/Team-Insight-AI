import { routeQuestion } from '../../src/assistant/router';

describe('routeQuestion', () => {
  it.each([
    ['What am I working on?', { intent: 'myWork' }],
    ['Show my outstanding work', { intent: 'myWork' }],
    ['what is overdue for me', { intent: 'myWork' }],
    ['What should I focus on next?', { intent: 'focus' }],
    ['What is my team working on?', { intent: 'teamWorkload' }],
    ["Give me an overview of my team's workload", { intent: 'teamWorkload' }],
    ['Which issues are blocked?', { intent: 'blockedWork' }],
    ['Who is involved in MKT-21?', { intent: 'issuePeople', issueKey: 'MKT-21' }],
    ['who owns mkt-5', { intent: 'issuePeople', issueKey: 'MKT-5' }],
    ['What are the related issues for MKT-21?', { intent: 'relatedWork', issueKey: 'MKT-21' }],
    ['Is MKT-22 blocked?', { intent: 'relatedWork', issueKey: 'MKT-22' }],
    ['Are there any documents for MKT-21?', { intent: 'relatedDocs', issueKey: 'MKT-21' }],
  ])('%s', (question, expected) => {
    expect(routeQuestion(question)).toMatchObject(expected);
  });

  it('extracts project keys for team and blocked questions', () => {
    expect(routeQuestion('Which issues are blocked in project mkt?')).toEqual({
      intent: 'blockedWork',
      projectKey: 'MKT',
    });
    expect(routeQuestion('Show the workload for project MKT')).toMatchObject({
      intent: 'teamWorkload',
      projectKey: 'MKT',
    });
  });

  it('extracts a named team', () => {
    expect(routeQuestion('What is the Platform team working on?')).toMatchObject({
      intent: 'teamWorkload',
      teamName: 'Platform',
    });
    expect(routeQuestion('What is the "Web Squad" team doing?')).toMatchObject({
      teamName: 'Web Squad',
    });
    expect(routeQuestion('What is my team working on?')).toMatchObject({ teamName: undefined });
  });

  it('asks for an issue when one is needed but missing', () => {
    expect(routeQuestion('Who is involved in this issue?')).toEqual({
      intent: 'needsIssue',
      asked: 'issuePeople',
    });
    expect(routeQuestion('What are the dependencies?')).toEqual({
      intent: 'needsIssue',
      asked: 'relatedWork',
    });
  });

  it('uses the context issue when the question omits a key', () => {
    expect(routeQuestion('Who is involved in this issue?', 'MKT-9')).toEqual({
      intent: 'issuePeople',
      issueKey: 'MKT-9',
    });
  });

  it('searches docs by topic when no issue is given', () => {
    expect(routeQuestion('Find docs about landing page design')).toEqual({
      intent: 'relatedDocs',
      query: 'landing page design',
    });
  });

  it('returns unknown for unrelated input', () => {
    expect(routeQuestion('')).toEqual({ intent: 'unknown' });
    expect(routeQuestion('Tell me a joke about cats')).toEqual({ intent: 'unknown' });
  });
});
