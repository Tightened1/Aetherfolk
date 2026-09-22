/* ============================================================
   Overworld: procedural region maps, rendering, movement
   ============================================================ */

const T = {GRASS:0,TALL:1,PATH:2,WATER:3,TREE:4,ROCK:5,WALL:6,HEAL:7,SHOP:8,GYM:9,FLOWER:10,SIGN:11,GATE:12,FLOOR:13,GATEBACK:14};
const WALK = {0:1,1:1,2:1,10:1,13:1,12:1,14:1};
const TILE = 32;
const MW = 52, MH = 40;
const mapCache = {};


/* ---------------- region art ----------------
   Art is scarloxy's MyPixelWorld Special Pack #01 (CC BY 4.0), used at its
   native 16px. The world tileset is laid out as 3x3 autotile blocks: the
   centre tile is the material, the surrounding eight are its edges against
   the material underneath. Every region is grass with autotiled sand paths;
   character comes from the patch material, the tree and rock set, and the
   arena. That way every fringe tile is the one the artist drew for it. */

const SRC = 16;              // native tile size
const SCALE = TILE / SRC;    // world tiles are 32px, so everything draws at 2x

const TILE_AT = { grass:[1,4], sand:[1,1], snow:[1,13] };
const BLOCK = { sand:[0,0], snow:[0,12] };   // 3x3 autotile origins in world.png
const WATER_BLOCK = [0,0];                   // in coast.png; frame f sits at row +f*3

const REGION_ART = [
  { patch:"sand", trees:["green_tree","green_tree_bushy","green_tree_small"],
    rocks:["grassrock1","grassrock2"], tuft:"grass", arena:"arena_plant",
    bg:"forest", mote:"leaf",  moteCol:"#DFF3B8", ruins:false, patchAt:0.70 },
  { patch:"sand", trees:["green_tree_small","palm_small"],
    rocks:["sandrock1","sandrock2"], tuft:"grass", arena:"arean_fire",
    bg:"sand",   mote:"ember", moteCol:"#FFB067", ruins:true, patchAt:0.40 },
  { patch:"sand", trees:["palm","palm_alt","palm_small"],
    rocks:["sandrock1","sandrock2"], tuft:"grass", arena:"arena_water",
    bg:"sand",   mote:"spray", moteCol:"#D6F2F7", ruins:false, patchAt:0.46 },
  { patch:"sand", trees:["teal_tree","teal_tree_bushy","teal_tree_small"],
    rocks:["grassrock1","grassrock2"], tuft:"grass", arena:"arena_plant",
    bg:"forest", mote:"spark", moteCol:"#FFF0A0", ruins:false, patchAt:0.68 },
  { patch:"sand", trees:["green_tree_small","teal_tree_small"],
    rocks:["sandrock1","sandrock2"], tuft:"grass", arena:"arena_plant",
    bg:"sand",   mote:"dust",  moteCol:"#E8DCC0", ruins:true, patchAt:0.38 },
  { patch:"sand", trees:["teal_tree_bushy","teal_tree","teal_tree_small"],
    rocks:["grassrock1","grassrock2"], tuft:"grass", arena:"arena_water",
    bg:"forest", mote:"wisp",  moteCol:"#C8B4F0", ruins:true, patchAt:0.66 },
  { patch:"snow", trees:["ice_tree","teal_tree_small","ice_tree"],
    rocks:["icerock1","icerock2"], tuft:"grass_ice", arena:"arena_water",
    bg:"ice",    mote:"snow",  moteCol:"#FFFFFF", ruins:false, patchAt:0.20 },
  { patch:"sand", trees:["teal_tree","green_tree_small"],
    rocks:["sandrock1","sandrock2"], tuft:"grass", arena:"arean_fire",
    bg:"sand",   mote:"ember", moteCol:"#F0BCA0", ruins:true, patchAt:0.42 }
];
function regionTint(i){ return ["#6E8C3A","#5E7A32"]; }

