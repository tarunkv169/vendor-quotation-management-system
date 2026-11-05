<#
  Builds every VQMS image and publishes it to Docker Hub as <user>/vqms-<service>:<tag>.

  Usage (PowerShell, from this folder):
    docker login -u tarun1278          # once; use a Docker Hub access token as password
    .\docker-publish.ps1                # builds + pushes :latest
    .\docker-publish.ps1 -Tag 1.0.0     # also tags a release version
    .\docker-publish.ps1 -Service gateway-service   # only one service

  Run published images anywhere:
    docker compose pull; docker compose up -d --no-build
#>
param(
    [string]$User = "tarun1278",
    [string]$Tag = "latest",
    [string]$Service = ""
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker is not installed or not on PATH. Install Docker Desktop first."
}
if (-not (Test-Path ".env")) {
    throw "Missing .env - copy .env.example to .env and fill in the values first."
}

$env:DOCKER_HUB_USER = $User
$env:IMAGE_TAG = $Tag

Write-Host "Building images for $User (tag $Tag)..." -ForegroundColor Cyan
if ($Service) { docker compose build $Service } else { docker compose build }
if ($LASTEXITCODE -ne 0) { throw "docker compose build failed" }

Write-Host "Pushing images to Docker Hub..." -ForegroundColor Cyan
if ($Service) { docker compose push $Service } else { docker compose push }
if ($LASTEXITCODE -ne 0) { throw "docker compose push failed (did you run 'docker login -u $User'?)" }

# Keep :latest in sync when publishing a release tag.
if ($Tag -ne "latest") {
    docker compose config --images | Where-Object { $_ -like "$User/*" } | ForEach-Object {
        $latest = $_ -replace ":$([regex]::Escape($Tag))$", ":latest"
        docker tag $_ $latest
        docker push $latest
    }
}
Write-Host "Done. Images: https://hub.docker.com/u/$User" -ForegroundColor Green
