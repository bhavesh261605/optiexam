@echo off
cd /d "%~dp0"
echo Starting OptiExam at http://127.0.0.1:3000
echo Keep this window open while using the prototype.
call npm run dev
pause
