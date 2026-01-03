# Script to kill process using port 5000
$port = 5000
$connections = netstat -ano | findstr ":$port"

if ($connections) {
    $processIds = $connections | ForEach-Object {
        if ($_ -match '\s+(\d+)$') {
            $matches[1]
        }
    } | Select-Object -Unique
    
    foreach ($processId in $processIds) {
        if ($processId -and $processId -ne '0') {
            Write-Host "Killing process $processId..."
            taskkill /F /PID $processId
        }
    }
    Write-Host "Port $port is now free!"
} else {
    Write-Host "No process found using port $port"
}

