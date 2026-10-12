# PicklePro — Test Cases (1009 automated scenarios)

Generated from the actual run on 2026-10-12 (`npm test`, local MongoDB, isolated `picklepro_qa_*` / `picklepro_test` databases). Status is the real result of that run. Each scenario is an executed `node:test` test; the expected result, preconditions and inputs are encoded in the test named here (see the file per category).

| Category | File | Scenarios | Pass | Fail |
|---|---|---|---|---|
| Original regression suite (server/test/draw.test.js) | `server/test/draw.test.js` | 23 | 23 | 0 |
| API | `server/test/qa/api.test.js` | 346 | 346 | 0 |
| Database integrity & recovery | `server/test/qa/db.test.js` | 45 | 45 | 0 |
| Draw engine | `server/test/qa/engine.test.js` | 259 | 259 | 0 |
| Concurrency / race | `server/test/qa/race.test.js` | 30 | 30 | 0 |
| Security | `server/test/qa/security.test.js` | 89 | 89 | 0 |
| System integration (HTTP + Socket.IO + DB), predictions, viewers, import, config | `server/test/qa/sit.test.js` | 78 | 78 | 0 |
| Unit | `server/test/qa/unit.test.js` | 139 | 139 | 0 |
| **Total** | | **1009** | **1009** | **0** |

## Original regression suite (server/test/draw.test.js)

| ID | Scenario (precondition / action → expected) | Status |
|---|---|---|
| LEGACY | shuffle is a permutation | PASS |
| LEGACY | admin APIs reject the audience | PASS |
| LEGACY | player validation | PASS |
| LEGACY | full draw A, Women, B, C, D with guards, undo and export | PASS |
| LEGACY | concurrent spins from two admin tabs never double-assign | PASS |
| LEGACY | spin is hidden until reveal, broadcast over Socket.IO, and survives a restart | PASS |
| LEGACY | health reports the database | PASS |
| LEGACY | archive lists past tournaments and exports any of them | PASS |
| LEGACY | spreadsheet import | PASS |
| LEGACY | every host route requires the admin cookie | PASS |
| LEGACY | login cookie is HttpOnly + SameSite=Strict, and logout clears it | PASS |
| LEGACY | new tournaments default to A, Women, B, C | PASS |
| LEGACY | categories lock at start and the next category waits for finalize | PASS |
| LEGACY | audience sockets cannot change the draw | PASS |
| LEGACY | spreadsheet upload over HTTP is validated | PASS |
| LEGACY | login is rate limited after repeated failures only | PASS |
| LEGACY | A is shuffled in one go wherever it sits in the order | PASS |
| LEGACY | every draw is provably fair: sealed before the spin, verifiable after | PASS |
| LEGACY | reactions: only the allowed emojis are relayed, and they are rate limited | PASS |
| LEGACY | host can switch predictions off and on; records are kept and the server enforces it | PASS |
| LEGACY | predictions: open only for the next spin, scored only after the reveal | PASS |
| LEGACY | audience ticker and viewer count | PASS |
| LEGACY | kids event: 4 teams, Icon Boy shuffle, Boy, two Girl rounds from one list — separate from the main draw | PASS |

## API

