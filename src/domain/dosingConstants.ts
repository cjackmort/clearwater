/**
 * Dosing constants — the tunable heart of the calculator.
 *
 * Every constant is expressed as: amount of product needed PER 10,000 GALLONS
 * to move the parameter by the stated step. Sources are standard industry
 * dosing charts (Taylor / Pentair / TFP); tune here as we validate against
 * real-world results.
 */

export const PER_GALLONS = 10_000

export const DOSING = {
  /** Raise FC 1 ppm per 10k gal ≈ 2 oz cal-hypo 65% */
  FC_RAISE_CAL_HYPO_OZ_PER_PPM: 2,
  /** Raise FC 1 ppm per 10k gal ≈ 10.7 fl oz liquid chlorine 12.5% */
  FC_RAISE_LIQUID_FLOZ_PER_PPM: 10.7,
  /** Lower pH from 7.9→7.5 per 10k gal ≈ 12 fl oz muriatic acid 31.45% → 3 fl oz per 0.1 pH */
  PH_LOWER_ACID_FLOZ_PER_TENTH: 3,
  /** Raise pH 0.1 per 10k gal ≈ 1.5 oz soda ash */
  PH_RAISE_SODA_ASH_OZ_PER_TENTH: 1.5,
  /** Raise TA 10 ppm per 10k gal ≈ 1.4 lbs baking soda */
  TA_RAISE_BAKING_SODA_LB_PER_10PPM: 1.4,
  /** Raise CH 10 ppm per 10k gal ≈ 1.25 lbs calcium chloride (77%) */
  CH_RAISE_CACL_LB_PER_10PPM: 1.25,
  /** Raise CYA 10 ppm per 10k gal ≈ 13 oz stabilizer */
  CYA_RAISE_OZ_PER_10PPM: 13,
  /** Remove ~1000 ppb phosphates per 10k gal ≈ 16 fl oz phosphate remover */
  PHOSPHATE_REMOVER_FLOZ_PER_1000PPB: 16,
  /** Raise salt 100 ppm per 10k gal ≈ 8.3 lbs pool salt */
  SALT_RAISE_LB_PER_100PPM: 8.3,
  /** Shock target: raise FC to this ppm when combined chloramines are high */
  SHOCK_TARGET_FC_PPM: 10,
} as const

/** Ideal ranges used by both the health score and the dosing calculator. */
export interface Range {
  min: number
  max: number
}

export const IDEAL: Record<string, Range> = {
  fc: { min: 1, max: 4 },
  ph: { min: 7.4, max: 7.6 },
  ta: { min: 80, max: 120 },
  ch: { min: 200, max: 400 },
  cya: { min: 30, max: 50 },
  phosphates: { min: 0, max: 100 },
  /** combined chloramines = TC − FC */
  cc: { min: 0, max: 0.2 },
  salt: { min: 2700, max: 3400 },
}

/** Dosing targets aim for the middle of the ideal range. */
export const TARGET = {
  fc: 3,
  ph: 7.5,
  ta: 100,
  ch: 300,
  cya: 40,
  salt: 3200,
} as const

export const PARAM_LABELS: Record<string, string> = {
  fc: 'Free Chlorine',
  tc: 'Total Chlorine',
  cc: 'Combined Chloramines',
  ph: 'pH',
  ta: 'Total Alkalinity',
  ch: 'Calcium Hardness',
  cya: 'CYA (Stabilizer)',
  phosphates: 'Phosphates',
  salt: 'Salt',
}

export const PARAM_UNITS: Record<string, string> = {
  fc: 'ppm',
  tc: 'ppm',
  cc: 'ppm',
  ph: '',
  ta: 'ppm',
  ch: 'ppm',
  cya: 'ppm',
  phosphates: 'ppb',
  salt: 'ppm',
}
