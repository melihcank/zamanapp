// ===== TUTORIAL MODULE =====
// Yeniden tasarlanmış "Nasıl Kullanılır?" öğretici sistemi
// Dikey akış: Önce açıklama, sonra işaretlenmiş arayüz

import { $, vib } from './utils.js';

// Tutorial state
let currentStep = 0;
let tutorialActive = false;

// Örnek veriler
const EXAMPLE = {
  job: 'Montaj Hattı A - Vida Takma',
  op: 'Ahmet Yılmaz',
  laps: [
    { num: 1, t: 4230, tag: null, tempo: 100 },
    { num: 2, t: 3890, tag: null, tempo: 100 },
    { num: 3, t: 5120, tag: 0, tempo: 95, note: 'Malzeme beklendi' },
    { num: 4, t: 4010, tag: null, tempo: 100 },
    { num: 5, t: 3950, tag: null, tempo: 105 },
  ],
  tags: [
    { name: 'Bekleme', color: '#ffab00' },
    { name: 'Hurda', color: '#ff3d00' },
    { name: 'Arıza', color: '#aa00ff' },
    { name: 'Ayar', color: '#2979ff' }
  ]
};

// ============ TUTORIAL STEPS ============
const STEPS = [
  // STEP 1: Giriş
  {
    id: 'intro',
    title: 'Hoş Geldiniz!',
    content: `
      <p>Bu uygulama, <strong>zaman ölçümü</strong> sürecini hızlı ve odaklı bir şekilde yürütmenizi sağlar.</p>
      <div class="tut-features">
        <div class="tut-feature">
          <span class="tut-feature-icon">👆</span>
          <div class="tut-feature-text">
            <h4>Tek Dokunuşla Kayıt</h4>
            <p>Ekrana dokunarak anında tur kaydedin. Gözünüz işten ayrılmasın.</p>
          </div>
        </div>
        <div class="tut-feature">
          <span class="tut-feature-icon">🏷️</span>
          <div class="tut-feature-text">
            <h4>Hızlı Etiketleme</h4>
            <p>Bekleme, arıza gibi durumları tek tuşla işaretleyin.</p>
          </div>
        </div>
        <div class="tut-feature">
          <span class="tut-feature-icon">📊</span>
          <div class="tut-feature-text">
            <h4>Anında İstatistik</h4>
            <p>Ortalama, standart sapma, CV% otomatik hesaplanır.</p>
          </div>
        </div>
        <div class="tut-feature">
          <span class="tut-feature-icon">📱</span>
          <div class="tut-feature-text">
            <h4>Her Yerde Çalışır</h4>
            <p>Telefon, tablet veya bilgisayar. İnternet gerekmez.</p>
          </div>
        </div>
      </div>
    `,
    screen: 'none'
  },

  // STEP 2: Ana Menü
  {
    id: 'menu',
    title: 'Ana Menü',
    content: `
      <p>Uygulamanın giriş noktası. Üç temel işleme buradan ulaşırsınız:</p>
      <p><strong>Zaman Tut</strong> — Yeni ölçüm başlatır<br>
      <strong>Etiketleri Düzenle</strong> — Anomali etiketlerini özelleştirir<br>
      <strong>Geçmiş Veriler</strong> — Kayıtlı ölçümleri görüntüler</p>
      <div class="tut-callout tut-callout-tip">
        <span class="tut-callout-icon">💡</span>
        <span>Kurulum gerektirmez, açar açmaz ölçüme başlayabilirsiniz.</span>
      </div>
    `,
    screen: 'menu',
    highlight: '.menu-btns'
  },

  // STEP 3: Kronometre
  {
    id: 'timer',
    title: 'Kronometre ile Ölçüm',
    content: `
      <p>Ölçümün kalbi burasıdır. Çok basit çalışır:</p>
      <p><strong>İlk dokunuş</strong> — Kronometreyi başlatır<br>
      <strong>Sonraki dokunuşlar</strong> — Tur kaydeder ve sıfırlar</p>
      <p>İşçi işe başladığında dokunun, bitirdiğinde tekrar dokunun. Bu kadar!</p>
      <div class="tut-callout tut-callout-success">
        <span class="tut-callout-icon">✓</span>
        <span>Her kayıtta titreşim alırsınız — gözünüz ekranda olmasa da kaydedildiğini anlarsınız.</span>
      </div>
    `,
    screen: 'measure',
    highlight: '.timer-ring'
  },

  // STEP 4: Etiketler
  {
    id: 'tags',
    title: 'Anomali Etiketleri',
    content: `
      <p>Normal çalışma dışı durumları işaretleyin:</p>
      <p><strong>Bekleme</strong> — Malzeme, talimat beklemesi<br>
      <strong>Hurda</strong> — Hatalı parça, yeniden işleme<br>
      <strong>Arıza</strong> — Makine/ekipman sorunu<br>
      <strong>Ayar</strong> — Hazırlık, kalıp değişimi</p>
      <p>Etiketli tur kaydetmek için kronometreye değil, <strong>etiket butonuna</strong> dokunun.</p>
      <div class="tut-callout tut-callout-tip">
        <span class="tut-callout-icon">💡</span>
        <span>Etiketli turlar istatistiklerden hariç tutulabilir.</span>
      </div>
    `,
    screen: 'measure',
    highlight: '.tag-strip'
  },

  // STEP 5: Tempo
  {
    id: 'tempo',
    title: 'Tempo Değerlendirmesi',
    content: `
      <p>Çalışanın hızını değerlendirin:</p>
      <p><strong>%100</strong> — Normal, sürdürülebilir hız<br>
      <strong>%100+</strong> — Normalden hızlı çalışıyor<br>
      <strong>%100-</strong> — Normalden yavaş çalışıyor</p>
      <p>Bu değerlendirme ile <strong>"Normal Süre"</strong> hesaplanır ve gerçekçi standartlar elde edilir.</p>
      <div class="tut-callout tut-callout-tip">
        <span class="tut-callout-icon">💡</span>
        <span>Tekerleği kaydırarak veya +/- tuşlarıyla ayarlayın.</span>
      </div>
    `,
    screen: 'measure',
    highlight: '.tempo-picker'
  },

  // STEP 6: Tur Kartları ve Hareketler
  {
    id: 'laps',
    title: 'Kayıtları Yönetme',
    content: `
      <p>Her tur bir kart olarak listelenir. Kartlarla etkileşim:</p>
      <div class="tut-gestures">
        <div class="tut-gesture">
          <div class="tut-gesture-icon">👉</div>
          <div class="tut-gesture-text">
            <strong>Sağa Kaydır</strong>
            <span>Not ekle/düzenle</span>
          </div>
        </div>
        <div class="tut-gesture">
          <div class="tut-gesture-icon">👈</div>
          <div class="tut-gesture-text">
            <strong>Sola Kaydır</strong>
            <span>Turu sil</span>
          </div>
        </div>
        <div class="tut-gesture">
          <div class="tut-gesture-icon">👆</div>
          <div class="tut-gesture-text">
            <strong>Uzun Bas / Sağ Tık</strong>
            <span>Etiket değiştir</span>
          </div>
        </div>
      </div>
    `,
    screen: 'measure',
    highlight: '.lap-wrap'
  },

  // STEP 7: Klavye (PC)
  {
    id: 'keyboard',
    title: 'Klavye Kısayolları',
    content: `
      <p>Bilgisayarda hızlı çalışmak için:</p>
      <div class="tut-shortcuts">
        <div class="tut-shortcut"><kbd>Space</kbd> <span>Tur kaydet</span></div>
        <div class="tut-shortcut"><kbd>1-4</kbd> <span>Etiketli tur</span></div>
        <div class="tut-shortcut"><kbd>+</kbd><kbd>−</kbd> <span>Tempo</span></div>
        <div class="tut-shortcut"><kbd>P</kbd> <span>Duraklat</span></div>
        <div class="tut-shortcut"><kbd>N</kbd> <span>Not ekle</span></div>
        <div class="tut-shortcut"><kbd>Q</kbd> <span>Bitir</span></div>
      </div>
      <div class="tut-callout tut-callout-tip">
        <span class="tut-callout-icon">💡</span>
        <span>Video üzerinden ölçüm yapıyorsanız klavye kısayolları çok faydalı.</span>
      </div>
    `,
    screen: 'measure',
    highlight: '.kb-bar'
  },

  // STEP 8: Özet
  {
    id: 'summary',
    title: 'İstatistikler ve Rapor',
    content: `
      <p>Ölçüm bittiğinde otomatik hesaplanan değerler:</p>
      <div class="tut-stats">
        <div class="tut-stat"><span class="tut-stat-value">X̄</span><span class="tut-stat-label">Ortalama</span></div>
        <div class="tut-stat"><span class="tut-stat-value">σ</span><span class="tut-stat-label">Std Sapma</span></div>
        <div class="tut-stat"><span class="tut-stat-value">CV</span><span class="tut-stat-label">Değişkenlik</span></div>
      </div>
      <p><strong>Excel raporu</strong> ile tüm verileri profesyonel formatta dışa aktarabilirsiniz.</p>
      <div class="tut-callout tut-callout-warn">
        <span class="tut-callout-icon">⚠️</span>
        <span>CV% değeri %15'in üzerindeyse süreçte tutarsızlık var demektir.</span>
      </div>
    `,
    screen: 'summary',
    highlight: '.sum-compare'
  },

  // STEP 9: Kayıt ve Yedekleme
  {
    id: 'storage',
    title: 'Verileriniz Güvende',
    content: `
      <p>Uygulama verilerinizi otomatik korur:</p>
      <div class="tut-features">
        <div class="tut-feature">
          <span class="tut-feature-icon">💾</span>
          <div class="tut-feature-text">
            <h4>Anlık Kayıt</h4>
            <p>Her tur kaydedildiğinde otomatik yedeklenir.</p>
          </div>
        </div>
        <div class="tut-feature">
          <span class="tut-feature-icon">🔄</span>
          <div class="tut-feature-text">
            <h4>Kurtarma</h4>
            <p>Uygulama kapansa bile yarım kalan ölçümü devam ettirin.</p>
          </div>
        </div>
        <div class="tut-feature">
          <span class="tut-feature-icon">📦</span>
          <div class="tut-feature-text">
            <h4>JSON Yedekleme</h4>
            <p>Tüm verilerinizi tek dosyada yedekleyin, aktarın.</p>
          </div>
        </div>
      </div>
    `,
    screen: 'history',
    highlight: '.hi-toolbar'
  },

  // STEP 10: Bitiş
  {
    id: 'finish',
    title: 'Hazırsınız!',
    content: `
      <div class="tut-finish">
        <div class="tut-finish-icon">🎯</div>
        <h2>Kullanmaya Başlayın</h2>
        <p>Ana menüden "Zaman Tut" butonuna dokunarak ilk ölçümünüzü başlatabilirsiniz.</p>
        <div class="tut-finish-summary">
          <div class="tut-finish-item"><span>👆</span> Dokun = Kaydet</div>
          <div class="tut-finish-item"><span>🏷️</span> Etiketle</div>
          <div class="tut-finish-item"><span>📊</span> Analiz et</div>
          <div class="tut-finish-item"><span>📋</span> Raporla</div>
        </div>
      </div>
    `,
    screen: 'none'
  }
];

