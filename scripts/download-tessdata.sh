#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT_DIR/android/app/src/main/assets/tessdata"
# Most accurate LSTM model for Russian / Cyrillic (slower, ~15 MB).
URL="https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/main/rus.traineddata"
OUT="$DEST/rus.traineddata"

mkdir -p "$DEST"

echo "Downloading high-accuracy rus.traineddata (tessdata_best)..."
curl -L --fail -o "$OUT" "$URL"
ls -lh "$OUT"
echo "Saved: $OUT"
echo "Note: uninstall/reinstall the app or clear app data so the new model is copied on device."
