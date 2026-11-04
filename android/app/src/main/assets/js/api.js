/* 서버(DB) API 호출
   담당: 최진범 (카카오 API·DB)
   (index.html에서 분리 — 내용은 그대로) */

const API_BASE_URL = 'http://localhost:3000/api';

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

// 3. GPS 런닝 종료 시 기록 저장
async function saveGpsRecord(selectionId, distance, calories, routePath) {
    try {
    const response = await fetch(`${API_BASE_URL}/workout/gps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectionId, distance, calories, routePath })
    });
    const data = await response.json();
    if (data.success) {
        alert('GPS 런닝 기록이 MySQL DB에 저장되었습니다!');
    }
    } catch (error) {
    console.error('GPS 저장 실패:', error);
    }
}

// 화면 로드 시 실행
window.addEventListener('DOMContentLoaded', loadTodayRoutines);
