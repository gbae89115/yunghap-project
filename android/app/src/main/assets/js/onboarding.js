/* 회원가입 후 초기값 설정 (온보딩)
   담당: 장정민 (UI/UX)
   - 저장된 신체 정보가 없는 사용자가 처음 로그인하면 띄운다
     1단계: 이름 · 성별 · 나이 / 2단계: 키 · 몸무게 / 3단계: BMI 결과
   - 저장하는 값 (사용자별 localStorage)
     profileName  : 이름 (문자열)
     bodyProfile  : { gender, age, height, weight }
     bodyRecords  : [첫 체중 기록 1개]
   - app.js 함수 사용: requestStoredValue, saveStoredValue, isValidBodyProfile,
     getBodyProfileError, computeBodyMetrics, setAppInert, getTodayKey
   - 화면 모양은 index.html 의 #onboardingScreen 과 style.css 의 .onboarding-* */

const onboardingLastStep = 3;
let onboardingStep = 1;
let onboardingGender = null;
let resolveOnboarding = null;

// BMI 구간별 결과 카드 색상 키와 한 줄 안내 (구간 이름은 app.js 의 getBmiCategory 와 같다)
const onboardingBmiLevels = {
    '저체중': { level: 'under', tip: '조금 더 든든하게 먹고, 근력 운동을 루틴에 곁들여 보세요.' },
    '정상': { level: 'normal', tip: '건강한 범위예요! 지금 같은 루틴을 꾸준히 이어가요.' },
    '과체중': { level: 'over', tip: '가벼운 유산소부터 루틴에 하나씩 넣어 보세요.' },
    '비만': { level: 'obese', tip: '무리하지 말고 걷기와 가벼운 러닝부터 시작해요.' }
};

// 막대 그래프가 보여 주는 BMI 범위 (15 ~ 30)
const onboardingBmiScaleMin = 15;
const onboardingBmiScaleMax = 30;

// 저장된 신체 정보가 없으면 초기값 설정이 필요하다
async function needsOnboarding() {
    const storedProfile = await requestStoredValue('bodyProfile', null);
    return !isValidBodyProfile(storedProfile);
}

// 초기값 설정 화면을 띄우고, 사용자가 "시작하기"를 누를 때까지 기다린다
function runOnboarding() {
    return new Promise((resolve) => {
        resolveOnboarding = resolve;
        onboardingStep = 1;
        onboardingGender = null;
        ['onboardingName', 'onboardingAge', 'onboardingHeight', 'onboardingWeight'].forEach(inputId => {
            document.getElementById(inputId).value = '';
        });
        setOnboardingMessage('');
        renderOnboardingStep();

        const onboardingScreen = document.getElementById('onboardingScreen');
        onboardingScreen.classList.remove('hidden');
        onboardingScreen.inert = false;
        setAppInert(true);
    });
}

function closeOnboarding() {
    const onboardingScreen = document.getElementById('onboardingScreen');
    onboardingScreen.classList.add('hidden');
    onboardingScreen.inert = true;
    setAppInert(false);
}

function setOnboardingMessage(message) {
    document.getElementById('onboardingMessage').textContent = message;
}

// 현재 단계에 맞게 화면(단계, 진행 막대, 버튼, 성별 선택)을 그린다
function renderOnboardingStep() {
    for (let step = 1; step <= onboardingLastStep; step++) {
        document.getElementById(`onboardingStep${step}`).classList.toggle('hidden', onboardingStep !== step);
    }
    document.getElementById('onboardingStepLabel').textContent = `${onboardingStep} / ${onboardingLastStep}`;
    document.getElementById('onboardingProgress').style.width = `${(onboardingStep / onboardingLastStep) * 100}%`;
    document.getElementById('onboardingBack').classList.toggle('invisible', onboardingStep === 1);

    const nextLabels = { 1: '다음', 2: '결과 보기', 3: '시작하기' };
    document.getElementById('onboardingNext').textContent = nextLabels[onboardingStep];

    document.getElementById('onboardingMale').setAttribute('aria-pressed', String(onboardingGender === 'male'));
    document.getElementById('onboardingFemale').setAttribute('aria-pressed', String(onboardingGender === 'female'));
}

function selectOnboardingGender(gender) {
    onboardingGender = gender;
    setOnboardingMessage('');
    renderOnboardingStep();
}

function readOnboardingName() {
    return document.getElementById('onboardingName').value.trim();
}

function readOnboardingNumber(inputId) {
    const rawValue = document.getElementById(inputId).value.trim();
    return rawValue === '' ? NaN : Number(rawValue);
}

