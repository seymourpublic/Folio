export type { MeasurementUnit } from "./document-model";
import type { MeasurementUnit } from "./document-model";

const POINTS_PER_UNIT: Record<MeasurementUnit, number> = {
  pt: 1,
  in: 72,
  cm: 72 / 2.54,
  mm: 72 / 25.4,
};

export function distanceInPoints(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function formatDistance(pointsValue: number, unit: MeasurementUnit): string {
  const value = pointsValue / POINTS_PER_UNIT[unit];
  return `${value.toFixed(2)} ${unit}`;
}

export const MEASUREMENT_UNITS: MeasurementUnit[] = ["pt", "in", "cm", "mm"];
