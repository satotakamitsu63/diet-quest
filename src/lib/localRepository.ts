import { createEmptyAppData, type Repository } from './repository';
import type { AppData, BodyLog, FamilyGroup, MealLog, Profile } from './types';

const STORAGE_KEY = 'diet-quest:data:v1';

function readFromStorage(): AppData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyAppData();
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const empty = createEmptyAppData();
    return {
      group: parsed.group ?? empty.group,
      profiles: parsed.profiles ?? [],
      mealLogs: parsed.mealLogs ?? [],
      bodyLogs: parsed.bodyLogs ?? [],
      activeProfileId: parsed.activeProfileId ?? null,
    };
  } catch {
    return createEmptyAppData();
  }
}

function writeToStorage(data: AppData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // プライベートブラウズや保存領域が使えない環境では、その回の保存をあきらめて画面は動かし続ける
  }
}

function replaceById<T extends { id: string }>(items: T[], next: T): T[] {
  const index = items.findIndex((item) => item.id === next.id);
  if (index === -1) return [...items, next];
  const copy = [...items];
  copy[index] = next;
  return copy;
}

/** ブラウザのローカル保存だけで動く保存先。Supabase 未設定でもアプリが使える。 */
export class LocalRepository implements Repository {
  readonly kind = 'local' as const;

  async load(): Promise<AppData> {
    return readFromStorage();
  }

  async saveGroup(group: FamilyGroup): Promise<void> {
    const data = readFromStorage();
    writeToStorage({ ...data, group });
  }

  async saveProfile(profile: Profile): Promise<void> {
    const data = readFromStorage();
    writeToStorage({
      ...data,
      profiles: replaceById(data.profiles, profile),
      activeProfileId: data.activeProfileId ?? profile.id,
    });
  }

  async removeProfile(profileId: string): Promise<void> {
    const data = readFromStorage();
    writeToStorage({
      ...data,
      profiles: data.profiles.filter((profile) => profile.id !== profileId),
      mealLogs: data.mealLogs.filter((log) => log.profileId !== profileId),
      bodyLogs: data.bodyLogs.filter((log) => log.profileId !== profileId),
      activeProfileId: data.activeProfileId === profileId ? null : data.activeProfileId,
    });
  }

  async saveMealLog(log: MealLog): Promise<void> {
    const data = readFromStorage();
    writeToStorage({ ...data, mealLogs: replaceById(data.mealLogs, log) });
  }

  async removeMealLog(logId: string): Promise<void> {
    const data = readFromStorage();
    writeToStorage({ ...data, mealLogs: data.mealLogs.filter((log) => log.id !== logId) });
  }

  async saveBodyLog(log: BodyLog): Promise<void> {
    const data = readFromStorage();
    writeToStorage({ ...data, bodyLogs: replaceById(data.bodyLogs, log) });
  }

  setActiveProfile(profileId: string | null): void {
    const data = readFromStorage();
    writeToStorage({ ...data, activeProfileId: profileId });
  }

  subscribe(): () => void {
    return () => undefined;
  }
}
