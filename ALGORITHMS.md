# String Art Algorithms

Copyright (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br>

This application supports two different algorithms for generating string art patterns.

## 🎯 Greedy Algorithm (Standard)

### How it works:
1. Starts at pin 0
2. For each iteration:
   - Evaluates all possible connections to other pins
   - Selects the line that passes through the darkest areas of the image
   - Lightens those pixels in a working copy of the image, so the same path
     becomes less attractive
   - Moves to the selected pin and repeats

### Best for:
- **Portraits** - Captures facial features well
- **High contrast images** - Photos with clear light/dark areas
- **Realistic representations** - Maintains original image structure

### Parameters:
- **Iterations**: Number of string connections (more = darker, more detailed)
- **Line Opacity**: How much each line darkens the image
- **Min Pin Distance**: Prevents nearby pins from connecting

### Pros:
- ✅ Produces recognizable images
- ✅ Good for portraits and photos
- ✅ Intuitive parameters

### Cons:
- ❌ Can be slow for many iterations
- ❌ May miss some patterns
- ❌ Sequential nature limits optimization

---

## 🔬 Radon Transform Algorithm

### How it works:
The Radon mode is a **hybrid**: it runs the same pin-to-pin loop as Greedy,
but adds a Radon projection score to each candidate line.

1. Applies the **Radon Transform** once, before the loop, to convert the
   image into projection space. For each angle θ (0° to 180°) and each
   distance ρ from the center, it stores the mean darkness along that line:
   - **θ** = angle of the line's normal
   - **ρ** = signed distance from the center
2. For each iteration, starting from the current pin:
   - Looks up the projection for every candidate pin-to-pin line
   - Scores it as 70% Radon intensity + 30% mean remaining darkness along the
     line. The Radon intensity is scaled by how much of the line's original
     darkness is left, so it fades as strings cover that area
   - Picks the best line, lightens its pixels, and moves to the new pin
3. Stops after the iteration limit, or earlier when the best score falls
   below the darkness threshold

See [RADON_EXPLAINED.md](RADON_EXPLAINED.md) for the details.

### Mathematical Foundation:
```
Line equation: x·cos(θ) + y·sin(θ) = ρ

Radon Transform: R(θ, ρ) = ∫∫ f(x,y) δ(x·cos(θ) + y·sin(θ) - ρ) dx dy
```

### Best for:
- **Geometric patterns** - Creates interesting mathematical patterns
- **Abstract art** - Less literal, more artistic interpretation
- **Feature detection** - Highlights edges and structures
- **Uniform coverage** - Better distribution across the circle

### Parameters:
- **Radon Angles**: Number of angles to sample (60-360)
  - More angles = finer angular resolution
  - Default: 180 (every 1°)
- **Darkness Threshold** (default 16): Stops generation once no line is
  darker than this on average, so light images get fewer lines
- **Iterations**: Maximum number of lines to use
- **Number of Pins**, **Min Pin Distance**, **Line Opacity**: as in Greedy

### Pros:
- ✅ Mathematical elegance
- ✅ Better for geometric/abstract patterns
- ✅ Consistent angular distribution
- ✅ Finds hidden structures in images

### Cons:
- ❌ Less recognizable for portraits
- ❌ More abstract results
- ❌ Stops earlier than Greedy on light images (raise Iterations or lower
  the threshold for a denser result)
- ❌ Precomputing the transform adds a short delay before the first line

---

## 📊 Comparison

| Aspect | Greedy | Radon Transform |
|--------|--------|-----------------|
| **Speed** | Medium | Medium (plus a short precomputation) |
| **Portrait Quality** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Abstract Art** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Geometric Patterns** | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Predictability** | Medium | High |
| **Parameter Sensitivity** | Low | Medium-High |
| **Mathematical Basis** | Heuristic | Transform Theory |

---

## 🎨 Usage Recommendations

### Choose **Greedy** when:
- Working with portraits or faces
- Want recognizable output
- Have high-contrast photos
- New to string art

### Choose **Radon Transform** when:
- Want abstract/artistic results
- Working with geometric shapes
- Interested in mathematical art
- Want uniform angular distribution

---

## 🔧 Technical Details

### Greedy Implementation:
```javascript
for each iteration:
  bestScore = -∞
  for each targetPin:
    score = sum of pixels along line
    if score > bestScore:
      bestPin = targetPin
  draw line to bestPin
  subtract line from working image
```

### Radon Implementation:
```javascript
// Precompute projections (once)
for θ from 0° to 180°:
  for each ρ from -radius to +radius:
    R[θ][ρ] = mean of pixels along line (θ, ρ)

// Greedy loop guided by the projections
for each iteration:
  for each targetPin (respecting minDistance):
    (θ, ρ) = normal angle and signed distance of the line
    remaining = mean remaining darkness / mean original darkness
    score = 0.7 * R[θ][ρ] * remaining + 0.3 * mean remaining darkness
  if bestScore < threshold: stop
  draw line to bestPin
  subtract line from working image
```

---

## 📚 References

### Radon Transform:
- **Johann Radon (1917)**: Original mathematical theory
- Used in: CT scans, computer vision, pattern recognition
- Transform maps lines to points in parameter space
- Inverse transform reconstructs image from projections

### Applications:
- Medical imaging (CAT scans)
- Hough Transform (computer vision)
- Seismic analysis
- String art generation! 🎨

---

## 💡 Tips

1. **Start with Greedy** for your first attempts
2. **Try Radon** if you want something different
3. **Experiment** with parameters - each image is unique
4. **Compare** both algorithms on the same image
5. **Share** your results and discoveries!

---

*Both algorithms produce beautiful results - the choice depends on your artistic vision!*
