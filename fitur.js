import { db } from './firebase-config.js';
import { 
    collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc, serverTimestamp 
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

// --- FUNGSI MODAL SHODAQOH ---
window.tampilkanModalShodaqoh = (callback) => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-shodaqoh';
    modal.style.zIndex = "10001";
    modal.innerHTML = `
        <div class="card" style="max-width:400px; text-align:center; padding:30px; border-top: 5px solid #28a745;">
            <h2 style="margin:0; color:#0056b3;">Infaq / Shodaqoh</h2>
            <p style="font-size:12px; color:#666; margin-top:5px;">Silakan isi nominal shodaqoh Anda</p>
            <div style="position:relative; margin:25px 0;">
                <span style="position:absolute; left:15px; top:14px; font-weight:bold; color:#28a745;">Rp</span>
                <input type="text" id="input-shodaqoh" style="padding-left:45px; font-size:20px; font-weight:bold; width:100%; box-sizing:border-box;" placeholder="0" oninput="window.formatRupiah(this)" inputmode="numeric">
            </div>
            <button id="btn-konf" class="primary-btn" style="background:#28a745; width:100%; padding:15px;">KONFIRMASI ABSEN</button>
            <button id="btn-skip" style="background:none; border:none; color:#888; margin-top:15px; cursor:pointer; font-size:13px;">Lewati / Tanpa Shodaqoh</button>
        </div>
    `;
    document.body.appendChild(modal);
    const inputUang = document.getElementById('input-shodaqoh');
    setTimeout(() => inputUang.focus(), 300);
    document.getElementById('btn-konf').onclick = () => {
        const nominal = parseInt(inputUang.value.replace(/\./g, '')) || 0;
        document.body.removeChild(modal);
        callback(nominal);
    };
    document.getElementById('btn-skip').onclick = () => {
        document.body.removeChild(modal);
        callback(0);
    };
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
        const evSnap = await getDoc(doc(db, "events", dataAbsen.eventId));
        let namaNgaji = dataAbsen.eventId; let jamMulaiStr = "--:--"; let infoTelat = "";
        if (evSnap.exists()) {
            const evData = evSnap.data();
            namaNgaji = evData.namaEvent || "Pengajian";
            if (evData.waktu && evData.waktu.includes('T')) {
                jamMulaiStr = evData.waktu.split('T')[1].substring(0, 5);
                const [jamM, minM] = jamMulaiStr.split(':').map(Number);
                const waktuScan = dataAbsen.waktu.toDate();
                const menitScan = (waktuScan.getHours() * 60) + waktuScan.getMinutes();
                const menitMulai = (jamM * 60) + minM;
                if (menitScan > (menitMulai + 10)) {
                    infoTelat = `<div style="margin-top:10px; color:#dc3545; font-weight:bold; background:#fff1f0; padding:10px; border-radius:8px; border:1px solid #ffa39e; font-size:13px; text-align:center;">⚠️ TERLAMBAT!<br>Amshol Istigfar 10x</div>`;
                }
            }
        }
        const jamScan = dataAbsen.waktu.toDate().toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'});
        historyBox.innerHTML = `
            <div style="background:#f8f9fa; border:1.5px solid #eee; padding:15px; border-radius:12px; text-align:left; margin-bottom:15px;">
                <p style="margin:0 0 5px 0; font-size:11px; font-weight:bold; color:#0056b3; letter-spacing:1px; text-transform:uppercase;">Absen Terakhir:</p>
                <div style="font-size:16px; font-weight:bold; color:#333;">${namaNgaji} (${dataAbsen.kelas || '-'})</div>
                <div style="font-size:12px; color:#666; margin-top:5px;">Scan: <b>${jamScan}</b> | Jadwal: <b>${jamMulaiStr}</b></div>
                ${infoTelat}
            </div>`;
    } catch (e) { historyBox.innerHTML = `<p style="font-size:12px; color:red;">Gagal memuat: ${e.message}</p>`; }
};

