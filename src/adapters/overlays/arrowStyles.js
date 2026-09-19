// Canvas-path drawing functions for the billboard arrow texture, keyed by
// style name. Each function draws a right-pointing arrow (shaft + head) into
// a 2D canvas context sized `size x size` — same signature/coordinate
// convention as the original inline drawing in billboardArrowOverlay.js.

/** Chevron: thin-ish shaft, simple solid filled triangle head. */
function drawChevron(ctx, size) {
  const midY = size / 2;
  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(size * 0.1, midY);
  ctx.lineTo(size * 0.68, midY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(size * 0.95, midY);
  ctx.lineTo(size * 0.58, midY - size * 0.22);
  ctx.lineTo(size * 0.58, midY + size * 0.22);
  ctx.closePath();
  ctx.fill();
}

/**
 * Skinny: thin shaft (2:1 shaft:head length ratio) and a fletched-arrow head
 * — barbs sweep backward past the head's own leading edge, with a concave
 * notch cut into the back, instead of a solid triangle.
 */
function drawSkinny(ctx, size) {
  const midY = size / 2;

  const shaftStartX = size * 0.05;
  const shaftEndX = size * 0.65; // shaft:head = 0.6 : 0.3 => 2:1
  const tipX = size * 0.95;
  const barbTipX = size * 0.48; // barbs sweep back past shaftEndX
  const barbSpreadY = size * 0.3;
  const notchX = size * 0.76; // concave centerline notch, pulled toward the tip

  ctx.strokeStyle = '#fff';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(shaftStartX, midY);
  ctx.lineTo(shaftEndX, midY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(tipX, midY);
  ctx.lineTo(barbTipX, midY - barbSpreadY);
  ctx.lineTo(notchX, midY);
  ctx.lineTo(barbTipX, midY + barbSpreadY);
  ctx.closePath();
  ctx.fill();
}

// Self-authored, trivial SVG markup (rounded-cap shaft + rounded-join
// chevron head) — no external asset, so no licensing question and no
// network fetch at build/runtime. Rasterized via SVG -> Image -> drawImage.
const SVG_ARROW_MARKUP =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<path d="M8,50 H62" stroke="#fff" stroke-width="10" stroke-linecap="round" fill="none"/>' +
  '<path d="M50,22 L92,50 L50,78" stroke="#fff" stroke-width="10" ' +
  'stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
  '</svg>';

let svgArrowImage = null;
let svgArrowImageReady = false;

/** Lazily kicks off the SVG->Image decode once; safe to call every frame. */
function getSvgArrowImage() {
  if (svgArrowImage || typeof Image === 'undefined') return svgArrowImage;
  const img = new Image();
  img.onload = () => {
    svgArrowImageReady = true;
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG_ARROW_MARKUP)}`;
  svgArrowImage = img;
  return img;
}

/**
 * Svg: rasterizes a self-authored SVG arrow icon onto the canvas
 * (SVG -> Image -> drawImage). Image decoding is asynchronous, so until the
 * first decode completes this falls back to drawChevron's shape rather than
 * leaving the texture blank.
 */
function drawSvg(ctx, size) {
  const img = getSvgArrowImage();
  if (img && svgArrowImageReady) {
    ctx.drawImage(img, 0, 0, size, size);
    return;
  }
  drawChevron(ctx, size);
}

export const ARROW_STYLES = {
  chevron: drawChevron,
  skinny: drawSkinny,
  svg: drawSvg,
};