function readOnboardingProfile() {
    return {
        gender: onboardingGender,
        age: readOnboardingNumber('onboardingAge'),
        height: Math.round(readOnboardingNumber('onboardingHeight') * 10) / 10,
        weight: Math.round(readOnboardingNumber('onboardingWeight') * 10) / 10
    };
}

// 1단계 확인 (나이 범위는 app.js 의 getBodyProfileError 와 같다)
function getOnboardingStep1Error() {
    if (readOnboardingName() === '') return '이름을 입력해 주세요.';
    if (onboardingGender === null) return '성별을 선택해 주세요.';

    const age = readOnboardingNumber('onboardingAge');
    if (!Number.isInteger(age) || age < 10 || age > 100) {
        return '나이는 10~100세 사이로 입력해 주세요.';
    }
    return '';
}

// 3단계: BMI 숫자, 구간 배지, 막대 위치, 안내 문구, 기초대사량을 채운다
function renderOnboardingResult(profile) {
    const metrics = computeBodyMetrics(profile);
    const levelInfo = onboardingBmiLevels[metrics.label] || onboardingBmiLevels['정상'];

    document.getElementById('onboardingResultName').textContent = readOnboardingName();
    document.getElementById('onboardingResultCard').dataset.bmiLevel = levelInfo.level;
    document.getElementById('onboardingBmiValue').textContent = metrics.bmi.toFixed(1);
    document.getElementById('onboardingBmiLabel').textContent = metrics.label;
    document.getElementById('onboardingBmiTip').textContent = levelInfo.tip;
    document.getElementById('onboardingBmrValue').textContent = Math.round(metrics.bmr).toLocaleString('ko-KR');

    const clampedBmi = Math.min(onboardingBmiScaleMax, Math.max(onboardingBmiScaleMin, metrics.bmi));
    const markerPercent = ((clampedBmi - onboardingBmiScaleMin) / (onboardingBmiScaleMax - onboardingBmiScaleMin)) * 100;
    document.getElementById('onboardingBmiMarker').style.left = `${markerPercent}%`;
}

function goToOnboardingStep(step) {
    onboardingStep = step;
    setOnboardingMessage('');
    renderOnboardingStep();

    const firstInputIds = { 1: 'onboardingName', 2: 'onboardingHeight' };
    if (firstInputIds[step]) {
        document.getElementById(firstInputIds[step]).focus();
    } else if (document.activeElement) {
        document.activeElement.blur(); // 결과 화면에서는 키보드를 내린다
    }
}

// 입력값을 저장하고 화면을 닫는다
async function completeOnboarding() {
    const profile = readOnboardingProfile();
    const nextButton = document.getElementById('onboardingNext');
    nextButton.disabled = true;

    const metrics = computeBodyMetrics(profile);
    const firstRecord = {
        bodyRecordId: 1,
        userId: currentUser.userId,
        recordDate: getTodayKey(),
        height: profile.height,
        weight: profile.weight,
        bmi: Number(metrics.bmi.toFixed(2)),
        bmr: Math.round(metrics.bmr)
    };

    await saveStoredValue('profileName', readOnboardingName());
    await saveStoredValue('bodyProfile', profile);
    await saveStoredValue('bodyRecords', [firstRecord]);

    nextButton.disabled = false;
    closeOnboarding();

    if (resolveOnboarding) {
        resolveOnboarding(profile);
        resolveOnboarding = null;
    }
}

async function handleOnboardingSubmit(event) {
    event.preventDefault();

    if (onboardingStep === 1) {
        const stepError = getOnboardingStep1Error();
        if (stepError) {
            setOnboardingMessage(stepError);
            return;
        }
        goToOnboardingStep(2);
        return;
    }

    if (onboardingStep === 2) {
        const profile = readOnboardingProfile();
        const profileError = getBodyProfileError(profile);
        if (profileError) {
            setOnboardingMessage(profileError);
            return;
        }
        renderOnboardingResult(profile);
        goToOnboardingStep(3);
        return;
    }

    await completeOnboarding();
}

function bindOnboardingEvents() {
    document.getElementById('onboardingForm').addEventListener('submit', handleOnboardingSubmit);
    document.getElementById('onboardingBack').addEventListener('click', () => goToOnboardingStep(onboardingStep - 1));
    document.getElementById('onboardingMale').addEventListener('click', () => selectOnboardingGender('male'));
    document.getElementById('onboardingFemale').addEventListener('click', () => selectOnboardingGender('female'));
}

// 이 파일은 <body> 맨 끝에서 읽히므로 화면 요소가 이미 있다
bindOnboardingEvents();