// ============ SCREEN TEMPLATES ============
function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const cs = Math.floor((ms % 1000) / 10);
  return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') + '.' + String(cs).padStart(2, '0');
}

function getMenuHTML() {
  return `
    <div class="tut-screen-content">
      <div class="menu-logo"><svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/></svg></div>
      <div class="menu-title">Zaman Etüdü</div>
      <div class="menu-sub">Saha Kronometresi</div>
      <div class="menu-btns">
        <button class="menu-btn menu-btn-primary"><svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/></svg>Zaman Tut</button>
        <button class="menu-btn menu-btn-secondary"><svg viewBox="0 0 24 24"><path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/></svg>Etiketleri Düzenle</button>
        <button class="menu-btn menu-btn-secondary"><svg viewBox="0 0 24 24"><path d="M13 3a9 9 0 00-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0013 21a9 9 0 000-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>Geçmiş Veriler</button>
      </div>
    </div>
  `;
}

function getMeasureHTML() {
  const tagsHTML = EXAMPLE.tags.map(t => `
    <button class="tag-btn" style="background:${t.color}">
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/></svg>
      ${t.name}
    </button>
  `).join('');

  const lapsHTML = EXAMPLE.laps.map(l => {
    const tag = l.tag !== null ? EXAMPLE.tags[l.tag] : null;
    const tagBadge = tag ? `<span class="lap-badge" style="background:rgba(255,171,0,0.15);color:${tag.color}">${tag.name}</span>` : '';
    const tempoBadge = l.tempo !== 100 ? `<span class="lap-tempo ${l.tempo < 100 ? 'tempo-slow' : 'tempo-fast'}">%${l.tempo}</span>` : '';
    const noteHTML = l.note ? `<div class="lap-note">${l.note}</div>` : '';

    return `
      <div class="lap-card">
        <div class="lap-cc">
          <div class="lap-stripe" style="background:${tag ? tag.color : '#555'}"></div>
          <div class="lap-num">#${l.num}</div>
          <div class="lap-info">
            <div class="lap-info-top">
              <span class="lap-tm">${formatTime(l.t)}</span>
              ${tempoBadge}
              ${tagBadge}
            </div>
            ${noteHTML}
          </div>
        </div>
      </div>
    `;
  }).reverse().join('');

  return `
    <div class="tut-screen-content tut-measure">
      <div class="top-bar">
        <div class="top-bar-info">
          <div class="job-name">${EXAMPLE.job}</div>
          <div class="op-name">${EXAMPLE.op}</div>
        </div>
        <div class="top-bar-acts">
          <button class="btn-ic" title="Duraklat"><svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg></button>
          <button class="btn-ic" title="Not"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h5v7h7v9H6z"/></svg></button>
          <button class="btn-ic danger" title="Bitir"><svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg></button>
        </div>
      </div>
      <div class="tag-strip" style="display:grid;grid-template-columns:1fr 1fr">${tagsHTML}</div>
      <div class="timer-area running">
        <div class="timer-tempo-wrap">
          <div class="timer-ring">
            <svg class="timer-ring-svg" viewBox="0 0 200 200">
              <circle class="ring-bg" cx="100" cy="100" r="90"/>
              <circle class="ring-prog" cx="100" cy="100" r="90" style="stroke-dashoffset:282.74"/>
            </svg>
            <div class="timer-display">
              <div class="timer-time">00:21</div>
              <div class="timer-ms">.20</div>
              <div class="timer-st">Çalışıyor</div>
            </div>
          </div>
          <div class="tempo-picker">
            <div class="tempo-picker-label">Tempo %</div>
            <div class="tempo-wheel">
              <div class="tempo-items" style="transform:translateY(0)">
                <div class="tempo-item ti-1">110</div>
                <div class="tempo-item ti-2">105</div>
                <div class="tempo-item ti-active">100</div>
                <div class="tempo-item ti-2">95</div>
                <div class="tempo-item ti-1">90</div>
              </div>
            </div>
          </div>
        </div>
        <div class="tap-hint">Ekrana dokun = Tur kaydet</div>
        <div class="lap-ctr" style="display:flex">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"/></svg>
          <span class="cnt">${EXAMPLE.laps.length}</span> tur
        </div>
      </div>
      <div class="lap-wrap"><div class="lap-list">${lapsHTML}</div></div>
      <div class="kb-bar">
        <span><kbd>Space</kbd> Tur</span>
        <span><kbd>1-4</kbd> Etiketli</span>
        <span><kbd>P</kbd> Duraklat</span>
      </div>
    </div>
  `;
}

