import * as THREE from 'three';

export class StringsMode {
  constructor(appScene) {
    this.appScene = appScene;
    this.lines = null;
    this.positions = new Float32Array(21 * 2 * 3); // 21 landmarks * 2 vertices per line * 3 coordinates
    this.colors = new Float32Array(21 * 2 * 3);
  }
  
  init() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    
    // Set colors statically based on landmark ID for a rainbow effect
    for (let i = 0; i < 21; i++) {
        const color = new THREE.Color();
        color.setHSL(i / 21, 1.0, 0.6); // Rainbow spread
        
        // Point A
        color.toArray(this.colors, i * 6);
        // Point B
        color.toArray(this.colors, i * 6 + 3);
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        linewidth: 2 // Note: WebGL standard restricts linewidth to 1 on many systems, but it looks good enough with additive blending.
    });

    this.lines = new THREE.LineSegments(geometry, material);
    
    // Hide initially
    this.lines.position.set(0,0,1000);
    this.appScene.scene.add(this.lines);
  }

  update(landmarks) {
    if (!this.lines) return;

    if (landmarks.length >= 2) {
        this.lines.position.set(0,0,0);
        
        const hand1 = landmarks[0];
        const hand2 = landmarks[1];
        const aspect = window.innerWidth / window.innerHeight;

        const mapLandmark = (lm) => {
            return new THREE.Vector3(
                -(lm.x - 0.5) * 12 * aspect,
                -(lm.y - 0.5) * 12,
                -lm.z * 15
            );
        };

        // Draw line between every pair of corresponding landmarks
        const posAttribute = this.lines.geometry.attributes.position;

        for (let i = 0; i < 21; i++) {
            const p1 = mapLandmark(hand1[i]);
            const p2 = mapLandmark(hand2[i]);

            posAttribute.setXYZ(i * 2, p1.x, p1.y, p1.z);
            posAttribute.setXYZ(i * 2 + 1, p2.x, p2.y, p2.z);
        }

        posAttribute.needsUpdate = true;
    } else {
        // Hide lines if < 2 hands detect
        this.lines.position.set(0,0,1000);
    }
  }

  cleanup() {
    this.appScene.clear();
    this.lines = null;
  }
}