| ID | Scenario (precondition / action → expected) | Status |
|---|---|---|
| API-001 | auth: main GET /admin with no cookie -> 401, no change | PASS |
| API-002 | auth: main GET /admin with forged signature -> 401, no change | PASS |
| API-003 | auth: main GET /admin with signed with another secret -> 401, no change | PASS |
| API-004 | auth: main GET /admin with expired session -> 401, no change | PASS |
| API-005 | auth: main GET /admin with malformed cookie value -> 401, no change | PASS |
| API-006 | auth: main PATCH /tournament with no cookie -> 401, no change | PASS |
| API-007 | auth: main PATCH /tournament with forged signature -> 401, no change | PASS |
| API-008 | auth: main PATCH /tournament with signed with another secret -> 401, no change | PASS |
| API-009 | auth: main PATCH /tournament with expired session -> 401, no change | PASS |
| API-010 | auth: main PATCH /tournament with malformed cookie value -> 401, no change | PASS |
| API-011 | auth: main POST /tournaments with no cookie -> 401, no change | PASS |
| API-012 | auth: main POST /tournaments with forged signature -> 401, no change | PASS |
| API-013 | auth: main POST /tournaments with signed with another secret -> 401, no change | PASS |
| API-014 | auth: main POST /tournaments with expired session -> 401, no change | PASS |
| API-015 | auth: main POST /tournaments with malformed cookie value -> 401, no change | PASS |
| API-016 | auth: main GET /tournaments with no cookie -> 401, no change | PASS |
| API-017 | auth: main GET /tournaments with forged signature -> 401, no change | PASS |
| API-018 | auth: main GET /tournaments with signed with another secret -> 401, no change | PASS |
| API-019 | auth: main GET /tournaments with expired session -> 401, no change | PASS |
| API-020 | auth: main GET /tournaments with malformed cookie value -> 401, no change | PASS |
| API-021 | auth: main PUT /players with no cookie -> 401, no change | PASS |
| API-022 | auth: main PUT /players with forged signature -> 401, no change | PASS |
| API-023 | auth: main PUT /players with signed with another secret -> 401, no change | PASS |
| API-024 | auth: main PUT /players with expired session -> 401, no change | PASS |
| API-025 | auth: main PUT /players with malformed cookie value -> 401, no change | PASS |
| API-026 | auth: main POST /players/import with no cookie -> 401, no change | PASS |
| API-027 | auth: main POST /players/import with forged signature -> 401, no change | PASS |
| API-028 | auth: main POST /players/import with signed with another secret -> 401, no change | PASS |
| API-029 | auth: main POST /players/import with expired session -> 401, no change | PASS |
| API-030 | auth: main POST /players/import with malformed cookie value -> 401, no change | PASS |
| API-031 | auth: main POST /start with no cookie -> 401, no change | PASS |
| API-032 | auth: main POST /start with forged signature -> 401, no change | PASS |
| API-033 | auth: main POST /start with signed with another secret -> 401, no change | PASS |
| API-034 | auth: main POST /start with expired session -> 401, no change | PASS |
| API-035 | auth: main POST /start with malformed cookie value -> 401, no change | PASS |
| API-036 | auth: main POST /draw with no cookie -> 401, no change | PASS |
| API-037 | auth: main POST /draw with forged signature -> 401, no change | PASS |
| API-038 | auth: main POST /draw with signed with another secret -> 401, no change | PASS |
| API-039 | auth: main POST /draw with expired session -> 401, no change | PASS |
| API-040 | auth: main POST /draw with malformed cookie value -> 401, no change | PASS |
| API-041 | auth: main POST /undo with no cookie -> 401, no change | PASS |
| API-042 | auth: main POST /undo with forged signature -> 401, no change | PASS |
| API-043 | auth: main POST /undo with signed with another secret -> 401, no change | PASS |
| API-044 | auth: main POST /undo with expired session -> 401, no change | PASS |
| API-045 | auth: main POST /undo with malformed cookie value -> 401, no change | PASS |
| API-046 | auth: main POST /finalize with no cookie -> 401, no change | PASS |
| API-047 | auth: main POST /finalize with forged signature -> 401, no change | PASS |
| API-048 | auth: main POST /finalize with signed with another secret -> 401, no change | PASS |
| API-049 | auth: main POST /finalize with expired session -> 401, no change | PASS |
| API-050 | auth: main POST /finalize with malformed cookie value -> 401, no change | PASS |
| API-051 | auth: main GET /export.xlsx with no cookie -> 401, no change | PASS |
| API-052 | auth: main GET /export.xlsx with forged signature -> 401, no change | PASS |
| API-053 | auth: main GET /export.xlsx with signed with another secret -> 401, no change | PASS |
| API-054 | auth: main GET /export.xlsx with expired session -> 401, no change | PASS |
| API-055 | auth: main GET /export.xlsx with malformed cookie value -> 401, no change | PASS |
| API-056 | auth: kids GET /admin with no cookie -> 401, no change | PASS |
| API-057 | auth: kids GET /admin with forged signature -> 401, no change | PASS |
| API-058 | auth: kids GET /admin with signed with another secret -> 401, no change | PASS |
| API-059 | auth: kids GET /admin with expired session -> 401, no change | PASS |
| API-060 | auth: kids GET /admin with malformed cookie value -> 401, no change | PASS |
| API-061 | auth: kids PATCH /tournament with no cookie -> 401, no change | PASS |
| API-062 | auth: kids PATCH /tournament with forged signature -> 401, no change | PASS |
| API-063 | auth: kids PATCH /tournament with signed with another secret -> 401, no change | PASS |
| API-064 | auth: kids PATCH /tournament with expired session -> 401, no change | PASS |
| API-065 | auth: kids PATCH /tournament with malformed cookie value -> 401, no change | PASS |
| API-066 | auth: kids POST /tournaments with no cookie -> 401, no change | PASS |
| API-067 | auth: kids POST /tournaments with forged signature -> 401, no change | PASS |
| API-068 | auth: kids POST /tournaments with signed with another secret -> 401, no change | PASS |
| API-069 | auth: kids POST /tournaments with expired session -> 401, no change | PASS |
| API-070 | auth: kids POST /tournaments with malformed cookie value -> 401, no change | PASS |
| API-071 | auth: kids GET /tournaments with no cookie -> 401, no change | PASS |
| API-072 | auth: kids GET /tournaments with forged signature -> 401, no change | PASS |
| API-073 | auth: kids GET /tournaments with signed with another secret -> 401, no change | PASS |
| API-074 | auth: kids GET /tournaments with expired session -> 401, no change | PASS |
| API-075 | auth: kids GET /tournaments with malformed cookie value -> 401, no change | PASS |
| API-076 | auth: kids PUT /players with no cookie -> 401, no change | PASS |
| API-077 | auth: kids PUT /players with forged signature -> 401, no change | PASS |
| API-078 | auth: kids PUT /players with signed with another secret -> 401, no change | PASS |
| API-079 | auth: kids PUT /players with expired session -> 401, no change | PASS |
| API-080 | auth: kids PUT /players with malformed cookie value -> 401, no change | PASS |
| API-081 | auth: kids POST /players/import with no cookie -> 401, no change | PASS |
| API-082 | auth: kids POST /players/import with forged signature -> 401, no change | PASS |
| API-083 | auth: kids POST /players/import with signed with another secret -> 401, no change | PASS |
| API-084 | auth: kids POST /players/import with expired session -> 401, no change | PASS |
| API-085 | auth: kids POST /players/import with malformed cookie value -> 401, no change | PASS |
| API-086 | auth: kids POST /start with no cookie -> 401, no change | PASS |
| API-087 | auth: kids POST /start with forged signature -> 401, no change | PASS |
| API-088 | auth: kids POST /start with signed with another secret -> 401, no change | PASS |
| API-089 | auth: kids POST /start with expired session -> 401, no change | PASS |
| API-090 | auth: kids POST /start with malformed cookie value -> 401, no change | PASS |
| API-091 | auth: kids POST /draw with no cookie -> 401, no change | PASS |
| API-092 | auth: kids POST /draw with forged signature -> 401, no change | PASS |
| API-093 | auth: kids POST /draw with signed with another secret -> 401, no change | PASS |
| API-094 | auth: kids POST /draw with expired session -> 401, no change | PASS |
| API-095 | auth: kids POST /draw with malformed cookie value -> 401, no change | PASS |
| API-096 | auth: kids POST /undo with no cookie -> 401, no change | PASS |
| API-097 | auth: kids POST /undo with forged signature -> 401, no change | PASS |
| API-098 | auth: kids POST /undo with signed with another secret -> 401, no change | PASS |
| API-099 | auth: kids POST /undo with expired session -> 401, no change | PASS |
| API-100 | auth: kids POST /undo with malformed cookie value -> 401, no change | PASS |
| API-101 | auth: kids POST /finalize with no cookie -> 401, no change | PASS |
| API-102 | auth: kids POST /finalize with forged signature -> 401, no change | PASS |
| API-103 | auth: kids POST /finalize with signed with another secret -> 401, no change | PASS |
| API-104 | auth: kids POST /finalize with expired session -> 401, no change | PASS |
| API-105 | auth: kids POST /finalize with malformed cookie value -> 401, no change | PASS |
| API-106 | auth: kids GET /export.xlsx with no cookie -> 401, no change | PASS |
| API-107 | auth: kids GET /export.xlsx with forged signature -> 401, no change | PASS |
| API-108 | auth: kids GET /export.xlsx with signed with another secret -> 401, no change | PASS |
| API-109 | auth: kids GET /export.xlsx with expired session -> 401, no change | PASS |
| API-110 | auth: kids GET /export.xlsx with malformed cookie value -> 401, no change | PASS |
| API-111 | auth: main GET /admin with a valid session -> 200 | PASS |
| API-112 | auth: main GET /tournaments with a valid session -> 200 | PASS |
| API-113 | auth: main GET /export.xlsx with a valid session -> 200 | PASS |
| API-114 | auth: kids GET /admin with a valid session -> 200 | PASS |
| API-115 | auth: kids GET /tournaments with a valid session -> 200 | PASS |
| API-116 | auth: kids GET /export.xlsx with a valid session -> 200 | PASS |
| API-117 | method: main DELETE /state -> 404 JSON, no change | PASS |
| API-118 | method: main POST /state -> 404 JSON, no change | PASS |
| API-119 | method: main PUT /leaderboard -> 404 JSON, no change | PASS |
| API-120 | method: main GET /guess -> 404 JSON, no change | PASS |
| API-121 | method: main GET /draw -> 404 JSON, no change | PASS |
| API-122 | method: main GET /undo -> 404 JSON, no change | PASS |
| API-123 | method: main GET /finalize -> 404 JSON, no change | PASS |
| API-124 | method: main GET /start -> 404 JSON, no change | PASS |
| API-125 | method: main DELETE /players -> 404 JSON, no change | PASS |
| API-126 | method: main POST /admin -> 404 JSON, no change | PASS |
| API-127 | method: main DELETE /tournament -> 404 JSON, no change | PASS |
| API-128 | method: main PUT /draw -> 404 JSON, no change | PASS |
| API-129 | method: kids DELETE /state -> 404 JSON, no change | PASS |
| API-130 | method: kids POST /state -> 404 JSON, no change | PASS |
| API-131 | method: kids PUT /leaderboard -> 404 JSON, no change | PASS |
| API-132 | method: kids GET /guess -> 404 JSON, no change | PASS |
| API-133 | method: kids GET /draw -> 404 JSON, no change | PASS |
| API-134 | method: kids GET /undo -> 404 JSON, no change | PASS |
| API-135 | method: kids GET /finalize -> 404 JSON, no change | PASS |
| API-136 | method: kids GET /start -> 404 JSON, no change | PASS |
| API-137 | method: kids DELETE /players -> 404 JSON, no change | PASS |
| API-138 | method: kids POST /admin -> 404 JSON, no change | PASS |
| API-139 | method: kids DELETE /tournament -> 404 JSON, no change | PASS |
| API-140 | method: kids PUT /draw -> 404 JSON, no change | PASS |
| API-141 | unknown: GET /nope (logged in) -> 404 | PASS |
| API-142 | unknown: GET /nope (anonymous) -> 404 | PASS |
| API-143 | unknown: GET /admin/x (logged in) -> 404 | PASS |
| API-144 | unknown: GET /admin/x (anonymous) -> 404 | PASS |
| API-145 | unknown: GET /kids/kids/state (logged in) -> 404 | PASS |
| API-146 | unknown: GET /kids/kids/state (anonymous) -> 404 | PASS |
| API-147 | unknown: GET /state/extra (logged in) -> 404 | PASS |
| API-148 | unknown: GET /state/extra (anonymous) -> 404 | PASS |
| API-149 | unknown: GET /export.csv (logged in) -> 404 | PASS |
| API-150 | unknown: GET /export.csv (anonymous) -> 404 | PASS |
| API-151 | unknown: GET /auth/admin (logged in) -> 404 | PASS |
| API-152 | unknown: GET /auth/admin (anonymous) -> 404 | PASS |
| API-153 | unknown: GET /state.json (logged in) -> 404 | PASS |
| API-154 | unknown: GET /state.json (anonymous) -> 404 | PASS |
| API-155 | unknown: GET /kids/nope (logged in) -> 404 | PASS |
| API-156 | unknown: GET /kids/nope (anonymous) -> 404 | PASS |
| API-157 | malformed JSON: main PATCH /tournament -> 400, no change | PASS |
| API-158 | text/plain body: main PATCH /tournament -> treated as empty (4xx or no-op 200), no change | PASS |
| API-159 | malformed JSON: main POST /tournaments -> 400, no change | PASS |
| API-160 | text/plain body: main POST /tournaments -> treated as empty (4xx or no-op 200), no change | PASS |
| API-161 | malformed JSON: main PUT /players -> 400, no change | PASS |
| API-162 | text/plain body: main PUT /players -> treated as empty (4xx or no-op 200), no change | PASS |
| API-163 | malformed JSON: main POST /players/import -> 400, no change | PASS |
| API-164 | text/plain body: main POST /players/import -> treated as empty (4xx or no-op 200), no change | PASS |
| API-165 | malformed JSON: main POST /start -> 400, no change | PASS |
| API-166 | text/plain body: main POST /start -> treated as empty (4xx or no-op 200), no change | PASS |
| API-167 | malformed JSON: main POST /draw -> 400, no change | PASS |
| API-168 | text/plain body: main POST /draw -> treated as empty (4xx or no-op 200), no change | PASS |
| API-169 | malformed JSON: main POST /undo -> 400, no change | PASS |
| API-170 | text/plain body: main POST /undo -> treated as empty (4xx or no-op 200), no change | PASS |
| API-171 | malformed JSON: main POST /finalize -> 400, no change | PASS |
| API-172 | text/plain body: main POST /finalize -> treated as empty (4xx or no-op 200), no change | PASS |
| API-173 | malformed JSON: main POST /guess -> 400, no change | PASS |
| API-174 | text/plain body: main POST /guess -> treated as empty (4xx or no-op 200), no change | PASS |
| API-175 | malformed JSON: kids PATCH /tournament -> 400, no change | PASS |
| API-176 | text/plain body: kids PATCH /tournament -> treated as empty (4xx or no-op 200), no change | PASS |
| API-177 | malformed JSON: kids POST /tournaments -> 400, no change | PASS |
| API-178 | text/plain body: kids POST /tournaments -> treated as empty (4xx or no-op 200), no change | PASS |
| API-179 | malformed JSON: kids PUT /players -> 400, no change | PASS |
| API-180 | text/plain body: kids PUT /players -> treated as empty (4xx or no-op 200), no change | PASS |
| API-181 | malformed JSON: kids POST /players/import -> 400, no change | PASS |
| API-182 | text/plain body: kids POST /players/import -> treated as empty (4xx or no-op 200), no change | PASS |
| API-183 | malformed JSON: kids POST /start -> 400, no change | PASS |
| API-184 | text/plain body: kids POST /start -> treated as empty (4xx or no-op 200), no change | PASS |
| API-185 | malformed JSON: kids POST /draw -> 400, no change | PASS |
| API-186 | text/plain body: kids POST /draw -> treated as empty (4xx or no-op 200), no change | PASS |
| API-187 | malformed JSON: kids POST /undo -> 400, no change | PASS |
| API-188 | text/plain body: kids POST /undo -> treated as empty (4xx or no-op 200), no change | PASS |
| API-189 | malformed JSON: kids POST /finalize -> 400, no change | PASS |
| API-190 | text/plain body: kids POST /finalize -> treated as empty (4xx or no-op 200), no change | PASS |
| API-191 | malformed JSON: kids POST /guess -> 400, no change | PASS |
| API-192 | text/plain body: kids POST /guess -> treated as empty (4xx or no-op 200), no change | PASS |
| API-193 | oversized body (> 6 MB) -> 413 | PASS |
| API-194 | body that is a JSON array -> 400 from players | PASS |
| API-195 | setup: fresh DRAFT tournaments for validation | PASS |
| API-196 | settings: main name empty -> 400 | PASS |
| API-197 | settings: main name spaces only -> 400 | PASS |
| API-198 | settings: main name 1 char -> 200 | PASS |
| API-199 | settings: main name 100 chars -> 200 | PASS |
| API-200 | settings: main name 101 chars -> 400 | PASS |
| API-201 | settings: main name number -> 200 | PASS |
| API-202 | settings: main name null -> 400 | PASS |
| API-203 | settings: main spinMs -1 -> 400 | PASS |
| API-204 | settings: main spinMs 0 -> 200 | PASS |
| API-205 | settings: main spinMs 30000 -> 200 | PASS |
| API-206 | settings: main spinMs 30001 -> 400 | PASS |
| API-207 | settings: main spinMs 1.5 -> 400 | PASS |
| API-208 | settings: main spinMs "5000" -> 400 | PASS |
| API-209 | settings: main spinMs null -> 400 | PASS |
| API-210 | settings: main predictions false -> 200 | PASS |
| API-211 | settings: main predictions true -> 200 | PASS |
| API-212 | settings: main predictions "yes" -> 400 | PASS |
| API-213 | settings: main predictions 1 -> 400 | PASS |
| API-214 | settings: main unknown field ignored -> 200 | PASS |
| API-215 | settings: main status cannot be set -> 200 | PASS |
| API-216 | settings: kids name empty -> 400 | PASS |
| API-217 | settings: kids name spaces only -> 400 | PASS |
| API-218 | settings: kids name 1 char -> 200 | PASS |
| API-219 | settings: kids name 100 chars -> 200 | PASS |
| API-220 | settings: kids name 101 chars -> 400 | PASS |
| API-221 | settings: kids name number -> 200 | PASS |
| API-222 | settings: kids name null -> 400 | PASS |
| API-223 | settings: kids spinMs -1 -> 400 | PASS |
| API-224 | settings: kids spinMs 0 -> 200 | PASS |
| API-225 | settings: kids spinMs 30000 -> 200 | PASS |
| API-226 | settings: kids spinMs 30001 -> 400 | PASS |
| API-227 | settings: kids spinMs 1.5 -> 400 | PASS |
| API-228 | settings: kids spinMs "5000" -> 400 | PASS |
| API-229 | settings: kids spinMs null -> 400 | PASS |
| API-230 | settings: kids predictions false -> 200 | PASS |
| API-231 | settings: kids predictions true -> 200 | PASS |
| API-232 | settings: kids predictions "yes" -> 400 | PASS |
| API-233 | settings: kids predictions 1 -> 400 | PASS |
| API-234 | settings: kids unknown field ignored -> 200 | PASS |
| API-235 | settings: kids status cannot be set -> 200 | PASS |
| API-236 | categories (main): empty list -> 400 | PASS |
| API-237 | categories (main): not an array -> 400 | PASS |
| API-238 | categories (main): duplicate -> 400 | PASS |
| API-239 | categories (main): unknown key -> 400 | PASS |
| API-240 | categories (main): kids key in main -> 400 | PASS |
| API-241 | categories (main): lowercase key -> 400 | PASS |
| API-242 | categories (main): single A -> 200 | PASS |
| API-243 | categories (main): all five -> 200 | PASS |
| API-244 | categories (main): D first -> 200 | PASS |
| API-245 | categories (main): default order -> 200 | PASS |
| API-246 | categories (kids): valid-looking -> 409 fixed format | PASS |
| API-247 | categories (kids): reordered -> 409 fixed format | PASS |
| API-248 | categories (kids): main keys -> 409 fixed format | PASS |
| API-249 | players (main DRAFT): lists missing -> 400 | PASS |
| API-250 | players (main DRAFT): lists null -> 400 | PASS |
| API-251 | players (main DRAFT): lists array -> 400 | PASS |
| API-252 | players (main DRAFT): unknown category -> 400 | PASS |
| API-253 | players (main DRAFT): kids list in main -> 400 | PASS |
| API-254 | players (main DRAFT): list not an array -> 400 | PASS |
| API-255 | players (main DRAFT): 201 names -> 400 | PASS |
| API-256 | players (main DRAFT): 200 names ok -> 200 | PASS |
| API-257 | players (main DRAFT): name 61 chars -> 400 | PASS |
| API-258 | players (main DRAFT): name 60 chars -> 200 | PASS |
| API-259 | players (main DRAFT): duplicate in list -> 400 | PASS |
| API-260 | players (main DRAFT): duplicate case-insensitive -> 400 | PASS |
| API-261 | players (main DRAFT): duplicate whitespace -> 400 | PASS |
| API-262 | players (main DRAFT): duplicate via zero-width space -> 400 | PASS |
| API-263 | players (main DRAFT): duplicate via decomposed accent -> 400 | PASS |
| API-264 | players (main DRAFT): duplicate across lists -> 400 | PASS |
| API-265 | players (main DRAFT): blank names dropped -> 200 | PASS |
| API-266 | players (main DRAFT): numbers become strings -> 200 | PASS |
| API-267 | players (main DRAFT): empty list allowed while DRAFT -> 200 | PASS |
| API-268 | players (main DRAFT): 28 names -> 200 | PASS |
| API-269 | players: a rejected save leaves the previous list intact | PASS |
| API-270 | players (kids DRAFT): main list in kids -> 400 | PASS |
| API-271 | players (kids DRAFT): round key instead of list -> 400 | PASS |
| API-272 | players (kids DRAFT): icon 4 -> 200 | PASS |
| API-273 | players (kids DRAFT): boy 4 -> 200 | PASS |
| API-274 | players (kids DRAFT): girls 8 -> 200 | PASS |
| API-275 | players (kids DRAFT): girl duplicates a boy -> 400 | PASS |
| API-276 | start: main refuses with 27 players in the first category | PASS |
| API-277 | start: main refuses with 29 players | PASS |
| API-278 | start: kids refuses with 3 icon boys | PASS |
| API-279 | start: main: first list has 28 -> 200 then a second start -> 409 | PASS |
| API-280 | start: kids: icon list has 4 -> 200 then a second start -> 409 | PASS |
| API-281 | draw fuzz (main): no body -> 409/400, nothing drawn | PASS |
| API-282 | draw fuzz (main): empty object -> 409/400, nothing drawn | PASS |
| API-283 | draw fuzz (main): category null -> 409/400, nothing drawn | PASS |
| API-284 | draw fuzz (main): category number -> 409/400, nothing drawn | PASS |
| API-285 | draw fuzz (main): category object -> 409/400, nothing drawn | PASS |
| API-286 | draw fuzz (main): category array -> 409/400, nothing drawn | PASS |
| API-287 | draw fuzz (main): category wrong case -> 409/400, nothing drawn | PASS |
| API-288 | draw fuzz (main): team string -> 409/400, nothing drawn | PASS |
| API-289 | draw fuzz (main): team 0 -> 409/400, nothing drawn | PASS |
| API-290 | draw fuzz (main): team -1 -> 409/400, nothing drawn | PASS |
| API-291 | draw fuzz (main): team 2 (stale/ahead) -> 409/400, nothing drawn | PASS |
| API-292 | draw fuzz (main): team 29 -> 409/400, nothing drawn | PASS |
| API-293 | draw fuzz (main): team float -> 409/400, nothing drawn | PASS |
| API-294 | draw fuzz (main): team null -> 409/400, nothing drawn | PASS |
| API-295 | draw fuzz (main): next round category -> 409/400, nothing drawn | PASS |
| API-296 | draw fuzz (main): kids category in main -> 409/400, nothing drawn | PASS |
| API-297 | draw fuzz (kids): main category -> 409, nothing drawn | PASS |
| API-298 | draw fuzz (kids): boy before icon -> 409, nothing drawn | PASS |
| API-299 | draw fuzz (kids): team 5 -> 409, nothing drawn | PASS |
| API-300 | draw fuzz (kids): team string -> 409, nothing drawn | PASS |
| API-301 | undo fuzz (main): no actionId with nothing drawn -> 409 | PASS |
| API-302 | undo fuzz (main): wrong actionId with nothing drawn -> 409 | PASS |
| API-303 | undo fuzz (main): actionId number with nothing drawn -> 409 | PASS |
| API-304 | undo fuzz (main): actionId object with nothing drawn -> 409 | PASS |
| API-305 | finalize fuzz (main): no category -> 409 | PASS |
| API-306 | finalize fuzz (main): wrong category -> 409 | PASS |
| API-307 | finalize fuzz (main): current but incomplete -> 409 | PASS |
| API-308 | undo fuzz (kids): no actionId with nothing drawn -> 409 | PASS |
| API-309 | undo fuzz (kids): wrong actionId with nothing drawn -> 409 | PASS |
| API-310 | undo fuzz (kids): actionId number with nothing drawn -> 409 | PASS |
| API-311 | undo fuzz (kids): actionId object with nothing drawn -> 409 | PASS |
| API-312 | finalize fuzz (kids): no category -> 409 | PASS |
| API-313 | finalize fuzz (kids): wrong category -> 409 | PASS |
| API-314 | finalize fuzz (kids): current but incomplete -> 409 | PASS |
| API-315 | shape: main public state has the documented fields | PASS |
| API-316 | shape: main admin state has lists/pools/available/editable/history | PASS |
| API-317 | shape: main public state never contains salts or player ids | PASS |
| API-318 | shape: main leaderboard without voter | PASS |
| API-319 | leaderboard (main): odd voter "" -> 200, me null | PASS |
| API-320 | leaderboard (main): odd voter "x" -> 200, me null | PASS |
| API-321 | leaderboard (main): odd voter "aaaaaaaaaaaaaaaaaaa -> 200, me null | PASS |
| API-322 | leaderboard (main): odd voter "<script>" -> 200, me null | PASS |
| API-323 | leaderboard (main): odd voter "%00" -> 200, me null | PASS |
| API-324 | shape: kids public state has the documented fields | PASS |
| API-325 | shape: kids admin state has lists/pools/available/editable/history | PASS |
| API-326 | shape: kids public state never contains salts or player ids | PASS |
| API-327 | shape: kids leaderboard without voter | PASS |
| API-328 | leaderboard (kids): odd voter "" -> 200, me null | PASS |
| API-329 | leaderboard (kids): odd voter "x" -> 200, me null | PASS |
| API-330 | leaderboard (kids): odd voter "aaaaaaaaaaaaaaaaaaa -> 200, me null | PASS |
| API-331 | leaderboard (kids): odd voter "<script>" -> 200, me null | PASS |
| API-332 | leaderboard (kids): odd voter "%00" -> 200, me null | PASS |
| API-333 | health: 200 with db up | PASS |
| API-334 | health: also reachable at /api/kids/health? -> 404 (not a kids route) | PASS |
| API-335 | login: password undefined -> 401 | PASS |
| API-336 | login: password null -> 401 | PASS |
| API-337 | login: password 1 -> 401 | PASS |
| API-338 | login: password true -> 401 | PASS |
| API-339 | login: password {} -> 401 | PASS |
| API-340 | login: password [] -> 401 | PASS |
| API-341 | login: password "" -> 401 | PASS |
| API-342 | login: password " qa-password" -> 401 | PASS |
| API-343 | login: password "QA-PASSWORD" -> 401 | PASS |
| API-344 | login: password "qa-password " -> 401 | PASS |
| API-345 | auth/me: anonymous -> admin false; logged in -> true | PASS |
| API-346 | errors: 4xx responses are JSON { error } without stack traces | PASS |

