import * as THREE from 'three';

export class DrawMode {
  constructor(appScene) {
    this.appScene = appScene;
    this.maxDots = 20000;
    this.dotCount = 0;
    this.points = null;

    // Position tracking
    this.lastPosition = new THREE.Vector3(0, 0, 10000);

    // Pre-allocate flat arrays for positions and colors
    this.positions = new Float32Array(this.maxDots * 3);
    this.colors = new Float32Array(this.maxDots * 3);
  }

  init() {
    const geometry = new THREE.BufferGeometry();

    // Fixed-size attributes; setDrawRange controls how many are rendered
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3)
    );
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3)
    );
    geometry.setDrawRange(0, 0); // nothing visible yet

    // PointsMaterial with vertexColors is the simplest, most reliable
    // way to render per-point colored dots in Three.js. No InstancedMesh
    // complexity, no instanceColor quirks — it just works.
    const material = new THREE.PointsMaterial({
      size: 8,                          // screen-space pixels (sizeAttenuation false)
      sizeAttenuation: false,           // constant size regardless of depth
      vertexColors: true,               // use per-point color attribute
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.appScene.scene.add(this.points);
  }

  update(landmarks) {
    if (!this.points) return;

    if (landmarks.length > 0) {
      const hand = landmarks[0];
      const aspect = window.innerWidth / window.innerHeight;

      const mapLandmark = (lm) =>
        new THREE.Vector3(
          -(lm.x - 0.5) * 12 * aspect,
          -(lm.y - 0.5) * 12,
          -lm.z * 5   // reduced Z so dots always stay well in front of camera
        );

      const indexTip = mapLandmark(hand[8]);

      // Pinch to clear (normalized landmark space)
      const dx = hand[8].x - hand[4].x;
      const dy = hand[8].y - hand[4].y;
      if (Math.sqrt(dx * dx + dy * dy) < 0.05) {
        this.clearCanvas();
        return;
      }

      // Add a dot only if finger moved enough
      if (
        this.lastPosition.distanceTo(indexTip) > 0.05 &&
        this.dotCount < this.maxDots
      ) {
        const i = this.dotCount;

        // Write position into buffer
        this.positions[i * 3 + 0] = indexTip.x;
        this.positions[i * 3 + 1] = indexTip.y;
        this.positions[i * 3 + 2] = indexTip.z;

        // Cycle hue over time for a neon rainbow trail
        const hue = (performance.now() * 0.0003) % 1.0;
        const c = new THREE.Color().setHSL(hue, 1.0, 0.65);
        this.colors[i * 3 + 0] = c.r;
        this.colors[i * 3 + 1] = c.g;
        this.colors[i * 3 + 2] = c.b;

        this.dotCount++;

        // Expand draw range and flag buffers dirty
        this.points.geometry.setDrawRange(0, this.dotCount);
        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.color.needsUpdate = true;

        this.lastPosition.copy(indexTip);
      }
    } else {
      // Tracking lost — break stroke so next one starts cleanly
      this.lastPosition.set(0, 0, 10000);
    }
  }

  clearCanvas() {
    this.dotCount = 0;
    this.points.geometry.setDrawRange(0, 0);
    this.lastPosition.set(0, 0, 10000);
  }

  cleanup() {
    this.appScene.clear();
    this.points = null;
    this.dotCount = 0;
    this.lastPosition.set(0, 0, 10000);
  }
}