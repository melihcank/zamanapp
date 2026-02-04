// ===== TUTORIAL MODULE =====
// Profesyonel "Nasıl Kullanılır?" öğretici sistemi

import { $, vib } from './utils.js';

// Tutorial state
let currentStep = 0;
let tutorialActive = false;

// Örnek veriler
const EXAMPLE_DATA = {
  job: 'Montaj Hattı A - Vida Takma',
  op: 'Ahmet Yılmaz',
  laps: [
    { num: 1, t: 4230, cum: 4230, tag: null, tempo: 100, note: '' },
    { num: 2, t: 3890, cum: 8120, tag: null, tempo: 100, note: '' },
    { num: 3, t: 5120, cum: 13240, tag: 0, tempo: 95, note: 'Malzeme beklendi' },
    { num: 4, t: 4010, cum: 17250, tag: null, tempo: 100, note: '' },
    { num: 5, t: 3950, cum: 21200, tag: null, tempo: 105, note: '' },
  ],
  tags: [
    { name: 'Bekleme', color: '#ffab00', icon: 'clock' },
    { name: 'Hurda', color: '#ff3d00', icon: 'warn' },
    { name: 'Arıza', color: '#aa00ff', icon: 'tool' },
    { name: 'Ayar', color: '#2979ff', icon: 'gear' }
  ],
  sequenceSteps: [
    { name: 'Parça Al', color: '#2979ff' },
    { name: 'Yerleştir', color: '#00c853' },
    { name: 'Vidala', color: '#ff6d00' },
    { name: 'Kontrol', color: '#aa00ff' }
  ]
};

