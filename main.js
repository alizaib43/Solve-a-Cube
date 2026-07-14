'use strict';
/* =========================================================
   CubeRush — main.js
   Three.js r158 + GSAP 3.12
   ========================================================= */

// ── Colors ────────────────────────────────────────────────
const COLOR = {
  U: 0xffffff, // White  – top
  D: 0xffcf00, // Yellow – bottom
  F: 0x00aa44, // Green  – front  (+Z)
  B: 0x0044cc, // Blue   – back   (–Z)
  R: 0xdd1111, // Red    – right  (+X)
  L: 0xff7700, // Orange – left   (–X)
  INNER: 0x111118,
};

const STICKER_GAP   = 0.87;  // sticker face size
const STICKER_RAISE = 0.503; // distance from cubie centre

// ── Scene & Renderer ──────────────────────────────────────
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200);
camera.position.set(5, 4, 7);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ── Lighting ──────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.55));

const sun = new THREE.DirectionalLight(0xffffff, 1.1);
sun.position.set(6, 8, 5);
sun.castShadow = true;
scene.add(sun);

const fillLight = new THREE.DirectionalLight(0x4455ff, 0.4);
fillLight.position.set(-5, -3, -5);
scene.add(fillLight);

const accentPoint = new THREE.PointLight(0x7c3aed, 1.2, 20);
accentPoint.position.set(0, 4, 0);
scene.add(accentPoint);

// ── Particles ─────────────────────────────────────────────
(function buildParticles() {
  const N = 900;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const palette = [[0.48,0.23,0.93],[0.31,0.27,0.94],[0.08,0.72,0.84],[0.06,0.73,0.52]];
  for (let i = 0; i < N; i++) {
    const r = 14 + Math.random() * 28;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
    pos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
    pos[i*3+2] = r * Math.cos(ph);
    const c = palette[Math.floor(Math.random() * palette.length)];
    col[i*3]=c[0]; col[i*3+1]=c[1]; col[i*3+2]=c[2];
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size:0.1, vertexColors:true, transparent:true, opacity:.65 });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  // slow spin
  gsap.to(pts.rotation, { y: Math.PI*2, duration:80, repeat:-1, ease:'none' });
  gsap.to(pts.rotation, { x: Math.PI,   duration:120, repeat:-1, ease:'none', yoyo:true });
})();



// ── Cube ──────────────────────────────────────────────────
class RubiksCube {
  constructor() {
    this.root      = new THREE.Group();
    this.cubies    = [];        // array of cubie objects
    this.stickerMeshes = [];    // all sticker meshes for raycasting
    this.meshMap   = new Map(); // mesh → cubie
    this.isAnimating = false;
    this.queue     = [];
    this.history   = [];        // undo stack {axis,layer,dir}
    scene.add(this.root);
    this._build();
  }

  _build() {
    for (let x=-1; x<=1; x++)
    for (let y=-1; y<=1; y++)
    for (let z=-1; z<=1; z++) {
      if (x===0 && y===0 && z===0) continue;
      const c = this._makeCubie(x,y,z);
      this.cubies.push(c);
      this.root.add(c.grp);
    }
  }

  _makeCubie(x,y,z) {
    const grp = new THREE.Group();
    grp.position.set(x,y,z);

    // Black base
    const bGeo = new THREE.BoxGeometry(.93,.93,.93);
    const bMat = new THREE.MeshStandardMaterial({
      color: COLOR.INNER, roughness:.7, metalness:.15
    });
    grp.add(new THREE.Mesh(bGeo, bMat));

    const stickers = [];

    const addSticker = (pos, euler, colorHex) => {
      const geo = new THREE.PlaneGeometry(STICKER_GAP, STICKER_GAP);
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex, roughness:.25, metalness:.05, side: THREE.FrontSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.rotation.copy(euler);
      grp.add(mesh);
      this.stickerMeshes.push(mesh);
      const sticker = { mesh, mat, colorHex };
      this.meshMap.set(mesh, { grp, sticker, allStickers: stickers });
      stickers.push(sticker);
    };

    const O = STICKER_RAISE;
    if (y===  1) addSticker(new THREE.Vector3(0, O,0), new THREE.Euler(-Math.PI/2,0,0), COLOR.U);
    if (y=== -1) addSticker(new THREE.Vector3(0,-O,0), new THREE.Euler( Math.PI/2,0,0), COLOR.D);
    if (z===  1) addSticker(new THREE.Vector3(0,0, O), new THREE.Euler(0,0,0),          COLOR.F);
    if (z=== -1) addSticker(new THREE.Vector3(0,0,-O), new THREE.Euler(0,Math.PI,0),    COLOR.B);
    if (x===  1) addSticker(new THREE.Vector3( O,0,0), new THREE.Euler(0, Math.PI/2,0), COLOR.R);
    if (x=== -1) addSticker(new THREE.Vector3(-O,0,0), new THREE.Euler(0,-Math.PI/2,0), COLOR.L);

    return { grp, stickers };
  }

