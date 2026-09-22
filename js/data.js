/* ============================================================
   AETHERFOLK — data layer
   All creatures, types and moves here are original inventions.
   ============================================================ */
"use strict";

const TYPES = ["Flora","Ember","Aqua","Volt","Terra","Gale","Frost","Venom","Psy","Brawl","Shade","Metal","Draco","Beast","Rune"];

const TYPE_COLOR = {
  Flora:["#6FBF73","#2F6B44"], Ember:["#E4713A","#8C2F1E"], Aqua:["#4FA3D9","#23557F"],
  Volt:["#F2C53D","#9A7213"], Terra:["#B98A4E","#6B4A24"], Gale:["#9FD4E0","#4A7F92"],
  Frost:["#A8DDE8","#4E8FA8"], Venom:["#A46FD1","#5A2F82"], Psy:["#E57BA8","#8E3660"],
  Brawl:["#D1553F","#7A2A1E"], Shade:["#6B6389","#2A2438"], Metal:["#A9B3BD","#5C6873"],
  Draco:["#7A6AD8","#3B2F80"], Beast:["#C9BFA6","#7A6F5A"], Rune:["#F0A8C8","#A44E7C"]
};

/* attacker -> { defender: multiplier }, anything unlisted is 1 */
const CHART = {
  Flora:{Aqua:2,Terra:2,Ember:.5,Flora:.5,Venom:.5,Gale:.5,Draco:.5,Metal:.5},
  Ember:{Flora:2,Frost:2,Venom:2,Metal:2,Ember:.5,Aqua:.5,Terra:.5,Draco:.5},
  Aqua:{Ember:2,Terra:2,Aqua:.5,Flora:.5,Draco:.5},
  Volt:{Aqua:2,Gale:2,Terra:0,Volt:.5,Flora:.5,Draco:.5},
  Terra:{Ember:2,Volt:2,Venom:2,Metal:2,Gale:0,Flora:.5},
  Gale:{Flora:2,Brawl:2,Beast:2,Volt:.5,Metal:.5,Frost:.5},
  Frost:{Flora:2,Terra:2,Gale:2,Draco:2,Ember:.5,Aqua:.5,Frost:.5,Metal:.5},
  Venom:{Flora:2,Rune:2,Metal:0,Venom:.5,Terra:.5,Shade:.5},
  Psy:{Brawl:2,Venom:2,Shade:0,Psy:.5,Metal:.5},
  Brawl:{Beast:2,Frost:2,Metal:2,Shade:2,Venom:.5,Gale:.5,Psy:.5,Rune:.5},
  Shade:{Psy:2,Brawl:.5,Shade:.5,Rune:.5},
  Metal:{Frost:2,Rune:2,Terra:2,Ember:.5,Aqua:.5,Volt:.5,Metal:.5},
  Draco:{Draco:2,Rune:0,Metal:.5},
  Beast:{Shade:0,Terra:.5,Metal:.5},
  Rune:{Draco:2,Brawl:2,Shade:2,Ember:.5,Venom:.5,Metal:.5}
};
function eff(atkType, defTypes){
  let m = 1;
  for (const d of defTypes){ const row = CHART[atkType]; if (row && row[d] !== undefined) m *= row[d]; }
  return m;
}

/* ---------------- moves ----------------
   name | type | cat(0 phys,1 spec,2 status) | power | acc | pp | effect | chance      */