## Database integrity & recovery

| ID | Scenario (precondition / action → expected) | Status |
|---|---|---|
| DB-001 | index: players unique (tournamentId, nameKey) | PASS |
| DB-002 | index: drawevents unique (tournamentId, sequence) | PASS |
| DB-003 | index: drawevents unique team-per-round for live (non-voided) picks | PASS |
| DB-004 | index: drawevents unique player for live (non-voided) picks | PASS |
| DB-005 | index: guesses unique (tournament, round, team, voter) | PASS |
| DB-006 | setup: a raw tournament and two players | PASS |
| DB-007 | constraint: same player name twice in a tournament rejected by the database | PASS |
| DB-008 | constraint: same name allowed in a different tournament | PASS |
| DB-009 | constraint: first pick inserts | PASS |
| DB-010 | constraint: second live pick for the same team+round rejected | PASS |
| DB-011 | constraint: same player picked twice (live) rejected | PASS |
| DB-012 | constraint: duplicate sequence rejected | PASS |
| DB-013 | constraint: after voiding, the same team can be drawn again (undo semantics) | PASS |
| DB-014 | constraint: voided rows are kept for the audit trail | PASS |
| DB-015 | schema: tournament without name -> rejected | PASS |
| DB-016 | schema: tournament bad status -> rejected | PASS |
| DB-017 | schema: tournament bad event -> rejected | PASS |
| DB-018 | schema: tournament unknown category -> rejected | PASS |
| DB-019 | schema: tournament spinMs > 30000 -> rejected | PASS |
| DB-020 | schema: tournament name > 100 -> rejected | PASS |
| DB-021 | schema: player bad list -> rejected | PASS |
| DB-022 | schema: player missing name -> rejected | PASS |
| DB-023 | schema: draw event missing revealAt -> rejected | PASS |
| DB-024 | schema: draw event bad category -> rejected | PASS |
| DB-025 | schema: guess missing voter -> rejected | PASS |
| DB-026 | defaults: new tournament = main event, DRAFT, 28 teams, A/Women/B/C, 6 s, predictions on | PASS |
| DB-027 | legacy: a tournament document WITHOUT an event field is treated as the main event | PASS |
| DB-028 | legacy: the kids event never picks up a main/legacy tournament | PASS |
| DB-029 | restart: committed picks survive a server restart (main) | PASS |
| DB-030 | restart: a spin in progress is revealed after restart (main) | PASS |
| DB-031 | restart: kids spin in progress is revealed after restart, only to kids screens | PASS |
| DB-032 | restart: undo history survives restart | PASS |
| DB-033 | restart: login session cookie stays valid across restart (stateless HMAC) | PASS |
| DB-034 | restart: 3 restarts in a row keep the state identical | PASS |
| DB-035 | outage: health reports 503 while MongoDB is disconnected, 200 after reconnect | PASS |
| DB-036 | outage: a draw attempted during the outage fails cleanly and leaves no partial pick | PASS |
| DB-037 | outage: after reconnect the draw continues normally | PASS |
| DB-038 | export: Excel matches the saved state exactly (teams + history) | PASS |
| DB-039 | export: before any draw, Excel still generates with empty teams | PASS |
| DB-040 | export: archived tournament of the OTHER event -> 404 | PASS |
| DB-041 | export: tournament id "nope" -> 404 | PASS |
| DB-042 | export: tournament id "000000000000000000000000" -> 404 | PASS |
| DB-043 | export: tournament id "{}" -> 404 | PASS |
| DB-044 | export: tournament id "%00" -> 404 | PASS |
| DB-045 | archive: tournaments list is per event, newest first, active flagged | PASS |

