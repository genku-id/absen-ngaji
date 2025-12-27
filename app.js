import { db } from './firebase-config.js';
import { 
    collection, getDocs, query, where, addDoc, 
    doc, setDoc, getDoc, deleteDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const dataWilayah = {
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"]
};

let html5QrCode;

// --- 1. LOGIKA MULTI-AKUN (LOCALSTORAGE) ---
function getSavedAccounts() {
    return JSON.parse(localStorage.getItem('saved_accounts')) || [];
}

function saveAccount(userData) {
    let accounts = getSavedAccounts();
    const exists = accounts.find(a => a.nama === userData.nama && a.desa === userData.desa);
    if (!exists) {
        accounts.push(userData);
        localStorage.setItem('saved_accounts', JSON.stringify(accounts));
    }
}

window.hapusAkunDariList = (nama) => {
    let accounts = getSavedAccounts().filter(a => a.nama !== nama);
    localStorage.setItem('saved_accounts', JSON.stringify(accounts));
    showPageRegistrasi();
};

// --- 2. HALAMAN LOGIN & LIST AKUN ---
window.showPageRegistrasi = () => {
    localStorage.removeItem('currentUser');
    const accounts = getSavedAccounts();
    const content = document.getElementById('app-content');
    
    let htmlList = "";
    if (accounts.length > 0) {
        htmlList = `<div class="account-list" style="margin-bottom:15px;">
            <p style="font-size: 12px; color: #010530; margin-bottom:10px;">Pilih akun tersimpan:</p>
            ${accounts.map(acc => `
                <div class="account-item" style="display:flex; justify-content:space-between; align-items:center; background:#f0f0f0; padding:10px; border-radius:8px; margin-bottom:5px;">
                    <div onclick='pilihAkun(${JSON.stringify(acc)})' style="flex-grow:1; cursor:pointer;">
                        <b>${acc.nama}</b><br><small>${acc.desa} - ${acc.kelompok}</small>
                    </div>
                    <button onclick="hapusAkunDariList('${acc.nama}')" style="background:none; border:none; color:red; font-weight:bold; cursor:pointer; padding:10px;">✕</button>
                </div>
            `).join('')}
            <hr style="margin:15px 0;">
        </div>`;
    }

    content.innerHTML = `
        <div class="card">
            <h2>LogIn</h2>
            ${htmlList}
            <p style="font-size: 12px; color: #010530;">Masukakan data:</p>
            <select id="reg-desa">
                <option value="">Pilih Desa</option>
                ${Object.keys(dataWilayah).map(desa => `<option value="${desa}">${desa}</option>`).join('')}
            </select>
            <select id="reg-kelompok" disabled><option value="">Pilih Kelompok</option></select>
            <div style="position: relative; width: 100%;">
    <input type="text" id="reg-nama" placeholder="Ketik Nama Anda..." autocomplete="off" disabled>
    <div id="suggestion-box" class="suggestion-container hidden"></div>
</div>

            <button id="btn-login" class="primary-btn">MASUK</button>
        </div>
    `;

    const desaSel = document.getElementById('reg-desa');
    const kelSel = document.getElementById('reg-kelompok');
    const namaInp = document.getElementById('reg-nama');

    desaSel.onchange = () => {
        const kelompok = dataWilayah[desaSel.value] || [];
        kelSel.innerHTML = '<option value="">Pilih Kelompok</option>' + kelompok.map(k => `<option value="${k}">${k}</option>`).join('');
        kelSel.disabled = false;
    };
    kelSel.onchange = () => { namaInp.disabled = false; };
    namaInp.oninput = async () => {
    const val = namaInp.value.toUpperCase();
    const suggestBox = document.getElementById('suggestion-box');
    
    if (val.length < 1) {
        suggestBox.classList.add('hidden');
        return;
    }

    const q = query(collection(db, "master_jamaah"), 
              where("desa", "==", desaSel.value), 
              where("kelompok", "==", kelSel.value));
    
    const snap = await getDocs(q);
    let matches = [];
    snap.forEach(d => {
        const namaDB = d.data().nama;
        if (namaDB.includes(val)) matches.push(namaDB);
    });

    if (matches.length > 0) {
        suggestBox.innerHTML = matches.map(name => 
            `<div class="suggest-item" onclick="pilihSaranNama('${name}')">${name}</div>`
        ).join('');
        suggestBox.classList.remove('hidden');
    } else {
        suggestBox.classList.add('hidden');
    }
};

    document.getElementById('btn-login').onclick = prosesLogin;
};
window.pilihSaranNama = (nama) => {
    document.getElementById('reg-nama').value = nama;
    document.getElementById('suggestion-box').classList.add('hidden');
};

window.pilihAkun = (userData) => {
    localStorage.setItem('currentUser', JSON.stringify(userData));
    showDashboard(userData);
};

// --- 3. PROSES LOGIN ---
window.prosesLogin = async () => {
    const namaRaw = document.getElementById('reg-nama').value;
    const nama = namaRaw.trim().toUpperCase();
    const desa = document.getElementById('reg-desa').value;
    const kelompok = document.getElementById('reg-kelompok').value;

    if (!nama || !desa || !kelompok) return alert("Lengkapi data!");

    try {
        const q = query(collection(db, "master_jamaah"), where("desa", "==", desa), where("kelompok", "==", kelompok), where("nama", "==", nama));
        const snap = await getDocs(q);
        let userData;

        if (!snap.empty) {
            userData = { nama: snap.docs[0].data().nama, desa, kelompok };
        } else {
            if (confirm(`Nama "${nama}" belum terdaftar. Daftarkan baru?`)) {
                userData = { nama, desa, kelompok, gender: "-" };
                await addDoc(collection(db, "master_jamaah"), userData);
            } else return;
        }

        saveAccount(userData);
        localStorage.setItem('currentUser', JSON.stringify(userData));
        showDashboard(userData);
    } catch (e) { alert("Error: " + e.message); }
};

// --- 4. DASHBOARD (SAPAAN) ---
window.showDashboard = (userData) => {
    const content = document.getElementById('app-content');
    content.innerHTML = `
        <div class="card animate-in">
            <div style="text-align:center; padding:30px 0;">
                <h2 style="font-weight: normal; color: #010530;">Assalaamualaikum,</h2>
                <h1 style="color: #075e54; margin:10px 0; font-size: 2.2em;">${userData.nama}</h1>
                <p style="color: #888; letter-spacing: 1px;">${userData.desa} - ${userData.kelompok}</p>
            </div>
            
            <button onclick='mulaiScanner(${JSON.stringify(userData)})' class="primary-btn" 
                style="padding:25px; font-size:20px; border-radius: 50px; box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3);">📸 MULAI SCAN BARCODE</button>
            
            <p style="text-align:center; margin-top:30px; font-size:11px; color:#ccc;">E-PRESENSI KU v1.0</p>
        </div>
    `;
};

// --- 5. SCANNER & PROSES ABSEN ---
window.mulaiScanner = (userData) => {
    const content = document.getElementById('app-content');
    content.innerHTML = `
        <div class="card" style="padding: 10px;">
            <h3 style="text-align:center;">Arahkan ke Barcode</h3>
            <div id="reader"></div>
            <button onclick='showDashboard(${JSON.stringify(userData)})' class="secondary-btn" style="margin-top:15px;">BATAL</button>
        </div>
    `;

    html5QrCode = new Html5Qrcode("reader");
    // Pengaturan kamera agar pas di layar HP
    const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 }, // Ukuran kotak target scan
        aspectRatio: 1.0 // Membuat tampilan kamera kotak (square) agar fokus
    };

    html5QrCode.start(
        { facingMode: "environment" }, 
        config, 
        async (decodedText) => {
            await html5QrCode.stop();
            prosesAbsensi(decodedText, userData);
        }
    ).catch(err => {
        console.error("Gagal Kamera:", err);
        alert("Mohon izinkan akses kamera!");
    });
};

