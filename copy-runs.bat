@echo off
chcp 65001 > nul
setlocal
title スレスパ2 ラン記録のコピー

rem ============================================================
rem  スレスパ2の history フォルダ（すべてのSteamID・すべての profile）から
rem  .run ファイルだけを「%USERPROFILE%\sts2-runs」（例：C:\Users\あなたの名前\sts2-runs）へ
rem  コピーし、最後にアプリのページを開きます。
rem  ・コピー先にまだ無いファイルだけをコピーします
rem  ・元のファイル（ゲームの保存先）は読むだけで、変更も削除も移動もしません
rem  ・.run.backup はコピーしません
rem  OneDrive の中のフォルダは、SteamID を含むファイルが同期されるので避けています。
rem ============================================================

set "URL=https://okitakunai.github.io/sts2-stats/"
set "SRC_ROOT=%APPDATA%\SlayTheSpire2\steam"
set "DEST=%USERPROFILE%\sts2-runs"
rem 動作テスト用の設定値（環境変数）。ふだんは使いません
rem   STS2_SRC_ROOT：コピー元の steam フォルダ ／ STS2_DEST：コピー先
rem   STS2_NO_BROWSER：ページを開かない ／ STS2_NO_WAIT：最後に待たない
if defined STS2_SRC_ROOT set "SRC_ROOT=%STS2_SRC_ROOT%"
if defined STS2_DEST set "DEST=%STS2_DEST%"

echo スレスパ2のラン記録（.run）をコピーします。
echo コピー先：%DEST%
echo.

if not exist "%SRC_ROOT%\" (
  echo ゲームの保存先が見つかりませんでした：%SRC_ROOT%
  echo スレスパ2をSteam版で一度起動したことがあるか確認してください。
  goto :stop
)

set IDS=0
set HIST=0
set NEW=0
set SKIP=0
set SIZEDIFF=0
set FAILED=0
rem steam の下にある数字のフォルダ（SteamID）と、その中の profile をすべて探す
for /d %%S in ("%SRC_ROOT%\*") do call :scan_id "%%~fS"

if "%HIST%"=="0" (
  echo history フォルダが見つかりませんでした。
  echo 探した場所：%SRC_ROOT%\（数字のフォルダ）\profile（番号）\saves\history
  goto :stop
)

echo 見つかった history フォルダ：%HIST% 個
echo 新しくコピーした .run ファイル：%NEW% 件
echo 既にあったので飛ばした .run ファイル：%SKIP% 件
if "%NEW%"=="0" echo 新しいランはありませんでした。

set WARN=0
if not "%IDS%"=="1" (
  set WARN=1
  echo.
  echo ※注意：SteamID のフォルダが %IDS% 個あります。別のアカウントの記録が混ざる可能性があります。
  echo 　　　　混ざると、シングルの集計に他のアカウントのランが入ります。分けたい場合は README を見てください。
)
if not "%SIZEDIFF%"=="0" (
  set WARN=1
  echo.
  echo ※注意：同じ名前だが大きさが違うため、コピーしなかったファイルが %SIZEDIFF% 件あります。
  echo 　　　　ゲームが書き込んでいる途中にコピーして、途中までしか入っていない可能性もあります。
  echo 　　　　ゲームを終了してから、sts2-runs の中のそのファイルを消して、もう一度実行してください。
)
if not "%FAILED%"=="0" (
  set WARN=1
  echo.
  echo ※一部のファイル（%FAILED% 件）をコピーできませんでした。ゲームを終了してから、もう一度実行してください。
)

echo.
echo アプリのページを開きます：%URL%
if not defined STS2_NO_BROWSER start "" "%URL%"

if "%WARN%"=="1" goto :wait
rem 何も問題が無いときだけ、5秒後に自動で閉じる
if defined STS2_NO_WAIT exit /b 0
echo この画面は5秒後に閉じます。
timeout /t 5 /nobreak > nul
exit /b 0

:stop
echo.
echo アプリのページは開きません。
:wait
if defined STS2_NO_WAIT exit /b 1
echo.
pause
exit /b 1

rem ---- SteamID のフォルダ1つ分を調べる
:scan_id
set FOUND_HERE=0
for /d %%P in ("%~1\profile*") do (
  if exist "%%~fP\saves\history\" call :copy_one "%%~fP\saves\history"
)
if not "%FOUND_HERE%"=="0" set /a IDS+=1
exit /b 0

rem ---- history フォルダ1つ分をコピーする
:copy_one
set /a HIST+=1
set /a FOUND_HERE+=1
if not exist "%DEST%\" mkdir "%DEST%"
for %%F in ("%~1\*.run") do (
  if /i "%%~xF"==".run" call :copy_file "%%~fF" "%%~nxF" "%%~zF"
)
exit /b 0

rem ---- ファイル1つ：コピー先に同じ名前があれば一切触らない（大きさが違えば数えるだけ）
:copy_file
if exist "%DEST%\%~2" (
  call :compare_size "%DEST%\%~2" "%~3"
  exit /b 0
)
copy /b "%~1" "%DEST%\%~2" > nul 2>&1
if errorlevel 1 (set /a FAILED+=1) else (set /a NEW+=1)
exit /b 0

:compare_size
if "%~z1"=="%~2" (set /a SKIP+=1) else (set /a SIZEDIFF+=1)
exit /b 0
