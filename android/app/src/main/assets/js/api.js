/* 서버(DB) API 호출
   담당: 최진범 (카카오 API·DB)
   (index.html에서 분리 — 내용은 그대로) */

const API_BASE_URL = 'https://routinenote-backend.onrender.com/api';

// 1. 페이지 로드 시 백엔드에서 오늘 루틴 목록 조회
async function loadTodayRoutines() {
    try {
    const response = await fetch(`${API_BASE_URL}/workout/today?userId=testuser`);
    const data = await response.json();
    if (data.success) {
        console.log('DB에서 조회된 루틴 데이터:', data);
    }
    } catch (error) {
    console.error('오늘 루틴 불러오기 실패:', error);
    }
}

// 2. 운동 루틴 체크박스 클릭 시 DB 상태 업데이트
async function updateRoutineCheck(selectionId, isChecked) {
    try {
    const response = await fetch(`${API_BASE_URL}/workout/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectionId, isChecked })
    });
    const data = await response.json();
    if (data.success) {
        console.log('DB 업데이트 성공!');
    }
    } catch (error) {
    console.error('상태 변경 저장 실패:', error);
    }
}

// 3. GPS 런닝 종료 시 기록 저장 (성공하면 true, 실패하면 false)
async function saveGpsRecord(selectionId, distance, calories, routePath) {
    try {
        const response = await fetch(`${API_BASE_URL}/workout/gps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selectionId, distance, calories, routePath })
        });
        const data = await response.json();
        if (data.success) console.log('GPS 기록 서버 저장 완료, gpsId =', data.gpsId);
        return data.success === true;
    } catch (error) {
        console.error('GPS 저장 실패:', error);
        return false;
    }
}

// ==========================================
// 카카오 로그인
// ==========================================

// 카카오 로그인 버튼을 누르면 실행
function startKakaoLogin() {
    window.location.href = `${API_BASE_URL}/auth/kakao/login`;
}

// 카카오 로그인 후 앱으로 돌아왔을 때 처리 (처리했으면 true)
async function handleKakaoLoginReturn() {
    const hash = window.location.hash;
    if (!hash.startsWith('#kakao')) return false;

    // 주소창에서 로그인 정보 지우기
    history.replaceState(null, '', window.location.pathname);

    const params = new URLSearchParams(hash.slice(1));
    if (params.has('kakaoError')) {
        showToast('카카오 로그인에 실패했어요. 다시 시도해 주세요.');
        return false;
    }

    try {
        const data = JSON.parse(params.get('kakaoLogin'));
        if (!data || !data.userId) return false;

        // 기기 계정 목록에 없으면 추가 (앱을 다시 켜도 로그인 유지)
        let account = findAccount(data.userId);
        if (!account) {
            account = { userId: data.userId, provider: 'KAKAO', createdAt: new Date().toISOString() };
            const accounts = getAccounts();
            accounts.push(account);
            writeStorage('accounts', accounts);
        }

        await beginSession(account, true);
        showToast(data.nickname ? `${data.nickname}님, 환영해요!` : '카카오 로그인 완료!');
        return true;
    } catch (e) {
        console.error('카카오 로그인 처리 실패:', e);
        return false;
    }
}

// 화면 로드 시 실행
window.addEventListener('DOMContentLoaded', loadTodayRoutines);
