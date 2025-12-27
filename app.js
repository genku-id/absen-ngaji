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
            <input type="text" id="reg-nama" placeholder="Ketik Nama..." list="list-nama" disabled>
            <datalist id="list-nama"></datalist>
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
        if (namaInp.value.length < 2) return;
        const q = query(collection(db, "master_jamaah"), where("desa", "==", desaSel.value), where("kelompok", "==", kelSel.value));
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
                <button onclick="downloadQR('qrcode-absen','Absen_${nama}')" class="secondary-btn">📥 Download Absen</button>
            </div>
            <div class="qr-item">
                <p><b>Barcode Izin</b></p>
                <div id="qrcode-izin" style="margin:10px auto; display:inline-block;"></div><br>
                <button onclick="downloadQR('qrcode-izin','Izin_${nama}')" class="secondary-btn">📥 Download Izin</button>
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
    // Mencari elemen gambar (img) atau canvas di dalam container QR
    const container = document.getElementById(el);
    const img = container.querySelector("img");
    const canvas = container.querySelector("canvas");

    const link = document.createElement("a");
    link.download = name + ".png";

    if (img && img.src && img.src !== "") {
        // Jika QRCode.js merender sebagai <img>
        link.href = img.src;
    } else if (canvas) {
        // Jika QRCode.js merender sebagai <canvas>
        link.href = canvas.toDataURL("image/png");
    } else {
        return alert("Gambar belum siap, silakan tunggu sebentar atau coba lagi.");
    }

    link.click();
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
            <button onclick="renderTabelLaporan()" class="primary-btn">Tampilkan</button>
            <button onclick="downloadLaporan()" class="secondary-btn">📥 Download Excel</button>
            <button onclick="resetAbsensi()" style="background: #d32f2f; color: white; margin-top: 10px; padding:10px; border:none; width:100%;">🗑️ Reset Riwayat</button>
        </div>
        <div id="tabel-container" class="table-responsive"></div>
    `;
    document.getElementById('f-desa').onchange = (e) => {
        const kel = dataWilayah[e.target.value] || [];
        document.getElementById('f-kelompok').innerHTML = '<option value="">Semua Kelompok</option>' + kel.map(k => `<option value="${k}">${k}</option>`).join('');
    };
    renderTabelLaporan();
};

window.renderTabelLaporan = async () => {
    const fDesa = document.getElementById('f-desa').value;
    const fKel = document.getElementById('f-kelompok').value;
    const tableDiv = document.getElementById('tabel-container');
    tableDiv.innerHTML = "Memuat data...";

    let qMaster = collection(db, "master_jamaah");
    if(fDesa) qMaster = query(qMaster, where("desa", "==", fDesa));
    if(fKel) qMaster = query(qMaster, where("kelompok", "==", fKel));
    
    const masterSnap = await getDocs(qMaster);
    const hadirSnap = await getDocs(collection(db, "attendance"));
    
    // Buat peta (map) untuk mencocokkan nama dengan statusnya (hadir/izin)
    const statusMap = {};
    hadirSnap.forEach(doc => {
        const data = doc.data();
        statusMap[data.nama] = data.status; // status berisi 'hadir' atau 'izin'
    });

    let html = `<table><thead><tr><th>Nama</th><th>Info (Desa/Kel)</th><th>Status</th></tr></thead><tbody>`;
    
    masterSnap.forEach(doc => {
        const d = doc.data();
        const status = statusMap[d.nama]; // Ambil status dari map
        
        let rowColor = "#ffebee"; // Default Merah (ALFA)
        let statusText = "❌ ALFA";

        if (status === "hadir") {
            rowColor = "#e8f5e9"; // Hijau (HADIR)
            statusText = "✅ HADIR";
        } else if (status === "izin") {
            rowColor = "#fff9c4"; // Kuning (IZIN)
            statusText = "🙏🏻 IZIN";
        }
        
        html += `<tr style="background:${rowColor}">
            <td><b>${d.nama}</b></td>
            <td><small>${d.desa}<br>${d.kelompok}</small></td>
            <td style="text-align:center;"><b>${statusText}</b></td>
        </tr>`;
    });
    
    tableDiv.innerHTML = html + `</tbody></table>`;
};

window.downloadLaporan = () => {
    const table = document.querySelector("#tabel-container table");
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, "Laporan.xlsx");
};

window.resetAbsensi = async () => {
    if (confirm("Hapus semua riwayat absen?")) {
        const snap = await getDocs(collection(db, "attendance"));
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "attendance", d.id))));
        alert("Selesai!");
        renderTabelLaporan();
    }
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