/* ---------------- art loading ---------------- */
const ART_SRC = {
  world:"assets/tiles/world.png", coast:"assets/tiles/coast.png",
  shadow:"assets/objects/shadow.png",
  bg_forest:"assets/bg/forest.png", bg_ice:"assets/bg/ice.png", bg_sand:"assets/bg/sand.png"
};
["green_tree","green_tree_bushy","green_tree_small","teal_tree","teal_tree_bushy",
 "teal_tree_small","ice_tree","palm","palm_alt","palm_small","grass","grass_ice",
 "grassrock1","grassrock2","sandrock1","sandrock2","icerock1","icerock2",
 "house_small","house_small_alt","house_large","house_large_alt","hospital",
 "arena_plant","arena_water","arean_fire","ruin_pillar","ruin_pillar_broke",
 "ruin_gate","gate_pillar","gate_top"].forEach(n=> ART_SRC[n] = "assets/objects/"+n+".png");
const CHARS = ["player"];
for(let i=0;i<10;i++) CHARS.push("town"+i);
for(let i=0;i<12;i++) CHARS.push("forest"+i);
CHARS.forEach(n=> ART_SRC["ch_"+n] = "assets/people/"+n+".png");
ART_SRC.interior = "assets/interior/interior.png";

const IMG = {};
function loadArt(onProgress){
  const keys = Object.keys(ART_SRC);
  let done = 0;
  return Promise.all(keys.map(k=> new Promise((res,rej)=>{
    const im = new Image();
    im.onload = ()=>{ IMG[k]=im; done++; onProgress && onProgress(done, keys.length); res(); };
    im.onerror = ()=> rej(new Error("could not load "+ART_SRC[k]));
    im.src = ART_SRC[k];
  })));
}

/* ---------------- rendering ---------------- */
const bufCache = {};
function hash2(x,y,s){ let h=x*374761393+y*668265263+s*69069; h=(h^(h>>13))*1274126177; return ((h^(h>>16))>>>0)/4294967296; }

/* pick the right cell of a 3x3 autotile block for a tile whose neighbours
   are described by `inside` */
function autoCell(inside, x, y){
  const col = !inside(x-1,y) ? 0 : (!inside(x+1,y) ? 2 : 1);
  const row = !inside(x,y-1) ? 0 : (!inside(x,y+1) ? 2 : 1);
  return [col,row];
}

