import { db } from './firebase-config.js';
import { collection, getDocs, query, where, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// Tampilan awal: Cek apakah sudah ada akun tersimpan
async function initApp() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        showScanner(JSON.parse(savedUser));
    } else {
        showPageRegistrasi();
    }
}

// Fungsi Registrasi dengan Suggestion
const dataWilayah = {
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"]
};

window.showPageRegistrasi = () => {
    const content = document.getElementById('app-content');
    content.innerHTML = `
        <div class="card">
            <h2>Masuk Peserta</h2>
            <select id="reg-desa">
                <option value="">Pilih Desa</option>
                ${Object.keys(dataWilayah).map(desa => `<option value="${desa}">${desa}</option>`).join('')}
            </select>
            <select id="reg-kelompok" disabled>
                <option value="">Pilih Kelompok</option>
            </select>
            <input type="text" id="reg-nama" placeholder="Ketik Nama Anda..." list="list-nama" disabled>
            <datalist id="list-nama"></datalist>
            <button onclick="prosesLogin()" class="primary-btn">Mulai Scan</button>
        </div>
    `;

    const desaSelect = document.getElementById('reg-desa');
    const kelSelect = document.getElementById('reg-kelompok');
    const namaInput = document.getElementById('reg-nama');

    desaSelect.onchange = () => {
        const kelompok = dataWilayah[desaSelect.value] || [];
        kelSelect.innerHTML = '<option value="">Pilih Kelompok</option>' + 
                              kelompok.map(k => `<option value="${k}">${k}</option>`).join('');
        kelSelect.disabled = false;
        namaInput.disabled = true;
    };

    kelSelect.onchange = () => {
        namaInput.disabled = false;
    };

    // Fitur Saran Nama tetap sama seperti sebelumnya
   // Pastikan bagian ini ada di dalam logic input nama
namaInput.oninput = async () => {
    const desaVal = desaSelect.value;
    const kelVal = kelSelect.value;
    const inputVal = namaInput.value;

    if (inputVal.length >= 2) { // Saran muncul setelah ketik 2 huruf
        try {
            // Mencari di database yang Desa dan Kelompoknya cocok
            const q = query(
                collection(db, "users"), 
                where("desa", "==", desaVal),
                where("kelompok", "==", kelVal)
            );
            
            const snap = await getDocs(q);
            listNama.innerHTML = ""; // Bersihkan saran lama
            
            snap.forEach(doc => {
                const data = doc.data();
                // Filter manual agar lebih akurat dengan apa yang diketik
                if (data.nama.toLowerCase().includes(inputVal.toLowerCase())) {
                    let opt = document.createElement('option');
                    opt.value = data.nama; 
                    listNama.appendChild(opt);
                }
            });
            console.log("Saran nama diperbarui dari database");
        } catch (error) {
            console.error("Gagal ambil saran nama:", error);
        }
    }
};
};
window.prosesLogin = async () => {
    const nama = document.getElementById('reg-nama').value;
    const desa = document.getElementById('reg-desa').value;
    const kelompok = document.getElementById('reg-kelompok').value;

    if (!nama || !desa || !kelompok) return alert("Lengkapi data!");

    // Logika simpan user ke database tetap sama...
    
    const userData = { nama, desa, kelompok };
    localStorage.setItem('currentUser', JSON.stringify(userData));
    
    // Panggil fungsi scanner
    showScanner(userData);
};

initApp();
// Tambahkan import ini di baris paling atas app.js jika belum ada


let html5QrCode;

window.showScanner = (userData) => {
    const content = document.getElementById('app-content');
    content.innerHTML = `
        <div class="card">
            <h3>Halo, ${userData.nama}</h3>
            <p>Silakan scan Barcode Absensi/Izin</p>
            <div id="reader" style="width: 100%"></div>
            <button onclick="showPageRegistrasi()" class="secondary-btn">Ganti Akun</button>
        </div>
    `;

    html5QrCode = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start({ facingMode: "environment" }, config, async (decodedText) => {
        // Berhenti scan setelah dapet kode
        await html5QrCode.stop();
        prosesAbsensi(decodedText, userData);
    });
};

async function prosesAbsensi(eventID, userData) {
    try {
        // Simpan ke collection 'attendance'
        const attendanceID = `${eventID}_${userData.nama.replace(/\s/g, '')}`;
        await setDoc(doc(db, "attendance", attendanceID), {
            nama: userData.nama,
            desa: userData.desa,
            kelompok: userData.kelompok,
            eventId: eventID,
            waktu: serverTimestamp(),
            status: "hadir"
        });

        // Tampilkan Lancar Barokah
        const overlay = document.getElementById('success-overlay');
        overlay.style.display = 'flex';

        // Hilangkan overlay setelah 3 detik dan buka scanner lagi
        setTimeout(() => {
            overlay.style.display = 'none';
            showScanner(userData); 
        }, 3000);

    } catch (e) {
        alert("Gagal absen: " + e.message);
        showScanner(userData);
    }
}
