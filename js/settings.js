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
  },
  stats: {
    iqrMultiplier: 1.5,          // IQR çarpanı (aykırı değer tespiti)
    movingAvgWindow: 5,          // Hareketli ortalama pencere boyutu
    histogramBins: 10,           // Histogram bin (aralık) sayısı
    modeRounding: 10,            // Mod yuvarlama hassasiyeti (ms)
    percentiles: [10, 25, 50, 75, 90], // Hesaplanacak yüzdelik dilimler
    trendThreshold: 0.10,        // Trend anlamlılık eşiği (R² min)
    defaultConfidence: 0.95,     // Güven düzeyi varsayılanı
    defaultErrorMargin: 0.05     // Hata payı varsayılanı
  }
  // Future categories: excel, ux
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
  },
  iqrMultiplier: {
    title: 'IQR Çarpanı',
    text: 'Aykırı değerleri tespit etmek için kullanılan Tukey IQR yöntemindeki çarpan katsayısıdır. Alt sınır = Q1 − k×IQR, üst sınır = Q3 + k×IQR şeklinde hesaplanır. Standart değer 1.5\'tir ve çoğu endüstriyel uygulamada iyi çalışır. Daha katı bir filtreleme için 1.0 veya 1.2 kullanılabilir; daha toleranslı bir yaklaşım için 2.0 veya 3.0 tercih edilebilir. Düşük çarpan daha fazla veriyi aykırı olarak işaretler, yüksek çarpan sadece aşırı sapmaları yakalar.'
  },
  movingAvgWindow: {
    title: 'Hareketli Ortalama Penceresi',
    text: 'Trend analizinde kullanılan hareketli ortalama hesaplamasının pencere boyutudur. Pencere, kaç ardışık ölçümün ortalamasının alınacağını belirler. Küçük pencere (2-3) değişimlere daha duyarlıdır ama gürültülü olabilir. Büyük pencere (7-10) daha pürüzsüz bir eğri çizer ama kısa süreli değişimleri maskeleyebilir. Varsayılan 5, çoğu zaman etüdü çalışması için dengeli bir seçimdir.'
  },
  histogramBins: {
    title: 'Histogram Bin Sayısı',
    text: 'Frekans dağılımı grafiğinde süre aralığının kaç eşit parçaya bölüneceğini belirler. Az bin (5-7) genel dağılım şeklini gösterir ama detayı kaybeder. Çok bin (20-30) ince ayrıntıları ortaya çıkarır ama az veriyle seyrek görünebilir. Varsayılan 10, 20-50 ölçüm için iyi bir dengedir. Çok sayıda ölçüm (100+) yapılıyorsa 15-20 arası denenebilir.'
  },
  modeRounding: {
    title: 'Mod Yuvarlama Hassasiyeti',
    text: 'En sık tekrarlanan süreyi (mod) bulmak için ölçüm süreleri bu hassasiyete yuvarlanarak gruplandırılır. Örneğin 10 ms seçildiğinde 1.234 sn ve 1.238 sn aynı gruba (1.230 sn) düşer. Küçük değerler (1-5 ms) daha hassas gruplar oluşturur ama az veriyle mod bulamayabilir. Büyük değerler (50-100 ms) daha geniş gruplar oluşturur ve mod bulmayı kolaylaştırır. Varsayılan 10 ms çoğu saha ölçümü için uygundur.'
  },
  percentiles: {
    title: 'Yüzdelik Dilim Setleri',
    text: 'İstatistik raporlarında ve Excel çıktısında hesaplanacak yüzdelik dilimleri seçin. P50 medyandır ve her zaman hesaplanır. P25 ve P75 çeyreklik sınırlarıdır (IQR hesabında kullanılır). P10 ve P90 uç değerlerin sınırlarını gösterir. P5 ve P95 daha aşırı uçları inceler. İhtiyacınıza göre birden fazla dilim seçebilirsiniz.'
  },
  trendThreshold: {
    title: 'Trend Eşik Değeri (R²)',
    text: 'Doğrusal regresyon analizinde trendin "anlamlı" sayılması için gereken minimum R² (determinasyon katsayısı) değeridir. R² değeri 0 ile 1 arasındadır; 1\'e yakınsa veriler doğrusal bir eğilim gösterir. Düşük eşik (0.05) zayıf trendleri bile raporlar; yüksek eşik (0.30-0.50) sadece güçlü eğilimleri gösterir. Varsayılan 0.10, endüstriyel zaman etütlerinde yaygın bir başlangıç değeridir.'
  },
  defaultConfidence: {
    title: 'Güven Düzeyi Varsayılanı',
    text: 'Yeni bir ölçüm başlatıldığında kurulum ekranında önceden seçili gelecek güven düzeyidir. %95 endüstri standardıdır ve çoğu zaman etüdü için yeterlidir. %90 daha az ölçüm gerektirir ama kesinlik azalır. %99 yüksek hassasiyet gerektiren kalite kontrol süreçleri için uygundur. Bu ayar sadece varsayılan seçimi belirler — her ölçüm başlangıcında değiştirilebilir.'
  },
  defaultErrorMargin: {
    title: 'Hata Payı Varsayılanı',
    text: 'Yeni bir ölçüm başlatıldığında kurulum ekranında önceden seçili gelecek hata payıdır. ±%5 standart zaman etütleri için en yaygın değerdir. ±%3 daha yüksek hassasiyet ister ve daha fazla ölçüm gerektirir. ±%10 hızlı bir ön etüt veya kaba tahmin için uygundur. Bu ayar gerekli ölçüm sayısı (n) hesaplamasını doğrudan etkiler — dar hata payı = daha fazla ölçüm gereksinimi.'
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

// Generate tempo values array centered on 100
export function buildTempoValues(min, max, step) {
  const values = [];
  for (let v = 100; v >= min; v -= step) values.push(v);
  for (let v = 100 + step; v <= max; v += step) values.push(v);
  values.sort((a, b) => b - a);
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
