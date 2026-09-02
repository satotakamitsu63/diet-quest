import { useCallback, useEffect, useState } from 'react';
import { createInviteCode } from '../lib/repository';
import { supabase } from '../lib/supabaseClient';

export const GROUP_ID_STORAGE_KEY = 'diet-quest:group-id';
/** 共有せずこの端末だけで使う、と選んだことを覚えておく。 */
export const FORCE_LOCAL_STORAGE_KEY = 'diet-quest:force-local';

type Stage = 'checking' | 'signedOut' | 'chooseGroup';
type AuthMode = 'signIn' | 'signUp';

type MembershipRow = { group_id: string; family_groups: { name: string; invite_code: string } | null };

type Props = { onReady: () => void };

/**
 * Supabase を使う設定のときに、ログインと家族グループへの参加を済ませる画面。
 * ここを通らないと行レベルセキュリティにより家族のデータを読めない。
 */
export function SupabaseGate({ onReady }: Props) {
  const [stage, setStage] = useState<Stage>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('signUp');
  const [groupName, setGroupName] = useState('わが家');
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const findExistingGroup = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('group_members')
      .select('group_id, family_groups(name, invite_code)')
      .limit(1);
    const membership = (data as MembershipRow[] | null)?.[0];
    if (membership) {
      window.localStorage.setItem(GROUP_ID_STORAGE_KEY, membership.group_id);
      onReady();
      return;
    }
    setStage('chooseGroup');
  }, [onReady]);

  useEffect(() => {
    if (!supabase) return undefined;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) await findExistingGroup();
      else setStage('signedOut');
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void findExistingGroup();
    });
    return () => listener.subscription.unsubscribe();
  }, [findExistingGroup]);

  /** Supabase が返す英語のエラーを、そのまま出しても分からないので言い換える。 */
  function describeAuthError(rawMessage: string): string {
    const text = rawMessage.toLowerCase();
    if (text.includes('invalid login credentials')) {
      return 'メールアドレスかパスワードが違います。はじめての方は「はじめて使う」を選んでください。';
    }
    if (text.includes('already registered') || text.includes('already been registered')) {
      return 'このメールアドレスは登録済みです。「ログイン」に切り替えてください。';
    }
    if (text.includes('password should be at least')) {
      return 'パスワードは6文字以上にしてください。';
    }
    if (text.includes('email address') && text.includes('invalid')) {
      return 'メールアドレスの形式が正しくありません。';
    }
    if (text.includes('rate limit') || text.includes('too many')) {
      return '短時間に試しすぎました。少し待ってからもう一度お願いします。';
    }
    return rawMessage;
  }

  async function handleSubmit() {
    if (!supabase || !email.trim() || password.length === 0) return;
    setIsWorking(true);
    setMessage(null);
    const credentials = { email: email.trim(), password };
    const { data, error } =
      authMode === 'signUp'
        ? await supabase.auth.signUp(credentials)
        : await supabase.auth.signInWithPassword(credentials);
    setIsWorking(false);

    if (error) {
      setMessage(describeAuthError(error.message));
      return;
    }
    if (!data.session) {
      // 確認メールを必須にしたままだと、ここに来て先へ進めない
      setMessage(
        '登録はできましたが、ログインが完了しませんでした。Supabase の Authentication > Providers > Email で「Confirm email」をオフにしてください。',
      );
      return;
    }
    // ログインできたら onAuthStateChange が拾って次へ進む
  }

  async function handleCreateGroup() {
    if (!supabase) return;
    setIsWorking(true);
    setMessage(null);
    const code = createInviteCode();
    const { data, error } = await supabase.rpc('create_group_with_code', {
      group_name: groupName.trim() || 'わが家',
      code,
    });
    setIsWorking(false);
    if (error || !data) {
      setMessage(`グループを作れませんでした：${error?.message ?? '不明なエラー'}`);
      return;
    }
    window.localStorage.setItem(GROUP_ID_STORAGE_KEY, data as string);
    window.localStorage.removeItem(FORCE_LOCAL_STORAGE_KEY);
    window.alert(`合言葉は「${code}」です。家族にこの合言葉を伝えてください。`);
    onReady();
  }

  async function handleJoinGroup() {
    if (!supabase || !inviteCode.trim()) return;
    setIsWorking(true);
    setMessage(null);
    const { data, error } = await supabase.rpc('join_group_with_code', { code: inviteCode.trim() });
    setIsWorking(false);
    if (error || !data) {
      setMessage(`参加できませんでした：${error?.message ?? '合言葉が違います'}`);
      return;
    }
    window.localStorage.setItem(GROUP_ID_STORAGE_KEY, data as string);
    onReady();
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>ダイエットクエスト</h1>
      </header>

      {stage === 'checking' && <p className="note">確認中…</p>}

      {stage === 'signedOut' && (
        <section className="card">
          <h2 className="card-title">{authMode === 'signUp' ? 'アカウントを作る' : 'ログイン'}</h2>

          <div className="chip-row">
            <button
              type="button"
              className={authMode === 'signUp' ? 'chip is-active' : 'chip'}
              onClick={() => {
                setAuthMode('signUp');
                setMessage(null);
              }}
            >
              はじめて使う
            </button>
            <button
              type="button"
              className={authMode === 'signIn' ? 'chip is-active' : 'chip'}
              onClick={() => {
                setAuthMode('signIn');
                setMessage(null);
              }}
            >
              ログイン
            </button>
          </div>

          <p className="note">
            ひとり1つのアカウントを作ります。メールは送られないので、確認の手間はありません。
            一度作れば、機種変更しても同じアドレスとパスワードで記録がそのまま戻ります。
          </p>
          <p className="note">
            <strong>パスワードは必ず控えてください。</strong>
            メールを送らない設定のため、忘れた場合に再設定できません。
          </p>

          <label className="field">
            <span>メールアドレス</span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label className="field">
            <span>パスワード（6文字以上）</span>
            <input
              type="password"
              autoComplete={authMode === 'signUp' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="primary-button"
            onClick={handleSubmit}
            disabled={isWorking || !email.trim() || password.length < 6}
          >
            {isWorking ? '処理中…' : authMode === 'signUp' ? 'アカウントを作る' : 'ログイン'}
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              window.localStorage.removeItem(GROUP_ID_STORAGE_KEY);
              window.localStorage.setItem(FORCE_LOCAL_STORAGE_KEY, '1');
              onReady();
            }}
          >
            共有せず、この端末だけで使う
          </button>
        </section>
      )}

      {stage === 'chooseGroup' && (
        <>
          <section className="card">
            <h2 className="card-title">家族グループを作る（最初の1人だけ）</h2>
            <p className="note">
              いちばん最初の人がここでグループを作ります。合言葉が1つ表示されるので、
              それを家族に伝えてください。
            </p>
            <label className="field">
              <span>グループの名前</span>
              <input
                type="text"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
              />
            </label>
            <button type="button" className="primary-button" onClick={handleCreateGroup} disabled={isWorking}>
              作る
            </button>
          </section>

          <section className="card">
            <h2 className="card-title">合言葉で参加する（2人目から）</h2>
            <p className="note">
              先に作った人から聞いた合言葉を入れると、同じ家族グループに入れます。
            </p>
            <label className="field">
              <span>合言葉（英数字6桁）</span>
              <input
                type="text"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                maxLength={6}
              />
            </label>
            <button type="button" className="primary-button" onClick={handleJoinGroup} disabled={isWorking}>
              参加する
            </button>
          </section>
        </>
      )}

      {message && <p className="alert">{message}</p>}
    </main>
  );
}