function getSummaryHTML() {
  return `
    <div class="tut-screen-content tut-summary">
      <div class="sum-hdr">
        <h2>Ölçüm Tamamlandı</h2>
        <p>${EXAMPLE.job}</p>
        <div class="sum-action-bar">
          <button class="sum-action-btn sab-excel"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>Excel</button>
          <button class="sum-action-btn sab-resume"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Devam</button>
          <button class="sum-action-btn sab-back"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>Menü</button>
        </div>
      </div>
      <div class="sum-compare">
        <div class="sum-compare-header">
          <span class="sch-n">5</span>
          <span class="sch-label">Gözlem</span>
          <span class="sch-req ok">Gerekli: 4 ✓</span>
        </div>
        <table class="sum-compare-table">
          <tbody>
            <tr><td>Ortalama</td><td>00:04.24</td></tr>
            <tr><td>Medyan</td><td>00:04.01</td></tr>
            <tr><td>Std Sapma</td><td>00:00.49</td></tr>
            <tr><td>CV%</td><td>11.6%</td></tr>
            <tr class="sct-highlight"><td>Saatlik Üretim</td><td>849</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function getHistoryHTML() {
  return `
    <div class="tut-screen-content tut-history">
      <div class="hi-header">
        <button class="te-back"><svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg></button>
        <h2>Geçmiş Veriler</h2>
      </div>
      <div class="hi-toolbar">
        <button class="btn-export btn-jn"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>JSON Yedekle</button>
        <button class="btn-export btn-jn-outline"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>İçe Aktar</button>
      </div>
      <div class="hi-card">
        <div class="hi-card-top">
          <span class="hi-job">${EXAMPLE.job}</span>
          <span class="hi-date">04.02.2026</span>
        </div>
        <div class="hi-card-row">${EXAMPLE.op} · 5 tur · Ort: 00:04.24</div>
      </div>
      <div class="hi-card">
        <div class="hi-card-top">
          <span class="hi-job">Paketleme İstasyonu</span>
          <span class="hi-date">03.02.2026</span>
        </div>
        <div class="hi-card-row">Mehmet Kaya · 12 tur · Ort: 00:06.82</div>
      </div>
    </div>
  `;
}

function getScreenHTML(screen) {
  switch (screen) {
    case 'menu': return getMenuHTML();
    case 'measure': return getMeasureHTML();
    case 'summary': return getSummaryHTML();
    case 'history': return getHistoryHTML();
    default: return '';
  }
}

function getScreenLabel(screen) {
  const labels = {
    menu: 'Ana Menü',
    measure: 'Ölçüm Ekranı',
    summary: 'Özet Ekranı',
    history: 'Geçmiş Veriler'
  };
  return labels[screen] || '';
}

// ============ RENDER ============
function renderStep(stepIndex) {
  const step = STEPS[stepIndex];
  if (!step) return;

  const container = $('tutorialContainer');
  const main = container.querySelector('.tut-main');
  const progress = container.querySelector('.tut-progress-fill');
  const stepCounter = container.querySelector('.tut-step-counter');

  // Update progress
  const progressPercent = ((stepIndex + 1) / STEPS.length) * 100;
  progress.style.width = progressPercent + '%';
  stepCounter.textContent = `${stepIndex + 1} / ${STEPS.length}`;

  // Build main content
  let html = `
    <div class="tut-info-panel">
      <div class="tut-info-title">${step.title}</div>
      <div class="tut-info-content">${step.content}</div>
    </div>
  `;

  // Add screen area if needed
  if (step.screen !== 'none') {
    html += `
      <div class="tut-screen-area">
        <div class="tut-screen-label">
          <svg viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg>
          ${getScreenLabel(step.screen)}
        </div>
        ${getScreenHTML(step.screen)}
      </div>
    `;
  }

  main.innerHTML = html;

  // Apply highlight
  if (step.highlight && step.screen !== 'none') {
    const screenArea = main.querySelector('.tut-screen-area');
    if (screenArea) {
      const target = screenArea.querySelector(step.highlight);
      if (target) {
        target.classList.add('tut-highlighted');
      }
    }
  }

  // Update button states
  const prevBtn = container.querySelector('.tut-btn-prev');
  const nextBtn = container.querySelector('.tut-btn-next');

  prevBtn.disabled = stepIndex === 0;

  if (stepIndex === STEPS.length - 1) {
    nextBtn.innerHTML = '<span>Bitir</span><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
  } else {
    nextBtn.innerHTML = '<span>İleri</span><svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';
  }

  // Scroll to top
  main.scrollTop = 0;
}

// ============ NAVIGATION ============
function bindButton(id, handler) {
  const btn = $(id);
  if (!btn) return;

  let handled = false;

  btn.addEventListener('touchend', e => {
    e.preventDefault();
    e.stopPropagation();
    if (handled) return;
    handled = true;
    setTimeout(() => handled = false, 400);
    handler();
  }, { passive: false });

  btn.addEventListener('click', e => {
    if (handled) return;
    e.stopPropagation();
    handler();
  });
}

function nextStep() {
  if (currentStep < STEPS.length - 1) {
    currentStep++;
    renderStep(currentStep);
    vib(10);
  } else {
    closeTutorial();
  }
}

function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    renderStep(currentStep);
    vib(10);
  }
}

function handleKeydown(e) {
  if (!tutorialActive) return;

  if (e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault();
    nextStep();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prevStep();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closeTutorial();
  }
}

// ============ START / CLOSE ============
export function startTutorial() {
  currentStep = 0;
  tutorialActive = true;

  const container = document.createElement('div');
  container.id = 'tutorialContainer';
  container.className = 'tutorial-overlay';
  container.innerHTML = `
    <div class="tut-header">
      <div class="tut-header-left">
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/></svg>
        <span>Nasıl Kullanılır?</span>
      </div>
      <button class="tut-close" id="tutClose">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
      </button>
    </div>
    <div class="tut-progress">
      <div class="tut-progress-fill"></div>
    </div>
    <div class="tut-main"></div>
    <div class="tut-footer">
      <button class="tut-btn tut-btn-skip" id="tutSkip">Atla</button>
      <div class="tut-nav">
        <button class="tut-btn tut-btn-prev" id="tutPrev">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59z"/></svg>
          <span>Geri</span>
        </button>
        <span class="tut-step-counter">1 / ${STEPS.length}</span>
        <button class="tut-btn tut-btn-next" id="tutNext">
          <span>İleri</span>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  bindButton('tutClose', closeTutorial);
  bindButton('tutSkip', closeTutorial);
  bindButton('tutPrev', prevStep);
  bindButton('tutNext', nextStep);

  document.addEventListener('keydown', handleKeydown);

  setTimeout(() => {
    container.classList.add('open');
    renderStep(0);
  }, 50);

  vib(20);
}

export function closeTutorial() {
  tutorialActive = false;
  const container = $('tutorialContainer');
  if (container) {
    container.classList.remove('open');
    setTimeout(() => container.remove(), 300);
  }
  document.removeEventListener('keydown', handleKeydown);
}

export function initTutorial() {
  const tutBtn = $('goTutorial');
  if (tutBtn) {
    let handled = false;

    tutBtn.addEventListener('touchend', e => {
      e.preventDefault();
      e.stopPropagation();
      if (handled) return;
      handled = true;
      setTimeout(() => handled = false, 400);
      startTutorial();
    }, { passive: false });

    tutBtn.addEventListener('click', e => {
      if (handled) return;
      e.stopPropagation();
      startTutorial();
    });
  }
}
