## [0.2.1](https://github.com/vessel-js/vessel/compare/v0.2.0...v0.2.1) (2023-01-13)

### Bug Fixes

- **create:** hide preact option for now until we add support ([3b69219](https://github.com/vessel-js/vessel/commit/3b69219fbe7e760dd80af1627536552447da6f9a))

# [0.2.0](https://github.com/vessel-js/vessel/compare/v0.1.3...v0.2.0) (2023-01-12)

### Bug Fixes

- **app:** additional route group fixes ([8bb5d7c](https://github.com/vessel-js/vessel/commit/8bb5d7c6ac55ee0fa2002a6145981a269d8d3162))
- **app:** better feedback during build process ([75021cb](https://github.com/vessel-js/vessel/commit/75021cb4697ae4262f536b04e37b99f58e305f89))
- **app:** do not load branch pages during static load process ([4cf7a0e](https://github.com/vessel-js/vessel/commit/4cf7a0e904b6dff475e58beab6a27bdd0c9e8696))
- **app:** do not log bundling client msg during dev ([322c27e](https://github.com/vessel-js/vessel/commit/322c27ea175a7d11d938940f8be57ffaaaa3de33))
- **app:** do not override shiki default bundled languages ([f251d35](https://github.com/vessel-js/vessel/commit/f251d35a4a77e549f3e4dcce59d0554bd8f3121b))
- **app:** greatly improve route size estimates in final log ([70c0469](https://github.com/vessel-js/vessel/commit/70c0469a485641407f4dcd691129374be2152c56))
- **app:** remove primitive route change detection for now ([313dcd0](https://github.com/vessel-js/vessel/commit/313dcd0b61249a29c99974e76e7292297779180b))
- **app:** route matching improvements ([aaff0ab](https://github.com/vessel-js/vessel/commit/aaff0abb81f0afd640bb431d9dd9437208173c85))
- **app:** update `matchedURL` and `params` on route change ([c46c703](https://github.com/vessel-js/vessel/commit/c46c703c472859d5727e43f3ce8624fd1dc21014))
- **create:** add shebang to create file ([#2](https://github.com/vessel-js/vessel/issues/2)) ([71b37cb](https://github.com/vessel-js/vessel/commit/71b37cb19486e8278c85f0b3f84534afba82314d))
- **svelte:** svelte removing markdown meta because it starts with `_` ([a3a2bcf](https://github.com/vessel-js/vessel/commit/a3a2bcf1b5a49cbde991675239c3a7da33217628))

### Features

- **app:** param overrides ([e9f2324](https://github.com/vessel-js/vessel/commit/e9f232406741c5ebf9db592e2f8834cad75ccf85))

## [0.1.3](https://github.com/vessel-js/vessel/compare/v0.1.2...v0.1.3) (2023-01-10)

### Bug Fixes

- ensure peer deps are set correctly by release script ([2fd8c27](https://github.com/vessel-js/vessel/commit/2fd8c27a2533d7bda7ecc6ad2235c58262c06146))

## [0.1.2](https://github.com/vessel-js/vessel/compare/v0.1.1...v0.1.2) (2023-01-10)

### Bug Fixes

- **app:** handle root and nested route groups correctly ([ad928c6](https://github.com/vessel-js/vessel/commit/ad928c65a13507ab111d52aac69381c2617bb8d7))
- **app:** include `.js` and `.ts` pages in default config ([f71ce35](https://github.com/vessel-js/vessel/commit/f71ce354e029a664a30490770951d0f5da512276))
- **app:** mark shiki and starry-night as external ([8ab2ea4](https://github.com/vessel-js/vessel/commit/8ab2ea458c211b93275b67c76cde536ec70a7477))
- **app:** remove optional peer deps ([d194106](https://github.com/vessel-js/vessel/commit/d19410625778168c6b887d032f362e34eb794a80))
- **app:** remove troublesome `cookie` package ([10d16ce](https://github.com/vessel-js/vessel/commit/10d16ceed918e6ad53abe36dc03e32f059dca43c))
- check node is tag in markdoc integrations ([9015c2d](https://github.com/vessel-js/vessel/commit/9015c2d6b0f45f28cebc6e18beb6f31aa51e8a92))
- **create:** drop `+` prefix on app files as the default ([81778d9](https://github.com/vessel-js/vessel/commit/81778d9325355b9e7ce2efb63af3c7c7825d5fab))
- rename `index.html` -> `app.html` ([15b1f30](https://github.com/vessel-js/vessel/commit/15b1f30c9e7e668e72b99798d4e8b06f42e3fa02))

### Features

- **app:** export url utils from http module ([c63db9b](https://github.com/vessel-js/vessel/commit/c63db9ba9bec717a636020c9295099148679c323))

## [0.1.1](https://github.com/vessel-js/vessel/compare/v0.1.0...v0.1.1) (2023-01-09)

### Bug Fixes

- include all declaration files and licenses ([d27d9ef](https://github.com/vessel-js/vessel/commit/d27d9ef2d5d4ccd8034fe6cd454a684e6c534b17))

# 0.1.0 (2023-01-09)

### Bug Fixes

- **app:** add `stale` property to route components ([7a22d11](https://github.com/vessel-js/vessel/commit/7a22d11af60f32cbdbb598ed7fcb2789595711f1))
- **app:** add server configured routes to vercel config ([bd56682](https://github.com/vessel-js/vessel/commit/bd56682b1b852c278d4655a01ade291979447758))
- **app:** add some basic logging for prod server ([8c1221f](https://github.com/vessel-js/vessel/commit/8c1221fb5ce25d2149dd6bb73ac657b5c1cda5a6))
- **app:** add vercel edge/node functions if server config has routes ([bd3af4b](https://github.com/vessel-js/vessel/commit/bd3af4bfda26da79b89c6350016add080b445d11))
- **app:** call static loader cache function ([b2f9fc4](https://github.com/vessel-js/vessel/commit/b2f9fc458d548995a72b3926fda6c1eae509290a))
- **app:** cancel navigation to same url or match ([e5a9780](https://github.com/vessel-js/vessel/commit/e5a978081ee7205e79a700cf73ef3a6943b65fe3))
- **app:** capture all word characters for named routes ([8bf7278](https://github.com/vessel-js/vessel/commit/8bf727899293ce306a457ecabba750c59fbfe2d4))
- **app:** clean up fetcher types ([d46005f](https://github.com/vessel-js/vessel/commit/d46005fa0e8286554acc753a99a2be1bfa6ab1f5))
- **app:** client router should default to using trailing slashes ([ef01abd](https://github.com/vessel-js/vessel/commit/ef01abd45398ef68ae500c5c0274d722bf72a2dd))
- **app:** default to 307 instead of 302 to preserve http method ([ada5724](https://github.com/vessel-js/vessel/commit/ada5724f7f3cdfbd7bf0ae089107c83350e4cf8f))
- **app:** default to no trailing slashes ([16069c8](https://github.com/vessel-js/vessel/commit/16069c8e70c5fb44323f7537ece5ecb7e9e9ec6d))
- **app:** deoptimize edge routes that contain node server loader in thier branch ([a47b55d](https://github.com/vessel-js/vessel/commit/a47b55d16b5e72b1bc3f713309fdbee4c37ce7a9))
- **app:** detect static/server routes during build ([b4fb816](https://github.com/vessel-js/vessel/commit/b4fb816b7dc0e0441cedeccbc11da0cc30d421bc))
- **app:** do not load page component of non-leaf routes ([297cb91](https://github.com/vessel-js/vessel/commit/297cb912cb38a5faa817fb3be9e295fc1baaac88))
- **app:** fetch test server-side in prod ([e31b5e1](https://github.com/vessel-js/vessel/commit/e31b5e1fca06a4446a707a12bfc28ed8155c7931))
- **app:** improve named routes support ([d25e648](https://github.com/vessel-js/vessel/commit/d25e64826f8334cc8fd41bd9722bec9dba653e27))
- **app:** include all branch routes in server manifest ([68f4e09](https://github.com/vessel-js/vessel/commit/68f4e0928ec098b8b031dca9472d278db03f2f9d))
- **app:** include all document routes in node env ([a19fc6e](https://github.com/vessel-js/vessel/commit/a19fc6e481526593686ecb0b808dcefcb2af9bee))
- **app:** include all route segments in server manifest ([4fe9312](https://github.com/vessel-js/vessel/commit/4fe93125a10e6782d708560461a96ea5225e0e46))
- **app:** include server manifest in static builds ([62d1e6d](https://github.com/vessel-js/vessel/commit/62d1e6d84fc288a6836370bfaa2b5435805519ad))
- **app:** make `staticLoader` noop in final vercel bundle ([ce847cb](https://github.com/vessel-js/vessel/commit/ce847cbc5977225854e24486314985bc11a03b0d))
- **app:** normalize order of transformed rpc call parts ([7b81ea6](https://github.com/vessel-js/vessel/commit/7b81ea69db52d32db94b335d0ffa946cfcad8ec6))
- **app:** normalize trailing slashes on route matches ([6347e05](https://github.com/vessel-js/vessel/commit/6347e0559dfabb8213184e31d5fc32ecf674acf5))
- **app:** only cancel client navigation reactive if same url ([e32d539](https://github.com/vessel-js/vessel/commit/e32d5397af585ab11f9004b21b578cc45138366f))
- **app:** refactor loaders removal plugin ([02001be](https://github.com/vessel-js/vessel/commit/02001be0e97995a1466a28a95523095978975364))
- **app:** refactor request handlers ([bd3f8b1](https://github.com/vessel-js/vessel/commit/bd3f8b1d030be95026930bdd1d6a74fc9f8537b8))
- **app:** remove all server exports from client-side files ([44f7c1f](https://github.com/vessel-js/vessel/commit/44f7c1f0dab93c8627361c02b36c872e2ea1d1dc))
- **app:** remove server only polyfillsfrom client bundle path ([d1f99f6](https://github.com/vessel-js/vessel/commit/d1f99f6891a896e0cea569664ea2d26ad14383f0))
- **app:** rename `createServerRequestHandler` -> `createHttpRequestHandler` ([cb8b349](https://github.com/vessel-js/vessel/commit/cb8b34918cba95f1dc67c643acab0d820cef77eb))
- **app:** render numbers and booleans in markdown content ([16e65ad](https://github.com/vessel-js/vessel/commit/16e65ad5c3fe3a12ecfc51b88343524db748cca5))
- **app:** replace page on non-leaf prev matches ([7f4a9a5](https://github.com/vessel-js/vessel/commit/7f4a9a509864a5b93d619e1d9e3256cb1202f00b))
- **app:** separate http/document request events ([38d0767](https://github.com/vessel-js/vessel/commit/38d0767051a59d5160a3feeaae88cfd31589ce29))
- **app:** server router http methods not merged ([32248f6](https://github.com/vessel-js/vessel/commit/32248f62fd3fe37749c8edd5945b11a3f3053867))
- **app:** set manifest production flag based on debug mode ([f477e05](https://github.com/vessel-js/vessel/commit/f477e0591fa3d8306d1c7288745002ae964ddc17))
- **app:** spa fallback can only be node or static ([2d44113](https://github.com/vessel-js/vessel/commit/2d4411379c2b9da9fe3780f08a5a644b26ae8240))
- **app:** static build adapter should output to `build` dir ([9a9eed1](https://github.com/vessel-js/vessel/commit/9a9eed1bdceb0ec4223f9f0d9465ed6744d1c6de))
- **app:** throw if server tries to overwrite api file route ([9b4f2b5](https://github.com/vessel-js/vessel/commit/9b4f2b52f678ffedd164a1fc4c7b4600699e2796))
- **app:** use `es-module-lexer` for fast rpc transforms ([0a02ad0](https://github.com/vessel-js/vessel/commit/0a02ad071d49dfa6c2cbed1fc78675fa5c8e5beb))
- **app:** use debug for client logs ([1431798](https://github.com/vessel-js/vessel/commit/14317980286bad9632c1ee6f6234c4574c473e0c))
- **create:** bump deps ([98bbe61](https://github.com/vessel-js/vessel/commit/98bbe619cbe68162b84c1ba7a49f078844daa69d))
- **create:** include `@types/node` in typescript addon ([e718a90](https://github.com/vessel-js/vessel/commit/e718a9038450903696558fc7a6345a964183c628))
- **create:** split out shared template files ([d6942ec](https://github.com/vessel-js/vessel/commit/d6942ec9ffe59387a4a6e1b8d55e68e9c409553f))
- replace `node:path` with `pathe` ([18f8354](https://github.com/vessel-js/vessel/commit/18f83544dfa5850d60aa09fc45054bbd119f31d9))
- replace `type` with `interface` where possible ([a9c3620](https://github.com/vessel-js/vessel/commit/a9c36203b284fce0be782cae619bba6372be7b9c))
- resolve all HMR issues by importing `App` directly ([f5b15f3](https://github.com/vessel-js/vessel/commit/f5b15f36567e8586fc313c96eac7e2e29929e1d8))
- **solid:** include `jsx` and `tsx` optimization ([aff43a9](https://github.com/vessel-js/vessel/commit/aff43a989fb9927f612453df0163c04a93ab7721))
- **solid:** remove extraneous exts from solid plugin ([1861495](https://github.com/vessel-js/vessel/commit/186149560073e8ae483392ea718e12c4ef867383))
- **solid:** spread rest props on link anchor ([ca77c5e](https://github.com/vessel-js/vessel/commit/ca77c5e2c930b185049272bc7cc6241cb9046c0c))
- **svelte:** export all context getters ([ef1ef9e](https://github.com/vessel-js/vessel/commit/ef1ef9efb1e9bba6d7a953d5617e734d16a63adf))
- use consistent hook naming across frameworks ([8aa15c2](https://github.com/vessel-js/vessel/commit/8aa15c26a800e5a1cde511e448e7629c4bf346ef))
- **vue:** `use` -> `get` prefix for context inject functions ([a4d0aaa](https://github.com/vessel-js/vessel/commit/a4d0aaa43cd2df5378792bfcf685261c2442c6e5))
- **vue:** no ssr externalization ([3818093](https://github.com/vessel-js/vessel/commit/3818093fd9569bbf8315c8c1f09f1159dcc0de70))
- **vue:** should announce new page when route changes ([90df12d](https://github.com/vessel-js/vessel/commit/90df12da0f39553e58af11aa3b8b648cd5a8f67a))

### Features

- **app:** `serverFetch` can make rpc calls ([1ab9b24](https://github.com/vessel-js/vessel/commit/1ab9b242736fe7e904903c47bdd22f724d21aa58))
- **app:** abort fetches on new navigation starts ([60fb234](https://github.com/vessel-js/vessel/commit/60fb234cbe86b794985913de694467b29ac4aefb))
- **app:** accept `data-replace` attr on anchor tags ([6037d28](https://github.com/vessel-js/vessel/commit/6037d28a05c8b9129a74c6798556a0fbbaed5322))
- **app:** add client-side which routes can fetch server data ([c0019dc](https://github.com/vessel-js/vessel/commit/c0019dc70c2a71ba752ed42ac6adc948fed2f6fb))
- **app:** add data loading and errors to client-side router ([a458c5a](https://github.com/vessel-js/vessel/commit/a458c5ab76acbe7e4797f45898bd12813987dcd0))
- **app:** add some basic error hooks to server manifest ([d9f0751](https://github.com/vessel-js/vessel/commit/d9f07517f35577181f7d34da17b46ba3a1adae64))
- **app:** add static data loader to build phase ([066eaca](https://github.com/vessel-js/vessel/commit/066eaca95831aa2e53c0f8d0a394efdb0774a071))
- **app:** allow `AnyResponse` to be returned from middleware ([c8b6ea4](https://github.com/vessel-js/vessel/commit/c8b6ea46d3391c57c24505db5b000744ee89508c))
- **app:** allow named page/api routes ([3ed5e42](https://github.com/vessel-js/vessel/commit/3ed5e42f8b98e290d33a4b98b902a0a449725ab5))
- **app:** express-like server router api ([433cb16](https://github.com/vessel-js/vessel/commit/433cb16a364b9f908eb3b564a55256034a5da396))
- **app:** fetcher now accepts `searchParams` ([6655180](https://github.com/vessel-js/vessel/commit/6655180d7bad2d117bf8dcd28f514c3d10acc8e5))
- **app:** generate server manifests ([5d19901](https://github.com/vessel-js/vessel/commit/5d19901036f9bd5528f48fae28b7aecd9f1f7c29))
- **app:** new `+server` config file ([fd0d287](https://github.com/vessel-js/vessel/commit/fd0d287cdee2cc0bdbc2177c36073aa57bd9d7fe))
- **app:** new `createServerLoader` type helper ([aad8baf](https://github.com/vessel-js/vessel/commit/aad8baf1746c083e3373c24c69dcb72b86c2cc8b))
- **app:** new `createStaticLoader` type helper ([e957971](https://github.com/vessel-js/vessel/commit/e95797159cc23153b31d8439309cff835ab06a42))
- **app:** new `routes.edge` glob option ([728ec68](https://github.com/vessel-js/vessel/commit/728ec685f0b01209549fe558261a569801a9442e))
- **app:** new clean routes logging table ([eb7d6e9](https://github.com/vessel-js/vessel/commit/eb7d6e9f2af7e4edc1522d8a54fc0ed87e81c88f))
- **app:** new RPC functionality ([cd6a802](https://github.com/vessel-js/vessel/commit/cd6a80241134e1877b1b9edc8a67cc8047c62e56))
- **app:** page/data server request handlers ([0eba62b](https://github.com/vessel-js/vessel/commit/0eba62b101407b50ba76aa7705333e5d83dc02cd))
- **app:** refactor http layer and new fetch+middleware api ([68987d7](https://github.com/vessel-js/vessel/commit/68987d70757bb3a7f4c14c26fc7c56cb4a492cce))
- **app:** router `go` method is now type-safe ([b49b4b0](https://github.com/vessel-js/vessel/commit/b49b4b0eb4614b91730b48149c7ed507660361a8))
- **app:** server handlers now accept `middleware` option ([52567f8](https://github.com/vessel-js/vessel/commit/52567f834ebfc3fc6758d19c32df8027d0dc5a03))
- **app:** server manifest now accepts document resources ([5eb8a81](https://github.com/vessel-js/vessel/commit/5eb8a81c539f01179a33a1b4768c68b8a134ce2c))
- **app:** vercel build adapter ([f43d5e8](https://github.com/vessel-js/vessel/commit/f43d5e899b7e2e2d5e1204f521d987becd1c150d))
- bump all deps ([03d5bc1](https://github.com/vessel-js/vessel/commit/03d5bc13a4f0f45efd2cdd66a269d966b2a30895))
- infer server data type from loader arg ([a51d6fa](https://github.com/vessel-js/vessel/commit/a51d6fa6de44f8b7c92e40b4039c745462facb74))
- infer static data type from loader arg ([017dc0b](https://github.com/vessel-js/vessel/commit/017dc0b0e73810c7c674535bfd3a8a4156645aca))
- new `create-vessel` package ([8ad9ad3](https://github.com/vessel-js/vessel/commit/8ad9ad361de66307375555b18e179039553b7a60))
- new vue package ([adde6e2](https://github.com/vessel-js/vessel/commit/adde6e2d628cb97870fce0a02837d7ada85a031a))
- **solid:** new solid package ([d7bd967](https://github.com/vessel-js/vessel/commit/d7bd967aeac282a89178cd2cb06b49164794a2e8))
- **svelte:** add router outlet components ([b7ddd1f](https://github.com/vessel-js/vessel/commit/b7ddd1f37a65aa7a797b948a47e9ace8a243cd36))
- **svelte:** new `getRouteParams` hook ([13c749a](https://github.com/vessel-js/vessel/commit/13c749af74ce1de6106f6b56330f05235b2ac2b3))
- **svelte:** new `Link` component ([9dd1350](https://github.com/vessel-js/vessel/commit/9dd1350dceed9aa370163827877ce6bf79991afc))
- **svelte:** route announcer ([416928f](https://github.com/vessel-js/vessel/commit/416928f4ca126d48d8b926dafd9771f6b79134ae))
- **svelte:** wire up server entry ([ab6304e](https://github.com/vessel-js/vessel/commit/ab6304e1d5568331297b16c5c8cd882cbc60651f))
- **vue:** new `getRouteParams` hook ([6dd624d](https://github.com/vessel-js/vessel/commit/6dd624dbd3af4fa46a84ed7f56cbb19d3551551a))
- **vue:** new `Link` component ([0c69c1a](https://github.com/vessel-js/vessel/commit/0c69c1a60efacb70b6ea3c677d8b6bfa84e344e8))
- **vue:** route announcer ([ea692b4](https://github.com/vessel-js/vessel/commit/ea692b4866d3139715cabee91b7ccbdaf3569ef8))
