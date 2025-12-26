import { db } from "./firebase-config.js";
import { getDoc, doc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- LOGIN & LOGOUT GLOBAL ---
window.loginAdmin = () => {
    const pin = prompt("Kode Admin:");
    if(pin === "1234") { 
        sessionStorage.setItem('role', 'admin'); 
        location.reload(); 
    } else if(pin !== null) {
        alert("PIN Salah!");
    }
};

window.logout = () => {
    // Hanya hapus akun aktif, daftar pilihan tetap ada
    localStorage.removeItem('akun_aktif');
    sessionStorage.removeItem('role');
    location.reload();
};

// --- LOGIKA TAMPILAN UTAMA ---
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Load Master Data (untuk autocomplete registrasi)
        const mSn = await getDocs(collection(db, "master_jamaah"));
        window.masterCache = mSn.docs.map(d => d.data());

        const role = sessionStorage.getItem('role');
        const aktif = localStorage.getItem('akun_aktif');
        const daftar = JSON.parse(localStorage.getItem('daftar_akun')) || [];

        // Sembunyikan semua section
        document.querySelectorAll('.card, .tab-content').forEach(c => c.classList.add('hidden'));

        // 2. Cek Role Admin
        if(role === 'admin') {
            document.getElementById('admin-section').classList.remove('hidden');
            document.getElementById('tab-event').classList.remove('hidden');
            
            // Panggil filter laporan dari admin-laporan.js
            if(window.filterLaporan) window.filterLaporan();
            
            const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
            if (evSnap.exists() && evSnap.data().status === "OPEN") {
                document.getElementById('setup-box').classList.add('hidden');
                document.getElementById('qr-box').classList.remove('hidden');
                
                // Panggil generator QR dari admin-event.js
                setTimeout(() => {
                    if(window.generateAllQR) window.generateAllQR(evSnap.data().id);
                }, 1000);
            }
        } 
        // 3. Cek Jika Sudah Login (Masuk Scanner)
        else if(aktif) {
            document.getElementById('peserta-section').classList.remove('hidden');
            if(window.tampilkanSalam) window.tampilkanSalam();
        } 
        // 4. Cek Jika Ada Daftar Akun (Masuk Pilih Nama)
        else if(daftar.length > 0) {
            document.getElementById('pilih-akun-section').classList.remove('hidden');
            const cp = document.getElementById('list-akun-pilihan');
            cp.innerHTML = "";
            daftar.forEach(x => {
                cp.innerHTML += `
                <div style="display:flex; gap:8px; margin-bottom:12px; align-items:center;">
                    <button onclick="pilihAkun('${x.id}')" class="btn-pilih-akun">
                        <span style="color:#333;">👤 ${x.nama}</span>
                    </button>
                    <button onclick="hapusAkunLokal('${x.id}')" style="width:50px; height:50px; background:#ff4757; color:white; border-radius:10px; border:none; font-weight:bold; cursor:pointer;">X</button>
                </div>`;
            });
        } 
        // 5. Belum ada akun sama sekali (Masuk Registrasi)
        else {
            document.getElementById('modal-tambah').classList.remove('hidden');
        }
    } catch (e) {
        console.error("Gagal memuat aplikasi:", e);
    }
});

// Fungsi pilih akun dari list
window.pilihAkun = (id) => {
    const daftar = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    const akun = daftar.find(a => a.id === id);
    if(akun) {
        localStorage.setItem('akun_aktif', JSON.stringify(akun));
        location.reload();
    }
};

// Fungsi hapus satu akun dari list (Tombol X)
window.hapusAkunLokal = (id) => {
    if(confirm("Hapus nama ini dari daftar HP ini?")) {
        let d = JSON.parse(localStorage.getItem('daftar_akun')) || [];
        d = d.filter(a => a.id !== id);
        localStorage.setItem('daftar_akun', JSON.stringify(d));
        location.reload();
    }
};
