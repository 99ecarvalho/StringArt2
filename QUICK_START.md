# 🚀 Quick Start Guide - Algorithm Selection

Copyright (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br>

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
