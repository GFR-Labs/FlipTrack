#!/bin/bash
set -e

echo "Fetching updates..."
git fetch --tags origin

# If a tag is passed, checkout that version; otherwise pull latest
if [ -n "$1" ]; then
  echo "Checking out $1..."
  git checkout "$1"
else
  git pull
fi

echo "Rebuilding container..."
docker compose up --build -d

echo ""
echo "Done — running $(git describe --tags --always) ($(git log -1 --format='%h %s'))"
