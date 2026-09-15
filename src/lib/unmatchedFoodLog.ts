const STORAGE_KEY = 'diet-quest-unmatched-foods';

type UnmatchedLog = Record<string, number>;

function readLog(): UnmatchedLog {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as UnmatchedLog;
  } catch {
    return {};
  }
}

function writeLog(log: UnmatchedLog): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // 保存できなくても記録機能自体は止めない
  }
}

/** 「わからなかった言葉」を、次にまとめて食品データベースへ登録できるよう端末に積み上げる。 */
export function recordUnmatchedTerms(terms: string[]): void {
  if (terms.length === 0) return;
  const log = readLog();
  for (const term of terms) {
    const trimmed = term.trim();
    if (!trimmed) continue;
    log[trimmed] = (log[trimmed] ?? 0) + 1;
  }
  writeLog(log);
}

export type UnmatchedFoodEntry = { term: string; count: number };

/** 記録回数が多い順に並べた、まだ食品データベースに無い言葉の一覧。 */
export function getUnmatchedLog(): UnmatchedFoodEntry[] {
  const log = readLog();
  return Object.entries(log)
    .map(([term, count]) => ({ term, count }))
    .sort((left, right) => right.count - left.count);
}

export function clearUnmatchedLog(): void {
  writeLog({});
}
