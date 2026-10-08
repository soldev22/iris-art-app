import React, { useState, useEffect, useRef } from 'react';
import { mk, clamp, makeSampleEye, detectIris, makeCrop, makePolar, meanColour, RENDERERS, compose, hexLum } from './engine.js';
import { Slider, Check, Seg, StyleControls, pct } from './ui.jsx';
import Group from './Group.jsx';
import { buildMember, restoreMember, MAX_GROUP } from './group.js';
import { loadGroup, saveGroup } from './store.js';
import { deliver, toBlob } from './deliver.js';

let srcCounter = 0;
const STYLES = [
  { id: 'kaleido', name: 'Kaleidoscope', desc: 'Mirrored wedges, with optional twist' },
  { id: 'rings', name: 'Tree rings', desc: 'Concentric bands of iris colour' },
  { id: 'cutout', name: 'Isolated iris', desc: 'Clean cutout, transparent or on colour' },
  { id: 'pano', name: 'Unwrapped', desc: 'The iris opened out into a landscape' },
  { id: 'stipple', name: 'Stipple', desc: 'Thousands of coloured dots' },
  { id: 'halftone', name: 'Halftone', desc: 'Dots sized by brightness' }
];
const DEFAULTS = { rebuild: true, segments: 8, rotate: 0, source: 0, twist: 0, inner: 0, outer: 1, flip: false, fullFrame: false, keepPupil: true, feather: 0.25,
  bands: 48, gap: 0.12, detail: 0.5, aspect: 3.5, mirror: false, dots: 40000, dotSize: 3, layout: 'radial', cells: 60, gain: 1.05 };
const GRADE0 = { sat: 1, con: 1, hue: 0, bri: 1, sharp: 0.4, clar: 0.15, clean: 0.6 };
const SIZES = [1600, 2400, 3600, 4800];
const PS = Math.min(1400, Math.round(900 * Math.max(1, window.devicePixelRatio || 1)));

async function loadFile(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) {
    bmp = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('That file could not be read as an image.')); im.src = URL.createObjectURL(file); });
  }
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight, sc = Math.min(1, 5000 / Math.max(w, h));
  const c = mk(Math.round(w * sc), Math.round(h * sc));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

function setAccent(r, g, b) {
  const R = r / 255, G = g / 255, B = b / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn;
  let h = 0;
  if (d > 0) { h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4; h *= 60; if (h < 0) h += 360; }
  const l = (mx + mn) / 2, s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), st = document.documentElement.style;
  st.setProperty('--ah', Math.round(h));
  st.setProperty('--as', Math.round(clamp(s * 100, 40, 75)) + '%');
}

function renderArt(S, A, style, P, bg, transparent) {
  const art = RENDERERS[style](S, A, { ...P, bgDark: hexLum(bg) < 0.45 });
  return compose(art, bg, transparent);
}

