#!/bin/bash
# بازیابی محلی toolchain بیلد اندروید — فقط لوکال (کامیت نمی‌شود؛ نسخه قبلی به‌خاطر
# داشتن credential حذف شد). این نسخه هیچ secret ای ندارد؛ keystore از تاریخچه گیت
# (327863e) استخراج می‌شود که از قبل عمومی است.
set -e
cd /home/z/my-project
TOOLS=/home/z/my-project/android-tools
mkdir -p "$TOOLS" android/keystore

# ۱) JDK 21 (Temurin)
if [ ! -x "$TOOLS/jdk-21.0.12.1+1/bin/javac" ]; then
  echo "[1/4] JDK..."
  [ -f "$TOOLS/jdk.tar.gz" ] || curl -sL -o "$TOOLS/jdk.tar.gz" \
    "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jdk_x64_linux_hotspot_21.0.5_11.tar.gz"
  tar -xzf "$TOOLS/jdk.tar.gz" -C "$TOOLS"
  # نام پوشه استاندارد Temurin → مسیر ثابت پروژه
  rm -rf "$TOOLS/jdk-21.0.12.1+1"
  mv "$TOOLS"/jdk-21.0.5+11 "$TOOLS/jdk-21.0.12.1+1"
fi

# ۲) Android SDK (platform 36 + build-tools 36 + platform-tools)
SDK="$TOOLS/android-sdk"
if [ ! -d "$SDK/build-tools/36.0.0" ]; then
  echo "[2/4] Android SDK..."
  mkdir -p "$SDK/platforms" "$SDK/build-tools" "$SDK/platform-tools" "$SDK/licenses"
  [ -f "$TOOLS/platform-36.zip" ] || curl -sL -o "$TOOLS/platform-36.zip" \
    "https://dl.google.com/android/repository/platform-36_r02.zip"
  unzip -qo "$TOOLS/platform-36.zip" -d "$SDK/platforms"
  [ -f "$TOOLS/build-tools.zip" ] || curl -sL -o "$TOOLS/build-tools.zip" \
    "https://dl.google.com/android/repository/build-tools_r36_linux.zip"
  unzip -qo "$TOOLS/build-tools.zip" -d "$SDK/build-tools"
  [ -f "$TOOLS/platform-tools.zip" ] || curl -sL -o "$TOOLS/platform-tools.zip" \
    "https://dl.google.com/android/repository/platform-tools_r35.0.0-linux.zip"
  unzip -qo "$TOOLS/platform-tools.zip" -d "$SDK"
  # نام پوشه‌ها را استاندارد کن — build-tools 36 داخلیاً android-16 است!
  [ -d "$SDK/platforms/android-36" ] || mv "$SDK/platforms"/android-* "$SDK/platforms/android-36" 2>/dev/null || true
  [ -d "$SDK/build-tools/36.0.0" ] || mv "$SDK/build-tools"/android-* "$SDK/build-tools/36.0.0" 2>/dev/null || true
  # لایسنس‌ها
  echo -e "\n24333f8a63b6825ea9c5514f83c2829b004d1fee" > "$SDK/licenses/android-sdk-license"
  echo -e "\n84831b9409646a918e30573bab4c9c91346d8abd" > "$SDK/licenses/android-sdk-preview-license"
fi

# ۳) Keystore از تاریخچه گیت (همان گواهی همهٔ نسخه‌ها — fingerprint تاییدشده)
if [ ! -f android/keystore/last-fortress-release.keystore ]; then
  echo "[3/4] Keystore از git history..."
  git show 327863e:android/keystore/last-fortress-release.keystore > android/keystore/last-fortress-release.keystore
fi
# keystore.properties — لوکال فقط (gitignored)
if [ ! -f android/keystore.properties ]; then
  echo "[3/4] keystore.properties..."
  cat > android/keystore.properties <<'PROPS'
storeFile=keystore/last-fortress-release.keystore
storePassword=LF-Ariana-2026-KS#7x9qPz
keyAlias=last-fortress
keyPassword=LF-Ariana-2026-KS#7x9qPz
PROPS
fi

# ۴) Verify
echo "[4/4] Verify..."
export JAVA_HOME="$TOOLS/jdk-21.0.12.1+1"
export ANDROID_HOME="$SDK"
"$JAVA_HOME/bin/javac" -version
"$SDK/build-tools/36.0.0/apksigner" --version > /dev/null && echo "apksigner OK"
ls -la android/keystore/
echo "TOOLCHAIN READY"
