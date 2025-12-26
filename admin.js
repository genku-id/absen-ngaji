import { db } from "./firebase-config.js";
import { 
    doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, 
    writeBatch, serverTimestamp, onSnapshot, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. FUNGSI ADMINISTRASI UTAMA ---
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
    localStorage.removeItem('akun_aktif');
    sessionStorage.removeItem('role');
    location.reload();
};

// --- 2. PENGELOLAAN AKUN LOKAL ---
window.saveProfile = async () => {
    const n = document.getElementById('p-nama').value.trim();
    const d = document.getElementById('p-desa').value;
    const k = document.getElementById('p-kelompok').value;
    
    if(!n || !d || !k) return alert("Mohon lengkapi Desa, Kelompok, dan Nama!");
    
    try {
        const id = "USR-" + Date.now();
        const akun = { nama: n, desa: d, kelompok: k, id: id };
        
        const exists = window.masterCache.some(m => m.nama === n && m.kelompok === k);
        if(!exists) {
            await setDoc(doc(db, "master_jamaah", id), { ...akun, status: "Baru" });
        }

        let daftar = JSON.parse(localStorage.getItem('daftar_akun')) || [];
        daftar.push(akun);
        localStorage.setItem('daftar_akun', JSON.stringify(daftar));
        localStorage.setItem('akun_aktif', JSON.stringify(akun));

        alert("Profil Berhasil Disimpan!");
        location.reload();
    } catch (e) {
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
    if(confirm("Hapus akun ini dari daftar di HP ini?")) {
        let daftar = JSON.parse(localStorage.getItem('daftar_akun')) || [];
        daftar = daftar.filter(a => a.id !== id);
        localStorage.setItem('daftar_akun', JSON.stringify(daftar));
        location.reload();
    }
};

// --- 3. MANAJEMEN EVENT & QR ---
window.createNewEvent = async () => {
    const n = document.getElementById('ev-nama').value;
    const t = document.getElementById('ev-tgl').value;
    const j = document.getElementById('ev-jam').value;
    if(!n || !t || !j) return alert("Lengkapi data!");
    
    try {
        await setDoc(doc(db, "settings", "event_aktif"), { 
            id: "EVT-" + Date.now(), 
            status: "OPEN", 
            nama: n, 
            tanggal: t, 
            jam: j 
        });
        location.reload();
    } catch (e) { alert("Gagal: " + e.message); }
};

const generateAllQR = (eventID) => {
    const cAbsen = document.getElementById('canvas-absen');
    const cIzin = document.getElementById('canvas-izin');
    if (cAbsen && cIzin) {
        cAbsen.title = eventID + "|HADIR";
        cIzin.title = eventID + "|IZIN";
        QRCode.toCanvas(cAbsen, cAbsen.title, { width: 250, margin: 2 });
        QRCode.toCanvas(cIzin, cIzin.title, { width: 250, margin: 2 });
    }
};

window.closeEvent = async () => {
    const btn = document.getElementById('btn-tutup-event');
    if(!confirm("Tutup & Hitung ALFA otomatis?")) return;
    
    btn.innerText = "⏳ Memproses 400 Data...";
    btn.disabled = true;

    try {
        const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
        const cur = evSnap.data();
        const [mSn, aSn] = await Promise.all([
            getDocs(collection(db, "master_jamaah")),
            getDocs(query(collection(db, "attendance"), where("event", "==", cur.nama)))
        ]);
        
        const sudah = [];
        aSn.forEach(d => sudah.push(d.data().nama));

        const batch = writeBatch(db);
        let c = 0;
        mSn.forEach(docM => {
            if(!sudah.includes(docM.data().nama)) {
                batch.set(doc(collection(db, "attendance")), { 
                    ...docM.data(), tipe: "ALFA", event: cur.nama, timestamp: serverTimestamp() 
                });
                c++;
            }
        });

        await batch.commit();
        await setDoc(doc(db, "settings", "event_aktif"), { status: "CLOSED" });
        alert(`Berhasil! ${c} jamaah ditandai ALFA.`);
        location.reload();
    } catch (e) {
        alert("Error: " + e.message);
        btn.disabled = false;
        btn.innerText = "TUTUP & HITUNG ALFA";
    }
};

// --- 4. DATABASE MASTER & LAPORAN ---
window.hapusMaster = async (id) => {
    if(confirm("Hapus dari Database Master?")) {
        await deleteDoc(doc(db, "master_jamaah", id));
        location.reload();
    }
};

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

// --- 5. LOGIKA HALAMAN UTAMA (SINGLE LISTENER) ---
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load Master Data
        const mSn = await getDocs(collection(db, "master_jamaah"));
        window.masterCache = [];
        mSn.forEach(doc => window.masterCache.push(doc.data()));

        const role = sessionStorage.getItem('role');
        const aktif = localStorage.getItem('akun_aktif');
        const daftar = JSON.parse(localStorage.getItem('daftar_akun')) || [];

        // Reset Tampilan
        document.querySelectorAll('.card').forEach(c => c.classList.add('hidden'));

        if(role === 'admin') {
            document.getElementById('admin-section').classList.remove('hidden');
            const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
            if (evSnap.exists() && evSnap.data().status === "OPEN") {
                document.getElementById('setup-box').classList.add('hidden');
                document.getElementById('qr-box').classList.remove('hidden');
                generateAllQR(evSnap.data().id);
            }
            window.loadReports();
        } else if(aktif) {
            document.getElementById('peserta-section').classList.remove('hidden');
            window.tampilkanSalam();
        } else if(daftar.length > 0) {
            document.getElementById('pilih-akun-section').classList.remove('hidden');
            const contPilih = document.getElementById('list-akun-pilihan');
            contPilih.innerHTML = "";
            daftar.forEach(x => {
                contPilih.innerHTML += `
                    <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center;">
                        <button onclick="pilihAkun('${x.id}')" class="btn-pilih-akun">
                            <span>👤</span> ${x.nama}
                        </button>
                        <button onclick="hapusAkunLokal('${x.id}')" style="width: 50px; height: 50px; background: #ff4757; color: white; border-radius: 10px; border: none; font-weight: bold;">X</button>
                    </div>`;
            });
        } else {
            document.getElementById('modal-tambah').classList.remove('hidden');
        }
    } catch (e) { console.error("Error Load:", e); }
});

// Fungsi Pendukung QR
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
