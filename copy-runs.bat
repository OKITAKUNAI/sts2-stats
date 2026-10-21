@echo off
rem このファイルは Shift_JIS で保存しています（日本語の Windows で文字化けせず、途中で文字コードを切り替えずに確実に動くように）
setlocal
title スレスパ2 ラン記録のコピー

rem ============================================================
rem  スレスパ2の history フォルダ（すべてのSteamID・すべての profile）から
rem  .run ファイルだけを「%USERPROFILE%\sts2-runs」（例：C:\Users\あなたの名前\sts2-runs）へ
rem  コピーし、最後にアプリのページを開きます。
rem  ・コピー先にまだ無いファイルをコピーします
rem  ・コピー先のファイルが元より小さい（書きかけをコピーした）ときは、コピーを上書きして直します
rem  ・元のファイル（ゲームの保存先）は読むだけで、変更も削除も移動もしません
rem  ・.run.backup はコピーしません
rem  ・結果を %LOCALAPPDATA%\sts2-stats\last-copy.txt に1行で書きます（日時と件数だけ）
rem  引数 /quiet：静かなモード（自動実行用）。ページを開かず、待たず、画面も止めません
rem  OneDrive の中のフォルダは、SteamID を含むファイルが同期されるので避けています。
rem ============================================================

set "URL=https://okitakunai.github.io/sts2-stats/"
set "SRC_ROOT=%APPDATA%\SlayTheSpire2\steam"
set "DEST=%USERPROFILE%\sts2-runs"
set "LOG=%LOCALAPPDATA%\sts2-stats\last-copy.txt"
set "QUIET="
if /i "%~1"=="/quiet" set "QUIET=1"
rem 動作テスト用の設定値（環境変数）。ふだんは使いません
rem   STS2_SRC_ROOT：コピー元の steam フォルダ ／ STS2_DEST：コピー先 ／ STS2_LOG：結果を書くファイル
rem   STS2_NO_BROWSER：ページを開かない ／ STS2_NO_WAIT：最後に待たない
if defined STS2_SRC_ROOT set "SRC_ROOT=%STS2_SRC_ROOT%"
if defined STS2_DEST set "DEST=%STS2_DEST%"
if defined STS2_LOG set "LOG=%STS2_LOG%"
if defined QUIET (
  set "STS2_NO_BROWSER=1"
  set "STS2_NO_WAIT=1"
)

echo スレスパ2のラン記録（.run）をコピーします。
echo コピー先：%DEST%
echo.

if not exist "%SRC_ROOT%\" (
  echo ゲームの保存先が見つかりませんでした：%SRC_ROOT%
  echo スレスパ2をSteam版で一度起動したことがあるか確認してください。
  call :log "失敗：ゲームの保存先が見つかりませんでした"
  goto :stop
)

set IDS=0
set HIST=0
set NEW=0
set UPD=0
set SKIP=0
set SIZEDIFF=0
set FAILED=0
rem steam の下にある数字のフォルダ（SteamID）と、その中の profile をすべて探す
for /d %%S in ("%SRC_ROOT%\*") do call :scan_id "%%~fS"

if "%HIST%"=="0" (
  echo history フォルダが見つかりませんでした。
  echo 探した場所：%SRC_ROOT%\（数字のフォルダ）\profile（番号）\saves\history
  call :log "失敗：history フォルダが見つかりませんでした"
  goto :stop
)

echo 見つかった history フォルダ：%HIST% 個
echo 新しくコピーした .run ファイル：%NEW% 件
if not "%UPD%"=="0" echo 書きかけだったコピーを直した .run ファイル：%UPD% 件
echo 既にあったので飛ばした .run ファイル：%SKIP% 件
if "%NEW%"=="0" echo 新しいランはありませんでした。

set WARN=0
set "NOTE="
if not "%IDS%"=="1" (
  set WARN=1
  set "NOTE=%NOTE% 注意：SteamIDのフォルダが%IDS%個"
  echo.
  echo ※注意：SteamID のフォルダが %IDS% 個あります。別のアカウントの記録が混ざる可能性があります。
  echo 　　　　混ざると、シングルの集計に他のアカウントのランが入ります。分けたい場合は README を見てください。
)
if not "%SIZEDIFF%"=="0" (
  set WARN=1
  set "NOTE=%NOTE% 注意：コピーの方が大きいファイル%SIZEDIFF%件"
  echo.
  echo ※注意：コピーの方が元より大きいため、そのままにしたファイルが %SIZEDIFF% 件あります。
  echo 　　　　別の profile に同じ名前のファイルがある可能性があります。
)
if not "%FAILED%"=="0" (
  set WARN=1
  set "NOTE=%NOTE% 失敗：コピーできなかったファイル%FAILED%件"
  echo.
  echo ※一部のファイル（%FAILED% 件）をコピーできませんでした。次の実行でもう一度試します。
)
call :log "新規%NEW%件 書きかけを直した%UPD%件 既存%SKIP%件%NOTE%"

echo.
if not defined STS2_NO_BROWSER (
  echo アプリのページを開きます：%URL%
  start "" "%URL%"
)

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

rem ---- 結果を1行で記録する（日時と件数だけ。SteamID などは書かない）
:log
for %%L in ("%LOG%") do if not exist "%%~dpL" mkdir "%%~dpL" > nul 2>&1
> "%LOG%" echo %date% %time:~0,8% %~1
exit /b 0

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

rem ---- ファイル1つ
rem  コピー先に無い：コピーする
rem  コピー先が元より小さい（書きかけをコピーした）：コピーを上書きして直す（元のファイルには触れない）
rem  コピー先が元と同じ大きさ：何もしない ／ コピー先が元より大きい：何もせず数えるだけ
:copy_file
if exist "%DEST%\%~2" (
  call :compare "%~1" "%DEST%\%~2" "%~3"
  exit /b 0
)
copy /b "%~1" "%DEST%\%~2" > nul 2>&1
if errorlevel 1 (set /a FAILED+=1) else (set /a NEW+=1)
exit /b 0

:compare
set /a SRC_SIZE=%~3
set /a DST_SIZE=%~z2
if %SRC_SIZE% EQU %DST_SIZE% (set /a SKIP+=1& exit /b 0)
if %SRC_SIZE% LSS %DST_SIZE% (set /a SIZEDIFF+=1& exit /b 0)
copy /b /y "%~1" "%~2" > nul 2>&1
if errorlevel 1 (set /a FAILED+=1) else (set /a UPD+=1)
exit /b 0
