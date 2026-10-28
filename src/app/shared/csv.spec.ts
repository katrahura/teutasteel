import { csvDocument, csvText } from './csv';

/**
 * A cell is data. A code beginning with `=` is a code, not a formula the reader's spreadsheet should
 * run; a comma inside one must not shift the columns after it.
 */
describe('csvText', () => {
  it('leaves a real number as a number', () => {
    expect(csvText(12.5)).toBe('12.5');
    expect(csvText(0)).toBe('0');
  });

  it('quotes a comma or a quote and doubles the quote', () => {
    expect(csvText('ODD,"1"')).toBe('"ODD,""1"""');
  });

  it('neutralises a cell a spreadsheet would treat as a formula', () => {
    expect(csvText('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvText('+383 44 133 208')).toBe("'+383 44 133 208");
    expect(csvText('-12')).toBe("'-12");
    expect(csvText('@import')).toBe("'@import");
  });

  it('writes nothing for a missing value', () => {
    expect(csvText(null)).toBe('');
    expect(csvText(undefined)).toBe('');
  });
});

describe('csvDocument', () => {
  it('writes a header and the rows, with CRLF between lines', () => {
    expect(csvDocument(['Code', 'Price'], [['A-1', 12.5], ['B-2', '-3']]))
      .toBe("Code,Price\r\nA-1,12.5\r\nB-2,'-3");
  });
});
