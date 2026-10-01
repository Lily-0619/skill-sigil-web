#!/bin/zsh

cd "${0:A:h}" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

package_manager="npm"
if ! command -v npm >/dev/null 2>&1; then
  codex_runtime="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies"
  if [[ -x "$codex_runtime/node/bin/node" && -x "$codex_runtime/bin/fallback/pnpm" ]]; then
    export PATH="$codex_runtime/node/bin:$codex_runtime/bin/fallback:$PATH"
    package_manager="pnpm"
  else
    echo "Node.jsが見つかりません。Node.jsのLTS版をインストールしてから、もう一度開いてください。"
    echo
    read "?Enterキーで閉じます。"
    exit 1
  fi
fi

if [[ ! -x "node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" ]]; then
  echo "Mac用の編集アプリを準備しています（初回のみ）。"
  if [[ "$package_manager" == "pnpm" ]]; then
    pnpm install --lockfile=false && pnpm rebuild electron esbuild
  else
    npm install
  fi
  if (( $? != 0 )); then
    echo
    read "?準備に失敗しました。表示内容を確認し、Enterキーで閉じます。"
    exit 1
  fi
fi

$package_manager run editor
exit_code=$?
if (( exit_code != 0 )); then
  echo
  read "?起動に失敗しました。表示内容を確認し、Enterキーで閉じます。"
fi
exit $exit_code
