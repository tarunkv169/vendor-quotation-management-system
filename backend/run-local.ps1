<#
  Runs the whole VQMS backend locally without Docker (each service as a background process).

    .\run-local.ps1 start     # start everything not already running (jars must exist: mvnw package)
    .\run-local.ps1 status    # health of every service (uses the ports chosen at start)
    .\run-local.ps1 stop      # stop only the processes started by this script

  - Services start one after another; each must listen before the next starts (low-memory friendly).
  - If a default port is used by another program (e.g. a Docker container), the service is moved to
    port + 10000 and all service-to-service URLs follow automatically. Chosen ports: .run-logs\ports.json
  - Eureka is used. Logs: backend\.run-logs\<service>.log
  - Frontend: run "npm start" in ..\frontend; package.json "proxy" must point to the gateway port shown.
  Prerequisites: Java 21, local PostgreSQL with the service databases (docker-compose/default/init-db.sql),
  Python venv with ai-extraction-service/requirements.txt (pass -Python <path to python.exe>).
#>
param(
    [ValidateSet("start", "stop", "status")] [string]$Action = "status",
    [string]$Python = "python",
    [string]$DbPassword = $(if ($env:DB_PASSWORD) { $env:DB_PASSWORD } else { "admin123" }),
    # Local-dev default = the secret the monolith (Identity) currently signs with. Override with $env:JWT_SECRET.
    [string]$JwtSecret = $(if ($env:JWT_SECRET) { $env:JWT_SECRET } else { "VQMS-Secret-Key-For-JWT-Token-Generation-2024-Production-Ready-Key" }),
    [string]$JavaOpts = "-Xms32m -Xmx192m -XX:MaxMetaspaceSize=160m -XX:ReservedCodeCacheSize=48m -Xss512k -XX:+UseSerialGC -XX:TieredStopAtLevel=1",
    [string]$FrontendOrigins = "http://localhost:3000,http://localhost:3001,http://localhost:5173"
)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$logs = Join-Path $root ".run-logs"
$pidFile = Join-Path $logs "pids.json"
$portFile = Join-Path $logs "ports.json"
New-Item -ItemType Directory -Force $logs | Out-Null

# Order matters: registry first, gateway last.
$services = @(
    @{ Name = "eureka-service";             Port = 8761; Health = "/actuator/health" }
    @{ Name = "VendorQuotationApplication"; Port = 8081; Health = "/actuator/health" }
    @{ Name = "quotation-service";          Port = 8082; Health = "/actuator/health" }
    @{ Name = "document-service";           Port = 8083; Health = "/actuator/health/readiness" }
    @{ Name = "validation-service";         Port = 8084; Health = "/actuator/health/readiness" }
    @{ Name = "comparison-service";         Port = 8085; Health = "/actuator/health/readiness" }
    @{ Name = "recommendation-service";     Port = 8086; Health = "/actuator/health/readiness" }
    @{ Name = "approval-service";           Port = 8087; Health = "/actuator/health/readiness" }
    @{ Name = "audit-service";              Port = 8088; Health = "/actuator/health/readiness" }
    @{ Name = "notification-service";       Port = 8089; Health = "/actuator/health/readiness" }
    @{ Name = "ai-extraction-service";      Port = 8090; Health = "/api/v1/health/ready"; Python = $true }
    @{ Name = "reporting-service";          Port = 8091; Health = "/actuator/health/readiness" }
    @{ Name = "gateway-service";            Port = 8080; Health = "/actuator/health" }
)

