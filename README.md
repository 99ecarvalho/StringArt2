# 🎨 String Art Generator

[![License: LGPL v3+](https://img.shields.io/badge/license-LGPL--3.0--or--later-blue.svg)](COPYING.LESSER)

A web-based tool that transforms images into string art patterns, with
step-by-step instructions for making them by hand and a JSON export for robot
or CNC automation. It runs entirely in the browser: no server, no build step,
and no dependencies.

Copyright (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br>

- [Algorithms](#-algorithms)
- [Features](#features)
- [How to use](#how-to-use)
- [Tips for best results](#tips-for-best-results)
- [Creating physical string art](#creating-physical-string-art)
- [Robot automation](#robot-automation)
- [Building and deploying](#building-and-deploying)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## ✨ Algorithms

Choose between two algorithms:

### 🎯 Greedy (default)

- Best for portraits and photos
- Produces recognizable, realistic results
- At each step, picks the line that covers the darkest remaining pixels

### 🔬 Radon Transform

- A hybrid that adds Radon projections (the math behind CT scans) to the
  greedy line score
- Favors lines that follow the image's large-scale structure
- Good for logos, geometric shapes, and abstract results

📖 See [ALGORITHMS.md](ALGORITHMS.md) for a comparison and
[RADON_EXPLAINED.md](RADON_EXPLAINED.md) for how the Radon mode works.

## Features

### Core functionality

- **Image upload**: any image format your browser can decode
- **Auto-optimize** (Greedy): analyzes the image and suggests parameters
- **Customizable parameters**:
  - Circle radius (100-600 pixels)
  - Number of pins (50-500)
  - String iterations (500-10,000)
  - Line opacity (5-50%)
  - Minimum pin distance (10-100)
  - Line weight (0.5-3 px)
  - Radon only: Radon angles (60-360) and darkness threshold (0-255)

### Animation and visualization

- **Live preview**: watch the string art being built line by line
- **Speed control**: 1-100 lines per frame
- **Playback controls**: play, pause, reset, and skip to end
- **Progress tracking**: progress bar and counter

### Project statistics

- String length needed, plus 20% extra for knots and waste
- Estimated work time, including fatigue and breaks
- Recommended number of work sessions
- Physical board size (1 pixel = 1 mm, so a 300 px radius is a 60 cm board)

### Export options

1. **Text instructions**: pin positions with angles, the full connection
   sequence, materials, and time estimates
2. **JSON**: pin coordinates, the connection sequence, and metadata, for
   robots and scripts
3. **Image**: the finished result as a PNG

## How to use

1. **Open** `index.html` in a modern web browser (or serve the folder with
   `python3 -m http.server`).
2. **Upload** an image.
3. **Adjust** the parameters, or tick *Auto-Optimize Parameters*:
   - More pins = finer detail
   - More iterations = darker, more detailed result
   - Lower opacity = lighter, more delicate look
4. Click **Generate String Art**.
5. **Watch** the animation or skip to the end. Line opacity and weight can be
   changed afterwards without regenerating.
6. **Export** the instructions, the JSON, or the image.

## Tips for best results

- **High-contrast images** work best (portraits, silhouettes).
- **Simple subjects** are more recognizable than busy scenes.
- **Start small**: try 200 pins and 2000 iterations first.
- **Line opacity**: lower values (10-20%) often look more realistic.
- See [QUICKSTART.md](QUICKSTART.md) for suggested settings per algorithm.

## Creating physical string art

1. **Materials**:
   - A circular board or frame
   - Small nails or pins (one per pin in the export)
   - Thread or string (black works well)
   - Ruler and protractor
2. **Setup**:
   - Pin 0 is at the 3 o'clock position and pins are numbered clockwise.
   - Mark each pin using the angle listed in the exported instructions.
   - Hammer in the nails and number them.
3. **Execution**:
   - Follow the exported sequence, wrapping the string around each pin in
     order.
   - Don't cut the string: it's one continuous thread!

## Robot automation

The JSON export contains everything a machine needs: pin coordinates relative
to the circle center (x to the right, y down, in pixels), the connection
sequence, and metadata.

```json
{
  "metadata": {
    "generated": "2026-01-01T12:00:00.000Z",
    "type": "string_art",
    "version": "1.0",
    "algorithm": "greedy",
    "generator": "String Art Generator",
    "author": "Eduardo Correia <ecorreia@apliant.com.br>",
    "license": "LGPL-3.0-or-later",
    "coordinateSystem": "origin at circle center, x right, y down, pixels"
  },
  "parameters": { "algorithm": "greedy", "radius": 300, "numPins": 200, "...": "..." },
  "physicalDimensions": { "radiusPixels": 300, "radiusCm": 30, "diameterCm": 60 },
  "materials": { "stringLengthMeters": 1234.56, "...": "..." },
  "timeEstimates": { "workTimeMinutes": 1000, "...": "..." },
  "pins": [
    { "index": 0, "x": 300, "y": 0, "angle": 0 }
  ],
  "sequence": [
    { "from": 0, "to": 45 }
  ],
  "statistics": { "totalConnections": 3000, "uniquePinsUsed": 200 }
}
```

## Building and deploying

The source files run as they are. To produce a single self-contained HTML
file for hosting:

```bash
./build_dist.sh        # or: node build.js
```

This writes `dist/`, which is not tracked in git. See
[BUILD_GUIDE.md](BUILD_GUIDE.md) for details and deployment options.

## Documentation

| Document | Contents |
| -------- | -------- |
| [QUICKSTART.md](QUICKSTART.md) | Which algorithm to use and suggested settings |
| [ALGORITHMS.md](ALGORITHMS.md) | How both algorithms work and how they compare |
| [RADON_EXPLAINED.md](RADON_EXPLAINED.md) | The hybrid Radon mode in detail |
| [FEATURES.md](FEATURES.md) | Complete feature list |
| [BUILD_GUIDE.md](BUILD_GUIDE.md) | Building and deploying |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |

## Browser compatibility

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Supported (slower with many pins or iterations)

## Contributing

Bug reports, documentation fixes, and code are welcome. Please read
[CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

Copyright (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br>

String Art Generator is free software: you can redistribute it and/or modify
it under the terms of the **GNU Lesser General Public License, version 3 or
(at your option) any later version**. The license text is in
[COPYING.LESSER](COPYING.LESSER); it supplements the GNU General Public
License v3, included as [COPYING](COPYING).

This program is distributed in the hope that it will be useful, but WITHOUT
ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE.

Images you create with the tool, and the instructions and JSON it exports for
them, are yours; the license covers the software, not its output.

---

Enjoy creating beautiful string art! 🧵✨