## Draw engine

| ID | Scenario (precondition / action → expected) | Status |
|---|---|---|
| DRAW-001 | main: fresh tournament is LIVE on A with 28 teams and nothing assigned | PASS |
| DRAW-002 | main A: finalize before the shuffle -> 409 | PASS |
| DRAW-003 | main A: one shuffle fills all 28 teams with the 28 A players | PASS |
| DRAW-004 | main A: a second shuffle is refused (teams full) | PASS |
| DRAW-005 | main A: A list locked once shuffled | PASS |
| DRAW-006 | main A: finalize -> Women becomes active | PASS |
| DRAW-007 | main A: finalizing A again -> 409 | PASS |
| DRAW-008 | main WOMEN: before pick 1, a request for team 2 (ahead) is refused | PASS |
| DRAW-009 | main WOMEN: before pick 1, finalize is refused (incomplete) | PASS |
| DRAW-010 | main WOMEN: pick 1 goes to Team 1, invariants hold | PASS |
| DRAW-011 | main WOMEN: undo pick 1 reopens Team 1 and returns the player | PASS |
| DRAW-012 | main WOMEN: undone pick is in history as voided; re-draw Team 1 | PASS |
| DRAW-013 | main WOMEN: before pick 2, a request for team 3 (ahead) is refused | PASS |
| DRAW-014 | main WOMEN: before pick 2, a stale request for team 1 is refused | PASS |
| DRAW-015 | main WOMEN: before pick 2, finalize is refused (incomplete) | PASS |
| DRAW-016 | main WOMEN: pick 2 goes to Team 2, invariants hold | PASS |
| DRAW-017 | main WOMEN: pick 3 goes to Team 3, invariants hold | PASS |
| DRAW-018 | main WOMEN: pick 4 goes to Team 4, invariants hold | PASS |
| DRAW-019 | main WOMEN: pick 5 goes to Team 5, invariants hold | PASS |
| DRAW-020 | main WOMEN: pick 6 goes to Team 6, invariants hold | PASS |
| DRAW-021 | main WOMEN: pick 7 goes to Team 7, invariants hold | PASS |
| DRAW-022 | main WOMEN: pick 8 goes to Team 8, invariants hold | PASS |
| DRAW-023 | main WOMEN: pick 9 goes to Team 9, invariants hold | PASS |
| DRAW-024 | main WOMEN: pick 10 goes to Team 10, invariants hold | PASS |
| DRAW-025 | main WOMEN: pick 11 goes to Team 11, invariants hold | PASS |
| DRAW-026 | main WOMEN: pick 12 goes to Team 12, invariants hold | PASS |
| DRAW-027 | main WOMEN: pick 13 goes to Team 13, invariants hold | PASS |
| DRAW-028 | main WOMEN: before pick 14, a request for team 15 (ahead) is refused | PASS |
| DRAW-029 | main WOMEN: before pick 14, a stale request for team 13 is refused | PASS |
| DRAW-030 | main WOMEN: before pick 14, finalize is refused (incomplete) | PASS |
| DRAW-031 | main WOMEN: pick 14 goes to Team 14, invariants hold | PASS |
| DRAW-032 | main WOMEN: undo pick 14 reopens Team 14 and returns the player | PASS |
| DRAW-033 | main WOMEN: undone pick is in history as voided; re-draw Team 14 | PASS |
| DRAW-034 | main WOMEN: pick 15 goes to Team 15, invariants hold | PASS |
| DRAW-035 | main WOMEN: pick 16 goes to Team 16, invariants hold | PASS |
| DRAW-036 | main WOMEN: pick 17 goes to Team 17, invariants hold | PASS |
| DRAW-037 | main WOMEN: pick 18 goes to Team 18, invariants hold | PASS |
| DRAW-038 | main WOMEN: pick 19 goes to Team 19, invariants hold | PASS |
| DRAW-039 | main WOMEN: pick 20 goes to Team 20, invariants hold | PASS |
| DRAW-040 | main WOMEN: pick 21 goes to Team 21, invariants hold | PASS |
| DRAW-041 | main WOMEN: pick 22 goes to Team 22, invariants hold | PASS |
| DRAW-042 | main WOMEN: pick 23 goes to Team 23, invariants hold | PASS |
| DRAW-043 | main WOMEN: pick 24 goes to Team 24, invariants hold | PASS |
| DRAW-044 | main WOMEN: pick 25 goes to Team 25, invariants hold | PASS |
| DRAW-045 | main WOMEN: pick 26 goes to Team 26, invariants hold | PASS |
| DRAW-046 | main WOMEN: before pick 27, a request for team 28 (ahead) is refused | PASS |
| DRAW-047 | main WOMEN: before pick 27, a stale request for team 26 is refused | PASS |
| DRAW-048 | main WOMEN: before pick 27, finalize is refused (incomplete) | PASS |
| DRAW-049 | main WOMEN: pick 27 goes to Team 27, invariants hold | PASS |
| DRAW-050 | main WOMEN: before pick 28, a request for team 29 (ahead) is refused | PASS |
| DRAW-051 | main WOMEN: before pick 28, a stale request for team 27 is refused | PASS |
| DRAW-052 | main WOMEN: before pick 28, finalize is refused (incomplete) | PASS |
| DRAW-053 | main WOMEN: pick 28 goes to Team 28, invariants hold | PASS |
| DRAW-054 | main WOMEN: undo pick 28 reopens Team 28 and returns the player | PASS |
| DRAW-055 | main WOMEN: undone pick is in history as voided; re-draw Team 28 | PASS |
| DRAW-056 | main WOMEN: draw after Team 28 -> 409 | PASS |
| DRAW-057 | main WOMEN: finalize locks it | PASS |
| DRAW-058 | main WOMEN: undo cannot reach into the finalized round | PASS |
| DRAW-059 | main B: before pick 1, a request for team 2 (ahead) is refused | PASS |
| DRAW-060 | main B: before pick 1, finalize is refused (incomplete) | PASS |
| DRAW-061 | main B: pick 1 goes to Team 1, invariants hold | PASS |
| DRAW-062 | main B: undo pick 1 reopens Team 1 and returns the player | PASS |
| DRAW-063 | main B: undone pick is in history as voided; re-draw Team 1 | PASS |
| DRAW-064 | main B: before pick 2, a request for team 3 (ahead) is refused | PASS |
| DRAW-065 | main B: before pick 2, a stale request for team 1 is refused | PASS |
| DRAW-066 | main B: before pick 2, finalize is refused (incomplete) | PASS |
| DRAW-067 | main B: pick 2 goes to Team 2, invariants hold | PASS |
| DRAW-068 | main B: pick 3 goes to Team 3, invariants hold | PASS |
| DRAW-069 | main B: pick 4 goes to Team 4, invariants hold | PASS |
| DRAW-070 | main B: pick 5 goes to Team 5, invariants hold | PASS |
| DRAW-071 | main B: pick 6 goes to Team 6, invariants hold | PASS |
| DRAW-072 | main B: pick 7 goes to Team 7, invariants hold | PASS |
| DRAW-073 | main B: pick 8 goes to Team 8, invariants hold | PASS |
| DRAW-074 | main B: pick 9 goes to Team 9, invariants hold | PASS |
| DRAW-075 | main B: pick 10 goes to Team 10, invariants hold | PASS |
| DRAW-076 | main B: pick 11 goes to Team 11, invariants hold | PASS |
| DRAW-077 | main B: pick 12 goes to Team 12, invariants hold | PASS |
| DRAW-078 | main B: pick 13 goes to Team 13, invariants hold | PASS |
| DRAW-079 | main B: before pick 14, a request for team 15 (ahead) is refused | PASS |
| DRAW-080 | main B: before pick 14, a stale request for team 13 is refused | PASS |
| DRAW-081 | main B: before pick 14, finalize is refused (incomplete) | PASS |
| DRAW-082 | main B: pick 14 goes to Team 14, invariants hold | PASS |
| DRAW-083 | main B: undo pick 14 reopens Team 14 and returns the player | PASS |
| DRAW-084 | main B: undone pick is in history as voided; re-draw Team 14 | PASS |
| DRAW-085 | main B: pick 15 goes to Team 15, invariants hold | PASS |
| DRAW-086 | main B: pick 16 goes to Team 16, invariants hold | PASS |
| DRAW-087 | main B: pick 17 goes to Team 17, invariants hold | PASS |
| DRAW-088 | main B: pick 18 goes to Team 18, invariants hold | PASS |
| DRAW-089 | main B: pick 19 goes to Team 19, invariants hold | PASS |
| DRAW-090 | main B: pick 20 goes to Team 20, invariants hold | PASS |
| DRAW-091 | main B: pick 21 goes to Team 21, invariants hold | PASS |
| DRAW-092 | main B: pick 22 goes to Team 22, invariants hold | PASS |
| DRAW-093 | main B: pick 23 goes to Team 23, invariants hold | PASS |
| DRAW-094 | main B: pick 24 goes to Team 24, invariants hold | PASS |
| DRAW-095 | main B: pick 25 goes to Team 25, invariants hold | PASS |
| DRAW-096 | main B: pick 26 goes to Team 26, invariants hold | PASS |
| DRAW-097 | main B: before pick 27, a request for team 28 (ahead) is refused | PASS |
| DRAW-098 | main B: before pick 27, a stale request for team 26 is refused | PASS |
| DRAW-099 | main B: before pick 27, finalize is refused (incomplete) | PASS |
| DRAW-100 | main B: pick 27 goes to Team 27, invariants hold | PASS |
| DRAW-101 | main B: before pick 28, a request for team 29 (ahead) is refused | PASS |
| DRAW-102 | main B: before pick 28, a stale request for team 27 is refused | PASS |
| DRAW-103 | main B: before pick 28, finalize is refused (incomplete) | PASS |
| DRAW-104 | main B: pick 28 goes to Team 28, invariants hold | PASS |
| DRAW-105 | main B: undo pick 28 reopens Team 28 and returns the player | PASS |
| DRAW-106 | main B: undone pick is in history as voided; re-draw Team 28 | PASS |
| DRAW-107 | main B: draw after Team 28 -> 409 | PASS |
| DRAW-108 | main B: finalize locks it | PASS |
| DRAW-109 | main B: undo cannot reach into the finalized round | PASS |
| DRAW-110 | main C: before pick 1, a request for team 2 (ahead) is refused | PASS |
| DRAW-111 | main C: before pick 1, finalize is refused (incomplete) | PASS |
| DRAW-112 | main C: pick 1 goes to Team 1, invariants hold | PASS |
| DRAW-113 | main C: undo pick 1 reopens Team 1 and returns the player | PASS |
| DRAW-114 | main C: undone pick is in history as voided; re-draw Team 1 | PASS |
| DRAW-115 | main C: before pick 2, a request for team 3 (ahead) is refused | PASS |
| DRAW-116 | main C: before pick 2, a stale request for team 1 is refused | PASS |
| DRAW-117 | main C: before pick 2, finalize is refused (incomplete) | PASS |
| DRAW-118 | main C: pick 2 goes to Team 2, invariants hold | PASS |
| DRAW-119 | main C: pick 3 goes to Team 3, invariants hold | PASS |
| DRAW-120 | main C: pick 4 goes to Team 4, invariants hold | PASS |
| DRAW-121 | main C: pick 5 goes to Team 5, invariants hold | PASS |
| DRAW-122 | main C: pick 6 goes to Team 6, invariants hold | PASS |
| DRAW-123 | main C: pick 7 goes to Team 7, invariants hold | PASS |
| DRAW-124 | main C: pick 8 goes to Team 8, invariants hold | PASS |
| DRAW-125 | main C: pick 9 goes to Team 9, invariants hold | PASS |
| DRAW-126 | main C: pick 10 goes to Team 10, invariants hold | PASS |
| DRAW-127 | main C: pick 11 goes to Team 11, invariants hold | PASS |
| DRAW-128 | main C: pick 12 goes to Team 12, invariants hold | PASS |
| DRAW-129 | main C: pick 13 goes to Team 13, invariants hold | PASS |
| DRAW-130 | main C: before pick 14, a request for team 15 (ahead) is refused | PASS |
| DRAW-131 | main C: before pick 14, a stale request for team 13 is refused | PASS |
| DRAW-132 | main C: before pick 14, finalize is refused (incomplete) | PASS |
| DRAW-133 | main C: pick 14 goes to Team 14, invariants hold | PASS |
| DRAW-134 | main C: undo pick 14 reopens Team 14 and returns the player | PASS |
| DRAW-135 | main C: undone pick is in history as voided; re-draw Team 14 | PASS |
| DRAW-136 | main C: pick 15 goes to Team 15, invariants hold | PASS |
| DRAW-137 | main C: pick 16 goes to Team 16, invariants hold | PASS |
| DRAW-138 | main C: pick 17 goes to Team 17, invariants hold | PASS |
| DRAW-139 | main C: pick 18 goes to Team 18, invariants hold | PASS |
| DRAW-140 | main C: pick 19 goes to Team 19, invariants hold | PASS |
| DRAW-141 | main C: pick 20 goes to Team 20, invariants hold | PASS |
| DRAW-142 | main C: pick 21 goes to Team 21, invariants hold | PASS |
| DRAW-143 | main C: pick 22 goes to Team 22, invariants hold | PASS |
| DRAW-144 | main C: pick 23 goes to Team 23, invariants hold | PASS |
| DRAW-145 | main C: pick 24 goes to Team 24, invariants hold | PASS |
| DRAW-146 | main C: pick 25 goes to Team 25, invariants hold | PASS |
| DRAW-147 | main C: pick 26 goes to Team 26, invariants hold | PASS |
| DRAW-148 | main C: before pick 27, a request for team 28 (ahead) is refused | PASS |
| DRAW-149 | main C: before pick 27, a stale request for team 26 is refused | PASS |
| DRAW-150 | main C: before pick 27, finalize is refused (incomplete) | PASS |
| DRAW-151 | main C: pick 27 goes to Team 27, invariants hold | PASS |
| DRAW-152 | main C: before pick 28, a request for team 29 (ahead) is refused | PASS |
| DRAW-153 | main C: before pick 28, a stale request for team 27 is refused | PASS |
| DRAW-154 | main C: before pick 28, finalize is refused (incomplete) | PASS |
| DRAW-155 | main C: pick 28 goes to Team 28, invariants hold | PASS |
| DRAW-156 | main C: undo pick 28 reopens Team 28 and returns the player | PASS |
| DRAW-157 | main C: undone pick is in history as voided; re-draw Team 28 | PASS |
| DRAW-158 | main C: draw after Team 28 -> 409 | PASS |
| DRAW-159 | main C: finalize locks it | PASS |
| DRAW-160 | main C: undo cannot reach into the finalized round | PASS |
| DRAW-161 | main D: before pick 1, a request for team 2 (ahead) is refused | PASS |
| DRAW-162 | main D: before pick 1, finalize is refused (incomplete) | PASS |
| DRAW-163 | main D: pick 1 goes to Team 1, invariants hold | PASS |
| DRAW-164 | main D: undo pick 1 reopens Team 1 and returns the player | PASS |
| DRAW-165 | main D: undone pick is in history as voided; re-draw Team 1 | PASS |
| DRAW-166 | main D: before pick 2, a request for team 3 (ahead) is refused | PASS |
| DRAW-167 | main D: before pick 2, a stale request for team 1 is refused | PASS |
| DRAW-168 | main D: before pick 2, finalize is refused (incomplete) | PASS |
| DRAW-169 | main D: pick 2 goes to Team 2, invariants hold | PASS |
| DRAW-170 | main D: pick 3 goes to Team 3, invariants hold | PASS |
| DRAW-171 | main D: pick 4 goes to Team 4, invariants hold | PASS |
| DRAW-172 | main D: pick 5 goes to Team 5, invariants hold | PASS |
| DRAW-173 | main D: pick 6 goes to Team 6, invariants hold | PASS |
| DRAW-174 | main D: pick 7 goes to Team 7, invariants hold | PASS |
| DRAW-175 | main D: pick 8 goes to Team 8, invariants hold | PASS |
| DRAW-176 | main D: pick 9 goes to Team 9, invariants hold | PASS |
| DRAW-177 | main D: pick 10 goes to Team 10, invariants hold | PASS |
| DRAW-178 | main D: pick 11 goes to Team 11, invariants hold | PASS |
| DRAW-179 | main D: pick 12 goes to Team 12, invariants hold | PASS |
| DRAW-180 | main D: pick 13 goes to Team 13, invariants hold | PASS |
| DRAW-181 | main D: before pick 14, a request for team 15 (ahead) is refused | PASS |
| DRAW-182 | main D: before pick 14, a stale request for team 13 is refused | PASS |
| DRAW-183 | main D: before pick 14, finalize is refused (incomplete) | PASS |
| DRAW-184 | main D: pick 14 goes to Team 14, invariants hold | PASS |
| DRAW-185 | main D: undo pick 14 reopens Team 14 and returns the player | PASS |
| DRAW-186 | main D: undone pick is in history as voided; re-draw Team 14 | PASS |
| DRAW-187 | main D: pick 15 goes to Team 15, invariants hold | PASS |
| DRAW-188 | main D: pick 16 goes to Team 16, invariants hold | PASS |
| DRAW-189 | main D: pick 17 goes to Team 17, invariants hold | PASS |
| DRAW-190 | main D: pick 18 goes to Team 18, invariants hold | PASS |
| DRAW-191 | main D: pick 19 goes to Team 19, invariants hold | PASS |
| DRAW-192 | main D: pick 20 goes to Team 20, invariants hold | PASS |
| DRAW-193 | main D: pick 21 goes to Team 21, invariants hold | PASS |
| DRAW-194 | main D: pick 22 goes to Team 22, invariants hold | PASS |
| DRAW-195 | main D: pick 23 goes to Team 23, invariants hold | PASS |
| DRAW-196 | main D: pick 24 goes to Team 24, invariants hold | PASS |
| DRAW-197 | main D: pick 25 goes to Team 25, invariants hold | PASS |
| DRAW-198 | main D: pick 26 goes to Team 26, invariants hold | PASS |
| DRAW-199 | main D: before pick 27, a request for team 28 (ahead) is refused | PASS |
| DRAW-200 | main D: before pick 27, a stale request for team 26 is refused | PASS |
| DRAW-201 | main D: before pick 27, finalize is refused (incomplete) | PASS |
| DRAW-202 | main D: pick 27 goes to Team 27, invariants hold | PASS |
| DRAW-203 | main D: before pick 28, a request for team 29 (ahead) is refused | PASS |
| DRAW-204 | main D: before pick 28, a stale request for team 27 is refused | PASS |
| DRAW-205 | main D: before pick 28, finalize is refused (incomplete) | PASS |
| DRAW-206 | main D: pick 28 goes to Team 28, invariants hold | PASS |
| DRAW-207 | main D: undo pick 28 reopens Team 28 and returns the player | PASS |
| DRAW-208 | main D: undone pick is in history as voided; re-draw Team 28 | PASS |
| DRAW-209 | main D: draw after Team 28 -> 409 | PASS |
| DRAW-210 | main D: finalize locks it | PASS |
| DRAW-211 | main D: undo cannot reach into the finalized round | PASS |
| DRAW-212 | main: tournament COMPLETED after D | PASS |
| DRAW-213 | main: every team has exactly one player per category, all unique | PASS |
| DRAW-214 | main: after completion every draw/undo/finalize is refused | PASS |
| DRAW-215 | main: completed lists cannot be edited | PASS |
| DRAW-216 | main: history has 140 final picks + 12 undone | PASS |
| DRAW-217 | order WOMEN→A: rounds run in this order, A always shuffles in one go | PASS |
| DRAW-218 | order B→A→C: rounds run in this order, A always shuffles in one go | PASS |
| DRAW-219 | order D: rounds run in this order, A always shuffles in one go | PASS |
| DRAW-220 | order C→B: rounds run in this order, A always shuffles in one go | PASS |
| DRAW-221 | order A: rounds run in this order, A always shuffles in one go | PASS |
| DRAW-222 | order WOMEN→B→A: rounds run in this order, A always shuffles in one go | PASS |
| DRAW-223 | order: a later list stays editable while an earlier round is drawing | PASS |
| DRAW-224 | order: next round refuses to start with a short list (27), fixable before its first draw | PASS |
| DRAW-225 | kids: fresh tournament has 4 teams, rounds ICON/BOY/GIRL1/GIRL2 | PASS |
| DRAW-226 | kids ICON: one shuffle places all 4 icon boys | PASS |
| DRAW-227 | kids BOY: pick 1 goes to Team 1 from the right list | PASS |
| DRAW-228 | kids BOY: stale request for team 1 after it was drawn -> 409 | PASS |
| DRAW-229 | kids BOY: pick 2 goes to Team 2 from the right list | PASS |
| DRAW-230 | kids BOY: stale request for team 2 after it was drawn -> 409 | PASS |
| DRAW-231 | kids BOY: pick 3 goes to Team 3 from the right list | PASS |
| DRAW-232 | kids BOY: stale request for team 3 after it was drawn -> 409 | PASS |
| DRAW-233 | kids BOY: pick 4 goes to Team 4 from the right list | PASS |
| DRAW-234 | kids BOY: stale request for team 4 after it was drawn -> 409 | PASS |
| DRAW-235 | kids BOY: finalize | PASS |
| DRAW-236 | kids GIRL1: pick 1 goes to Team 1 from the right list | PASS |
| DRAW-237 | kids GIRL1: stale request for team 1 after it was drawn -> 409 | PASS |
| DRAW-238 | kids GIRL1: pick 2 goes to Team 2 from the right list | PASS |
| DRAW-239 | kids GIRL1: stale request for team 2 after it was drawn -> 409 | PASS |
| DRAW-240 | kids GIRL1: pick 3 goes to Team 3 from the right list | PASS |
| DRAW-241 | kids GIRL1: stale request for team 3 after it was drawn -> 409 | PASS |
| DRAW-242 | kids GIRL1: pick 4 goes to Team 4 from the right list | PASS |
| DRAW-243 | kids GIRL1: stale request for team 4 after it was drawn -> 409 | PASS |
| DRAW-244 | kids GIRL1: finalize | PASS |
| DRAW-245 | kids GIRL2: pick 1 goes to Team 1 from the right list | PASS |
| DRAW-246 | kids GIRL2: stale request for team 1 after it was drawn -> 409 | PASS |
| DRAW-247 | kids GIRL2: pick 2 goes to Team 2 from the right list | PASS |
| DRAW-248 | kids GIRL2: stale request for team 2 after it was drawn -> 409 | PASS |
| DRAW-249 | kids GIRL2: pick 3 goes to Team 3 from the right list | PASS |
| DRAW-250 | kids GIRL2: stale request for team 3 after it was drawn -> 409 | PASS |
| DRAW-251 | kids GIRL2: pick 4 goes to Team 4 from the right list | PASS |
| DRAW-252 | kids GIRL2: stale request for team 4 after it was drawn -> 409 | PASS |
| DRAW-253 | kids GIRL2: finalize | PASS |
| DRAW-254 | kids: completed, each team = Icon Boy + Boy + 2 different girls | PASS |
| DRAW-255 | kids: Girls list must have exactly 8 before Girl 1 (7 refused) | PASS |
| DRAW-256 | kids: Girls list 9 also refused | PASS |
| DRAW-257 | kids: undo the only Girl 1 pick reopens the list for editing | PASS |
| DRAW-258 | kids: Girl 2 is ready once Girl 1 is finalized (uses the 4 left) | PASS |
| DRAW-259 | isolation: kids activity never changed the main tournament | PASS |

