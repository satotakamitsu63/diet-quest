import type { AppData, BodyLog, FamilyGroup, MealLog, Profile } from './types';

export interface Repository {
  readonly kind: 'local' | 'supabase';
  load(): Promise<AppData>;
  saveGroup(group: FamilyGroup): Promise<void>;
  saveProfile(profile: Profile): Promise<void>;
  removeProfile(profileId: string): Promise<void>;
  saveMealLog(log: MealLog): Promise<void>;
  removeMealLog(logId: string): Promise<void>;
  saveBodyLog(log: BodyLog): Promise<void>;
  /** 家族の更新を受け取る。戻り値は購読解除の関数。 */
  subscribe(onRemoteChange: () => void): () => void;
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

/** 家族グループに入るための合言葉。読み上げやすいよう英数字6桁にする。 */
export function createInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export function createEmptyAppData(): AppData {
  return {
    group: {
      id: createId(),
      name: 'わが家',
      inviteCode: createInviteCode(),
      createdAt: new Date().toISOString(),
    },
    profiles: [],
    mealLogs: [],
    bodyLogs: [],
    activeProfileId: null,
  };
}
