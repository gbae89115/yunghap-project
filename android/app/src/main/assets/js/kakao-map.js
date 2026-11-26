/* 카카오 지도 · GPS 러닝
   담당: 최진범 (카카오 API·DB)
   (index.html에서 분리 — 내용은 그대로) */

/* ==========================================
   5. Kakao Map GPS Integration
   ========================================== */

// 한국 밖 좌표(예: 에뮬레이터 기본 위치 = 미국)면 서울시청 기준으로 표시
const DEFAULT_LAT = 37.5665;
const DEFAULT_LNG = 126.9780;

function isInKorea(lat, lng) {
    return lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132;
}

function setLocationBadge(text) {
    const badgeElement = document.getElementById('locationBadgeText');
    if (badgeElement) badgeElement.textContent = text;
}

function isKakaoMapReady() {
    return typeof kakao !== 'undefined' && Boolean(kakao.maps);
}

// 현재 위치 주변의 예시 경로 (트래킹 전 미리보기용)
function buildCoursePath(lat, lng) {
    return [
        new kakao.maps.LatLng(lat - 0.001, lng - 0.001),
        new kakao.maps.LatLng(lat - 0.0005, lng + 0.0005),
        new kakao.maps.LatLng(lat, lng)
    ];
}

// 지도는 기본 좌표로 먼저 만들고, GPS 위치를 받으면 그 위치로 옮긴다.
// (GPS 허용을 기다리는 동안에도, 거부해도 지도가 비어 있지 않도록)
function initKakaoMap() {
    const container = document.getElementById('kakaoMap');
    if (!container) return;

    // Check if Kakao Maps SDK loaded correctly
    if (isKakaoMapReady()) {
        try {
            const startPosition = new kakao.maps.LatLng(currentLat, currentLng);
            kakaoMapInstance = new kakao.maps.Map(container, { center: startPosition, level: 3 });

            // Running Path Polyline
            kakaoPolyline = new kakao.maps.Polyline({
                path: [],
                strokeWeight: 6,
                strokeColor: '#3b82f6',
                strokeOpacity: 0.9,
                strokeStyle: 'solid'
            });
            kakaoPolyline.setMap(kakaoMapInstance);

            // 내 위치 표시: 파란 점 + 퍼지는 원 (style.css 의 .run-me-dot)
            kakaoMarker = new kakao.maps.CustomOverlay({
                position: startPosition,
                content: '<div class="run-me-dot" aria-label="내 위치"></div>',
                xAnchor: 0.5,
                yAnchor: 0.5,
                zIndex: 3
            });
            kakaoMarker.setMap(kakaoMapInstance);

            requestCurrentPosition(false);
            return;
        } catch (error) {
            console.warn('Kakao Map init fallback triggered:', error);
        }
    }

    // Fallback Canvas Rendering if Kakao API is blocked due to domain restriction
    initFallbackCanvasMap();
}

/* ==========================================
   안드로이드 앱 연결: 위치 권한 · 화면 켜짐 유지
   (브라우저에서 열면 RoutineNoteApp 이 없으므로 그냥 넘어간다)
   ========================================== */
let pendingLocationAction = null; // 권한 허용 뒤 이어서 할 일: 'run' | 'locate'

function needsLocationPermission() {
    return !!(window.RoutineNoteApp && RoutineNoteApp.hasLocationPermission
        && !RoutineNoteApp.hasLocationPermission());
}

// 위치 권한 창을 띄운다. 허용하면 action('run' 러닝 시작 / 'locate' 내 위치)을 이어서 한다
function askLocationPermission(action) {
    pendingLocationAction = action;
    RoutineNoteApp.requestLocationPermission();
}

// MainActivity 가 권한 창 결과를 알려 줄 때 실행된다
function onLocationPermissionResult(granted) {
    const action = pendingLocationAction;
    pendingLocationAction = null;
    if (!granted) {
        showToast('위치 권한이 있어야 러닝 경로를 기록할 수 있어요. 설정 > 애플리케이션 > 루틴노트 > 권한에서 켤 수 있어요.');
        return;
    }
    if (action === 'run' && !isRunning) toggleRunningSimulation();
    else if (action === 'locate') requestCurrentPosition(true);
}

// 러닝 중에는 화면이 꺼지지 않게 한다
function setRunScreenOn(on) {
    if (window.RoutineNoteApp && RoutineNoteApp.setKeepScreenOn) RoutineNoteApp.setKeepScreenOn(on);
    // 알림창에도 러닝 기록 카드(킬로미터 / 시간 / 평균 페이스)를 띄우거나 닫는다
    if (window.RoutineNoteApp) {
        if (on && RoutineNoteApp.startRunNotification) RoutineNoteApp.startRunNotification();
        if (!on && RoutineNoteApp.stopRunNotification) RoutineNoteApp.stopRunNotification();
    }
}

