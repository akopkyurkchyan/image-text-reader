#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
KEYSTORE_PATH="$ANDROID_DIR/app/upload-keystore.jks"
PROPERTIES_PATH="$ANDROID_DIR/keystore.properties"
KEY_ALIAS="imagetextreader-upload"

if [[ -f "$KEYSTORE_PATH" ]]; then
  echo "Upload keystore already exists at: $KEYSTORE_PATH"
  echo "Delete it first if you want to generate a new one."
  exit 1
fi

if [[ -f "$PROPERTIES_PATH" ]]; then
  echo "keystore.properties already exists at: $PROPERTIES_PATH"
  echo "Delete it first if you want to regenerate credentials."
  exit 1
fi

KEYTOOL=""
if command -v keytool >/dev/null 2>&1; then
  KEYTOOL="keytool"
elif [[ -x "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool" ]]; then
  KEYTOOL="/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool"
else
  echo "keytool not found. Install Java or Android Studio."
  exit 1
fi

STORE_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)"
KEY_PASS="$STORE_PASS"

"$KEYTOOL" -genkeypair -v \
  -storetype PKCS12 \
  -keystore "$KEYSTORE_PATH" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass "$STORE_PASS" \
  -keypass "$KEY_PASS" \
  -dname "CN=Image to Text, OU=Mobile, O=ImageTextReader, L=Unknown, ST=Unknown, C=US"

cat > "$PROPERTIES_PATH" <<EOF
storeFile=app/upload-keystore.jks
storePassword=${STORE_PASS}
keyAlias=${KEY_ALIAS}
keyPassword=${KEY_PASS}
EOF

echo ""
echo "Upload keystore created:"
echo "  $KEYSTORE_PATH"
echo "  $PROPERTIES_PATH"
echo ""
echo "IMPORTANT: Back up both files and store the passwords in a password manager."
echo "If you lose the upload key, you cannot update your app on Google Play."