  // axis:'x'|'y'|'z', layer:-1|0|1, dir:+1|-1
  rotate(axis, layer, dir, { record=true, silent=false }={}) {
    if (this.isAnimating) {
      this.queue.push({ axis, layer, dir, record, silent });
      return;
    }
    this.isAnimating = true;
    if (record) this.history.push({ axis, layer, dir });

    const axVec = new THREE.Vector3(
      axis==='x'?1:0, axis==='y'?1:0, axis==='z'?1:0
    );
    const targetAngle = dir * Math.PI / 2;

    // Gather cubies in this layer
    const slice = this.cubies.filter(c =>
      Math.round(c.grp.position[axis]) === layer
    );

    // Build pivot
    const pivot = new THREE.Group();
    this.root.add(pivot);
    for (const c of slice) {
      pivot.add(c.grp);
    }

    // Animate
    const anim = { a: 0 };
    gsap.to(anim, {
      a: targetAngle,
      duration: 0.22,
      ease: 'power2.out',
      onUpdate: () => pivot.setRotationFromAxisAngle(axVec, anim.a),
      onComplete: () => {
        pivot.updateMatrixWorld(true);
        for (const c of slice) {
          this.root.attach(c.grp);
          c.grp.position.x = Math.round(c.grp.position.x);
          c.grp.position.y = Math.round(c.grp.position.y);
          c.grp.position.z = Math.round(c.grp.position.z);
          snapCubieRotation(c.grp);
        }
        this.root.remove(pivot);
        this.isAnimating = false;

        if (this.queue.length > 0) {
          const next = this.queue.shift();
          this.rotate(next.axis, next.layer, next.dir,
            { record: next.record, silent: next.silent });
        } else if (!silent) {
          onQueueEmpty();
        }
      }
    });
  }

  undo() {
    if (this.history.length === 0) { showToast('Nothing to undo'); return; }
    const m = this.history.pop();
    this.rotate(m.axis, m.layer, -m.dir, { record: false });
    moveCount = Math.max(0, moveCount - 1);
    updateMoveCount();
  }

  scramble(n=20) {
    const axes = ['x','y','z'], layers = [-1,0,1], dirs = [1,-1];
    let lastAxis='', lastLayer=99;
    for (let i=0; i<n; i++) {
      let ax, ly;
      do {
        ax = axes[Math.floor(Math.random()*3)];
        ly = layers[Math.floor(Math.random()*3)];
      } while (ax===lastAxis && ly===lastLayer);
      const d = dirs[Math.floor(Math.random()*2)];
      lastAxis=ax; lastLayer=ly;
      this.queue.push({ axis:ax, layer:ly, dir:d, record:false, silent:true });
    }
    // Mark last move as non-silent so we know when done
    if (this.queue.length > 0) this.queue[this.queue.length-1].silent = false;
    if (!this.isAnimating) {
      const first = this.queue.shift();
      this.rotate(first.axis, first.layer, first.dir, { record:false, silent:first.silent });
    }
  }

  reset() {
    // Kill any running animation queue
    gsap.globalTimeline.clear();
    gsap.killTweensOf(this.root.rotation);
    this.root.rotation.set(0, 0, 0);

    this.queue     = [];
    this.history   = [];
    this.isAnimating = false;

    // Completely clear root of all children (including any temporary pivots)
    while (this.root.children.length > 0) {
      this.root.remove(this.root.children[0]);
    }

    this.cubies       = [];
    this.stickerMeshes = [];
    this.meshMap      = new Map();
    this._build();
  }

