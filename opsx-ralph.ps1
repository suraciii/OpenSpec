#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Ralph - OpenSpec autonomous implementation agent loop
.DESCRIPTION
    Executes Ralph iterations for an OpenSpec change until all tasks are complete
.PARAMETER ChangeName
    The OpenSpec change name (directory name under openspec/changes/)
.PARAMETER MaxIterations
    Maximum number of iterations to run (default: 10)
.PARAMETER Tool
    Tool to use: 'opencode', 'amp', or 'claude' (default: 'opencode')
.EXAMPLE
    .\opsx-ralph.ps1 hftx-new-api-integration
.EXAMPLE
    .\opsx-ralph.ps1 hftx-new-api-integration -MaxIterations 20 -Tool amp
#>

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$ChangeName,
    
    [Parameter(Mandatory=$false)]
    [int]$MaxIterations = 10,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('opencode', 'amp', 'claude')]
    [string]$Tool = 'opencode'
)

$ErrorActionPreference = 'Stop'

# Paths
$ScriptDir = $PSScriptRoot
$ChangeDir = Join-Path $ScriptDir "openspec\changes\$ChangeName"
$PrdFile = Join-Path $ChangeDir "prd.json"
$ProgressFile = Join-Path $ChangeDir "progress.txt"
$ArchiveDir = Join-Path $ChangeDir "archive"

# Validate change directory exists
if (-not (Test-Path $ChangeDir)) {
    Write-Error "Change directory not found: $ChangeDir"
    exit 1
}

# Validate prd.json exists
if (-not (Test-Path $PrdFile)) {
    Write-Error "prd.json not found. Run '/opsx-prd $ChangeName' first to generate it."
    exit 1
}

# Archive previous run if progress.txt exists with content
if (Test-Path $ProgressFile) {
    $progressContent = Get-Content $ProgressFile -Raw
    $initHeader = @"
# Ralph Progress Log
Started: 
"@
    # Check if progress.txt has actual content beyond the initial header
    # If it contains more than just the header, it means a previous run completed some work
    $hasContent = $progressContent.Trim().Length -gt $initHeader.Length + 50
    
    if ($hasContent) {
        # Archive the previous run
        $date = Get-Date -Format "yyyy-MM-dd-HHmmss"
        $archiveFolder = Join-Path $ArchiveDir $date
        
        Write-Host "Archiving previous run..." -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $archiveFolder -Force | Out-Null
        
        Copy-Item $PrdFile -Destination $archiveFolder
        Copy-Item $ProgressFile -Destination $archiveFolder
        
        Write-Host "  Archived to: $archiveFolder" -ForegroundColor Gray
        
        # Reset progress file for new run
        @"
# Ralph Progress Log
Started: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

---

"@ | Set-Content $ProgressFile
    }
}

# Initialize progress file if it doesn't exist
if (-not (Test-Path $ProgressFile)) {
    @"
# Ralph Progress Log
Started: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

---

"@ | Set-Content $ProgressFile
}

Write-Host ""
Write-Host "Starting Ralph for OpenSpec change: $ChangeName" -ForegroundColor Cyan
Write-Host "Tool: $Tool | Max iterations: $MaxIterations" -ForegroundColor Gray
Write-Host "Change directory: $ChangeDir" -ForegroundColor Gray
Write-Host ""

