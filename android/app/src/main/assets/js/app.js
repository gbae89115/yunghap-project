/* 앱 기능: 상태, 루틴, 캘린더, 타이머, 로그인, 마이페이지, BMI·다이어트, 토스트
   담당: 이해민 (기능 구현)
   (index.html에서 분리 — 내용은 그대로) */

/* ==========================================
   1. Core Application State
   ========================================== */
// [수업 규칙] 화면 글자는 textContent 로만 넣고, HTML 문자열은 삽입하지 않는다.
// [수업 규칙] 운동 기록은 Promise + async/await 로 불러온 뒤에 달력에 반영한다.
// [수업 규칙] 변수와 함수 이름은 camelCase.
const mockUserId = 1;
const mockDelayMs = 400;
const weekdayNames = ['일', '월', '화', '수', '목', '금', '토'];
const statusLabels = {
    completed: '루틴 완수',
    partial: '일부 완료',
    incomplete: '미완료'
};

// 날짜별 운동 항목: { '2026-10-10': [{ id, name, completed }] }
let workoutState = {};
// WORKOUT_LOG 형태: workoutLogId, userId, workoutDate, isCompleted, currentStreak
let workoutLogs = [];
let isWorkoutLoaded = false;
let nextRoutineId = 1;

let currentActiveDate = formatDateKey(new Date());
let calendarInstance = null;
let lastFocusedElement = null;
let selectedGender = "male";

// GPS Running State
let isRunning = false;
let runTimerInterval = null;
let secondsElapsed = 1720; // 00:28:40
let distanceKm = 5.2;
let caloriesBurned = 415;

// Kakao Map Instances
let kakaoMapInstance = null;
let kakaoPolyline = null;
let kakaoMarker = null;
// 현재 위치 (GPS 를 받기 전/실패 시에는 이 기본 좌표를 쓴다)
let currentLat = 37.4852;
let currentLng = 126.7816;

// ===== v2.3 추가: 로그인 / 마이페이지 / 운동일지 / 다이어트 목표 =====
const storagePrefix = 'routineNote:';
const demoUserId = 'testuser';
const userDataKeys = ['workout', 'bodyProfile', 'bodyRecords', 'dietGoal', 'exerciseLogs', 'gpsLogs'];

// 메뉴 하위 화면은 하단 탭에서 '메뉴'가 선택된 것으로 표시한다
const subPageParentNav = { 'tab-calorie': 'tab-menu', 'tab-bmr': 'tab-menu' };

// TODAY_ROUTINE_SELECTION.routine_type 과 같은 값 (RUNNING / WEIGHT / REST), 직접 입력은 CUSTOM
const defaultRoutineNames = {
    RUNNING: '🏃‍♂️ 런닝 (GPS 지도)',
    WEIGHT: '🏋️ 운동 (웨이트)',
    REST: '🧘 휴식 및 스트레칭'
};

// 완료한 항목 1개당 예상 소모 칼로리 (정확한 측정값이 아니라 화면 표시용 추정치)
const estimatedKcalByType = { RUNNING: 400, WEIGHT: 250, REST: 40, CUSTOM: 150 };

// 칼로리 계산기: 소모 칼로리 = MET x 체중(kg) x 시간(h)
const activityMets = [
    { key: 'walk', label: '걷기', met: 3.5 },
    { key: 'jog', label: '조깅', met: 7.0 },
    { key: 'run', label: '달리기', met: 9.8 },
    { key: 'bike', label: '자전거', met: 7.5 },
    { key: 'swim', label: '수영', met: 8.0 },
    { key: 'weight', label: '웨이트', met: 5.0 },
    { key: 'yoga', label: '요가', met: 2.5 },
    { key: 'rope', label: '줄넘기', met: 11.0 },
    { key: 'hike', label: '등산', met: 6.5 }
];

// 기초대사량 분석: 활동대사량 = 기초대사량 x 활동 계수
const activityLevels = [
    { key: 'sedentary', label: '거의 운동 안 함', factor: 1.2 },
    { key: 'light', label: '주 1~3회 가벼운 운동', factor: 1.375 },
    { key: 'moderate', label: '주 3~5회 운동', factor: 1.55 },
    { key: 'active', label: '주 6~7회 운동', factor: 1.725 },
    { key: 'veryActive', label: '매일 강한 운동', factor: 1.9 }
];

const goalAdjustments = {
    lose: { label: '감량', kcal: -500 },
    keep: { label: '유지', kcal: 0 },
    gain: { label: '증량', kcal: 300 }
};

let currentUser = null;
let profileName = ''; // 초기값 설정 화면에서 입력한 이름 (없으면 아이디를 대신 보여 준다)
let authMode = 'login';
let bodyProfile = { gender: 'male', age: 28, height: 175, weight: 72.5 };
let bodyRecords = [];
let dietGoal = null;
let exerciseLogs = {};
let gpsLogs = [];
let nextExerciseLogId = 1;
let isWorkoutCustom = false;
let activeDetailPanel = 'routine';
let selectedGoalKey = 'lose';
let isResetArmed = false;
let resetArmTimerId = null;
let hasShownStorageWarning = false;

// 타이머 / 스톱워치 상태 (baseMs: 멈춰 있을 때의 값. 스톱워치는 누적 시간, 타이머는 남은 시간)
const clockState = {
    mode: 'stopwatch',
    isRunning: false,
    startedAt: 0,
    baseMs: 0,
    presetMs: 60000,
    intervalId: null
};

document.addEventListener('DOMContentLoaded', () => {
    initApp();

    // Auto Clock
    setInterval(() => {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        document.getElementById('statusBarTime').textContent = `${hrs}:${mins}`;
    }, 10000);
});


/* ==========================================
   2. SPA Navigation & Dark Mode
   ========================================== */



/* ==========================================
   3. 날짜 도우미 & DOM 도우미
   ========================================== */
function getTodayKey() {
    return formatDateKey(new Date());
}

// 로컬 시간 기준 'YYYY-MM-DD' (toISOString 은 시간대 때문에 하루 어긋날 수 있다)
function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function addDays(date, amount) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + amount);
    return nextDate;
}

