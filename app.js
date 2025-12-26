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
window.showPageRegistrasi = () => {
    const content = document.getElementById('app-content');
    content.innerHTML = `
        <div class="card">
            <h2>Masuk Peserta</h2>
            <select id="reg-desa">
                <option value="">Pilih Desa</option>
                <option value="Wates">Wates</option>
                <option value="Sentolo">Sentolo</option> </select>
            <select id="reg-kelompok" disabled>
                <option value="">Pilih Kelompok</option>
                <option value="Kelompok 1">Kelompok 1</option>
                <option value="Kelompok 2">Kelompok 2</option>
            </select>
            <input type="text" id="reg-nama" placeholder="Ketik Nama Anda..." list="list-nama" disabled>
            <datalist id="list-nama"></datalist>
            <button onclick="prosesLogin()" class="primary-btn">Mulai Scan</button>
        </div>
    `;

    const desa = document.getElementById('reg-desa');
    const kelompok = document.getElementById('reg-kelompok');
    const nama = document.getElementById('reg-nama');

    desa.onchange = () => { kelompok.disabled = false; };
    kelompok.onchange = () => { nama.disabled = false; };

    // Fitur Saran Nama (Auto-suggest)
    nama.oninput = async () => {
        if (nama.value.length < 2) return;
        const q = query(collection(db, "users"), 
                  where("desa", "==", desa.value),
                  where("kelompok", "==", kelompok.value));
        
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
