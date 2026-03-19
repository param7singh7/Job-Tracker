#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_URL="${1:-}"

if [ -z "$REPO_URL" ]; then
  echo "Usage: bash scripts/publish-to-github.sh <github-repo-url>"
  echo "Example: bash scripts/publish-to-github.sh git@github.com:<user>/ireland-job-radar.git"
  exit 1
fi

cd "$ROOT_DIR"

if [ ! -d .git ]; then
  git init
fi

git add .

if ! git diff --cached --quiet; then
  git commit -m "Deploy-ready cloud setup and job radar improvements"
fi

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

git branch -M main
git push -u origin main

echo
echo "Pushed to: $REPO_URL"
echo "Next step: Render -> New + -> Blueprint -> select this repo"
