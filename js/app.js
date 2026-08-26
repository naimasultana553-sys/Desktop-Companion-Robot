// ============================================================
// DESKTOP COMPANION ROBOT — Interactive 3D Explorer
// Main Application (ES Module)
// ============================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ============================================================
// SECTION 1: COMPONENT & WIRING DATA
// ============================================================

const COMPONENTS = {
  xiao: {
    name: 'Seeed XIAO ESP32S3 Sense', tag: 'Microcontroller — the body\'s brain',
    price: '~$14-20', category: 'mcu',
    roles: [
      'Runs face firmware and hosts web control page',
      'Wi-Fi connects to computer (the AI "brain")',
      'I2C master — talks to OLED (0x3C) and PCA9685 (0x40)',
      'Sense version includes camera for face tracking',
    ],
    note: 'Flash with Arduino IDE (board: XIAO_ESP32S3). Buy Sense version for camera.',
    pins: ['3V3', 'GND', 'D4 (SDA)', 'D5 (SCL)'],
  },
  oled: {
    name: 'SSD1306 OLED 0.96" (I2C)', tag: 'Display — the robot\'s face',
    price: '~$3-5', category: 'display',
    roles: [
      'Draws 15+ facial expressions (happy, curious, sleepy...)',
      'I2C address 0x3C — shares bus with PCA9685',
      'Needs only 4 wires: VCC, GND, SDA, SCL',
    ],
    note: 'Buy 4-pin I2C version, NOT 8-pin SPI version.',
    pins: ['VCC', 'GND', 'SCL', 'SDA'],
  },
  pca: {
    name: 'PCA9685 16-Ch PWM Driver', tag: 'Servo controller board',
    price: '~$3-6', category: 'driver',
    roles: [
      'Generates precise pulses that position servos',
      'I2C address 0x40 — same bus as OLED',
      'Green screw terminal V+ takes 5V servo power',
      'Offloads pulse timing from ESP32',
    ],
    note: 'CH0 = pan, CH1 = tilt. Tie OE to GND if present.',
    pins: ['VCC', 'GND', 'SDA', 'SCL', 'V+ (5V)', 'CH0', 'CH1'],
  },
  pan: {
    name: 'SG90 Micro Servo — PAN', tag: 'Motor — turns head left/right',
    price: '~$2-4', category: 'servo',
    roles: [
      'Mounted at base; rotates head horizontally',
      'Signal from PCA9685 CH0',
      '90° = straight ahead, 0-180° = full sweep',
    ],
    note: 'If left/right feels inverted, swap mapping in firmware.',
    pins: ['Signal', '5V', 'GND'],
  },
  tilt: {
    name: 'SG90 Micro Servo — TILT', tag: 'Motor — nods head up/down',
    price: '~$2-4', category: 'servo',
    roles: [
      'Mounted in neck; tilts head up/down',
      'Signal from PCA9685 CH1',
    ],
    note: 'If up/down is inverted, reverse in firmware.',
    pins: ['Signal', '5V', 'GND'],
  },
  psu: {
    name: '5V / 3-4A Power Supply', tag: 'Servo power brick',
    price: '~$5-10', category: 'power',
    roles: [
      'Feeds ONLY servos through PCA9685 V+ terminal',
      'Two stalled servos can pull 1A+ each',
      'Negative terminal must share GND with XIAO',
    ],
    note: 'Old phone charger (5V/3A) with cut USB cable works.',
    pins: ['+5V', 'GND'],
  },
};

const NETS = [
  {
    id: 'v33', label: '3.3V Logic Rail', short: '3.3V Power',
    color: '#e53935', thickness: 0.13,
    desc: 'Powers low-current electronics. XIAO 3V3 feeds OLED and PCA9685 logic. Never plug servos here.',
    wires: [
      { from: 'xiao.3v3', to: 'oled.vcc', fromLabel: 'XIAO · 3V3', toLabel: 'OLED · VCC' },
      { from: 'xiao.3v3', to: 'pca.vcc', fromLabel: 'XIAO · 3V3', toLabel: 'PCA · VCC' },
    ],
  },
  {
    id: 'gnd', label: 'Ground (GND) Rail', short: 'Ground',
    color: '#787f8c', thickness: 0.13,
    desc: 'Return path for every current. ALL grounds join together — missing common ground = glitches.',
    wires: [
      { from: 'xiao.gnd', to: 'oled.gnd', fromLabel: 'XIAO · GND', toLabel: 'OLED · GND' },
      { from: 'xiao.gnd', to: 'pca.gnd', fromLabel: 'XIAO · GND', toLabel: 'PCA · GND' },
      { from: 'psu.neg', to: 'pca.gnd', fromLabel: 'PSU · −', toLabel: 'PCA · GND' },
      { from: 'psu.neg', to: 'xiao.gnd', fromLabel: 'PSU · −', toLabel: 'XIAO · GND' },
    ],
  },
  {
    id: 'sda', label: 'I2C Data — D4/SDA', short: 'SDA Data',
    color: '#42a5f5', thickness: 0.13,
    desc: 'Data half of I2C bus. XIAO D4 connects to both OLED and PCA9685 — each has its own address.',
    wires: [
      { from: 'xiao.d4', to: 'oled.sda', fromLabel: 'XIAO · D4', toLabel: 'OLED · SDA' },
      { from: 'xiao.d4', to: 'pca.sda', fromLabel: 'XIAO · D4', toLabel: 'PCA · SDA' },
    ],
  },
  {
    id: 'scl', label: 'I2C Clock — D5/SCL', short: 'SCL Clock',
    color: '#66bb6a', thickness: 0.13,
    desc: 'Clock half of I2C bus. XIAO D5 paces every byte sent to OLED and PCA9685.',
    wires: [
      { from: 'xiao.d5', to: 'oled.scl', fromLabel: 'XIAO · D5', toLabel: 'OLED · SCL' },
      { from: 'xiao.d5', to: 'pca.scl', fromLabel: 'XIAO · D5', toLabel: 'PCA · SCL' },
    ],
  },
  {
    id: 'v5', label: '5V Servo Power', short: '5V Power',
    color: '#d32f2f', thickness: 0.22,
    desc: 'Thick red wire — carries BIG current. External 5V supply feeds PCA9685 V+ terminal for servos.',
    wires: [
      { from: 'psu.pos', to: 'pca.vplus', fromLabel: 'PSU · +', toLabel: 'PCA · V+' },
    ],
  },
  {
    id: 'servo0', label: 'Pan Servo Cable (CH0)', short: 'Pan Servo',
    color: '#ffa726', thickness: 0.13,
    desc: '3-wire servo cable: Orange=signal (CH0), Red=5V, Brown=GND. Pulse width maps to 0-180°.',
    wires: [
      { from: 'pca.ch0', to: 'pan.sig', fromLabel: 'PCA · CH0', toLabel: 'PAN · Sig' },
      { from: 'pca.vplus', to: 'pan.pwr', fromLabel: 'PCA · V+', toLabel: 'PAN · 5V' },
      { from: 'pca.gnd', to: 'pan.gnd', fromLabel: 'PCA · GND', toLabel: 'PAN · GND' },
    ],
  },
  {
    id: 'servo1', label: 'Tilt Servo Cable (CH1)', short: 'Tilt Servo',
    color: '#ffd54f', thickness: 0.13,
    desc: 'Same 3-wire deal as pan, from CH1. Both servos share 5V and GND rails — only signal differs.',
    wires: [
      { from: 'pca.ch1', to: 'tilt.sig', fromLabel: 'PCA · CH1', toLabel: 'TILT · Sig' },
      { from: 'pca.vplus', to: 'tilt.pwr', fromLabel: 'PCA · V+', toLabel: 'TILT · 5V' },
      { from: 'pca.gnd', to: 'tilt.gnd', fromLabel: 'PCA · GND', toLabel: 'TILT · GND' },
    ],
  },
];

