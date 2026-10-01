# 🚀 Quick Start Guide

Copyright (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br>

- [Getting it running](#getting-it-running)
- [Running the tests](#running-the-tests)
- [Building the distributable](#building-the-distributable)
- [Deploying](#deploying)
- [Choosing an algorithm](#when-to-use-each-algorithm)

## Getting it running

String Art Generator is a static web page. There is nothing to install and
no server-side code: all you need is a modern browser (Chrome, Edge, Firefox,
or Safari).

### 1. Get the code

```bash
git clone <repository-url> string-art-generator
cd string-art-generator
```

### 2. Start it

**Option A: open the file directly**

```bash
xdg-open index.html        # Linux
open index.html            # macOS
start index.html           # Windows (cmd or PowerShell)
```

**Option B: serve it locally** (closest to how it runs once deployed)

With Node.js 18 or newer, use the built-in server (no `npm install` needed):

```bash
npm start                        # or: node serve.js
```

Or use whichever of these you already have:

```bash
python3 -m http.server 8080      # Python 3
php -S localhost:8080            # PHP
```

Then open <http://localhost:8080> in your browser. Press `Ctrl+C` in the
terminal to stop the server.

### 3. Make your first piece

1. Click **Choose File** and pick an image (a high-contrast portrait works
   well).
2. Check the target preview next to the canvas. Use **Zoom** and the
   position sliders to frame the subject.
3. Keep the default settings and click **🎯 Generate String Art**.
4. Watch the animation, or click **⏭️ Skip to End**.
5. Set your board's **pin circle diameter** and **nail diameter**.
6. Download the instructions (TXT), the robot file (JSON), the image (PNG),
   or the printable pin template (SVG).

## Running the tests

```bash
npm test                   # tests for the algorithms (node:test, no dependencies)
npm run check              # syntax check of every script
```

## Building the distributable

You only need this to host the app as a single file. It requires Node.js 18
or newer and has no npm dependencies.

```bash
node --version             # check Node.js is installed (v18+)
npm run build              # or: ./build_dist.sh, or node build.js
```

The result is in `dist/`. Test the build before deploying:

```bash
npm run serve:dist         # serves dist/ on http://localhost:8080
```

## Deploying

Copy the single-file build to any web server or static host:

```bash
scp dist/index.html user@server:/var/www/html/stringart.html
```

Or copy the separate files, including the optional Apache configuration:

```bash
scp dist/index-separate.html dist/style.min.css dist/stringart-core.js dist/script.js \
    dist/.htaccess dist/COPYING dist/COPYING.LESSER \
    user@server:/var/www/html/stringart/
```

See [BUILD_GUIDE.md](BUILD_GUIDE.md) for more deployment options.

---

## When to Use Each Algorithm

### 🎯 Use GREEDY for:

**Best Results:**
- ✅ Portraits and faces
- ✅ Photographs
- ✅ High-contrast images
- ✅ When you want recognizable output

**Example Settings:**
```
Radius: 300 pixels
Pins: 200-250
Iterations: 2500-4000
Line Opacity: 15-25%
```

**Tips:**
- Start with 200 pins and 3000 iterations
- Lower opacity (15-20%) looks more natural
- Works great with black & white photos

---

### 🔬 Use RADON TRANSFORM for:

**Best Results:**
- ✅ Abstract art
- ✅ Geometric shapes
- ✅ Patterns and textures
- ✅ When you want something unique

**Example Settings:**
```
Radius: 300 pixels
Pins: 200-300
Radon Angles: 180
Iterations: 3000
Darkness Threshold: 16 (default)
```

**Tips:**
- More angles (240-360) = finer angular detail
- Raise the darkness threshold for a lighter, sparser result; lower it for a denser one
- Great for logos and geometric designs

---

## 🎨 Comparison Examples

### Portrait Photo:
- **Greedy**: ⭐⭐⭐⭐⭐ (Excellent - face clearly visible)
- **Radon**: ⭐⭐⭐ (Good - more abstract, artistic)

### Geometric Logo:
- **Greedy**: ⭐⭐⭐ (Good - recognizable)
- **Radon**: ⭐⭐⭐⭐⭐ (Excellent - sharp lines, uniform)

### Landscape:
- **Greedy**: ⭐⭐⭐⭐ (Very good - realistic)
- **Radon**: ⭐⭐⭐⭐ (Very good - abstract interpretation)

### Abstract Pattern:
- **Greedy**: ⭐⭐⭐ (Good)
- **Radon**: ⭐⭐⭐⭐⭐ (Excellent - mathematical beauty)

---

## 🔧 Parameter Guide

### GREEDY Parameters:

**Iterations** (500-10,000)
- The maximum number of lines. Greedy stops by itself once another line
  would no longer improve the match, often before the limit
- 1000-2000: Quick sketch or preview
- 3000-4000: Balanced (recommended)
- 5000+: Only matters for very dark or detailed images

**Line Opacity** (5-50%)
- 10-15%: Very light, delicate
- 20-25%: Balanced (recommended)
- 30%+: Dark, bold

**Min Pin Distance** (10-100)
- 15-20: Natural (recommended)
- 30+: Prevents short jumps
- Lower: More short lines near the edge

---

### RADON TRANSFORM Parameters:

**Radon Angles** (60-360)
- 60-90: Coarse, fast
- 180: Balanced (recommended)
- 240-360: Fine detail, slower

**Darkness Threshold** (0-255, default 16)
- Generation stops once no line is darker than this on average,
  so light images automatically get fewer lines
- 0: always uses all iterations
- 16: stops when the image is well covered (recommended)
- 32-64: lighter, sparser result

**Iterations** (limit on lines)
- Caps the number of lines
- Start with 3000

Pins, opacity, min pin distance, and line weight work as in Greedy.

---

## 💡 Pro Tips

1. **Try Both!** 
   - Same image, different algorithms
   - Compare the results
   - Each has unique character

2. **Start Simple**
   - Use default settings first
   - Adjust one parameter at a time
   - Note what works for your images

3. **Image Preparation**
   - High contrast works better: raise **Contrast** if the target looks flat
   - Raise **Gamma** above 1 for darker midtones (more string)
   - Use **Zoom** and the position sliders to crop to the subject
   - Compare settings with the **Match to Target** score

4. **Performance**
   - Generation time grows with pins × iterations
   - Radon adds a short precomputation step
   - Use fewer iterations or a lower resolution for quick previews
   - Generation runs in the background; press **Cancel** to stop it

5. **Artistic Freedom**
   - No "right" settings
   - Experiment freely
   - Unexpected results can be beautiful!

---

## 📊 Performance Comparison

| Aspect | Greedy | Radon |
| ------ | ------ | ----- |
| Speed | Pins × iterations | Same, plus a short precomputation |
| Portrait quality | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Abstract art | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Predictability | Medium | High |

---

## 🎯 Recommended Workflow

1. **Upload your image**
2. **Start with Greedy** (default)
   - Generate with defaults
   - See if you like the style
3. **If portrait/photo**: Fine-tune Greedy parameters
4. **If want abstract**: Switch to Radon
5. **Experiment** with both!
6. **Export** your favorite result

---

## ❓ FAQ

**Q: Which algorithm is "better"?**
A: Neither! They serve different artistic purposes.

**Q: Can I mix both algorithms?**
A: The Radon mode already is a mix: it runs the greedy loop and adds a Radon
projection score to each line. See [RADON_EXPLAINED.md](RADON_EXPLAINED.md).

**Q: Which uses less string?**
A: Check the Project Statistics panel after generating: it shows the exact
string length for your image and settings.

**Q: My Radon result looks weird?**
A: Try more Radon angles, fewer iterations, or a lower line opacity. Each
image needs different settings.

---

Happy creating! 🎨✨
