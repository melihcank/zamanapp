// ===== TUTORIAL MODULE =====
// "Nasıl Kullanılır?" öğretici sistemi
// Dikey akış: Önce açıklama, sonra işaretlenmiş arayüz

import { $, vib, goFS } from './utils.js';

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
  // STEP 1: Giriş - Değer Önerileri
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
      <div class="tut-callout tut-callout-tip">
        <span class="tut-callout-icon">💡</span>
        <span>Şimdi uygulamayı adım adım tanıyalım!</span>
      </div>
    `,
    screen: 'none'
  },

  // STEP 2: Ana Menü
  {
    id: 'menu',
    title: 'Ana Menü',
    content: `
      <p>Ana menü, uygulamanın giriş noktasıdır. Buradan tüm temel işlemlere tek dokunuşla erişebilirsiniz.</p>
      <p><strong>Zaman Tut</strong> — Yeni bir ölçüm başlatır. İş ve operatör bilgilerini girdikten sonra ölçüme geçersiniz.</p>
      <p><strong>Etiketleri Düzenle</strong> — Anomali etiketlerinin isimlerini, renklerini ve simgelerini özelleştirin. Her sektörün ihtiyacına göre uyarlayın.</p>
      <p><strong>Geçmiş Veriler</strong> — Daha önce kaydettiğiniz tüm ölçümlere erişin, inceleyin veya Excel olarak dışa aktarın.</p>
      <div class="tut-callout tut-callout-tip">
        <span class="tut-callout-icon">💡</span>
        <span>Kurulum gerektirmez, açar açmaz ölçüme başlayabilirsiniz!</span>
      </div>
    `,
    screen: 'menu',
    highlight: '.menu-btns'
  },

  // STEP 3: Mod Seçimi
  {
    id: 'mode-select',
    title: 'Ölçüm Modu Seçimi',
    content: `
      <p>İhtiyacınıza göre iki farklı ölçüm modu arasından seçim yapabilirsiniz:</p>
      <div class="tut-gestures">
        <div class="tut-gesture">
          <div class="tut-gesture-icon">🔄</div>
          <div class="tut-gesture-text">
            <strong>Tekrarlı Ölçüm</strong>
            <span>Aynı işlem tekrar tekrar yapılır ve her seferinde süre kaydedilir. Örneğin: Vida sıkma, kutu paketleme, form doldurma.</span>
          </div>
        </div>
        <div class="tut-gesture">
          <div class="tut-gesture-icon">📋</div>
          <div class="tut-gesture-text">
            <strong>Ardışık İşlem</strong>
            <span>Bir işin farklı adımları sırasıyla ölçülür. Örneğin: Parça al → Yerleştir → Vidala → Kontrol et.</span>
          </div>
        </div>
      </div>
      <div class="tut-callout tut-callout-tip">
        <span class="tut-callout-icon">💡</span>
        <span>Çoğu zaman etüdü için <strong>Tekrarlı Ölçüm</strong> idealdir.</span>
      </div>
    `,
    screen: 'mode-select',
    highlight: '.mode-cards'
  },

  // STEP 4: Ölçüm Bilgileri
  {
    id: 'setup',
    title: 'Ölçüm Bilgileri',
    content: `
      <p>Ölçüme başlamadan önce kayıt için gerekli temel bilgileri girin. Bu bilgiler raporlarınızda ve geçmiş kayıtlarında görünecektir.</p>
      <p><strong>Operatör Adı</strong> — İşi yapan kişinin adı. Farklı operatörlerin performansını karşılaştırmanıza olanak tanır.</p>
      <p><strong>İş / Proses Adı</strong> — Ölçtüğünüz işlemin tanımlayıcı adı. Örneğin: "Montaj Hattı A - Vida Takma", "Paketleme İstasyonu 3".</p>
      <div class="tut-callout tut-callout-tip">
        <span class="tut-callout-icon">💡</span>
        <span>Açıklayıcı isimler kullanın — geçmiş verilerinizi ararken işinizi kolaylaştırır.</span>
      </div>
    `,
    screen: 'setup',
    highlight: '.setup-form'
  },

  // STEP 5: Ölçüm Ekranı Genel
  {
    id: 'measure-overview',
    title: 'Ölçüm Ekranı',
    content: `
      <p>Bu, uygulamanın kalbi olan ana ölçüm ekranıdır. Tüm zaman kaydı işlemleri burada gerçekleşir.</p>
      <p>Ekran şu ana bölümlerden oluşur:</p>
      <p><strong>Üst çubuk</strong> — İş bilgileri, duraklat/devam ve bitir kontrolleri</p>
      <p><strong>Etiket butonları</strong> — Anomali durumları için hızlı işaretleme</p>
      <p><strong>Kronometre</strong> — Dokunarak tur kaydı yapılan merkezi alan</p>
      <p><strong>Tempo ayarı</strong> — Çalışan hızı değerlendirmesi</p>
      <p><strong>Tur listesi</strong> — Kaydedilen tüm turların görüntülendiği alan</p>
      <div class="tut-callout tut-callout-tip">
        <span class="tut-callout-icon">💡</span>
        <span>Şimdi her bir bölümü detaylıca inceleyelim.</span>
      </div>
    `,
    screen: 'measure',
    highlight: null
  },

  // STEP 6: Üst Kontrol Çubuğu
  {
    id: 'topbar',
    title: 'Üst Kontrol Çubuğu',
    content: `
      <p>Üst çubuk, ölçüm sırasında ihtiyaç duyacağınız kontrolleri barındırır:</p>
      <p><strong>İş ve Operatör Bilgisi</strong> — Hangi ölçümde olduğunuzu hatırlatır.</p>
      <p><strong>Duraklat/Devam</strong> — Kronometreyi durdurup tekrar başlatır. Molalarda veya beklenmedik durumlarda kullanın.</p>
      <p><strong>Bitir Butonu</strong> — Ölçümü sonlandırır ve özet ekranına geçer.</p>
      <div class="tut-callout tut-callout-tip">
        <span class="tut-callout-icon">💡</span>
        <span>Ölçümü bitirmeden önce en az 5-10 tur kaydetmeniz önerilir. Daha fazla veri = daha güvenilir sonuç!</span>
      </div>
    `,
    screen: 'measure',
    highlight: '.top-bar'
  },

  // STEP 7: Kronometre
  {
    id: 'timer',
    title: 'Kronometre Alanı',
    content: `
      <p>Merkezdeki kronometre, uygulamanın en önemli bileşenidir. Ölçüm burada gerçekleşir.</p>
      <p><strong>İlk Dokunuş</strong> — Kronometreyi başlatır. İşçi işe başladığında dokunun.</p>
      <p><strong>Sonraki Dokunuşlar</strong> — Her dokunuşta bir tur kaydedilir ve kronometre sıfırlanır. İşçi işi tamamladığında dokunun.</p>
      <p><strong>Görsel Halka</strong> — Dakika ilerlemesini gösterir. Uzun süren işlerde referans sağlar.</p>
      <p><strong>Süre Göstergesi</strong> — Geçen zamanı dakika:saniye.milisaniye formatında gösterir.</p>
      <div class="tut-callout tut-callout-success">
        <span class="tut-callout-icon">✓</span>
        <span>Her kayıtta titreşim alırsınız — gözünüz ekranda olmasa da kaydedildiğini anlarsınız.</span>
      </div>
    `,
    screen: 'measure',
    highlight: '.timer-ring'
  },

  // STEP 8: Tempo
  {
    id: 'tempo',
    title: 'Tempo Değerlendirmesi',
    content: `
      <p>Tempo ayarı, zaman etüdünün kritik özelliklerinden biridir. Çalışanın performans hızını değerlendirmenizi sağlar.</p>
      <p><strong>%100 (Normal)</strong> — Çalışan standart, sürdürülebilir bir hızda çalışıyor.</p>
      <p><strong>%100 üzeri</strong> — Çalışan normalden hızlı çalışıyor (örn: %110, %120).</p>
      <p><strong>%100 altı</strong> — Çalışan normalden yavaş çalışıyor (örn: %90, %85).</p>
      <p>Bu değerlendirme ile <strong>"Normal Süre"</strong> hesaplanır:</p>
      <p style="background:var(--bg3);padding:8px 12px;border-radius:6px;font-family:var(--mono);font-size:13px">Normal Süre = Gözlenen Süre × (Tempo / 100)</p>
      <div class="tut-callout tut-callout-tip">
        <span class="tut-callout-icon">💡</span>
        <span>Tekerleği kaydırarak veya +/- tuşlarıyla tempo değiştirin.</span>
      </div>
    `,
    screen: 'measure',
    highlight: '.tempo-picker'
  },

  // STEP 9: Etiketler
  {
    id: 'tags',
    title: 'Anomali Etiketleri',
    content: `
      <p>Etiketler, normal çevrim dışı durumları işaretlemenizi sağlar. Etiketli turlar istatistiklerden hariç tutulabilir.</p>
      <p><strong>Bekleme</strong> — Malzeme bekleme, talimat bekleme gibi duraklamalar.</p>
      <p><strong>Hurda</strong> — Hatalı parça, yeniden işleme gerektiren durumlar.</p>
      <p><strong>Arıza</strong> — Makine veya ekipman arızaları.</p>
      <p><strong>Ayar</strong> — Makine ayarı, kalıp değişimi gibi hazırlık işleri.</p>
      <p>Etiketli tur kaydetmek için: İşçi anormal bir durumla karşılaştığında, kronometre yerine ilgili <strong>etiket butonuna</strong> dokunun.</p>
      <div class="tut-callout tut-callout-tip">
        <span class="tut-callout-icon">💡</span>
        <span>Etiketleri ana menüden özelleştirebilirsiniz. Sektörünüze uygun isimler ve renkler belirleyin!</span>
      </div>
    `,
    screen: 'measure',
    highlight: '.tag-strip'
  },

  // STEP 10: Tur Kartları
  {
    id: 'laps',
    title: 'Tur Kartları',
    content: `
      <p>Kaydedilen her tur, detaylı bilgilerle birlikte bir kart olarak listelenir. En son tur en üstte görünür.</p>
      <p>Her kartta şunları görebilirsiniz:</p>
      <p><strong>Tur numarası</strong> — Kaçıncı tur olduğu (#1, #2, #3...)</p>
      <p><strong>Süre</strong> — O turun kaç saniye sürdüğü</p>
      <p><strong>Tempo rozeti</strong> — Eğer %100'den farklıysa gösterilir</p>
      <p><strong>Etiket rozeti</strong> — Varsa anomali etiketi</p>
      <p><strong>Not</strong> — Eklendiyse açıklama metni</p>
    `,
    screen: 'measure',
    highlight: '.lap-wrap'
  },

  // STEP 11: Tur Kartı Etkileşimleri
  {
    id: 'lap-interactions',
    title: 'Tur Kartı İşlemleri',
    content: `
      <p>Kaydedilen turları düzenlemek veya yönetmek için çeşitli hareketler kullanabilirsiniz:</p>
      <div class="tut-gestures">
        <div class="tut-gesture">
          <div class="tut-gesture-icon">👉</div>
          <div class="tut-gesture-text">
            <strong>Sağa Kaydır</strong>
            <span>Not ekleme/düzenleme panelini açar. Tura açıklama eklemek için kullanın.</span>
          </div>
        </div>
        <div class="tut-gesture">
          <div class="tut-gesture-icon">👈</div>
          <div class="tut-gesture-text">
            <strong>Sola Kaydır</strong>
            <span>Turu siler. Yanlışlıkla kaydedilen veya geçersiz turları kaldırın.</span>
          </div>
        </div>
        <div class="tut-gesture">
          <div class="tut-gesture-icon">👆</div>
          <div class="tut-gesture-text">
            <strong>Uzun Basma (Mobil)</strong>
            <span>Etiket seçici açar. Mevcut bir tura sonradan etiket ekleyin veya değiştirin.</span>
          </div>
        </div>
        <div class="tut-gesture">
          <div class="tut-gesture-icon">🖱️</div>
          <div class="tut-gesture-text">
            <strong>Sağ Tık (PC)</strong>
            <span>Uzun basma ile aynı işlevi görür. Bilgisayarda etiket seçici açar.</span>
          </div>
        </div>
      </div>
      <div class="tut-callout tut-callout-tip">
        <span class="tut-callout-icon">💡</span>
        <span>Hatalı kayıtları hemen silmenize gerek yok — özet ekranında da düzenleme yapabilirsiniz.</span>
      </div>
    `,
    screen: 'measure',
    highlight: '.lap-wrap'
  },

  // STEP 12: Klavye
  {
    id: 'keyboard',
    title: 'Klavye Kısayolları',
    content: `
      <p>Bilgisayarda kullanırken klavye kısayolları ile çok daha hızlı çalışabilirsiniz:</p>
      <div class="tut-shortcuts">
        <div class="tut-shortcut"><kbd>Space</kbd> <span>Tur kaydet</span></div>
        <div class="tut-shortcut"><kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> <span>Etiketli tur</span></div>
        <div class="tut-shortcut"><kbd>+</kbd><kbd>−</kbd> <span>Tempo ayarla</span></div>
        <div class="tut-shortcut"><kbd>P</kbd> <span>Duraklat</span></div>
        <div class="tut-shortcut"><kbd>Q</kbd> <span>Bitir</span></div>
        <div class="tut-shortcut"><kbd>Del</kbd> <span>Son turu sil</span></div>
      </div>
      <div class="tut-callout tut-callout-tip">
        <span class="tut-callout-icon">💡</span>
        <span>Video üzerinden ölçüm yapıyorsanız klavye kısayolları vazgeçilmezdir!</span>
      </div>
    `,
    screen: 'measure',
    highlight: '.kb-bar'
  },

  // STEP 13: Özet İstatistikler
  {
    id: 'summary',
    title: 'Özet ve İstatistikler',
    content: `
      <p>Ölçüm tamamlandığında kapsamlı bir istatistik raporu görürsünüz. Bu veriler, standart süre belirlemenin temelidir.</p>
      <p><strong>Gözlem Sayısı</strong> — Kaç tur kaydettiğiniz ve istatistiksel güvenilirlik için kaç gözlem gerektiği.</p>
      <p><strong>Ortalama / Medyan</strong> — Merkezi eğilim ölçüleri. Medyan aykırı değerlerden etkilenmez.</p>
      <p><strong>Min / Max</strong> — En kısa ve en uzun süren turlar.</p>
      <p><strong>Standart Sapma</strong> — Sürelerin ortalamadan ne kadar saptığı (tutarlılık göstergesi).</p>
      <p><strong>CV% (Değişkenlik Katsayısı)</strong> — Göreceli değişkenlik. %15'in altı iyi kabul edilir.</p>
      <p><strong>Saatlik Üretim</strong> — Bu süreyle saatte kaç adet üretilebileceği.</p>
      <div class="tut-callout tut-callout-warn">
        <span class="tut-callout-icon">⚠️</span>
        <span>CV% yüksekse, süreçte tutarsızlık var demektir. Nedenini araştırın!</span>
      </div>
    `,
    screen: 'summary',
    highlight: '.sum-compare'
  },

  // STEP 14: Özet İşlemleri
  {
    id: 'summary-actions',
    title: 'Özet Ekranı İşlemleri',
    content: `
      <p>Özet ekranında ölçüm verilerinizi yönetebilir ve dışa aktarabilirsiniz:</p>
      <p><strong>Excel İndir</strong> — Tüm detayları içeren profesyonel bir Excel raporu oluşturur. Tur tur veriler, istatistikler ve grafikler için hazır format.</p>
      <p><strong>Devam Et</strong> — Ölçüme geri döner ve daha fazla tur eklemenizi sağlar. Yeterli veri toplamadıysanız kullanın.</p>
      <p><strong>Menüye Dön</strong> — Ölçümü kaydedip ana menüye döner. Veriler otomatik saklanır.</p>
      <p>Ayrıca özet ekranında tur kartlarını düzenleyebilirsiniz: Etiket veya tempo değiştirin, hatalı turları silin.</p>
    `,
    screen: 'summary',
    highlight: '.sum-action-bar'
  },

  // STEP 15: Geçmiş
  {
    id: 'history',
    title: 'Geçmiş Kayıtlar',
    content: `
      <p>Tüm ölçümleriniz tarayıcınızda otomatik olarak saklanır. Geçmiş ekranından bunlara her zaman erişebilirsiniz.</p>
      <p><strong>Kayda Tıklama</strong> — O ölçümün özet ekranını açar. Detayları inceleyebilir, Excel alabilirsiniz.</p>
      <p><strong>Excel Butonu</strong> — Doğrudan Excel raporu indirir.</p>
      <p><strong>Silme Butonu</strong> — Kaydı kalıcı olarak siler.</p>
      <p><strong>JSON Yedekle</strong> — Tüm verilerinizi tek bir dosyaya aktarır. Düzenli yedek alın!</p>
      <p><strong>JSON İçe Aktar</strong> — Yedek dosyasından verileri geri yükler. Farklı cihazlar arası aktarım için de kullanılır.</p>
      <div class="tut-callout tut-callout-warn">
        <span class="tut-callout-icon">⚠️</span>
        <span>Tarayıcı verileri temizlenirse kayıplar olabilir. Önemli verilerinizi JSON olarak yedekleyin!</span>
      </div>
    `,
    screen: 'history',
    highlight: '.hi-toolbar'
  },

  // STEP 16: Otomatik Kurtarma
  {
    id: 'auto-recovery',
    title: 'Otomatik Kurtarma',
    content: `
      <p>Uygulama, veri kaybını önlemek için gelişmiş bir otomatik kurtarma sistemine sahiptir:</p>
      <div class="tut-features">
        <div class="tut-feature">
          <span class="tut-feature-icon">💾</span>
          <div class="tut-feature-text">
            <h4>Anlık Yedekleme</h4>
            <p>Her tur kaydedildiğinde veriler otomatik olarak saklanır.</p>
          </div>
        </div>
        <div class="tut-feature">
          <span class="tut-feature-icon">🔄</span>
          <div class="tut-feature-text">
            <h4>Çökme Koruması</h4>
            <p>Uygulama beklenmedik şekilde kapansa bile veriler korunur.</p>
          </div>
        </div>
        <div class="tut-feature">
          <span class="tut-feature-icon">🔔</span>
          <div class="tut-feature-text">
            <h4>Kurtarma Bildirimi</h4>
            <p>Yarım kalan bir ölçüm varsa, uygulama açılışında uyarı gösterilir.</p>
          </div>
        </div>
      </div>
      <div class="tut-callout tut-callout-success">
        <span class="tut-callout-icon">✓</span>
        <span>Pil bitse, internet gitse, tarayıcı çökse bile verileriniz kaybolmaz!</span>
      </div>
    `,
    screen: 'none'
  },

  // STEP 17: Bitiş
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
        <p style="margin-top:20px;font-size:13px;color:var(--tx3)">Bu rehbere ana menüdeki "Nasıl Kullanılır?" butonundan her zaman ulaşabilirsiniz.</p>
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
          <input type="text" value="${EXAMPLE.op}" readonly>
        </div>
        <div class="inp-grp">
          <label>İş / Proses Adı</label>
          <input type="text" value="${EXAMPLE.job}" readonly>
        </div>
        <button type="button" class="btn-go">BAŞLAT</button>
      </form>
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
        <button class="btn-pause-top visible">
          <svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          <span>Duraklat</span>
        </button>
        <div class="top-bar-acts">
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
    case 'mode-select': return getModeSelectHTML();
    case 'setup': return getSetupHTML();
    case 'measure': return getMeasureHTML();
    case 'summary': return getSummaryHTML();
    case 'history': return getHistoryHTML();
    default: return '';
  }
}

function getScreenLabel(screen) {
  const labels = {
    menu: 'Ana Menü',
    'mode-select': 'Mod Seçimi',
    setup: 'Ölçüm Ayarları',
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
    goFS();
    handler();
  }, { passive: false });

  btn.addEventListener('click', e => {
    if (handled) return;
    e.stopPropagation();
    goFS();
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

  // Fullscreen on any click/touch in tutorial
  container.addEventListener('click', goFS);
  container.addEventListener('touchend', goFS);

  bindButton('tutClose', closeTutorial);
  bindButton('tutSkip', closeTutorial);
  bindButton('tutPrev', prevStep);
  bindButton('tutNext', nextStep);

  document.addEventListener('keydown', handleKeydown);

  setTimeout(() => {
    container.classList.add('open');
    renderStep(0);
  }, 50);

  goFS();
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