const PIN_MAP = [
  { comp: 'XIAO', pin: 'D4', type: 'I2C SDA', purpose: 'Data to OLED + PCA9685', volt: '3.3V' },
  { comp: 'XIAO', pin: 'D5', type: 'I2C SCL', purpose: 'Clock to OLED + PCA9685', volt: '3.3V' },
  { comp: 'XIAO', pin: '3V3', type: 'Power Out', purpose: 'Logic power for OLED + PCA', volt: '3.3V' },
  { comp: 'XIAO', pin: 'GND', type: 'Ground', purpose: 'Common ground reference', volt: '0V' },
  { comp: 'OLED', pin: 'SDA', type: 'I2C Data', purpose: 'Face expression data', volt: '3.3V' },
  { comp: 'OLED', pin: 'SCL', type: 'I2C Clock', purpose: 'Clock signal', volt: '3.3V' },
  { comp: 'OLED', pin: 'VCC', type: 'Power In', purpose: 'Display power', volt: '3.3V' },
  { comp: 'PCA9685', pin: 'SDA', type: 'I2C Data', purpose: 'Servo command data', volt: '3.3V' },
  { comp: 'PCA9685', pin: 'SCL', type: 'I2C Clock', purpose: 'Clock signal', volt: '3.3V' },
  { comp: 'PCA9685', pin: 'VCC', type: 'Power In', purpose: 'Logic power', volt: '3.3V' },
  { comp: 'PCA9685', pin: 'V+', type: 'Power In', purpose: 'Servo power input', volt: '5V' },
  { comp: 'PCA9685', pin: 'CH0', type: 'PWM Out', purpose: 'Pan servo signal', volt: '5V PWM' },
  { comp: 'PCA9685', pin: 'CH1', type: 'PWM Out', purpose: 'Tilt servo signal', volt: '5V PWM' },
  { comp: 'PSU', pin: '+5V', type: 'Power Out', purpose: 'Servo power rail', volt: '5V' },
  { comp: 'PSU', pin: 'GND', type: 'Ground', purpose: 'Common ground', volt: '0V' },
  { comp: 'Pan Servo', pin: 'Sig', type: 'PWM In', purpose: 'Position signal', volt: '5V PWM' },
  { comp: 'Pan Servo', pin: '5V', type: 'Power In', purpose: 'Motor power', volt: '5V' },
  { comp: 'Tilt Servo', pin: 'Sig', type: 'PWM In', purpose: 'Position signal', volt: '5V PWM' },
  { comp: 'Tilt Servo', pin: '5V', type: 'Power In', purpose: 'Motor power', volt: '5V' },
];

const PIN_POS = {
  'xiao.3v3': [-10.4, 1.35, -4.6], 'xiao.gnd': [-10.4, 1.35, -5.6],
  'xiao.d4': [-10.4, 1.35, -6.6], 'xiao.d5': [-10.4, 1.35, -7.6],
  'oled.vcc': [-4.3, 1.35, -5.2], 'oled.gnd': [-4.3, 1.35, -6.0],
  'oled.scl': [-4.3, 1.35, -6.8], 'oled.sda': [-4.3, 1.35, -7.6],
  'pca.vcc': [7.2, 1.35, -0.3], 'pca.gnd': [7.2, 1.35, -1.3],
  'pca.sda': [7.2, 1.35, -2.3], 'pca.scl': [7.2, 1.35, -3.3],
  'pca.vplus': [15.3, 1.75, -0.7], 'pca.ch0': [9.0, 1.35, -3.9],
  'pca.ch1': [9.9, 1.35, -3.9], 'psu.pos': [13.6, 1.8, 8.1],
  'psu.neg': [13.6, 1.8, 9.9], 'pan.sig': [-5.9, 2.05, 8.4],
  'pan.pwr': [-5.9, 2.05, 8.9], 'pan.gnd': [-5.9, 2.05, 9.4],
  'tilt.sig': [1.1, 2.05, 8.4], 'tilt.pwr': [1.1, 2.05, 8.9],
  'tilt.gnd': [1.1, 2.05, 9.4],
};

const PIN_LABELS = {
  'xiao.3v3': '3V3', 'xiao.gnd': 'GND', 'xiao.d4': 'D4 SDA', 'xiao.d5': 'D5 SCL',
  'oled.vcc': 'VCC', 'oled.gnd': 'GND', 'oled.scl': 'SCL', 'oled.sda': 'SDA',
  'pca.vcc': 'VCC', 'pca.gnd': 'GND', 'pca.sda': 'SDA', 'pca.scl': 'SCL',
  'pca.vplus': 'V+ 5V', 'pca.ch0': 'CH0', 'pca.ch1': 'CH1',
  'psu.pos': '+ 5V', 'psu.neg': '− GND',
  'pan.sig': 'Sig', 'pan.pwr': '5V', 'pan.gnd': 'GND',
  'tilt.sig': 'Sig', 'tilt.pwr': '5V', 'tilt.gnd': 'GND',
};

// ============================================================
// SECTION 2: BOOT SEQUENCE
// ============================================================

const BOOT_LINES = [
  { text: '> INITIALIZING COMPANION SYSTEM...', delay: 0 },
  { text: '> MCU: Seeed XIAO ESP32S3 Sense ........... <span class="ok">OK</span>', delay: 300 },
  { text: '> DISPLAY: SSD1306 OLED 0.96" I2C ......... <span class="ok">OK</span>', delay: 500 },
  { text: '> SERVO DRIVER: PCA9685 PWM ............... <span class="ok">OK</span>', delay: 400 },
  { text: '> ACTUATORS: Pan + Tilt SG90 .............. <span class="ok">OK</span>', delay: 400 },
  { text: '> POWER: 5V External Rail ................. <span class="ok">OK</span>', delay: 350 },
  { text: '> I2C BUS: D4(SDA) / D5(SCL) ............. <span class="ok">OK</span>', delay: 300 },
  { text: '> WIFI: STA Mode Ready .................... <span class="ok">OK</span>', delay: 400 },
  { text: '', delay: 200 },
  { text: '> <span class="ready">ALL SYSTEMS READY — COMPANION ONLINE</span>', delay: 500 },
  { text: '<span class="dim">  Desktop Companion Robot v1.0</span>', delay: 200 },
];

function runBootSequence() {
  const logEl = document.getElementById('boot-log');
  const irisEl = document.getElementById('boot-iris');
  let cumulativeDelay = 0;

  BOOT_LINES.forEach((line, i) => {
    cumulativeDelay += line.delay;
    setTimeout(() => {
      const div = document.createElement('div');
      div.className = 'line';
      div.innerHTML = line.text || '&nbsp;';
      div.style.animationDelay = '0s';
      logEl.appendChild(div);
    }, cumulativeDelay);
  });

  cumulativeDelay += 800;
  setTimeout(() => {
    irisEl.classList.remove('hidden');
    requestAnimationFrame(() => irisEl.classList.add('show'));
  }, cumulativeDelay);

  cumulativeDelay += 2000;
  setTimeout(() => {
    document.getElementById('boot-screen').style.opacity = '0';
    document.getElementById('boot-screen').style.transition = 'opacity 0.6s ease';
    setTimeout(() => {
      document.getElementById('boot-screen').classList.add('hidden');
      showIntro();
    }, 600);
  }, cumulativeDelay);
}