## Concurrency / race

| ID | Scenario (precondition / action → expected) | Status |
|---|---|---|
| RACE-001 | 2 tabs draw the same team at once (spin round) -> exactly one 200 | PASS |
| RACE-002 | 2 tabs shuffle A at once -> exactly one shuffle | PASS |
| RACE-003 | 3 tabs draw the same team at once (spin round) -> exactly one 200 | PASS |
| RACE-004 | 3 tabs shuffle A at once -> exactly one shuffle | PASS |
| RACE-005 | 5 tabs draw the same team at once (spin round) -> exactly one 200 | PASS |
| RACE-006 | 5 tabs shuffle A at once -> exactly one shuffle | PASS |
| RACE-007 | 10 tabs draw the same team at once (spin round) -> exactly one 200 | PASS |
| RACE-008 | 10 tabs shuffle A at once -> exactly one shuffle | PASS |
| RACE-009 | 25 tabs draw the same team at once (spin round) -> exactly one 200 | PASS |
| RACE-010 | 25 tabs shuffle A at once -> exactly one shuffle | PASS |
| RACE-011 | 2 tabs each request a DIFFERENT team at once -> picks land only in team order, no gaps or duplicates | PASS |
| RACE-012 | 5 tabs each request a DIFFERENT team at once -> picks land only in team order, no gaps or duplicates | PASS |
| RACE-013 | sequential rapid clicks (20 in a row, no await between) -> one pick per correct team | PASS |
| RACE-014 | draw + undo at the same time -> state stays consistent | PASS |
| RACE-015 | undo + draw (undo first) -> undo wins, draw refused as stale | PASS |
| RACE-016 | 5 simultaneous undos of the same pick -> exactly one succeeds | PASS |
| RACE-017 | 5 simultaneous finalizes -> one succeeds, round advances exactly once | PASS |
| RACE-018 | finalize + draw racing on the last team -> no 29th pick | PASS |
| RACE-019 | 5 simultaneous starts -> one succeeds | PASS |
| RACE-020 | 5 simultaneous player saves -> list ends consistent (one full list, no mixture) | PASS |
| RACE-021 | list save racing the first draw of that list -> either the save or the draw is refused, never both applied inconsistently | PASS |
| RACE-022 | draw during an active spin (non-zero spin time) -> 409 busy | PASS |
| RACE-023 | undo during an active spin -> 409 | PASS |
| RACE-024 | new tournament during an active spin -> 409 | PASS |
| RACE-025 | main and kids draw at the same instant -> both succeed independently | PASS |
| RACE-026 | 10 kids + 10 main draw requests interleaved -> one pick in each event | PASS |
| RACE-027 | 30 audience sockets connect simultaneously -> all receive the same state | PASS |
| RACE-028 | 10 sockets reconnect simultaneously during a spin -> spin and result unaffected | PASS |
| RACE-029 | 20 parallel guesses from different viewers for the same team -> all stored once each | PASS |
| RACE-030 | 10 parallel guesses from the SAME viewer -> one stored guess (upsert) | PASS |

