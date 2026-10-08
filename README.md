# Iris Studio

Upload an eye photo, isolate the iris, and turn it into art. Everything runs in the browser, nothing is uploaded anywhere.

## Run it

    npm install
    npm run build        # writes dist/iris-studio.html

`dist/iris-studio.html` is one self-contained file (React is bundled inside). Double-click it and it works with no internet. If you are online it also picks up the Google fonts; offline it uses your system fonts.

## Using it

1. Upload an eye photo (or use the example eye; the button cycles two examples), check the rings, trim eyelids, adjust colour and focus. **Clean reflections and flash** (on by default) removes catchlights from the iris and pupil.
2. Make single-eye art in Step 2, or press **Add this iris to the group** to keep the isolated iris. **Save isolated iris (PNG)** saves it as a transparent PNG.
3. Add up to 6 irises (two for a couple, more for a family). In Step 3 choose **Colliding irises** or **Infinity loop** and save the group image. **Make all pupils the same size** (on by default) matches the pupils across the group. **Repaint pupils so they look identical** (on by default) redraws every pupil as the same clean disc, with your choice of colour and edge softness. The group is kept in the browser (IndexedDB) between visits.

## Layout

- `src/engine.js`  iris detection, eyelid trim, polar unwrap, sharpen, and the six art styles (plain JavaScript on canvas)
- `src/App.jsx`    the React app: photo with draggable rings, style picker, preview, export
- `src/group.js`   group members, colliding-irises and infinity-loop rendering
- `src/Group.jsx`  the Step 3 group panel
- `src/store.js`   keeps the group in IndexedDB
- `src/deliver.js` saves files (browser download, or the claude.ai viewer's save prompt)
- `src/ui.jsx`     sliders, checkboxes, and the per-style controls
- `src/styles.css` design tokens (dark and light) and layout
- `build.mjs`      esbuild script that inlines everything into the single HTML file

## Adding a style

Write a function `rMyStyle(S, A, p)` in `src/engine.js` that returns a canvas, add it to `RENDERERS`, then add an entry to `STYLES` in `src/App.jsx` and a block in `StyleControls` in `src/ui.jsx`.
