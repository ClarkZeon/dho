# 쪽지 시스템

유저 간 쪽지 보내기 / 받은·보낸 쪽지함 / 답장 기능입니다.

## 기능

| 기능 | 설명 |
|------|------|
| 보내기 | 닉네임 또는 아이디로 수신자 지정 |
| 받은쪽지 | 내게 온 쪽지 목록, 미읽음 표시 |
| 보낸쪽지 | 내가 보낸 쪽지 목록 |
| 상세 | 스레드(원문+답장) 보기, 열면 읽음 처리 |
| 답장 | 상세에서 바로 답장 또는 쓰기 화면으로 답장 |
| 미읽음 뱃지 | 상단 쪽지 메뉴에 미읽음 개수 |

## API

인증: `Authorization: Bearer <token>` (로그인 시 발급)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/messages/inbox` | 받은쪽지 |
| GET | `/api/messages/sent` | 보낸쪽지 |
| GET | `/api/messages/unread-count` | 미읽음 수 |
| GET | `/api/messages/:id` | 상세(+스레드), 수신자 읽음 처리 |
| POST | `/api/messages` | 새 쪽지 `{ to, subject, body }` |
| POST | `/api/messages/:id/reply` | 답장 `{ body }` |
| GET | `/api/users/search?q=` | 수신자 검색 |

## 저장

- `server/data/messages.json`
- `server/data/sessions.json` (로그인 토큰)

## 제약

- 제목 1~60자, 내용 1~2000자
- 자기 자신에게 발송 불가
- 답장 제목은 `Re:` 접두 유지
