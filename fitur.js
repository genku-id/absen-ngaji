import { db } from './firebase-config.js';
import { 
    collection, query, where, getDocs, doc, getDoc 
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
    input.value = split[1] !== undefined ? rupiah + ',' + split[1] : rupiah;
};

// Fungsi untuk menampilkan Modal Shodaqoh
window.tampilkanModalShodaqoh = (roleAdmin, callback) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-shodaqoh';
    modal.style.zIndex = "10001";

    const isKelompok = roleAdmin === "KELOMPOK";

    modal.innerHTML = `
        <div class="card" style="max-width:400px; text-align:center; padding:25px; border-top: 5px solid #0056b3;">
            <h2 style="margin:0 0 10px 0; color:#0056b3;">Form Absensi</h2>
            
            ${isKelompok ? `
            <div style="text-align:left; margin-bottom:15px;">
                <label style="font-size:13px; font-weight:bold;">Pilih Kelas:</label>
                <select id="pilih-kelas" style="width:100%; padding:12px; margin-top:5px; border-radius:8px; border:1px solid #ccc; font-size:15px;">
                    <option value="PRA-REMAJA">PRA-REMAJA</option>
                    <option value="REMAJA">REMAJA</option>
                    <option value="PRA-NIKAH">PRA-NIKAH</option>
                    <option value="UMUM/LAINNYA">UMUM/LAINNYA</option>
                </select>
            </div>` : ''}

            <div style="text-align:left; margin-bottom:20px;">
                <label style="font-size:13px; font-weight:bold;">Shodaqoh (Rp):</label>
                <div style="position:relative; margin-top:5px;">
                    <span style="position:absolute; left:15px; top:12px; font-weight:bold; color:#28a745;">Rp</span>
                    <input type="text" id="input-shodaqoh" style="padding-left:45px; font-size:18px; font-weight:bold; width:100%; box-sizing:border-box;" placeholder="0" oninput="window.formatRupiah(this)" inputmode="numeric">
                </div>
            </div>

            <button id="btn-konf" class="primary-btn" style="background:#28a745; width:100%; padding:15px;">KONFIRMASI</button>
            <button id="btn-skip" style="background:none; border:none; color:#888; margin-top:15px; cursor:pointer;">Batal</button>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-konf').onclick = () => {
        const inputUang = document.getElementById('input-shodaqoh');
        const nominal = parseInt(inputUang.value.replace(/\./g, '')) || 0;
        const kelas = isKelompok ? document.getElementById('pilih-kelas').value : "-";
        
        document.body.removeChild(modal);
        // Pastikan callback dipanggil dengan objek hasil
        callback({ nominal: nominal, kelas: kelas });
    };

    document.getElementById('btn-skip').onclick = () => {
        document.body.removeChild(modal);
    };
};

window.renderRiwayatBeranda = async (user) => {
    const historyBox = document.getElementById('riwayat-absen-box');
    if (!historyBox) return;

    try {
        // Ambil data absen
        const q = query(collection(db, "attendance"), where("nama", "==", user.nama));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            historyBox.innerHTML = `<p style="font-size:12px; color:#888;">Belum ada riwayat absen.</p>`;
            return;
        }

        // Urutkan manual (biar gak perlu bikin indeks di Firebase console)
        const docs = snap.docs.map(d => d.data());
        docs.sort((a, b) => b.waktu.toMillis() - a.waktu.toMillis());
        const dataAbsen = docs[0];

        // Ambil data event untuk cari Nama & Waktu
        const evRef = doc(db, "events", dataAbsen.eventId);
        const evSnap = await getDoc(evRef);
        
        let namaNgaji = dataAbsen.eventId; 
        let jamMulaiStr = "--:--";
        let infoTelat = "";

        if (evSnap.exists()) {
            const evData = evSnap.data();
            namaNgaji = evData.namaEvent || "Pengajian";
            
            // Baca field 'waktu' sesuai screenshot Firebase kamu
            if (evData.waktu && evData.waktu.includes('T')) {
                jamMulaiStr = evData.waktu.split('T')[1].substring(0, 5);
                
                const [jamM, minM] = jamMulaiStr.split(':').map(Number);
                const waktuScan = dataAbsen.waktu.toDate();
                const menitScan = (waktuScan.getHours() * 60) + waktuScan.getMinutes();
                const menitMulai = (jamM * 60) + minM;

                // Jika telat > 10 menit
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
            <div style="background:#f8f9fa; border:1.5px solid #eee; padding:15px; border-radius:12px; text-align:left; margin-bottom:15px;">
                <p style="margin:0 0 5px 0; font-size:11px; font-weight:bold; color:#0056b3; letter-spacing:1px; text-transform:uppercase;">Absen Terakhir:</p>
                <div style="font-size:16px; font-weight:bold; color:#333;">${namaNgaji}</div>
                <div style="font-size:12px; color:#666; margin-top:5px;">
                    Scan: <b>${jamScan}</b> | Jadwal: <b>${jamMulaiStr}</b>
                </div>
                ${infoTelat}
            </div>
        `;
    } catch (e) {
        console.error("Error Detail:", e);
        historyBox.innerHTML = `<p style="font-size:12px; color:red;">Gagal memuat: ${e.message}</p>`;
    }
};
