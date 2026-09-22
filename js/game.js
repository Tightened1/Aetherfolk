/* ============================================================
   Game shell: loop, input, interaction, menus
   ============================================================ */
const cv = $("worldCanvas"), ctx = cv.getContext("2d");
let P = {x:0,y:0,px:0,py:0,dir:"down",moving:false,prog:0,frame:0,anim:0};
let busy = false, running = false;
const keys = {};
let heldDir = null;
function releaseKeys(){ ["up","down","left","right"].forEach(d=>keys[d]=false); heldDir=null; }

let vignette = null, vigW = 0, vigH = 0;
function resize(){
  const w = $("world").clientWidth, h = $("world").clientHeight;
  if(!w || !h) return;
  // whole-number scaling only: a fractional device ratio makes tiled art shimmer
  const dpr = Math.min(2, Math.max(1, Math.floor(window.devicePixelRatio||1)));
  cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.imageSmoothingEnabled = false;
  vignette = null;
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", ()=>setTimeout(resize,150));
if(window.ResizeObserver){ try{ new ResizeObserver(()=>resize()).observe($("world")); }catch(e){} }

function trimBuffers(){
  const ks = Object.keys(bufCache);
  if(ks.length>2) ks.slice(0, ks.length-2).forEach(k=>{ if(+k!==G.region) delete bufCache[k]; });
}
function tileAt(x,y){
  const m = genRegion(G.region);
  if(x<0||y<0||x>=MW||y>=MH) return T.TREE;
  return m.tiles[y*MW+x];
}
function objAt(x,y){
  const m = genRegion(G.region);
  return m.objs.find(o=>o.x===x&&o.y===y && !objDone(o));
}
function objDone(o){
  if(o.kind==="trainer") return !!G.beaten[G.region+":t"+o.idx];
  if(o.kind==="item") return !!G.picked[G.region+":i"+o.idx];
  return false;
}
function blocked(x,y){
  const t = tileAt(x,y);
  if(!WALK[t]) return true;
  const o = objAt(x,y);
  if(o && (o.kind==="npc"||o.kind==="trainer"||o.kind==="sign")) return true;
  return false;
}
const DIRV = {up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};

function draw(){
  const w = $("world").clientWidth, h = $("world").clientHeight;
  const buf = renderRegionBuffer(G.region);
  const A = REGION_ART[G.region];
  const t = performance.now();
  const cx = P.px + TILE/2 - w/2, cy = P.py + TILE/2 - h/2;
  // round the camera: fractional source coords tear the tiled background apart
  const camX = Math.round(Math.max(0, Math.min(Math.max(0, MW*TILE - w), cx)));
  const camY = Math.round(Math.max(0, Math.min(Math.max(0, MH*TILE - h), cy)));
  ctx.fillStyle = "#0B0F0A"; ctx.fillRect(0,0,w,h);
  const sw = Math.min(w, buf.width - camX), sh = Math.min(h, buf.height - camY);
  ctx.drawImage(buf, camX, camY, sw, sh, 0, 0, sw, sh);
  drawWaterAnim(ctx, camX, camY, w, h, t);
  drawFlowerAnim(ctx, camX, camY, w, h, t);

  const m = genRegion(G.region);
  const drawables = [];
  m.objs.forEach(o=>{
    if(objDone(o)) return;
    const sx = Math.round(o.x*TILE-camX), sy = Math.round(o.y*TILE-camY);
    if(sx<-48||sy<-48||sx>w+48||sy>h+48) return;
    drawables.push({y:o.y, fn:()=>{
      if(o.kind==="item"){
        const bob = Math.sin(t*.003 + o.x + o.y)*2;
        ctx.fillStyle="rgba(0,0,0,.24)"; ctx.beginPath(); ctx.ellipse(sx+16,sy+27,8,3.6,0,0,7); ctx.fill();
        ctx.fillStyle="#8A6A2E"; ctx.fillRect(sx+7,sy+11+bob,18,13);
        ctx.fillStyle="#C99A3E"; ctx.fillRect(sx+7,sy+11+bob,18,6);
        ctx.fillStyle="#EFE6D2"; ctx.fillRect(sx+7,sy+16+bob,18,2.5);
        ctx.fillStyle="#7A5A22"; ctx.fillRect(sx+14,sy+11+bob,4,13);
        ctx.fillStyle="rgba(255,255,255,.35)"; ctx.fillRect(sx+9,sy+12.5+bob,4,2);
      } else if(o.kind==="sign"){
        ctx.fillStyle="rgba(0,0,0,.2)"; ctx.beginPath(); ctx.ellipse(sx+16,sy+29,8,3.4,0,0,7); ctx.fill();
        ctx.fillStyle="#6B5326"; ctx.fillRect(sx+14,sy+19,4,10);
        ctx.fillStyle="#A8834C"; ctx.fillRect(sx+4,sy+6,24,14);
        ctx.fillStyle="#C9A567"; ctx.fillRect(sx+5,sy+7,22,5);
        ctx.fillStyle="#5A4227"; ctx.fillRect(sx+7,sy+13,18,2); ctx.fillRect(sx+7,sy+16,11,2);
      } else {
        const pal = NPC_PALS[(o.x*3+o.y+(o.idx||0))%NPC_PALS.length];
        const dir = o.kind==="trainer"? "down" : ["down","left","right","up"][(o.x+o.y)%4];
        const fr = o.kind==="trainer"? 0 : Math.floor(t/380 + o.x)%2;
        drawPerson(ctx, sx, sy, dir, fr, pal);
        if(o.kind==="trainer"){
          const fl = Math.sin(t*.004+o.x)*1.6;
          ctx.fillStyle="#E0A73C"; ctx.beginPath();
          ctx.moveTo(sx+16,sy-12+fl); ctx.lineTo(sx+21,sy-3+fl); ctx.lineTo(sx+11,sy-3+fl); ctx.closePath(); ctx.fill();
          ctx.fillStyle="#7A5A1E"; ctx.fillRect(sx+15,sy-4+fl,3,3);
        }
      }
    }});
  });
  drawables.push({y:P.y+0.5, fn:()=>drawPerson(ctx, Math.round(P.px-camX), Math.round(P.py-camY), P.dir, P.frame, PLAYER_PAL)});
  drawables.sort((a,b)=>a.y-b.y).forEach(d=>d.fn());

  // tall grass closes over whoever is standing in it
  const grassOver = (gx,gy)=>{
    if(tileAt(gx,gy)!==T.TALL) return;
    const bx = BLOCKS[REGION_ART[G.region].block];
    const sway = Math.sin(t*.0035+gx)*1.5;
    ctx.drawImage(IMG.floor, (bx[0]+REL.bush[0])*SRC, (bx[1]+REL.bush[1])*SRC, SRC, SRC,
      Math.round(gx*TILE-camX+sway), Math.round(gy*TILE-camY+8), TILE, TILE-8);
  };
  grassOver(P.x,P.y);
  if(P.moving) grassOver(P.tx,P.ty);

  drawMotes(ctx, w, h, t);

  // light and vignette
  if(!vignette || vigW!==w || vigH!==h){
    vignette = ctx.createRadialGradient(w*.42,h*.36,Math.min(w,h)*0.30,w/2,h/2,Math.max(w,h)*0.74);
    vignette.addColorStop(0,"rgba(255,246,214,.10)");
    vignette.addColorStop(.45,"rgba(0,0,0,0)");
    vignette.addColorStop(1,"rgba(0,0,0,.42)");
    vigW=w; vigH=h;
  }
  ctx.fillStyle=vignette; ctx.fillRect(0,0,w,h);
}

function step(){
  if(!busy && !P.moving && heldDir){
    const [dx,dy] = DIRV[heldDir];
    P.dir = heldDir;
    const nx = P.x+dx, ny = P.y+dy;
    if(!blocked(nx,ny)){ P.moving=true; P.prog=0; P.tx=nx; P.ty=ny; }
    else { bumpTile(nx,ny); }
  }
  if(P.moving){
    P.prog += 0.19;
    P.anim++;
    P.frame = Math.floor(P.anim/6)%2;
    const [dx,dy] = DIRV[P.dir];
    P.px = (P.x+dx*Math.min(1,P.prog))*TILE;
    P.py = (P.y+dy*Math.min(1,P.prog))*TILE;
    if(P.prog>=1){
      P.moving=false; P.x=P.tx; P.y=P.ty; P.px=P.x*TILE; P.py=P.y*TILE;
      G.x=P.x; G.y=P.y; G.facing=P.dir; G.steps++;
      onArrive();
    }
  } else P.frame = 0;
  draw();
  requestAnimationFrame(step);
}

function onArrive(){
  const t = tileAt(P.x,P.y);
  const o = objAt(P.x,P.y);
  if(o && o.kind==="item"){ pickUpItem(o); return; }
  if(t===T.GATE){ travel(1); return; }
  if(t===T.GATEBACK){ travel(-1); return; }
  // trainer spots you
  const m = genRegion(G.region);
  const spotter = m.objs.find(ob=>ob.kind==="trainer" && !objDone(ob) &&
    Math.abs(ob.x-P.x)+Math.abs(ob.y-P.y)===1);
  if(spotter){ startTrainerBattle(spotter); return; }
  if(t===T.TALL && Math.random()<0.13) wildEncounter();
  if(G.steps%40===0) saveGame();
}

function bumpTile(x,y){
  const t = tileAt(x,y);
  if(t===T.HEAL) return openHeal();
  if(t===T.SHOP) return openShop();
  if(t===T.GYM) return openGym();
}

/* ---------------- dialogue ---------------- */
function showDialog(opts){
  return new Promise(resolve=>{
    busy = true;
    $("dialogue").classList.add("show");
    $("dlgName").textContent = opts.name||"";
    $("dlgText").innerHTML = opts.text + (opts.choices? "" : ` <span class="blink">▾</span>`);
    const ch = $("dlgChoices"); ch.innerHTML="";
    const close = (val)=>{ $("dialogue").classList.remove("show"); busy=false; releaseKeys(); resolve(val); };
    if(opts.choices){
      opts.choices.forEach(c=>{
        const b=document.createElement("button"); b.textContent=c.label;
        b.onclick=()=>{ $("dialogue").classList.remove("show"); busy=false; releaseKeys(); resolve(c.value); };
        ch.appendChild(b);
      });
    } else {
      dialogResolver = ()=>close(true);
    }
  });
}
let dialogResolver = null;

async function sayLines(name, lines){
  for(const l of lines) await showDialog({name, text:l});
}

/* ---------------- interactions ---------------- */
function interact(){
  if(busy) return;
  const [dx,dy]=DIRV[P.dir];
  const nx=P.x+dx, ny=P.y+dy;
  const t = tileAt(nx,ny);
  if(t===T.HEAL) return openHeal();
  if(t===T.SHOP) return openShop();
  if(t===T.GYM) return openGym();
  const o = objAt(nx,ny);
  if(!o) return;
  if(o.kind==="npc"||o.kind==="sign") return showDialog({name:o.name, text:o.text});
  if(o.kind==="trainer") return startTrainerBattle(o);
  if(o.kind==="item") return pickUpItem(o);
}

function pickUpItem(o){
  G.picked[G.region+":i"+o.idx]=1;
  G.bag[o.item] = (G.bag[o.item]||0)+1;
  saveGame();
  return showDialog({name:"Found", text:`A crate by the path. Inside: <b>${o.item}</b>.`});
}

function wildEncounter(){
  const reg = REGIONS[G.region];
  let pool = reg.pool;
  if(G.region===7 && G.badges.every(Boolean)) pool = pool.concat(LEGENDARY);
  const sid = pool[Math.floor(Math.random()*pool.length)];
  const lv = reg.lv[0]+Math.floor(Math.random()*(reg.lv[1]-reg.lv[0]+1));
  const foe = makeCreature(sid, Math.max(2,lv));
  busy = true;
  startBattle({type:"wild", foe, onEnd:()=>{ busy=false; updateHUD(); }});
}

function startTrainerBattle(o){
  busy = true;
  showDialog({name:`${o.title} ${o.pname}`, text:o.taunt}).then(()=>{
    const team = o.team.map(t=>makeCreature(t.sid, t.lv));
    busy = true;
    startBattle({type:"trainer", team, trainer:o, onEnd:async (res)=>{
      if(res==="win"){ G.beaten[G.region+":t"+o.idx]=1; saveGame();
        await showDialog({name:`${o.title} ${o.pname}`, text:"Cleanly done. Take the route, it is yours."}); }
      busy=false; updateHUD();
    }});
  });
}

/* ---------------- buildings ---------------- */
async function openHeal(){
  const pick = await showDialog({name:"Rest Hollow",
    text:"Come in. I can see to your creatures, and the storage stand is against the back wall.",
    choices:[{label:"Rest my creatures",value:"heal"},{label:"Use the storage stand",value:"box"},{label:"Leave",value:0}]});
  if(pick==="heal"){
    healParty(); saveGame(); updateHUD(); sfx("level");
    await showDialog({name:"Rest Hollow", text:"All rested and back on their feet. Travel well."});
  } else if(pick==="box"){
    storagePanel();
  }
}

/* The storage stand: the only place a team can be rearranged. */
function storagePanel(){
  const teamHtml = G.party.map((c,i)=>
    `<button class="card" data-dep="${i}" style="border-left-color:${TYPE_COLOR[byId(c.sid).types[0]][0]}">${creatureCard(c)}</button>`).join("");
  const boxHtml = G.box.length
    ? G.box.map((c,i)=>`<button class="card" data-wit="${i}" style="border-left-color:${TYPE_COLOR[byId(c.sid).types[0]][0]}">${creatureCard(c)}</button>`).join("")
    : `<div class="muted">Storage is empty. Anything you catch with a full team waits here.</div>`;
  openPanel("Storage stand", `
    <div class="rowsplit" style="margin:2px 0 8px"><span>Travelling with you</span><span class="muted">${G.party.length} of 6</span></div>
    <div class="grid">${teamHtml}</div>
    <div class="rowsplit" style="margin:18px 0 8px"><span>In storage</span><span class="muted">${G.box.length} held</span></div>
    <div class="grid">${boxHtml}</div>`,
    [{label:"Done", fn:closePanel}],
    "Tap a creature to move it between your team and the stand.");
  $("panelBody").querySelectorAll("[data-dep]").forEach(b=>b.onclick=()=>{
    const i = +b.dataset.dep;
    if(G.party.length<=1){ toast("Keep at least one creature with you."); return; }
    const remaining = G.party.filter((c,k)=>k!==i && !isFainted(c)).length;
    if(remaining<1){ toast("You need one creature still standing."); return; }
    const [c] = G.party.splice(i,1); G.box.push(c);
    sfx("select"); saveGame(); storagePanel(); toast(`${cName(c)} went into storage.`);
  });
  $("panelBody").querySelectorAll("[data-wit]").forEach(b=>b.onclick=()=>{
    const i = +b.dataset.wit;
    if(G.party.length>=6){ toast("Your team is full. Store one first."); return; }
    const [c] = G.box.splice(i,1); G.party.push(c);
    sfx("select"); saveGame(); storagePanel(); toast(`${cName(c)} joined your team.`);
  });
}

async function openShop(){
  busy = true;
  const stockAll = Object.keys(ITEMS);
  const tier = Math.min(stockAll.length, 4 + G.region);
  const stock = stockAll.filter((k,i)=> i < tier || (ITEMS[k].price <= 400 + G.region*400));
  const render = ()=>{
    const body = stock.map(k=>{
      const it=ITEMS[k];
      return `<button class="card" data-buy="${k}" style="border-left-color:${it.cat==='ball'?'#E0A73C':'#6FBF73'}">
        <div class="meta"><div class="nm">${k}</div><div class="sub">${it.desc}</div></div>
        <div style="text-align:right"><div>¢${it.price}</div><div class="sub">have ${G.bag[k]||0}</div></div></button>`;
    }).join("");
    openPanel("Supply Store", `<div class="grid">${body}</div>`,
      [{label:"Sell something", fn:sellPanel},{label:"Leave", fn:closePanel}],
      `You carry ¢${G.money}.`);
    $("panelBody").querySelectorAll("[data-buy]").forEach(b=>{
      b.onclick=()=>{
        const k=b.dataset.buy;
        if(G.money < ITEMS[k].price){ toast("Not enough on you."); return; }
        G.money -= ITEMS[k].price; G.bag[k]=(G.bag[k]||0)+1; saveGame(); updateHUD(); render(); toast(`Bought ${k}.`);
      };
    });
  };
  render();
}
function sellPanel(){
  const itemKeys = Object.keys(G.bag).filter(k=>G.bag[k]>0);
  const body = itemKeys.length? itemKeys.map(k=>`<button class="card" data-sell="${k}">
      <div class="meta"><div class="nm">${k}</div><div class="sub">×${G.bag[k]} · sells for ¢${Math.floor(ITEMS[k].price/2)}</div></div></button>`).join("")
    : `<div class="muted">Nothing to sell.</div>`;
  openPanel("Sell", `<div class="grid">${body}</div>`, [{label:"Back", fn:openShop}], `You carry ¢${G.money}.`);
  $("panelBody").querySelectorAll("[data-sell]").forEach(b=>{
    b.onclick=()=>{ const k=b.dataset.sell; G.bag[k]--; if(!G.bag[k]) delete G.bag[k];
      G.money += Math.floor(ITEMS[k].price/2); saveGame(); updateHUD(); sellPanel(); };
  });
}

function gymTeam(ri){
  const reg = REGIONS[ri];
  const rng = mulberry(4242+ri*131);
  const minB = 200 + ri*34, maxB = 362 + ri*38;
  const onType = s => s.types.some(t=>reg.teamTypes.includes(t));
  let cands = SPECIES.filter(s => onType(s) && !LEGENDARY.includes(s.id)
    && (ri>=6 || !PSEUDO.includes(s.id))
    && s.bst>=minB && s.bst<=maxB
    && (ri<3 || !s.evoTo));
  if(cands.length<4) cands = SPECIES.filter(s=>onType(s) && !LEGENDARY.includes(s.id) && s.bst<=maxB+60 && (ri<3 || !s.evoTo));
  if(cands.length<4) cands = SPECIES.filter(s=>onType(s) && !LEGENDARY.includes(s.id));
  const size = Math.min(cands.length, ri<2?3 : ri<5?4 : 5);
  const picks = []; const used = new Set();
  let guard = 0;
  while(picks.length<size && guard++<400){
    const s = cands[Math.floor(rng()*cands.length)];
    if(used.has(s.id)) continue;
    used.add(s.id); picks.push(s);
  }
  picks.sort((a,b)=>a.bst-b.bst);             // the strongest is saved for last
  return picks.map((s,i)=>makeCreature(s.id, reg.gymLv + (i===picks.length-1?2:0)));
}

async function openGym(){
  const ri = G.region, reg = REGIONS[ri];
  if(G.badges[ri]){
    return showDialog({name:reg.leader, text:`Good to see you again. The ${reg.badge} is yours and the road east is open.`});
  }
  const go = await showDialog({name:`${reg.leader}, arena leader`,
    text:`So you have come for the ${reg.badge}. I lead with ${reg.teamTypes.join(" and ")}. Are your creatures ready?`,
    choices:[{label:"I'm ready",value:1},{label:"Give me time",value:0}]});
  if(!go) return;
  busy = true;
  const team = gymTeam(ri);
  startBattle({type:"gym", team, trainer:{title:"Arena leader", pname:reg.leader, reward:1200+ri*500},
    onEnd: async (res)=>{
      if(res==="win"){
        G.badges[ri]=true; G.gyms[ri]=1; sfx("badge");
        const gift = ["Strong Salve","Braided Snare","Master Salve","Ether Dust","Revival Ember","Warden Snare","Growth Tonic","Master Salve"][ri];
        G.bag[gift]=(G.bag[gift]||0)+3;
        saveGame(); updateHUD();
        await showDialog({name:reg.leader, text:`Clean work. The <b>${reg.badge}</b> is yours, along with three ${gift}. The gate east will let you through now.`});
        if(ri===7) await endingSequence();
      } else if(res==="loss"){
        await showDialog({name:reg.leader, text:"Come back when they have grown. I will be here."});
      }
      busy=false; updateHUD();
    }});
}

async function endingSequence(){
  await sayLines("Warden's Council", [
    "Eight badges. Nobody has brought them all in a single season for a long while.",
    "The high paths above Ashen Spire are open to you now. Something old is said to nest up there.",
    "Go and finish your field guide, warden."
  ]);
}

/* ---------------- travel ---------------- */
async function travel(dir){
  const target = G.region + dir;
  if(target<0){ nudgeBack(dir); return showDialog({name:"Gatekeeper", text:"Nothing back that way but the road you came in on."}); }
  if(target>7){ nudgeBack(dir); return showDialog({name:"Gatekeeper", text:"The high paths beyond the Spire stay shut. For now."}); }
  if(dir>0 && !G.badges[G.region]){
    nudgeBack(dir);
    return showDialog({name:"Gatekeeper", text:`The road east is for badge holders. Win the <b>${REGIONS[G.region].badge}</b> first.`});
  }
  G.region = target;
  const m = genRegion(target);
  if(dir>0){ P.x = 3; P.y = m.gateY; } else { P.x = MW-4; P.y = m.gateY; }
  P.px=P.x*TILE; P.py=P.y*TILE; G.x=P.x; G.y=P.y;
  updateHUD(); saveGame(); trimBuffers();
  await showDialog({name:"Now entering", text:`<b>${REGIONS[target].name}</b> — ${REGIONS[target].town} lies to the ${dir>0?"west":"east"}.`});
}
function nudgeBack(dir){
  P.x -= (dir>0?1:-1)*1; P.px=P.x*TILE; G.x=P.x;
}

/* ---------------- panels ---------------- */
function openPanel(title, html, buttons, subtitle){
  busy = true;
  $("panel").classList.remove("hidden");
  $("panelTitle").textContent = title;
  $("panelBody").innerHTML = (subtitle? `<div class="muted" style="margin-bottom:9px">${subtitle}</div>`:"") + html;
  const foot = $("panelFoot"); foot.innerHTML="";
  (buttons||[{label:"Close", fn:closePanel}]).forEach(b=>{
    const el=document.createElement("button"); el.className="btn"; el.textContent=b.label; el.onclick=b.fn;
    foot.appendChild(el);
  });
}
function closePanel(){ $("panel").classList.add("hidden"); busy=false; releaseKeys(); }
function toast(msg){
  const el=document.createElement("div");
  el.textContent=msg;
  el.style.cssText="position:absolute;left:50%;top:14%;transform:translateX(-50%);background:rgba(16,22,15,.94);border:2px solid var(--brass);padding:8px 14px;z-index:30;font-size:15px";
  $("world").appendChild(el);
  setTimeout(()=>el.remove(), 1200);
}

function mainMenu(){
  openPanel("Field kit", `<div class="grid" style="grid-template-columns:1fr 1fr">
    <button class="card" data-m="team"><div class="meta"><div class="nm">Team</div><div class="sub">${G.party.length} with you</div></div></button>
    <button class="card" data-m="bag"><div class="meta"><div class="nm">Bag</div><div class="sub">¢${G.money}</div></div></button>
    <button class="card" data-m="dex"><div class="meta"><div class="nm">Field guide</div><div class="sub">${Object.keys(G.caught).length}/150 recorded</div></div></button>
    <button class="card" data-m="box"><div class="meta"><div class="nm">Storage</div><div class="sub">${G.box.length} held at the hollow</div></div></button>
    <button class="card" data-m="save"><div class="meta"><div class="nm">Save</div><div class="sub">Keep your progress</div></div></button>
    <button class="card" data-m="badges"><div class="meta"><div class="nm">Badges</div><div class="sub">${G.badges.filter(Boolean).length} of 8</div></div></button>
    <button class="card" data-m="sound"><div class="meta"><div class="nm">Sound</div><div class="sub">${sfxOn?"on":"off"}</div></div></button>
  </div>`, [{label:"Close", fn:closePanel}]);
  $("panelBody").querySelectorAll("[data-m]").forEach(b=>{
    b.onclick=()=>({team:teamPanel,bag:bagPanel,dex:dexPanel,box:boxPanel,save:savePanel,badges:badgePanel,sound:()=>{toggleSound();mainMenu();}}[b.dataset.m])();
  });
}

function creatureCard(c, extra){
  const sp = byId(c.sid);
  const pct = Math.max(0,c.hp/c.stats.hp*100);
  const cls = pct<25?"low":pct<55?"mid":"";
  const need = xpForLevel(c.lv+1)-xpForLevel(c.lv), have = c.xp - xpForLevel(c.lv);
  return `<div class="sp">${spriteSVG(c.sid)}</div>
    <div class="meta"><div class="nm">${cName(c)} ${typeTags(sp.types)}</div>
    <div class="sub">Level ${c.lv} · ${Math.max(0,Math.ceil(c.hp))}/${c.stats.hp} hp ${c.status?"· "+STATUS_INFO[c.status].label:""}</div>
    <div class="hpbar ${cls}"><i style="width:${pct}%"></i></div>
    <div class="xpbar"><i style="width:${Math.max(0,Math.min(100,have/need*100))}%"></i></div>${extra||""}</div>`;
}

function teamPanel(){
  const body = G.party.map((c,i)=>`<button class="card" data-i="${i}" style="border-left-color:${TYPE_COLOR[byId(c.sid).types[0]][0]}">${creatureCard(c)}</button>`).join("");
  openPanel("Your team", `<div class="grid">${body}</div>`, [{label:"Back", fn:mainMenu},{label:"Close", fn:closePanel}]);
  $("panelBody").querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>creaturePanel(+b.dataset.i,"party"));
}
function boxPanel(){
  const body = G.box.length? G.box.map((c,i)=>`<button class="card" data-i="${i}">${creatureCard(c)}</button>`).join("")
    : `<div class="muted">Storage is empty. Anything you catch with a full team waits here.</div>`;
  openPanel("Storage", `<div class="grid">${body}</div>`, [{label:"Back", fn:mainMenu},{label:"Close", fn:closePanel}],
    "Swapping happens at the storage stand inside any rest hollow.");
  $("panelBody").querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>creaturePanel(+b.dataset.i,"box"));
}
function creaturePanel(i, where){
  const list = where==="party"? G.party : G.box;
  const c = list[i], sp = byId(c.sid);
  const s = c.stats;
  const moves = c.moves.map(m=>{
    const mv=MOVES[m.name];
    return `<div class="card" style="border-left-color:${TYPE_COLOR[mv.type][0]}">
      <div class="meta"><div class="nm">${m.name} ${typeTag(mv.type)}</div>
      <div class="sub">${mv.cat===2?"status move":(mv.cat===0?"physical":"special")+" · power "+mv.pow} · ${m.pp}/${m.max} pp</div></div></div>`;
  }).join("");
  const nextEvo = sp.evoTo? `<div class="sub">Evolves into ${byId(sp.evoTo).name} at level ${sp.evoLv}.</div>`:`<div class="sub">This is its final form.</div>`;
  const stat = (k,v)=>`<div class="rowsplit"><span class="muted">${k}</span><span>${v}</span></div>`;
  openPanel(cName(c), `
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:10px">
      <div style="width:110px;flex:0 0 110px">${spriteSVG(c.sid)}</div>
      <div style="flex:1">
        <div class="nm">${sp.name} ${typeTags(sp.types)}</div>
        <div class="sub">Level ${c.lv} · ${Math.max(0,Math.ceil(c.hp))}/${s.hp} hp</div>
        ${nextEvo}
      </div>
    </div>
    <div class="grid" style="grid-template-columns:1fr 1fr;margin-bottom:10px">
      ${stat("Attack",s.atk)}${stat("Defence",s.def)}${stat("Sp. attack",s.spa)}${stat("Sp. defence",s.spd)}${stat("Speed",s.spe)}${stat("Experience",c.xp)}
    </div>
    <div class="grid">${moves}</div>`,
    [ where==="party" && G.party.length>1 ? {label:"Lead with this one", fn:()=>{ const [x]=G.party.splice(i,1); G.party.unshift(x); saveGame(); teamPanel(); }} : null,
      {label:"Back", fn: where==="party"? teamPanel : boxPanel}
    ].filter(Boolean));
}

