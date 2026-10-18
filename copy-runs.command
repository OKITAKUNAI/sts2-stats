#!/bin/bash
# ============================================================
#  スレスパ2（Mac）の history フォルダから .run ファイルだけを
#  ~/sts2-runs（あなたのホームフォルダの中の sts2-runs）へコピーします。
#  ・コピー先にまだ無いファイルだけをコピーします
#  ・元のファイル（ゲームの保存先）は読むだけで、変更も削除もしません
#  ・.run.backup はコピーしません
#  ※ Mac の保存場所は未確認です（下の SRC_ROOT）。見つからない場合はメッセージが出ます
# ============================================================

# 動作テスト用：STS2_SRC_ROOT / STS2_DEST が設定されていればそちらを使う
SRC_ROOT="${STS2_SRC_ROOT:-$HOME/Library/Application Support/SlayTheSpire2/steam}"
DEST="${STS2_DEST:-$HOME/sts2-runs}"

finish() {
  echo
  # ダブルクリックで開いた場合は、キーを押すまで画面を残す
  if [ -t 0 ]; then read -n 1 -s -r -p "何かキーを押すと閉じます"; echo; fi
  exit 0
}

echo "スレスパ2のラン記録（.run）をコピーします。"
echo "コピー先：$DEST"
echo

if [ ! -d "$SRC_ROOT" ]; then
  echo "ゲームの保存先が見つかりませんでした：$SRC_ROOT"
  echo "Mac での保存場所は未確認です。Finder で「SlayTheSpire2」を検索して、"
  echo "steam → 数字のフォルダ → profile1 → saves → history があるか確かめてください。"
  finish
fi

if ! mkdir -p "$DEST"; then
  echo "コピー先のフォルダを作れませんでした：$DEST"
  finish
fi

shopt -s nullglob
before=0; for f in "$DEST"/*.run; do before=$((before + 1)); done
found=0
failed=0
# steam の下にある数字のフォルダ（SteamID）を自動で探す
for dir in "$SRC_ROOT"/*/profile1/saves/history; do
  [ -d "$dir" ] || continue
  found=$((found + 1))
  for f in "$dir"/*.run; do
    name="$(basename "$f")"
    # コピー先に同じ名前のファイルがあれば一切触らない（＝新しいファイルだけコピー）
    [ -e "$DEST/$name" ] && continue
    cp -p "$f" "$DEST/$name" || failed=$((failed + 1))
  done
done

if [ "$found" -eq 0 ]; then
  echo "history フォルダが見つかりませんでした。"
  echo "探した場所：$SRC_ROOT/（数字のフォルダ）/profile1/saves/history"
  finish
fi

after=0; for f in "$DEST"/*.run; do after=$((after + 1)); done
echo "見つかった history フォルダ：$found 個"
echo "新しくコピーした .run ファイル：$((after - before)) 件"
echo "コピー先にある .run ファイルの合計：$after 件"
[ "$failed" -gt 0 ] && echo "※一部のファイルをコピーできませんでした。ゲームを終了してから、もう一度実行してください。"
echo
echo "ブラウザのアプリでは、このフォルダを選んでください："
echo "$DEST"
finish
