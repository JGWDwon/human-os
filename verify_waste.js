const path = require('path');

(async () => {
  global.localStorage = {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = v; },
    removeItem(k) { delete this._data[k]; }
  };

  const { pathToFileURL } = require('url');
  const storageModule = await import(pathToFileURL(path.resolve(__dirname, 'src/utils/storage.js')).href);
  const storage = storageModule.storage;
  storage._dispatchSync = () => {};

  const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];

  console.log('=== TEST: STUDY SESSION & TIME WASTE ANALYSIS ===');
  
  // 1. Log focus and pause sessions
  storage.logStudySession(todayStr, 'focus', '14:00', '14:25', 25);
  storage.logStudySession(todayStr, 'pause', '14:25', '14:35', 10);
  storage.logStudySession(todayStr, 'focus', '14:35', '15:00', 25);

  const timeline = storage.getDailySessionTimeline(todayStr);
  const slot14 = timeline.find(s => s.hour === 14);
  console.log('Hour 14 Slot:', slot14);

  // 2. Test Time Waste Analysis
  const analysis = storage.getTimeWasteAnalysis(7);
  console.log('Time Waste Analysis Summary:');
  console.log(`- Avg Daily Focus: ${analysis.avgDailyFocusMins} mins`);
  console.log(`- Avg Daily Waste: ${analysis.avgDailyWasteMins} mins`);
  console.log('Top 3 Idle Slots:', analysis.topIdleSlots);

  if (slot14.focusMins === 50 && slot14.pauseMins === 10) {
    console.log('\n✅ PASS: Study sessions and pause intervals recorded correctly!');
  } else {
    console.error('\n❌ FAIL: Session calculation mismatch!');
  }
})();
