module.exports = {
  useTabs: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  plugins: [require('@ianvs/prettier-plugin-sort-imports')],
  importOrder: ['.+.css', '<THIRD_PARTY_MODULES>', '^[../]', '^[./]'],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderCaseInsensitive: true,
};
