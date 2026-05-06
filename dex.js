// ── 도감 데이터 모델 + 화면 ──
// v0.5 풀스펙: state / captureCount / failStack / candy / biggest / smallest / firstCaught
// monster_table.js, ui.js 다음에 로드 (showScreen / applyPokemonBg 사용)

const DEX_KEY='hexPuzzleDex';
const DEX_LEGACY_KEY='hexPuzzleDexCaught';
const CANDY_KEY='hexPuzzleCandy';
const SKIN_NEW_KEY='hexPuzzleSkinNew'; // 신규 해금 미확인 트래커 (배열)

// ── 사탕 (공통 통화, v0.5.1) ──
function getCandy(){
  const v=Number(localStorage.getItem(CANDY_KEY)||0);
  return Number.isFinite(v)?v:0;
}
function setCandy(n){
  localStorage.setItem(CANDY_KEY,String(Math.max(0,n|0)));
}
function addCandy(amount){
  setCandy(getCandy()+(amount|0));
  return getCandy();
}

// ── 신규 해금 트래커 (스킨창 레드닷용) ──
// 도감에서 첫 captured로 전환된 id를 push, 사용자가 스킨창에서 해당 마리 확인 시 remove.
function loadSkinNew(){
  try{
    const raw=JSON.parse(localStorage.getItem(SKIN_NEW_KEY)||'null');
    if(Array.isArray(raw)) return raw;
  }catch(e){}
  return [];
}
function saveSkinNew(arr){
  localStorage.setItem(SKIN_NEW_KEY,JSON.stringify(Array.from(new Set(arr))));
}
function markSkinNew(id){
  const arr=loadSkinNew();
  if(!arr.includes(id)){ arr.push(id); saveSkinNew(arr); }
}
function clearSkinNew(id){
  const arr=loadSkinNew().filter(x=>x!==id);
  saveSkinNew(arr);
}
function hasSkinNew(id){
  return loadSkinNew().includes(id);
}
function getSkinNewCount(){
  return loadSkinNew().length;
}

const DEX_STATE={
  UNDISCOVERED:'undiscovered',
  DISCOVERED:  'discovered',
  CAPTURED:    'captured',
  EVOLVED:     'evolved',
};

// ── 저장/로드 ──
function loadDex(){
  try{
    const raw=JSON.parse(localStorage.getItem(DEX_KEY)||'null');
    if(raw&&typeof raw==='object') return raw;
  }catch(e){}
  return {};
}
function saveDex(dex){
  localStorage.setItem(DEX_KEY,JSON.stringify(dex));
}

function defaultEntry(id){
  return {
    id,
    state:DEX_STATE.UNDISCOVERED,
    captureCount:0,
    failStack:0,
    // candy는 글로벌 (CANDY_KEY) — 종별 필드 제거 (v0.5.1)
    biggest:null,    // { height, weight, encounterDate }
    smallest:null,   // { height, weight, encounterDate }
    firstCaught:null,
  };
}

function getDexEntry(id){
  const dex=loadDex();
  return dex[id]||defaultEntry(id);
}

function setDexEntry(id,entry){
  const dex=loadDex();
  dex[id]=entry;
  saveDex(dex);
}

// ── 상태 변경 액션 ──
function markDiscovered(id){
  const e=getDexEntry(id);
  if(e.state===DEX_STATE.UNDISCOVERED) e.state=DEX_STATE.DISCOVERED;
  setDexEntry(id,e);
  return e;
}

// 포획 성공: state=captured, captureCount+1, 글로벌 사탕+2, failStack=0, biggest/smallest 갱신, firstCaught 세팅
function captureNow(id,opts){
  opts=opts||{};
  const e=getDexEntry(id);
  const wasUnseen=(e.state===DEX_STATE.UNDISCOVERED||e.state===DEX_STATE.DISCOVERED);
  e.state=(e.state===DEX_STATE.EVOLVED)?DEX_STATE.EVOLVED:DEX_STATE.CAPTURED;
  e.captureCount=(e.captureCount|0)+1;
  addCandy(2); // 공통 사탕 풀에 +2
  e.failStack=0;
  if(!e.firstCaught) e.firstCaught=Date.now();
  // 첫 captured 전환이면 스킨창 레드닷 표시 큐에 추가
  if(wasUnseen) markSkinNew(id);

  // 키/무게 — opts로 전달되지 않으면 monster_table 기준치 사용
  const meta=(typeof getMonsterMeta==='function')?getMonsterMeta(id):null;
  const h=opts.height!=null?opts.height:(meta&&meta.height_m)||0;
  const w=opts.weight!=null?opts.weight:(meta&&meta.weight_kg)||0;
  const rec={height:h,weight:w,encounterDate:Date.now()};
  if(!e.biggest||h>e.biggest.height) e.biggest=rec;
  if(!e.smallest||h<e.smallest.height) e.smallest=rec;

  setDexEntry(id,e);
  return e;
}

