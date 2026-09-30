# 🚀 Quick Start Guide

Copyright (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br>

- [Getting it running](#getting-it-running)
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

Use whichever of these you already have:

```bash
python3 -m http.server 8080      # Python 3
npx --yes serve -l 8080 .        # Node.js
php -S localhost:8080            # PHP
```

Then open <http://localhost:8080> in your browser. Press `Ctrl+C` in the
terminal to stop the server.

### 3. Make your first piece

1. Click **Choose File** and pick an image (a high-contrast portrait works
   well).
2. Keep the default settings and click **🎯 Generate String Art**.
3. Watch the animation, or click **⏭️ Skip to End**.
4. Download the instructions (TXT), the robot file (JSON), or the image (PNG).

## Building the distributable

You only need this to host the app as a single file. It requires Node.js 16
or newer and has no npm dependencies.

```bash
node --version             # check Node.js is installed (v16+)
./build_dist.sh            # or: node build.js
```

The result is in `dist/`. Test the build before deploying:

```bash
cd dist
python3 -m http.server 8080
# Visit http://localhost:8080
```

## Deploying

Copy the single-file build to any web server or static host:

```bash
scp dist/index.html user@server:/var/www/html/stringart.html
```

Or copy the separate files, including the optional Apache configuration:

```bash
scp dist/index-separate.html dist/style.min.css dist/script.js \
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
Darkness Threshold: 128 (default)
```

**Tips:**
- More angles (240-360) = finer angular detail
- Raise the darkness threshold to stop earlier on light images
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
- 1000-2000: Light sketch
- 2500-4000: Balanced (recommended)
- 5000+: Very dark, detailed

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

**Darkness Threshold** (0-255)
- Generation stops when the best line scores below this value
- Low values: always uses all iterations
- High values: stops once the image is mostly covered

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
   - High contrast works better
   - Convert to black & white beforehand
   - Crop to focus on subject

4. **Performance**
   - Generation time grows with pins × iterations
   - Radon adds a short precomputation step
   - Use fewer iterations for quick previews

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
