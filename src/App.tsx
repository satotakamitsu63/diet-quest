import { useMemo, useState } from 'react';
import { BattleArena } from './components/BattleArena';
import { BodyLogCard } from './components/BodyLogCard';
import { FamilyBoard } from './components/FamilyBoard';
import { HomeView } from './components/HomeView';
import { MealRecorder } from './components/MealRecorder';
import { ProfileEditor, createBlankProfile } from './components/ProfileEditor';
import { FORCE_LOCAL_STORAGE_KEY, GROUP_ID_STORAGE_KEY, SupabaseGate } from './components/SupabaseGate';
import { isSupabaseConfigured } from './lib/supabaseClient';
import { DIETARY_REFERENCE_SOURCE } from './data/dietaryReference';
import { useAppData } from './hooks/useAppData';
import { findLatestBodyLog } from './logic/bodyGoal';
import { buildProfileView } from './logic/profileView';
import { MEAL_SLOT_LABELS } from './lib/types';
import { todayKey } from './lib/dates';

type Tab = 'home' | 'record' | 'body' | 'battle' | 'family' | 'settings';

const TAB_LABELS: Record<Tab, string> = {
  home: 'ホーム',
  record: 'きろく',
  body: 'からだ',
  battle: 'たいせん',
  family: 'かぞく',
  settings: '設定',
};

/** Supabase を使う設定なら、ログインとグループ参加を先に済ませる。 */
function useSupabaseReadiness(): { needsGate: boolean; markReady: () => void } {
  const [needsGate, setNeedsGate] = useState(
    () =>
      isSupabaseConfigured &&
      !window.localStorage.getItem(GROUP_ID_STORAGE_KEY) &&
      !window.localStorage.getItem(FORCE_LOCAL_STORAGE_KEY),
  );
  return {
    needsGate,
    markReady: () => {
      setNeedsGate(false);
      window.location.reload();
    },
  };
}

export function App() {
  const supabaseReadiness = useSupabaseReadiness();
  if (supabaseReadiness.needsGate) {
    return <SupabaseGate onReady={supabaseReadiness.markReady} />;
  }
  return <AppContent />;
}

