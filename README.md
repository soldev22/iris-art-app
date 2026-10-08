# Iris Studio

Upload an eye photo, isolate the iris, and turn it into art. Everything runs in the browser, nothing is uploaded anywhere.

## Run it

    npm install
    npm run build        # writes dist/iris-studio.html

`dist/iris-studio.html` is one self-contained file (React is bundled inside). Double-click it and it works with no internet. If you are online it also picks up the Google fonts; offline it uses your system fonts.

## Layout

- `src/engine.js`  iris detection, eyelid trim, polar unwrap, sharpen, and the six art styles (plain JavaScript on canvas)
- `src/App.jsx`    the React app: photo with draggable rings, style picker, preview, export
- `src/ui.jsx`     sliders, checkboxes, and the per-style controls
- `src/styles.css` design tokens (dark and light) and layout
- `build.mjs`      esbuild script that inlines everything into the single HTML file

## Adding a style

Write a function `rMyStyle(S, A, p)` in `src/engine.js` that returns a canvas, add it to `RENDERERS`, then add an entry to `STYLES` in `src/App.jsx` and a block in `StyleControls` in `src/ui.jsx`.
