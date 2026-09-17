@echo off
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%PATH%"
title 记账看板
echo.
echo 正在启动记账看板，请稍候...
echo 启动后不要关闭这个窗口。
echo.
npm run start
echo.
echo 服务已停止。
pause
