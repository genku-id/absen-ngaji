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
window.prosesRekapDanReset = async (wilayah, role) => {
    try {
        const d = new Date();
        const bulanSekarang = d.getMonth() + 1;
        const tahunSekarang = d.getFullYear();

        // 1. CARI SEMUA DATA ATTENDANCE BERDASARKAN LEVEL ADMIN
        let q;
        if (role === "KELOMPOK") {
            // Admin Kelompok hanya melihat & menghapus orang di kelompoknya sendiri
            q = query(collection(db, "attendance"), where("kelompok", "==", wilayah));
        } else if (role === "DESA") {
            // Admin Desa hanya melihat & menghapus orang di desanya sendiri
            q = query(collection(db, "attendance"), where("desa", "==", wilayah));
        } else if (role === "DAERAH") {
            // Admin Daerah melihat semua data (atau bisa kamu filter per wilayah event jika perlu)
            // Di sini kita asumsikan Daerah menghapus SEMUA data attendance saat ini
            q = collection(db, "attendance");
        }

        const snap = await getDocs(q);
        const allAtt = snap.docs.map(d => ({id: d.id, ...d.data()}));

        if (allAtt.length > 0) {
            // 2. LOGIKA REKAP KHUSUS ADMIN KELOMPOK
            if (role === "KELOMPOK") {
                const docRekapId = `REKAP_${wilayah.replace(/\s/g, '')}_${tahunSekarang}_${bulanSekarang}`;
                const hitungHadir = (kls) => allAtt.filter(a => a.kelas === kls && a.status === 'hadir').length;
                const uniqueEvents = [...new Set(allAtt.map(a => a.eventId))].length;

                const rekapRef = doc(db, "rekap_bulanan", docRekapId);
                const rekapSnap = await getDoc(rekapRef);

                if (rekapSnap.exists()) {
                    const old = rekapSnap.data();
                    await setDoc(rekapRef, {
                        hadirPR: (old.hadirPR || 0) + hitungHadir("PRA-REMAJA"),
                        hadirR: (old.hadirR || 0) + hitungHadir("REMAJA"),
                        hadirPN: (old.hadirPN || 0) + hitungHadir("PRA-NIKAH"),
                        jumlahPertemuan: (old.jumlahPertemuan || 0) + uniqueEvents,
                        lastUpdate: serverTimestamp()
                    }, { merge: true });
                } else {
                    await setDoc(rekapRef, {
                        wilayah: wilayah, role: role, bulan: bulanSekarang, tahun: tahunSekarang,
                        hadirPR: hitungHadir("PRA-REMAJA"), hadirR: hitungHadir("REMAJA"), hadirPN: hitungHadir("PRA-NIKAH"),
                        jumlahPertemuan: uniqueEvents, lastUpdate: serverTimestamp()
                    });
                }
            }

            // 3. PROSES HAPUS (Cleaning) - Berlaku untuk SEMUA level admin
            const promises = snap.docs.map(d => deleteDoc(doc(db, "attendance", d.id)));
            await Promise.all(promises);
        }
        return true;
    } catch (e) {
        console.error("Gagal Rekap & Reset:", e);
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
        return {
            totalPR: data.filter(j => j.kelas === "PRA-REMAJA").length,
            totalR: data.filter(j => j.kelas === "REMAJA").length,
            totalPN: data.filter(j => j.kelas === "PRA-NIKAH").length
        };
    } catch (e) { return { totalPR: 0, totalR: 0, totalPN: 0 }; }
};