// --- MESIN REKAP & RESET (PENYEMPURNAAN) ---
window.prosesRekapDanReset = async (eventId, admin) => {
    try {
        const { wilayah, role } = admin;
        const d = new Date();
        const bulanSekarang = d.getMonth() + 1;
        const tahunSekarang = d.getFullYear();

        // 1. Ambil data Event yang akan di-reset (untuk tau Target Kelas)
        const evRef = doc(db, "events", eventId);
        const evSnap = await getDoc(evRef);
        if (!evSnap.exists()) return false;
        const targetKelas = evSnap.data().targetKelas || [];

        // 2. Ambil SEMUA data kehadiran (Global) untuk hitung SB Lain vs Hadir Lokal
        const qAtt = query(collection(db, "attendance"));
        const attSnap = await getDocs(qAtt);
        const globalAtt = attSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filter: Attendance milik event ini saja
        const localAtt = globalAtt.filter(a => a.eventId === eventId);

        // 3. LOGIKA REKAP (Hanya jika Admin Kelompok)
        if (role === "KELOMPOK") {
            const docRekapId = `REKAP_${wilayah.replace(/\s/g, '')}_${tahunSekarang}_${bulanSekarang}`;
            
            const hitungHadir = (kls) => localAtt.filter(a => a.kelas === kls && a.status === 'hadir').length;
            
            const hitungIzinDanSBLain = (kls) => {
                const izinLokal = localAtt.filter(a => a.kelas === kls && a.status === 'izin').length;
            
                return izinLokal; 
            };

            const rekapRef = doc(db, "rekap_bulanan", docRekapId);
            const rekapDoc = await getDoc(rekapRef);

            const updateData = {
                hadirPR: (rekapDoc.exists() ? rekapDoc.data().hadirPR || 0 : 0) + hitungHadir("PRA-REMAJA"),
                hadirR: (rekapDoc.exists() ? rekapDoc.data().hadirR || 0 : 0) + hitungHadir("REMAJA"),
                hadirPN: (rekapDoc.exists() ? rekapDoc.data().hadirPN || 0 : 0) + hitungHadir("PRA-NIKAH"),
                jumlahPertemuan: (rekapDoc.exists() ? rekapDoc.data().jumlahPertemuan || 0 : 0) + 1,
                lastUpdate: serverTimestamp(),
                wilayah: wilayah,
                role: role,
                bulan: bulanSekarang,
                tahun: tahunSekarang
            };

            await setDoc(rekapRef, updateData, { merge: true });
        }

        const batchPromises = localAtt.map(a => deleteDoc(doc(db, "attendance", a.id)));
        await Promise.all(batchPromises);

        await deleteDoc(evRef);

        return true;
    } catch (e) {
        console.error("Gagal Rekap:", e);
        return false;
    }
};

window.getStatistikBulanLalu = async (wilayah) => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const bulanLalu = d.getMonth() + 1;
    const tahunLalu = d.getFullYear();
    const docRekapId = `REKAP_${wilayah.replace(/\s/g, '')}_${tahunLalu}_${bulanLalu}`;
    const snap = await getDoc(doc(db, "rekap_bulanan", docRekapId));
    return snap.exists() ? snap.data() : null;
};

window.getTotalAnggotaPerKelas = async (wilayah, role) => {
    try {
        let q = collection(db, "master_jamaah");
        if (role === "KELOMPOK") q = query(q, where("kelompok", "==", wilayah));
        else if (role === "DESA") q = query(q, where("desa", "==", wilayah));
        
        const snap = await getDocs(q);
        const data = snap.docs.map(d => d.data());
        
        const pr = data.filter(j => j.kelas === "PRA-REMAJA").length;
        const r = data.filter(j => j.kelas === "REMAJA").length;
        const pn = data.filter(j => j.kelas === "PRA-NIKAH").length;

        return {
            totalPR: pr,
            totalR: r,
            totalPN: pn,
            totalSemua: pr + r + pn 
        };
    } catch (e) { return { totalPR: 0, totalR: 0, totalPN: 0, totalSemua: 0 }; }
};

// --- LOGIKA SCAN DARI GALERI ---
const fileInput = document.getElementById('input-qr-galeri');

if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Gunakan library Html5Qrcode untuk memindai file gambar
        const html5QrCode = new Html5Qrcode("reader"); 
        
        try {
            // Proses scan file
            const decodedText = await html5QrCode.scanFile(file, true);
            
            // Jika berhasil, kirim hasilnya ke fungsi absen yang sudah ada
            console.log("QR Galeri Terdeteksi:", decodedText);
            
            // Tutup scanner dulu sebelum memproses hasil
            if (typeof window.stopScanner === 'function') window.stopScanner();
            
            // Panggil fungsi utama absensi kamu
            if (typeof window.handleHasilScan === 'function') {
                window.handleHasilScan(decodedText);
            } else {
                // Jika nama fungsinya beda, sesuaikan di sini
                alert("QR Berhasil dibaca: " + decodedText);
            }

        } catch (err) {
            console.error("Gagal scan file:", err);
            alert("Gagal membaca QR Code. Pastikan foto jelas, terang, dan tidak terpotong.");
        } finally {
            // Reset input file agar bisa pilih foto yang sama lagi jika gagal
            fileInput.value = "";
        }
    });
}
