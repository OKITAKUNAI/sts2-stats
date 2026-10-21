@echo off
rem このファイルは Shift_JIS で保存しています（日本語の Windows で文字化けせず、途中で文字コードを切り替えずに確実に動くように）
setlocal
title スレスパ2 ラン記録集計（確認用サーバー）

rem ============================================================
rem  このフォルダを、このパソコンの中だけで見られるサーバーとして開き、
rem  ブラウザでアプリを表示します。
rem  ・外部（ほかのパソコンやインターネット）からは見られません（127.0.0.1 のみ）
rem  ・終わるときは、この黒い画面を閉じるか Ctrl＋C を押します
rem ============================================================

set "PORT=8765"
rem 動作テスト用：STS2_PORT / STS2_NO_BROWSER が設定されていればそちらに従う
if defined STS2_PORT set "PORT=%STS2_PORT%"
set "URL=http://127.0.0.1:%PORT%/"

rem このバッチファイルがあるフォルダに移動する
cd /d "%~dp0"

rem すでに起動している場合は、ブラウザで開くだけにする
netstat -ano | findstr /r /c:"127\.0\.0\.1:%PORT% .*LISTENING" > nul
if not errorlevel 1 (
  echo サーバーはすでに起動しています。ブラウザで開きます：%URL%
  if not defined STS2_NO_BROWSER start "" "%URL%"
  goto :end
)

set "PY="
where python > nul 2>&1 && set "PY=python"
if not defined PY where py > nul 2>&1 && set "PY=py"
if not defined PY (
  echo Python が見つかりませんでした。
  echo https://www.python.org/ からインストールするか、README の「別の開き方」を見てください。
  goto :end
)

echo アプリを表示します：%URL%
echo.
echo この画面は、アプリを使っている間は閉じないでください（最小化は大丈夫です）。
echo 終わるときは、この画面を閉じるか Ctrl＋C を押してください。
echo.
if not defined STS2_NO_BROWSER start "" "%URL%"
%PY% -m http.server %PORT% --bind 127.0.0.1
echo.
echo サーバーが止まりました。

:end
echo.
pause
