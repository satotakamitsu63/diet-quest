import { isSupabaseConfigured, supabase } from './supabaseClient';
import type { Profile } from './types';

const BUCKET_NAME = 'avatar-level-images';
const DATABASE_NAME = 'diet-quest-private-avatar';
const STORE_NAME = 'level-images';
const DATABASE_VERSION = 1;

type AvatarImageRecord = {
  id: string;
  image: Blob;
};

export type AvatarImageSource = {
  url: string;
  revoke: () => void;
};

function avatarScope(profile: Profile): string {
  return profile.ownerId ?? profile.id;
}

function recordId(profile: Profile, level: number): string {
  return `${avatarScope(profile)}:${level}`;
}

function objectPath(userId: string, profile: Profile, level: number): string {
  return `${userId}/${profile.id}/levels/${level}.avatar`;
}

function levelFromFile(file: File): number | null {
  const match = file.name.match(/^(10|[1-9])\.(png|jpe?g|webp)$/i);
  return match ? Number(match[1]) : null;
}

function filesByLevel(files: File[]): Map<number, File> {
  const byLevel = new Map<number, File>();
  for (const file of files) {
    const level = levelFromFile(file);
    if (level !== null) byLevel.set(level, file);
  }
  if (byLevel.size !== 10 || Array.from({ length: 10 }, (_, index) => !byLevel.has(index + 1)).some(Boolean)) {
    throw new Error('1.png〜10.png の10枚をまとめて選んでください。');
  }
  return byLevel;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('本人キャラクターの保存領域を開けませんでした。'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('本人キャラクターを保存できませんでした。'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error ?? new Error('本人キャラクターの保存処理に失敗しました。'));
  });
}

async function currentUserId(profile: Profile): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('本人キャラクターを使うにはログインが必要です。');
  // 旧プロフィールは owner_id が未設定のことがある。画像登録の直後にプロフィールを
  // 保存すると所有者が確定するため、その初回登録だけは現在ログイン中の本人に許可する。
  if (profile.ownerId !== null && profile.ownerId !== data.user.id) {
    throw new Error('本人キャラクターは、このプロフィールの所有者だけが操作できます。');
  }
  return data.user.id;
}

async function saveToBrowser(profile: Profile, byLevel: Map<number, File>): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (const [level, file] of byLevel) {
      store.put({ id: recordId(profile, level), image: file } satisfies AvatarImageRecord);
    }
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error ?? new Error('本人キャラクターを保存できませんでした。'));
  });
}

async function removeFromBrowser(profile: Profile): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    for (let level = 1; level <= 10; level += 1) store.delete(recordId(profile, level));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error ?? new Error('本人キャラクターを削除できませんでした。'));
  });
}

async function loadFromBrowser(profile: Profile, level: number): Promise<AvatarImageSource | null> {
  const record = await withStore<AvatarImageRecord | undefined>('readonly', (store) => store.get(recordId(profile, level)));
  if (!record) return null;
  const url = URL.createObjectURL(record.image);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

/** 1.png〜10.png を、Supabase利用時はログイン本人だけが読める非公開バケットへ保存する。 */
export async function savePrivateAvatarSet(profile: Profile, files: File[]): Promise<void> {
  const byLevel = filesByLevel(files);
  const userId = await currentUserId(profile);
  if (!userId || !supabase) {
    await saveToBrowser(profile, byLevel);
    return;
  }
  for (const [level, file] of byLevel) {
    const { error } = await supabase.storage.from(BUCKET_NAME).upload(objectPath(userId, profile, level), file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) throw new Error(`レベル${level}の画像を非公開保存できませんでした。${error.message}`);
  }
}

/** ログイン本人用の短時間署名付きURL、またはローカル保存画像を返す。 */
export async function loadPrivateAvatarImage(profile: Profile, level: number): Promise<AvatarImageSource | null> {
  const userId = await currentUserId(profile);
  if (userId && supabase) {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(objectPath(userId, profile, level), 60 * 15);
    if (!error && data?.signedUrl) return { url: data.signedUrl, revoke: () => undefined };
  }
  return loadFromBrowser(profile, level);
}

/** 本人キャラクターを非公開ストレージと、この端末のキャッシュから削除する。 */
export async function removePrivateAvatarSet(profile: Profile): Promise<void> {
  const userId = await currentUserId(profile);
  if (userId && supabase) {
    const paths = Array.from({ length: 10 }, (_, index) => objectPath(userId, profile, index + 1));
    const { error } = await supabase.storage.from(BUCKET_NAME).remove(paths);
    if (error) throw new Error(`本人キャラクターを削除できませんでした。${error.message}`);
  }
  await removeFromBrowser(profile);
}
