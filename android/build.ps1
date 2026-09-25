param(
    [string]$ToolsRoot = (Join-Path $env:LOCALAPPDATA 'family-othello-tools'),
    [switch]$Setup
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$nativeRoot = Join-Path $ToolsRoot 'work'
$buildRoot = Join-Path $nativeRoot 'build'
$releaseRoot = Join-Path $PSScriptRoot 'releases'
$signingRoot = Join-Path $projectRoot '.android-signing'
$jdkRoot = Join-Path $ToolsRoot 'jdk/jdk-21.0.12.1+1'
$androidTools = Join-Path $ToolsRoot 'build-tools/android-15'
$androidJar = Join-Path $ToolsRoot 'platform/android-35/android.jar'

function Install-Archive([string]$Url, [string]$Name, [string]$Folder, [string]$Hash, [string]$Algorithm) {
    New-Item -ItemType Directory -Path $ToolsRoot -Force | Out-Null
    $zip = Join-Path $ToolsRoot $Name
    if (!(Test-Path -LiteralPath $zip)) { Invoke-WebRequest -Uri $Url -OutFile $zip -TimeoutSec 300 }
    if ((Get-FileHash -LiteralPath $zip -Algorithm $Algorithm).Hash -ne $Hash) { throw "Checksum mismatch: $Name" }
    Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $ToolsRoot $Folder) -Force
}
if ($Setup) {
    Install-Archive 'https://aka.ms/download-jdk/microsoft-jdk-21.0.12.1-windows-x64.zip' 'jdk.zip' 'jdk' '192441A9D27DA813BADA974BB88B4CF64D37A9589ED37F204374D411CA5CE07F' 'SHA256'
    Install-Archive 'https://dl.google.com/android/repository/build-tools_r35_windows.zip' 'build-tools.zip' 'build-tools' 'AF059BB67CF7786F45EE0DB85E2D24985DF1B4B6' 'SHA1'
    Install-Archive 'https://dl.google.com/android/repository/platform-35_r02.zip' 'platform.zip' 'platform' '0BB560A90A7A2CBD0DD8348224D518B638FE7949' 'SHA1'
}
$java = Join-Path $jdkRoot 'bin/java.exe'
$javac = Join-Path $jdkRoot 'bin/javac.exe'
$jar = Join-Path $jdkRoot 'bin/jar.exe'
$keytool = Join-Path $jdkRoot 'bin/keytool.exe'
$aapt2 = Join-Path $androidTools 'aapt2.exe'
foreach ($required in @($java, $javac, $aapt2, $androidJar)) {
    if (!(Test-Path -LiteralPath $required)) { throw "Missing $required. Run build.ps1 -Setup first." }
}
function Invoke-Tool([string]$Executable, [string[]]$ToolArgs) {
    & $Executable @ToolArgs
    if ($LASTEXITCODE -ne 0) { throw "Tool failed with exit code ${LASTEXITCODE}: $Executable" }
}
foreach ($stale in @("$buildRoot/assets", "$buildRoot/classes", "$buildRoot/dex")) {
    if (Test-Path -LiteralPath $stale) { Remove-Item -LiteralPath $stale -Recurse -Force }
}
foreach ($folder in @($buildRoot, $releaseRoot, $signingRoot, "$buildRoot/assets/www/assets", "$buildRoot/classes", "$buildRoot/dex")) {
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
}
# Native SDK tools on Windows do not reliably accept Japanese characters in paths.
Copy-Item -LiteralPath "$PSScriptRoot/res" -Destination $nativeRoot -Recurse -Force
Copy-Item -LiteralPath "$PSScriptRoot/AndroidManifest.xml" -Destination "$nativeRoot/AndroidManifest.xml" -Force
Copy-Item -LiteralPath "$PSScriptRoot/src/jp/family/kazokuothello/MainActivity.java" -Destination "$nativeRoot/MainActivity.java" -Force
foreach ($file in @('index.html', 'style.css', 'app.js', 'engine.js', 'game-store.js', 'ai-worker.js')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination "$buildRoot/assets/www/$file" -Force
}
foreach ($file in @('panda.jpg', 'neko.jpg', 'kuma.jpg', 'usagi.jpg', 'inu.jpg', 'hiyoko.jpg')) {
    Copy-Item -LiteralPath "$projectRoot/assets/$file" -Destination "$buildRoot/assets/www/assets/$file" -Force
}
# Android uses device fonts, with no Google Fonts request and no network dependency.
$cssPath = "$buildRoot/assets/www/style.css"
$css = [IO.File]::ReadAllText($cssPath) -replace '(?m)^@import[^;]+;\r?\n?', ''
[IO.File]::WriteAllText($cssPath, $css, [Text.UTF8Encoding]::new($false))
Invoke-Tool $aapt2 @('compile', '--dir', "$nativeRoot/res", '-o', "$buildRoot/resources.zip")
Invoke-Tool $aapt2 @('link', '-o', "$buildRoot/unsigned.apk", '-I', $androidJar, '--manifest', "$nativeRoot/AndroidManifest.xml", '-A', "$buildRoot/assets", "$buildRoot/resources.zip")
Invoke-Tool $javac @('-J-Duser.language=en', '-J-Duser.country=US', '--release', '8', '-Xlint:-options', '-encoding', 'UTF-8', '-classpath', $androidJar, '-d', "$buildRoot/classes", "$nativeRoot/MainActivity.java")
Invoke-Tool $jar @('cf', "$buildRoot/classes.jar", '-C', "$buildRoot/classes", '.')
Invoke-Tool $java @('-cp', "$androidTools/lib/d8.jar", 'com.android.tools.r8.D8', '--release', '--min-api', '26', '--lib', $androidJar, '--output', "$buildRoot/dex", "$buildRoot/classes.jar")
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::Open("$buildRoot/unsigned.apk", [IO.Compression.ZipArchiveMode]::Update)
try {
    # The Windows aapt2 package can emit backslashes inside asset entry names.
    # Android AssetManager requires standard ZIP paths with forward slashes.
    foreach ($entry in @($archive.Entries)) {
        if ($entry.FullName.Contains('\')) {
            $replacement = $archive.CreateEntry($entry.FullName.Replace('\', '/'), [IO.Compression.CompressionLevel]::Optimal)
            $inputStream = $entry.Open()
            $outputStream = $replacement.Open()
            try { $inputStream.CopyTo($outputStream) }
            finally { $inputStream.Dispose(); $outputStream.Dispose() }
            $entry.Delete()
        }
    }
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, "$buildRoot/dex/classes.dex", 'classes.dex', [IO.Compression.CompressionLevel]::Optimal) | Out-Null
} finally { $archive.Dispose() }
Invoke-Tool (Join-Path $androidTools 'zipalign.exe') @('-f', '-p', '4', "$buildRoot/unsigned.apk", "$buildRoot/aligned.apk")

$keystore = Join-Path $signingRoot 'family-release.jks'
$passwordFile = Join-Path $signingRoot 'password.txt'
if (!(Test-Path -LiteralPath $keystore)) {
    $secretBytes = [byte[]]::new(32)
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($secretBytes) } finally { $rng.Dispose() }
    [IO.File]::WriteAllText($passwordFile, [Convert]::ToBase64String($secretBytes), [Text.UTF8Encoding]::new($false))
    Invoke-Tool $keytool @('-genkeypair', '-keystore', $keystore, '-storetype', 'JKS', '-storepass:file', $passwordFile, '-keypass:file', $passwordFile,
        '-alias', 'family', '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=Kazoku Othello, O=Family, C=JP')
}
if (!(Test-Path -LiteralPath $passwordFile)) { throw 'The signing password file is missing. Restore the original signing files before building an update.' }
$apk = Join-Path $buildRoot 'kazoku-othello-1.0.0.apk'
Invoke-Tool $java @('-jar', "$androidTools/lib/apksigner.jar", 'sign', '--ks', $keystore, '--ks-key-alias', 'family', '--ks-pass', "file:$passwordFile", '--v4-signing-enabled', 'false', '--out', $apk, "$buildRoot/aligned.apk")
Invoke-Tool $java @('-jar', "$androidTools/lib/apksigner.jar", 'verify', '--verbose', '--print-certs', $apk)
Invoke-Tool (Join-Path $androidTools 'aapt.exe') @('dump', 'badging', $apk)
Copy-Item -LiteralPath $apk -Destination $releaseRoot -Force
$apk = Join-Path $releaseRoot 'kazoku-othello-1.0.0.apk'
$apkHash = (Get-FileHash -LiteralPath $apk -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText("$apk.sha256", "$apkHash  $([IO.Path]::GetFileName($apk))`n", [Text.UTF8Encoding]::new($false))
Write-Output "APK ready: $apk"
