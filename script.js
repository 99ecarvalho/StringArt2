/**
 * String Art Generator - Main Script
 *
 * Copyright (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br>
 *
 * This file is part of String Art Generator. It is free software, licensed
 * under the GNU Lesser General Public License v3.0 or later. See
 * COPYING.LESSER and COPYING for details.
 *
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */

const APP_NAME = 'String Art Generator';
const APP_AUTHOR = 'Eduardo Correia <ecorreia@apliant.com.br>';
const APP_LICENSE = 'LGPL-3.0-or-later';

class StringArtGenerator {
    constructor() {
        this.image = null;
        this.imageData = null;
        this.grayscaleData = null;
        this.pins = [];
        this.sequence = [];
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Animation state
        this.animationIndex = 0;
        this.isAnimating = false;
        this.animationFrameId = null;

        // Optimization state
        this.imageAnalysis = null;
        this.suggestedParams = null;

        // Status message timer
        this.statusTimer = null;

        // Parameters
        this.params = {
            algorithm: 'greedy',
            radius: 300,
            numPins: 200,
            iterations: 3000,
            lineOpacity: 20,
            minDistance: 20,
            threshold: 128,
            lineWeight: 1,
            animationSpeed: 10,
            // Radon-specific parameters
            radonAngles: 180
        };

        // Snapshot of the parameters used for the last generation. Geometry,
        // statistics and exports use it, so editing the inputs afterwards
        // cannot desynchronize the pins from the sequence.
        this.gen = { ...this.params };

        this.initializeEventListeners();
        this.setupCanvas();
    }

