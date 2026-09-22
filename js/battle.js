/* ============================================================
   Battle engine
   ============================================================ */
const $ = id => document.getElementById(id);
const wait = ms => new Promise(r=>setTimeout(r,ms));
const rand = (a,b)=>a+Math.random()*(b-a);
const chance = p => Math.random()*100 < p;
const STAGE_MULT = [.25,.28,.33,.4,.5,.66,1,1.5,2,2.5,3,3.5,4];

let B = null;      // live battle state
let skipFlag = false;

function stageMul(s){ return STAGE_MULT[Math.max(-6,Math.min(6,s))+6]; }
function freshStages(){ return {atk:0,def:0,spa:0,spd:0,spe:0,acc:0}; }

function effLabel(m){
  if(m===0) return "It had no effect at all.";
  if(m>=4) return "A devastating match-up.";
  if(m>1) return "It was very effective.";
  if(m<1) return "It was not very effective.";
  return "";
}

async function say(text, ms){
  $("battleText").innerHTML = text;
  const t = ms===undefined? 950 : ms;
  let waited = 0;
  while(waited < t){ if(skipFlag){ skipFlag=false; break; } await wait(40); waited+=40; }
}
function banner(text, ms){
  const b = $("battleBanner"); b.textContent = text; b.classList.add("show");
  setTimeout(()=>b.classList.remove("show"), ms||900);
}

/* ---------------- battle backdrop ---------------- */
function battleScene(){
  const A = REGION_ART[G.region];
  const hill1 = A.hill, hill2 = mix(A.hill, A.sky[1], .35);
  const svg =
   `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${A.sky[0]}"/><stop offset="70%" stop-color="${A.sky[1]}"/></linearGradient>
        <linearGradient id="gr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${A.ground}"/><stop offset="100%" stop-color="${mix(A.ground,"#000000",.40)}"/></linearGradient>
        <radialGradient id="sn"><stop offset="0%" stop-color="#FFF6DC" stop-opacity=".95"/>
          <stop offset="100%" stop-color="#FFF6DC" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="400" height="300" fill="url(#sk)"/>
      <circle cx="308" cy="52" r="46" fill="url(#sn)"/>
      <circle cx="308" cy="52" r="17" fill="#FFF3D2" opacity=".85"/>
      <path d="M0 150 q40 -38 84 -14 q34 18 62 -6 q40 -34 82 -6 q36 26 78 2 q36 -20 94 6 L400 300 L0 300 Z" fill="${hill2}" opacity=".75"/>
      <path d="M0 182 q54 -34 106 -8 q44 22 86 -4 q50 -30 104 0 q44 22 104 -2 L400 300 L0 300 Z" fill="${hill1}"/>
      <rect y="232" width="400" height="68" fill="url(#gr)"/>
      <path d="M0 232 q46 -12 92 2 q54 16 108 0 q56 -16 110 2 q44 12 90 -4 L400 246 L0 246 Z" fill="${A.ground}" opacity=".7"/>
    </svg>`;
  $("battle").style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  document.querySelectorAll(".plat").forEach(p=>{
    p.style.background = `radial-gradient(60% 100% at 50% 0%, ${mix(A.ground,"#FFFFFF",.20)}, ${mix(A.ground,"#000000",.34)})`;
  });
}

function renderSide(which){
  const c = which==="ally"? B.ally : B.foe;
  const slot = which==="ally"? $("allySlot") : $("foeSlot");
  const plate = which==="ally"? $("allyPlate") : $("foePlate");
  slot.innerHTML = spriteSVG(c.sid);
  const pct = Math.max(0, c.hp/c.stats.hp*100);
  const cls = pct<25? "low" : pct<55? "mid" : "";
  const st = c.status? `<span class="tag" style="background:${STATUS_INFO[c.status].col}">${STATUS_INFO[c.status].label.slice(0,4)}</span>`:"";
  plate.innerHTML = `<div class="t"><span>${cName(c)} ${st}</span><span class="lv">L${c.lv}</span></div>
    <div class="hpbar ${cls}"><i style="width:${pct}%"></i></div>
    ${which==="ally"? `<div class="rowsplit muted" style="font-size:13px"><span>${Math.max(0,Math.ceil(c.hp))}/${c.stats.hp}</span><span>${B.type==="wild"?"":""}</span></div>`:""}`;
}
function renderBattle(){ renderSide("ally"); renderSide("foe"); }

