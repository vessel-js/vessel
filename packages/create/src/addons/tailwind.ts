import type { Builder } from '../builder';

export async function tailwindAddon(builder: Builder) {
  if (!builder.hasAddon('tailwind')) return;

  builder.pkg.addDevDep('tailwindcss', '^3.0.0');
  builder.pkg.addDevDep('postcss', '^8.0.0');
  builder.pkg.addDevDep('autoprefixer', '^10.0.0');

  const ext = builder.pkg.hasField('type', 'module') ? '.cjs' : '.js';

  builder.addHook('postBuild', async () => {
    await builder.dirs.target.write(`tailwind.config${ext}`, resolveConfig(builder));

    await builder.dirs.target.write(`postcss.config${ext}`, resolvePostCssConfig());

    await builder.dirs.target.write(
      'app/global.css',
      `@tailwind base;\n@tailwind components;\n@tailwind utilities;`,
      true,
    );
  });
}

function resolvePostCssConfig() {
  return `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
}

function resolveConfig(builder: Builder) {
  function getExt() {
    if (builder.framework === 'svelte') return 'svelte';
    if (builder.framework === 'vue') return 'vue';
    return builder.hasAddon('typescript') ? 'tsx' : 'jsx';
  }

  const ext = getExt();
  const content = [
    `'./app/app.html'`,
    `'./app/**/*.{md,${ext}}'`,
    `'./app/**/.markdoc/**/*.{md,${ext}}'`,
  ];

  return `/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    ${content.join(',\n    ')}
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
`;
}
