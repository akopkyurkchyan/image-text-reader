type LogValue = string | number | boolean | null | undefined | object;

export function debugLog(message: string, value?: LogValue): void {
  if (!__DEV__ || !console.tron) {
    return;
  }

  if (value === undefined) {
    console.tron.log?.(message);
    return;
  }

  console.tron.display?.({
    name: message,
    value,
    preview: typeof value === 'string' ? value.slice(0, 120) : undefined,
  });
}

export function debugError(message: string, error: unknown): void {
  if (!__DEV__ || !console.tron) {
    return;
  }

  console.tron.error?.(message, error);
}
