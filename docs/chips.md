# 카탈로그 칩 설정 (단일 참고)

종류 라벨·색·마크업·카탈로그 점프·사용처를 **여기만** 본다.  
새 칩을 넣을 때 코드/규칙을 다시 검색하지 말고 이 표를 따른다.  
CSS 실체: `src/App.css` (`.quest-skill-chips` / `.chip-edge-label`)  
짧은 규칙: `.cursor/rules/chip-edge-label.mdc` · `.cursor/rules/catalog-jump.mdc`

---

## 공통 규칙

1. **카탈로그 점프 칩** = 앞 라벨 + 종류별 외곽선/배경색 + 점프 UX를 **항상 함께**.
2. 호버 **밑줄 없음**.
3. 본문에 「불러오는 중…」 문구 금지 → `LoadingOverlay`.
4. 전문 스킬·전문 직업(`is-specialist`)은 금색 표면 유지 + 종류 라벨 병행.
5. 스킬 레벨·소비품 수량만 `em` 금색.

### 기하학 (`.chip-edge-label` + `.is-leading`)

| 속성 | 값 |
|------|-----|
| 배치 | 칩 `li` 안 첫 자식 (내용 앞). 외곽선 걸침 금지 |
| 축소 | `transform: scale(0.92)` · `transform-origin: center center` |
| 글자 | `font-size: 0.7rem; font-weight: 800` (rem만 더 줄이지 말 것) |
| 라벨 내부 | `padding: 0.14rem 0.22rem` |
| 세로 정렬 | 한 flex 줄 `align-items: center` (개별 `translateY` 금지) |
| 내용 간격 | 발견물: `.discovery-chip-inner` `gap: 0.22rem` / 기타: `li` `gap: 0.12rem` |

---

## 종류별 설정

| 종류 | 라벨 컴포넌트 | 라벨 CSS | 칩 클래스 | 액센트(라벨/외곽) | 글자색 | 해시 `#/...` | 단건 API | Catalog / DetailView |
|------|---------------|----------|-----------|-------------------|--------|--------------|----------|----------------------|
| 도시 | `CityEdgeLabel` | `.is-city` | `.is-city-chip` | `#b03a3a` | `#8f2f2f` | `ports` | `GET /api/ports/:key` | `PortCatalog` / `PortDetailView` |
| 육지 | `LandEdgeLabel` | `.is-land` | `.is-land-chip` | `#5a7a32` | `#4d6a28` | `fields` | `GET /api/fields/:key` | `FieldCatalog` / `FieldDetailView` |
| 해역 | `SeaAreaEdgeLabel` | `.is-sea` | `.is-sea-chip` | `#245a8c` | `#1c4870` | `sea-areas` | `GET /api/sea-areas/:key` | `SeaAreaCatalog` / `SeaAreaDetailView` |
| 지역 | `RegionEdgeLabel` | `.is-region` | `.is-region-chip` | `#6b4f8a` | `#574072` | `regions` | `GET /api/regions/:key` | `RegionCatalog` / `RegionDetailView` |
| 발견물 | `DiscoveryEdgeLabel` | `.is-discovery` | `.is-discovery-chip` | `var(--is-blue)` | `var(--is-blue)` | `discoveries` | `GET /api/discoveries/:key` | `DiscoveryCatalog` / `DiscoveryDetailView` · `DiscoveryChips` |
| 스킬 | `SkillEdgeLabel` | `.is-skill` | `.is-skill-chip` | `#0c7c8c` | `#0a6a72` | `skills` | `GET /api/skills/:key` | `SkillCatalog` / `SkillDetailView` · `SkillModule` |
| 소비품 | `ConsumableEdgeLabel` | `.is-consumable` | `.is-consumable-chip` | `#c45f12` | `#9a4a0e` | `consumables` | `GET /api/consumables/:key` | `ConsumableCatalog` |
| 직업 | `JobEdgeLabel` | `.is-job` | `.is-job-chip` | `#4558a8` | `#36478a` | `jobs` | `GET /api/jobs/:key` | `JobCatalog` / `JobDetailView` · `JobModule` |

칩 배경: `color-mix(in srgb, {액센트} 7~14%, var(--is-white))`  
칩 외곽선: `rgba`/`color-mix`로 액센트 22~50% 투명. 세부 값은 `App.css` 해당 블록.

