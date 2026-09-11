import { useEffect, useState } from 'react';
import { GOAL_PHYSIQUE_LABELS, type GoalPhysique } from '../lib/avatarApi';
import { getPrivateAvatarStatus, removePrivateAvatarSet, savePrivateAvatarSet, type PrivateAvatarStatus } from '../lib/privateAvatarStore';
import type { Profile } from '../lib/types';

type Props = {
  profile: Profile;
  sex: Profile['sex'];
  isAdult: boolean;
  consent: boolean;
  goalPhysique: GoalPhysique | null;
  isEnabled: boolean;
  onConsentChange: (value: boolean) => void;
  onGoalPhysiqueChange: (value: GoalPhysique) => void;
  onEnabledChange: (value: boolean) => void;
  onAvatarStored: () => Promise<void>;
};

function defaultGoalPhysique(sex: Profile['sex']): GoalPhysique {
  return sex === 'male' ? 'athletic' : 'slim';
}

/** Codexデスクトップで作った画像セットを、本人だけが読める保存先へ登録する設定画面。 */
export function AvatarPhotoManager({
  profile,
  sex,
  isAdult,
  consent,
  goalPhysique,
  isEnabled,
  onConsentChange,
  onGoalPhysiqueChange,
  onEnabledChange,
  onAvatarStored,
}: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState<PrivateAvatarStatus | null>(null);
  const [statusVersion, setStatusVersion] = useState(0);
  const selectedGoal = goalPhysique ?? defaultGoalPhysique(sex);

  useEffect(() => {
    let active = true;
    void getPrivateAvatarStatus(profile).then((nextStatus) => {
      if (active) setStatus(nextStatus);
    });
    return () => {
      active = false;
    };
  }, [profile, statusVersion]);
  if (!isAdult) {
    return (
      <section className="avatar-manager" aria-label="本人キャラクター">
        <h3>キャラクター写真を登録</h3>
        <p className="note">本人写真を使うキャラクターは、18歳以上の利用者のみが対象です。</p>
      </section>
    );
  }

  return (
    <section className="avatar-manager" aria-label="本人キャラクター">
      <h3>キャラクター写真を登録</h3>
      <p className="note">元写真はこのアプリへ保存・送信しません。Codexデスクトップで作成した10枚だけを、ログイン本人しか読めない非公開保存先へ登録します。GitHub Pages・Git・家族のアカウントには公開されません。</p>
      <label className="checkbox-field">
        <input type="checkbox" checked={consent} onChange={(event) => onConsentChange(event.target.checked)} />
        <span>この写真は本人の写真であり、本人キャラクターの生成に使用することへ同意します。</span>
      </label>
      <div className="field">
        <span>目標体型</span>
        <div className="chip-row">
          {(Object.keys(GOAL_PHYSIQUE_LABELS) as GoalPhysique[]).map((value) => (
            <button key={value} type="button" className={selectedGoal === value ? 'chip is-active' : 'chip'} onClick={() => onGoalPhysiqueChange(value)}>
              {GOAL_PHYSIQUE_LABELS[value]}
            </button>
          ))}
        </div>
      </div>
      <label className="field">
        <span>レベル1〜10の画像を取り込む</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          disabled={!consent || isImporting}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length === 0) return;
            setIsImporting(true);
            setMessage(null);
            void savePrivateAvatarSet(profile, files)
              .then(() => {
                onEnabledChange(true);
                return onAvatarStored();
              })
              .then(() => {
                setStatusVersion((current) => current + 1);
                setMessage('10枚を本人専用の非公開保存先へ登録し、ゲーム画面への表示も有効にしました。');
              })
              .catch((error: unknown) => setMessage(error instanceof Error ? error.message : '画像を保存できませんでした。'))
              .finally(() => setIsImporting(false));
          }}
        />
      </label>
      <p className="note">ファイル名は <code>1.png</code>〜<code>10.png</code> のまま選んでください。画像は公開フォルダやGitには送られず、本人ログイン時だけ取得できます。</p>
      {status && (
        <p className={status.error ? 'alert' : 'note'}>
          保存状況：{status.location === 'remote' ? '本人専用の非公開ストレージ' : 'この端末'}に {status.count}/10 枚
          {status.error ? `（${status.error}）` : ''}
        </p>
      )}
      <label className="checkbox-field">
        <input type="checkbox" checked={isEnabled} disabled={!consent} onChange={(event) => onEnabledChange(event.target.checked)} />
        <span>10枚の画像をローカルへ取り込んだので、ゲーム画面で本人キャラクターを表示する</span>
      </label>
      {isEnabled && (
        <p className="note">ゲーム画面で、現在レベルの本人キャラクターを表示します。</p>
      )}
      {status?.count === 10 && !isEnabled && (
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            onEnabledChange(true);
            void onAvatarStored().catch((error: unknown) => {
              setMessage(error instanceof Error ? error.message : '本人キャラクターの表示設定を保存できませんでした。');
            });
          }}
        >
          保存済みの画像をゲームに反映する
        </button>
      )}
      {message && <p className="note">{message}</p>}
      {isEnabled && (
        <button
          type="button"
          className="danger-button"
          onClick={() => {
            if (!window.confirm('この端末に保存した本人キャラクター10枚を削除します。よろしいですか？')) return;
            void removePrivateAvatarSet(profile).then(() => {
              onEnabledChange(false);
              setStatusVersion((current) => current + 1);
              setMessage('本人キャラクター画像を非公開保存先とこの端末から削除しました。');
            });
          }}
        >
          この端末の本人キャラクターを削除
        </button>
      )}
    </section>
  );
}
