#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
# shellcheck disable=SC1090
source "$NVM_DIR/nvm.sh"

NODE_VERSION="24"
nvm install "$NODE_VERSION"
nvm use "$NODE_VERSION"

corepack enable
corepack prepare pnpm@10.10.0 --activate

pnpm install --frozen-lockfile
pnpm run build
