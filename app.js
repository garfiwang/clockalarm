/**
 * Premium Timer - 倒數計時器核心邏輯
 */

// ==========================================================================
// 狀態管理 (State Management)
// ==========================================================================
let totalSeconds = 15 * 60;       // 預設倒數總秒數 (15分鐘)
let remainingSeconds = 15 * 60;   // 剩餘秒數
let timerState = 'ready';         // 'ready' | 'running' | 'paused' | 'finished'
let timerInterval = null;         // setInterval 參考
let expectedEndTime = null;       // 預計結束時間戳 (用於防止時間漂移)
let originalDocumentTitle = document.title;

// 音訊相關狀態
let audioCtx = null;
let alarmInterval = null;         // 鬧鐘聲音重複播放的定時器
let isMuted = false;
let savedVolume = 80;             // 預設音量 80%

// SVG 圓環參數 (在 CSS 中對應 stroke-dasharray="596.9")
const CIRCUMFERENCE = 596.9;

// ==========================================================================
// DOM 元素選取
// ==========================================================================
const timerTimeEl = document.getElementById('timer-time');
const timerStateEl = document.getElementById('timer-state');
const progressBarEl = document.getElementById('progress-bar');

const btnPlayPause = document.getElementById('btn-play-pause');
const playPauseText = document.getElementById('play-pause-text');
const btnReset = document.getElementById('btn-reset');

const presetButtons = document.querySelectorAll('.preset-btn');
const timeSlider = document.getElementById('time-slider');
const sliderVal = document.getElementById('slider-val');

const inputMin = document.getElementById('input-min');
const inputSec = document.getElementById('input-sec');
const btnApplyCustom = document.getElementById('btn-apply-custom');

const soundSelect = document.getElementById('sound-select');
const btnTestSound = document.getElementById('btn-test-sound');
const btnMute = document.getElementById('btn-mute');
const volumeSlider = document.getElementById('volume-slider');
const volumeVal = document.getElementById('volume-val');

const themeToggleBtn = document.getElementById('theme-toggle');
const btnFullscreenToggle = document.getElementById('fullscreen-toggle');
const btnNotificationToggle = document.getElementById('btn-notification-toggle');

// ==========================================================================
// 初始化設置 (Initialization)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  loadPreferences();
  updateUI();
  initNotificationUI();
});

