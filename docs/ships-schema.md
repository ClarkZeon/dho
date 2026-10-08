# 선박 DB 스키마

선박 **상세 화면 항목**을 기준으로 MySQL 테이블을 잡았습니다.  
(타 사이트 데이터 수집 없음 — 자체 입력·공개 출처만 사용)

SQL:
- [`server/sql/000_create_database.sql`](../server/sql/000_create_database.sql)
- [`server/sql/001_ships.sql`](../server/sql/001_ships.sql)
- [`server/sql/002_seed_fancy.sql`](../server/sql/002_seed_fancy.sql)
- [`server/sql/003_reset_ships.sql`](../server/sql/003_reset_ships.sql)

현재 런타임 저장소(앱 연동): [`server/data/ships-db.json`](../server/data/ships-db.json)  
MySQL 적용: `MYSQL_PASSWORD=... node server/scripts/init-ships-mysql.mjs`

## 콤보 마스터 (입력 시 select)

| 항목 | 테이블 | 선박 FK |
|------|--------|---------|
| 선박 크기 | `ship_sizes` | `ships.size_id` |
| 선박 형식 | `ship_forms` | `ships.form_id` |
| 재질 | `ship_materials` | `ships.material_id` |

입력 UI는 각 마스터의 `is_enabled = 1` 행을 `sort_order` 순으로 조회해 콤보에 넣으면 됩니다.

초기 시드:
- 크기: 소형1~2, 중형1~2, 대형1~2
- 형식: 범선, 갤리, 증기선
- 재질: 너도밤나무, 삼나무판, 붉은 소나무, 잉글랜드 제독 재료 (이후 관리에서 추가)

> 예전 명칭 **추진 방식** → DB/UI 모두 **선박 형식** (`ship_forms`)으로 통일.

## 상세 항목 → 컬럼 매핑

| 상세 영역 | 컬럼 |
|-----------|------|
| 이름 | `ships.name` / `slug` |
| 분류 (전투용 등) | `ships.category` |
| 소개 | `ships.description` |
| 선박 크기 | `size_id` → `ship_sizes` |
| 선박 형식 | `form_id` → `ship_forms` |
| 모험·교역·전투 Lv | `adventure_lv`, `trade_lv`, `battle_lv` |
| 재질 | `material_id` → `ship_materials` |
| 획득 방법 | `acquire_method` |
| 강화 횟수 | `enhance_count` |
| 건조 랭크·일수 | `shipyard_rank`, `build_days` |
| 기본 성능 | `durability`, `sail_vertical`, `sail_horizontal`, `oar`, `turn_stat`, `wave_resist`, `armor` |
| 적재 | `cabin`, `crew_required`, `guns`, `warehouse` |
| 강화 상한 | `cap_*` |
| 선박 부품 슬롯 | `part_*` |
| 선박 스킬 | `ship_skills` + `ship_skill_links` |

## 테이블

### ship_sizes / ship_forms / ship_materials

공통 구조: `code`, `name`, `sort_order`, `is_enabled`.

### ships

선박 1척 = 1행. 크기·형식·재질은 FK로만 저장합니다.

### ship_skills / ship_skill_links

스킬 마스터 + 연결.

## 조회 예 (콤보 + 상세)

```sql
-- 콤보: 선박 형식
SELECT id, name FROM ship_forms WHERE is_enabled = 1 ORDER BY sort_order, name;

-- 선박 상세 (표시명 join)
SELECT
  s.*,
  sz.name AS size_name,
  f.name  AS form_name,
  m.name  AS material_name
FROM ships s
JOIN ship_sizes sz ON sz.id = s.size_id
JOIN ship_forms f  ON f.id = s.form_id
LEFT JOIN ship_materials m ON m.id = s.material_id
WHERE s.slug = ?;
```

## 파생 값 (저장 안 함)

| 값 | 계산 |
|----|------|
| 돛 합 | `sail_vertical + sail_horizontal` |
| 총 적재 | `cabin + guns + warehouse` |

가속도 단계는 별도 공식([ship-acceleration.md](./ship-acceleration.md))으로 계산합니다.

## 적용

```bash
mysql -u root -p dho < server/sql/001_ships.sql
```