/* ---------------- damage ---------------- */
function calcDamage(atk, def, move, stA, stD){
  if(move.cat===2) return {dmg:0,mult:1,crit:false};
  const mult = eff(move.type, byId(def.sid).types);
  if(mult===0) return {dmg:0, mult:0, crit:false};
  const phys = move.cat===0;
  let A = (phys? atk.stats.atk : atk.stats.spa) * stageMul(phys? stA.atk : stA.spa);
  let D = (phys? def.stats.def : def.stats.spd) * stageMul(phys? stD.def : stD.spd);
  if(atk.status==="burn" && phys) A *= .55;
  const crit = chance(move.eff==="hicrit"? 22 : 6);
  const stab = byId(atk.sid).types.includes(move.type)? 1.5 : 1;
  let d = (((2*atk.lv/5+2) * move.pow * A/D)/50 + 2);
  d *= stab * mult * rand(.85,1) * (crit?1.65:1);
  return {dmg: Math.max(1, Math.round(d)), mult, crit};
}

async function animateAttack(which){
  const slot = which==="ally"? $("allySlot") : $("foeSlot");
  const dir = which==="ally"? 1 : -1;
  slot.style.transition="transform .12s"; 
  slot.style.transform = `translate(${dir*26}px, ${-dir*14}px)`;
  await wait(130);
  slot.style.transform = "";
  await wait(110);
}
async function animateHit(which, mult){
  sfx(mult>1?"hit2":"hit");
  const slot = which==="ally"? $("allySlot") : $("foeSlot");
  slot.classList.add(mult>1? "shake":"flash");
  await wait(340);
  slot.classList.remove("shake"); slot.classList.remove("flash");
}

/* ---------------- controls ---------------- */
function clearControls(){ $("battleControls").innerHTML = ""; }
function controlButtons(list){
  const wrap = document.createElement("div");
  wrap.className = "actions";
  list.forEach(o=>{
    const b = document.createElement("button");
    b.className="btn"; b.textContent=o.label; if(o.disabled) b.disabled=true;
    b.onclick = o.onClick; wrap.appendChild(b);
  });
  $("battleControls").innerHTML=""; $("battleControls").appendChild(wrap);
}