function formatKoreanDate(dateKey) {
    const date = parseDateKey(dateKey);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdayNames[date.getDay()]})`;
}

function createIcon(iconClass) {
    const iconElement = document.createElement('i');
    iconElement.className = iconClass;
    iconElement.setAttribute('aria-hidden', 'true');
    return iconElement;
}

// 아이콘 + 글자를 안전하게 넣는다 (글자는 텍스트 노드로만 들어간다)
function setIconText(element, iconClass, text) {
    element.replaceChildren(createIcon(iconClass), document.createTextNode(text));
}

function createMessageBox(text, className) {
    const boxElement = document.createElement('div');
    boxElement.className = className;
    boxElement.textContent = text;
    return boxElement;
}

/* ==========================================
   4. 운동 기록 불러오기 (Promise + async/await)
   ========================================== */

// Mock 데이터: 오늘 기준으로 과거 기록을 만든다 (null = 기록 없음)

// 서버 응답을 흉내 내는 Promise (실제 연동 시 이 함수를 fetch 로 교체)
function requestWorkoutData(userId) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            try {
                resolve(buildMockWorkoutState());
            } catch (error) {
                reject(error);
            }
        }, mockDelayMs);
    });
}


async function loadWorkoutData() {
    setCalendarLoading(true);

    try {
        workoutState = await getWorkoutState(mockUserId);
        isWorkoutLoaded = true;
        // 데이터가 도착한 뒤에만 화면(오늘 체크리스트 / 달력 / 연속 달성)을 갱신한다
        refreshAllViews();
    } catch (error) {
        console.error('운동 기록 불러오기 실패:', error);
        showToast('운동 기록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
        setCalendarLoading(false);
    }
}

function setCalendarLoading(isLoading) {
    const cardElement = document.getElementById('calendarCard');
    cardElement.classList.toggle('opacity-60', isLoading);
    cardElement.setAttribute('aria-busy', String(isLoading));
}

/* ==========================================
   5. WORKOUT_LOG 계산 / 연속 달성 / 화면 갱신
   ========================================== */

// 하루의 상태: none(항목 없음) / completed(전부 완료) / partial(일부 완료) / incomplete(전부 미완료)
function getDayStatus(routines) {
    if (!routines || routines.length === 0) return 'none';

    const completedCount = routines.filter(item => item.completed).length;
    if (completedCount === routines.length) return 'completed';
    if (completedCount > 0) return 'partial';
    return 'incomplete';
}

// 하루도 빠짐없이 이어진 '루틴 완수'만 연속으로 센다
function applyStreakValues(rawLogs) {
    const sortedLogs = [...rawLogs].sort((a, b) => a.workoutDate.localeCompare(b.workoutDate));

    let runningStreak = 0;
    let previousDateKey = null;
    let previousCompleted = false;

    return sortedLogs.map(log => {
        const isNextDay = previousDateKey !== null
            && formatDateKey(addDays(parseDateKey(previousDateKey), 1)) === log.workoutDate;

        if (!log.isCompleted) {
            runningStreak = 0;
        } else if (previousCompleted && isNextDay) {
            runningStreak += 1;
        } else {
            runningStreak = 1;
        }

        previousDateKey = log.workoutDate;
        previousCompleted = log.isCompleted;

        return { ...log, currentStreak: runningStreak };
    });
}

// workoutState 로부터 WORKOUT_LOG 행을 만든다 (workoutLogId 는 Mock 용 임시 번호)
function buildWorkoutLogs() {
    const dateKeys = Object.keys(workoutState)
        .filter(dateKey => workoutState[dateKey].length > 0)
        .sort();

    const rawLogs = dateKeys.map((dateKey, index) => ({
        workoutLogId: 1000 + index,
        userId: mockUserId,
        workoutDate: dateKey,
        isCompleted: getDayStatus(workoutState[dateKey]) === 'completed'
    }));

    return applyStreakValues(rawLogs);
}

function calculateDisplayStreak() {
    const completedLogs = workoutLogs
        .filter(log => log.isCompleted)
        .sort((a, b) => b.workoutDate.localeCompare(a.workoutDate));

    if (completedLogs.length === 0) return 0;

    const todayKey = getTodayKey();
    const yesterdayKey = formatDateKey(addDays(new Date(), -1));
    const latestLog = completedLogs[0];

    // 가장 최근 완수 기록이 오늘 또는 어제여야 연속이 이어지는 중이다
    const isStreakAlive = latestLog.workoutDate === todayKey || latestLog.workoutDate === yesterdayKey;
    return isStreakAlive ? latestLog.currentStreak : 0;
}

function renderStreak() {
    const streakDays = calculateDisplayStreak();

    document.getElementById('streakCount').textContent = String(streakDays);
    document.getElementById('streakSuffix').textContent = streakDays > 0
        ? '일째 성공 중'
        : '일 (오늘 운동으로 다시 시작해 보세요)';
}


/* ==========================================
   6. 오늘의 체크리스트 (초안 기능 유지, DOM API 로 재작성)
   ========================================== */

function createCheckBox(isCompleted, extraClass) {
    const boxElement = document.createElement('span');
    boxElement.className = `w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold transition ${extraClass} ${isCompleted ? 'bg-brand-600 text-white' : 'border-2 border-slate-300 dark:border-slate-600 text-transparent'}`;
    boxElement.appendChild(createIcon('fa-solid fa-check'));
    return boxElement;
}

function renderTodayChecklist() {
    const container = document.getElementById('todayChecklistContainer');
    const todayKey = getTodayKey();
    const routines = workoutState[todayKey] || [];

    container.replaceChildren();

    if (!isWorkoutLoaded) {
        container.appendChild(createMessageBox('운동 기록을 불러오는 중이에요.', 'text-center py-4 text-xs text-slate-400'));
        return;
    }

    if (routines.length === 0) {
        container.appendChild(createMessageBox('오늘 등록된 운동 루틴이 없습니다.', 'text-center py-4 text-xs text-slate-400'));
        updateTodayProgress(0, 0);
        return;
    }

    let completedCount = 0;

    routines.forEach(item => {
        if (item.completed) completedCount++;

        const rowElement = document.createElement('div');
        rowElement.className = `flex items-center justify-between p-2.5 rounded-xl border ${item.completed ? 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700/60' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'} transition`;

        const toggleButton = document.createElement('button');
        toggleButton.type = 'button';
        toggleButton.className = 'flex items-center space-x-3 text-left';
        toggleButton.setAttribute('aria-pressed', String(item.completed));
        toggleButton.addEventListener('click', () => toggleRoutineStatus(todayKey, item.id));

        const nameElement = document.createElement('span');
        nameElement.className = `text-xs font-bold ${item.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`;
        nameElement.textContent = item.name;

        toggleButton.append(createCheckBox(item.completed, ''), nameElement);

        const badgeElement = document.createElement('span');
        badgeElement.className = `text-[10px] font-bold px-2 py-0.5 rounded ${item.completed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`;
        badgeElement.textContent = item.completed ? '완료' : '진행중';

        rowElement.append(toggleButton, badgeElement);
        container.appendChild(rowElement);
    });

    updateTodayProgress(completedCount, routines.length);
}

/* ==========================================
   7. FullCalendar 6.1.8 (와이어프레임 21번)
   ========================================== */
function initCalendar() {
    const calendarElement = document.getElementById('fullCalendar');

    if (typeof FullCalendar === 'undefined') {
        calendarElement.textContent = '달력을 불러오지 못했어요. 네트워크 연결을 확인해 주세요.';
        return;
    }

    calendarInstance = new FullCalendar.Calendar(calendarElement, {
        initialView: 'dayGridMonth',
        locale: 'ko',
        height: 'auto',
        fixedWeekCount: false,
        headerToolbar: { left: 'prev', center: 'title', right: 'today next' },
        buttonText: { today: '오늘' },
        titleFormat: { year: 'numeric', month: 'long' },
        dayMaxEvents: 1,
        eventInteractive: true,
        dayCellContent: (arg) => String(arg.date.getDate()),
        eventContent: createEventContent,
        dateClick: (info) => openDetailModal(info.dateStr),
        eventClick: (info) => openDetailModal(info.event.startStr.slice(0, 10))
    });

    calendarInstance.render();
}

// 이벤트를 막대 대신 상태 점으로 그린다. DOM 노드를 직접 만들어 넘긴다.
function createEventContent(arg) {
    const status = arg.event.extendedProps.status;

    const dotElement = document.createElement('span');
    dotElement.className = `log-dot log-dot--${status}`;
    dotElement.setAttribute('role', 'img');
    dotElement.setAttribute('aria-label', statusLabels[status]);

    return { domNodes: [dotElement] };
}

function buildCalendarEvents() {
    return workoutLogs.map(log => {
        const status = getDayStatus(workoutState[log.workoutDate]);

        return {
            id: String(log.workoutLogId),
            title: statusLabels[status],
            start: log.workoutDate,
            allDay: true,
            extendedProps: {
                status: status,
                isCompleted: log.isCompleted,
                currentStreak: log.currentStreak
            }
        };
    });
}

function renderCalendarEvents() {
    if (calendarInstance === null) return;

    calendarInstance.removeAllEvents();
    calendarInstance.addEventSource(buildCalendarEvents());
}

/* ==========================================
   8. 모달 공통 / 날짜 상세 모달 (운동 항목 확인·추가·삭제)
   ========================================== */
function isModalOpen(modalElement) {
    return !modalElement.classList.contains('opacity-0');
}

function showModalElement(modalElement) {
    lastFocusedElement = document.activeElement;

    modalElement.inert = false;
    modalElement.classList.remove('opacity-0', 'pointer-events-none');

    const firstButton = modalElement.querySelector('button');
    if (firstButton) firstButton.focus();
}

function hideModalElement(modalElement) {
    modalElement.classList.add('opacity-0', 'pointer-events-none');
    modalElement.inert = true;

    if (lastFocusedElement && document.contains(lastFocusedElement)) {
        lastFocusedElement.focus();
    }
}



function closeDetailModal() {
    hideModalElement(document.getElementById('detailModal'));
    refreshAllViews();
}

function createModalEmptyState() {
    const boxElement = document.createElement('div');
    boxElement.className = 'text-center py-6 text-xs text-slate-400';

    const iconElement = createIcon('fa-solid fa-dumbbell text-xl mb-1.5 block opacity-50');
    boxElement.append(
        iconElement,
        '등록된 운동 항목이 없습니다.',
        document.createElement('br'),
        '아래에서 새 운동을 추가해 보세요!'
    );
    return boxElement;
}

function createModalRoutineRow(item, dateStr) {
    const rowElement = document.createElement('div');
    rowElement.className = 'flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/60';

    const leftElement = document.createElement('div');
    leftElement.className = 'flex items-center space-x-2.5';

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = `w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold transition ${item.completed ? 'bg-brand-600 text-white' : 'border-2 border-slate-300 dark:border-slate-600 text-transparent bg-white dark:bg-slate-800'}`;
    toggleButton.setAttribute('aria-label', '완료 상태 바꾸기');
    toggleButton.setAttribute('aria-pressed', String(item.completed));
    toggleButton.appendChild(createIcon('fa-solid fa-check'));
    toggleButton.addEventListener('click', () => toggleRoutineStatus(dateStr, item.id));

    const nameElement = document.createElement('span');
    nameElement.className = `text-xs font-bold ${item.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`;
    nameElement.textContent = item.name;

    leftElement.append(toggleButton, nameElement);

    const rightElement = document.createElement('div');
    rightElement.className = 'flex items-center space-x-1.5';

    const badgeElement = document.createElement('span');
    badgeElement.className = `text-[9px] font-bold px-1.5 py-0.5 rounded ${item.completed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'}`;
    badgeElement.textContent = item.completed ? '완료' : '미완료';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'text-slate-300 dark:text-slate-600 hover:text-red-500 transition px-1';
    deleteButton.setAttribute('aria-label', '운동 항목 삭제');
    deleteButton.appendChild(createIcon('fa-solid fa-trash-can text-xs'));
    deleteButton.addEventListener('click', () => deleteRoutineItem(dateStr, item.id));

    rightElement.append(badgeElement, deleteButton);
    rowElement.append(leftElement, rightElement);
    return rowElement;
}

function renderModalRoutineList() {
    const listElement = document.getElementById('modalRoutineList');
    const routines = workoutState[currentActiveDate] || [];

    listElement.replaceChildren();

    if (routines.length === 0) {
        listElement.appendChild(createModalEmptyState());
        return;
    }

    routines.forEach(item => {
        listElement.appendChild(createModalRoutineRow(item, currentActiveDate));
    });
}




/* ==========================================
   9. 타이머 / 스톱워치 모달 (와이어프레임 23번)
   ========================================== */
function openTimerModal() {
    showModalElement(document.getElementById('timerModal'));
}

function closeTimerModal() {
    hideModalElement(document.getElementById('timerModal'));
}

// 지금 화면에 보여줄 시간(ms)
function getClockMs() {
    if (!clockState.isRunning) return clockState.baseMs;

    const elapsedMs = Date.now() - clockState.startedAt;
    if (clockState.mode === 'stopwatch') {
        return clockState.baseMs + elapsedMs;
    }
    return Math.max(0, clockState.baseMs - elapsedMs);
}

// 스톱워치는 내림, 타이머는 올림 (끝나기 직전까지 00:00:01 로 보이게)
function formatClock(ms, mode) {
    const totalSeconds = mode === 'timer' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function setClockMessage(message) {
    document.getElementById('clockMessage').textContent = message;
}

function stopClockInterval() {
    clearInterval(clockState.intervalId);
    clockState.intervalId = null;
}

function updateClockUi() {
    const displayElement = document.getElementById('clockDisplay');
    displayElement.textContent = formatClock(getClockMs(), clockState.mode);
    displayElement.classList.toggle(
        'clock-finished',
        clockState.mode === 'timer' && !clockState.isRunning && clockState.baseMs === 0
    );

    const hasProgress = clockState.baseMs > 0
        && (clockState.mode === 'stopwatch' || clockState.baseMs < clockState.presetMs);

    let toggleLabel = '시작';
    if (clockState.isRunning) {
        toggleLabel = '일시정지';
    } else if (hasProgress) {
        toggleLabel = '계속';
    }
    document.getElementById('clockToggleButton').textContent = toggleLabel;

    // 프리셋 버튼: 선택 표시 + 실행 중에는 변경 불가
    document.getElementById('presetRow').querySelectorAll('button').forEach(presetButton => {
        const presetMs = Number(presetButton.dataset.seconds) * 1000;
        presetButton.setAttribute('aria-pressed', String(presetMs === clockState.presetMs));
        presetButton.disabled = clockState.isRunning;
    });
}

function setClockMode(mode) {
    stopClockInterval();

    clockState.mode = mode;
    clockState.isRunning = false;
    clockState.baseMs = mode === 'stopwatch' ? 0 : clockState.presetMs;

    document.getElementById('modeStopwatchButton').setAttribute('aria-pressed', String(mode === 'stopwatch'));
    document.getElementById('modeTimerButton').setAttribute('aria-pressed', String(mode === 'timer'));
    document.getElementById('presetRow').classList.toggle('hidden', mode !== 'timer');

    setClockMessage('');
    updateClockUi();
}

function startClock() {
    // 타이머가 끝난 뒤 다시 누르면 선택해 둔 시간부터 다시 시작
    if (clockState.mode === 'timer' && clockState.baseMs <= 0) {
        clockState.baseMs = clockState.presetMs;
    }

    clockState.isRunning = true;
    clockState.startedAt = Date.now();
    clockState.intervalId = setInterval(tickClock, 200);

    setClockMessage('');
    updateClockUi();
}

function pauseClock() {
    // isRunning 을 끄기 전에 현재 값을 먼저 저장해야 한다
    clockState.baseMs = getClockMs();
    clockState.isRunning = false;
    stopClockInterval();
    updateClockUi();
}

function resetClock() {
    stopClockInterval();

    clockState.isRunning = false;
    clockState.baseMs = clockState.mode === 'stopwatch' ? 0 : clockState.presetMs;

    setClockMessage('');
    updateClockUi();
}

function tickClock() {
    const currentMs = getClockMs();
    document.getElementById('clockDisplay').textContent = formatClock(currentMs, clockState.mode);

    if (clockState.mode === 'timer' && currentMs <= 0) {
        finishTimer();
    }
}

function finishTimer() {
    stopClockInterval();

    clockState.isRunning = false;
    clockState.baseMs = 0;

    setClockMessage('시간이 끝났어요. 다음 세트를 시작해 보세요.');
    showToast('타이머가 끝났어요.');
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

    updateClockUi();
}

function bindClockEvents() {
    document.getElementById('timerOpenButton').addEventListener('click', openTimerModal);

    document.getElementById('modeStopwatchButton').addEventListener('click', () => setClockMode('stopwatch'));
    document.getElementById('modeTimerButton').addEventListener('click', () => setClockMode('timer'));

    document.getElementById('clockToggleButton').addEventListener('click', () => {
        if (clockState.isRunning) {
            pauseClock();
        } else {
            startClock();
        }
    });

    document.getElementById('clockResetButton').addEventListener('click', resetClock);

    // 프리셋 버튼은 이벤트 위임으로 처리
    document.getElementById('presetRow').addEventListener('click', (event) => {
        const presetButton = event.target.closest('button[data-seconds]');
        if (!presetButton || clockState.isRunning) return;

        clockState.presetMs = Number(presetButton.dataset.seconds) * 1000;
        clockState.baseMs = clockState.presetMs;

        setClockMessage('');
        updateClockUi();
    });
}

/* ==========================================
   앱 시작 (로그인 세션이 있으면 바로 시작, 없으면 로그인 화면)
   ========================================== */
async function initApp() {
    bindAuthEvents();
    bindHeaderButtons();
    bindModalShortcuts();
    bindClockEvents();
    bindFeatureEvents();
    initCalculatorOptions();
    setClockMode('stopwatch');

    applyTheme(readStorage('theme', 'light'));
    document.getElementById('todayBannerDate').textContent = formatKoreanDate(getTodayKey());

    initCalendar();
    initKakaoMap();
    renderTodayChecklist();   // 로딩 안내를 먼저 보여준다

    ensureDemoAccount();
    const savedSession = readStorage('session', null);
    const savedAccount = savedSession ? findAccount(savedSession.userId) : null;

    if (savedAccount) {
        await beginSession(savedAccount, false);
    } else {
        showLoginScreen();
    }
}

/* ==========================================
   저장 계층 (localStorage)
   서버(MySQL)가 준비되기 전까지는 브라우저에 저장한다.
   서버가 준비되면 requestStoredValue / saveStoredValue 안을 fetch 로 바꾸면 된다.
   ========================================== */
function readStorage(key, fallbackValue) {
    try {
        const rawValue = localStorage.getItem(storagePrefix + key);
        return rawValue === null ? fallbackValue : JSON.parse(rawValue);
    } catch (error) {
        return fallbackValue;
    }
}

function writeStorage(key, value) {
    try {
        localStorage.setItem(storagePrefix + key, JSON.stringify(value));
        return true;
    } catch (error) {
        return false;
    }
}

function removeStorage(key) {
    try {
        localStorage.removeItem(storagePrefix + key);
    } catch (error) {
        // 저장 공간을 쓸 수 없는 환경이면 지울 것도 없다
    }
}

function getUserKey(name) {
    return `user:${currentUser.userId}:${name}`;
}

// 화면에 보여 줄 이름: 초기값 설정에서 입력한 이름이 있으면 그것, 없으면 아이디
function getDisplayName() {
    return profileName !== '' ? profileName : currentUser.userId;
}

function requestStoredValue(name, fallbackValue) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(readStorage(getUserKey(name), fallbackValue)), 0);
    });
}

