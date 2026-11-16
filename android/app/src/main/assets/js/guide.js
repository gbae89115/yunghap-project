/* ==========================================
   시작 가이드 (오늘 루틴 탭 맨 위)
   새 사용자는 데이터가 비어 있어서, 처음 해 볼 일 3가지를 안내한다.
   세 가지를 모두 끝내거나 '닫기'를 누르면 더 이상 보이지 않는다.
   app.js 의 전역 값(currentUser, workoutState, dietGoal)을 읽기만 한다.
   ========================================== */
function getGuideHiddenKey() {
    return `routinenote_guide_hidden_${currentUser.userId}`;
}

function isStartGuideHidden() {
    try {
        return localStorage.getItem(getGuideHiddenKey()) === '1';
    } catch (error) {
        return false;
    }
}

function hideStartGuide() {
    try {
        localStorage.setItem(getGuideHiddenKey(), '1');
    } catch (error) {
        // 저장 공간을 못 쓰면 이번 화면에서만 숨긴다
    }
    document.getElementById('startGuide').hidden = true;
}

// 각 단계가 끝났는지 지금 데이터로 판단한다
function getStartGuideSteps() {
    const todayRoutines = workoutState[getTodayKey()] || [];
    return {
        routine: todayRoutines.length > 0,
        complete: todayRoutines.some(item => item.completed),
        period: dietGoal !== null
    };
}

function renderStartGuide() {
    const guideElement = document.getElementById('startGuide');
    if (!guideElement) return;

    // 로그인 전, 시연용 계정, 닫은 사용자에게는 보여 주지 않는다
    if (currentUser === null || isDemoUser() || isStartGuideHidden()) {
        guideElement.hidden = true;
        return;
    }

    const steps = getStartGuideSteps();
    const doneCount = Object.values(steps).filter(Boolean).length;

    guideElement.querySelectorAll('[data-guide-step]').forEach(stepButton => {
        const isDone = steps[stepButton.dataset.guideStep];
        stepButton.classList.toggle('is-done', isDone);
        stepButton.setAttribute('aria-label',
            `${stepButton.querySelector('.guide-step-title').textContent}${isDone ? ' (완료)' : ''}`);
    });
    document.getElementById('startGuideCount').textContent = `${doneCount} / 3`;

    // 세 가지를 다 끝내면 가이드는 자동으로 사라진다
    guideElement.hidden = doneCount === 3;
}

function bindStartGuide() {
    const guideElement = document.getElementById('startGuide');
    if (!guideElement) return;

    document.getElementById('startGuideClose').addEventListener('click', hideStartGuide);

    guideElement.querySelectorAll('[data-guide-step]').forEach(stepButton => {
        stepButton.addEventListener('click', () => {
            const step = stepButton.dataset.guideStep;
            if (step === 'period') {
                switchTab('tab-body');
                document.getElementById('dietPeriodForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
            const targetId = step === 'routine' ? 'routineSelectCard' : 'todayChecklistCard';
            document.getElementById(targetId).scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    });

    // 다른 탭에서 오늘 루틴 탭으로 돌아올 때마다 다시 확인한다
    new MutationObserver(() => {
        if (!document.getElementById('tab-today').classList.contains('hidden')) renderStartGuide();
    }).observe(document.getElementById('tab-today'), { attributes: true, attributeFilter: ['class'] });
}

document.addEventListener('DOMContentLoaded', bindStartGuide);
