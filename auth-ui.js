// ── 인증 UI (회원가입/로그인/로그아웃) ──
// 메인화면 모달 + 로비 헤더 로그아웃/이메일 표시.
// 게스트도 그대로 플레이 가능; 로그인 시 진행상황 서버 동기화.
(function(){
  let _mode = 'login';

  function $(id){ return document.getElementById(id); }

  function setMode(mode){
    _mode = mode;
    const title = $('auth-modal-title');
    const submit = $('auth-modal-submit');
    const sw = $('auth-modal-switch');
    if(title) title.textContent = mode === 'login' ? '로그인' : '회원가입';
    if(submit) submit.textContent = mode === 'login' ? '로그인' : '회원가입';
    if(sw) sw.textContent = mode === 'login'
      ? '계정이 없으신가요? 회원가입'
      : '이미 계정이 있나요? 로그인';
    const err = $('auth-modal-error');
    if(err) err.textContent = '';
  }

  function openModal(mode){
    setMode(mode);
    const email = $('auth-email');
    const pw = $('auth-password');
    if(email) email.value = '';
    if(pw) pw.value = '';
    const modal = $('auth-modal');
    if(modal) modal.classList.remove('hidden');
    setTimeout(() => { if(email) email.focus(); }, 50);
  }

  function closeModal(){
    const modal = $('auth-modal');
    if(modal) modal.classList.add('hidden');
  }

  function setBusy(busy){
    const btn = $('auth-modal-submit');
    if(!btn) return;
    btn.disabled = busy;
    if(busy){
      btn.dataset.label = btn.dataset.label || btn.textContent;
      btn.textContent = '잠시만요...';
    } else if(btn.dataset.label){
      btn.textContent = btn.dataset.label;
      btn.dataset.label = '';
    }
  }

  async function submitAuth(){
    const email = ($('auth-email')?.value || '').trim();
    const pw = $('auth-password')?.value || '';
    const errEl = $('auth-modal-error');
    if(!email || !pw){
      if(errEl) errEl.textContent = '이메일과 비밀번호를 입력하세요.';
      return;
    }
    if(_mode === 'register' && pw.length < 8){
      if(errEl) errEl.textContent = '비밀번호는 8자 이상이어야 합니다.';
      return;
    }
    setBusy(true);
    if(errEl) errEl.textContent = '';
    try {
      if(_mode === 'login'){
        await window.gameSync.apiLogin(email, pw);
      } else {
        await window.gameSync.apiRegister(email, pw);
      }
      // 로그인 직후: 서버에 저장된 상태 → 로컬 적용
      const state = await window.gameSync.fetchServerState();
      if(state) window.gameSync.applyServerState(state);

      // 회원가입 직후 + 게스트로 진행하던 데이터가 있으면 그것도 서버로 push
      if(_mode === 'register'){
        window.gameSync.syncToServer();
      }

      closeModal();
      updateAuthStatusUI();
      // 메모리 캐시 reload
      if(typeof loadSkinData === 'function' && typeof skinData !== 'undefined'){
        try { skinData = loadSkinData(); } catch {}
      }
      if(typeof updateLobbyProfile === 'function') updateLobbyProfile();
      if(typeof updateLobbyStage === 'function') updateLobbyStage();
    } catch(e){
      if(errEl) errEl.textContent = mapAuthError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function mapAuthError(msg){
    switch(msg){
      case 'email_invalid': return '이메일 형식이 올바르지 않습니다.';
      case 'password_min_8_chars': return '비밀번호는 8자 이상이어야 합니다.';
      case 'email_taken': return '이미 가입된 이메일입니다.';
      case 'invalid_credentials': return '이메일 또는 비밀번호가 일치하지 않습니다.';
      case 'credentials_required': return '이메일과 비밀번호를 입력하세요.';
      default:
        if(/^(login|register)_failed_/.test(msg || '')) return '서버 연결 실패. 잠시 후 다시 시도하세요.';
        if(/NetworkError|Failed to fetch/i.test(msg || '')) return '서버에 연결할 수 없습니다. 서버 기동 상태를 확인하세요.';
        return msg || '인증 실패';
    }
  }

  function updateAuthStatusUI(){
    const statusEl = $('main-auth-status');
    const loginBtn = $('main-auth-login');
    const registerBtn = $('main-auth-register');
    const sep = document.querySelector('.main-auth-sep');
    const lobbyLogout = $('lobby-logout-btn');
    const lobbyEmail = $('lobby-account-email');

    if(window.gameSync && window.gameSync.isLoggedIn()){
      const email = window.gameSync.getEmail() || '';
      if(statusEl) statusEl.textContent = `✓ 로그인됨: ${email}`;
      if(loginBtn) loginBtn.classList.add('hidden');
      if(registerBtn) registerBtn.classList.add('hidden');
      if(sep) sep.classList.add('hidden');
      if(lobbyLogout) lobbyLogout.classList.remove('hidden');
      if(lobbyEmail){
        lobbyEmail.textContent = email;
        lobbyEmail.classList.remove('hidden');
      }
    } else {
      if(statusEl) statusEl.textContent = '';
      if(loginBtn) loginBtn.classList.remove('hidden');
      if(registerBtn) registerBtn.classList.remove('hidden');
      if(sep) sep.classList.remove('hidden');
      if(lobbyLogout) lobbyLogout.classList.add('hidden');
      if(lobbyEmail) lobbyEmail.classList.add('hidden');
    }
  }

  function bind(){
    const loginBtn = $('main-auth-login');
    const registerBtn = $('main-auth-register');
    const closeBtn = $('auth-modal-close');
    const backdrop = $('auth-modal-backdrop');
    const submitBtn = $('auth-modal-submit');
    const switchBtn = $('auth-modal-switch');
    const pwInput = $('auth-password');
    const emailInput = $('auth-email');
    const logoutBtn = $('lobby-logout-btn');

    if(loginBtn) loginBtn.addEventListener('click', () => openModal('login'));
    if(registerBtn) registerBtn.addEventListener('click', () => openModal('register'));
    if(closeBtn) closeBtn.addEventListener('click', closeModal);
    if(backdrop) backdrop.addEventListener('click', closeModal);
    if(submitBtn) submitBtn.addEventListener('click', submitAuth);
    if(switchBtn) switchBtn.addEventListener('click', () => setMode(_mode === 'login' ? 'register' : 'login'));
    if(pwInput) pwInput.addEventListener('keydown', e => { if(e.key === 'Enter') submitAuth(); });
    if(emailInput) emailInput.addEventListener('keydown', e => { if(e.key === 'Enter') $('auth-password')?.focus(); });
    if(logoutBtn) logoutBtn.addEventListener('click', () => {
      if(!confirm('로그아웃 하시겠습니까?\n로컬 진행상황이 정리되고 메인화면으로 이동합니다.\n(서버 데이터는 그대로 유지됩니다.)')) return;
      window.gameSync.logout();
      if(typeof currentStage !== 'undefined') currentStage = 1;
      if(typeof currentGold !== 'undefined') currentGold = 0;
      if(typeof devUnlocked !== 'undefined') devUnlocked = false;
      updateAuthStatusUI();
      if(typeof showScreen === 'function') showScreen('main-screen');
      if(typeof startMainBgm === 'function') startMainBgm();
    });

    updateAuthStatusUI();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.gameAuthUI = { openModal, closeModal, updateAuthStatusUI };
})();