function bagPanel(){
  const itemKeys = Object.keys(G.bag).filter(k=>G.bag[k]>0);
  const body = itemKeys.length? itemKeys.map(k=>`<button class="card" data-u="${k}">
      <div class="meta"><div class="nm">${k} <span class="sub">×${G.bag[k]}</span></div><div class="sub">${ITEMS[k].desc}</div></div></button>`).join("")
    : `<div class="muted">Nothing in the bag. Supply stores sell the basics.</div>`;
  openPanel("Bag", `<div class="grid">${body}</div>`, [{label:"Back", fn:mainMenu},{label:"Close", fn:closePanel}], `You carry ¢${G.money}.`);
  $("panelBody").querySelectorAll("[data-u]").forEach(b=>b.onclick=()=>useItemField(b.dataset.u));
}
function useItemField(name){
  const it = ITEMS[name];
  if(it.cat==="ball"){ toast("Snares are only for wild creatures."); return; }
  const body = G.party.map((c,i)=>`<button class="card" data-t="${i}">${creatureCard(c)}</button>`).join("");
  openPanel(`Use ${name}`, `<div class="grid">${body}</div>`, [{label:"Back", fn:bagPanel}]);
  $("panelBody").querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{
    const c = G.party[+b.dataset.t];
    if(it.cat==="heal"){ if(isFainted(c)){ toast("It has fainted. Use a Revival Ember."); return; }
      if(c.hp>=c.stats.hp){ toast("Already at full health."); return; }
      c.hp=Math.min(c.stats.hp,c.hp+it.heal); }
    else if(it.cat==="cure"){ if(!c.status){ toast("Nothing to clear."); return; } c.status=null; }
    else if(it.cat==="revive"){ if(!isFainted(c)){ toast("It is still standing."); return; } c.hp=Math.ceil(c.stats.hp/2); }
    else if(it.cat==="pp"){ c.moves.forEach(m=>m.pp=Math.min(m.max,m.pp+10)); }
    else if(it.cat==="xp"){ const evs=giveXP(c, Math.max(1,xpForLevel(c.lv+1)-c.xp));
      evs.forEach(e=>{ if(e.type==="evolve") toast(`${e.from} became ${e.to}`); }); }
    G.bag[name]--; if(!G.bag[name]) delete G.bag[name];
    saveGame(); toast(`Used ${name}.`); bagPanel();
  });
}

