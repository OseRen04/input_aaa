#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
if ! command -v gh >/dev/null 2>&1; then
  echo 'GitHub CLI がありません。Macでは brew install gh を実行してください。' >&2
  exit 1
fi
if ! gh auth status >/dev/null 2>&1; then
  echo 'GitHubの認証がありません。gh auth login を実行してください。' >&2
  exit 1
fi
if git remote get-url origin >/dev/null 2>&1; then
  echo 'origin は既に登録されています。誤って他のリポジトリにpushしないよう処理を停止しました。' >&2
  exit 1
fi
if [ ! -d .git ]; then git init -b main; fi
if [ -z "$(git config user.name || true)" ] || [ -z "$(git config user.email || true)" ]; then
  echo 'Gitの本人情報が未設定です。git config --global user.name と user.email を設定してください。' >&2
  exit 1
fi
git add .
if ! git diff --cached --quiet; then
  git commit -m 'feat: add PLaMo offline Chrome translation extension'
fi
gh repo create local-input-translator --public --source=. --remote=origin --push
echo '公開リポジトリへのpushが完了しました。'
