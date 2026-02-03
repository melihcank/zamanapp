// ===== EXPORT MODULE =====

import { $, toast, ffull } from './utils.js';
import { STEP_COLORS } from './config.js';
import { calcStats, tagAnalysis } from './stats.js';
import { loadHistory, saveHistory, loadTags, saveTags } from './storage.js';
import { tags, setTags, sequenceSteps } from './state.js';
import { renderHistory } from './history.js';

// Load XLSX library dynamically
function loadXLSX(cb) {
  if (typeof XLSX !== 'undefined') { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload = cb;
  s.onerror = () => toast('Excel kütüphanesi yüklenemedi. İnternet bağlantısını kontrol edin.', 't-dng');
  document.head.appendChild(s);
}

// Export to Excel
export function exportExcel(session, fn) {
  loadXLSX(() => {
    const sTags = session.tags || tags;
    const sSteps = session.steps || sequenceSteps;
    const isSeqMode = session.mode === 'sequence';
    const times = session.laps.map(l => l.t);
    const normalTimes = session.laps.map(l => l.nt || l.t);
    const st = calcStats(times);
    const stNT = calcStats(normalTimes);
    const wb = XLSX.utils.book_new();

    if (isSeqMode) {
      // SEQUENCE MODE EXCEL
      const stepCount = sSteps.length || 4;
      const completeCycles = Math.floor(session.laps.length / stepCount);

      // Calculate cycle times
      const cycleTimes = [];
      for (let c = 0; c < completeCycles; c++) {
        let ct = 0;
        for (let s = 0; s < stepCount; s++) {
          const idx = c * stepCount + s;
          if (session.laps[idx]) ct += session.laps[idx].t;
        }
        cycleTimes.push(ct);
      }
      const cycleStats = calcStats(cycleTimes);

      // Sheet 1: Özet
      const w1 = [['ZAMAN ETÜDÜ RAPORU - ARDIŞIK İŞLEM'], [], ['İş / Proses Adı', session.job], ['Operatör', session.op], ['Tarih', session.date || ''],
        [], ['ÇEVRİM BİLGİSİ'], ['Tam Çevrim Sayısı', completeCycles], ['Adım Sayısı', stepCount], ['Toplam Kayıt', session.laps.length]];
      if (cycleStats && cycleStats.n > 0) {
        w1.push([], ['ÇEVRİM SÜRESİ İSTATİSTİKLERİ'], ['Ortalama Çevrim (sn)', +(cycleStats.mean / 1000).toFixed(3)],
          ['Minimum Çevrim (sn)', +(cycleStats.min / 1000).toFixed(3)], ['Maksimum Çevrim (sn)', +(cycleStats.max / 1000).toFixed(3)],
          ['Std Sapma (sn)', +(cycleStats.stdDev / 1000).toFixed(3)], ['CV%', +cycleStats.cv.toFixed(2)]);
      }
      const s1 = XLSX.utils.aoa_to_sheet(w1);
      s1['!cols'] = [{ wch: 35 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, s1, 'Özet');

      // Sheet 2: Kayıt Listesi
      const w2 = [['Kayıt No', 'Adım', 'Süre (sn)', 'Süre', 'Tempo', 'Normal (sn)', 'Normal', 'Çevrim', 'Anomali', 'Not']];
      session.laps.forEach((l, i) => {
        const stepName = l.stepName || sSteps[l.step]?.name || ('Adım ' + (l.step + 1));
        const anomaly = l.tag !== null && l.tag !== undefined && sTags[l.tag] ? sTags[l.tag].name : '';
        const tempo = l.tempo || 100;
        const nt = l.nt || l.t;
        w2.push([i + 1, stepName, +(l.t / 1000).toFixed(3), ffull(l.t), tempo, +(nt / 1000).toFixed(3), ffull(nt), l.cycle || 1, anomaly, l.note || '']);
      });
      const s2 = XLSX.utils.aoa_to_sheet(w2);
      s2['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, s2, 'Kayıt Listesi');

      // Sheet 3: Adım Analizi
      const w3 = [['Adım', 'Adet', 'Toplam (sn)', 'Ortalama (sn)', 'Normal Ort (sn)', 'Min (sn)', 'Max (sn)', 'Std Sapma (sn)', 'CV%']];
      for (let i = 0; i < stepCount; i++) {
        const stepLaps = session.laps.filter(l => l.step === i);
        const stepTimes = stepLaps.map(l => l.t);
        const stepNT = stepLaps.map(l => l.nt || l.t);
        const stats = calcStats(stepTimes);
        const ntStats = calcStats(stepNT);
        const stepName = sSteps[i]?.name || ('Adım ' + (i + 1));
        if (stats) {
          w3.push([stepName, stats.n, +(stats.sum / 1000).toFixed(3), +(stats.mean / 1000).toFixed(3), +(ntStats.mean / 1000).toFixed(3), +(stats.min / 1000).toFixed(3), +(stats.max / 1000).toFixed(3), +(stats.stdDev / 1000).toFixed(3), +stats.cv.toFixed(2)]);
        }
      }
      const s3 = XLSX.utils.aoa_to_sheet(w3);
      s3['!cols'] = [{ wch: 20 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 8 }];
      XLSX.utils.book_append_sheet(wb, s3, 'Adım Analizi');

      // Sheet 4: Anomali Özeti
      const anomalyLaps = session.laps.filter(l => l.tag !== null && l.tag !== undefined);
      if (anomalyLaps.length > 0) {
        const w4 = [['Anomali Türü', 'Adet', 'Toplam Süre (sn)']];
        sTags.forEach((t, i) => {
          const count = anomalyLaps.filter(l => l.tag === i).length;
          const sum = anomalyLaps.filter(l => l.tag === i).reduce((a, l) => a + l.t, 0);
          if (count > 0) w4.push([t.name, count, +(sum / 1000).toFixed(3)]);
        });
        const s4 = XLSX.utils.aoa_to_sheet(w4);
        s4['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, s4, 'Anomaliler');
      }

    } else {
      // REPEAT MODE EXCEL
      const ta = tagAnalysis(session.laps, sTags);
      const w1 = [['ZAMAN ETÜDÜ RAPORU - TEKRARLI ÖLÇÜM'], [], ['İş / Proses Adı', session.job], ['Operatör', session.op], ['Tarih', session.date || ''],
        [], ['GÖZLEMLENEN SÜRELER'], ['Gözlem Sayısı (n)', st.n], ['Toplam Süre (sn)', +(st.sum / 1000).toFixed(3)],
        ['Ortalama (sn)', +(st.mean / 1000).toFixed(3)], ['Medyan (sn)', +(st.median / 1000).toFixed(3)],
        ['Standart Sapma (sn)', +(st.stdDev / 1000).toFixed(3)], ['Varyasyon Katsayısı (%)', +st.cv.toFixed(2)],
        ['Minimum (sn)', +(st.min / 1000).toFixed(3)], ['Maksimum (sn)', +(st.max / 1000).toFixed(3)], ['Aralık (sn)', +(st.range / 1000).toFixed(3)],
        [], ['NORMAL SÜRELER (Tempo Düzeltmeli)'], ['Toplam Normal Süre (sn)', +(stNT.sum / 1000).toFixed(3)],
        ['Ortalama Normal Süre (sn)', +(stNT.mean / 1000).toFixed(3)], ['Medyan Normal Süre (sn)', +(stNT.median / 1000).toFixed(3)],
        [], ['DAĞILIM & YETERLİLİK'], ['%95 Güven Aralığı Alt (sn)', +(st.ci95Low / 1000).toFixed(3)], ['%95 Güven Aralığı Üst (sn)', +(st.ci95High / 1000).toFixed(3)],
        ['Gerekli Gözlem Sayısı (±%5, %95 GA)', st.nReq], ['Yeterli Gözlem', st.n >= st.nReq ? 'Evet' : 'Hayır']];

      const w2 = [['Tur No', 'Süre (sn)', 'Süre', 'Tempo', 'Normal Süre (sn)', 'Normal Süre', 'Kümülatif (sn)', 'Etiket', 'Not']];
      session.laps.forEach((l, i) => {
        const tn = l.tag !== null && sTags[l.tag] ? sTags[l.tag].name : '';
        const tempo = l.tempo || 100;
        const nt = l.nt || l.t;
        w2.push([i + 1, +(l.t / 1000).toFixed(3), ffull(l.t), tempo, +(nt / 1000).toFixed(3), ffull(nt), +(l.cum / 1000).toFixed(3), tn, l.note || '']);
      });

      const w3 = [['Etiket', 'Adet', 'Toplam (sn)', 'Ortalama (sn)', 'Min (sn)', 'Max (sn)', 'Std Sapma (sn)', 'CV%', 'Oran (%)']];
      ta.forEach(ts => {
        w3.push([ts.name, ts.count, +(ts.sum / 1000).toFixed(3), +(ts.mean / 1000).toFixed(3), +(ts.min / 1000).toFixed(3), +(ts.max / 1000).toFixed(3), +(ts.stdDev / 1000).toFixed(3), +ts.cv.toFixed(2), +((ts.count / st.n) * 100).toFixed(1)]);
      });

      const s1 = XLSX.utils.aoa_to_sheet(w1);
      s1['!cols'] = [{ wch: 35 }, { wch: 20 }];
      const s2 = XLSX.utils.aoa_to_sheet(w2);
      s2['!cols'] = [{ wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 15 }, { wch: 30 }];
      const s3 = XLSX.utils.aoa_to_sheet(w3);
      s3['!cols'] = [{ wch: 15 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, s1, 'Özet');
      XLSX.utils.book_append_sheet(wb, s2, 'Tur Verileri');
      XLSX.utils.book_append_sheet(wb, s3, 'Etiket Analizi');
    }

    XLSX.writeFile(wb, fn);
    toast('Excel dosyası indirildi', 't-ok');
  });
}

// Export all history to JSON
export function exportAllJSON() {
  const data = {
    version: 1,
    exportDate: new Date().toISOString(),
    tags: loadTags(),
    history: loadHistory()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'zaman_etudu_yedek_' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  toast('JSON yedeği indirildi', 't-ok');
}

// Trigger import JSON
export function triggerImportJSON() {
  $('jsonImportInput').click();
}

// Handle JSON import
export function handleJSONImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);

      // Doğrulama yap
      const validation = validateImportData(data);
      if (!validation.valid) {
        toast(validation.error, 't-dng');
        return;
      }

      // Etiketleri kaydet (4 adet ve geçerliyse)
      if (data.tags && data.tags.length === 4) {
        saveTags(data.tags);
        setTags(data.tags);
      }

      // Geçmişi kaydet
      saveHistory(data.history);
      toast(data.history.length + ' ölçüm başarıyla içe aktarıldı', 't-ok');
      renderHistory();
    } catch (err) {
      toast('Geçersiz JSON dosyası: Dosya okunamadı', 't-dng');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// İçe aktarma verisini doğrula
function validateImportData(data) {
  // Temel yapı kontrolü
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Geçersiz dosya formatı' };
  }

  // history dizisi kontrolü
  if (!Array.isArray(data.history)) {
    return { valid: false, error: 'Geçmiş verisi bulunamadı' };
  }

  // Boş history kabul edilebilir
  if (data.history.length === 0) {
    return { valid: true };
  }

  // Her geçmiş kaydını kontrol et
  for (let i = 0; i < data.history.length; i++) {
    const record = data.history[i];

    // Kayıt obje mi?
    if (!record || typeof record !== 'object') {
      return { valid: false, error: `Kayıt #${i + 1} geçersiz format` };
    }

    // laps dizisi var mı?
    if (!Array.isArray(record.laps)) {
      return { valid: false, error: `Kayıt #${i + 1}: Tur verisi bulunamadı` };
    }

    // Her turu kontrol et
    for (let j = 0; j < record.laps.length; j++) {
      const lap = record.laps[j];

      // Tur obje mi?
      if (!lap || typeof lap !== 'object') {
        return { valid: false, error: `Kayıt #${i + 1}, Tur #${j + 1}: Geçersiz format` };
      }

      // Süre (t) var mı ve sayı mı?
      if (typeof lap.t !== 'number' || lap.t < 0) {
        return { valid: false, error: `Kayıt #${i + 1}, Tur #${j + 1}: Geçersiz süre değeri` };
      }
    }
  }

  // Etiketler varsa kontrol et
  if (data.tags) {
    if (!Array.isArray(data.tags)) {
      return { valid: false, error: 'Etiket verisi geçersiz format' };
    }

    // 4 etiket olmalı
    if (data.tags.length !== 4) {
      return { valid: false, error: 'Etiket sayısı 4 olmalı' };
    }

    // Her etiketin name ve color'ı olmalı
    for (let i = 0; i < data.tags.length; i++) {
      const tag = data.tags[i];
      if (!tag || typeof tag !== 'object') {
        return { valid: false, error: `Etiket #${i + 1}: Geçersiz format` };
      }
      if (!tag.name || typeof tag.name !== 'string') {
        return { valid: false, error: `Etiket #${i + 1}: İsim bulunamadı` };
      }
      if (!tag.color || typeof tag.color !== 'string') {
        return { valid: false, error: `Etiket #${i + 1}: Renk bulunamadı` };
      }
    }
  }

  return { valid: true };
}

// Initialize export events
export function initExportEvents() {
  $('jsonImportInput').addEventListener('change', handleJSONImport);
}
