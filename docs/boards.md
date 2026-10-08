# 게시판 시스템 (공통 posts)

공지·자유·공략 등 **모든 게시판이 하나의 posts 테이블**을 공유합니다.  
선박 관련 기능(비교 등)은 게시판이 아니라 **선박** 대메뉴의 도구로 둡니다.  
게시판 종류는 `boardId`로 구분합니다. (추후 MySQL 이관 대비)

## 테이블 개념

### boards

| 컬럼 | 설명 |
|------|------|
| id | `notice`, `free`, `guide` … (선박 도구는 별도 메뉴) |
| title | 표시 이름 |
| description | 설명 |
| writeRole | `admin` \| `member` \| `none` |
| previewCount | 대시보드 미리보기 개수 |
| sortOrder | 정렬 |
| enabled | 사용 여부 |

### posts (공통)

| 컬럼 | 설명 |
|------|------|
| id | 글 ID |
| boardId | 게시판 ID (FK → boards.id) |
| authorId | 작성자 유저 ID (`system` 가능) |
| title | 제목 |
| body | 본문 |
| isPinned | 상단 고정 |
| isDeleted | 소프트 삭제 |
| createdAt / updatedAt | ISO 시각 |

파일 저장(현재):

- `server/data/boards.json`
- `server/data/posts.json`

## 권한

| 게시판 | writeRole | 글쓰기 |
|--------|-----------|--------|
| 공지 (`notice`) | admin | 관리자만 |
| 자유/공략 | member | 로그인 회원 |

- 관리자: `users.role = admin`
- 서버 최초 기동 시 관리자가 없으면 **첫 유저**를 admin으로 지정
- 아이디 `admin`으로 가입 시 admin

## API

인증: `Authorization: Bearer <token>`

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/boards` | 게시판 목록(메타만, 글 수 집계 없음) |
| GET | `/api/boards?preview=1` | 게시판 목록(+대시보드용 미리보기 글) |
| GET | `/api/boards/:boardId/posts` | 글 목록 |
| GET | `/api/boards/:boardId/posts/:postId` | 글 상세 |
| POST | `/api/boards/:boardId/posts` | 글 작성 `{ title, body, isPinned? }` |

## 새 게시판 추가

`server/boardStore.mjs`의 `DEFAULT_BOARDS`에 항목을 추가하거나  
`server/data/boards.json`에 동일 스키마로 추가하면 됩니다.  
글은 모두 `posts`에 `boardId`만 바꿔 저장합니다.

## UI

- 대시보드: 각 게시판 미리보기
- 더보기/글 클릭: 목록·상세·글쓰기 (`BoardView`)
- 공지 글쓰기는 admin만 버튼 노출
