/* ---------- Engine: detection, isolation, polar unwrap, art styles ---------- */
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
function mulberry(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function mk(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c}
const TAU=Math.PI*2;

/* Example eye, generated here so the tool opens in a working state */
function vnoise(x,y,s){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const h=(a,b)=>{const t=Math.sin(a*127.1+b*311.7+s*74.7)*43758.5453;return t-Math.floor(t)};
  return (h(ix,iy)*(1-u)+h(ix+1,iy)*u)*(1-v)+(h(ix,iy+1)*(1-u)+h(ix+1,iy+1)*u)*v}
function makeSampleEye(){
  const W=1400,H=900,c=mk(W,H),x=c.getContext('2d'),im=x.createImageData(W,H),d=im.data;
  const cx=690,cy=455,IR=250,PR=88;
  const mix=(a,b,t)=>[lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
  for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){
    const dx=xx-cx,dy=y-cy,r=Math.hypot(dx,dy),th=Math.atan2(dy,dx),ct=Math.cos(th),st=Math.sin(th);
    const u=clamp(dx/640,-1,1),k=Math.pow(1-u*u,0.8),top=-228*k+dx*0.02,bot=250*k;
    let col;
    if(!(dy>top&&dy<bot)){
      const e=dy<=top?top-dy:dy-bot;
      const f=0.5+0.5*smooth(0,70,e);
      col=[206*f+vnoise(xx*.03,y*.03,4)*10,158*f+vnoise(xx*.03,y*.03,5)*8,132*f+vnoise(xx*.03,y*.03,6)*8];
    }else{
      const shade=Math.min(0.45+0.55*smooth(0,60,dy-top),0.8+0.2*smooth(0,30,bot-dy));
      const prr=PR*(1+0.025*vnoise(ct*3,st*3,9));
      let sclera=[234,228,222];
      const vein=smooth(0.68,0.82,vnoise(xx*.015,y*.04,7))*0.55*smooth(IR,IR+160,r);
      sclera=[sclera[0]-10*vein,sclera[1]-70*vein,sclera[2]-70*vein];
      if(r<IR+3){
        let ic;
        if(r<prr)ic=[9,8,9];
        else{
          const t=(r-prr)/(IR-prr);
          ic=mix([186,124,52],[64,126,106],smooth(0.3,0.5,t));
          ic=mix(ic,[44,92,122],smooth(0.6,0.95,t));
          const n=0.5*vnoise(ct*40+r*.02,st*40,1)+0.3*vnoise(ct*90,st*90+r*.03,2)+0.2*vnoise(ct*10+r*.05,st*10,3);
          let mod=0.55+0.9*n+Math.exp(-Math.pow((t-0.36)/0.04,2))*0.3;
          const cr=smooth(0.72,0.8,vnoise(ct*14,st*14+t*6,5))*smooth(0.1,0.3,t)*(1-smooth(0.6,0.8,t));
          mod*=1-0.5*cr; mod*=1-0.65*smooth(0.9,1,t); mod*=0.6+0.4*smooth(0,0.06,t);
          ic=[ic[0]*mod,ic[1]*mod,ic[2]*mod];
          ic=mix([9,8,9],ic,smooth(prr-1,prr+2,r));
        }
        col=mix(ic,sclera,smooth(IR-2,IR+3,r));
      }else col=sclera;
      col=[col[0]*shade,col[1]*shade,col[2]*shade];
      const h1=1-smooth(16,42,Math.hypot(xx-(cx-92),y-(cy-98))),h2=0.5*(1-smooth(10,26,Math.hypot(xx-(cx+110),y-(cy+122))));
      col=mix(col,[255,255,255],Math.min(1,h1*0.92+h2));
    }
    const i=(y*W+xx)*4,g=(Math.random()-0.5)*5;
    d[i]=col[0]+g;d[i+1]=col[1]+g;d[i+2]=col[2]+g;d[i+3]=255;
  }
  x.putImageData(im,0,0);return c;
}

/* Detection: circular edge search (Daugman style) on a small greyscale copy */
function boxBlur(g,w,h,r){const t=new Float32Array(w*h),o=new Float32Array(w*h),n=2*r+1;
  for(let y=0;y<h;y++){let s=0;for(let k=-r;k<=r;k++)s+=g[y*w+clamp(k,0,w-1)];
    for(let x=0;x<w;x++){t[y*w+x]=s/n;s+=g[y*w+clamp(x+r+1,0,w-1)]-g[y*w+clamp(x-r,0,w-1)]}}
  for(let x=0;x<w;x++){let s=0;for(let k=-r;k<=r;k++)s+=t[clamp(k,0,h-1)*w+x];
    for(let y=0;y<h;y++){o[y*w+x]=s/n;s+=t[clamp(y+r+1,0,h-1)*w+x]-t[clamp(y-r,0,h-1)*w+x]}}
  return o}
function detectIris(src){
  const sc=Math.min(1,420/Math.max(src.width,src.height)),w=Math.round(src.width*sc),h=Math.round(src.height*sc);
  const c=mk(w,h),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(src,0,0,w,h);
  const px=x.getImageData(0,0,w,h).data;let g=new Float32Array(w*h);
  for(let i=0;i<w*h;i++)g[i]=0.299*px[i*4]+0.587*px[i*4+1]+0.114*px[i*4+2];
  g=boxBlur(boxBlur(g,w,h,1),w,h,1);
  const ang=(list)=>{const cs=[],sn=[];for(const a of list){cs.push(Math.cos(a));sn.push(Math.sin(a))}return{cs,sn}};
  const side=[],full=[];
  for(let i=0;i<20;i++){const a=(-40+80*i/19)*Math.PI/180;side.push(a,a+Math.PI)}
  for(let i=0;i<56;i++)full.push(i/56*TAU);
  const S=ang(side),F=ang(full);
  const ring=(cx,cy,r,A)=>{let s=0,n=0;for(let i=0;i<A.cs.length;i++){const xx=Math.round(cx+r*A.cs[i]),yy=Math.round(cy+r*A.sn[i]);if(xx<0||yy<0||xx>=w||yy>=h)continue;s+=g[yy*w+xx];n++}return n<A.cs.length*0.6?NaN:s/n};
  const m=Math.min(w,h),rMin=Math.max(8,Math.round(m*0.07)),rMax=Math.round(m*0.48);
  const best={s:-1e9,cx:w/2,cy:h/2,r:m/4};
  const scan=(x0,x1,y0,y1,st,r0,r1,A,gap)=>{
    const prof=new Float32Array(r1+gap+2);
    for(let cy=y0;cy<=y1;cy+=st)for(let cx=x0;cx<=x1;cx+=st){
      for(let r=Math.max(2,r0-gap);r<=r1+gap;r++)prof[r]=ring(cx,cy,r,A);
      for(let r=r0;r<=r1;r++){const s=prof[r+gap]-prof[r-gap];if(s>best.s){best.s=s;best.cx=cx;best.cy=cy;best.r=r}}}};
  scan(Math.round(w*.15),Math.round(w*.85),Math.round(h*.15),Math.round(h*.85),4,rMin,rMax,S,3);
  const b1={...best};best.s=-1e9;
  scan(b1.cx-5,b1.cx+5,b1.cy-5,b1.cy+5,1,Math.max(rMin,b1.r-6),Math.min(rMax,b1.r+6),S,3);
  const I={cx:best.cx,cy:best.cy,r:best.r};
  best.s=-1e9;
  const pMin=Math.max(3,Math.round(I.r*0.1)),pMax=Math.round(I.r*0.62),off=Math.round(I.r*0.3);
  scan(I.cx-off,I.cx+off,I.cy-off,I.cy+off,2,pMin,pMax,F,2);
  const P={cx:best.cx,cy:best.cy,r:best.r};
  return{cx:I.cx/sc,cy:I.cy/sc,ir:I.r/sc,pr:Math.min(P.r/sc,I.r/sc*0.75)};
}

/* Crop, colour grade, bilinear sampling */
function applyGrade(d,G){
  if(G.sat===1&&G.con===1&&G.hue===0&&G.bri===1)return;
  const a=G.hue*Math.PI/180,cs=Math.cos(a),sn=Math.sin(a);
  const m=[.213+cs*.787-sn*.213,.715-cs*.715-sn*.715,.072-cs*.072+sn*.928,
           .213-cs*.213+sn*.143,.715+cs*.285+sn*.140,.072-cs*.072-sn*.283,
           .213-cs*.213-sn*.787,.715-cs*.715+sn*.715,.072+cs*.928+sn*.072];
  for(let i=0;i<d.length;i+=4){
    let r=d[i],g=d[i+1],b=d[i+2];
    const l=.299*r+.587*g+.114*b;
    r=l+(r-l)*G.sat;g=l+(g-l)*G.sat;b=l+(b-l)*G.sat;
    const r2=m[0]*r+m[1]*g+m[2]*b,g2=m[3]*r+m[4]*g+m[5]*b,b2=m[6]*r+m[7]*g+m[8]*b;
    d[i]=((r2*G.bri)-128)*G.con+128;d[i+1]=((g2*G.bri)-128)*G.con+128;d[i+2]=((b2*G.bri)-128)*G.con+128;
  }
}
function sharpen(d,w,h,amount,r){
  if(amount<=0.001)return;
  const g=new Float32Array(w*h);
  for(let ch=0;ch<3;ch++){
    for(let i=0;i<w*h;i++)g[i]=d[i*4+ch];
    const bl=boxBlur(boxBlur(g,w,h,r),w,h,r);
    for(let i=0;i<w*h;i++)d[i*4+ch]=g[i]+(g[i]-bl[i])*amount;
  }
}
function makeCrop(src,circ,grade){
  const R=Math.ceil(circ.ir)+2,ox=Math.round(circ.cx)-R,oy=Math.round(circ.cy)-R,s=R*2;
  const c=mk(s,s),x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(src,-ox,-oy);
  const id=x.getImageData(0,0,s,s);applyGrade(id.data,grade);
  sharpen(id.data,s,s,grade.sharp,Math.max(1,Math.round(circ.ir/160)));
  sharpen(id.data,s,s,grade.clar,Math.max(2,Math.round(circ.ir/22)));
  return{data:id.data,w:s,h:s,ox,oy};
}
function bil(img,u,v,o){
  u-=0.5;v-=0.5;
  const x0=Math.floor(u),y0=Math.floor(v),fx=u-x0,fy=v-y0,w=img.w,h=img.h,d=img.data;
  let r=0,g=0,b=0,a=0;
  for(let j=0;j<2;j++){const yy=y0+j,wy=j?fy:1-fy;
    for(let i=0;i<2;i++){const xx=x0+i;if(xx<0||yy<0||xx>=w||yy>=h)continue;
      const k=(yy*w+xx)*4,al=d[k+3]*(i?fx:1-fx)*wy;
      r+=d[k]*al;g+=d[k+1]*al;b+=d[k+2]*al;a+=al}}
  if(a>0){o[0]=r/a;o[1]=g/a;o[2]=b/a}else{o[0]=o[1]=o[2]=0}
  o[3]=a;
}

/* Polar unwrap: columns are angle, rows run from pupil edge (0) to iris edge (R-1) */
function makePolar(crop,circ,trim){
  const{ir,pr,cx,cy}=circ;
  const A=clamp(Math.round(TAU*ir*0.9),720,3600),R=clamp(Math.round(ir-pr),96,900);
  const data=new Uint8ClampedArray(A*R*4),valid=new Uint8Array(A*R),o=new Float32Array(4);
  const yTop=cy-ir+2*ir*trim.top,yBot=cy+ir-2*ir*trim.bot,lo=pr+0.01*ir,hi=ir*0.965;
  for(let a=0;a<A;a++){
    const th=a/A*TAU,c=Math.cos(th),s=Math.sin(th);
    for(let r=0;r<R;r++){
      const rho=lo+(r+0.5)/R*(hi-lo),px=cx+rho*c,py=cy+rho*s;
      if(py<yTop||py>yBot)continue;
      bil(crop,px-crop.ox,py-crop.oy,o);
      if(o[3]<200)continue;
      const k=r*A+a;data[k*4]=o[0];data[k*4+1]=o[1];data[k*4+2]=o[2];valid[k]=1;
    }
  }
  const rowMean=new Float32Array(R*3);
  for(let r=0;r<R;r++){
    const base=r*A;let first=-1,sr=0,sg=0,sb=0,n=0;
    for(let a=0;a<A;a++)if(valid[base+a]){if(first<0)first=a;const k=(base+a)*4;sr+=data[k];sg+=data[k+1];sb+=data[k+2];n++}
    if(first<0){
      for(let a=0;a<A;a++){const k=(base+a)*4,p=r>0?(base-A+a)*4:-1;
        data[k]=p>=0?data[p]:40;data[k+1]=p>=0?data[p+1]:40;data[k+2]=p>=0?data[p+2]:40;data[k+3]=255}
      rowMean[r*3]=data[base*4];rowMean[r*3+1]=data[base*4+1];rowMean[r*3+2]=data[base*4+2];continue;
    }
    rowMean[r*3]=sr/n;rowMean[r*3+1]=sg/n;rowMean[r*3+2]=sb/n;
    let last=first,run=0;
    for(let step=1;step<=A;step++){
      const idx=(first+step)%A;
      if(valid[base+idx]){
        for(let q=1;q<=run;q++){
          const ia=(last+q)%A;
          let s=q<=run/2?(((last-q+1)%A)+A)%A:(idx+run-q)%A;
          if(!valid[base+s])s=q<=run/2?last:idx;
          for(let ch=0;ch<3;ch++)data[(base+ia)*4+ch]=data[(base+s)*4+ch];
        }
        run=0;last=idx;
      }else run++;
    }
    for(let a=0;a<A;a++)data[(base+a)*4+3]=255;
  }
  return{A,R,data,valid,rowMean};
}
function polarAt(P,t,u,o){
  const y=clamp(t*P.R-0.5,0,P.R-1),y0=Math.floor(y),fy=y-y0,y1=Math.min(y0+1,P.R-1);
  const x=u*P.A-0.5;let x0=Math.floor(x);const fx=x-x0;
  x0=((x0%P.A)+P.A)%P.A;const x1=(x0+1)%P.A,d=P.data,A=P.A;
  const i00=(y0*A+x0)*4,i10=(y0*A+x1)*4,i01=(y1*A+x0)*4,i11=(y1*A+x1)*4;
  for(let ch=0;ch<3;ch++)o[ch]=(d[i00+ch]*(1-fx)+d[i10+ch]*fx)*(1-fy)+(d[i01+ch]*(1-fx)+d[i11+ch]*fx)*fy;
}
function rowAt(P,t,o){
  const y=clamp(t*P.R-0.5,0,P.R-1),y0=Math.floor(y),fy=y-y0,y1=Math.min(y0+1,P.R-1),m=P.rowMean;
  for(let ch=0;ch<3;ch++)o[ch]=m[y0*3+ch]*(1-fy)+m[y1*3+ch]*fy;
}
function meanColour(P){
  let r=0,g=0,b=0;for(let i=0;i<P.R;i++){r+=P.rowMean[i*3];g+=P.rowMean[i*3+1];b+=P.rowMean[i*3+2]}
  return[r/P.R,g/P.R,b/P.R];
}

/* Colour at a source point; under the eyelid trim lines it can rebuild the hidden iris from the unwrapped texture so the disc stays round */
function colourAt(A,rebuild,px,py,o){
  const{cx,cy,ir,pr}=A.circ,yTop=cy-ir+2*ir*A.trim.top,yBot=cy+ir-2*ir*A.trim.bot;
  const dx=px-cx,dy=py-cy,rho=Math.hypot(dx,dy);
  if((py>=yTop&&py<=yBot)||rho<pr){bil(A.crop,px-A.crop.ox,py-A.crop.oy,o);return o[3]>=200}
  if(!rebuild)return false;
  const lo=pr+0.01*ir,hi=ir*0.965;let u=Math.atan2(dy,dx)/TAU;u-=Math.floor(u);
  polarAt(A.polar,clamp((rho-lo)/(hi-lo),0,1),u,o);o[3]=255;return true;
}
/* Art styles. Each returns a canvas with transparent background where nothing is drawn. */
function discSetup(S,A){const half=S/2,Rd=half*0.94;return{half,Rd,k:A.circ.ir/Rd}}
function rCutout(S,A,p){
  const c=mk(S,S),x=c.getContext('2d'),im=x.createImageData(S,S),d=im.data,o=new Float32Array(4);
  const{half,k}=discSetup(S,A),{cx,cy,ir,pr}=A.circ;
  const yTop=cy-ir+2*ir*A.trim.top,yBot=cy+ir-2*ir*A.trim.bot,fs=1+p.feather*0.08*ir,irO=ir*0.975;
  for(let y=0;y<S;y++)for(let xx=0;xx<S;xx++){
    const dx=(xx+0.5-half)*k,dy=(y+0.5-half)*k,rho=Math.hypot(dx,dy);
    if(rho>irO+fs)continue;
    let m=1-smooth(irO-fs,irO,rho);
    if(!p.keepPupil)m*=smooth(pr,pr+fs,rho);
    if(!p.rebuild){const sy=cy+dy;m*=smooth(yTop-fs*.3,yTop+fs*.3,sy)*(1-smooth(yBot-fs*.3,yBot+fs*.3,sy))}
    if(m<=0)continue;
    if(!colourAt(A,p.rebuild,cx+dx,cy+dy,o))continue;
    const i=(y*S+xx)*4;d[i]=o[0];d[i+1]=o[1];d[i+2]=o[2];d[i+3]=m*o[3];
  }
  x.putImageData(im,0,0);return c;
}
function rKaleido(S,A,p){
  const c=mk(S,S),x=c.getContext('2d'),im=x.createImageData(S,S),d=im.data,o=new Float32Array(3),P=A.polar;
  const half=S/2,Rd=p.fullFrame?half:half*0.94,wedge=TAU/p.segments,rot=p.rotate*Math.PI/180,tw=p.twist*Math.PI/180,src=p.source/360;
  const aa=2/Rd;
  for(let y=0;y<S;y++)for(let xx=0;xx<S;xx++){
    const dx=xx+0.5-half,dy=y+0.5-half,rn=Math.hypot(dx,dy)/Rd;
    let al=1;
    if(!p.fullFrame){if(rn>1+aa)continue;al=1-smooth(1-aa,1+aa,rn)}
    let f=Math.atan2(dy,dx)+rot+tw*rn;
    f=((f%wedge)+wedge)%wedge;if(f>wedge/2)f=wedge-f;
    let q=rn%2;if(q>1)q=2-q;if(p.flip)q=1-q;
    polarAt(P,p.inner+q*(p.outer-p.inner),src+f/TAU,o);
    const i=(y*S+xx)*4;d[i]=o[0];d[i+1]=o[1];d[i+2]=o[2];d[i+3]=al*255;
  }
  x.putImageData(im,0,0);return c;
}
function rRings(S,A,p){
  const c=mk(S,S),x=c.getContext('2d'),im=x.createImageData(S,S),d=im.data,P=A.polar,o=new Float32Array(3),o2=new Float32Array(3);
  const half=S/2,Rd=half*0.94,aa=2/Rd,src=p.source/360,N=p.bands,gap=p.gap,aab=N*1.5/Rd;
  for(let y=0;y<S;y++)for(let xx=0;xx<S;xx++){
    const dx=xx+0.5-half,dy=y+0.5-half,rn=Math.hypot(dx,dy)/Rd;
    if(rn>1+aa)continue;
    let al=1-smooth(1-aa,1+aa,rn);
    const b=Math.min(N-1,Math.floor(rn*N)),fr=rn*N-b;
    if(gap>0)al*=smooth(gap/2,gap/2+aab,fr)*(1-smooth(1-gap/2-aab,1-gap/2,fr));
    if(al<=0)continue;
    const t=(b+0.5)/N;
    rowAt(P,t,o);
    if(p.detail>0){let u=Math.atan2(dy,dx)/TAU+src;u-=Math.floor(u);polarAt(P,t,u,o2);
      for(let ch=0;ch<3;ch++)o[ch]=lerp(o[ch],o2[ch],p.detail)}
    const i=(y*S+xx)*4;d[i]=o[0];d[i+1]=o[1];d[i+2]=o[2];d[i+3]=al*255;
  }
  x.putImageData(im,0,0);return c;
}
function rPano(S,A,p){
  const W=S,H=Math.round(S/p.aspect),c=mk(W,H),x=c.getContext('2d'),im=x.createImageData(W,H),d=im.data,P=A.polar,o=new Float32Array(3);
  const src=p.source/360;
  for(let y=0;y<H;y++){
    let v=(y+0.5)/H;
    if(p.mirror)v=v<0.5?v*2:2-v*2;
    if(p.flip)v=1-v;
    for(let xx=0;xx<W;xx++){
      polarAt(P,v,src+(xx+0.5)/W,o);
      const i=(y*W+xx)*4;d[i]=o[0];d[i+1]=o[1];d[i+2]=o[2];d[i+3]=255;
    }
  }
  x.putImageData(im,0,0);return c;
}
function rStipple(S,A,p){
  const c=mk(S,S),x=c.getContext('2d'),rnd=mulberry(7),o=new Float32Array(4);
  const{half,k}=discSetup(S,A),{cx,cy,ir,pr}=A.circ;
  const yTop=cy-ir+2*ir*A.trim.top,yBot=cy+ir-2*ir*A.trim.bot,base=p.dotSize*S/1000,irO=ir*0.975;
  const lo=p.keepPupil?0:pr*pr;
  for(let i=0;i<p.dots;i++){
    const rho=Math.sqrt(lerp(lo,irO*irO,rnd())),th=rnd()*TAU,px=cx+rho*Math.cos(th),py=cy+rho*Math.sin(th);
    if(!colourAt(A,p.rebuild,px,py,o))continue;
    const lum=(.299*o[0]+.587*o[1]+.114*o[2])/255,r=base*(0.45+0.9*(p.bgDark?lum:1-lum));
    x.fillStyle='rgb('+(o[0]|0)+','+(o[1]|0)+','+(o[2]|0)+')';
    x.beginPath();x.arc((px-cx)/k+half,(py-cy)/k+half,r,0,TAU);x.fill();
  }
  return c;
}
function rHalftone(S,A,p){
  const c=mk(S,S),x=c.getContext('2d'),o=new Float32Array(4);
  const{half,Rd,k}=discSetup(S,A),{cx,cy,ir,pr}=A.circ;
  const yTop=cy-ir+2*ir*A.trim.top,yBot=cy+ir-2*ir*A.trim.bot,step=2*Rd/p.cells,lo=p.keepPupil?0:pr;
  const dot=(ox,oy)=>{
    const rho=Math.hypot(ox,oy)*k;if(rho>ir*0.975-1||rho<lo)return;
    if(!colourAt(A,p.rebuild,cx+ox*k,cy+oy*k,o))return;
    const lum=(.299*o[0]+.587*o[1]+.114*o[2])/255,f=p.bgDark?lum:1-lum,r=step*0.5*clamp((0.12+0.88*Math.pow(f,0.8))*p.gain,0.05,0.75);
    x.fillStyle='rgb('+(o[0]|0)+','+(o[1]|0)+','+(o[2]|0)+')';
    x.beginPath();x.arc(half+ox,half+oy,r,0,TAU);x.fill();
  };
  if(p.layout==='grid'){
    const n=Math.ceil(p.cells/2)+1;
    for(let j=-n;j<=n;j++)for(let i=-n;i<=n;i++)dot(i*step,j*step);
  }else{
    const rings=Math.floor(Rd/step);
    for(let j=0;j<=rings;j++){
      const rr=j*step;if(j===0){dot(0,0);continue}
      const n=Math.max(6,Math.round(TAU*rr/step)),off=(j%2)*0.5;
      for(let i=0;i<n;i++){const th=(i+off)/n*TAU;dot(rr*Math.cos(th),rr*Math.sin(th))}
    }
  }
  return c;
}
const RENDERERS={cutout:rCutout,kaleido:rKaleido,rings:rRings,pano:rPano,stipple:rStipple,halftone:rHalftone};
function compose(art,bg,transparent){
  const c=mk(art.width,art.height),x=c.getContext('2d');
  if(!transparent){x.fillStyle=bg;x.fillRect(0,0,c.width,c.height)}
  x.drawImage(art,0,0);return c;
}
function hexLum(h){const n=parseInt(h.slice(1),16);return(.299*(n>>16)+.587*((n>>8)&255)+.114*(n&255))/255}

export{mk,clamp,makeSampleEye,detectIris,makeCrop,makePolar,meanColour,RENDERERS,compose,hexLum};
