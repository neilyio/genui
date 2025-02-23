import { test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const html = readFileSync(join(__dirname, 'index.html'), 'utf8');

test('dom test', () => {
  document.body.innerHTML = html;
  const button = document.querySelector('button');
  expect(button?.innerText).toEqual('My button');
});
