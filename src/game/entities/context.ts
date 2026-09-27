import * as THREE from 'three';
import type { TargetingMode, DamageType } from '../data/types';

// ============================================================
// Context بین موجودیت‌ها و موتور بازی — جلوگیری از import دایره‌ای
// ============================================================

export interface DamageableEnemy {
  id: number;
  getPos(): THREE.Vector3;
  takeDamage(amount: number, type: DamageType): boolean; // true = مرگ
  alive: boolean;
  data: { boss?: boolean; flying?: boolean; id: string };
  hpRatio: number;
  hp: number;
  maxHp: number;
  dist: number;
  speed: number;
  tier: number;
  applySlow(factor: number, duration: number): void;
  applyBurn(dps: number, duration: number): void;
  hasShield(): boolean;
}

export interface GameContext {
  pathPoints: THREE.Vector3[];
  pathLength: number;
  corePos: THREE.Vector3;
  enemies: DamageableEnemy[];
  towers: TowerLike[];
  vfx: {
    burst(pos: THREE.Vector3, color: number, count: number, opts?: { speed?: number; life?: number; size?: number; gravity?: number; up?: number; spread?: number }): void;
    hitSpark(pos: THREE.Vector3, color: number): void;
    explosion(pos: THREE.Vector3, color: number, big?: boolean): void;
    bolt(from: THREE.Vector3, to: THREE.Vector3, color?: number, thick?: boolean): void;
    ring(pos: THREE.Vector3, color: number, maxRadius: number, life?: number): void;
    magicCircle(pos: THREE.Vector3, color: number, radius: number, duration: number): void;
  };
  audio: { play(name: string): void };
  cameraShake(amount: number): void;
  spawnProjectile(kind: string, from: THREE.Vector3, target: DamageableEnemy, opts: { damage: number; splash?: number; burn?: number; slow?: number; slowDur?: number; color: number }): void;
  chainLightning(from: THREE.Vector3, firstTarget: DamageableEnemy, chains: number, damage: number, color: number): void;
  scheduleFireBarrage(center: THREE.Vector3, radius: number, count: number, damage: number): void;
  summonAt(pos: THREE.Vector3): void;
  onEnemyKilled(enemy: DamageableEnemy): void;
  onEnemyLeak(enemy: DamageableEnemy): void;
  heroDamageBuff: number; // ضریب افزایش آسیب از قهرمان
  towerRateBuff: number; // ضریب افزایش سرعت شلیک (فرمان نبرد)
}

export interface TowerLike {
  id: number;
  towerId: string;
  position: THREE.Vector3;
  damage: number;
  range: number;
  targeting: TargetingMode;
  alive: boolean;
}
