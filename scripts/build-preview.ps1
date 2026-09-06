# Build a uniquely versioned Android preview APK without changing tracked source files.
# Examples:
#   npm run build-preview
#   npm run build-preview -- -Abi all
#   npm run build-preview -- -InstallDependencies

[CmdletBinding()]
param(
    [ValidateSet("arm64-v8a", "armeabi-v7a", "x86", "x86_64", "all")]
    [string]$Abi = "arm64-v8a",
    [string]$PreviewVersion,
    [long]$VersionCode = 0,
    [switch]$InstallDependencies,
    [switch]$SkipBuildInfo,
    [switch]$SkipVerification,
    [switch]$SkipNdkWorkaround
)

$ErrorActionPreference = "Stop"

function Invoke-RequiredCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory
    )

    Write-Host "> $FilePath $($Arguments -join ' ')" -ForegroundColor DarkGray
    Push-Location $WorkingDirectory
    try {
        & $FilePath @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed (exit code $LASTEXITCODE): $FilePath"
        }
    } finally {
        Pop-Location
    }
}

function Get-AndroidSdkPath {
    $candidates = @(@(
        $env:ANDROID_SDK_ROOT,
        $env:ANDROID_HOME,
        (Join-Path $env:LOCALAPPDATA "Android\Sdk")
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) })

    if ($candidates.Count -eq 0) {
        throw "Android SDK not found. Set ANDROID_SDK_ROOT or ANDROID_HOME."
    }

    return (Resolve-Path -LiteralPath $candidates[0]).Path
}

