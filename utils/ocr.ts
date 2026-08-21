import { NativeModules, Platform, TurboModuleRegistry } from 'react-native';
import MlkitOcr from 'rn-mlkit-ocr';
import {
  isTessOcrLinked,
  isVisionOcrLinked,
  recognizeCyrillicWithTesseract,
  recognizeWithVisionAuto,
} from './cyrillicOcr';
import {
  hasMeaningfulText,
  looksLikeMangledCyrillic,
  pickBestOcrText,
} from './ocrScriptScore';

export const OCR_NATIVE_MODULE_ERROR =
  'OCR is not linked. Stop Metro, rebuild the app once with: npm run ios';

export function isMlkitOcrLinked(): boolean {
  if (NativeModules.RnMlkitOcr != null) {
    return true;
  }

  return TurboModuleRegistry.get('RnMlkitOcr') != null;
}

async function recognizeLatinWithMlkit(uri: string): Promise<string> {
  if (!isMlkitOcrLinked()) {
    return '';
  }

  try {
    const result = await MlkitOcr.recognizeText(uri, 'latin');
    return result.text.trim();
  } catch {
    return '';
  }
}

/**
 * Extract text with automatic Latin vs Cyrillic detection (no language picker).
 * - iOS: Apple Vision auto language detection (Latin + Cyrillic)
 * - Android: ML Kit (Latin) and Tesseract (Cyrillic) run in parallel, and the
 *   more plausible-looking result wins.
 */
export async function extractTextFromImage(uri: string): Promise<string> {
  if (Platform.OS === 'ios' && isVisionOcrLinked()) {
    const visionRaw = await recognizeWithVisionAuto(uri);
    const visionText = hasMeaningfulText(visionRaw) ? visionRaw : '';
    if (visionText && !looksLikeMangledCyrillic(visionText)) {
      return visionText;
    }

    const latinFallback = await recognizeLatinWithMlkit(uri);
    if (hasMeaningfulText(latinFallback) && !looksLikeMangledCyrillic(latinFallback)) {
      return latinFallback;
    }

    if (visionText) {
      return visionText;
    }

    throw new Error('No text was found in this image. Try a clearer photo.');
  }

  if (!isMlkitOcrLinked() && !isTessOcrLinked()) {
    throw new Error(OCR_NATIVE_MODULE_ERROR);
  }

  const [cyrillicResult, latinText] = await Promise.all([
    recognizeCyrillicWithTesseract(uri),
    recognizeLatinWithMlkit(uri),
  ]);

  const cyrillicText = hasMeaningfulText(cyrillicResult.text)
    ? cyrillicResult.text
    : '';
  const latinCandidate = hasMeaningfulText(latinText) ? latinText : '';

  // Both engines misread the other script into plausible-looking letters,
  // so the winner is decided on word shape rather than on script presence.
  const best = pickBestOcrText([latinCandidate, cyrillicText]);
  if (best) {
    return best;
  }

  if (cyrillicResult.error) {
    throw new Error(`Could not read the text (${cyrillicResult.error}).`);
  }

  throw new Error('No text was found in this image. Try a clearer photo.');
}
