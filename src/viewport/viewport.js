// Center 3D viewport (Agent A).
//
// Contract:
//   mountViewport(el, store) — render the bodies + orbit trails in 3D.
//   Subscribe with store.onFrame((snapshot) => ...). Use
//   snapshot.relativeBodies(store.origin) to draw relative to the chosen frame,
//   and re-read the origin via store.onOriginChange(...).

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { displaySettings } from '../app/displaySettings.js';
import { mountDisplayControls } from './displayControls.js';
import { mountGravitationalPotentialPanel } from './gravitationalPotentialPanel.js';
import { mountDiscretizationPanel } from './discretizationPanel.js';
import { overlayRendererProvider } from '../provider/OverlayRendererProvider.js';

const TRAIL_LENGTH = 600;
const MIN_RADIUS = 0.15;
const MAX_RADIUS = 1.4;
const UNIFORM_RADIUS = (MIN_RADIUS + MAX_RADIUS) / 2;
// NLIPS (Non-Linear Inverse Perspective Scaling): apparent size grows with
// distance from the camera so far bodies don't shrink into invisibility.
// Perspective projection shrinks apparent size ~1/distance, so scaling the
// world-space radius linearly with distance counteracts that and keeps
// on-screen size roughly constant regardless of depth.
const NLIPS_K = 0.05;

// Sim coords (x,y,z) -> Three coords (x, z, -y). Keeps the orbital plane
// (sim x-y) flat on the ground in a Y-up Three world.
function toThree(v, out) {
  out.set(v[0], v[2], -v[1]);
  return out;
}

/** Loosely mass-scaled radius, log-compressed so a 100-mass star isn't 100x a 1-mass planet. */
function radiusForMass(mass) {
  const r = 0.25 + Math.log10(mass + 1) * 0.4;
  return THREE.MathUtils.clamp(r, MIN_RADIUS, MAX_RADIUS);
}

