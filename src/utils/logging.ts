/**
 * Minimal structured logger. Only operational metadata is logged (operation names, HTTP status,
 * durations, counts, error codes). Never pass display names, emails, issue content or tokens.
 */
type Level = 'info' | 'warn' | 'error';
type Meta = Record<string, string | number | boolean | undefined>;

function emit(level: Level, event: string, meta: Meta = {}): void {
  const line = JSON.stringify({ app: 'teamwork-insight', level, event, ...meta });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, meta?: Meta) => emit('info', event, meta),
  warn: (event: string, meta?: Meta) => emit('warn', event, meta),
  error: (event: string, meta?: Meta) => emit('error', event, meta),
};