// ============================================================
// SECTION 3: INTRO SCREEN
// ============================================================

let introScene, introCamera, introRenderer, introRobot;

function showIntro() {
  const introScreen = document.getElementById('intro-screen');
  introScreen.classList.remove('hidden');

  initIntro3D();

  setTimeout(() => {
    document.getElementById('dialogue-2').classList.remove('hidden');
  }, 1200);

  setTimeout(() => {
    document.getElementById('intro-actions').classList.remove('hidden');
  }, 2200);

  document.getElementById('btn-show-me').addEventListener('click', () => {
    transitionToSite();
  });
  document.getElementById('btn-explore').addEventListener('click', () => {
    transitionToSite();
  });
  document.getElementById('btn-skip').addEventListener('click', () => {
    transitionToSite();
  });
}

function initIntro3D() {
  const canvas = document.getElementById('intro-robot-canvas');
  const container = document.getElementById('intro-robot-container');

  introScene = new THREE.Scene();
  introScene.background = new THREE.Color(0x0B0E14);

  introCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  introCamera.position.set(0, 5, 18);

  introRenderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  introRenderer.setSize(300, 300);
  introRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  introScene.add(new THREE.HemisphereLight(0xbfd4ff, 0x20242c, 1.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(10, 20, 15);
  introScene.add(sun);

  introRobot = buildIntroRobot();
  introScene.add(introRobot);

  function animateIntro() {
    requestAnimationFrame(animateIntro);
    introRobot.rotation.y += 0.008;
    introRenderer.render(introScene, introCamera);
  }
  animateIntro();
}

function buildIntroRobot() {
  const root = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.55, metalness: 0.04 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.4 });

  const B = (w, h, d, m, x, y, z, p) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z); p.add(o); return o;
  };

  // Base
  B(8, 0.8, 6.5, shell, 0, 0.4, 0, root);
  B(8, 0.25, 6.5, shell, 0, 0.92, 0, root);

  // Pan disc
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 0.5, 32), shell);
  disc.position.set(0, 1.2, 0); root.add(disc);

  // Neck
  B(1.6, 3.3, 1.3, shell, 0, 3.1, -1.7, root);

  // Head
  const head = B(4.9, 4.4, 4.5, shell, 0, 5.7, 0.3, root);

  // Screen frame
  B(3.9, 2.8, 0.25, dark, 0, 5.9, 2.53, root);

  // Eyes (glowing teal)
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x39e6d0 });
  B(1.0, 1.1, 0.1, eyeMat, -0.9, 6.2, 2.68, root);
  B(1.0, 1.1, 0.1, eyeMat, 0.9, 6.2, 2.68, root);

  // Camera on top
  B(0.85, 0.55, 0.65, dark, 1.35, 8.15, 2.0, root);

  return root;
}

function transitionToSite() {
  const introScreen = document.getElementById('intro-screen');
  introScreen.style.opacity = '0';
  introScreen.style.transition = 'opacity 0.5s ease';
  setTimeout(() => {
    introScreen.classList.add('hidden');
    document.getElementById('site').classList.remove('hidden');
    document.getElementById('site').style.opacity = '0';
    document.getElementById('site').style.transition = 'opacity 0.5s ease';
    requestAnimationFrame(() => {
      document.getElementById('site').style.opacity = '1';
    });
    initMainScene();
    initDashboard();
  }, 500);
}

// ============================================================
// SECTION 4: MAIN THREE.JS SCENE
// ============================================================

let scene, camera, renderer, labelRenderer, controls;
let workbenchGroup, robotData;
let pickables = [], labelObjs = [];
let netMeshes = {};
let robotMode = false, xrayOn = false, labelsOn = true;
let hoveredComp = null, selectedNet = null;
let oledCtx, faceTex;
let panHorn, tiltHorn;
let autoRotate = false;

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const UP = new THREE.Vector3(0, 1, 0);

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.12, ...opts });

function initMainScene() {
  const container = document.getElementById('three-container');

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x0B0E14);
  container.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0B0E14);
  scene.fog = new THREE.Fog(0x0B0E14, 60, 130);

  // Camera
  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 300);
  camera.position.set(2, 27, 36);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.5, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 10;
  controls.maxDistance = 80;

  // CSS2D Renderer for labels
  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(labelRenderer.domElement);

  // Tooltip element
  const tooltip = document.createElement('div');
  tooltip.id = 'tooltip-3d';
  container.appendChild(tooltip);

  // Lights
  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x20242c, 1.05));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(18, 34, 20);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
  fill.position.set(-20, 16, -14);
  scene.add(fill);

  // Build workbench
  workbenchGroup = new THREE.Group();
  scene.add(workbenchGroup);
  buildWorkbench();

  // Build assembled robot
  robotData = buildAssembledRobot();
  robotData.root.visible = false;

  // Merge robot cables into netMeshes
  for (const id of Object.keys(robotData.cables)) {
    if (!netMeshes[id]) netMeshes[id] = [];
    netMeshes[id].push(...robotData.cables[id]);
  }

  // Build UI
  buildConnectionsList();
  buildHardwareCards();
  buildPinTable();

  // Event listeners
  setupInteractions(tooltip);
  setupViewerControls();
  setupServoControls();
  setupModeToggle();

  // Start loop
  animate();

  // Handle resize
  window.addEventListener('resize', onResize);
}

// ============================================================
// SECTION 5: WORKBENCH MODEL
// ============================================================

function B(w, h, d, material, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function cyl(r, h, material, x, y, z, parent, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

function tagPick(rootObj, id) {
  rootObj.traverse((o) => { o.userData.pickComp = id; });
  pickables.push(rootObj);
}

function addLabel(pinId) {
  const div = document.createElement('div');
  div.className = 'pin-label';
  div.textContent = PIN_LABELS[pinId] || pinId;
  const lab = new CSS2DObject(div);
  const p = V3(PIN_POS[pinId]); p.y += 0.75;
  lab.position.copy(p);
  workbenchGroup.add(lab);
  labelObjs.push(lab);
}

function buildWorkbench() {
  // Desk surface
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(160, 110), mat(0x14171d, { roughness: 0.95 }));
  desk.rotation.x = -Math.PI / 2;
  scene.add(desk);

  // Breadboard
  const bbTex = makeBreadboardTexture();
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(40, 1, 24),
    mat(0xffffff, { map: bbTex.map, bumpMap: bbTex.bump, bumpScale: 0.12, roughness: 0.85 })
  );
  board.position.y = 0.5;
  workbenchGroup.add(board);

  // Power rail strips
  const railRed = mat(0xcc2222, { roughness: 0.5 });
  const railBlue = mat(0x2244aa, { roughness: 0.5 });
  B(38, 0.18, 0.6, railRed, 0, 1.09, -11.4, workbenchGroup);
  B(38, 0.18, 0.6, railRed, 0, 1.09, -10.6, workbenchGroup);
  B(38, 0.18, 0.6, railBlue, 0, 1.09, 11.4, workbenchGroup);
  B(38, 0.18, 0.6, railBlue, 0, 1.09, 10.6, workbenchGroup);

  // Components
  buildXIAO();
  buildOLED();
  buildPCA9685();
  buildServo('pan', -8, 7, 'pan');
  buildServo('tilt', -1, 7, 'tilt');
  buildPSU();

  // Pin markers
  for (const pid of Object.keys(PIN_POS)) {
    const p = V3(PIN_POS[pid]);
    const isTerm = pid.startsWith('psu') || pid === 'pca.vplus';
    cyl(isTerm ? 0.13 : 0.085, isTerm ? 0.5 : 0.34, mat(0xc9ccd2, { metalness: 0.75, roughness: 0.32 }),
      p.x, p.y - 0.12, p.z, workbenchGroup);
    if (isTerm) workbenchGroup.children[workbenchGroup.children.length - 1].rotation.x = Math.PI / 2;
    addLabel(pid);
  }

  // Wires
  buildWires();
}

