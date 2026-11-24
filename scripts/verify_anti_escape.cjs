// Automated Verification Script for Anti-Escape System
const fs = require('fs');
const path = require('path');

// Mock localStorage and window
const store = {};
global.localStorage = {
  getItem: (key) => store[key] !== undefined ? store[key] : null,
  setItem: (key, val) => { store[key] = String(val); },
  removeItem: (key) => { delete store[key]; },
  clear: () => { for (const k in store) delete store[k]; }
};

global.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {}
};
global.CustomEvent = function(name, detail) { this.name = name; this.detail = detail; };

// Load storage.js
const storageCode = fs.readFileSync(path.resolve(__dirname, '../src/utils/storage.js'), 'utf8');

// Replace ES module exports with CommonJS export for Node testing
let cjsCode = storageCode
  .replace(/export\s+const\s+(\w+)\s*=/g, 'const $1 =')
  .replace(/export\s+function\s+(\w+)/g, 'function $1');

cjsCode += '\nmodule.exports = { storage, STORAGE_KEYS, calculateSleepDuration };';

const m = { exports: {} };
const fn = new Function('module', 'exports', 'require', cjsCode);
fn(m, m.exports, require);
const { storage, STORAGE_KEYS } = m.exports;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('=== TEST SUITE: Human OS 도피 원천 봉쇄 시스템 검증 ===\n');

// -------------------------------------------------------------
// Test 1: 휴가 쿼터 & 소급 적용 금지 검증
// -------------------------------------------------------------
console.log('--- 1. 휴가 쿼터 & 잠금장치 테스트 ---');

// 1.1 소급 적용 금지: 기존 11월 휴가 데이터 (countsTowardQuota 없음)
const legacyVacations = [
  { id: 'vac_old_1', startDate: '2026-11-15', endDate: '2026-11-17', days: 3, reason: '기존 휴가' },
  { id: 'vac_old_2', startDate: '2026-11-20', endDate: '2026-11-20', days: 1, reason: '기존 휴가 2' }
];
localStorage.setItem('human_os_vacations_v1', JSON.stringify(legacyVacations));

const quotaNov = storage.getMonthlyVacationQuota('2026-11');
assert(quotaNov.max === 2, '월 최대 쿼터는 2일');
assert(quotaNov.used === 0, '소급 적용 금지: 기존 11월 휴가는 쿼터에 차감되지 않음 (used: 0)');
assert(quotaNov.remaining === 2, '현재 잔여 쿼터는 2 / 2일에서 시작');

// 1.2 당일 휴가 원천 차단
const todayMock = new Date('2026-11-21T14:00:00');
const sameDayCheck = storage.canRegisterVacation('2026-11-21', '2026-11-21', todayMock);
assert(sameDayCheck.allowed === false, '오늘 날짜(당일) 휴가 등록은 원천 차단됨');

// 1.3 과거 날짜 차단
const pastCheck = storage.canRegisterVacation('2026-11-19', '2026-11-19', todayMock);
assert(pastCheck.allowed === false, '과거 날짜 휴가 등록은 차단됨');

// 1.4 전날 밤 22:00 이전 사전 예약제 검증
// A) 11/21 14:00 (22시 이전) -> 11/22 내일 휴가 예약 가능
const preCheckAllowed = storage.canRegisterVacation('2026-11-22', '2026-11-22', new Date('2026-11-21T14:00:00'));
assert(preCheckAllowed.allowed === true, '전날 14:00 (22:00 이전)에는 내일 휴가 예약 허용');

// B) 11/21 22:30 (22시 이후) -> 11/22 내일 휴가 예약 불가
const preCheckBlocked = storage.canRegisterVacation('2026-11-22', '2026-11-22', new Date('2026-11-21T22:30:00'));
assert(preCheckBlocked.allowed === false, '전날 22:30 (22:00 이후)에는 내일 휴가 예약 차단 (마감)');

// C) 11/21 22:30 -> 11/23 모레 휴가 예약은 가능
const preCheckD2 = storage.canRegisterVacation('2026-11-23', '2026-11-23', new Date('2026-11-21T22:30:00'));
assert(preCheckD2.allowed === true, '전날 22:30에도 모레(D+2) 휴가 예약은 허용');