// Tutorial adımları
const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Zaman Etüdü Uygulamasına Hoş Geldiniz',
    content: `
      <div class="tut-welcome">
        <div class="tut-welcome-icon">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/></svg>
        </div>
        <p>Bu rehber size uygulamayı nasıl kullanacağınızı adım adım gösterecek.</p>
        <div class="tut-features">
          <div class="tut-feature">
            <span class="tut-feature-icon">⏱️</span>
            <span>Hassas zaman ölçümü</span>
          </div>
          <div class="tut-feature">
            <span class="tut-feature-icon">📊</span>
            <span>Otomatik istatistikler</span>
          </div>
          <div class="tut-feature">
            <span class="tut-feature-icon">📱</span>
            <span>Mobil uyumlu</span>
          </div>
          <div class="tut-feature">
            <span class="tut-feature-icon">💾</span>
            <span>Otomatik kayıt</span>
          </div>
        </div>
      </div>
    `,
    screen: 'menu',
    highlight: null,
    position: 'center'
  },
  {
    id: 'menu-overview',
    title: 'Ana Menü',
    content: `
      <p>Bu ana menü ekranıdır. Buradan tüm işlemlere erişebilirsiniz.</p>
      <ul class="tut-list">
        <li><strong>Zaman Tut:</strong> Yeni ölçüm başlatır</li>
        <li><strong>Etiketleri Düzenle:</strong> Anomali etiketlerini özelleştirir</li>
        <li><strong>Geçmiş Veriler:</strong> Kayıtlı ölçümleri görüntüler</li>
      </ul>
    `,
    screen: 'menu',
    highlight: '.menu-btns',
    position: 'bottom'
  },
  {
    id: 'mode-select',
    title: 'Ölçüm Modu Seçimi',
    content: `
      <p>İki farklı ölçüm modu vardır:</p>
      <div class="tut-modes">
        <div class="tut-mode">
          <div class="tut-mode-icon" style="background:var(--acc-d)">🔄</div>
          <strong>Tekrarlı Ölçüm</strong>
          <span>Aynı işlem tekrar tekrar ölçülür</span>
        </div>
        <div class="tut-mode">
          <div class="tut-mode-icon" style="background:var(--inf-d)">📋</div>
          <strong>Ardışık İşlem</strong>
          <span>Farklı adımlar sırasıyla ölçülür</span>
        </div>
      </div>
    `,
    screen: 'mode-select',
    highlight: '.mode-cards',
    position: 'bottom'
  },
  {
    id: 'setup',
    title: 'Ölçüm Bilgileri',
    content: `
      <p>Ölçüme başlamadan önce temel bilgileri girin:</p>
      <ul class="tut-list">
        <li><strong>Operatör Adı:</strong> İşi yapan kişi</li>
        <li><strong>İş Adı:</strong> Ölçülen işlemin tanımı</li>
      </ul>
      <p class="tut-tip">💡 Bu bilgiler raporlarda ve geçmişte görünecektir.</p>
    `,
    screen: 'setup',
    highlight: '.setup-form',
    position: 'bottom'
  },
  {
    id: 'measure-overview',
    title: 'Ölçüm Ekranı',
    content: `
      <p>Bu ana ölçüm ekranıdır. Şimdi her bölümü inceleyelim.</p>
    `,
    screen: 'measure',
    highlight: null,
    position: 'center'
  },
  {
    id: 'measure-topbar',
    title: 'Üst Kontrol Çubuğu',
    content: `
      <p>Üst çubukta önemli kontroller bulunur:</p>
      <ul class="tut-list">
        <li><strong>Duraklat/Devam:</strong> Kronometreyi kontrol eder</li>
        <li><strong>Not (N):</strong> Son tura not ekler</li>
        <li><strong>Bitir (■):</strong> Ölçümü sonlandırır</li>
      </ul>
    `,
    screen: 'measure',
    highlight: '.top-bar',
    position: 'bottom'
  },
  {
    id: 'measure-timer',
    title: 'Kronometre',
    content: `
      <p>Merkezdeki kronometre alanı:</p>
      <ul class="tut-list">
        <li><strong>Dokunma/Tıklama:</strong> İlk dokunuşta başlar, sonrakilerde tur kaydeder</li>
        <li><strong>Halka:</strong> Dakika ilerlemesini gösterir</li>
        <li><strong>Süre:</strong> Geçen zamanı MM:SS.ms formatında gösterir</li>
      </ul>
      <p class="tut-tip">💡 Her dokunuşta hafif titreşim geri bildirimi alırsınız.</p>
    `,
    screen: 'measure',
    highlight: '.timer-ring',
    position: 'bottom'
  },
  {
    id: 'measure-tempo',
    title: 'Tempo Ayarı',
    content: `
      <p>Sağdaki tempo tekerleği çalışan hızını ayarlar:</p>
      <ul class="tut-list">
        <li><strong>%100:</strong> Normal hız</li>
        <li><strong>%100+:</strong> Normalden hızlı çalışıyor</li>
        <li><strong>%100-:</strong> Normalden yavaş çalışıyor</li>
      </ul>
      <p class="tut-tip">💡 Tempo, "Normal Süre" hesaplamasında kullanılır.</p>
    `,
    screen: 'measure',
    highlight: '.tempo-picker',
    position: 'left'
  },
  {
    id: 'measure-tags',
    title: 'Anomali Etiketleri',
    content: `
      <p>Renkli butonlar anomali etiketleridir:</p>
      <ul class="tut-list">
        <li>Dokunulduğunda <strong>etiketli tur</strong> kaydeder</li>
        <li>Bekleme, hurda, arıza gibi durumları işaretler</li>
        <li>Etiketler özelleştirilebilir</li>
      </ul>
      <p class="tut-tip">💡 Klavyede 1, 2, 3, 4 tuşları da kullanılabilir.</p>
    `,
    screen: 'measure',
    highlight: '.tag-strip',
    position: 'bottom'
  },
  {
    id: 'measure-laps',
    title: 'Tur Kartları',
    content: `
      <p>Kaydedilen her tur bir kart olarak görünür:</p>
      <div class="tut-lap-demo">
        <div class="tut-lap-card">
          <div class="tut-lap-num">#3</div>
          <div class="tut-lap-time">00:05.12</div>
          <div class="tut-lap-tag" style="background:#ffab00">Bekleme</div>
        </div>
      </div>
      <p>Her kartta: Tur no, süre, tempo, etiket ve not görünür.</p>
    `,
    screen: 'measure',
    highlight: '.lap-wrap',
    position: 'top'
  },
  {
    id: 'lap-interactions',
    title: 'Tur Kartı Etkileşimleri',
    content: `
      <p>Tur kartlarıyla şu şekillerde etkileşime geçebilirsiniz:</p>
      <div class="tut-interactions">
        <div class="tut-interaction">
          <span class="tut-int-icon">👉</span>
          <div>
            <strong>Sağa Kaydır</strong>
            <span>Not ekleme panelini açar</span>
          </div>
        </div>
        <div class="tut-interaction">
          <span class="tut-int-icon">👈</span>
          <div>
            <strong>Sola Kaydır</strong>
            <span>Turu siler</span>
          </div>
        </div>
        <div class="tut-interaction">
          <span class="tut-int-icon">👆</span>
          <div>
            <strong>Uzun Basma</strong>
            <span>Etiket seçici açar (mobil)</span>
          </div>
        </div>
        <div class="tut-interaction">
          <span class="tut-int-icon">🖱️</span>
          <div>
            <strong>Sağ Tık</strong>
            <span>Etiket seçici açar (PC)</span>
          </div>
        </div>
      </div>
    `,
    screen: 'measure',
    highlight: '.lap-wrap',
    position: 'top'
  },
  {
    id: 'keyboard',
    title: 'Klavye Kısayolları (PC)',
    content: `
      <p>Bilgisayarda bu kısayolları kullanabilirsiniz:</p>
      <div class="tut-shortcuts">
        <div class="tut-shortcut"><kbd>Space</kbd> <span>Tur kaydet</span></div>
        <div class="tut-shortcut"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> <span>Etiketli tur</span></div>
        <div class="tut-shortcut"><kbd>+</kbd><kbd>−</kbd> <span>Tempo ayarla</span></div>
        <div class="tut-shortcut"><kbd>P</kbd> <span>Duraklat</span></div>
        <div class="tut-shortcut"><kbd>N</kbd> <span>Not ekle</span></div>
        <div class="tut-shortcut"><kbd>Q</kbd> <span>Bitir</span></div>
        <div class="tut-shortcut"><kbd>Del</kbd> <span>Son turu sil</span></div>
      </div>
    `,
    screen: 'measure',
    highlight: '.kb-bar',
    position: 'top'
  },
  {
    id: 'summary',
    title: 'Özet Ekranı',
    content: `
      <p>Ölçüm bittiğinde detaylı istatistikler görürsünüz:</p>
      <ul class="tut-list">
        <li><strong>Gözlem sayısı</strong> ve gerekli gözlem</li>
        <li><strong>Ortalama, Medyan, Min, Max</strong></li>
        <li><strong>Standart Sapma, CV%</strong></li>
        <li><strong>%95 Güven Aralığı</strong></li>
        <li><strong>Saatlik üretim</strong> kapasitesi</li>
      </ul>
    `,
    screen: 'summary',
    highlight: '.sum-compare',
    position: 'bottom'
  },
  {
    id: 'summary-actions',
    title: 'Özet İşlemleri',
    content: `
      <p>Özet ekranında yapabilecekleriniz:</p>
      <ul class="tut-list">
        <li><strong>Excel:</strong> Detaylı raporu indir</li>
        <li><strong>Devam Et:</strong> Ölçüme geri dön</li>
        <li><strong>Tur düzenleme:</strong> Etiket, tempo değiştir veya sil</li>
        <li><strong>Filtreler:</strong> Aykırı verileri hariç tut</li>
      </ul>
    `,
    screen: 'summary',
    highlight: '.sum-action-bar',
    position: 'bottom'
  },
  {
    id: 'history',
    title: 'Geçmiş Veriler',
    content: `
      <p>Tüm ölçümleriniz otomatik kaydedilir:</p>
      <ul class="tut-list">
        <li>Kayıtlara tıklayarak özete gidin</li>
        <li>Excel olarak indirin</li>
        <li><strong>JSON Yedekle:</strong> Tüm verileri yedekleyin</li>
        <li><strong>JSON İçe Aktar:</strong> Yedeği geri yükleyin</li>
      </ul>
      <p class="tut-tip">💡 Veriler tarayıcınızda saklanır. Yedek almayı unutmayın!</p>
    `,
    screen: 'history',
    highlight: '.hi-toolbar',
    position: 'bottom'
  },
  {
    id: 'auto-recovery',
    title: 'Otomatik Kurtarma',
    content: `
      <p>Veri kaybını önlemek için:</p>
      <ul class="tut-list">
        <li>Her tur kaydında otomatik yedek alınır</li>
        <li>Uygulama kapansa bile veriler korunur</li>
        <li>Açılışta "Yarım kalan ölçüm" uyarısı çıkar</li>
        <li>Devam edebilir veya silebilirsiniz</li>
      </ul>
      <p class="tut-tip">💡 Pil bitse, internet gitse de verileriniz güvende!</p>
    `,
    screen: 'menu',
    highlight: null,
    position: 'center'
  },
  {
    id: 'finish',
    title: 'Hazırsınız!',
    content: `
      <div class="tut-finish">
        <div class="tut-finish-icon">🎉</div>
        <p>Artık Zaman Etüdü uygulamasını kullanmaya hazırsınız!</p>
        <div class="tut-finish-tips">
          <strong>Hatırlatmalar:</strong>
          <ul>
            <li>İlk dokunuş kronometreyi başlatır</li>
            <li>Sonraki dokunuşlar tur kaydeder</li>
            <li>Verileriniz otomatik kaydedilir</li>
            <li>Excel ile detaylı raporlar alabilirsiniz</li>
          </ul>
        </div>
      </div>
    `,
    screen: 'menu',
    highlight: null,
    position: 'center'
  }
];

