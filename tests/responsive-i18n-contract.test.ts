import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const modalCss = readFileSync('components/ui/ProductCustomizerModal.module.css', 'utf8');
const aboutCss = readFileSync('app/about/about.module.css', 'utf8');
const languageContext = readFileSync('context/LanguageContext.tsx', 'utf8');
const header = readFileSync('components/layout/Header.tsx', 'utf8');
const home = readFileSync('app/HomeClient.tsx', 'utf8');

test('mobile product customizer collapses options and keeps footer inside the modal', () => {
  assert.match(modalCss, /@media\s*\(max-width:\s*600px\)/);
  assert.match(modalCss, /\.optionsGrid\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);
  assert.match(modalCss, /\.footer\s*\{[\s\S]*?flex-wrap:\s*wrap;/);
  assert.match(modalCss, /\.footer\s*>\s*:last-child\s*\{[\s\S]*?flex:\s*1\s+1\s+100%;/);
});

test('about roastery content can shrink below its grid minimum on small screens', () => {
  assert.match(aboutCss, /\.roasteryShowcase\s*\{[\s\S]*?min-width:\s*0;/);
  assert.match(aboutCss, /\.rText\s*\{[\s\S]*?min-width:\s*0;/);
  assert.match(aboutCss, /\.rText\s+h2\s*\{[\s\S]*?overflow-wrap:\s*anywhere;/);
  assert.match(aboutCss, /\.rText\s+:global\(\.btn\)\s*\{[\s\S]*?white-space:\s*normal;/);
});

test('language changes update the document language and accessible cart label', () => {
  assert.match(languageContext, /document\.documentElement\.lang\s*=\s*lang/);
  assert.match(header, /aria-label=\{t\('Giỏ hàng',\s*'Cart'\)\}/);
});

test('home gallery captions provide English alternatives', () => {
  assert.match(home, /captionVi:/);
  assert.match(home, /captionEn:/);
  assert.match(home, /lang === 'en' \? img\.captionEn : img\.captionVi/);
});
