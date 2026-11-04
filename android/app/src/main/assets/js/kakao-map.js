/* 카카오 지도 · GPS 러닝
   담당: 최진범 (카카오 API·DB)
   (index.html에서 분리 — 내용은 그대로) */

/* ==========================================
   5. Kakao Map GPS Integration
   ========================================== */
function setLocationBadge(text) {
    const badgeElement = document.getElementById('locationBadgeText');
    if (badgeElement) badgeElement.textContent = text;
}

function isKakaoMapReady() {
    return typeof kakao !== 'undefined' && Boolean(kakao.maps);
}

// 현재 위치 주변의 예시 경로 (실제 트래킹 좌표가 생기면 이 함수를 교체하면 된다)
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
                path: buildCoursePath(currentLat, currentLng),
                strokeWeight: 6,
                strokeColor: '#3b82f6',
                strokeOpacity: 0.9,
                strokeStyle: 'solid'
            });
            kakaoPolyline.setMap(kakaoMapInstance);

            // Marker
            kakaoMarker = new kakao.maps.Marker({ position: startPosition });
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

// 브라우저 GPS 위치 조회 (isManual: 사용자가 버튼을 눌렀을 때만 안내 토스트를 띄운다)
function requestCurrentPosition(isManual) {
    if (!navigator.geolocation) {
        updateAddressFromCoords(currentLat, currentLng);
        if (isManual) showToast('GPS 위치 정보 조회가 불가능합니다.');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            moveMapToPosition(position.coords.latitude, position.coords.longitude);
            if (isManual) showToast('현재 GPS 위치와 주소를 갱신했습니다.');
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
    if (kakaoPolyline) kakaoPolyline.setPath(buildCoursePath(lat, lng));

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

// 숨겨져 있던 탭에서 지도가 처음 보일 때 크기를 다시 계산한다
function relayoutKakaoMap() {
    if (kakaoMapInstance) {
        kakaoMapInstance.relayout();
        kakaoMapInstance.setCenter(new kakao.maps.LatLng(currentLat, currentLng));
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

function toggleRunningSimulation() {
    const btnText = document.getElementById('toggleRunText');
    const btnIcon = document.getElementById('toggleRunIcon');

    if (!isRunning) {
        isRunning = true;
        btnText.textContent = "일시 정지";
        btnIcon.className = "fa-solid fa-pause";

        runTimerInterval = setInterval(() => {
            secondsElapsed++;
            distanceKm += 0.003;
            caloriesBurned += 0.25;

            updateRunDisplay();
        }, 1000);

        showToast('GPS 트래킹을 시작합니다.');
    } else {
        isRunning = false;
        btnText.textContent = "트래킹 재개";
        btnIcon.className = "fa-solid fa-play";
        clearInterval(runTimerInterval);
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
}

function resetRunningData() {
    isRunning = false;
    clearInterval(runTimerInterval);
    secondsElapsed = 0;
    distanceKm = 0.0;
    caloriesBurned = 0;

    document.getElementById('toggleRunText').textContent = "트래킹 시작";
    document.getElementById('toggleRunIcon').className = "fa-solid fa-play";

    updateRunDisplay();
    showToast('러닝 데이터가 초기화되었습니다.');
}