function Test-Port([int]$port) {
    return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Read-Json($file) {
    $map = @{}
    if (Test-Path $file) { (Get-Content $file -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $map[$_.Name] = $_.Value } }
    return $map
}

function Test-Ours($name, $pids) {
    return $pids.ContainsKey($name) -and [bool](Get-Process -Id $pids[$name] -ErrorAction SilentlyContinue)
}

function Get-Health($svc, $port) {
    try {
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 "http://localhost:$port$($svc.Health)"
        return "UP ($($r.StatusCode))"
    } catch {
        if ($_.Exception.Response) { return "RESPONDING ($([int]$_.Exception.Response.StatusCode))" }
        if (Test-Port $port) { return "STARTING" }
        return "DOWN"
    }
}

switch ($Action) {
    "start" {
        $pids = Read-Json $pidFile
        $ports = Read-Json $portFile

        # 1. Decide the port of every service (keep ports of our running services, shift on conflicts).
        foreach ($svc in $services) {
            if (Test-Ours $svc.Name $pids) { continue }
            $port = $svc.Port
            if (Test-Port $port) {
                $alt = $port + 10000
                if (Test-Port $alt) { Write-Warning "$($svc.Name): ports $port and $alt are busy - skipped"; $ports.Remove($svc.Name); continue }
                Write-Host ("{0,-28} port {1} is used by another program -> using {2}" -f $svc.Name, $port, $alt) -ForegroundColor Yellow
                $port = $alt
            }
            $ports[$svc.Name] = $port
        }
        $url = { param($n) "http://localhost:$($ports[$n])" }

        # 2. Environment shared by all services, wired to the chosen ports.
        $common = @{
            JWT_SECRET = $JwtSecret; JWT_ALGORITHM = "HS512"; DB_USERNAME = "postgres"; DB_PASSWORD = $DbPassword
            # Feature flags for infrastructure that is not present locally (switch on when available).
            EUREKA_ENABLED = "true"; EMAIL_ENABLED = "false"
            S3_ENABLED = $(if ($env:S3_ENABLED) { $env:S3_ENABLED } else { "false" })
            LLM_ENABLED = $(if ($env:LLM_ENABLED) { $env:LLM_ENABLED } else { "false" })
            # Small pools: 11 services x 10 connections would exceed PostgreSQL's default max_connections (100).
            SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE = "4"; SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE = "1"
            EUREKA_URL = "$(& $url 'eureka-service')/eureka/"
            QUOTATION_SERVICE_URL = (& $url "quotation-service"); VENDOR_SERVICE_URL = (& $url "VendorQuotationApplication")
            PROCUREMENT_SERVICE_URL = (& $url "VendorQuotationApplication"); IDENTITY_SERVICE_URL = (& $url "VendorQuotationApplication")
            VALIDATION_SERVICE_URL = (& $url "validation-service"); COMPARISON_SERVICE_URL = (& $url "comparison-service")
            RECOMMENDATION_SERVICE_URL = (& $url "recommendation-service"); APPROVAL_SERVICE_URL = (& $url "approval-service")
        }
        $extra = @{
            "quotation-service"     = @{ SPRING_DATASOURCE_PASSWORD = $DbPassword
                                         SERVICES_VENDOR_BASE_URL = (& $url "VendorQuotationApplication")
                                         SERVICES_PROCUREMENT_BASE_URL = (& $url "VendorQuotationApplication") }
            "document-service"      = @{ AWS_ACCESS_KEY_ID = "test"; AWS_SECRET_ACCESS_KEY = "test"
                                         S3_ENDPOINT = "http://localhost:4566"; S3_PATH_STYLE = "true" }
            "ai-extraction-service" = @{ DATABASE_URL = "postgresql+asyncpg://postgres:$DbPassword@localhost:5432/extraction_db"
                                         DOCUMENT_SERVICE_BASE_URL = (& $url "document-service")
                                         LLM_MODEL = [string]$env:LLM_MODEL
                                         LLM_API_KEY = [string]$env:LLM_API_KEY }
            "gateway-service"       = @{ CORS_ALLOWED_ORIGINS = $FrontendOrigins
                                         MONOLITH_URI = (& $url "VendorQuotationApplication")
                                         DOCUMENT_SERVICE_URI = (& $url "document-service")
                                         AI_EXTRACTION_SERVICE_URI = (& $url "ai-extraction-service")
                                         VALIDATION_SERVICE_URI = (& $url "validation-service")
                                         COMPARISON_SERVICE_URI = (& $url "comparison-service")
                                         RECOMMENDATION_SERVICE_URI = (& $url "recommendation-service")
                                         APPROVAL_SERVICE_URI = (& $url "approval-service")
                                         AUDIT_SERVICE_URI = (& $url "audit-service")
                                         NOTIFICATION_SERVICE_URI = (& $url "notification-service")
                                         REPORTING_SERVICE_URI = (& $url "reporting-service") }
        }

        # 3. Start one by one; wait until each listens (or 120 s) before the next.
        foreach ($svc in $services) {
            if (Test-Ours $svc.Name $pids) { Write-Host ("{0,-28} already running (pid {1})" -f $svc.Name, $pids[$svc.Name]); continue }
            if (-not $ports.ContainsKey($svc.Name)) { continue }
            $port = $ports[$svc.Name]
            $dir = Join-Path $root $svc.Name
            $log = Join-Path $logs "$($svc.Name).log"
            if ($svc.Python) {
                $cmd = "`"$Python`" -m alembic upgrade head && `"$Python`" -m uvicorn app.main:app --host 127.0.0.1 --port $port"
            } else {
                $jar = Get-ChildItem (Join-Path $dir "target") -Filter "*.jar" -ErrorAction SilentlyContinue |
                        Where-Object { $_.Name -notlike "*original*" } | Select-Object -First 1
                if (-not $jar) { Write-Warning "$($svc.Name): no jar - run mvnw package first"; continue }
                $cmd = "java $JavaOpts -jar `"$($jar.FullName)`" --server.port=$port"
            }
            $psi = New-Object System.Diagnostics.ProcessStartInfo
            $psi.FileName = "cmd.exe"
            # Outer quotes: cmd /c strips the first and last quote, keeping quoted paths inside intact.
            # Parentheses: the redirect covers every command of a chain (alembic && uvicorn).
            $psi.Arguments = "/s /c `"($cmd) > `"$log`" 2>&1`""
            $psi.WorkingDirectory = $dir
            $psi.UseShellExecute = $false
            $psi.CreateNoWindow = $true
            foreach ($kv in $common.GetEnumerator()) { $psi.EnvironmentVariables[$kv.Key] = [string]$kv.Value }
            if ($extra.ContainsKey($svc.Name)) {
                foreach ($kv in $extra[$svc.Name].GetEnumerator()) { $psi.EnvironmentVariables[$kv.Key] = [string]$kv.Value }
            }
            $p = [System.Diagnostics.Process]::Start($psi)
            $pids[$svc.Name] = $p.Id
            $pids | ConvertTo-Json | Set-Content -Encoding utf8 $pidFile
            $ports | ConvertTo-Json | Set-Content -Encoding utf8 $portFile
            $sw = [Diagnostics.Stopwatch]::StartNew()
            while (-not (Test-Port $port) -and -not $p.HasExited -and $sw.Elapsed.TotalSeconds -lt 120) { Start-Sleep -Seconds 2 }
            $state = if (Test-Port $port) { "listening" } elseif ($p.HasExited) { "EXITED - see $log" } else { "still starting" }
            Write-Host ("{0,-28} port {1,-6} pid {2,-6} {3} ({4:N0}s)" -f $svc.Name, $port, $p.Id, $state, $sw.Elapsed.TotalSeconds)
        }
        Write-Host "Gateway: http://localhost:$($ports['gateway-service'])   Eureka: http://localhost:$($ports['eureka-service'])"
    }
    "status" {
        $ports = Read-Json $portFile
        foreach ($svc in $services) {
            $port = if ($ports.ContainsKey($svc.Name)) { $ports[$svc.Name] } else { $svc.Port }
            Write-Host ("{0,-28} {1,-6} {2}" -f $svc.Name, $port, (Get-Health $svc $port))
        }
    }
    "stop" {
        $pids = Read-Json $pidFile
        if ($pids.Count -eq 0) { Write-Host "Nothing started by this script."; return }
        $ErrorActionPreference = "Continue"   # taskkill writes to stderr for already-exited processes
        foreach ($kv in $pids.GetEnumerator()) {
            cmd.exe /c "taskkill /PID $($kv.Value) /T /F >nul 2>&1"
            Write-Host "stopped $($kv.Key) (pid $($kv.Value))"
        }
        Remove-Item $pidFile
    }
}
