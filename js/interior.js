/* ============================================================
   Interiors
   Rooms are their own small maps, rendered from AxulArt's
   Basic Top-down Interior tileset (CC BY 4.0) at 16px native.
   Walking onto a building door swaps the current map for one of
   these; walking onto the mat by the entrance swaps it back.
   ============================================================ */

T.EXIT = 15;  WALK[15] = 1;       // the doormat you leave by
T.PROP = 16;                      // furniture: drawn separately, never walkable

const INT_TILE = {               // tile coords inside interior.png
  floor:[[0,9],[1,9],[2,9],[3,9],[4,9],[5,9],[6,9],[7,9],[8,9]],
  wall: [[0,8],[1,8],[2,8],[3,8],[4,8],[5,8],[6,8],[7,8],[8,8]],
  door: [[0,7],[1,7],[2,7],[3,7]],
  window:[[4,7],[5,7]]
};
/* furniture: [tx,ty,w,h] in tiles */
const INT_PROP = {
  shelf:[0,1,2,5], bed:[5,0,2,2], desk:[3,0,1,2], tv:[8,3,3,2],
  plant:[7,3,1,3], chair:[3,3,1,2], table:[5,3,2,3], rug:[9,7,3,3],
  box:[8,0,2,2], clock:[11,5,1,1]
};

const INT_STYLE = {
  heal: { wall:0, floor:4, door:2, title:"Recovery House" },
  shop: { wall:1, floor:3, door:1, title:"Supply Store"   },
  gym:  { wall:5, floor:6, door:2, title:"Arena Hall"     }
};

const interiorCache = {};

function makeInterior(kind, ri){
  const key = kind+":"+ri;
  if(interiorCache[key]) return interiorCache[key];
  const st = INT_STYLE[kind];
  const w = 15, h = 11;
  const t = new Uint8Array(w*h).fill(T.FLOOR);
  const set = (x,y,v)=>{ if(x>=0&&y>=0&&x<w&&y<h) t[y*w+x]=v; };
  const props = [];
  const objs = [];
  const addProp = (name,x,y)=>{
    const [tx,ty,pw,ph] = INT_PROP[name];
    props.push({tx,ty,pw,ph,x,y});
    for(let j=0;j<ph;j++) for(let i=0;i<pw;i++) set(x+i, y+j, T.PROP);
  };

  for(let x=0;x<w;x++){ set(x,0,T.WALL); set(x,1,T.WALL); }
  for(let y=0;y<h;y++){ set(0,y,T.WALL); set(w-1,y,T.WALL); }
  for(let x=0;x<w;x++) set(x,h-1,T.WALL);

  const cx = Math.floor(w/2);
  set(cx, h-1, T.EXIT);                       // the way out

  if(kind==="heal"){
    addProp("desk", cx-1, 3);
    objs.push({x:cx, y:3, kind:"heal", name:"Warden", facing:"down", sheet:"ch_town3"});
    addProp("bed", 2, 4); addProp("bed", 2, 7);
    addProp("plant", w-3, 3); addProp("plant", w-3, 7);
    addProp("clock", cx+3, 1);
  } else if(kind==="shop"){
    addProp("shelf", 1, 2); addProp("shelf", w-3, 2);
    addProp("desk", cx-1, 4);
    objs.push({x:cx, y:4, kind:"shop", name:"Trader", facing:"down", sheet:"ch_town6"});
    addProp("box", cx+3, 7);
  } else {
    addProp("rug", cx-1, 5);
    addProp("plant", 2, 3); addProp("plant", w-3, 3);
    addProp("plant", 2, 8); addProp("plant", w-3, 8);
    objs.push({x:cx, y:3, kind:"gym", name:REGIONS[ri].leader, facing:"down",
               sheet:"ch_forest"+((ri*3+1)%12)});
  }
  objs.forEach(o=> set(o.x,o.y, T.FLOOR));    // the keeper stands on floor
  objs.forEach(o=> o.solid = true);

  const m = {tiles:t, w, h, objs, props, style:st, kind, ri,
             spawn:{x:cx, y:h-2}, interior:true};
  interiorCache[key] = m;
  return m;
}

function renderInterior(m){
  if(m.buf) return m.buf;
  const st = m.style;
  const cv = document.createElement("canvas");
  cv.width = m.w*TILE; cv.height = m.h*TILE;
  const c = cv.getContext("2d");
  c.imageSmoothingEnabled = false;
  const img = IMG.interior;
  const put = (tx,ty,x,y,tw,th)=> c.drawImage(img, tx*SRC, ty*SRC, (tw||1)*SRC, (th||1)*SRC,
      x*TILE, y*TILE, (tw||1)*TILE, (th||1)*TILE);

  const fl = INT_TILE.floor[st.floor], wl = INT_TILE.wall[st.wall];
  for(let y=0;y<m.h;y++) for(let x=0;x<m.w;x++){
    const v = m.tiles[y*m.w+x];
    if(v===T.WALL && y<2) put(wl[0],wl[1],x,y);
    else if(v===T.WALL) put(wl[0],wl[1],x,y);
    else put(fl[0],fl[1],x,y);
  }
  /* windows to break up the back wall */
  const win = INT_TILE.window[0];
  put(win[0],win[1], 3, 1); put(win[0],win[1], m.w-4, 1);
  /* the doorway, drawn into the wall the mat sits in */
  const dr = INT_TILE.door[st.door];
  const cx = Math.floor(m.w/2);
  put(dr[0],dr[1], cx, m.h-1);

  m.props.forEach(p=> put(p.tx,p.ty,p.x,p.y,p.pw,p.ph));

  /* a soft shadow along the base of the back wall */
  c.fillStyle = "rgba(20,16,40,.18)";
  c.fillRect(0, 2*TILE, m.w*TILE, 5);

  m.buf = cv;
  return cv;
}
