/* ============================================================
   Overworld: procedural region maps, rendering, movement
   ============================================================ */

const T = {GRASS:0,TALL:1,PATH:2,WATER:3,TREE:4,ROCK:5,WALL:6,HEAL:7,SHOP:8,GYM:9,FLOWER:10,SIGN:11,GATE:12,FLOOR:13,GATEBACK:14};
const WALK = {0:1,1:1,2:1,10:1,13:1,12:1,14:1};
const TILE = 32;
const MW = 52, MH = 40;
const mapCache = {};

/* ---------------- region art ----------------
   Terrain comes from tileset_floor.png, which is laid out as six
   11x7 blocks. Within a block the tiles sit at fixed offsets, so
   one small table drives every region. Blocks are re-used with a
   colour wash to give eight distinct moods from six sets of art. */

const BLOCKS = { sand:[0,0], rose:[11,0], grass:[0,7], deepgrass:[11,7], snow:[0,14], mud:[11,14], pool:[0,21] };
/* offsets inside a block, in tiles */
const REL = {
  patch:   [0,0],   // 3x3 autotile for paths and dirt
  center:  [1,1],
  patchDeco:[0,4],
  base:    [0,5],   // plain ground
  baseDeco:[1,5],   // four decorated ground variants follow
  bush:    [0,6]    // encounter grass
};

const REGION_ART = [
  {block:"grass",     wash:null,              mote:"leaf",  moteCol:"#DFF3B8",
   sky:["#79A9C4","#C8DCC0"], ground:"#5E9450", hill:"#2E6136"},
  {block:"sand",      wash:["#B8431F",0.16],  mote:"ember", moteCol:"#FFB067",
   sky:["#8A5540","#D9A06A"], ground:"#B08048", hill:"#6D4326"},
  {block:"deepgrass", wash:["#2E7BA8",0.14],  mote:"spray", moteCol:"#D6F2F7",
   sky:["#6FA8C8","#CFE6DC"], ground:"#4A8A66", hill:"#2F5F4C"},
  {block:"mud",       wash:["#E8D24A",0.20],  mote:"spark", moteCol:"#FFF0A0",
   sky:["#7A7E9A","#D0CFA8"], ground:"#9A9250", hill:"#5A5A2E"},
  {block:"rose",      wash:["#7E7566",0.34], desat:0.45,  mote:"dust",  moteCol:"#E8DCC0",
   sky:["#9A8E78","#DCD2B8"], ground:"#9A9280", hill:"#5F5A4A"},
  {block:"snow",      wash:["#43336E",0.50], desat:0.35,  mote:"wisp",  moteCol:"#C8B4F0",
   sky:["#433C62","#8A7FA8"], ground:"#5A5080", hill:"#332E52"},
  {block:"snow",      wash:["#8CBEDE",0.30], desat:0.62,  mote:"snow",  moteCol:"#FFFFFF",
   sky:["#8FB4C8","#E4F0F6"], ground:"#C3D6E0", hill:"#4E7684"},
  {block:"rose",      wash:["#6E2F5E",0.40], desat:0.30,  mote:"ember", moteCol:"#F0BCA0",
   sky:["#6A4460","#E0A88A"], ground:"#8A5A78", hill:"#4E2F48"}
];
function regionTint(i){ return ["#4E8449","#437640"]; }

/* ---------------- art loading ---------------- */
const ART_SRC = {
  floor:   "assets/tileset_floor.png",
  village: "assets/tileset_village_abandoned.png",
  flower:  "assets/tileset_animated.png",
  char0:   "assets/char_ninja_blue.png",
  char1:   "assets/char_samurai_blue.png",
  char2:   "assets/char_samurai_green.png",
  animal:  "assets/pig.png"
};
const IMG = {};
function loadArt(onProgress){
  const keys = Object.keys(ART_SRC);
  let done = 0;
  return Promise.all(keys.map(k=>new Promise((res,rej)=>{
    const im = new Image();
    im.onload = ()=>{ IMG[k]=im; done++; if(onProgress) onProgress(done, keys.length); res(); };
    im.onerror = ()=>rej(new Error("Could not load "+ART_SRC[k]));
    im.src = ART_SRC[k];
  })));
}

