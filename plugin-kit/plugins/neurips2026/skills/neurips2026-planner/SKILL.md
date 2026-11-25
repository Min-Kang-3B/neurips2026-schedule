---
name: neurips2026-planner
description: Plan a NeurIPS 2026 conference visit with the neurips2026 MCP tools - find papers by topic/institution/author, check session times, rooms and poster boards, and manage the personal wishlist. Use when the user asks about NeurIPS 2026 papers, posters, orals, sessions, schedule, or their conference wishlist.
---

# NeurIPS 2026 planner

Use the `neurips2026` MCP server tools. All data is public conference information
(neurips.cc) — never ask for or store personal/patient data.

## Defaults
- Venue defaults to **Sydney** (AEDT, UTC+11). Only use Atlanta/Paris when the user asks.
- Answer in the user's language; give Korean titles (`title_ko`) when the user writes Korean.
- Always show session **date, time, room and poster board** (`poster_board`, e.g. `#S1000`) for papers.

## Tools
| Need | Tool |
|---|---|
| Find papers by topic/meaning | `search_papers` with `mode: "semantic"` (English description works best) |
| Find by exact words, author, institution, board | `search_papers` with `mode: "keyword"` |
| Abstract (EN/KO), review scores + review/poster summaries, poster image | `get_paper` |
| Highly rated papers on a topic | `search_papers` with `min_review_avg` (1-6 scale) or `sort: "rating"` |
| Day schedule / list of days | `get_schedule` (`date`, optional `type` like `oral`, `poster`, `workshop`) |
| Find talks, workshops, socials | `search_events` |
| Wishlist (only if the URL has a sync code) | `get_wishlist`, `add_to_wishlist` (`paper_ids` / `event_ids`), `remove_from_wishlist` |

## Workflows
- **"Find papers on X"** → semantic search (limit ~10), then group by session time; flag Oral/Spotlight.
- **"Plan my day"** → `get_wishlist`, sort by start time, point out overlaps (`conflicts`) and suggest which to drop; include room hops.
- **"Is this paper good / what did reviewers say?"** → `get_paper`; quote `openreview_reviews` and `review_summary_ko`, mention it is an AI summary.
- **"What does the poster show?"** → `get_paper`; give `poster_summary` key numbers and link `poster_image`.
- **"Add these"** → confirm the exact papers first, then `add_to_wishlist`; report what changed.
- If wishlist tools are missing, tell the user to create a sync code on the site
  (Timetable → 🔗 AI & sync) and reconnect with `…/mcp/<code>`.

## Caveats
- Semantic search covers main-track papers; workshop papers are keyword-only.
- Times are local to each venue. Data is an unofficial mirror; link `url` for the official page.
