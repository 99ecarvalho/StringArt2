/**
 * String Art Generator - User interface
 *
 * Page logic: controls, image preparation, running the generator (in a Web
 * Worker when possible), animation, statistics and downloads. The
 * algorithms live in stringart-core.js.
 *
 * Copyright (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br>
 *
 * This file is part of String Art Generator. It is free software, licensed
 * under the GNU Lesser General Public License v3.0 or later. See
 * COPYING.LESSER and COPYING for details.
 *
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

/* global StringArtCore */

const core = StringArtCore;

// Every input the page reads. `kind` is how its value is parsed; the flags
// say what a change affects:
//   render:   only how the result is drawn (redraw, no regeneration)
//   prep:     image preparation (refresh the target preview)
//   physical: physical board size (refresh statistics)
const PARAM_DEFS = [
    { id: 'algorithm', key: 'algorithm', kind: 'select' },
    { id: 'radius', key: 'radius', kind: 'int', prep: true },
    { id: 'pins', key: 'numPins', kind: 'int' },
    { id: 'pinStart', key: 'pinStart', kind: 'select' },
    { id: 'iterations', key: 'iterations', kind: 'int' },
    { id: 'lineOpacity', key: 'lineOpacity', kind: 'float', render: true },
    { id: 'minDistance', key: 'minDistance', kind: 'int' },
    { id: 'threshold', key: 'threshold', kind: 'int' },
    { id: 'lineWeight', key: 'lineWeight', kind: 'float', render: true },
    { id: 'angles', key: 'radonAngles', kind: 'int' },
    { id: 'animationSpeed', key: 'animationSpeed', kind: 'int' },
    { id: 'fitMode', key: 'fitMode', kind: 'select', prep: true },
    { id: 'zoom', key: 'zoom', kind: 'float', prep: true },
    { id: 'offsetX', key: 'offsetX', kind: 'float', prep: true },
    { id: 'offsetY', key: 'offsetY', kind: 'float', prep: true },
    { id: 'contrast', key: 'contrast', kind: 'int', prep: true },
    { id: 'gamma', key: 'gamma', kind: 'float', prep: true },
    { id: 'pinCircleDiameter', key: 'pinCircleDiameterCm', kind: 'float', physical: true },
    { id: 'nailDiameter', key: 'nailDiameterMm', kind: 'float', physical: true }
];

const PREP_DEFAULTS = { fitMode: 'cover', zoom: 1, offsetX: 0, offsetY: 0, contrast: 0, gamma: 1 };

const SETTINGS_KEY = 'stringArtGenerator.settings.v1';

// Blank space around the pin circle on the result canvas, in pixels
const CANVAS_MARGIN = 50;

class StringArtGenerator {
    constructor() {
        this.image = null;
        this.imageName = 'string-art';
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.targetCanvas = document.getElementById('targetCanvas');
        this.targetCtx = this.targetCanvas.getContext('2d');

        // Last completed generation: { params, pins, radius, size, sequence, rmse, stopReason }
        this.result = null;

        // Animation state
        this.animationIndex = 0;
        this.isAnimating = false;
        this.animationFrameId = null;

        // Running generation, with a cancel() method
        this.job = null;

        this.suggestedParams = null;
        this.statusTimer = null;
        this.targetFrame = null;

        this.params = {};
        this.restoreSettings();
        this.readParams();

        this.initializeEventListeners();
        this.updateAlgorithmUI();
        this.clearCanvas();
    }

    // ------------------------------------------------------------------
    // Parameters and settings
    // ------------------------------------------------------------------