/* village tileset objects, in source pixels */
const OBJ = {
  treeOrange: [64,96,32,32],   treeGreen: [64,144,32,32],
  bushOrange: [64,128,16,16],  bushGreen: [64,176,16,16],
  rock:       [112,64,16,16],
  houseSmall: [176,0,48,48],   houseMid:  [176,48,48,48], houseBig: [192,96,80,80]
};

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
  const tx0=4, ty0=4, tw=18, th=14;
  for(let y=ty0;y<ty0+th;y++) for(let x=tx0;x<tx0+tw;x++) set(x,y, (x+y)%13===0?T.FLOWER:T.FLOOR);
  const buildings = [
    {x:tx0+2, y:ty0+2, w:3, h:3, door:T.HEAL},
    {x:tx0+12,y:ty0+2, w:3, h:3, door:T.SHOP},
    {x:tx0+2, y:ty0+8, w:5, h:5, door:T.GYM}
  ];
  buildings.forEach(b=>{
    for(let y=b.y;y<b.y+b.h;y++) for(let x=b.x;x<b.x+b.w;x++) set(x,y,T.WALL);
    set(b.x+Math.floor(b.w/2), b.y+b.h-1, b.door);
  });
  // roads
  const roadY = ty0+th+2;
  for(let x=tx0+2;x<MW-3;x++){ set(x,roadY,T.PATH); set(x,roadY+1,T.PATH); }
  for(let y=ty0+6;y<=roadY;y++){ set(tx0+8,y,T.PATH); set(tx0+9,y,T.PATH); }
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
    const dx = b.x+Math.floor(b.w/2), dy = b.y+b.h-1;
    set(dx, dy, b.door);
    if(dy+1 < MH && !WALK[at(dx,dy+1)]) set(dx, dy+1, T.FLOOR);   // keep the approach clear
  });

  // ---- objects ----
  const objs = [];
  const reg = REGIONS[ri];
  const walkable = (x,y)=>WALK[at(x,y)] && at(x,y)!==T.GATE && at(x,y)!==T.GATEBACK;
  // flood fill from the town so nothing is ever placed in a sealed pocket
  const spawnX = tx0+8, spawnY = ty0+7;
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

  const m = {tiles:t, objs, spawn:{x:tx0+8, y:ty0+7}, gateY, buildings, tx0, ty0, tw, th};
  mapCache[ri]=m;
  return m;
}

/* ---------------- rendering ---------------- */
const bufCache = {};
function hash2(x,y,s){ let h=x*374761393+y*668265263+s*69069; h=(h^(h>>13))*1274126177; return ((h^(h>>16))>>>0)/4294967296; }

const SRC = 16;              // source tile size in the tileset
const SCALE = TILE / SRC;    // world tiles are 32px, so everything draws at 2x

