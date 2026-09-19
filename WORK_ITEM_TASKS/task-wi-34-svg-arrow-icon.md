# task-wi-34: SVG arrow icon for billboard arrows

## Goal

Add a 3rd `ARROW_STYLES` entry in `src/adapters/overlays/arrowStyles.js` that renders an SVG arrow icon. This diversifies the billboard arrow glyph options beyond the current canvas-path-drawn chevron and skinny styles.

## Specification

### Implementation approach
- Source: Find a simple SVG arrow icon (public domain or CC0 preferred — avoid licensing complexity)
- Rendering: Rasterize the SVG onto the same CanvasTexture as the existing canvas-drawn styles (SVG → Image → drawImage)
- No new library dependencies required
- Signature: matches the existing `drawChevron(ctx, size)` / `drawSkinny(ctx, size)` pattern — function receives a 2D canvas context and a square size, draws a right-pointing arrow

### Integration
- Add the new drawing function to `src/adapters/overlays/arrowStyles.js` as a 3rd ARROW_STYLES entry
- Key name: `svg` (or a descriptive alternative, e.g., `outlined`, `styled`)
- Function must draw into the canvas context the same way the existing two do (fill + stroke into a right-pointing 2D arrow shape)

### Success criteria
1. SVG icon sourced and validated as suitable
2. Rasterization logic implemented (SVG → Image → ctx.drawImage into the canvas)
3. Arrow renders on the 3D view alongside chevron/skinny options
4. User can select it from the arrow-style dropdown in the force field / billboard arrows controls
5. `yarn test` passes
6. `yarn build` succeeds

## Files to touch
- `src/adapters/overlays/arrowStyles.js` — add the 3rd drawing function and export

## Acceptance check
- [ ] SVG arrow icon sourced
- [ ] Rasterization into canvas context working
- [ ] New style selectable in the UI dropdown
- [ ] Tests passing
- [ ] Build passing