function dexPanel(){
  const cells = SPECIES.map(sp=>{
    const seen = G.seen[sp.id], caught = G.caught[sp.id];
    if(!seen) return `<div class="card" style="opacity:.4"><div class="sp" style="display:flex;align-items:center;justify-content:center;font-family:var(--font-disp);font-size:9px">?</div>
      <div class="meta"><div class="nm">#${String(sp.id).padStart(3,"0")}</div><div class="sub">Not yet seen</div></div></div>`;
    return `<div class="card" style="border-left-color:${TYPE_COLOR[sp.types[0]][0]}">
      <div class="sp">${spriteSVG(sp.id)}</div>
      <div class="meta"><div class="nm">${sp.name} ${typeTags(sp.types)}</div>
      <div class="sub">#${String(sp.id).padStart(3,"0")} · ${caught?"in your guide":"seen in the field"}</div></div></div>`;
  }).join("");
  openPanel("Field guide", `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(230px,1fr))">${cells}</div>`,
    [{label:"Back", fn:mainMenu},{label:"Close", fn:closePanel}],
    `${Object.keys(G.caught).length} recorded, ${Object.keys(G.seen).length} seen, out of 150.`);
}

function badgePanel(){
  const rows = REGIONS.map((r,i)=>`<div class="card" style="border-left-color:${G.badges[i]?'#E0A73C':'#3D5240'}">
    <div class="sp" style="display:flex;align-items:center;justify-content:center">
      <span style="width:26px;height:26px;transform:rotate(45deg);background:${G.badges[i]?'#E0A73C':'#2b382c'};border:2px solid #1b2417"></span></div>
    <div class="meta"><div class="nm">${r.badge}</div>
    <div class="sub">${r.name} · ${r.leader} · ${r.teamTypes.join(" / ")}${G.badges[i]?" · earned":""}</div></div></div>`).join("");
  openPanel("Badges", `<div class="grid">${rows}</div>`, [{label:"Back", fn:mainMenu},{label:"Close", fn:closePanel}]);
}

