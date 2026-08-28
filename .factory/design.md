# Photo Exit Bundle — visual thesis

## Direction: the archive crossing

The product uses **surreal editorial scenery** to turn an anxious, technical exit into a calm passage. A dark indigo sea holds an impossible paper causeway: loose photographs leave a cloud-shaped filing cabinet and arrive in a warm, labelled archive house. The scene explains the product—nothing is uploaded, originals cross intact, and uncertain items are visibly set aside—rather than decorating a generic hero.

The interface is a single focused workbench. Editorial typography and cut-paper illustration establish trust; compact ledger rows, ruled annotations, and stamped status lozenges make the converter feel precise. It deliberately avoids dashboard grids, glass effects, and gradient-led SaaS styling.

## Palette

- `night #17182B` — primary ink and the archive night sky.
- `paper #F6F0E3` — warm background, like an archival envelope.
- `sheet #FFFCF5` — elevated working surfaces.
- `cobalt #2947A9` — primary action and focus; dark enough for white text.
- `persimmon #A33B22` — editorial accent and attention marks; the darker ink keeps small labels AA on paper. The generated scene uses a lighter material interpretation inside the artwork only.
- `moss #32634A` — complete/paired state.
- `ochre #8A5B00` — review/warning state.
- `crimson #A52F38` — errors and missing items.
- `muted #62606A` — secondary copy on paper.
- Dark treatment: `#111322` canvas, `#1D2033` sheet, `#F6F0E3` text, `#BBB6AA` muted, with `#91A7FF` interactive accents.

All text and control combinations target WCAG AA (4.5:1); state is always named and never conveyed by colour alone.

## Type and spacing

- Display: Georgia, `Times New Roman`, serif. Its printed-editorial voice makes the exit feel like a deliberate archival act rather than a settings wizard.
- Interface/body: `Avenir Next`, Avenir, `Segoe UI`, system sans-serif. No network font dependency.
- Scale: 14 / 16 / 20 / 28 / clamp(42–72) px. Body is never below 16 px.
- Rhythm: an 8 px base with 4 px for micro-alignment; main gaps are 16, 24, 32, 48, 72 px. Reading measure tops out near 68 characters.
- Corners are restrained (4–14 px) and paired with 1.5 px ink rules. Shadows look like displaced paper, not floating glass.

## Interaction grammar

The archive journey has four numbered stations: choose, inspect, decide, build. The current station is announced in a persistent progress rail; completed stations receive a plain-language stamp. The primary action sits with the state it changes. Files appear as ledger rows, while decisions use labelled toggles and checkboxes with 44 px targets. The phone layout drops the decorative scene after selection and stacks the ledger above its action bar.

Keyboard and screen-reader users follow the same station order. File selection is a real labelled input, links remain links, progress uses native progress semantics, errors are announced, and focus uses a 3 px cobalt/cream double ring.

## Motion policy

On entry, the illustration and workbench settle into place with a 240 ms transform/opacity transition. Station changes use a 180 ms opacity transition; progress fills from its prior value. Nothing loops. With `prefers-reduced-motion: reduce`, transforms and smooth scrolling are removed and state changes are instant. Depth remains through scale, overlap, rules, and paper shadows.

## Asset plan and provenance

### `archive-crossing-hero`

- Purpose: hero explanation and empty-state reassurance.
- Use case: `stylized-concept`; wide editorial landing-page illustration.
- Prompt: “Surreal editorial cut-paper illustration of a family photo archive crossing at night: an impossible narrow paper causeway spans a calm deep-indigo sea. On the left, a cloud-shaped filing cabinet releases a small orderly ribbon of unlabeled instant photographs and one tiny film strip; on the right, they arrive at a warmly lit cream archive house with neat date drawers. One single red-orange photograph waits visibly on a small review island. Sophisticated magazine composition, tactile deckled paper, subtle grain, screen-print edges, navy, warm cream, muted cobalt, persimmon and moss palette, gentle overhead moonlight, wide landscape framing, useful negative space, no people, no screens. No text, no letters, no numbers, no logos, no brands, no watermark, no UI.”
- Generator: Factory Azure image deployment via `/opt/fleet/lib/gen-image.sh` (OpenAI image model), generated 2026-08-28.
- License/provenance: original AI-generated artwork for this product; no input artwork, brands, real people, or copyrighted characters.
- Delivery: source PNG retained under `assets/src/` with prompt sidecar; responsive WebP derivatives under `public/art/`, each hero candidate visually reviewed for text artifacts, seams, brands, and misleading UI.

Icons and marks are hand-authored inline SVG using simple archive/photo geometry. They are product UI, not generated imagery. The footer discloses the generated hero artwork.
