#Requires -Version 5.1
# Smoke-test running TAZIA coturn (reads docker/coturn/.env).
$ErrorActionPreference = 'Stop'
$CoturnDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $CoturnDir 'install\windows\Install-TaziaTurn.ps1') -TestOnly
