# Startup of the pi-agent-pulse -> Telegram bridge (node, hidden window)
# Env file: %USERPROFILE%\.pi\agent\pi-pulse-bridge.env (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
Get-Content $env:USERPROFILE\.pi\agent\pi-pulse-bridge.env | ForEach-Object {
  $p = $_ -split '='
  if ($p.Count -ge 2) { [Environment]::SetEnvironmentVariable($p[0], $p[1], 'Process') }
}
Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' `
  -ArgumentList 'C:\Yandex.Disk\Computer_Vision\agent-starter-kit\scripts\pulse-telegram-bridge.mjs' `
  -WindowStyle Hidden
Write-Output 'BRIDGE_UP'