function incFailStack(id){
  const e=getDexEntry(id);
  if(e.state===DEX_STATE.UNDISCOVERED) e.state=DEX_STATE.DISCOVERED;
  e.failStack=(e.failStack|0)+1;
  setDexEntry(id,e);
  return e;
}

// (구버전 종별 사탕 함수 제거 — 글로벌 addCandy/getCandy 사용)

// ── 어댑터 (lobby.js 등 외부 사용) ──
function getCapturedCount(){
  const dex=loadDex();
  let n=0;
  for(const k in dex){
    const s=dex[k]&&dex[k].state;
    if(s===DEX_STATE.CAPTURED||s===DEX_STATE.EVOLVED) n++;
  }
  return n;
}
function getCapturedIds(){
  const dex=loadDex();
  const out=[];
  for(const k in dex){
    const s=dex[k]&&dex[k].state;
    if(s===DEX_STATE.CAPTURED||s===DEX_STATE.EVOLVED) out.push(parseInt(k,10));
  }
  return out.sort((a,b)=>a-b);
}

// ── 레거시 마이그레이션 ──
// hexPuzzleDexCaught([id,...]) → hexPuzzleDex({id:{state:captured,...}})
// 1회 실행 후 legacy 키는 보존(롤백 안전망), saveDex로 신키 정착
function migrateLegacyDex(){
  // 1) 종별 candy → 글로벌 candy 합산 (이전 도감 스펙에서 entry.candy 보유 케이스)
  const existing=loadDex();
  let mergedCandy=0, dirty=false;
  for(const k in existing){
    const e=existing[k];
    if(e&&typeof e.candy==='number'){
      mergedCandy+=e.candy|0;
      delete e.candy;
      dirty=true;
    }
  }
  if(mergedCandy>0) setCandy(getCandy()+mergedCandy);
  if(dirty) saveDex(existing);

  // 2) 신키 이미 있으면 더 마이그레이션 안 함
  const newRaw=localStorage.getItem(DEX_KEY);
  if(newRaw) return;

  // 3) 레거시 배열(hexPuzzleDexCaught) → 풀스펙 객체
  let legacy=null;
  try{ legacy=JSON.parse(localStorage.getItem(DEX_LEGACY_KEY)||'null'); }catch(e){}
  if(!Array.isArray(legacy)||legacy.length===0){
    saveDex({}); // 빈 dex라도 신키로 lock — 다음 호출은 마이그레이션 안 탐
    return;
  }
  const dex={};
  const now=Date.now();
  for(const id of legacy){
    if(typeof id!=='number'||id<1||id>DEX_TOTAL) continue;
    const meta=(typeof getMonsterMeta==='function')?getMonsterMeta(id):null;
    const h=(meta&&meta.height_m)||0, w=(meta&&meta.weight_kg)||0;
    dex[id]={
      id,
      state:DEX_STATE.CAPTURED,
      captureCount:1,
      failStack:0,
      biggest:{height:h,weight:w,encounterDate:now},
      smallest:{height:h,weight:w,encounterDate:now},
      firstCaught:now,
    };
  }
  saveDex(dex);
}

// ── 도감 화면 렌더 ──
function showDexScreen(){
  if(typeof showScreen!=='function') return;
  showScreen('dex-screen');
  renderDexScreen();
}

function renderDexScreen(){
  const grid=document.getElementById('dex-grid');
  if(!grid) return;
  grid.innerHTML='';
  const dex=loadDex();
  for(let id=1;id<=DEX_TOTAL;id++){
    const entry=dex[id]||defaultEntry(id);
    const cell=document.createElement('button');
    cell.type='button';
    cell.className='dex-cell dex-state-'+entry.state;
    cell.dataset.dexId=String(id);

    // 도트 이미지 (assets/dot/pokemon/{id}.gif) — 실루엣도 형태가 명확
    const sprite=document.createElement('img');
    sprite.className='dex-cell-sprite';
    sprite.src=`assets/dot/pokemon/${id}.gif`;
    sprite.alt='';
    sprite.draggable=false;
    cell.appendChild(sprite);

    const num=document.createElement('div');
    num.className='dex-cell-num';
    num.textContent='#'+String(id).padStart(3,'0');
    cell.appendChild(num);

    cell.addEventListener('click',()=>openDexDetail(id));
    grid.appendChild(cell);
  }
  updateDexCounter();
}

function updateDexCounter(){
  const n=getCapturedCount();
  const el=document.getElementById('dex-counter');
  if(el) el.textContent=`${n} / ${DEX_TOTAL}`;
}