const MOVE_SRC = [
 // Beast / universal
 "Tackle|Beast|0|40|100|35||0","Scratch|Beast|0|40|100|35||0","Quick Jab|Beast|0|40|100|30|priority|0",
 "Body Slam|Beast|0|82|100|15|para|25","Rush Down|Beast|0|90|95|15||0","Hyper Howl|Beast|1|95|95|10|spa-|20",
 "Slam Tail|Beast|0|65|100|20|flinch|20","Wild Charge|Beast|0|110|85|10|recoil|0",
 "Growl|Beast|2|0|100|25|atk-|100","Harden Up|Beast|2|0|100|25|def+|100","Focus Mind|Beast|2|0|100|20|spa+|100",
 "Rest Up|Beast|2|0|100|10|heal|100","Sand Kick|Terra|2|0|100|20|acc-|100","Screech|Beast|2|0|90|20|def-|100",
 // Flora
 "Leaf Dart|Flora|1|42|100|30||0","Vine Lash|Flora|0|50|100|25||0","Petal Storm|Flora|1|78|95|15||0",
 "Root Drain|Flora|1|65|100|15|drain|100","Bramble Whip|Flora|0|85|95|15||0","Verdant Blast|Flora|1|110|90|8||0",
 "Spore Cloud|Flora|2|0|75|15|sleep|100","Seed Bind|Flora|2|0|90|20|spe-|100",
 // Ember
 "Ember Spit|Ember|1|42|100|30|burn|10","Flame Claw|Ember|0|55|100|25||0","Cinder Wave|Ember|1|80|95|15|burn|15",
 "Magma Fang|Ember|0|85|95|15|burn|20","Solar Flare|Ember|1|115|85|8|spd-|20","Heat Haze|Ember|2|0|100|20|spa+|100",
 // Aqua
 "Water Jet|Aqua|1|42|100|30||0","Aqua Fang|Aqua|0|55|100|25|flinch|15","Tide Surge|Aqua|1|80|100|15||0",
 "Whirlpool|Aqua|1|70|95|15|spe-|30","Abyssal Break|Aqua|1|112|85|8||0","Mist Veil|Aqua|2|0|100|20|spd+|100",
 // Volt
 "Static Nip|Volt|1|42|100|30|para|10","Spark Tackle|Volt|0|58|100|25|para|15","Arc Bolt|Volt|1|80|100|15|para|20",
 "Chain Shock|Volt|1|95|90|10|para|25","Thunder Crash|Volt|1|118|80|8|para|30","Charge Up|Volt|2|0|100|20|spa+|100",
 // Terra
 "Pebble Toss|Terra|0|45|100|30||0","Tremor|Terra|0|62|100|20||0","Stone Edge|Terra|0|82|90|15|hicrit|100",
 "Quake Slam|Terra|0|95|95|10||0","Mountainfall|Terra|0|118|80|8|def-|20","Bury|Terra|2|0|100|20|def+|100",
 // Gale
 "Gust Cut|Gale|1|45|100|30||0","Wing Beat|Gale|0|60|100|25||0","Cyclone|Gale|1|82|95|15|spe-|20",
 "Sky Dive|Gale|0|95|90|10|flinch|20","Tempest|Gale|1|115|80|8|confuse|20","Updraft|Gale|2|0|100|20|spe+|100",
 // Frost
 "Chill Spray|Frost|1|42|100|30|freeze|8","Ice Shard|Frost|0|45|100|30|priority|0","Frost Bite|Frost|0|75|95|15|freeze|12",
 "Glacial Wave|Frost|1|88|95|12|freeze|12","Absolute Zero|Frost|1|115|80|8|spa-|20","Frostguard|Frost|2|0|100|20|def+|100",
 // Venom
 "Toxin Sting|Venom|0|42|100|30|poison|20","Acid Spray|Venom|1|58|100|25|spd-|25","Venom Fang|Venom|0|80|95|15|poison|30",
 "Sludge Burst|Venom|1|92|95|10|poison|25","Plague Bloom|Venom|1|112|85|8|poison|35","Noxious Fog|Venom|2|0|85|20|poison|100",
 // Psy
 "Mind Flick|Psy|1|45|100|30||0","Kinesis|Psy|1|62|100|25|spd-|20","Psi Pulse|Psy|1|82|100|15|confuse|15",
 "Dreameater|Psy|1|90|95|10|drain|100","Mindbreak|Psy|1|118|85|8|spd-|30","Meditate|Psy|2|0|100|20|spa+|100",
 "Hypnotise|Psy|2|0|65|15|sleep|100",
 // Brawl
 "Knuckle|Brawl|0|48|100|30||0","Grapple|Brawl|0|65|100|25||0","Rising Kick|Brawl|0|85|95|15|priority|0",
 "Pile Driver|Brawl|0|98|90|10||0","Final Strike|Brawl|0|122|80|6|recoil|0","Battle Cry|Brawl|2|0|100|20|atk+|100",
 // Shade
 "Shadow Nip|Shade|0|45|100|30||0","Gloom Pulse|Shade|1|62|100|25|spa-|20","Nightmare|Shade|1|82|100|15|flinch|20",
 "Soul Siphon|Shade|1|88|95|10|drain|100","Eclipse|Shade|1|118|85|8|spd-|25","Shroud|Shade|2|0|100|20|spd+|100",
 // Metal
 "Iron Peck|Metal|0|48|100|30||0","Gear Slam|Metal|0|68|100|25||0","Steel Wing|Metal|0|85|95|15|def+|20",
 "Forge Hammer|Metal|0|100|85|10||0","Alloy Ruin|Metal|0|120|80|6|def-|25","Plate Up|Metal|2|0|100|20|def+|100",
 // Draco
 "Dragon Nip|Draco|0|48|100|30||0","Scale Shot|Draco|1|65|100|25||0","Wyrm Pulse|Draco|1|85|100|15||0",
 "Draco Rend|Draco|0|100|90|10||0","Cataclysm|Draco|1|128|80|5|spa-|30","Ancient Roar|Draco|2|0|100|20|atk+|100",
 // Rune
 "Glimmer|Rune|1|45|100|30||0","Charm Beam|Rune|1|62|100|25|atk-|25","Fable Burst|Rune|1|84|100|15||0",
 "Moonlight Arc|Rune|1|92|95|10|drain|100","Astral Judgement|Rune|1|118|85|8|spd-|25","Blessing|Rune|2|0|100|20|heal|100"
];
const MOVES = {};
MOVE_SRC.forEach(s=>{
  const p=s.split("|");
  MOVES[p[0]]={name:p[0],type:p[1],cat:+p[2],pow:+p[3],acc:+p[4],pp:+p[5],eff:p[6]||null,chance:+p[7]||0};
});
const MOVE_NAMES = Object.keys(MOVES);

