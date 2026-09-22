/* ============================================================
   Creature model + persistent game state
   ============================================================ */

const STATUS_INFO = {
  poison:{label:"Poisoned", col:"#A46FD1"}, burn:{label:"Burned", col:"#E4713A"},
  para:{label:"Paralysed", col:"#F2C53D"}, sleep:{label:"Asleep", col:"#6B6389"},
  freeze:{label:"Frozen", col:"#A8DDE8"}
};

function xpForLevel(lv){ return Math.round(1.15*Math.pow(lv,3)); }

function statAt(base, lv, iv, isHp){
  if(isHp) return Math.floor((2*base+iv)*lv/100)+lv+10;
  return Math.floor((2*base+iv)*lv/100)+5;
}

function movesAtLevel(speciesId, lv){
  const set = LEARNSETS[speciesId].filter(m=>m[0]<=lv).map(m=>m[1]);
  const uniq = [...new Set(set)];
  return uniq.slice(-4);
}

function makeCreature(speciesId, lv, opts){
  opts = opts||{};
  const sp = byId(speciesId);
  const ivs = {}; ["hp","atk","def","spa","spd","spe"].forEach(k=>ivs[k]=Math.floor(Math.random()*16));
  const c = { sid:speciesId, lv, xp:xpForLevel(lv), ivs, status:null, statusTurns:0, nick:null,
              moves: movesAtLevel(speciesId, lv).map(n=>({name:n, pp:MOVES[n].pp, max:MOVES[n].pp})) };
  if(!c.moves.length) c.moves=[{name:"Tackle",pp:35,max:35}];
  recalc(c); c.hp = c.stats.hp;
  if(opts.hp!==undefined) c.hp=opts.hp;
  return c;
}
function recalc(c){
  const sp = byId(c.sid);
  c.stats = {
    hp: statAt(sp.base.hp, c.lv, c.ivs.hp, true),
    atk: statAt(sp.base.atk, c.lv, c.ivs.atk),
    def: statAt(sp.base.def, c.lv, c.ivs.def),
    spa: statAt(sp.base.spa, c.lv, c.ivs.spa),
    spd: statAt(sp.base.spd, c.lv, c.ivs.spd),
    spe: statAt(sp.base.spe, c.lv, c.ivs.spe)
  };
}
const cName = c => c.nick || byId(c.sid).name;
const isFainted = c => c.hp<=0;

/* ---------------- game state ---------------- */
const SAVE_KEY = "aetherfolk.save.v1";
let G = null;

function newGame(starterId){
  G = {
    region: 0, x: 0, y: 0, facing: "down",
    party: [], box: [],
    bag: {"Field Snare":8,"Salve":5},
    money: 3000, badges: [false,false,false,false,false,false,false,false],
    seen: {}, caught: {},
    beaten: {},        // "region:index" -> true for trainers
    picked: {},        // ground items collected
    gyms: {},          // region -> true
    steps: 0, playtime: 0, started: Date.now()
  };
  const st = makeCreature(starterId, 5);
  G.party.push(st);
  G.seen[starterId]=1; G.caught[starterId]=1;
  return G;
}

function saveGame(){
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify(G));
    return true;
  }catch(e){ return false; }
}
function loadGame(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    const d = JSON.parse(raw);
    if(!d || !d.party) return false;
    d.party.forEach(recalc); (d.box||[]).forEach(recalc);
    G = d; return true;
  }catch(e){ return false; }
}
function hasSave(){ try{ return !!localStorage.getItem(SAVE_KEY); }catch(e){ return false; } }

/* ---------------- party helpers ---------------- */
function healParty(){
  G.party.forEach(c=>{ c.hp=c.stats.hp; c.status=null; c.statusTurns=0; c.moves.forEach(m=>m.pp=m.max); });
}
function partyAlive(){ return G.party.some(c=>!isFainted(c)); }
function firstAlive(){ return G.party.findIndex(c=>!isFainted(c)); }
function addToParty(c){
  if(G.party.length<6){ G.party.push(c); return "party"; }
  G.box.push(c); return "box";
}
function giveXP(c, amount, log){
  if(isFainted(c)) return [];
  const events = [];
  c.xp += amount;
  while(c.lv<100 && c.xp >= xpForLevel(c.lv+1)){
    c.lv++;
    const before = c.stats.hp;
    recalc(c);
    c.hp += (c.stats.hp - before);
    events.push({type:"level", lv:c.lv});
    // learn any move for this level
    LEARNSETS[c.sid].filter(m=>m[0]===c.lv).forEach(m=>{
      if(c.moves.some(x=>x.name===m[1])) return;
      if(c.moves.length<4){ c.moves.push({name:m[1],pp:MOVES[m[1]].pp,max:MOVES[m[1]].pp}); events.push({type:"move",name:m[1]}); }
      else events.push({type:"movefull", name:m[1]});
    });
    const sp = byId(c.sid);
    if(sp.evoLv && c.lv>=sp.evoLv && sp.evoTo){
      const to = sp.evoTo;
      c.sid = to; recalc(c);
      G.seen[to]=1; G.caught[to]=1;
      events.push({type:"evolve", from:sp.name, to:byId(to).name});
    }
  }
  return events;
}
function xpFromFoe(foe, isTrainer){
  const sp = byId(foe.sid);
  return Math.max(6, Math.round(sp.xpYield * foe.lv / 5 * (isTrainer?1.5:1)));
}
