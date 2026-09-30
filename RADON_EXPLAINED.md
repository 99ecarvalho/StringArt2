# 🔬 Radon Transform - How It Works

Copyright (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br>

The Radon mode is a **hybrid algorithm**. It runs the same pin-to-pin loop as
the Greedy algorithm, but each candidate line gets an extra score from the
image's Radon transform. The Radon score steers the result toward the image's
large-scale structure; the pixel score keeps it faithful to the image.

## How it works

```text
Once, before the loop:
  Compute the Radon projections of the image

For each iteration:
  1. For each candidate pin:
     a. Skip it if it is closer than Min Pin Distance (as in Greedy)
     b. Compute the pixel score of the line
     c. Look up the Radon score of the line, scaled by how much of the
        line's original darkness is left
     d. Combine: 70% Radon + 30% pixels
  2. Stop if the best score is below the Darkness Threshold
  3. Choose the best line
  4. Lighten its pixels in the working image (as in Greedy)
  5. Move to the new pin
```

### Score combination

```javascript
finalScore = 0.7 × radonScore + 0.3 × pixelScore

pixelScore = mean remaining darkness along the line (working image)
remaining  = pixelScore / mean darkness along the line in the original image
radonScore = projection value for the line × remaining
```

Both scores are means on the same 0-255 scale, so the weights mean what they
say, and the final score can be compared directly with the Darkness
Threshold.

## 📊 Parameters

Every parameter is used:

| Parameter | How the Radon mode uses it |
| --------- | -------------------------- |
| **Number of Pins** | Defines the available pins |
| **Min Pin Distance** | Skips lines between nearby pins |
| **Iterations** | Maximum number of lines |
| **Line Opacity** | How much each line lightens the working image, and the drawing opacity |
| **Darkness Threshold** | Stops once no line is darker than this on average (default 16) |
| **Line Weight** | Visual thickness of the lines |
| **Radon Angles** | Angular resolution of the projections |

The Darkness Threshold only applies to the Radon mode, so the page shows it
only when Radon is selected. Because the score fades as strings cover the
image, the threshold works as an automatic stop: light images, such as logos
and text, finish with fewer lines than dark ones. Set it to 0 to always use
every iteration.

### 🔬 Radon Angles

**What it is:** the number of angles sampled between 0° and 180°. Each angle
produces one set of parallel projections.

**Effect:**

- **60-90 angles:** fast, coarse
- **180 angles:** balanced (1° resolution) ⭐ recommended
- **240-360 angles:** finer, slower precomputation

**Relationship with Number of Pins:** they are independent. Radon Angles is
the resolution of the analysis; Number of Pins is the set of physical points
on the circle. Each pin-to-pin line is matched to the nearest sampled angle.

```text
200 pins, 180 angles:
- 200 physical positions on the circle
- 180 directions analyzed
- each candidate line uses the projection closest to it
```

## 🔄 Greedy vs. Radon

### Greedy

```javascript
for each candidate pin:
  score = sum of remaining darkness along the line
choose the best score
```

### Radon (hybrid)

```javascript
precompute: Radon projections at every angle

for each candidate pin:
  pixelScore = mean remaining darkness along the line
  radonScore = projection value for this line × share of darkness left
  score = 0.7 * radonScore + 0.3 * pixelScore
stop if the best score < threshold
choose the best score
```

## 💡 When to use Radon

### ✅ Radon is better for

1. **Images with geometric structure**: logos, symbols, shapes. The
   projections respond strongly to straight edges and lines.
2. **A more uniform distribution**: the Radon term spreads lines across
   directions, while Greedy can concentrate on the darkest areas.
3. **Repetitive patterns**: textures and grids.

### ✅ Greedy is still better for

1. **Portraits and photos of people**: it concentrates on the important
   areas (eyes, nose, mouth), so the result is more recognizable.
2. **High-contrast images with a clear focus**, when you want to emphasize
   specific areas.

## 🎨 Suggested settings

### Portraits

```text
Algorithm: Greedy
Pins: 250
Iterations: 3500
Opacity: 18%
```

### Logos / geometric

```text
Algorithm: Radon
Pins: 200
Iterations: 3000
Radon Angles: 240
Opacity: 20%
```

### Abstract

```text
Algorithm: Radon
Pins: 300
Iterations: 4000
Radon Angles: 180
Opacity: 15%
```

## 🔬 Technical details

### Computing the projections

The image is a square of side `2 × radius`, with center `c`. For each
sampled angle θ and each signed distance ρ (in steps of 2 pixels, from
−radius to +radius):

```javascript
line: (x − cx)·cos(θ) + (y − cy)·sin(θ) = ρ
walk along the line's chord of the pin circle, one pixel at a time
R[θ][ρ] = mean darkness of the pixels visited
```

θ is the angle of the line's **normal**, in [0°, 180°), and ρ is signed.
Lines that cross the image in fewer than 10 samples get a score of 0.

The projections are stored in a flat typed array indexed by (angle, ρ), so
each lookup during the loop takes constant time.

### Matching a pin-to-pin line to a projection

```javascript
line from pin1 to pin2:
  1. normal angle θ = atan2(dx, −dy), folded into [0°, 180°)
  2. ρ = signed distance from the center to the line along that normal
  3. round θ and ρ to the nearest sampled bin
     (θ rounding up to 180° is the same line as 0° with ρ negated)
  4. radonScore = R[θ][ρ]
```

### Why 70% Radon + 30% pixels?

- **70% Radon**: overall guidance from the image's structure
- **30% pixels**: local correction from the image as it is being covered

The weights were chosen by experiment.

### Why the Radon score is scaled

The projections are computed once, from the original image. If they were
used as they are, a line through a dark area would keep its high Radon score
however many strings already cover that area, and the same lines would be
drawn over and over. Scaling each projection by the share of the line's
original darkness that remains in the working image makes the Radon score
fade exactly as the pixels do, whichever strings covered them.

### Difference from Greedy

Greedy scores a line by the **sum** of the darkness along it, which favors
long lines through the middle of the circle. The Radon mode uses **means**,
so short lines along dark edges compete on equal terms. Together with the
threshold, this gives the Radon mode its higher-contrast, sparser look.

## ✨ Summary

The Radon mode:

- ✅ uses every parameter;
- ✅ uses the actual image, not only abstract projections;
- ✅ combines mathematical analysis with the pixel data;
- ✅ produces more structured results than Greedy on geometric images.

---

**TL;DR**: the Radon mode is a **hybrid algorithm** that uses the image's
Radon projections as a guide, while still respecting every parameter and the
image itself. 🎨🔬
