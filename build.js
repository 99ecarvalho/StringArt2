/**
 * String Art Generator - Build script
 *
 * Bundles index.html, style.css, stringart-core.js and script.js into dist/
 * for deployment:
 *   dist/index.html           single file with CSS and JS inlined
 *   dist/index-separate.html  page that loads the files below
 *   dist/style.min.css        minified stylesheet
 *   dist/stringart-core.js    unmodified algorithms
 *   dist/script.js            unmodified user interface
 *   dist/.htaccess            optional Apache configuration
 *   dist/COPYING, dist/COPYING.LESSER
 *
 * The JavaScript is deliberately not minified or renamed: the project is free
 * software and the shipped code should stay readable.
 *
 * Copyright (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br>
 *
 * This file is part of String Art Generator. It is free software, licensed
 * under the GNU Lesser General Public License v3.0 or later. See
 * COPYING.LESSER and COPYING for details.
 *
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');

const banner = '/*! String Art Generator | (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br> | LGPL-3.0-or-later | See COPYING.LESSER */';

const CSS_TAG = '<link rel="stylesheet" href="style.css">';
const CORE_TAG = '<script src="stringart-core.js"></script>';
const JS_TAG = '<script src="script.js"></script>';

function read(file) {
    return fs.readFileSync(path.join(root, file), 'utf8');
}

// Conservative CSS minifier: drops comments and collapses whitespace
// around punctuation. Safe for this stylesheet (no strings with significant
// spaces, no descendant selectors starting with ':').
function minifyCSS(code) {
    return code
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([{}:;,])\s*/g, '$1')
        .replace(/;}/g, '}')
        .trim();
}

// Replace exactly one occurrence of `tag`, failing loudly if it is missing.
// A replacer function is used so '$' sequences in the code are not expanded.
function replaceTag(html, tag, replacement) {
    if (!html.includes(tag)) {
        throw new Error(`index.html does not contain ${tag}`);
    }
    return html.replace(tag, () => replacement);
}

const coreJS = read('stringart-core.js');
const scriptJS = read('script.js');
const styleCSS = read('style.css');
const indexHTML = read('index.html');

for (const [name, code] of [['stringart-core.js', coreJS], ['script.js', scriptJS]]) {
    if (/<\/script/i.test(code)) {
        throw new Error(`${name} contains "</script" and cannot be inlined`);
    }
}

const minCSS = banner + '\n' + minifyCSS(styleCSS);

// Single file: CSS and JS inlined
let inlineHTML = replaceTag(indexHTML, CSS_TAG, `<style>\n${minCSS}\n</style>`);
inlineHTML = replaceTag(inlineHTML, CORE_TAG, `<script>\n${coreJS}</script>`);
inlineHTML = replaceTag(inlineHTML, JS_TAG, `<script>\n${scriptJS}</script>`);

// Separate files
const separateHTML = replaceTag(indexHTML, CSS_TAG, '<link rel="stylesheet" href="style.min.css">');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);

fs.writeFileSync(path.join(dist, 'index.html'), inlineHTML);
fs.writeFileSync(path.join(dist, 'index-separate.html'), separateHTML);
fs.writeFileSync(path.join(dist, 'style.min.css'), minCSS);
fs.writeFileSync(path.join(dist, 'stringart-core.js'), coreJS);
fs.writeFileSync(path.join(dist, 'script.js'), scriptJS);
fs.copyFileSync(path.join(root, 'deploy', '.htaccess'), path.join(dist, '.htaccess'));
fs.copyFileSync(path.join(root, 'COPYING'), path.join(dist, 'COPYING'));
fs.copyFileSync(path.join(root, 'COPYING.LESSER'), path.join(dist, 'COPYING.LESSER'));

const kb = n => (n / 1024).toFixed(2) + ' KB';
console.log('Build complete:');
console.log(`  dist/index.html           ${kb(inlineHTML.length)} (single file)`);
console.log(`  dist/index-separate.html  ${kb(separateHTML.length)}`);
console.log(`  dist/style.min.css        ${kb(minCSS.length)} (from ${kb(styleCSS.length)})`);
console.log(`  dist/stringart-core.js    ${kb(coreJS.length)}`);
console.log(`  dist/script.js            ${kb(scriptJS.length)}`);
console.log('  dist/.htaccess, dist/COPYING, dist/COPYING.LESSER');
