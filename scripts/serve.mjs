/*
 * app.html を家の Wi-Fi 内に配るだけの、ごく小さなサーバ。
 * 外部サービスも証明書も使わない。Mac のファイアウォールが node を
 * 許可しているため、python の http.server と違ってそのまま LAN に出られる。
 */
import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

const PORT = Number(process.env.PORT ?? 8766);
const FILE = 'app.html';

try {
  statSync(FILE);
} catch {
  console.error(`${FILE} がありません。先に npm run bundle を実行してください。`);
  process.exit(1);
}

createServer((request, response) => {
  // 単一ファイルなので、どのパスで来ても同じものを返す
  const body = readFileSync(FILE);
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  response.end(request.method === 'HEAD' ? undefined : body);
}).listen(PORT, '0.0.0.0', () => {
  const addresses = Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);

  console.log('スマホから次のアドレスを開いてください（同じ Wi-Fi に接続した状態で）:');
  for (const address of addresses) console.log(`  http://${address}:${PORT}`);
  console.log(`\nこの Mac からの確認用: http://localhost:${PORT}`);
  console.log('止めるときは Ctrl+C');
});
