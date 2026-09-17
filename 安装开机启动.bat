@echo off
cd /d "%~dp0"
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TARGET=%STARTUP%\开机启动记账.vbs"
> "%TARGET%" echo Set WshShell = CreateObject("WScript.Shell")
>> "%TARGET%" echo WshShell.Run "cmd /k ""%~dp0启动记账.bat""", 1, False
echo 已加入开机启动。重启后会自动打开记账服务窗口。
echo 若要取消，删除启动文件夹里的「开机启动记账.vbs」。
pause