async function saveStoredValue(name, value) {
    const isSaved = await new Promise((resolve) => {
        setTimeout(() => resolve(writeStorage(getUserKey(name), value)), 0);
    });

    if (!isSaved && !hasShownStorageWarning) {
        hasShownStorageWarning = true;
        showToast('브라우저 저장 공간을 쓸 수 없어요. 새로고침하면 변경이 사라질 수 있어요.');
    }
    return isSaved;
}

/* ==========================================
   로그인 / 회원가입 (와이어프레임 1~5번)
   [임시] 서버 연동 전 Mock 이다. 비밀번호는 저장하지도, 검증하지도 않는다.
   서버가 준비되면 requestLogin / requestJoin / requestKakaoLogin 안을 fetch 로 바꾼다.
   (USER 테이블: user_id, password(해시), provider)
   ========================================== */
function simulateServerDelay(delayMs) {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function getAccounts() {
    const accounts = readStorage('accounts', []);
    return Array.isArray(accounts) ? accounts : [];
}

function findAccount(userId) {
    return getAccounts().find(account => account.userId === userId) || null;
}

// 서버의 테스트 사용자(testuser)와 같은 아이디를 미리 만들어 둔다
function ensureDemoAccount() {
    if (findAccount(demoUserId) !== null) return;

    const accounts = getAccounts();
    accounts.push({ userId: demoUserId, provider: 'local', createdAt: getTodayKey() });
    writeStorage('accounts', accounts);
}

function checkCredentialFormat(userId, password) {
    if (!/^[a-zA-Z0-9_]{4,20}$/.test(userId)) return '아이디는 영문, 숫자, _ 로 4~20자여야 해요.';
    if (password.length < 6) return '비밀번호는 6자 이상 입력해 주세요.';
    return '';
}

async function requestLogin(userId) {
    await simulateServerDelay(250);

    const account = findAccount(userId);
    if (account === null) {
        return { ok: false, message: '가입되지 않은 아이디예요. Join 을 눌러 가입해 주세요.' };
    }
    return { ok: true, account: account };
}

async function requestJoin(userId, password, confirmPassword) {
    await simulateServerDelay(250);

    if (password !== confirmPassword) {
        return { ok: false, message: '비밀번호 확인이 일치하지 않아요.' };
    }
    if (findAccount(userId) !== null) {
        return { ok: false, message: '이미 사용 중인 아이디예요.' };
    }

    const account = { userId: userId, provider: 'local', createdAt: getTodayKey() };
    const accounts = getAccounts();
    accounts.push(account);
    writeStorage('accounts', accounts);
    return { ok: true, account: account };
}

// 실제로는 카카오 로그인 SDK 로 받은 토큰을 서버가 검증한 뒤 USER(provider='kakao')를 만든다
async function requestKakaoLogin() {
    await simulateServerDelay(250);

    const kakaoUserId = 'kakao_user';
    let account = findAccount(kakaoUserId);

    if (account === null) {
        account = { userId: kakaoUserId, provider: 'kakao', createdAt: getTodayKey() };
        const accounts = getAccounts();
        accounts.push(account);
        writeStorage('accounts', accounts);
    }
    return { ok: true, account: account };
}

function setAuthMode(mode) {
    authMode = mode;
    const isJoin = mode === 'join';

    document.getElementById('joinConfirmField').classList.toggle('hidden', !isJoin);
    document.getElementById('loginSubmitButton').textContent = isJoin ? '회원가입' : 'Login';
    document.getElementById('authModeToggle').textContent = isJoin ? '로그인으로 돌아가기' : 'Join';
    document.getElementById('authSubtitle').textContent = isJoin
        ? '새 계정을 만들어 운동 기록을 시작해요'
        : '운동 루틴을 기록하고 이어가요';
    document.getElementById('loginPassword').autocomplete = isJoin ? 'new-password' : 'current-password';
    setAuthMessage('');
}

function setAuthMessage(message) {
    document.getElementById('loginMessage').textContent = message;
}

function setAuthBusy(isBusy) {
    ['loginSubmitButton', 'kakaoLoginButton', 'authModeToggle'].forEach(buttonId => {
        document.getElementById(buttonId).disabled = isBusy;
    });
}

// 로그인 화면이 떠 있는 동안에는 뒤쪽 화면에 포커스가 가지 않게 한다
function setAppInert(isInert) {
    ['mainHeader', 'mainScrollBody', 'mainNav'].forEach(elementId => {
        const element = document.getElementById(elementId);
        if (element) element.inert = isInert;
    });
}

function showLoginScreen() {
    const loginScreen = document.getElementById('loginScreen');
    loginScreen.classList.remove('hidden');
    loginScreen.inert = false;
    setAppInert(true);
    setAuthMode('login');
    document.getElementById('loginUserId').focus();
}

function hideLoginScreen() {
    const loginScreen = document.getElementById('loginScreen');
    loginScreen.classList.add('hidden');
    loginScreen.inert = true;
    setAppInert(false);

    ['loginUserId', 'loginPassword', 'joinPasswordConfirm'].forEach(inputId => {
        document.getElementById(inputId).value = '';
    });
    setAuthMessage('');
}

function bindAuthEvents() {
    document.getElementById('loginForm').addEventListener('submit', handleAuthSubmit);
    document.getElementById('authModeToggle').addEventListener('click', () => {
        setAuthMode(authMode === 'login' ? 'join' : 'login');
    });
    document.getElementById('kakaoLoginButton').addEventListener('click', handleKakaoLogin);
}

async function handleAuthSubmit(event) {
    event.preventDefault();

    const userId = document.getElementById('loginUserId').value.trim();
    const password = document.getElementById('loginPassword').value;
    const confirmPassword = document.getElementById('joinPasswordConfirm').value;

    const formatError = checkCredentialFormat(userId, password);
    if (formatError) {
        setAuthMessage(formatError);
        return;
    }

    setAuthBusy(true);
    const result = authMode === 'join'
        ? await requestJoin(userId, password, confirmPassword)
        : await requestLogin(userId);
    setAuthBusy(false);

    if (!result.ok) {
        setAuthMessage(result.message);
        return;
    }
    await beginSession(result.account, true);
}

async function handleKakaoLogin() {
    setAuthBusy(true);
    const result = await requestKakaoLogin();
    setAuthBusy(false);

    if (result.ok) await beginSession(result.account, true);
}

async function beginSession(account, isFreshLogin) {
    currentUser = { userId: account.userId, provider: account.provider, createdAt: account.createdAt };
    writeStorage('session', { userId: account.userId });
    hideLoginScreen();

    // [초기값 설정] 저장된 신체 정보가 없는 첫 로그인이면 성별·나이·키·몸무게부터 받는다 (js/onboarding.js)
    if (await needsOnboarding()) await runOnboarding();

    await loadUserData();
    applyBodyProfileToInputs();
    await calculateBodyMetrics(false);
    await loadWorkoutData();

    switchTab('tab-today');
    if (isFreshLogin) showToast(`${getDisplayName()} 님, 환영해요!`);
}

function closeAllModals() {
    [['detailModal', closeDetailModal], ['timerModal', closeTimerModal], ['successModal', closeSuccessModal]]
        .forEach(([modalId, closeAction]) => {
            if (isModalOpen(document.getElementById(modalId))) closeAction();
        });
}

function logout() {
    removeStorage('session');
    closeAllModals();
    resetClock();
    if (isRunning) toggleRunningSimulation();

    currentUser = null;
    profileName = '';
    workoutState = {};
    workoutLogs = [];
    isWorkoutLoaded = false;
    isWorkoutCustom = false;

    renderCalendarEvents();
    renderStreak();
    renderTodayChecklist();
    switchTab('tab-today');
    showLoginScreen();
}

// 로그인한 사용자의 저장 데이터를 한 번에 불러온다 (없으면 예시 데이터)
async function loadUserData() {
    const [storedName, storedProfile, storedRecords, storedGoal, storedLogs, storedGps] = await Promise.all([
        requestStoredValue('profileName', ''),
        requestStoredValue('bodyProfile', null),
        requestStoredValue('bodyRecords', null),
        requestStoredValue('dietGoal', null),
        requestStoredValue('exerciseLogs', null),
        requestStoredValue('gpsLogs', null)
    ]);

    profileName = typeof storedName === 'string' ? storedName.trim() : '';

    bodyProfile = isValidBodyProfile(storedProfile)
        ? storedProfile
        : { gender: 'male', age: 28, height: 175, weight: 72.5 };

    bodyRecords = Array.isArray(storedRecords) && storedRecords.length > 0
        ? storedRecords
        : buildMockBodyRecords();

    dietGoal = storedGoal && typeof storedGoal === 'object' && !Array.isArray(storedGoal)
        ? storedGoal
        : buildMockDietGoal();

    exerciseLogs = storedLogs && typeof storedLogs === 'object' && !Array.isArray(storedLogs)
        ? storedLogs
        : {};

    gpsLogs = Array.isArray(storedGps) ? storedGps : [];

    const loggedIds = Object.values(exerciseLogs).flat().map(entry => entry.id || 0);
    nextExerciseLogId = Math.max(0, ...loggedIds) + 1;
}

/* ==========================================
   다크 모드 / 탭 전환
   ========================================== */
function applyTheme(themeName) {
    const isDark = themeName === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.classList.toggle('light', !isDark);

    const darkSwitch = document.getElementById('darkModeSwitch');
    if (darkSwitch) darkSwitch.setAttribute('aria-checked', String(isDark));
}

function toggleDarkMode() {
    const willBeDark = !document.documentElement.classList.contains('dark');
    applyTheme(willBeDark ? 'dark' : 'light');
    writeStorage('theme', willBeDark ? 'dark' : 'light');
    showToast(willBeDark ? '다크 모드로 전환되었습니다.' : '라이트 모드로 전환되었습니다.');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-screen').forEach(tab => {
        tab.classList.add('hidden');
    });

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-brand-600', 'dark:text-brand-400', 'font-bold');
        btn.classList.add('text-slate-400', 'font-medium');
    });

    const navTabId = subPageParentNav[tabId] || tabId;
    const activeNav = document.getElementById('nav-' + navTabId);
    if (activeNav) {
        activeNav.classList.remove('text-slate-400', 'font-medium');
        activeNav.classList.add('text-brand-600', 'dark:text-brand-400', 'font-bold');
    }

    document.getElementById('mainScrollBody').scrollTop = 0;

    if (tabId === 'tab-running') {
        setTimeout(relayoutKakaoMap, 100);
    }

    // 숨겨져 있던 탭에서 달력이 처음 보일 때 크기를 다시 계산한다
    if (tabId === 'tab-calendar' && calendarInstance !== null) {
        setTimeout(() => calendarInstance.updateSize(), 0);
    }

    if (tabId === 'tab-mypage') {
        fillGoalForm();
        renderMyPage();
    }
    if (tabId === 'tab-body') renderDietSection();
    if (tabId === 'tab-bmr') renderBmrAnalysis();
    if (tabId === 'tab-calorie') prefillCalorieWeight();
}