    initializeEventListeners() {
        document.getElementById('imageInput').addEventListener('change', (e) => this.handleImageUpload(e));

        PARAM_DEFS.forEach(def => {
            const el = document.getElementById(def.id);
            const eventName = def.kind === 'select' ? 'change' : 'input';
            el.addEventListener(eventName, () => this.onParamInput(def));
            // Clamp typed numbers once editing is finished
            if (el.type === 'number') {
                el.addEventListener('change', () => {
                    this.readParams();
                    this.saveSettings();
                });
            }
        });

        document.getElementById('autoOptimizeCheck').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.analyzeImageAndSuggest();
            } else {
                document.getElementById('optimizationResults').style.display = 'none';
            }
        });
        document.getElementById('applyOptimization').addEventListener('click', () => this.applyOptimizedParams());
        document.getElementById('dismissOptimization').addEventListener('click', () => {
            document.getElementById('optimizationResults').style.display = 'none';
            document.getElementById('autoOptimizeCheck').checked = false;
        });
        document.getElementById('resetPrepBtn').addEventListener('click', () => this.resetImagePreparation());

        document.getElementById('generateBtn').addEventListener('click', () => this.generate());
        document.getElementById('cancelBtn').addEventListener('click', () => this.cancelGeneration());
        document.getElementById('playBtn').addEventListener('click', () => this.playAnimation());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pauseAnimation());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetAnimation());
        document.getElementById('skipBtn').addEventListener('click', () => this.skipToEnd());

        document.getElementById('exportInstructions').addEventListener('click', () => this.exportInstructions());
        document.getElementById('exportJSON').addEventListener('click', () => this.exportJSON());
        document.getElementById('exportImage').addEventListener('click', () => this.exportImage());
        document.getElementById('exportTemplate').addEventListener('click', () => this.exportTemplate());
    }

    onParamInput(def) {
        const el = document.getElementById(def.id);
        if (def.kind === 'select') {
            this.params[def.key] = el.value;
        } else {
            const value = parseFloat(el.value);
            if (!Number.isFinite(value)) return; // Field is empty or mid-edit
            this.params[def.key] = value;
            this.setValueLabel(def.id, value);
        }

        if (def.id === 'algorithm') this.updateAlgorithmUI();
        if (def.render && !this.isAnimating) this.drawFrame();
        if (def.prep) this.scheduleTargetUpdate();
        if (def.physical && this.result) this.updateStatsDisplay();
        this.saveSettings();
    }

    setValueLabel(id, value) {
        const label = document.getElementById(id + 'Value');
        if (label) label.textContent = value;
    }

    // Read every input, clamping numbers to their min/max, so values typed
    // out of range (or left half-typed) never reach the algorithms.
    readParams() {
        PARAM_DEFS.forEach(def => {
            const el = document.getElementById(def.id);
            if (def.kind === 'select') {
                this.params[def.key] = el.value;
                return;
            }
            let value = parseFloat(el.value);
            if (!Number.isFinite(value)) value = Number.isFinite(this.params[def.key]) ? this.params[def.key] : parseFloat(el.defaultValue);
            const min = parseFloat(el.min);
            const max = parseFloat(el.max);
            if (Number.isFinite(min)) value = Math.max(min, value);
            if (Number.isFinite(max)) value = Math.min(max, value);
            if (def.kind === 'int') value = Math.round(value);
            this.params[def.key] = value;
            el.value = value;
            this.setValueLabel(def.id, value);
        });
    }

    // Settings are a convenience: storage can be unavailable (private
    // windows, blocked site data), so every access is guarded.
    saveSettings() {
        try {
            const values = {};
            PARAM_DEFS.forEach(def => { values[def.id] = document.getElementById(def.id).value; });
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(values));
        } catch (e) {
            // Ignore: settings just won't be remembered
        }
    }

    restoreSettings() {
        let values = null;
        try {
            values = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
        } catch (e) {
            values = null;
        }
        if (!values || typeof values !== 'object') return;
        PARAM_DEFS.forEach(def => {
            const el = document.getElementById(def.id);
            const value = values[def.id];
            if (typeof value !== 'string') return;
            if (def.kind === 'select') {
                if ([...el.options].some(o => o.value === value)) el.value = value;
            } else if (Number.isFinite(parseFloat(value))) {
                el.value = value;
            }
        });
    }

    resetImagePreparation() {
        Object.entries(PREP_DEFAULTS).forEach(([key, value]) => {
            const def = PARAM_DEFS.find(d => d.key === key);
            document.getElementById(def.id).value = value;
        });
        this.readParams();
        this.saveSettings();
        this.scheduleTargetUpdate();
    }

    updateAlgorithmUI() {
        const isRadon = this.params.algorithm === 'radon';
        document.querySelectorAll('.radon-only').forEach(el => {
            el.style.display = isRadon ? 'block' : 'none';
        });
        document.querySelectorAll('.greedy-only').forEach(el => {
            el.style.display = isRadon ? 'none' : 'block';
        });

        if (isRadon) {
            document.getElementById('optimizationResults').style.display = 'none';
            document.getElementById('autoOptimizeCheck').checked = false;
        }

        const infoText = document.querySelector('#algorithmInfo .info-text');
        if (isRadon) {
            infoText.innerHTML = '<strong>Radon Transform:</strong> Uses mathematical projections (like CT scans) to identify important lines. Combines Radon analysis with pixel data for better results. Works with all parameters!';
        } else {
            infoText.innerHTML = '<strong>Greedy:</strong> Iteratively selects lines that best match dark areas. Excellent for portraits and photos.';
        }
    }

    // ------------------------------------------------------------------
    // Image loading and preparation
    // ------------------------------------------------------------------

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.image = img;
                this.imageName = this.fileBaseName(file.name);
                this.showImagePreview(img);
                this.scheduleTargetUpdate();
                this.showStatus('Image loaded! Adjust the preparation if needed, then click "Generate String Art".', 'success');
                if (document.getElementById('autoOptimizeCheck').checked) {
                    this.analyzeImageAndSuggest();
                }
            };
            img.onerror = () => {
                this.showStatus('Could not read this file as an image. Please choose a PNG, JPEG, GIF or WebP file.', 'error');
            };
            img.src = e.target.result;
        };
        reader.onerror = () => {
            this.showStatus('Could not read the selected file.', 'error');
        };
        reader.readAsDataURL(file);
    }

    // File name without extension, reduced to characters safe in any file system
    fileBaseName(name) {
        const base = name.replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
        return base.slice(0, 60) || 'string-art';
    }

    showImagePreview(img) {
        const preview = document.getElementById('imagePreview');
        preview.innerHTML = '';
        const previewImg = document.createElement('img');
        previewImg.src = img.src;
        previewImg.alt = 'Uploaded image preview';
        previewImg.style.maxWidth = '100%';
        previewImg.style.borderRadius = '8px';
        preview.appendChild(previewImg);
    }

    // Scale, crop and adjust the image into a size x size square and return
    // its darkness values (see StringArtCore.toDarkness).
    prepareImage(size) {
        const temp = document.createElement('canvas');
        temp.width = size;
        temp.height = size;
        const ctx = temp.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, size, size);

        const place = core.imagePlacement(this.image.width, this.image.height, size, this.params);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(this.image, place.x, place.y, place.width, place.height);

        const rgba = ctx.getImageData(0, 0, size, size).data;
        return core.toDarkness(rgba, size, { contrast: this.params.contrast, gamma: this.params.gamma });
    }

    scheduleTargetUpdate() {
        if (!this.image || this.targetFrame) return;
        this.targetFrame = requestAnimationFrame(() => {
            this.targetFrame = null;
            this.updateTarget();
        });
    }

    // Show the prepared image, masked to the pin circle
    updateTarget() {
        if (!this.image) return;
        const size = this.params.radius * 2;
        const darkness = this.prepareImage(size);
        this.targetCanvas.width = size;
        this.targetCanvas.height = size;
        const img = this.targetCtx.createImageData(size, size);
        const c = size / 2;
        const r2 = core.pinRadiusForSize(size) ** 2;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const p = y * size + x;
                const inside = (x + 0.5 - c) ** 2 + (y + 0.5 - c) ** 2 <= r2;
                const v = inside ? Math.round((1 - darkness[p]) * 255) : 240;
                img.data[p * 4] = v;
                img.data[p * 4 + 1] = v;
                img.data[p * 4 + 2] = v;
                img.data[p * 4 + 3] = 255;
            }
        }
        this.targetCtx.putImageData(img, 0, 0);
        document.querySelector('.target-container').classList.add('visible');
    }

    // ------------------------------------------------------------------
    // Auto-optimize
    // ------------------------------------------------------------------

    analyzeImageAndSuggest() {
        if (!this.image) {
            this.showStatus('Please upload an image first to analyze it', 'error');
            document.getElementById('autoOptimizeCheck').checked = false;
            return;
        }

        this.readParams();
        const size = this.params.radius * 2;
        const analysis = core.analyzeImage(this.prepareImage(size), size);
        this.suggestedParams = core.suggestParams(analysis);
        this.displayOptimizationSuggestions(analysis, this.suggestedParams);
    }

    displayOptimizationSuggestions(analysis, params) {
        const typeLabel = {
            'photo': '📷 Photo / portrait',
            'high-detail': '🌿 High detail / texture',
            'low-contrast': '🌫️ Low contrast',
            'dark': '🌑 Dark',
            'light': '☀️ Light',
            'general': '🖼️ General'
        };

        let html = '';
        html += `<li><strong>Type:</strong> ${typeLabel[analysis.imageType]}</li>`;
        html += `<li><strong>Contrast:</strong> ${(analysis.contrast * 100).toFixed(0)}% ${analysis.contrast > 0.5 ? '(High)' : analysis.contrast > 0.3 ? '(Medium)' : '(Low)'}</li>`;
        html += `<li><strong>Detail Level:</strong> ${(analysis.edgeRatio * 100).toFixed(0)}% edges</li>`;
        html += `<li><strong>Darkness:</strong> ${(analysis.darkRatio * 100).toFixed(0)}% dark pixels</li>`;
        html += '<li style="margin-top: 10px;"><strong>🎯 Suggested Settings:</strong></li>';
        html += `<li style="padding-left: 15px;">Pins: ${params.numPins}</li>`;
        html += `<li style="padding-left: 15px;">Iterations: ${params.iterations}</li>`;
        html += `<li style="padding-left: 15px;">Line Opacity: ${params.lineOpacity}%</li>`;
        html += `<li style="padding-left: 15px;">Min Distance: ${params.minDistance}</li>`;
        html += `<li style="padding-left: 15px;">Line Weight: ${params.lineWeight}px</li>`;
        document.getElementById('analysisInfo').innerHTML = html;

        document.getElementById('optimizationResults').style.display = 'block';
    }

    applyOptimizedParams() {
        if (!this.suggestedParams) return;

        const fields = { pins: 'numPins', iterations: 'iterations', lineOpacity: 'lineOpacity', minDistance: 'minDistance', lineWeight: 'lineWeight' };
        Object.entries(fields).forEach(([inputId, key]) => {
            document.getElementById(inputId).value = this.suggestedParams[key];
        });
        this.readParams();
        this.saveSettings();

        this.showStatus('Optimized parameters applied! Click "Generate String Art" to see results.', 'success');
        document.getElementById('optimizationResults').style.display = 'none';
        document.getElementById('autoOptimizeCheck').checked = false;
    }

    // ------------------------------------------------------------------
    // Generation
    // ------------------------------------------------------------------

    async generate() {
        if (!this.image) {
            this.showStatus('Please upload an image first!', 'error');
            return;
        }
        if (this.job) return;

        this.readParams();
        const params = { ...this.params };
        const size = params.radius * 2;
        const darkness = this.prepareImage(size);

        this.setGenerating(true);
        this.showStatus('Generating string art...', 'info', 0);

        let result;
        try {
            result = await this.runGeneration(darkness, size, params);
        } catch (err) {
            this.setGenerating(false);
            if (err && err.cancelled) {
                this.showStatus('Generation cancelled.', 'info');
            } else {
                console.error(err);
                this.showStatus(`Generation failed: ${err && err.message ? err.message : err}`, 'error');
            }
            return;
        }
        this.setGenerating(false);

        if (result.sequence.length === 0) {
            this.showStatus('No lines were generated. Try a lower Min Pin Distance or Darkness Threshold.', 'error');
            return;
        }

        // The previous result stays usable until this point
        this.pauseAnimation();
        this.result = { ...result, params, size };
        this.setupCanvas();

        document.getElementById('animationSection').style.display = 'block';
        document.getElementById('exportSection').style.display = 'block';
        document.getElementById('statsSection').style.display = 'block';
        this.updateStatsDisplay();

        this.resetAnimation();
        this.playAnimation();

        let early = '';
        if (result.stopReason === 'converged') {
            early = params.algorithm === 'radon'
                ? ` Stopped at ${result.sequence.length} lines: no line scored above the darkness threshold.`
                : ` Stopped at ${result.sequence.length} lines: more string would not improve the match.`;
        }
        this.showStatus(`Generation complete!${early} Animation playing...`, 'success');
    }

    setGenerating(active) {
        document.getElementById('generateBtn').disabled = active;
        document.getElementById('cancelBtn').style.display = active ? '' : 'none';
        const progress = document.getElementById('generationProgress');
        progress.style.display = active ? 'block' : 'none';
        progress.value = 0;
    }

    cancelGeneration() {
        if (this.job) this.job.cancel();
    }

    onGenerationProgress(count, total) {
        const progress = document.getElementById('generationProgress');
        progress.value = total > 0 ? (count / total) * 100 : 0;
        this.showStatus(`Generating string art... ${count} / ${total} lines`, 'info', 0);
    }

    // Run the generator in a Web Worker, so the page stays responsive, and
    // fall back to running it here if workers are unavailable.
    runGeneration(darkness, size, params) {
        return new Promise((resolve, reject) => {
            const finish = (fn, value) => {
                this.job = null;
                fn(value);
            };
            const cancelled = Object.assign(new Error('cancelled'), { cancelled: true });

            let worker = null;
            try {
                worker = new Worker(StringArtGenerator.workerURL());
            } catch (e) {
                worker = null;
            }

            if (!worker) {
                this.runOnMainThread(darkness, size, params, resolve, reject, finish, cancelled);
                return;
            }

            let started = false;
            worker.onmessage = (event) => {
                const msg = event.data;
                started = true;
                if (msg.type === 'progress') {
                    this.onGenerationProgress(msg.count, msg.total);
                } else if (msg.type === 'done') {
                    worker.terminate();
                    finish(resolve, msg.result);
                } else if (msg.type === 'error') {
                    worker.terminate();
                    finish(reject, new Error(msg.message));
                }
            };
            worker.onerror = (event) => {
                event.preventDefault();
                worker.terminate();
                if (!started) {
                    // The worker could not even start (e.g. blocked by the page's security policy)
                    this.runOnMainThread(darkness, size, params, resolve, reject, finish, cancelled);
                } else {
                    finish(reject, new Error(event.message || 'Worker error'));
                }
            };
            this.job = {
                cancel: () => {
                    worker.terminate();
                    finish(reject, cancelled);
                }
            };
            worker.postMessage({ type: 'start', darkness, size, params });
        });
    }

    runOnMainThread(darkness, size, params, resolve, reject, finish, cancelled) {
        let stop = false;
        this.job = { cancel: () => { stop = true; } };
        let run;
        try {
            run = core.createRun(darkness, size, params);
        } catch (err) {
            finish(reject, err);
            return;
        }
        const tick = () => {
            if (stop) {
                finish(reject, cancelled);
                return;
            }
            let status;
            try {
                status = run.step(20);
            } catch (err) {
                finish(reject, err);
                return;
            }
            this.onGenerationProgress(status.count, params.iterations);
            if (status.done) {
                finish(resolve, {
                    pins: run.pins,
                    radius: run.radius,
                    sequence: run.sequence(),
                    rmse: run.rmse(),
                    stopReason: status.stopReason
                });
            } else {
                setTimeout(tick, 0);
            }
        };
        setTimeout(tick, 0);
    }

    // Blob URL for the worker: the core module plus its worker entry point.
    // Built from the loaded code, so it also works from file:// and in the
    // single-file build, where a separate worker file couldn't be loaded.
    static workerURL() {
        if (!StringArtGenerator.cachedWorkerURL) {
            const source =
                `const core = (${core.factory.toString()})();\n` +
                `(${core.workerMain.toString()})(self, core);\n`;
            StringArtGenerator.cachedWorkerURL = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
        }
        return StringArtGenerator.cachedWorkerURL;
    }

    // ------------------------------------------------------------------
    // Drawing and animation
    // ------------------------------------------------------------------

    setupCanvas() {
        const size = (this.result ? this.result.size : this.params.radius * 2) + CANVAS_MARGIN * 2;
        this.canvas.width = size;
        this.canvas.height = size;
    }

    clearCanvas() {
        this.setupCanvas();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Redraw the background, the pins and the first animationIndex lines
    drawFrame() {
        if (!this.result) return;
        const ctx = this.ctx;
        const c = this.result.size / 2 + CANVAS_MARGIN;

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c, c, this.result.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#666';
        this.result.pins.forEach(pin => {
            ctx.beginPath();
            ctx.arc(pin.x + CANVAS_MARGIN, pin.y + CANVAS_MARGIN, 2, 0, Math.PI * 2);
            ctx.fill();
        });

        this.drawLines(0, this.animationIndex);
    }

    // Draw lines [from, to) on top of what is already on the canvas. Opacity
    // and weight follow the live controls, so the rendering can be tweaked
    // without regenerating (the closest match is with the values used to
    // generate).
    drawLines(from, to) {
        const ctx = this.ctx;
        const { pins, sequence } = this.result;
        ctx.strokeStyle = `rgba(0, 0, 0, ${this.params.lineOpacity / 100})`;
        ctx.lineWidth = this.params.lineWeight;
        for (let i = from; i < to; i++) {
            const a = pins[sequence[i].from];
            const b = pins[sequence[i].to];
            ctx.beginPath();
            ctx.moveTo(a.x + CANVAS_MARGIN, a.y + CANVAS_MARGIN);
            ctx.lineTo(b.x + CANVAS_MARGIN, b.y + CANVAS_MARGIN);
            ctx.stroke();
        }
    }

    playAnimation() {
        if (this.isAnimating || !this.result) return;
        if (this.animationIndex >= this.result.sequence.length) {
            this.animationIndex = 0; // Replay from the start when finished
        }
        if (this.animationIndex === 0) this.drawFrame();
        this.isAnimating = true;
        this.animate();
    }

    pauseAnimation() {
        this.isAnimating = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    resetAnimation() {
        if (!this.result) return;
        this.pauseAnimation();
        this.animationIndex = 0;
        this.drawFrame();
        this.updateProgress();
    }

    skipToEnd() {
        if (!this.result) return;
        this.pauseAnimation();
        this.animationIndex = this.result.sequence.length;
        this.drawFrame();
        this.updateProgress();
    }

    // Each frame draws only the new lines on top of the previous frame
    animate() {
        if (!this.isAnimating) return;

        const total = this.result.sequence.length;
        const end = Math.min(this.animationIndex + this.params.animationSpeed, total);
        this.drawLines(this.animationIndex, end);
        this.animationIndex = end;
        this.updateProgress();

        if (this.animationIndex < total) {
            this.animationFrameId = requestAnimationFrame(() => this.animate());
        } else {
            this.isAnimating = false;
            this.animationFrameId = null;
        }
    }

    updateProgress() {
        const total = this.result ? this.result.sequence.length : 0;
        document.getElementById('progressText').textContent = `${this.animationIndex} / ${total}`;
        const percent = total > 0 ? (this.animationIndex / total) * 100 : 0;
        document.getElementById('progressFill').style.width = percent + '%';
    }

    // ------------------------------------------------------------------
    // Statistics and exports
    // ------------------------------------------------------------------

    physicalParams() {
        return {
            pinCircleDiameterCm: this.params.pinCircleDiameterCm,
            nailDiameterMm: this.params.nailDiameterMm
        };
    }

    calculateProjectStats() {
        return core.computeStats(this.result.sequence, this.result.pins, this.result.radius, this.physicalParams());
    }

    updateStatsDisplay() {
        const stats = this.calculateProjectStats();
        document.getElementById('matchScore').textContent = `${core.matchPercent(this.result.rmse)}%`;
        document.getElementById('stringLength').textContent = `${stats.stringLength.toFixed(2)} meters`;
        document.getElementById('stringLengthExtra').textContent = `${stats.stringLengthWithExtra.toFixed(2)} meters`;
        document.getElementById('workTime').textContent = stats.workTimeFormatted;
        document.getElementById('totalTime').textContent = stats.totalTimeFormatted;
        document.getElementById('sessions').textContent = `${stats.recommendedSessions} × ${stats.sessionDuration} min`;
        document.getElementById('physicalSize').textContent = `${stats.pinCircleDiameterCm.toFixed(1)} cm diameter`;
        document.getElementById('pinSpacing').textContent = `${stats.pinSpacingMm.toFixed(1)} mm`;
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Revoking immediately can cancel the download in some browsers
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    exportInstructions() {
        if (!this.result) return;
        const text = core.buildInstructions(this.result, this.calculateProjectStats());
        this.downloadBlob(new Blob([text], { type: 'text/plain' }), `${this.imageName}-instructions.txt`);
        this.showStatus('Instructions downloaded!', 'success');
    }

    exportJSON() {
        if (!this.result) return;
        const data = core.buildRobotJSON(this.result, this.calculateProjectStats());
        this.downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${this.imageName}-robot.json`);
        this.showStatus('JSON downloaded!', 'success');
    }

    exportImage() {
        if (!this.result) return;
        this.skipToEnd();
        this.canvas.toBlob(blob => {
            if (!blob) {
                this.showStatus('Could not export the image.', 'error');
                return;
            }
            this.downloadBlob(blob, `${this.imageName}-string-art.png`);
            this.showStatus('Image saved!', 'success');
        }, 'image/png');
    }

    exportTemplate() {
        if (!this.result) return;
        const p = this.result.params;
        const svg = core.buildPinTemplateSVG(p.numPins, this.params.pinCircleDiameterCm, this.params.nailDiameterMm, p.pinStart);
        this.downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${this.imageName}-pin-template.svg`);
        this.showStatus('Pin template downloaded! Print it at 100% scale.', 'success');
    }

    // Show a status message. It hides itself after `timeout` ms; 0 keeps it
    // visible until the next message.
    showStatus(message, type = 'info', timeout = 5000) {
        const statusEl = document.getElementById('statusMessage');
        statusEl.textContent = message;
        statusEl.className = `status ${type}`;
        statusEl.style.display = 'block';

        clearTimeout(this.statusTimer);
        this.statusTimer = timeout > 0
            ? setTimeout(() => { statusEl.style.display = 'none'; }, timeout)
            : null;
    }
}

// Initialize the generator when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.stringArtApp = new StringArtGenerator();
});
