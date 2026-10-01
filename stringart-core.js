/**
 * String Art Generator - Core algorithms
 *
 * Everything that does not need the page: pin geometry, image-to-darkness
 * conversion, line rasterization, the Greedy and Radon algorithms, image
 * analysis, project statistics, and the export formats.
 *
 * The same file runs in three places:
 *   - the browser, as a classic script (exposes window.StringArtCore);
 *   - a Web Worker, built from StringArtCore.factory.toString();
 *   - Node.js, for the tests (module.exports).
 * So it must stay free of DOM access and of top-level state.
 *
 * Copyright (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br>
 *
 * This file is part of String Art Generator. It is free software, licensed
 * under the GNU Lesser General Public License v3.0 or later. See
 * COPYING.LESSER and COPYING for details.
 *
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

(function (root, factory) {
    const core = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = core;
    } else {
        root.StringArtCore = core;
    }
})(typeof self !== 'undefined' ? self : this, function StringArtCoreFactory() {
    'use strict';

    const APP = {
        name: 'String Art Generator',
        author: 'Eduardo Correia <ecorreia@apliant.com.br>',
        license: 'LGPL-3.0-or-later',
        exportVersion: '1.1'
    };

    // Maximum number of cached line pixels (each costs 8 bytes). Lines beyond
    // the budget are rasterized again whenever they are scored.
    const LINE_CACHE_BUDGET = 8 * 1024 * 1024;

    // Weights of the Radon mode score
    const RADON_WEIGHT = 0.7;
    const PIXEL_WEIGHT = 0.3;

    // ------------------------------------------------------------------
    // Geometry
    // ------------------------------------------------------------------

    // Angle of pin 0: 'right' is the 3 o'clock position, 'top' is 12 o'clock.
    // Pins are numbered clockwise (screen coordinates, y axis pointing down).
    const PIN_START_ANGLES = { right: 0, top: -Math.PI / 2 };

    function pinAngle(index, numPins, pinStart) {
        const start = PIN_START_ANGLES[pinStart] !== undefined ? PIN_START_ANGLES[pinStart] : 0;
        return start + (index / numPins) * Math.PI * 2;
    }

    function generatePins(numPins, radius, centerX, centerY, pinStart = 'right') {
        const pins = [];
        for (let i = 0; i < numPins; i++) {
            const angle = pinAngle(i, numPins, pinStart);
            pins.push({
                index: i,
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius
            });
        }
        return pins;
    }

    // Radius of the pin circle inside a size x size image. Half a pixel in
    // from the edge, so every pin lies inside the pixel grid.
    function pinRadiusForSize(size) {
        return size / 2 - 0.5;
    }

    function circularDistance(a, b, numPins) {
        const d = Math.abs(a - b);
        return Math.min(d, numPins - d);
    }

    // ------------------------------------------------------------------
    // Image preparation
    // ------------------------------------------------------------------

    // Convert RGBA pixels (already scaled and cropped to size x size) to
    // darkness values in [0, 1], where 1 is black.
    //   contrast: -100 (flat gray) .. 0 (unchanged) .. 100 (3x contrast)
    //   gamma:    applied to brightness; above 1 darkens the midtones
    function toDarkness(rgba, size, { contrast = 0, gamma = 1 } = {}) {
        const factor = contrast >= 0 ? 1 + (contrast / 100) * 2 : 1 + contrast / 100;
        const out = new Float32Array(size * size);
        for (let i = 0, p = 0; p < out.length; i += 4, p++) {
            const gray = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) / 255;
            let v = (gray - 0.5) * factor + 0.5;
            v = v < 0 ? 0 : v > 1 ? 1 : v;
            if (gamma !== 1) v = Math.pow(v, gamma);
            out[p] = 1 - v;
        }
        return out;
    }

    // Where to draw an image of iw x ih pixels inside a size x size square.
    //   fitMode: 'cover' fills the square (cropping), 'contain' fits inside it
    //   zoom:    1 or more, extra magnification
    //   offsetX/offsetY: -100 .. 100, pans across the part that doesn't fit
    function imagePlacement(iw, ih, size, { fitMode = 'cover', zoom = 1, offsetX = 0, offsetY = 0 } = {}) {
        const base = fitMode === 'contain'
            ? Math.min(size / iw, size / ih)
            : Math.max(size / iw, size / ih);
        const scale = base * zoom;
        const width = iw * scale;
        const height = ih * scale;
        return {
            x: (size - width) / 2 - (offsetX / 100) * Math.abs(width - size) / 2,
            y: (size - height) / 2 - (offsetY / 100) * Math.abs(height - size) / 2,
            width,
            height
        };
    }

    // ------------------------------------------------------------------
    // Line rasterization
    // ------------------------------------------------------------------

    // Rasterize the segment (x1, y1)-(x2, y2) as a band `width` pixels wide.
    // Writes the covered pixel indices to outIdx and the covered fraction of
    // each pixel (0-1) to outCov, and returns how many were written. This is
    // box-filtered coverage, as a canvas uses to antialias a stroke.
    function rasterizeLine(x1, y1, x2, y2, width, size, outIdx, outCov) {
        const steep = Math.abs(y2 - y1) > Math.abs(x2 - x1);
        // Step along the major axis (a) and spread across the minor axis (b)
        let a1 = steep ? y1 : x1;
        let b1 = steep ? x1 : y1;
        let a2 = steep ? y2 : x2;
        let b2 = steep ? x2 : y2;
        if (a2 < a1) {
            [a1, a2] = [a2, a1];
            [b1, b2] = [b2, b1];
        }
        const slope = a2 > a1 ? (b2 - b1) / (a2 - a1) : 0;
        // A band of perpendicular width w spans w * sqrt(1 + slope²) along b
        const half = (width * Math.sqrt(1 + slope * slope)) / 2;

        let n = 0;
        const aStart = Math.max(0, Math.floor(a1));
        const aEnd = Math.min(size - 1, Math.floor(a2));
        for (let a = aStart; a <= aEnd; a++) {
            const b = b1 + (a + 0.5 - a1) * slope;
            const lo = b - half;
            const hi = b + half;
            const kStart = Math.max(0, Math.floor(lo));
            const kEnd = Math.min(size - 1, Math.floor(hi));
            for (let k = kStart; k <= kEnd; k++) {
                const cov = Math.min(k + 1, hi) - Math.max(k, lo);
                if (cov <= 0) continue;
                outIdx[n] = steep ? a * size + k : k * size + a;
                outCov[n] = cov;
                n++;
            }
        }
        return n;
    }

    // Upper bound on the pixels rasterizeLine() can write for a given size
    function maxLinePixels(size, width) {
        return (size + 1) * (Math.ceil(width * Math.SQRT2) + 2);
    }

    // ------------------------------------------------------------------
    // Radon transform
    // ------------------------------------------------------------------

    // Compute the Radon transform R(theta, rho) of the darkness image: the
    // mean darkness (scaled to 0-255) along every line
    // (x - c)cos(theta) + (y - c)sin(theta) = rho, where c is the image
    // center. theta is the angle of the line's normal, in [0, pi), and rho is
    // signed. Only lines that cross the pin circle are needed, so
    // |rho| <= size / 2 and each line is sampled along its chord of that
    // circle.
    function radonTransform(darkness, size, numAngles) {
        const rhoStep = 2; // Step size of 2 pixels
        const maxRho = size / 2;
        const rhoSteps = Math.ceil(maxRho / rhoStep);
        const numRhos = rhoSteps * 2 + 1;
        const intensity = new Float32Array(numAngles * numRhos);
        const center = size / 2;

        for (let angleIdx = 0; angleIdx < numAngles; angleIdx++) {
            const theta = (angleIdx * Math.PI) / numAngles; // 0 to π
            const cosTheta = Math.cos(theta);
            const sinTheta = Math.sin(theta);

            for (let rhoIdx = 0; rhoIdx < numRhos; rhoIdx++) {
                const rho = (rhoIdx - rhoSteps) * rhoStep;
                if (Math.abs(rho) > maxRho) continue;

                // Point on the line closest to the center, then walk along it
                const baseX = center + rho * cosTheta;
                const baseY = center + rho * sinTheta;
                const halfChord = Math.sqrt(maxRho * maxRho - rho * rho);

                let sum = 0;
                let count = 0;
                for (let t = -halfChord; t <= halfChord; t += 1) {
                    const xi = Math.floor(baseX - t * sinTheta);
                    const yi = Math.floor(baseY + t * cosTheta);
                    if (xi >= 0 && xi < size && yi >= 0 && yi < size) {
                        sum += darkness[yi * size + xi];
                        count++;
                    }
                }

                // Only keep lines with enough samples
                if (count > 10) {
                    intensity[angleIdx * numRhos + rhoIdx] = (sum / count) * 255;
                }
            }
        }

        return { intensity, numAngles, numRhos, rhoSteps, rhoStep };
    }

    // Index of the projection bin nearest to the line through p1 and p2
    function radonBin(p1, p2, centerX, centerY, projections) {
        // Normal angle of the line, in the same convention as the transform
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        let theta = Math.atan2(dx, -dy);
        if (theta < 0) theta += Math.PI;
        if (theta >= Math.PI) theta -= Math.PI;

        // Signed distance from the center to the line along that normal
        let rho = (p1.x - centerX) * Math.cos(theta) + (p1.y - centerY) * Math.sin(theta);

        // theta = pi is theta = 0 with rho negated
        const { numAngles, numRhos, rhoSteps, rhoStep } = projections;
        let angleIdx = Math.round((theta / Math.PI) * numAngles);
        if (angleIdx >= numAngles) {
            angleIdx -= numAngles;
            rho = -rho;
        }
        const rhoIdx = Math.min(numRhos - 1, Math.max(0, Math.round(rho / rhoStep) + rhoSteps));
        return angleIdx * numRhos + rhoIdx;
    }

    // ------------------------------------------------------------------
    // Generation
    // ------------------------------------------------------------------

    // Start a generation run. `darkness` is a size x size Float32Array from
    // toDarkness(); `params` holds algorithm, numPins, iterations,
    // lineOpacity (%), lineWeight (px), minDistance, threshold, radonAngles
    // and pinStart.
    //
    // The run models the canvas exactly: each string is a band lineWeight
    // pixels wide that multiplies the brightness of every pixel it covers by
    // (1 - opacity * coverage). T holds that brightness (transmittance), so
    // the rendered darkness is 1 - T and the residual still to be drawn is
    // darkness - (1 - T).
    //
    // Call step() repeatedly until it reports done, so the caller can report
    // progress or stop early.
    function createRun(darkness, size, params) {
        const numPins = params.numPins;
        const alpha = params.lineOpacity / 100;
        const width = params.lineWeight;
        const isRadon = params.algorithm === 'radon';
        const center = size / 2;
        const radius = pinRadiusForSize(size);
        const pins = generatePins(numPins, radius, center, center, params.pinStart);

        const T = new Float32Array(size * size).fill(1);
        const projections = isRadon ? radonTransform(darkness, size, params.radonAngles) : null;

        // Line cache: pixel indices and coverage per pin pair
        const cacheIdx = new Array(numPins * numPins);
        const cacheCov = new Array(numPins * numPins);
        const cacheCount = new Uint32Array(numPins * numPins);
        const covSums = new Float32Array(numPins * numPins);
        const originalMeans = new Float32Array(numPins * numPins).fill(NaN);
        let cachedPixels = 0;
        const scratchIdx = new Uint32Array(maxLinePixels(size, width));
        const scratchCov = new Float32Array(scratchIdx.length);

        // Pixels of the line between two pins. The returned arrays are only
        // valid until the next call when the line is not cached.
        const line = { idx: null, cov: null, n: 0, covSum: 0, originalMean: 0 };
        function getLine(i, j) {
            const key = i < j ? i * numPins + j : j * numPins + i;
            if (cacheIdx[key]) {
                line.idx = cacheIdx[key];
                line.cov = cacheCov[key];
                line.n = cacheCount[key];
            } else {
                const n = rasterizeLine(pins[i].x, pins[i].y, pins[j].x, pins[j].y, width, size, scratchIdx, scratchCov);
                line.n = n;
                if (cachedPixels + n <= LINE_CACHE_BUDGET) {
                    cacheIdx[key] = scratchIdx.slice(0, n);
                    cacheCov[key] = scratchCov.slice(0, n);
                    cacheCount[key] = n;
                    cachedPixels += n;
                    line.idx = cacheIdx[key];
                    line.cov = cacheCov[key];
                } else {
                    line.idx = scratchIdx;
                    line.cov = scratchCov;
                }
            }
            if (Number.isNaN(originalMeans[key])) {
                let covSum = 0;
                let sum = 0;
                for (let k = 0; k < line.n; k++) {
                    covSum += line.cov[k];
                    sum += line.cov[k] * darkness[line.idx[k]];
                }
                covSums[key] = covSum;
                originalMeans[key] = covSum > 0 ? sum / covSum : 0;
            }
            line.covSum = covSums[key];
            line.originalMean = originalMeans[key];
            return line;
        }

        // Greedy: how much drawing the line reduces the squared error between
        // the target and the rendering. Negative when it would overshoot.
        function greedyScore(l) {
            let gain = 0;
            for (let k = 0; k < l.n; k++) {
                const p = l.idx[k];
                const t = T[p];
                const delta = t * alpha * l.cov[k];
                const residual = darkness[p] - (1 - t);
                gain += delta * (2 * residual - delta);
            }
            return gain;
        }

        // Radon: 70% projection + 30% mean residual, both on a 0-255 scale.
        // The projections come from the original image and never change, so
        // they are scaled by the share of the line's darkness still missing
        // from the rendering; lines through covered areas fade.
        function radonScore(i, j, l) {
            if (l.covSum <= 0) return -Infinity;
            let sum = 0;
            for (let k = 0; k < l.n; k++) {
                const p = l.idx[k];
                sum += l.cov[k] * (darkness[p] - (1 - T[p]));
            }
            const meanResidual = sum / l.covSum;
            const remaining = l.originalMean > 0 ? Math.min(1, Math.max(0, meanResidual) / l.originalMean) : 0;
            const projection = projections.intensity[radonBin(pins[i], pins[j], center, center, projections)];
            return RADON_WEIGHT * projection * remaining + PIXEL_WEIGHT * meanResidual * 255;
        }

        function drawLine(l) {
            for (let k = 0; k < l.n; k++) {
                T[l.idx[k]] *= 1 - alpha * l.cov[k];
            }
        }

        const sequence = [];
        let currentPin = 0;
        let done = numPins < 2;
        let stopReason = done ? 'no-candidates' : null;

        function step(maxIterations) {
            for (let s = 0; s < maxIterations && !done; s++) {
                if (sequence.length >= params.iterations) {
                    done = true;
                    stopReason = 'iterations';
                    break;
                }

                let bestPin = -1;
                let bestScore = -Infinity;
                for (let target = 0; target < numPins; target++) {
                    if (circularDistance(target, currentPin, numPins) < params.minDistance) continue;
                    const l = getLine(currentPin, target);
                    const score = isRadon ? radonScore(currentPin, target, l) : greedyScore(l);
                    if (score > bestScore) {
                        bestScore = score;
                        bestPin = target;
                    }
                }

                if (bestPin === -1) {
                    done = true;
                    stopReason = 'no-candidates';
                } else if (isRadon ? bestScore < params.threshold : bestScore <= 0) {
                    // Radon: below the threshold. Greedy: no line improves the match.
                    done = true;
                    stopReason = 'converged';
                } else {
                    drawLine(getLine(currentPin, bestPin));
                    sequence.push({ from: currentPin, to: bestPin });
                    currentPin = bestPin;
                }
            }
            return { done, count: sequence.length, stopReason };
        }

        return {
            pins,
            radius,
            step,
            sequence: () => sequence,
            rmse: () => matchError(darkness, T, size)
        };
    }

    // Root-mean-square difference between the target darkness and the
    // rendered darkness (1 - T), over the pixels inside the pin circle.
    // 0 is a perfect match, 1 is the worst possible.
    function matchError(darkness, T, size) {
        const c = size / 2;
        const r2 = pinRadiusForSize(size) ** 2;
        let sum = 0;
        let count = 0;
        for (let y = 0; y < size; y++) {
            const dy = y + 0.5 - c;
            for (let x = 0; x < size; x++) {
                const dx = x + 0.5 - c;
                if (dx * dx + dy * dy > r2) continue;
                const p = y * size + x;
                const diff = darkness[p] - (1 - T[p]);
                sum += diff * diff;
                count++;
            }
        }
        return count > 0 ? Math.sqrt(sum / count) : 0;
    }

    // Run a whole generation synchronously (used by the Web Worker and tests)
    function generate(darkness, size, params, onProgress) {
        const run = createRun(darkness, size, params);
        let status;
        do {
            status = run.step(50);
            if (onProgress) onProgress(status.count, params.iterations);
        } while (!status.done);
        return {
            pins: run.pins,
            radius: run.radius,
            sequence: run.sequence(),
            rmse: run.rmse(),
            stopReason: status.stopReason
        };
    }

    // ------------------------------------------------------------------
    // Image analysis (Auto-optimize)
    // ------------------------------------------------------------------

    function analyzeImage(darkness, size) {
        const n = darkness.length;
        let darkPixels = 0;
        let total = 0;
        let maxIntensity = 0;
        let minIntensity = 255;

        for (let i = 0; i < n; i++) {
            const val = darkness[i] * 255;
            total += val;
            if (val > maxIntensity) maxIntensity = val;
            if (val < minIntensity) minIntensity = val;
            if (val > 128) darkPixels++;
        }

        const avgIntensity = total / n;
        const darkRatio = darkPixels / n;

        // Contrast (standard deviation)
        let variance = 0;
        for (let i = 0; i < n; i++) {
            variance += Math.pow(darkness[i] * 255 - avgIntensity, 2);
        }
        const stdDev = Math.sqrt(variance / n);
        const contrast = stdDev / 128; // Normalized 0-1

        // Edges (simple Sobel-like)
        let edgePixels = 0;
        for (let y = 1; y < size - 1; y++) {
            for (let x = 1; x < size - 1; x++) {
                const idx = y * size + x;
                const gx = Math.abs(darkness[idx + 1] - darkness[idx - 1]) * 255;
                const gy = Math.abs(darkness[idx + size] - darkness[idx - size]) * 255;
                if (Math.sqrt(gx * gx + gy * gy) > 30) edgePixels++;
            }
        }
        const edgeRatio = edgePixels / n;

        // Classify image type. The thresholds were calibrated on standard test
        // photos (portraits, animals, objects, text, logos, textures, scenery).
        // Faces can't be told apart from other photos with these global
        // statistics, so "photo" covers any detailed, mid-tone photograph.
        let imageType = 'general';
        if (contrast > 0.45 && edgeRatio >= 0.03 && edgeRatio <= 0.25 &&
            darkRatio >= 0.3 && darkRatio <= 0.6) {
            imageType = 'photo';
        } else if (edgeRatio > 0.25) {
            imageType = 'high-detail';
        } else if (contrast < 0.25) {
            imageType = 'low-contrast';
        } else if (darkRatio > 0.6) {
            imageType = 'dark';
        } else if (darkRatio < 0.3) {
            imageType = 'light';
        }

        return { avgIntensity, darkRatio, contrast, edgeRatio, imageType, stdDev, minIntensity, maxIntensity };
    }

    function suggestParams(analysis) {
        const params = {};

        // Number of pins based on image detail
        if (analysis.edgeRatio > 0.25 || analysis.imageType === 'photo') {
            params.numPins = 250; // High detail
        } else if (analysis.edgeRatio > 0.15) {
            params.numPins = 200; // Medium detail
        } else {
            params.numPins = 150; // Low detail
        }

        // Iterations based on darkness and contrast
        if (analysis.imageType === 'photo') {
            params.iterations = 3500;
        } else if (analysis.darkRatio > 0.5) {
            params.iterations = 4000; // Dark images need more lines
        } else if (analysis.contrast > 0.5) {
            params.iterations = 3000; // High contrast
        } else {
            params.iterations = 2500; // Low contrast
        }

        // Line opacity based on darkness
        if (analysis.darkRatio > 0.6) {
            params.lineOpacity = 15; // Light lines for dark images
        } else if (analysis.darkRatio < 0.3) {
            params.lineOpacity = 25; // Darker lines for light images
        } else {
            params.lineOpacity = 20; // Balanced
        }

        // Min distance based on detail level
        params.minDistance = analysis.edgeRatio > 0.25 ? 15 : 20;

        // Line weight based on pin count
        params.lineWeight = params.numPins > 200 ? 0.8 : 1;

        return params;
    }

    // ------------------------------------------------------------------
    // Statistics
    // ------------------------------------------------------------------

    // `physical` holds pinCircleDiameterCm (diameter of the circle the pins
    // stand on) and nailDiameterMm. Each connection also wraps about half
    // way around a nail, which is added to the string length.
    function computeStats(sequence, pins, radiusPx, physical) {
        const numPins = pins.length;
        const mmPerPx = (physical.pinCircleDiameterCm * 10) / (2 * radiusPx);

        let lengthPx = 0;
        for (const step of sequence) {
            const from = pins[step.from];
            const to = pins[step.to];
            lengthPx += Math.hypot(to.x - from.x, to.y - from.y);
        }
        const wrapMm = (Math.PI * physical.nailDiameterMm / 2) * sequence.length;
        const stringLength = (lengthPx * mmPerPx + wrapMm) / 1000; // meters
        const stringLengthWithExtra = stringLength * 1.2; // 20% extra for knots and waste

        // Time estimates: 12 s per connection at first, slowing with fatigue
        const totalConnections = sequence.length;
        let totalSeconds = 0;
        for (let i = 0; i < totalConnections; i++) {
            if (i < 200) totalSeconds += 12;
            else if (i < 500) totalSeconds += 15;
            else if (i < 1000) totalSeconds += 18;
            else totalSeconds += 22;
        }

        // 5-minute break every 30 minutes, plus up to 3 longer breaks
        const workMinutes = totalSeconds / 60;
        const breakCount = Math.floor(workMinutes / 30);
        const bathroomBreaks = Math.min(3, Math.floor(workMinutes / 60));
        const totalMinutes = workMinutes + breakCount * 5 + bathroomBreaks * 8;

        // Sessions of at most 90 minutes
        const sessionDuration = 90;

        return {
            pinCircleDiameterCm: physical.pinCircleDiameterCm,
            physicalRadius: physical.pinCircleDiameterCm / 2, // cm
            nailDiameterMm: physical.nailDiameterMm,
            pinSpacingMm: numPins > 0 ? (Math.PI * physical.pinCircleDiameterCm * 10) / numPins : 0,
            mmPerPx,
            stringLength,
            stringLengthWithExtra,
            workTimeMinutes: workMinutes,
            totalMinutes,
            workTimeFormatted: formatTime(workMinutes),
            totalTimeFormatted: formatTime(totalMinutes),
            connectionsPerMinute: workMinutes > 0 ? totalConnections / workMinutes : 0,
            recommendedSessions: Math.ceil(totalMinutes / sessionDuration),
            sessionDuration,
            breakCount,
            bathroomBreaks
        };
    }

    function formatTime(minutes) {
        let hours = Math.floor(minutes / 60);
        let mins = Math.round(minutes % 60);
        if (mins === 60) { // e.g. 59.6 minutes rounds up to a full hour
            hours++;
            mins = 0;
        }
        if (hours === 0) return `${mins} minutes`;
        if (hours === 1) return `1 hour ${mins} minutes`;
        return `${hours} hours ${mins} minutes`;
    }

    // ------------------------------------------------------------------
    // Exports
    // ------------------------------------------------------------------

    function round(value, digits) {
        const f = Math.pow(10, digits);
        return Math.round(value * f) / f;
    }

    function pinStartLabel(pinStart) {
        return pinStart === 'top' ? "12 o'clock" : "3 o'clock";
    }

    // `result` is { params, pins, radius, sequence, rmse } from a run
    function buildInstructions(result, stats) {
        const p = result.params;
        let text = `STRING ART INSTRUCTIONS\n`;
        text += `=======================\n`;
        text += `Generated by ${APP.name} - (c) ${APP.author}\n\n`;
        text += `ALGORITHM: ${p.algorithm.toUpperCase()}\n`;
        if (p.algorithm === 'radon') {
            text += `- Radon Transform angles: ${p.radonAngles}\n`;
            text += `- Darkness threshold: ${p.threshold}\n`;
        }
        text += `- Match to target image: ${matchPercent(result.rmse)}%\n`;
        text += `\n`;
        text += `SETUP:\n`;
        text += `- Pin circle diameter: ${stats.pinCircleDiameterCm.toFixed(1)} cm\n`;
        text += `- Number of pins: ${p.numPins} (spaced ${stats.pinSpacingMm.toFixed(1)} mm apart)\n`;
        text += `- Nail diameter: ${stats.nailDiameterMm} mm\n`;
        text += `- Total string connections: ${result.sequence.length}\n\n`;
        text += `MATERIALS NEEDED:\n`;
        text += `- String length required: ${stats.stringLength.toFixed(2)} meters (including wraps around the nails)\n`;
        text += `- Recommended: ${stats.stringLengthWithExtra.toFixed(2)} meters (includes 20% extra for knots/waste)\n`;
        text += `- A board larger than ${stats.pinCircleDiameterCm.toFixed(1)} cm across\n`;
        text += `- Pins/nails: ${p.numPins} pieces\n\n`;
        text += `TIME ESTIMATE:\n`;
        text += `- Estimated work time: ${stats.workTimeFormatted}\n`;
        text += `- With breaks & fatigue: ${stats.totalTimeFormatted}\n`;
        text += `- Average speed: ${stats.connectionsPerMinute.toFixed(1)} connections/minute\n`;
        text += `- Recommended sessions: ${stats.recommendedSessions} sessions of ${stats.sessionDuration} minutes each\n\n`;
        text += `PIN POSITIONS (pin 0 at the ${pinStartLabel(p.pinStart)} position, numbered clockwise;\n`;
        text += `angles measured clockwise from pin 0):\n`;
        for (let i = 0; i < p.numPins; i++) {
            text += `Pin ${i}: ${((i / p.numPins) * 360).toFixed(1)}°\n`;
        }
        text += `\n\nSTRING SEQUENCE:\n`;
        text += `Follow these steps, connecting the string from pin to pin:\n\n`;
        result.sequence.forEach((step, i) => {
            text += `${i + 1}. Pin ${step.from} → Pin ${step.to}\n`;
        });
        return text;
    }

    function buildRobotJSON(result, stats, generatedAt = new Date()) {
        const p = result.params;
        const center = result.pins.length ? result.size / 2 : 0;
        return {
            metadata: {
                generated: generatedAt.toISOString(),
                type: 'string_art',
                version: APP.exportVersion,
                algorithm: p.algorithm,
                generator: APP.name,
                author: APP.author,
                license: APP.license,
                pin0Position: pinStartLabel(p.pinStart),
                coordinateSystem: 'origin at circle center, x right, y down; x/y in pixels, xMm/yMm in millimeters'
            },
            parameters: {
                algorithm: p.algorithm,
                radius: p.radius,
                numPins: p.numPins,
                iterations: p.iterations,
                lineOpacity: p.lineOpacity,
                lineWeight: p.lineWeight,
                minDistance: p.minDistance,
                pinStart: p.pinStart
            },
            algorithmSpecific: p.algorithm === 'radon' ? {
                radonAngles: p.radonAngles,
                threshold: p.threshold
            } : {},
            physicalDimensions: {
                radiusPixels: round(result.radius, 2),
                pinCircleDiameterCm: stats.pinCircleDiameterCm,
                radiusCm: round(stats.physicalRadius, 2),
                diameterCm: stats.pinCircleDiameterCm,
                pinSpacingMm: round(stats.pinSpacingMm, 2),
                nailDiameterMm: stats.nailDiameterMm
            },
            materials: {
                stringLengthMeters: round(stats.stringLength, 2),
                stringLengthWithExtraMeters: round(stats.stringLengthWithExtra, 2),
                pinsRequired: p.numPins
            },
            timeEstimates: {
                workTimeMinutes: Math.round(stats.workTimeMinutes),
                totalTimeMinutes: Math.round(stats.totalMinutes),
                workTimeFormatted: stats.workTimeFormatted,
                totalTimeFormatted: stats.totalTimeFormatted,
                recommendedSessions: stats.recommendedSessions,
                sessionDurationMinutes: stats.sessionDuration,
                averageConnectionsPerMinute: round(stats.connectionsPerMinute, 2)
            },
            pins: result.pins.map(pin => ({
                index: pin.index,
                x: round(pin.x - center, 3),
                y: round(pin.y - center, 3),
                xMm: round((pin.x - center) * stats.mmPerPx, 2),
                yMm: round((pin.y - center) * stats.mmPerPx, 2),
                angle: round((pin.index / p.numPins) * 360, 4)
            })),
            sequence: result.sequence,
            statistics: {
                totalConnections: result.sequence.length,
                uniquePinsUsed: new Set(result.sequence.flatMap(s => [s.from, s.to])).size,
                matchPercent: matchPercent(result.rmse)
            }
        };
    }

    function matchPercent(rmse) {
        return round((1 - rmse) * 100, 1);
    }

    function escapeXml(text) {
        return String(text).replace(/[<>&"']/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[ch]));
    }

    // Printable, full-size pin template. Units are millimeters, so printing
    // at 100% scale gives the real size; the scale bar lets you check it.
    function buildPinTemplateSVG(numPins, pinCircleDiameterCm, nailDiameterMm, pinStart = 'right') {
        const diameter = pinCircleDiameterCm * 10;
        const radius = diameter / 2;
        const margin = 25;
        const size = diameter + margin * 2;
        const c = size / 2;
        const spacing = (Math.PI * diameter) / numPins;
        // Label every pin when there is room, otherwise every Nth
        const labelEvery = Math.max(1, Math.ceil(5 / spacing));
        const fontSize = Math.min(4, Math.max(1.5, spacing * 0.6 * labelEvery));
        const pinR = Math.max(0.4, nailDiameterMm / 2);
        const f = v => round(v, 3);

        const parts = [];
        parts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
        parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${f(size)}mm" height="${f(size)}mm" viewBox="0 0 ${f(size)} ${f(size)}" font-family="Arial, Helvetica, sans-serif">`);
        parts.push(`<title>${escapeXml(`${APP.name} pin template: ${numPins} pins on a ${pinCircleDiameterCm} cm circle`)}</title>`);
        parts.push(`<rect width="100%" height="100%" fill="#fff"/>`);
        parts.push(`<circle cx="${f(c)}" cy="${f(c)}" r="${f(radius)}" fill="none" stroke="#999" stroke-width="0.3"/>`);
        // Center mark
        parts.push(`<path d="M ${f(c - 8)} ${f(c)} H ${f(c + 8)} M ${f(c)} ${f(c - 8)} V ${f(c + 8)}" stroke="#000" stroke-width="0.3"/>`);
        parts.push(`<circle cx="${f(c)}" cy="${f(c)}" r="1" fill="none" stroke="#000" stroke-width="0.3"/>`);

        for (let i = 0; i < numPins; i++) {
            const a = pinAngle(i, numPins, pinStart);
            const x = c + Math.cos(a) * radius;
            const y = c + Math.sin(a) * radius;
            const isZero = i === 0;
            parts.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(isZero ? pinR * 1.8 : pinR)}" fill="${isZero ? '#d00' : '#000'}"/>`);
            if (i % labelEvery === 0) {
                const lx = c + Math.cos(a) * (radius + 3 + fontSize);
                const ly = c + Math.sin(a) * (radius + 3 + fontSize);
                parts.push(`<text x="${f(lx)}" y="${f(ly)}" font-size="${f(fontSize)}" text-anchor="middle" dominant-baseline="central"${isZero ? ' fill="#d00" font-weight="bold"' : ''}>${i}</text>`);
            }
        }

        // 100 mm scale bar and notes
        const barY = size - 8;
        parts.push(`<path d="M 10 ${f(barY)} H 110 M 10 ${f(barY - 2)} V ${f(barY + 2)} M 110 ${f(barY - 2)} V ${f(barY + 2)}" stroke="#000" stroke-width="0.4"/>`);
        parts.push(`<text x="60" y="${f(barY - 3)}" font-size="3" text-anchor="middle">100 mm (check your print scale)</text>`);
        parts.push(`<text x="10" y="8" font-size="3.5">${escapeXml(`${numPins} pins, ${pinCircleDiameterCm} cm circle, ${round(spacing, 2)} mm spacing. Pin 0 (red) at ${pinStartLabel(pinStart)}, numbered clockwise.`)}</text>`);
        parts.push(`<text x="10" y="13" font-size="2.5" fill="#666">${escapeXml(`Print at 100% scale. ${APP.name} - (c) ${APP.author}`)}</text>`);
        parts.push(`</svg>`);
        return parts.join('\n') + '\n';
    }

    // ------------------------------------------------------------------
    // Web Worker entry point
    // ------------------------------------------------------------------

    // Runs inside the worker; `core` is this module. Stringified and
    // started from a Blob URL by the page (see script.js).
    function workerMain(scope, core) {
        scope.onmessage = (event) => {
            const msg = event.data;
            if (!msg || msg.type !== 'start') return;
            try {
                let lastReport = 0;
                const result = core.generate(msg.darkness, msg.size, msg.params, (count, total) => {
                    const now = Date.now();
                    if (now - lastReport > 100) {
                        lastReport = now;
                        scope.postMessage({ type: 'progress', count, total });
                    }
                });
                scope.postMessage({ type: 'done', result });
            } catch (err) {
                scope.postMessage({ type: 'error', message: err && err.message ? err.message : String(err) });
            }
        };
    }

    return {
        APP,
        factory: StringArtCoreFactory,
        workerMain,
        pinAngle,
        generatePins,
        pinRadiusForSize,
        circularDistance,
        toDarkness,
        imagePlacement,
        rasterizeLine,
        maxLinePixels,
        radonTransform,
        radonBin,
        createRun,
        generate,
        matchError,
        matchPercent,
        analyzeImage,
        suggestParams,
        computeStats,
        formatTime,
        buildInstructions,
        buildRobotJSON,
        buildPinTemplateSVG
    };
});
