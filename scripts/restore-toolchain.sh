#!/bin/bash
# بازسازی کامل محیط بیلد اندروید بعد از پاک‌سازی sandbox
# usage: bash /home/z/my-project/scripts/restore-toolchain.sh
set -e
AT=/home/z/my-project/android-tools
DL=$AT/dl
JDK_DIR=$AT/jdk-21.0.12.1+1
SDK=$AT/android-sdk
PJ=/home/z/my-project

mkdir -p "$DL"

# 1) downloads (skip if already downloaded)
[ -s "$DL/jdk21.tar.gz" ]          || curl -sL -o "$DL/jdk21.tar.gz" "https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.5%2B11/OpenJDK21U-jdk_x64_linux_hotspot_21.0.5_11.tar.gz" &
[ -s "$DL/platform-36.zip" ]       || curl -sL -o "$DL/platform-36.zip" "https://dl.google.com/android/repository/platform-36_r02.zip" &
[ -s "$DL/build-tools-36.zip" ]    || curl -sL -o "$DL/build-tools-36.zip" "https://dl.google.com/android/repository/build-tools_r36_linux.zip" &
[ -s "$DL/platform-tools.zip" ]    || curl -sL -o "$DL/platform-tools.zip" "https://dl.google.com/android/repository/platform-tools-latest-linux.zip" &
wait
du -h "$DL"/* | sed 's/^/  /'

# 2) JDK
if [ ! -x "$JDK_DIR/bin/javac" ]; then
  rm -rf "$JDK_DIR"
  tar xzf "$DL/jdk21.tar.gz" -C "$AT"
  mv "$AT/jdk-21.0.5+11" "$JDK_DIR"
  echo "JDK restored"
fi

# 3) SDK
if [ ! -f "$SDK/build-tools/36.0.0/apksigner" ]; then
  rm -rf "$SDK"
  mkdir -p "$SDK/platforms" "$SDK/build-tools" "$SDK/licenses"
  (cd "$SDK" && unzip -q "$DL/platform-36.zip")
  (cd "$SDK" && unzip -q "$DL/build-tools-36.zip" -d bt && mv bt/android-* build-tools/36.0.0 && rmdir bt)
  (cd "$SDK" && unzip -q "$DL/platform-tools.zip")
  mv "$SDK"/android-36 "$SDK/platforms/" 2>/dev/null || true
  printf '24333f8a63b6825ea9c5514f83c2829b004d1fee\n8933bad161af4178b1185d1a37fbf41ea5269c55\nd56f5187479451eabf01fb78af6dfcb131a6481e\n' > "$SDK/licenses/android-sdk-license"
  printf '84831b9409646a918e30573bab4c9c91346d8abd\n' > "$SDK/licenses/android-sdk-preview-license"
  echo "SDK restored"
fi

# 4) keystore from git history (commit 327863e kept it before removal)
if [ ! -f "$PJ/android/keystore/last-fortress-release.keystore" ]; then
  mkdir -p "$PJ/android/keystore"
  git -C "$PJ" show 327863e:android/keystore/last-fortress-release.keystore > "$PJ/android/keystore/last-fortress-release.keystore"
  git -C "$PJ" show 327863e:android/keystore.properties > "$PJ/android/keystore.properties"
  echo "keystore restored from git history"
fi
[ -f "$PJ/.env" ] || git -C "$PJ" show 18aab16^:.env > "$PJ/.env"

# 5) credentials + gradle — توکن هرگز داخل گیت نمی‌آید؛
# از ~/.git-credentials موجود یا متغیر GITHUB_TOKEN خوانده می‌شود
if [ ! -s /home/z/.git-credentials ] && [ -n "$GITHUB_TOKEN" ]; then
  printf 'https://derack:%s@github.com\n' "$GITHUB_TOKEN" > /home/z/.git-credentials
  chmod 600 /home/z/.git-credentials
fi
if [ -s /home/z/.git-credentials ]; then
  git -C "$PJ" config credential.helper store
else
  echo "⚠ ~/.git-credentials موجود نیست — push دستی: GITHUB_TOKEN=... bash restore-toolchain.sh"
fi
mkdir -p /home/z/.gradle
printf '# machine-specific JDK path (local builds only — do not commit)\norg.gradle.java.home=%s\n' "$JDK_DIR" > /home/z/.gradle/gradle.properties

echo "=== verify ==="
"$JDK_DIR/bin/javac" -version
"$SDK/build-tools/36.0.0/apksigner" --version | head -1
keytool -list -keystore "$PJ/android/keystore/last-fortress-release.keystore" -storepass 'LF-Ariana-2026-KS#7x9qPz' -alias last-fortress 2>&1 | head -1
echo "TOOLCHAIN READY"