// 헤더의 R 로고: 어느 화면에서든 메인(오늘 루틴) 화면으로 돌아간다
function goHome() {
    closeAllModals();
    switchTab('tab-today');
}

function bindHeaderButtons() {
    // 와이어프레임 20번의 마이페이지 버튼
    document.getElementById('profileButton').addEventListener('click', () => {
        switchTab('tab-mypage');
    });
}

/* ==========================================
   운동 기록 (불러오기 / 저장)
   ========================================== */

// Mock 데이터: 오늘 기준으로 과거 기록을 만든다 (null = 기록 없음)
function buildMockWorkoutState() {
    const statusByDaysAgo = [
        'done', 'done', 'done', 'done', 'done', 'done',                       // 1~6일 전: 6일 연속 완수
        'partial',                                                            // 7일 전: 일부 완료 (연속 끊김)
        'done', 'done', 'done',                                               // 8~10일 전
        null,                                                                 // 11일 전: 기록 없음
        'done', 'done',                                                       // 12~13일 전
        'missed',                                                             // 14일 전: 전부 미완료
        'done', 'done', 'done', 'done', 'done', 'done', 'done', 'done',       // 15~22일 전
        null, 'done', 'done', 'partial', 'done', 'done', 'done'               // 23~29일 전
    ];

    const today = new Date();
    const mockState = {};
    let routineId = 1;

    const createItem = (routineType, completed) => ({
        id: routineId++,
        name: defaultRoutineNames[routineType],
        completed: completed,
        routineType: routineType
    });

    statusByDaysAgo.forEach((status, index) => {
        if (status === null) return;

        const dateKey = formatDateKey(addDays(today, -(index + 1)));
        const secondType = index % 2 === 0 ? 'WEIGHT' : 'REST';

        if (status === 'done') {
            mockState[dateKey] = [createItem('RUNNING', true), createItem(secondType, true)];
        } else if (status === 'partial') {
            mockState[dateKey] = [createItem('RUNNING', true), createItem(secondType, false)];
        } else {
            mockState[dateKey] = [createItem('WEIGHT', false)];
        }
    });

    // 오늘: 3개 항목 (2개 완료)
    mockState[getTodayKey()] = [
        createItem('RUNNING', true),
        createItem('WEIGHT', true),
        createItem('REST', false)
    ];

    // 모레: 예정된 운동
    mockState[formatDateKey(addDays(today, 2))] = [
        { id: routineId++, name: '🏋️ 운동 (하체 데이)', completed: false, routineType: 'WEIGHT' }
    ];

    nextRoutineId = routineId;
    return mockState;
}

async function getWorkoutState(userId) {
    // 백엔드가 준비되면 아래 주석을 풀고 저장 계층 호출을 지우면 된다.
    // const response = await fetch(`/api/users/${userId}/workout-logs`);
    // if (!response.ok) {
    //     throw new Error(`운동 기록 요청 실패 (HTTP ${response.status})`);
    // }
    // return await response.json();

    // 사용자가 직접 고친 기록이 있으면 그것을 쓰고, 없으면 예시 데이터를 만든다
    const storedWorkout = await requestStoredValue('workout', null);

    if (storedWorkout && storedWorkout.isCustom && storedWorkout.state) {
        const usedIds = Object.values(storedWorkout.state).flat().map(item => item.id || 0);
        nextRoutineId = Math.max(storedWorkout.nextRoutineId || 1, Math.max(0, ...usedIds) + 1);
        isWorkoutCustom = true;
        return storedWorkout.state;
    }

    isWorkoutCustom = false;
    return await requestWorkoutData(userId);
}