function renderRegionBuffer(ri){
  if(bufCache[ri]) return bufCache[ri];
  const m = genRegion(ri);
  const A = REGION_ART[ri];
  const cv = document.createElement("canvas");
  cv.width = MW*TILE; cv.height = MH*TILE;
  const c = cv.getContext("2d");
  c.imageSmoothingEnabled = false;
  const tl = (x,y)=> (x<0||y<0||x>=MW||y>=MH) ? T.TREE : m.tiles[y*MW+x];

  const blit = (img, sx, sy, sw, sh, dx, dy)=>
    c.drawImage(img, sx, sy, sw, sh, Math.round(dx*SCALE), Math.round(dy*SCALE), sw*SCALE, sh*SCALE);
  const cell = (tx,ty,x,y)=> blit(IMG.world, tx*SRC, ty*SRC, SRC, SRC, x*SRC, y*SRC);

  /* ---- pass 1: grass everywhere ---- */
  const g = TILE_AT.grass;
  for(let y=0;y<MH;y++) for(let x=0;x<MW;x++) cell(g[0],g[1],x,y);

  /* ---- pass 2: the region's patch material, in soft blobs ---- */
  const patchSeed = ri*131+7;
  const isPatch = (x,y)=>{
    if(x<0||y<0||x>=MW||y>=MH) return false;
    const v = tl(x,y);
    if(v===T.WATER||v===T.PATH||v===T.FLOOR||v===T.GATE||v===T.GATEBACK) return false;
    const n = hash2(Math.floor(x/6),Math.floor(y/5),patchSeed)*0.7
            + hash2(Math.floor(x/3),Math.floor(y/3),patchSeed+9)*0.3;
    return n > A.patchAt;
  };
  const pb = BLOCK[A.patch];
  for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){
    if(!isPatch(x,y)) continue;
    const [cx2,cy2] = autoCell(isPatch,x,y);
    cell(pb[0]+cx2, pb[1]+cy2, x, y);
  }

  /* ---- pass 3: paths and town floor, autotiled sand ---- */
  const isPath = (x,y)=>{
    const v = tl(x,y);
    return v===T.PATH||v===T.FLOOR||v===T.GATE||v===T.GATEBACK||
           v===T.WALL||v===T.HEAL||v===T.SHOP||v===T.GYM||v===T.SIGN;
  };
  const sb = BLOCK.sand;
  for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){
    if(!isPath(x,y)) continue;
    const [cx2,cy2] = autoCell(isPath,x,y);
    cell(sb[0]+cx2, sb[1]+cy2, x, y);
  }

  /* ---- pass 4: water, frame 0. The animated overlay redraws the rest. ---- */
  const isWater = (x,y)=> (x<0||y<0||x>=MW||y>=MH) ? false : tl(x,y)===T.WATER;
  for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){
    if(!isWater(x,y)) continue;
    const [cx2,cy2] = autoCell(isWater,x,y);
    blit(IMG.coast, (WATER_BLOCK[0]+cx2)*SRC, (WATER_BLOCK[1]+cy2)*SRC, SRC, SRC, x*SRC, y*SRC);
  }

  /* ---- pass 5: things that stand up, top rows first so they overlap ---- */
  const drop = (img,x,y)=>{                       // bottom-centre on the tile
    const dx = x*SRC + SRC/2 - img.width/2;
    const dy = y*SRC + SRC - img.height;
    blit(img, 0,0, img.width, img.height, dx, dy);
  };
  const shadow = (x,y)=>{
    const s = IMG.shadow;
    blit(s,0,0,s.width,s.height, x*SRC+SRC/2-s.width/2, y*SRC+SRC-s.height-1);
  };
  for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){
    const v = tl(x,y), h = hash2(x,y,ri);
    if(v===T.TREE){
      const set = A.ruins && h>0.82 ? ["ruin_pillar","ruin_pillar_broke"] : A.trees;
      const name = set[Math.floor(h*set.length)%set.length];
      shadow(x,y); drop(IMG[name], x, y);
    }
    else if(v===T.ROCK){
      const name = A.rocks[Math.floor(h*A.rocks.length)%A.rocks.length];
      shadow(x,y); drop(IMG[name], x, y);
    }
    else if(v===T.TALL || v===T.FLOWER){
      drop(IMG[A.tuft], x, y);
    }
    else if(v===T.GATE||v===T.GATEBACK){
      if(tl(x,y-1)!==T.GATE && tl(x,y-1)!==T.GATEBACK){
        drop(IMG.gate_pillar, x-1, y+1); drop(IMG.gate_pillar, x+1, y+1);
        const gt = IMG.gate_top;
        blit(gt,0,0,gt.width,gt.height, x*SRC+SRC/2-gt.width/2, (y-1)*SRC);
      }
    }
  }

  /* ---- pass 6: buildings ---- */
  m.buildings.forEach(b=>{
    const img = IMG[b.art];
    if(!img) return;
    blit(img, 0,0, img.width, img.height, b.x*SRC, b.y*SRC);
  });

  bufCache[ri]=cv;
  return cv;
}

/* ---------------- animated overlay ---------------- */
/* Water cycles four frames. Tiles that sit under something tall are left on
   frame 0 in the buffer, otherwise the overlay would repaint over a canopy. */
const waterCells = {};
function animWater(ri){
  if(waterCells[ri]) return waterCells[ri];
  const m = genRegion(ri);
  const tl = (x,y)=> (x<0||y<0||x>=MW||y>=MH) ? T.TREE : m.tiles[y*MW+x];
  const isWater = (x,y)=> (x<0||y<0||x>=MW||y>=MH) ? false : tl(x,y)===T.WATER;
  const out = [];
  for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){
    if(!isWater(x,y)) continue;
    let blocked = false;
    for(let d=1;d<=3;d++){
      const v = tl(x,y+d);
      if(v===T.TREE||v===T.ROCK||v===T.WALL||v===T.HEAL||v===T.SHOP||v===T.GYM){ blocked=true; break; }
    }
    if(blocked) continue;
    const [cx,cy] = autoCell(isWater,x,y);
    out.push([x,y,cx,cy]);
  }
  waterCells[ri]=out;
  return out;
}
function drawWaterAnim(c, camX, camY, w, h, t){
  const cells = animWater(G.region);
  const f = Math.floor(t/220)%4;
  c.imageSmoothingEnabled = false;
  for(const [x,y,cx,cy] of cells){
    const dx = x*TILE-camX, dy = y*TILE-camY;
    if(dx<-TILE||dy<-TILE||dx>w||dy>h) continue;
    c.drawImage(IMG.coast, (WATER_BLOCK[0]+cx)*SRC, (WATER_BLOCK[1]+cy+f*3)*SRC, SRC, SRC,
                Math.round(dx), Math.round(dy), TILE, TILE);
  }
}
function drawFlowerAnim(){ /* the tuft art is static in this pack */ }

