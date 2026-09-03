import { GROWTH_STAGE_NAMES } from '../art/mascot';
import type { AppData } from '../lib/types';
import { buildProfileView } from '../logic/profileView';
import { CONDITION_LABELS } from '../logic/score';
import { MascotArt } from './MascotArt';

type Props = {
  data: AppData;
  activeProfileId: string | null;
  /** ログインしているアカウントの ID。自分のキャラに印を付けるのに使う */
  currentUserId: string | null;
  onSelectProfile: (profileId: string) => void;
};

export function FamilyBoard({ data, activeProfileId, currentUserId, onSelectProfile }: Props) {
  if (data.profiles.length === 0) {
    return (
      <section className="card">
        <h2 className="card-title">かぞく</h2>
        <p className="note">まだ誰も登録されていません。設定からメンバーを追加してください。</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 className="card-title">かぞくのようす</h2>
      <div className="family-grid">
        {data.profiles.map((profile) => {
          const view = buildProfileView(profile, data);
          const isActive = profile.id === activeProfileId;
          return (
            <button
              type="button"
              key={profile.id}
              className={isActive ? 'family-card is-active' : 'family-card'}
              onClick={() => onSelectProfile(profile.id)}
            >
              <MascotArt
                species={profile.species}
                shapeValue={view.character.shapeValue}
                growthStage={view.character.growthStage}
                condition={view.character.condition}
                animate={false}
              />
              <span className="family-name">
                {profile.displayName}
                {currentUserId !== null && profile.ownerId === currentUserId && (
                  <span className="family-mine">じぶん</span>
                )}
              </span>
              <span className="family-character">{profile.characterName}</span>
              <span className="family-stage">
                Lv.{view.character.growthStage + 1}「{GROWTH_STAGE_NAMES[view.character.growthStage]}」
              </span>
              <span className="family-score">
                今日 {view.today.score === null ? '記録なし' : `${view.today.score}点`}
              </span>
              <span className="family-condition">{CONDITION_LABELS[view.character.condition]}</span>
              {view.character.streakDays > 0 && (
                <span className="family-streak">🔥 {view.character.streakDays}日連続</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