// 讀取 LocalStorage 中的使用者偏好
function loadPreferences() {
  // 讀取主題 (預設淺色：白底黑字紅字；切換深色)
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme'); // 預設為淺色模式
  }

  // 讀取音量與靜音狀態
  const localVolume = localStorage.getItem('volume');
  if (localVolume !== null) {
    savedVolume = parseInt(localVolume, 10);
    volumeSlider.value = savedVolume;
    volumeVal.textContent = `${savedVolume}%`;
  }
  
  const localMuted = localStorage.getItem('muted');
  if (localMuted === 'true') {
    isMuted = true;
    document.body.classList.add('audio-muted');
  }

  // 讀取上次設定的計時器分鐘數
  const savedMinutes = localStorage.getItem('timerMinutes');
  if (savedMinutes !== null) {
    const mins = parseInt(savedMinutes, 10);
    totalSeconds = mins * 60;
    remainingSeconds = totalSeconds;
    
    // 更新設定區的 UI
    timeSlider.value = mins;
    sliderVal.textContent = `${mins} 分鐘`;
    inputMin.value = mins;
    inputSec.value = 0;
    
    // 更新快捷按鈕 active 狀態
    presetButtons.forEach(btn => {
      if (parseInt(btn.dataset.minutes, 10) === mins) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // 讀取上次選擇的提醒音效
  const savedSound = localStorage.getItem('alarmSound');
  if (savedSound !== null) {
    soundSelect.value = savedSound;
  }
}

// 保存偏好設定
function savePreference(key, value) {
  localStorage.setItem(key, value);
}

// ==========================================================================
// 計時核心邏輯 (Timer Core Logic)
// ==========================================================================

function startTimer() {
  if (timerState === 'running') return;

  // 懶加載初始化音訊內容 (瀏覽器要求使用者互動後才能發聲)
  initAudioContext();

  // 計算精準的預計結束時間戳 (當前時間 + 剩餘毫秒數)
  expectedEndTime = Date.now() + remainingSeconds * 1000;
  timerState = 'running';
  
  document.body.classList.remove('timer-paused', 'timer-finished');
  document.body.classList.add('timer-running');
  
  updateUIControls();

  // 開始循環 Tick
  timerInterval = setInterval(tick, 100); // 每 100 毫秒檢查一次，確保精準且更新順暢
}

function pauseTimer() {
  if (timerState !== 'running') return;

  // 停止 Tick 循環
  clearInterval(timerInterval);
  timerInterval = null;

  // 計算並儲存實際剩餘的秒數 (利用系統時鐘比對以防誤差)
  remainingSeconds = Math.max(0, Math.ceil((expectedEndTime - Date.now()) / 1000));
  timerState = 'paused';
  
  document.body.classList.remove('timer-running', 'timer-finished');
  document.body.classList.add('timer-paused');
  
  updateUIControls();
  updateUI();
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  stopAlarm();

  remainingSeconds = totalSeconds;
  timerState = 'ready';
  
  document.body.classList.remove('timer-running', 'timer-paused', 'timer-finished');
  document.title = originalDocumentTitle;
  
  updateUIControls();
  updateUI();
}

// 核心計時 Tick
function tick() {
  const now = Date.now();
  const diff = expectedEndTime - now;

  if (diff <= 0) {
    // 倒數結束！
    remainingSeconds = 0;
    timerState = 'finished';
    
    clearInterval(timerInterval);
    timerInterval = null;
    
    document.body.classList.remove('timer-running', 'timer-paused');
    document.body.classList.add('timer-finished');
    
    updateUIControls();
    updateUI();
    
    // 觸發鬧鈴與通知
    triggerAlarm();
  } else {
    // 更新剩餘秒數
    remainingSeconds = Math.ceil(diff / 1000);
    updateUI();
  }
}

// ==========================================================================
// UI 更新輔助 (UI Updates)
// ==========================================================================

function updateUI() {
  // 1. 格式化時間 (MM:SS)
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  
  timerTimeEl.textContent = timeStr;

  // 2. 更新網頁 Tab 標題
  if (timerState === 'running') {
    document.title = `(${timeStr}) Premium Timer`;
    timerStateEl.textContent = '倒數中...';
  } else if (timerState === 'paused') {
    document.title = `[已暫停] ${timeStr}`;
    timerStateEl.textContent = '計時已暫停';
  } else if (timerState === 'finished') {
    document.title = `⏰ 時間到！ - Premium Timer`;
    timerStateEl.textContent = '計時結束！';
  } else {
    document.title = originalDocumentTitle;
    timerStateEl.textContent = '準備就緒';
  }

  // 3. 更新 SVG 圓環進度條
  // 剩餘比例 (從 1 降到 0)
  const ratio = totalSeconds > 0 ? remainingSeconds / totalSeconds : 0;
  // dashoffset 為 0 時是全滿，為 CIRCUMFERENCE 時是全空
  const offset = CIRCUMFERENCE * (1 - ratio);
  progressBarEl.style.strokeDashoffset = offset;
}

// 根據目前狀態更新控制按鈕文字與 icon
function updateUIControls() {
  if (timerState === 'running') {
    playPauseText.textContent = '暫停';
    btnPlayPause.setAttribute('aria-label', '暫停倒數');
  } else {
    playPauseText.textContent = '開始';
    btnPlayPause.setAttribute('aria-label', '開始倒數');
  }
}

// ==========================================================================
// Web Audio API 鬧鐘聲音合成 (Synthesizer Alarm)
// ==========================================================================

// 初始化 AudioContext 實例
function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// 獲取目前音量大小 (調配為較舒適的輸出音量，最大為 0.25)
function getTargetVolume() {
  if (isMuted) return 0;
  return (savedVolume / 100) * 0.25;
}

// 觸發時間到鬧鈴
function triggerAlarm() {
  // 1. 播放聲音
  startAlarm();
  // 2. 送出瀏覽器通知
  sendDesktopNotification();
}

// 開始循環播放鬧鈴
function startAlarm() {
  stopAlarm(); // 確保不會有重複的鬧鈴定時器
  initAudioContext();
  
  const soundType = soundSelect.value;
  if (soundType === 'none') return;

  // 根據選擇的音效設定重複播放間隔
  let intervalMs = 2000;
  if (soundType === 'digital') intervalMs = 1500;
  if (soundType === 'chime') intervalMs = 3000;
  if (soundType === 'retro') intervalMs = 1000;

  // 立即播放第一次
  playAlarm(soundType);

  // 設定重複播放
  alarmInterval = setInterval(() => {
    playAlarm(soundType);
  }, intervalMs);
}

// 停止鬧鈴播放
function stopAlarm() {
  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }
}

// 合成特定音效的一段聲音
function playAlarm(type) {
  if (!audioCtx || isMuted || type === 'none') return;
  
  const volume = getTargetVolume();

  if (type === 'digital') {
    // 經典電子鬧鐘：雙嗶聲 (Beep-Beep)
    const now = audioCtx.currentTime;
    playBeepTone(880, 0.1, volume, now);
    playBeepTone(880, 0.1, volume, now + 0.2);
  } 
  else if (type === 'chime') {
    // 優雅和弦風鈴：C5, E5, G5, C6 疊加，長衰減
    const now = audioCtx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    freqs.forEach((freq, index) => {
      // 稍微錯開每顆音，創造琶音/風鈴撥動的空間感
      playChimeTone(freq, 2.0, volume / 4, now + index * 0.08);
    });
  } 
  else if (type === 'retro') {
    // 復古警報：頻率隨時間上下掃描 (Frequency Sweep)
    playRetroSiren(volume);
  }
}

// 合成單一嗶聲
function playBeepTone(freq, duration, volume, startTime) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);

  // 設置起音 (attack) 與釋音 (release) 避免爆音
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.setValueAtTime(volume, startTime + duration - 0.01);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

