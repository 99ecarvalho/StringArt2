# String Art Generator - Build & Distribution Guide

Copyright (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br>

The application needs no build step: `index.html`, `style.css`,
`stringart-core.js`, and `script.js` run as they are. The build script only
packages them for hosting.

## 📂 Project structure

```text
StringArt2/
├── index.html          # Page layout and controls
├── stringart-core.js   # Algorithms, statistics, exports (no DOM; also runs in a Web Worker and Node)
├── script.js           # User interface (StringArtGenerator class)
├── style.css           # Styles
├── package.json        # npm scripts (no dependencies)
├── build.js            # Packages the app into dist/
├── build_dist.sh       # Runs build.js from any directory
├── serve.js            # Local static server for testing
├── tests/              # Node tests for stringart-core.js
├── docs/images/        # README screenshot
├── assets/             # Example portrait, results, and best-settings.txt
├── deploy/
│   └── .htaccess       # Optional Apache configuration, copied into dist/
├── COPYING             # GNU GPL v3
├── COPYING.LESSER      # GNU LGPL v3 (the project license)
└── dist/               # Build output (generated, not tracked in git)
    ├── index.html              # All-in-one file (recommended)
    ├── index-separate.html     # Page that loads the files below
    ├── style.min.css           # Minified CSS
    ├── stringart-core.js       # Algorithms, unmodified
    ├── script.js               # User interface, unmodified
    ├── .htaccess
    ├── COPYING
    └── COPYING.LESSER
```

## 🔨 Building

You need Node.js 18 or newer. There are no npm dependencies.

```bash
npm run build
# or
./build_dist.sh
# or
node build.js
```

The build:

- inlines the CSS and JavaScript into `dist/index.html`, so the whole app is
  one file;
- minifies the CSS and adds a one-line copyright and license banner;
- copies the JavaScript **unchanged**. It is not minified or obfuscated, so
  the code users run is the same code they can read and modify;
- keeps the generator working in the single file: the Web Worker is built at
  run time from the inlined `stringart-core.js`, so no separate worker file
  is needed;
- copies `deploy/.htaccess` and the license files into `dist/`.

`dist/` is deleted and recreated on every build.

## 🚀 Deployment options

### Option 1: All-in-one file (easiest)

```bash
scp dist/index.html user@server:/var/www/html/stringart.html
```

### Option 2: Separate files

```bash
cd dist
scp index-separate.html style.min.css stringart-core.js script.js .htaccess COPYING COPYING.LESSER \
    user@server:/var/www/html/stringart/
```

Rename `index-separate.html` to `index.html` on the server if you want it to
be the default page.

### Option 3: Static hosting

Any static host works (GitHub Pages, Netlify, an S3 bucket, and so on).
Publish either `dist/` or the repository root.

### Option 4: Test locally first

```bash
npm run serve:dist
# Visit http://localhost:8080
```

## ⚙️ Apache configuration (`.htaccess`)

The optional `deploy/.htaccess` (Apache 2.4):

- disables directory listing;
- sets `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy`
  headers;
- enables compression and caching when the modules are available;
- refuses to serve `.md`, `.sh`, and `.log` files.

Other web servers ignore it.

## 🔧 Modifying & rebuilding

1. Edit `index.html`, `stringart-core.js`, `script.js`, or `style.css`.
2. Run `npm test` and test by opening `index.html` in a browser.
3. Run `npm run build`.
4. Test `dist/index.html`.
5. Deploy.

## 📝 License

When you redistribute the application, modified or not, keep the copyright
notices and include `COPYING` and `COPYING.LESSER` (the build copies them into
`dist/`). The in-page footer credits the author and links to the license;
please keep it. See the [License](README.md#license) section of the README.
