param([switch]$CreateDevice, [switch]$PlayStore)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$sdkCandidates = @($env:ARCHIFY_ANDROID_SDK, $env:ANDROID_HOME, $env:ANDROID_SDK_ROOT, (Join-Path $projectRoot '.local/android-sdk'), (Join-Path $env:USERPROFILE 'AppData/Local/Android/Sdk'))
$sdkPath = $sdkCandidates | Where-Object { $_ -and (Test-Path (Join-Path $_ 'cmdline-tools/latest/bin/sdkmanager.bat')) } | Select-Object -First 1
if (-not $sdkPath) {
    Write-Host 'Install Android SDK Command-line Tools and a compatible Java runtime on this Windows execution host. Android Studio is optional.'
    Write-Host 'Official download: https://developer.android.com/studio'
    Write-Host 'Other browser users do not need this installation.'
    throw 'SDK not found. Set ANDROID_HOME to the SDK path, then run this command again.'
}
$studioJava = 'C:/Program Files/Android/Android Studio/jbr'
if (-not $env:JAVA_HOME -and (Test-Path "$studioJava/bin/java.exe")) { $env:JAVA_HOME = $studioJava }
if (-not $env:JAVA_HOME -and -not (Get-Command java -ErrorAction SilentlyContinue)) { throw 'Java runtime not found. Configure JAVA_HOME for your JDK, or use the runtime included with Android Studio.' }
$env:ANDROID_HOME = $sdkPath
$manager = Join-Path $sdkPath 'cmdline-tools/latest/bin/sdkmanager.bat'
# License decisions stay interactive; never pipe automatic acceptance.
& $manager "--sdk_root=$sdkPath" --licenses
if ($LASTEXITCODE -ne 0) { throw 'SDK license step did not complete.' }
$imagePackage = if ($PlayStore) { 'system-images;android-35;google_apis_playstore;x86_64' } else { 'system-images;android-35;google_apis;x86_64' }
$deviceName = if ($PlayStore) { 'Archify_Play_API_35' } else { 'Archify_API_35' }
& $manager "--sdk_root=$sdkPath" 'platform-tools' 'emulator' 'platforms;android-35' $imagePackage
if ($LASTEXITCODE -ne 0) { throw 'Android SDK component installation failed.' }
if ($CreateDevice) {
    $avdManager = Join-Path $sdkPath 'cmdline-tools/latest/bin/avdmanager.bat'
    $existing = & (Join-Path $sdkPath 'emulator/emulator.exe') -list-avds
    if ($existing -notcontains $deviceName) {
        'no' | & $avdManager create avd --name $deviceName --package $imagePackage --device 'pixel_6'
        if ($LASTEXITCODE -ne 0) { throw 'Virtual device creation failed.' }
    }
}
& (Join-Path $sdkPath 'emulator/emulator.exe') -accel-check
if ($LASTEXITCODE -ne 0) { throw 'Hardware acceleration is unavailable. Enable Windows Hypervisor Platform and restart Windows before testing.' }
Write-Host 'Android SDK preparation finished. Run npm run android:check, then npm run android:worker with the existing VM SSH tunnel.'
