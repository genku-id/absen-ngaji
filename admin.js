import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch, serverTimestamp, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Sisa kode ke bawah sudah benar...
window.closeEvent = async () => {
    // Cari tombolnya berdasarkan ID yang ada di HTML
    const btn = document.getElementById('btn-tutup-event');
    
    if(!confirm("Yakin ingin menutup absen? Sistem akan menghitung ALFA untuk 400 jamaah secara otomatis.")) return;
    
    // Beri tanda loading agar admin tahu proses sedang berjalan
    if(btn) {
        btn.innerText = "⏳ Memproses Data... Mohon Tunggu";
        btn.disabled = true;
        btn.style.background = "#bdc3c7";
    }

    try {
        // 1. Ambil data event yang sedang aktif
        const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
        if (!evSnap.exists()) throw new Error("Tidak ada event aktif.");
        const cur = evSnap.data();

        // 2. Ambil SEMUA data jamaah (Master) dan data yang SUDAH ABSEN
        const [masterSn, absenSn] = await Promise.all([
            getDocs(collection(db, "master_jamaah")),
            getDocs(query(collection(db, "attendance"), where("event", "==", cur.nama)))
        ]);
        
        // Buat daftar nama yang sudah hadir/izin
        const sudahAbsen = [];
        absenSn.forEach(d => sudahAbsen.push(d.data().nama));

        // 3. Mulai proses penulisan massal (Batch)
        const batch = writeBatch(db);
        let jumlahAlfa = 0;

        masterSn.forEach(docM => {
            const dataMaster = docM.data();
            // Jika nama di master TIDAK ADA di daftar sudah absen
            if(!sudahAbsen.includes(dataMaster.nama)) {
                const newRef = doc(collection(db, "attendance"));
                batch.set(newRef, { 
                    ...dataMaster, 
                    tipe: "ALFA", 
                    event: cur.nama, 
                    timestamp: serverTimestamp() 
                });
                jumlahAlfa++;
            }
        });

        // 4. Kirim semua data sekaligus & tutup status event
        await batch.commit();
        await setDoc(doc(db, "settings", "event_aktif"), { status: "CLOSED" });
        
        alert(`Berhasil! Absen ditutup dan ${jumlahAlfa} jamaah otomatis ALFA.`);
        location.reload();

    } catch (e) {
        console.error("Gagal menutup event:", e);
        alert("Terjadi kesalahan: " + e.message);
        if(btn) {
            btn.innerText = "TUTUP & HITUNG ALFA";
            btn.disabled = false;
            btn.style.background = "#ff4757";
        }
    }
};

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
            // Cari bagian loop daftar akun di admin.js kamu
            daftar.forEach(x => {
            contPilih.innerHTML += `
                <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center;">
                    <button onclick="pilihAkun('${x.id}')" class="btn-pilih-akun">
                        <span style="font-size: 18px;">👤</span> ${x.nama}
                    </button>
                    <button onclick="hapusAkunLokal('${x.id}')" style="width: 50px; height: 50px; background: #ff4757; color: white; border-radius: 10px; border: none; font-weight: bold; cursor: pointer;">
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

// admin.js

// 1. Fungsi Aktifkan QR (Membuat Event Baru)
window.createNewEvent = async () => {
    const n = document.getElementById('ev-nama').value;
    const t = document.getElementById('ev-tgl').value;
    const j = document.getElementById('ev-jam').value;
    
    if(!n || !t || !j) return alert("Lengkapi Nama Acara, Tanggal, dan Jam!");
    
    try {
        const eventID = "EVT-" + Date.now();
        await setDoc(doc(db, "settings", "event_aktif"), { 
            id: eventID, 
            status: "OPEN", 
            nama: n, 
            tanggal: t, 
            jam: j 
        });
        
        alert("Event Berhasil Diaktifkan!");
        location.reload(); // Reload untuk memicu generator QR di DOMContentLoaded
    } catch (e) {
        alert("Gagal: " + e.message);
    }
};

// 2. Fungsi Generator QR (Dipanggil otomatis saat halaman load jika admin)
const generateAllQR = (eventID) => {
    const cAbsen = document.getElementById('canvas-absen');
    const cIzin = document.getElementById('canvas-izin');
    
    if (cAbsen && cIzin) {
        // Simpan data ID ke dalam properti title untuk referensi download/modal
        cAbsen.title = eventID + "|HADIR";
        cIzin.title = eventID + "|IZIN";

        // Gunakan library QRCode yang sudah di-load di index.html
        QRCode.toCanvas(cAbsen, cAbsen.title, { width: 250, margin: 2 });
        QRCode.toCanvas(cIzin, cIzin.title, { width: 250, margin: 2 });
    }
};

// 3. Pastikan Fungsi Pendukung QR ada di window
window.downloadQR = (id, file) => {
    const canvas = document.getElementById(id);
    const link = document.createElement('a');
    link.download = file + '.png';
    link.href = canvas.toDataURL("image/png");
    link.click();
};

window.showFullQR = (id, title) => {
    document.getElementById('full-qr-modal').classList.remove('hidden');
    document.getElementById('full-title').innerText = title;
    const source = document.getElementById(id);
    QRCode.toCanvas(document.getElementById('full-canvas'), source.title, { width: 500 });
};

// 4. Update bagian DOMContentLoaded di admin.js
window.addEventListener('DOMContentLoaded', async () => {
    // ... kode masterCache tetap sama ...
    
    const role = sessionStorage.getItem('role');
    if (role === 'admin') {
        const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
        if (evSnap.exists() && evSnap.data().status === "OPEN") {
            document.getElementById('setup-box').classList.add('hidden');
            document.getElementById('qr-box').classList.remove('hidden');
            
            // JALANKAN GENERATOR QR
            generateAllQR(evSnap.data().id);
            window.loadReports();
        }
    }
});