  isSolved() {
    const buckets = new Map([
      ['+x',[]],['-x',[]],['+y',[]],['-y',[]],['+z',[]],['-z',[]]
    ]);
    const dirs = [
      [new THREE.Vector3(1,0,0), '+x'], [new THREE.Vector3(-1,0,0),'-x'],
      [new THREE.Vector3(0,1,0), '+y'], [new THREE.Vector3(0,-1,0),'-y'],
      [new THREE.Vector3(0,0,1), '+z'], [new THREE.Vector3(0,0,-1),'-z'],
    ];
    const nm = new THREE.Matrix3();
    const wn = new THREE.Vector3();
    const frontLocal = new THREE.Vector3(0,0,1);

    for (const c of this.cubies) {
      for (const s of c.stickers) {
        s.mesh.updateMatrixWorld(true);
        wn.copy(frontLocal).applyMatrix3(nm.getNormalMatrix(s.mesh.matrixWorld)).normalize();
        let best=-Infinity, key='';
        for (const [v,k] of dirs) {
          const d = wn.dot(v);
          if (d>best) { best=d; key=k; }
        }
        buckets.get(key).push(s.colorHex);
      }
    }
    for (const [,colors] of buckets) {
      if (colors.length !== 9) return false;
      if (!colors.every(c=>c===colors[0])) return false;
    }
    return true;
  }
}

// Helper to snap cubie rotation to the nearest orthogonal orientation
function snapCubieRotation(cubieGrp) {
  cubieGrp.updateMatrix();
  const m = new THREE.Matrix4().copy(cubieGrp.matrix);
  
  const x = new THREE.Vector3(m.elements[0], m.elements[1], m.elements[2]).normalize();
  const y = new THREE.Vector3(m.elements[4], m.elements[5], m.elements[6]).normalize();

  const directions = [
    new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)
  ];

  const snapVector = (v) => {
    let maxDot = -Infinity;
    let bestDir = directions[0];
    for (const d of directions) {
      const dot = v.dot(d);
      if (dot > maxDot) {
        maxDot = dot;
        bestDir = d;
      }
    }
    return bestDir;
  };

  const newX = snapVector(x);
  
  let newY = null;
  let maxDotY = -Infinity;
  for (const d of directions) {
    if (Math.abs(d.dot(newX)) > 0.1) continue;
    const dot = y.dot(d);
    if (dot > maxDotY) {
      maxDotY = dot;
      newY = d;
    }
  }

  const newZ = new THREE.Vector3().crossVectors(newX, newY).normalize();

  m.elements[0] = newX.x; m.elements[1] = newX.y; m.elements[2] = newX.z;
  m.elements[4] = newY.x; m.elements[5] = newY.y; m.elements[6] = newY.z;
  m.elements[8] = newZ.x; m.elements[9] = newZ.y; m.elements[10] = newZ.z;

  cubieGrp.setRotationFromMatrix(m);
}