function savePanel(){
  const ok = saveGame();
  openPanel("Save", `<div class="card"><div class="meta">
    <div class="nm">${ok? "Progress saved.":"This browser is blocking storage, so nothing was saved."}</div>
    <div class="sub">${G.party.length} creatures · ${G.badges.filter(Boolean).length} badges · ¢${G.money} · ${REGIONS[G.region].name}</div>
  </div></div>`, [{label:"Back", fn:mainMenu},{label:"Close", fn:closePanel}]);
}

/* ---------------- HUD ---------------- */
function updateHUD(){
  $("hudRegion").textContent = REGIONS[G.region].name;
  $("hudMoney").textContent = "¢ "+G.money;
  $("hudBadges").innerHTML = G.badges.map(b=>`<i class="${b?"on":""}"></i>`).join("");
}

/* ---------------- input ---------------- */
const DIRKEYS = {ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right",w:"up",s:"down",a:"left",d:"right",W:"up",S:"down",A:"left",D:"right"};
document.addEventListener("keydown", e=>{
  if(B){ if(e.key===" "||e.key==="Enter"){ skipFlag=true; e.preventDefault(); } return; }
  if(DIRKEYS[e.key]){ keys[DIRKEYS[e.key]]=true; heldDir=DIRKEYS[e.key]; e.preventDefault(); }
  if(e.key===" "||e.key==="Enter"){
    e.preventDefault();
    if(dialogResolver && $("dialogue").classList.contains("show")){ const r=dialogResolver; dialogResolver=null; r(); return; }
    if(!$("panel").classList.contains("hidden")) return;
    interact();
  }
  if(e.key==="m"||e.key==="M"){ if(!busy) mainMenu(); }
  if(e.key==="Escape"){ if(!$("panel").classList.contains("hidden")) closePanel(); }
});
document.addEventListener("keyup", e=>{
  if(DIRKEYS[e.key]){ keys[DIRKEYS[e.key]]=false;
    heldDir = ["up","down","left","right"].find(d=>keys[d]) || null; }
});
$("dialogue").addEventListener("click", ()=>{
  if(dialogResolver){ const r=dialogResolver; dialogResolver=null; r(); }
});
$("battleUI").addEventListener("click", e=>{ if(e.target===$("battleUI")||e.target===$("battleText")) skipFlag=true; });
$("menuBtn").onclick = ()=>{ if(!busy) mainMenu(); };

// touch pad
(function(){
  const isTouch = ("ontouchstart" in window) || navigator.maxTouchPoints>0;
  if(!isTouch) return;
  $("pad").classList.add("show"); $("actBtn").classList.add("show");
  $("pad").querySelectorAll("button").forEach(b=>{
    const d=b.dataset.dir;
    const on=e=>{ e.preventDefault(); keys[d]=true; heldDir=d; };
    const off=e=>{ e.preventDefault(); keys[d]=false; heldDir=["up","down","left","right"].find(k=>keys[k])||null; };
    b.addEventListener("touchstart",on,{passive:false}); b.addEventListener("touchend",off);
    b.addEventListener("touchcancel",off); b.addEventListener("mousedown",on); b.addEventListener("mouseup",off);
  });
  $("actBtn").addEventListener("click", e=>{
    e.preventDefault();
    if(B){ skipFlag=true; return; }
    if(dialogResolver && $("dialogue").classList.contains("show")){ const r=dialogResolver; dialogResolver=null; r(); return; }
    interact();
  });
})();

/* ---------------- boot ---------------- */
const STARTERS = [1,4,7];
function renderTitleSprites(){
  $("titleSprites").innerHTML = STARTERS.map(id=>spriteSVG(id)).join("");
}
function chooseStarter(){
  const body = STARTERS.map(id=>{
    const sp=byId(id);
    return `<button class="card" data-s="${id}" style="border-left-color:${TYPE_COLOR[sp.types[0]][0]}">
      <div class="sp">${spriteSVG(id)}</div>
      <div class="meta"><div class="nm">${sp.name} ${typeTags(sp.types)}</div>
      <div class="sub">${["A stubborn sprout that hardens into bark and stone.","All heat and no patience. Grows into a brawler.","Quiet and quick. Learns to move like weather."][STARTERS.indexOf(id)]}</div>
      <div class="sub">Becomes ${byId(byId(byId(id).evoTo).evoTo).name}.</div></div></button>`;
  }).join("");
  openPanel("Choose your first creature", `<div class="grid">${body}</div>`, [], "Warden Ilse has three in her care. Take one — the other two stay to be raised here.");
  $("panelBody").querySelectorAll("[data-s]").forEach(b=>{
    b.onclick = async ()=>{
      const id=+b.dataset.s;
      newGame(id);
      closePanel();
      $("title").classList.add("hidden");
      startWorld();
      await sayLines("Warden Ilse", [
        `A fine pick. ${byId(id).name} is yours now — look after it.`,
        "Eight regions, eight arenas, eight badges. That is the whole of it.",
        "Your guide is empty. One hundred and fifty creatures are out there. Go and find them."
      ]);
      saveGame();
    };
  });
}
function startWorld(){
  const m = genRegion(G.region);
  if(!G.x && !G.y){ G.x=m.spawn.x; G.y=m.spawn.y; }
  P.x=G.x; P.y=G.y; P.px=P.x*TILE; P.py=P.y*TILE; P.dir=G.facing||"down";
  resize(); updateHUD();
  if(!running){ running=true; requestAnimationFrame(step); }
}
$("newGameBtn").onclick = ()=>{
  if(hasSave() && !confirm("Starting a new expedition will overwrite your saved one. Continue?")) return;
  chooseStarter();
};
$("continueBtn").onclick = ()=>{
  if(!loadGame()){ toastTitle("No saved expedition found in this browser."); return; }
  $("title").classList.add("hidden");
  startWorld();
};
function toastTitle(msg){
  let el = document.getElementById("titleToast");
  if(!el){ el=document.createElement("div"); el.id="titleToast"; el.className="muted"; $("title").appendChild(el); }
  el.textContent = msg;
}
function fatal(msg){
  let el = document.getElementById("titleToast");
  if(!el){ el=document.createElement("div"); el.id="titleToast"; el.className="muted"; $("title").appendChild(el); }
  el.style.color = "#C2503F";
  el.textContent = "Something broke: " + msg;
}
window.addEventListener("error", e=>fatal(e.message));
(async function boot(){
  try{
    const bar = $("loadBar"), note = $("loadNote");
    await loadArt((done,total)=>{
      if(bar) bar.style.width = Math.round(done/total*100)+"%";
      if(note) note.textContent = `Loading art ${done}/${total}`;
    });
    $("loading").classList.add("hidden");
    $("title").classList.remove("hidden");
    renderTitleSprites();
    resize();
    requestAnimationFrame(resize);      // run again once layout has settled
    if(!hasSave()) $("continueBtn").disabled = true;
  }catch(err){
    $("loading").classList.add("hidden");
    $("title").classList.remove("hidden");
    fatal(err.message + " — if you opened this file directly, serve it over http instead.");
  }
})();
