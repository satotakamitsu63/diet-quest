import { useCallback, useEffect, useState } from 'react';
import { createInviteCode } from '../lib/repository';
import { supabase } from '../lib/supabaseClient';

export const GROUP_ID_STORAGE_KEY = 'diet-quest:group-id';
/** 共有せずこの端末だけで使う、と選んだことを覚えておく。 */
export const FORCE_LOCAL_STORAGE_KEY = 'diet-quest:force-local';

type Stage = 'checking' | 'signedOut' | 'linkSent' | 'chooseGroup';

type MembershipRow = { group_id: string; family_groups: { name: string; invite_code: string } | null };

type Props = { onReady: () => void };

/**
 * Supabase を使う設定のときに、ログインと家族グループへの参加を済ませる画面。
 * ここを通らないと行レベルセキュリティにより家族のデータを読めない。
 */
export function SupabaseGate({ onReady }: Props) {
  const [stage, setStage] = useState<Stage>('checking');
  const [email, setEmail] = useState('');
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

  async function handleSendLink() {
    if (!supabase || !email.trim()) return;
    setIsWorking(true);
    setMessage(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // オリジンだけだと /diet-quest/ のようなサブパス配信で戻り先が 404 になる
      options: { emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).href },
    });
    setIsWorking(false);
    if (error) setMessage(`ログイン用のメールを送れませんでした：${error.message}`);
    else setStage('linkSent');
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
          <h2 className="card-title">ログイン</h2>
          <p className="note">
            ひとり1つのアカウントを作ります。メールアドレスを入れるとログイン用のリンクが届くので、
            それを開けば完了です。パスワードは決めなくてかまいません。
          </p>
          <p className="note">
            一度ログインすれば、その端末では次から入力は要りません。機種変更のときは同じ
            メールアドレスでログインし直せば、記録もキャラクターもそのまま戻ります。
          </p>
          <p className="note">
            子どものぶんのメールアドレスが無いときは、保護者のアドレスに <code>+</code> と名前を
            足したもの（例：<code>oya+yui@gmail.com</code>）が使えます。別のアカウントとして扱われますが、
            リンクは保護者の受信箱に届きます。
          </p>
          <label className="field">
            <span>メールアドレス</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <button type="button" className="primary-button" onClick={handleSendLink} disabled={isWorking}>
            {isWorking ? '送信中…' : 'ログイン用のリンクを送る'}
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

      {stage === 'linkSent' && (
        <section className="card">
          <h2 className="card-title">メールを確認してください</h2>
          <p className="note">{email} にログイン用のリンクを送りました。リンクを開くと続きに進みます。</p>
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