function makeBreadboardTexture() {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 720;
  const g = c.getContext('2d');
  g.fillStyle = '#f0ede6'; g.fillRect(0, 0, 1200, 720);
  g.fillStyle = '#d8d4c8'; g.fillRect(0, 324, 1200, 72);
  g.strokeStyle = '#c0bcb0'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(0, 328); g.lineTo(1200, 328); g.stroke();
  g.beginPath(); g.moveTo(0, 392); g.lineTo(1200, 392); g.stroke();
  g.strokeStyle = '#cc2222'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(12, 24); g.lineTo(1188, 24); g.stroke();
  g.beginPath(); g.moveTo(12, 44); g.lineTo(1188, 44); g.stroke();
  g.strokeStyle = '#2244aa';
  g.beginPath(); g.moveTo(12, 676); g.lineTo(1188, 676); g.stroke();
  g.beginPath(); g.moveTo(12, 696); g.lineTo(1188, 696); g.stroke();
  g.fillStyle = '#555';
  for (let row = 0; row < 24; row++) {
    for (let col = 0; col < 30; col++) {
      if (row >= 10 && row <= 13) continue;
      g.beginPath(); g.arc(40 + col * 40, 60 + row * 28, 4.5, 0, Math.PI * 2); g.fill();
    }
  }
  const mainTex = new THREE.CanvasTexture(c);
  mainTex.anisotropy = 8;

  const bc = document.createElement('canvas');
  bc.width = 1200; bc.height = 720;
  const bg = bc.getContext('2d');
  bg.fillStyle = '#ffffff'; bg.fillRect(0, 0, 1200, 720);
  bg.fillStyle = '#000000';
  for (let row = 0; row < 24; row++) {
    for (let col = 0; col < 30; col++) {
      if (row >= 10 && row <= 13) continue;
      bg.beginPath(); bg.arc(40 + col * 40, 60 + row * 28, 4.5, 0, Math.PI * 2); bg.fill();
    }
  }
  return { map: mainTex, bump: new THREE.CanvasTexture(bc) };
}

function buildXIAO() {
  const g = new THREE.Group();
  g.position.set(-13, 1.16, -6);
  const pcbGreen = mat(0x1c8f4a, { roughness: 0.5 });
  const metal = mat(0xc9ccd2, { metalness: 0.75, roughness: 0.32 });
  const dark = mat(0x22262e);
  B(5.2, 0.26, 4.2, pcbGreen, 0, 0, 0, g);
  B(1.1, 0.34, 0.9, metal, -2.95, 0.05, -1.1, g);
  B(1.6, 0.18, 1.6, dark, 1.2, 0.22, 0.6, g);
  cyl(0.72, 0.5, dark, -1.55, 0.36, -1.35, g);
  cyl(0.5, 0.12, mat(0x0a2038), -1.55, 0.63, -1.35, g);
  B(0.9, 0.14, 0.9, dark, 1.9, 0.2, -1.4, g);
  for (let i = 0; i < 7; i++) {
    cyl(0.09, 0.55, metal, 2.65, -0.25, -1.5 + i * 0.5, g);
    cyl(0.09, 0.55, metal, -2.65, -0.25, -1.5 + i * 0.5, g);
  }
  workbenchGroup.add(g);
  tagPick(g, 'xiao');
}

function buildOLED() {
  const g = new THREE.Group();
  g.position.set(-2, 1.16, -7);
  const pcbBlue = mat(0x182a52, { roughness: 0.45 });
  const metal = mat(0xc9ccd2, { metalness: 0.75, roughness: 0.32 });
  B(4.6, 0.26, 4.6, pcbBlue, 0, 0, 0.4, g);

  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  oledCtx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  faceTex = tex;
  const faceMat = new THREE.MeshBasicMaterial({ map: tex });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.9, 0.22), mat(0x10141b));
  frame.position.set(0, 1.55, -1.15);
  frame.rotation.x = -0.42;
  g.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 2.4), faceMat);
  face.position.set(0, 1.58, -1.02);
  face.rotation.x = -0.42;
  g.add(face);
  for (let i = 0; i < 4; i++) cyl(0.09, 0.5, metal, -2.35, -0.25, -0.9 + i * 0.8, g);
  workbenchGroup.add(g);
  tagPick(g, 'oled');
  drawFace(false);
  setInterval(() => { drawFace(true); setTimeout(() => drawFace(false), 150); }, 4200);
}

function drawFace(closed) {
  if (!oledCtx) return;
  const g = oledCtx;
  g.fillStyle = '#06121f'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#39e6d0'; g.strokeStyle = '#39e6d0';
  g.shadowColor = '#39e6d0'; g.shadowBlur = 14;
  const ex = [86, 170], ey = 52, r = 24;
  if (closed) {
    g.lineWidth = 6; g.lineCap = 'round';
    for (const x of ex) { g.beginPath(); g.moveTo(x - r, ey + 8); g.lineTo(x + r, ey + 8); g.stroke(); }
  } else {
    for (const x of ex) { g.beginPath(); g.arc(x, ey, r, 0, Math.PI * 2); g.fill(); }
  }
  g.lineWidth = 7; g.beginPath();
  g.arc(128, 78, 34, Math.PI * 0.18, Math.PI * 0.82); g.stroke();
  if (faceTex) faceTex.needsUpdate = true;
}

function buildPCA9685() {
  const g = new THREE.Group();
  g.position.set(11, 1.16, -2);
  const pcbRed = mat(0xb03028, { roughness: 0.5 });
  const dark = mat(0x22262e);
  const metal = mat(0xc9ccd2, { metalness: 0.75, roughness: 0.32 });
  B(8.4, 0.26, 3.4, pcbRed, 0, 0, 0, g);
  B(1.7, 0.95, 1.7, mat(0x2e9e60), 3.55, 0.5, 0.55, g);
  B(1.7, 0.5, 1.7, mat(0x2e9e60), 3.55, 0.32, -1.05, g);
  B(1.5, 0.3, 1.5, dark, -0.4, 0.28, 0.2, g);
  cyl(0.6, 1.25, mat(0x17202e, { roughness: 0.35 }), 1.9, 0.85, 0.7, g);
  for (let i = 0; i < 16; i++) {
    cyl(0.085, 0.5, metal, -3.6 + i * 0.48, 0.38, -1.85, g);
    B(0.44, 0.22, 0.3, mat(0x173a70), -3.6 + i * 0.48, 0.19, -1.85, g);
  }
  workbenchGroup.add(g);
  tagPick(g, 'pca');
}

