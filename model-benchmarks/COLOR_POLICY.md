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
| OpenAI | Luna | `#869ACB` | luna |
| OpenAI | Sol | `#3177D8` | sol, sol6, sol61 |
| OpenAI | Astra | `#097CCE` | astra |
| Google | Argon | `#34A853` | argon |
| SpaceXAI | Grok | `#5F39D0` | grok46, grok47 |

Faint to vibrant by size within a lab: Anthropic Haiku → Sonnet → Opus → Fable; OpenAI Luna → Terra → Sol → Astra; Google Flash → Pro → Argon. SpaceXAI is Grok only.

## Default chip selection

Default off on board load and board switch: `grok46`, `opus48`, `sol`, `sol6`, `fable`.

Everything else stays selected, including haiku55, opus55, sonnet55, sol61, grok47, argon, astra, luna. The All button still selects every model. Models stay in the snapshot and chip list when off.

## Placeholders (not plotted yet)

Reserved for future Benchy work. Same lab hue family; do not reuse a plotted line's hex for a new line.

| Lab | Line | Hex |
|-----|------|-----|
| Anthropic | Mythos | `#E1470E` (same as Fable; same model, not public) |
| OpenAI | Terra | `#5C85CC` |
| Google | Flash | `#7CC08E` |
| Google | Pro | `#4EBC6B` |
| Future lab | – | `#2E9E95` |