function Write-LocalProperties {
    param([string]$Path, [string]$SdkPath)

    $sdkValue = $SdkPath.Replace('\', '/')
    [System.IO.File]::WriteAllText($Path, "sdk.dir=$sdkValue`r`n", [System.Text.UTF8Encoding]::new($false))
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$androidRoot = Join-Path $repoRoot "android"
$packageJsonPath = Join-Path $repoRoot "package.json"
$buildGradlePath = Join-Path $androidRoot "app\build.gradle"
$buildInfoPath = Join-Path $repoRoot "src\constants\buildInfo.ts"
$localPropertiesPath = Join-Path $androidRoot "local.properties"
$releaseDirectory = Join-Path $androidRoot "app\build\outputs\apk\release"

if (-not (Test-Path -LiteralPath (Join-Path $repoRoot "package-lock.json"))) {
    throw "package-lock.json not found; npm ci cannot be used."
}

$packageJson = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
$baseVersion = [string]$packageJson.version

if ([string]::IsNullOrWhiteSpace($PreviewVersion)) {
    $PreviewVersion = "$baseVersion-preview.$(Get-Date -Format 'yyyyMMdd.HHmmss')"
}

if ($PreviewVersion -notmatch "^[0-9A-Za-z][0-9A-Za-z.+_-]*$") {
    throw "Invalid preview version: $PreviewVersion"
}

if ($VersionCode -le 0) {
    $gradleText = Get-Content -LiteralPath $buildGradlePath -Raw
    $match = [regex]::Match($gradleText, "def appVersionCode\s*=\s*[^\r\n]*?(\d+)")
    if (-not $match.Success) {
        throw "Unable to read the base versionCode from android/app/build.gradle."
    }

    $baseVersionCode = [long]$match.Groups[1].Value
    $VersionCode = [Math]::Max($baseVersionCode + 1, [DateTimeOffset]::Now.ToUnixTimeSeconds())
}

if ($VersionCode -gt 2147483647) {
    throw "versionCode exceeds the Android limit: $VersionCode"
}

$sdkPath = Get-AndroidSdkPath
$hadLocalProperties = Test-Path -LiteralPath $localPropertiesPath
$originalLocalProperties = if ($hadLocalProperties) { [System.IO.File]::ReadAllText($localPropertiesPath) } else { $null }
$hadBuildInfo = Test-Path -LiteralPath $buildInfoPath
$originalBuildInfo = if ($hadBuildInfo) { [System.IO.File]::ReadAllText($buildInfoPath) } else { $null }
$temporaryGradleInitScriptPath = $null

try {
    if (-not $hadLocalProperties) {
        Write-LocalProperties -Path $localPropertiesPath -SdkPath $sdkPath
    }

    if ($InstallDependencies -or -not (Test-Path -LiteralPath (Join-Path $repoRoot "node_modules"))) {
        Invoke-RequiredCommand -FilePath "npm.cmd" -Arguments @("ci") -WorkingDirectory $repoRoot
    }

    if (-not $SkipBuildInfo) {
        Invoke-RequiredCommand -FilePath "node.exe" -Arguments @("./scripts/generate-build-info.js") -WorkingDirectory $repoRoot
    }

    $gradleArguments = @(
        "assembleRelease",
        "-PappVersion=$PreviewVersion",
        "-PappVersionCode=$VersionCode",
        "--no-daemon"
    )

    if ($Abi -ne "all") {
        $gradleArguments += "-PbuildAbi=$Abi"
    }

    if (($env:OS -eq "Windows_NT") -and -not $SkipNdkWorkaround) {
        $temporaryGradleInitScriptPath = Join-Path ([System.IO.Path]::GetTempPath()) "audiora-ndk-workaround-$([guid]::NewGuid()).gradle"
        $ndkDirectory = Get-ChildItem -LiteralPath (Join-Path $sdkPath "ndk") -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
        if (-not $ndkDirectory) {
            throw "Android NDK not found under $sdkPath."
        }

        $gradleInitScript = @'
def normalizeLibcxxSharedObjects = { File buildDirectory ->
    def files = []
    def abiDirectories = [
        "arm64-v8a": "aarch64-linux-android",
        "armeabi-v7a": "arm-linux-androideabi",
        "x86": "i686-linux-android",
        "x86_64": "x86_64-linux-android",
    ]
    def ndkRoot = new File("__AUDIORA_NDK_ROOT__")
    if (buildDirectory.exists()) {
        files += gradle.rootProject.fileTree(buildDirectory) {
            include "**/libc++_shared.so"
        }.files
    }

    files.unique().each { file ->
        def abiDirectory = abiDirectories.find { entry -> file.absolutePath.contains("${File.separator}${entry.key}${File.separator}") }
        if (abiDirectory == null) {
            return
        }

        def sourceFile = new File(ndkRoot, "toolchains/llvm/prebuilt/windows-x86_64/sysroot/usr/lib/${abiDirectory.value}/libc++_shared.so")
        def temporaryFile = new File(file.parentFile, "${file.name}.audiora-plain")
        if (temporaryFile.exists()) {
            temporaryFile.delete()
        }

        def copyProcess = ["cmd.exe", "/d", "/s", "/c", "copy /y \"${sourceFile.absolutePath}\" \"${temporaryFile.absolutePath}\""].execute()
        copyProcess.waitFor()
        def decryptProcess = ["cipher.exe", "/d", "/a", temporaryFile.absolutePath].execute()
        decryptProcess.waitFor()
        if (copyProcess.exitValue() != 0 || decryptProcess.exitValue() != 0 || !temporaryFile.exists() || temporaryFile.length() == 0) {
            throw new GradleException("Unable to normalize ${file.absolutePath}")
        }

        if (!file.delete() || !temporaryFile.renameTo(file)) {
            throw new GradleException("Unable to replace ${file.absolutePath}")
        }
    }
}

gradle.allprojects { project ->
    project.tasks.configureEach { task ->
        def taskName = task.name.toLowerCase(Locale.ROOT)
        def isCmakeBuild = taskName.startsWith("buildcmake")
        def isExternalNativeBuild = taskName.contains("externalnativebuild") && !taskName.contains("configure")
        if (isCmakeBuild || isExternalNativeBuild) {
            task.doNotTrackState("libc++_shared.so may have an unreadable Windows file attribute")
            task.doLast {
                normalizeLibcxxSharedObjects(project.buildDir)
            }
        }
    }
}
'@
        $gradleInitScript = $gradleInitScript.Replace("__AUDIORA_NDK_ROOT__", $ndkDirectory.FullName.Replace('\', '/'))
        [System.IO.File]::WriteAllText($temporaryGradleInitScriptPath, $gradleInitScript, [System.Text.UTF8Encoding]::new($false))
        $gradleArguments += @("--init-script", $temporaryGradleInitScriptPath)
    }

    if ($env:JAVA_HOME) {
        $gradleArguments += "-Dorg.gradle.java.home=$env:JAVA_HOME"
    }

    Invoke-RequiredCommand -FilePath ".\gradlew.bat" -Arguments $gradleArguments -WorkingDirectory $androidRoot

    $apkPattern = if ($Abi -eq "all") {
        "Audiora-v$PreviewVersion-*-release.apk"
    } else {
        "Audiora-v$PreviewVersion-$Abi-release.apk"
    }
    $apkFiles = @(Get-ChildItem -LiteralPath $releaseDirectory -Filter $apkPattern -File)
    if ($apkFiles.Count -eq 0) {
        throw "Build completed but no APK was found: $apkPattern"
    }

    if (-not $SkipVerification) {
        $aapt2Candidates = Get-ChildItem -LiteralPath (Join-Path $sdkPath "build-tools") -Filter "aapt2.exe" -Recurse -File | Sort-Object FullName -Descending
        if ($aapt2Candidates.Count -eq 0) {
            Write-Warning "aapt2 not found; skipping APK metadata verification."
        } else {
            foreach ($apk in $apkFiles) {
                Write-Host "`nAPK: $($apk.FullName)" -ForegroundColor Green
                Write-Host "SHA-256: $((Get-FileHash -Algorithm SHA256 -LiteralPath $apk.FullName).Hash)"
                & $aapt2Candidates[0].FullName dump badging $apk.FullName | Select-String "package:|native-code:"

                $apksignerPath = Join-Path $aapt2Candidates[0].Directory.FullName "apksigner.bat"
                if (Test-Path -LiteralPath $apksignerPath) {
                    $signingOutput = & $apksignerPath verify --verbose $apk.FullName 2>&1
                    if ($LASTEXITCODE -ne 0) {
                        throw "APK signature verification failed: $($apk.FullName)"
                    }
                    $signingOutput | Select-String "Verified using v[123] scheme|Number of signers"
                }
            }
        }
    }

    Write-Host "`nBuild completed. Generated $($apkFiles.Count) APK(s)." -ForegroundColor Green
    $apkFiles | ForEach-Object { Write-Host $_.FullName }
} finally {
    if ($temporaryGradleInitScriptPath -and (Test-Path -LiteralPath $temporaryGradleInitScriptPath)) {
        [System.IO.File]::Delete($temporaryGradleInitScriptPath)
    }

    if ($hadLocalProperties) {
        [System.IO.File]::WriteAllText($localPropertiesPath, $originalLocalProperties, [System.Text.UTF8Encoding]::new($false))
    } elseif (Test-Path -LiteralPath $localPropertiesPath) {
        [System.IO.File]::Delete($localPropertiesPath)
    }

    if ($hadBuildInfo) {
        [System.IO.File]::WriteAllText($buildInfoPath, $originalBuildInfo, [System.Text.UTF8Encoding]::new($false))
    } elseif (Test-Path -LiteralPath $buildInfoPath) {
        [System.IO.File]::Delete($buildInfoPath)
    }

}
