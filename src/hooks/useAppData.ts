import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LocalRepository } from '../lib/localRepository';
import { createEmptyAppData, type Repository } from '../lib/repository';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { SupabaseRepository } from '../lib/supabaseRepository';
import type { AppData, BodyLog, FamilyGroup, MealLog, Profile } from '../lib/types';

import { GROUP_ID_STORAGE_KEY } from '../components/SupabaseGate';

export type SyncMode = 'local' | 'supabase';

export type AppDataState = {
  data: AppData;
  isLoading: boolean;
  syncMode: SyncMode;
  /** いまログインしているアカウントの ID。共有していないときは null */
  currentUserId: string | null;
  saveProfile: (profile: Profile) => Promise<void>;
  removeProfile: (profileId: string) => Promise<void>;
  saveMealLog: (log: MealLog) => Promise<void>;
  removeMealLog: (logId: string) => Promise<void>;
  saveBodyLog: (log: BodyLog) => Promise<void>;
  saveGroup: (group: FamilyGroup) => Promise<void>;
  setActiveProfileId: (profileId: string | null) => void;
  reload: () => Promise<void>;
};

function createRepository(): Repository {
  const storedGroupId = window.localStorage.getItem(GROUP_ID_STORAGE_KEY);
  if (isSupabaseConfigured && supabase && storedGroupId) {
    return new SupabaseRepository(supabase, storedGroupId);
  }
  return new LocalRepository();
}

/** 保存先を選び、アプリ全体のデータを読み書きする。 */
export function useAppData(): AppDataState {
  const repositoryRef = useRef<Repository>(createRepository());
  const [data, setData] = useState<AppData>(() => createEmptyAppData());
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const repository = repositoryRef.current;
    const loaded = await repository.load();

    // 共有しているときは、ログインした本人のプロフィールを最初に開く
    let ownProfileId: string | null = null;
    if (repository instanceof SupabaseRepository) {
      const userId = await repository.getCurrentUserId();
      setCurrentUserId(userId);
      ownProfileId = loaded.profiles.find((profile) => profile.ownerId === userId)?.id ?? null;
    }

    setData((current) => ({
      ...loaded,
      activeProfileId:
        ownProfileId ??
        loaded.activeProfileId ??
        current.activeProfileId ??
        loaded.profiles[0]?.id ??
        null,
    }));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    const unsubscribe = repositoryRef.current.subscribe(() => {
      void reload();
    });
    return unsubscribe;
  }, [reload]);

  const saveProfile = useCallback(
    async (profile: Profile) => {
      await repositoryRef.current.saveProfile(profile);
      await reload();
    },
    [reload],
  );

  const removeProfile = useCallback(
    async (profileId: string) => {
      await repositoryRef.current.removeProfile(profileId);
      await reload();
    },
    [reload],
  );

  const saveMealLog = useCallback(
    async (log: MealLog) => {
      await repositoryRef.current.saveMealLog(log);
      await reload();
    },
    [reload],
  );

  const removeMealLog = useCallback(
    async (logId: string) => {
      await repositoryRef.current.removeMealLog(logId);
      await reload();
    },
    [reload],
  );

  const saveBodyLog = useCallback(
    async (log: BodyLog) => {
      await repositoryRef.current.saveBodyLog(log);
      await reload();
    },
    [reload],
  );

  const saveGroup = useCallback(
    async (group: FamilyGroup) => {
      await repositoryRef.current.saveGroup(group);
      await reload();
    },
    [reload],
  );

  const setActiveProfileId = useCallback((profileId: string | null) => {
    setData((current) => ({ ...current, activeProfileId: profileId }));
    const repository = repositoryRef.current;
    if (repository instanceof LocalRepository) repository.setActiveProfile(profileId);
  }, []);

  const syncMode = useMemo<SyncMode>(() => repositoryRef.current.kind, []);

  return {
    data,
    isLoading,
    syncMode,
    currentUserId,
    saveProfile,
    removeProfile,
    saveMealLog,
    removeMealLog,
    saveBodyLog,
    saveGroup,
    setActiveProfileId,
    reload,
  };
}
