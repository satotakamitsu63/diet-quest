#!/usr/bin/env bash
# 実機確認用の自己署名証明書を作る。
# 音声認識はブラウザが「安全なコンテキスト」でしか許可しないため、HTTPS が必要。
# LAN の IP を証明書の対象に含めないと iPhone の Safari が接続を拒否する。
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p certs

LAN_IP="${1:-$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1)}"
echo "証明書に含める IP: ${LAN_IP}"

openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout certs/dev-key.pem -out certs/dev-cert.pem \
  -subj "/CN=diet-quest-dev" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:${LAN_IP}" \
  -addext "basicConstraints=critical,CA:TRUE" 2>/dev/null

echo "certs/dev-cert.pem を作りました。"
