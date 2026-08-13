export const CATEGORY_OPTIONS = ['COM', 'SURV', 'MET', 'RESEAU'];

const currentYear = new Date().getFullYear();

export const YEAR_OPTIONS = Array.from(
  { length: currentYear - 2009 + 1 },
  (_, index) => currentYear - index,
);

export const DEFAULT_IMPORT_YEAR = String(currentYear);
