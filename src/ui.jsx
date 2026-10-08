import React, { useRef } from 'react';

export const pct = v => Math.round(v * 100) + '%';

export function Slider({ label, value, min, max, step, onChange, fmt }) {
  const id = useRef('s' + Math.random().toString(36).slice(2)).current;
  return (
    <div className="field">
      <div className="lab"><label htmlFor={id}>{label}</label><span className="val">{fmt ? fmt(value) : value}</span></div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

export function Check({ label, checked, onChange }) {
  return (
    <label className="check"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />{label}</label>
  );
}

export function Seg({ options, value, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(o => <button key={o[0]} aria-pressed={value === o[0]} onClick={() => onChange(o[0])}>{o[1]}</button>)}
    </div>
  );
}

export function StyleControls({ style, P, setP, setPR }) {
  const rebuild = <Check label="Rebuild iris hidden by eyelids, keeps it round" checked={P.rebuild} onChange={v => setP('rebuild', v)} />;
  const deg = v => v + '°';
  if (style === 'kaleido') return (
    <div className="fields">
      <Slider label="Mirror segments" value={P.segments} min={1} max={16} step={1} onChange={v => setP('segments', v)} />
      <Slider label="Rotate" value={P.rotate} min={-180} max={180} step={1} fmt={deg} onChange={v => setP('rotate', v)} />
      <Slider label="Source angle" value={P.source} min={0} max={360} step={1} fmt={deg} onChange={v => setP('source', v)} />
      <Slider label="Twist" value={P.twist} min={-360} max={360} step={5} fmt={deg} onChange={v => setP('twist', v)} />
      <Slider label="Ring start (pupil side)" value={P.inner} min={0} max={0.9} step={0.01} fmt={pct} onChange={v => setPR(o => ({ ...o, inner: Math.min(v, o.outer - 0.08) }))} />
      <Slider label="Ring end (outer edge)" value={P.outer} min={0.1} max={1} step={0.01} fmt={pct} onChange={v => setPR(o => ({ ...o, outer: Math.max(v, o.inner + 0.08) }))} />
      <Check label="Flip: outer edge at centre" checked={P.flip} onChange={v => setP('flip', v)} />
      <Check label="Fill the whole frame" checked={P.fullFrame} onChange={v => setP('fullFrame', v)} />
    </div>
  );
  if (style === 'rings') return (
    <div className="fields">
      <Slider label="Bands" value={P.bands} min={6} max={120} step={1} onChange={v => setP('bands', v)} />
      <Slider label="Gap between bands" value={P.gap} min={0} max={0.6} step={0.01} fmt={pct} onChange={v => setP('gap', v)} />
      <Slider label="Fibre detail" value={P.detail} min={0} max={1} step={0.01} fmt={pct} onChange={v => setP('detail', v)} />
      <Slider label="Source angle" value={P.source} min={0} max={360} step={1} fmt={deg} onChange={v => setP('source', v)} />
    </div>
  );
  if (style === 'cutout') return (
    <div className="fields">
      <Slider label="Edge softness" value={P.feather} min={0} max={1} step={0.01} fmt={pct} onChange={v => setP('feather', v)} />
      <Check label="Keep the pupil" checked={P.keepPupil} onChange={v => setP('keepPupil', v)} />
      {rebuild}
    </div>
  );
  if (style === 'pano') return (
    <div className="fields">
      <Slider label="Width to height" value={P.aspect} min={1.5} max={8} step={0.1} fmt={v => v.toFixed(1) + ' : 1'} onChange={v => setP('aspect', v)} />
      <Slider label="Start angle" value={P.source} min={0} max={360} step={1} fmt={deg} onChange={v => setP('source', v)} />
      <Check label="Mirror into a reflection" checked={P.mirror} onChange={v => setP('mirror', v)} />
      <Check label="Pupil edge at the bottom" checked={P.flip} onChange={v => setP('flip', v)} />
    </div>
  );
  if (style === 'stipple') return (
    <div className="fields">
      <Slider label="Dots" value={P.dots} min={5000} max={120000} step={1000} fmt={v => (v / 1000) + 'k'} onChange={v => setP('dots', v)} />
      <Slider label="Dot size" value={P.dotSize} min={1} max={8} step={0.1} fmt={v => v.toFixed(1)} onChange={v => setP('dotSize', v)} />
      <Check label="Dots inside the pupil too" checked={P.keepPupil} onChange={v => setP('keepPupil', v)} />
      {rebuild}
    </div>
  );
  return (
    <div className="fields">
      <div className="field"><div className="lab"><span>Layout</span></div>
        <Seg label="Layout" value={P.layout} onChange={v => setP('layout', v)} options={[['radial', 'Radial'], ['grid', 'Grid']]} /></div>
      <Slider label="Dots across" value={P.cells} min={20} max={140} step={1} onChange={v => setP('cells', v)} />
      <Slider label="Dot size" value={P.gain} min={0.5} max={1.6} step={0.01} fmt={v => v.toFixed(2)} onChange={v => setP('gain', v)} />
      <Check label="Dots inside the pupil too" checked={P.keepPupil} onChange={v => setP('keepPupil', v)} />
      {rebuild}
    </div>
  );
}
