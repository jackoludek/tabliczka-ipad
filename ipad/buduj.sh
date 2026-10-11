#!/bin/bash
# Buduje Tabliczkę na iPada bez projektu Xcode (na Macu GitHub Actions, workflow .github/workflows/ipad.yml):
#   swiftc (kod) + actool (ikona i kolor tła) + Info.plist + strona w www + podpis ad hoc.
# Wynik: wynik/Tabliczka.ipa (bez podpisu Apple; podpisuje go Sideloadly darmowym Apple ID)
# i budowa/iphonesimulator/Tabliczka.app do testu na symulatorze (ipad/test-symulator.sh).
set -euo pipefail
cd "$(dirname "$0")/.."
WYNIK="$PWD/wynik"
BUD="$PWD/budowa"
rm -rf "$WYNIK" "$BUD"
mkdir -p "$WYNIK" "$BUD"
NUMER="$(date -u +%y%m%d%H%M)"
xcodebuild -version | tee "$WYNIK/xcode.txt"

for PLATFORMA in iphoneos iphonesimulator; do
  APP="$BUD/$PLATFORMA/Tabliczka.app"
  mkdir -p "$APP"
  if [ "$PLATFORMA" = iphoneos ]; then CEL="arm64-apple-ios16.0"; NAZWA="iPhoneOS"; else CEL="arm64-apple-ios16.0-simulator"; NAZWA="iPhoneSimulator"; fi
  echo "== $PLATFORMA"
  xcrun -sdk "$PLATFORMA" swiftc -target "$CEL" -O -parse-as-library -module-name Tabliczka ipad/Zrodla/*.swift -o "$APP/Tabliczka"
  cp -R strona "$APP/www"
  rm -f "$APP/www/sw.js"
  xcrun actool ipad/Assets.xcassets --compile "$APP" --platform "$PLATFORMA" --minimum-deployment-target 16.0 \
    --app-icon AppIcon --output-partial-info-plist "$BUD/$PLATFORMA/ikona.plist" \
    --target-device ipad --target-device iphone --output-format human-readable-text
  cp ipad/Info.plist "$APP/Info.plist"
  /usr/libexec/PlistBuddy -c "Merge $BUD/$PLATFORMA/ikona.plist" "$APP/Info.plist"
  plutil -replace CFBundleVersion -string "$NUMER" "$APP/Info.plist"
  plutil -replace CFBundleSupportedPlatforms -json "[\"$NAZWA\"]" "$APP/Info.plist"
  plutil -replace DTPlatformName -string "$PLATFORMA" "$APP/Info.plist"
  plutil -lint "$APP/Info.plist"
  codesign --force --sign - --timestamp=none "$APP"
  ls -la "$APP" | tee "$WYNIK/zawartosc-$PLATFORMA.txt"
done

cd "$BUD/iphoneos"
mkdir -p Payload
mv Tabliczka.app Payload/
zip -qr "$WYNIK/Tabliczka.ipa" Payload
cd - > /dev/null
echo "Wersja $NUMER" > "$WYNIK/wersja.txt"
ls -la "$WYNIK/Tabliczka.ipa"
