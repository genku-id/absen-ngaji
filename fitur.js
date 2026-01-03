import { db } from './firebase-config.js';
import { 
    collection, query, where, getDocs, limit, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// Fungsi untuk memformat angka ke Rupiah saat mengetik
window.formatRupiah = (input) => {
    let value = input.value.replace(/[^,\d]/g, '').toString();
    let split = value.split(',');
    let sisa = split[0].length % 3;
    let rupiah = split[0].substr(0, sisa);
    let ribuan = split[0].substr(sisa).match(/\d{3}/gi);
    if (ribuan) {
        let separator = sisa ? '.' : '';
        rupiah += separator + ribuan.join('.');
    }
    rupiah = split[1] !== undefined ? rupiah + ',' + split[1] : rupiah;
    input.value = rupiah;
};

// Fungsi untuk menampilkan Modal Shodaqoh
window.tampilkanModalShodaqoh = (callback) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-shodaqoh';
    modal.style.zIndex = "10001"; // Pastikan di atas segalanya
    
    modal.innerHTML = `
        <div class="card" style="max-width:400px; text-align:center; padding:30px; position:relative;">
            <h2 style="margin-top:0; color:#0056b3;">Infaq / Shodaqoh</h2>
            <p style="font-size:14px; color:#666;">Silakan masukkan nominal (opsional):</p>
            
            <div style="position:relative; margin:20px 0;">
                <span style="position:absolute; left:15px; top:14px; font-weight:bold; color:#28a745;">Rp</span>
                <input type="text" id="input-shodaqoh" 
                    style="padding-left:45px; font-size:20px; font-weight:bold; color:#28a745;" 
                    placeholder="0" 
                    oninput="window.formatRupiah(this)"
                    inputmode="numeric">
            </div>

            <button id="btn-konfirmasi-shodaqoh" class="primary-btn" style="background:#28a745;">KONFIRMASI & LANJUT</button>
            <button id="btn-skip-shodaqoh" style="background:none; border:none; color:#888; margin-top:15px; cursor:pointer; font-weight:bold;">LEWATI</button>
        </div>
    `;
    
    document.body.appendChild(modal);

    const input = document.getElementById('input-shodaqoh');
    const btnOk = document.getElementById('btn-konfirmasi-shodaqoh');
    const btnSkip = document.getElementById('btn-skip-shodaqoh');

    if (input) setTimeout(() => input.focus(), 300);

    const tutupDanLanjut = (nominal) => {
        if (document.getElementById('modal-shodaqoh')) {
            document.body.removeChild(modal);
        }
        if (typeof callback === 'function') callback(nominal);
    };

    btnOk.onclick = () => {
        const nominal = parseInt(input.value.replace(/\./g, '')) || 0;
        tutupDanLanjut(nominal);
    };

    btnSkip.onclick = () => tutupDanLanjut(0);
};

window.renderRiwayatBeranda = async (user) => {
    const historyBox = document.getElementById('riwayat-absen-box');
    if (!historyBox) return;
    try {
        const q = query(collection(db, "attendance"), where("nama", "==", user.nama));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            historyBox.innerHTML = `<p style="font-size:12px; color:#888;">Belum ada riwayat absen.</p>`;
            return;
        }

        const docs = snap.docs.map(d => d.data());
        docs.sort((a, b) => b.waktu.toMillis() - a.waktu.toMillis());
        const dataAbsen = docs[0];

        // Ambil data event
        const evSnap = await getDoc(doc(db, "events", dataAbsen.eventId));
        let namaNgaji = "Event Tidak Dikenal";
        let jamMulaiStr = "--:--";
        let infoTelat = "";

        if (evSnap.exists()) {
            const evData = evSnap.data();
            namaNgaji = evData.namaEvent || "Tanpa Nama";
            
            // Berdasarkan screenshot kamu, fieldnya bernama 'waktu' (format: 2026-01-03T14:40)
            if (evData.waktu) {
                // Kita ambil bagian jamnya saja (HH:mm)
                jamMulaiStr = evData.waktu.split('T')[1].substring(0, 5);
                
                const [jamM, minM] = jamMulaiStr.split(':').map(Number);
                const waktuScan = dataAbsen.waktu.toDate();
                const menitScan = (waktuScan.getHours() * 60) + waktuScan.getMinutes();
                const menitMulai = (jamM * 60) + minM;

                // Jika telat lebih dari 10 menit
                if (menitScan > (menitMulai + 10)) {
                    infoTelat = `
                        <div style="margin-top:10px; color:#dc3545; font-weight:bold; background:#fff1f0; padding:10px; border-radius:8px; border:1px solid #ffa39e; font-size:13px; text-align:center;">
                            ⚠️ TERLAMBAT!<br>Amshol Istigfar 10x
                        </div>`;
                }
            }
        }

        const jamScan = dataAbsen.waktu.toDate().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});

        historyBox.innerHTML = `
            <div style="background:#f8f9fa; border:1.5px solid #eee; padding:15px; border-radius:12px; text-align:left; margin-bottom:15px; animation: zoomIn 0.3s ease-out;">
                <p style="margin:0 0 5px 0; font-size:11px; font-weight:bold; color:#0056b3; letter-spacing:1px; text-transform:uppercase;">Absen Terakhir:</p>
                <div style="font-size:16px; font-weight:bold; color:#333; line-height:1.2;">${namaNgaji}</div>
                <div style="font-size:12px; color:#666; margin-top:5px;">
                    Scan: <b>${jamScan}</b> | Jadwal: <b>${jamMulaiStr}</b>
                </div>
                ${infoTelat}
            </div>
        `;
    } catch (e) {
        console.error(e);
        historyBox.innerHTML = `<p style="font-size:12px; color:red;">Gagal memuat data.</p>`;
    }
};
