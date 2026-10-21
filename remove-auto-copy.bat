@echo off
rem このファイルは Shift_JIS で保存しています（日本語の Windows で文字化けせず、途中で文字コードを切り替えずに確実に動くように）
setlocal
title スレスパ2 ラン記録の自動コピーを止める

rem ============================================================
rem  setup-auto-copy.bat で登録した自動コピーを止めます。
rem  ・タスク スケジューラのタスク「STS2-copy-runs」を削除します
rem  ・setup-auto-copy.bat が作った2つのファイルだけを消します
rem    （%LOCALAPPDATA%\sts2-stats\copy-runs.bat と last-copy.txt）
rem  ・sts2-runs（コピーしたラン）とゲームの保存先には一切触れません
rem ============================================================

set "TASK=STS2-copy-runs"
set "APPDIR=%LOCALAPPDATA%\sts2-stats"
rem 動作テスト用の設定値（環境変数）。ふだんは使いません
if defined STS2_TASK set "TASK=%STS2_TASK%"
if defined STS2_APPDIR set "APPDIR=%STS2_APPDIR%"

set "STS2_REG_TASK=%TASK%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$t=Get-ScheduledTask -TaskName $env:STS2_REG_TASK -ErrorAction SilentlyContinue;" ^
  "if ($t) { Unregister-ScheduledTask -TaskName $env:STS2_REG_TASK -Confirm:$false; 'タスクを削除しました。' } else { '登録されたタスクはありませんでした。' }"

rem 自分で作ったファイルだけを、名前を指定して消す（* などは使わない）
if exist "%APPDIR%\copy-runs.bat" del "%APPDIR%\copy-runs.bat"
if exist "%APPDIR%\last-copy.txt" del "%APPDIR%\last-copy.txt"
rem フォルダは空のときだけ消える形で消す（/s は使わない）
if exist "%APPDIR%\" rmdir "%APPDIR%" > nul 2>&1

echo 自動コピーを止めました。sts2-runs の中のランはそのまま残っています。
echo もう一度使うときは setup-auto-copy.bat を実行してください。

if defined STS2_NO_WAIT exit /b 0
echo.
pause
exit /b 0
