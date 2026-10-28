import { checkDraftVersion } from './draft-version';

describe('draft version contract', () => {
  it('accepts initial version and increments only that section', () => {
    expect(checkDraftVersion({}, 'A:main', 0, 'm1')).toEqual({ duplicate: false, revision: 1, versions: { 'A:main': { revision: 1, mutationId: 'm1' } } });
  });
  it('rejects delayed and unversioned saves without replacing content', () => {
    const versions = { 'A:main': { revision: 2, mutationId: 'new' } };
    expect(() => checkDraftVersion(versions, 'A:main', 1, 'old')).toThrow('草稿版本冲突');
    expect(() => checkDraftVersion(versions, 'A:main', undefined, undefined)).toThrow('草稿版本冲突');
  });
  it('retries the acknowledged mutation without advancing twice', () => {
    expect(checkDraftVersion({ 'B:main': { revision: 3, mutationId: 'm' } }, 'B:main', 2, 'm').duplicate).toBe(true);
  });
  it('keeps A main, B main and feedback independent', () => {
    const versions = { 'A:main': { revision: 7, mutationId: 'a' } };
    const result = checkDraftVersion(versions, 'B:feedback', 0, 'b');
    expect(result.versions['A:main'].revision).toBe(7);
    expect(result.revision).toBe(1);
  });
  it('rejects invalid revisions', () => {
    for (const value of [-1, 0.5, NaN]) expect(() => checkDraftVersion({}, 'A:main', value, 'x')).toThrow();
  });
});
