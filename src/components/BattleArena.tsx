import { useMemo, useRef, useState } from 'react';
import { todayKey } from '../lib/dates';
import type { AppData, Profile } from '../lib/types';
import { CLUBS } from '../data/clubs';
import {
  AWARD_POINT_CAP,
  STAT_KEYS,
  STAT_LABELS,
  buildBattleBuild,
  describeStatSource,
  resolveSpecialMoveName,
  simulateBattle,
  type BattleResult,
  type Combatant,
} from '../logic/battle';
import { buildProfileView } from '../logic/profileView';
import { MascotArt } from './MascotArt';

/** ステータスの棒の長さを決めるための上限。だいたいの最大値。 */
const STAT_SCALE = 320;

function toCombatant(profile: Profile, data: AppData): Combatant {
  const view = buildProfileView(profile, data);
  const build = buildBattleBuild({
    summaries: view.history,
    character: view.character,
    age: view.age,
    proximity: view.assessment.proximity,
    club: profile.club,
    awards: profile.awards,
  });
  return {
    profileId: profile.id,
    displayName: profile.displayName,
    characterName: profile.characterName,
    species: profile.species,
    stats: build.stats,
    shapeValue: view.character.shapeValue,
    growthStage: view.character.growthStage,
    condition: view.character.condition,
    specialMoveName: resolveSpecialMoveName(profile.club, profile.customSpecialMoveName),
    modifiers: build.modifiers,
  };
}

function formatPercent(multiplier: number): string {
  const percent = Math.round((multiplier - 1) * 100);
  return percent === 0 ? '±0%' : percent > 0 ? `+${percent}%` : `${percent}%`;
}

type FighterCardProps = { combatant: Combatant; isWinner: boolean | null };

function FighterCard({ combatant, isWinner }: FighterCardProps) {
  return (
    <div className={isWinner ? 'fighter is-winner' : 'fighter'}>
      <MascotArt
        species={combatant.species}
        shapeValue={combatant.shapeValue}
        growthStage={combatant.growthStage}
        condition={combatant.condition}
        animate={false}
      />
      <strong className="fighter-name">{combatant.characterName}</strong>
      <span className="fighter-owner">
        {combatant.displayName}・Lv.{combatant.stats.level}
      </span>
      <span className="fighter-move">必殺技：{combatant.specialMoveName}</span>
    </div>
  );
}

type Props = { data: AppData; activeProfile: Profile };