// Maps clicked face local normal + local drag direction → Rubik's layer rotation parameters
function getDragParams(localNormal, localDrag, pos) {
  const nx = Math.round(localNormal.x);
  const ny = Math.round(localNormal.y);
  const nz = Math.round(localNormal.z);

  let axis = 'x';
  let layer = 0;
  let dir = 1;

  if (nz === 1) { // Front (+Z)
    if (Math.abs(localDrag.x) > Math.abs(localDrag.y)) {
      axis = 'y'; layer = Math.round(pos.y);
      dir = -Math.sign(localDrag.x) * (layer === -1 ? -1 : 1);
    } else {
      axis = 'x'; layer = Math.round(pos.x);
      dir = -Math.sign(localDrag.y);
    }
  } else if (nz === -1) { // Back (-Z)
    if (Math.abs(localDrag.x) > Math.abs(localDrag.y)) {
      axis = 'y'; layer = Math.round(pos.y);
      dir = Math.sign(localDrag.x) * (layer === -1 ? -1 : 1);
    } else {
      axis = 'x'; layer = Math.round(pos.x);
      dir = Math.sign(localDrag.y);
    }
  } else if (nx === 1) { // Right (+X)
    if (Math.abs(localDrag.z) > Math.abs(localDrag.y)) {
      axis = 'y'; layer = Math.round(pos.y);
      dir = Math.sign(localDrag.z) * (layer === -1 ? -1 : 1);
    } else {
      axis = 'z'; layer = Math.round(pos.z);
      dir = Math.sign(localDrag.y);
    }
  } else if (nx === -1) { // Left (-X)
    if (Math.abs(localDrag.z) > Math.abs(localDrag.y)) {
      axis = 'y'; layer = Math.round(pos.y);
      dir = -Math.sign(localDrag.z) * (layer === -1 ? -1 : 1);
    } else {
      axis = 'z'; layer = Math.round(pos.z);
      dir = -Math.sign(localDrag.y);
    }
  } else if (ny === 1) { // Top (+Y)
    if (Math.abs(localDrag.x) > Math.abs(localDrag.z)) {
      axis = 'z'; layer = Math.round(pos.z);
      dir = -Math.sign(localDrag.x);
    } else {
      axis = 'x'; layer = Math.round(pos.x);
      dir = Math.sign(localDrag.z);
    }
  } else if (ny === -1) { // Bottom (-Y)
    if (Math.abs(localDrag.x) > Math.abs(localDrag.z)) {
      axis = 'z'; layer = Math.round(pos.z);
      dir = Math.sign(localDrag.x);
    } else {
      axis = 'x'; layer = Math.round(pos.x);
      dir = -Math.sign(localDrag.z);
    }
  }

  if (dir === 0) dir = 1;

  return { axis, layer, dir };
}

// ── Orbit Camera ──────────────────────────────────────────
const orbit = (() => {
  const state = {
    active: false,
    sx: 0, sy: 0,
    theta: Math.atan2(5,7),       // ~0.62
    phi:   Math.atan2(Math.sqrt(25+49),4), // ~1.14
    radius: Math.sqrt(25+16+49),  // ~9.49
  };
  function applyOrbit() {
    state.phi = Math.max(.15, Math.min(Math.PI-.15, state.phi));
    camera.position.x = state.radius * Math.sin(state.phi)*Math.sin(state.theta);
    camera.position.y = state.radius * Math.cos(state.phi);
    camera.position.z = state.radius * Math.sin(state.phi)*Math.cos(state.theta);
    camera.lookAt(0,0,0);
  }
  function pan(dx,dy) {
    state.theta -= dx * 0.012;
    state.phi   -= dy * 0.012;
    applyOrbit();
  }
  function zoom(delta) {
    state.radius = Math.max(5, Math.min(18, state.radius + delta));
    applyOrbit();
  }
  return { state, pan, zoom, applyOrbit };
})();

// ── Drag Controls ─────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse2    = new THREE.Vector2();

let dragState   = null; // face drag in progress
let orbitActive = false;
let orbitStart  = { x:0, y:0 };
let hoveredMesh = null;

const cube = new RubiksCube();

function toNDC(clientX, clientY) {
  return new THREE.Vector2(
    (clientX / innerWidth)  *  2 - 1,
    (clientY / innerHeight) * -2 + 1
  );
}

function getHit(clientX, clientY) {
  raycaster.setFromCamera(toNDC(clientX,clientY), camera);
  const hits = raycaster.intersectObjects(cube.stickerMeshes);
  return hits.length > 0 ? hits[0] : null;
}

function onPointerDown(clientX, clientY) {
  if (cube.isAnimating) return;

  // Auto-close open panels on mobile when interacting with the cube
  if (window.innerWidth <= 768) {
    document.getElementById('controls-panel').classList.remove('open');
    document.getElementById('records-panel').classList.remove('open');
  }

  const hit = getHit(clientX, clientY);
  if (hit) {
    // Start face drag
    const nm = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
    const wn = hit.face.normal.clone().applyMatrix3(nm).normalize();
    // Transform normal from world space to cube root local space
    const ln = wn.clone().applyQuaternion(cube.root.quaternion.clone().invert()).normalize();
    const info = cube.meshMap.get(hit.object);
    dragState = {
      started: false,
      sx: clientX, sy: clientY,
      localNormal: ln,
      cubieGrp: info.grp,
    };
  } else {
    orbitActive = true;
    orbitStart  = { x: clientX, y: clientY };
  }
}