// 合成風鈴和弦單音 (指數型衰減)
function playChimeTone(freq, duration, volume, startTime) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);

  // 指數漸弱包絡線
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

// 合成復古警報音 (使用變頻器 LFO 概念調變頻率)
function playRetroSiren(volume) {
  const now = audioCtx.currentTime;
  const duration = 0.8;
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.type = 'triangle'; // 復古電子音常用三角波或方波
  
  // 頻率在一秒內從 400Hz 線性上升到 1000Hz，再降回 400Hz
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.linearRampToValueAtTime(1000, now + duration * 0.5);
  osc.frequency.linearRampToValueAtTime(400, now + duration);

  // 音量淡入淡出
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + 0.05);
  gain.gain.setValueAtTime(volume, now + duration - 0.05);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  osc.start(now);
  osc.stop(now + duration);
}

// ==========================================================================
// 互動 UI 事件綁定 (Event Listeners)
// ==========================================================================

// Play / Pause 按鈕
btnPlayPause.addEventListener('click', () => {
  if (timerState === 'running') {
    pauseTimer();
  } else {
    startTimer();
  }
});

// Reset 按鈕
btnReset.addEventListener('click', resetTimer);

// 快速預設時間快捷鍵
presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    // 只有在非運行狀態下，或重置後才能直接切換時間
    if (timerState === 'running') {
      const confirmChange = confirm('計時器正在運行中，要重新設定並重設計時嗎？');
      if (!confirmChange) return;
    }
    
    presetButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const mins = parseInt(btn.dataset.minutes, 10);
    totalSeconds = mins * 60;
    
    // 同步更新自訂 slider 與 number input
    timeSlider.value = mins;
    sliderVal.textContent = `${mins} 分鐘`;
    inputMin.value = mins;
    inputSec.value = 0;
    
    savePreference('timerMinutes', mins);
    resetTimer();
  });
});

