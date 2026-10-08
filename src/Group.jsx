import React, { useEffect, useRef, useState } from 'react';
import { Slider, Check, Seg, pct } from './ui.jsx';
import { renderGroup, groupDims, avgPupil, edge, GROUP_DEFAULTS, MAX_GROUP } from './group.js';
import { compose } from './engine.js';
import { deliver, toBlob } from './deliver.js';

const SIZES = [1600, 2400, 3600, 4800];
const GSTYLES = [
  { id: 'collide', name: 'Colliding irises', desc: 'Irises overlap and blend where they meet' },
  { id: 'infinity', name: 'Infinity loop', desc: 'A ribbon of iris looping around each pair' }
];
const PREVIEW = Math.min(1400, Math.round(900 * Math.max(1, window.devicePixelRatio || 1)));

export default function Group({ members, setMembers }) {
  const [P, setPR] = useState(GROUP_DEFAULTS);
  const [bg, setBg] = useState('#111113');
  const [transparent, setTransparent] = useState(false);
  const [size, setSize] = useState(3600);
  const [fmt, setFmt] = useState('png');
  const [status, setStatus] = useState({ text: '', err: false });
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const prevRef = useRef();
  const setP = (k, v) => setPR(o => ({ ...o, [k]: v }));
  const n = members.length;

  useEffect(() => {
    if (!n) return;
    setBusy(true);
    const t = setTimeout(() => {
      try {
        const out = compose(renderGroup(members, P, PREVIEW), bg, transparent), cv = prevRef.current;
        cv.width = out.width; cv.height = out.height; cv.getContext('2d').drawImage(out, 0, 0);
        setStatus({ text: '', err: false });
      } catch (e) { setStatus({ text: 'Preview failed: ' + e.message, err: true }); }
      setBusy(false);
    }, 80);
    return () => clearTimeout(t);
  }, [members, P, bg, transparent]);

  const rename = (id, name) => setMembers(a => a.map(m => m.id === id ? { ...m, name } : m));
  const setEdge = (id, v) => setMembers(a => a.map(m => m.id === id ? { ...m, prDark: v } : m));
  const remove = id => setMembers(a => a.filter(m => m.id !== id));
  const move = (i, d) => setMembers(a => { const b = a.slice(), j = i + d; if (j < 0 || j >= b.length) return a; [b[i], b[j]] = [b[j], b[i]]; return b; });

  async function save() {
    setExporting(true); setStatus({ text: 'Rendering ' + size + ' px. Large sizes take a few seconds…', err: false });
    await new Promise(r => setTimeout(r, 50));
    try {
      const art = renderGroup(members, P, size), out = compose(art, bg, transparent && fmt === 'png');
      await deliver(await toBlob(out, fmt), 'iris-group-' + P.style + '-' + size + '.' + fmt);
      setStatus({ text: 'Saved ' + out.width + ' x ' + out.height + ' px ' + fmt.toUpperCase() + '.', err: false });
    } catch (e) {
      if (e && e.code === 'declined') setStatus({ text: 'Save cancelled.', err: false });
      else setStatus({ text: (e && e.message) || 'Export failed.', err: true });
    }
    setExporting(false);
  }

  const dims = groupDims(Math.max(n, 1), P, size);
  const ring = n > 2;

  return (
    <section className="panel group" aria-labelledby="h-group">
      <div className="ph"><span className="step">Step 3</span><h2 id="h-group">Iris group</h2><span className="mono">{n} of {MAX_GROUP}</span></div>
      <p className="hint">The ring on each card marks where that pupil ends. If a dark rim is left outside it, drag Pupil edge out until the ring sits on the outer edge. Isolate each eye in Step 1 and press Add this iris to the group. Two is typical for a couple, up to six for a family. The group is kept in this browser between visits.</p>
      <div className="tray">
        {Array.from({ length: MAX_GROUP }).map((_, i) => {
          const m = members[i];
          return m ? (
            <div className="slot filled" key={m.id}>
              <div className="thumbwrap">
                <img src={m.thumb} alt={'Iris of ' + m.name} />
                <div className="ring" style={{ width: (edge(m) * 100) + '%' }}></div>
              </div>
              <input aria-label={'Name for iris ' + (i + 1)} value={m.name} maxLength={24} onChange={e => rename(m.id, e.target.value)} />
              <Slider label="Pupil edge" value={edge(m)} min={0.12} max={0.6} step={0.005} fmt={pct} onChange={v => setEdge(m.id, v)} />
              {Math.abs(edge(m) - m.prAuto) > 0.004 ? <button className="mini" onClick={() => setEdge(m.id, m.prAuto)}>Back to automatic</button> : null}
              <div className="slotbtns">
                <button className="mini" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}>&larr;</button>
                <button className="mini" aria-label="Move later" disabled={i === n - 1} onClick={() => move(i, 1)}>&rarr;</button>
                <button className="mini" aria-label={'Remove ' + m.name} onClick={() => remove(m.id)}>Remove</button>
              </div>
            </div>
          ) : (
            <div className="slot empty" key={'e' + i}>{i === n ? 'Next iris goes here' : 'Empty'}</div>
          );
        })}
      </div>

      {n === 0 ? (
        <p className="hint">No irises yet. Isolate one above and add it to start.</p>
      ) : (
        <div className="gsplit">
          <div className="gcontrols">
            <div className="styles" role="group" aria-label="Group art style">
              {GSTYLES.map(s => <button key={s.id} className="sbtn" aria-pressed={P.style === s.id} onClick={() => setP('style', s.id)}><b>{s.name}</b><span>{s.desc}</span></button>)}
            </div>
            {n === 1 ? <p className="hint">Add a second iris to see the group art. One iris is shown on its own.</p> : null}
            <div className="fields">
              {n > 2 ? (
                <div className="field"><div className="lab"><span>Arrangement</span></div>
                  <Seg label="Arrangement" value={P.layout} onChange={v => setP('layout', v)} options={[['line', 'In a line'], ['ring', 'In a ring']]} /></div>
              ) : null}
              {n > 1 ? (<>
                <Check label="Make all pupils the same size" checked={P.matchPupil} onChange={v => setP('matchPupil', v)} />
                {P.matchPupil ? (
                  <div className="field">
                    <Slider label="Pupil size (share of iris width)" value={P.pupil == null ? avgPupil(members) : P.pupil} min={0.2} max={0.6} step={0.01} fmt={pct} onChange={v => setP('pupil', v)} />
                    {P.pupil != null ? <button className="mini" onClick={() => setP('pupil', null)}>Use the group average</button> : null}
                  </div>
                ) : null}
              </>) : null}
              <div className="field">
                <Check label="Repaint pupils so they look identical" checked={P.repaint} onChange={v => setP('repaint', v)} />
                {P.repaint ? (
                  <div className="row">
                    <input id="pupilcol" type="color" value={P.pupilColour} onChange={e => setP('pupilColour', e.target.value)} aria-label="Pupil colour" />
                    <span className="mono">Pupil colour</span>
                  </div>
                ) : null}
              </div>
              {P.repaint ? <Slider label="Pupil edge softness" value={P.pupilSoft} min={0} max={1} step={0.01} fmt={pct} onChange={v => setP('pupilSoft', v)} /> : null}
              <Slider label="Rotate whole piece" value={P.rotate} min={-180} max={180} step={1} fmt={v => v + '°'} onChange={v => setP('rotate', v)} />
              {P.style === 'collide' ? (<>
                <Slider label="Overlap" value={P.overlap} min={0} max={0.8} step={0.01} fmt={pct} onChange={v => setP('overlap', v)} />
                <Check label="Keep pupils clear where irises overlap" checked={P.pupilsOnTop} onChange={v => setP('pupilsOnTop', v)} />
                <Slider label="Edge softness" value={P.soft} min={0} max={1} step={0.01} fmt={pct} onChange={v => setP('soft', v)} />
                <div className="field"><div className="lab"><span>Where they meet</span></div>
                  <Seg label="Blend" value={P.blend} onChange={v => setP('blend', v)} options={[['blend', 'Blend'], ['screen', 'Glow'], ['multiply', 'Deepen'], ['difference', 'Contrast']]} /></div>
              </>) : (<>
                <Slider label="Ribbon width" value={P.width} min={0.15} max={0.8} step={0.01} fmt={pct} onChange={v => setP('width', v)} />
                <Slider label="Space between loops" value={P.gap} min={0.1} max={1} step={0.01} fmt={pct} onChange={v => setP('gap', v)} />
                <Slider label="Fibre length" value={P.fibre} min={1.5} max={10} step={0.1} fmt={v => v.toFixed(1)} onChange={v => setP('fibre', v)} />
              </>)}
            </div>
            {P.style === 'infinity' && n > 2 ? <p className="hint">With more than two irises, each neighbouring pair is linked by its own infinity loop.</p> : null}
            <div className="group">
              <div className="glabel">Background and export</div>
              <div className="row">
                <input id="gbg" type="color" value={bg} onChange={e => setBg(e.target.value)} aria-label="Background colour" />
                <Check label="Transparent (PNG)" checked={transparent} onChange={setTransparent} />
              </div>
              <div className="row">
                <label className="mono" htmlFor="gsize">Long edge</label>
                <select id="gsize" value={size} onChange={e => setSize(parseInt(e.target.value))}>{SIZES.map(s => <option key={s} value={s}>{s} px</option>)}</select>
                <Seg label="File type" value={fmt} onChange={setFmt} options={[['png', 'PNG'], ['jpg', 'JPG']]} />
                <button className="btn primary" onClick={save} disabled={exporting}>{exporting ? 'Rendering…' : 'Save group image'}</button>
              </div>
              <div className="mono">{dims.w} x {dims.h} px, about {(dims.w / 300).toFixed(1)} x {(dims.h / 300).toFixed(1)} in at 300 dpi</div>
              <div className={'status' + (status.err ? ' err' : '')} role="status">{status.text}</div>
            </div>
          </div>
          <div className="gpreview">
            <div className="preview"><canvas ref={prevRef} aria-label="Group art preview"></canvas>{busy ? <span className="busy">Rendering</span> : null}</div>
          </div>
        </div>
      )}
    </section>
  );
}