async function prosesAbsensi(eventID, userData) {
    try {
        // 1. Bersihkan ID jika itu scan Barcode Izin
        const cleanID = eventID.replace("_IZIN", "");
        
        // 2. Cek apakah Event masih aktif di Firebase
        const eventRef = doc(db, "events", cleanID);
        const eventSnap = await getDoc(eventRef);

        if (!eventSnap.exists()) {
            alert("MAAF, BARCODE SUDAH TIDAK BERLAKU / EVENT SUDAH DITUTUP");
            return showDashboard(userData); // Kembali ke sapaan
        }

        // 3. Tentukan status (hadir atau izin)
        const statusAbsen = eventID.includes("_IZIN") ? "izin" : "hadir";

        // 4. Simpan ke database koleksi 'attendance'
        const attID = `${cleanID}_${userData.nama.replace(/\s/g, '')}`;
        await setDoc(doc(db, "attendance", attID), {
            nama: userData.nama,
            desa: userData.desa,
            kelompok: userData.kelompok,
            eventId: cleanID,
            waktu: serverTimestamp(),
            status: statusAbsen
        });

        // 5. Tampilkan Overlay "Lancar Barokah" Full Layar
        const overlay = document.getElementById('success-overlay');
        overlay.innerHTML = "<h1 style='padding:20px; text-align:center;'>Alhamdulillah Jazaa Kumullahu Khoiroo,<br>LANCAR BAROKAH!</h1>";
        overlay.style.display = 'flex'; // Mengaktifkan tampilan hijau

        // 6. Tunggu 4 detik, lalu sembunyikan dan kembali ke Dashboard
        setTimeout(() => {
            overlay.style.display = 'none';
            showDashboard(userData); // Kembali ke halaman "Assalaamualaikum"
        }, 4000);

    } catch (e) {
        console.error("Detail Error:", e);
        alert("Gagal memproses absensi: " + e.message);
        showDashboard(userData);
    }
}
// --- 6. LOGIKA ADMIN ---
window.bukaAdmin = () => {
    const pass = prompt("Password Admin:");
    if (pass !== "1234") return alert("Salah!");
    const content = document.getElementById('app-content');
    content.innerHTML = `
        <div class="card" style="max-width:95%">
            <h2>Panel Admin</h2>
            <div class="admin-actions" style="display:flex; gap:5px; margin-bottom:15px;">
                <button id="btn-ev" class="admin-btn" onclick="switchAdminTab('ev')" style="flex:1; padding:10px; border:none; color:white;">EVENT</button>
                <button id="btn-lp" class="admin-btn" onclick="switchAdminTab('lp')" style="flex:1; padding:10px; border:none; color:white;">LAPORAN</button>
                <button id="btn-db" class="admin-btn" onclick="switchAdminTab('db')" style="flex:1; padding:10px; border:none; color:white;">DATABASE</button>
            </div>
            <div id="admin-dynamic-content"></div>
        </div>`;
    switchAdminTab('ev');
};

