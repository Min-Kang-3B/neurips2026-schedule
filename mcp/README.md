# NeurIPS 2026 MCP 서버 (Cloudflare Workers)

ChatGPT·Claude에서 논문 검색과 위시리스트 관리를 하게 해 주는 원격 MCP 서버입니다.
사이트의 **🗓 타임테이블 → 🔗 AI 연결·동기화**에서 만든 동기화 코드로 위시리스트가 사이트와 이어집니다.

- MCP 주소: `https://neurips2026-mcp.<계정>.workers.dev/mcp/<동기화 코드>` (Streamable HTTP, 인증 없음 — 코드가 비밀번호 역할)
- 도구: `search_papers`(키워드/의미), `get_paper`, `get_schedule`, `search_events`, `search`·`fetch`(ChatGPT 호환), `get_wishlist`, `add_to_wishlist`, `remove_from_wishlist`
- 저장소: D1(논문·일정 + 동기화된 위시리스트), 의미 검색은 Workers AI `@cf/baai/bge-small-en-v1.5` + 사이트의 `data/search/emb.bin`

## 처음 배포

```bash
cd mcp && npm install
npx wrangler login                                   # 개인 Cloudflare 계정
npx wrangler d1 create neurips2026                   # 출력된 database_id를 wrangler.toml에 입력
npx wrangler d1 execute neurips2026 --remote --file=schema.sql
python3 ../scripts/build_d1.py                       # → work/d1_seed.sql
npx wrangler d1 execute neurips2026 --remote --file=../work/d1_seed.sql
npx wrangler deploy                                  # → https://neurips2026-mcp.<계정>.workers.dev
```

그다음 `assets/app.js`의 `SYNC_API` 값을 배포 주소로 바꾸고 사이트를 push하면 동기화 UI가 나타납니다.

## 데이터 업데이트 때

`build_site.py` 후 `build_d1.py` → `d1 execute --remote --file=../work/d1_seed.sql` (위시리스트 테이블은 건드리지 않음).
임베딩은 사이트의 `emb.bin`을 1시간 캐시로 읽으므로 사이트 배포만으로 반영됩니다.

## 로컬 테스트

Workers AI는 로그인 없이는 로컬에서 쓸 수 없어서, `[ai]` 블록을 뺀 설정으로 `wrangler dev`를 돌리면 키워드 검색·일정·위시리스트를 시험할 수 있습니다(`--local` D1에 schema/seed 실행 후).
