import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const keyPath = path.resolve(__dirname, 'certs/dev-key.pem');
const certPath = path.resolve(__dirname, 'certs/dev-cert.pem');

/**
 * 音声認識はブラウザが「安全なコンテキスト」でしか許可しないため、
 * 実機で確認するときは HTTPS で配信する。
 * 証明書は scripts/make-cert.sh で作る。無ければ HTTP のまま起動する。
 */
const httpsOptions =
  fs.existsSync(keyPath) && fs.existsSync(certPath)
    ? { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }
    : undefined;

export default defineConfig({
  // GitHub Pages は https://<user>.github.io/diet-quest/ で配信されるため、
  // 配信元のサブパスを基準にする。環境変数で上書きできるようにしておく。
  base: process.env.VITE_BASE_PATH ?? '/diet-quest/',
  plugins: [react()],
  server: { port: 5173, host: true, https: httpsOptions },
});
