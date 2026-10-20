import * as THREE from 'three';

// ============================================================
// سیستم VFX — استخر ذرات + صاعقه + حلقه انفجار + دایره جادو
// بهینه برای موبایل: Points مشترک + Pool
// ============================================================

interface Particle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  size: number;
  color: THREE.Color;
  gravity: number;
  drag: number;
}

interface Bolt {
  line: THREE.Line;
  life: number;
  maxLife: number;
}

interface Ring {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  grow: number;
}

interface Circle {
  mesh: THREE.Group;
  life: number;
  maxLife: number;
  total: number;
}

export class VFXSystem {
  private scene: THREE.Scene;
  private particles: Particle[] = [];
  private pointsMesh: THREE.Points;
  private posAttr: THREE.BufferAttribute;
  private colAttr: THREE.BufferAttribute;
  private sizeAttr: THREE.BufferAttribute;
  private maxParticles = 900;
  private bolts: Bolt[] = [];
  private rings: Ring[] = [];
  private circles: Circle[] = [];
  private boltPool: Bolt[] = [];
  private ringPool: Ring[] = [];
  private flashes: { light: THREE.PointLight; life: number }[] = [];
  private flashPool: THREE.PointLight[] = [];
  particleScale = 1;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // --- ذرات ---
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(new Float32Array(this.maxParticles * 3), 3);
    this.colAttr = new THREE.BufferAttribute(new Float32Array(this.maxParticles * 3), 3);
    this.sizeAttr = new THREE.BufferAttribute(new Float32Array(this.maxParticles), 1);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    geo.setAttribute('size', this.sizeAttr);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {},
      vertexShader: `
        attribute float size;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (140.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          float a = smoothstep(0.5, 0.05, d);
          gl_FragColor = vec4(vColor, a);
        }`,
      vertexColors: true,
    });
    this.pointsMesh = new THREE.Points(geo, mat);
    this.pointsMesh.frustumCulled = false;
    scene.add(this.pointsMesh);
  }

  // ------------------- ذرات -------------------

  burst(pos: THREE.Vector3, color: number, count: number, opts?: {
    speed?: number; life?: number; size?: number; gravity?: number; up?: number; spread?: number;
  }) {
    const n = Math.max(1, Math.round(count * this.particleScale));
    const speed = opts?.speed ?? 6;
    const life = opts?.life ?? 0.6;
    const size = opts?.size ?? 0.5;
    const gravity = opts?.gravity ?? 6;
    const up = opts?.up ?? 0.5;
    const spread = opts?.spread ?? Math.PI * 2;
    const col = new THREE.Color(color);

    for (let i = 0; i < n; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const dir = new THREE.Vector3(
        Math.cos(Math.random() * spread) * Math.sin(Math.random() * Math.PI),
        up + Math.random() * 0.8,
        Math.sin(Math.random() * spread) * Math.sin(Math.random() * Math.PI)
      ).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.7));
      this.particles.push({
        pos: pos.clone(),
        vel: dir,
        life,
        maxLife: life,
        size: size * (0.6 + Math.random() * 0.8),
        color: col.clone().offsetHSL(0, 0, (Math.random() - 0.5) * 0.15),
        gravity,
        drag: 0.98,
      });
    }
  }

  hitSpark(pos: THREE.Vector3, color: number) {
    this.burst(pos, color, 5, { speed: 4, life: 0.25, size: 0.35, gravity: 4 });
  }

  explosion(pos: THREE.Vector3, color: number, big = false) {
    this.burst(pos, color, big ? 40 : 22, { speed: big ? 11 : 7, life: 0.7, size: big ? 0.9 : 0.6, gravity: 8 });
    this.burst(pos, 0x552211, big ? 16 : 9, { speed: big ? 5 : 3, life: 1.0, size: 1.1, gravity: 1, up: 0.9 });
    this.ring(pos, color, big ? 4.5 : 2.6, 0.4);
    this.flash(pos, color, big ? 26 : 12);
  }

  // ------------------- صاعقه -------------------

  bolt(from: THREE.Vector3, to: THREE.Vector3, color = 0x9d6bff, thick = false) {
    const b = this.boltPool.pop() ?? this.createBolt();
    const positions = b.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    const segs = 14;
    const dir = to.clone().sub(from);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = from.clone().addScaledVector(dir, t);
      if (i > 0 && i < segs) {
        p.x += (Math.random() - 0.5) * 1.6;
        p.y += (Math.random() - 0.5) * 1.2;
        p.z += (Math.random() - 0.5) * 1.6;
      }
      positions.setXYZ(i, p.x, p.y, p.z);
    }
    positions.needsUpdate = true;
    const mat = b.line.material as THREE.LineBasicMaterial;
    mat.color.setHex(color);
    mat.opacity = 1;
    b.line.visible = true;
    b.life = b.maxLife = 0.22;
    this.bolts.push(b);

    // رگبار جرقه در نقطه برخورد
    this.burst(to, color, thick ? 24 : 12, { speed: 5, life: 0.35, size: 0.45, gravity: 5 });
    this.flash(to, color, thick ? 18 : 9);
  }

  private createBolt(): Bolt {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(15 * 3), 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x9d6bff,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    line.visible = false;
    this.scene.add(line);
    return { line, life: 0, maxLife: 0.22 };
  }

  // ------------------- حلقه -------------------

  ring(pos: THREE.Vector3, color: number, maxRadius: number, life = 0.5) {
    const r = this.ringPool.pop() ?? this.createRing();
    (r.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
    r.mesh.position.copy(pos);
    r.mesh.position.y = 0.15;
    r.mesh.scale.setScalar(0.3);
    r.mesh.visible = true;
    r.life = r.maxLife = life;
    r.grow = maxRadius;
    this.rings.push(r);
  }

  private createRing(): Ring {
    const geo = new THREE.RingGeometry(0.8, 1, 40);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    this.scene.add(mesh);
    return { mesh, life: 0, maxLife: 0.5, grow: 3 };
  }

  // ------------------- فلش نور -------------------

  private flash(pos: THREE.Vector3, color: number, intensity: number) {
    const l = this.flashPool.pop() ?? (() => {
      const light = new THREE.PointLight(0xffffff, 0, 20, 1.8);
      this.scene.add(light);
      return light;
    })();
    l.color.setHex(color);
    l.intensity = intensity * this.particleScale;
    l.position.copy(pos).add(new THREE.Vector3(0, 2, 0));
    this.flashes.push({ light: l, life: 0.25 });
  }

  // ------------------- دایره جادو -------------------

  magicCircle(pos: THREE.Vector3, color: number, radius: number, duration: number) {
    const group = new THREE.Group();
    const tex = runeTexture(color);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), mat);
    plane.rotation.x = -Math.PI / 2;
    group.add(plane);
    group.position.set(pos.x, 0.25, pos.z);
    this.scene.add(group);
    this.circles.push({ mesh: group, life: 0, maxLife: duration, total: duration });
  }

  // ------------------- بروزرسانی -------------------

  update(dt: number) {
    // ذرات
    const pos = this.posAttr.array as Float32Array;
    const col = this.colAttr.array as Float32Array;
    const size = this.sizeAttr.array as Float32Array;
    let n = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(p.drag);
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.05) p.pos.y = 0.05;
      const k = p.life / p.maxLife;
      pos[n * 3] = p.pos.x;
      pos[n * 3 + 1] = p.pos.y;
      pos[n * 3 + 2] = p.pos.z;
      col[n * 3] = p.color.r * k;
      col[n * 3 + 1] = p.color.g * k;
      col[n * 3 + 2] = p.color.b * k;
      size[n] = p.size * (0.4 + k * 0.6);
      n++;
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.pointsMesh.geometry.setDrawRange(0, n);

    // صاعقه‌ها
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.life -= dt;
      const mat = b.line.material as THREE.LineBasicMaterial;
      mat.opacity = Math.max(0, b.life / b.maxLife);
      if (b.life <= 0) {
        b.line.visible = false;
        this.bolts.splice(i, 1);
        this.boltPool.push(b);
      }
    }

    // حلقه‌ها
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const k = 1 - r.life / r.maxLife;
      r.mesh.scale.setScalar(0.3 + k * r.grow);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      if (r.life <= 0) {
        r.mesh.visible = false;
        this.rings.splice(i, 1);
        this.ringPool.push(r);
      }
    }

    // فلش‌ها
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      f.light.intensity *= Math.pow(0.0001, dt);
      if (f.life <= 0) {
        f.light.intensity = 0;
        this.flashes.splice(i, 1);
        this.flashPool.push(f.light);
      }
    }

    // دایره‌های جادو
    for (let i = this.circles.length - 1; i >= 0; i--) {
      const c = this.circles[i];
      c.life += dt;
      const k = c.life / c.total;
      const mat = (c.mesh.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
      mat.opacity = k < 0.15 ? k / 0.15 : Math.max(0, 1 - (k - 0.7) / 0.3);
      c.mesh.rotation.y += dt * 0.8;
      const s = k < 0.15 ? 0.5 + (k / 0.15) * 0.5 : 1;
      c.mesh.scale.setScalar(s);
      if (c.life >= c.total) {
        const m = (c.mesh.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial;
        m.map?.dispose();
        m.dispose();
        (c.mesh.children[0] as THREE.Mesh).geometry.dispose();
        this.scene.remove(c.mesh);
        this.circles.splice(i, 1);
      }
    }
  }

  clearAll() {
    this.particles.length = 0;
    this.pointsMesh.geometry.setDrawRange(0, 0);

    // Return pooled effects to their pools so a scene reset cannot leave
    // stale flashes/rings/bolts visible or grow the live arrays indefinitely.
    for (const bolt of this.bolts) {
      bolt.line.visible = false;
      bolt.life = 0;
      this.boltPool.push(bolt);
    }
    this.bolts.length = 0;

    for (const ring of this.rings) {
      ring.mesh.visible = false;
      ring.life = 0;
      this.ringPool.push(ring);
    }
    this.rings.length = 0;

    for (const flash of this.flashes) {
      flash.light.intensity = 0;
      flash.life = 0;
      this.flashPool.push(flash.light);
    }
    this.flashes.length = 0;

    // Rune textures are unique per circle. Dispose them immediately on reset
    // rather than waiting for their normal lifetime to expire.
    for (const circle of this.circles) {
      const plane = circle.mesh.children[0] as THREE.Mesh | undefined;
      if (plane) {
        const material = plane.material as THREE.MeshBasicMaterial;
        material.map?.dispose();
        material.dispose();
        plane.geometry.dispose();
      }
      this.scene.remove(circle.mesh);
    }
    this.circles.length = 0;
  }
}

