import { db } from './firebase-config.js';
import { collection, getDocs, query, where, addDoc, doc, setDoc, serverTimestamp, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
        // 1. Cek apakah Event ID valid (Bukan Scan asal-asalan)
        // Jika scan Barcode Izin (ada tambahan _IZIN), kita bersihkan dulu ID-nya
        const cleanEventID = eventID.replace("_IZIN", "");
        
        const eventRef = doc(db, "events", cleanEventID);
        const eventSnap = await getDoc(eventRef);

        if (!eventSnap.exists()) {
            alert("MAAF, BARCODE SUDAH TIDAK BERLAKU / EVENT SUDAH DITUTUP");
            showScanner(userData);
            return;
        }

        // 2. Tentukan status (Hadir atau Izin)
        const statusAbsen = eventID.includes("_IZIN") ? "izin" : "hadir";

        // 3. Simpan Kehadiran
        const attendanceID = `${cleanEventID}_${userData.nama.replace(/\s/g, '')}`;
        await setDoc(doc(db, "attendance", attendanceID), {
            nama: userData.nama,
            desa: userData.desa,
            kelompok: userData.kelompok,
            eventId: cleanEventID,
            waktu: serverTimestamp(),
            status: statusAbsen
        });

        // 4. Efek Lancar Barokah
        const overlay = document.getElementById('success-overlay');
        overlay.style.display = 'flex';
        setTimeout(() => {
            overlay.style.display = 'none';
            showScanner(userData); 
        }, 3000);

    } catch (e) {
        console.error("Detail Error:", e);
        alert("Gagal scan: " + e.message);
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
    if (password !== "admin123") return alert("Password Salah!");

    const content = document.getElementById('app-content');
    content.innerHTML = `
        <div class="card admin-card" style="max-width: 95%;">
            <h2>Panel Admin</h2>
            <div class="admin-actions">
                <button id="btn-ev" class="admin-btn" onclick="switchAdminTab('ev')">EVENT</button>
                <button id="btn-lp" class="admin-btn" onclick="switchAdminTab('lp')">LAPORAN</button>
                <button id="btn-db" class="admin-btn" onclick="switchAdminTab('db')">DATABASE</button>
            </div>
            <div id="admin-dynamic-content"></div>
        </div>
    `;
    // Standar awal buka tab Event
    switchAdminTab('ev');
};

// Fungsi untuk pindah tab dan ganti warna tombol
window.switchAdminTab = (tab) => {
    // Reset semua tombol jadi abu-abu
    document.querySelectorAll('.admin-btn').forEach(btn => btn.classList.remove('active'));
    
    if (tab === 'ev') {
        document.getElementById('btn-ev').classList.add('active');
        formBuatEvent();
    } else if (tab === 'lp') {
        document.getElementById('btn-lp').classList.add('active');
        lihatLaporan();
    } else if (tab === 'db') {
        document.getElementById('btn-db').classList.add('active');
        lihatDatabase();
    }
};

window.formBuatEvent = async () => {
    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = `<p>Memeriksa status event...</p>`;

    // Cek apakah ada event yang statusnya masih 'open'
    const q = query(collection(db, "events"), where("status", "==", "open"));
    const snap = await getDocs(q);

    if (!snap.empty) {
        // Jika ada event aktif, langsung tampilkan QR-nya
        const evData = snap.docs[0].data();
        const evId = snap.docs[0].id;
        tampilkanBarcode(evId, evData.nama, evData.waktu);
    } else {
        // Jika tidak ada, tampilkan form buat baru
        container.innerHTML = `
            <h3>Buat Event Baru</h3>
            <label>Nama Pengajian:</label>
            <input type="text" id="ev-nama" placeholder="">
            <label>Tanggal & Jam Mulai:</label>
            <input type="datetime-local" id="ev-waktu"> 
            <button onclick="simpanEvent()" class="primary-btn">Terbitkan & Buat Barcode</button>
        `;
    }
};

window.simpanEvent = async () => {
    const nama = document.getElementById('ev-nama').value;
    const waktu = document.getElementById('ev-waktu').value; // Ini mengambil Tgl & Jam
    if (!nama || !waktu) return alert("Isi nama dan waktu!");

    const eventId = "EVT-" + Date.now();
    await setDoc(doc(db, "events", eventId), {
        nama: nama,
        waktu: waktu,
        status: "open",
        createdAt: serverTimestamp()
    });

    tampilkanBarcode(eventId, nama, waktu);
};

