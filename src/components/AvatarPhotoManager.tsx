import { useState } from 'react';
import { GOAL_PHYSIQUE_LABELS, type GoalPhysique } from '../lib/avatarApi';
import { removePrivateAvatarSet, savePrivateAvatarSet } from '../lib/privateAvatarStore';
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
};

function defaultGoalPhysique(sex: Profile['sex']): GoalPhysique {
  return sex === 'male' ? 'athletic' : 'slim';
}

/** 通信せず、Codexデスクトップで作ったローカル画像セットを参照するための設定画面。 */
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
}: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const selectedGoal = goalPhysique ?? defaultGoalPhysique(sex);
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
      <p className="note">写真はこのアプリへ保存・送信しません。Codexデスクトップでこの会話に顔と上半身が写る成人の本人写真を添付し、「本人キャラクターを10段階で作成」と依頼してください。生成画像はこのブラウザだけに保存されます。</p>
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
                setMessage('このブラウザのたかみつアカウントへ10枚を保存しました。下の「保存する」を押してください。');
              })
              .catch((error: unknown) => setMessage(error instanceof Error ? error.message : '画像を保存できませんでした。'))
              .finally(() => setIsImporting(false));
          }}
        />
      </label>
      <p className="note">ファイル名は <code>1.png</code>〜<code>10.png</code> のまま選んでください。画像は公開フォルダ・Git・サーバーへ送られません。</p>
      <label className="checkbox-field">
        <input type="checkbox" checked={isEnabled} disabled={!consent} onChange={(event) => onEnabledChange(event.target.checked)} />
        <span>10枚の画像をローカルへ取り込んだので、ゲーム画面で本人キャラクターを表示する</span>
      </label>
      {isEnabled && (
        <p className="note">ゲーム画面で、現在レベルの本人キャラクターを表示します。</p>
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
              setMessage('この端末の本人キャラクター画像を削除しました。設定の保存で反映されます。');
            });
          }}
        >
          この端末の本人キャラクターを削除
        </button>
      )}
    </section>
  );
}
