# 🎨 EmpireScene Quick Visual Reference

## Component Props

```javascript
<EmpireScene
  daysElapsed={number}    // For day/night cycle
  season={string}         // '春季' | '夏季' | '秋季' | '冬季'
  population={number}     // 0-∞
  stability={number}      // 0-100
  wealth={number}         // Silver amount
/>
```

---

## Visual Decision Tree

```
┌─────────────────────────────────────────────────────────────┐
│                     EMPIRE SCENE                            │
│                                                             │
│  Sky: Based on daysElapsed (5-second cycle)                │
│  ├─ 0-25%:   Dawn (Deep Blue → Light Blue)                 │
│  ├─ 25-50%:  Day (Light Blue → Orange)                     │
│  ├─ 50-75%:  Dusk (Orange → Deep Blue)                     │
│  └─ 75-100%: Night (Deep Blue → Purple) + Stars            │
│                                                             │
│  Weather: Based on stability                               │
│  ├─ >80:  Clear Sky + Flying Birds                         │
│  ├─ 40-80: Cloudy + Drifting Clouds                        │
│  └─ <40:  Stormy + Rain + Lightning                        │
│                                                             │
│  Ground & Trees: Based on season                           │
│  ├─ 春季: Green + Pink Flowers                             │
│  ├─ 夏季: Bright Green + Yellow Sparkles                   │
│  ├─ 秋季: Orange/Brown + Falling Leaves                    │
│  └─ 冬季: White Snow + Snowflakes + Bare Trees             │
│                                                             │
│  Settlement: Based on population                           │
│  ├─ <10:   Campfire + Tent                                 │
│  ├─ 10-100: Simple Houses (1 per 5 pop, max 20)            │
│  └─ >100:  Stone Houses (upgraded appearance)              │
│                                                             │
│  Prosperity: Based on wealth                               │
│  ├─ <500:  Normal appearance                               │
│  └─ >500:  Golden sparkles rising from buildings           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Example Scenarios

### 🌅 Early Game - Dawn, Spring, Low Population
```
Props: { daysElapsed: 2, season: '春季', population: 8, stability: 90, wealth: 50 }

Visual:
- Dawn sky (light blue gradient)
- Fresh green ground
- Pink flower particles
- Campfire with animated flames
- Clear weather (high stability)
- No sparkles (low wealth)
```

### ☀️ Mid Game - Day, Summer, Growing Settlement
```
Props: { daysElapsed: 50, season: '夏季', population: 45, stability: 65, wealth: 300 }

Visual:
- Bright day sky (blue-orange gradient)
- Vibrant green ground
- 9 simple houses (45 ÷ 5)
- Cloudy weather (medium stability)
- No sparkles (wealth < 500)
```

### 🌙 Late Game - Night, Autumn, Prosperous City
```
Props: { daysElapsed: 200, season: '秋季', population: 150, stability: 85, wealth: 800 }

Visual:
- Night sky (deep blue-purple) with twinkling stars
- Orange/brown autumn ground
- 20 stone houses (max, upgraded style)
- Windows glowing bright yellow
- Clear weather with flying birds
- Golden sparkles rising (high wealth)
```

### ⛈️ Crisis - Storm, Winter, Struggling Settlement
```
Props: { daysElapsed: 100, season: '冬季', population: 30, stability: 25, wealth: 100 }

Visual:
- Day/dusk sky
- White snowy ground
- 6 simple houses
- Dark storm clouds
- Rain and lightning
- Snowflakes falling
- No sparkles (low wealth)
```

---

## Animation Reference

### Continuous Animations
- **Day/Night Cycle**: Updates every 100ms, 5-second full cycle
- **Cloud Drift**: 20-second horizontal movement
- **Star Twinkle**: 2-second opacity pulse
- **Float (Birds/Flames)**: 3-second up-down motion

### Triggered Animations
- **Wealth Sparkles**: Only when wealth > 500
- **Lightning**: Only when stability < 40
- **Rain**: Only when stability < 40
- **Stars**: Only during night (dayProgress > 0.6 or < 0.15)
- **Window Glow**: Brighter at night

### Seasonal Animations
- **Spring**: Pink flower particles floating
- **Summer**: Yellow sparkles (subtle)
- **Autumn**: Orange leaf particles
- **Winter**: White snowflakes falling

---

## Color Codes Quick Reference

### Sky Gradients
```css
/* Dawn */
from: rgb(25-135, 25-150, 60-200)
to: rgb(60-135, 60-160, 100-200)