    initializeEventListeners() {
        // Image upload
        document.getElementById('imageInput').addEventListener('change', (e) => this.handleImageUpload(e));

        // Algorithm selection
        document.getElementById('algorithm').addEventListener('change', (e) => {
            this.params.algorithm = e.target.value;
            this.updateAlgorithmUI();
        });

        // Auto-optimize checkbox
        document.getElementById('autoOptimizeCheck').addEventListener('change', (e) => {
            if (e.target.checked) {
                this.analyzeImageAndSuggest();
            } else {
                document.getElementById('optimizationResults').style.display = 'none';
            }
        });

        // Optimization buttons
        document.getElementById('applyOptimization').addEventListener('click', () => this.applyOptimizedParams());
        document.getElementById('dismissOptimization').addEventListener('click', () => {
            document.getElementById('optimizationResults').style.display = 'none';
            document.getElementById('autoOptimizeCheck').checked = false;
        });

        // Parameter updates
        const params = ['radius', 'pins', 'iterations', 'lineOpacity', 'minDistance', 'threshold', 'lineWeight', 'animationSpeed', 'angles'];
        params.forEach(param => {
            const element = document.getElementById(param);
            if (!element) return;

            element.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                if (!Number.isFinite(value)) return; // Field is empty or mid-edit
                this.params[this.paramKey(param)] = value;
                document.getElementById(param + 'Value').textContent = value;
            });
        });

        // Control buttons
        document.getElementById('generateBtn').addEventListener('click', () => this.generate());
        document.getElementById('playBtn').addEventListener('click', () => this.playAnimation());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pauseAnimation());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetAnimation());
        document.getElementById('skipBtn').addEventListener('click', () => this.skipToEnd());

        // Export buttons
        document.getElementById('exportInstructions').addEventListener('click', () => this.exportInstructions());
        document.getElementById('exportJSON').addEventListener('click', () => this.exportJSON());
        document.getElementById('exportImage').addEventListener('click', () => this.exportImage());
    }

    // Map an input element id to its key in this.params
    paramKey(inputId) {
        if (inputId === 'pins') return 'numPins';
        if (inputId === 'angles') return 'radonAngles';
        return inputId;
    }

    // Clamp every numeric parameter to its input's min/max, so values typed
    // out of range (or left half-typed) never reach the algorithms.
    readParams() {
        const inputs = ['radius', 'pins', 'iterations', 'lineOpacity', 'minDistance', 'threshold', 'lineWeight', 'animationSpeed', 'angles'];
        inputs.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const key = this.paramKey(id);
            let value = parseFloat(el.value);
            if (!Number.isFinite(value)) value = this.params[key];
            const min = parseFloat(el.min);
            const max = parseFloat(el.max);
            if (Number.isFinite(min)) value = Math.max(min, value);
            if (Number.isFinite(max)) value = Math.min(max, value);
            if (el.type === 'number') value = Math.round(value);
            this.params[key] = value;
            el.value = value;
            document.getElementById(id + 'Value').textContent = value;
        });
    }

    updateAlgorithmUI() {
        const isRadon = this.params.algorithm === 'radon';
        const radonElements = document.querySelectorAll('.radon-only');
        const greedyElements = document.querySelectorAll('.greedy-only');

        radonElements.forEach(el => {
            el.style.display = isRadon ? 'block' : 'none';
        });

        greedyElements.forEach(el => {
            el.style.display = isRadon ? 'none' : 'block';
        });

        if (isRadon) {
            document.getElementById('optimizationResults').style.display = 'none';
            document.getElementById('autoOptimizeCheck').checked = false;
        }

        // Update algorithm info
        const infoText = document.querySelector('#algorithmInfo .info-text');
        if (isRadon) {
            infoText.innerHTML = '<strong>Radon Transform:</strong> Uses mathematical projections (like CT scans) to identify important lines. Combines Radon analysis with pixel data for better results. Works with all parameters!';
        } else {
            infoText.innerHTML = '<strong>Greedy:</strong> Iteratively selects lines that best match dark areas. Excellent for portraits and photos.';
        }
    }

    setupCanvas() {
        const size = this.gen.radius * 2 + 100;
        this.canvas.width = size;
        this.canvas.height = size;
        this.centerX = size / 2;
        this.centerY = size / 2;
    }


    analyzeImageAndSuggest() {
        if (!this.image) {
            this.showStatus('Please upload an image first to analyze it', 'error');
            document.getElementById('autoOptimizeCheck').checked = false;
            return;
        }

        this.readParams();
        const size = this.params.radius * 2;
        const data = this.processImage(size);
        const analysis = this.analyzeImage(data, size);
        this.imageAnalysis = analysis;

        // Calculate optimal parameters based on analysis
        this.suggestedParams = this.calculateOptimalParams(analysis);

        // Display results
        this.displayOptimizationSuggestions(analysis, this.suggestedParams);
    }

    analyzeImage(data, size) {
        let darkPixels = 0;
        let totalIntensity = 0;
        let maxIntensity = 0;
        let minIntensity = 255;

        // Calculate statistics
        for (let i = 0; i < data.length; i++) {
            const val = data[i];
            totalIntensity += val;

            if (val > maxIntensity) maxIntensity = val;
            if (val < minIntensity) minIntensity = val;
            if (val > 128) darkPixels++;
        }

        const avgIntensity = totalIntensity / data.length;
        const darkRatio = darkPixels / data.length;

        // Calculate contrast (standard deviation)
        let variance = 0;
        for (let i = 0; i < data.length; i++) {
            variance += Math.pow(data[i] - avgIntensity, 2);
        }
        const stdDev = Math.sqrt(variance / data.length);
        const contrast = stdDev / 128; // Normalized 0-1

        // Detect edges (simple Sobel-like)
        let edgePixels = 0;
        for (let y = 1; y < size - 1; y++) {
            for (let x = 1; x < size - 1; x++) {
                const idx = y * size + x;
                const gx = Math.abs(data[idx + 1] - data[idx - 1]);
                const gy = Math.abs(data[idx + size] - data[idx - size]);
                const gradient = Math.sqrt(gx * gx + gy * gy);

                if (gradient > 30) edgePixels++;
            }
        }
        const edgeRatio = edgePixels / data.length;

        // Detect if it's likely a portrait (face detection heuristic)
        // High detail in center, some symmetry
        const centerDetail = this.calculateCenterDetail(data, size);
        const isLikelyPortrait = centerDetail > 0.6 && edgeRatio > 0.15 && contrast > 0.3;

        // Classify image type
        let imageType = 'general';
        if (isLikelyPortrait) {
            imageType = 'portrait';
        } else if (edgeRatio > 0.25) {
            imageType = 'geometric';
        } else if (contrast < 0.25) {
            imageType = 'low-contrast';
        } else if (darkRatio > 0.6) {
            imageType = 'dark';
        } else if (darkRatio < 0.3) {
            imageType = 'light';
        }

        return {
            avgIntensity,
            darkRatio,
            contrast,
            edgeRatio,
            centerDetail,
            imageType,
            stdDev,
            minIntensity,
            maxIntensity
        };
    }

    calculateCenterDetail(data, size) {
        const centerSize = Math.floor(size / 3);
        const centerStart = Math.floor(size / 2 - centerSize / 2);

        let centerVariance = 0;
        let count = 0;

        for (let y = centerStart; y < centerStart + centerSize; y++) {
            for (let x = centerStart; x < centerStart + centerSize; x++) {
                if (x > 0 && x < size - 1 && y > 0 && y < size - 1) {
                    const idx = y * size + x;
                    const diff = Math.abs(data[idx] - data[idx + 1]) +
                                Math.abs(data[idx] - data[idx + size]);
                    centerVariance += diff;
                    count++;
                }
            }
        }

        return count > 0 ? (centerVariance / count) / 255 : 0; // Normalized
    }

    calculateOptimalParams(analysis) {
        const params = {};

        // Number of pins based on image detail
        if (analysis.edgeRatio > 0.25 || analysis.imageType === 'portrait') {
            params.numPins = 250; // High detail
        } else if (analysis.edgeRatio > 0.15) {
            params.numPins = 200; // Medium detail
        } else {
            params.numPins = 150; // Low detail
        }

        // Iterations based on darkness and contrast
        if (analysis.imageType === 'portrait') {
            params.iterations = 3500;
        } else if (analysis.darkRatio > 0.5) {
            params.iterations = 4000; // Dark images need more lines
        } else if (analysis.contrast > 0.5) {
            params.iterations = 3000; // High contrast
        } else {
            params.iterations = 2500; // Low contrast
        }

        // Line opacity based on average intensity
        if (analysis.darkRatio > 0.6) {
            params.lineOpacity = 15; // Light lines for dark images
        } else if (analysis.darkRatio < 0.3) {
            params.lineOpacity = 25; // Darker lines for light images
        } else {
            params.lineOpacity = 20; // Balanced
        }

        // Min distance based on detail level
        if (analysis.edgeRatio > 0.25) {
            params.minDistance = 15; // Allow closer connections for detail
        } else {
            params.minDistance = 20; // Standard
        }

        // Line weight based on pin count
        if (params.numPins > 200) {
            params.lineWeight = 0.8; // Thinner for many pins
        } else {
            params.lineWeight = 1; // Standard
        }

        return params;
    }

    displayOptimizationSuggestions(analysis, params) {
        const resultsDiv = document.getElementById('optimizationResults');
        const infoList = document.getElementById('analysisInfo');

        // Image type
        const typeEmoji = {
            'portrait': '👤',
            'geometric': '📐',
            'low-contrast': '🌫️',
            'dark': '🌑',
            'light': '☀️',
            'general': '🖼️'
        };

        let html = '';
        html += `<li><strong>Type:</strong> ${typeEmoji[analysis.imageType]} ${analysis.imageType.charAt(0).toUpperCase() + analysis.imageType.slice(1)}</li>`;
        html += `<li><strong>Contrast:</strong> ${(analysis.contrast * 100).toFixed(0)}% ${analysis.contrast > 0.5 ? '(High)' : analysis.contrast > 0.3 ? '(Medium)' : '(Low)'}</li>`;
        html += `<li><strong>Detail Level:</strong> ${(analysis.edgeRatio * 100).toFixed(0)}% edges</li>`;
        html += `<li><strong>Darkness:</strong> ${(analysis.darkRatio * 100).toFixed(0)}% dark pixels</li>`;

        html += '<li style="margin-top: 10px;"><strong>🎯 Suggested Settings:</strong></li>';
        html += `<li style="padding-left: 15px;">Pins: ${params.numPins}</li>`;
        html += `<li style="padding-left: 15px;">Iterations: ${params.iterations}</li>`;
        html += `<li style="padding-left: 15px;">Line Opacity: ${params.lineOpacity}%</li>`;
        html += `<li style="padding-left: 15px;">Min Distance: ${params.minDistance}</li>`;
        html += `<li style="padding-left: 15px;">Line Weight: ${params.lineWeight}px</li>`;
        infoList.innerHTML = html;

        resultsDiv.style.display = 'block';
    }

    applyOptimizedParams() {
        if (!this.suggestedParams) return;

        const fields = {
            pins: 'numPins',
            iterations: 'iterations',
            lineOpacity: 'lineOpacity',
            minDistance: 'minDistance',
            lineWeight: 'lineWeight'
        };

        // Apply parameters and update UI inputs
        Object.entries(fields).forEach(([inputId, key]) => {
            const value = this.suggestedParams[key];
            this.params[key] = value;
            document.getElementById(inputId).value = value;
            document.getElementById(inputId + 'Value').textContent = value;
        });

        this.showStatus('Optimized parameters applied! Click "Generate String Art" to see results.', 'success');
        document.getElementById('optimizationResults').style.display = 'none';
        document.getElementById('autoOptimizeCheck').checked = false;
    }

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.image = img;
                this.showImagePreview(img);
                this.showStatus('Image loaded! Click "Generate String Art" to start.', 'success');
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

    async generate() {
        if (!this.image) {
            this.showStatus('Please upload an image first!', 'error');
            return;
        }

        const generateBtn = document.getElementById('generateBtn');
        this.showStatus('Generating string art...', 'info', 0);
        generateBtn.disabled = true;
        this.pauseAnimation();

        try {
            // Freeze the parameters for this run
            this.readParams();
            this.gen = { ...this.params };

            // Update canvas size
            this.setupCanvas();

            // Generate pins
            this.generatePins();

            // Process image
            const size = this.gen.radius * 2;
            this.grayscaleData = this.processImage(size);

            // Calculate string sequence based on selected algorithm
            if (this.gen.algorithm === 'radon') {
                await this.calculateSequenceRadon();
            } else {
                await this.calculateSequenceGreedy();
            }

            if (this.sequence.length === 0) {
                this.showStatus('No lines were generated. Try a lower Min Pin Distance or Darkness Threshold.', 'error');
                this.drawFrame();
                this.updateProgress();
                return;
            }

            // Show animation controls
            document.getElementById('animationSection').style.display = 'block';
            document.getElementById('exportSection').style.display = 'block';
            document.getElementById('statsSection').style.display = 'block';

            // Update statistics display
            this.updateStatsDisplay();

            // Reset and start animation
            this.resetAnimation();
            this.playAnimation();

            this.showStatus('Generation complete! Animation playing...', 'success');
        } catch (err) {
            console.error(err);
            this.showStatus(`Generation failed: ${err.message}`, 'error');
        } finally {
            generateBtn.disabled = false;
        }
    }

    generatePins() {
        this.pins = [];
        for (let i = 0; i < this.gen.numPins; i++) {
            const angle = (i / this.gen.numPins) * Math.PI * 2;
            const x = this.centerX + Math.cos(angle) * this.gen.radius;
            const y = this.centerY + Math.sin(angle) * this.gen.radius;
            this.pins.push({ x, y, index: i });
        }
    }

    // Scale the image into a size x size square and return its inverted
    // grayscale values (dark areas have high values).
    processImage(size) {
        // Create temporary canvas to process image
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = size;
        tempCanvas.height = size;

        // Draw and crop image to circle
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, size, size);

        // Calculate aspect ratio and draw centered
        const scale = Math.min(size / this.image.width, size / this.image.height);
        const scaledWidth = this.image.width * scale;
        const scaledHeight = this.image.height * scale;
        const offsetX = (size - scaledWidth) / 2;
        const offsetY = (size - scaledHeight) / 2;

        tempCtx.drawImage(this.image, offsetX, offsetY, scaledWidth, scaledHeight);

        // Get image data and convert to grayscale
        this.imageData = tempCtx.getImageData(0, 0, size, size);
        const grayscale = new Uint8ClampedArray(size * size);

        for (let i = 0; i < this.imageData.data.length; i += 4) {
            const r = this.imageData.data[i];
            const g = this.imageData.data[i + 1];
            const b = this.imageData.data[i + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            grayscale[i / 4] = 255 - gray; // Invert so darker areas have higher values
        }

        return grayscale;
    }

    async calculateSequenceGreedy() {
        this.sequence = [];
        const size = this.gen.radius * 2;
        const numPins = this.gen.numPins;
        const workingData = new Float32Array(this.grayscaleData);

        let currentPin = 0;
        const opacityValue = this.gen.lineOpacity / 100 * 255;

        for (let i = 0; i < this.gen.iterations; i++) {
            let bestPin = -1;
            let bestScore = -Infinity;

            // Try all possible pins
            for (let targetPin = 0; targetPin < numPins; targetPin++) {
                // Skip if too close
                const distance = Math.abs(targetPin - currentPin);
                const circularDistance = Math.min(distance, numPins - distance);
                if (circularDistance < this.gen.minDistance) continue;

                // Calculate score for this line
                const score = this.calculateLineScore(currentPin, targetPin, workingData, size);

                if (score > bestScore) {
                    bestScore = score;
                    bestPin = targetPin;
                }
            }

            if (bestPin === -1) break;

            // Add to sequence
            this.sequence.push({ from: currentPin, to: bestPin });

            // Update working data (darken the line)
            this.applyLine(currentPin, bestPin, workingData, size, opacityValue);

            currentPin = bestPin;

            // Progress update
            if (i % 100 === 0) {
                this.showStatus(`Generating string art... ${i} / ${this.gen.iterations}`, 'info', 0);
                await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI updates
            }
        }
    }

    async calculateSequenceRadon() {
        this.sequence = [];
        const size = this.gen.radius * 2;
        const numPins = this.gen.numPins;
        const workingData = new Float32Array(this.grayscaleData);

        // Calculate Radon transform projections
        this.showStatus('Computing Radon transform...', 'info', 0);
        await new Promise(resolve => setTimeout(resolve, 0));
        const projections = this.calculateRadonTransform(this.grayscaleData, size);

        // Use iterative approach similar to greedy but guided by Radon
        // This respects minDistance and number of pins while using Radon scores
        let currentPin = 0;
        const opacityValue = this.gen.lineOpacity / 100 * 255;

        for (let i = 0; i < this.gen.iterations; i++) {
            let bestPin = -1;
            let bestScore = -Infinity;

            // Try all possible pins
            for (let targetPin = 0; targetPin < numPins; targetPin++) {
                // Skip if too close (respect minDistance)
                const distance = Math.abs(targetPin - currentPin);
                const circularDistance = Math.min(distance, numPins - distance);
                if (circularDistance < this.gen.minDistance) continue;

                // Score based on Radon projection intensity for this line
                const score = this.calculateRadonLineScore(currentPin, targetPin, projections, workingData, size);

                if (score > bestScore) {
                    bestScore = score;
                    bestPin = targetPin;
                }
            }

            if (bestPin === -1 || bestScore < this.gen.threshold) break;

            // Add to sequence
            this.sequence.push({ from: currentPin, to: bestPin });

            // Update working data (darken the line)
            this.applyLine(currentPin, bestPin, workingData, size, opacityValue);

            currentPin = bestPin;

            // Progress update
            if (i % 100 === 0) {
                this.showStatus(`Generating string art... ${i} / ${this.gen.iterations}`, 'info', 0);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
    }


    // Compute the Radon transform R(theta, rho) of the image: the mean
    // intensity along every line (x - c)cos(theta) + (y - c)sin(theta) = rho,
    // where c is the image center. theta is the angle of the line's normal,
    // in [0, pi), and rho is signed. Only lines that cross the pin circle
    // are needed, so |rho| <= size / 2 and each line is sampled along its
    // chord of that circle.
    calculateRadonTransform(data, size) {
        const numAngles = this.gen.radonAngles;
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
                        sum += data[yi * size + xi];
                        count++;
                    }
                }

                // Only keep lines with enough samples
                if (count > 10) {
                    intensity[angleIdx * numRhos + rhoIdx] = sum / count;
                }
            }
        }

        return { intensity, numAngles, numRhos, rhoSteps, rhoStep };
    }

    calculateRadonLineScore(pin1, pin2, projections, workingData, size) {
        const p1 = this.pins[pin1];
        const p2 = this.pins[pin2];

        // Normal angle of the line, in the same convention as the transform
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        let theta = Math.atan2(dx, -dy);
        if (theta < 0) theta += Math.PI;
        if (theta >= Math.PI) theta -= Math.PI;

        // Signed distance from the center to the line along that normal
        let rho = (p1.x - this.centerX) * Math.cos(theta) + (p1.y - this.centerY) * Math.sin(theta);

        // Look up the nearest projection bin. theta = pi is theta = 0 with rho negated.
        const { intensity, numAngles, numRhos, rhoSteps, rhoStep } = projections;
        let angleIdx = Math.round((theta / Math.PI) * numAngles);
        if (angleIdx >= numAngles) {
            angleIdx -= numAngles;
            rho = -rho;
        }
        const rhoIdx = Math.min(numRhos - 1, Math.max(0, Math.round(rho / rhoStep) + rhoSteps));
        const radonScore = intensity[angleIdx * numRhos + rhoIdx];

        // Combine Radon intensity with actual pixel values along line
        const pixelScore = this.calculateLineScore(pin1, pin2, workingData, size);

        // Weighted combination: 70% Radon, 30% actual pixels
        const radonWeight = 0.7;
        const pixelWeight = 0.3;

        return radonScore * radonWeight + pixelScore * pixelWeight;
    }

    calculateLineScore(pin1, pin2, data, size) {
        const p1 = this.pins[pin1];
        const p2 = this.pins[pin2];

        // Offset to image coordinates
        const x1 = p1.x - this.centerX + this.gen.radius;
        const y1 = p1.y - this.centerY + this.gen.radius;
        const x2 = p2.x - this.centerX + this.gen.radius;
        const y2 = p2.y - this.centerY + this.gen.radius;

        let score = 0;
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))));

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = Math.round(x1 + (x2 - x1) * t);
            const y = Math.round(y1 + (y2 - y1) * t);

            if (x >= 0 && x < size && y >= 0 && y < size) {
                const idx = y * size + x;
                score += data[idx];
            }
        }

        return score;
    }

    applyLine(pin1, pin2, data, size, opacity) {
        const p1 = this.pins[pin1];
        const p2 = this.pins[pin2];

        const x1 = p1.x - this.centerX + this.gen.radius;
        const y1 = p1.y - this.centerY + this.gen.radius;
        const x2 = p2.x - this.centerX + this.gen.radius;
        const y2 = p2.y - this.centerY + this.gen.radius;

        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))));

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = Math.round(x1 + (x2 - x1) * t);
            const y = Math.round(y1 + (y2 - y1) * t);

            if (x >= 0 && x < size && y >= 0 && y < size) {
                const idx = y * size + x;
                data[idx] = Math.max(0, data[idx] - opacity);
            }
        }
    }

    playAnimation() {
        if (this.isAnimating) return;
        if (this.animationIndex >= this.sequence.length) {
            this.animationIndex = 0; // Replay from the start when finished
        }
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
        this.pauseAnimation();
        this.animationIndex = 0;
        this.drawFrame();
        this.updateProgress();
    }

    skipToEnd() {
        this.pauseAnimation();
        this.animationIndex = this.sequence.length;
        this.drawFrame();
        this.updateProgress();
    }

    animate() {
        if (!this.isAnimating) return;

        const speed = this.params.animationSpeed;
        this.animationIndex = Math.min(this.animationIndex + speed, this.sequence.length);

        this.drawFrame();
        this.updateProgress();

        if (this.animationIndex < this.sequence.length) {
            this.animationFrameId = requestAnimationFrame(() => this.animate());
        } else {
            this.isAnimating = false;
            this.animationFrameId = null;
        }
    }

    drawFrame() {
        // Clear canvas
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw circle outline
        this.ctx.strokeStyle = '#e0e0e0';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, this.gen.radius, 0, Math.PI * 2);
        this.ctx.stroke();

        // Draw pins
        this.ctx.fillStyle = '#666';
        this.pins.forEach(pin => {
            this.ctx.beginPath();
            this.ctx.arc(pin.x, pin.y, 2, 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw strings (opacity and weight follow the live controls, so the
        // rendering can be tweaked without regenerating)
        this.ctx.strokeStyle = `rgba(0, 0, 0, ${this.params.lineOpacity / 100})`;
        this.ctx.lineWidth = this.params.lineWeight;

        for (let i = 0; i < this.animationIndex; i++) {
            const step = this.sequence[i];
            const from = this.pins[step.from];
            const to = this.pins[step.to];

            this.ctx.beginPath();
            this.ctx.moveTo(from.x, from.y);
            this.ctx.lineTo(to.x, to.y);
            this.ctx.stroke();
        }
    }

    updateProgress() {
        const total = this.sequence.length;
        const text = `${this.animationIndex} / ${total}`;
        document.getElementById('progressText').textContent = text;

        const percent = total > 0 ? (this.animationIndex / total) * 100 : 0;
        document.getElementById('progressFill').style.width = percent + '%';
    }


    calculateProjectStats() {
        // Calculate physical dimensions (300 pixels = 30 cm radius)
        const pixelToCmRatio = 30 / 300; // 0.1 cm per pixel
        const physicalRadius = this.gen.radius * pixelToCmRatio;

        // Calculate total string length
        let totalStringLength = 0; // in pixels
        this.sequence.forEach(step => {
            const from = this.pins[step.from];
            const to = this.pins[step.to];
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            totalStringLength += distance;
        });

        // Convert to meters
        const stringLengthCm = totalStringLength * pixelToCmRatio;
        const stringLength = stringLengthCm / 100; // meters
        const stringLengthWithExtra = stringLength * 1.2; // 20% extra for knots and waste

        // Time estimates
        // Average person: 10-15 seconds per connection initially
        // With fatigue: increases to 20-25 seconds after 500 connections
        const totalConnections = this.sequence.length;

        // Calculate time considering fatigue
        let totalSeconds = 0;
        for (let i = 0; i < totalConnections; i++) {
            if (i < 200) {
                totalSeconds += 12; // Fast at beginning (12 sec/connection)
            } else if (i < 500) {
                totalSeconds += 15; // Getting tired (15 sec/connection)
            } else if (i < 1000) {
                totalSeconds += 18; // Fatigued (18 sec/connection)
            } else {
                totalSeconds += 22; // Very fatigued (22 sec/connection)
            }
        }

        // Add break time (5 min every 30 min of work)
        const workMinutes = totalSeconds / 60;
        const breakCount = Math.floor(workMinutes / 30);
        const breakTimeMinutes = breakCount * 5; // 5-minute breaks

        // Add bathroom breaks (assume 2-3 longer breaks for large projects)
        const bathroomBreaks = Math.min(3, Math.floor(workMinutes / 60));
        const bathroomTimeMinutes = bathroomBreaks * 8; // 8 minutes per bathroom break

        const totalMinutes = workMinutes + breakTimeMinutes + bathroomTimeMinutes;

        // Format times
        const workTimeFormatted = this.formatTime(workMinutes);
        const totalTimeFormatted = this.formatTime(totalMinutes);

        // Recommended sessions (max 90 minutes per session to avoid excessive fatigue)
        const sessionDuration = 90; // minutes
        const recommendedSessions = Math.ceil(totalMinutes / sessionDuration);

        return {
            physicalRadius: physicalRadius,
            stringLength: stringLength,
            stringLengthWithExtra: stringLengthWithExtra,
            workTimeMinutes: workMinutes,
            totalMinutes: totalMinutes,
            workTimeFormatted: workTimeFormatted,
            totalTimeFormatted: totalTimeFormatted,
            connectionsPerMinute: workMinutes > 0 ? totalConnections / workMinutes : 0,
            recommendedSessions: recommendedSessions,
            sessionDuration: sessionDuration,
            breakCount: breakCount,
            bathroomBreaks: bathroomBreaks
        };
    }


    updateStatsDisplay() {
        const stats = this.calculateProjectStats();

        document.getElementById('stringLength').textContent = `${stats.stringLength.toFixed(2)} meters`;
        document.getElementById('stringLengthExtra').textContent = `${stats.stringLengthWithExtra.toFixed(2)} meters`;
        document.getElementById('workTime').textContent = stats.workTimeFormatted;
        document.getElementById('totalTime').textContent = stats.totalTimeFormatted;
        document.getElementById('sessions').textContent = `${stats.recommendedSessions} × ${stats.sessionDuration} min`;
        document.getElementById('physicalSize').textContent = `${(stats.physicalRadius * 2).toFixed(1)} cm diameter`;
    }

    formatTime(minutes) {
        let hours = Math.floor(minutes / 60);
        let mins = Math.round(minutes % 60);
        if (mins === 60) { // e.g. 59.6 minutes rounds up to a full hour
            hours++;
            mins = 0;
        }

        if (hours === 0) {
            return `${mins} minutes`;
        } else if (hours === 1) {
            return `1 hour ${mins} minutes`;
        } else {
            return `${hours} hours ${mins} minutes`;
        }
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
        if (this.sequence.length === 0) return;

        // Calculate string length and time estimates
        const stats = this.calculateProjectStats();

        let text = `STRING ART INSTRUCTIONS\n`;
        text += `=======================\n`;
        text += `Generated by ${APP_NAME} - (c) ${APP_AUTHOR}\n\n`;
        text += `ALGORITHM: ${this.gen.algorithm.toUpperCase()}\n`;
        if (this.gen.algorithm === 'radon') {
            text += `- Radon Transform angles: ${this.gen.radonAngles}\n`;
            text += `- Uses all standard parameters (pins, minDistance, threshold, etc.)\n`;
        }
        text += `\n`;
        text += `SETUP:\n`;
        text += `- Circle radius: ${this.gen.radius} pixels (${stats.physicalRadius.toFixed(1)} cm)\n`;
        text += `- Number of pins: ${this.gen.numPins}\n`;
        text += `- Total string connections: ${this.sequence.length}\n\n`;
        text += `MATERIALS NEEDED:\n`;
        text += `- String length required: ${stats.stringLength.toFixed(2)} meters\n`;
        text += `- Recommended: ${stats.stringLengthWithExtra.toFixed(2)} meters (includes 20% extra for knots/waste)\n`;
        text += `- Board diameter: ${(stats.physicalRadius * 2).toFixed(1)} cm\n`;
        text += `- Pins/nails: ${this.gen.numPins} pieces\n\n`;
        text += `TIME ESTIMATE:\n`;
        text += `- Estimated work time: ${stats.workTimeFormatted}\n`;
        text += `- With breaks & fatigue: ${stats.totalTimeFormatted}\n`;
        text += `- Average speed: ${stats.connectionsPerMinute.toFixed(1)} connections/minute\n`;
        text += `- Recommended sessions: ${stats.recommendedSessions} sessions of ${stats.sessionDuration} minutes each\n\n`;
        text += `PIN POSITIONS (pin 0 at the 3 o'clock position, numbered clockwise):\n`;
        this.pins.forEach((pin, i) => {
            const angle = (i / this.gen.numPins) * 360;
            text += `Pin ${i}: ${angle.toFixed(1)}°\n`;
        });
        text += `\n\nSTRING SEQUENCE:\n`;
        text += `Follow these steps, connecting the string from pin to pin:\n\n`;

        this.sequence.forEach((step, i) => {
            text += `${i + 1}. Pin ${step.from} → Pin ${step.to}\n`;
        });

        this.downloadBlob(new Blob([text], { type: 'text/plain' }), 'string_art_instructions.txt');

        this.showStatus('Instructions downloaded!', 'success');
    }

    exportJSON() {
        if (this.sequence.length === 0) return;

        const stats = this.calculateProjectStats();

        const data = {
            metadata: {
                generated: new Date().toISOString(),
                type: 'string_art',
                version: '1.0',
                algorithm: this.gen.algorithm,
                generator: APP_NAME,
                author: APP_AUTHOR,
                license: APP_LICENSE,
                // Pin 0 is at the 3 o'clock position; angles increase clockwise
                // (screen coordinates, y axis pointing down)
                coordinateSystem: 'origin at circle center, x right, y down, pixels'
            },
            parameters: {
                algorithm: this.gen.algorithm,
                radius: this.gen.radius,
                numPins: this.gen.numPins,
                iterations: this.gen.iterations,
                lineOpacity: this.gen.lineOpacity,
                minDistance: this.gen.minDistance
            },
            algorithmSpecific: this.gen.algorithm === 'radon' ? {
                radonAngles: this.gen.radonAngles,
                threshold: this.gen.threshold,
                note: "Radon uses all standard parameters plus angle sampling"
            } : {},
            physicalDimensions: {
                radiusPixels: this.gen.radius,
                radiusCm: stats.physicalRadius,
                diameterCm: stats.physicalRadius * 2
            },
            materials: {
                stringLengthMeters: parseFloat(stats.stringLength.toFixed(2)),
                stringLengthWithExtraMeters: parseFloat(stats.stringLengthWithExtra.toFixed(2)),
                pinsRequired: this.gen.numPins
            },
            timeEstimates: {
                workTimeMinutes: Math.round(stats.workTimeMinutes),
                totalTimeMinutes: Math.round(stats.totalMinutes),
                workTimeFormatted: stats.workTimeFormatted,
                totalTimeFormatted: stats.totalTimeFormatted,
                recommendedSessions: stats.recommendedSessions,
                sessionDurationMinutes: stats.sessionDuration,
                averageConnectionsPerMinute: parseFloat(stats.connectionsPerMinute.toFixed(2))
            },
            pins: this.pins.map(pin => ({
                index: pin.index,
                x: pin.x - this.centerX,
                y: pin.y - this.centerY,
                angle: (pin.index / this.gen.numPins) * 360
            })),
            sequence: this.sequence,
            statistics: {
                totalConnections: this.sequence.length,
                uniquePinsUsed: new Set(this.sequence.flatMap(s => [s.from, s.to])).size
            }
        };

        const json = JSON.stringify(data, null, 2);
        this.downloadBlob(new Blob([json], { type: 'application/json' }), 'string_art_robot.json');

        this.showStatus('JSON downloaded!', 'success');
    }

    exportImage() {
        if (this.sequence.length === 0) return;

        // Draw final image
        this.skipToEnd();

        this.canvas.toBlob(blob => {
            if (!blob) {
                this.showStatus('Could not export the image.', 'error');
                return;
            }
            this.downloadBlob(blob, 'string_art.png');
            this.showStatus('Image saved!', 'success');
        }, 'image/png');
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
    new StringArtGenerator();
});