function onPointerMove(clientX, clientY) {
  // Hover highlight
  if (!dragState && !orbitActive) {
    const hit = getHit(clientX, clientY);
    const newMesh = hit ? hit.object : null;
    if (newMesh !== hoveredMesh) {
      if (hoveredMesh) hoveredMesh.material.emissive.setHex(0x000000);
      if (newMesh)     newMesh.material.emissive.setHex(0x222222);
      hoveredMesh = newMesh;
      renderer.domElement.style.cursor = newMesh ? 'grab' : 'default';
    }
  }

  if (dragState && !dragState.started) {
    const dx = clientX - dragState.sx;
    const dy = clientY - dragState.sy;
    if (Math.hypot(dx,dy) > 14) {
      dragState.started = true;
      executeDrag(dx, dy);
      dragState = null;
    }
  }

  if (orbitActive) {
    const dx = clientX - orbitStart.x;
    const dy = clientY - orbitStart.y;
    orbitStart = { x:clientX, y:clientY };
    orbit.pan(dx, dy);
  }
}

function onPointerUp() {
  dragState   = null;
  orbitActive = false;
  renderer.domElement.style.cursor = 'default';
}

// Convert screen drag → local rotation in cube root space
function executeDrag(dx, dy) {
  const ln  = dragState.localNormal;   // local-space face normal
  const pos = dragState.cubieGrp.position; // local-space cubie position

  // Camera basis in world space
  const fwd   = new THREE.Vector3(); camera.getWorldDirection(fwd);
  const right = new THREE.Vector3().crossVectors(fwd, camera.up).normalize();
  const up    = new THREE.Vector3().crossVectors(right, fwd).normalize();

  // World-space drag
  const worldDrag = right.clone().multiplyScalar(dx).addScaledVector(up, -dy);
  // Transform world drag to cube root local space
  const localDrag = worldDrag.clone().applyQuaternion(cube.root.quaternion.clone().invert());

  const { axis, layer, dir } = getDragParams(ln, localDrag, pos);

  cube.rotate(axis, layer, dir);
  onUserMove();
}

// ── Mouse Events ──────────────────────────────────────────
renderer.domElement.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  onPointerDown(e.clientX, e.clientY);
});
renderer.domElement.addEventListener('mousemove', e => {
  onPointerMove(e.clientX, e.clientY);
});
renderer.domElement.addEventListener('mouseup', () => onPointerUp());
renderer.domElement.addEventListener('mouseleave', () => onPointerUp());
renderer.domElement.addEventListener('wheel', e => {
  orbit.zoom(e.deltaY * 0.008);
}, { passive: true });

// ── Touch Events ──────────────────────────────────────────
let pinchStartDist   = 0;
let pinchStartRadius = 0;

renderer.domElement.addEventListener('touchstart', e => {
  e.preventDefault();
  if (e.touches.length === 1) {
    onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
  } else if (e.touches.length === 2) {
    dragState   = null;
    orbitActive = false;
    pinchStartDist   = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    pinchStartRadius = orbit.state.radius;
  }
}, { passive:false });

renderer.domElement.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length === 1) {
    onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
  } else if (e.touches.length === 2) {
    const d = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    const scale = pinchStartDist / Math.max(d, 1);
    orbit.state.radius = Math.max(5, Math.min(18, pinchStartRadius * scale));
    orbit.applyOrbit();
  }
}, { passive:false });

renderer.domElement.addEventListener('touchend',   () => onPointerUp());
renderer.domElement.addEventListener('touchcancel',() => onPointerUp());

// ── Timer ─────────────────────────────────────────────────
let timerRunning = false;
let timerStart   = 0;
let timerElapsed = 0;
let timerTick    = null;