/* ---------------- species ----------------
   name|type1|type2|archetype|spread|bst|evoLevel,evoTargetId  */
const SPREADS = {
  bal:[1,1,1,1,1,1], atk:[1.05,1.45,1.05,.7,.9,1.05], spa:[1,.7,.95,1.5,1.05,1.05],
  def:[1.1,1.05,1.55,.85,1.05,.65], spd:[1.1,.95,1,.95,1.5,.75], spe:[.9,1.15,.85,1,.9,1.45],
  bulk:[1.5,1,1.15,.9,1.15,.55], glass:[.8,1.4,.7,1.3,.8,1.25], tank:[1.3,1.2,1.3,.8,1.1,.6]
};
const SPECIES_SRC = [
// 1-9 starters
"Sprigling|Flora||quad|bal|318|16,2","Thornling|Flora||quad|bal|410|32,3","Bramblore|Flora|Terra|quad|tank|530|,",
"Cindercub|Ember||quad|spe|318|16,5","Blazehound|Ember||quad|spe|410|32,6","Pyrothane|Ember|Brawl|biped|atk|530|,",
"Dripling|Aqua||blob|spd|318|16,8","Tidepole|Aqua||fish|spd|410|32,9","Maelstrike|Aqua|Gale|serpent|spa|530|,",
// 10-20 early
"Nibbit|Beast||quad|spe|252|18,11","Gnawrat|Beast||quad|spe|400|,",
"Flittail|Gale|Beast|avian|spe|248|14,13","Skywren|Gale||avian|spe|350|30,14","Galecrest|Gale||avian|spe|468|,",
"Grubbly|Venom||insect|bal|205|9,16","Chrysalix|Venom||blob|def|215|14,17","Mothwyng|Venom|Gale|insect|spa|400|,",
"Pebbling|Terra||golem|def|280|22,19","Boulderon|Terra||golem|def|400|38,20","Monolithe|Terra|Metal|golem|tank|510|,",
// 21-30
"Sparkit|Volt||quad|spe|290|24,22","Voltrix|Volt||quad|spe|448|,",
"Emberfly|Ember||insect|spa|275|26,24","Scorchwing|Ember|Gale|insect|spa|442|,",
"Lilypip|Flora||plant|spd|282|28,26","Bloomara|Flora|Rune|plant|spa|455|,",
"Mucklet|Venom|Terra|blob|bulk|290|30,28","Sludgore|Venom||blob|bulk|462|,",
"Frostkit|Frost||quad|atk|288|28,30","Glacifang|Frost||quad|atk|460|,",
// 31-40
"Bubblit|Aqua||fish|spa|272|22,32","Coralash|Aqua|Flora|fish|spd|435|,",
"Torchmite|Ember||insect|atk|285|30,34","Magmite|Ember|Metal|golem|def|468|,",
"Whispurr|Psy|Beast|quad|spa|286|28,36","Mystipaw|Psy||quad|spa|455|,",
"Duskbat|Shade|Gale|avian|spe|280|32,38","Nocturne|Shade||avian|spe|470|,",
"Ironjaw|Metal|Beast|quad|atk|300|34,40","Clankarn|Metal||golem|def|480|,",
// 41-50
"Wispling|Shade||float|spa|278|30,42","Phantasm|Shade|Psy|float|spa|468|,",
"Puffcloud|Gale||float|spd|276|32,44","Cumulord|Gale|Volt|float|spa|472|,",
"Sandnip|Terra||insect|atk|270|24,46","Dunescorp|Terra|Venom|insect|atk|452|,",
"Kelpling|Aqua|Flora|plant|def|284|30,48","Reefwarden|Aqua|Flora|plant|tank|470|,",
"Rivulet|Aqua||serpent|spe|292|36,50","Cascadra|Aqua|Draco|serpent|spa|500|,",
// 51-60
"Pyrelash|Ember|Shade|float|spa|290|34,52","Cindervex|Ember|Shade|float|spa|478|,",
"Boulderfist|Terra|Brawl|biped|atk|296|36,54","Titanclay|Terra|Brawl|biped|atk|492|,",
"Zephyrkit|Gale||quad|spe|278|26,56","Aerofang|Gale|Beast|quad|spe|450|,",
"Sproutle|Flora||plant|bal|262|20,58","Vinewrath|Flora||plant|atk|392|36,59","Thistlebrute|Flora|Brawl|biped|atk|498|,",
"Lumifly|Rune||insect|spa|255|16,61",
// 61-70
"Glimmermoth|Rune|Gale|insect|spa|380|34,62","Prismoth|Rune|Psy|insect|spa|505|,",
"Cobblit|Terra||golem|def|274|30,64","Quarrax|Terra|Metal|golem|tank|472|,",
"Shockshell|Volt|Metal|blob|def|420|,","Dynamoth|Volt||insect|spe|425|,",
"Chillfin|Frost|Aqua|fish|spa|288|32,68","Bergrazor|Frost|Aqua|fish|atk|470|,",
"Snowtuft|Frost|Flora|blob|spd|282|30,70","Blizzbloom|Frost|Flora|plant|spa|465|,",
// 71-80
"Emberox|Ember|Beast|quad|atk|300|34,72","Blazehorn|Ember|Terra|quad|tank|485|,",
"Toxifrog|Venom||biped|spa|286|32,74","Venomaul|Venom|Brawl|biped|atk|480|,",
"Mindmite|Psy||insect|spa|268|30,76","Cerebrus|Psy|Shade|quad|spa|478|,",
"Tinkerbolt|Volt|Metal|biped|spa|435|,","Voltagon|Volt|Draco|serpent|spa|515|,",
"Ripplefin|Aqua||fish|spe|290|32,80","Tsunamaw|Aqua|Beast|fish|atk|482|,",
// 81-90
"Gloomcap|Flora|Venom|plant|spd|284|32,82","Sporelord|Flora|Venom|plant|spd|478|,",
"Emberquill|Ember|Gale|avian|spe|292|34,84","Flameroc|Ember|Gale|avian|spe|488|,",
"Steelbeak|Metal|Gale|avian|atk|296|36,86","Aegisoar|Metal|Gale|avian|def|495|,",
"Runepup|Rune||quad|spd|280|30,88","Fableon|Rune|Psy|quad|spa|482|,",
"Duskmoth|Shade|Venom|insect|spa|294|38,90","Eclipsera|Shade|Draco|float|spa|510|,",
// 91-100
"Cragclaw|Terra|Beast|quad|atk|292|34,92","Mesabrawl|Terra|Brawl|biped|tank|486|,",
"Icicleaf|Frost|Flora|plant|spd|280|32,94","Frostbriar|Frost|Flora|plant|def|474|,",
"Aquaspark|Aqua|Volt|fish|spa|290|34,96","Stormtide|Aqua|Volt|serpent|spa|500|,",
"Ashpup|Ember|Shade|quad|spe|288|36,98","Cinderwraith|Ember|Shade|float|spa|492|,",
"Silkspin|Venom||insect|def|264|28,100","Arachnex|Venom|Shade|insect|atk|470|,",
// 101-110
"Grovekin|Flora|Rune|plant|spd|292|36,102","Sylvanox|Flora|Rune|plant|tank|505|,",
"Stonewing|Terra|Gale|avian|spe|286|32,104","Cliffsoar|Terra|Gale|avian|atk|480|,",
"Glowkoi|Aqua|Rune|fish|spa|430|,","Lanterneel|Aqua|Volt|serpent|spa|445|,",
"Mirrorshade|Psy|Metal|float|spd|440|,","Prismguard|Psy|Metal|golem|def|498|,",
"Gustling|Gale||float|spe|280|32,110","Tempestral|Gale|Psy|float|spa|490|,",
// 111-120
"Lavapup|Ember|Terra|quad|atk|290|34,112","Magmaul|Ember|Terra|golem|tank|492|,",
"Frostgeist|Frost|Shade|float|spa|288|36,114","Rimewraith|Frost|Shade|float|spa|496|,",
"Bramblehog|Flora|Terra|quad|def|284|30,116","Thornbeast|Flora|Beast|quad|atk|478|,",
"Chompfin|Aqua|Brawl|fish|atk|292|32,118","Brinebrawler|Aqua|Brawl|biped|atk|488|,",
"Voltkit|Volt|Beast|quad|spe|278|28,120","Thunderpelt|Volt|Beast|quad|spe|470|,",
// 121-130
"Ironhide|Metal|Terra|quad|def|300|36,122","Bastiomar|Metal|Terra|golem|tank|505|,",
"Hexling|Shade|Rune|float|spa|290|34,124","Malicorn|Shade|Rune|quad|spa|495|,",
"Dracling|Draco||serpent|bal|300|30,126","Wyrmscale|Draco||serpent|bal|420|48,127","Sovranwyrm|Draco|Gale|serpent|atk|600|,",
"Pyredrake|Draco|Ember|serpent|spa|520|,","Frostwyrm|Draco|Frost|serpent|spa|520|,","Tidalwyrm|Draco|Aqua|serpent|spa|520|,",
// 131-140
"Geodrake|Draco|Terra|serpent|tank|520|,","Voltwyrm|Draco|Volt|serpent|spa|520|,",
"Sablefang|Shade|Beast|quad|spe|296|34,134","Umbrapard|Shade|Beast|quad|spe|500|,",
"Lucentia|Rune|Psy|float|spa|525|,","Solmirage|Rune|Ember|float|spa|525|,",
"Gigashell|Aqua|Metal|blob|def|310|36,138","Abyssguard|Aqua|Metal|golem|tank|515|,",
"Mycelord|Flora|Shade|plant|spd|515|,","Verdantitan|Flora|Terra|golem|tank|540|,",
// 141-150
"Quakehorn|Terra|Beast|quad|atk|525|,","Tempestmaw|Gale|Draco|avian|spe|540|,",
"Infernace|Ember|Brawl|biped|atk|540|,","Cryostag|Frost|Rune|quad|spd|530|,",
"Voltmonarch|Volt|Rune|float|spa|535|,","Umbralux|Shade|Psy|float|spa|535|,",
"Terravore|Terra|Draco|golem|tank|545|,","Seraphlume|Rune|Gale|avian|spa|640|,",
"Noctivore|Shade|Draco|float|atk|640|,","Aetherion|Psy|Rune|float|bal|660|,"
];