const MOTES = [];
function drawMotes(c, w, h, t){
  const A = REGION_ART[G.region];
  const want = A.mote==="snow"? 46 : A.mote==="dust"? 22 : 30;
  while(MOTES.length<want) MOTES.push({x:Math.random()*w, y:Math.random()*h, s:.4+Math.random(), p:Math.random()*6.28});
  while(MOTES.length>want) MOTES.pop();
  c.save();
  for(const p of MOTES){
    const k = A.mote;
    if(k==="snow"){ p.y += p.s*.5; p.x += Math.sin(t*.001+p.p)*.35; }
    else if(k==="ember"){ p.y -= p.s*.6; p.x += Math.sin(t*.002+p.p)*.5; }
    else if(k==="spark"){ p.y += Math.sin(t*.004+p.p)*.6; p.x += p.s*.4; }
    else { p.y += p.s*.22; p.x += Math.sin(t*.0012+p.p)*.5; }
    if(p.y>h+6) p.y=-6; if(p.y<-6) p.y=h+6;
    if(p.x>w+6) p.x=-6; if(p.x<-6) p.x=w+6;
    c.globalAlpha = .18 + .30*Math.abs(Math.sin(t*.002+p.p));
    c.fillStyle = A.moteCol;
    const r = k==="snow"? 1.8 : 1.5;
    c.beginPath(); c.arc(p.x,p.y,r*p.s+.6,0,7); c.fill();
  }
  c.restore();
}

/* ---------------- people ----------------
   Screen Smith's sheets are 3 columns (walk frames) by 4 rows
   (down, left, right, up) at 18x26. Frame 1 is the standing pose. */
const CHAR_W = 18, CHAR_H = 26;
const DIRROW = {down:0, left:1, right:2, up:3};
const WALK_CYCLE = [1,0,1,2];
function drawPerson(ctx,px,py,facing,frame,pal){
  const img = IMG[pal.sheet] || IMG.ch_player;
  const s = IMG.shadow;
  ctx.imageSmoothingEnabled = false;
  if(s) ctx.drawImage(s, 0,0, s.width, s.height,
      Math.round(px+TILE/2-s.width*SCALE/2), Math.round(py+TILE-s.height*SCALE-1),
      s.width*SCALE, s.height*SCALE);
  const row = DIRROW[facing] !== undefined ? DIRROW[facing] : 0;
  const col = WALK_CYCLE[frame & 3];
  const dw = CHAR_W*SCALE, dh = CHAR_H*SCALE;
  ctx.drawImage(img, col*CHAR_W, row*CHAR_H, CHAR_W, CHAR_H,
    Math.round(px + TILE/2 - dw/2), Math.round(py + TILE - dh + 3), dw, dh);
}

const PLAYER_PAL = {sheet:"ch_player"};
const NPC_PALS = [
  {sheet:"ch_town0"}, {sheet:"ch_town1"}, {sheet:"ch_town2"}, {sheet:"ch_town3"},
  {sheet:"ch_town4"}, {sheet:"ch_town5"}, {sheet:"ch_town6"}, {sheet:"ch_town7"},
  {sheet:"ch_town8"}, {sheet:"ch_town9"}
];
/* wilderness trainers come from the forest set */
const BOSS_PALS = [];
for(let i=0;i<12;i++) BOSS_PALS.push("ch_forest"+i);

