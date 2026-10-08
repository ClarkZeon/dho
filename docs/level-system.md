# 레벨 시스템

앱 계정(유저) 레벨·경험치 규칙입니다.  
게임 내 캐릭터 레벨과는 별개입니다.

구현 위치: `server/index.mjs` · UI: 로그인 후 상단 `Lv.` 뱃지, 홈 경험치 바

---

## 개요

| 항목 | 값 |
|------|----|
| 시작 레벨 | `1` |
| 시작 XP | `0` |
| 다음 레벨 필요 XP | `현재 레벨 × 100` |
| 일일 로그인 보상 | `+20 XP` (UTC 기준 하루 1회) |

---

## 필드

유저 저장 데이터 (`server/data/users.json`)에 포함됩니다.

| 필드 | 타입 | 설명 |
|------|------|------|
| `level` | number | 현재 레벨 (≥ 1) |
| `xp` | number | 현재 레벨 안에서의 경험치 (≥ 0) |
| `lastLoginAt` | string \| null | 마지막 로그인 시각 (ISO 8601). 일일 XP 판정용 |

API 응답(공개 유저)에는 추가로:

| 필드 | 설명 |
|------|------|
| `xpToNext` | 다음 레벨까지 필요한 XP (`level × 100`) |

비밀번호 해시 등 민감 정보는 응답에 포함하지 않습니다.

---

## 필요 경험치

```text
xpNeeded(level) = max(1, level) * 100
```

예시:

| 현재 레벨 | 다음 레벨까지 |
|-----------|----------------|
| 1 | 100 XP |
| 2 | 200 XP |
| 3 | 300 XP |
| 10 | 1000 XP |

---

## 레벨업 처리

XP를 지급할 때:

1. `xp += amount`
2. `xp >= xpNeeded(level)` 이면  
   - `xp -= xpNeeded(level)`  
   - `level += 1`  
3. 남은 XP로 2를 반복 (한 번에 여러 레벨 가능)

잔여 XP는 다음 레벨 게이지로 이월됩니다.

---

## 일일 로그인 XP

- 로그인 성공 시 `lastLoginAt`과 현재 시각을 **UTC 날짜**로 비교합니다.
- 같은 UTC 날짜에 이미 로그인한 적 있으면 XP 없음 (`dailyXp = 0`).
- 날짜가 바뀌었거나 `lastLoginAt`이 없으면 **+20 XP** 지급.
- 이후 `lastLoginAt`을 현재 시각으로 갱신합니다.

로그인 API 응답 예시:

```json
{
  "user": {
    "id": "...",
    "username": "captain01",
    "nickname": "항해자",
    "level": 1,
    "xp": 20,
    "xpToNext": 100,
    "createdAt": "..."
  },
  "reward": {
    "dailyXp": 20,
    "gainedLevels": 0
  }
}
```

- `gainedLevels`: 이번 보상으로 오른 레벨 수
- 프론트는 보상 메시지를 조합해 표시합니다.

---

## 회원가입

신규 계정:

```text
level = 1
xp = 0
lastLoginAt = null
```

첫 로그인 때 일일 XP(+20)를 받을 수 있습니다.

---

## 기존 계정 호환

`level` / `xp` / `lastLoginAt`이 없는 구 데이터는 로드 시 보정합니다.

| 누락 필드 | 기본값 |
|-----------|--------|
| `level` | `1` |
| `xp` | `0` |
| `lastLoginAt` | `null` |

---

## UI

| 위치 | 표시 |
|------|------|
| 상단 우측 | `Lv.{level}` 뱃지 + 닉네임 |
| 홈 | 경험치 바 (`xp / xpToNext`), 안내 문구 |

세션(`localStorage` / `sessionStorage`)에도 `level`, `xp`, `xpToNext`를 저장합니다.  
구 세션에 레벨이 없으면 클라이언트에서도 동일 규칙으로 보정합니다.

---

## 상수 (서버)

```js
const DAILY_LOGIN_XP = 20
// xpNeeded(level) = level * 100
```

보상량·공식을 바꿀 때는 이 문서와 `server/index.mjs`를 함께 수정하세요.

---

## 향후 확장 (미구현)

- 계산기 사용·도감 열람 등 활동 XP
- 레벨 상한
- 타임존을 UTC가 아닌 KST로 고정
- MySQL 이관 시 `users` 테이블 컬럼: `level`, `xp`, `last_login_at`
