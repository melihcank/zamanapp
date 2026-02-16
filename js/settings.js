// ===== SETTINGS MODULE =====

const STORAGE_KEY = 'zt_settings';

// Default settings (all categories)
const DEFAULTS = {
  measure: {
    tempoMin: 50,
    tempoMax: 150,
    tempoStep: 5,
    tempoDefault: 100,
    autoSaveInterval: 10000 // ms
  }
  // Future categories: stats, excel, ux
};

// Info texts for each setting (shown in info modal)
const INFO_TEXTS = {
  tempoRange: {
    title: 'Varsayılan Tempo Aralığı',
    text: 'Ölçüm sırasında kullanılabilecek tempo değerlerinin alt ve üst sınırını belirler. Tempo, gözlemlenen sürenin normal süreye dönüştürülmesinde kullanılan performans katsayısıdır (%). Farklı endüstriler farklı aralıklar kullanabilir — örneğin hassas montaj işlerinde 75-125 yeterli olabilirken, ağır sanayi işlemlerinde 50-150 gerekebilir. Adım değeri ise tempo seçicideki artış miktarını belirler (varsayılan 5).'
  },
  tempoDefault: {
    title: 'Varsayılan Tempo Değeri',
    text: 'Yeni bir ölçüm başlatıldığında tempo seçicinin hangi değerle açılacağını belirler. Tempo %100 demek operatörün "normal" hızda çalıştığı anlamına gelir. Deneyimli bir operatör izleniyorsa 110-120 gibi yüksek bir varsayılan, yeni bir operatör için 85-95 gibi düşük bir varsayılan uygun olabilir.'
  },
  autoSave: {
    title: 'Otomatik Kaydetme Sıklığı',
    text: 'Ölçüm sırasında sayfa kapanırsa veya tarayıcı çökerse verinin kaybolmaması için uygulama arka planda ölçüm durumunu periyodik olarak kaydeder. "5 sn" seçerseniz her 5 saniyede bir kaydedilir — veri kaybı riski en düşük ama cihaza daha sık yazma yapılır. "20 sn" daha az yazma yapar ama kapanma anında son 20 saniyedeki turlar kaybolabilir. "Her turda" ise zamanlayıcıdan bağımsız olarak her tur kaydedildiğinde tetiklenir.'
  }
};

// Load settings from localStorage
export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      // Deep merge with defaults (ensures new settings get default values)
      return deepMerge(DEFAULTS, saved);
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULTS));
}

// Save settings to localStorage
export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

// Get a specific setting value
export function getSetting(category, key) {
  const settings = loadSettings();
  return settings[category]?.[key] ?? DEFAULTS[category]?.[key];
}

// Set a specific setting value
export function setSetting(category, key, value) {
  const settings = loadSettings();
  if (!settings[category]) settings[category] = {};
  settings[category][key] = value;
  saveSettings(settings);
}

// Get info text for a setting
export function getInfoText(key) {
  return INFO_TEXTS[key] || { title: 'Bilgi', text: '' };
}

// Get default settings (for reset)
export function getDefaults(category) {
  return JSON.parse(JSON.stringify(DEFAULTS[category] || {}));
}

// Generate tempo values array from settings
export function buildTempoValues(min, max, step) {
  const values = [];
  for (let v = max; v >= min; v -= step) {
    values.push(v);
  }
  return values;
}

// Deep merge utility
function deepMerge(defaults, saved) {
  const result = JSON.parse(JSON.stringify(defaults));
  for (const cat in saved) {
    if (result[cat] && typeof result[cat] === 'object') {
      for (const key in saved[cat]) {
        if (key in result[cat]) {
          result[cat][key] = saved[cat][key];
        }
      }
    }
  }
  return result;
}