// 알림창 기록 카드를 새 값으로 갱신한다 (예: 0.19 / 2:06 / 10'49")
function updateRunNotification(paceText) {
    if (!isRunning || !window.RoutineNoteApp || !RoutineNoteApp.updateRunNotification) return;
    const h = Math.floor(secondsElapsed / 3600);
    const m = Math.floor((secondsElapsed % 3600) / 60);
    const s = String(secondsElapsed % 60).padStart(2, '0');
    const timeText = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
    RoutineNoteApp.updateRunNotification(distanceKm.toFixed(2), timeText, paceText);
}

// 브라우저 GPS 위치 조회 (isManual: 사용자가 버튼을 눌렀을 때만 안내 토스트를 띄운다)
function requestCurrentPosition(isManual) {
    // 앱에서 위치 권한이 아직 없으면: 처음 지도를 열 때는 묻지 않고 기본 위치로 보여 주고,
    // '내 위치' 버튼을 눌렀을 때만 권한을 묻는다
    if (needsLocationPermission()) {
        updateAddressFromCoords(currentLat, currentLng);
        if (isManual) askLocationPermission('locate');
        return;
    }
    if (!navigator.geolocation) {
        updateAddressFromCoords(currentLat, currentLng);
        if (isManual) showToast('GPS 위치 정보 조회가 불가능합니다.');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            if (isInKorea(latitude, longitude)) {
                moveMapToPosition(latitude, longitude);
                if (isManual) showToast('현재 GPS 위치와 주소를 갱신했습니다.');
            } else {
                moveMapToPosition(DEFAULT_LAT, DEFAULT_LNG);
                if (isManual) showToast('현재 위치가 한국 밖이라 서울 기준으로 표시합니다.');
            }
        },
        () => {
            // GPS 차단 또는 실패 시 기본 좌표 기준으로 주소를 표시한다
            updateAddressFromCoords(currentLat, currentLng);
            if (isManual) showToast('GPS 위치를 가져오지 못했어요. 위치 권한을 확인해 주세요.');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
}

function moveMapToPosition(lat, lng) {
    currentLat = lat;
    currentLng = lng;

    if (kakaoMapInstance === null) return;

    const position = new kakao.maps.LatLng(lat, lng);
    kakaoMapInstance.setCenter(position);
    if (kakaoMarker) kakaoMarker.setPosition(position);
    // 실제 트래킹 경로가 있으면 지우지 않고, 없을 때만 예시 경로를 보여준다

    updateAddressFromCoords(lat, lng);
}

// 좌표 -> 행정동 주소 변환 (Geocoder) 후 위치 뱃지에 표시
function updateAddressFromCoords(lat, lng) {
    if (!isKakaoMapReady() || !kakao.maps.services) {
        setLocationBadge('GPS 기본 코스');
        return;
    }

    const geocoder = new kakao.maps.services.Geocoder();
    geocoder.coord2RegionCode(lng, lat, (result, status) => {
        if (status !== kakao.maps.services.Status.OK || result.length === 0) {
            setLocationBadge('현재 위치 코스');
            return;
        }

        // 행정동(H) 우선, 없으면 첫 번째 결과
        const regionInfo = result.find(region => region.region_type === 'H') || result[0];
        setLocationBadge(`${regionInfo.address_name} 코스`);
    });
}
// 숨겨져 있던 탭에서 지도가 보일 때 크기를 다시 계산하고,
// 러닝 중이 아니면 현재 GPS 위치로 다시 맞춘다
function relayoutKakaoMap(refreshGps = true) {
    if (kakaoMapInstance) {
        kakaoMapInstance.relayout();
        kakaoMapInstance.setCenter(new kakao.maps.LatLng(currentLat, currentLng));
        if (refreshGps && !isRunning) requestCurrentPosition(false);
    } else {
        initFallbackCanvasMap();
    }
}

function recenterKakaoMap() {
    if (kakaoMapInstance === null) initFallbackCanvasMap();
    requestCurrentPosition(true);
}

function initFallbackCanvasMap() {
    const canvas = document.getElementById('fallbackMapCanvas');
    if (!canvas) return;
    canvas.classList.remove('hidden');

    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth || 340;
    canvas.height = canvas.parentElement.clientHeight || 280;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    for (let x = 0; x < canvas.width; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Route Line
    ctx.beginPath();
    ctx.moveTo(30, 180);
    ctx.lineTo(120, 120);
    ctx.lineTo(200, 160);
    ctx.lineTo(280, 80);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 5;
    ctx.stroke();

    // End dot
    ctx.beginPath();
    ctx.arc(280, 80, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    setLocationBadge('GPS 기본 코스');
}

/* ==========================================
   실제 GPS 러닝 추적
   ========================================== */
let runWatchId = null;          // watchPosition 번호
let runPath = [];               // 지도에 그릴 실제 이동 좌표들
let lastRunPoint = null;        // 직전 좌표 {lat, lng}
let outsideKoreaWarned = false; // 한국 밖 안내를 한 번만 띄우기 위함
let runStartOverlay = null;     // 출발 지점 깃발

// 출발 지점에 초록 깃발을 표시한다 (style.css 의 .run-start-flag)
function showRunStartFlag(position) {
    if (!kakaoMapInstance) return;
    if (runStartOverlay) runStartOverlay.setMap(null);
    runStartOverlay = new kakao.maps.CustomOverlay({
        position: position,
        content: '<div class="run-start-flag" aria-label="출발 지점"><i class="fa-solid fa-flag"></i></div>',
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 2
    });
    runStartOverlay.setMap(kakaoMapInstance);
}

function clearRunStartFlag() {
    if (runStartOverlay) {
        runStartOverlay.setMap(null);
        runStartOverlay = null;
    }
}

// 두 좌표 사이 거리(km) - 하버사인 공식
function getDistanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}

// 새 GPS 좌표가 들어올 때마다 실행
function onRunPosition(position) {
    const { latitude, longitude, accuracy } = position.coords;

    // 한국 밖 좌표는 기록하지 않는다 (에뮬레이터 기본 위치 대비)
    if (!isInKorea(latitude, longitude)) {
        if (!outsideKoreaWarned) {
            showToast('현재 위치가 한국 밖이라 기록되지 않아요. 에뮬레이터 위치를 확인해 주세요.');
            outsideKoreaWarned = true;
        }
        return;
    }

    if (accuracy > 50) return;                 // 오차 50m 넘는 부정확한 점은 무시

    if (lastRunPoint) {
        const d = getDistanceKm(lastRunPoint.lat, lastRunPoint.lng, latitude, longitude);
        if (d < 0.003) return;                 // 3m 미만 흔들림은 무시
        distanceKm += d;
        caloriesBurned = distanceKm * 60;      // 대략 1km당 60kcal (체중 반영은 나중에)
    }
    lastRunPoint = { lat: latitude, lng: longitude };
    currentLat = latitude;
    currentLng = longitude;

    if (kakaoMapInstance) {
        const p = new kakao.maps.LatLng(latitude, longitude);
        if (runPath.length === 0) showRunStartFlag(p); // 첫 좌표 = 출발 지점
        runPath.push(p);
        kakaoPolyline.setPath(runPath);        // 이동 경로 선
        kakaoMarker.setPosition(p);            // 현재 위치 마커
        kakaoMapInstance.panTo(p);             // 지도가 따라감
    }
    updateRunDisplay();
}

// 서버 저장용: 경로 좌표 목록
function getRunPathForSave() {
    return runPath.map((p) => ({ lat: p.getLat(), lng: p.getLng() }));
}

function stopGpsWatch() {
    if (runWatchId !== null) {
        navigator.geolocation.clearWatch(runWatchId);
        runWatchId = null;
    }
}

function toggleRunningSimulation() {
    const btnText = document.getElementById('toggleRunText');
    const btnIcon = document.getElementById('toggleRunIcon');

    if (!isRunning) {
        if (!navigator.geolocation) {
            showToast('이 기기에서는 GPS를 사용할 수 없어요.');
            return;
        }
        // 처음 러닝을 시작할 때 위치 권한을 묻는다 (허용하면 자동으로 이어서 시작)
        if (needsLocationPermission()) {
            askLocationPermission('run');
            return;
        }
        isRunning = true;
        setRunScreenOn(true);
        outsideKoreaWarned = false;
        btnText.textContent = "일시 정지";
        btnIcon.className = "fa-solid fa-pause";

        // 처음 시작이면 예시 경로 지우기
        if (runPath.length === 0 && kakaoPolyline) kakaoPolyline.setPath([]);

        runTimerInterval = setInterval(() => {
            secondsElapsed++;
            updateRunDisplay();
        }, 1000);

        runWatchId = navigator.geolocation.watchPosition(
            onRunPosition,
            (err) => showToast('GPS 신호를 받지 못했어요: ' + err.message),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
        );

        showToast('GPS 트래킹을 시작합니다.');
    } else {
        isRunning = false;
        setRunScreenOn(false);
        btnText.textContent = "트래킹 재개";
        btnIcon.className = "fa-solid fa-play";
        clearInterval(runTimerInterval);
        stopGpsWatch();
        lastRunPoint = null;   // 일시정지 중 이동한 거리는 포함하지 않음
        showToast('GPS 트래킹이 일시정지 되었습니다.');
    }
}

function updateRunDisplay() {
    document.getElementById('runDistance').textContent = distanceKm.toFixed(1);
    document.getElementById('runCalories').textContent = Math.round(caloriesBurned);

    const hrs = String(Math.floor(secondsElapsed / 3600)).padStart(2, '0');
    const mins = String(Math.floor((secondsElapsed % 3600) / 60)).padStart(2, '0');
    const secs = String(secondsElapsed % 60).padStart(2, '0');
    document.getElementById('runTimer').textContent = `${hrs}:${mins}:${secs}`;

    // 평균 페이스: 1km 를 달리는 데 걸린 평균 시간 (예: 5'32")
    const paceElement = document.getElementById('runPace');
    if (paceElement) {
        if (distanceKm >= 0.01) {
            const paceSec = Math.round(secondsElapsed / distanceKm);
            const paceMin = Math.floor(paceSec / 60);
            paceElement.textContent = paceMin >= 60
                ? '-'
                : `${paceMin}'${String(paceSec % 60).padStart(2, '0')}"`;
        } else {
            paceElement.textContent = '-';
        }
        updateRunNotification(paceElement.textContent);
    }
}

function resetRunningData() {
    isRunning = false;
    setRunScreenOn(false);
    clearInterval(runTimerInterval);
    stopGpsWatch();
    runPath = [];
    lastRunPoint = null;
    if (kakaoPolyline) kakaoPolyline.setPath([]);
    clearRunStartFlag();

    secondsElapsed = 0;
    distanceKm = 0.0;
    caloriesBurned = 0;

    document.getElementById('toggleRunText').textContent = "트래킹 시작";
    document.getElementById('toggleRunIcon').className = "fa-solid fa-play";

    updateRunDisplay();
    showToast('러닝 데이터가 초기화되었습니다.');
}
/* ==========================================
   지도 전체화면 (현재 위치 버튼 아래 버튼)
   ========================================== */
let isMapFullscreen = false;
let mapPlaceholder = null;

// 전체화면용 스타일을 한 번만 추가한다 (style.css를 건드리지 않기 위해)
function ensureMapFullscreenStyle() {
    if (document.getElementById('mapFullscreenStyle')) return;
    const style = document.createElement('style');
    style.id = 'mapFullscreenStyle';
    style.textContent = `
        .map-fullscreen {
            position: fixed !important;
            inset: 0 !important;
            z-index: 9999 !important;
            width: 100vw !important;
            height: 100vh !important;
            height: 100dvh !important;
            margin: 0 !important;
            border-radius: 0 !important;
        }
        .map-fullscreen #kakaoMap,
        .map-fullscreen #fallbackMapCanvas {
            width: 100% !important;
            height: 100% !important;
        }`;
    document.head.appendChild(style);
}

function toggleMapFullscreen() {
    const mapBox = document.getElementById('kakaoMap')?.parentElement;
    if (!mapBox) return;
    ensureMapFullscreenStyle();
    isMapFullscreen = !isMapFullscreen;

    if (isMapFullscreen) {
        // 원래 자리를 표시해 두고, 지도 박스를 화면 맨 위로 옮긴다
        mapPlaceholder = document.createComment('map-placeholder');
        mapBox.before(mapPlaceholder);
        document.body.appendChild(mapBox);
        mapBox.classList.add('map-fullscreen');
        document.body.style.overflow = 'hidden';
    } else {
        // 원래 자리로 되돌린다
        mapBox.classList.remove('map-fullscreen');
        if (mapPlaceholder) {
            mapPlaceholder.replaceWith(mapBox);
            mapPlaceholder = null;
        }
        document.body.style.overflow = '';
    }

    // 버튼 아이콘 바꾸기 (확대 ↔ 축소)
    const icon = document.getElementById('mapFullscreenIcon');
    if (icon) icon.className = isMapFullscreen ? 'fa-solid fa-compress' : 'fa-solid fa-expand';

    // 지도 크기가 바뀌었으니 다시 그리기
    setTimeout(() => relayoutKakaoMap(false), 50);
}