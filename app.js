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
        const q = query(collection(db, "master_jamaah"), 
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

// --- 6. LOGIKA ADMIN ---
window.bukaAdmin = () => {
    const password = prompt("Masukkan Password Admin:");
    if (password !== "admin123") return alert("Password Salah!"); // Ganti password sesukamu

    const content = document.getElementById('app-content');
    content.innerHTML = `
        <div class="card admin-card">
            <h2>Panel Admin</h2>
            <div class="admin-actions">
                <button onclick="formBuatEvent()" class="primary-btn">➕ Buat Event Ngaji Baru</button>
                <button onclick="lihatLaporan()" class="secondary-btn">📊 Lihat Laporan Kehadiran</button>
                <button onclick="lihatDatabase()" class="secondary-btn">🗂️ Database Jamaah</button>
            </div>
            <div id="admin-dynamic-content"></div>
        </div>
    `;
};

window.formBuatEvent = () => {
    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = `
        <h3>Buat Event Baru</h3>
        <input type="text" id="ev-nama" placeholder="Nama Pengajian (misal: Selasa Pon)">
        <input type="date" id="ev-tgl">
        <button onclick="simpanEvent()" class="primary-btn">Terbitkan & Buat Barcode</button>
    `;
};

window.simpanEvent = async () => {
    const nama = document.getElementById('ev-nama').value;
    const tgl = document.getElementById('ev-tgl').value;
    if (!nama || !tgl) return alert("Isi nama dan tanggal!");

    const eventId = "EVT-" + Date.now();
    await setDoc(doc(db, "events", eventId), {
        nama: nama,
        tanggal: tgl,
        status: "open",
        createdAt: serverTimestamp()
    });

    tampilkanBarcode(eventId, nama);
};

function tampilkanBarcode(id, nama) {
    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = `
        <div class="qr-result">
            <h4>Barcode untuk: ${nama}</h4>
            <div class="qr-item">
                <p><b>BARCODE ABSENSI</b> (Pajang di Meja)</p>
                <div id="qrcode-absen"></div>
                <button onclick="downloadQR('qrcode-absen', 'Absen_${nama}')">Download Barcode Absen</button>
            </div>
            <hr>
            <div class="qr-item">
                <p><b>BARCODE IZIN</b> (Share ke WA)</p>
                <div id="qrcode-izin"></div>
                <button onclick="downloadQR('qrcode-izin', 'Izin_${nama}')">Download Barcode Izin</button>
            </div>
            <button onclick="tutupEvent('${id}')" style="background:red; color:white; margin-top:20px">Tutup Pendaftaran (Matikan Barcode)</button>
        </div>
    `;

    // Generate QR
    new QRCode(document.getElementById("qrcode-absen"), id);
    new QRCode(document.getElementById("qrcode-izin"), id + "_IZIN");
}

window.downloadQR = (elementId, fileName) => {
    const img = document.getElementById(elementId).querySelector("img");
    const link = document.createElement("a");
    link.href = img.src;
    link.download = fileName + ".png";
    link.click();
};

window.tutupEvent = async (id) => {
    if(confirm("Jika ditutup, barcode tidak bisa digunakan lagi. Lanjut?")) {
        await setDoc(doc(db, "events", id), { status: "closed" }, { merge: true });
        alert("Event ditutup!");
        bukaAdmin();
    }
};

// --- LOGIKA MENU TITIK 3 ---
const menuBtn = document.getElementById('menu-btn');
const menuDropdown = document.getElementById('menu-dropdown');

// Klik titik 3 untuk buka/tutup menu
menuBtn.onclick = (e) => {
    e.stopPropagation();
    menuDropdown.classList.toggle('hidden');
};

// Klik di mana saja di luar menu untuk menutup
window.onclick = () => {
    if (!menuDropdown.classList.contains('hidden')) {
        menuDropdown.classList.add('hidden');
    }
};

// Fungsi untuk prompt password admin
window.promptAdmin = () => {
    const pass = prompt("Masukkan Password Admin:");
    if (pass === "1234") {
        bukaAdmin();
    } else {
        alert("Password Salah!");
    }
};

window.lihatLaporan = async () => {
    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = `
        <h3>Laporan Kehadiran</h3>
        <div class="filter-box">
            <select id="f-desa">
                <option value="">Semua Desa</option>
                ${Object.keys(dataWilayah).map(d => `<option value="${d}">${d}</option>`).join('')}
            </select>
            <select id="f-kelompok">
                <option value="">Semua Kelompok</option>
            </select>
            <button onclick="renderTabelLaporan()" class="primary-btn">Tampilkan</button>
            <button onclick="downloadLaporan()" class="secondary-btn">📥 Download Hasil Filter</button>
        </div>
        <div id="tabel-container" class="table-responsive">
            <p>Memuat data...</p>
        </div>
    `;
    
    // Logika filter kelompok yang dinamis di laporan
    document.getElementById('f-desa').onchange = (e) => {
        const kel = dataWilayah[e.target.value] || [];
        document.getElementById('f-kelompok').innerHTML = '<option value="">Semua Kelompok</option>' + 
            kel.map(k => `<option value="${k}">${k}</option>`).join('');
    };
    
    renderTabelLaporan();
};

window.renderTabelLaporan = async () => {
    const fDesa = document.getElementById('f-desa').value;
    const fKel = document.getElementById('f-kelompok').value;
    const tableDiv = document.getElementById('tabel-container');

    // 1. Ambil semua master jamaah untuk cek siapa yang ALFA
    let qMaster = collection(db, "master_jamaah");
    if(fDesa) qMaster = query(qMaster, where("desa", "==", fDesa));
    if(fKel) qMaster = query(qMaster, where("kelompok", "==", fKel));
    
    const masterSnap = await getDocs(qMaster);
    const daftarHadirSnap = await getDocs(collection(db, "attendance")); // Sesuai event aktif
    
    const hadirNames = [];
    daftarHadirSnap.forEach(doc => hadirNames.push(doc.data().nama));

    let html = `<table>
        <thead>
            <tr><th>Nama</th><th>Desa</th><th>Kelompok</th><th>Status</th></tr>
        </thead>
        <tbody>`;

    masterSnap.forEach(doc => {
        const d = doc.data();
        const isHadir = hadirNames.includes(d.nama);
        html += `
            <tr class="${isHadir ? 'row-hadir' : 'row-alfa'}">
                <td>${d.nama}</td>
                <td>${d.desa}</td>
                <td>${d.kelompok}</td>
                <td><b>${isHadir ? '✅ HADIR' : '❌ ALFA'}</b></td>
            </tr>`;
    });

    html += `</tbody></table>`;
    tableDiv.innerHTML = html;
};

window.downloadLaporan = () => {
    const table = document.querySelector("#tabel-container table");
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, "Laporan_Presensi_Ngaji.xlsx");
};