## Security

| ID | Scenario (precondition / action → expected) | Status |
|---|---|---|
| SEC-001 | reveal (main, shuffle): start a 1.2 s spin and capture what screens receive | PASS |
| SEC-002 | reveal (main, shuffle): draw:spinning carries no result and no key | PASS |
| SEC-003 | reveal (main, shuffle): public state hides the pick while spinning | PASS |
| SEC-004 | reveal (main, shuffle): admin history hides the pick while spinning | PASS |
| SEC-005 | reveal (main, shuffle): Excel export hides the pick while spinning | PASS |
| SEC-006 | reveal (main, shuffle): leaderboard does not score the hidden pick | PASS |
| SEC-007 | reveal (main, shuffle): socket state broadcasts during the spin hide the pick | PASS |
| SEC-008 | reveal (main, shuffle): after the spin the result and key are published | PASS |
| SEC-009 | reveal (main, spin): start a 1.2 s spin and capture what screens receive | PASS |
| SEC-010 | reveal (main, spin): draw:spinning carries no result and no key | PASS |
| SEC-011 | reveal (main, spin): public state hides the pick while spinning | PASS |
| SEC-012 | reveal (main, spin): admin history hides the pick while spinning | PASS |
| SEC-013 | reveal (main, spin): Excel export hides the pick while spinning | PASS |
| SEC-014 | reveal (main, spin): leaderboard does not score the hidden pick | PASS |
| SEC-015 | reveal (main, spin): socket state broadcasts during the spin hide the pick | PASS |
| SEC-016 | reveal (main, spin): after the spin the result and key are published | PASS |
| SEC-017 | reveal (kids, shuffle): start a 1.2 s spin and capture what screens receive | PASS |
| SEC-018 | reveal (kids, shuffle): draw:spinning carries no result and no key | PASS |
| SEC-019 | reveal (kids, shuffle): public state hides the pick while spinning | PASS |
| SEC-020 | reveal (kids, shuffle): admin history hides the pick while spinning | PASS |
| SEC-021 | reveal (kids, shuffle): Excel export hides the pick while spinning | PASS |
| SEC-022 | reveal (kids, shuffle): leaderboard does not score the hidden pick | PASS |
| SEC-023 | reveal (kids, shuffle): socket state broadcasts during the spin hide the pick | PASS |
| SEC-024 | reveal (kids, shuffle): after the spin the result and key are published | PASS |
| SEC-025 | reveal (kids, spin): start a 1.2 s spin and capture what screens receive | PASS |
| SEC-026 | reveal (kids, spin): draw:spinning carries no result and no key | PASS |
| SEC-027 | reveal (kids, spin): public state hides the pick while spinning | PASS |
| SEC-028 | reveal (kids, spin): admin history hides the pick while spinning | PASS |
| SEC-029 | reveal (kids, spin): Excel export hides the pick while spinning | PASS |
| SEC-030 | reveal (kids, spin): leaderboard does not score the hidden pick | PASS |
| SEC-031 | reveal (kids, spin): socket state broadcasts during the spin hide the pick | PASS |
| SEC-032 | reveal (kids, spin): after the spin the result and key are published | PASS |
| SEC-033 | socket (main): forged "draw" event changes nothing and is not relayed | PASS |
| SEC-034 | socket (main): forged "draw:spinning" event changes nothing and is not relayed | PASS |
| SEC-035 | socket (main): forged "draw:revealed" event changes nothing and is not relayed | PASS |
| SEC-036 | socket (main): forged "draw:undone" event changes nothing and is not relayed | PASS |
| SEC-037 | socket (main): forged "undo" event changes nothing and is not relayed | PASS |
| SEC-038 | socket (main): forged "finalize" event changes nothing and is not relayed | PASS |
| SEC-039 | socket (main): forged "start" event changes nothing and is not relayed | PASS |
| SEC-040 | socket (main): forged "tournament:state" event changes nothing and is not relayed | PASS |
| SEC-041 | socket (main): forged "category:finalized" event changes nothing and is not relayed | PASS |
| SEC-042 | socket (main): forged "tap" event changes nothing and is not relayed | PASS |
| SEC-043 | socket (main): forged "viewers" event changes nothing and is not relayed | PASS |
| SEC-044 | socket (main): forged "admin" event changes nothing and is not relayed | PASS |
| SEC-045 | socket (kids): forged "draw" event changes nothing and is not relayed | PASS |
| SEC-046 | socket (kids): forged "draw:spinning" event changes nothing and is not relayed | PASS |
| SEC-047 | socket (kids): forged "draw:revealed" event changes nothing and is not relayed | PASS |
| SEC-048 | socket (kids): forged "draw:undone" event changes nothing and is not relayed | PASS |
| SEC-049 | socket (kids): forged "undo" event changes nothing and is not relayed | PASS |
| SEC-050 | socket (kids): forged "finalize" event changes nothing and is not relayed | PASS |
| SEC-051 | socket (kids): forged "start" event changes nothing and is not relayed | PASS |
| SEC-052 | socket (kids): forged "tournament:state" event changes nothing and is not relayed | PASS |
| SEC-053 | socket (kids): forged "category:finalized" event changes nothing and is not relayed | PASS |
| SEC-054 | socket (kids): forged "tap" event changes nothing and is not relayed | PASS |
| SEC-055 | socket (kids): forged "viewers" event changes nothing and is not relayed | PASS |
| SEC-056 | socket (kids): forged "admin" event changes nothing and is not relayed | PASS |
| SEC-057 | socket: reaction payload null is dropped | PASS |
| SEC-058 | socket: reaction payload 123 is dropped | PASS |
| SEC-059 | socket: reaction payload {} is dropped | PASS |
| SEC-060 | socket: reaction payload [] is dropped | PASS |
| SEC-061 | socket: reaction payload "🔥🔥" is dropped | PASS |
| SEC-062 | socket: reaction payload "xxxxxxxxxxxxxxxxxxx is dropped | PASS |
| SEC-063 | socket: reaction payload "<img src=x>" is dropped | PASS |
| SEC-064 | socket: reaction payload {"emoji":"🔥"} is dropped | PASS |
| SEC-065 | socket: reactions do not cross from kids to main | PASS |
| SEC-066 | injection: login password as object -> 401 | PASS |
| SEC-067 | injection: login password as array -> 401 | PASS |
| SEC-068 | injection: guess voterId as object -> 400 | PASS |
| SEC-069 | injection: guess nickname as object -> 400 | PASS |
| SEC-070 | injection: draw category as operator -> 409 | PASS |
| SEC-071 | injection: undo actionId as operator -> 409 | PASS |
| SEC-072 | injection: leaderboard query voter[$ne]=x -> 200, me null | PASS |
| SEC-073 | injection: leaderboard query voter[]=a&voter[]=b -> 200, me null | PASS |
| SEC-074 | injection: export ?tournament[$ne]=x is ignored (simple query parser) -> active tournament, no operator reaches Mongo | PASS |
| SEC-075 | injection: formula-like names are stored and exported as plain text cells | PASS |
| SEC-076 | injection: tournament name with path characters gives a safe download filename | PASS |
| SEC-077 | headers: helmet security headers present on API responses | PASS |
| SEC-078 | CORS: the REST API does not grant cross-origin reads to other sites | PASS |
| SEC-079 | CORS: cross-origin preflight for a host mutation is not granted | PASS |
| SEC-080 | cookie: HttpOnly + SameSite=Strict + Path=/ + 12 h | PASS |
| SEC-081 | cookie: Secure flag set in production mode | PASS |
| SEC-082 | rate limit: 10 wrong passwords from one IP -> 11th attempt 429 even with the right password | PASS |
| SEC-083 | rate limit: other IPs are not affected | PASS |
| SEC-084 | rate limit: a successful login resets the failure count | PASS |
| SEC-085 | logout: clears the cookie | PASS |
| SEC-086 | secrets: no .env file is tracked by git | PASS |
| SEC-087 | secrets: no MongoDB credentials or session secrets in git history | PASS |
| SEC-088 | secrets: built client bundle contains no server secrets | PASS |
| SEC-089 | secrets: .env files are ignored by git | PASS |

