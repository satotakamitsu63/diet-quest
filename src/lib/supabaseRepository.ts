import type { SupabaseClient } from '@supabase/supabase-js';
import { createEmptyAppData, type Repository } from './repository';
import type {
  ActivityLevelValue,
  AppData,
  BodyLog,
  FamilyGroup,
  MealItem,
  MealLog,
  Profile,
} from './types';

type ProfileRow = {
  id: string;
  group_id: string;
  display_name: string;
  birth_date: string | null;
  age_years: number | null;
  sex: 'male' | 'female';
  height_cm: number | null;
  activity_level: number;
  is_menstruating: boolean;
  goal_preset: Profile['goalPreset'];
  custom_target_weight_kg: number | null;
  custom_target_bmi: number | null;
  custom_target_body_fat_percent: number | null;
  aesthetic_sport_mode: boolean;
  growth_boost: boolean;
  father_height_cm: number | null;
  mother_height_cm: number | null;
  target_adult_height_cm: number | null;
  species: Profile['species'];
  character_name: string;
  club: Profile['club'];
  custom_special_move_name: string | null;
  awards: Profile['awards'];
  created_at: string;
};

type MealLogRow = {
  id: string;
  group_id: string;
  profile_id: string;
  date: string;
  slot: MealLog['slot'];
  raw_text: string;
  items: MealItem[];
  created_at: string;
};

type BodyLogRow = {
  id: string;
  group_id: string;
  profile_id: string;
  date: string;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_percent: number | null;
};

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    groupId: row.group_id,
    displayName: row.display_name,
    birthDate: row.birth_date,
    ageYears: row.age_years,
    sex: row.sex,
    heightCm: row.height_cm,
    activityLevel: (row.activity_level as ActivityLevelValue) ?? 2,
    isMenstruating: row.is_menstruating,
    goalPreset: row.goal_preset,
    customTargetWeightKg: row.custom_target_weight_kg,
    customTargetBmi: row.custom_target_bmi,
    customTargetBodyFatPercent: row.custom_target_body_fat_percent,
    aestheticSportMode: row.aesthetic_sport_mode,
    growthBoost: row.growth_boost ?? true,
    fatherHeightCm: row.father_height_cm,
    motherHeightCm: row.mother_height_cm,
    targetAdultHeightCm: row.target_adult_height_cm,
    species: row.species,
    characterName: row.character_name,
    club: row.club ?? 'none',
    customSpecialMoveName: row.custom_special_move_name,
    awards: row.awards ?? [],
    createdAt: row.created_at,
  };
}

function toProfileRow(profile: Profile): ProfileRow {
  return {
    id: profile.id,
    group_id: profile.groupId,
    display_name: profile.displayName,
    birth_date: profile.birthDate,
    age_years: profile.ageYears,
    sex: profile.sex,
    height_cm: profile.heightCm,
    activity_level: profile.activityLevel,
    is_menstruating: profile.isMenstruating,
    goal_preset: profile.goalPreset,
    custom_target_weight_kg: profile.customTargetWeightKg,
    custom_target_bmi: profile.customTargetBmi,
    custom_target_body_fat_percent: profile.customTargetBodyFatPercent,
    aesthetic_sport_mode: profile.aestheticSportMode,
    growth_boost: profile.growthBoost,
    father_height_cm: profile.fatherHeightCm,
    mother_height_cm: profile.motherHeightCm,
    target_adult_height_cm: profile.targetAdultHeightCm,
    species: profile.species,
    character_name: profile.characterName,
    club: profile.club,
    custom_special_move_name: profile.customSpecialMoveName,
    awards: profile.awards,
    created_at: profile.createdAt,
  };
}

/** Supabase に保存して家族3人で共有する保存先。 */
export class SupabaseRepository implements Repository {
  readonly kind = 'supabase' as const;

  constructor(
    private readonly client: SupabaseClient,
    private readonly groupId: string,
  ) {}

  async load(): Promise<AppData> {
    const [groupResult, profileResult, mealResult, bodyResult] = await Promise.all([
      this.client.from('family_groups').select('*').eq('id', this.groupId).single(),
      this.client.from('profiles').select('*').eq('group_id', this.groupId),
      this.client.from('meal_logs').select('*').eq('group_id', this.groupId),
      this.client.from('body_logs').select('*').eq('group_id', this.groupId),
    ]);

    const fallback = createEmptyAppData();
    const groupRow = groupResult.data as
      | { id: string; name: string; invite_code: string; created_at: string }
      | null;

    const group: FamilyGroup = groupRow
      ? {
          id: groupRow.id,
          name: groupRow.name,
          inviteCode: groupRow.invite_code,
          createdAt: groupRow.created_at,
        }
      : fallback.group;

    const mealLogs: MealLog[] = ((mealResult.data as MealLogRow[]) ?? []).map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      date: row.date,
      slot: row.slot,
      rawText: row.raw_text,
      items: row.items ?? [],
      createdAt: row.created_at,
    }));

    const bodyLogs: BodyLog[] = ((bodyResult.data as BodyLogRow[]) ?? []).map((row) => ({
      id: row.id,
      profileId: row.profile_id,
      date: row.date,
      weightKg: row.weight_kg,
      heightCm: row.height_cm,
      bodyFatPercent: row.body_fat_percent,
    }));

    return {
      group,
      profiles: ((profileResult.data as ProfileRow[]) ?? []).map(toProfile),
      mealLogs,
      bodyLogs,
      activeProfileId: null,
    };
  }

  async saveGroup(group: FamilyGroup): Promise<void> {
    await this.client.from('family_groups').update({ name: group.name }).eq('id', group.id);
  }

  async saveProfile(profile: Profile): Promise<void> {
    await this.client.from('profiles').upsert(toProfileRow(profile));
  }

  async removeProfile(profileId: string): Promise<void> {
    await this.client.from('profiles').delete().eq('id', profileId);
  }

  async saveMealLog(log: MealLog): Promise<void> {
    await this.client.from('meal_logs').upsert({
      id: log.id,
      group_id: this.groupId,
      profile_id: log.profileId,
      date: log.date,
      slot: log.slot,
      raw_text: log.rawText,
      items: log.items,
      created_at: log.createdAt,
    });
  }

  async removeMealLog(logId: string): Promise<void> {
    await this.client.from('meal_logs').delete().eq('id', logId);
  }

  async saveBodyLog(log: BodyLog): Promise<void> {
    await this.client.from('body_logs').upsert(
      {
        id: log.id,
        group_id: this.groupId,
        profile_id: log.profileId,
        date: log.date,
        weight_kg: log.weightKg,
        height_cm: log.heightCm,
        body_fat_percent: log.bodyFatPercent,
      },
      { onConflict: 'profile_id,date' },
    );
  }

  subscribe(onRemoteChange: () => void): () => void {
    const channel = this.client
      .channel(`group-${this.groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_logs' }, onRemoteChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'body_logs' }, onRemoteChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, onRemoteChange)
      .subscribe();
    return () => {
      void this.client.removeChannel(channel);
    };
  }
}
