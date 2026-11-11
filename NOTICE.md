# Third-party software

The built site bundles these libraries from `node_modules` (versions are exact pins in
`package.json`; nothing is loaded from a CDN):

| Library    | Version | Licence     | Origin                                   |
|------------|---------|-------------|------------------------------------------|
| p5.js      | 2.3.4   | LGPL-2.1    | https://github.com/processing/p5.js      |
| Alpine.js  | 3.17.5  | MIT         | https://github.com/alpinejs/alpine       |
| Flowbite   | 4.0.2   | MIT         | https://github.com/themesberg/flowbite   |
| Tailwind CSS | 4.3.5 | MIT         | https://github.com/tailwindlabs/tailwindcss |

p5.js is LGPL-2.1: its unmodified source is available from the origin above at the pinned
version, and the bundle can be rebuilt against any compatible p5.js with `npm run build`.

The page markup adapts the owner's licensed Flowbite Pro templates. No Flowbite Pro source
file is part of this repository or of the built site.