function playerAction(){
  return new Promise(resolve=>{
    const mainMenu = ()=>{
      $("battleText").textContent = `What will ${cName(B.ally)} do?`;
      controlButtons([
        {label:"Fight", onClick:fightMenu},
        {label:"Bag", onClick:()=>bagMenu(resolve)},
        {label:"Team", onClick:()=>teamMenu(resolve)},
        {label: B.type==="wild"? "Run":"Forfeit", onClick:()=>{
          if(B.type==="wild") resolve({kind:"run"});
          else { $("battleText").textContent="There is no walking away from a trainer match."; setTimeout(mainMenu,900); }
        }}
      ]);
    };
    const fightMenu = ()=>{
      const wrap = document.createElement("div");
      wrap.className="moves";
      B.ally.moves.forEach(m=>{
        const mv = MOVES[m.name];
        const b = document.createElement("button");
        b.className="movebtn";
        b.innerHTML = `<div class="mn"><span>${mv.name}</span>${typeTag(mv.type)}</div>
                       <div class="mp">${mv.cat===2?"status":"power "+mv.pow} · ${m.pp}/${m.max} pp</div>`;
        if(m.pp<=0) b.disabled=true;
        b.onclick=()=>resolve({kind:"move", move:m});
        wrap.appendChild(b);
      });
      const back = document.createElement("button");
      back.className="btn"; back.style.marginTop="7px"; back.textContent="Back";
      back.onclick = mainMenu;
      $("battleControls").innerHTML=""; $("battleControls").appendChild(wrap); $("battleControls").appendChild(back);
    };
    const bagMenu = (res)=>{
      const items = Object.keys(G.bag).filter(k=>G.bag[k]>0);
      const wrap = document.createElement("div");
      wrap.className="moves";
      if(!items.length){ wrap.innerHTML = `<div class="muted">Your bag is empty.</div>`; }
      items.forEach(k=>{
        const b=document.createElement("button"); b.className="movebtn";
        b.innerHTML=`<div class="mn"><span>${k}</span><span class="mp">×${G.bag[k]}</span></div><div class="mp">${ITEMS[k].desc}</div>`;
        if(ITEMS[k].cat==="ball" && B.type!=="wild") b.disabled=true;
        b.onclick=()=>res({kind:"item", item:k});
        wrap.appendChild(b);
      });
      const back=document.createElement("button"); back.className="btn"; back.style.marginTop="7px"; back.textContent="Back"; back.onclick=mainMenu;
      $("battleControls").innerHTML=""; $("battleControls").appendChild(wrap); $("battleControls").appendChild(back);
    };
    const teamMenu = (res)=>{
      const wrap=document.createElement("div"); wrap.className="moves";
      G.party.forEach((c,i)=>{
        const b=document.createElement("button"); b.className="movebtn";
        b.innerHTML=`<div class="mn"><span>${cName(c)}</span><span class="mp">L${c.lv}</span></div>
          <div class="mp">${Math.max(0,Math.ceil(c.hp))}/${c.stats.hp} hp ${c.status?"· "+STATUS_INFO[c.status].label:""}</div>`;
        if(isFainted(c) || c===B.ally) b.disabled=true;
        b.onclick=()=>res({kind:"swap", idx:i});
        wrap.appendChild(b);
      });
      const back=document.createElement("button"); back.className="btn"; back.style.marginTop="7px"; back.textContent="Back"; back.onclick=mainMenu;
      $("battleControls").innerHTML=""; $("battleControls").appendChild(wrap); $("battleControls").appendChild(back);
    };
    mainMenu();
  });
}

function forcedSwitch(){
  return new Promise(resolve=>{
    $("battleText").textContent = "Send out which creature?";
    const wrap=document.createElement("div"); wrap.className="moves";
    G.party.forEach((c,i)=>{
      const b=document.createElement("button"); b.className="movebtn";
      b.innerHTML=`<div class="mn"><span>${cName(c)}</span><span class="mp">L${c.lv}</span></div>
        <div class="mp">${Math.max(0,Math.ceil(c.hp))}/${c.stats.hp} hp</div>`;
      if(isFainted(c)) b.disabled=true;
      b.onclick=()=>resolve(i);
      wrap.appendChild(b);
    });
    $("battleControls").innerHTML=""; $("battleControls").appendChild(wrap);
  });
}

/* ---------------- move resolution ---------------- */
async function useMove(attacker, defender, side, moveSlot){
  const mv = MOVES[moveSlot.name];
  moveSlot.pp--;
  const stA = side==="ally"? B.stA : B.stF;
  const stD = side==="ally"? B.stF : B.stA;
  await say(`${cName(attacker)} used ${mv.name}.`);
  const accRoll = mv.acc * stageMul(stA.acc||0);
  if(!chance(Math.min(100, accRoll))){ await say(`It missed.`); return; }
  await animateAttack(side);

  if(mv.cat===2){
    await applyEffect(mv, attacker, defender, side, true);
    renderBattle(); return;
  }
  const {dmg, mult, crit} = calcDamage(attacker, defender, mv, stA, stD);
  if(mult===0){ await say(effLabel(0)); return; }
  defender.hp = Math.max(0, defender.hp - dmg);
  await animateHit(side==="ally"?"foe":"ally", mult);
  renderBattle();
  if(crit) await say("A critical hit.", 700);
  const lab = effLabel(mult); if(lab) await say(lab, 750);

  if(mv.eff==="drain"){
    const back = Math.round(dmg*0.5);
    attacker.hp = Math.min(attacker.stats.hp, attacker.hp+back);
    renderBattle(); await say(`${cName(attacker)} drained ${back} health.`, 750);
  }
  if(mv.eff==="recoil"){
    const rc = Math.round(dmg*0.28);
    attacker.hp = Math.max(0, attacker.hp-rc);
    renderBattle(); await say(`${cName(attacker)} took ${rc} in recoil.`, 750);
  }
  if(defender.hp>0 && mv.eff && mv.chance && chance(mv.chance)) await applyEffect(mv, attacker, defender, side, false);
  renderBattle();
}