// Fungsi tutup event sekarang menghapus data di Firebase
window.tutupEvent = async (id) => {
    if(confirm("Jika ditutup, data event & Barcode akan DIHAPUS permanen. Lanjutkan?")) {
        try {
            await deleteDoc(doc(db, "events", id));
            alert("Event Berhasil Ditutup & Barcode dinonaktifkan!");
            bukaAdmin(); // Refresh ke tampilan awal admin
        } catch (e) {
            alert("Gagal menutup: " + e.message);
        }
    }
};
function tampilkanBarcode(id, nama, waktu) {
    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = `
        <div class="qr-result">
            <h4>${nama}</h4>
            <p>Jadwal: ${waktu.replace('T', ' Jam ')}</p>
            <div class="qr-item">
                <p><b>BARCODE ABSENSI</b></p>
                <div id="qrcode-absen"></div>
                <button onclick="downloadQR('qrcode-absen', 'Absen_${nama}')">Download Barcode Absen</button>
            </div>
            <div class="qr-item">
                <p><b>BARCODE IZIN</b></p>
                <div id="qrcode-izin"></div>
                <button onclick="downloadQR('qrcode-izin', 'Izin_${nama}')">Download Barcode Izin</button>
            </div>
            <button onclick="tutupEvent('${id}')" style="background:red; color:white; width:100%; padding:15px; margin-top:10px;">
                TUTUP EVENT (QR MATI & HAPUS EVENT)
            </button>
        </div>
    `;

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
            <button onclick="resetAbsensi()" style="background: #d32f2f; color: white; margin-top: 10px;">🗑️ Reset</button>
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
window.resetAbsensi = async () => {
    if (confirm("PERINGATAN! Semua data kehadiran akan DIHAPUS PERMANEN. Pastikan sudah download laporan. Lanjut?")) {
        try {
            const snap = await getDocs(collection(db, "attendance"));
            const promises = snap.docs.map(d => deleteDoc(doc(db, "attendance", d.id)));
            await Promise.all(promises);
            alert("Riwayat absen telah dibersihkan!");
            renderTabelLaporan();
        } catch (e) {
            alert("Gagal reset: " + e.message);
        }
    }
};
window.lihatDatabase = async () => {
    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = `
        <div class="filter-box">
            <input type="text" id="cari-nama-db" placeholder="Cari nama jamaah...">
            <button onclick="renderTabelDatabase()" class="primary-btn">Cari</button>
        </div>
        <div id="db-container" class="table-responsive"></div>
    `;
    renderTabelDatabase();
};

window.renderTabelDatabase = async () => {
    const container = document.getElementById('db-container');
    const cari = document.getElementById('cari-nama-db').value.toUpperCase();
    const snap = await getDocs(collection(db, "master_jamaah"));
    
    let html = `<table><thead><tr><th>Nama</th><th>Info</th><th>Aksi</th></tr></thead><tbody>`;
    
    snap.forEach(docSnap => {
        const d = docSnap.data();
        if (d.nama.includes(cari) || cari === "") {
            html += `
                <tr>
                    <td>${d.nama}</td>
                    <td>${d.desa}<br>${d.kelompok}<br><b>(${d.gender || '?'})</b></td>
                    <td>
                        <button onclick="hapusJamaah('${docSnap.id}', '${d.nama}')" class="btn-hapus">🗑️</button>
                    </td>
                </tr>`;
        }
    });
    html += `</tbody></table>`;
    container.innerHTML = html;
};

window.hapusJamaah = async (id, nama) => {
    if (confirm(`Yakin ingin menghapus ${nama} dari database?`)) {
        await deleteDoc(doc(db, "master_jamaah", id));
        alert("Terhapus!");
        renderTabelDatabase();
    }
};

window.prosesLogin = async () => {
    const namaInputRaw = document.getElementById('reg-nama').value;
    const namaInput = namaInputRaw.trim().toUpperCase();
    const desa = document.getElementById('reg-desa').value;
    const kelompok = document.getElementById('reg-kelompok').value;

    if (!namaInput || !desa || !kelompok) return alert("Mohon lengkapi data!");

    try {
        // 1. Cek apakah sudah ada di master_jamaah
        const q = query(
            collection(db, "master_jamaah"), 
            where("desa", "==", desa),
            where("kelompok", "==", kelompok),
            where("nama", "==", namaInput)
        );
        
        const snap = await getDocs(q);
        let userData;

        if (!snap.empty) {
            // DATA SUDAH ADA: Ambil data lama (termasuk gender dll jika ada)
            const docData = snap.docs[0].data();
            userData = { 
                nama: docData.nama, 
                desa: docData.desa, 
                kelompok: docData.kelompok 
            };
            console.log("Menggunakan data yang sudah ada di Master.");
        } else {
            // DATA BELUM ADA: Tulis sebagai data baru ke master_jamaah
            const konfirmasi = confirm(`Nama "${namaInput}" belum terdaftar. Daftarkan sebagai jamaah baru di ${desa}?`);
            if (konfirmasi) {
                userData = { 
                    nama: namaInput, 
                    desa: desa, 
                    kelompok: kelompok,
                    gender: "-" // Default kosong, admin bisa edit nanti di menu Database
                };
                await addDoc(collection(db, "master_jamaah"), userData);
                alert("Berhasil mendaftar ke Master Database!");
            } else {
                return;
            }
        }

        // Simpan login ke HP
        localStorage.setItem('currentUser', JSON.stringify(userData));
        showScanner(userData);

    } catch (e) {
        alert("Gagal koneksi: " + e.message);
    }
};