function fmtTime(ms) {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const cs  = Math.floor((ms % 1000) / 10);
  return `${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
}

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  timerStart   = Date.now() - timerElapsed;
  const el = document.getElementById('timer-value');
  el.classList.add('running');
  timerTick = setInterval(() => {
    timerElapsed = Date.now() - timerStart;
    el.textContent = fmtTime(timerElapsed);
  }, 33);
}

function stopTimer() {
  if (!timerRunning) return;
  timerRunning = false;
  clearInterval(timerTick);
  timerElapsed = Date.now() - timerStart;
  document.getElementById('timer-value').classList.remove('running');
  document.getElementById('timer-value').textContent = fmtTime(timerElapsed);
}

function resetTimer() {
  stopTimer();
  timerElapsed = 0;
  document.getElementById('timer-value').textContent = '00:00.00';
}

// ── Records ───────────────────────────────────────────────
let bestMs      = null;
let sessions    = []; // [{ms,moves}] newest first

function loadBest() {
  const s = localStorage.getItem('cuberush-best');
  if (s) { bestMs = parseInt(s,10); syncBestUI(); }
}

function saveBest(ms) {
  localStorage.setItem('cuberush-best', ms);
  bestMs = ms; syncBestUI();
}

function syncBestUI() {
  const txt = bestMs !== null ? fmtTime(bestMs) : '--:--.-';
  document.getElementById('header-best').textContent  = txt;
  document.getElementById('best-time-big').textContent = txt;
}

function loadSessions() {
  const s = localStorage.getItem('cuberush-sessions');
  if (s) {
    try {
      sessions = JSON.parse(s);
    } catch (e) {
      sessions = [];
    }
  }
}

function saveSessions() {
  localStorage.setItem('cuberush-sessions', JSON.stringify(sessions));
}

function calculateAverage(n) {
  if (sessions.length < n) return null;
  const lastN = sessions.slice(0, n).map(s => s.ms);
  lastN.sort((a, b) => a - b);
  // Remove best and worst
  const trimmed = lastN.slice(1, -1);
  const sum = trimmed.reduce((a, b) => a + b, 0);
  return sum / trimmed.length;
}

function updateAverages() {
  const ao5 = calculateAverage(5);
  const ao12 = calculateAverage(12);
  document.getElementById('val-ao5').textContent = ao5 !== null ? fmtTime(ao5) : '--:--.-';
  document.getElementById('val-ao12').textContent = ao12 !== null ? fmtTime(ao12) : '--:--.-';
}

function addSession(ms, moves) {
  sessions.unshift({ ms, moves });
  if (sessions.length > 100) sessions.pop();
  saveSessions();
  renderRecords();
  updateAverages();
}

function renderRecords() {
  const list = document.getElementById('records-list');
  if (sessions.length === 0) {
    list.innerHTML = '<div class="no-records">No solves yet.<br>Scramble &amp; solve!</div>';
    return;
  }
  list.innerHTML = sessions.map((r, i) => `
    <div class="record-row">
      <span class="rec-rank ${i===0?'gold':''}">${i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`}</span>
      <span class="rec-time">${fmtTime(r.ms)}</span>
      <span class="rec-moves">${r.moves}mv</span>
    </div>
  `).join('');
}

// ── Move Counter ──────────────────────────────────────────
let moveCount = 0;

function updateMoveCount() {
  document.getElementById('move-counter').textContent = moveCount;
}

// ── Game State ────────────────────────────────────────────
let inSolveMode   = false; // true after scramble finished
let scrambleComplete = false;

function onQueueEmpty() {
  if (!inSolveMode) {
    // Scramble just finished
    inSolveMode      = true;
    scrambleComplete = true;
    showToast('🎲 Scrambled! Start solving!', '');
    return;
  }
  // Check solve after user moves
  if (timerRunning && cube.isSolved()) {
    stopTimer();
    onSolved();
  }
}

function onUserMove() {
  if (!inSolveMode) return;
  startTimer();
  moveCount++;
  updateMoveCount();
}

function onSolved() {
  const elapsed = timerElapsed;
  const isNew   = bestMs === null || elapsed < bestMs;
  if (isNew) saveBest(elapsed);
  addSession(elapsed, moveCount);

  document.getElementById('modal-time-val').textContent  = fmtTime(elapsed);
  document.getElementById('modal-sub-text').textContent  = isNew ? '🏆 New Personal Best!' : `Best: ${fmtTime(bestMs)}`;
  document.getElementById('modal-moves-text').textContent = `Solved in ${moveCount} moves`;

  setTimeout(() => {
    document.getElementById('solve-modal').classList.remove('hidden');
  }, 600);
  showToast('✨ Cube solved!', 'success');
}

