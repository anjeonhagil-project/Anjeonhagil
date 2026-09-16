# 기능: 전달 ZIP에서 계산 데이터 8개와 서울 경계 1개만 해시 검증 후 복원한다. 기존 파일이 다른 버전이면 덮어쓰지 않는다.
param([Parameter(Mandatory=$true)][string]$ArchivePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$routingRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\apps\backend\routing'))
$manifestPath = Join-Path $routingRoot 'service_manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ArchivePath).Path)
try {
    foreach ($property in $manifest.files.PSObject.Properties) {
        $relative = $property.Name
        if (-not $relative.StartsWith('data/')) { continue }
        $target = [IO.Path]::GetFullPath((Join-Path $routingRoot $relative))
        if (-not $target.StartsWith($routingRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Invalid manifest path' }
        if (Test-Path -LiteralPath $target) {
            if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $property.Value) {
                throw "Existing file differs; preserve it and investigate: $relative"
            }
            Write-Output "Verified existing $relative"
            continue
        }
        $nested = $null
        $nestedStream = $null
        if ($relative -eq 'data/seoul_boundary.gpkg') {
            $nestedStream = [IO.MemoryStream]::new()
            $sourceStream = $archive.GetEntry('Anjeonhagil_FINAL/dataset/source_materials.zip').Open()
            try { $sourceStream.CopyTo($nestedStream) } finally { $sourceStream.Dispose() }
            $nestedStream.Position = 0
            $nested = [IO.Compression.ZipArchive]::new($nestedStream, [IO.Compression.ZipArchiveMode]::Read)
            $entry = $nested.GetEntry('rebuild_source/unified_handoff_v1/inputs/seoul_boundary.gpkg')
        } else {
            $entry = $archive.GetEntry('Anjeonhagil_FINAL/dataset/' + $relative)
        }
        if ($null -eq $entry) { throw "Missing ZIP entry: $relative" }
        New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($target)) | Out-Null
        $temporary = $target + '.' + [guid]::NewGuid().ToString('N') + '.importing'
        try {
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $temporary)
            if ((Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash.ToLowerInvariant() -ne $property.Value) {
                throw "ZIP data hash mismatch: $relative"
            }
            Move-Item -LiteralPath $temporary -Destination $target
        } finally {
            if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary }
            if ($null -ne $nested) { $nested.Dispose() }
            if ($null -ne $nestedStream) { $nestedStream.Dispose() }
        }
        Write-Output "Imported $relative"
    }
} finally { $archive.Dispose() }