// Tutorial HTML templates for each screen
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

function getModeSelectHTML() {
  return `
    <div class="tut-screen-content">
      <div class="mode-title">Ölçüm Modu Seçin</div>
      <div class="mode-sub">Yapmak istediğiniz zaman etüdü türüne göre bir mod seçin</div>
      <div class="mode-cards">
        <div class="mode-card">
          <div class="mode-card-icon"><svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg></div>
          <h3>Tekrarlı Ölçüm</h3>
          <p>Aynı işlem tekrar tekrar yapılır</p>
        </div>
        <div class="mode-card">
          <div class="mode-card-icon mode-seq"><svg viewBox="0 0 24 24"><path d="M3 5h2v14H3V5zm4 0h2v14H7V5zm4 0h2v14h-2V5zm4 0h2v14h-2V5zm4 0h2v14h-2V5z"/></svg></div>
          <h3>Ardışık İşlem</h3>
          <p>Farklı adımlar sırasıyla ölçülür</p>
        </div>
      </div>
    </div>
  `;
}

function getSetupHTML() {
  return `
    <div class="tut-screen-content">
      <form class="setup-form">
        <div class="setup-title">Yeni Ölçüm — Tekrarlı</div>
        <div class="setup-mode-hint">Aynı işlem tekrar tekrar ölçülecek.</div>
        <div class="inp-grp">
          <label>Operatör Adı</label>
          <input type="text" value="${EXAMPLE_DATA.op}" readonly>
        </div>
        <div class="inp-grp">
          <label>İş / Proses Adı</label>
          <input type="text" value="${EXAMPLE_DATA.job}" readonly>
        </div>
        <button type="button" class="btn-go">BAŞLAT</button>
      </form>
    </div>
  `;
}