async function applyEffect(mv, attacker, defender, side, isStatusMove){
  const e = mv.eff;
  const stA = side==="ally"? B.stA : B.stF;
  const stD = side==="ally"? B.stF : B.stA;
  if(e && /^(atk|def|spa|spd|spe|acc)[+-]$/.test(e)){
    const key = e.slice(0,3), up = e.endsWith("+");
    const target = up? stA : stD, who = up? attacker : defender;
    const before = target[key];
    target[key] = Math.max(-6, Math.min(6, target[key] + (up?1:-1)));
    if(target[key]===before) await say(`${cName(who)}'s ${key} will not shift further.`, 750);
    else await say(`${cName(who)}'s ${key} ${up?"rose":"fell"}.`, 750);
    return;
  }
  if(e==="heal"){
    const amt = Math.round(attacker.stats.hp*0.5);
    attacker.hp = Math.min(attacker.stats.hp, attacker.hp+amt);
    renderBattle(); await say(`${cName(attacker)} recovered.`, 800); return;
  }
  if(["poison","burn","para","sleep","freeze"].includes(e)){
    if(defender.status){ if(isStatusMove) await say("It had no effect.", 700); return; }
    const dt = byId(defender.sid).types;
    if(e==="poison" && (dt.includes("Venom")||dt.includes("Metal"))){ if(isStatusMove) await say("It is immune to poison.",700); return; }
    if(e==="burn" && dt.includes("Ember")){ if(isStatusMove) await say("It cannot be burned.",700); return; }
    if(e==="freeze" && dt.includes("Frost")){ if(isStatusMove) await say("It cannot be frozen.",700); return; }
    if(e==="para" && dt.includes("Volt")){ if(isStatusMove) await say("It shrugs off the current.",700); return; }
    defender.status = e; defender.statusTurns = e==="sleep"? 1+Math.floor(Math.random()*3) : 0;
    renderBattle();
    await say(`${cName(defender)} is ${STATUS_INFO[e].label.toLowerCase()}.`, 850);
    return;
  }
  if(e==="flinch" && side==="ally") B.foeFlinch = true;
  if(e==="flinch" && side==="foe") B.allyFlinch = true;
  if(e==="confuse") await say(`${cName(defender)} is reeling.`, 700);
}

async function startOfTurnStatus(c, side){
  if(!c.status) return true;
  if(c.status==="sleep"){
    if(c.statusTurns<=0){ c.status=null; renderBattle(); await say(`${cName(c)} woke up.`); return true; }
    c.statusTurns--; await say(`${cName(c)} is fast asleep.`); return false;
  }
  if(c.status==="freeze"){
    if(chance(22)){ c.status=null; renderBattle(); await say(`${cName(c)} thawed out.`); return true; }
    await say(`${cName(c)} is frozen solid.`); return false;
  }
  if(c.status==="para" && chance(25)){ await say(`${cName(c)} is stiff with static.`); return false; }
  return true;
}
async function endOfTurnStatus(c){
  if(!c.status || c.hp<=0) return;
  if(c.status==="poison"||c.status==="burn"){
    const d = Math.max(1, Math.round(c.stats.hp/16));
    c.hp = Math.max(0, c.hp-d); renderBattle();
    await say(`${cName(c)} is hurt by ${c.status==="burn"?"its burn":"poison"}.`, 800);
  }
}

