## Task 26: SVG thin continuous field-line arrows with barbs

**Goal:** an alternative field-line rendering style — a single continuous thin line (not the
current per-arrow `THREE.ConeGeometry` markers spaced every `ARROW_SPACING` points) with
small arrow barbs drawn along it at intervals, SVG-sourced rather than canvas-path-drawn (the
existing `arrowStyles.js` chevron/skinny styles are canvas-drawn glyphs for the billboard
force-field arrows — this is a distinct ask, for field lines specifically, using SVG as the
source art).

**Approach — SVG path → canvas rasterize → texture, same non-dependency technique already
used for `arrowStyles.js`** (per the earlier answered WORK_ITEMS.md question: "SVG → Image →
drawImage onto a CanvasTexture, no library dependency needed"):
1. Author (or source) a simple arrow-barb SVG shape — a small chevron/barb, not a filled
   triangle — at a fixed viewBox size.
2. At overlay construction time, rasterize it once via `new Image()` + `img.src =
   'data:image/svg+xml;base64,' + btoa(svgString)` + `ctx.drawImage(img, ...)` onto an
   offscreen canvas, same as `billboardArrowOverlay.js`'s existing `makeArrowTexture`
   pattern — read that function first, mirror its shape.
3. Line itself: keep `THREE.Line`/`LineBasicMaterial` for the continuous thin line (already
   the case in `fieldLinesOverlay.js`), but replace the per-marker `ConeGeometry` mesh
   instances with small camera-facing billboard quads textured with the rasterized SVG barb
   (reuse `BillboardArrowOverlay`'s camera-facing quaternion math — `makeBasis`/
   `setFromRotationMatrix` — rather than re-deriving it).
4. Add as a THIRD `arrowStyle` choice (`'svg-barb'`) in `src/adapters/overlays/
   arrowStyles.js`'s `ARROW_STYLES` registry if reusing that switch, OR (recommended, since
   field lines currently have no style switch at all) add a new
   `displaySettings.fieldLineArrowStyle` (`SelectDisplayOption`, choices `['cone', 'svg-barb']`)
   specific to `fieldLinesOverlay.js` — don't conflate with the unrelated billboard force-field
   arrow style. Recommend the latter; note the choice in your report either way.

**Files:** `src/adapters/overlays/fieldLinesOverlay.js` (swap cone markers for SVG-barb
billboards when the style is `'svg-barb'`, keep `'cone'` as the existing default/fallback —
this is additive, not a replacement), `src/app/displaySettings.js` (+
`fieldLineArrowStyle`), `src/app/displayOptions.js` (+ `SelectDisplayOption` entry).

**Do NOT** add an SVG library/parser dependency — a hardcoded inline SVG string + native
`Image`/canvas rasterization only, per the existing no-dependency convention in this repo.

**Acceptance check:** `yarn test` passes, `yarn build` succeeds. `yarn dev`, toggle field
lines on, switch the new arrow-style control to `svg-barb`, confirm thin continuous lines
with small camera-facing barb markers render along each streamline (barbs still track camera
rotation, same as billboard arrows), switching back to `cone` restores the old look.