// 自訂時間 Slider 拖動
timeSlider.addEventListener('input', (e) => {
  const mins = parseInt(e.target.value, 10);
  sliderVal.textContent = `${mins} 分鐘`;
  
  // 同步更新 number input
  inputMin.value = mins;
  inputSec.value = 0;
  
  // 移除預設快捷按鈕 active 樣式 (若沒有剛好配對的話)
  presetButtons.forEach(btn => {
    if (parseInt(btn.dataset.minutes, 10) === mins) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
});

// 自訂時間 Slider 拖動結束 (放開滑鼠時才更新並重置計時器，防抖動)
timeSlider.addEventListener('change', (e) => {
  const mins = parseInt(e.target.value, 10);
  totalSeconds = mins * 60;
  savePreference('timerMinutes', mins);
  resetTimer();
});

// 點擊「套用自訂時間」按鈕
btnApplyCustom.addEventListener('click', () => {
  const mins = parseInt(inputMin.value, 10) || 0;
  const secs = parseInt(inputSec.value, 10) || 0;
  
  const calcTotal = mins * 60 + secs;
  if (calcTotal <= 0) {
    alert('時間必須大於 0 秒！');
    return;
  }
  
  if (timerState === 'running') {
    const confirmChange = confirm('計時器正在運行中，確定要套用新時間並重設計時嗎？');
    if (!confirmChange) return;
  }

  totalSeconds = calcTotal;
  savePreference('timerMinutes', mins); // 儲存主要分鐘數
  
  // 更新 slider 位置 (若大於 slider 上限則設為 max)
  timeSlider.value = Math.min(mins, parseInt(timeSlider.max, 10));
  sliderVal.textContent = `${inputMin.value} 分鐘`;
  
  // 檢查是否符合 preset
  presetButtons.forEach(btn => {
    if (parseInt(btn.dataset.minutes, 10) === mins && secs === 0) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  resetTimer();
});

// 提醒音效下拉選單變更
soundSelect.addEventListener('change', (e) => {
  savePreference('alarmSound', e.target.value);
  // 如果正在鬧鈴，即時切換新聲音播放
  if (timerState === 'finished') {
    startAlarm();
  }
});

// 測試音效按鈕
btnTestSound.addEventListener('click', () => {
  initAudioContext();
  const soundType = soundSelect.value;
  if (soundType === 'none') {
    alert('目前選擇的是「靜音」，請選擇其他音效再測試！');
    return;
  }
  // 播放一次音效
  playAlarm(soundType);
});

// 靜音按鈕
btnMute.addEventListener('click', () => {
  isMuted = !isMuted;
  if (isMuted) {
    document.body.classList.add('audio-muted');
    savePreference('muted', 'true');
  } else {
    document.body.classList.remove('audio-muted');
    savePreference('muted', 'false');
    // 如果解靜音時已經倒數結束，立即發聲
    if (timerState === 'finished') {
      startAlarm();
    }
  }
});

// 音量滑桿調整
volumeSlider.addEventListener('input', (e) => {
  savedVolume = parseInt(e.target.value, 10);
  volumeVal.textContent = `${savedVolume}%`;
  savePreference('volume', savedVolume);
  
  // 調整音量時若原本是靜音，自動解除靜音
  if (isMuted && savedVolume > 0) {
    isMuted = false;
    document.body.classList.remove('audio-muted');
    savePreference('muted', 'false');
  }
});

// 主題切換按鈕
themeToggleBtn.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark-theme');
  savePreference('theme', isDark ? 'dark' : 'light');
});

// 全螢幕切換按鈕
btnFullscreenToggle.addEventListener('click', () => {
  toggleFullscreen();
});

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
      .then(() => {
        document.body.classList.add('fullscreen-active');
      })
      .catch(err => {
        alert(`無法進入全螢幕模式：${err.message}`);
      });
  } else {
    document.exitFullscreen();
  }
}

// 監聽全螢幕狀態變化 (處理使用者按 Esc 退出全螢幕)
document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) {
    document.body.classList.add('fullscreen-active');
  } else {
    document.body.classList.remove('fullscreen-active');
  }
});

// ==========================================================================
// 瀏覽器桌面通知功能 (Notification API)
// ==========================================================================

function initNotificationUI() {
  if (!('Notification' in window)) {
    // 瀏覽器不支援通知
    btnNotificationToggle.style.display = 'none';
    return;
  }

  updateNotificationButtonState();

  btnNotificationToggle.addEventListener('click', () => {
    if (Notification.permission === 'default') {
      // 請求權限
      Notification.requestPermission().then(() => {
        updateNotificationButtonState();
      });
    } else if (Notification.permission === 'granted') {
      alert('已啟用桌面通知權限！時間到時將發送桌面通知。');
    } else if (Notification.permission === 'denied') {
      alert('桌面通知權限已被拒絕。請至瀏覽器設定中解鎖此網站的通知權限，才能正常使用。');
    }
  });
}

function updateNotificationButtonState() {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    btnNotificationToggle.textContent = '已啟用通知';
    btnNotificationToggle.classList.remove('btn-secondary');
    btnNotificationToggle.style.background = 'var(--color-success)';
    btnNotificationToggle.style.color = '#ffffff';
    btnNotificationToggle.style.borderColor = 'transparent';
  } else if (Notification.permission === 'denied') {
    btnNotificationToggle.textContent = '通知已被封鎖';
    btnNotificationToggle.classList.add('btn-secondary');
    btnNotificationToggle.style.background = '';
    btnNotificationToggle.style.color = '';
    btnNotificationToggle.style.borderColor = '';
  } else {
    btnNotificationToggle.textContent = '請求權限';
    btnNotificationToggle.classList.add('btn-secondary');
    btnNotificationToggle.style.background = '';
    btnNotificationToggle.style.color = '';
    btnNotificationToggle.style.borderColor = '';
  }
}

function sendDesktopNotification() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const title = "⏰ 時間到囉！";
  const options = {
    body: "設定的倒數計時已結束，提醒您該休息或進行下一步囉！",
    requireInteraction: true // 通知會一直停留在畫面上直到使用者點擊
  };

  try {
    const notification = new Notification(title, options);
    
    // 點擊通知時自動回到當前網頁視窗
    notification.onclick = () => {
      window.focus();
      notification.close();
      resetTimer(); // 點擊通知自動停止聲音並重置計時
    };
  } catch (err) {
    console.error("發送通知時出錯：", err);
  }
}
