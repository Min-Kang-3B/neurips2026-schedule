# NeurIPS 2026 일정 사이트 (Sydney · Atlanta · Paris)

neurips.cc 가상 사이트(2026)를 전부 수집해 만든 **한국어/영어 전환 가능한** 정적 일정 웹사이트 + PWA입니다.
NeurIPS 2026은 시드니(메인, 12/6–12)와 애틀랜타·파리(위성, 12/9–13) 세 곳에서 열리며, 개최지 탭으로 전환합니다.

## 실행

```bash
python3 -m http.server 8643
# → http://localhost:8643
```

`index.html`을 브라우저로 직접 열어도 동작합니다(모든 데이터가 `<script>` 태그로 로드되어 `file://`에서도 OK).

## 기능

- **개최지 탭** — 시드니 / 애틀랜타 / 파리, 각 개최지 **현지 시각** 기준(AEDT / EST / CET)
- **요일 탭** — 엑스포 · 튜토리얼 · 본회의 · 워크숍 일자별 타임라인
- **한국어 ↔ English** — 이벤트 제목·소개, 논문 제목·초록 번역
- **유형 필터** — 오럴 / 포스터 / 초청·특별 / 튜토리얼 / 워크숍·대회 / 엑스포 / 소셜 / 운영
- **검색** — 세 개최지 전체 이벤트 + 전체 논문 제목·저자 검색
- **상세 모달** — 소개(한/영), 포스터·오럴 논문 목록과 초록, 워크숍 수록 논문, OpenReview·neurips.cc 링크
- **위시리스트** — 카드/논문을 길게 눌러 핀, ⭐ 필터로 하루 동선 보기
- **PWA** — 설치 + 오프라인 전체 저장
- **딥링크** — `?loc=paris&day=paris-2026-12-10&lang=en&open=<eventId>&q=<검색어>&theme=dark`

## 데이터 파이프라인 (`scripts/`)

작업 디렉토리는 `work/`(gitignore). 원본·중간 산출물이 여기에 남습니다.

```bash
cd work
python3 -m venv venv && venv/bin/pip install beautifulsoup4 lxml requests
venv/bin/python ../scripts/fetch.py index      # 캘린더 3곳 + 이벤트 목록 + papers.json
venv/bin/python ../scripts/fetch.py details    # 상세 페이지 ~9.6k (재개 가능) → details.jsonl
venv/bin/python ../scripts/parse.py            # → events.json, papers_main.json, tr_in_*.json
venv/bin/python ../scripts/translate_codex.py titles|misc|abstracts|pabs|wtitles   # codex CLI → ko_*.json
venv/bin/python ../scripts/build_site.py ..    # → data/
```

### neurips.cc 수집 시 주의점

- **모든 개최지의 시간이 시드니 시각(AEDT)으로 렌더링됩니다.** 캘린더·목록·상세 페이지 모두 해당. `parse.py`가 Australia/Sydney로 해석한 뒤 각 개최지 시간대로 변환합니다.
- **orals-posters JSON은 페이지네이션 중복으로 불완전합니다**(9,278행 중 고유 5,596편). 캘린더의 포스터 세션 목록이 완전하므로 둘을 합치고, 누락분은 포스터 상세 페이지에서 저자·초록을 가져옵니다.
- 오럴 논문의 오럴 세션 배정은 아직 공개되지 않았습니다. 개최지별 오럴 목록을 오럴 세션에 연결해 보여주고, 상세 페이지의 related-events 링크가 생기면 자동으로 세션별로 배정됩니다.
- 워크숍·대회 페이지 안에 수록 논문 목록(제목·저자·OpenReview 링크)이 들어 있습니다.

출처: https://neurips.cc/virtual/2026 · 비공식 사이트입니다.