/* ---------------- foe AI ---------------- */
function foeChooseMove(){
  const foe = B.foe, ally = B.ally;
  const usable = foe.moves.filter(m=>m.pp>0);
  if(!usable.length) return {name:"Tackle", pp:1, max:1};
  let best=null, bestScore=-1;
  usable.forEach(m=>{
    const mv = MOVES[m.name];
    let score;
    if(mv.cat===2){ score = 18 + Math.random()*14; if(foe.hp<foe.stats.hp*0.4 && mv.eff==="heal") score+=60; }
    else {
      const {dmg} = calcDamage(foe, ally, mv, B.stF, B.stA);
      score = dmg * (eff(mv.type, byId(ally.sid).types)>=2?1.15:1) + Math.random()*8;
    }
    if(score>bestScore){ bestScore=score; best=m; }
  });
  return best;
}

/* ---------------- catching ---------------- */
async function tryCatch(itemName){
  const ball = ITEMS[itemName];
  G.bag[itemName]--; if(G.bag[itemName]<=0) delete G.bag[itemName];
  const foe = B.foe, sp = byId(foe.sid);
  await say(`You threw a ${itemName}.`, 700);
  const statusBonus = foe.status? (["sleep","freeze"].includes(foe.status)?2:1.5) : 1;
  const a = ((3*foe.stats.hp - 2*foe.hp) / (3*foe.stats.hp)) * sp.catchRate * ball.rate * statusBonus;
  const p = Math.min(1, a/255);
  let shakes = 0;
  const perShake = Math.min(0.97, Math.max(0.12, Math.pow(p,0.42)));
  for(let i=0;i<4;i++){ if(Math.random() < perShake) shakes++; else break; }
  const caught = shakes>=4;
  for(let i=0;i<Math.max(1,Math.min(shakes,3));i++){
    $("foeSlot").style.transform = `translateX(${i%2?-9:9}px) scale(${1-0.1*(i+1)})`;
    sfx("shake");
    await say("...", 520);
  }
  $("foeSlot").style.transform="";
  if(caught){
    $("foeSlot").innerHTML="";
    sfx("catch");
    await say(`${sp.name} was caught.`, 1100);
    G.seen[foe.sid]=1; G.caught[foe.sid]=1;
    const where = addToParty(foe);
    await say(where==="party"? `${sp.name} joined your team.` : `Your team is full, so ${sp.name} was sent to storage at the rest hollow.`, 1400);
    return true;
  }
  await say(`It broke free.`, 900);
  return false;
}

