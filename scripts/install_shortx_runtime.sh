#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SHORTX_ROOT="${1:-}"

if [ -z "$SHORTX_ROOT" ]; then
  SHORTX_ROOT="$(su --mount-master -c '
    for d in /data/system/shortx_*; do
      if [ -d "$d/ClipHub/probes" ]; then
        printf "%s\n" "$d"
      fi
    done
  ' | head -n 1)"
fi

case "$SHORTX_ROOT" in
  /data/system/shortx_*) ;;
  *)
    echo "错误：无法确定 ShortX 根目录，请把路径作为第一个参数传入。" >&2
    exit 1
    ;;
esac

TARGET="$SHORTX_ROOT/ClipHub"
SOURCE_COUNT="$(find "$REPO_DIR/src" -maxdepth 1 -type f -name 'ch_*.js' | wc -l | tr -d ' ')"

if [ "$SOURCE_COUNT" != "15" ]; then
  echo "错误：仓库 src 中应有 15 个模块，当前为 $SOURCE_COUNT。" >&2
  exit 1
fi

su --mount-master -c "
  set -e
  TARGET='$TARGET'
  REPO='$REPO_DIR'
  rm -rf \"\$TARGET/modules.new\"
  mkdir -p \"\$TARGET/modules.new\" \"\$TARGET/probes\"
  cp \"\$REPO\"/src/ch_*.js \"\$TARGET/modules.new/\"
  cp \"\$REPO/ClipHub.js\" \"\$TARGET/ClipHub.js.new\"
  chmod 0644 \"\$TARGET/modules.new/\"*.js \"\$TARGET/ClipHub.js.new\"
  chown -R system:system \"\$TARGET/modules.new\" \"\$TARGET/ClipHub.js.new\" 2>/dev/null || true
  rm -rf \"\$TARGET/modules.old\"
  if [ -d \"\$TARGET/modules\" ]; then
    mv \"\$TARGET/modules\" \"\$TARGET/modules.old\"
  fi
  mv \"\$TARGET/modules.new\" \"\$TARGET/modules\"
  mv \"\$TARGET/ClipHub.js.new\" \"\$TARGET/ClipHub.js\"
  rm -rf \"\$TARGET/modules.old\"
  restorecon -RF \"\$TARGET\" 2>/dev/null || true
"

INSTALLED_COUNT="$(su --mount-master -c "find '$TARGET/modules' -maxdepth 1 -type f -name 'ch_*.js' | wc -l" | tr -d '[:space:]')"

if [ "$INSTALLED_COUNT" != "15" ]; then
  echo "错误：安装后模块数量异常：$INSTALLED_COUNT。" >&2
  exit 1
fi

printf 'ClipHub 运行文件已安装：\n%s\n模块数量：%s\n' "$TARGET" "$INSTALLED_COUNT"