window.switchAdminTab = (tab) => {
    // Reset semua tombol jadi abu-abu tua
    document.querySelectorAll('.admin-btn').forEach(b => b.style.background = "#666");
    
    const activeBtn = document.getElementById(`btn-${tab}`);
    if(activeBtn) {
        // GANTI DI SINI: Ubah dari #25d366 (hijau) ke biru
        activeBtn.style.background = "#007bff"; 
    }
    
    if (tab === 'ev') formBuatEvent();
    else if (tab === 'lp') lihatLaporan();
    else if (tab === 'db') lihatDatabase();
};
window.formBuatEvent = async () => {
    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = "Memeriksa...";
    const q = query(collection(db, "events"), where("status", "==", "open"));
    const snap = await getDocs(q);
    if (!snap.empty) {
        tampilkanBarcode(snap.docs[0].id, snap.docs[0].data().nama, snap.docs[0].data().waktu);
    } else {
        container.innerHTML = `<h3>Buat Event</h3><input type="text" id="ev-nama" placeholder="Nama Ngaji"><input type="datetime-local" id="ev-waktu"><button onclick="simpanEvent()" class="primary-btn">Terbitkan</button>`;
    }
};

window.simpanEvent = async () => {
    const nama = document.getElementById('ev-nama').value;
    const waktu = document.getElementById('ev-waktu').value;
    if (!nama || !waktu) return alert("Isi data!");
    const id = "EVT-" + Date.now();
    await setDoc(doc(db, "events", id), { nama, waktu, status: "open", createdAt: serverTimestamp() });
    tampilkanBarcode(id, nama, waktu);
};