## System integration (HTTP + Socket.IO + DB), predictions, viewers, import, config

| ID | Scenario (precondition / action → expected) | Status |
|---|---|---|
| SIT-001 | flow (main): a connecting screen immediately receives state + viewer count | PASS |
| SIT-002 | flow (main): a draw emits spinning, then state, then revealed, in order | PASS |
| SIT-003 | flow (main): spinning and revealed refer to the same action and teams | PASS |
| SIT-004 | flow (main): the revealed winner was one of the announced candidates | PASS |
| SIT-005 | flow (main): the final broadcast state matches GET /state | PASS |
| SIT-006 | flow (main): finalize emits category:finalized and the next round becomes current | PASS |
| SIT-007 | flow (main): undo emits draw:undone with the action id | PASS |
| SIT-008 | flow (main): a screen that reconnects gets the current state, nothing replays | PASS |
| SIT-009 | flow (kids): a connecting screen immediately receives state + viewer count | PASS |
| SIT-010 | flow (kids): a draw emits spinning, then state, then revealed, in order | PASS |
| SIT-011 | flow (kids): spinning and revealed refer to the same action and teams | PASS |
| SIT-012 | flow (kids): the revealed winner was one of the announced candidates | PASS |
| SIT-013 | flow (kids): the final broadcast state matches GET /state | PASS |
| SIT-014 | flow (kids): finalize emits category:finalized and the next round becomes current | PASS |
| SIT-015 | flow (kids): undo emits draw:undone with the action id | PASS |
| SIT-016 | flow (kids): a screen that reconnects gets the current state, nothing replays | PASS |
| SIT-017 | ticker: recent lists the last 5 one-by-one picks newest first, never shuffle picks | PASS |
| SIT-018 | ticker: an undone pick disappears from recent | PASS |
| SIT-019 | ticker: hidden while spinning (pending pick not in recent) | PASS |
| SIT-020 | captain data: the first shuffle round is flagged so screens can show the captain | PASS |
| SIT-021 | short codes: team cards get distinct codes (kids G1 vs G2) | PASS |
| SIT-022 | predict: setup a live Women round | PASS |
| SIT-023 | predict: closed during a shuffle round (A) | PASS |
| SIT-024 | predict: opens once the one-by-one round starts | PASS |
| SIT-025 | predict: wrong team (ahead) -> 409 | PASS |
| SIT-026 | predict: wrong team (0) -> 409 | PASS |
| SIT-027 | predict: wrong round -> 409 | PASS |
| SIT-028 | predict: player not in the pool -> 400 | PASS |
| SIT-029 | predict: player from another list -> 400 | PASS |
| SIT-030 | predict: empty nickname -> 400 | PASS |
| SIT-031 | predict: nickname 25 chars -> 400 | PASS |
| SIT-032 | predict: nickname 24 chars -> 200 | PASS |
| SIT-033 | predict: voter id too short -> 400 | PASS |
| SIT-034 | predict: voter id with spaces -> 400 | PASS |
| SIT-035 | predict: voter id 64 chars -> 200 | PASS |
| SIT-036 | predict: voter id 65 chars -> 400 | PASS |
| SIT-037 | predict: player name differently spaced -> 200 | PASS |
| SIT-038 | predict: name as number -> 400 | PASS |
| SIT-039 | predict: same viewer can change the pick; only the last one counts | PASS |
| SIT-040 | predict: nothing is scored before the reveal | PASS |
| SIT-041 | predict: after the reveal, guesses for that team close | PASS |
| SIT-042 | predict: leaderboard scores 1 point per correct pick and counts every guesser | PASS |
| SIT-043 | predict: an undone pick no longer scores; the re-draw does | PASS |
| SIT-044 | predict: host closes predictions -> 409 "closed by the host", records kept | PASS |
| SIT-045 | predict: host reopens -> accepted again | PASS |
| SIT-046 | predict: kids guesses go to the kids leaderboard only | PASS |
| SIT-047 | predict: per-viewer rate limit -> 429 after 12 attempts in a minute (other viewers unaffected) | PASS |
| SIT-048 | predict: leaderboard never exposes voter ids | PASS |
| SIT-049 | viewers: host and projector are not counted | PASS |
| SIT-050 | viewers: 3 audience browsers -> 3 | PASS |
| SIT-051 | viewers: same browser in 3 tabs -> 1 | PASS |
| SIT-052 | viewers: invalid viewer ids are not counted | PASS |
| SIT-053 | viewers: kids audience counted only on kids screens | PASS |
| SIT-054 | viewers: count drops after a viewer leaves | PASS |
| SIT-055 | import: CSV through the API returns lists; saving applies the same validation | PASS |
| SIT-056 | import: invisible-character duplicates from a spreadsheet are caught on save | PASS |
| SIT-057 | import: XLSX through the API | PASS |
| SIT-058 | import: kids file through the kids API | PASS |
| SIT-059 | import: anonymous import -> 401 | PASS |
| SIT-060 | config: Vercel rewrites /api (incl. /api/kids) to the Render backend | PASS |
| SIT-061 | config: Vercel SPA fallback serves index.html for /admin and /screen | PASS |
| SIT-062 | config: PWA service worker never caches /api or /socket.io (no stale draw data) | PASS |
| SIT-063 | config: PWA manifest has name, start_url "/", standalone and icons incl. maskable | PASS |
| SIT-064 | config: PWA auto-updates to new deployments | PASS |
| SIT-065 | config: Render health check path is /api/health and start command is npm start | PASS |
| SIT-066 | config: Render secrets are not committed (sync: false / generated) | PASS |
| SIT-067 | config: the server refuses to start without required env vars | PASS |
| SIT-068 | config: CI runs the server tests against MongoDB and builds the client | PASS |
| SIT-069 | brand: contact numbers and WhatsApp link are defined once and correct | PASS |
| SIT-070 | brand: no other source file hard-codes a phone number | PASS |
| SIT-071 | client: the browser fairness check uses the same proof format as the server | PASS |
| SIT-072 | client: audience pages hide the fairness seal (host-only) | PASS |
| SIT-073 | client: sound unlock happens inside the tap and mute cancels scheduled sounds | PASS |
| SIT-074 | client: switching draws does not reload the page (history.pushState) | PASS |
| SIT-075 | cache: GET /state right after a draw shows the new pick (cache refreshed on change) | PASS |
| SIT-076 | cache: during a spin, repeated GET /state never shows the hidden pick | PASS |
| SIT-077 | cache: leaderboard reflects a reveal immediately (not a stale cached copy) | PASS |
| SIT-078 | cache: main and kids caches are separate | PASS |

