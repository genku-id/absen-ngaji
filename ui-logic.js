import { db } from './firebase-config.js';
import { collection, getDocs, query, where, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export const WILAYAH = {
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"]
};

// --- LOGIKA FORM REGISTRASI ---

const pDesa = document.getElementById('p-desa');
const pKelompok = document.getElementById('p-kelompok');
const pNama = document.getElementById('p-nama');

// 1. Update Dropdown Kelompok saat Desa dipilih
pDesa.addEventListener('change', () => {
    const kelompok = WILAYAH[pDesa.value] || [];
    pKelompok.innerHTML = '<option value="">-- Pilih Kelompok --</option>';
    kelompok.forEach(k => {
        pKelompok.innerHTML += `<option value="${k}">${k}</option>`;
    });
});

// 2. Fungsi Simpan Profil (Cek Master Data)
window.saveProfile = async () => {
    const nama = pNama.value.trim().toUpperCase();
    const desa = pDesa.value;
    const kelompok = pKelompok.value;

    if (!nama || !desa || !kelompok) return alert("Lengkapi data!");

    try {
        // Cek apakah nama sudah ada di users_master
        const q = query(collection(db, "users_master"), 
            where("desa", "==", desa),
            where("kelompok", "==", kelompok),
            where("nama", "==", nama)
        );
        
        const snap = await getDocs(q);

        if (snap.empty) {
            // Jika nama belum ada di database, otomatis tambahkan (Request-mu)
            await addDoc(collection(db, "users_master"), {
                nama: nama,
                desa: desa,
                kelompok: kelompok,
                createdAt: new Date()
            });
            console.log("Nama baru ditambahkan ke Master Data");
        }

        // Simpan ke Lokal HP (LocalStorage) agar bisa ganti akun nantinya
        const userBaru = { nama, desa, kelompok };
        let daftarAkun = JSON.parse(localStorage.getItem('accounts')) || [];
        
        // Cek agar tidak duplikat di list ganti akun
        if (!daftarAkun.some(a => a.nama === nama)) {
            daftarAkun.push(userBaru);
            localStorage.setItem('accounts', JSON.stringify(daftarAkun));
        }

        alert("Profil Berhasil Disimpan!");
        location.reload(); // Refresh untuk masuk ke tampilan utama
    } catch (e) {
        console.error("Error simpan profil:", e);
    }
};

document.getElementById('btn-save-profile').addEventListener('click', window.saveProfile);

// --- LOGIKA UI UMUM ---

window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
};

window.switchTab = (tabName) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.remove('hidden');
    event.currentTarget.classList.add('active');
};
