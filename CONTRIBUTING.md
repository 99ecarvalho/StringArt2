# Contributing to String Art Generator

Thanks for your interest in String Art Generator! Bug reports, documentation
fixes, example images, and code are all welcome. This guide explains how to get
a change merged with as little back-and-forth as possible.

- [Ways to contribute](#ways-to-contribute)
- [Reporting bugs](#reporting-bugs)
- [Development setup](#development-setup)
- [Making a change](#making-a-change)
- [Coding style](#coding-style)
- [Commit messages](#commit-messages)
- [Pull requests](#pull-requests)
- [Licensing of contributions](#licensing-of-contributions)

## Ways to contribute

- **Report a bug** or unexpected behavior. See [Reporting bugs](#reporting-bugs).
- **Improve the documentation.** If something was unclear or wrong, a fix is
  welcome. The user guides are [README.md](README.md),
  [QUICKSTART.md](QUICKSTART.md), [ALGORITHMS.md](ALGORITHMS.md), and
  [RADON_EXPLAINED.md](RADON_EXPLAINED.md).
- **Improve the algorithms.** Better line scoring, faster generation, and
  new algorithms are all useful. Please include before/after images and
  match scores with the same input and parameters.
- **Test on your browser and device.** Reports from mobile browsers and
  low-end hardware help a lot.
- **Share results.** Physical pieces built from the exported instructions, or
  robot/CNC integrations using the JSON export, are great feedback.

## Reporting bugs

Search the [existing issues](https://github.com/99ecarvalho/StringArt2/issues)
first. If your bug is new, [open an issue](https://github.com/99ecarvalho/StringArt2/issues/new) and
include:

- the commit hash or release you used, and whether you opened `index.html`
  directly or the built `dist/index.html`;
- your browser and version, and your OS;
- the algorithm and every parameter value you used;
- the input image, or a similar one that reproduces the problem, if you can
  share it;
- what you expected to happen and what happened instead;
- any errors shown in the browser's developer console (F12).

A minimal way to reproduce the problem is the most valuable thing you can
provide.

## Development setup

The application is plain HTML, CSS, and JavaScript with no runtime
dependencies and no framework. You only need a modern browser. Node.js 18 or
newer is needed for the tests, the build script, and the local server; there
is nothing to `npm install`.

```bash
git clone https://github.com/99ecarvalho/StringArt2.git
cd StringArt2
npm start                        # serves http://localhost:8080 (or open index.html directly)
npm test                         # runs the tests
```

The source files are:

| File | Purpose |
| ---- | ------- |
| `index.html` | Page layout and controls |
| `style.css` | Styles |
| `stringart-core.js` | Pin geometry, image-to-darkness conversion, line rasterization, both algorithms, image analysis, statistics, and the export formats. No DOM access |
| `script.js` | The `StringArtGenerator` class: controls, image preparation, running the generator in a Web Worker, animation, and downloads |
| `tests/core.test.js` | Tests for `stringart-core.js` (`node:test`) |
| `build.js` | Bundles the app into `dist/`; see [BUILD_GUIDE.md](BUILD_GUIDE.md) |
| `serve.js` | Local static server used by `npm start` |

### Testing your change

Before opening a pull request:

1. Run `npm run check` (syntax) and `npm test`. **Add a test** to
   `tests/core.test.js` for a bug fix (one that fails without the fix) or a
   new feature of the core.
2. Open `index.html` in a browser, upload an image, and generate with **both**
   algorithms. Confirm the animation, the statistics, Cancel, and all four
   exports (TXT, JSON, PNG, SVG template) still work, with no errors in the
   developer console.
3. Try the edge cases your change could affect: very small and very large
   pin counts, a high Min Pin Distance, non-square images with each fit
   mode, and changing parameters after a generation.
4. Run `npm run build` and check that `dist/index.html` behaves the same as
   the source version, including when opened directly from disk.
5. If you changed the output of an algorithm, attach before/after images and
   the match scores to the pull request.

Describe what you tested in the pull request.

## Making a change

1. For anything larger than a small fix, **open an issue first** to discuss
   the approach. This avoids wasted work on changes that don't fit the
   project.
2. Fork the repository and create a branch from `main`:
   `git checkout -b fix/radon-threshold`.
3. Keep each pull request focused on one topic. Unrelated clean-ups belong in
   a separate pull request.
4. Update the documentation in the same pull request when you change
   behavior: the README, the user guides, and the in-page hints in
   `index.html`. If you change the JSON export, update the example in the
   README and bump `metadata.version` when the change is not
   backward compatible.

## Coding style

Follow the style of the surrounding code:

- Plain modern JavaScript (ES2020) that runs directly in the browser, with no
  build step required for development and no runtime dependencies.
- 4-space indentation, no tabs, semicolons, and single quotes.
- `camelCase` for methods and variables, `PascalCase` for classes, and
  `UPPER_CASE` for constants.
- Keep `stringart-core.js` free of DOM access and top-level state: it also
  runs in a Web Worker, which is built from `StringArtCore.factory.toString()`,
  so everything it uses must be defined inside the factory function.
- Keep page logic in the `StringArtGenerator` class in `script.js`.
- A generation works on a copy of the parameters taken when it starts, and
  replaces `this.result` only when it finishes, so editing the inputs during
  or after a run can never mix the pins of one run with the sequence of
  another.
- Long-running work belongs in the core, driven through `createRun().step()`,
  so it can run in the worker and report progress.
- Don't insert untrusted text (file names, image data) into the page with
  `innerHTML`; use `textContent`.
- Comment the *why* of non-obvious math, as in `radonTransform()` and
  `rasterizeLine()`.

New source files start with this header (adapt the comment syntax to the
file type):

```javascript
/**
 * One-line description
 *
 * Copyright (c) 2026 Your Name <you@example.com>
 *
 * This file is part of String Art Generator. It is free software, licensed
 * under the GNU Lesser General Public License v3.0 or later. See
 * COPYING.LESSER and COPYING for details.
 *
 * SPDX-License-Identifier: LGPL-3.0-or-later
 */
```

When you make a substantial change to an existing file, you may add your own
copyright line below the existing one.

## Commit messages

The project uses [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<optional scope>): <short summary in the imperative>

<optional body explaining what changed and why>
```

Common types are `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`,
and `chore`. For example:

```text
fix(radon): look up projections by normal angle, not line direction

The lookup compared the line's direction with the projection's normal
angle, so every candidate line matched an unrelated projection.
```

Keep the summary line under about 72 characters. Make each commit leave the
application working.

## Pull requests

Before you open a pull request, check that:

- [ ] `npm run check` and `npm test` pass;
- [ ] both algorithms still generate, animate, and export correctly;
- [ ] there are no new errors or warnings in the browser console;
- [ ] `npm run build` succeeds and `dist/index.html` works;
- [ ] documentation and in-page hints reflect any change in behavior;
- [ ] new files carry the copyright and SPDX header;
- [ ] commits follow the commit message convention.

Don't commit the `dist/` directory; it is generated.

A maintainer will review the pull request. You may be asked for changes, so
please don't take that as a rejection. It is how the code stays maintainable.

## Licensing of contributions

String Art Generator is licensed under the GNU Lesser General Public License
v3.0 or later (see [COPYING.LESSER](COPYING.LESSER) and [COPYING](COPYING)).
By submitting a contribution, you agree that it is licensed under the same
terms, and you confirm that you have the right to submit it.