const servoHornY = 4.32;
function buildServo(id, x, z, axis) {
  const g = new THREE.Group();
  g.position.set(x, 1.04, z);
  const servoBlue = mat(0x2266cc, { roughness: 0.42 });
  const white = mat(0xeef0f4);
  const dark = mat(0x22262e);
  B(3.7, 3.1, 4.5, servoBlue, 0, 1.55, 0, g);
  B(4.6, 0.2, 4.5, servoBlue, 0, 2.85, 0, g);
  B(1.0, 1.0, 2.2, servoBlue, 1.6, 1.9, 0, g);
  cyl(1.0, 0.5, servoBlue, 0.9, 3.2, 0, g);
  const horn = new THREE.Group();
  horn.position.set(0.9, servoHornY - 1.04, 0);
  g.add(horn);
  cyl(1.15, 0.22, white, 0, 0, 0, horn);
  B(2.6, 0.2, 0.55, white, 0.9, 0.2, 0, horn);
  if (axis === 'tilt') {
    B(0.5, 1.7, 2.4, dark, 2.0, 0.9, 0, horn);
    B(1.9, 1.1, 2.0, mat(0x39424f), 2.9, 1.5, 0, horn);
  }
  workbenchGroup.add(g);
  tagPick(g, id);
  if (id === 'pan') panHorn = horn;
  if (id === 'tilt') tiltHorn = horn;
  return horn;
}

function buildPSU() {
  const g = new THREE.Group();
  g.position.set(16, 1.7, 9);
  B(6, 3.2, 4.2, mat(0x14171d, { roughness: 0.4 }), 0, 0, 0, g);
  B(1.4, 0.9, 0.2, mat(0x2e9e60), -3.05, 0.55, -0.9, g);
  B(1.4, 0.9, 0.2, mat(0x2e9e60), -3.05, 0.55, 0.9, g);
  cyl(0.16, 1.2, mat(0xc9ccd2, { metalness: 0.75, roughness: 0.32 }), -3.05, 1.15, -0.9, g).rotation.x = Math.PI / 2;
  cyl(0.16, 1.2, mat(0xc9ccd2, { metalness: 0.75, roughness: 0.32 }), -3.05, 1.15, 0.9, g).rotation.x = Math.PI / 2;
  B(0.3, 0.5, 2.2, mat(0x333333), -3.1, -0.9, 0, g);
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.25, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x33ff66 })
  );
  led.position.set(-3.11, 0, 1.6);
  g.add(led);
  workbenchGroup.add(g);
  tagPick(g, 'psu');
}

// ============================================================
// SECTION 6: WIRES
// ============================================================

function wireCurve(fromPin, toPin, off = 0, lift = 0) {
  const p0 = V3(PIN_POS[fromPin]);
  const p3 = V3(PIN_POS[toPin]);
  const dist = p0.distanceTo(p3);
  const dir = p3.clone().sub(p0); dir.y = 0;
  if (dir.lengthSq() > 1e-6) dir.normalize();
  const lat = new THREE.Vector3().crossVectors(dir, UP).normalize();
  const peak = Math.min(4.6, Math.max(1.4, dist * 0.3)) + lift;
  const m1 = p0.clone().lerp(p3, 0.22); m1.addScaledVector(lat, off * 0.6); m1.y += peak;
  const m2 = p0.clone().lerp(p3, 0.78); m2.addScaledVector(lat, off * 0.6); m2.y += peak;
  return new THREE.CatmullRomCurve3([p0, m1, m2, p3]);
}

function buildWires() {
  const wireOffsets = {
    v33: [{ off: 0.35 }, { off: -0.45 }],
    gnd: [{ off: 0.35 }, { off: -0.45 }, { off: 0.3 }, { off: 0.55, lift: 1.2 }],
    sda: [{ off: 0.35 }, { off: -0.45 }],
    scl: [{ off: 0.35 }, { off: -0.45 }],
    v5: [{ off: 0 }],
    servo0: [{ off: 0 }, { off: 0.4 }, { off: 0.4, lift: 1.0 }],
    servo1: [{ off: 0 }, { off: 0.8 }, { off: 0.8, lift: 1.0 }],
  };

  for (const net of NETS) {
    netMeshes[net.id] = [];
    const offsets = wireOffsets[net.id] || net.wires.map(() => ({}));
    for (let i = 0; i < net.wires.length; i++) {
      const w = net.wires[i];
      const o = offsets[i] || {};
      const geo = new THREE.TubeGeometry(
        wireCurve(w.from, w.to, o.off || 0, o.lift || 0), 48, net.thickness, 8
      );
      const m = new THREE.MeshStandardMaterial({
        color: net.color, roughness: 0.45, metalness: 0.05,
        transparent: true, opacity: 1,
      });
      const tube = new THREE.Mesh(geo, m);
      tube.userData.net = net.id;
      workbenchGroup.add(tube);
      pickables.push(tube);
      netMeshes[net.id].push(tube);
    }
  }
}

function setNetGlow(netId, on) {
  for (const id of Object.keys(netMeshes)) {
    const active = id === netId;
    for (const t of netMeshes[id]) {
      t.material.emissive.setHex(on && active ? 0x444444 : 0x000000);
      t.material.opacity = !on ? 1 : (active ? 1 : 0.1);
    }
  }
}

// ============================================================
// SECTION 7: ASSEMBLED ROBOT
// ============================================================

