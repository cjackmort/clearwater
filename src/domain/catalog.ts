/**
 * Pre-loaded product catalog. `packageSize`/`packageUnit` describe the typical
 * retail container and `estPrice` its street price — used to turn dosing math
 * into a shopping list with estimated totals.
 */

export type CatalogCategory =
  | 'Sanitizer'
  | 'Shock'
  | 'Balancer'
  | 'Algae & Clarity'
  | 'Filter & Equipment'
  | 'Salt'

export interface CatalogProduct {
  id: string
  name: string
  category: CatalogCategory
  /** Unit dosing math is expressed in for this product */
  unit: string
  /** How much one retail package holds, expressed in `unit` */
  packageSize: number
  /** Human label for the retail package, e.g. "1 gal jug" */
  packageUnit: string
  estPrice: number
}

export const CATALOG: CatalogProduct[] = [
  { id: 'chlorine_tabs', name: 'Chlorine Tabs 3"', category: 'Sanitizer', unit: 'tabs', packageSize: 50, packageUnit: '25 lb bucket', estPrice: 89.99 },
  { id: 'liquid_chlorine', name: 'Liquid Chlorine 12.5%', category: 'Sanitizer', unit: 'fl oz', packageSize: 128, packageUnit: '1 gal jug', estPrice: 8.99 },
  { id: 'cal_hypo_shock', name: 'Cal-Hypo Shock 65%', category: 'Shock', unit: 'oz', packageSize: 16, packageUnit: '1 lb bag', estPrice: 6.49 },
  { id: 'dichlor_shock', name: 'Dichlor Shock 56%', category: 'Shock', unit: 'oz', packageSize: 16, packageUnit: '1 lb bag', estPrice: 7.99 },
  { id: 'muriatic_acid', name: 'Muriatic Acid 31.45%', category: 'Balancer', unit: 'fl oz', packageSize: 128, packageUnit: '1 gal jug', estPrice: 12.99 },
  { id: 'soda_ash', name: 'Soda Ash (pH Up)', category: 'Balancer', unit: 'oz', packageSize: 96, packageUnit: '6 lb tub', estPrice: 16.99 },
  { id: 'sodium_bisulfate', name: 'Sodium Bisulfate (pH Down)', category: 'Balancer', unit: 'oz', packageSize: 160, packageUnit: '10 lb tub', estPrice: 24.99 },
  { id: 'baking_soda', name: 'Baking Soda (Alkalinity Up)', category: 'Balancer', unit: 'lb', packageSize: 12, packageUnit: '12 lb pouch', estPrice: 14.99 },
  { id: 'calcium_chloride', name: 'Calcium Chloride', category: 'Balancer', unit: 'lb', packageSize: 10, packageUnit: '10 lb tub', estPrice: 21.99 },
  { id: 'cya_stabilizer', name: 'CYA Stabilizer', category: 'Balancer', unit: 'oz', packageSize: 64, packageUnit: '4 lb tub', estPrice: 19.99 },
  { id: 'algaecide', name: 'Algaecide 60%', category: 'Algae & Clarity', unit: 'fl oz', packageSize: 32, packageUnit: '1 qt bottle', estPrice: 17.99 },
  { id: 'clarifier', name: 'Water Clarifier', category: 'Algae & Clarity', unit: 'fl oz', packageSize: 32, packageUnit: '1 qt bottle', estPrice: 12.49 },
  { id: 'phosphate_remover', name: 'Phosphate Remover', category: 'Algae & Clarity', unit: 'fl oz', packageSize: 32, packageUnit: '1 qt bottle', estPrice: 27.99 },
  { id: 'de_powder', name: 'DE Powder', category: 'Filter & Equipment', unit: 'lb', packageSize: 24, packageUnit: '24 lb box', estPrice: 32.99 },
  { id: 'filter_cartridge', name: 'Filter Cartridge', category: 'Filter & Equipment', unit: 'each', packageSize: 1, packageUnit: 'cartridge', estPrice: 44.99 },
  { id: 'pool_salt', name: 'Pool Salt', category: 'Salt', unit: 'lb', packageSize: 40, packageUnit: '40 lb bag', estPrice: 11.99 },
]

export function catalogById(id: string): CatalogProduct | undefined {
  return CATALOG.find((p) => p.id === id)
}

export function catalogByName(name: string): CatalogProduct | undefined {
  const lower = name.toLowerCase()
  return CATALOG.find(
    (p) => p.name.toLowerCase() === lower || lower.includes(p.name.toLowerCase().split(' ')[0]),
  )
}

/** Best-effort category for free-text product names (used by the ledger). */
export function categoryForProduct(name: string): string {
  const exact = catalogByName(name)
  if (exact) return exact.category
  const lower = name.toLowerCase()
  if (/(chlorine|tab|sanitiz)/.test(lower)) return 'Sanitizer'
  if (/(shock|hypo|dichlor)/.test(lower)) return 'Shock'
  if (/(acid|ph|alkalinity|soda|calcium|stabilizer|cya|baking)/.test(lower)) return 'Balancer'
  if (/(algae|clarif|phosphate|enzyme)/.test(lower)) return 'Algae & Clarity'
  if (/(filter|cartridge|de powder|pump|net|brush|hose|vacuum)/.test(lower))
    return 'Filter & Equipment'
  if (/salt/.test(lower)) return 'Salt'
  return 'Other'
}
