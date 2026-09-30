# 🎨 String Art Generator - Feature Summary

Copyright (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br>

## ✨ Dual algorithm system

### 🎯 Greedy algorithm (standard)

- **Best for:** Portraits, photos, realistic images
- **How it works:** At each step, picks the line that covers the darkest
  remaining pixels, then lightens those pixels
- **Result:** Recognizable, photo-like output

### 🔬 Radon Transform algorithm (hybrid)

- **Best for:** Logos, geometric shapes, abstract results
- **How it works:** Precomputes Radon projections (the math used in CT scans)
  and adds them to the greedy pixel score, favoring lines that follow the
  image's large-scale structure
- **Result:** More structured, more evenly spread lines

**Radon-only parameters:**

- Radon angles (60-360): angular resolution of the projections
- Darkness threshold (0-255): stops early when the best line scores below it

---

## 📊 Complete feature list

### Image processing

- ✅ Upload any image format the browser can decode
- ✅ Automatic grayscale conversion
- ✅ Scaling and centering to fit the circle

### Algorithm selection

- ✅ Toggle between Greedy and Radon Transform
- ✅ Algorithm-specific parameters shown only when they apply
- ✅ Algorithm description shown next to the selector

### Auto-optimize (Greedy)

- ✅ Analyzes contrast, edge density, and darkness of the uploaded image
- ✅ Classifies it (portrait, geometric, low-contrast, dark, light, general)
- ✅ Suggests pins, iterations, opacity, minimum distance, and line weight

### Customizable parameters

**Both algorithms:**

- Radius: 100-600 pixels
- Number of pins: 50-500
- Iterations: 500-10,000
- Line opacity: 5-50%
- Minimum pin distance: 10-100 pins
- Line weight: 0.5-3 pixels

**Radon only:**

- Radon angles: 60-360
- Darkness threshold: 0-255

Line opacity and line weight also control the rendering, and can be changed
after generation without regenerating.

### Animation & visualization

- ✅ Real-time animation of string placement
- ✅ Variable speed control (1-100 lines/frame)
- ✅ Play / Pause / Reset / Skip controls
- ✅ Progress bar and counter
- ✅ Pins drawn on the circle

### Project statistics

- ✅ **String length** in meters
- ✅ **Material requirements** (with 20% extra)
- ✅ **Time estimation** (considering fatigue)
- ✅ **Break scheduling** (every 30 minutes)
- ✅ **Recommended work sessions** (90 minutes max)
- ✅ **Physical size** (1 pixel = 1 mm)

### Export formats

#### 📋 Text instructions (.txt)

- Algorithm used
- Pin positions with angles (pin 0 at 3 o'clock, numbered clockwise)
- Complete sequence of connections
- Material requirements
- Time estimates with breaks
- Physical dimensions

#### 💾 Robot JSON (.json)

```text
{
  "metadata": {
    "algorithm": "greedy" | "radon",
    "generated": "ISO timestamp",
    "generator", "author", "license", "coordinateSystem"
  },
  "parameters": { ... },
  "algorithmSpecific": {
    // Radon: radonAngles, threshold
  },
  "physicalDimensions": {
    "radiusCm": number,
    "diameterCm": number
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
  "pins": [{ index, x, y, angle }],
  "sequence": [{ from, to }]
}
```

#### 🖼️ Image export (.png)

- Full canvas resolution
- Ready to share or print

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

### Material calculations

- ✅ Exact string length in meters
- ✅ 20% extra for knots and waste
- ✅ Physical radius and diameter
- ✅ Pixel-to-centimeter conversion (1 px = 1 mm)

### Distribution

- ✅ No dependencies: open `index.html` and it works
- ✅ Single-file build with CSS and JavaScript inlined
- ✅ Readable, unobfuscated JavaScript in every build
- ✅ Optional Apache `.htaccess`
- ✅ Free software under the LGPL v3.0 or later

---

## 📁 Documentation files

1. **README.md** - Project overview
2. **QUICKSTART.md** - Algorithm selection and suggested settings
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
2. **Radon transform** - Medical-imaging math applied to art
3. **Realistic time estimation** - Includes fatigue modeling and breaks
4. **Physical dimension mapping** - Pixel-to-centimeter conversion
5. **Material calculator** - Automated supply estimation
6. **Machine-readable export** - JSON ready for robots and scripts

---

**Version:** 2.0 (with Radon Transform)
**License:** GNU LGPL v3.0 or later, see [COPYING.LESSER](COPYING.LESSER)
