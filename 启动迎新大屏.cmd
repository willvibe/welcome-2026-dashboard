@echo off
chcp 65001 >nul
cd /d "%~dp0welcome-screen"
if not exist node_modules (
  call npm.cmd install
  if errorlevel 1 goto error
)
call npm.cmd run setup
if errorlevel 1 goto error
if not exist dist\server (
  call npm.cmd run build
  if errorlevel 1 goto error
)
echo.
echo 迎新大屏：http://localhost:3000/
echo 教师后台：http://localhost:3000/admin
echo 请保持此窗口运行。关闭窗口将停止服务。
echo.
call npm.cmd start
if errorlevel 1 goto error
exit /b 0
:error
echo.
echo 启动失败，请查看上方信息，确认 MySQL 正在运行。
pause
