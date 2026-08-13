export const MONTH_OPTIONS = [
  { value: '01', label: 'Janvier' },
  { value: '02', label: 'Fevrier' },
  { value: '03', label: 'Mars' },
  { value: '04', label: 'Avril' },
  { value: '05', label: 'Mai' },
  { value: '06', label: 'Juin' },
  { value: '07', label: 'Juillet' },
  { value: '08', label: 'Aout' },
  { value: '09', label: 'Septembre' },
  { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' },
  { value: '12', label: 'Decembre' },
];

export const CATEGORY_OPTIONS = [
  { value: 'ALL', label: 'Toutes les categories' },
  { value: 'COM', label: 'COM' },
  { value: 'SURV', label: 'SURV' },
  { value: 'MET', label: 'MET' },
  { value: 'RESEAU', label: 'RESEAU' },
];

export const CATEGORY_VALUES = CATEGORY_OPTIONS.map((option) => option.value);

export const CURRENT_YEAR = new Date().getFullYear();

export const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - 2009 + 1 },
  (_, index) => String(CURRENT_YEAR - index),
);

export function formatCategoryLabel(category) {
  return category && category !== 'ALL' ? category : 'Toutes les categories';
}
