import { NativeModules, TurboModuleRegistry } from 'react-native';
import MlkitOcr from 'rn-mlkit-ocr';

export const OCR_NATIVE_MODULE_ERROR =
  'OCR is not linked. Stop Metro, rebuild the app once with: npm run ios';

export function isMlkitOcrLinked(): boolean {
  if (NativeModules.RnMlkitOcr != null) {
    return true;
  }

  return TurboModuleRegistry.get('RnMlkitOcr') != null;
}

export async function extractTextFromImage(uri: string): Promise<string> {
  if (!isMlkitOcrLinked()) {
    throw new Error(OCR_NATIVE_MODULE_ERROR);
  }

  const result = await MlkitOcr.recognizeText(uri, 'latin');
  const text = result.text.trim();

  if (!text) {
    throw new Error('No text was found in this image. Try a clearer photo.');
  }

  return text;
}