function renderRegionBuffer(ri){
  if(bufCache[ri]) return bufCache[ri];
  const m = genRegion(ri);
  const A = REGION_ART[ri];
  const B = BLOCKS[A.block], PB = BLOCKS.pool;
  const cv = document.createElement("canvas");
  cv.width = MW*TILE; cv.height = MH*TILE;
  const c = cv.getContext("2d");
  c.imageSmoothingEnabled = false;

  const tl = (x,y)=> (x<0||y<0||x>=MW||y>=MH) ? T.TREE : m.tiles[y*MW+x];

  /* draw one tile of a block, by its offset inside that block */
  const blit = (blk, rc, x, y)=>{
    c.drawImage(IMG.floor, (blk[0]+rc[0])*SRC, (blk[1]+rc[1])*SRC, SRC, SRC,
                x*TILE, y*TILE, TILE, TILE);
  };
  /* 9-slice: pick the right edge tile from a 3x3 patch set */
  const patchRC = (n,e,s,w)=>[ w? (e?1:2) : 0, n? (s?1:2) : 0 ];
  /* an object from the village sheet, drawn at 2x and bottom-anchored */
  const obj = (o, x, y, dy)=>{
    const [sx,sy,sw,sh] = o;
    c.drawImage(IMG.village, sx, sy, sw, sh,
      x*TILE + TILE/2 - sw*SCALE/2, (y+1)*TILE - sh*SCALE + (dy||0), sw*SCALE, sh*SCALE);
  };

  /* ---- pass 1: ground under everything ---- */
  for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){
    const h = hash2(x,y,ri);
    if(h > 0.82) blit(B, [REL.baseDeco[0] + Math.floor(h*97)%4, REL.baseDeco[1]], x, y);
    else blit(B, REL.base, x, y);
  }

  /* ---- pass 2: surfaces that sit in the ground ---- */
  const isPath = (x,y)=>{ const v=tl(x,y); return v===T.PATH||v===T.GATE||v===T.GATEBACK||v===T.FLOOR
    ||v===T.WALL||v===T.HEAL||v===T.SHOP||v===T.GYM; };
  const isWater = (x,y)=> tl(x,y)===T.WATER;

  for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){
    const v = tl(x,y), h = hash2(x,y,ri);

    if(isPath(x,y)){
      const rc = patchRC(isPath(x,y-1), isPath(x+1,y), isPath(x,y+1), isPath(x-1,y));
      blit(B, [REL.patch[0]+rc[0], REL.patch[1]+rc[1]], x, y);
      if(rc[0]===1 && rc[1]===1 && h>0.86) blit(B, REL.patchDeco, x, y);
    }
    else if(v===T.WATER){
      const rc = patchRC(isWater(x,y-1), isWater(x+1,y), isWater(x,y+1), isWater(x-1,y));
      blit(PB, [REL.patch[0]+rc[0], REL.patch[1]+rc[1]], x, y);
      /* the pool set is pale, so a wash turns it into real water */
      c.save();
      c.globalCompositeOperation = "source-atop";
      c.fillStyle = "rgba(26,86,148,.62)";
      c.fillRect(x*TILE, y*TILE, TILE, TILE);
      c.restore();
    }
    else if(v===T.TALL){
      const set = hash2(x,y,ri+4)>.5 ? 0 : 3;   // two bush colours per block
      blit(B, [REL.bush[0] + set + (x&1), REL.bush[1]], x, y);
    }
    else if(v===T.FLOWER){
      c.drawImage(IMG.flower, 0, 0, SRC, SRC, x*TILE, y*TILE, TILE, TILE);
    }
  }

  /* ---- pass 3: things that stand up, top row first so they overlap ---- */
  for(let y=0;y<MH;y++) for(let x=0;x<MW;x++){
    const v = tl(x,y), h = hash2(x,y,ri);
    if(v===T.TREE){
      c.fillStyle="rgba(0,0,0,.22)";
      c.beginPath(); c.ellipse(x*TILE+16, y*TILE+27, 13, 5, 0, 0, 7); c.fill();
      obj(h>0.5? OBJ.treeGreen : OBJ.treeOrange, x, y, -2);
    }
    else if(v===T.ROCK){
      c.fillStyle="rgba(0,0,0,.20)";
      c.beginPath(); c.ellipse(x*TILE+16, y*TILE+27, 11, 4, 0, 0, 7); c.fill();
      obj(h>0.5? OBJ.rock : (h>0.25? OBJ.bushGreen : OBJ.bushOrange), x, y, -1);
    }
    else if(v===T.SIGN){
      c.fillStyle="rgba(0,0,0,.2)";
      c.beginPath(); c.ellipse(x*TILE+16, y*TILE+29, 8, 3.5, 0, 0, 7); c.fill();
      c.fillStyle="#6B5326"; c.fillRect(x*TILE+14, y*TILE+18, 4, 11);
      c.fillStyle="#A8834C"; c.fillRect(x*TILE+4, y*TILE+6, 24, 14);
      c.fillStyle="#C9A567"; c.fillRect(x*TILE+5, y*TILE+7, 22, 5);
      c.fillStyle="#5A4227"; c.fillRect(x*TILE+7, y*TILE+13, 18, 2); c.fillRect(x*TILE+7, y*TILE+16, 11, 2);
    }
    else if(v===T.GATE||v===T.GATEBACK){
      c.fillStyle="#4A3A22"; c.fillRect(x*TILE+1, y*TILE, 5, TILE); c.fillRect(x*TILE+26, y*TILE, 5, TILE);
      c.fillStyle="#63502F"; c.fillRect(x*TILE+1, y*TILE, 5, 4); c.fillRect(x*TILE+26, y*TILE, 5, 4);
      c.fillStyle="#E0A73C"; c.fillRect(x*TILE+8, y*TILE+12, 16, 6);
      c.fillStyle="rgba(0,0,0,.25)"; c.fillRect(x*TILE+8, y*TILE+16, 16, 2);
    }
  }

  /* ---- pass 4: buildings ---- */
  m.buildings.forEach(b=>{
    const art = b.door===T.HEAL? OBJ.houseSmall : b.door===T.SHOP? OBJ.houseMid : OBJ.houseBig;
    const trim = b.door===T.HEAL? "#6FBF73" : b.door===T.SHOP? "#4FA3D9" : "#E0A73C";
    const [sx,sy,sw,sh] = art;
    c.fillStyle="rgba(0,0,0,.20)";
    c.fillRect(b.x*TILE-4, (b.y+b.h)*TILE-8, b.w*TILE+8, 8);
    c.drawImage(IMG.village, sx, sy, sw, sh, b.x*TILE, b.y*TILE, sw*SCALE, sh*SCALE);
    /* a coloured shingle band and a hanging sign tell the three apart */
    const cx = b.x*TILE + b.w*TILE/2;
    c.fillStyle = trim; c.fillRect(cx-26, b.y*TILE-6, 52, 5);
    c.fillStyle = "rgba(0,0,0,.30)"; c.fillRect(cx-26, b.y*TILE-2, 52, 2);
    c.fillStyle = "#2A2016"; c.fillRect(cx-16, b.y*TILE+2, 32, 3);
    c.fillStyle = trim; c.fillRect(cx-14, b.y*TILE+5, 28, 11);
    c.fillStyle = "#1A1410"; c.fillRect(cx-10, b.y*TILE+8, 20, 5);
    /* lanterns beside the doorway */
    const dx = (b.x+Math.floor(b.w/2))*TILE, dy = (b.y+b.h-1)*TILE;
    c.fillStyle = "#E0A73C"; c.fillRect(dx-6, dy+10, 4, 4); c.fillRect(dx+34, dy+10, 4, 4);
  });

  /* ---- pass 5: the region's colour wash ---- */
  if(A.desat){
    c.save();
    c.globalCompositeOperation = "saturation";
    c.globalAlpha = A.desat;
    c.fillStyle = "hsl(0,0%,50%)";
    c.fillRect(0,0,cv.width,cv.height);
    c.restore();
  }
  if(A.wash){
    c.save();
    c.globalCompositeOperation = "source-atop";
    c.globalAlpha = A.wash[1];
    c.fillStyle = A.wash[0];
    c.fillRect(0,0,cv.width,cv.height);
    c.restore();
  }

  bufCache[ri]=cv;
  return cv;
}

