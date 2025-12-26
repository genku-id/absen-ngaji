import { db } from './firebase-config.js';
import { collection, getDocs, query, where, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
    namaInput.oninput = async () => {
        if (namaInput.value.length < 2) return;
        const q = query(collection(db, "users"), 
                  where("desa", "==", desaSelect.value),
                  where("kelompok", "==", kelSelect.value));
        
        const snap = await getDocs(q);
        const list = document.getElementById('list-nama');
        list.innerHTML = "";
        snap.forEach(doc => {
            let opt = document.createElement('option');
            opt.value = doc.data().nama;
            list.appendChild(opt);
        });
    };
};
window.prosesLogin = async () => {
    const nama = document.getElementById('reg-nama').value;
    const desa = document.getElementById('reg-desa').value;
    const kelompok = document.getElementById('reg-kelompok').value;

    if (!nama || !desa || !kelompok) return alert("Lengkapi data!");

    // Cek di database, jika tidak ada, otomatis tambah
    const q = query(collection(db, "users"), where("nama", "==", nama));
    const snap = await getDocs(q);
    if (snap.empty) {
        await addDoc(collection(db, "users"), { nama, desa, kelompok });
    }

    const userData = { nama, desa, kelompok };
    localStorage.setItem('currentUser', JSON.stringify(userData));
    showScanner(userData);
};

initApp();
