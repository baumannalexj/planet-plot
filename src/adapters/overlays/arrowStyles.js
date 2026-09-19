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

export const ARROW_STYLES = {
  chevron: drawChevron,
  skinny: drawSkinny,
};