// 1.5 월 2회 단일 쿼터 차감 및 초과 등록 차단
const reg1 = storage.addVacation('2026-11-24', '2026-11-24', '병원 방문', new Date('2026-11-21T14:00:00'));
assert(reg1.success === true, '1일 휴가 신규 등록 성공');

const quotaAfter1 = storage.getMonthlyVacationQuota('2026-11');
assert(quotaAfter1.used === 1, '신규 등록 후 쿼터 사용 1일');
assert(quotaAfter1.remaining === 1, '신규 등록 후 잔여 쿼터 1일');

const reg2 = storage.addVacation('2026-11-26', '2026-11-26', '가족 행사', new Date('2026-11-21T14:00:00'));
assert(reg2.success === true, '두 번째 1일 휴가 신규 등록 성공');

const quotaAfter2 = storage.getMonthlyVacationQuota('2026-11');
assert(quotaAfter2.used === 2, '쿼터 2일 모두 소진');
assert(quotaAfter2.remaining === 0, '잔여 쿼터 0일');

// 쿼터 초과 등록 시도 차단
const reg3 = storage.addVacation('2026-11-28', '2026-11-28', '추가 휴식', new Date('2026-11-21T14:00:00'));
assert(reg3.success === false, '쿼터 소진 후 추가 휴가 등록은 원천 차단됨');

// 1.6 JSON 백업 스키마 검증
const allData = storage.getAllData();
const exportedVacations = JSON.parse(allData.vacations);
const newVacObj = exportedVacations.find(v => v.startDate === '2026-11-24');
assert(newVacObj.date === '2026-11-24', 'JSON 백업: date 필드 정상 저장');
assert(!!newVacObj.reservedAt, 'JSON 백업: reservedAt 사전예약 타임스탬프 정상 저장');
assert(newVacObj.countsTowardQuota === true, 'JSON 백업: 신규 휴가는 countsTowardQuota: true');
const oldVacObj = exportedVacations.find(v => v.startDate === '2026-11-15');
assert(oldVacObj.countsTowardQuota === false, 'JSON 백업: 기존 휴가는 countsTowardQuota: false (소급 미적용)');

console.log('\n--- 2. 유연한 최저 방어 미션 배너 테스트 ---');

// -------------------------------------------------------------
// Test 2: 최저 방어선 배너 상태 검증
// -------------------------------------------------------------
const testDate = '2026-11-21';

// 2.1 오늘 복습 3개 중 1개 완료 -> defenseStatus: "none"
const mockLectures = [
  {
    id: 'lec_1',
    subject: '셈회',
    title: '원가관리',
    createdAt: '2026-11-14',
    reviews: [
      { id: 'rev_1_7', dayOffset: 7, targetDate: testDate, isCompleted: true, completedAt: '2026-11-21T10:00:00' },
      { id: 'rev_1_14', dayOffset: 14, targetDate: '2026-11-28', isCompleted: false }
    ]
  },
  {
    id: 'lec_2',
    subject: '행소',
    title: '행정심판',
    createdAt: '2026-11-17',
    reviews: [
      { id: 'rev_2_4', dayOffset: 4, targetDate: testDate, isCompleted: false, completedAt: null }
    ]
  }
];
localStorage.setItem('human_os_lectures_v1', JSON.stringify(mockLectures));

const statusPartial = storage.getDailyDefenseStatus(testDate);
assert(statusPartial.status === 'none', '복습 미완료 상태: defenseStatus는 none');
assert(statusPartial.isStep1Cleared === false, '1단계 최저 방어선 미달성');

// 2.2 오늘 복습 2개 모두 완료 -> defenseStatus: "review_cleared" (1단계 최저 방어선 돌파)
mockLectures[1].reviews[0].isCompleted = true;
mockLectures[1].reviews[0].completedAt = '2026-11-21T11:00:00';
localStorage.setItem('human_os_lectures_v1', JSON.stringify(mockLectures));

const statusStep1 = storage.getDailyDefenseStatus(testDate);
assert(statusStep1.status === 'review_cleared', '복습 100% 완료: defenseStatus는 review_cleared (최저 방어선 돌파)');
assert(statusStep1.isStep1Cleared === true, '1단계 최저 방어선 달성');
assert(statusStep1.isStep2Cleared === false, '2단계는 아직 미달성');

// dailyLogs에 defenseStatus 저장 확인
const dailyLogsStep1 = storage.getDailyLogs();
assert(dailyLogsStep1[testDate]?.defenseStatus === 'review_cleared', 'dailyLogs에 defenseStatus: review_cleared 저장됨');

