import * as THREE from 'three';

export class ParticlesMode {
    constructor(appScene) {
        this.appScene = appScene;
        this.particleCount = 10000;
        this.particles = null;
        this.dummy = new THREE.Object3D();

        // Physics data: px, py, pz, vx, vy, vz
        this.physics = new Float32Array(this.particleCount * 6);

        // Colors
        this.colors = new Float32Array(this.particleCount * 3);
        const color = new THREE.Color();

        for (let i = 0; i < this.particleCount; i++) {
            this.physics[i * 6 + 0] = (Math.random() - 0.5) * 20;
            this.physics[i * 6 + 1] = (Math.random() - 0.5) * 20;
            this.physics[i * 6 + 2] = (Math.random() - 0.5) * 5;
            this.physics[i * 6 + 3] = 0;
            this.physics[i * 6 + 4] = 0;
            this.physics[i * 6 + 5] = 0;

            const hue = Math.random() > 0.5 ? 0.5 + Math.random() * 0.1 : 0.8 + Math.random() * 0.1;
            color.setHSL(hue, 1.0, 0.7);
            color.toArray(this.colors, i * 3);
        }
    }

    init() {
        const geometry = new THREE.PlaneGeometry(0.3, 0.3);

        // Soft circle texture
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);
        const texture = new THREE.CanvasTexture(canvas);

        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.particles = new THREE.InstancedMesh(geometry, material, this.particleCount);
        this.particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const tmpColor = new THREE.Color();
        for (let i = 0; i < this.particleCount; i++) {
            tmpColor.fromArray(this.colors, i * 3);
            this.particles.setColorAt(i, tmpColor);

            this.dummy.position.set(
                this.physics[i * 6 + 0],
                this.physics[i * 6 + 1],
                this.physics[i * 6 + 2]
            );
            this.dummy.updateMatrix();
            this.particles.setMatrixAt(i, this.dummy.matrix);
        }

        this.particles.instanceMatrix.needsUpdate = true;
        this.particles.instanceColor.needsUpdate = true;
        this.appScene.scene.add(this.particles);
    }

    update(landmarks) {
        if (!this.particles) return;

        const aspect = window.innerWidth / window.innerHeight;

        let targets = [];
        let isFist = false;

        // BUG FIX: handCenter must be freshly created each frame.
        // The original code declared it once but called .add() on it every frame
        // without resetting, causing it to accumulate and drift infinitely.
        let handCenter = new THREE.Vector3();

        if (landmarks.length > 0) {
            const hand = landmarks[0];

            const mapLandmark = (lm) => {
                return new THREE.Vector3(
                    -(lm.x - 0.5) * 12 * aspect,
                    -(lm.y - 0.5) * 12,
                    -lm.z * 15
                );
            };

            const wrist = mapLandmark(hand[0]);
            const tips = [
                mapLandmark(hand[4]),  // thumb
                mapLandmark(hand[8]),  // index
                mapLandmark(hand[12]), // middle
                mapLandmark(hand[16]), // ring
                mapLandmark(hand[20]), // pinky
            ];

            targets = tips;

            // Compute hand center correctly each frame
            hand.forEach(lm => {
                handCenter.add(mapLandmark(lm));
            });
            handCenter.divideScalar(hand.length);

            // Fist detection: avg distance of fingertips from wrist
            let avgDist = 0;
            tips.forEach(t => avgDist += t.distanceTo(wrist));
            avgDist /= tips.length;

            isFist = avgDist < 2.5;
        }

        const time = performance.now() * 0.001;

        for (let i = 0; i < this.particleCount; i++) {
            const px = this.physics[i * 6 + 0];
            const py = this.physics[i * 6 + 1];
            const pz = this.physics[i * 6 + 2];
            let vx = this.physics[i * 6 + 3];
            let vy = this.physics[i * 6 + 4];
            let vz = this.physics[i * 6 + 5];

            let tx = 0, ty = 0, tz = 0;
            let force = 0.1;

            if (isFist) {
                // Scatter outward from hand center
                const dx = px - handCenter.x;
                const dy = py - handCenter.y;
                const dz = pz - handCenter.z;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.1;

                tx = px + dx / dist * 5;
                ty = py + dy / dist * 5;
                tz = Math.random() * 5 - 2.5;
                force = 0.5;
            } else if (targets.length > 0) {
                // BUG FIX: force was 0.02 (too weak) — particles barely responded
                // to hand movement, making them look like they wander on their own.
                // Increased to 0.1 so particles snap to fingertips responsively.
                const targetIdx = i % targets.length;
                const t = targets[targetIdx];

                // Small noise so particles feel alive, not robotic
                const noiseX = Math.sin(time * 2 + i) * 0.3;
                const noiseY = Math.cos(time * 2 + i) * 0.3;
                const noiseZ = Math.sin(time * 3 + i) * 0.2;

                tx = t.x + noiseX;
                ty = t.y + noiseY;
                tz = t.z + noiseZ;
                force = 0.10; // was 0.02 — raised for snappy hand tracking
            } else {
                // Idle wander when no hand detected
                tx = Math.sin(time * 0.5 + i) * 5;
                ty = Math.cos(time * 0.5 + i) * 5;
                tz = Math.sin(time * 0.2 + i) * 2;
                force = 0.01;
            }

            // Update velocity with spring force toward target
            vx += (tx - px) * force;
            vy += (ty - py) * force;
            vz += (tz - pz) * force;

            // Friction / damping
            vx *= 0.88;
            vy *= 0.88;
            vz *= 0.88;

            // Update position
            this.physics[i * 6 + 0] = px + vx;
            this.physics[i * 6 + 1] = py + vy;
            this.physics[i * 6 + 2] = pz + vz;
            this.physics[i * 6 + 3] = vx;
            this.physics[i * 6 + 4] = vy;
            this.physics[i * 6 + 5] = vz;

            this.dummy.position.set(px + vx, py + vy, pz + vz);
            this.dummy.rotation.set(0, 0, 0);
            this.dummy.updateMatrix();
            this.particles.setMatrixAt(i, this.dummy.matrix);
        }

        this.particles.instanceMatrix.needsUpdate = true;
    }

    cleanup() {
        this.appScene.clear();
        this.particles = null;
    }
}