import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch, serverTimestamp, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// FUNGSI LOGIN & LOGOUT
window.loginAdmin = () => {
    const pin = prompt("Kode Admin:");
    if(pin === "1234") { sessionStorage.setItem('role', 'admin'); location.reload(); }
};

window.logout = () => {
    localStorage.removeItem('akun_aktif');
    sessionStorage.removeItem('role');
    location.reload();
};

// PENGELOLAAN AKUN LOKAL
// admin.js

window.saveProfile = async () => {
    const n = document.getElementById('p-nama').value.trim();
    const d = document.getElementById('p-desa').value;
    const k = document.getElementById('p-kelompok').value;
    
    if(!n || !d || !k) return alert("Mohon lengkapi Desa, Kelompok, dan Nama!");
    
    try {
        const id = "USR-" + Date.now();
        const akun = { nama: n, desa: d, kelompok: k, id: id };
        
        // 1. Simpan ke Database Master jika belum ada
        const exists = window.masterCache.some(m => m.nama === n && m.kelompok === k);
        if(!exists) {
            await setDoc(doc(db, "master_jamaah", id), { ...akun, status: "Baru" });
        }

        // 2. Simpan ke Daftar Akun Lokal (agar tidak hilang saat ganti akun)
        let daftar = JSON.parse(localStorage.getItem('daftar_akun')) || [];
        daftar.push(akun);
        localStorage.setItem('daftar_akun', JSON.stringify(daftar));

        // 3. Set sebagai Akun Aktif
        localStorage.setItem('akun_aktif', JSON.stringify(akun));

        alert("Profil Berhasil Disimpan!");
        location.reload();
    } catch (e) {
        console.error("Gagal simpan profil: ", e);
        alert("Gagal menyimpan: " + e.message);
    }
};
window.pilihAkun = (id) => {
    const daftar = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    const akun = daftar.find(a => a.id === id);
    if(akun) {
        localStorage.setItem('akun_aktif', JSON.stringify(akun));
        location.reload();
    }
};

window.hapusAkunLokal = (id) => {
    if(confirm("Hapus akun ini dari daftar?")) {
        let daftar = JSON.parse(localStorage.getItem('daftar_akun')) || [];
        daftar = daftar.filter(a => a.id !== id);
        localStorage.setItem('daftar_akun', JSON.stringify(daftar));
        location.reload();
    }
};

// LOGIKA HALAMAN UTAMA (INI YANG MENENTUKAN TAMPILAN TENGAH)
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load Master Database untuk Saran Nama
        const mSn = await getDocs(collection(db, "master_jamaah"));
        window.masterCache = [];
        mSn.forEach(doc => window.masterCache.push(doc.data()));

        const role = sessionStorage.getItem('role');
        const aktif = localStorage.getItem('akun_aktif');
        const daftar = JSON.parse(localStorage.getItem('daftar_akun')) || [];
        const contPilih = document.getElementById('list-akun-pilihan');

        // Sembunyikan semua dulu
        document.getElementById('admin-section').classList.add('hidden');
        document.getElementById('peserta-section').classList.add('hidden');
        document.getElementById('pilih-akun-section').classList.add('hidden');
        document.getElementById('modal-tambah').classList.add('hidden');

        if(role === 'admin') {
            document.getElementById('admin-section').classList.remove('hidden');
            window.loadReports();
        } else if(aktif) {
            document.getElementById('peserta-section').classList.remove('hidden');
            window.tampilkanSalam();
        } else if(daftar.length > 0) {
            document.getElementById('pilih-akun-section').classList.remove('hidden');
            contPilih.innerHTML = "";
            daftar.forEach(x => {
                contPilih.innerHTML += `
                    <div style="display: flex; gap: 8px; margin-bottom: 12px;">
                        <button onclick="pilihAkun('${x.id}')" style="flex: 1; text-align: left; padding: 15px; background: #fff; border: 2px solid #eee; border-radius: 10px; font-weight: bold; cursor: pointer;">
                            👤 ${x.nama}
                        </button>
                        <button onclick="hapusAkunLokal('${x.id}')" style="width: 50px; background: #ff4757; color: white; border-radius: 10px; border: none; font-weight: bold; cursor: pointer;">
                            X
                        </button>
                    </div>`;
            });
        } else {
            document.getElementById('modal-tambah').classList.remove('hidden');
        }
    } catch (e) { console.error(e); }
});

// LOAD LAPORAN (KHUSUS ADMIN)
window.loadReports = () => {
    const cont = document.getElementById('report-list-cont');
    if(!cont) return;
    onSnapshot(query(collection(db, "attendance"), orderBy("timestamp", "desc")), (sn) => {
        cont.innerHTML = "";
        sn.forEach(doc => {
            const r = doc.data();
            cont.innerHTML += `<div class="report-item"><b>${r.nama}</b><span>${r.tipe}</span></div>`;
        });
    });
};
