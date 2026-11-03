@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules\" (
  echo Dependencies are missing. Run npm install first.
  pause
  exit /b 1
)

set "APPDATA=%CD%\.runtime\appdata"
set "LOCALAPPDATA=%CD%\.runtime\localappdata"
if not exist "%APPDATA%" mkdir "%APPDATA%" >nul 2>&1
if not exist "%LOCALAPPDATA%" mkdir "%LOCALAPPDATA%" >nul 2>&1

echo Starting blockchain...
start "Certificate Registry - Blockchain" cmd /k "cd /d ""%CD%"" && set ""APPDATA=%APPDATA%"" && set ""LOCALAPPDATA=%LOCALAPPDATA%"" && npx hardhat node"

echo Waiting for blockchain at http://127.0.0.1:8545 ...
node -e "const wait=async()=>{for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',method:'eth_chainId',params:[],id:1})});if(r.ok){const j=await r.json();if(j.result==='0x7a69')return;}}catch{}await new Promise(r=>setTimeout(r,1000));}console.error('Timed out waiting for Hardhat.');process.exit(1)};wait()"
if errorlevel 1 (
  echo Could not start the blockchain. Check the blockchain terminal for errors.
  pause
  exit /b 1
)

echo Deploying CertificateRegistry...
node scripts\deploy-local.js
if errorlevel 1 (
  echo Deployment failed. Check that the local chain is available.
  pause
  exit /b 1
)

set /p LOCAL_CONTRACT_ADDRESS=<.local-contract-address
echo Starting frontend and backend...
echo Open http://127.0.0.1:3000 in your browser.
start "Certificate Registry - Local App" cmd /k "cd /d ""%CD%"" && set ""APPDATA=%APPDATA%"" && set ""LOCALAPPDATA=%LOCALAPPDATA%"" && set ""LOCAL_CONTRACT_ADDRESS=%LOCAL_CONTRACT_ADDRESS%"" && npm run local"

echo Ready. Keep both terminal windows open while using the application.
exit /b 0
