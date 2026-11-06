export function appTimezone(): string {
  return process.env.APP_TIMEZONE ?? 'Asia/Jakarta';
}

export function todayWorkDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: appTimezone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function formatStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: appTimezone(),
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('day')} ${value('month')} ${value('year')} - ${value('hour')}:${value('minute')}:${value('second')}`;
}
