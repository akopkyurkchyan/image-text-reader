/**
 * Score OCR candidates and pick Latin vs Cyrillic automatically.
 *
 * The two engines fail in opposite, recognisable ways:
 * - ML Kit (Latin only) renders Russian as Latin lookalikes: "JIIOBMJI", "XO4y".
 * - Tesseract (Russian model) renders English with Cyrillic lookalikes: "Yоu knоw".
 *
 * Both failures produce implausible *words*, so candidates are compared on word
 * plausibility rather than on which script happens to be present.
 */

const CYRILLIC_START = 0x0400;
const CYRILLIC_END = 0x04ff;

const LATIN_VOWELS = 'aeiouy';
const CYRILLIC_VOWELS = 'аеёиоуыэюя';

function isLatinLetter(code: number): boolean {
  return (
    (code >= 0x0041 && code <= 0x005a) ||
    (code >= 0x0061 && code <= 0x007a) ||
    (code >= 0x00c0 && code <= 0x024f)
  );
}

function isCyrillicLetter(code: number): boolean {
  return code >= CYRILLIC_START && code <= CYRILLIC_END;
}

function isDigit(code: number): boolean {
  return code >= 0x0030 && code <= 0x0039;
}

function isLetter(code: number): boolean {
  return isLatinLetter(code) || isCyrillicLetter(code);
}

function isUpperCase(char: string): boolean {
  return char !== char.toLowerCase() && char === char.toUpperCase();
}

function isLowerCase(char: string): boolean {
  return char !== char.toUpperCase() && char === char.toLowerCase();
}

function hasVowel(token: string): boolean {
  for (const char of token.toLowerCase()) {
    if (LATIN_VOWELS.includes(char) || CYRILLIC_VOWELS.includes(char)) {
      return true;
    }
  }
  return false;
}

/** Split on anything that is not a letter or digit. */
function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let current = '';

  for (const char of text) {
    const code = char.codePointAt(0);
    if (code != null && (isLetter(code) || isDigit(code))) {
      current += char;
      continue;
    }
    if (current) {
      tokens.push(current);
      current = '';
    }
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function countLettersIn(token: string): number {
  let count = 0;
  for (const char of token) {
    const code = char.codePointAt(0);
    if (code != null && isLetter(code)) {
      count += 1;
    }
  }
  return count;
}

/**
 * A word looks like real language when it keeps to one script, contains a
 * vowel, has no digits spliced in, and uses ordinary capitalisation.
 */
function isPlausibleWord(token: string): boolean {
  let latin = 0;
  let cyrillic = 0;
  let digits = 0;
  let hasUpperAfterLower = false;
  let seenLower = false;

  for (const char of token) {
    const code = char.codePointAt(0);
    if (code == null) {
      continue;
    }

    if (isDigit(code)) {
      digits += 1;
      continue;
    }
    if (isLatinLetter(code)) {
      latin += 1;
    } else if (isCyrillicLetter(code)) {
      cyrillic += 1;
    }

    if (isLowerCase(char)) {
      seenLower = true;
    } else if (isUpperCase(char) && seenLower) {
      hasUpperAfterLower = true;
    }
  }

  if (latin > 0 && cyrillic > 0) {
    return false;
  }
  if (digits > 0) {
    return false;
  }
  if (hasUpperAfterLower) {
    return false;
  }

  return hasVowel(token);
}

export type ScriptScores = {
  text: string;
  cyrillicLetters: number;
  latinLetters: number;
  letterCount: number;
  cyrillicRatio: number;
  wordCount: number;
  plausibleWords: number;
  plausibilityRatio: number;
};

export function scoreOcrText(text: string): ScriptScores {
  let cyrillicLetters = 0;
  let latinLetters = 0;

  for (const char of text) {
    const code = char.codePointAt(0);
    if (code == null) {
      continue;
    }

    if (isCyrillicLetter(code)) {
      cyrillicLetters += 1;
    } else if (isLatinLetter(code)) {
      latinLetters += 1;
    }
  }

  const letterCount = cyrillicLetters + latinLetters;

  // Single characters carry no shape information, so they are not scored.
  const words = tokenize(text).filter(token => countLettersIn(token) >= 2);
  const plausibleWords = words.filter(isPlausibleWord).length;

  return {
    text,
    cyrillicLetters,
    latinLetters,
    letterCount,
    cyrillicRatio: letterCount === 0 ? 0 : cyrillicLetters / letterCount,
    wordCount: words.length,
    plausibleWords,
    plausibilityRatio: words.length === 0 ? 0 : plausibleWords / words.length,
  };
}

export function hasCyrillicScript(text: string): boolean {
  return scoreOcrText(text).cyrillicLetters > 0;
}

/**
 * A failed OCR pass often returns stray punctuation ("*", ".", "|"),
 * which must not be shown to the user as a successful read.
 */
export function hasMeaningfulText(text: string | null | undefined): boolean {
  return scoreOcrText((text ?? '').trim()).letterCount >= 2;
}

/**
 * Latin text that is really a misread of Cyrillic: no Cyrillic letters present,
 * yet most words are shaped implausibly for Latin script.
 */
export function looksLikeMangledCyrillic(text: string): boolean {
  const score = scoreOcrText(text.trim());

  if (score.cyrillicLetters > 0) {
    return false;
  }
  if (score.latinLetters < 6 || score.wordCount < 3) {
    return false;
  }

  return score.plausibilityRatio < MANGLED_PLAUSIBILITY;
}

/**
 * Pick the candidate whose words look most like real language. Falls back to
 * the longer read when candidates are of comparable quality.
 */
export function pickBestOcrText(candidates: Array<string | null | undefined>): string {
  const scored = candidates
    .map(candidate => (candidate ?? '').trim())
    .filter(text => text.length > 0)
    .map(scoreOcrText)
    .filter(score => score.letterCount >= 2);

  if (scored.length === 0) {
    return '';
  }

  const ranked = [...scored].sort((a, b) => {
    if (Math.abs(b.plausibilityRatio - a.plausibilityRatio) > PLAUSIBILITY_MARGIN) {
      return b.plausibilityRatio - a.plausibilityRatio;
    }
    if (b.plausibleWords !== a.plausibleWords) {
      return b.plausibleWords - a.plausibleWords;
    }
    return b.letterCount - a.letterCount;
  });

  return ranked[0].text;
}

const PLAUSIBILITY_MARGIN = 0.15;

/**
 * Calibrated between observed Latin misreads of Cyrillic (0.64-0.67) and
 * genuine Latin text, which scores at or near 1.0.
 */
const MANGLED_PLAUSIBILITY = 0.75;
