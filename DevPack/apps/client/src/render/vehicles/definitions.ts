import authored from './definitions.generated.json';
import type { VehicleType } from '@stopthatguy/shared';
import type { AssetId } from '../assets/catalog.js';
export type VehicleQuality = 'low' | 'medium';
export interface VehicleAnchor { readonly parent: string | null; readonly position: readonly [number, number, number] }
export interface VehicleSeat {
  readonly id: string;
  readonly role: 'rider' | 'driver' | 'passenger';
  readonly seat: string;
  readonly hands: readonly [string, string];
  readonly feet: readonly [string, string];
  /** Static preview fit only. T023 owns riding pose/animation. */
  readonly fitLeanRadians: number;
}
export interface VehicleDefinition {
  readonly id: AssetId;
  readonly label: string;
  readonly clearance: { readonly source: string; readonly radiusM: number; readonly heightM: number; readonly scope: string };
  readonly pivots: Readonly<Record<string, VehicleAnchor>>;
  readonly anchors: Readonly<Record<string, VehicleAnchor>>;
  readonly wheels: readonly { readonly pivot: string; readonly radiusM: number }[];
  readonly steering: readonly string[];
  readonly crank: string | null;
  readonly seats: readonly VehicleSeat[];
}
// Generated from the single authored source and verified against GLB nodes and world limits.
export const VEHICLE_DEFINITIONS = authored as unknown as Readonly<Record<VehicleType, VehicleDefinition>>;