async function persistWorkoutState() {
    await saveStoredValue('workout', {
        isCustom: true,
        nextRoutineId: nextRoutineId,
        state: workoutState
    });
}

// 운동 항목이 바뀔 때마다 부르는 공통 함수: 화면 갱신 + 저장
async function commitWorkoutChange() {
    isWorkoutCustom = true;
    refreshAllViews();
    await persistWorkoutState();
}

function refreshAllViews() {
    workoutLogs = buildWorkoutLogs();
    renderTodayChecklist();
    renderRoutineSelection();
    renderCalendarEvents();
    renderStreak();

    if (currentUser !== null) {
        renderMyPage();
        renderDietSection();
    }
}

function estimateBurnedKcal(startDateKey, endDateKey) {
    let totalKcal = 0;

    Object.keys(workoutState).forEach(dateKey => {
        if (startDateKey && dateKey < startDateKey) return;
        if (endDateKey && dateKey > endDateKey) return;

        workoutState[dateKey].forEach(item => {
            if (item.completed) {
                totalKcal += estimatedKcalByType[item.routineType || 'CUSTOM'] || 150;
            }
        });
    });
    return totalKcal;
}

function updateTodayProgress(completedCount, totalCount) {
    const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    document.getElementById('todayPercentText').textContent = percent + '%';
    document.getElementById('todayProgressBar').style.width = percent + '%';
    setIconText(
        document.getElementById('todayTaskSummary'),
        'fa-solid fa-circle-check text-emerald-400 mr-1',
        `${totalCount}개 중 ${completedCount}개 완료`
    );

    const todayKey = getTodayKey();
    document.getElementById('todayKcalText').textContent = String(estimateBurnedKcal(todayKey, todayKey));
}

/* ==========================================
   모달 (닫기 / 날짜 상세 / 루틴 체크)
   ========================================== */