function tampilkanBarcode(id, nama, waktu) {
    document.getElementById('admin-dynamic-content').innerHTML = `
        <div style="text-align:center;">
            <h4>${nama}</h4><p>${waktu.replace('T',' ')}</p>
            <div class="qr-item">
                <p><b>Barcode Absensi</b></p>
                <div id="qrcode-absen" style="margin:10px auto; display:inline-block;"></div><br>
                <button onclick="downloadQR('qrcode-absen','Absen_${nama}')" class="secondary-btn">🖼️ Preview Barcode</button>
            </div>
            <div class="qr-item">
                <p><b>Barcode Izin</b></p>
                <div id="qrcode-izin" style="margin:10px auto; display:inline-block;"></div><br>
                <button onclick="downloadQR('qrcode-izin','Izin_${nama}')" class="secondary-btn">🖼️ Preview Barcode</button>
            </div>
            <button onclick="tutupEvent('${id}')" style="background:red; color:white; width:100%; padding:15px; margin-top:20px; border:none; border-radius:8px; font-weight:bold;">TUTUP EVENT (HAPUS QR)</button>
        </div>`;

    // Render QR Code
    new QRCode(document.getElementById("qrcode-absen"), {
        text: id,
        width: 200,
        height: 200
    });
    new QRCode(document.getElementById("qrcode-izin"), {
        text: id + "_IZIN",
        width: 200,
        height: 200
    });
}