function buildAssembledRobot() {
  const root = new THREE.Group();
  root.position.set(0, 0, -1);

  // 3D print layer lines bump
  const bc = document.createElement('canvas');
  bc.width = 4; bc.height = 64;
  const bg = bc.getContext('2d');
  for (let y = 0; y < 64; y += 2) { bg.fillStyle = y % 4 ? '#909090' : '#b4b4b4'; bg.fillRect(0, y, 4, 1); }
  const bump = new THREE.CanvasTexture(bc);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(5, 5);

  const shell = new THREE.MeshStandardMaterial({
    color: 0xf3f1ec, roughness: 0.55, metalness: 0.04,
    transparent: true, opacity: 1, bumpMap: bump, bumpScale: 0.05,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.4 });
  const intG = new THREE.MeshStandardMaterial({ color: 0x2fd06e, emissive: 0x0d4f27, roughness: 0.5 });
  const intB = new THREE.MeshStandardMaterial({ color: 0x2b4bb5, emissive: 0x0e1a44, roughness: 0.5 });
  const intR = new THREE.MeshStandardMaterial({ color: 0xe04840, emissive: 0x521210, roughness: 0.5 });
  const intM = new THREE.MeshStandardMaterial({ color: 0xd7dade, metalness: 0.7, roughness: 0.3 });
  const intD = new THREE.MeshStandardMaterial({ color: 0x1a1e26, roughness: 0.5 });
  const intServo = new THREE.MeshStandardMaterial({ color: 0x2f74e0, emissive: 0x0a1f44, roughness: 0.42 });

  const B = (w, h, d, m, x, y, z, p) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z); p.add(o); return o;
  };
  const tag = (obj, id) => { obj.userData.pickComp = id; pickables.push(obj); };

  // Face texture
  const fc = document.createElement('canvas');
  fc.width = 256; fc.height = 160;
  const fg = fc.getContext('2d');
  function drawRobotFace(closed) {
    fg.fillStyle = '#050b12'; fg.fillRect(0, 0, 256, 160);
    fg.fillStyle = '#39e6d0'; fg.shadowColor = '#39e6d0'; fg.shadowBlur = 22;
    const w = 54, h = closed ? 10 : 60, y = closed ? 62 : 34;
    const rr = (g, x, y, w, h, r) => {
      g.beginPath(); g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    };
    rr(fg, 44, y, w, h, 13); fg.fill();
    rr(fg, 158, y, w, h, 13); fg.fill();
  }
  drawRobotFace(false);
  const robotFaceTex = new THREE.CanvasTexture(fc);
  setInterval(() => { drawRobotFace(true); setTimeout(() => drawRobotFace(false), 160); }, 4600);

  // Base plate
  const base = new THREE.Group(); root.add(base);
  const plate = B(16, 1.6, 13, shell, 0, 0.8, 0, base);
  B(16, 0.5, 13, shell, 0, 1.85, 0, base);
  B(5, 0.12, 0.9, darkMat, -4.5, 2.25, 2.5, base);
  B(5, 0.12, 0.9, darkMat, 1.5, 2.25, 2.5, base);
  B(0.9, 0.12, 4, darkMat, -5.5, 2.25, -3, base);
  tag(plate, 'rcase');

  // Pan turntable
  const panPivot = new THREE.Group();
  panPivot.position.set(0, 2.1, 0);
  base.add(panPivot);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 1.0, 40), shell);
  disc.position.y = 0.5; panPivot.add(disc);
  tag(disc, 'pan');

  // Neck arm
  const arm = new THREE.Group(); panPivot.add(arm);
  B(3.2, 6.6, 2.6, shell, 0, 3.9, -3.4, arm);
  B(2.2, 5.0, 1.8, shell, 0, 3.1, 2.4, arm);
  B(3.4, 2.8, 3.6, shell, 0, 7.6, -3.4, arm);
  tag(arm, 'tilt');

  // Head
  const tiltPivot = new THREE.Group();
  tiltPivot.position.set(0, 8.0, -1.0);
  panPivot.add(tiltPivot);

  const head = new THREE.Group(); tiltPivot.add(head);
  const cube = B(9.8, 8.8, 9.0, shell, 0, 4.6, 0.6, head);
  tag(cube, 'rcase');

  // Screen frame
  B(7.8, 5.6, 0.5, darkMat, 0, 5.0, 5.05, head);
  const fz = 5.25;
  B(9.6, 1.0, 0.8, shell, 0, 7.9, fz, head);
  B(9.6, 1.0, 0.8, shell, 0, 2.1, fz, head);
  B(1.0, 4.8, 0.8, shell, -4.3, 5.0, fz, head);
  B(1.0, 4.8, 0.8, shell, 4.3, 5.0, fz, head);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(6.8, 4.3),
    new THREE.MeshBasicMaterial({ map: robotFaceTex })
  );
  screen.position.set(0, 5.0, 5.33);
  head.add(screen);
  tag(screen, 'oled');

  // Camera on top
  B(1.7, 1.1, 1.3, shell, 2.7, 9.35, 4.0, head);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.55, 20), darkMat);
  lens.rotation.x = Math.PI / 2 - 0.35;
  lens.position.set(2.7, 9.5, 4.75);
  head.add(lens);

  // ---- X-RAY INTERNALS ----
  const xrayParts = [], xrayLabels = [];
  const part = (o) => { xrayParts.push(o); o.visible = false; return o; };
  const label = (txt, parent, x, y, z) => {
    const div = document.createElement('div');
    div.className = 'pin-label';
    div.textContent = txt;
    const o = new CSS2DObject(div);
    o.position.set(x, y, z);
    o.userData.xray = true;
    parent.add(o);
    o.visible = false;
    xrayLabels.push(o);
    labelObjs.push(o);
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const jumper = (parent, pts, color, r = 0.1) => {
    const m = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, r, 8),
      new THREE.MeshBasicMaterial({ color })
    );
    parent.add(m);
    return part(m);
  };

  // OLED module
  const oledG = new THREE.Group(); head.add(oledG); part(oledG);
  B(4.0, 3.1, 0.22, intB, 0, 5.0, 3.55, oledG);
  label('SSD1306 OLED', oledG, 0, 7.1, 3.6);

  // XIAO
  const xg = new THREE.Group(); head.add(xg); part(xg);
  B(3.4, 0.24, 2.6, intG, -0.4, 7.85, -1.7, xg);
  B(0.9, 0.3, 0.8, intM, -0.4, 7.9, -3.25, xg);
  const xcam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 16), intD);
  xcam.rotation.x = Math.PI / 2;
  xcam.position.set(0.9, 7.95, -0.15);
  xg.add(xcam);
  label('XIAO ESP32S3', xg, -0.4, 9.0, -1.7);

  // Jumpers XIAO -> OLED
  const jw = [['#e53935', -0.45], ['#787f8c', -0.15], ['#42a5f5', 0.15], ['#66bb6a', 0.45]];
  for (const [c, ox] of jw) {
    jumper(head, [V(-0.4 + ox, 7.6, -0.6), V(ox * 2.2, 6.5, 1.6), V(ox, 5.4, 3.3)], c, 0.09);
  }
  jumper(head, [V(-1.6, 7.6, -2.2), V(-1.2, 4.2, -3.0), V(-0.4, 0.4, -1.4)], '#42a5f5', 0.11);
  jumper(head, [V(-1.2, 7.6, -2.2), V(-0.8, 4.2, -3.0), V(0.0, 0.4, -1.4)], '#66bb6a', 0.11);

  // PCA9685 in base
  const pg = new THREE.Group(); root.add(pg); part(pg);
  B(5.4, 0.26, 2.6, intR, 3.6, 2.75, 3.0, pg);
  B(1.4, 0.85, 1.5, intG, 5.6, 3.2, 3.0, pg);
  label('PCA9685', pg, 3.6, 4.5, 3.0);

  // Pan servo
  const panG = new THREE.Group(); root.add(panG); part(panG);
  B(3.4, 1.7, 4.3, intServo, -2.6, 1.25, -1.4, panG);
  label('Pan Servo', panG, -2.6, 3.6, -1.4);

  // Tilt servo
  const tiltG = new THREE.Group(); arm.add(tiltG); part(tiltG);
  B(2.9, 2.1, 3.0, intServo, 0, 7.5, -3.4, tiltG);
  label('Tilt Servo', tiltG, 0, 9.4, -3.4);

  // ---- CABLES ----
  const cables = { v33: [], gnd: [], sda: [], scl: [], v5: [], servo0: [], servo1: [] };
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  function cable(parent, pts, color, r, net) {
    const m = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5, transparent: true, opacity: 1 })
    );
    m.userData.net = net;
    parent.add(m);
    if (net && cables[net]) cables[net].push(m);
    return m;
  }

  // I2C bundle
  for (const [col, net, ox] of [['#e53935', 'v33', -0.5], ['#787f8c', 'gnd', -0.17], ['#42a5f5', 'sda', 0.17], ['#66bb6a', 'scl', 0.5]]) {
    cable(panPivot, [P(ox, 0.7, -3.0), P(ox * 1.4, 3.4, -4.6), P(ox, 7.0, -3.4), P(ox * 0.4, 8.3, -1.2)], col, 0.13, net);
  }

  // Servo cables
  for (const [col, ox] of [['#ffa726', 0.35], ['#e53935', 0.0], ['#787f8c', -0.35]]) {
    cable(panPivot, [P(ox + 0.9, 7.9, -0.6), P(ox + 1.2, 4.4, 1.6), P(ox + 0.8, 1.1, 0.6)], col, 0.12, 'servo1');
  }
  for (const [col, ox] of [['#ffa726', 0.35], ['#e53935', 0.0], ['#787f8c', -0.35]]) {
    cable(root, [P(ox - 0.5, 2.6, -4.2), P(ox - 0.5, 1.4, -6.2), P(ox - 0.5, 0.5, -8.0)], col, 0.12, 'servo0');
  }

  // PSU cables
  cable(root, [P(2.2, 1.6, -6.3), P(3.4, 0.9, -8.4), P(6.5, 0.35, -10.5)], '#d32f2f', 0.22, 'v5');
  cable(root, [P(3.0, 1.6, -6.3), P(4.2, 0.8, -8.6), P(7.2, 0.3, -10.8)], '#787f8c', 0.18, 'gnd');

  // ---- X-RAY ----
  function setXray(on) {
    shell.opacity = on ? 0.18 : 1;
    shell.depthWrite = !on;
    for (const p of xrayParts) p.visible = on;
    for (const l of xrayLabels) l.visible = on;
  }

  // ---- EXPLODED VIEW ----
  const homePos = {
    head: head.position.clone(),
    arm: arm.position.clone(),
    disc: panPivot.position.clone(),
  };
  const explodeOffset = {
    head: new THREE.Vector3(0, 7, 4),
    arm: new THREE.Vector3(0, 5, 0),
    disc: new THREE.Vector3(0, 0, 6),
  };
  const explodeLabels = [];
  function makeExplodeLabel(text, parent, x, y, z) {
    const div = document.createElement('div');
    div.className = 'pin-label';
    div.textContent = text;
    const o = new CSS2DObject(div);
    o.position.set(x, y, z);
    o.visible = false;
    parent.add(o);
    explodeLabels.push(o);
    labelObjs.push(o);
  }
  makeExplodeLabel('HEAD — OLED + Camera + XIAO', head, 0, 10, 2);
  makeExplodeLabel('NECK — Tilt Servo (CH1)', arm, 0, 10, 0);
  makeExplodeLabel('TURNTABLE — Pan Servo (CH0)', panPivot, 0, 2, 8);
  makeExplodeLabel('BASE — PCA9685 + Power', root, 0, 0, 8);

  function setExplosion(factor) {
    const t = Math.max(0, Math.min(1, factor));
    head.position.lerpVectors(homePos.head, homePos.head.clone().add(explodeOffset.head), t);
    arm.position.lerpVectors(homePos.arm, homePos.arm.clone().add(explodeOffset.arm), t);
    panPivot.position.lerpVectors(homePos.disc, homePos.disc.clone().add(explodeOffset.disc), t);
    const showLabels = t > 0.15;
    for (const l of explodeLabels) l.visible = showLabels;
  }

  scene.add(root);
  return { root, panPivot, tiltPivot, setXray, cables, setExplosion };
}

