// ============================================================
// نقطه ورود سیستم Asset — تنها راه دسترسی Gameplay به Assetها
// ------------------------------------------------------------
// import { characterFactory, assetManager } from '@/game/assets';
// ============================================================

export { ASSETS, allAssetEntries, findAssetEntry, sliceAssetEntries } from './AssetManifest';
export type { CharacterAssetEntry, AssetCategory, AssetPhase } from './AssetManifest';

export { assetManager } from './AssetManager';
export type { AssetStatus, AssetCacheRecord, PreloadProgress, PreloadReport } from './AssetManager';

export { characterFactory, CharacterHandle } from './CharacterFactory';
export type { HandleSource } from './CharacterFactory';

export { CharacterAnimationController } from './CharacterAnimationController';
export type { LocomotionState } from './CharacterAnimationController';

export { normalizeModel } from './ModelNormalizer';
export type { NormalizedModel } from './ModelNormalizer';

export { validateAsset } from './AssetValidator';
export type { AssetValidationReport, ValidationCheck } from './AssetValidator';

export { ASSET_SPECS } from './AssetSpecifications';
export type { AssetSpecification, MaterialSpec } from './AssetSpecifications';