function AppContent() {
  const state = useAppData();
  const [tab, setTab] = useState<Tab>('home');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [isAddingProfile, setIsAddingProfile] = useState(false);

  const activeProfile =
    state.data.profiles.find((profile) => profile.id === state.data.activeProfileId) ??
    state.data.profiles[0] ??
    null;

  const view = useMemo(
    () => (activeProfile ? buildProfileView(activeProfile, state.data) : null),
    [activeProfile, state.data],
  );

  const todaysLogs = useMemo(
    () =>
      activeProfile
        ? state.data.mealLogs
            .filter((log) => log.profileId === activeProfile.id && log.date === todayKey())
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        : [],
    [activeProfile, state.data.mealLogs],
  );

  if (state.isLoading) {
    return <main className="app"><p className="note">読み込み中…</p></main>;
  }

  if (state.data.profiles.length === 0 || isAddingProfile) {
    return (
      <main className="app">
        <header className="app-header">
          <h1>ダイエットクエスト</h1>
        </header>
        <ProfileEditor
          profile={createBlankProfile(state.data.group.id)}
          onSave={async (profile) => {
            await state.saveProfile(profile);
            state.setActiveProfileId(profile.id);
            setIsAddingProfile(false);
            setTab('home');
          }}
          onCancel={state.data.profiles.length > 0 ? () => setIsAddingProfile(false) : undefined}
        />
      </main>
    );
  }

  const editingProfile = state.data.profiles.find((profile) => profile.id === editingProfileId) ?? null;

  return (
    <main className="app">
      <header className="app-header">
        <h1>ダイエットクエスト</h1>
        {activeProfile && (
          <select
            className="profile-select"
            value={activeProfile.id}
            onChange={(event) => state.setActiveProfileId(event.target.value)}
          >
            {state.data.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.displayName}
              </option>
            ))}
          </select>
        )}
      </header>

      <div className="app-body">
        {tab === 'home' && activeProfile && view && <HomeView profile={activeProfile} view={view} />}

        {tab === 'record' && activeProfile && (
          <>
            <MealRecorder key={activeProfile.id} profile={activeProfile} onSave={state.saveMealLog} />
            <section className="card">
              <h2 className="card-title">今日の記録</h2>
              {todaysLogs.length === 0 ? (
                <p className="note">まだ記録がありません。</p>
              ) : (
                <ul className="log-list">
                  {todaysLogs.map((log) => (
                    <li key={log.id}>
                      <div className="log-head">
                        <strong>{MEAL_SLOT_LABELS[log.slot]}</strong>
                        <span>
                          {Math.round(log.items.reduce((total, item) => total + item.nutrients.energy, 0))}
                          kcal
                        </span>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => void state.removeMealLog(log.id)}
                          aria-label="この記録を消す"
                        >
                          ×
                        </button>
                      </div>
                      <p className="log-items">
                        {log.items.map((item) => `${item.name} ${item.grams}g`).join('、')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}

        {tab === 'body' && activeProfile && view && (
          <BodyLogCard
            key={activeProfile.id}
            profile={activeProfile}
            age={view.age}
            assessment={view.assessment}
            latestLog={findLatestBodyLog(state.data.bodyLogs, activeProfile.id)}
            heightGoal={view.heightGoal}
            heightVelocity={view.heightVelocity}
            isGrowthBoosted={view.isGrowthBoosted}
            onSave={state.saveBodyLog}
          />
        )}

        {tab === 'battle' && activeProfile && (
          <BattleArena data={state.data} activeProfile={activeProfile} />
        )}

        {tab === 'family' && (
          <FamilyBoard
            data={state.data}
            activeProfileId={activeProfile?.id ?? null}
            onSelectProfile={(profileId) => {
              state.setActiveProfileId(profileId);
              setTab('home');
            }}
          />
        )}

        {tab === 'settings' && (
          <>
            {editingProfile ? (
              <ProfileEditor
                profile={editingProfile}
                onSave={async (profile) => {
                  await state.saveProfile(profile);
                  setEditingProfileId(null);
                }}
                onCancel={() => setEditingProfileId(null)}
                onDelete={async (profileId) => {
                  await state.removeProfile(profileId);
                  setEditingProfileId(null);
                }}
              />
            ) : (
              <section className="card">
                <h2 className="card-title">メンバー</h2>
                <ul className="member-list">
                  {state.data.profiles.map((profile) => (
                    <li key={profile.id}>
                      <span>{profile.displayName}</span>
                      <button type="button" className="ghost-button" onClick={() => setEditingProfileId(profile.id)}>
                        編集
                      </button>
                    </li>
                  ))}
                </ul>
                <button type="button" className="primary-button" onClick={() => setIsAddingProfile(true)}>
                  メンバーを追加
                </button>
              </section>
            )}

            <section className="card">
              <h2 className="card-title">このアプリについて</h2>
              <p className="note">
                保存先：{state.syncMode === 'supabase' ? 'Supabase（家族で共有）' : 'この端末のブラウザ内'}
                <br />
                合言葉：{state.data.group.inviteCode}
              </p>
              <p className="note">
                栄養の目標値は{DIETARY_REFERENCE_SOURCE}にもとづきます。食品の成分値は日本食品標準成分表2020年版（八訂）、
                料理の値は標準的なレシピからの目安です。医療行為の判断に使うものではありません。
              </p>
            </section>
          </>
        )}
      </div>

      <nav className="tab-bar">
        {(Object.keys(TAB_LABELS) as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            className={value === tab ? 'tab is-active' : 'tab'}
            onClick={() => setTab(value)}
          >
            {TAB_LABELS[value]}
          </button>
        ))}
      </nav>
    </main>
  );
}
