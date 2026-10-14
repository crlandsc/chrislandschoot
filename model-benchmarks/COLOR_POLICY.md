# Model-benchmarks color and default-selection policy

Chris-approved Option A: one hex per product line. Versions of the same line share a hex. Markers still distinguish versions. Do not invent a second palette.

Live source of truth for plotted models: `data/live-cost-vs-score-latest.json` → `style.colors`.

## Current lines (plotted)

| Lab | Line | Hex | Model IDs |
|-----|------|-----|-----------|
| Anthropic | Haiku | `#DE9A72` | haiku55 |
| Anthropic | Sonnet | `#D67551` | sonnet55 |
| Anthropic | Opus | `#E45825` | opus48, opus55 |
| Anthropic | Fable | `#E1470E` | fable |
| OpenAI | Luna | `#949494` (dark mode `#8A8A8A`) | luna |
| OpenAI | Sol | `#4A4A4A` (dark mode `#CFCFCF`) | sol6, sol61 |
| OpenAI | Astra | `#1A1A1A` (dark mode `#F0F0F0`) | astra |
| Google | Argon | `#34A853` | argon |
| SpaceXAI | Grok | `#5F39D0` | grok47 |
| Meta | Muse Spark | `#869ACB` | musespark13 |
| Meta | Muse Wonder | `#3177D8` | musewonder |

Why: lab families sit closer to the real company colors. Meta's Muse line takes the blues OpenAI used before (Spark, the smaller line, gets the fainter blue). OpenAI moves to a black and gray family.

Dark mode: `app.js` `DARK_COLOR_OVERRIDES` swaps the OpenAI grays (keyed by light hex) for light grays on the dark theme, keeping the size order, and re-renders chips and chart on theme toggle. JSON `style.colors` stays the light-mode source of truth. WCAG contrast vs plot background (light `#FFFFFF` / dark `#121212`): Luna 3.03 / 5.43, Terra 5.10 / 8.16, Sol 8.86 / 12.02, Astra 17.40 / 16.44.

Faint to vibrant by size within a lab: Anthropic Haiku → Sonnet → Opus → Fable; OpenAI Luna → Terra → Sol → Astra (light gray to near-black; reversed to dim-to-bright light grays in dark mode); Google Flash → Pro → Argon; Meta Muse Spark → Muse Wonder. SpaceXAI is Grok only.

## Default chip selection

Default off on board load and board switch: `opus48`, `sol6`, `fable`.

Retired 2026-10-14 (removed from data, chips and defaults): GPT-5.6 Sol (`sol`) and Grok 4.6 (`grok46`).

Everything else stays selected, including haiku55, opus55, sonnet55, sol61, grok47, argon, astra, luna, musespark13, musewonder. The All button still selects every model. Models stay in the snapshot and chip list when off.

## Placeholders (not plotted yet)

Reserved for future Benchy work. Same lab hue family; do not reuse a plotted line's hex for a new line.

| Lab | Line | Hex |
|-----|------|-----|
| Anthropic | Mythos | `#E1470E` (same as Fable; same model, not public) |
| OpenAI | Terra | `#6E6E6E` (dark mode `#ABABAB`) |
| Google | Flash | `#7CC08E` |
| Google | Pro | `#4EBC6B` |
| Meta | Muse Wonder Full, older Muse models | not plotted (Wonder Full is uncosted on AA) |
| Future lab | – | `#2E9E95` |
