import { validateNumericAnswers } from './validate-answers';

describe('questionnaire numeric answers', () => {
  const items = [{ code: 'DEMO-01', type: 'number', required: true, min: 0 }];
  it.each([-1, '-3', 'NaN', 'Infinity', {}, [], '', null])('rejects invalid value %p', (value) => {
    expect(() => validateNumericAnswers(items, { 'DEMO-01': value })).toThrow();
  });
  it.each([0, '0', 22, '1.5'])('accepts nonnegative finite %p', (value) => {
    expect(() => validateNumericAnswers(items, { 'DEMO-01': value })).not.toThrow();
  });
});