export function mountViewport(el, store) {
  el.innerHTML = '';
  el.style.position = el.style.position || 'relative';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d12);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 2000);
  camera.position.set(10, 8, 12);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  el.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(8, 15, 6);
  scene.add(sun);

  const grid = new THREE.GridHelper(40, 40, 0x2d3748, 0x1a1f2c);
  scene.add(grid);

  // --- Per-body render state ------------------------------------------------
  // entries: { mesh, trail: { line, geometry, positions:Float32Array, count } }
  let entries = [];
  let latestSnapshot = null;

  function disposeEntries() {
    for (const e of entries) {
      scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      scene.remove(e.trail.line);
      e.trail.geometry.dispose();
      e.trail.line.material.dispose();
    }
    entries = [];
  }

  function buildEntries() {
    disposeEntries();
    const bodies = store.sim.bodies;
    let maxMassIdx = 0;
    bodies.forEach((b, i) => {
      if (b.mass > bodies[maxMassIdx].mass) maxMassIdx = i;
    });

    entries = bodies.map((b, i) => {
      const color = new THREE.Color(b.color);
      const isCentral = i === maxMassIdx && bodies.length > 1;

      // Unit sphere: actual on-screen size is driven every frame via
      // mesh.scale (see render loop), so toggling massSize/nlips in
      // displaySettings takes effect immediately without rebuilding geometry.
      const geometry = new THREE.SphereGeometry(1, 24, 16);
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: isCentral ? color : 0x000000,
        emissiveIntensity: isCentral ? 0.7 : 0,
        roughness: 0.6,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      const positions = new Float32Array(TRAIL_LENGTH * 3);
      const trailGeometry = new THREE.BufferGeometry();
      trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      trailGeometry.setDrawRange(0, 0);
      const trailMaterial = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6 });
      const line = new THREE.Line(trailGeometry, trailMaterial);
      scene.add(line);

      return {
        mesh,
        trail: { line, geometry: trailGeometry, positions, count: 0 },
      };
    });
  }

  function clearTrails() {
    for (const e of entries) {
      e.trail.count = 0;
      e.trail.geometry.setDrawRange(0, 0);
    }
  }

  function pushTrailPoint(trail, x, y, z) {
    const { positions } = trail;
    if (trail.count < TRAIL_LENGTH) {
      const idx = trail.count * 3;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
      trail.count++;
    } else {
      positions.copyWithin(0, 3, TRAIL_LENGTH * 3);
      const idx = (TRAIL_LENGTH - 1) * 3;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
    }
    trail.geometry.attributes.position.needsUpdate = true;
    trail.geometry.setDrawRange(0, trail.count);
  }

  buildEntries();

  store.onFrame((snapshot) => {
    latestSnapshot = snapshot;
  });
  store.onOriginChange(() => {
    clearTrails();
  });
  store.onPresetChange(() => {
    buildEntries();
  });

  // --- Resize handling -------------------------------------------------------
  function resize() {
    const w = el.clientWidth || 1;
    const h = el.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(el);

  // Self-contained "Display ▾" popover — see displayControls.js.
  mountDisplayControls(el);
  // Dedicated potential-field panel, top-right so it doesn't collide with
  // the NLIPS pill/Display popover anchored top-left — see
  // gravitationalPotentialPanel.js.
  mountGravitationalPotentialPanel(el);
  // Shared shell-grid discretization panel, bottom-left so it doesn't
  // collide with the Display ▾ popover (top-left) or the gravitational
  // potential panel (top-right) — see discretizationPanel.js.
  mountDiscretizationPanel(el);

  const lagrangeOverlay = overlayRendererProvider.provideLagrangePointsOverlay(scene, (v) => toThree(v, new THREE.Vector3()));
  const forceFieldOverlay = overlayRendererProvider.provideForceFieldOverlay(scene, (v) => toThree(v, new THREE.Vector3()));
  const billboardArrowOverlay = overlayRendererProvider.provideBillboardArrowOverlay(scene, (v) => toThree(v, new THREE.Vector3()), camera);
  const potentialFieldOverlay = overlayRendererProvider.providePotentialFieldOverlay(scene, (v) => toThree(v, new THREE.Vector3()));
  const equipotentialLinesOverlay = overlayRendererProvider.provideEquipotentialLinesOverlay(scene, (v) => toThree(v, new THREE.Vector3()));
  const jacobiPotentialOverlay = overlayRendererProvider.provideJacobiPotentialOverlay(scene, (v) => toThree(v, new THREE.Vector3()));
  const fieldLinesOverlay = overlayRendererProvider.provideFieldLinesOverlay(scene, (v) => toThree(v, new THREE.Vector3()), camera);

  // --- Render loop -------------------------------------------------------
  const tmp = new THREE.Vector3();
  const spinAxisTmp = new THREE.Vector3();
  const spinQuaternion = new THREE.Quaternion();
  function render() {
    requestAnimationFrame(render);
    controls.update();

    if (latestSnapshot) {
      const relBodies = latestSnapshot.relativeBodies(store.origin);
      lagrangeOverlay.update(relBodies);
      forceFieldOverlay.update(relBodies);
      billboardArrowOverlay.update(relBodies);
      potentialFieldOverlay.update(relBodies);
      equipotentialLinesOverlay.update(relBodies);
      jacobiPotentialOverlay.update(relBodies);
      fieldLinesOverlay.update(relBodies);
      relBodies.forEach((b, i) => {
        const entry = entries[i];
        if (!entry) return;
        toThree(b.position, tmp);
        entry.mesh.position.copy(tmp);
        pushTrailPoint(entry.trail, tmp.x, tmp.y, tmp.z);

        // Kinematic spin: closed-form q(t) = axisAngle(spinAxis, spinRate*t)
        // — no accumulation error over long runs, decoupled from
        // Simulation.step() (point-mass gravity exerts zero torque about a
        // body's own center, so there's no differential equation to
        // integrate here). See .WORK_ITEMS/WORK_QUEUE.md's "Research: Rotational
        // bodies" entry.
        toThree(b.spinAxis, spinAxisTmp).normalize();
        spinQuaternion.setFromAxisAngle(spinAxisTmp, b.spinRate * latestSnapshot.time);
        entry.mesh.quaternion.copy(spinQuaternion);

        // Base radius from mass (read live so mass edits in the object
        // panel are reflected immediately) or a flat uniform radius,
        // depending on displaySettings.massSize.
        const liveMass = store.sim.bodies[i] ? store.sim.bodies[i].mass : b.mass;
        let effectiveRadius = displaySettings.massSize ? radiusForMass(liveMass) : UNIFORM_RADIUS;

        // NLIPS: grow world-space size ~linearly with camera distance so
        // apparent (on-screen) size stays roughly constant with depth,
        // counteracting perspective shrink. The star/most-massive body
        // still reads larger since this scales its (bigger) base radius too.
        if (displaySettings.nlips) {
          const distance = camera.position.distanceTo(entry.mesh.position);
          effectiveRadius *= 1 + NLIPS_K * distance;
        }

        entry.mesh.scale.setScalar(effectiveRadius);
      });
    }

    renderer.render(scene, camera);
  }
  render();
}
