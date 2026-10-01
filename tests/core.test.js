/**
 * Tests for stringart-core.js. Run with `npm test` (Node.js 18 or newer).
 *
 * Copyright (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br>
 *
 * This file is part of String Art Generator. It is free software, licensed
 * under the GNU Lesser General Public License v3.0 or later. See
 * COPYING.LESSER and COPYING for details.
 *
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../stringart-core.js');

const SIZE = 120;

function baseParams(overrides = {}) {
    return {
        algorithm: 'greedy',
        radius: SIZE / 2,
        numPins: 60,
        iterations: 400,
        lineOpacity: 20,
        lineWeight: 1,
        minDistance: 8,
        threshold: 16,
        radonAngles: 90,
        pinStart: 'right',
        ...overrides
    };
}

// Darkness image with a filled dark disk in the middle
function diskImage(size = SIZE, radius = size / 4) {
    const d = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if ((x + 0.5 - size / 2) ** 2 + (y + 0.5 - size / 2) ** 2 < radius * radius) d[y * size + x] = 1;
        }
    }
    return d;
}

function approx(actual, expected, tolerance, message) {
    assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected} ± ${tolerance}, got ${actual}`);
}

test('generatePins places pins clockwise from 3 o\'clock or 12 o\'clock', () => {
    const right = core.generatePins(4, 10, 0, 0, 'right');
    approx(right[0].x, 10, 1e-9, 'pin 0 x (right)');
    approx(right[0].y, 0, 1e-9, 'pin 0 y (right)');
    approx(right[1].y, 10, 1e-9, 'pin 1 is below the center (clockwise on screen)');

    const top = core.generatePins(4, 10, 0, 0, 'top');
    approx(top[0].x, 0, 1e-9, 'pin 0 x (top)');
    approx(top[0].y, -10, 1e-9, 'pin 0 y (top)');
    approx(top[1].x, 10, 1e-9, 'pin 1 is right of the center (clockwise)');
});

test('circularDistance wraps around the circle', () => {
    assert.equal(core.circularDistance(1, 199, 200), 2);
    assert.equal(core.circularDistance(0, 100, 200), 100);
    assert.equal(core.circularDistance(5, 5, 200), 0);
});

test('toDarkness inverts gray and applies contrast and gamma', () => {
    const rgba = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 128, 128, 128, 255, 64, 64, 64, 255]);
    const plain = core.toDarkness(rgba, 2);
    approx(plain[0], 0, 1e-6, 'white');
    approx(plain[1], 1, 1e-6, 'black');

    const flat = core.toDarkness(rgba, 2, { contrast: -100 });
    for (const v of flat) approx(v, 0.5, 1e-6, 'contrast -100 is flat gray');

    const darker = core.toDarkness(rgba, 2, { gamma: 2 });
    assert.ok(darker[2] > plain[2], 'gamma above 1 darkens the midtones');
});

test('imagePlacement covers or contains the square and pans', () => {
    const cover = core.imagePlacement(200, 100, 100, { fitMode: 'cover' });
    assert.deepEqual([cover.width, cover.height], [200, 100]);
    assert.equal(cover.x, -50);

    const left = core.imagePlacement(200, 100, 100, { fitMode: 'cover', offsetX: -100 });
    assert.equal(left.x, 0, 'offset -100 shows the left edge');

    const contain = core.imagePlacement(200, 100, 100, { fitMode: 'contain' });
    assert.deepEqual([contain.width, contain.height, contain.y], [100, 50, 25]);

    const zoomed = core.imagePlacement(100, 100, 100, { zoom: 2 });
    assert.deepEqual([zoomed.width, zoomed.x], [200, -50]);
});

test('rasterizeLine coverage adds up to the line area', () => {
    const size = 100;
    const idx = new Uint32Array(core.maxLinePixels(size, 3));
    const cov = new Float32Array(idx.length);

    for (const [x1, y1, x2, y2] of [[10, 50.5, 90, 50.5], [10, 10, 90, 90], [20, 5, 30, 95]]) {
        for (const width of [0.5, 1, 2.5]) {
            const n = core.rasterizeLine(x1, y1, x2, y2, width, size, idx, cov);
            let area = 0;
            for (let k = 0; k < n; k++) {
                assert.ok(idx[k] < size * size, 'index inside the image');
                assert.ok(cov[k] > 0 && cov[k] <= 1 + 1e-6, 'coverage in (0, 1]');
                area += cov[k];
            }
            const length = Math.hypot(x2 - x1, y2 - y1);
            approx(area, length * width, length * width * 0.05 + 2, `area of ${width}px line`);
        }
    }
});

test('radonBin matches a line to its own projection, in either direction', () => {
    const size = SIZE;
    const pins = core.generatePins(60, core.pinRadiusForSize(size), size / 2, size / 2);
    const darkness = new Float32Array(size * size);
    const idx = new Uint32Array(core.maxLinePixels(size, 1));
    const cov = new Float32Array(idx.length);
    const n = core.rasterizeLine(pins[5].x, pins[5].y, pins[35].x, pins[35].y, 1, size, idx, cov);
    for (let k = 0; k < n; k++) darkness[idx[k]] = 1;

    const projections = core.radonTransform(darkness, size, 180);
    const onLine = projections.intensity[core.radonBin(pins[5], pins[35], size / 2, size / 2, projections)];
    const reversed = projections.intensity[core.radonBin(pins[35], pins[5], size / 2, size / 2, projections)];
    const offLine = projections.intensity[core.radonBin(pins[5], pins[20], size / 2, size / 2, projections)];
    assert.ok(onLine > 150, `projection along the dark line is high (${onLine})`);
    assert.equal(reversed, onLine);
    assert.ok(offLine < 50, `projection elsewhere is low (${offLine})`);
});

test('greedy draws nothing on a white image', () => {
    const result = core.generate(new Float32Array(SIZE * SIZE), SIZE, baseParams());
    assert.equal(result.sequence.length, 0);
    assert.equal(result.stopReason, 'converged');
});

for (const algorithm of ['greedy', 'radon']) {
    test(`${algorithm}: respects minDistance, is deterministic, and improves the match`, () => {
        const darkness = diskImage();
        const params = baseParams({ algorithm });
        const a = core.generate(darkness, SIZE, params);
        const b = core.generate(darkness, SIZE, params);

        assert.ok(a.sequence.length > 20, `draws lines (${a.sequence.length})`);
        assert.deepEqual(a.sequence, b.sequence, 'same input, same output');
        assert.equal(a.sequence[0].from, 0, 'starts at pin 0');
        a.sequence.forEach((s, i) => {
            assert.ok(core.circularDistance(s.from, s.to, params.numPins) >= params.minDistance, 'minDistance');
            if (i > 0) assert.equal(s.from, a.sequence[i - 1].to, 'one continuous thread');
        });

        const blank = core.matchError(darkness, new Float32Array(SIZE * SIZE).fill(1), SIZE);
        assert.ok(a.rmse < blank, `match improves (${a.rmse} < ${blank})`);
    });

    test(`${algorithm}: stops at the iteration limit`, () => {
        const darkness = new Float32Array(SIZE * SIZE).fill(1);
        const result = core.generate(darkness, SIZE, baseParams({ algorithm, iterations: 25, threshold: 0 }));
        assert.equal(result.sequence.length, 25);
        assert.equal(result.stopReason, 'iterations');
    });
}

test('radon: a higher threshold stops earlier', () => {
    const darkness = diskImage();
    const low = core.generate(darkness, SIZE, baseParams({ algorithm: 'radon', threshold: 5, iterations: 3000 }));
    const high = core.generate(darkness, SIZE, baseParams({ algorithm: 'radon', threshold: 60, iterations: 3000 }));
    assert.ok(high.sequence.length < low.sequence.length, `${high.sequence.length} < ${low.sequence.length}`);
    assert.equal(high.stopReason, 'converged');
});

test('createRun reports progress through step()', () => {
    const run = core.createRun(diskImage(), SIZE, baseParams({ iterations: 30 }));
    const first = run.step(10);
    assert.equal(first.count, 10);
    assert.equal(first.done, false);
    let status = first;
    while (!status.done) status = run.step(10);
    assert.equal(run.sequence().length, 30);
});

test('computeStats uses the physical diameter and adds nail wraps', () => {
    const pins = core.generatePins(4, 100, 0, 0);
    // Two diameters: pin 0 -> 2 -> 0
    const sequence = [{ from: 0, to: 2 }, { from: 2, to: 0 }];
    const stats = core.computeStats(sequence, pins, 100, { pinCircleDiameterCm: 50, nailDiameterMm: 2 });
    const expected = (2 * 500 + 2 * Math.PI) / 1000; // meters
    approx(stats.stringLength, expected, 1e-9, 'string length');
    approx(stats.stringLengthWithExtra, expected * 1.2, 1e-9, 'with extra');
    approx(stats.pinSpacingMm, (Math.PI * 500) / 4, 1e-9, 'pin spacing');
    assert.equal(stats.physicalRadius, 25);
});

test('formatTime rounds up to the next hour', () => {
    assert.equal(core.formatTime(59.7), '1 hour 0 minutes');
    assert.equal(core.formatTime(45), '45 minutes');
    assert.equal(core.formatTime(125), '2 hours 5 minutes');
});

test('exports: JSON is rounded and complete, text and SVG list every pin', () => {
    const params = baseParams({ pinStart: 'top' });
    const result = { ...core.generate(diskImage(), SIZE, params), params, size: SIZE };
    const stats = core.computeStats(result.sequence, result.pins, result.radius, { pinCircleDiameterCm: 40, nailDiameterMm: 1.5 });

    const json = core.buildRobotJSON(result, stats, new Date('2026-01-01T00:00:00Z'));
    assert.equal(json.metadata.version, core.APP.exportVersion);
    assert.equal(json.metadata.author, core.APP.author);
    assert.equal(json.metadata.pin0Position, "12 o'clock");
    assert.equal(json.pins.length, params.numPins);
    for (const pin of json.pins) {
        for (const key of ['x', 'y']) assert.ok(Math.abs(pin[key] * 1000 - Math.round(pin[key] * 1000)) < 1e-6, `${key} rounded to 3 decimals`);
        for (const key of ['xMm', 'yMm']) assert.ok(Math.abs(pin[key] * 100 - Math.round(pin[key] * 100)) < 1e-6, `${key} rounded to 2 decimals`);
    }
    approx(Math.hypot(json.pins[0].xMm, json.pins[0].yMm), 200, 0.01, 'pins lie on the physical circle');
    assert.deepEqual(json.sequence, result.sequence);

    const text = core.buildInstructions(result, stats);
    assert.ok(text.includes(`Pin ${params.numPins - 1}:`));
    assert.ok(text.includes("12 o'clock"));
    assert.ok(text.includes(`${result.sequence.length}. Pin`));

    const svg = core.buildPinTemplateSVG(params.numPins, 40, 1.5, 'top');
    assert.ok(svg.startsWith('<?xml'));
    assert.ok(svg.includes('width="450mm"'), 'true size: 400 mm circle + 2 x 25 mm margin');
    const pinCircles = (svg.match(/<circle [^>]*fill="#(000|d00)"/g) || []).length;
    assert.equal(pinCircles, params.numPins);
});

test('analyzeImage and suggestParams classify simple images', () => {
    const noise = new Float32Array(SIZE * SIZE);
    let seed = 1;
    for (let i = 0; i < noise.length; i++) {
        seed = (seed * 16807) % 2147483647;
        noise[i] = seed / 2147483647;
    }
    assert.equal(core.analyzeImage(noise, SIZE).imageType, 'high-detail');
    assert.equal(core.analyzeImage(new Float32Array(SIZE * SIZE), SIZE).imageType, 'low-contrast');

    const suggested = core.suggestParams(core.analyzeImage(noise, SIZE));
    for (const key of ['numPins', 'iterations', 'lineOpacity', 'minDistance', 'lineWeight']) {
        assert.ok(Number.isFinite(suggested[key]), key);
    }
});

test('the core rebuilds from its own source, as the Web Worker does', () => {
    const rebuilt = new Function(`return (${core.factory.toString()})();`)();
    const result = rebuilt.generate(diskImage(), SIZE, baseParams({ iterations: 50 }));
    assert.deepEqual(result.sequence, core.generate(diskImage(), SIZE, baseParams({ iterations: 50 })).sequence);
    assert.equal(typeof new Function(`return ${core.workerMain.toString()}`)(), 'function');
});
