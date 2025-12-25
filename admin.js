import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch, serverTimestamp, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    // Hanya hapus akun yang sedang aktif/dipakai
    localStorage.removeItem('akun_aktif');
    // Jika admin, hapus juga rolenya
    sessionStorage.removeItem('role');
    location.reload();
};

// Tambahkan juga fungsi hapus akun dari daftar (tombol X)
window.hapusAkunLokal = (id) => {
    if(confirm("Hapus akun ini dari daftar di HP ini?")) {
        let daftar = JSON.parse(localStorage.getItem('daftar_akun')) || [];
        daftar = daftar.filter(a => a.id !== id);
        localStorage.setItem('daftar_akun', JSON.stringify(daftar));
        location.reload();
    }
};

// Fungsi untuk memilih akun dari daftar
window.pilihAkun = (id) => {
    let daftar = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    const akun = daftar.find(a => a.id === id);
    if(akun) {
        localStorage.setItem('akun_aktif', JSON.stringify(akun));
        location.reload();
    }
};

window.createNewEvent = async () => {
    const n = document.getElementById('ev-nama').value;
    const t = document.getElementById('ev-tgl').value;
    const j = document.getElementById('ev-jam').value;
    if(!n || !t || !j) return alert("Lengkapi data!");
    await setDoc(doc(db, "settings", "event_aktif"), { id: "EVT-"+Date.now(), status: "OPEN", nama: n, tanggal: t, jam: j });
    location.reload();
};

window.closeEvent = async () => {
    const btn = document.getElementById('btn-tutup-event');
    if(!confirm("Tutup & Hitung Alfa?")) return;
    
    btn.innerText = "⏳ Memproses 400 Data...";
    btn.disabled = true;

    try {
        const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
        const cur = evSnap.data();
        const masterSn = await getDocs(collection(db, "master_jamaah"));
        const absenSn = await getDocs(query(collection(db, "attendance"), where("event", "==", cur.nama)));
        
        const sudah = [];
        absenSn.forEach(d => sudah.push(d.data().nama));

        const batch = writeBatch(db);
        masterSn.forEach(docM => {
            if(!sudah.includes(docM.data().nama)) {
                batch.set(doc(collection(db, "attendance")), { ...docM.data(), tipe: "ALFA", event: cur.nama, timestamp: serverTimestamp() });
            }
        });

        await batch.commit();
        await setDoc(doc(db, "settings", "event_aktif"), { status: "CLOSED" });
        alert("Berhasil!");
        location.reload();
    } catch (e) {
        alert("Error: " + e.message);
        btn.disabled = false;
        btn.innerText = "TUTUP & HITUNG ALFA";
    }
};

// Pemicu tampilan saat halaman dimuat
window.addEventListener('DOMContentLoaded', async () => {
    const role = sessionStorage.getItem('role');
    const aktif = localStorage.getItem('akun_aktif');
    
    if(role === 'admin') {
        document.getElementById('admin-section').classList.remove('hidden');
    } else if(aktif) {
        document.getElementById('peserta-section').classList.remove('hidden');
    } else {
        document.getElementById('pilih-akun-section').classList.remove('hidden');
    }
});
// --- BAGIAN PENARIK DATA MASTER UNTUK SARAN NAMA ---
window.addEventListener('DOMContentLoaded', async () => {
    try {
        // ... kode penarik data master yang sudah ada ...
        const mSn = await getDocs(collection(db, "master_jamaah"));
        window.masterCache = [];
        mSn.forEach(doc => window.masterCache.push(doc.data()));

    const daftar = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    const contPilih = document.getElementById('list-akun-pilihan');

    if(role === 'admin') {
        document.getElementById('admin-section').classList.remove('hidden');
    } else if(aktif) {
        document.getElementById('peserta-section').classList.remove('hidden');
        window.tampilkanSalam();
    } else if(daftar.length > 0) {
        // Tampilkan halaman pilih akun jika ada daftar nama tersimpan
        document.getElementById('pilih-akun-section').classList.remove('hidden');
        contPilih.innerHTML = "";
        
        daftar.forEach(x => {
            contPilih.innerHTML += `
                <div style="display: flex; gap: 5px; margin-bottom: 10px;">
                    <button onclick="pilihAkun('${x.id}')" style="flex: 1; text-align: left; padding: 12px; background: #f8f9fa; color: #333; border: 1px solid #ddd; border-radius: 8px; font-weight: bold;">
                        👤 ${x.nama}
                    </button>
                    <button onclick="hapusAkunLokal('${x.id}')" style="width: 45px; background: #e74c3c; color: white; border-radius: 8px; border: none; font-weight: bold;">
                        X
                    </button>
                </div>
            `;
        });
    } else {
        // Jika benar-benar kosong, baru tampilkan form registrasi
        document.getElementById('modal-tambah').classList.remove('hidden');
    }

        // Logika tampilan halaman
        const role = sessionStorage.getItem('role');
        const aktif = localStorage.getItem('akun_aktif');
        
        if(role === 'admin') {
            document.getElementById('admin-section').classList.remove('hidden');
        } else if(aktif) {
            document.getElementById('peserta-section').classList.remove('hidden');
            window.tampilkanSalam(); // <--- TAMBAHKAN INI
        } else {
            document.getElementById('pilih-akun-section').classList.remove('hidden');
        }
    } catch (e) {
        console.error("Error load data: ", e);
    }
});

// Pastikan fungsi simpan profil juga bisa menambah database baru jika nama belum ada
window.saveProfile = async () => {
    const n = document.getElementById('p-nama').value.trim();
    const d = document.getElementById('p-desa').value;
    const k = document.getElementById('p-kelompok').value;
    if(!n || !d || !k) return alert("Lengkapi data!");
    
    const id = "USR-" + Date.now();
    const akun = { nama: n, desa: d, kelompok: k, id: id };
    
    // Cek apakah nama sudah ada di database master
    const exists = window.masterCache.some(m => m.nama === n && m.kelompok === k);
    
    // Jika belum ada, simpan sebagai database master baru
    if(!exists) {
        await setDoc(doc(db, "master_jamaah", id), { ...akun, status: "Baru" });
    }

    let list = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    list.push(akun);
    localStorage.setItem('daftar_akun', JSON.stringify(list));
    localStorage.setItem('akun_aktif', JSON.stringify(akun));
    location.reload();
};