// ============================================================
// SECTION 8: INTERACTIONS
// ============================================================

function setupInteractions(tooltipEl) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function pickAt(ev) {
    const container = document.getElementById('three-container');
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(pickables, true);
    for (const h of hits) {
      let ok = true, o = h.object;
      while (o) { if (!o.visible) { ok = false; break; } o = o.parent; }
      if (ok) return h.object;
    }
    return null;
  }

  function rootData(o) {
    while (o) {
      if (o.userData.pickComp) return { comp: o.userData.pickComp };
      if (o.userData.net) return { net: o.userData.net };
      o = o.parent;
    }
    return null;
  }

  renderer.domElement.addEventListener('pointermove', (ev) => {
    const hit = pickAt(ev);
    const info = hit ? rootData(hit) : null;
    const compId = info?.comp || null;
    if (compId !== hoveredComp) {
      hoveredComp = compId;
      renderer.domElement.style.cursor = compId || (info?.net) ? 'pointer' : 'grab';
    }
    if (info) {
      tooltipEl.style.display = 'block';
      tooltipEl.textContent = COMPONENTS[info.comp]?.name || NETS.find((n) => n.id === info.net)?.label || '';
      tooltipEl.style.left = ev.clientX + 14 + 'px';
      tooltipEl.style.top = ev.clientY + 10 + 'px';
    } else {
      tooltipEl.style.display = 'none';
    }
  });

  renderer.domElement.addEventListener('click', (ev) => {
    const hit = pickAt(ev);
    const info = hit ? rootData(hit) : null;
    if (!info) return;
    if (info.comp) showComponentInfo(info.comp);
    else selectNet(info.net, true);
  });

  renderer.domElement.addEventListener('pointerleave', () => {
    tooltipEl.style.display = 'none';
  });
}

function showComponentInfo(id) {
  const c = COMPONENTS[id];
  if (!c) return;
  setNetGlow(null, false); selectedNet = null;

  const panel = document.querySelector('[data-panel="explorer"]');
  const infoEl = document.getElementById('explorer-info');
  infoEl.innerHTML = `
    <div class="hw-card glass accent-border" style="margin-bottom:12px">
      <div class="hw-card-header">
        <h4>${c.name}</h4>
        <span class="hw-card-price">${c.price}</span>
      </div>
      <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:10px">${c.tag}</p>
      <ul style="list-style:none;display:flex;flex-direction:column;gap:6px">
        ${c.roles.map(r => `<li style="font-size:0.8rem;color:var(--text-secondary);padding-left:16px;position:relative"><span style="position:absolute;left:0;color:var(--teal)">▸</span>${r}</li>`).join('')}
      </ul>
      ${c.note ? `<div class="warning-box mt-12"><p>💡 ${c.note}</p></div>` : ''}
    </div>
  `;

  // Switch to explorer panel
  setActivePanel('explorer');
  setActiveSidebar('explorer');
}

function selectNet(id, showInfo) {
  selectedNet = id;
  setNetGlow(id, true);
  document.querySelectorAll('.net-wire, .net-header').forEach(el => {
    el.classList.toggle('active', el.dataset.net === id);
  });
  if (showInfo) {
    const n = NETS.find(x => x.id === id);
    if (n) {
      setActivePanel('connections');
      setActiveSidebar('connections');
    }
  }
}

// ============================================================
// SECTION 9: VIEWER CONTROLS
// ============================================================

function setupViewerControls() {
  const views = {
    front: { p: [0, 8, 30], t: [0, 5, 0] },
    back: { p: [0, 8, -30], t: [0, 5, 0] },
    left: { p: [-30, 8, 0], t: [0, 5, 0] },
    right: { p: [30, 8, 0], t: [0, 5, 0] },
    top: { p: [0, 40, 0.1], t: [0, 0, 0] },
    reset: { p: [2, 27, 36], t: [0, 1.5, 0] },
    robot: { p: [18, 20, 32], t: [0, 8.5, 0] },
  };

  function setView(name) {
    const v = views[name] || views.reset;
    const duration = 800;
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    const endPos = new THREE.Vector3(...v.p);
    const endTarget = new THREE.Vector3(...v.t);
    const startTime = performance.now();

    function animateCam(now) {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      camera.position.lerpVectors(startPos, endPos, ease);
      controls.target.lerpVectors(startTarget, endTarget, ease);
      if (t < 1) requestAnimationFrame(animateCam);
    }
    requestAnimationFrame(animateCam);
  }

  document.getElementById('vc-reset').addEventListener('click', () => setView(robotMode ? 'robot' : 'reset'));
  document.getElementById('vc-front').addEventListener('click', () => setView('front'));
  document.getElementById('vc-back').addEventListener('click', () => setView('back'));
  document.getElementById('vc-left').addEventListener('click', () => setView('left'));
  document.getElementById('vc-right').addEventListener('click', () => setView('right'));
  document.getElementById('vc-top').addEventListener('click', () => setView('top'));
  document.getElementById('vc-auto').addEventListener('click', function () {
    autoRotate = !autoRotate;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 1.5;
    this.classList.toggle('active', autoRotate);
  });
}

// ============================================================
// SECTION 10: SERVO CONTROLS
// ============================================================

