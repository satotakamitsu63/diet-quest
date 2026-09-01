/*
 * ビルド結果を1枚の app.html にまとめる。
 * 症例レコーダー（tha-tka-recorder/app.html）と同じ形にして、
 * python3 -m http.server で配るだけでスマホから使えるようにする。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf-8');

const cssPath = html.match(/href="\.?\/?(assets\/[^"]+\.css)"/)[1];
const jsPath = html.match(/src="\.?\/?(assets\/[^"]+\.js)"/)[1];
const css = readFileSync(join(dist, cssPath), 'utf-8');
const js = readFileSync(join(dist, jsPath), 'utf-8');
const icon = readFileSync(join(dist, 'icon-192.png')).toString('base64');

// スクリプトの中に </script> があると、そこで HTML が閉じてしまう
const safeJs = js.replace(/<\/script/g, '<\\/script');

const output = `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#12101a" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="ダイエットQ" />
    <meta name="format-detection" content="telephone=no" />
    <link rel="apple-touch-icon" href="data:image/png;base64,${icon}" />
    <link rel="icon" href="data:image/png;base64,${icon}" />
    <title>ダイエットクエスト</title>
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
${safeJs}
    </script>
  </body>
</html>
`;

writeFileSync('app.html', output, 'utf-8');
const sizeKb = Math.round(Buffer.byteLength(output, 'utf-8') / 1024);
console.log(`app.html を作成しました（${sizeKb}KB・外部ファイル参照なし）`);