function mulberry(seed){ let a=seed>>>0; return function(){ a|=0;a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

const SPECIES = SPECIES_SRC.map((s,i)=>{
  const p = s.split("|");
  const id = i+1;
  const w = SPREADS[p[4]], bst = +p[5];
  const rng = mulberry(id*7919+13);
  const base = w.map(k=>Math.max(15, Math.round(bst/6*k*(0.94+rng()*0.12))));
  const evo = p[6].split(",");
  const types = [p[1]]; if(p[2]) types.push(p[2]);
  return { id, name:p[0], types, arch:p[3], bst,
    base:{hp:base[0],atk:base[1],def:base[2],spa:base[3],spd:base[4],spe:base[5]},
    evoLv: evo[0]?+evo[0]:0, evoTo: evo[1]?+evo[1]:0,
    catchRate: Math.max(10, Math.round(260 - bst/3.1)),
    xpYield: Math.round(bst/4.2)
  };
});
const byId = id => SPECIES[id-1];

/* creatures that never appear in tall grass */
const LEGENDARY = [148,149,150];
/* evolution stage: 0 basic, 1 middle, 2 final — drives sprite size and detail */
const PREVO = {};
SPECIES.forEach(s=>{ if(s.evoTo) PREVO[s.evoTo]=s.id; });
SPECIES.forEach(s=>{
  const hasPrevo = !!PREVO[s.id];
  if(!hasPrevo && !s.evoTo) s.stage = s.bst>=470? 2 : 1;
  else if(!hasPrevo) s.stage = 0;
  else s.stage = s.evoTo? 1 : 2;
});
const PSEUDO = [127,128,129,130,131,132,135,136,139,140,141,142,143,144,145,146,147];

/* ---------------- learnsets (deterministic per species) ---------------- */
function movesOfType(t, maxPow){
  return MOVE_NAMES.filter(n=>MOVES[n].type===t && MOVES[n].pow<=maxPow);
}
function buildLearnset(sp){
  const rng = mulberry(sp.id*104729+5);
  const pool = [];
  sp.types.forEach(t=>pool.push(...MOVE_NAMES.filter(n=>MOVES[n].type===t)));
  pool.push(...MOVE_NAMES.filter(n=>MOVES[n].type==="Beast"));
  const uniq = [...new Set(pool)].map(n=>MOVES[n]);
  const weak = uniq.filter(m=>m.cat!==2 && m.pow<=55).sort((a,b)=>a.pow-b.pow);
  const mid  = uniq.filter(m=>m.cat!==2 && m.pow>55 && m.pow<=92);
  const big  = uniq.filter(m=>m.cat!==2 && m.pow>92);
  const stat = uniq.filter(m=>m.cat===2);
  const set = [];
  const take=(arr,lv)=>{ if(!arr.length) return; const m=arr.splice(Math.floor(rng()*arr.length),1)[0]; set.push([lv,m.name]); };
  // always open with a same-type attack so nothing starts helpless
  const stabWeak = weak.filter(m=>m.type===sp.types[0]);
  if(stabWeak.length){
    const m = stabWeak[Math.floor(rng()*stabWeak.length)];
    weak.splice(weak.indexOf(m),1); set.push([1,m.name]);
  }
  take(weak,1); take(weak,1);
  if(stat.length) take(stat,4);
  take(weak,8); take(mid,13);
  if(stat.length) take(stat,17);
  take(mid,21); take(mid,26);
  take(big,32);
  if(stat.length) take(stat,36);
  take(big,41);
  const rest = [...mid,...big,...weak];
  let lv=46; while(set.length<12 && rest.length){ take(rest,lv); lv+=5; }
  set.sort((a,b)=>a[0]-b[0]);
  return set;
}
const LEARNSETS = {};
SPECIES.forEach(sp=>LEARNSETS[sp.id]=buildLearnset(sp));

/* ---------------- items ---------------- */
const ITEMS = {
  "Field Snare":  {price:200, cat:"ball", rate:1,   desc:"A woven snare. Standard odds of holding a creature."},
  "Braided Snare":{price:600, cat:"ball", rate:1.9, desc:"Tighter weave, much better hold."},
  "Warden Snare": {price:1400,cat:"ball", rate:3.1, desc:"The finest snare a field warden can buy."},
  "Salve":        {price:250, cat:"heal", heal:30,  desc:"Restores 30 health."},
  "Strong Salve": {price:600, cat:"heal", heal:80,  desc:"Restores 80 health."},
  "Master Salve": {price:1400,cat:"heal", heal:220, desc:"Restores 220 health."},
  "Waking Draught":{price:320,cat:"cure", cures:"all", desc:"Clears any lingering condition."},
  "Revival Ember":{price:1600,cat:"revive", desc:"Wakes a fainted creature at half health."},
  "Ether Dust":   {price:900, cat:"pp",   desc:"Restores 10 uses to every move."},
  "Growth Tonic": {price:2400,cat:"xp",   desc:"Grants one level to a chosen creature."}
};

/* ---------------- regions ---------------- */
const REGIONS = [
  {name:"Verdant Hollow", badge:"Leaf Badge",  leader:"Mira",     ltype:"Flora", palette:"#3C6B3E", town:"Hollowstead",
   pool:[1,4,7,10,12,15,18,25,57,60,87,109,115,101], lv:[3,7], gymLv:14, teamTypes:["Flora"]},
  {name:"Cinder Basin",   badge:"Ember Badge", leader:"Dorn",     ltype:"Ember", palette:"#6B4030", town:"Slagmouth",
   pool:[11,13,16,19,21,23,33,45,71,97,111,83,5,2], lv:[9,14], gymLv:20, teamTypes:["Ember"]},
  {name:"Tidewatch Bay",  badge:"Tide Badge",  leader:"Nerissa",  ltype:"Aqua",  palette:"#2F5A70", town:"Saltpier",
   pool:[8,31,47,49,67,79,95,117,137,105,26,32,55,14], lv:[15,21], gymLv:26, teamTypes:["Aqua"]},
  {name:"Static Reach",   badge:"Surge Badge", leader:"Volk",     ltype:"Volt",  palette:"#6B6030", town:"Coilgate",
   pool:[22,43,65,66,77,106,119,44,24,36,99,3,6,9], lv:[21,28], gymLv:32, teamTypes:["Volt"]},
  {name:"Quarry Hold",    badge:"Stone Badge", leader:"Brann",    ltype:"Terra", palette:"#5E5340", town:"Grithaven",
   pool:[20,34,39,46,53,63,91,103,121,112,72,64,40,116], lv:[27,34], gymLv:38, teamTypes:["Terra","Metal"]},
  {name:"Hollowmere",     badge:"Dusk Badge",  leader:"Sable",    ltype:"Shade", palette:"#3A3350", town:"Wraithfen",
   pool:[28,37,41,73,75,81,89,100,113,123,133,42,76,52], lv:[33,41], gymLv:44, teamTypes:["Shade","Venom"]},
  {name:"Rime Summit",    badge:"Rime Badge",  leader:"Kestra",   ltype:"Frost", palette:"#3F5C6B", town:"Palefrost",
   pool:[29,30,68,69,70,93,94,110,114,144,56,86,104,13], lv:[39,47], gymLv:50, teamTypes:["Frost","Gale"]},
  {name:"Ashen Spire",    badge:"Spire Badge", leader:"Aurelian", ltype:"Draco", palette:"#5A3A52", town:"Emberhall",
   pool:[125,126,128,129,130,131,132,135,136,142,147,90,134,146], lv:[45,54], gymLv:58, teamTypes:["Draco","Rune"]}
];

const TRAINER_TITLES = ["Forager","Scout","Hiker","Angler","Ranger","Drifter","Apprentice","Bugcatcher","Herbalist","Courier","Cartographer","Lantern-keeper"];
const TRAINER_NAMES = ["Juno","Pell","Corin","Wren","Adda","Tobin","Sesk","Marlo","Iyla","Quill","Bram","Nessa","Ovid","Fenn","Lark","Dov","Ashra","Perrin","Sable-Jo","Kesh","Ivo","Runa","Tam","Ollie"];
