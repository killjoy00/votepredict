import test from 'node:test';
import assert from 'node:assert/strict';
import { lifecycleSubstantiveBody,lifecycleLanguageTokens,lifecycleLanguageStructuralFeatures } from '../src/evaluation/lifecycle-bill-language-screen.js';

test('language tokenizer uses substantive body and strips legislative boilerplate',()=>{
  const text='A bill for an act relating to health. BE IT ENACTED BY THE LEGISLATURE: Section 1. Diabetes screening program established. Sec. 2. Grants are available.';
  const body=lifecycleSubstantiveBody(text);
  assert.match(body,/Diabetes screening/i);
  const tokens=lifecycleLanguageTokens(text);
  assert.ok(tokens.includes('diabetes'));
  assert.ok(tokens.includes('screening'));
  assert.equal(tokens.includes('section'),false);
});

test('structural language features are deterministic',()=>{
  const text='BE IT ENACTED BY THE LEGISLATURE: Sec. 1. Subd. 1. Minnesota Statutes are amended. Sec. 2. EFFECTIVE DATE. $1,000 is appropriated. Section 3 is repealed.';
  const a=lifecycleLanguageStructuralFeatures(text);
  const b=lifecycleLanguageStructuralFeatures(text);
  assert.deepEqual(a,b);
  assert.ok(a[0]>0);
  assert.ok(a[2]>0);
  assert.ok(a[4]>0);
  assert.ok(a[5]>0);
  assert.ok(a[6]>0);
});