function setupServoControls() {
  const panSlider = document.getElementById('servo-pan');
  const tiltSlider = document.getElementById('servo-tilt');
  const panVal = document.getElementById('servo-pan-val');
  const tiltVal = document.getElementById('servo-tilt-val');

  function applyPose() {
    const pan = ((panSlider.value - 90) * Math.PI) / 180;
    const tilt = ((90 - tiltSlider.value) * Math.PI) / 180;
    if (panHorn) panHorn.rotation.y = pan;
    if (tiltHorn) tiltHorn.rotation.x = tilt;
    if (robotData) {
      robotData.panPivot.rotation.y = pan;
      robotData.tiltPivot.rotation.x = tilt;
    }
    const monServos = document.getElementById('mon-servos');
    if (monServos) monServos.textContent = `Pan: ${panSlider.value}° / Tilt: ${tiltSlider.value}°`;
  }

  panSlider.addEventListener('input', () => {
    panVal.textContent = panSlider.value + '°';
    applyPose();
  });
  tiltSlider.addEventListener('input', () => {
    tiltVal.textContent = tiltSlider.value + '°';
    applyPose();
  });
}

// ============================================================
// SECTION 11: MODE TOGGLE
// ============================================================

function setupModeToggle() {
  const modeBtns = document.querySelectorAll('.mode-btn');
  const xrayControls = document.getElementById('xray-controls');
  const explodeSlider = document.getElementById('explode-slider');
  const explodeValue = document.getElementById('explode-value');
  const xrayBtn = document.getElementById('btn-xray');

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      robotMode = btn.dataset.mode === 'robot';

      workbenchGroup.visible = !robotMode;
      robotData.root.visible = robotMode;

      xrayControls.classList.toggle('hidden', !robotMode);

      if (!robotMode) {
        robotData.setExplosion(0);
        robotData.setXray(false);
        explodeSlider.value = 0;
        explodeValue.textContent = '0%';
        xrayBtn.classList.remove('active');
        xrayBtn.textContent = 'X-Ray OFF';
      }

      // Update camera
      const v = robotMode ? { p: [18, 20, 32], t: [0, 8.5, 0] } : { p: [2, 27, 36], t: [0, 1.5, 0] };
      camera.position.set(...v.p);
      controls.target.set(...v.t);

      syncLabels();
    });
  });

  // X-Ray
  xrayBtn.addEventListener('click', () => {
    xrayOn = !xrayOn;
    robotData.setXray(xrayOn);
    xrayBtn.classList.toggle('active', xrayOn);
    xrayBtn.textContent = xrayOn ? 'X-Ray ON' : 'X-Ray OFF';
    if (xrayOn) {
      robotData.setExplosion(0);
      explodeSlider.value = 0;
      explodeValue.textContent = '0%';
    }
  });

  // Explode
  explodeSlider.addEventListener('input', () => {
    const v = parseInt(explodeSlider.value);
    explodeValue.textContent = v + '%';
    robotData.setExplosion(v / 100);
  });

  // Labels
  document.getElementById('btn-xray');
}

function syncLabels() {
  labelObjs.forEach(l => {
    if (l.userData.xray) return;
    l.visible = labelsOn && !robotMode;
  });
}

// ============================================================
// SECTION 12: UI BUILDERS
// ============================================================

function buildConnectionsList() {
  const container = document.getElementById('connections-list');
  for (const net of NETS) {
    const wiresHtml = net.wires.map(w =>
      `<div class="net-wire" data-net="${net.id}">
        <span>${w.fromLabel}</span>
        <span class="net-arrow">→</span>
        <span>${w.toLabel}</span>
      </div>`
    ).join('');

    const group = document.createElement('div');
    group.className = 'net-group';
    group.innerHTML = `
      <div class="net-header" data-net="${net.id}">
        <span class="net-dot" style="background:${net.color};color:${net.color}"></span>
        <span class="net-name">${net.short}</span>
        <span class="net-count">${net.wires.length} wire${net.wires.length > 1 ? 's' : ''}</span>
      </div>
      <div class="net-wires">
        <div class="net-desc">${net.desc}</div>
        ${wiresHtml}
      </div>
    `;

    // Hover/click on header
    const header = group.querySelector('.net-header');
    header.addEventListener('mouseenter', () => setNetGlow(net.id, true));
    header.addEventListener('mouseleave', () => setNetGlow(selectedNet, !!selectedNet));
    header.addEventListener('click', () => {
      if (selectedNet === net.id) {
        selectedNet = null;
        setNetGlow(null, false);
        group.classList.remove('active');
      } else {
        selectNet(net.id, false);
        container.querySelectorAll('.net-group').forEach(g => g.classList.remove('active'));
        group.classList.add('active');
      }
    });

    container.appendChild(group);
  }
}

function buildHardwareCards() {
  const container = document.getElementById('hardware-cards');
  for (const [id, c] of Object.entries(COMPONENTS)) {
    const card = document.createElement('div');
    card.className = 'hw-card glass';
    card.innerHTML = `
      <div class="hw-card-header">
        <h4>${c.name}</h4>
        <span class="hw-card-price">${c.price}</span>
      </div>
      <p>${c.tag}</p>
      <div class="hw-card-pins">
        ${c.pins.map(p => {
          let cls = '';
          if (p.includes('SDA') || p.includes('SCL') || p.includes('I2C')) cls = 'i2c';
          else if (p.includes('3V') || p.includes('VCC') || p.includes('5V') || p.includes('V+')) cls = 'power';
          else if (p.includes('GND')) cls = 'ground';
          else if (p.includes('CH') || p.includes('Sig')) cls = 'pwm';
          return `<span class="hw-pin ${cls}">${p}</span>`;
        }).join('')}
      </div>
    `;
    card.addEventListener('click', () => showComponentInfo(id));
    container.appendChild(card);
  }
}

function buildPinTable() {
  const tbody = document.querySelector('#pin-table tbody');
  for (const row of PIN_MAP) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="pin-comp">${row.comp}</td>
      <td>${row.pin}</td>
      <td>${row.type}</td>
      <td>${row.purpose}</td>
      <td class="pin-volt">${row.volt}</td>
    `;
    tbody.appendChild(tr);
  }
}

// ============================================================
// SECTION 13: DASHBOARD NAVIGATION
// ============================================================

function initDashboard() {
  // Sidebar buttons
  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setActiveSidebar(btn.dataset.section);
      setActivePanel(btn.dataset.section);

      // Update nav links too
      document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.dataset.section === btn.dataset.section);
      });
    });
  });

  // Nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      setActiveSidebar(link.dataset.section);
      setActivePanel(link.dataset.section);
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  // Mobile nav toggle
  document.getElementById('nav-toggle').addEventListener('click', () => {
    document.getElementById('nav-links').classList.toggle('open');
  });

  // Block diagram hover -> highlight 3D
  document.querySelectorAll('.block').forEach(block => {
    block.addEventListener('click', () => {
      const comp = block.dataset.block;
      if (comp && COMPONENTS[comp]) showComponentInfo(comp);
    });
  });
}

function setActiveSidebar(section) {
  document.querySelectorAll('.sidebar-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.section === section);
  });
}

function setActivePanel(section) {
  document.querySelectorAll('.panel-content').forEach(p => {
    p.classList.toggle('active', p.dataset.panel === section);
  });
}

// ============================================================
// SECTION 14: ANIMATION LOOP
// ============================================================

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

function onResize() {
  const container = document.getElementById('three-container');
  if (!container) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
}

// ============================================================
// SECTION 15: INITIALIZATION
// ============================================================

// Check for reduced motion preference
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Start
if (prefersReducedMotion) {
  // Skip boot animation
  document.getElementById('boot-screen').classList.add('hidden');
  showIntro();
} else {
  runBootSequence();
}

// URL params for deep-linking
const qp = new URLSearchParams(location.search);
if (qp.get('view') === 'explorer') {
  // Will be applied after site loads
}
