#!/bin/bash
# ============================================================
#  スレスパ2（Mac）の history フォルダ（すべてのSteamID・すべての profile）から
#  .run ファイルだけを ~/sts2-runs（ホームフォルダの中の sts2-runs）へコピーし、
#  最後にアプリのページを開きます。
#  ・コピー先にまだ無いファイルだけをコピーします
#  ・元のファイル（ゲームの保存先）は読むだけで、変更も削除も移動もしません
#  ・.run.backup はコピーしません
#  ※ Mac での保存場所と動作は未確認です（下の SRC_ROOT）
# ============================================================

URL="https://okitakunai.github.io/sts2-stats/"
# 動作テスト用の設定値（環境変数）。ふだんは使いません
#   STS2_SRC_ROOT：コピー元の steam フォルダ ／ STS2_DEST：コピー先 ／ STS2_NO_BROWSER：ページを開かない
SRC_ROOT="${STS2_SRC_ROOT:-$HOME/Library/Application Support/SlayTheSpire2/steam}"
DEST="${STS2_DEST:-$HOME/sts2-runs}"

finish() {
  echo
  # ダブルクリックで開いた場合は、キーを押すまで画面を残す（Mac では自動で閉じない）
  if [ -t 0 ]; then read -n 1 -s -r -p "何かキーを押すと閉じます"; echo; fi
  exit "${1:-0}"
}
stop() {
  echo
  echo "アプリのページは開きません。"
  finish 1
}
size_of() { wc -c < "$1" | tr -d ' '; }

echo "スレスパ2のラン記録（.run）をコピーします。"
echo "コピー先：$DEST"
echo

if [ ! -d "$SRC_ROOT" ]; then
  echo "ゲームの保存先が見つかりませんでした：$SRC_ROOT"
  echo "Mac での保存場所は未確認です。Finder で「SlayTheSpire2」を検索して、"
  echo "steam → 数字のフォルダ → profile（番号） → saves → history があるか確かめてください。"
  stop
fi

shopt -s nullglob
ids=0; hist=0; new=0; skip=0; sizediff=0; failed=0
# steam の下にある数字のフォルダ（SteamID）と、その中の profile をすべて探す
for id in "$SRC_ROOT"/*/; do
  found_here=0
  for dir in "$id"profile*/saves/history; do
    [ -d "$dir" ] || continue
    hist=$((hist + 1)); found_here=1
    mkdir -p "$DEST" || { echo "コピー先のフォルダを作れませんでした：$DEST"; stop; }
    for f in "$dir"/*.run; do
      name="$(basename "$f")"
      if [ -e "$DEST/$name" ]; then
        # コピー先に同じ名前があれば一切触らない（大きさが違えば数えるだけ）
        if [ "$(size_of "$f")" = "$(size_of "$DEST/$name")" ]; then skip=$((skip + 1)); else sizediff=$((sizediff + 1)); fi
        continue
      fi
      if cp -p "$f" "$DEST/$name"; then new=$((new + 1)); else failed=$((failed + 1)); fi
    done
  done
  [ "$found_here" -eq 1 ] && ids=$((ids + 1))
done

if [ "$hist" -eq 0 ]; then
  echo "history フォルダが見つかりませんでした。"
  echo "探した場所：$SRC_ROOT/（数字のフォルダ）/profile（番号）/saves/history"
  stop
fi

echo "見つかった history フォルダ：$hist 個"
echo "新しくコピーした .run ファイル：$new 件"
echo "既にあったので飛ばした .run ファイル：$skip 件"
[ "$new" -eq 0 ] && echo "新しいランはありませんでした。"

if [ "$ids" -gt 1 ]; then
  echo
  echo "※注意：SteamID のフォルダが $ids 個あります。別のアカウントの記録が混ざる可能性があります。"
  echo "　　　　混ざると、シングルの集計に他のアカウントのランが入ります。分けたい場合は README を見てください。"
fi
if [ "$sizediff" -gt 0 ]; then
  echo
  echo "※注意：同じ名前だが大きさが違うため、コピーしなかったファイルが $sizediff 件あります。"
  echo "　　　　ゲームが書き込んでいる途中にコピーして、途中までしか入っていない可能性もあります。"
  echo "　　　　ゲームを終了してから、sts2-runs の中のそのファイルを消して、もう一度実行してください。"
fi
if [ "$failed" -gt 0 ]; then
  echo
  echo "※一部のファイル（$failed 件）をコピーできませんでした。ゲームを終了してから、もう一度実行してください。"
fi

echo
echo "アプリのページを開きます：$URL"
if [ -z "$STS2_NO_BROWSER" ]; then
  open "$URL" 2>/dev/null || echo "ページを自動で開けませんでした。ブラウザで上のアドレスを開いてください。"
fi
finish 0
