import * as THREE from "../vendor/three.module.min.js";
import {
  CHECKPOINT,
  DECOR,
  GOAL,
  PLATFORMS,
  SWITCHES,
  platformsFor,
  surfaceAt,
} from "./world-data.js";
import { MOVE_SPEED } from "./physics.js";

const COLORS = {
  skyTop: "#7cc9cf",
  skyBottom: "#f6e9c9",
  fog: "#c3e4dd",
  grass: "#79b76b",
  grassLight: "#8ac77a",
  grassDark: "#5e9c57",
  dirt: "#9b6b49",
  dirtDark: "#7d5439",
  rock: "#777a74",
  rockDark: "#575d5a",
  wood: "#a87544",
  woodDark: "#7a5030",
  ink: "#18251f",
  paper: "#f3ecdd",
  jade: "#0f6555",
  red: "#c84a31",
  mustard: "#d9a52c",
  cloud: "#fffdf4",
  checkpoint: "#7f8f88",
  checkpointActive: "#e0a62b",
};

const SWITCH_COLORS = ["#e36549", "#297e6d"];

function canvasTexture(width, height, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function makeSkyTexture() {
  return canvasTexture(32, 512, (ctx, width, height) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, COLORS.skyTop);
    gradient.addColorStop(0.52, "#bfe4df");
    gradient.addColorStop(1, COLORS.skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  });
}

function makeNameTexture(name, color, local) {
  return canvasTexture(512, 128, (ctx, width) => {
    ctx.clearRect(0, 0, width, 128);
    ctx.fillStyle = "rgba(24, 37, 31, 0.92)";
    roundedRect(ctx, 18, 22, width - 36, 82, 18);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(57, 63, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#faf4e8";
    ctx.font = '600 34px "Be Vietnam Pro", "Segoe UI", sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(Array.from(name).slice(0, 16).join(""), 88, 65, 312);
    if (local) {
      ctx.fillStyle = "#f4e7be";
      ctx.font = '600 18px "IBM Plex Mono", Consolas, monospace';
      ctx.textAlign = "right";
      ctx.fillText("BẠN", width - 42, 65);
    }
  });
}

function makeSignTexture(text, options = {}) {
  const bg = options.bg ?? COLORS.paper;
  const fg = options.fg ?? COLORS.ink;
  return canvasTexture(512, 176, (ctx, width, height) => {
    ctx.fillStyle = bg;
    roundedRect(ctx, 8, 8, width - 16, height - 16, 18);
    ctx.fill();
    ctx.strokeStyle = fg;
    ctx.lineWidth = 6;
    roundedRect(ctx, 18, 18, width - 36, height - 36, 12);
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.font = '600 74px "Fraunces", Georgia, serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, width / 2, height / 2 + 4);
  });
}

function textSprite(texture, width, height) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(width, height, 1);
  sprite.renderOrder = 20;
  return sprite;
}

function makeMat(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.86,
    metalness: 0,
    flatShading: options.flatShading ?? true,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 1,
    side: options.side ?? THREE.FrontSide,
  });
}

function addOutline(mesh, color = COLORS.ink, opacity = 0.24) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, 28),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  );
  edges.renderOrder = 1;
  mesh.add(edges);
  return edges;
}