/* ---------------- the battle ---------------- */
async function startBattle(opts){
  // opts: {type, foe|team, trainer, onEnd}
  const partyIdx = firstAlive();
  B = {
    type: opts.type,
    team: opts.team || [opts.foe],
    foeIdx: 0,
    trainer: opts.trainer || null,
    ally: G.party[partyIdx],
    allyIdx: partyIdx,
    stA: freshStages(), stF: freshStages(),
    foeFlinch:false, allyFlinch:false,
    participants: new Set([partyIdx])
  };
  B.foe = B.team[0];
  G.seen[B.foe.sid]=1;
  battleScene();
  $("battle").classList.add("show");
  $("dialogue").classList.remove("show");
  clearControls(); renderBattle();
  [$("allySlot"),$("foeSlot")].forEach(s=>{ s.classList.remove("entering"); void s.offsetWidth; s.classList.add("entering"); });
  if(B.type==="wild") await say(`A wild ${cName(B.foe)} appeared.`, 1000);
  else await say(`${B.trainer.title} ${B.trainer.pname} wants to battle.`, 1200);
  await say(`Go, ${cName(B.ally)}.`, 900);

  let result = "";
  let turnCount = 0;
  while(true){
    if(++turnCount > 80){ await say("Neither side can finish this. You both back off.", 1400); result="draw"; break; }
    const action = await playerAction();
    clearControls();

    /* --- item / swap / run happen before the foe's move --- */
    if(action.kind==="item"){
      const it = ITEMS[action.item];
      if(it.cat==="ball"){
        const done = await tryCatch(action.item);
        if(done){ result="caught"; break; }
      } else {
        await useItemInBattle(action.item);
      }
    } else if(action.kind==="swap"){
      await say(`Come back, ${cName(B.ally)}.`, 700);
      B.allyIdx = action.idx; B.ally = G.party[action.idx];
      B.participants.add(action.idx);
      B.stA = freshStages();
      renderBattle();
      await say(`Go, ${cName(B.ally)}.`, 800);
    } else if(action.kind==="run"){
      const odds = 45 + (B.ally.stats.spe - B.foe.stats.spe);
      if(chance(Math.max(30, Math.min(95, odds)))){ await say("You slipped away.", 900); result="ran"; break; }
      await say("You could not get clear.", 900);
    }

    /* --- turn order --- */
    const allyMove = action.kind==="move"? action.move : null;
    const foeMove = foeChooseMove();
    const allyPri = allyMove && MOVES[allyMove.name].eff==="priority"? 1:0;
    const foePri  = MOVES[foeMove.name].eff==="priority"? 1:0;
    let allySpe = B.ally.stats.spe*stageMul(B.stA.spe); if(B.ally.status==="para") allySpe*=.5;
    let foeSpe  = B.foe.stats.spe*stageMul(B.stF.spe);  if(B.foe.status==="para") foeSpe*=.5;
    const allyFirst = allyPri!==foePri? allyPri>foePri : (allySpe===foeSpe? Math.random()<.5 : allySpe>foeSpe);

    const doAlly = async ()=>{
      if(!allyMove || B.ally.hp<=0) return;
      if(B.allyFlinch){ B.allyFlinch=false; await say(`${cName(B.ally)} flinched.`); return; }
      if(!(await startOfTurnStatus(B.ally,"ally"))) return;
      await useMove(B.ally, B.foe, "ally", allyMove);
    };
    const doFoe = async ()=>{
      if(B.foe.hp<=0) return;
      if(B.foeFlinch){ B.foeFlinch=false; await say(`${cName(B.foe)} flinched.`); return; }
      if(!(await startOfTurnStatus(B.foe,"foe"))) return;
      await useMove(B.foe, B.ally, "foe", foeMove);
    };
    if(allyFirst){ await doAlly(); if(B.foe.hp>0) await doFoe(); }
    else { await doFoe(); if(B.ally.hp>0) await doAlly(); }

    /* --- faint checks --- */
    if(B.foe.hp<=0){
      $("foeSlot").style.transition="transform .4s,opacity .4s";
      $("foeSlot").style.transform="translateY(40px)"; $("foeSlot").style.opacity="0";
      sfx("faint");
      await say(`${cName(B.foe)} fainted.`, 900);
      $("foeSlot").style.transition=""; $("foeSlot").style.transform=""; $("foeSlot").style.opacity="1";
      const gained = xpFromFoe(B.foe, B.type!=="wild");
      for(const i of B.participants){
        const c = G.party[i]; if(!c || isFainted(c)) continue;
        const amt = i===B.allyIdx? gained : Math.round(gained*0.5);
        const evs = giveXP(c, amt);
        if(i===B.allyIdx) await say(`${cName(c)} gained ${amt} experience.`, 800);
        for(const e of evs){
          if(e.type==="level"){ renderBattle(); (sfx("level"),banner(`${cName(c)} reached level ${e.lv}`)); await say(`${cName(c)} grew to level ${e.lv}.`, 950); }
          if(e.type==="move") await say(`${cName(c)} learned ${e.name}.`, 950);
          if(e.type==="movefull") await learnMovePrompt(c, e.name);
          if(e.type==="evolve"){ renderBattle(); banner(`${e.from} became ${e.to}`,1400); await say(`${e.from} evolved into ${e.to}.`, 1400); }
        }
      }
      B.foeIdx++;
      if(B.foeIdx < B.team.length){
        B.foe = B.team[B.foeIdx]; B.stF = freshStages(); G.seen[B.foe.sid]=1;
        renderBattle();
        await say(`${B.trainer.title} ${B.trainer.pname} sent out ${cName(B.foe)}.`, 1000);
      } else { result="win"; break; }
    }
    if(B.ally.hp<=0){
      await say(`${cName(B.ally)} fainted.`, 1000);
      if(!partyAlive()){ result="loss"; break; }
      const idx = await forcedSwitch();
      B.allyIdx=idx; B.ally=G.party[idx]; B.participants.add(idx); B.stA=freshStages();
      renderBattle(); await say(`Go, ${cName(B.ally)}.`, 800);
      continue;
    }
    await endOfTurnStatus(B.ally); await endOfTurnStatus(B.foe);
    if(B.ally.hp<=0){
      await say(`${cName(B.ally)} fainted.`, 1000);
      if(!partyAlive()){ result="loss"; break; }
      const idx = await forcedSwitch();
      B.allyIdx=idx; B.ally=G.party[idx]; B.participants.add(idx); B.stA=freshStages();
      renderBattle(); await say(`Go, ${cName(B.ally)}.`, 800);
    }
    if(B.foe.hp<=0) continue;
  }

  if(result==="win" && B.trainer){
    G.money += B.trainer.reward;
    await say(`${B.trainer.title} ${B.trainer.pname} handed over ¢${B.trainer.reward}.`, 1200);
  }
  if(result==="loss"){
    const lost = Math.min(G.money, 200*(G.region+1));
    G.money -= lost;
    await say(`You are out of creatures. You hurried back to town and paid ¢${lost} in care.`, 1600);
    healParty();
  }
  clearControls();
  $("battle").classList.remove("show");
  B = null;
  saveGame();
  if(opts.onEnd) opts.onEnd(result);
  return result;
}

