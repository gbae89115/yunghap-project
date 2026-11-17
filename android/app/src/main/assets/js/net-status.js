/* ==========================================
   연결 상태 안내 (헤더 바로 아래의 얇은 띠)
   - 인터넷이 끊기면: "인터넷에 연결되어 있지 않아요" (다시 연결되면 사라진다)
   - 서버 응답이 늦으면: "서버에 연결하는 중이에요…" (무료 서버는 쉬다가 깨어나는 데 시간이 걸린다)
   - 서버 요청이 실패하면: "서버에 연결하지 못했어요" + [다시 확인]
   api.js 는 고치지 않고, 서버(API_BASE_URL)로 가는 fetch 만 지켜본다.
   ========================================== */
const netSlowAfterMs = 2500;   // 이 시간보다 오래 걸리면 "연결하는 중" 을 보여 준다
const netOkHideMs = 2000;      // "연결됐어요" 를 보여 주는 시간
const netServerRoot = API_BASE_URL.replace(/\/api\/?$/, '/');

let netPendingCount = 0;       // 진행 중인 서버 요청 수
let netSlowTimerId = null;
let netHideTimerId = null;

// state: 'offline' | 'waking' | 'failed' | 'ok' | 'hidden'
function showNetBanner(state) {
    const banner = document.getElementById('netBanner');
    if (!banner) return;

    const messages = {
        offline: '인터넷에 연결되어 있지 않아요. 기록은 휴대폰에 저장돼요.',
        waking: '서버에 연결하는 중이에요. 처음에는 30초쯤 걸릴 수 있어요.',
        failed: '서버에 연결하지 못했어요. 기록은 휴대폰에 남아 있어요.',
        ok: '연결됐어요.'
    };

    clearTimeout(netHideTimerId);
    banner.dataset.state = state;
    banner.hidden = state === 'hidden';
    if (state === 'hidden') return;

    document.getElementById('netBannerText').textContent = messages[state];
    document.getElementById('netBannerRetry').hidden = state !== 'failed';
    if (state === 'ok') netHideTimerId = setTimeout(() => showNetBanner('hidden'), netOkHideMs);
}

function isServerRequest(input) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    return url.startsWith(API_BASE_URL);
}

// 서버로 가는 요청을 지켜보다가 늦어지거나 실패하면 띠로 알려 준다
function watchServerRequests() {
    const originalFetch = window.fetch.bind(window);

    window.fetch = function (input, init) {
        if (!isServerRequest(input)) return originalFetch(input, init);

        netPendingCount += 1;
        if (netSlowTimerId === null) {
            netSlowTimerId = setTimeout(() => {
                if (netPendingCount > 0 && navigator.onLine) showNetBanner('waking');
            }, netSlowAfterMs);
        }

        const finish = (succeeded) => {
            netPendingCount -= 1;
            if (netPendingCount > 0) return;

            clearTimeout(netSlowTimerId);
            netSlowTimerId = null;

            const banner = document.getElementById('netBanner');
            if (!navigator.onLine) {
                showNetBanner('offline');
            } else if (!succeeded) {
                showNetBanner('failed');
            } else if (banner && !banner.hidden) {
                showNetBanner('ok'); // 띠가 떠 있던 경우에만 "연결됐어요" 로 마무리한다
            }
        };

        return originalFetch(input, init).then(
            (response) => {
                finish(response.status < 500);
                return response;
            },
            (error) => {
                finish(false);
                throw error;
            }
        );
    };
}

// [다시 확인]: 서버 첫 화면을 불러 보고 연결 여부만 확인한다
async function retryServerConnection() {
    if (!navigator.onLine) {
        showNetBanner('offline');
        return;
    }

    showNetBanner('waking');
    try {
        await fetch(netServerRoot, { mode: 'no-cors', cache: 'no-store' });
        showNetBanner('ok');
    } catch (error) {
        showNetBanner('failed');
    }
}

function bindNetStatus() {
    watchServerRequests();

    window.addEventListener('offline', () => showNetBanner('offline'));
    window.addEventListener('online', () => showNetBanner('ok'));
    if (!navigator.onLine) showNetBanner('offline');

    document.getElementById('netBannerRetry').addEventListener('click', retryServerConnection);

    // 인터넷이 없을 때 카카오 로그인을 누르면 오류 화면으로 넘어가므로, 안내만 하고 막는다
    document.getElementById('kakaoLoginButton').addEventListener('click', (event) => {
        if (navigator.onLine) return;
        event.stopImmediatePropagation();
        event.preventDefault();
        showToast('인터넷 연결을 확인한 뒤 다시 시도해 주세요.');
    }, true);
}

// app.js 가 버튼 이벤트를 붙이기 전에 먼저 등록해야 하므로 바로 실행한다 (스크립트는 문서 맨 끝에 있다)
bindNetStatus();
