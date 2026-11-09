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
// 러닝 기록은 0에서 시작한다 (예전 예시값: 00:28:40 / 5.2km / 415kcal)
let secondsElapsed = 0;
let distanceKm = 0;
let caloriesBurned = 0;

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
    intervalId: null,
    laps: [] // 스톱워치 구간 기록 (누적 시간 ms)
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
   9. 타이머 / 스톱워치 화면 (와이어프레임 23번) — 전체 화면
   ========================================== */
const dialProgressLength = 2 * Math.PI * 138; // index.html 의 clockProgress 원(r=138) 둘레
const pickerItemHeight = 76; // style.css 의 .time-picker-item 높이와 같아야 한다

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

// 타이머: 시:분:초 (끝나기 직전까지 00:00:01 로 보이게 올림)
function formatTimerClock(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

// 스톱워치: 1시간 전에는 분:초, 넘으면 시:분:초 (내림)
function formatStopwatchMain(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

// 0.01초 단위 (.00 ~ .99)
function formatCentiseconds(ms) {
    return `.${String(Math.floor((ms % 1000) / 10)).padStart(2, '0')}`;
}

function formatStopwatch(ms) {
    return formatStopwatchMain(ms) + formatCentiseconds(ms);
}

// 원 둘레의 눈금 60개 (5칸마다 굵게)
function buildClockDial() {
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const ticksGroup = document.getElementById('clockTicks');

    for (let index = 0; index < 60; index++) {
        const isMajor = index % 5 === 0;
        const angle = (index / 60) * Math.PI * 2;
        const innerRadius = isMajor ? 132 : 138;
        const outerRadius = 146;

        const tick = document.createElementNS(svgNamespace, 'line');
        tick.setAttribute('x1', (150 + Math.sin(angle) * innerRadius).toFixed(2));
        tick.setAttribute('y1', (150 - Math.cos(angle) * innerRadius).toFixed(2));
        tick.setAttribute('x2', (150 + Math.sin(angle) * outerRadius).toFixed(2));
        tick.setAttribute('y2', (150 - Math.cos(angle) * outerRadius).toFixed(2));
        tick.setAttribute('class', isMajor ? 'clock-tick clock-tick--major' : 'clock-tick');
        ticksGroup.appendChild(tick);
    }

    document.getElementById('clockProgress').style.strokeDasharray = String(dialProgressLength);
}

// 숫자 + 원(스톱워치 바늘 / 타이머 남은 시간 테두리)을 그린다
function renderClockDisplay(ms) {
    const isStopwatch = clockState.mode === 'stopwatch';
    const displayElement = document.getElementById('clockDisplay');
    const fractionElement = document.getElementById('clockFraction');

    if (isStopwatch) {
        document.getElementById('clockMain').textContent = formatStopwatchMain(ms);
        fractionElement.textContent = formatCentiseconds(ms);
        displayElement.classList.toggle('is-long', ms >= 3600000);

        // 바늘은 1분에 한 바퀴
        const handAngle = ((ms % 60000) / 60000) * 360;
        document.getElementById('clockHand').setAttribute('transform', `rotate(${handAngle.toFixed(2)} 150 150)`);
    } else {
        document.getElementById('clockMain').textContent = formatTimerClock(ms);
        displayElement.classList.remove('is-long');

        const remainingRatio = clockState.presetMs > 0 ? ms / clockState.presetMs : 0;
        document.getElementById('clockProgress').style.strokeDashoffset = String(dialProgressLength * (1 - remainingRatio));
    }
    fractionElement.hidden = !isStopwatch;
}

/* 타이머 시간 선택 휠: 시/분/초 칸을 위아래로 스크롤해서 맞춘다 */
function getPickerColumns() {
    return document.querySelectorAll('#timePicker .time-picker-scroll');
}

function getPickerValue(column) {
    const maxValue = Number(column.dataset.max);
    return Math.min(maxValue, Math.max(0, Math.round(column.scrollTop / pickerItemHeight)));
}

function markPickerSelection(column) {
    const value = getPickerValue(column);
    column.querySelectorAll('.time-picker-item').forEach((item, index) => {
        item.classList.toggle('is-selected', index === value);
    });
    column.setAttribute('aria-valuenow', String(value));
}

function setPickerValue(column, value, smooth) {
    column.scrollTo({ top: value * pickerItemHeight, behavior: smooth ? 'smooth' : 'auto' });
    markPickerSelection(column);
}

// 선택해 둔 타이머 시간(presetMs)을 휠 위치에 반영한다
function syncPickerFromPreset() {
    const totalSeconds = Math.round(clockState.presetMs / 1000);
    const values = {
        hours: Math.floor(totalSeconds / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60
    };
    // 바로 이동해야 움직이는 중간 값이 타이머 시간으로 잡히지 않는다
    getPickerColumns().forEach(column => setPickerValue(column, values[column.dataset.unit], false));
}

// 휠이 멈추면 그 값으로 타이머 시간을 바꾼다
function applyPickerToPreset() {
    if (clockState.isRunning || clockState.mode !== 'timer' || document.getElementById('timerSetupArea').hidden) return;

    let totalSeconds = 0;
    getPickerColumns().forEach(column => {
        const value = getPickerValue(column);
        if (column.dataset.unit === 'hours') totalSeconds += value * 3600;
        if (column.dataset.unit === 'minutes') totalSeconds += value * 60;
        if (column.dataset.unit === 'seconds') totalSeconds += value;
        setPickerValue(column, value, true); // 칸 가운데에 딱 맞춘다
    });

    clockState.presetMs = totalSeconds * 1000;
    clockState.baseMs = clockState.presetMs;
    setClockMessage('');
    updateClockUi();
}

function buildTimePicker() {
    getPickerColumns().forEach(column => {
        const maxValue = Number(column.dataset.max);
        column.setAttribute('aria-valuemin', '0');
        column.setAttribute('aria-valuemax', String(maxValue));

        for (let value = 0; value <= maxValue; value++) {
            const item = document.createElement('div');
            item.className = 'time-picker-item';
            item.textContent = String(value).padStart(2, '0');
            item.addEventListener('click', () => {
                setPickerValue(column, value, true);
            });
            column.appendChild(item);
        }

        let settleTimerId = null;
        column.addEventListener('scroll', () => {
            markPickerSelection(column);
            clearTimeout(settleTimerId);
            settleTimerId = setTimeout(applyPickerToPreset, 150);
        });

        // 키보드: 위/아래 화살표로 한 칸씩
        column.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            event.preventDefault();
            const step = event.key === 'ArrowUp' ? -1 : 1;
            const nextValue = Math.min(maxValue, Math.max(0, getPickerValue(column) + step));
            setPickerValue(column, nextValue, true);
        });
    });
}

/* 스톱워치 구간 기록 (최근 기록이 위로) */
function renderLaps() {
    const lapList = document.getElementById('lapList');
    lapList.textContent = '';

    for (let index = clockState.laps.length - 1; index >= 0; index--) {
        const totalMs = clockState.laps[index];
        const previousMs = index > 0 ? clockState.laps[index - 1] : 0;

        const row = document.createElement('li');
        row.className = 'clock-lap';
        [
            ['clock-lap-name', `구간 ${String(index + 1).padStart(2, '0')}`],
            ['clock-lap-split', `+${formatStopwatch(totalMs - previousMs)}`],
            ['clock-lap-total', formatStopwatch(totalMs)]
        ].forEach(([className, text]) => {
            const cell = document.createElement('span');
            cell.className = className;
            cell.textContent = text;
            row.appendChild(cell);
        });
        lapList.appendChild(row);
    }

    document.getElementById('clockDialArea').classList.toggle('has-laps', clockState.laps.length > 0);
}

function addLap() {
    clockState.laps.push(getClockMs());
    renderLaps();
}

function setClockMessage(message) {
    document.getElementById('clockMessage').textContent = message;
}

function stopClockInterval() {
    clearInterval(clockState.intervalId);
    clockState.intervalId = null;
}

function updateClockUi() {
    const isStopwatch = clockState.mode === 'stopwatch';
    const displayElement = document.getElementById('clockDisplay');

    renderClockDisplay(getClockMs());
    displayElement.classList.toggle(
        'clock-finished',
        !isStopwatch && !clockState.isRunning && clockState.baseMs === 0
    );
    document.getElementById('timerModalTitle').textContent = isStopwatch ? '스톱워치' : '타이머';

    // 타이머를 시작하기 전(또는 초기화 후)에는 시간 선택 휠을, 그 외에는 원 + 숫자를 보여준다
    const setupElement = document.getElementById('timerSetupArea');
    const dialAreaElement = document.getElementById('clockDialArea');
    const showSetup = !isStopwatch && !clockState.isRunning && clockState.baseMs === clockState.presetMs;
    const wasSetupHidden = setupElement.hidden;
    setupElement.hidden = !showSetup;
    dialAreaElement.hidden = showSetup;
    dialAreaElement.dataset.mode = clockState.mode;
    if (showSetup && wasSetupHidden) syncPickerFromPreset();

    const hasProgress = clockState.baseMs > 0
        && (isStopwatch || clockState.baseMs < clockState.presetMs);
    const isTimerFinished = !isStopwatch && clockState.baseMs === 0 && clockState.presetMs > 0;

    // 오른쪽 큰 버튼: 시작 / 일시정지 / 계속
    let toggleLabel = '시작';
    if (clockState.isRunning) {
        toggleLabel = '일시정지';
    } else if (isTimerFinished) {
        toggleLabel = '다시 시작';
    } else if (hasProgress) {
        toggleLabel = '계속';
    }
    document.getElementById('clockToggleButton').textContent = toggleLabel;

    // 왼쪽 버튼: 스톱워치는 구간 기록 / 초기화, 타이머는 취소 (시간 설정 중에는 숨김)
    const leftButton = document.getElementById('clockResetButton');
    if (isStopwatch) {
        leftButton.hidden = false;
        leftButton.textContent = !clockState.isRunning && hasProgress ? '초기화' : '구간 기록';
        leftButton.disabled = !clockState.isRunning && !hasProgress;
    } else {
        leftButton.hidden = showSetup;
        leftButton.textContent = '취소';
        leftButton.disabled = false;
    }
    document.getElementById('clockActions').classList.toggle('is-single', leftButton.hidden);

    // 자주 쓰는 시간 버튼: 선택 표시 + 실행 중에는 변경 불가
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
    clockState.laps = [];
    renderLaps();

    document.getElementById('modeStopwatchButton').setAttribute('aria-pressed', String(mode === 'stopwatch'));
    document.getElementById('modeTimerButton').setAttribute('aria-pressed', String(mode === 'timer'));

    setClockMessage('');
    updateClockUi();
}

function startClock() {
    if (clockState.mode === 'timer' && clockState.presetMs <= 0) {
        setClockMessage('타이머 시간을 먼저 맞춰 주세요.');
        return;
    }

    // 타이머가 끝난 뒤 다시 누르면 선택해 둔 시간부터 다시 시작
    if (clockState.mode === 'timer' && clockState.baseMs <= 0) {
        clockState.baseMs = clockState.presetMs;
    }

    clockState.isRunning = true;
    clockState.startedAt = Date.now();
    // 스톱워치는 0.01초 단위가 보이므로 자주 갱신한다
    clockState.intervalId = setInterval(tickClock, clockState.mode === 'stopwatch' ? 10 : 50);

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
    clockState.laps = [];
    renderLaps();

    setClockMessage('');
    updateClockUi();
}

function tickClock() {
    const currentMs = getClockMs();
    renderClockDisplay(currentMs);

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

    // 왼쪽 버튼: 스톱워치가 돌아가는 중이면 구간 기록, 아니면 초기화(타이머는 취소)
    document.getElementById('clockResetButton').addEventListener('click', () => {
        if (clockState.mode === 'stopwatch' && clockState.isRunning) {
            addLap();
        } else {
            resetClock();
        }
    });

    // 자주 쓰는 시간 버튼은 이벤트 위임으로 처리
    document.getElementById('presetRow').addEventListener('click', (event) => {
        const presetButton = event.target.closest('button[data-seconds]');
        if (!presetButton || clockState.isRunning) return;

        clockState.presetMs = Number(presetButton.dataset.seconds) * 1000;
        clockState.baseMs = clockState.presetMs;

        setClockMessage('');
        updateClockUi();
        syncPickerFromPreset();
    });
}

/* ==========================================
   앱 시작 (로그인 세션이 있으면 바로 시작, 없으면 로그인 화면)
   ========================================== */
async function initApp() {
    bindAuthEvents();
    bindHeaderButtons();
    bindModalShortcuts();
    buildTimePicker();
    buildClockDial();
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
    if (typeof handleKakaoLoginReturn === 'function' && await handleKakaoLoginReturn()) return;
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
// 예시 데이터는 시연용 계정(testuser)에만 채운다. 새로 가입한 사용자는 빈 데이터로 시작한다.
function isDemoUser() {
    return currentUser !== null && currentUser.userId === demoUserId;
}

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
    document.getElementById('kakaoLoginButton').addEventListener('click', () => startKakaoLogin());
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

// 로그인한 사용자의 저장 데이터를 한 번에 불러온다 (없으면 빈 데이터, 시연용 계정만 예시 데이터)
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

    if (Array.isArray(storedRecords) && storedRecords.length > 0) {
        bodyRecords = storedRecords;
    } else {
        bodyRecords = isDemoUser() ? buildMockBodyRecords() : [];
    }

    if (storedGoal && typeof storedGoal === 'object' && !Array.isArray(storedGoal)) {
        dietGoal = storedGoal;
    } else {
        dietGoal = isDemoUser() ? buildMockDietGoal() : null; // 새 사용자는 목표 없음
    }

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

/* ==========================================
   뒤로가기: 휴대폰 뒤로 버튼을 누르면 MainActivity 가 handleAppBack() 을 부른다
   열린 화면 닫기 → 이전 탭 → (오늘 루틴에서) 두 번 누르면 종료
   ========================================== */
let currentTabId = 'tab-today';
let tabHistory = []; // 지나온 탭 (오늘 루틴으로 가면 비운다)
let lastBackPressAt = 0;

function isScreenVisible(elementId) {
    const element = document.getElementById(elementId);
    return element !== null && !element.classList.contains('hidden');
}

// 처음 화면에서는 한 번 더 눌러야 종료 (실수로 꺼지지 않게)
function confirmAppExit() {
    if (Date.now() - lastBackPressAt < 2000) return false;
    lastBackPressAt = Date.now();
    showToast('뒤로 버튼을 한 번 더 누르면 종료돼요.');
    return true;
}

// 앱이 뒤로가기를 처리했으면 true, 앱을 종료해도 되면 false 를 돌려준다
function handleAppBack() {
    // 1. 초기값 설정 화면: 이전 단계로 (1단계면 종료 확인)
    if (isScreenVisible('onboardingScreen')) {
        if (typeof onboardingStep === 'number' && onboardingStep > 1) {
            goToOnboardingStep(onboardingStep - 1);
            return true;
        }
        return confirmAppExit();
    }

    // 2. 로그인 화면
    if (isScreenVisible('loginScreen')) return confirmAppExit();

    // 3. 열려 있는 창(성공 화면 → 타이머/스톱워치 → 날짜 상세) 닫기
    const openModal = [
        ['successModal', closeSuccessModal],
        ['timerModal', closeTimerModal],
        ['detailModal', closeDetailModal]
    ].find(([modalId]) => isModalOpen(document.getElementById(modalId)));
    if (openModal) {
        openModal[1]();
        return true;
    }

    // 4. 이전 탭으로 (기록이 없으면 오늘 루틴으로)
    if (currentTabId !== 'tab-today') {
        switchTab(tabHistory.pop() || 'tab-today', { isBack: true });
        return true;
    }

    // 5. 오늘 루틴 화면: 두 번 누르면 종료
    return confirmAppExit();
}

function switchTab(tabId, options = {}) {
    // 뒤로가기용 탭 기록
    if (tabId === 'tab-today') {
        tabHistory = [];
    } else if (!options.isBack && currentTabId !== tabId) {
        tabHistory.push(currentTabId);
        if (tabHistory.length > 20) tabHistory.shift();
    }
    currentTabId = tabId;

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
        applyBodyProfileToInputs(); // 저장하지 않고 나갔던 입력값은 지우고 지금 신체 정보로 다시 채운다
        fillGoalForm();
        renderMyPage();
    }
    if (tabId === 'tab-body') {
        fillDietPeriodForm();
        renderDietSection();
    }
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

    // 사용자가 직접 고친 기록이 있으면 그것을 쓰고, 없으면 빈 기록 (시연용 계정만 예시 데이터)
    const storedWorkout = await requestStoredValue('workout', null);

    if (storedWorkout && storedWorkout.isCustom && storedWorkout.state) {
        const usedIds = Object.values(storedWorkout.state).flat().map(item => item.id || 0);
        nextRoutineId = Math.max(storedWorkout.nextRoutineId || 1, Math.max(0, ...usedIds) + 1);
        isWorkoutCustom = true;
        return storedWorkout.state;
    }

    isWorkoutCustom = false;
    if (!isDemoUser()) return {};
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

/* 다이어트 기간: 시작일 ~ 종료일 사이의 일일 체중 기록으로 변화를 본다 */
function parseDateKey(dateKey) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
}

// 두 날짜 사이의 일수 (같은 날이면 0)
function getDaysBetween(fromKey, toKey) {
    return Math.round((parseDateKey(toKey) - parseDateKey(fromKey)) / 86400000);
}

function formatShortDate(dateKey) {
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return `${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8, 10))} (${weekdays[parseDateKey(dateKey).getDay()]})`;
}

function hasTargetWeight() {
    return dietGoal !== null && Number.isFinite(dietGoal.targetWeight);
}

// 기간 안(시작일 ~ 종료일)의 체중 기록
function getPeriodRecords() {
    if (dietGoal === null) return [];
    return getBodyRecordsSorted().filter(record =>
        record.recordDate >= dietGoal.startDate && record.recordDate <= dietGoal.endDate);
}

// 기간 변화 계산: 시작 체중 = 시작일 당일(또는 그 전) 마지막 기록, 없으면 기간 안 첫 기록
function calculateDietProgress() {
    if (dietGoal === null) return null;

    const periodRecords = getPeriodRecords();
    const recordsBeforeStart = getBodyRecordsSorted().filter(record => record.recordDate <= dietGoal.startDate);
    const startRecord = recordsBeforeStart[recordsBeforeStart.length - 1] || periodRecords[0];
    if (!startRecord) return null;

    const latestRecord = periodRecords[periodRecords.length - 1] || startRecord;
    const targetWeight = hasTargetWeight() ? dietGoal.targetWeight : null;

    // 달성도 = (시작 체중 - 현재 체중) / (시작 체중 - 목표 체중)
    let percent = null;
    if (targetWeight !== null) {
        const totalGap = startRecord.weight - targetWeight;
        percent = totalGap === 0 ? 100 : ((startRecord.weight - latestRecord.weight) / totalGap) * 100;
        percent = Math.max(0, Math.min(100, Math.round(percent)));
    }

    return {
        startRecord: startRecord,
        latestRecord: latestRecord,
        periodRecords: periodRecords,
        startWeight: startRecord.weight,
        currentWeight: latestRecord.weight,
        targetWeight: targetWeight,
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

// 기간(시작일 ~ 종료일)을 가로축으로, 일일 체중 기록을 점으로 그린다
function drawWeightChart(progress) {
    const svg = document.getElementById('weightChartSvg');
    svg.replaceChildren();

    const showMessage = (message) => {
        appendSvgText(svg, { x: 150, y: 60, 'font-size': 10, fill: '#94a3b8', 'text-anchor': 'middle' }, message);
    };

    if (dietGoal === null) {
        showMessage('다이어트 기간을 먼저 설정해 주세요.');
        return;
    }
    if (progress === null) {
        showMessage('기간 안에 체중 기록이 없어요. 오늘 체중을 기록해 보세요.');
        return;
    }

    // 시작 체중이 시작일 전 기록이면 시작일 위치에 붙여서 그린다
    const chartRecords = [...progress.periodRecords];
    if (progress.startRecord.recordDate < dietGoal.startDate) {
        chartRecords.unshift({ ...progress.startRecord, recordDate: dietGoal.startDate, isCarried: true });
    }

    const weights = chartRecords.map(record => record.weight);
    const scaleValues = progress.targetWeight !== null ? [...weights, progress.targetWeight] : weights;

    // 눈금 값이 정수로 떨어지도록 범위를 짝수 칸으로 맞춘다
    const minValue = Math.floor(Math.min(...scaleValues)) - 1;
    let maxValue = Math.ceil(Math.max(...scaleValues)) + 1;
    if (maxValue - minValue < 4) maxValue = minValue + 4;
    if ((maxValue - minValue) % 2 === 1) maxValue += 1;

    const totalDays = Math.max(1, getDaysBetween(dietGoal.startDate, dietGoal.endDate));
    const getX = (dateKey) => 36 + (getDaysBetween(dietGoal.startDate, dateKey) / totalDays) * 252;
    const getY = (weight) => 88 - ((weight - minValue) / (maxValue - minValue)) * 72;

    // 눈금선과 눈금 글자
    [16, 52, 88].forEach(lineY => {
        svg.appendChild(createSvgElement('line', {
            x1: 32, y1: lineY, x2: 290, y2: lineY, stroke: '#cbd5e1', 'stroke-dasharray': 2
        }));
        const labelValue = maxValue - ((lineY - 16) / 72) * (maxValue - minValue);
        appendSvgText(svg, { x: 28, y: lineY + 3, 'font-size': 8, fill: '#94a3b8', 'text-anchor': 'end' },
            `${labelValue}kg`);
    });

    // 오늘 위치 (기간 안일 때만)
    const todayKey = getTodayKey();
    if (todayKey > dietGoal.startDate && todayKey < dietGoal.endDate) {
        const todayX = getX(todayKey);
        svg.appendChild(createSvgElement('line', {
            x1: todayX, y1: 12, x2: todayX, y2: 92, stroke: '#94a3b8', 'stroke-width': 1, 'stroke-dasharray': '2 2'
        }));
        appendSvgText(svg, { x: todayX, y: 9, 'font-size': 7.5, fill: '#64748b', 'text-anchor': 'middle' }, '오늘');
    }

    // 목표 체중선
    if (progress.targetWeight !== null) {
        const goalY = getY(progress.targetWeight);
        svg.appendChild(createSvgElement('line', {
            x1: 32, y1: goalY, x2: 290, y2: goalY, stroke: '#10b981', 'stroke-width': 1.5, 'stroke-dasharray': '4 3'
        }));
        appendSvgText(svg, { x: 290, y: goalY - 3, 'font-size': 8, fill: '#059669', 'font-weight': 'bold', 'text-anchor': 'end' },
            `목표 ${progress.targetWeight}kg`);
    }

    // 꺾은선 + 아래 면
    const points = chartRecords.map(record => ({ x: getX(record.recordDate), y: getY(record.weight) }));
    const linePath = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
        .join(' ');

    if (points.length > 1) {
        const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} 92 L ${points[0].x.toFixed(1)} 92 Z`;
        const defs = createSvgElement('defs');
        const gradient = createSvgElement('linearGradient', { id: 'chartGradient', x1: 0, y1: 0, x2: 0, y2: 1 });
        gradient.appendChild(createSvgElement('stop', { offset: '0%', 'stop-color': '#3b82f6' }));
        gradient.appendChild(createSvgElement('stop', { offset: '100%', 'stop-color': '#3b82f6', 'stop-opacity': 0 }));
        defs.appendChild(gradient);
        svg.appendChild(defs);
        svg.appendChild(createSvgElement('path', { d: areaPath, fill: 'url(#chartGradient)', opacity: 0.2 }));
        svg.appendChild(createSvgElement('path', {
            d: linePath, fill: 'none', stroke: '#3b82f6', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
        }));
    }

    // 점 (기록이 많으면 작게, 마지막 기록은 초록색으로 크게)
    const dotRadius = points.length > 20 ? 2 : 3;
    points.forEach((point, index) => {
        const isLast = index === points.length - 1;
        svg.appendChild(createSvgElement('circle', {
            cx: point.x, cy: point.y, r: isLast ? 4.5 : dotRadius,
            fill: isLast ? '#10b981' : '#3b82f6',
            stroke: isLast ? '#ffffff' : 'none', 'stroke-width': isLast ? 2 : 0
        }));
    });

    // 가로축: 시작일 / 종료일
    const formatAxisDate = (dateKey) => `${Number(dateKey.slice(5, 7))}/${Number(dateKey.slice(8, 10))}`;
    appendSvgText(svg, { x: 36, y: 108, 'font-size': 8, fill: '#64748b', 'text-anchor': 'start' },
        `${formatAxisDate(dietGoal.startDate)} 시작`);
    appendSvgText(svg, { x: 288, y: 108, 'font-size': 8, fill: '#64748b', 'text-anchor': 'end' },
        `${formatAxisDate(dietGoal.endDate)} 종료`);

    svg.setAttribute('aria-label',
        `기간 동안 체중 변화 그래프: ${progress.startWeight}kg에서 ${progress.currentWeight}kg, 기록 ${progress.periodRecords.length}개`);
}

// 일별 기록 목록 (최근 날짜가 위, 전날 기록과 비교)
function renderDietRecordList(progress) {
    const listElement = document.getElementById('dietRecordList');
    listElement.replaceChildren();

    const records = progress ? progress.periodRecords : [];
    if (records.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'px-3 py-4 text-center text-xs text-slate-400';
        emptyItem.textContent = dietGoal === null ? '기간을 설정하면 기록이 여기에 쌓여요.' : '아직 기간 안에 기록이 없어요.';
        listElement.appendChild(emptyItem);
        return;
    }

    const allRecords = getBodyRecordsSorted();
    [...records].reverse().forEach(record => {
        const recordIndex = allRecords.findIndex(item => item.recordDate === record.recordDate);
        const previousRecord = recordIndex > 0 ? allRecords[recordIndex - 1] : null;
        const diffKg = previousRecord ? record.weight - previousRecord.weight : null;

        const item = document.createElement('li');
        item.className = 'flex items-center gap-2 px-3 py-2.5 text-xs bg-white dark:bg-slate-800';

        const dateCell = document.createElement('span');
        dateCell.className = 'w-[4.5rem] shrink-0 whitespace-nowrap font-medium text-slate-500';
        dateCell.textContent = formatShortDate(record.recordDate);

        const weightCell = document.createElement('span');
        weightCell.className = 'flex-1 whitespace-nowrap font-bold text-slate-800 dark:text-slate-100';
        weightCell.textContent = `${record.weight.toFixed(1)} kg`;

        const diffCell = document.createElement('span');
        diffCell.className = 'w-11 shrink-0 text-right font-bold';
        if (diffKg === null || Math.abs(diffKg) < 0.05) {
            diffCell.classList.add('text-slate-400');
            diffCell.textContent = diffKg === null ? '-' : '0.0';
        } else {
            diffCell.classList.add(diffKg < 0 ? 'text-emerald-600' : 'text-rose-500');
            diffCell.textContent = `${diffKg > 0 ? '+' : ''}${diffKg.toFixed(1)}`;
        }

        const bmiCell = document.createElement('span');
        bmiCell.className = 'w-16 shrink-0 whitespace-nowrap text-right text-slate-500';
        bmiCell.textContent = `BMI ${computeRecordBmi(record).toFixed(1)}`;

        // 실수로 지우지 않도록 두 번 눌러야 삭제된다
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'w-9 shrink-0 text-right text-slate-400 hover:text-rose-500 font-bold whitespace-nowrap';
        deleteButton.setAttribute('aria-label', `${formatShortDate(record.recordDate)} 기록 삭제`);
        deleteButton.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
        deleteButton.addEventListener('click', () => {
            if (deleteButton.dataset.armed === 'true') {
                deleteWeightLog(record.recordDate);
                return;
            }
            deleteButton.dataset.armed = 'true';
            deleteButton.textContent = '삭제?';
            deleteButton.classList.add('text-rose-500');
            setTimeout(() => {
                if (!deleteButton.isConnected) return;
                deleteButton.dataset.armed = 'false';
                deleteButton.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
                deleteButton.classList.remove('text-rose-500');
            }, 3000);
        });

        item.append(dateCell, weightCell, diffCell, bmiCell, deleteButton);
        listElement.appendChild(item);
    });
}

// 진행 일수 / 남은 일수 / 주당 변화
function buildDietDayText(progress) {
    if (dietGoal === null) return '기간을 정하고 매일 체중을 기록하면 변화가 보여요.';

    const todayKey = getTodayKey();
    const totalDays = getDaysBetween(dietGoal.startDate, dietGoal.endDate) + 1;
    let dayText;
    if (todayKey < dietGoal.startDate) {
        dayText = `시작까지 ${getDaysBetween(todayKey, dietGoal.startDate)}일 남음 · 총 ${totalDays}일`;
    } else if (todayKey > dietGoal.endDate) {
        dayText = `기간 종료 · 총 ${totalDays}일`;
    } else {
        dayText = `${getDaysBetween(dietGoal.startDate, todayKey) + 1}일째 / 총 ${totalDays}일 · ${getDaysBetween(todayKey, dietGoal.endDate)}일 남음`;
    }

    if (progress !== null) {
        const recordDays = getDaysBetween(progress.startRecord.recordDate, progress.latestRecord.recordDate);
        dayText += ` · 기록 ${progress.periodRecords.length}회`;
        if (recordDays >= 7) {
            const weeklyKg = (progress.changeKg / recordDays) * 7;
            dayText += ` · 주당 ${weeklyKg > 0 ? '+' : ''}${weeklyKg.toFixed(2)}kg`;
        }
    }
    return dayText;
}

function renderDietSection() {
    if (currentUser === null) return;

    const setText = (elementId, text) => {
        document.getElementById(elementId).textContent = text;
    };
    const progress = calculateDietProgress();

    // 내 신체 정보 요약 (수정은 마이페이지에서)
    setText('bodySummaryText',
        `${bodyProfile.gender === 'male' ? '남성' : '여성'} · ${bodyProfile.age}세 · ${bodyProfile.height}cm · ${bodyProfile.weight}kg`);

    setText('dietPeriodText', dietGoal === null
        ? '다이어트 기간을 설정해 주세요'
        : `${dietGoal.startDate} ~ ${dietGoal.endDate}`);
    setText('dietDayText', buildDietDayText(progress));

    // 시작 / 현재 / 변화
    const changeElement = document.getElementById('dietChangeText');
    changeElement.classList.remove('text-emerald-600', 'text-rose-500');
    if (progress !== null) {
        setText('dietStartWeightText', `${progress.startWeight.toFixed(1)} kg`);
        setText('dietCurrentWeightText', `${progress.currentWeight.toFixed(1)} kg`);
        setText('dietChangeText', `${progress.changeKg > 0 ? '+' : ''}${progress.changeKg.toFixed(1)} kg`);
        if (progress.changeKg < 0) changeElement.classList.add('text-emerald-600');
        if (progress.changeKg > 0) changeElement.classList.add('text-rose-500');
    } else {
        ['dietStartWeightText', 'dietCurrentWeightText', 'dietChangeText'].forEach(elementId => setText(elementId, '-'));
    }

    drawWeightChart(progress);

    // 현재 BMI: 기간 안 가장 최근 기록 → 없으면 전체 중 가장 최근 기록 → 없으면 신체 정보
    const allRecords = getBodyRecordsSorted();
    const latestRecord = progress !== null ? progress.latestRecord : allRecords[allRecords.length - 1];
    const currentWeight = latestRecord ? latestRecord.weight : bodyProfile.weight;
    const currentMetrics = computeBodyMetrics({ ...bodyProfile, weight: currentWeight });
    renderBodyMetrics(currentMetrics);

    // 현재 BMI 글자색: 저체중 파랑 / 정상 초록 / 과체중 주황 / 비만 빨강
    const bmiColorClasses = {
        '저체중': ['text-blue-600', 'dark:text-blue-400'],
        '정상': ['text-emerald-600', 'dark:text-emerald-400'],
        '과체중': ['text-amber-600', 'dark:text-amber-400'],
        '비만': ['text-rose-600', 'dark:text-rose-400']
    };
    const bmiTextElement = document.getElementById('resBmiText');
    Object.values(bmiColorClasses).flat().forEach(className => bmiTextElement.classList.remove(className));
    bmiTextElement.classList.add(...bmiColorClasses[currentMetrics.label]);

    if (progress !== null) {
        const startBmi = computeRecordBmi(progress.startRecord);
        const bmiDiff = currentMetrics.bmi - startBmi;
        setText('dietBeforeBmiText',
            `${startBmi.toFixed(1)} → ${currentMetrics.bmi.toFixed(1)} (${bmiDiff > 0 ? '+' : ''}${bmiDiff.toFixed(1)})`);
    } else {
        setText('dietBeforeBmiText', '-');
    }

    // 목표 달성도
    if (progress !== null && progress.percent !== null) {
        setText('dietAchieveText', `${progress.percent}% 달성`);
        document.getElementById('dietProgressBar').style.width = progress.percent + '%';
    } else {
        setText('dietAchieveText', hasTargetWeight() ? '-' : '목표 체중 미설정');
        document.getElementById('dietProgressBar').style.width = '0%';
    }
    setText('dietTargetText', hasTargetWeight() ? `${dietGoal.targetWeight} kg` : '-');

    if (dietGoal !== null) {
        const burnedEndKey = getTodayKey() < dietGoal.endDate ? getTodayKey() : dietGoal.endDate;
        setText('dietBurnedText', `약 ${estimateBurnedKcal(dietGoal.startDate, burnedEndKey).toLocaleString()} kcal`);
    } else {
        setText('dietBurnedText', '-');
    }

    renderDietRecordList(progress);
}

// 기간 설정 칸 채우기 (목표가 없으면 오늘부터 30일)
function fillDietPeriodForm() {
    const todayKey = getTodayKey();
    document.getElementById('periodStartDate').value = dietGoal ? dietGoal.startDate : todayKey;
    document.getElementById('periodEndDate').value = dietGoal ? dietGoal.endDate : formatDateKey(addDays(new Date(), 29));
    document.getElementById('periodTargetWeight').value = hasTargetWeight() ? dietGoal.targetWeight : '';

    const logDateInput = document.getElementById('weightLogDate');
    logDateInput.value = todayKey;
    logDateInput.max = todayKey;
    const latestRecord = getBodyRecordsSorted().pop();
    document.getElementById('weightLogValue').placeholder = latestRecord ? String(latestRecord.weight) : String(bodyProfile.weight);
}

async function saveDietPeriod(event) {
    event.preventDefault();
    if (currentUser === null) return;

    const startDate = document.getElementById('periodStartDate').value;
    const endDate = document.getElementById('periodEndDate').value;
    const targetText = document.getElementById('periodTargetWeight').value.trim();
    const targetWeight = targetText === '' ? null : parseFloat(targetText);

    if (!startDate || !endDate) {
        showToast('시작일과 종료일을 모두 선택해 주세요.');
        return;
    }
    if (startDate > endDate) {
        showToast('종료일은 시작일보다 빠를 수 없어요.');
        return;
    }
    if (targetWeight !== null && (!Number.isFinite(targetWeight) || targetWeight < 20 || targetWeight > 300)) {
        showToast('목표 체중은 20~300kg 사이로 입력해 주세요.');
        return;
    }

    dietGoal = {
        goalId: dietGoal ? dietGoal.goalId : 1,
        userId: currentUser.userId,
        targetWeight: targetWeight,
        startDate: startDate,
        endDate: endDate,
        isActive: getTodayKey() <= endDate
    };

    await saveStoredValue('dietGoal', dietGoal);
    fillGoalForm();
    renderDietSection();
    renderMyPage();
    showToast('다이어트 기간을 저장했어요.');
}

// 고른 날짜의 체중 기록을 새로 만들거나 덮어쓴다
async function saveWeightLog(event) {
    event.preventDefault();
    if (currentUser === null) return;

    const dateKey = document.getElementById('weightLogDate').value;
    const weight = parseFloat(document.getElementById('weightLogValue').value);

    if (!dateKey) {
        showToast('날짜를 선택해 주세요.');
        return;
    }
    if (dateKey > getTodayKey()) {
        showToast('미래 날짜에는 기록할 수 없어요.');
        return;
    }
    if (!Number.isFinite(weight) || weight < 20 || weight > 300) {
        showToast('체중은 20~300kg 사이로 입력해 주세요.');
        return;
    }

    const roundedWeight = Math.round(weight * 10) / 10;
    const metrics = computeBodyMetrics({ ...bodyProfile, weight: roundedWeight });
    const existingIndex = bodyRecords.findIndex(record => record.recordDate === dateKey);
    const record = {
        bodyRecordId: existingIndex >= 0
            ? bodyRecords[existingIndex].bodyRecordId
            : bodyRecords.reduce((maxId, item) => Math.max(maxId, item.bodyRecordId || 0), 0) + 1,
        userId: currentUser.userId,
        recordDate: dateKey,
        height: bodyProfile.height,
        weight: roundedWeight,
        bmi: Number(metrics.bmi.toFixed(2)),
        bmr: Math.round(metrics.bmr)
    };

    if (existingIndex >= 0) {
        bodyRecords[existingIndex] = record;
    } else {
        bodyRecords.push(record);
    }
    bodyRecords.sort((a, b) => a.recordDate.localeCompare(b.recordDate));

    await afterWeightRecordsChanged();
    document.getElementById('weightLogValue').value = '';
    showToast(`${formatShortDate(dateKey)} 체중 ${roundedWeight}kg을 기록했어요.`);
}

async function deleteWeightLog(dateKey) {
    bodyRecords = bodyRecords.filter(record => record.recordDate !== dateKey);
    await afterWeightRecordsChanged();
    showToast(`${formatShortDate(dateKey)} 기록을 삭제했어요.`);
}

// 가장 최근 기록을 지금 몸무게로 삼고, 저장한 뒤 화면을 다시 그린다
async function afterWeightRecordsChanged() {
    const latestRecord = getBodyRecordsSorted().pop();
    if (latestRecord) bodyProfile = { ...bodyProfile, weight: latestRecord.weight };

    await Promise.all([
        saveStoredValue('bodyProfile', bodyProfile),
        saveStoredValue('bodyRecords', bodyRecords)
    ]);

    applyBodyProfileToInputs();
    fillDietPeriodForm();
    renderDietSection();
    renderMyPage();
    renderBmrAnalysis();
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
    // 서버(MySQL)에도 저장한다. 실패해도 기기 저장은 유지된다.
        const savedToServer = await saveGpsRecord(
            null,
            Number(distanceKm.toFixed(2)),
            Math.round(caloriesBurned),
            getRunPathForSave()
        );
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
    showToast(savedToServer ? '런닝 기록을 저장했어요.' : '기기에는 저장했지만 서버 저장은 실패했어요.');

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
    setText('myBmi', `${metrics.bmi.toFixed(1)} (${metrics.label})`);
    setText('myBmr', `${Math.round(metrics.bmr).toLocaleString()} kcal`);

    // 다이어트 목표 진행
    const progress = calculateDietProgress();
    if (progress !== null) {
        if (progress.percent !== null) {
            setText('goalProgressText', `${progress.percent}% 달성 (현재 ${progress.currentWeight}kg, 목표 ${progress.targetWeight}kg)`);
            document.getElementById('goalProgressBar').style.width = progress.percent + '%';
        } else {
            setText('goalProgressText', `현재 ${progress.currentWeight}kg (목표 체중을 정하면 달성도가 보여요)`);
            document.getElementById('goalProgressBar').style.width = '0%';
        }
    } else {
        setText('goalProgressText', '아직 설정한 목표가 없어요');
        document.getElementById('goalProgressBar').style.width = '0%';
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
    if (dietGoal === null) {
        // 목표가 없으면 다른 계정의 값이 남지 않도록 입력칸을 비운다
        ['goalTargetWeight', 'goalStartDate', 'goalEndDate'].forEach(elementId => {
            document.getElementById(elementId).value = '';
        });
        document.getElementById('goalIsActive').checked = true;
        return;
    }

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
    fillDietPeriodForm();
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
    // 신체 기록은 지금 신체 정보(초기값 설정에서 받은 값)로 오늘 값 1건만 남기고, 다이어트 목표는 없앤다.
    workoutState = {};
    workoutLogs = [];
    nextRoutineId = 1;
    exerciseLogs = {};
    gpsLogs = [];
    nextExerciseLogId = 1;
    bodyRecords = [];
    saveBodyRecord(bodyProfile, computeBodyMetrics(bodyProfile));
    dietGoal = null;

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
    fillDietPeriodForm();
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
    document.getElementById('dietPeriodForm').addEventListener('submit', saveDietPeriod);
    document.getElementById('weightLogForm').addEventListener('submit', saveWeightLog);
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

