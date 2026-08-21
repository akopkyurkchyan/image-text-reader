import { NativeModules, Platform } from 'react-native';

type TessOcrNativeModule = {
  recognizeCyrillic: (imageUri: string) => Promise<string>;
};

type VisionOcrNativeModule = {
  recognize: (imageUri: string) => Promise<string>;
};

const TessOcr = NativeModules.TessOcr as TessOcrNativeModule | undefined;
const VisionOcr = NativeModules.VisionOcr as VisionOcrNativeModule | undefined;

export function isTessOcrLinked(): boolean {
  return TessOcr != null && typeof TessOcr.recognizeCyrillic === 'function';
}

export function isVisionOcrLinked(): boolean {
  return VisionOcr != null && typeof VisionOcr.recognize === 'function';
}

export type CyrillicOcrResult = {
  text: string;
  error?: string;
};

export async function recognizeCyrillicWithTesseract(
  uri: string,
): Promise<CyrillicOcrResult> {
  if (!isTessOcrLinked()) {
    return {
      text: '',
      error:
        'Cyrillic OCR module is not linked. Rebuild the Android app with: npm run android',
    };
  }

  try {
    const text = (await TessOcr!.recognizeCyrillic(uri)).trim();
    return { text };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Tesseract Cyrillic OCR failed';
    return { text: '', error: message };
  }
}

export async function recognizeWithVisionAuto(uri: string): Promise<string> {
  if (!isVisionOcrLinked()) {
    return '';
  }

  try {
    return (await VisionOcr!.recognize(uri)).trim();
  } catch {
    return '';
  }
}

export function getCyrillicEngineHint(): string {
  if (Platform.OS === 'ios') {
    return 'Vision';
  }
  return 'Tesseract';
}
