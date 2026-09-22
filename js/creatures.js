/* ============================================================
   Creature art — procedural pixel sprites.

   Every species is drawn into a 48x48 pixel buffer from its
   design genome, then outlined and shaded automatically so the
   whole roster shares one visual language with the tile art.
   Genomes are de-duplicated, so no two creatures look alike.
   ============================================================ */

function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function hexToRgb(h){ const n=parseInt(h.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function rgbToHex(r,g,b){
  return "#"+((1<<24)+(Math.round(clamp(r,0,255))<<16)+(Math.round(clamp(g,0,255))<<8)+Math.round(clamp(b,0,255))).toString(16).slice(1);
}
function shade(hex, amt){ const [r,g,b]=hexToRgb(hex); return rgbToHex(r+amt,g+amt,b+amt); }
function mix(a,b,t){ const A=hexToRgb(a),B=hexToRgb(b); return rgbToHex(A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t, A[2]+(B[2]-A[2])*t); }
function rgbToHsl(r,g,b){
  r/=255;g/=255;b/=255;
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b); let h=0,s=0; const l=(mx+mn)/2;
  if(mx!==mn){ const d=mx-mn; s=l>.5? d/(2-mx-mn) : d/(mx+mn);
    h = mx===r? (g-b)/d+(g<b?6:0) : mx===g? (b-r)/d+2 : (r-g)/d+4; h*=60; }
  return [h, s*100, l*100];
}
function hslToHex(h,s,l){
  h=((h%360)+360)%360; s/=100; l/=100;
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
  let r=0,g=0,b=0;
  if(h<60){r=c;g=x;} else if(h<120){r=x;g=c;} else if(h<180){g=c;b=x;}
  else if(h<240){g=x;b=c;} else if(h<300){r=x;b=c;} else {r=c;b=x;}
  return rgbToHex((r+m)*255,(g+m)*255,(b+m)*255);
}
function tweak(hex, dh, ds, dl){
  const [r,g,b]=hexToRgb(hex); const [h,s,l]=rgbToHsl(r,g,b);
  return hslToHex(h+dh, clamp(s+ds,5,95), clamp(l+dl,8,92));
}

/* ---------------- palettes ----------------
   Species sharing a primary type are fanned across a hue range,
   so no two of them land on the same colour. */
const PALETTE = {};
(function(){
  const groups = {};
  SPECIES.forEach(sp=>{ (groups[sp.types[0]] = groups[sp.types[0]] || []).push(sp); });
  Object.keys(groups).forEach(t=>{
    const list = groups[t];
    list.forEach((sp,i)=>{
      const n = list.length, f = n>1 ? i/(n-1) : .5;
      const dh = (f-0.5)*52, dl = ((i%3)-1)*7, ds = ((i%4)-1.5)*9;
      const base = tweak(TYPE_COLOR[t][0], dh, ds, dl);
      const dark = tweak(TYPE_COLOR[t][1], dh, ds*.6, dl-2);
      const second = sp.types[sp.types.length-1];
      const accent = second===t ? tweak(TYPE_COLOR[second][0], dh+150, 14, 12)
                                : tweak(TYPE_COLOR[second][0], dh*.35, 10, 6);
      PALETTE[sp.id] = {
        base, dark,
        light: tweak(base, 0, -6, 15),
        pale:  tweak(base, 0, -20, 28),
        accent, accentDark: tweak(accent, 0, 6, -18),
        line:  tweak(dark, 0, 10, -22),
        eye:   ["#191310","#22182C","#12211C","#2A1618","#141C26"][i%5]
      };
    });
  });
})();

/* ---------------- design genomes ----------------
   Only traits an archetype actually draws count towards its
   signature, so uniqueness is uniqueness you can see. */
const ARCH_USES = {
  quad:    ["body","head","ear","horn","tail","pat","eye","legs"],
  biped:   ["body","head","horn","tail","pat","eye","back","legs"],
  avian:   ["body","head","back","tail","pat","eye","crest","legs"],
  serpent: ["body","head","horn","pat","eye","crest","back"],
  blob:    ["body","pat","eye","extra","horn","ear"],
  insect:  ["body","head","back","pat","eye","legs","horn"],
  fish:    ["body","tail","pat","eye","back","crest"],
  float:   ["body","pat","eye","extra","back","horn"],
  plant:   ["body","head","pat","eye","crest","extra"],
  golem:   ["body","pat","eye","horn","back","legs"]
};
const DESIGN = {};
function buildDesigns(){
  const seenTraits = new Set(), seenShapes = new Set();
  const roll = (sp,rng)=>{
    const st = sp.stage||0, R = n=>Math.floor(rng()*n);
    return { body:R(4), head:R(4), ear:R(4), horn: st===0? R(3):R(5),
             tail:R(5), back: st===0? R(3):R(4), pat:R(5), eye:R(5),
             extra:R(4), legs:R(3), crest: st===2? R(3):R(2) };
  };
  /* Hash the finished pixels, not the traits. Two creatures can only
     share a hash if they are literally the same picture, so this is
     the check that actually guarantees 150 different-looking sprites. */
  const shapeHash = (id,d)=>{
    const b = creatureRaster(id,d).b;
    let h = 2166136261;
    for(let i=0;i<b.length;i++){ h ^= b[i]; h = Math.imul(h, 16777619); }
    return h>>>0;
  };
  SPECIES.forEach(sp=>{
    const uses = ARCH_USES[sp.arch] || ARCH_USES.golem;
    let seed = (sp.id*2654435761 + 77)>>>0, d, key, sh, tries=0;
    do{
      d = roll(sp, mulberry(seed));
      key = sp.arch+"|"+uses.map(k=>d[k]).join(",");
      sh = shapeHash(sp.id, d);
      seed = (seed + 0x9E3779B9 + tries*7919)>>>0; tries++;
    } while((seenTraits.has(key) || seenShapes.has(sh)) && tries<400);
    seenTraits.add(key); seenShapes.add(sh);
    DESIGN[sp.id] = d;
  });
}
/* called once the raster and archetypes below are in scope */

/* ---------------- the pixel buffer ----------------
   Slots: 1 body  2 body shadow  3 belly  4 accent
          5 accent shadow  6 eye white  7 pupil  8 outline  9 body light */
const CW = 48, CH = 48;

function Raster(){
  this.b = new Uint8Array(CW*CH);
}
Raster.prototype.px = function(x,y,c){
  x=Math.round(x); y=Math.round(y);
  if(x<1||y<1||x>=CW-1||y>=CH-1) return;
  this.b[y*CW+x]=c;
};
Raster.prototype.get = function(x,y){
  if(x<0||y<0||x>=CW||y>=CH) return 0;
  return this.b[y*CW+x];
};
Raster.prototype.rect = function(x,y,w,h,c){
  for(let j=0;j<h;j++) for(let i=0;i<w;i++) this.px(x+i,y+j,c);
};
Raster.prototype.ellipse = function(cx,cy,rx,ry,c){
  if(rx<=0||ry<=0) return;
  for(let y=Math.floor(cy-ry); y<=Math.ceil(cy+ry); y++)
    for(let x=Math.floor(cx-rx); x<=Math.ceil(cx+rx); x++){
      const dx=(x-cx)/rx, dy=(y-cy)/ry;
      if(dx*dx+dy*dy<=1.02) this.px(x,y,c);
    }
};
Raster.prototype.disc = function(cx,cy,r,c){ this.ellipse(cx,cy,r,r,c); };
Raster.prototype.tri = function(ax,ay,bx,by,cx2,cy2,c){
  const minx=Math.floor(Math.min(ax,bx,cx2)), maxx=Math.ceil(Math.max(ax,bx,cx2));
  const miny=Math.floor(Math.min(ay,by,cy2)), maxy=Math.ceil(Math.max(ay,by,cy2));
  const area=(bx-ax)*(cy2-ay)-(cx2-ax)*(by-ay);
  if(!area) return;
  for(let y=miny;y<=maxy;y++) for(let x=minx;x<=maxx;x++){
    const w0=((bx-ax)*(y-ay)-(x-ax)*(by-ay))/area;
    const w1=((cx2-bx)*(y-by)-(x-bx)*(cy2-by))/area;
    const w2=((ax-cx2)*(y-cy2)-(x-cx2)*(ay-cy2))/area;
    if(w0>=-0.02&&w1>=-0.02&&w2>=-0.02) this.px(x,y,c);
  }
};
Raster.prototype.line = function(x0,y0,x1,y1,c,thick){
  const n=Math.ceil(Math.max(Math.abs(x1-x0),Math.abs(y1-y0)))||1;
  for(let i=0;i<=n;i++){
    const x=x0+(x1-x0)*i/n, y=y0+(y1-y0)*i/n;
    if(thick>1) this.disc(x,y,thick/2,c); else this.px(x,y,c);
  }
};
/* quadratic curve, for tails and tentacles */
Raster.prototype.curve = function(x0,y0,cx,cy,x1,y1,c,thick){
  const n=26;
  for(let i=0;i<=n;i++){
    const t=i/n, u=1-t;
    const x=u*u*x0+2*u*t*cx+t*t*x1, y=u*u*y0+2*u*t*cy+t*t*y1;
    const w = typeof thick==="function"? thick(t) : (thick||1);
    this.disc(x,y,w/2,c);
  }
};

/* Outline every silhouette edge, then light the top and darken the base.
   Doing it as a pass is what makes the set look hand-drawn rather than
   like a pile of shapes. */
Raster.prototype.finish = function(){
  const src = this.b.slice();
  /* outline */
  for(let y=1;y<CH-1;y++) for(let x=1;x<CW-1;x++){
    if(src[y*CW+x]) continue;
    if(src[(y-1)*CW+x]||src[(y+1)*CW+x]||src[y*CW+x-1]||src[y*CW+x+1]) this.b[y*CW+x]=8;
  }
  /* rim light along the top of the body, shadow along the bottom */
  const after = this.b.slice();
  for(let y=1;y<CH-1;y++) for(let x=1;x<CW-1;x++){
    const v = after[y*CW+x];
    if(v!==1) continue;
    const above = after[(y-1)*CW+x], above2 = after[(y-2)*CW+x];
    if(above===8||above===0||above2===8||above2===0) this.b[y*CW+x]=9;
    const below = after[(y+1)*CW+x], below2 = after[(y+2)*CW+x];
    if(below===8||below===0||below2===8||below2===0) this.b[y*CW+x]=2;
  }
};

const _spriteCache = {};

/* Build the 48x48 buffer for a species. */
function creatureRaster(id, genome){
  const sp = byId(id), D = genome || DESIGN[id], st = sp.stage||0;
  const R = new Raster();
  const both = fn => { fn(-1); fn(1); };

  /* ---- shared features ---- */
  function eyes(cx,cy,gap){
    const s = D.eye;
    both(d=>{
      const x = cx + d*gap;
      if(s===0){ R.rect(x-1,cy-1,2,3,6); R.px(x-1+ (d>0?1:0), cy, 7); R.px(x-1+(d>0?1:0), cy+1, 7); }
      else if(s===1){ R.rect(x-1,cy-1,3,3,6); R.rect(x,cy,1,2,7); }
      else if(s===2){ R.rect(x-1,cy,2,2,7); }
      else if(s===3){ R.rect(x-1,cy-1,3,2,6); R.rect(x,cy-1,1,2,7); R.px(x-1,cy-2,8); }
      else { R.rect(x-1,cy-1,3,3,4); R.rect(x,cy,1,2,7); }
    });
  }
  function ears(cx,cy,spread){
    const e = D.ear; if(!e) return;
    both(d=>{
      const x = cx + d*spread;
      if(e===1) R.tri(x, cy+2, x+d*1, cy-6, x+d*4, cy+1, 4);
      else if(e===2) R.ellipse(x+d*1, cy-1, 3, 3, 4);
      else R.ellipse(x+d*2, cy+3, 2, 5, 4);
    });
  }
  function horns(cx,cy){
    const h = D.horn; if(!h) return;
    const L = 5 + st*2;
    if(h===1) R.tri(cx-2, cy+1, cx, cy-L-1, cx+2, cy+1, 4);
    else if(h===2) both(d=>R.tri(cx+d*2, cy+1, cx+d*4, cy-L, cx+d*6, cy+1, 4));
    else if(h===3) both(d=>R.curve(cx+d*4, cy+1, cx+d*8, cy-2, cx+d*5, cy-L-1, 4, 2));
    else both(d=>{ R.tri(cx+d*2, cy+1, cx+d*3, cy-L, cx+d*5, cy+1, 4);
                   R.tri(cx+d*6, cy+2, cx+d*7, cy-L+2, cx+d*9, cy+2, 4); });
  }
  function crest(cx,cy,w){
    if(!D.crest) return;
    if(D.crest===1) for(let i=0;i<3;i++){ const x=cx-w/2+w*(i+.5)/3; R.tri(x-2,cy+2,x,cy-5-(i%2)*2,x+2,cy+2,5); }
    else R.ellipse(cx,cy-2,w*.4,4,4);
  }
  function markings(cx,cy,rx,ry){
    const p = D.pat;
    if(p===0) for(let i=0;i<3;i++) R.disc(cx-rx*.4+i*rx*.4, cy-ry*.2+(i%2)*ry*.5, 2, 2);
    else if(p===1) for(let i=0;i<3;i++) R.rect(cx-rx*.7, cy-ry*.4+i*Math.max(3,ry*.4), rx*1.4, 1, 2);
    else if(p===2) R.ellipse(cx, cy+ry*.35, rx*.55, ry*.5, 3);
    else if(p===3) both(d=>R.line(cx+d*rx*.5, cy-ry*.4, cx+d*rx*.2, cy+ry*.4, 4, 2));
    /* p===4: clean hide */
  }
  function tailOf(x,y,dir){
    const t = D.tail, d = dir||1;
    if(!t) return;
    if(t===1) R.curve(x,y, x+d*8,y-2, x+d*7,y-10, 2, t=>3-t*1.6);
    else if(t===2) R.curve(x,y, x+d*9,y+3, x+d*6,y+10, 2, t=>3.4-t*1.8);
    else if(t===3){ R.curve(x,y, x+d*7,y+1, x+d*8,y+6, 2, 2); R.disc(x+d*9,y+7,3,4); }
    else { R.curve(x,y, x+d*8,y-4, x+d*10,y-9, 2, 2); R.tri(x+d*10,y-12,x+d*13,y-8,x+d*8,y-6,4); }
  }
  function wings(cx,cy,sc){
    const w = D.back; if(!w) return;
    sc = sc||1;
    if(w===1) both(d=>R.tri(cx+d*5, cy-3, cx+d*(15*sc), cy-6, cx+d*(13*sc), cy+7, 4));
    else if(w===2) both(d=>{ R.ellipse(cx+d*(11*sc), cy, 6*sc, 4*sc, 4); R.ellipse(cx+d*(9*sc), cy+4, 4*sc, 3*sc, 5); });
    else both(d=>{ R.tri(cx+d*4, cy-4, cx+d*(14*sc), cy-9, cx+d*(11*sc), cy+2, 5);
                   R.tri(cx+d*4, cy, cx+d*(12*sc), cy+1, cx+d*(9*sc), cy+8, 5); });
  }
  function legsPair(y,w,h){
    const l = D.legs;
    both(d=>{
      const x = 24 + d*w;
      if(l===0) R.rect(x-2, y, 4, h, 2);
      else if(l===1){ R.rect(x-2, y, 4, h-1, 2); R.rect(x-3, y+h-2, 6, 2, 5); }
      else { R.rect(x-2, y, 4, h, 2); R.rect(x-4, y+h-2, 7, 2, 5); }
    });
  }

  /* ---- archetypes ---- */
  switch(sp.arch){

  case "quad": {
    const bw = [13,15,11,14][D.body], bh = [8,7,10,9][D.body];
    tailOf(24+bw-1, 26, 1);
    legsPair(26+bh-2, 8, 10);
    R.ellipse(24, 26, bw, bh, 1);
    markings(25, 26, bw, bh);
    const hx = 24-bw+2, hy = 17;
    if(D.head===0) R.disc(hx, hy, 8, 1);
    else if(D.head===1){ R.ellipse(hx, hy, 8, 7, 1); R.ellipse(hx-6, hy+3, 4, 3, 1); }
    else if(D.head===2) R.ellipse(hx, hy, 7, 8, 1);
    else { R.ellipse(hx, hy, 8, 6, 1); R.tri(hx-9, hy, hx-4, hy-2, hx-4, hy+3, 4); }
    ears(hx, hy-6, 5);
    horns(hx, hy-7);
    eyes(hx, hy, 3);
    break; }

  case "biped": {
    legsPair(34, 5, 11);
    const bw = [9,11,8,10][D.body], bh = [11,9,12,10][D.body];
    wings(24, 24, .8);
    tailOf(24+bw-1, 33, 1);
    R.ellipse(24, 26, bw, bh, 1);
    markings(24, 26, bw, bh);
    both(d=>{ R.curve(24+d*bw, 21, 24+d*(bw+5), 26, 24+d*(bw+3), 33, 1, 3.4);
              R.disc(24+d*(bw+3), 34, 2.6, 5); });
    if(D.head===0) R.disc(24, 12, 8, 1);
    else if(D.head===1) R.ellipse(24, 12, 9, 6, 1);
    else if(D.head===2) R.ellipse(24, 12, 7, 8, 1);
    else { R.rect(17, 7, 14, 11, 1); R.rect(19, 5, 10, 3, 1); }
    ears(24, 7, 6);
    horns(24, 5);
    eyes(24, 12, 3);
    break; }

  case "avian": {
    const bw = [8,10,7,9][D.body];
    tailOf(28, 32, 1);
    legsPair(36, 3, 7);
    R.ellipse(24, 26, bw, bw+2, 1);
    markings(24, 26, bw, bw+2);
    wings(24, 24, 1);
    R.disc(24, 13, 7, 1);
    R.tri(30, 12, 37, 14, 30, 17, 4);
    crest(24, 6, 10);
    eyes(23, 12, 3);
    break; }

  case "serpent": {
    const coils = [
      [[16,14],[42,20],[4,34],[34,42]],
      [[15,12],[6,32],[44,32],[28,43]],
      [[17,13],[46,34],[2,28],[34,43]],
      [[15,15],[40,12],[8,42],[36,41]]
    ][D.body];
    const [A,B,C2,D2] = coils, N=34;
    const bez=(t,a,b,c,d)=>{const u=1-t;return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d;};
    for(let i=N;i>=0;i--){
      const t=i/N;
      const x=bez(t,A[0],B[0],C2[0],D2[0]), y=bez(t,A[1],B[1],C2[1],D2[1]);
      const r = (1.6 + 4.2*Math.pow(1-t,.7)) * (1+st*.08);
      R.disc(x,y,r, i%3===0? 2 : 1);
    }
    if(D.back>1) for(let i=3;i<N-4;i+=5){
      const t=i/N, x=bez(t,A[0],B[0],C2[0],D2[0]), y=bez(t,A[1],B[1],C2[1],D2[1]);
      R.tri(x-2,y-2,x,y-6,x+2,y-2,5);
    } else if(D.back===1) for(let i=5;i<N-3;i+=4){
      const t=i/N, x=bez(t,A[0],B[0],C2[0],D2[0]), y=bez(t,A[1],B[1],C2[1],D2[1]);
      R.disc(x,y,1.6,5);
    }
    /* belly banding */
    if(D.pat<3) for(let i=2;i<N-2;i+=(D.pat+2)){
      const t=i/N, x=bez(t,A[0],B[0],C2[0],D2[0]), y=bez(t,A[1],B[1],C2[1],D2[1]);
      R.disc(x, y+1, D.pat===0? 1.4 : 2, D.pat===2? 4 : 3);
    }
    const hx=A[0], hy=A[1];
    if(D.head===0) R.ellipse(hx,hy,7,6,1);
    else if(D.head===1){ R.ellipse(hx,hy,8,5,1); R.tri(hx-9,hy-1,hx-4,hy-3,hx-4,hy+2,1); }
    else if(D.head===2) R.ellipse(hx,hy,6,7,1);
    else R.ellipse(hx,hy,7,5,1);
    crest(hx,hy-6,10);
    horns(hx,hy-6);
    eyes(hx,hy,3);
    break; }

  case "blob": {
    const bw = [13,15,12,14][D.body], bh = [12,10,14,11][D.body];
    if(D.body===2){ R.ellipse(24, 30, bw, bh, 1); R.ellipse(24, 20, bw-4, bh-5, 1); }
    else R.ellipse(24, 30, bw, bh, 1);
    R.rect(24-bw, 36, bw*2, 6, 1);
    markings(24, 30, bw-2, bh-2);
    ears(24, 20, 8);
    horns(24, 19);
    if(D.extra===1) R.ellipse(24, 38, bw*.55, 3, 3);
    eyes(24, 29, 4);
    break; }

  case "insect": {
    const seg = [8,7,9,8][D.body];
    R.ellipse(30, 30, seg+2, seg, 1);
    R.ellipse(21, 24, seg-1, seg-2, 1);
    markings(30, 30, seg+1, seg-1);
    both(d=>{ for(let i=0;i<3;i++) R.line(26+i*4, 32, 26+i*4+d*7, 40, 2, 2); });
    wings(26, 20, .9);
    R.disc(14, 19, 6, 1);
    both(d=>R.line(14+d*2, 14, 14+d*6, 6, 2, 1.6));
    both(d=>R.disc(14+d*6, 5, 2, 4));
    horns(14, 14);
    eyes(13, 19, 3);
    break; }

  case "fish": {
    const bw = [15,17,13,16][D.body], bh = [9,8,11,10][D.body];
    R.ellipse(26, 26, bw, bh, 1);
    if(D.body===1) R.ellipse(20, 26, bw-4, bh+1, 1);
    markings(27, 26, bw-3, bh-2);
    const t = D.tail;
    if(t<2){ R.tri(26-bw+1, 26, 8, 16, 10, 26, 5); R.tri(26-bw+1, 26, 8, 36, 10, 26, 5); }
    else if(t<4) R.tri(26-bw+2, 20, 26-bw+2, 33, 8, 26, 5);
    else { R.ellipse(26-bw-2, 26, 5, 8, 5); }
    if(D.back>0) R.tri(24, 26-bh, 30, 26-bh-7, 34, 26-bh+1, 4);
    if(D.crest) R.tri(24, 26+bh-1, 30, 26+bh+6, 33, 26+bh-1, 5);
    R.ellipse(32, 30, 4, 3, 5);
    eyes(34, 23, 0);
    break; }

  case "float": {
    const bw = [10,12,9,11][D.body];
    if(D.body===2){ R.tri(24,12,24+bw,26,24-bw,26,1); R.tri(24,40,24+bw,26,24-bw,26,1); }
    else R.ellipse(24, 24, bw, bw-1, 1);
    markings(24, 24, bw-2, bw-3);
    both(d=>R.curve(24+d*5, 24+bw-3, 24+d*7, 34, 24+d*4, 42, 1, 2.4));
    R.curve(24, 24+bw-3, 24, 36, 24, 43, 1, 2.6);
    const h = D.back;
    if(h===1){ for(let i=0;i<8;i++){ const a=i/8*Math.PI*2; R.disc(24+Math.cos(a)*(bw+5), 24+Math.sin(a)*(bw+2), 1.6, 4); } }
    else if(h===2) both(d=>R.ellipse(24+d*(bw+4), 22, 4, 7, 4));
    else if(h===3) R.rect(24-bw-3, 22, (bw+3)*2, 2, 4);
    horns(24, 24-bw+1);
    if(D.extra===1) R.disc(24, 24-bw-3, 2.4, 4);
    eyes(24, 23, 3);
    break; }

  case "plant": {
    R.rect(21, 34, 6, 9, 2);
    both(d=>R.curve(24, 40, 24+d*5, 41, 24+d*7, 43, 2, 2.4));
    const bw = [10,12,9,11][D.body];
    R.ellipse(24, 26, bw, bw, 1);
    markings(24, 26, bw-2, bw-2);
    const l = D.head;
    if(l===0) both(d=>R.ellipse(24+d*(bw+3), 18, 6, 3, 4));
    else if(l===1) for(let i=0;i<6;i++){ const a=i/6*Math.PI*2; R.ellipse(24+Math.cos(a)*(bw+2), 17+Math.sin(a)*6, 3, 2, 4); }
    else if(l===2){ R.tri(24, 8, 19, 18, 29, 18, 4); R.disc(24, 10, 2.5, 5); }
    else both(d=>R.curve(24, 18, 24+d*8, 10, 24+d*4, 4, 4, 3));
    both(d=>R.ellipse(24+d*(bw+2), 30, 5, 3, 5));
    crest(24, 16, 10);
    eyes(24, 26, 3);
    break; }

  case "golem": default: {
    const n = [6,7,5,8][D.body], pts=[];
    const rng2 = mulberry(id*97+13);
    for(let i=0;i<n;i++){
      const a = -Math.PI/2 + i/n*Math.PI*2;
      const rad = 12 + rng2()*4;
      pts.push([24+Math.cos(a)*rad, 27+Math.sin(a)*rad*.95]);
    }
    for(let i=1;i<n-1;i++) R.tri(pts[0][0],pts[0][1], pts[i][0],pts[i][1], pts[i+1][0],pts[i+1][1], 1);
    for(let i=0;i<n;i+=2){
      const a=pts[i], b=pts[(i+1)%n];
      R.tri(a[0],a[1],b[0],b[1],24,27, i%4? 9 : 2);
    }
    markings(24, 28, 8, 7);
    both(d=>R.ellipse(24+d*17, 30, 4, 4, 2));
    if(D.legs>0) legsPair(38, 6, 6);
    const cn = 2+st;
    for(let i=0;i<cn;i++){ const x = 24-(cn-1)*4+i*8; R.tri(x-2, 16, x, 16-5-(i%2)*3-st, x+2, 16, 4); }
    horns(24, 14);
    if(D.back>1) both(d=>R.tri(24+d*10, 20, 24+d*17, 12, 24+d*13, 22, 5));
    eyes(24, 27, 3);
    break; }
  }

  R.finish();
  /* contact shadow, drawn under everything */
  let lowest = 0;
  for(let y=CH-2;y>0;y--){ let any=false; for(let x=1;x<CW-1;x++) if(R.b[y*CW+x]){any=true;break;} if(any){lowest=y;break;} }
  for(let x=14;x<34;x++){
    const d=Math.abs(x-24);
    if(d>9) continue;
    const yy = lowest+1;
    if(!R.get(x,yy)) R.px(x,yy,10);
    if(d<6 && !R.get(x,yy+1)) R.px(x,yy+1,10);
  }
  return R;
}

/* Paint the buffer into a canvas and hand back an <img> tag. */
function spriteSVG(id, size){
  const key = id+"@"+(size||0);
  if(_spriteCache[key]) return _spriteCache[key];
  const PAL = PALETTE[id];
  const cols = [null, PAL.base, PAL.dark, PAL.pale, PAL.accent, PAL.accentDark,
                "#F7F3E7", PAL.eye, PAL.line, PAL.light, "rgba(0,0,0,.28)"];
  const R = creatureRaster(id);
  const cv = document.createElement("canvas");
  cv.width = CW; cv.height = CH;
  const c = cv.getContext("2d");
  for(let y=0;y<CH;y++) for(let x=0;x<CW;x++){
    const v = R.b[y*CW+x];
    if(!v) continue;
    c.fillStyle = cols[v];
    c.fillRect(x,y,1,1);
  }
  const dim = size? ` width="${size}" height="${size}"` : "";
  const out = `<img class="cre" src="${cv.toDataURL()}"${dim} alt="">`;
  _spriteCache[key] = out;
  return out;
}

buildDesigns();

function typeTag(t){ return `<span class="tag" style="background:${TYPE_COLOR[t][0]}">${t}</span>`; }
function typeTags(types){ return types.map(typeTag).join(" "); }
