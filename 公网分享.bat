@echo off
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
title 记账看板-公网分享
echo.
echo 将把这台电脑分享到公网，方便手机在外面记账。
echo 窗口里会出现 https 地址和访问码，不要关闭窗口。
echo.
npm run share
echo.
pause
