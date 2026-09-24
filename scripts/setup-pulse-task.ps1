# Setup: pi-agent-pulse as SYSTEM scheduled task (survives reboots, no SSH session needed)
# Telegram secrets go to Machine-level env vars (the SYSTEM task inherits them)
[Environment]::SetEnvironmentVariable('TELEGRAM_BOT_TOKEN','8739394436:AAGt2LxfePAKKrSdPwJIQrdJXRvG-id5YYY','Machine')
[Environment]::SetEnvironmentVariable('TELEGRAM_CHAT_ID','638788684','Machine')

$bridge = 'C:\Yandex.Disk\Computer_Vision\agent-starter-kit\scripts\pulse-telegram-bridge.mjs'
$node = 'C:\Program Files\nodejs\node.exe'
schtasks /create /tn PulseBridge /tr "`"$node`" `"$bridge`"" /sc onstart /ru SYSTEM /rl HIGHEST /f
schtasks /run /tn PulseBridge
Start-Sleep 4
$port = Get-NetTCPConnection -LocalPort 8787 -ErrorAction SilentlyContinue
if ($port) { Write-Output 'PORT_8787_OK' } else { Write-Output 'PORT_8787_FAIL' }
try {
  Invoke-WebRequest -Uri 'http://127.0.0.1:8787/webhook' -Method POST -Body '{}' -UseBasicParsing | Out-Null
  Write-Output 'WEBHOOK_OK'
} catch { Write-Output 'WEBHOOK_FAIL' }