export class IslandAvatar {
  constructor({ id, name, color, isLocal }) {
    this.id = id;
    this.isLocal = isLocal;
    this.name = name;
    this.color = color;
    this.group = new THREE.Group();
    this.group.userData.playerId = id;
    this.target = { x: 0, y: 0, z: 0, yaw: 0, grounded: true, atGoal: false };
    this.position = { x: 0, y: 0, z: 0, yaw: 0 };
    this.initialized = false;
    this.animTime = Math.random() * Math.PI * 2;
    this.walkBlend = 0;
    this.airBlend = 0;

    this.parts = {};
    this.build();
    this.label = textSprite(makeNameTexture(name, color, isLocal), 2.55, 0.64);
    this.label.position.set(0, 2.17, 0);
    this.group.add(this.label);

    if (isLocal) {
      this.arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.13, 0.3, 4),
        new THREE.MeshBasicMaterial({ color: "#fff6d8" })
      );
      this.arrow.rotation.x = Math.PI;
      this.arrow.position.set(0, 2.52, 0);
      this.group.add(this.arrow);
    }

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.46, 22),
      new THREE.MeshBasicMaterial({
        color: "#24352e",
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      })
    );
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 2;

    this.arrivalRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.045, 6, 24),
      new THREE.MeshBasicMaterial({ color: COLORS.mustard, transparent: true, opacity: 0 })
    );
    this.arrivalRing.rotation.x = -Math.PI / 2;
    this.arrivalRing.position.y = 0.035;
    this.group.add(this.arrivalRing);
  }

  build() {
    const bodyMat = makeMat(this.color);
    const skinMat = makeMat("#e9bf99");
    const darkMat = makeMat("#293b35");
    const shoeMat = makeMat("#4c3c31");
    const packMat = makeMat(COLORS.woodDark);
    const paperMat = makeMat(COLORS.paper);

    const body = new THREE.Group();
    body.position.y = 0.02;
    this.group.add(body);
    this.parts.body = body;

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.29, 0.42, 5, 9), bodyMat);
    torso.position.y = 0.82;
    addOutline(torso);
    body.add(torso);
    this.parts.torso = torso;

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 10), skinMat);
    head.position.set(0, 1.37, 0.02);
    addOutline(head);
    body.add(head);
    this.parts.head = head;

    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.055, 12), darkMat);
    hatBrim.position.set(0, 1.62, 0);
    body.add(hatBrim);
    const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.28, 0.19, 10), bodyMat);
    hatTop.position.set(0, 1.72, 0);
    addOutline(hatTop);
    body.add(hatTop);

    const eyeGeo = new THREE.SphereGeometry(0.038, 7, 6);
    for (const x of [-0.105, 0.105]) {
      const eye = new THREE.Mesh(eyeGeo, darkMat);
      eye.position.set(x, 1.4, 0.292);
      body.add(eye);
    }
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 5, 12, Math.PI), darkMat);
    smile.position.set(0, 1.32, 0.3);
    smile.rotation.z = Math.PI;
    body.add(smile);

    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.48, 0.19), packMat);
    pack.position.set(0, 0.87, -0.29);
    addOutline(pack);
    body.add(pack);
    const packTop = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.12), paperMat);
    packTop.position.set(0, 1.04, -0.38);
    body.add(packTop);

    const limbGeo = new THREE.CapsuleGeometry(0.073, 0.27, 4, 7);
    for (const [side, x] of [
      ["left", -0.29],
      ["right", 0.29],
    ]) {
      const arm = new THREE.Mesh(limbGeo, bodyMat);
      arm.position.set(x, 1.05, 0);
      arm.rotation.z = side === "left" ? 0.24 : -0.24;
      addOutline(arm);
      body.add(arm);
      this.parts[`${side}Arm`] = arm;
    }

    const legGeo = new THREE.CapsuleGeometry(0.085, 0.23, 4, 7);
    for (const [side, x] of [
      ["left", -0.145],
      ["right", 0.145],
    ]) {
      const leg = new THREE.Mesh(legGeo, darkMat);
      leg.position.set(x, 0.31, 0);
      body.add(leg);
      this.parts[`${side}Leg`] = leg;
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.1, 0.27), shoeMat);
      shoe.position.set(x, 0.1, 0.055);
      body.add(shoe);
      this.parts[`${side}Shoe`] = shoe;
    }
  }

  setTarget(pose) {
    this.target.x = pose.x;
    this.target.y = pose.y;
    this.target.z = pose.z;
    this.target.yaw = pose.yaw ?? this.target.yaw;
    this.target.grounded = pose.grounded !== false;
    this.target.atGoal = Boolean(pose.atGoal);
    if (!this.initialized) {
      this.position.x = this.target.x;
      this.position.y = this.target.y;
      this.position.z = this.target.z;
      this.position.yaw = this.target.yaw;
      this.initialized = true;
    }
  }

  snapTo(pose) {
    this.setTarget(pose);
    this.position.x = pose.x;
    this.position.y = pose.y;
    this.position.z = pose.z;
    this.position.yaw = pose.yaw ?? 0;
    this.initialized = true;
  }

  setSettings(pose, speed, dt) {
    const targetYaw = pose.yaw ?? 0;
    const angleDelta = Math.atan2(
      Math.sin(targetYaw - this.position.yaw),
      Math.cos(targetYaw - this.position.yaw)
    );
    this.position.yaw += angleDelta * Math.min(1, dt * 15);
    this.position.x = pose.x;
    this.position.y = pose.y;
    this.position.z = pose.z;
    this.animate(speed, pose.grounded !== false, dt);
  }

  updateRemote(dt) {
    if (!this.initialized) return;
    const alpha = 1 - Math.exp(-12 * dt);
    const prevX = this.position.x;
    const prevZ = this.position.z;
    this.position.x += (this.target.x - this.position.x) * alpha;
    this.position.y += (this.target.y - this.position.y) * alpha;
    this.position.z += (this.target.z - this.position.z) * alpha;
    const angleDelta = Math.atan2(
      Math.sin(this.target.yaw - this.position.yaw),
      Math.cos(this.target.yaw - this.position.yaw)
    );
    this.position.yaw += angleDelta * Math.min(1, dt * 12);
    const moved = Math.hypot(this.position.x - prevX, this.position.z - prevZ);
    this.animate(moved / Math.max(dt, 0.001), this.target.grounded, dt);
  }

  animate(speed, grounded, dt) {
    const walking = Math.min(1.3, speed / MOVE_SPEED);
    this.walkBlend += (walking - this.walkBlend) * Math.min(1, dt * 10);
    this.airBlend += ((grounded ? 0 : 1) - this.airBlend) * Math.min(1, dt * 12);
    this.animTime += dt * (2.4 + speed * 1.15);
    const swing = Math.sin(this.animTime) * this.walkBlend;
    const idle = Math.sin(this.animTime * 0.7) * 0.018;

    this.group.position.set(this.position.x, this.position.y, this.position.z);
    this.group.rotation.y = this.position.yaw;
    this.parts.body.position.y =
      0.02 + idle + Math.abs(Math.sin(this.animTime)) * 0.035 * this.walkBlend;
    this.parts.leftArm.rotation.x = swing * 0.65 - this.airBlend * 0.5;
    this.parts.rightArm.rotation.x = -swing * 0.65 - this.airBlend * 0.5;
    this.parts.leftArm.rotation.z = -0.24 - this.airBlend * 0.45;
    this.parts.rightArm.rotation.z = 0.24 + this.airBlend * 0.45;
    this.parts.leftLeg.rotation.x = -swing * 0.8 + this.airBlend * 0.32;
    this.parts.rightLeg.rotation.x = swing * 0.8 + this.airBlend * 0.32;
    this.parts.leftShoe.position.z = 0.055 - swing * 0.08;
    this.parts.rightShoe.position.z = 0.055 + swing * 0.08;
    this.parts.head.rotation.y =
      Math.sin(this.animTime * 0.35) * 0.08 * (1 - this.walkBlend);

    this.arrivalRing.material.opacity +=
      ((this.target.atGoal ? 0.9 : 0) - this.arrivalRing.material.opacity) *
      Math.min(1, dt * 5);
    if (this.arrow) {
      this.arrow.position.y = 2.52 + Math.sin(this.animTime * 0.9) * 0.06;
      this.arrow.rotation.y += dt * 0.8;
    }
    this.label.position.y = 2.17 + Math.sin(this.animTime * 0.6) * 0.015;
  }

  updateShadow(platforms) {
    const surface = surfaceAt(
      this.position.x,
      this.position.z,
      this.position.y + 0.25,
      platforms
    );
    if (!surface) {
      this.shadow.visible = false;
      return;
    }
    this.shadow.visible = true;
    this.shadow.position.set(this.position.x, surface.top + 0.028, this.position.z);
    const height = Math.max(0, this.position.y - surface.top);
    const scale = Math.max(0.45, 1 - height * 0.08);
    this.shadow.scale.setScalar(scale);
    this.shadow.material.opacity = Math.max(0.06, 0.2 - height * 0.018);
  }

  dispose() {
    this.group.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (material.map) material.map.dispose();
          material.dispose();
        }
      }
    });
    this.shadow.geometry.dispose();
    this.shadow.material.dispose();
  }
}

