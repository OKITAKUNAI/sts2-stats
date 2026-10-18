@echo off
chcp 65001 > nul
setlocal
title スレスパ2 ラン記録のコピー

rem ============================================================
rem  スレスパ2の history フォルダから .run ファイルだけを
rem  「%USERPROFILE%\sts2-runs」（例：C:\Users\あなたの名前\sts2-runs）へコピーします。
rem  OneDrive の中のフォルダは、SteamID を含むファイルが同期されるので避けています。
rem  ・コピー先にまだ無いファイルだけをコピーします
rem  ・元のファイル（ゲームの保存先）は読むだけで、変更も削除もしません
rem  ・.run.backup はコピーしません
rem ============================================================

set "SRC_ROOT=%APPDATA%\SlayTheSpire2\steam"
rem 動作テスト用：STS2_SRC_ROOT / STS2_DEST が設定されていればそちらを使う
if defined STS2_SRC_ROOT set "SRC_ROOT=%STS2_SRC_ROOT%"

set "DEST=%USERPROFILE%\sts2-runs"
if defined STS2_DEST set "DEST=%STS2_DEST%"

echo スレスパ2のラン記録（.run）をコピーします。
echo コピー先：%DEST%
echo.

if not exist "%SRC_ROOT%\" (
  echo ゲームの保存先が見つかりませんでした：%SRC_ROOT%
  echo スレスパ2をSteam版で一度起動したことがあるか確認してください。
  goto :end
)

if not exist "%DEST%\" mkdir "%DEST%"
if not exist "%DEST%\" (
  echo コピー先のフォルダを作れませんでした：%DEST%
  goto :end
)

call :count_runs BEFORE
set FOUND=0
set FAILED=0
rem steam の下にある数字のフォルダ（SteamID）を自動で探す
for /d %%S in ("%SRC_ROOT%\*") do (
  if exist "%%S\profile1\saves\history\" call :copy_one "%%S\profile1\saves\history"
)

if "%FOUND%"=="0" (
  echo history フォルダが見つかりませんでした。
  echo 探した場所：%SRC_ROOT%\（数字のフォルダ）\profile1\saves\history
  goto :end
)

call :count_runs AFTER
set /a NEW=AFTER-BEFORE
echo 見つかった history フォルダ：%FOUND% 個
echo 新しくコピーした .run ファイル：%NEW% 件
echo コピー先にある .run ファイルの合計：%AFTER% 件
if not "%FAILED%"=="0" echo ※一部のファイルをコピーできませんでした。ゲームを終了してから、もう一度実行してください。
echo.
echo ブラウザのアプリでは、このフォルダを選んでください：
echo %DEST%

:end
echo.
pause
exit /b 0

rem ---- history フォルダ1つ分をコピーする
:copy_one
set /a FOUND+=1
rem /XC /XN /XO：コピー先に同じ名前のファイルがあれば一切触らない（＝新しいファイルだけコピー）
rem /XF *.backup：.run.backup はコピーしない
rem 削除を伴うオプション（/MIR /PURGE /MOV）は使っていない
robocopy "%~1" "%DEST%" *.run /XF *.backup /XC /XN /XO /R:0 /W:0 /NP /NFL /NDL /NJH /NJS > nul
if errorlevel 8 set /a FAILED+=1
exit /b 0

rem ---- コピー先の .run の件数を数える
:count_runs
set "%1=0"
for /f %%N in ('dir /b /a-d "%DEST%\*.run" 2^>nul ^| find /c /v ""') do set "%1=%%N"
exit /b 0