// 2.3 오늘 새 강의 수강 + 1일차 복습 완료 -> defenseStatus: "full_cleared" (1·2단계 완전 정복)
const newTodayLecture = {
  id: 'lec_today',
  subject: '세법학',
  title: '국세기본법 1장',
  createdAt: testDate,
  reviews: [
    { id: 'rev_today_1', dayOffset: 1, targetDate: testDate, isCompleted: true, completedAt: '2026-11-21T14:00:00' }
  ]
};
mockLectures.push(newTodayLecture);
localStorage.setItem('human_os_lectures_v1', JSON.stringify(mockLectures));

const statusStep2 = storage.getDailyDefenseStatus(testDate);
assert(statusStep2.status === 'full_cleared', '새 강의 수강 + 1일차 복습 완료: defenseStatus는 full_cleared (오늘 목표 완전 정복)');
assert(statusStep2.isStep2Cleared === true, '2단계 정상 주행 달성');

const dailyLogsStep2 = storage.getDailyLogs();
assert(dailyLogsStep2[testDate]?.defenseStatus === 'full_cleared', 'dailyLogs에 defenseStatus: full_cleared 저장됨');

console.log('\n--- 3. 15분 서킷 브레이커 원클릭 타이머 테스트 ---');

// -------------------------------------------------------------
// Test 3: 15분 서킷 브레이커 세션 기록 검증
// -------------------------------------------------------------
// 3.1 서킷 브레이커 세션 기록 (isCircuitBreaker: true)
const cbSession = storage.logStudySession(
  testDate,
  'focus',
  '15:00',
  '15:15',
  15,
  '세법학',
  'review',
  'completed',
  true // isCircuitBreaker
);

assert(cbSession.isCircuitBreaker === true, '서킷 브레이커 세션 객체에 isCircuitBreaker: true 저장');
assert(cbSession.durationMins === 15, '정상 학습 시간 15분 기록');

// 3.2 일반 세션 기록 (isCircuitBreaker: false/생략)
const normalSession = storage.logStudySession(
  testDate,
  'focus',
  '15:30',
  '16:00',
  30,
  '세법학',
  'lecture',
  'completed'
);

assert(!normalSession.isCircuitBreaker, '일반 세션은 isCircuitBreaker 플래그 없음');

// 3.3 studySessions 전체 조회 시 플래그 유지 확인
const allSessions = storage.getDailySessions(testDate);
const foundCb = allSessions.find(s => s.id === cbSession.id);
assert(foundCb?.isCircuitBreaker === true, 'studySessions 로컬 스토리지에 isCircuitBreaker: true 정상 보존');

// -------------------------------------------------------------
// Test 4: 막힌 문제 보충슬롯 과거 날짜순(오래된 등록순) 정렬 검증
// -------------------------------------------------------------
console.log('\n--- 4. 막힌 문제 보충슬롯 과거 날짜순 정렬 테스트 ---');

store[STORAGE_KEYS.SUPPLEMENTARY_SLOTS] = JSON.stringify([
  { id: 'slot_3', title: '문제3 (오늘)', date: '2026-11-24', createdAt: '2026-11-24T10:00:00Z', isCompleted: false },
  { id: 'slot_1', title: '문제1 (가장 오래된 과거)', date: '2026-11-18', createdAt: '2026-11-18T09:00:00Z', isCompleted: false },
  { id: 'slot_2', title: '문제2 (중간 과거)', date: '2026-11-20', createdAt: '2026-11-20T14:00:00Z', isCompleted: false }
]);

const sortedSlots = storage.getSupplementarySlots();
assert(sortedSlots.length === 3, '보충 슬롯 3개 조회 성공');
assert(sortedSlots[0].id === 'slot_1', '가장 오래된 과거(11월 18일) 문제가 1번째로 정렬됨');
assert(sortedSlots[1].id === 'slot_2', '중간 과거(11월 20일) 문제가 2번째로 정렬됨');
assert(sortedSlots[2].id === 'slot_3', '최근 날짜(11월 24일) 문제가 3번째로 정렬됨');

console.log(`\n========================================`);
console.log(`테스트 결과: ${passed} 통과, ${failed} 실패`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 모든 기능 검증 100% 통과!');
}
