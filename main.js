import { AppScene } from './scene.js';
import { HandTracker } from './tracker.js';

import { ParticlesMode } from './modes/particles.js';
import { DrawMode } from './modes/draw.js';
import { StringsMode } from './modes/strings.js';

const videoElement = document.getElementById('webcam');
const statusText = document.getElementById('status-text');
const modeSelector = document.getElementById('mode-selector');
const instructions = document.getElementById('mode-instructions');
const buttons = document.querySelectorAll('#mode-selector button');

let appScene, handTracker;
let activeMode = null;
let modes = {};

async function init() {
  try {
    statusText.innerText = "Initializing Camera...";
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 1280,
        height: 720,
        facingMode: "user"
      }
    });
    videoElement.srcObject = stream;
    
    // Wait for video to be ready
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        resolve(videoElement);
      };
    });

    statusText.innerText = "Initializing AI Models...";
    handTracker = new HandTracker();
    await handTracker.init();

    appScene = new AppScene();
    
    modes = {
      'particles': new ParticlesMode(appScene),
      'draw': new DrawMode(appScene),
      'strings': new StringsMode(appScene)
    };

    modeSelector.style.display = 'flex';
    statusText.innerText = "Ready!";
    
    switchMode('particles');

    // UI listeners
    buttons.forEach(button => {
      button.addEventListener('click', (e) => {
        buttons.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        switchMode(e.target.dataset.mode);
      });
    });

    requestAnimationFrame(renderLoop);
  } catch (error) {
    statusText.innerText = "Error: " + error.message;
    console.error(error);
  }
}

function switchMode(modeKey) {
  if (activeMode) {
    activeMode.cleanup();
  }
  
  activeMode = modes[modeKey];
  activeMode.init();

  if (modeKey === 'particles') {
    instructions.innerText = "Glowing Particles: Move your hands. Clench your fist to scatter particles.";
  } else if (modeKey === 'draw') {
    instructions.innerText = "Air Drawing: Use your index finger to draw in 3D. Pinch thumb and index to clear the canvas.";
  } else if (modeKey === 'strings') {
    instructions.innerText = "Elastic Strings: Use both hands to see glowing strings connect your fingertips.";
  }
}

function renderLoop() {
  requestAnimationFrame(renderLoop);

  if (handTracker && activeMode) {
    const results = handTracker.detect(videoElement);
    if (results && results.landmarks) {
      activeMode.update(results.landmarks);
    }
  }

  appScene.render();
}

window.onload = () => {
  init();
};
