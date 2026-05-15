// ── 클라이언트 ↔ 서버 sync 어댑터 ──
// localStorage 14개 키를 서버 schema와 매핑 + 로그인/회원가입/sync 헬퍼.
// 오프라인 또는 토큰 없음 시 모든 호출은 no-op (localStorage만 유지).

(function(){
  // 서버 URL: index.html에서 window.SERVER_URL 정의 (또는 기본값)
  const SERVER_URL = (window.SERVER_URL || 'http://localhost:8080').replace(/\/$/, '');
  const TOKEN_KEY = 'hexPuzzleAuthToken';
  const EMAIL_KEY = 'hexPuzzleAuthEmail';

  function getToken(){ return localStorage.getItem(TOKEN_KEY); }
  function setToken(t){ localStorage.setItem(TOKEN_KEY, t); }
  function clearToken(){ localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(EMAIL_KEY); }
  function getEmail(){ return localStorage.getItem(EMAIL_KEY); }
  function isLoggedIn(){ return !!getToken(); }

  function safeJson(s, fallback){
    if(!s) return fallback;
    try { return JSON.parse(s); } catch { return fallback; }
  }

  // ── API 호출 ──
  async function apiRegister(email, password){
    const r = await fetch(`${SERVER_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error || `register_failed_${r.status}`);
    setToken(data.token);
    localStorage.setItem(EMAIL_KEY, data.user.email);
    return data.user;
  }

  async function apiLogin(email, password){
    const r = await fetch(`${SERVER_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error || `login_failed_${r.status}`);
    setToken(data.token);
    localStorage.setItem(EMAIL_KEY, data.user.email);
    return data.user;
  }

  async function fetchServerState(){
    const token = getToken();
    if(!token) return null;
    const r = await fetch(`${SERVER_URL}/api/profile`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if(!r.ok){
      if(r.status === 401) clearToken();
      return null;
    }
    return await r.json();
  }

  // ── localStorage → 서버 schema 변환 ──
  function collectLocalState(){
    return {
      profile: {
        character: localStorage.getItem('hexPuzzlePlayerCharacter'),
        nickname: localStorage.getItem('hexPuzzlePlayerName'),
        stage: parseInt(localStorage.getItem('hexPuzzleStage') || '1', 10),
        gold: parseInt(localStorage.getItem('hexPuzzleGold') || '0', 10),
        diamond: parseInt(localStorage.getItem('hexPuzzleDiamond') || '0', 10),
        candy: parseInt(localStorage.getItem('hexPuzzleCandy') || '0', 10),
        hearts: parseInt(localStorage.getItem('hexPuzzleHeart') || '5', 10),
        heart_charge_at: parseInt(localStorage.getItem('hexPuzzleHeartChargeAt') || '0', 10),
        basic_charge_at: parseInt(localStorage.getItem('hexPuzzleBasicChargeAt') || '0', 10),
        balls: safeJson(localStorage.getItem('hexPuzzleBalls'), {}),
        materials: safeJson(localStorage.getItem('hexPuzzleMaterials'), {}),
        pity_main: parseInt(localStorage.getItem('hexPuzzlePityMain') || '0', 10),
        pity_repeat: parseInt(localStorage.getItem('hexPuzzlePityRepeat') || '0', 10),
        auto_flee: localStorage.getItem('hexPuzzleAutoFlee') === '1',
        auto_flee_seen: localStorage.getItem('hexPuzzleAutoFleeSeen') === '1',
        dark_mode: localStorage.getItem('hexPuzzleDarkMode') === '1',
        intro_done: localStorage.getItem('hexPuzzleIntroDone') === '1',
        high_score: parseInt(localStorage.getItem('hexPuzzleHighScore') || '0', 10),
      },
      dex: dexObjToArray(safeJson(localStorage.getItem('hexPuzzleDex'), {})),
      skinSlots: slotsToServer(safeJson(localStorage.getItem('hexPuzzleSlots'), [])),
      skinUnlocked: safeJson(localStorage.getItem('hexPuzzleUnlocked'), []),
    };
  }

  function dexObjToArray(dexObj){
    if(!dexObj || typeof dexObj !== 'object') return [];
    return Object.entries(dexObj).map(([dexId, e]) => ({
      dexId: Number(dexId),
      state: e.state || 'undiscovered',
      captureCount: Number(e.captureCount) || 0,
      failStack: Number(e.failStack) || 0,
      biggest: e.biggest || null,
      smallest: e.smallest || null,
      firstCaught: e.firstCaught ? Number(e.firstCaught) : null,
    }));
  }

  function slotsToServer(arr){
    if(!Array.isArray(arr)) return [];
    return arr
      .map((dexId, i) => ({ slotIndex: i, dexId }))
      .filter(s => typeof s.dexId === 'number' && s.dexId > 0);
  }

  // ── 서버 schema → localStorage 적용 ──
  function applyServerState(state){
    if(!state) return;
    const p = state.profile;
    if(p){
      if(p.character != null) localStorage.setItem('hexPuzzlePlayerCharacter', p.character);
      if(p.nickname != null) localStorage.setItem('hexPuzzlePlayerName', p.nickname);
      localStorage.setItem('hexPuzzleStage', String(p.stage || 1));
      localStorage.setItem('hexPuzzleGold', String(p.gold || 0));
      localStorage.setItem('hexPuzzleDiamond', String(p.diamond || 0));
      localStorage.setItem('hexPuzzleCandy', String(p.candy || 0));
      localStorage.setItem('hexPuzzleHeart', String(p.hearts != null ? p.hearts : 5));
      localStorage.setItem('hexPuzzleHeartChargeAt', String(p.heart_charge_at || 0));
      localStorage.setItem('hexPuzzleBasicChargeAt', String(p.basic_charge_at || 0));
      localStorage.setItem('hexPuzzleBalls', JSON.stringify(p.balls || {}));
      localStorage.setItem('hexPuzzleMaterials', JSON.stringify(p.materials || {}));
      localStorage.setItem('hexPuzzlePityMain', String(p.pity_main || 0));
      localStorage.setItem('hexPuzzlePityRepeat', String(p.pity_repeat || 0));
      localStorage.setItem('hexPuzzleAutoFlee', p.auto_flee ? '1' : '0');
      localStorage.setItem('hexPuzzleAutoFleeSeen', p.auto_flee_seen ? '1' : '0');
      localStorage.setItem('hexPuzzleDarkMode', p.dark_mode ? '1' : '0');
      localStorage.setItem('hexPuzzleIntroDone', p.intro_done ? '1' : '0');
      localStorage.setItem('hexPuzzleHighScore', String(p.high_score || 0));
    }
    if(Array.isArray(state.dex)){
      const dexObj = {};
      for(const e of state.dex) dexObj[e.dexId] = e;
      localStorage.setItem('hexPuzzleDex', JSON.stringify(dexObj));
    }
    if(Array.isArray(state.skinSlots) && state.skinSlots.length > 0){
      const arr = [];
      for(const s of state.skinSlots) arr[s.slotIndex] = s.dexId;
      localStorage.setItem('hexPuzzleSlots', JSON.stringify(arr));
    }
    if(Array.isArray(state.skinUnlocked)){
      localStorage.setItem('hexPuzzleUnlocked', JSON.stringify(state.skinUnlocked));
    }
  }

  // ── 디바운스 sync (마지막 호출 1500ms 후 PUT) ──
  let _syncTimer = null;
  let _syncing = false;
  function syncToServer(){
    if(!isLoggedIn()) return; // 게스트 모드면 no-op
    clearTimeout(_syncTimer);
    _syncTimer = setTimeout(async () => {
      if(_syncing) return;
      _syncing = true;
      try {
        const state = collectLocalState();
        const r = await fetch(`${SERVER_URL}/api/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
          },
          body: JSON.stringify(state),
        });
        if(!r.ok && r.status === 401){
          clearToken();
          console.warn('[sync] token expired, logged out');
        } else if(!r.ok){
          console.warn('[sync] PUT failed:', r.status);
        }
      } catch(e){
        // 오프라인/네트워크 에러: graceful degrade
        console.warn('[sync] network error:', e.message);
      } finally {
        _syncing = false;
      }
    }, 1500);
  }

  // ── 로그아웃: 토큰 + 동기화 데이터 청소 ──
  function logout(){
    clearToken();
    const keysToClear = [
      'hexPuzzlePlayerName', 'hexPuzzlePlayerCharacter', 'hexPuzzleStage',
      'hexPuzzleGold', 'hexPuzzleDiamond', 'hexPuzzleCandy',
      'hexPuzzleHeart', 'hexPuzzleHeartChargeAt', 'hexPuzzleBasicChargeAt',
      'hexPuzzleBalls', 'hexPuzzleMaterials',
      'hexPuzzlePityMain', 'hexPuzzlePityRepeat',
      'hexPuzzleAutoFlee', 'hexPuzzleAutoFleeSeen',
      'hexPuzzleIntroDone', 'hexPuzzleDex', 'hexPuzzleSlots',
      'hexPuzzleUnlocked', 'hexPuzzleSkinNew',
    ];
    for(const k of keysToClear) localStorage.removeItem(k);
  }

  // 전역 expose
  window.gameSync = {
    SERVER_URL,
    apiRegister, apiLogin, fetchServerState,
    collectLocalState, applyServerState, syncToServer,
    logout, isLoggedIn, getToken, getEmail,
  };
})();
