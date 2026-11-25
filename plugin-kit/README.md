# NeurIPS 2026 플러그인 (MCP + 스킬)

NeurIPS 2026 논문 검색, 일정 조회, 위시리스트 관리를 AI 도구에서 쓰게 해 주는 묶음입니다.

- **MCP 서버**: `https://neurips2026-mcp.neurips2026-mcp.workers.dev/mcp`
  - 논문 검색(키워드·의미), 초록(영·한), 일정, 위시리스트 도구를 제공합니다.
- **스킬** `neurips2026-planner`: 위 도구를 언제 어떻게 쓸지 알려 줍니다. 기본 개최지는 시드니이고, 보드 번호를 항상 보여 주며, 일정이 겹치는지 확인합니다.
- 웹사이트: https://min-kang-3b.github.io/neurips2026-schedule/

다루는 데이터는 neurips.cc에 공개된 학회 정보뿐입니다. 비공식 사이트이고, 개인정보는 저장하지 않습니다.

## 위시리스트 동기화 코드 (선택)
- 검색과 일정 조회만 쓸 거면 코드는 필요 없습니다.
- 위시리스트를 AI와 웹사이트에서 같이 쓰려면 코드를 만드세요. 웹사이트에서 **타임테이블 → 🔗 AI 연결·동기화 → 동기화 코드 만들기**를 누르면 됩니다.
- 코드는 비밀번호처럼 다루세요. 코드를 아는 사람은 위시리스트를 보고 고칠 수 있습니다. 저장소, 이슈, 채팅에 붙여 넣지 마세요.

---

## 1. Claude Code (플러그인 설치, 추천)
이 저장소 자체가 플러그인 마켓플레이스입니다.

```bash
claude plugin marketplace add https://github.com/3billion/neurips2026-kit
claude plugin install neurips2026@neurips2026-kit
```

- 비공개 저장소라 3billion GitHub 조직에 접근 권한이 있어야 합니다. 평소 `git clone`이 되는 계정이면 됩니다. SSH를 쓰면 `git@github.com:3billion/neurips2026-kit.git`도 됩니다.
- Claude Code 안에서는 `/plugin marketplace add <주소>`, `/plugin install neurips2026@neurips2026-kit`로도 설치할 수 있습니다.

동기화 코드를 넣을 때(선택):
```bash
claude plugin configure neurips2026@neurips2026-kit
```
또는 Claude Code 안에서 `/plugin configure neurips2026@neurips2026-kit`를 실행합니다. 넣은 뒤에는 Claude Code를 다시 시작하세요.

확인:
```bash
claude mcp list
```
목록에 `plugin:neurips2026:neurips2026 … ✔ Connected`가 보이면 됩니다.

업데이트:
```bash
claude plugin marketplace update neurips2026-kit
```
```bash
claude plugin update neurips2026@neurips2026-kit
```

## 2. Codex CLI
```bash
codex mcp add neurips2026 --url https://neurips2026-mcp.neurips2026-mcp.workers.dev/mcp
```
- 위시리스트까지 쓰려면 주소 끝을 `/mcp/<동기화코드>`로 바꿉니다.
- 스킬도 쓰려면 `plugins/neurips2026/skills/neurips2026-planner` 폴더를 `~/.codex/skills/`에 복사합니다.

## 3. Claude 웹·데스크톱 앱 (claude.ai)
- **MCP**: 설정 → 커넥터 → 사용자 지정 커넥터 추가에서 위 MCP 주소를 넣습니다. 인증은 없습니다.
  - Team·Enterprise 플랜은 조직 관리자가 커넥터를 허용해야 할 수 있습니다.
- **스킬**: `neurips2026-planner` 폴더를 zip으로 묶어 설정의 스킬 메뉴에서 올립니다. 메뉴 위치와 사용 가능 여부는 플랜에 따라 다릅니다.

## 4. ChatGPT
- 설정의 개발자 모드(Developer mode)에서 커넥터를 만들고 위 MCP 주소를 넣습니다. 인증은 없습니다.
- Business·Enterprise 워크스페이스는 관리자가 허용해야 할 수 있습니다.

---

## 구조
```
.claude-plugin/marketplace.json          # 마켓플레이스 (플러그인 목록)
plugins/neurips2026/
  .claude-plugin/plugin.json             # 플러그인 정보 + sync_code 옵션
  .mcp.json                              # MCP 서버 주소 (${user_config.sync_code} 치환)
  skills/neurips2026-planner/SKILL.md    # 스킬
```
검증:
```bash
claude plugin validate .
```

## 운영 메모
- MCP 서버(Cloudflare Workers + D1)와 웹사이트는 **개인 계정에서 운영하는 비공식 서비스**입니다. 회사 인프라가 아니고, 가동 여부나 데이터 정확도를 보장하지 않습니다.
- 데이터는 neurips.cc를 주기적으로 다시 받아 갱신합니다. 가장 정확한 정보는 공식 페이지(`url` 필드)를 확인하세요.