function genRegion(ri){
  if(mapCache[ri]) return mapCache[ri];
  const rng = mulberry(9001 + ri*7331);
  const rnd = ()=>rng();
  const t = new Uint8Array(MW*MH).fill(T.GRASS);
  const at = (x,y)=>t[y*MW+x];
  const set = (x,y,v)=>{ if(x>=0&&y>=0&&x<MW&&y<MH) t[y*MW+x]=v; };

  // border of trees
  for(let x=0;x<MW;x++){ set(x,0,T.TREE); set(x,1,T.TREE); set(x,MH-1,T.TREE); set(x,MH-2,T.TREE); }
  for(let y=0;y<MH;y++){ set(0,y,T.TREE); set(1,y,T.TREE); set(MW-1,y,T.TREE); set(MW-2,y,T.TREE); }

  // scattered woods
  for(let i=0;i<70;i++){
    const cx=3+Math.floor(rnd()*(MW-6)), cy=3+Math.floor(rnd()*(MH-6)), rr=1+Math.floor(rnd()*2.6);
    for(let y=-rr;y<=rr;y++) for(let x=-rr;x<=rr;x++)
      if(x*x+y*y<=rr*rr && rnd()>.3) set(cx+x,cy+y, rnd()>.78?T.ROCK:T.TREE);
  }
  // a lake
  const lx = 30+Math.floor(rnd()*12), ly = 22+Math.floor(rnd()*10);
  for(let y=-5;y<=5;y++) for(let x=-8;x<=8;x++)
    if(x*x/2.2+y*y<=22 && rnd()>.12) set(lx+x,ly+y,T.WATER);
  // tall grass patches
  for(let i=0;i<16;i++){
    const cx=6+Math.floor(rnd()*(MW-12)), cy=6+Math.floor(rnd()*(MH-12)), rw=2+Math.floor(rnd()*4), rh=2+Math.floor(rnd()*3);
    for(let y=-rh;y<=rh;y++) for(let x=-rw;x<=rw;x++){
      const tx=cx+x, ty=cy+y;
      if(tx<2||ty<2||tx>MW-3||ty>MH-3) continue;
      if(at(tx,ty)===T.GRASS && rnd()>.2) set(tx,ty,T.TALL);
    }
  }
  for(let i=0;i<40;i++){ const x=3+Math.floor(rnd()*(MW-6)), y=3+Math.floor(rnd()*(MH-6)); if(at(x,y)===T.GRASS) set(x,y,T.FLOWER); }

  // ---- town block (left side) ----
  // Footprints match the artwork exactly: the hospital sprite is 6x6 tiles,
  // the small house 5x5 and the arena 7x7, all at 16px per tile.
  const tx0=4, ty0=4, tw=22, th=18;
  for(let y=ty0;y<ty0+th;y++) for(let x=tx0;x<tx0+tw;x++) set(x,y,T.FLOOR);
  const buildings = [
    {x:tx0+1,  y:ty0+1,  w:6, h:6, door:T.HEAL, art:"hospital"},
    {x:tx0+12, y:ty0+2,  w:5, h:5, door:T.SHOP, art:"house_small"},
    {x:tx0+6,  y:ty0+10, w:7, h:7, door:T.GYM,  art:REGION_ART[ri].arena},
    {x:tx0+15, y:ty0+10, w:5, h:5, art:(ri%2? "house_small_alt":"house_small")}
  ];
  buildings.forEach(b=>{
    for(let y=b.y;y<b.y+b.h;y++) for(let x=b.x;x<b.x+b.w;x++) set(x,y,T.WALL);
    if(b.door) set(b.x+Math.floor(b.w/2), b.y+b.h-1, b.door);
  });
  // roads
  const roadY = ty0+th+2;
  for(let x=tx0+2;x<MW-3;x++){ set(x,roadY,T.PATH); set(x,roadY+1,T.PATH); }
  for(let y=ty0+8;y<=roadY;y++){ set(tx0+20,y,T.PATH); set(tx0+21,y,T.PATH); }
  const branchX = 26+Math.floor(rnd()*8);
  for(let y=6;y<roadY;y++){ set(branchX,y,T.PATH); }
  // gates
  const gateY = roadY;
  set(MW-2,gateY,T.GATE); set(MW-2,gateY+1,T.GATE); set(MW-1,gateY,T.GATE); set(MW-1,gateY+1,T.GATE);
  set(0,gateY,T.GATEBACK); set(1,gateY,T.GATEBACK); set(0,gateY+1,T.GATEBACK); set(1,gateY+1,T.GATEBACK);
  set(2,gateY,T.PATH); set(2,gateY+1,T.PATH); set(3,gateY,T.PATH); set(3,gateY+1,T.PATH);
  for(let x=3;x<tx0+2;x++){ set(x,gateY,T.PATH); set(x,gateY+1,T.PATH); }

  // Roads are carved after the buildings, so re-stamp every building and its
  // door afterwards. A road once ran through the arena and deleted its door,
  // which locked the whole game: no entrance, no badge, no gate east.
  buildings.forEach(b=>{
    for(let y=b.y;y<b.y+b.h;y++) for(let x=b.x;x<b.x+b.w;x++) set(x,y,T.WALL);
    if(!b.door) return;
    const dx = b.x+Math.floor(b.w/2), dy = b.y+b.h-1;
    set(dx, dy, b.door);
    if(dy+1 < MH && !WALK[at(dx,dy+1)]) set(dx, dy+1, T.FLOOR);   // keep the approach clear
  });

  // ---- objects ----
  const objs = [];
  const reg = REGIONS[ri];
  const walkable = (x,y)=>WALK[at(x,y)] && at(x,y)!==T.GATE && at(x,y)!==T.GATEBACK;
  // flood fill from the town so nothing is ever placed in a sealed pocket
  const spawnX = tx0+2, spawnY = ty0+8;
  const reachable = new Set([spawnX+","+spawnY]);
  const stack = [[spawnX,spawnY]];
  while(stack.length){
    const [x,y] = stack.pop();
    for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){
      const nx=x+dx, ny=y+dy, k=nx+","+ny;
      if(nx<1||ny<1||nx>=MW-1||ny>=MH-1||reachable.has(k)) continue;
      if(!WALK[at(nx,ny)]) continue;
      reachable.add(k); stack.push([nx,ny]);
    }
  }
  const freeSpot = (minX,minY,maxX,maxY)=>{
    for(let k=0;k<600;k++){
      const x=minX+Math.floor(rnd()*(maxX-minX)), y=minY+Math.floor(rnd()*(maxY-minY));
      if(walkable(x,y) && reachable.has(x+","+y) && !objs.some(o=>o.x===x&&o.y===y)) return {x,y};
    }
    return null;
  };
  // town folk
  const lines = [
    "Arena leaders only accept a challenge from a warden who travels light and trains hard.",
    "Tall grass hides the shy ones. Walk it slowly and something will find you.",
    "A creature that faints still learns nothing. Rest them at the hollow before you push on.",
    "Snares work best on a tired creature. Wear them down first, then throw.",
    "Every region keeps its own weather, and its own creatures. Nothing here lives up on the Spire.",
    "Type matters more than levels. A bad matchup will humble a strong creature."
  ];
  for(let i=0;i<3;i++){
    const s = freeSpot(tx0+1,ty0+1,tx0+tw-1,ty0+th-1);
    if(s) objs.push({...s, kind:"npc", text: lines[(ri*3+i)%lines.length], name:["Villager","Warden","Elder"][i]});
  }
  objs.push({x:tx0+4,y:ty0+7,kind:"sign",name:"Notice board",
    text:`${reg.town}, in ${reg.name}. The arena stands to the south. ${reg.leader} keeps the ${reg.badge}.`});

  // trainers along the routes
  const nTrainers = 6 + (ri>3?2:0);
  for(let i=0;i<nTrainers;i++){
    const s = freeSpot(tx0+tw+2, 3, MW-4, MH-4);
    if(!s) continue;
    const size = ri<2?1:(rnd()>.55?3:2);
    const team = [];
    for(let k=0;k<size;k++){
      const sid = reg.pool[Math.floor(rnd()*reg.pool.length)];
      const lv = reg.lv[0]+Math.floor(rnd()*(reg.lv[1]-reg.lv[0]+1))+1;
      team.push({sid, lv});
    }
    objs.push({...s, kind:"trainer", idx:i,
      title: TRAINER_TITLES[Math.floor(rnd()*TRAINER_TITLES.length)],
      pname: TRAINER_NAMES[Math.floor(rnd()*TRAINER_NAMES.length)],
      team, reward: 90*(ri+1)+Math.floor(rnd()*140),
      taunt: ["Hold it. You walked right past my patch.","You have the look of a challenger. Prove it.",
              "Nice creatures. Mine bite harder.","I have been waiting all morning for a real match.",
              "This route is mine until you beat me."][Math.floor(rnd()*5)]});
  }
  // ground items
  const itemNames = Object.keys(ITEMS);
  for(let i=0;i<5;i++){
    const s = freeSpot(tx0+tw+2, 3, MW-4, MH-4);
    if(!s) continue;
    const pick = itemNames[Math.floor(rnd()*(ri<3?6:itemNames.length))];
    objs.push({...s, kind:"item", item:pick, idx:i});
  }
  // tidy the coastline: stray single tiles left inside a lake look like glitches
  for(let pass=0;pass<2;pass++){
    const copy = t.slice();
    for(let y=1;y<MH-1;y++) for(let x=1;x<MW-1;x++){
      const v = copy[y*MW+x];
      if(v===T.WATER || v===T.WALL || v===T.HEAL || v===T.SHOP || v===T.GYM || v===T.PATH || v===T.FLOOR) continue;
      let n=0;
      if(copy[(y-1)*MW+x]===T.WATER) n++;
      if(copy[(y+1)*MW+x]===T.WATER) n++;
      if(copy[y*MW+x-1]===T.WATER) n++;
      if(copy[y*MW+x+1]===T.WATER) n++;
      if(n>=3) t[y*MW+x]=T.WATER;
    }
  }
  // cheap guard: a region without an arena door cannot be completed
  if(!Array.prototype.includes.call(t, T.GYM)) console.warn("Aetherfolk: region "+ri+" generated without an arena door");

  const m = {tiles:t, objs, spawn:{x:tx0+2, y:ty0+8}, gateY, buildings, tx0, ty0, tw, th};
  mapCache[ri]=m;
  return m;
}


