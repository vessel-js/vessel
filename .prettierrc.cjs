module.exports = {
  useTabs: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  plugins: [require('@ianvs/prettier-plugin-sort-imports')],
  importOrder: [
    '.css$',
    '^node:',
    '<THIRD_PARTY_MODULES>',
    '^(client|node|shared|server|virtual)',
    '^[../]',
    '^[./]',
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderCaseInsensitive: true,
};