export function BattleArena({ data, activeProfile }: Props) {
  const opponents = data.profiles.filter((profile) => profile.id !== activeProfile.id);
  const [opponentId, setOpponentId] = useState(opponents[0]?.id ?? '');
  const [result, setResult] = useState<BattleResult | null>(null);
  const [revealedTurns, setRevealedTurns] = useState(0);
  const revealTimer = useRef<number | null>(null);

  const mine = useMemo(() => toCombatant(activeProfile, data), [activeProfile, data]);
  const opponentProfile = opponents.find((profile) => profile.id === opponentId) ?? null;
  const theirs = useMemo(
    () => (opponentProfile ? toCombatant(opponentProfile, data) : null),
    [opponentProfile, data],
  );

  function startBattle() {
    if (!theirs) return;
    if (revealTimer.current !== null) window.clearInterval(revealTimer.current);
    // 同じ相手と同じ日なら、何度押しても同じ展開になる
    const seed = `${todayKey()}:${mine.profileId}:${theirs.profileId}`;
    const battle = simulateBattle(mine, theirs, seed);
    setResult(battle);
    setRevealedTurns(0);
    revealTimer.current = window.setInterval(() => {
      setRevealedTurns((current) => {
        if (current >= battle.turns.length) {
          if (revealTimer.current !== null) window.clearInterval(revealTimer.current);
          return current;
        }
        return current + 1;
      });
    }, 420);
  }

  if (opponents.length === 0) {
    return (
      <section className="card">
        <h2 className="card-title">たいせん</h2>
        <p className="note">
          対戦するには家族がもう1人必要です。設定タブからメンバーを追加してください。
        </p>
      </section>
    );
  }

  const isFinished = result !== null && revealedTurns >= result.turns.length;

  return (
    <>
      <section className="card">
        <h2 className="card-title">たいせん</h2>

        <div className="field">
          <span>相手をえらぶ</span>
          <div className="chip-row">
            {opponents.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className={profile.id === opponentId ? 'chip is-active' : 'chip'}
                onClick={() => {
                  setOpponentId(profile.id);
                  setResult(null);
                  setRevealedTurns(0);
                }}
              >
                {profile.characterName}
              </button>
            ))}
          </div>
        </div>

        {theirs && (
          <div className="arena">
            <FighterCard
              combatant={mine}
              isWinner={isFinished ? result.winnerProfileId === mine.profileId : null}
            />
            <span className="arena-versus">VS</span>
            <FighterCard
              combatant={theirs}
              isWinner={isFinished ? result.winnerProfileId === theirs.profileId : null}
            />
          </div>
        )}

        {theirs && (
          <div className="stat-compare">
            {STAT_KEYS.map((key) => (
              <div className="stat-line" key={key}>
                <span className="stat-mine">{mine.stats[key]}</span>
                <div className="stat-bars">
                  <div className="stat-bar is-left">
                    <div
                      className="stat-bar-fill"
                      style={{ width: `${Math.min(100, (mine.stats[key] / STAT_SCALE) * 100)}%` }}
                    />
                  </div>
                  <span className="stat-name">{STAT_LABELS[key]}</span>
                  <div className="stat-bar is-right">
                    <div
                      className="stat-bar-fill"
                      style={{ width: `${Math.min(100, (theirs.stats[key] / STAT_SCALE) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="stat-theirs">{theirs.stats[key]}</span>
              </div>
            ))}
          </div>
        )}

        <button type="button" className="primary-button" onClick={startBattle} disabled={!theirs}>
          たたかう
        </button>
      </section>

      {theirs && (
        <section className="card">
          <h2 className="card-title">補正の内訳</h2>
          <table className="modifier-table">
            <thead>
              <tr>
                <th>補正</th>
                <th>{mine.characterName}</th>
                <th>{theirs.characterName}</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['育ち（レベル）', 'level'],
                  ['連続記録', 'streak'],
                  ['いまの調子', 'condition'],
                  ['年齢', 'age'],
                  ['体型（目標への近さ）', 'physique'],
                  ['受賞歴', 'award'],
                ] as const
              ).map(([label, key]) => (
                <tr key={key}>
                  <td>{label}</td>
                  <td>{formatPercent(mine.modifiers[key])}</td>
                  <td>{formatPercent(theirs.modifiers[key])}</td>
                </tr>
              ))}
              <tr>
                <td>スポーツ点</td>
                <td>{mine.modifiers.awardScore.sports}</td>
                <td>{theirs.modifiers.awardScore.sports}</td>
              </tr>
              <tr>
                <td>勉強点</td>
                <td>{mine.modifiers.awardScore.study}</td>
                <td>{theirs.modifiers.awardScore.study}</td>
              </tr>
              <tr>
                <td>芸術・その他点</td>
                <td>{mine.modifiers.awardScore.art}</td>
                <td>{theirs.modifiers.awardScore.art}</td>
              </tr>
              <tr>
                <td>得意ステータス</td>
                <td>{mine.modifiers.affinity ? STAT_LABELS[mine.modifiers.affinity] : 'なし'}</td>
                <td>{theirs.modifiers.affinity ? STAT_LABELS[theirs.modifiers.affinity] : 'なし'}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {result && (
        <section className="card">
          <h2 className="card-title">たたかいの記録</h2>
          <ol className="battle-log">
            {result.turns.slice(0, revealedTurns).map((turn, index) => (
              <li key={index} className={turn.isSpecial ? 'is-special' : turn.isCritical ? 'is-critical' : ''}>
                {turn.message}
              </li>
            ))}
          </ol>
          {isFinished && (
            <p className="battle-result">
              {result.summary}
              {result.decidedByRemainingHp && <small>（決着がつかず、残った体力で判定しました）</small>}
            </p>
          )}
        </section>
      )}

      <section className="card">
        <h2 className="card-title">ステータスの決まりかた</h2>
        <ul className="suggestion-list">
          {STAT_KEYS.map((key) => (
            <li key={key}>
              <strong>{STAT_LABELS[key]}</strong>
              <span>{describeStatSource(key)}が足りているほど上がる</span>
            </li>
          ))}
        </ul>
        <p className="note">
          もとになるのは直近2週間の栄養の充足と、記録が続いている日数です。そこに
          年齢（子どものほうが強い）、その年齢での目標体型への近さ、部活の得意分野、受賞歴の評価点が
          かけ合わされます。
        </p>
        <p className="note">
          体型の補正は<strong>目標から離れるほど下がります</strong>。太りすぎでも痩せすぎでも弱くなり、
          細いほど強いということはありません。食べる量が足りずキャラクターがやつれると、
          すべてのステータスが下がります。必要量を超えて食べた分も強さにはなりません。
          受賞歴の効果は合計{AWARD_POINT_CAP}点・最大 +25% までに抑えてあります。
        </p>
        {theirs && (
          <p className="note">
            {mine.characterName}は{CLUBS[activeProfile.club].label}なので「{mine.specialMoveName}」を、
            体力が4割を切ったときに一度だけ使えます（Lv.6以上）。
          </p>
        )}
      </section>
    </>
  );
}