/* Day */
from: rgb(135-255, 150-255, 200-150)
to: rgb(135-255, 160-100, 200-100)

/* Dusk */
from: rgb(255-25, 255-25, 150-60)
to: rgb(255-60, 100-60, 100-60)

/* Night */
from: rgb(25, 25-35, 60-100)
to: rgb(60-40, 60-40, 100-150)
```

### Seasonal Palette
```css
/* Spring */
ground: #7cb342
trees: #558b2f
particles: #ffc0cb (pink)

/* Summer */
ground: #8bc34a
trees: #689f38
particles: #ffeb3b (yellow)

/* Autumn */
ground: #d4a574
trees: #bf8040
particles: #ff9800 (orange)

/* Winter */
ground: #e8f4f8
trees: #8d6e63 (bare trunks)
particles: #ffffff (snow)
```

### Building Colors
```css
/* Simple Houses */
body: #a1887f
roof: #8d6e63
windows: #ffeb3b (opacity varies)

/* Prosperous Houses */
body: #795548
roof: #d32f2f
windows: #ffeb3b (opacity varies)
```

---

## Layout Coordinates

### SVG ViewBox: `0 0 200 120`

```
Y-Axis:
  0 ─────────────────────────────── Top (Sky)
  30 ─ Celestial bodies path
  50 ─ Cloud layer
  65 ─ Tree tops
  80 ─ Ground level
  120 ────────────────────────────── Bottom

X-Axis:
  0 ─ Left edge
  30 ─ First tree
  60 ─ Second tree
  100 ─ Center (campfire position)
  170 ─ Third tree
  200 ─ Right edge

Houses Grid:
  Row 1: Y=85 (ground level)
  Row 2: Y=73 (elevated)
  Row 3: Y=61 (elevated)
  Row 4: Y=49 (elevated)
  
  Columns: X=40, 65, 90, 115, 140 (5 per row)
```

---

## Performance Notes

### Render Triggers
Component re-renders when any prop changes:
- `daysElapsed` → Sky gradient recalculation
- `season` → Ground/tree colors, particles
- `population` → House count/style
- `stability` → Weather state
- `wealth` → Sparkle effects

### Optimization Tips
1. **Memoization**: Wrap with `React.memo` if parent re-renders frequently
2. **Prop Stability**: Ensure props don't change unnecessarily
3. **Animation Toggle**: Consider adding a "reduce motion" option
4. **Conditional Rendering**: Many elements only render when needed

### Element Counts
- Stars: 15 (night only)
- Rain drops: 20 (stormy only)
- Clouds: 5 ellipses (cloudy/stormy only)
- Houses: 0-20 (based on population)
- Trees: 3 (always)
- Sparkles: 8 (wealth > 500 only)
- Seasonal particles: 10-15 (varies by season)

---

## Integration Checklist

- [x] Import `EmpireScene` from `'./components'`
- [x] Place in right sidebar above `LogPanel`
- [x] Pass `daysElapsed` from `gameState.daysElapsed`
- [x] Pass `season` from `calendar.season`
- [x] Pass `population` from `gameState.population`
- [x] Pass `stability` from `gameState.stability`
- [x] Pass `wealth` from `gameState.resources.silver`
- [x] Ensure `calendar` is calculated with `getCalendarInfo()`

---

## Troubleshooting

### Issue: Sky not animating
**Solution:** Check that `daysElapsed` prop is updating

### Issue: Wrong season colors
**Solution:** Verify `calendar.season` matches: '春季', '夏季', '秋季', or '冬季'

### Issue: No houses showing
**Solution:** Check `population` prop is > 10

### Issue: Sparkles not appearing
**Solution:** Verify `wealth` (resources.silver) is > 500

### Issue: Weather not changing
**Solution:** Check `stability` prop is between 0-100

---

## Quick Test Props

```javascript
// Test Dawn + Spring + Campfire
<EmpireScene daysElapsed={0} season="春季" population={5} stability={100} wealth={50} />

// Test Day + Summer + Houses
<EmpireScene daysElapsed={25} season="夏季" population={50} stability={70} wealth={300} />

// Test Night + Autumn + Prosperous
<EmpireScene daysElapsed={75} season="秋季" population={120} stability={90} wealth={600} />

// Test Storm + Winter + Crisis
<EmpireScene daysElapsed={50} season="冬季" population={30} stability={20} wealth={100} />
```

---

**Quick Reference Version:** 1.0.0  
**Last Updated:** 2025-11-24