/* ---------------- animated overlay ---------------- */
function drawWaterAnim(c, camX, camY, w, h, t){
  const m = genRegion(G.region);
  const x0 = Math.max(0,Math.floor(camX/TILE)), y0 = Math.max(0,Math.floor(camY/TILE));
  const x1 = Math.min(MW-1, Math.ceil((camX+w)/TILE)), y1 = Math.min(MH-1, Math.ceil((camY+h)/TILE));
  c.save(); c.globalAlpha = .30; c.fillStyle = "#CFF0FA";
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    if(m.tiles[y*MW+x]!==T.WATER) continue;
    const px = x*TILE-camX, py = y*TILE-camY;
    const a = Math.sin(t*0.0022 + hash2(x,y,G.region)*6.28);
    c.fillRect(px+6+a*3, py+10, 12, 2);
    c.fillRect(px+16-a*3, py+21, 8, 2);
  }
  c.restore();
}

/* flowers wave; four frames in tileset_animated.png */
function drawFlowerAnim(c, camX, camY, w, h, t){
  const m = genRegion(G.region);
  const x0 = Math.max(0,Math.floor(camX/TILE)), y0 = Math.max(0,Math.floor(camY/TILE));
  const x1 = Math.min(MW-1, Math.ceil((camX+w)/TILE)), y1 = Math.min(MH-1, Math.ceil((camY+h)/TILE));
  for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
    if(m.tiles[y*MW+x]!==T.FLOWER) continue;
    const f = (Math.floor(t/220) + x + y) % 4;
    c.drawImage(IMG.flower, f*SRC, 0, SRC, SRC, x*TILE-camX, y*TILE-camY, TILE, TILE);
  }
}

/* weather and light motes */
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
    c.fillRect(p.x, p.y, 2, 2);
  }
  c.restore();
}

/* ---------------- people ----------------
   The sheets are 4 columns (down, up, left, right) by 7 rows;
   rows 0-3 are the walk cycle and row 0 doubles as the idle pose. */
const DIRCOL = {down:0, up:1, left:2, right:3};
function drawPerson(ctx,px,py,facing,frame,pal){
  const img = IMG[pal.sheet] || IMG.char0;
  ctx.fillStyle="rgba(0,0,0,.26)";
  ctx.beginPath(); ctx.ellipse(px+TILE/2, py+TILE-3, 9, 4, 0, 0, 7); ctx.fill();
  const col = DIRCOL[facing] !== undefined ? DIRCOL[facing] : 0;
  const row = frame & 3;
  ctx.drawImage(img, col*SRC, row*SRC, SRC, SRC, px, py-6, TILE, TILE);
}

const PLAYER_PAL = {sheet:"char0"};
const NPC_PALS = [
  {sheet:"char1"}, {sheet:"char2"}, {sheet:"char0"},
  {sheet:"char2"}, {sheet:"char1"}, {sheet:"char0"}
];
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
