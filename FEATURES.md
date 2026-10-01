# 🎨 String Art Generator - Feature Summary

Copyright (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br>

## ✨ Dual algorithm system

### 🎯 Greedy algorithm (standard)

- **Best for:** Portraits, photos, realistic images
- **How it works:** At each step, draws the line that most reduces the
  difference between the target and the rendering, and stops by itself when
  no line would help
- **Result:** Recognizable, photo-like output

### 🔬 Radon Transform algorithm (hybrid)

- **Best for:** Logos, geometric shapes, higher-contrast results
- **How it works:** Precomputes Radon projections (the math used in CT scans)
  and combines them with the remaining darkness along each line, favoring
  lines that follow the image's large-scale structure
- **Result:** More structured, higher-contrast lines

**Radon-only parameters:**

- Radon angles (60-360): angular resolution of the projections
- Darkness threshold (0-255, default 16): stops once the image is covered

Both algorithms use the same model of the canvas: each string is a band as
wide as the line weight, antialiased and blended exactly as the browser draws
it.

---

## 📊 Complete feature list

### Image preparation

- ✅ Upload any image format the browser can decode
- ✅ Fit: fill the circle (crop) or fit the whole image
- ✅ Zoom (1-3x) and horizontal/vertical position
- ✅ Contrast (-100 to 100) and gamma (0.4-2.5)
- ✅ Target preview of the prepared image, next to the result
- ✅ One-click reset of the preparation

### Algorithm selection

- ✅ Toggle between Greedy and Radon Transform
- ✅ Algorithm-specific parameters shown only when they apply
- ✅ Algorithm description shown next to the selector

### Auto-optimize (Greedy)

- ✅ Analyzes contrast, edge density, and darkness of the prepared image
- ✅ Classifies it (photo/portrait, high detail/texture, low-contrast, dark,
  light, general)
- ✅ Suggests pins, iterations, opacity, minimum distance, and line weight

### Customizable parameters

**Both algorithms:**

- Resolution: radius 100-600 pixels
- Number of pins: 50-500
- Pin 0 position: 3 o'clock or 12 o'clock
- Iterations (maximum number of lines): 500-10,000
- Line opacity: 5-50%
- Minimum pin distance: 10-100 pins
- Line weight: 0.5-3 pixels

**Radon only:**

- Radon angles: 60-360
- Darkness threshold: 0-255

Line opacity and line weight also control the rendering, and can be changed
after generation without regenerating (the preview matches the model most
closely with the values used to generate).

### Generation

- ✅ Runs in a Web Worker, so the page stays responsive
- ✅ Progress bar and Cancel button
- ✅ Falls back to running in the page if workers are unavailable
- ✅ Line pixels are cached between iterations for speed
- ✅ Match score (0-100%) between the result and the target

### Animation & visualization

- ✅ Real-time animation of string placement, drawing only new lines each
  frame
- ✅ Variable speed control (1-100 lines/frame)
- ✅ Play / Pause / Reset / Skip controls
- ✅ Progress bar and counter
- ✅ Pins drawn on the circle

### Project statistics

- ✅ **Match to target**
- ✅ **String length** in meters, including the thread that wraps around
  each nail
- ✅ **Material requirements** (with 20% extra)
- ✅ **Pin spacing** on the physical board
- ✅ **Time estimation** (considering fatigue)
- ✅ **Break scheduling** (every 30 minutes)
- ✅ **Recommended work sessions** (90 minutes max)

### Physical board

- ✅ Pin circle diameter in cm, independent of the resolution
- ✅ Nail diameter in mm, for the template and the thread wraps
- ✅ Statistics update immediately when either changes

### Export formats

#### 📋 Text instructions (.txt)

- Algorithm used and match score
- Pin circle diameter, pin spacing, and nail diameter
- Pin positions with angles (from pin 0, numbered clockwise)
- Complete sequence of connections
- Material requirements
- Time estimates with breaks

#### 💾 Robot JSON (.json, format version 1.1)

```text
{
  "metadata": {
    "algorithm": "greedy" | "radon",
    "generated": "ISO timestamp",
    "version": "1.1",
    "generator", "author", "license", "pin0Position", "coordinateSystem"
  },
  "parameters": { ... },
  "algorithmSpecific": {
    // Radon: radonAngles, threshold
  },
  "physicalDimensions": {
    "pinCircleDiameterCm": number,
    "pinSpacingMm": number,
    "nailDiameterMm": number
  },
  "materials": {
    "stringLengthMeters": number,
    "stringLengthWithExtraMeters": number
  },
  "timeEstimates": {
    "workTimeMinutes": number,
    "totalTimeMinutes": number,
    "recommendedSessions": number
  },
  "pins": [{ index, x, y, xMm, yMm, angle }],
  "sequence": [{ from, to }],
  "statistics": { totalConnections, uniquePinsUsed, matchPercent }
}
```

Coordinates are rounded (pixels to 3 decimals, millimeters to 2).

#### 🖼️ Image export (.png)

- Full canvas resolution
- Ready to share or print

#### 📐 Pin template (.svg)

- Full size, in millimeters: print at 100% scale
- Every pin marked, pin 0 in red, with numbers (thinned out when pins are
  close together)
- Center mark and a 100 mm scale bar to check the print

Downloads are named after the uploaded image, for example
`portrait-instructions.txt`.

### Time estimation

- ✅ **Fatigue modeling:**
  - First 200 connections: 12 sec each
  - 200-500: 15 sec each
  - 500-1000: 18 sec each
  - 1000+: 22 sec each
- ✅ **Automatic breaks:**
  - 5 minutes every 30 minutes
  - Up to 3 longer breaks (8 minutes) for long projects
- ✅ **Session recommendations:**
  - Max 90 minutes per session
  - Calculates the number of sessions

### Convenience and accessibility

- ✅ Settings are remembered between visits (in the browser's local storage)
- ✅ Status messages are announced by screen readers

### Distribution

- ✅ No dependencies: open `index.html` and it works
- ✅ Single-file build with CSS and JavaScript inlined, Web Worker included
- ✅ Readable, unobfuscated JavaScript in every build
- ✅ Optional Apache `.htaccess`
- ✅ npm scripts to serve, test, and build, with nothing to install
- ✅ Free software under the LGPL v3.0 or later

---

## 📁 Documentation files

1. **README.md** - Project overview
2. **QUICKSTART.md** - Getting it running, algorithm selection, suggested settings
3. **ALGORITHMS.md** - How the algorithms work and compare
4. **RADON_EXPLAINED.md** - The hybrid Radon mode in detail
5. **BUILD_GUIDE.md** - Building and deploying
6. **CONTRIBUTING.md** - How to contribute
7. **This file** - Complete feature summary

---

## 🎯 Use cases

### For artists

- Create unique wall art
- Portrait commissions
- Abstract installations
- Geometric designs

### For educators

- Teach algorithms (greedy optimization vs. transforms)
- Mathematics visualization
- Computer vision concepts

### For makers

- DIY home decor
- Personalized gifts
- Mathematical art pieces
- CNC/robot projects

### For developers

- Algorithm comparison studies
- Image processing examples
- Canvas API demonstrations
- Transform theory applications

---

## 💡 Highlights

1. **Two algorithms** - Compare a greedy optimizer with a Radon-guided hybrid
2. **Faithful preview** - The algorithms model the canvas exactly
3. **Radon transform** - Medical-imaging math applied to art
4. **Printable pin template** - Full-size SVG for marking the board
5. **Realistic time estimation** - Includes fatigue modeling and breaks
6. **Material calculator** - String length including nail wraps
7. **Machine-readable export** - JSON in pixels and millimeters

---

**Version:** 2.1
**License:** GNU LGPL v3.0 or later, see [COPYING.LESSER](COPYING.LESSER)