## Unit

| ID | Scenario (precondition / action → expected) | Status |
|---|---|---|
| UNIT-001 | cleanName: plain | PASS |
| UNIT-002 | cleanName: trim both ends | PASS |
| UNIT-003 | cleanName: collapse inner spaces | PASS |
| UNIT-004 | cleanName: tabs | PASS |
| UNIT-005 | cleanName: newlines | PASS |
| UNIT-006 | cleanName: carriage return | PASS |
| UNIT-007 | cleanName: non-breaking space | PASS |
| UNIT-008 | cleanName: null | PASS |
| UNIT-009 | cleanName: undefined | PASS |
| UNIT-010 | cleanName: number | PASS |
| UNIT-011 | cleanName: empty | PASS |
| UNIT-012 | cleanName: spaces only | PASS |
| UNIT-013 | cleanName: unicode letters kept | PASS |
| UNIT-014 | cleanName: devanagari kept | PASS |
| UNIT-015 | cleanName: apostrophe kept | PASS |
| UNIT-016 | cleanName: hyphen kept | PASS |
| UNIT-017 | cleanName: dot kept | PASS |
| UNIT-018 | cleanName: emoji kept | PASS |
| UNIT-019 | cleanName: formula-like kept as text | PASS |
| UNIT-020 | cleanName: html-like kept as text | PASS |
| UNIT-021 | cleanName: zero-width space removed | PASS |
| UNIT-022 | cleanName: zero-width joiner removed | PASS |
| UNIT-023 | cleanName: byte-order mark removed | PASS |
| UNIT-024 | cleanName: soft hyphen removed | PASS |
| UNIT-025 | cleanName: control chars removed | PASS |
| UNIT-026 | cleanName: NFC: decomposed é equals composed | PASS |
| UNIT-027 | cleanName: NFC: decomposed ö | PASS |
| UNIT-028 | cleanName: bidi override removed | PASS |
| UNIT-029 | cleanName: ideographic space | PASS |
| UNIT-030 | cleanName: line separator | PASS |
| UNIT-031 | shuffle: size 0 returns a permutation and leaves the input untouched | PASS |
| UNIT-032 | shuffle: size 1 returns a permutation and leaves the input untouched | PASS |
| UNIT-033 | shuffle: size 2 returns a permutation and leaves the input untouched | PASS |
| UNIT-034 | shuffle: size 3 returns a permutation and leaves the input untouched | PASS |
| UNIT-035 | shuffle: size 4 returns a permutation and leaves the input untouched | PASS |
| UNIT-036 | shuffle: size 5 returns a permutation and leaves the input untouched | PASS |
| UNIT-037 | shuffle: size 8 returns a permutation and leaves the input untouched | PASS |
| UNIT-038 | shuffle: size 16 returns a permutation and leaves the input untouched | PASS |
| UNIT-039 | shuffle: size 27 returns a permutation and leaves the input untouched | PASS |
| UNIT-040 | shuffle: size 28 returns a permutation and leaves the input untouched | PASS |
| UNIT-041 | shuffle: size 29 returns a permutation and leaves the input untouched | PASS |
| UNIT-042 | shuffle: size 50 returns a permutation and leaves the input untouched | PASS |
| UNIT-043 | shuffle: size 100 returns a permutation and leaves the input untouched | PASS |
| UNIT-044 | shuffle: size 200 returns a permutation and leaves the input untouched | PASS |
| UNIT-045 | shuffle: works on objects and keeps identity | PASS |
| UNIT-046 | shuffle: repeated calls are not all identical (randomness present) | PASS |
| UNIT-047 | shuffle: statistical uniformity of first position (n=4, 40k samples, chi-square < 25) | PASS |
| UNIT-048 | shuffle: every position reachable for each item (n=5, 5k samples) | PASS |
| UNIT-049 | headerCategory: "A" -> A | PASS |
| UNIT-050 | headerCategory: "a" -> A | PASS |
| UNIT-051 | headerCategory: "A Player" -> A | PASS |
| UNIT-052 | headerCategory: "A Players" -> A | PASS |
| UNIT-053 | headerCategory: "Category A" -> A | PASS |
| UNIT-054 | headerCategory: "Cat B" -> B | PASS |
| UNIT-055 | headerCategory: "Group C" -> C | PASS |
| UNIT-056 | headerCategory: "  d  " -> D | PASS |
| UNIT-057 | headerCategory: "B-Players" -> B | PASS |
| UNIT-058 | headerCategory: "C_player" -> C | PASS |
| UNIT-059 | headerCategory: "Women" -> WOMEN | PASS |
| UNIT-060 | headerCategory: "WOMEN" -> WOMEN | PASS |
| UNIT-061 | headerCategory: "woman" -> WOMEN | PASS |
| UNIT-062 | headerCategory: "Ladies" -> WOMEN | PASS |
| UNIT-063 | headerCategory: "W" -> WOMEN | PASS |
| UNIT-064 | headerCategory: "Icon Boy" -> ICON | PASS |
| UNIT-065 | headerCategory: "icon" -> ICON | PASS |
| UNIT-066 | headerCategory: "ICON BOYS" -> ICON | PASS |
| UNIT-067 | headerCategory: "Boy" -> BOY | PASS |
| UNIT-068 | headerCategory: "Boys" -> BOY | PASS |
| UNIT-069 | headerCategory: "boy players" -> BOY | PASS |
| UNIT-070 | headerCategory: "Girl" -> GIRL | PASS |
| UNIT-071 | headerCategory: "Girls" -> GIRL | PASS |
| UNIT-072 | headerCategory: "girl player" -> GIRL | PASS |
| UNIT-073 | headerCategory: "E" -> null | PASS |
| UNIT-074 | headerCategory: "Notes" -> null | PASS |
| UNIT-075 | headerCategory: "" -> null | PASS |
| UNIT-076 | headerCategory: "Team" -> null | PASS |
| UNIT-077 | headerCategory: "Category" -> null | PASS |
| UNIT-078 | headerCategory: "Player" -> null | PASS |
| UNIT-079 | headerCategory: "AB" -> null | PASS |
| UNIT-080 | headerCategory: "Men" -> null | PASS |
| UNIT-081 | headerCategory: "123" -> null | PASS |
| UNIT-082 | headerCategory: "Boyfriend" -> null | PASS |
| UNIT-083 | headerCategory: "Girlfriend" -> null | PASS |
| UNIT-084 | headerCategory: "Women Team" -> WOMEN | PASS |
| UNIT-085 | parseUpload CSV: comma CSV | PASS |
| UNIT-086 | parseUpload CSV: semicolon CSV | PASS |
| UNIT-087 | parseUpload CSV: quoted comma in name | PASS |
| UNIT-088 | parseUpload CSV: BOM at start | PASS |
| UNIT-089 | parseUpload CSV: blank rows ignored | PASS |
| UNIT-090 | parseUpload CSV: blank cells ignored | PASS |
| UNIT-091 | parseUpload CSV: extra unknown columns ignored | PASS |
| UNIT-092 | parseUpload CSV: names trimmed and collapsed | PASS |
| UNIT-093 | parseUpload CSV: CRLF line endings | PASS |
| UNIT-094 | parseUpload CSV: kids headers | PASS |
| UNIT-095 | parseUpload CSV: accented names kept | PASS |
| UNIT-096 | parseUpload CSV: formula-like value kept as plain text | PASS |
| UNIT-097 | parseUpload CSV: header only, no names | PASS |
| UNIT-098 | parseUpload CSV: duplicate names passed through (save validates) | PASS |
| UNIT-099 | parseUpload rejects: missing body | PASS |
| UNIT-100 | parseUpload rejects: filename not a string | PASS |
| UNIT-101 | parseUpload rejects: data not a string | PASS |
| UNIT-102 | parseUpload rejects: unsupported .xls | PASS |
| UNIT-103 | parseUpload rejects: unsupported .txt | PASS |
| UNIT-104 | parseUpload rejects: no extension | PASS |
| UNIT-105 | parseUpload rejects: corrupt xlsx bytes | PASS |
| UNIT-106 | parseUpload rejects: empty xlsx | PASS |
| UNIT-107 | parseUpload rejects: CSV with no category header | PASS |
| UNIT-108 | parseUpload rejects: empty CSV | PASS |
| UNIT-109 | parseUpload XLSX: first sheet only, numbers and blanks handled | PASS |
| UNIT-110 | parseUpload XLSX: 200 names in one column | PASS |
| UNIT-111 | sha256: known vector | PASS |
| UNIT-112 | proofText: stable format | PASS |
| UNIT-113 | fairness: different actionId changes the fingerprint | PASS |
| UNIT-114 | fairness: different category changes the fingerprint | PASS |
| UNIT-115 | fairness: different team changes the fingerprint | PASS |
| UNIT-116 | fairness: different name changes the fingerprint | PASS |
| UNIT-117 | fairness: different salt changes the fingerprint | PASS |
| UNIT-118 | fairness: extra assignment changes the fingerprint | PASS |
| UNIT-119 | fairness: no assignment changes the fingerprint | PASS |
| UNIT-120 | fairness: shuffle order matters (team swap detected) | PASS |
| UNIT-121 | fairness: browser proofText equals server proofText | PASS |
| UNIT-122 | fairness: browser verify() accepts an honest reveal | PASS |
| UNIT-123 | fairness: browser verify() rejects a tampered name | PASS |
| UNIT-124 | fairness: browser verify() returns null without a key | PASS |
| UNIT-125 | fairness: browser sha256 matches server for unicode | PASS |
| UNIT-126 | config: every round has a label and short code | PASS |
| UNIT-127 | config: every round draws from a known list | PASS |
| UNIT-128 | config: Girl 1 and Girl 2 share the Girls list, others use their own | PASS |
| UNIT-129 | config: shuffle rounds are exactly A and Icon Boy | PASS |
| UNIT-130 | config: main event = 28 teams, A–D available, default A/Women/B/C | PASS |
| UNIT-131 | config: kids event = 4 teams, fixed Icon Boy/Boy/Girl 1/Girl 2 | PASS |
| UNIT-132 | config: kids team = 2 boys + 2 girls | PASS |
| UNIT-133 | eventOf("kids") -> kids | PASS |
| UNIT-134 | eventOf("main") -> main | PASS |
| UNIT-135 | eventOf(undefined) -> main | PASS |
| UNIT-136 | eventOf("") -> main | PASS |
| UNIT-137 | eventOf("KIDS") -> main | PASS |
| UNIT-138 | eventOf({}) -> main | PASS |
| UNIT-139 | eventOf("../kids") -> main | PASS |