async function useItemInBattle(name){
  const it = ITEMS[name];
  if(it.cat==="heal"){
    const c = B.ally;
    if(c.hp>=c.stats.hp){ await say("It is already at full health.", 900); return; }
    G.bag[name]--; if(!G.bag[name]) delete G.bag[name];
    c.hp = Math.min(c.stats.hp, c.hp+it.heal); renderBattle();
    await say(`${cName(c)} recovered ${it.heal} health.`, 950);
  } else if(it.cat==="cure"){
    const c=B.ally;
    if(!c.status){ await say("Nothing to clear.", 900); return; }
    G.bag[name]--; if(!G.bag[name]) delete G.bag[name];
    c.status=null; c.statusTurns=0; renderBattle();
    await say(`${cName(c)} shook it off.`, 950);
  } else if(it.cat==="pp"){
    G.bag[name]--; if(!G.bag[name]) delete G.bag[name];
    B.ally.moves.forEach(m=>m.pp=Math.min(m.max,m.pp+10));
    await say(`${cName(B.ally)}'s moves were restored.`, 950);
  } else {
    await say("Not now.", 700);
  }
}

function learnMovePrompt(c, newMove){
  return new Promise(resolve=>{
    $("battleText").innerHTML = `${cName(c)} wants to learn <b>${newMove}</b> (${MOVES[newMove].type}, ${MOVES[newMove].cat===2?"status":"power "+MOVES[newMove].pow}). Replace which move?`;
    const wrap=document.createElement("div"); wrap.className="moves";
    c.moves.forEach((m,i)=>{
      const mv=MOVES[m.name];
      const b=document.createElement("button"); b.className="movebtn";
      b.innerHTML=`<div class="mn"><span>${m.name}</span>${typeTag(mv.type)}</div><div class="mp">${mv.cat===2?"status":"power "+mv.pow}</div>`;
      b.onclick=()=>{ c.moves[i]={name:newMove,pp:MOVES[newMove].pp,max:MOVES[newMove].pp}; clearControls(); resolve(); };
      wrap.appendChild(b);
    });
    const skip=document.createElement("button"); skip.className="btn"; skip.style.marginTop="7px";
    skip.textContent=`Keep the current four`; skip.onclick=()=>{ clearControls(); resolve(); };
    $("battleControls").innerHTML=""; $("battleControls").appendChild(wrap); $("battleControls").appendChild(skip);
  });
}