function doScramble() {
  inSolveMode   = false;
  scrambleComplete = false;
  cube.reset();
  resetTimer();
  resetIdleTimer();
  moveCount = 0; updateMoveCount();
  gsap.fromTo(document.getElementById('canvas-container'),
    { opacity:.6 }, { opacity:1, duration:.5 });
  cube.scramble(22);
}

function doReset() {
  inSolveMode = false;
  cube.reset();
  resetTimer();
  resetIdleTimer();
  moveCount = 0; updateMoveCount();
  showToast('Cube reset to solved state');
}

// ── Toast ─────────────────────────────────────────────────
function showToast(msg, cls='') {
  const area  = document.getElementById('toast-area');
  const toast = document.createElement('div');
  toast.className = 'toast' + (cls ? ' '+cls : '');
  toast.textContent = msg;
  area.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

// ── UI Wiring ─────────────────────────────────────────────
document.querySelectorAll('.move-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const axis  = btn.dataset.axis;
    const layer = parseInt(btn.dataset.layer, 10);
    const dir   = parseInt(btn.dataset.dir,   10);
    cube.rotate(axis, layer, dir);
    onUserMove();
  });
});

document.getElementById('btn-scramble').addEventListener('click', doScramble);
document.getElementById('btn-reset').addEventListener('click', doReset);
document.getElementById('btn-undo').addEventListener('click', () => cube.undo());

document.getElementById('modal-play-again').addEventListener('click', () => {
  document.getElementById('solve-modal').classList.add('hidden');
  doScramble();
});
document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('solve-modal').classList.add('hidden');
});

document.getElementById('close-hint').addEventListener('click', () => {
  const bar = document.getElementById('hint-bar');
  bar.style.opacity = '0';
  setTimeout(() => bar.style.display='none', 400);
});
setTimeout(() => {
  const bar = document.getElementById('hint-bar');
  if (bar) { bar.style.opacity='0'; setTimeout(()=>bar.style.display='none',400); }
}, 6000);

document.getElementById('btn-hint').addEventListener('click', () => {
  const bar = document.getElementById('hint-bar');
  bar.style.display = '';
  bar.style.opacity = '1';
  setTimeout(() => { bar.style.opacity='0'; setTimeout(()=>bar.style.display='none',400); }, 4000);
});

// Mobile panel toggle wiring
const controlsPanel = document.getElementById('controls-panel');
const recordsPanel = document.getElementById('records-panel');

document.getElementById('btn-toggle-moves').addEventListener('click', (e) => {
  e.stopPropagation();
  controlsPanel.classList.toggle('open');
  recordsPanel.classList.remove('open');
});

document.getElementById('btn-toggle-stats').addEventListener('click', (e) => {
  e.stopPropagation();
  recordsPanel.classList.toggle('open');
  controlsPanel.classList.remove('open');
});

document.getElementById('close-controls').addEventListener('click', () => {
  controlsPanel.classList.remove('open');
});

document.getElementById('close-records').addEventListener('click', () => {
  recordsPanel.classList.remove('open');
});

// ── Idle auto-breathe ─────────────────────────────────────
let idleTimer = null;
function resetIdleTimer() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    // Gentle Y-rotation when truly idle
    gsap.to(cube.root.rotation, {
      y: cube.root.rotation.y + Math.PI*2,
      duration: 24, ease:'none', repeat:-1, overwrite:true
    });
  }, 8000);
}
renderer.domElement.addEventListener('mousedown', () => {
  gsap.killTweensOf(cube.root.rotation);
  resetIdleTimer();
});
renderer.domElement.addEventListener('touchstart', () => {
  gsap.killTweensOf(cube.root.rotation);
  resetIdleTimer();
});
resetIdleTimer();

// ── Animation Loop ────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Pulsing point light
  accentPoint.intensity = 1.0 + 0.45 * Math.sin(t * 2.3);
  accentPoint.position.x = Math.sin(t * 0.7) * 3;
  accentPoint.position.z = Math.cos(t * 0.5) * 3;

  renderer.render(scene, camera);
}

// ── Init ──────────────────────────────────────────────────
loadBest();
loadSessions();
updateAverages();
renderRecords();
animate();
showToast('👋 Welcome! Press SCRAMBLE to start.', '');