// ── 상세 모달 ──
function openDexDetail(id){
  const overlay=document.getElementById('dex-detail-overlay');
  if(!overlay) return;
  const entry=getDexEntry(id);
  const meta=(typeof getMonsterMeta==='function')?getMonsterMeta(id):null;

  // 스프라이트 (도트 GIF, 실루엣 처리는 .dex-state-* 클래스로)
  const sp=document.getElementById('dex-detail-sprite');
  sp.className='dex-detail-sprite dex-state-'+entry.state;
  sp.style.backgroundImage=`url("assets/dot/pokemon/${id}.gif")`;
  sp.style.backgroundSize='contain';
  sp.style.backgroundPosition='center';
  sp.style.backgroundRepeat='no-repeat';

  // 번호
  document.getElementById('dex-detail-num').textContent='#'+String(id).padStart(3,'0');

  // 이름 / 타입 (발견 이상부터 노출)
  const nameEl=document.getElementById('dex-detail-name');
  const typesEl=document.getElementById('dex-detail-types');
  if(entry.state===DEX_STATE.UNDISCOVERED){
    nameEl.textContent='???';
    typesEl.innerHTML='';
  } else {
    nameEl.textContent=meta?meta.name_ko:'??';
    typesEl.innerHTML='';
    if(meta&&meta.types){
      for(const t of meta.types){
        const tag=document.createElement('span');
        tag.className='dex-type-tag';
        tag.textContent=t;
        if(typeof TYPE_COLORS!=='undefined'&&TYPE_COLORS[t]) tag.style.background=TYPE_COLORS[t];
        typesEl.appendChild(tag);
      }
    }
  }

  // 상세 정보 (포획 이상부터 노출)
  const info=document.getElementById('dex-detail-info');
  info.innerHTML='';
  if(entry.state===DEX_STATE.UNDISCOVERED){
    info.innerHTML='<div class="dex-detail-row dex-detail-locked">아직 발견하지 못했습니다</div>';
  } else if(entry.state===DEX_STATE.DISCOVERED){
    info.innerHTML='<div class="dex-detail-row dex-detail-locked">포획하면 더 많은 정보가 열립니다</div>';
    if(entry.failStack>0){
      const r=document.createElement('div');
      r.className='dex-detail-row';
      r.textContent=`포획 실패 +${entry.failStack*5}% 보정`;
      info.appendChild(r);
    }
  } else {
    const rows=[
      ['잡은 마리수', entry.captureCount+'마리'],
      ['보유 사탕 (공용)', getCandy()+'개'],
      ['키 (기본)', meta?meta.height_m+'m':'-'],
      ['무게 (기본)', meta?meta.weight_kg+'kg':'-'],
    ];
    if(entry.biggest)  rows.push(['최대 개체', `${entry.biggest.height}m / ${entry.biggest.weight}kg`]);
    if(entry.smallest) rows.push(['최소 개체', `${entry.smallest.height}m / ${entry.smallest.weight}kg`]);
    if(entry.firstCaught){
      const d=new Date(entry.firstCaught);
      rows.push(['최초 포획', `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`]);
    }
    for(const [k,v] of rows){
      const r=document.createElement('div');
      r.className='dex-detail-row';
      r.innerHTML=`<span class="dex-detail-key">${k}</span><span class="dex-detail-val">${v}</span>`;
      info.appendChild(r);
    }
  }

  // 디버그 즉시 잡기 (개발자 모드 인증 시에만)
  const debugBtn=document.getElementById('dex-detail-debug-catch');
  if(debugBtn){
    if(typeof devUnlocked!=='undefined'&&devUnlocked){
      debugBtn.classList.remove('hidden');
      debugBtn.onclick=()=>{
        captureNow(id);
        // 화면/카운터/풀밭/스킨 뱃지 일괄 갱신
        openDexDetail(id);
        renderDexScreen();
        if(typeof applyMeadowStageBackground==='function') applyMeadowStageBackground();
        if(typeof updateLobbySkinBadge==='function') updateLobbySkinBadge();
      };
    } else {
      debugBtn.classList.add('hidden');
    }
  }

  overlay.classList.remove('hidden');
}

function closeDexDetail(){
  const overlay=document.getElementById('dex-detail-overlay');
  if(overlay) overlay.classList.add('hidden');
}

function setupDexScreen(){
  // 마이그레이션 1회
  migrateLegacyDex();

  const back=document.getElementById('dex-back-btn');
  if(back) back.addEventListener('click',()=>{
    if(typeof playSfx==='function') playSfx('btn_click');
    if(typeof showScreen==='function') showScreen('lobby-screen');
  });

  const overlay=document.getElementById('dex-detail-overlay');
  if(overlay){
    // 백드롭 클릭으로 닫기
    overlay.addEventListener('click',e=>{ if(e.target===overlay) closeDexDetail(); });
  }
  const closeBtn=document.getElementById('dex-detail-close');
  if(closeBtn) closeBtn.addEventListener('click',closeDexDetail);
}

// 콘솔 디버그(레거시 호환)
if(typeof window!=='undefined'){
  window.dex={
    load:loadDex, save:saveDex, get:getDexEntry,
    captureNow, markDiscovered, incFailStack,
    addCandy, getCandy, setCandy, // 글로벌 사탕
    capturedCount:getCapturedCount, capturedIds:getCapturedIds,
    markSkinNew, clearSkinNew, hasSkinNew, getSkinNewCount, // 레드닷
  };
}