**아직 전용 칩 없음 (필요 시 위 표에 추가):** 퀘스트·보물지도·선박 등. 퀘스트는 칩 외 링크/모듈로 점프하는 경우 있음 (`DiscoveryDetailView` 등).

---

## 마크업 템플릿

```tsx
<ul className="quest-skill-chips">
  <li className="is-sea-chip">
    {authToken ? (
      <button
        type="button"
        className="quest-skill-chip-btn"
        disabled={seaLoading}
        onClick={() => void openMatchedSeaArea(name)}
      >
        <span className="chip-edge-inner">
          <SeaAreaEdgeLabel />
          <span>{name}</span>
        </span>
      </button>
    ) : (
      <span className="chip-edge-inner">
        <SeaAreaEdgeLabel />
        <span>{name}</span>
      </span>
    )}
  </li>
</ul>
```

발견물만 내부 래퍼가 `.discovery-chip-inner` (+ 소분류 `em` + 랭크 마크).

---

## 카탈로그 점프 (4단)

1. 칩 클릭 → `LoadingOverlay` (`「{종류} 불러오는 중…」` 레이블만)
2. `fetch*ByKey` → 성공 시 `DetailModal` (`stack={1}`) + 해당 `*DetailView`
3. 헤더 **「{카탈로그} 메뉴로 이동」** — **관리자만** → 새 탭 `#/{hash}?q=&open=`
4. 없음 → `ConfirmLayer` `「{이름}」 {종류}이(가) 없습니다.` · 관리자만 **등록하러 이동** → `#/{hash}?q=&add=1`

URL 파라미터: `q` 검색 · `open` 자동 상세 · `add=1` 관리자만.  
해시/`initialAdd`/API `requireAdmin` 보안은 `catalog-jump.mdc`와 동일.

---

## 사용처 (상세 뷰)

| 상세 뷰 | 칩 필드 |
|---------|---------|
| `QuestDetailView` | 필요 스킬 · 보상 소비품 · 발견물 · 의뢰 장소(도시) · 목적지(도시/육지 분할) · 연속 퀘스트 · 연결 지도/퀘스트 |
| `DiscoveryDetailView` | 퀘스트 (모듈/점프) |
| `PortDetailView` | 지역 · 해역 · 언어(스킬) · 도시 인물 스킬 · 도시 외곽(육지) |
| `FieldDetailView` | 지역 · 해역 |
| `SeaAreaDetailView` | 지역(쉼표면 하나로/1차·2차 선택 레이어) · 해역 내 장소(도시 / 상륙지·2차 필드→육지) |
| `RegionDetailView` | 해역 |
| `SkillDetailView` | 직업 · 습득·사용 도시 |
| `JobDetailView` | 우대·연구 스킬 (`SkillModule`) |
| `RefineDetailView` | 스킬 (라벨만, 점프 미연결 시 동일 칩 클래스) |

목적지 분할: `splitQuestDestination` → `steps[]` 각각 칩 + `»` (`.quest-dest-sep`).  
도시 목록에 있으면 도시 칩, 아니면 육지 칩. 한 칩에 합치지 말 것.  
목적지 끝 괄호: 칩은 앞 이름만, 괄호 구간은 칩 뒤 일반 텍스트(`.quest-dest-paren-note`).  
예: `[육지] 남그린란드섬 앞바다` + ` (14150, 1280)`. `splitDestinationParenSuffix`.

---

## 새 종류 추가 체크리스트

1. `*EdgeLabel.tsx` — `chip-edge-label is-{kind} is-leading`
2. `App.css` — `.chip-edge-label.is-{kind}` + `li.is-{kind}-chip` (+ kv 그리드 글자색)
3. 이 문서 표·사용처 행 추가
4. 상세 뷰에 마크업 + `openMatched*` + Overlay + Modal + miss Confirm
5. `Dashboard` 해시 `q`/`open`/`add` · Catalog `initialQuery`/`openKey`/`initialAdd`
6. `GET /api/.../:key` 단건 + import `requireAdmin`
7. `.cursor/rules/chip-edge-label.mdc` · `catalog-jump.mdc` 한 줄만 갱신 (자세한 표는 이 문서)