function bindModalShortcuts() {
    const modalActions = [
        { id: 'successModal', close: closeSuccessModal },
        { id: 'timerModal', close: closeTimerModal },
        { id: 'detailModal', close: closeDetailModal }
    ];

    // 어두운 배경을 누르면 닫기
    modalActions.forEach(action => {
        const modalElement = document.getElementById(action.id);
        modalElement.addEventListener('click', (event) => {
            if (event.target === modalElement) action.close();
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;

        const openedAction = modalActions.find(action => isModalOpen(document.getElementById(action.id)));
        if (openedAction) openedAction.close();
    });
}

function openDetailModal(dateStr, panelName) {
    currentActiveDate = dateStr;

    const status = getDayStatus(workoutState[dateStr]);
    const titleText = status === 'none'
        ? `${formatKoreanDate(dateStr)} 운동 목록`
        : `${formatKoreanDate(dateStr)} 운동 목록 · ${statusLabels[status]}`;

    setIconText(document.getElementById('modalDateTitle'), 'fa-solid fa-calendar-day', titleText);
    renderModalRoutineList();
    setDetailPanel(panelName || 'routine');

    showModalElement(document.getElementById('detailModal'));
}

async function toggleRoutineStatus(dateStr, itemId) {
    if (!workoutState[dateStr]) return;

    const item = workoutState[dateStr].find(routine => routine.id === itemId);
    if (!item) return;

    const wasCompleted = getDayStatus(workoutState[dateStr]) === 'completed';
    item.completed = !item.completed;

    renderModalRoutineList();
    await commitWorkoutChange();
    showToast(item.completed ? `"${item.name}" 완료 처리!` : `"${item.name}" 미완료 변경.`);

    const isNowCompleted = getDayStatus(workoutState[dateStr]) === 'completed';
    if (!wasCompleted && isNowCompleted && dateStr === getTodayKey()) {
        openSuccessModal();
    }
}

async function deleteRoutineItem(dateStr, itemId) {
    if (!workoutState[dateStr]) return;

    workoutState[dateStr] = workoutState[dateStr].filter(routine => routine.id !== itemId);
    renderModalRoutineList();
    await commitWorkoutChange();
    showToast('운동 항목이 삭제되었습니다.');
}

async function addNewRoutineItem(event) {
    event.preventDefault();

    const input = document.getElementById('newRoutineInput');
    const inputValue = input.value.trim();
    if (!inputValue) return;

    if (!workoutState[currentActiveDate]) {
        workoutState[currentActiveDate] = [];
    }

    workoutState[currentActiveDate].push({
        id: nextRoutineId++,
        name: inputValue,
        completed: false,
        routineType: 'CUSTOM'
    });

    input.value = '';
    renderModalRoutineList();
    await commitWorkoutChange();
    showToast('새 운동 항목이 추가되었습니다!');
}

/* ==========================================
   신체 데이터 (BODY_RECORD) / BMI / BMR
   ========================================== */
function setGender(gender) {
    selectedGender = gender;
    const maleBtn = document.getElementById('genderMale');
    const femaleBtn = document.getElementById('genderFemale');

    if (gender === 'male') {
        maleBtn.className = "py-2 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-2 transition border-brand-500 bg-blue-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300";
        femaleBtn.className = "py-2 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-2 transition border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300";
    } else {
        femaleBtn.className = "py-2 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-2 transition border-brand-500 bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-300";
        maleBtn.className = "py-2 rounded-xl border-2 font-bold text-xs flex items-center justify-center gap-2 transition border-slate-200 dark:border-slate-700 text-slate-500 hover:border-slate-300";
    }
}

function readBodyInputs() {
    return {
        gender: selectedGender,
        age: parseFloat(document.getElementById('inputAge').value),
        height: parseFloat(document.getElementById('inputHeight').value),
        weight: parseFloat(document.getElementById('inputWeight').value)
    };
}

function getBodyProfileError(profile) {
    if (!Number.isFinite(profile.age) || profile.age < 10 || profile.age > 100) {
        return '나이는 10~100세 사이로 입력해 주세요.';
    }
    if (!Number.isFinite(profile.height) || profile.height < 100 || profile.height > 250) {
        return '키는 100~250cm 사이로 입력해 주세요.';
    }
    if (!Number.isFinite(profile.weight) || profile.weight < 20 || profile.weight > 300) {
        return '몸무게는 20~300kg 사이로 입력해 주세요.';
    }
    return '';
}

function isValidBodyProfile(profile) {
    return Boolean(profile)
        && (profile.gender === 'male' || profile.gender === 'female')
        && getBodyProfileError(profile) === '';
}

function applyBodyProfileToInputs() {
    document.getElementById('inputAge').value = bodyProfile.age;
    document.getElementById('inputHeight').value = bodyProfile.height;
    document.getElementById('inputWeight').value = bodyProfile.weight;
    setGender(bodyProfile.gender);
}

function getBmiCategory(bmi) {
    if (bmi < 18.5) return { label: '저체중', needleAngle: 70 };
    if (bmi < 23) return { label: '정상', needleAngle: 25 };
    if (bmi < 25) return { label: '과체중', needleAngle: -25 };
    return { label: '비만', needleAngle: -70 };
}

// BMI = 체중 / 키(m)^2,  BMR = Mifflin-St Jeor 공식
function computeBodyMetrics(profile) {
    const heightM = profile.height / 100;
    const bmi = profile.weight / (heightM * heightM);

    let bmr = (10 * profile.weight) + (6.25 * profile.height) - (5 * profile.age);
    bmr += profile.gender === 'male' ? 5 : -161;

    const category = getBmiCategory(bmi);
    return { bmi: bmi, bmr: bmr, label: category.label, needleAngle: category.needleAngle };
}

function renderBodyMetrics(metrics) {
    document.getElementById('resBmiText').textContent = `${metrics.bmi.toFixed(1)} (${metrics.label})`;
    document.getElementById('resBmrText').textContent = `${Math.round(metrics.bmr).toLocaleString()} kcal`;

    const needle = document.getElementById('bmiGaugeNeedle');
    if (needle) {
        needle.style.transform = `rotate(${metrics.needleAngle}deg)`;
    }
}

// 오늘 날짜의 BODY_RECORD 를 새로 만들거나 덮어쓴다
function saveBodyRecord(profile, metrics) {
    const todayKey = getTodayKey();
    const existingIndex = bodyRecords.findIndex(record => record.recordDate === todayKey);

    const record = {
        bodyRecordId: existingIndex >= 0
            ? bodyRecords[existingIndex].bodyRecordId
            : bodyRecords.reduce((maxId, item) => Math.max(maxId, item.bodyRecordId || 0), 0) + 1,
        userId: currentUser.userId,
        recordDate: todayKey,
        height: profile.height,
        weight: profile.weight,
        bmi: Number(metrics.bmi.toFixed(2)),
        bmr: Math.round(metrics.bmr)
    };

    if (existingIndex >= 0) {
        bodyRecords[existingIndex] = record;
    } else {
        bodyRecords.push(record);
    }
    bodyRecords.sort((a, b) => a.recordDate.localeCompare(b.recordDate));
}

async function calculateBodyMetrics(shouldSave) {
    const profile = readBodyInputs();
    const errorMessage = getBodyProfileError(profile);

    if (errorMessage) {
        showToast(errorMessage);
        return;
    }

    const metrics = computeBodyMetrics(profile);
    renderBodyMetrics(metrics);

    if (!shouldSave || currentUser === null) return;

    bodyProfile = profile;
    saveBodyRecord(profile, metrics);
    await Promise.all([
        saveStoredValue('bodyProfile', bodyProfile),
        saveStoredValue('bodyRecords', bodyRecords)
    ]);

    renderDietSection();
    renderMyPage();
    renderBmrAnalysis();
    showToast('신체 데이터 및 BMI 수치가 업데이트 되었습니다.');
}

/* ==========================================
   다이어트 기간 비교 (와이어프레임 32~36번): BODY_RECORD + DIET_GOAL
   ========================================== */
function getBodyRecordsSorted() {
    return [...bodyRecords].sort((a, b) => a.recordDate.localeCompare(b.recordDate));
}

// 예시 데이터: 최근 6개월 체중 (마지막 값이 현재 체중)
function buildMockBodyRecords() {
    const today = new Date();
    const weightOffsets = [6.0, 3.5, 4.3, 2.7, 0.9, 0];

    return weightOffsets.map((offset, index) => {
        const monthsAgo = weightOffsets.length - 1 - index;
        const recordDate = monthsAgo === 0
            ? today
            : new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1);
        const weight = Math.round((bodyProfile.weight + offset) * 10) / 10;
        const metrics = computeBodyMetrics({ ...bodyProfile, weight: weight });

        return {
            bodyRecordId: index + 1,
            userId: currentUser.userId,
            recordDate: formatDateKey(recordDate),
            height: bodyProfile.height,
            weight: weight,
            bmi: Number(metrics.bmi.toFixed(2)),
            bmr: Math.round(metrics.bmr)
        };
    });
}

function buildMockDietGoal() {
    const firstRecord = getBodyRecordsSorted()[0];

    return {
        goalId: 1,
        userId: currentUser.userId,
        targetWeight: Math.round((bodyProfile.weight - 4.5) * 2) / 2,
        startDate: firstRecord ? firstRecord.recordDate : getTodayKey(),
        endDate: formatDateKey(addDays(new Date(), 60)),
        isActive: true
    };
}

function computeRecordBmi(record) {
    if (record.bmi) return record.bmi;
    const heightM = record.height / 100;
    return record.weight / (heightM * heightM);
}

// 달성도 = (시작 체중 - 현재 체중) / (시작 체중 - 목표 체중)
function calculateDietProgress() {
    const records = getBodyRecordsSorted();
    if (records.length === 0 || dietGoal === null) return null;

    const startRecord = records.find(record => record.recordDate >= dietGoal.startDate) || records[0];
    const latestRecord = records[records.length - 1];
    const totalGap = startRecord.weight - dietGoal.targetWeight;

    let percent = totalGap === 0 ? 100 : ((startRecord.weight - latestRecord.weight) / totalGap) * 100;
    percent = Math.max(0, Math.min(100, Math.round(percent)));

    return {
        startRecord: startRecord,
        latestRecord: latestRecord,
        startWeight: startRecord.weight,
        currentWeight: latestRecord.weight,
        targetWeight: dietGoal.targetWeight,
        changeKg: latestRecord.weight - startRecord.weight,
        percent: percent
    };
}

function createSvgElement(tagName, attributes) {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
    Object.entries(attributes || {}).forEach(([name, value]) => {
        element.setAttribute(name, String(value));
    });
    return element;
}

function appendSvgText(svg, attributes, text) {
    const textElement = createSvgElement('text', attributes);
    textElement.textContent = text;
    svg.appendChild(textElement);
}

function drawWeightChart() {
    const svg = document.getElementById('weightChartSvg');
    svg.replaceChildren();

    const records = getBodyRecordsSorted().slice(-8);
    if (records.length === 0) {
        appendSvgText(svg, { x: 150, y: 55, 'font-size': 10, fill: '#94a3b8', 'text-anchor': 'middle' },
            '체중 기록이 없어요. 신체 데이터를 저장해 보세요.');
        return;
    }

    const weights = records.map(record => record.weight);
    const hasGoal = dietGoal !== null && Number.isFinite(dietGoal.targetWeight);
    const scaleValues = hasGoal ? [...weights, dietGoal.targetWeight] : weights;

    // 눈금 값이 정수로 떨어지도록 범위를 짝수 칸으로 맞춘다
    const minValue = Math.floor(Math.min(...scaleValues)) - 1;
    let maxValue = Math.ceil(Math.max(...scaleValues)) + 1;
    if (maxValue - minValue < 4) maxValue = minValue + 4;
    if ((maxValue - minValue) % 2 === 1) maxValue += 1;

    const getY = (weight) => 80 - ((weight - minValue) / (maxValue - minValue)) * 60;
    const getX = (index) => (records.length === 1 ? 160 : 40 + index * (240 / (records.length - 1)));

    // 눈금선과 눈금 글자
    [20, 50, 80].forEach(lineY => {
        svg.appendChild(createSvgElement('line', {
            x1: 30, y1: lineY, x2: 290, y2: lineY, stroke: '#cbd5e1', 'stroke-dasharray': 2
        }));
        const labelValue = maxValue - ((lineY - 20) / 60) * (maxValue - minValue);
        appendSvgText(svg, { x: 24, y: lineY + 3, 'font-size': 8, fill: '#94a3b8', 'text-anchor': 'end' },
            `${labelValue}kg`);
    });

    // 목표 체중선
    if (hasGoal) {
        const goalY = getY(dietGoal.targetWeight);
        svg.appendChild(createSvgElement('line', {
            x1: 30, y1: goalY, x2: 290, y2: goalY, stroke: '#10b981', 'stroke-width': 1.5, 'stroke-dasharray': '4 3'
        }));
        appendSvgText(svg, { x: 290, y: goalY - 3, 'font-size': 8, fill: '#059669', 'font-weight': 'bold', 'text-anchor': 'end' },
            `목표 ${dietGoal.targetWeight}kg`);
    }

    // 꺾은선 + 아래 면
    const points = records.map((record, index) => ({ x: getX(index), y: getY(record.weight) }));
    const linePath = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
        .join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} 90 L ${points[0].x.toFixed(1)} 90 Z`;

    const defs = createSvgElement('defs');
    const gradient = createSvgElement('linearGradient', { id: 'chartGradient', x1: 0, y1: 0, x2: 0, y2: 1 });
    gradient.appendChild(createSvgElement('stop', { offset: '0%', 'stop-color': '#3b82f6' }));
    gradient.appendChild(createSvgElement('stop', { offset: '100%', 'stop-color': '#3b82f6', 'stop-opacity': 0 }));
    defs.appendChild(gradient);
    svg.appendChild(defs);

    svg.appendChild(createSvgElement('path', { d: areaPath, fill: 'url(#chartGradient)', opacity: 0.2 }));
    svg.appendChild(createSvgElement('path', {
        d: linePath, fill: 'none', stroke: '#3b82f6', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }));

    // 점 + 날짜 글자
    points.forEach((point, index) => {
        const isLast = index === points.length - 1;
        svg.appendChild(createSvgElement('circle', {
            cx: point.x, cy: point.y, r: isLast ? 5 : 3.5,
            fill: isLast ? '#10b981' : '#3b82f6',
            stroke: isLast ? '#ffffff' : 'none', 'stroke-width': isLast ? 2 : 0
        }));

        const dateKey = records[index].recordDate;
        appendSvgText(svg, {
            x: point.x, y: 105, 'font-size': 8,
            fill: isLast ? '#3b82f6' : '#64748b', 'font-weight': isLast ? 'bold' : 'normal', 'text-anchor': 'middle'
        }, `${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8, 10))}`);
    });

    svg.setAttribute('aria-label', `체중 변화 그래프: ${weights[0]}kg에서 ${weights[weights.length - 1]}kg`);
}

function renderDietSection() {
    if (currentUser === null || dietGoal === null) return;

    const setText = (elementId, text) => {
        document.getElementById(elementId).textContent = text;
    };

    setText('dietPeriodText', `(${dietGoal.startDate} ~ ${dietGoal.endDate}${dietGoal.isActive ? '' : ', 종료됨'})`);
    drawWeightChart();

    const progress = calculateDietProgress();
    if (progress === null) return;

    const startBmi = computeRecordBmi(progress.startRecord);
    const changeSign = progress.changeKg > 0 ? '+' : '';

    setText('dietAchieveText', `${progress.percent}% 달성`);
    document.getElementById('dietProgressBar').style.width = progress.percent + '%';
    setText('dietChangeText', `${changeSign}${progress.changeKg.toFixed(1)} kg`);
    setText('dietBurnedText', `약 ${estimateBurnedKcal(dietGoal.startDate, getTodayKey()).toLocaleString()} kcal`);
    setText('dietBeforeWeightText', `${progress.startWeight.toFixed(1)} kg`);
    setText('dietBeforeBmiText', `${startBmi.toFixed(1)} (${getBmiCategory(startBmi).label})`);
    setText('dietTargetText', `${progress.targetWeight} kg`);
}

/* ==========================================
   운동일지 (와이어프레임 24~26번): EXERCISE_SET (세트 / 중량 / 횟수)
   ========================================== */
function setDetailPanel(panelName) {
    activeDetailPanel = panelName === 'log' ? 'log' : 'routine';
    const isRoutine = activeDetailPanel === 'routine';

    document.getElementById('routinePanel').classList.toggle('hidden', !isRoutine);
    document.getElementById('logPanel').classList.toggle('hidden', isRoutine);
    document.getElementById('detailTabRoutine').setAttribute('aria-pressed', String(isRoutine));
    document.getElementById('detailTabLog').setAttribute('aria-pressed', String(!isRoutine));

    if (!isRoutine) renderExerciseLogList();
}

function createExerciseLogRow(entry, dateStr) {
    const rowElement = document.createElement('div');
    rowElement.className = 'grid grid-cols-[1fr_2.6rem_3.6rem_2.8rem_1.25rem] gap-1 items-center px-1 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-[11px] font-bold text-slate-800 dark:text-slate-100';

    const nameElement = document.createElement('span');
    nameElement.className = 'truncate min-w-0';
    nameElement.textContent = entry.exerciseName;
    nameElement.setAttribute('title', entry.exerciseName);

    const setElement = document.createElement('span');
    setElement.className = 'text-center';
    setElement.textContent = `${entry.setCount}세트`;

    const weightElement = document.createElement('span');
    weightElement.className = 'text-center';
    weightElement.textContent = `${entry.weight}kg`;

    const repsElement = document.createElement('span');
    repsElement.className = 'text-center';
    repsElement.textContent = `${entry.reps}회`;

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'text-slate-300 dark:text-slate-600 hover:text-red-500 transition';
    deleteButton.setAttribute('aria-label', `${entry.exerciseName} 삭제`);
    deleteButton.appendChild(createIcon('fa-solid fa-xmark text-xs'));
    deleteButton.addEventListener('click', () => deleteExerciseLog(dateStr, entry.id));

    rowElement.append(nameElement, setElement, weightElement, repsElement, deleteButton);
    return rowElement;
}

function renderExerciseLogList() {
    const listElement = document.getElementById('exerciseLogList');
    const entries = exerciseLogs[currentActiveDate] || [];

    listElement.replaceChildren();

    if (entries.length === 0) {
        listElement.appendChild(createMessageBox('기록된 운동이 없어요. 아래에서 추가해 주세요.', 'text-center py-4 text-xs text-slate-400'));
    } else {
        entries.forEach(entry => listElement.appendChild(createExerciseLogRow(entry, currentActiveDate)));
    }

    // 볼륨 = 세트 x 중량 x 횟수의 합
    const totalVolume = entries.reduce((sum, entry) => sum + entry.setCount * entry.weight * entry.reps, 0);
    document.getElementById('exerciseLogSummary').textContent = entries.length > 0
        ? `총 ${entries.length}종목, 볼륨 ${Math.round(totalVolume).toLocaleString()} kg`
        : '';
}

async function addExerciseLog(event) {
    event.preventDefault();

    const exerciseName = document.getElementById('logExerciseName').value.trim();
    const setCount = parseInt(document.getElementById('logSets').value, 10);
    const weight = parseFloat(document.getElementById('logWeight').value);
    const reps = parseInt(document.getElementById('logReps').value, 10);

    if (!exerciseName) {
        showToast('운동명을 입력해 주세요.');
        return;
    }
    if (!Number.isInteger(setCount) || setCount < 1 || setCount > 20) {
        showToast('세트는 1~20 사이로 입력해 주세요.');
        return;
    }
    if (!Number.isFinite(weight) || weight < 0 || weight > 500) {
        showToast('중량은 0~500kg 사이로 입력해 주세요.');
        return;
    }
    if (!Number.isInteger(reps) || reps < 1 || reps > 200) {
        showToast('횟수는 1~200 사이로 입력해 주세요.');
        return;
    }

    if (!exerciseLogs[currentActiveDate]) {
        exerciseLogs[currentActiveDate] = [];
    }
    exerciseLogs[currentActiveDate].push({
        id: nextExerciseLogId++,
        exerciseName: exerciseName,
        setCount: setCount,
        weight: weight,
        reps: reps
    });

    ['logExerciseName', 'logSets', 'logWeight', 'logReps'].forEach(inputId => {
        document.getElementById(inputId).value = '';
    });
    renderExerciseLogList();
    await saveStoredValue('exerciseLogs', exerciseLogs);
    showToast('운동을 추가했어요. 운동일지 저장을 눌러 마무리해 주세요.');
}

async function deleteExerciseLog(dateStr, logId) {
    exerciseLogs[dateStr] = (exerciseLogs[dateStr] || []).filter(entry => entry.id !== logId);
    renderExerciseLogList();
    await saveStoredValue('exerciseLogs', exerciseLogs);
    showToast('운동 기록을 삭제했어요.');
}

async function saveExerciseLogs() {
    const isSaved = await saveStoredValue('exerciseLogs', exerciseLogs);
    if (isSaved) showToast('운동일지가 저장되었습니다.');
}

/* ==========================================
   오늘의 운동 선택 (와이어프레임 12~15번): TODAY_ROUTINE_SELECTION
   ========================================== */
function renderRoutineSelection() {
    const todayRoutines = workoutState[getTodayKey()] || [];

    document.querySelectorAll('.type-chip').forEach(chip => {
        const hasType = todayRoutines.some(item => (item.routineType || 'CUSTOM') === chip.dataset.routineType);
        chip.setAttribute('aria-pressed', String(hasType));
    });
}

async function toggleRoutineType(routineType) {
    if (!isWorkoutLoaded) return;
    if (!Object.prototype.hasOwnProperty.call(defaultRoutineNames, routineType)) return;

    const todayKey = getTodayKey();
    const routines = workoutState[todayKey] || [];
    const hasType = routines.some(item => item.routineType === routineType);

    if (hasType) {
        workoutState[todayKey] = routines.filter(item => item.routineType !== routineType);
        showToast('오늘 루틴에서 뺐어요.');
    } else {
        routines.push({
            id: nextRoutineId++,
            name: defaultRoutineNames[routineType],
            completed: false,
            routineType: routineType
        });
        workoutState[todayKey] = routines;
        showToast('오늘 루틴에 추가했어요.');
    }
    await commitWorkoutChange();
}

function confirmRoutineSelection() {
    const todayKey = getTodayKey();
    const routines = workoutState[todayKey] || [];
    const hasType = (routineType) => routines.some(item => item.routineType === routineType);

    if (hasType('RUNNING')) {
        switchTab('tab-running');
        showToast('런닝 지도를 열었어요. 트래킹을 시작해 보세요.');
    } else if (hasType('WEIGHT')) {
        openDetailModal(todayKey, 'log');
    } else if (hasType('REST')) {
        showToast('오늘은 휴식으로 정했어요. 푹 쉬어요!');
    } else {
        showToast('오늘 할 운동을 먼저 선택해 주세요.');
    }
}

/* ==========================================
   성공 화면 (와이어프레임 19번)
   ========================================== */
function openSuccessModal() {
    if (isModalOpen(document.getElementById('detailModal'))) closeDetailModal();

    const today = new Date();
    const monthText = String(today.getMonth() + 1).padStart(2, '0');

    document.getElementById('successDateText').textContent = `${today.getFullYear()}.${monthText} 캘린더에 기록되었습니다.`;
    document.getElementById('successStreakText').textContent = `🔥 연속 ${calculateDisplayStreak()}일째 성공 중`;
    showModalElement(document.getElementById('successModal'));
}

function closeSuccessModal() {
    hideModalElement(document.getElementById('successModal'));
}

/* ==========================================
   런닝 종료 및 기록 저장 (와이어프레임 16~19번): GPS_LOG
   ========================================== */
async function finishRunningAndSave() {
    if (currentUser === null) return;

    if (secondsElapsed <= 0 || distanceKm <= 0) {
        showToast('저장할 런닝 기록이 없어요. 트래킹을 먼저 시작해 주세요.');
        return;
    }
    if (isRunning) toggleRunningSimulation();

    gpsLogs.push({
        gpsId: gpsLogs.reduce((maxId, log) => Math.max(maxId, log.gpsId || 0), 0) + 1,
        recordDate: getTodayKey(),
        distance: Number(distanceKm.toFixed(2)),
        calories: Math.round(caloriesBurned),
        durationSec: secondsElapsed
    });
    await saveStoredValue('gpsLogs', gpsLogs);
    // 서버가 준비되면 여기서 saveGpsRecord(selectionId, distance, calories, routePath) 를 호출한다.

    // 오늘의 런닝 항목을 완료 처리한다 (없으면 새로 만든다)
    const todayKey = getTodayKey();
    const wasCompleted = getDayStatus(workoutState[todayKey]) === 'completed';
    const routines = workoutState[todayKey] || [];
    const runningRoutines = routines.filter(item => item.routineType === 'RUNNING');

    if (runningRoutines.length === 0) {
        routines.push({ id: nextRoutineId++, name: defaultRoutineNames.RUNNING, completed: true, routineType: 'RUNNING' });
    } else {
        runningRoutines.forEach(item => {
            item.completed = true;
        });
    }
    workoutState[todayKey] = routines;

    await commitWorkoutChange();
    resetRunningData();
    showToast('런닝 기록을 저장했어요.');

    if (!wasCompleted && getDayStatus(workoutState[todayKey]) === 'completed') {
        openSuccessModal();
    }
}

/* ==========================================
   마이페이지: USER / BODY_RECORD / DIET_GOAL / 운동 통계
   ========================================== */
function calculateWorkoutStats() {
    const todayKey = getTodayKey();
    const pastLogs = workoutLogs.filter(log => log.workoutDate <= todayKey);
    const completedDays = pastLogs.filter(log => log.isCompleted).length;

    return {
        totalDays: pastLogs.length,
        completedDays: completedDays,
        completionRate: pastLogs.length > 0 ? Math.round((completedDays / pastLogs.length) * 100) : 0,
        currentStreak: calculateDisplayStreak(),
        longestStreak: workoutLogs.reduce((maxStreak, log) => Math.max(maxStreak, log.currentStreak), 0),
        runCount: gpsLogs.length,
        runDistance: gpsLogs.reduce((sum, log) => sum + log.distance, 0),
        burnedKcal: estimateBurnedKcal(null, todayKey)
    };
}

function renderMyPage() {
    if (currentUser === null) return;

    const setText = (elementId, text) => {
        document.getElementById(elementId).textContent = text;
    };
    const metrics = computeBodyMetrics(bodyProfile);
    const stats = calculateWorkoutStats();
    const isKakao = currentUser.provider === 'kakao';

    // 프로필
    const displayName = getDisplayName();
    setText('myAvatar', displayName.charAt(0).toUpperCase());
    setText('myUserId', displayName);
    document.getElementById('myUserId').title = `아이디: ${currentUser.userId}`;
    setText('myJoinDate', currentUser.createdAt ? formatKoreanDate(currentUser.createdAt) : '-');

    const providerBadge = document.getElementById('myProviderBadge');
    providerBadge.textContent = isKakao ? '카카오 로그인' : '일반 계정';
    providerBadge.className = `text-[10px] font-bold px-2 py-0.5 rounded-full ${isKakao
        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`;

    // 신체 정보
    setText('myBodyBasis', `${bodyProfile.gender === 'male' ? '남성' : '여성'}, ${bodyProfile.age}세`);
    setText('myHeight', `${bodyProfile.height} cm`);
    setText('myWeight', `${bodyProfile.weight} kg`);
    setText('myBmi', `${metrics.bmi.toFixed(1)} (${metrics.label})`);
    setText('myBmr', `${Math.round(metrics.bmr).toLocaleString()} kcal`);

    // 다이어트 목표 진행
    const progress = calculateDietProgress();
    if (progress !== null) {
        setText('goalProgressText', `${progress.percent}% 달성 (현재 ${progress.currentWeight}kg, 목표 ${progress.targetWeight}kg)`);
        document.getElementById('goalProgressBar').style.width = progress.percent + '%';
    }

    // 운동 통계
    setText('statTotalDays', `${stats.totalDays}일`);
    setText('statCompletedDays', `${stats.completedDays}일`);
    setText('statCompletionRate', `${stats.completionRate}%`);
    setText('statCurrentStreak', `${stats.currentStreak}일`);
    setText('statLongestStreak', `${stats.longestStreak}일`);
    setText('statRunCount', `${stats.runCount}회`);
    setText('statRunDistance', `${stats.runDistance.toFixed(1)} km`);
    setText('statBurnedKcal', `${stats.burnedKcal.toLocaleString()} kcal`);
}

function fillGoalForm() {
    if (dietGoal === null) return;

    document.getElementById('goalTargetWeight').value = dietGoal.targetWeight;
    document.getElementById('goalStartDate').value = dietGoal.startDate;
    document.getElementById('goalEndDate').value = dietGoal.endDate;
    document.getElementById('goalIsActive').checked = Boolean(dietGoal.isActive);
}

async function saveDietGoal(event) {
    event.preventDefault();
    if (currentUser === null) return;

    const targetWeight = parseFloat(document.getElementById('goalTargetWeight').value);
    const startDate = document.getElementById('goalStartDate').value;
    const endDate = document.getElementById('goalEndDate').value;
    const isActive = document.getElementById('goalIsActive').checked;

    if (!Number.isFinite(targetWeight) || targetWeight < 20 || targetWeight > 300) {
        showToast('목표 체중은 20~300kg 사이로 입력해 주세요.');
        return;
    }
    if (!startDate || !endDate) {
        showToast('시작일과 종료일을 모두 선택해 주세요.');
        return;
    }
    if (startDate > endDate) {
        showToast('종료일은 시작일보다 빠를 수 없어요.');
        return;
    }

    dietGoal = {
        goalId: dietGoal ? dietGoal.goalId : 1,
        userId: currentUser.userId,
        targetWeight: targetWeight,
        startDate: startDate,
        endDate: endDate,
        isActive: isActive
    };

    await saveStoredValue('dietGoal', dietGoal);
    renderDietSection();
    renderMyPage();
    showToast('다이어트 목표가 저장되었습니다.');
}

function disarmResetButton() {
    isResetArmed = false;
    clearTimeout(resetArmTimerId);
    document.getElementById('resetDataLabel').textContent = '내 기록 모두 삭제';
}

// 실수로 지우지 않도록 두 번 눌러야 삭제된다
async function handleResetData() {
    if (currentUser === null) return;

    if (!isResetArmed) {
        isResetArmed = true;
        document.getElementById('resetDataLabel').textContent = '정말 삭제할까요? 한 번 더 누르세요';
        clearTimeout(resetArmTimerId);
        resetArmTimerId = setTimeout(disarmResetButton, 4000);
        return;
    }

    disarmResetButton();
    userDataKeys.forEach(name => removeStorage(getUserKey(name)));

    // 예시 데이터로 되돌리는 게 아니라 정말 비운다: 운동 기록 / 운동일지 / GPS 기록은 0건,
    // 신체 기록은 오늘 값 1건만 남기고, 목표는 기본값으로 다시 만든다.
    workoutState = {};
    workoutLogs = [];
    nextRoutineId = 1;
    exerciseLogs = {};
    gpsLogs = [];
    nextExerciseLogId = 1;
    bodyProfile = { gender: 'male', age: 28, height: 175, weight: 72.5 };
    bodyRecords = [];
    saveBodyRecord(bodyProfile, computeBodyMetrics(bodyProfile));
    dietGoal = buildMockDietGoal();

    await Promise.all([
        persistWorkoutState(),
        saveStoredValue('exerciseLogs', exerciseLogs),
        saveStoredValue('gpsLogs', gpsLogs),
        saveStoredValue('bodyProfile', bodyProfile),
        saveStoredValue('bodyRecords', bodyRecords),
        saveStoredValue('dietGoal', dietGoal)
    ]);

    applyBodyProfileToInputs();
    await calculateBodyMetrics(false);
    isWorkoutLoaded = true;
    isWorkoutCustom = true;
    refreshAllViews();
    fillGoalForm();
    renderBmrAnalysis();
    showToast('내 기록을 모두 삭제했어요.');
}

/* ==========================================
   칼로리 계산기 / 기초대사량 분석 (메뉴 29, 30번)
   ========================================== */
function initCalculatorOptions() {
    const activitySelect = document.getElementById('calcActivity');
    activityMets.forEach(activity => {
        const optionElement = document.createElement('option');
        optionElement.value = activity.key;
        optionElement.textContent = `${activity.label} (MET ${activity.met})`;
        activitySelect.appendChild(optionElement);
    });

    const levelSelect = document.getElementById('bmrActivity');
    activityLevels.forEach(level => {
        const optionElement = document.createElement('option');
        optionElement.value = level.key;
        optionElement.textContent = `${level.label} (x${level.factor})`;
        levelSelect.appendChild(optionElement);
    });
    levelSelect.value = 'light';
}

function prefillCalorieWeight() {
    const weightInput = document.getElementById('calcWeight');
    if (!weightInput.value) weightInput.value = bodyProfile.weight;
    renderCalorieResult();
}

function renderCalorieResult() {
    const minutes = parseFloat(document.getElementById('calcMinutes').value);
    const weight = parseFloat(document.getElementById('calcWeight').value);
    const activity = activityMets.find(item => item.key === document.getElementById('calcActivity').value) || activityMets[0];

    const kcalElement = document.getElementById('calcResultKcal');
    const foodElement = document.getElementById('calcResultFood');

    if (!(minutes > 0 && minutes <= 600) || !(weight >= 20 && weight <= 300)) {
        kcalElement.textContent = '-';
        foodElement.textContent = '운동 시간(1~600분)과 체중(20~300kg)을 입력해 주세요.';
        return;
    }

    const kcal = Math.round(activity.met * weight * (minutes / 60));
    kcalElement.textContent = `${kcal.toLocaleString()} kcal`;
    foodElement.textContent = `공기밥(300kcal) 약 ${(kcal / 300).toFixed(1)}공기 분량이에요.`;
}

function renderBmrAnalysis() {
    const metrics = computeBodyMetrics(bodyProfile);
    const level = activityLevels.find(item => item.key === document.getElementById('bmrActivity').value) || activityLevels[1];
    const goal = goalAdjustments[selectedGoalKey];

    const bmr = Math.round(metrics.bmr);
    const tdee = Math.round(metrics.bmr * level.factor);
    const targetIntake = tdee + goal.kcal;
    const recommended = Math.max(targetIntake, bmr);

    const setText = (elementId, text) => {
        document.getElementById(elementId).textContent = text;
    };

    setText('bmrBasisText', `${bodyProfile.gender === 'male' ? '남성' : '여성'} ${bodyProfile.age}세, ${bodyProfile.height}cm, ${bodyProfile.weight}kg 기준`);
    setText('bmrValue', `${bmr.toLocaleString()} kcal`);
    setText('tdeeValue', `${tdee.toLocaleString()} kcal`);
    setText('intakeValue', `${recommended.toLocaleString()} kcal`);
    setText('intakeNote', targetIntake < bmr
        ? '기초대사량보다 적게 먹으면 건강을 해칠 수 있어, 기초대사량을 최소선으로 안내해요.'
        : `${goal.label} 목표 기준 하루 권장 섭취량이에요.`);

    document.getElementById('bmrGoalButtons').querySelectorAll('button').forEach(goalButton => {
        goalButton.setAttribute('aria-pressed', String(goalButton.dataset.goal === selectedGoalKey));
    });
}

/* ==========================================
   v2.3 이벤트 연결
   ========================================== */
function bindFeatureEvents() {
    // 날짜 상세 모달: 패널 전환 / 운동일지
    document.getElementById('detailTabRoutine').addEventListener('click', () => setDetailPanel('routine'));
    document.getElementById('detailTabLog').addEventListener('click', () => setDetailPanel('log'));
    document.getElementById('exerciseLogForm').addEventListener('submit', addExerciseLog);
    document.getElementById('saveExerciseLogButton').addEventListener('click', saveExerciseLogs);

    // 오늘의 운동 선택
    document.querySelectorAll('.type-chip').forEach(chip => {
        chip.addEventListener('click', () => toggleRoutineType(chip.dataset.routineType));
    });
    document.getElementById('confirmSelectionButton').addEventListener('click', confirmRoutineSelection);

    // 성공 화면
    document.getElementById('successCloseButton').addEventListener('click', closeSuccessModal);
    document.getElementById('successCalendarButton').addEventListener('click', () => {
        closeSuccessModal();
        switchTab('tab-calendar');
    });

    // 런닝 종료 및 저장
    document.getElementById('finishRunButton').addEventListener('click', finishRunningAndSave);

    // 마이페이지
    document.getElementById('goalForm').addEventListener('submit', saveDietGoal);
    document.getElementById('darkModeSwitch').addEventListener('click', toggleDarkMode);
    document.getElementById('logoutButton').addEventListener('click', logout);
    document.getElementById('resetDataButton').addEventListener('click', handleResetData);

    // 계산기
    ['calcActivity', 'calcMinutes', 'calcWeight'].forEach(elementId => {
        document.getElementById(elementId).addEventListener('input', renderCalorieResult);
    });
    document.getElementById('bmrActivity').addEventListener('change', renderBmrAnalysis);
    document.getElementById('bmrGoalButtons').addEventListener('click', (event) => {
        const goalButton = event.target.closest('button[data-goal]');
        if (!goalButton) return;

        selectedGoalKey = goalButton.dataset.goal;
        renderBmrAnalysis();
    });
}


/* ==========================================
   6. BMI & Body Data Calculator
   ========================================== */


/* ==========================================
   7. Toast Notification Engine
   ========================================== */
let toastTimeout = null;
function showToast(msg) {
    const toast = document.getElementById('toast');
    const msgSpan = document.getElementById('toastMsg');

    msgSpan.textContent = msg;
    toast.classList.remove('opacity-0', 'pointer-events-none');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.add('opacity-0', 'pointer-events-none');
    }, 2400);
}
