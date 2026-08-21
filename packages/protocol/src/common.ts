import { z } from "zod";

export const FiniteNumberSchema = z.number().finite();
export const NonNegativeIntegerSchema = z.number().int().nonnegative();
export const IdentifierSchema = z.string().min(1).max(128);

export const Vec3Schema = z.object({
  x: FiniteNumberSchema,
  y: FiniteNumberSchema,
  z: FiniteNumberSchema,
});

export const QuaternionSchema = z.object({
  x: FiniteNumberSchema,
  y: FiniteNumberSchema,
  z: FiniteNumberSchema,
  w: FiniteNumberSchema,
});

export type Vec3 = z.infer<typeof Vec3Schema>;
export type Quaternion = z.infer<typeof QuaternionSchema>;
