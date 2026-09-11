import type { Profile } from './types';

const DATABASE_NAME = 'diet-quest-private-avatar';
const STORE_NAME = 'level-images';
const DATABASE_VERSION = 1;

type AvatarImageRecord = {
  id: string;
  image: Blob;
};

function avatarScope(profile: Profile): string {
  return profile.ownerId ?? profile.id;
}

function recordId(profile: Profile, level: number): string {
  return `${avatarScope(profile)}:${level}`;
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

function levelFromFile(file: File): number | null {
  const match = file.name.match(/^(10|[1-9])\.(png|jpe?g|webp)$/i);
  return match ? Number(match[1]) : null;
}

/** 1.png〜10.png をブラウザ内のみに保存する。サーバー・公開フォルダへは送らない。 */
export async function savePrivateAvatarSet(profile: Profile, files: File[]): Promise<void> {
  const byLevel = new Map<number, File>();
  for (const file of files) {
    const level = levelFromFile(file);
    if (level !== null) byLevel.set(level, file);
  }
  if (byLevel.size !== 10 || Array.from({ length: 10 }, (_, index) => !byLevel.has(index + 1)).some(Boolean)) {
    throw new Error('1.png〜10.png の10枚をまとめて選んでください。');
  }
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

/** 指定レベルの画像を取り出す。呼び出し側が作った Object URL は利用後に解放する。 */
export async function loadPrivateAvatarImage(profile: Profile, level: number): Promise<string | null> {
  const record = await withStore<AvatarImageRecord | undefined>('readonly', (store) => store.get(recordId(profile, level)));
  return record ? URL.createObjectURL(record.image) : null;
}

/** このアカウントの端末内にある本人キャラクター画像だけを削除する。 */
export async function removePrivateAvatarSet(profile: Profile): Promise<void> {
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