window.downloadQR = (el, name) => {
    const container = document.getElementById(el);
    const img = container.querySelector("img");
    const canvas = container.querySelector("canvas");
    let dataUrl = "";

    // Ambil data gambar dari img atau canvas
    if (img && img.src && img.src.startsWith("data:image")) {
        dataUrl = img.src;
    } else if (canvas) {
        dataUrl = canvas.toDataURL("image/png");
    }

    if (!dataUrl) return alert("Gambar belum siap.");

    // Buat Overlay Preview
    const overlay = document.createElement('div');
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:20000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:white; font-family:sans-serif; padding:20px; box-sizing:border-box; text-align:center;";
    
    overlay.innerHTML = `
        <div style="background:white; padding:20px; border-radius:15px; width:100%; max-width:320px;">
            <p style="color:#333; margin-bottom:15px; font-size:14px;"><b>PREVIEW BARCODE</b><br><small>Klik tombol di bawah atau tekan lama gambar</small></p>
            <img src="${dataUrl}" style="width:100%; border:1px solid #eee; margin-bottom:20px;">
            
            <button id="btn-do-download" style="width:100%; padding:15px; background:#007bff; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; margin-bottom:10px;">📥 DOWNLOAD IMAGE</button>
            
            <button id="close-qr-preview" style="width:100%; padding:10px; background:none; color:#666; border:none; font-size:13px; cursor:pointer;">Tutup & Kembali</button>
        </div>
    `;

    document.body.appendChild(overlay);

    // FUNGSI TOMBOL DOWNLOAD (Shortcut)
    document.getElementById('btn-do-download').onclick = () => {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = name + ".png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Fungsi untuk menutup preview
    document.getElementById('close-qr-preview').onclick = () => {
        document.body.removeChild(overlay);
    };
};
window.tutupEvent = async (id) => {
    if(confirm("Tutup dan Hapus QR?")) {
        await deleteDoc(doc(db, "events", id));
        bukaAdmin();
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
            <button onclick="renderTabelLaporan()" class="primary-btn">Tampilkan Detail</button>
            
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button onclick="downloadLaporan()" class="secondary-btn" style="flex:1;">📥 Excel</button>
                <button onclick="bukaModalStatistik()" class="primary-btn" style="flex:1; background:#28a745;">📊 Statistik</button>
            </div>
        </div>
        <div id="tabel-container" class="table-responsive"></div>
    `;
    // ... sisa kode onchange desa tetap sama ...
};


window.renderTabelLaporan = async () => {
    const fD = document.getElementById('f-desa').value;
    const fK = document.getElementById('f-kelompok').value;
    const tableDiv = document.getElementById('tabel-container');
    tableDiv.innerHTML = "Memuat data...";

    try {
        // 1. Cek apakah ada data scan di database (Attendance)
        const hSnap = await getDocs(collection(db, "attendance"));
        
        // JIKA TIDAK ADA DATA SCAN, SEMBUNYIKAN TABEL
        if (hSnap.empty) {
            tableDiv.innerHTML = "<p style='text-align:center; padding:20px; color:#999;'>Riwayat kosong..</p>";
            return;
        }

        // 2. Cek apakah ada event yang sedang "open"
        const qEvent = query(collection(db, "events"), where("status", "==", "open"));
        const evSnap = await getDocs(qEvent);
        const isEventRunning = !evSnap.empty;

        // 3. Ambil data Master Jamaah
        let qM = collection(db, "master_jamaah");
        if(fD) qM = query(qM, where("desa", "==", fD));
        if(fK) qM = query(qM, where("kelompok", "==", fK));
        const mSnap = await getDocs(qM);

        // Map status kehadiran
        const statusMap = {};
        hSnap.forEach(doc => { statusMap[doc.data().nama] = doc.data().status; });

        // --- BAGIAN BARU: PROSES SORTIR ---
        let listJamaah = [];
        mSnap.forEach(doc => {
            listJamaah.push(doc.data());
        });

        // Sortir: Desa -> Kelompok -> Nama
        listJamaah.sort((a, b) => {
            if (a.desa !== b.desa) return a.desa.localeCompare(b.desa);
            if (a.kelompok !== b.kelompok) return a.kelompok.localeCompare(b.kelompok);
            return a.nama.localeCompare(b.nama);
        });
        // --- AKHIR BAGIAN SORTIR ---

        let html = `<table><thead><tr><th>Nama</th><th>Info</th><th>Status</th></tr></thead><tbody>`;
        let adaBarisDibuat = false;

        // Gunakan listJamaah (yang sudah disortir) untuk looping, bukan mSnap lagi
        listJamaah.forEach(d => {
            const s = statusMap[d.nama];
// ... di dalam renderTabelLaporan setelah listJamaah disortir ...
window.currentListData = listJamaah; // Simpan ke variabel global agar bisa dibaca fungsi statistik

            // LOGIKA SEMBUNYI TETAP BERTAHAN
            if (isEventRunning && !s) return;

            adaBarisDibuat = true;
            let color = "#ffebee", txt = "❌ ALFA";
            if(s === "hadir") { color = "#e8f5e9"; txt = "✅ HADIR"; }
            else if(s === "izin") { color = "#fff9c4"; txt = "🙏🏻 IZIN"; }

            html += `<tr style="background:${color}">
                <td><b>${d.nama}</b></td>
                <td><small>${d.desa}<br>${d.kelompok}</small></td>
                <td style="text-align:center;"><b>${txt}</b></td>
            </tr>`;
        });

        tableDiv.innerHTML = adaBarisDibuat ? html + `</tbody></table>` : "<p style='text-align:center; padding:20px; color:#999;'>Belum ada data scan yang cocok.</p>";

    } catch (e) {
        tableDiv.innerHTML = "Error: " + e.message;
    }
};

window.downloadLaporan = () => {
    const table = document.querySelector("#tabel-container table");
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, "Laporan.xlsx");
};
window.bukaModalStatistik = async () => {
    // Ambil data yang sedang tampil di layar (sudah terfilter)
    // Kita asumsikan listJamaah adalah variabel global atau diambil dari render terakhir
    if (!window.currentListData || window.currentListData.length === 0) {
        return alert("Tidak ada data untuk statistik. Silakan tampilkan laporan dulu.");
    }

    // Ambil status kehadiran dari database saat ini
    const hSnap = await getDocs(collection(db, "attendance"));
    const statusMap = {};
    hSnap.forEach(doc => { statusMap[doc.data().nama] = doc.data().status; });

    let rekap = {};
    let total = { tl:0, tp:0, hl:0, hp:0, il:0, ip:0, al:0, ap:0 };

    // Proses Hitung berdasarkan data yang ada di layar
    window.currentListData.forEach(d => {
        const key = `${d.desa} - ${d.kelompok}`;
        const s = statusMap[d.nama];
        const g = d.gender; // Membaca L atau P

        if (!rekap[key]) rekap[key] = { tl:0, tp:0, hl:0, hp:0, il:0, ip:0, al:0, ap:0 };

        if (g === 'L') {
            rekap[key].tl++; total.tl++;
            if (s === 'hadir') { rekap[key].hl++; total.hl++; }
            else if (s === 'izin') { rekap[key].il++; total.il++; }
            else { rekap[key].al++; total.al++; }
        } else {
            rekap[key].tp++; total.tp++;
            if (s === 'hadir') { rekap[key].hp++; total.hp++; }
            else if (s === 'izin') { rekap[key].ip++; total.ip++; }
            else { rekap[key].ap++; total.ap++; }
        }
    });

    // Ambil info filter untuk Judul
    const filterDesa = document.getElementById('f-desa').value || "SEMUA DESA";

    // Bangun HTML Tabel Rekap
    let barisHtml = "";
    for (let k in rekap) {
        const r = rekap[k];
        barisHtml += `<tr>
            <td style="text-align:left; padding-left:5px;">${k}</td>
            <td>${r.tl}</td><td>${r.tp}</td><td>${r.hl}</td><td>${r.hp}</td>
            <td>${r.il}</td><td>${r.ip}</td><td>${r.al}</td><td>${r.ap}</td>
        </tr>`;
    }

    // Buat Overlay Modal
    const modal = document.createElement('div');
    modal.id = "modal-stat";
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:10px; box-sizing:border-box; color:white;";
    
    modal.innerHTML = `
        <div id="capture-area" style="background:white; color:black; padding:15px; border-radius:8px; width:100%; max-width:500px;">
            <h3 style="text-align:center; margin:0 0 10px 0; font-size:16px;">STATISTIK KELOMPOK - ${filterDesa}</h3>
            <table style="width:100%; border-collapse:collapse; font-size:11px; text-align:center;" border="1">
                <thead>
                    <tr style="background:#f0f0f0;">
                        <th rowspan="2">DESA-KEL</th>
                        <th colspan="2">TARGET</th><th colspan="2">HADIR</th><th colspan="2">IZIN</th><th colspan="2">ALFA</th>
                    </tr>
                    <tr style="background:#f0f0f0;">
                        <th>L</th><th>P</th><th>L</th><th>P</th><th>L</th><th>P</th><th>L</th><th>P</th>
                    </tr>
                </thead>
                <tbody>
                    ${barisHtml}
                    <tr style="background:#e3f2fd; font-weight:bold;">
                        <td>TOTAL</td>
                        <td>${total.tl}</td><td>${total.tp}</td><td>${total.hl}</td><td>${total.hp}</td>
                        <td>${total.il}</td><td>${total.ip}</td><td>${total.al}</td><td>${total.ap}</td>
                    </tr>
                </tbody>
            </table>
            <p style="font-size:9px; text-align:right; margin-top:5px;">Dicetak: ${new Date().toLocaleString('id-ID')}</p>
        </div>
        
        <div style="margin-top:20px; display:flex; flex-direction:column; gap:10px; width:100%; max-width:500px;">
            <button onclick="downloadStatistikGambar()" style="background:#28a745; color:white; padding:12px; border:none; border-radius:8px; font-weight:bold;">📸 Download Gambar (PNG)</button>
            <button onclick="resetAbsensiDariStatistik()" style="background:#d32f2f; color:white; padding:12px; border:none; border-radius:8px;">🗑️ Reset Data & Selesai</button>
            <button onclick="document.body.removeChild(document.getElementById('modal-stat'))" style="background:none; color:white; border:1px solid white; padding:8px; border-radius:8px;">Batal / Tutup</button>
        </div>
    `;
    document.body.appendChild(modal);
};
window.resetAbsensiDariStatistik = async () => {
    if (confirm("Hapus semua riwayat dan kembali ke menu Event?")) {
        const snap = await getDocs(collection(db, "attendance"));
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "attendance", d.id))));
        
        // Hapus modal
        const modal = document.getElementById('modal-stat');
        if(modal) document.body.removeChild(modal);
        
        // Balik ke tampilan buat event
        alert("Data berhasil direset!");
        bukaPanelAdmin(); // Asumsi ini fungsi untuk kembali ke menu utama admin
    }
};

window.resetAbsensi = async () => {
    if (confirm("Hapus semua riwayat absen? Tabel laporan akan disembunyikan kembali.")) {
        const snap = await getDocs(collection(db, "attendance"));
        // Hapus semua data attendance satu per satu
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "attendance", d.id))));
        // Refresh tabel (akan masuk ke kondisi hSnap.empty dan sembunyi)
        renderTabelLaporan();
        alert("Riwayat berhasil dibersihkan!");
    }
};
window.downloadStatistikGambar = () => {
    const area = document.getElementById('capture-area');
    html2canvas(area).then(canvas => {
        const link = document.createElement('a');
        link.download = 'Statistik_Kehadiran.png';
        link.href = canvas.toDataURL();
        link.click();
    });
};

window.lihatDatabase = async () => {
    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = `<div class="filter-box"><input type="text" id="cari-nama-db" placeholder="Cari nama..."><button onclick="renderTabelDatabase()" class="primary-btn">Cari</button></div><div id="db-container" class="table-responsive"></div>`;
    renderTabelDatabase();
};

window.renderTabelDatabase = async () => {
    const cari = document.getElementById('cari-nama-db').value.toUpperCase();
    const snap = await getDocs(collection(db, "master_jamaah"));
    let html = `<table><thead><tr><th>Nama</th><th>Info (Desa/Kel)</th><th>Aksi</th></tr></thead><tbody>`;
    
    snap.forEach(ds => {
        const d = ds.data();
        if (d.nama.includes(cari) || !cari) {
            html += `<tr>
                <td><b>${d.nama}</b></td>
                <td><small>${d.desa}<br>${d.kelompok}</small></td>
                <td>
                    <button onclick="hapusJamaah('${ds.id}','${d.nama}')" style="background:red; color:white; border:none; padding:8px; border-radius:5px;">🗑️</button>
                </td>
            </tr>`;
        }
    });
    document.getElementById('db-container').innerHTML = html + `</tbody></table>`;
};

window.hapusJamaah = async (id, nama) => {
    if (confirm(`Hapus ${nama}?`)) { await deleteDoc(doc(db, "master_jamaah", id)); renderTabelDatabase(); }
};
// --- MENU TITIK 3 ---
document.getElementById('menu-btn').onclick = (e) => { e.stopPropagation(); document.getElementById('menu-dropdown').classList.toggle('hidden'); };
window.onclick = () => document.getElementById('menu-dropdown').classList.add('hidden');
window.promptAdmin = () => { const p = prompt("Pass:"); if(p==="1234") bukaAdmin(); };
// --- INISIALISASI ---
const initApp = () => {
    const accounts = getSavedAccounts();
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser) showDashboard(currentUser);
    else if (accounts.length === 1) pilihAkun(accounts[0]);
    else showPageRegistrasi();
};

initApp();
