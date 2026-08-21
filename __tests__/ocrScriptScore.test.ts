import {
  hasMeaningfulText,
  looksLikeMangledCyrillic,
  pickBestOcrText,
  scoreOcrText,
} from '../utils/ocrScriptScore';

describe('ocrScriptScore', () => {
  it('scores Cyrillic letters', () => {
    const score = scoreOcrText('Привет мир');
    expect(score.cyrillicLetters).toBeGreaterThan(0);
    expect(score.latinLetters).toBe(0);
  });

  it('treats punctuation-only OCR output as empty', () => {
    expect(hasMeaningfulText('*')).toBe(false);
    expect(hasMeaningfulText('  .|  ')).toBe(false);
    expect(hasMeaningfulText('Привет')).toBe(true);
  });

  it('prefers real Cyrillic over ML Kit Latin lookalikes', () => {
    const mlkit = 'A Bac IIOŐHJI: IOŐOBb euë , 6HITb MOKeT';
    const tesseract = 'Я вас любил : любовь ещё , быть может';
    expect(pickBestOcrText([mlkit, tesseract])).toBe(tesseract);
  });

  it('prefers real Latin over Tesseract Cyrillic lookalikes', () => {
    const mlkit = 'You now know how to use agents to understand codebases';
    // Tesseract's Russian model substitutes Cyrillic glyphs into English words.
    const tesseract = 'Yоu nоw knоw hоw tо usе аgеnts tо undеrstаnd соdеbаsеs';
    expect(pickBestOcrText([mlkit, tesseract])).toBe(mlkit);
  });

  it('keeps the longer read when both candidates look equally plausible', () => {
    const short = 'Hello world';
    const long = 'Hello world from a longer and equally clean sentence';
    expect(pickBestOcrText([short, long])).toBe(long);
  });

  it('detects mangled Cyrillic lookalikes from Latin OCR', () => {
    const mangled = `A BAC JIIOBMJI.
A Bac IIOŐHJI: IOŐOBb euë , 6HITb MOKeT,
1 He XO4y IIeMaJIHTb`;
    expect(looksLikeMangledCyrillic(mangled)).toBe(true);
  });

  it('does not flag genuine Latin text as mangled', () => {
    expect(looksLikeMangledCyrillic('Hello world from England')).toBe(false);
    expect(
      looksLikeMangledCyrillic(
        'This chapter shows an example of putting all of those pieces together',
      ),
    ).toBe(false);
  });

  it('ignores empty and junk candidates', () => {
    expect(pickBestOcrText(['Hello world', '!!!'])).toBe('Hello world');
    expect(pickBestOcrText([null, undefined, ''])).toBe('');
  });
});