function getMeasureHTML() {
  const lapsHTML = EXAMPLE_DATA.laps.map(l => {
    const tag = l.tag !== null ? EXAMPLE_DATA.tags[l.tag] : null;
    const tempoClass = l.tempo < 100 ? 'tempo-slow' : (l.tempo > 100 ? 'tempo-fast' : '');
    const tagBadge = tag ? `<span class="lap-badge" style="background:rgba(255,171,0,0.15);color:${tag.color}">${tag.name}</span>` : '';
    const tempoBadge = l.tempo !== 100 ? `<span class="lap-tempo ${tempoClass}">%${l.tempo}</span>` : '';
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
            <div class="lap-cum">Toplam: ${formatTime(l.cum)}</div>
            ${noteHTML}
          </div>
        </div>
        <div class="lap-actions">
          <button class="lap-act-btn act-tag"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7v10c0 1.1.9 1.99 2 1.99L16 19c.67 0 1.27-.33 1.63-.84L22 12l-4.37-6.16z"/></svg></button>
          <button class="lap-act-btn act-del"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
        </div>
      </div>
    `;
  }).reverse().join('');

  const tagsHTML = EXAMPLE_DATA.tags.map((t, i) => `
    <button class="tag-btn" style="background:${t.color}">
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/></svg>
      ${t.name}
    </button>
  `).join('');

  return `
    <div class="tut-screen-content tut-measure">
      <div class="top-bar">
        <div class="top-bar-info">
          <div class="job-name">${EXAMPLE_DATA.job}</div>
          <div class="op-name">${EXAMPLE_DATA.op}</div>
        </div>
        <button class="btn-pause-top visible">
          <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          <span>Duraklat</span>
        </button>
        <div class="top-bar-acts">
          <button class="btn-ic" title="Not"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h5v7h7v9H6zm2-7h8v2H8v-2zm0 4h5v2H8v-2z"/></svg></button>
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
          <span class="cnt">${EXAMPLE_DATA.laps.length}</span> tur
        </div>
      </div>
      <div class="lap-wrap"><div class="lap-list">${lapsHTML}</div></div>
      <div class="kb-bar">
        <span><kbd>Space</kbd> Tur</span>
        <span><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> Etiketli tur</span>
        <span><kbd>+</kbd><kbd>−</kbd> Tempo</span>
        <span><kbd>P</kbd> Duraklat</span>
      </div>
    </div>
  `;
}

function getSummaryHTML() {
  return `
    <div class="tut-screen-content tut-summary">
      <div class="sum-hdr">
        <h2>Ölçüm Tamamlandı<span style="display:inline-block;padding:2px 8px;background:var(--acc-d);color:var(--acc);border-radius:var(--r-pill);font-size:10px;font-weight:700;margin-left:6px">TEKRARLI</span></h2>
        <p>${EXAMPLE_DATA.job} — ${EXAMPLE_DATA.op}</p>
        <p style="font-size:11px;color:var(--tx3);margin-top:4px">04.02.2026 14:32</p>
        <div class="sum-action-bar">
          <button class="sum-action-btn sab-excel"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>Excel</button>
          <button class="sum-action-btn sab-resume"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>Devam Et</button>
          <button class="sum-action-btn sab-back"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>Menü</button>
        </div>
      </div>
      <div class="sum-compare">
        <div class="sum-compare-header">
          <span class="sch-n">5</span>
          <span class="sch-label">Gözlem</span>
          <span class="sch-req ok">Gerekli Gözlem: 4 ✓</span>
        </div>
        <table class="sum-compare-table">
          <thead><tr><th></th><th>Değer</th></tr></thead>
          <tbody>
            <tr><td>Toplam</td><td>00:21.20</td></tr>
            <tr><td>Ortalama</td><td>00:04.24</td></tr>
            <tr><td>Medyan</td><td>00:04.01</td></tr>
            <tr><td>Min</td><td>00:03.89</td></tr>
            <tr><td>Max</td><td>00:05.12</td></tr>
            <tr><td>Std Sapma</td><td>00:00.49</td></tr>
            <tr><td>CV%</td><td>11.6%</td></tr>
            <tr class="sct-section sct-highlight"><td>Saatlik Üretim</td><td>849.1</td></tr>
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
        <button class="btn-export btn-jn-outline"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>JSON İçe Aktar</button>
      </div>
      <div class="hi-card">
        <div class="hi-card-top">
          <span class="hi-job">${EXAMPLE_DATA.job}</span>
          <div class="hi-card-acts">
            <span class="hi-date">04.02.2026</span>
            <button class="hi-xl"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg></button>
            <button class="hi-del"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
          </div>
        </div>
        <div class="hi-card-row">${EXAMPLE_DATA.op} · <span>5</span> tur · Ort: <span>00:04.24</span></div>
      </div>
      <div class="hi-card">
        <div class="hi-card-top">
          <span class="hi-job">Paketleme İstasyonu</span>
          <div class="hi-card-acts">
            <span class="hi-date">03.02.2026</span>
            <button class="hi-xl"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg></button>
            <button class="hi-del"><svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg></button>
          </div>
        </div>
        <div class="hi-card-row">Mehmet Kaya · <span>12</span> tur · Ort: <span>00:06.82</span></div>
      </div>
    </div>
  `;
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const cs = Math.floor((ms % 1000) / 10);
  return String(m).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0') + '.' + String(cs).padStart(2, '0');
}

// Get screen HTML based on screen name
function getScreenHTML(screen) {
  switch (screen) {
    case 'menu': return getMenuHTML();
    case 'mode-select': return getModeSelectHTML();
    case 'setup': return getSetupHTML();
    case 'measure': return getMeasureHTML();
    case 'summary': return getSummaryHTML();
    case 'history': return getHistoryHTML();
    default: return getMenuHTML();
  }
}

// Render tutorial step
function renderStep(stepIndex) {
  const step = TUTORIAL_STEPS[stepIndex];
  if (!step) return;

  const container = $('tutorialContainer');
  const screenArea = container.querySelector('.tut-screen-area');
  const infoPanel = container.querySelector('.tut-info-panel');
  const progress = container.querySelector('.tut-progress-fill');
  const stepCounter = container.querySelector('.tut-step-counter');

  // Update screen content
  screenArea.innerHTML = getScreenHTML(step.screen);

  // Update progress
  const progressPercent = ((stepIndex + 1) / TUTORIAL_STEPS.length) * 100;
  progress.style.width = progressPercent + '%';
  stepCounter.textContent = `${stepIndex + 1} / ${TUTORIAL_STEPS.length}`;

  // Update info panel
  infoPanel.innerHTML = `
    <div class="tut-info-title">${step.title}</div>
    <div class="tut-info-content">${step.content}</div>
  `;

  // Apply highlight
  const existingHighlight = screenArea.querySelector('.tut-highlight-box');
  if (existingHighlight) existingHighlight.remove();

  if (step.highlight) {
    const target = screenArea.querySelector(step.highlight);
    if (target) {
      target.classList.add('tut-highlighted');
      // Add pulsing border
      const rect = target.getBoundingClientRect();
      const screenRect = screenArea.getBoundingClientRect();
    }
  }

  // Remove previous highlights
  screenArea.querySelectorAll('.tut-highlighted').forEach(el => {
    if (!step.highlight || !el.matches(step.highlight)) {
      el.classList.remove('tut-highlighted');
    }
  });

  // Update button states
  const prevBtn = container.querySelector('.tut-btn-prev');
  const nextBtn = container.querySelector('.tut-btn-next');

  prevBtn.disabled = stepIndex === 0;

  if (stepIndex === TUTORIAL_STEPS.length - 1) {
    nextBtn.innerHTML = '<span>Bitir</span><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
  } else {
    nextBtn.innerHTML = '<span>İleri</span><svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';
  }
}

// Start tutorial
export function startTutorial() {
  currentStep = 0;
  tutorialActive = true;

  // Create tutorial container
  const container = document.createElement('div');
  container.id = 'tutorialContainer';
  container.className = 'tutorial-overlay';
  container.innerHTML = `
    <div class="tut-header">
      <div class="tut-header-left">
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z"/></svg>
        <span>Nasıl Kullanılır?</span>
      </div>
      <button class="tut-close" id="tutClose">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
      </button>
    </div>
    <div class="tut-progress">
      <div class="tut-progress-fill"></div>
    </div>
    <div class="tut-main">
      <div class="tut-screen-area"></div>
      <div class="tut-info-panel"></div>
    </div>
    <div class="tut-footer">
      <button class="tut-btn tut-btn-skip" id="tutSkip">Atla</button>
      <div class="tut-nav">
        <button class="tut-btn tut-btn-prev" id="tutPrev">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59z"/></svg>
          <span>Geri</span>
        </button>
        <span class="tut-step-counter">1 / ${TUTORIAL_STEPS.length}</span>
        <button class="tut-btn tut-btn-next" id="tutNext">
          <span>İleri</span>
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  // Bind events
  $('tutClose').onclick = closeTutorial;
  $('tutSkip').onclick = closeTutorial;
  $('tutPrev').onclick = prevStep;
  $('tutNext').onclick = nextStep;

  // Keyboard navigation
  document.addEventListener('keydown', handleTutorialKeydown);

  // Render first step
  setTimeout(() => {
    container.classList.add('open');
    renderStep(0);
  }, 50);

  vib(20);
}

// Close tutorial
export function closeTutorial() {
  tutorialActive = false;
  const container = $('tutorialContainer');
  if (container) {
    container.classList.remove('open');
    setTimeout(() => container.remove(), 300);
  }
  document.removeEventListener('keydown', handleTutorialKeydown);
}

// Next step
function nextStep() {
  if (currentStep < TUTORIAL_STEPS.length - 1) {
    currentStep++;
    renderStep(currentStep);
    vib(10);
  } else {
    closeTutorial();
  }
}

// Previous step
function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    renderStep(currentStep);
    vib(10);
  }
}

// Keyboard handler
function handleTutorialKeydown(e) {
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

// Initialize tutorial button
export function initTutorial() {
  const tutBtn = $('goTutorial');
  if (tutBtn) {
    tutBtn.onclick = startTutorial;
  }
}