/* ---------------- sound ---------------- */
let AC = null, sfxOn = true;
try{ sfxOn = localStorage.getItem("aetherfolk.sound") !== "off"; }catch(e){}
function ac(){
  if(!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ AC=false; } }
  if(AC && AC.state==="suspended") AC.resume();
  return AC || null;
}
function tone(freq, dur, type, vol, slideTo){
  const c = ac(); if(!c || !sfxOn) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type||"square"; o.frequency.setValueAtTime(freq, c.currentTime);
  if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30,slideTo), c.currentTime+dur);
  g.gain.setValueAtTime(vol||0.05, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+dur);
  o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+dur);
}
function sfx(kind){
  switch(kind){
    case "select": tone(660,.06,"square",.035); break;
    case "hit":    tone(180,.12,"square",.05,90); break;
    case "hit2":   tone(240,.2,"sawtooth",.055,70); break;
    case "faint":  tone(300,.45,"triangle",.05,60); break;
    case "level":  tone(523,.09,"square",.05); setTimeout(()=>tone(659,.09,"square",.05),95); setTimeout(()=>tone(784,.18,"square",.05),190); break;
    case "catch":  tone(440,.08,"square",.05); setTimeout(()=>tone(587,.08,"square",.05),90); setTimeout(()=>tone(880,.25,"square",.05),180); break;
    case "shake":  tone(320,.07,"square",.04); break;
    case "door":  tone(420,.09,"square",.05); setTimeout(()=>tone(300,.12,"square",.04),90); break;
    case "badge":  [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,.2,"square",.05),i*110)); break;
  }
}
function toggleSound(){
  sfxOn = !sfxOn;
  try{ localStorage.setItem("aetherfolk.sound", sfxOn?"on":"off"); }catch(e){}
  if(sfxOn) sfx("select");
  return sfxOn;
}
document.addEventListener("click", ()=>ac(), {once:true});
document.addEventListener("keydown", ()=>ac(), {once:true});
