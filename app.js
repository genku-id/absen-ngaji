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

// --- 1. LOGIKA MULTI-AKUN ---
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

// --- 2. HALAMAN LOGIN ---
window.showPageRegistrasi = () => {
    localStorage.removeItem('currentUser');
    const accounts = getSavedAccounts();
    const content = document.getElementById('app-content');
    
    let htmlList = "";
    if (accounts.length > 0) {
        htmlList = `<div class="account-list">
            <p style="font-size: 12px; color: #0056b3; margin-bottom:10px;">Pilih akun tersimpan:</p>
            ${accounts.map(acc => `
                <div class="account-item">
                    <div onclick='pilihAkun(${JSON.stringify(acc)})' style="flex-grow:1; cursor:pointer;">
                        <b>${acc.nama}</b><br><small>${acc.desa} - ${acc.kelompok}</small>
                    </div>
                    <button onclick="hapusAkunDariList('${acc.nama}')" class="btn-x">✕</button>
                </div>
            `).join('')}
            <hr style="margin:15px 0; border: 0; border-top: 1px solid #eee;">
        </div>`;
    }

    content.innerHTML = `
        <div class="card">
            <h2 style="color:#0056b3;">LogIn</h2>
            ${htmlList}
            <p style="font-size: 12px; color: #666;">Masukan data baru:</p>
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

// --- 3. DASHBOARD & SCANNER ---
window.showDashboard = (userData) => {
    const content = document.getElementById('app-content');
    content.innerHTML = `
        <div class="card animate-in">
            <div style="text-align:center; padding:30px 0;">
                <h2 style="font-weight: normal; color: #666;">Assalaamualaikum,</h2>
                <h1 style="color: #0056b3; margin:10px 0; font-size: 2.2em;">${userData.nama}</h1>
                <p style="color: #888; letter-spacing: 1px;">${userData.desa} - ${userData.kelompok}</p>
            </div>
            <button onclick='mulaiScanner(${JSON.stringify(userData)})' class="primary-btn" style="padding:25px; font-size:18px; border-radius: 50px;">📸 MULAI SCAN BARCODE</button>
            <p style="text-align:center; margin-top:30px; font-size:11px; color:#ccc;">E-PRESENSI KU v1.0</p>
        </div>
    `;
};

window.mulaiScanner = (userData) => {
    const content = document.getElementById('app-content');
    content.innerHTML = `<div class="card" style="padding:10px;"><h3 style="text-align:center;">Scan Barcode</h3><div id="reader"></div><button onclick='showDashboard(${JSON.stringify(userData)})' class="secondary-btn" style="margin-top:15px;">BATAL</button></div>`;
    
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250, aspectRatio: 1.0 }, async (decodedText) => {
        await html5QrCode.stop();
        prosesAbsensi(decodedText, userData);
    }).catch(err => alert("Kamera Error: " + err));
};

async function prosesAbsensi(eventID, userData) {
    try {
        const cleanID = eventID.replace("_IZIN", "");
        const eventSnap = await getDoc(doc(db, "events", cleanID));
        if (!eventSnap.exists()) return alert("BARCODE TIDAK BERLAKU");

        const statusAbsen = eventID.includes("_IZIN") ? "izin" : "hadir";
        const attID = `${cleanID}_${userData.nama.replace(/\s/g, '')}`;
        
        await setDoc(doc(db, "attendance", attID), {
            nama: userData.nama, desa: userData.desa, kelompok: userData.kelompok,
            eventId: cleanID, waktu: serverTimestamp(), status: statusAbsen
        });

        const overlay = document.getElementById('success-overlay');
        overlay.innerHTML = "<h1 style='padding:20px; text-align:center;'>Alhamdulillah Jazaa Kumullahu Khoiroo,<br>LANCAR BAROKAH!</h1>";
        overlay.style.display = 'flex';

        setTimeout(() => {
            overlay.style.display = 'none';
            showDashboard(userData);
        }, 4000);
    } catch (e) { alert("Error: " + e.message); showDashboard(userData); }
}

// --- 4. LOGIKA ADMIN (CUSTOM MODAL) ---
window.promptAdmin = () => {
    document.getElementById('menu-dropdown').classList.add('hidden');
    document.getElementById('admin-modal').classList.remove('hidden');
    document.getElementById('admin-pass-input').value = "";
    document.getElementById('admin-pass-input').focus();
};

window.tutupModalAdmin = () => document.getElementById('admin-modal').classList.add('hidden');

window.cekPasswordAdmin = () => {
    if (document.getElementById('admin-pass-input').value === "1234") {
        tutupModalAdmin();
        bukaAdmin();
    } else alert("Password Salah!");
};

window.bukaAdmin = () => {
    const content = document.getElementById('app-content');
    content.innerHTML = `
        <div class="card" style="max-width:95%">
            <h2>Panel Admin</h2>
            <div class="admin-actions">
                <button id="btn-ev" class="admin-btn" onclick="switchAdminTab('ev')">EVENT</button>
                <button id="btn-lp" class="admin-btn" onclick="switchAdminTab('lp')">LAPORAN</button>
                <button id="btn-db" class="admin-btn" onclick="switchAdminTab('db')">DATABASE</button>
            </div>
            <div id="admin-dynamic-content"></div>
            <button onclick="initApp()" class="secondary-btn" style="margin-top:20px;">KELUAR ADMIN</button>
        </div>`;
    switchAdminTab('ev');
};

window.switchAdminTab = (tab) => {
    document.querySelectorAll('.admin-btn').forEach(b => b.style.background = "#666");
    const activeBtn = document.getElementById(`btn-${tab}`);
    if(activeBtn) activeBtn.style.background = "#007bff";
    
    if (tab === 'ev') formBuatEvent();
    else if (tab === 'lp') lihatLaporan();
    else if (tab === 'db') lihatDatabase();
};

window.formBuatEvent = async () => {
    const container = document.getElementById('admin-dynamic-content');
    const q = query(collection(db, "events"), where("status", "==", "open"));
    const snap = await getDocs(q);
    if (!snap.empty) {
        const d = snap.docs[0].data();
        tampilkanBarcode(snap.docs[0].id, d.nama, d.waktu);
    } else {
        container.innerHTML = `<h3>Buat Event</h3><input type="text" id="ev-nama" placeholder="Nama Ngaji"><input type="datetime-local" id="ev-waktu"><button onclick="simpanEvent()" class="primary-btn">Terbitkan</button>`;
    }
};

window.simpanEvent = async (nama, waktu) => {
    const n = document.getElementById('ev-nama').value;
    const w = document.getElementById('ev-waktu').value;
    if (!n || !w) return alert("Isi data!");
    const id = "EVT-" + Date.now();
    await setDoc(doc(db, "events", id), { nama: n, waktu: w, status: "open", createdAt: serverTimestamp() });
    tampilkanBarcode(id, n, w);
};

function tampilkanBarcode(id, nama, waktu) {
    document.getElementById('admin-dynamic-content').innerHTML = `
        <div style="text-align:center;">
            <h4>${nama}</h4><p>${waktu.replace('T',' ')}</p>
            <div id="qrcode-absen" style="margin:10px auto; display:inline-block;"></div><br>
            <button onclick="downloadQR('qrcode-absen','Absen')" class="secondary-btn">Download Absen</button>
            <div id="qrcode-izin" style="margin:10px auto; display:inline-block;"></div><br>
            <button onclick="downloadQR('qrcode-izin','Izin')" class="secondary-btn">Download Izin</button>
            <button onclick="tutupEvent('${id}')" style="background:red; color:white; width:100%; padding:15px; margin-top:20px; border:none; border-radius:8px;">TUTUP EVENT</button>
        </div>`;
    new QRCode(document.getElementById("qrcode-absen"), id);
    new QRCode(document.getElementById("qrcode-izin"), id + "_IZIN");
}

window.downloadQR = (el, name) => {
    const img = document.getElementById(el).querySelector("img");
    const a = document.createElement("a");
    a.href = img.src; a.download = name + ".png"; a.click();
};

window.tutupEvent = async (id) => {
    if(confirm("Tutup dan Hapus QR?")) { await deleteDoc(doc(db, "events", id)); bukaAdmin(); }
};

window.lihatLaporan = async () => {
    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = `<h3>Laporan</h3><div class="filter-box"><select id="f-desa"><option value="">Semua Desa</option>${Object.keys(dataWilayah).map(d => `<option value="${d}">${d}</option>`).join('')}</select><select id="f-kelompok"><option value="">Semua Kelompok</option></select><button onclick="renderTabelLaporan()" class="primary-btn">Tampilkan</button><button onclick="downloadLaporan()" class="secondary-btn">📥 Download Excel</button><button onclick="resetAbsensi()" style="background:red; color:white; width:100%; margin-top:10px; border:none; padding:10px;">🗑️ Reset</button></div><div id="tabel-container" class="table-responsive"></div>`;
    document.getElementById('f-desa').onchange = (e) => {
        const kel = dataWilayah[e.target.value] || [];
        document.getElementById('f-kelompok').innerHTML = '<option value="">Semua Kelompok</option>' + kel.map(k => `<option value="${k}">${k}</option>`).join('');
    };
    renderTabelLaporan();
};

window.renderTabelLaporan = async () => {
    const fD = document.getElementById('f-desa').value;
    const fK = document.getElementById('f-kelompok').value;
    const tableDiv = document.getElementById('tabel-container');
    tableDiv.innerHTML = "Memuat...";

    let qM = collection(db, "master_jamaah");
    if(fD) qM = query(qM, where("desa", "==", fD));
    if(fK) qM = query(qM, where("kelompok", "==", fK));
    
    const mSnap = await getDocs(qM);
    const hSnap = await getDocs(collection(db, "attendance"));
    const statusMap = {};
    hSnap.forEach(doc => { statusMap[doc.data().nama] = doc.data().status; });

    let html = `<table><thead><tr><th>Nama</th><th>Info</th><th>Status</th></tr></thead><tbody>`;
    mSnap.forEach(doc => {
        const d = doc.data();
        const s = statusMap[d.nama];
        let color = "#ffebee", txt = "❌ ALFA";
        if(s === "hadir") { color = "#e8f5e9"; txt = "✅ HADIR"; }
        else if(s === "izin") { color = "#fff9c4"; txt = "🙏🏻 IZIN"; }
        html += `<tr style="background:${color}"><td><b>${d.nama}</b></td><td><small>${d.desa}<br>${d.kelompok}</small></td><td style="text-align:center;"><b>${txt}</b></td></tr>`;
    });
    tableDiv.innerHTML = html + `</tbody></table>`;
};

window.downloadLaporan = () => {
    const wb = XLSX.utils.table_to_book(document.querySelector("#tabel-container table"));
    XLSX.writeFile(wb, "Laporan.xlsx");
};

window.resetAbsensi = async () => {
    if (confirm("Hapus semua riwayat absen?")) {
        const snap = await getDocs(collection(db, "attendance"));
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "attendance", d.id))));
        renderTabelLaporan();
    }
};

window.lihatDatabase = async () => {
    document.getElementById('admin-dynamic-content').innerHTML = `<div class="filter-box"><input type="text" id="cari-nama-db" placeholder="Cari nama..."><button onclick="renderTabelDatabase()" class="primary-btn">Cari</button></div><div id="db-container" class="table-responsive"></div>`;
    renderTabelDatabase();
};

window.renderTabelDatabase = async () => {
    const cari = document.getElementById('cari-nama-db').value.toUpperCase();
    const snap = await getDocs(collection(db, "master_jamaah"));
    let html = `<table><thead><tr><th>Nama</th><th>Info</th><th>Aksi</th></tr></thead><tbody>`;
    snap.forEach(ds => {
        const d = ds.data();
        if (d.nama.includes(cari) || !cari) {
            html += `<tr><td><b>${d.nama}</b></td><td><small>${d.desa}<br>${d.kelompok}</small></td><td><button onclick="hapusJamaah('${ds.id}','${d.nama}')" style="background:red; color:white; border:none; padding:8px; border-radius:5px;">🗑️</button></td></tr>`;
        }
    });
    document.getElementById('db-container').innerHTML = html + `</tbody></table>`;
};

window.hapusJamaah = async (id, nama) => {
    if (confirm(`Hapus ${nama}?`)) { await deleteDoc(doc(db, "master_jamaah", id)); renderTabelDatabase(); }
};

document.getElementById('menu-btn').onclick = (e) => { e.stopPropagation(); document.getElementById('menu-dropdown').classList.toggle('hidden'); };
window.onclick = () => document.getElementById('menu-dropdown').classList.add('hidden');

const initApp = () => {
    const accounts = getSavedAccounts();
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser) showDashboard(currentUser);
    else if (accounts.length === 1) pilihAkun(accounts[0]);
    else showPageRegistrasi();
};

initApp();
