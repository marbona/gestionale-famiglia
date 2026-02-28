export const CATEGORY_COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#d0ed57',
  '#a4de6c',
];

export const buildCategoryColorMap = (categoryNames: string[]): Record<string, string> => {
  const uniqueSorted = Array.from(new Set(categoryNames)).sort((a, b) => a.localeCompare(b, 'it'));
  return uniqueSorted.reduce<Record<string, string>>((acc, categoryName, index) => {
    acc[categoryName] = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
    return acc;
  }, {});
};
