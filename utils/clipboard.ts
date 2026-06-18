import { Share, TurboModuleRegistry } from 'react-native';

type ClipboardModule = {
  setString: (content: string) => void;
};

export const CLIPBOARD_NATIVE_MODULE_ERROR =
  'Copy is not available yet. Stop the app, then rebuild with: npm run ios';

export function isClipboardLinked(): boolean {
  return TurboModuleRegistry.get<ClipboardModule>('RNCClipboard') != null;
}

export async function copyTextToClipboard(
  text: string,
): Promise<
  | { ok: true; method: 'clipboard' }
  | { ok: true; method: 'share' }
  | { ok: false; message: string }
> {
  const clipboard = TurboModuleRegistry.get<ClipboardModule>('RNCClipboard');

  if (clipboard) {
    clipboard.setString(text);
    return { ok: true, method: 'clipboard' };
  }

  try {
    await Share.share({ message: text });
    return { ok: true, method: 'share' };
  } catch {
    return { ok: false, message: CLIPBOARD_NATIVE_MODULE_ERROR };
  }
}