/** بافت دایره جادو با رون‌های اورجینال (Canvas) */
function runeTexture(color: number): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const col = '#' + color.toString(16).padStart(6, '0');
  ctx.clearRect(0, 0, 256, 256);
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 3;
  ctx.shadowColor = col;
  ctx.shadowBlur = 12;

  // دایره بیرونی و داخلی
  ctx.beginPath();
  ctx.arc(128, 128, 120, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, 128, 86, 0, Math.PI * 2);
  ctx.stroke();

  // رون‌های اورجینال — خطوط هندسی تصادفی-but-deterministic
  const rnd = mulberry32(42);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = 128 + Math.cos(a) * 103;
    const y = 128 + Math.sin(a) * 103;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rnd() * Math.PI);
    ctx.beginPath();
    const pattern = Math.floor(rnd() * 3);
    if (pattern === 0) {
      ctx.moveTo(-7, 6); ctx.lineTo(0, -7); ctx.lineTo(7, 6); ctx.lineTo(0, 2); ctx.closePath();
    } else if (pattern === 1) {
      ctx.moveTo(-6, -6); ctx.lineTo(6, 6); ctx.moveTo(6, -6); ctx.lineTo(-6, 6);
    } else {
      ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.moveTo(-5, -3); ctx.lineTo(5, -3);
    }
    ctx.stroke();
    ctx.restore();
  }

  // خطوط نوری متصل
  ctx.globalAlpha = 0.65;
  for (let i = 0; i < 8; i++) {
    const a1 = (i / 8) * Math.PI * 2;
    const a2 = ((i + 3) / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a1) * 86, 128 + Math.sin(a1) * 86);
    ctx.lineTo(128 + Math.cos(a2) * 86, 128 + Math.sin(a2) * 86);
    ctx.stroke();
  }
  // هسته مرکزی
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(128, 128, 14, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
