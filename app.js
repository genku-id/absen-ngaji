import { db } from './firebase-config.js';
import { collection, getDocs, query, where, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Fungsi untuk menampilkan halaman
window.showPage = (pageName) => {
    const content = document.getElementById('app-content');
    if (pageName === 'registrasi') {
        content.innerHTML = `
            <div class="card">
                <h2>Registrasi Peserta</h2>
                <select id="reg-desa">
                    <option value="">Pilih Desa</option>
                    <option value="Wates">Wates</option>
                    <option value="Sentolo">Sentolo</option>
                </select>
                <select id="reg-kelompok" disabled>
                    <option value="">Pilih Kelompok</option>
                </select>
                <input type="text" id="reg-nama" placeholder="Ketik Nama Anda..." list="list-nama" disabled>
                <datalist id="list-nama"></datalist>
                <button id="btn-masuk" class="primary-btn">Masuk ke Scanner</button>
            </div>
        `;
        setupRegLogic();
    }
};

function setupRegLogic() {
    const desaSelect = document.getElementById('reg-desa');
    const kelompokSelect = document.getElementById('reg-kelompok');
    const namaInput = document.getElementById('reg-nama');
    const listNama = document.getElementById('list-nama');

    // Contoh logika aktifkan kelompok setelah pilih desa
    desaSelect.addEventListener('change', () => {
        kelompokSelect.disabled = false;
        // Kamu bisa isi daftar kelompok berdasarkan desa di sini
    });

    // Logika Auto-suggest Nama dari Firebase
    namaInput.addEventListener('input', async (e) => {
        const val = e.target.value;
        if (val.length > 1) {
            const q = query(collection(db, "users"), 
                      where("desa", "==", desaSelect.value),
                      where("kelompok", "==", kelompokSelect.value));
            
            const querySnapshot = await getDocs(q);
            listNama.innerHTML = "";
            querySnapshot.forEach((doc) => {
                const option = document.createElement('option');
                option.value = doc.data().nama;
                listNama.appendChild(option);
            });
        }
    });
}

// Jalankan halaman registrasi saat pertama buka
showPage('registrasi');
