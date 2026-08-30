/** Date を YYYY-MM-DD にする（端末のタイムゾーンで日付を決める）。 */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** 今日を含む直近 count 日ぶんの日付を、古い順に返す。 */
export function recentDateKeys(count: number, from: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(from);
    date.setDate(date.getDate() - offset);
    keys.push(toDateKey(date));
  }
  return keys;
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

export function formatShortDate(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  const date = new Date(`${dateKey}T00:00:00`);
  return `${Number(month)}/${Number(day)}(${WEEKDAY_LABELS[date.getDay()]})`;
}
