#!/usr/bin/env bash
# 루틴노트 앱이 인터넷 없이도 화면을 그릴 수 있도록
# 디자인(Tailwind), 아이콘(Font Awesome), 캘린더(FullCalendar), 글꼴(Pretendard) 파일을
# android/app/src/main/assets/vendor/ 에 내려받는다.
#
# 사용법 (Git Bash, 저장소 맨 위 폴더에서):
#   bash tools/download-vendor.sh
#
# 버전을 바꾸고 싶으면 아래 숫자만 고치고 다시 실행하면 된다.
TAILWIND_VERSION="3.4.17"
FONTAWESOME_VERSION="6.4.0"
FULLCALENDAR_VERSION="6.1.8"
PRETENDARD_VERSION="1.3.9"

set -u
cd "$(dirname "$0")/.." || exit 1
VENDOR="android/app/src/main/assets/vendor"
FA_BASE="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/${FONTAWESOME_VERSION}"
failed=0

download() {
    local url="$1" target="$2"
    mkdir -p "$(dirname "$target")"
    # 임시 파일(.part)로 받고, 끝까지 받았을 때만 진짜 파일로 바꾼다
    # (중간에 끊겨도 예전에 받아 둔 파일이 망가지지 않게)
    if curl -fsSL --retry 3 --retry-all-errors --retry-delay 2 -o "$target.part" "$url"; then
        mv -f "$target.part" "$target"
        printf '  OK   %-55s %8s bytes\n' "$target" "$(wc -c < "$target" | tr -d ' ')"
    else
        rm -f "$target.part"
        printf '  FAIL %s\n       (%s)\n' "$target" "$url"
        failed=1
    fi
}

echo "루틴노트 vendor 파일 내려받는 중..."
download "https://cdn.tailwindcss.com/${TAILWIND_VERSION}" "$VENDOR/tailwind/tailwindcss.js"
download "${FA_BASE}/css/all.min.css" "$VENDOR/fontawesome/css/all.min.css"
for font in fa-solid-900 fa-regular-400 fa-brands-400 fa-v4compatibility; do
    download "${FA_BASE}/webfonts/${font}.woff2" "$VENDOR/fontawesome/webfonts/${font}.woff2"
    download "${FA_BASE}/webfonts/${font}.ttf" "$VENDOR/fontawesome/webfonts/${font}.ttf"
done
download "https://cdn.jsdelivr.net/npm/fullcalendar@${FULLCALENDAR_VERSION}/index.global.min.js" "$VENDOR/fullcalendar/index.global.min.js"
download "https://cdn.jsdelivr.net/npm/pretendard@${PRETENDARD_VERSION}/dist/web/variable/woff2/PretendardVariable.woff2" "$VENDOR/pretendard/PretendardVariable.woff2"

echo
if [ "$failed" -eq 0 ]; then
    echo "완료! 모든 파일을 받았어요."
else
    echo "일부 파일을 받지 못했어요. 인터넷 연결을 확인하고 다시 실행해 주세요."
    exit 1
fi