# Main iteration loop
for ($i = 1; $i -le $MaxIterations; $i++) {
    Write-Host ""
    Write-Host "===============================================================" -ForegroundColor Cyan
    Write-Host " Ralph Iteration $i of $MaxIterations ($Tool)" -ForegroundColor Cyan
    Write-Host "===============================================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Run the selected tool with the opsx-ralph command
    try {
        if ($Tool -eq 'opencode') {
            # OpenCode: pipe prompt to run command
            $output = opencode run --command opsx-ralph -- $ChangeName 2>&1 | Out-String
        }
        elseif ($Tool -eq 'amp') {
            # Use amp with the /opsx-ralph command
            $output = "/opsx-ralph $ChangeName" | amp --dangerously-allow-all 2>&1 | Out-String
        }
        else {
            # Claude Code: use --dangerously-skip-permissions for autonomous operation
            $output = "/opsx-ralph $ChangeName" | claude --dangerously-skip-permissions --print 2>&1 | Out-String
        }
        
        # Check for completion signal (match ralph.sh pattern)
        if ($output -match "<promise>COMPLETE</promise>") {
            Write-Host ""
            Write-Host "===============================================================" -ForegroundColor Green
            Write-Host " Ralph completed all tasks!" -ForegroundColor Green
            Write-Host "===============================================================" -ForegroundColor Green
            Write-Host "Completed at iteration $i of $MaxIterations" -ForegroundColor Gray
            Write-Host ""
            
            # Show summary - wrap in try-catch for safety
            try {
                $prdContent = Get-Content $PrdFile -Raw | ConvertFrom-Json
                $totalTasks = $prdContent.tasks.Count
                $completedTasks = ($prdContent.tasks | Where-Object { $_.passes -eq $true }).Count
                
                Write-Host "Summary:" -ForegroundColor Cyan
                Write-Host "  Total tasks: $totalTasks" -ForegroundColor Gray
                Write-Host "  Completed: $completedTasks" -ForegroundColor Green
                Write-Host "  Progress log: $ProgressFile" -ForegroundColor Gray
                Write-Host ""
            }
            catch {
                Write-Warning "Could not parse prd.json for summary: $_"
                Write-Host "  Progress log: $ProgressFile" -ForegroundColor Gray
                Write-Host ""
            }
            
            exit 0
        }
        
        Write-Host ""
        Write-Host "Iteration $i complete. Continuing..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
    catch {
        $errorMessage = $_.Exception.Message
        
        # Check for fatal errors that should stop execution
        if ($errorMessage -match "command not found|not recognized|Cannot find" -or
            $errorMessage -match "access.*denied|permission") {
            Write-Error "Fatal error in iteration ${i}: $errorMessage"
            Write-Host "This error cannot be recovered. Stopping execution." -ForegroundColor Red
            exit 1
        }
        
        # Recoverable error - log and continue
        Write-Warning "Error in iteration ${i}: $errorMessage"
        Write-Host "Continuing to next iteration..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

# Reached max iterations without completion
Write-Host ""
Write-Host "===============================================================" -ForegroundColor Yellow
Write-Host " Ralph reached max iterations ($MaxIterations)" -ForegroundColor Yellow
Write-Host "===============================================================" -ForegroundColor Yellow
Write-Host ""

# Show current status
try {
    $prdContent = Get-Content $PrdFile -Raw | ConvertFrom-Json
    $totalTasks = $prdContent.tasks.Count
    $completedTasks = ($prdContent.tasks | Where-Object { $_.passes -eq $true }).Count
    $remainingTasks = $totalTasks - $completedTasks

    Write-Host "Status:" -ForegroundColor Cyan
    Write-Host "  Total tasks: $totalTasks" -ForegroundColor Gray
    Write-Host "  Completed: $completedTasks" -ForegroundColor Green
    Write-Host "  Remaining: $remainingTasks" -ForegroundColor Yellow
    Write-Host "  Progress log: $ProgressFile" -ForegroundColor Gray
    Write-Host ""

    if ($remainingTasks -gt 0) {
        Write-Host "Incomplete tasks:" -ForegroundColor Yellow
        $prdContent.tasks | Where-Object { $_.passes -eq $false } | ForEach-Object {
            Write-Host "  [$($_.id)] $($_.title)" -ForegroundColor Gray
        }
        Write-Host ""
    }
}
catch {
    Write-Warning "Could not parse prd.json for status report: $_"
    Write-Host "  Progress log: $ProgressFile" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "Run again with more iterations if needed:" -ForegroundColor Cyan
Write-Host "  .\opsx-ralph.ps1 $ChangeName -MaxIterations 20" -ForegroundColor Gray
Write-Host ""

exit 1
