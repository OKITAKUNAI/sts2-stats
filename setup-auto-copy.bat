@echo off
rem このファイルは Shift_JIS で保存しています（日本語の Windows で文字化けせず、途中で文字コードを切り替えずに確実に動くように）
setlocal
title スレスパ2 ラン記録の自動コピーを登録

rem ============================================================
rem  copy-runs.bat を、Windows の「タスク スケジューラ」に登録して、
rem  10分おきに画面を出さずに自動で動かします（管理者の権限は不要）。
rem  ・このファイルと同じフォルダに copy-runs.bat を置いてから実行してください
rem  ・copy-runs.bat を %LOCALAPPDATA%\sts2-stats\ にコピーし、そこから動かします
rem    （copy-runs.bat を新しくしたら、このファイルをもう一度実行してください）
rem  ・止めるときは remove-auto-copy.bat を実行します
rem  ・ゲームの保存先には何も書き込みません（読むだけ）
rem ============================================================

set "TASK=STS2-copy-runs"
set "APPDIR=%LOCALAPPDATA%\sts2-stats"
set "SRC=%~dp0copy-runs.bat"
set "RUNBAT=%APPDIR%\copy-runs.bat"
rem 動作テスト用の設定値（環境変数）。ふだんは使いません
rem   STS2_TASK：タスクの名前 ／ STS2_TASK_BAT：タスクに動かさせるバッチファイル ／ STS2_LOG：結果のファイル
if defined STS2_TASK set "TASK=%STS2_TASK%"
set "LOG=%APPDIR%\last-copy.txt"
if defined STS2_LOG set "LOG=%STS2_LOG%"

echo スレスパ2のラン記録を、10分おきに自動でコピーするよう登録します。
echo.

if defined STS2_TASK_BAT (
  set "RUNBAT=%STS2_TASK_BAT%"
  goto :register
)

if not exist "%SRC%" (
  echo copy-runs.bat が見つかりませんでした。
  echo このファイル（setup-auto-copy.bat）と同じフォルダに copy-runs.bat を保存してから、もう一度実行してください。
  goto :end
)
if not exist "%APPDIR%\" mkdir "%APPDIR%"
copy /b /y "%SRC%" "%RUNBAT%" > nul
if errorlevel 1 (
  echo copy-runs.bat を %APPDIR% にコピーできませんでした。
  goto :end
)

:register
rem PowerShell（Windows 標準の、コマンドで操作する仕組み）でタスクを登録する
rem  ・画面を出さないよう、conhost.exe --headless（画面を作らずにコマンドを動かす Windows の仕組み）経由で動かす
rem  ・電池で動いているときも実行する ／ 前の実行が終わっていなければ重ねて動かさない ／ 5分で打ち切る
set "STS2_REG_TASK=%TASK%"
set "STS2_REG_BAT=%RUNBAT%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$q=[char]34; $bat=$env:STS2_REG_BAT;" ^
  "$a=New-ScheduledTaskAction -Execute (Join-Path $env:WINDIR 'System32\conhost.exe') -Argument ('--headless cmd.exe /c '+$q+$q+$bat+$q+' /quiet'+$q);" ^
  "$t=New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 10);" ^
  "$s=New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5);" ^
  "$p=New-ScheduledTaskPrincipal -UserId ($env:USERDOMAIN+'\'+$env:USERNAME) -LogonType Interactive -RunLevel Limited;" ^
  "Register-ScheduledTask -TaskName $env:STS2_REG_TASK -Action $a -Trigger $t -Settings $s -Principal $p -Force | Out-Null;" ^
  "Start-ScheduledTask -TaskName $env:STS2_REG_TASK"
if errorlevel 1 (
  echo タスクを登録できませんでした。
  goto :end
)

echo 登録しました（タスクの名前：%TASK%）。今、1回目を動かしています…
rem 1回目の結果を待って表示する（最大20秒）
for /l %%i in (1,1,10) do (
  if exist "%LOG%" goto :show
  ping -n 3 127.0.0.1 > nul
)
:show
ping -n 3 127.0.0.1 > nul
echo.
if exist "%LOG%" (
  echo 最後のコピーの結果：
  type "%LOG%"
) else (
  echo まだ結果がありません。数分後に %LOG% を開いて確かめてください。
)
echo.
echo これからは、パソコンにログオンしている間、10分おきに画面を出さずにコピーします。
echo アプリ（https://okitakunai.github.io/sts2-stats/）をブックマークから開くだけで、新しいランが読み込まれます
echo （初回は「sts2-runs フォルダを選ぶ」で sts2-runs を選び、「すべてのアクセスで許可」を選んでください）。
echo 止めるときは remove-auto-copy.bat を実行してください。

:end
if defined STS2_NO_WAIT exit /b 0
echo.
pause
exit /b 0
