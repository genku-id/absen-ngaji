import { db } from './firebase-config.js';
import { collection, getDocs, query, where, addDoc, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const dataWilayah = {
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"]
};

let html5QrCode;

// --- 1. FUNGSI REGISTRASI ---
window.showPageRegistrasi = () => {
    localStorage.removeItem('currentUser');
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
            <button id="btn-login" class="primary-btn">Mulai Scan</button>
        </div>
    `;

    const desaSel = document.getElementById('reg-desa');
    const kelSel = document.getElementById('reg-kelompok');
    const namaInp = document.getElementById('reg-nama');

    desaSel.onchange = () => {
        const kelompok = dataWilayah[desaSel.value] || [];
        kelSel.innerHTML = '<option value="">Pilih Kelompok</option>' + 
                           kelompok.map(k => `<option value="${k}">${k}</option>`).join('');
        kelSel.disabled = false;
    };

    kelSel.onchange = () => { namaInp.disabled = false; };

    // Logika Saran Nama
    namaInp.oninput = async () => {
        if (namaInp.value.length < 2) return;
        const q = query(collection(db, "users"), 
                  where("desa", "==", desaSel.value),
                  where("kelompok", "==", kelSel.value));
        const snap = await getDocs(q);
        const list = document.getElementById('list-nama');
        list.innerHTML = "";
        snap.forEach(d => {
            let opt = document.createElement('option');
            opt.value = d.data().nama;
            list.appendChild(opt);
        });
    };

    document.getElementById('btn-login').onclick = prosesLogin;
};

// --- 2. FUNGSI LOGIN ---
async function prosesLogin() {
    const nama = document.getElementById('reg-nama').value.toUpperCase();
    const desa = document.getElementById('reg-desa').value;
    const kelompok = document.getElementById('reg-kelompok').value;

    if (!nama || !desa || !kelompok) return alert("Lengkapi data!");

    const q = query(collection(db, "users"), where("nama", "==", nama));
    const snap = await getDocs(q);
    if (snap.empty) {
        await addDoc(collection(db, "users"), { nama, desa, kelompok });
    }

    const userData = { nama, desa, kelompok };
    localStorage.setItem('currentUser', JSON.stringify(userData));
    showScanner(userData);
}

// --- 3. FUNGSI SCANNER ---
window.showScanner = (userData) => {
    const content = document.getElementById('app-content');
    content.innerHTML = `
        <div class="card">
            <h3>Halo, ${userData.nama}</h3>
            <div id="reader" style="width: 100%"></div>
            <button id="btn-ganti" class="secondary-btn">Ganti Akun</button>
        </div>
    `;

    document.getElementById('btn-ganti').onclick = showPageRegistrasi;

    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, 
        async (decodedText) => {
            await html5QrCode.stop();
            prosesAbsensi(decodedText, userData);
        }
    ).catch(err => console.error("Kamera Error:", err));
};

// --- 4. FUNGSI ABSENSI ---
async function prosesAbsensi(eventID, userData) {
    try {
        const attendanceID = `${eventID}_${userData.nama.replace(/\s/g, '')}`;
        await setDoc(doc(db, "attendance", attendanceID), {
            nama: userData.nama, desa: userData.desa, kelompok: userData.kelompok,
            eventId: eventID, waktu: serverTimestamp(), status: "hadir"
        });

        const overlay = document.getElementById('success-overlay');
        overlay.style.display = 'flex';
        setTimeout(() => {
            overlay.style.display = 'none';
            showScanner(userData); 
        }, 3000);
    } catch (e) {
        alert("Gagal absen: " + e.message);
        showScanner(userData);
    }
}

// --- 5. JALANKAN APLIKASI ---
const savedUser = localStorage.getItem('currentUser');
if (savedUser) {
    showScanner(JSON.parse(savedUser));
} else {
    showPageRegistrasi();
}