export default function App() {
  const [src, setSrc] = useState(null);
  const [circ, setCirc] = useState(null);
  const [trim, setTrim] = useState({ top: 0, bot: 0 });
  const [grade, setGrade] = useState(GRADE0);
  const [style, setStyle] = useState('kaleido');
  const [P, setPR] = useState(DEFAULTS);
  const [bg, setBg] = useState('#111113');
  const [transparent, setTransparent] = useState(false);
  const [size, setSize] = useState(3600);
  const [fmt, setFmt] = useState('png');
  const [status, setStatus] = useState({ text: 'Preparing the example eye…', err: false });
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [over, setOver] = useState(false);
  const [cur, setCur] = useState('default');
  const [members, setMembers] = useState([]);
  const groupLoaded = useRef(false), exampleN = useRef(0);
  const viewRef = useRef(), prevRef = useRef(), svgRef = useRef(), fileRef = useRef(), cache = useRef(null), drag = useRef(null);
  const setP = (k, v) => setPR(o => ({ ...o, [k]: v }));
  const say = (text, err) => setStatus({ text, err: !!err });

  useEffect(() => {
    let alive = true;
    loadGroup().then(async rows => {
      const list = [];
      for (const r of rows) { try { list.push(await restoreMember(r)); } catch (e) { /* skip unreadable entry */ } }
      if (alive && list.length) setMembers(list);
      groupLoaded.current = true;
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!groupLoaded.current) return;
    const t = setTimeout(() => saveGroup(members), 300);
    return () => clearTimeout(t);
  }, [members]);

  useEffect(() => {
    const t = setTimeout(() => setSrc({ id: ++srcCounter, canvas: makeSampleEye(), name: 'Example eye', sample: true }), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!src) return;
    const cv = viewRef.current, sc = Math.min(1, 1400 / Math.max(src.canvas.width, src.canvas.height));
    cv.width = Math.round(src.canvas.width * sc); cv.height = Math.round(src.canvas.height * sc);
    cv.getContext('2d').drawImage(src.canvas, 0, 0, cv.width, cv.height);
    say('Looking for the iris…');
    const t = setTimeout(() => {
      try {
        const c = detectIris(src.canvas); setCirc(c); setTrim({ top: 0.1, bot: 0.04 });
        say((src.sample ? 'Example eye is generated, upload your own photo to replace it. ' : '') + 'Iris found, radius ' + Math.round(c.ir) + ' px. Drag the rings if they sit off.');
      } catch (e) {
        const m = Math.min(src.canvas.width, src.canvas.height);
        setCirc({ cx: src.canvas.width / 2, cy: src.canvas.height / 2, ir: m / 4, pr: m / 12 });
        say('Could not find the iris automatically. Place the rings by hand.', true);
      }
    }, 40);
    return () => clearTimeout(t);
  }, [src]);

  useEffect(() => {
    if (!src || !circ) return;
    setBusy(true);
    const t = setTimeout(() => {
      try {
        const key = src.id + JSON.stringify([circ, trim, grade]);
        let A = cache.current;
        if (!A || A.key !== key) {
          const crop = makeCrop(src.canvas, circ, grade, trim), polar = makePolar(crop, circ, trim);
          A = { key, circ, trim, crop, polar }; cache.current = A;
          const m = meanColour(polar); setAccent(m[0], m[1], m[2]);
        }
        const out = renderArt(PS, A, style, P, bg, transparent), pv = prevRef.current;
        pv.width = out.width; pv.height = out.height; pv.getContext('2d').drawImage(out, 0, 0);
      } catch (e) { say('Preview failed: ' + e.message, true); }
      setBusy(false);
    }, 70);
    return () => clearTimeout(t);
  }, [src, circ, trim, grade, style, P, bg, transparent]);

  async function pick(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { say('Choose an image file (JPG, PNG, WebP).', true); return; }
    say('Reading ' + file.name + '…');
    try { const canvas = await loadFile(file); setSrc({ id: ++srcCounter, canvas, name: file.name, sample: false }); }
    catch (e) { say(e.message, true); }
  }

  const toSrc = e => { const r = svgRef.current.getBoundingClientRect(), k = src.canvas.width / r.width; return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, k }; };
  const modeAt = p => {
    const d = Math.hypot(p.x - circ.cx, p.y - circ.cy), tol = 16 * p.k;
    if (Math.abs(d - circ.ir) < tol) return 'ir';
    if (Math.abs(d - circ.pr) < tol) return 'pr';
    return d < circ.ir ? 'move' : null;
  };
  function onDown(e) {
    if (!circ) return;
    const p = toSrc(e), mode = modeAt(p); if (!mode) return;
    drag.current = { mode, dx: circ.cx - p.x, dy: circ.cy - p.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    if (!circ) return;
    const p = toSrc(e), dr = drag.current;
    if (!dr) { const m = modeAt(p); setCur(m === 'move' ? 'move' : m ? 'ew-resize' : 'default'); return; }
    const lim = Math.min(src.canvas.width, src.canvas.height) * 0.6;
    setCirc(c => {
      if (dr.mode === 'move') return { ...c, cx: p.x + dr.dx, cy: p.y + dr.dy };
      const d = Math.hypot(p.x - c.cx, p.y - c.cy);
      return dr.mode === 'ir' ? { ...c, ir: clamp(d, c.pr + 6, lim) } : { ...c, pr: clamp(d, 3, c.ir - 6) };
    });
  }
  const onUp = () => { drag.current = null; };

  function redetect() {
    if (!src) return;
    say('Looking for the iris…');
    setTimeout(() => {
      try { const c = detectIris(src.canvas); setCirc(c); say('Iris found, radius ' + Math.round(c.ir) + ' px.'); }
      catch (e) { say('Could not find the iris automatically.', true); }
    }, 30);
  }

  async function addToGroup() {
    if (!circ || !cache.current) return;
    if (members.length >= MAX_GROUP) { say('The group already has ' + MAX_GROUP + ' irises. Remove one in Step 3 first.', true); return; }
    say('Adding this iris to the group…');
    try {
      const m = await buildMember(cache.current, 'Iris ' + (members.length + 1));
      setMembers(list => [...list, m]);
      say('Added ' + m.name + ' to the group (' + (members.length + 1) + ' of ' + MAX_GROUP + '). Upload the next eye photo, or scroll down to Step 3 to make group art.');
    } catch (e) { say('Could not add this iris: ' + e.message, true); }
  }

  async function saveIris() {
    if (!circ || !cache.current) return;
    say('Rendering the isolated iris…');
    await new Promise(r => setTimeout(r, 30));
    try {
      const art = RENDERERS.cutout(3000, cache.current, { feather: 0.12, keepPupil: true, rebuild: true });
      await deliver(await toBlob(art, 'png'), 'iris-isolated.png');
      say('Saved the isolated iris as a transparent PNG (3000 x 3000 px).');
    } catch (e) { say(e && e.code === 'declined' ? 'Save cancelled.' : (e && e.message) || 'Save failed.', !(e && e.code === 'declined')); }
  }

  async function doExport() {
    if (!circ || !cache.current) return;
    setExporting(true); say('Rendering ' + size + ' px. Large sizes take a few seconds…');
    await new Promise(r => setTimeout(r, 50));
    try {
      const tr = transparent && fmt === 'png', out = renderArt(size, cache.current, style, P, bg, tr);
      const blob = await new Promise((res, rej) => out.toBlob(b => b ? res(b) : rej(new Error('The browser could not encode an image this large. Try a smaller size.')), fmt === 'jpg' ? 'image/jpeg' : 'image/png', 0.95));
      await deliver(blob, 'iris-' + style + '-' + size + '.' + fmt);
      say('Saved ' + out.width + ' x ' + out.height + ' px ' + fmt.toUpperCase() + '.');
    } catch (e) {
      if (e && e.code === 'declined') say('Save cancelled.');
      else if (e && e.code === 'too_large') say('That file is too large for this view. Choose a smaller size.', true);
      else say((e && e.message) || 'Export failed.', true);
    }
    setExporting(false);
  }

  const W = src ? src.canvas.width : 1, H = src ? src.canvas.height : 1, c = circ;
  const yTop = c ? c.cy - c.ir + 2 * c.ir * trim.top : 0, yBot = c ? c.cy + c.ir - 2 * c.ir * trim.bot : 0;
  const maxR = Math.round(Math.min(W, H) * 0.6);
  const outH = style === 'pano' ? Math.round(size / P.aspect) : size;
  const deg = v => v + ' px';

  return (
    <>
      <header className="top">
        <div className="brand"><h1>Iris Studio</h1><span className="sub">Photograph in, iris out, art made from it.</span><span className="mono" title="Build time of this version">Build {__BUILD__}</span></div>
        <div className="spacer"></div>
        <div className="btns">
          <button className="btn primary" onClick={() => fileRef.current.click()}>Upload eye photo</button>
          <button className="btn" onClick={() => { exampleN.current = (exampleN.current + 1) % 2; setSrc({ id: ++srcCounter, canvas: makeSampleEye(exampleN.current), name: 'Example eye', sample: true }); }}>Example eye</button>
        </div>
        <input ref={fileRef} id="file" type="file" accept="image/*" hidden onChange={e => { pick(e.target.files[0]); e.target.value = ''; }} />
      </header>
      <main className="grid">
        <section className="panel" aria-labelledby="h-iso">
          <div className="ph"><span className="step">Step 1</span><h2 id="h-iso">Isolate the iris</h2></div>
          <p className="hint">Drag the solid ring to resize the iris, the dashed ring for the pupil, or drag inside to move both. Eyelids hide part of most irises, so the trim sliders start slightly in. You can also drop a photo here.</p>
          <div className={'stage' + (over ? ' drop' : '')}
            onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}>
            <canvas ref={viewRef} hidden={!src} aria-label="Source eye photo"></canvas>
            {!src ? <div style={{ aspectRatio: '14 / 9' }}></div> : null}
            {src && c ? (
              <svg ref={svgRef} viewBox={'0 0 ' + W + ' ' + H} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} style={{ cursor: cur }}>
                <path fillRule="evenodd" style={{ fill: 'var(--scrim)' }} d={'M0 0H' + W + 'V' + H + 'H0Z M' + (c.cx - c.ir) + ' ' + c.cy + 'a' + c.ir + ' ' + c.ir + ' 0 1 0 ' + (2 * c.ir) + ' 0a' + c.ir + ' ' + c.ir + ' 0 1 0 ' + (-2 * c.ir) + ' 0Z'} />
                <circle cx={c.cx} cy={c.cy} r={c.ir} fill="none" strokeWidth="2.5" vectorEffect="non-scaling-stroke" style={{ stroke: 'var(--accent)' }} />
                <circle cx={c.cx} cy={c.cy} r={c.pr} fill="none" strokeWidth="2" strokeDasharray="7 5" vectorEffect="non-scaling-stroke" style={{ stroke: 'var(--accent)' }} />
                {trim.top > 0 ? <line x1={c.cx - c.ir} x2={c.cx + c.ir} y1={yTop} y2={yTop} strokeWidth="1.5" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" style={{ stroke: '#fff' }} /> : null}
                {trim.bot > 0 ? <line x1={c.cx - c.ir} x2={c.cx + c.ir} y1={yBot} y2={yBot} strokeWidth="1.5" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" style={{ stroke: '#fff' }} /> : null}
                <circle cx={c.cx + c.ir} cy={c.cy} r={W * 0.006} style={{ fill: 'var(--accent)' }} />
                <circle cx={c.cx + c.pr} cy={c.cy} r={W * 0.005} style={{ fill: 'var(--accent)' }} />
                <circle cx={c.cx} cy={c.cy} r={W * 0.003} style={{ fill: 'var(--accent)' }} />
              </svg>
            ) : null}
          </div>
          <div className={'status' + (status.err ? ' err' : '')} role="status">{status.text}</div>
          <div className="btns">
            <button className="btn" onClick={redetect} disabled={!src}>Find iris automatically</button>
            <button className="btn primary" onClick={addToGroup} disabled={!c}>Add this iris to the group ({members.length} of {MAX_GROUP})</button>
            <button className="btn" onClick={saveIris} disabled={!c}>Save isolated iris (PNG)</button>
          </div>
          {c ? (
            <div className="fields">
              <Slider label="Iris radius" value={Math.round(c.ir)} min={12} max={maxR} step={1} fmt={deg} onChange={v => setCirc(o => ({ ...o, ir: v, pr: Math.min(o.pr, v - 6) }))} />
              <Slider label="Pupil radius" value={Math.round(c.pr)} min={3} max={Math.max(4, Math.round(c.ir - 6))} step={1} fmt={deg} onChange={v => setCirc(o => ({ ...o, pr: v }))} />
              <Slider label="Centre across" value={Math.round(c.cx)} min={0} max={W} step={1} fmt={deg} onChange={v => setCirc(o => ({ ...o, cx: v }))} />
              <Slider label="Centre down" value={Math.round(c.cy)} min={0} max={H} step={1} fmt={deg} onChange={v => setCirc(o => ({ ...o, cy: v }))} />
              <Slider label="Trim upper eyelid" value={trim.top} min={0} max={0.6} step={0.01} fmt={pct} onChange={v => setTrim(o => ({ ...o, top: v }))} />
              <Slider label="Trim lower eyelid" value={trim.bot} min={0} max={0.6} step={0.01} fmt={pct} onChange={v => setTrim(o => ({ ...o, bot: v }))} />
            </div>
          ) : null}
          <div className="group">
            <div className="glabel">Colour and focus</div>
            <div className="fields">
              <Slider label="Saturation" value={grade.sat} min={0} max={2} step={0.01} fmt={pct} onChange={v => setGrade(o => ({ ...o, sat: v }))} />
              <Slider label="Contrast" value={grade.con} min={0.5} max={1.8} step={0.01} fmt={pct} onChange={v => setGrade(o => ({ ...o, con: v }))} />
              <Slider label="Brightness" value={grade.bri} min={0.5} max={1.6} step={0.01} fmt={pct} onChange={v => setGrade(o => ({ ...o, bri: v }))} />
              <Slider label="Clean reflections and flash" value={grade.clean} min={0} max={1} step={0.05} fmt={v => v <= 0 ? 'Off' : pct(v)} onChange={v => setGrade(o => ({ ...o, clean: v }))} />
              <Slider label="Sharpen fine detail" value={grade.sharp} min={0} max={2} step={0.05} fmt={pct} onChange={v => setGrade(o => ({ ...o, sharp: v }))} />
              <Slider label="Clarity (local contrast)" value={grade.clar} min={0} max={1} step={0.05} fmt={pct} onChange={v => setGrade(o => ({ ...o, clar: v }))} />
              <Slider label="Hue shift" value={grade.hue} min={-180} max={180} step={1} fmt={v => v + '°'} onChange={v => setGrade(o => ({ ...o, hue: v }))} />
            </div>
            <div className="btns"><button className="btn" onClick={() => setGrade(GRADE0)}>Reset colour and focus</button></div>
          </div>
        </section>

        <section className="panel" aria-labelledby="h-art">
          <div className="ph"><span className="step">Step 2</span><h2 id="h-art">Make the art</h2></div>
          <div className="styles" role="group" aria-label="Art style">
            {STYLES.map(s => <button key={s.id} className="sbtn" aria-pressed={style === s.id} onClick={() => setStyle(s.id)}><b>{s.name}</b><span>{s.desc}</span></button>)}
          </div>
          <div className="preview"><canvas ref={prevRef} aria-label="Art preview"></canvas>{busy ? <span className="busy">Rendering</span> : null}</div>
          <StyleControls style={style} P={P} setP={setP} setPR={setPR} />
          <div className="group">
            <div className="glabel">Background</div>
            <div className="row">
              <input id="bg" type="color" value={bg} onChange={e => setBg(e.target.value)} aria-label="Background colour" />
              <Check label="Transparent (PNG)" checked={transparent} onChange={setTransparent} />
            </div>
          </div>
          <div className="group">
            <div className="glabel">Export</div>
            <div className="row">
              <label className="mono" htmlFor="size">Long edge</label>
              <select id="size" value={size} onChange={e => setSize(parseInt(e.target.value))}>{SIZES.map(s => <option key={s} value={s}>{s} px</option>)}</select>
              <Seg label="File type" value={fmt} onChange={setFmt} options={[['png', 'PNG'], ['jpg', 'JPG']]} />
              <button className="btn primary" onClick={doExport} disabled={exporting || !c}>{exporting ? 'Rendering…' : 'Save image'}</button>
            </div>
            <div className="mono">{size} x {outH} px, about {(size / 300).toFixed(1)} x {(outH / 300).toFixed(1)} in at 300 dpi{transparent && fmt === 'jpg' ? '. JPG has no transparency, the background colour is used.' : ''}</div>
          </div>
        </section>
      </main>
      <Group members={members} setMembers={setMembers} />
    </>
  );
}