export class IslandWorld {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = makeSkyTexture();
    this.scene.fog = new THREE.Fog(COLORS.fog, 38, 128);
    this.players = new Map();
    this.clouds = [];
    this.doorOpen = false;
    this.doorProgress = 0;
    this.checkpointActive = false;
    this.time = 0;
    this.localId = null;
    this.switchVisuals = [];
    this.buildLights();
    this.buildPlatforms();
    this.buildBridge();
    this.buildSwitches();
    this.buildCheckpoint();
    this.buildGoal();
    this.buildDecor();
    this.buildClouds();
    this.buildAmbient();
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight("#e8fff8", "#9c7357", 2.25));
    const sun = new THREE.DirectionalLight("#fff4d2", 2.65);
    sun.position.set(-24, 40, 18);
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight("#a8e4dc", 0.75);
    rim.position.set(20, 14, -35);
    this.scene.add(rim);
  }

  buildPlatforms() {
    const grassTop = makeMat(COLORS.grass);
    const grassTopLight = makeMat(COLORS.grassLight);
    const grassSide = makeMat(COLORS.grassDark);
    const dirt = makeMat(COLORS.dirt);
    const rock = makeMat(COLORS.rock);
    const rockDark = makeMat(COLORS.rockDark);

    PLATFORMS.forEach((platform, index) => {
      const group = new THREE.Group();
      group.position.set(platform.x, 0, platform.z);
      const topMat = platform.kind === "goal" ? grassTopLight : grassTop;
      const top = new THREE.Mesh(new THREE.BoxGeometry(platform.w, 0.34, platform.d), topMat);
      top.position.y = platform.top - 0.17;
      group.add(top);
      addOutline(top, COLORS.ink, 0.18);

      const sideHeight = 0.46;
      const sides = new THREE.Mesh(
        new THREE.BoxGeometry(platform.w - 0.16, sideHeight, platform.d - 0.16),
        grassSide
      );
      sides.position.y = platform.top - 0.34 - sideHeight / 2;
      group.add(sides);

      const dirtHeight = Math.min(1.25, platform.thickness * 0.44);
      const dirtMesh = new THREE.Mesh(
        new THREE.BoxGeometry(platform.w - 0.62, dirtHeight, platform.d - 0.62),
        dirt
      );
      dirtMesh.position.y = platform.top - 0.34 - sideHeight - dirtHeight / 2;
      group.add(dirtMesh);

      const coneHeight = Math.max(1.7, platform.thickness * 0.9);
      const cone = new THREE.Mesh(
        new THREE.CylinderGeometry(
          Math.min(platform.w, platform.d) * 0.35,
          Math.min(platform.w, platform.d) * 0.11,
          coneHeight,
          7
        ),
        index % 2 ? rock : rockDark
      );
      cone.position.y = platform.top - 0.34 - sideHeight - dirtHeight - coneHeight / 2;
      cone.rotation.y = index * 0.7;
      group.add(cone);

      const shard = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.5 + (index % 3) * 0.12, 0),
        rock
      );
      shard.position.set(
        platform.w * 0.27,
        platform.top - 1.4 - (index % 2) * 0.8,
        platform.d * 0.22
      );
      shard.scale.y = 1.7;
      group.add(shard);

      if (platform.kind === "start") this.addStartMarkings(group, platform);
      if (platform.kind === "checkpoint") {
        this.addGroundSign(group, platform, "LƯU", -3.4, 3.8, COLORS.paper);
      }
      if (platform.kind === "goal") {
        this.addGroundSign(group, platform, "ĐÍCH", 4.7, 4.2, COLORS.mustard);
      }
      if (platform.kind === "switch") {
        this.addGroundSign(group, platform, "CẦU", 0, -3.95, COLORS.paper);
      }

      this.scene.add(group);
    });
  }

  addStartMarkings(group, platform) {
    const ringMat = new THREE.MeshBasicMaterial({
      color: COLORS.paper,
      transparent: true,
      opacity: 0.55,
    });
    for (const [x, z] of [
      [-1.8, 2.4],
      [1.8, 2.4],
      [-1.8, -0.3],
      [1.8, -0.3],
    ]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.035, 5, 26), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, platform.top + 0.045, z);
      group.add(ring);
    }
    const label = textSprite(
      makeSignTexture("KHỞI HÀNH", { bg: COLORS.paper, fg: COLORS.ink }),
      3.2,
      1.1
    );
    label.position.set(0, platform.top + 2.8, 3.1);
    group.add(label);
  }

  addGroundSign(group, platform, text, x, z, color) {
    const sign = textSprite(makeSignTexture(text, { bg: color, fg: COLORS.ink }), 2.05, 0.7);
    sign.position.set(x, platform.top + 2.55, z);
    sign.material.depthTest = true;
    group.add(sign);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 2.5, 6),
      makeMat(COLORS.woodDark)
    );
    pole.position.set(x, platform.top + 1.25, z);
    group.add(pole);
  }

  buildBridge() {
    this.bridgeGroup = new THREE.Group();
    const wood = makeMat(COLORS.wood);
    const woodDark = makeMat(COLORS.woodDark);
    const plankCount = 9;
    for (let index = 0; index < plankCount; index += 1) {
      const z = -28.9 - (index * 6.15) / (plankCount - 1);
      const plank = new THREE.Mesh(
        new THREE.BoxGeometry(4.15, 0.17, 0.62),
        index % 2 ? wood : woodDark
      );
      plank.position.set(0, 1.32, z);
      plank.rotation.y = (index % 2 ? 1 : -1) * 0.018;
      addOutline(plank, COLORS.ink, 0.16);
      this.bridgeGroup.add(plank);
    }
    for (const x of [-2.02, 2.02]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 6.2, 6), woodDark);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(x, 2.35, -32);
      this.bridgeGroup.add(rail);
      for (const z of [-28.85, -35.15]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 1.25, 7), woodDark);
        post.position.set(x, 1.92, z);
        this.bridgeGroup.add(post);
      }
    }
    const sign = textSprite(makeSignTexture("CẦU MÂY"), 2.5, 0.86);
    sign.position.set(0, 3.25, -32);
    this.bridgeGroup.add(sign);
    this.bridgeGroup.visible = false;
    this.bridgeGroup.position.y = -2.6;
    this.scene.add(this.bridgeGroup);
  }

  buildSwitches() {
    for (const [index, sw] of SWITCHES.entries()) {
      const group = new THREE.Group();
      group.position.set(sw.x, sw.y, sw.z);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(1.12, 1.22, 0.17, 18),
        makeMat(COLORS.woodDark)
      );
      base.position.y = 0.085;
      group.add(base);
      const topMat = makeMat(SWITCH_COLORS[index], {
        emissive: SWITCH_COLORS[index],
        emissiveIntensity: 0.12,
      });
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.84, 0.16, 18), topMat);
      top.position.y = 0.23;
      addOutline(top, COLORS.paper, 0.35);
      group.add(top);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.98, 0.045, 6, 28),
        new THREE.MeshBasicMaterial({
          color: COLORS.paper,
          transparent: true,
          opacity: 0.65,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.185;
      group.add(ring);
      const label = textSprite(
        makeSignTexture(index === 0 ? "A" : "B", {
          bg: SWITCH_COLORS[index],
          fg: COLORS.paper,
        }),
        0.8,
        0.8
      );
      label.position.set(0, 1.5, 0);
      group.add(label);
      this.scene.add(group);
      this.switchVisuals.push({ group, top, ring, label, topMat, index });
    }
  }

  buildCheckpoint() {
    const group = new THREE.Group();
    group.position.set(CHECKPOINT.x, CHECKPOINT.y, CHECKPOINT.z);
    const ringMat = new THREE.MeshBasicMaterial({
      color: COLORS.checkpoint,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.095, 7, 42), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    group.add(ring);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.95, 2.15, 8.5, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: COLORS.checkpoint,
        transparent: true,
        opacity: 0.11,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beam.position.y = 4.3;
    group.add(beam);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 3.35, 7),
      makeMat(COLORS.woodDark)
    );
    pole.position.set(0, 1.7, 0);
    group.add(pole);
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1.12, 0.68),
      new THREE.MeshStandardMaterial({
        color: COLORS.checkpoint,
        side: THREE.DoubleSide,
        roughness: 0.8,
      })
    );
    flag.position.set(0.55, 3.1, 0);
    group.add(flag);
    const label = textSprite(
      makeSignTexture("LƯU", { bg: COLORS.paper, fg: COLORS.ink }),
      1.5,
      0.52
    );
    label.position.set(0, 3.85, 0);
    group.add(label);
    this.checkpointRing = ring;
    this.checkpointBeam = beam;
    this.checkpointFlag = flag;
    this.scene.add(group);
  }

  buildGoal() {
    const group = new THREE.Group();
    group.position.set(GOAL.x, GOAL.y, GOAL.z);
    const postMat = makeMat(COLORS.woodDark);
    for (const x of [-5.6, 5.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 5, 8), postMat);
      post.position.set(x, 2.5, 0);
      group.add(post);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.55, 6), makeMat(COLORS.red));
      cap.position.set(x, 5.2, 0);
      group.add(cap);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.32, 0.36), postMat);
    beam.position.set(0, 4.95, 0);
    group.add(beam);
    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(5.1, 1.45),
      new THREE.MeshBasicMaterial({
        map: makeSignTexture("VỀ ĐÍCH", { bg: COLORS.paper, fg: COLORS.red }),
        side: THREE.DoubleSide,
      })
    );
    banner.position.set(0, 4.05, 0);
    group.add(banner);
    const goalRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.2, 0.095, 7, 48),
      new THREE.MeshBasicMaterial({
        color: COLORS.mustard,
        transparent: true,
        opacity: 0.82,
      })
    );
    goalRing.rotation.x = -Math.PI / 2;
    goalRing.position.y = 0.055;
    group.add(goalRing);
    for (const x of [-3.7, 3.7]) {
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(1.55, 0.9),
        new THREE.MeshStandardMaterial({
          color: x < 0 ? COLORS.jade : COLORS.red,
          side: THREE.DoubleSide,
          roughness: 0.8,
        })
      );
      flag.position.set(x, 3.7, 0.05);
      group.add(flag);
    }
    this.goalRing = goalRing;
    this.goalBanner = banner;
    this.scene.add(group);
  }

  buildDecor() {
    const treeSpots = [
      ...DECOR.startTrees,
      ...DECOR.switchTrees,
      ...DECOR.checkpointTrees,
      ...DECOR.goalTrees,
    ];
    treeSpots.forEach((spot, index) => this.addTree(spot, index));
    DECOR.flowers.forEach((flower, index) => this.addFlower(flower, index));
    const rocks = [
      [-5.9, 15.1, 11.5],
      [6.2, -22.2, 12],
      [-5.7, -38.2, 13],
      [6.6, -62.2, 4.8],
      [-4.8, -67.1, 2.2],
    ];
    for (const [x, z, y] of rocks) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.55 + Math.random() * 0.25, 0),
        makeMat(COLORS.rock)
      );
      rock.position.set(x, y, z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.scale.y = 0.8;
      this.scene.add(rock);
    }
    this.addDistantIslands();
  }

  addTree(spot, index) {
    const surface = surfaceAt(spot.x, spot.z, 12);
    if (!surface) return;
    const group = new THREE.Group();
    group.position.set(spot.x, surface.top, spot.z);
    group.scale.setScalar(spot.scale ?? 1);
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.24, 1.5, 7),
      makeMat(COLORS.woodDark)
    );
    trunk.position.y = 0.75;
    group.add(trunk);
    const colors = ["#4f8d59", "#3f7b50", "#70a85c"];
    for (let layer = 0; layer < 3; layer += 1) {
      const foliage = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.75 - layer * 0.12, 0),
        makeMat(colors[(spot.variant + layer) % colors.length])
      );
      foliage.position.set(
        (layer - 1) * 0.18,
        1.55 + layer * 0.42,
        layer % 2 ? 0.16 : -0.1
      );
      foliage.rotation.set(index * 0.5 + layer, index + layer, 0);
      group.add(foliage);
    }
    this.scene.add(group);
  }

  addFlower(flower, index) {
    const surface = surfaceAt(flower.x, flower.z, 12);
    if (!surface) return;
    const colors = ["#e05d44", "#f0c04c", "#f4eee0"];
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.02, 0.42, 5),
      makeMat("#4f8d59")
    );
    stem.position.set(flower.x, surface.top + 0.21, flower.z);
    this.scene.add(stem);
    const bloom = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.12, 0),
      makeMat(colors[flower.color % colors.length])
    );
    bloom.position.set(flower.x, surface.top + 0.46, flower.z);
    bloom.rotation.y = index;
    this.scene.add(bloom);
  }

  addDistantIslands() {
    const spots = [
      { x: -27, y: -5, z: -28, scale: 1.5 },
      { x: 31, y: 4, z: -55, scale: 1.8 },
      { x: -35, y: 9, z: 14, scale: 1.2 },
      { x: 26, y: -7, z: 31, scale: 1.4 },
    ];
    for (const [index, spot] of spots.entries()) {
      const group = new THREE.Group();
      group.position.set(spot.x, spot.y, spot.z);
      group.scale.setScalar(spot.scale);
      const top = new THREE.Mesh(
        new THREE.CylinderGeometry(3.2, 3.6, 0.8, 7),
        makeMat(index % 2 ? COLORS.grassDark : COLORS.grass)
      );
      group.add(top);
      const rock = new THREE.Mesh(
        new THREE.ConeGeometry(3.2, 7, 7),
        makeMat(COLORS.rockDark)
      );
      rock.position.y = -3.8;
      rock.rotation.y = index * 0.9;
      group.add(rock);
      const tree = new THREE.Mesh(
        new THREE.ConeGeometry(1.15, 2.4, 7),
        makeMat("#4f8d59")
      );
      tree.position.y = 1.4;
      group.add(tree);
      this.scene.add(group);
    }
  }

  buildClouds() {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: COLORS.cloud,
      roughness: 1,
      transparent: true,
      opacity: 0.92,
      flatShading: true,
    });
    const spots = [
      [-16, -9, 2],
      [17, -12, -12],
      [-25, 8, -50],
      [24, 11, -72],
      [0, -16, 26],
      [-20, -14, -76],
      [12, 16, -20],
      [-34, 14, -18],
    ];
    for (const [index, [x, y, z]] of spots.entries()) {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      for (let puff = 0; puff < 4; puff += 1) {
        const cloud = new THREE.Mesh(
          new THREE.IcosahedronGeometry(1 + (puff % 2) * 0.45, 0),
          cloudMat
        );
        cloud.position.set(
          puff * 1.1 - 1.5,
          Math.sin(puff * 2.2) * 0.35,
          Math.cos(puff) * 0.3
        );
        cloud.scale.y = 0.55;
        group.add(cloud);
      }
      group.userData.baseX = x;
      group.userData.speed = 0.18 + (index % 3) * 0.06;
      this.clouds.push(group);
      this.scene.add(group);
    }
  }

  buildAmbient() {
    const count = 90;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = Math.random() * 22 - 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 110 - 25;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.motes = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: "#fff4c7",
        size: 0.16,
        transparent: true,
        opacity: 0.55,
        sizeAttenuation: true,
      })
    );
    this.scene.add(this.motes);
  }

  setLocalId(id) {
    this.localId = id;
  }

  syncPlayers(snapshot) {
    const seen = new Set();
    for (const player of snapshot.players ?? []) {
      seen.add(player.id);
      let avatar = this.players.get(player.id);
      if (!avatar) {
        avatar = new IslandAvatar({
          id: player.id,
          name: player.name,
          color: player.color,
          isLocal: player.id === this.localId,
        });
        this.players.set(player.id, avatar);
        this.scene.add(avatar.group);
        this.scene.add(avatar.shadow);
        avatar.snapTo(player);
      }
      avatar.setTarget(player);
    }
    for (const [id, avatar] of this.players) {
      if (seen.has(id)) continue;
      this.scene.remove(avatar.group);
      this.scene.remove(avatar.shadow);
      avatar.dispose();
      this.players.delete(id);
    }
  }

  setViewState(snapshot) {
    this.doorOpen = Boolean(snapshot.switches?.open);
    this.checkpointActive = Boolean(snapshot.checkpoint);
    const pressedA = snapshot.switches?.a?.length ?? 0;
    const pressedB = snapshot.switches?.b?.length ?? 0;
    for (const visual of this.switchVisuals) {
      const pressed = visual.index === 0 ? pressedA : pressedB;
      visual.top.position.y +=
        ((pressed ? 0.16 : 0.23) - visual.top.position.y) * 0.25;
      visual.topMat.emissiveIntensity = pressed
        ? 0.75
        : 0.12 + (snapshot.switches?.charge ?? 0) * 0.08;
      visual.ring.material.opacity = pressed ? 1 : 0.65;
    }
    const checkpointColor = this.checkpointActive
      ? COLORS.checkpointActive
      : COLORS.checkpoint;
    this.checkpointRing.material.color.set(checkpointColor);
    this.checkpointBeam.material.color.set(checkpointColor);
    this.checkpointBeam.material.opacity = this.checkpointActive ? 0.2 : 0.11;
    this.checkpointFlag.material.color.set(checkpointColor);
  }

  setLocalPose(id, pose, speed, dt) {
    const avatar = this.players.get(id);
    if (!avatar) return;
    avatar.setTarget(pose);
    avatar.setSettings(pose, speed, dt);
  }

  update(dt) {
    this.time += dt;
    const targetDoor = this.doorOpen ? 1 : 0;
    this.doorProgress += (targetDoor - this.doorProgress) * Math.min(1, dt * 4.6);
    this.bridgeGroup.visible = this.doorProgress > 0.015;
    this.bridgeGroup.position.y = -2.6 + this.doorProgress * 2.6;
    const platforms = platformsFor(this.doorOpen);
    for (const [id, avatar] of this.players) {
      if (id !== this.localId) avatar.updateRemote(dt);
      avatar.updateShadow(platforms);
    }
    if (this.checkpointActive) {
      this.checkpointRing.rotation.z += dt * 0.35;
      this.checkpointBeam.rotation.y += dt * 0.2;
    }
    this.goalRing.rotation.z -= dt * 0.22;
    this.goalBanner.position.y = 4.05 + Math.sin(this.time * 1.3) * 0.035;
    for (const cloud of this.clouds) {
      cloud.position.x = cloud.userData.baseX + Math.sin(this.time * cloud.userData.speed) * 2.4;
    }
    this.motes.rotation.y += dt * 0.006;
  }

  dispose() {
    for (const avatar of this.players.values()) {
      this.scene.remove(avatar.group);
      this.scene.remove(avatar.shadow);
      avatar.dispose();
    }
    this.players.clear();
    this.scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (material.map) material.map.dispose();
          material.dispose();
        }
      }
    });
  }
}

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.domElement.className = "island-canvas";
  renderer.domElement.setAttribute("aria-label", "Sân đảo 3D");
  renderer.domElement.setAttribute("role", "img");
  container.appendChild(renderer.domElement);
  return renderer;
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 220);
  camera.position.set(0, 6, 20);
  return camera;
}
