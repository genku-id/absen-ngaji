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
            <p style="font-size: 12px; color: #010530;">Masukan data:</p>
            <select id="reg-desa">
                <option value="">Pilih Desa</option>
                ${Object.keys(dataWilayah).map(desa => `<option value="${desa}">${desa}</option>`).join('')}
            </select>
            <select id="reg-kelompok" disabled><option value="">Pilih Kelompok</option></select>
            <div style="position: relative; width: 100%;">
                <input type="text" id="reg-nama" placeholder="Ketik Nama Anda..." autocomplete="off" disabled>
                <div id="suggestion-box" class="suggestion-container hidden"></div>
            </div>
            
            <div style="margin: 15px 0; text-align: left; color: #010530;">
            <p style="font-size: 13px; margin-bottom: 8px; font-weight: bold;">Jenis Kelamin:</p>
            <div style="display: flex; gap: 20px; align-items: center;">
            <label style="display: flex; align-items: center; cursor: pointer; font-size: 14px;">
            <input type="radio" name="reg-gender" value="PUTRA" style="margin-right: 8px; width: 18px; height: 18px;"> Putra
            </label>
            <label style="display: flex; align-items: center; cursor: pointer; font-size: 14px;">
            <input type="radio" name="reg-gender" value="PUTRI" style="margin-right: 8px; width: 18px; height: 18px;"> Putri
        </label>
    </div>
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
        if (val.length < 1) { suggestBox.classList.add('hidden'); return; }

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
            suggestBox.innerHTML = matches.map(name => `<div class="suggest-item" onclick="pilihSaranNama('${name}')">${name}</div>`).join('');
            suggestBox.classList.remove('hidden');
        } else { suggestBox.classList.add('hidden'); }
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

window.prosesLogin = async () => {
    const namaRaw = document.getElementById('reg-nama').value;
    const nama = namaRaw.trim().toUpperCase();
    const desa = document.getElementById('reg-desa').value;
    const kelompok = document.getElementById('reg-kelompok').value;
    
    // Ambil radio button yang dipilih
    const genderRad = document.querySelector('input[name="reg-gender"]:checked');

    // VALIDASI: Pastikan semua diisi termasuk Jenis Kelamin
    if (!nama || !desa || !kelompok || !genderRad) {
        return alert("⚠️ DATA BELUM LENGKAP!\nMohon isi nama dan pilih Jenis Kelamin (Putra/Putri).");
    }

    const gender = genderRad.value; // Hasilnya "PUTRA" atau "PUTRI"

    try {
        const q = query(collection(db, "master_jamaah"), 
                  where("desa", "==", desa), 
                  where("kelompok", "==", kelompok), 
                  where("nama", "==", nama));
        const snap = await getDocs(q);
        let userData;

        if (!snap.empty) {
            // Jika sudah ada di DB, ambil data aslinya
            const dbData = snap.docs[0].data();
            userData = { 
                nama: dbData.nama, 
                desa, 
                kelompok, 
                gender: dbData.gender || gender 
            };
        } else {
            // Jika pendaftaran baru
            if (confirm(`Daftarkan "${nama}" sebagai ${gender}?`)) {
                userData = { nama, desa, kelompok, gender: gender };
                await addDoc(collection(db, "master_jamaah"), userData);
            } else return;
        }

        saveAccount(userData);
        localStorage.setItem('currentUser', JSON.stringify(userData));
        showDashboard(userData);
    } catch (e) { 
        alert("Error: " + e.message); 
    }
};

// --- 3. DASHBOARD & SCANNER ---
window.showDashboard = (userData) => {
    const content = document.getElementById('app-content');
    content.innerHTML = `
        <div class="card animate-in">
            <div style="text-align:center; padding:30px 0;">
                <h2 style="font-weight: normal; color: #010530;">Assalaamualaikum,</h2>
                <h1 style="color: #010530; margin:10px 0; font-size: 2.2em;">${userData.nama}</h1>
                <p style="color: #888; letter-spacing: 1px;">${userData.desa} - ${userData.kelompok}</p>
            </div>
            <button onclick='mulaiScanner(${JSON.stringify(userData)})' class="primary-btn" style="padding:25px; font-size:20px; border-radius: 50px;">📸 MULAI SCAN BARCODE</button>
        </div>`;
};

window.mulaiScanner = (userData) => {
    const content = document.getElementById('app-content');
    content.innerHTML = `<div class="card" style="padding: 10px;"><div id="reader"></div><button onclick='showDashboard(${JSON.stringify(userData)})' class="secondary-btn" style="margin-top:15px;">BATAL</button></div>`;
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (decodedText) => {
        await html5QrCode.stop();
        prosesAbsensi(decodedText, userData);
    }).catch(err => alert("Akses kamera ditolak!"));
};

async function prosesAbsensi(eventID, userData) {
    try {
        const cleanID = eventID.replace("_IZIN", "");
        const eventSnap = await getDoc(doc(db, "events", cleanID));
        if (!eventSnap.exists()) { alert("EVENT SUDAH DITUTUP"); return showDashboard(userData); }

        const statusAbsen = eventID.includes("_IZIN") ? "izin" : "hadir";
        const attID = `${cleanID}_${userData.nama.replace(/\s/g, '')}`;
        await setDoc(doc(db, "attendance", attID), {
            nama: userData.nama, desa: userData.desa, kelompok: userData.kelompok,
            eventId: cleanID, waktu: serverTimestamp(), status: statusAbsen
        });

        const overlay = document.getElementById('success-overlay');
        overlay.innerHTML = "<h1 style='padding:20px; text-align:center;'>Alhamdulillah Jazaa Kumullahu Khoiroo,<br>LANCAR BAROKAH!</h1>";
        overlay.style.display = 'flex';
        setTimeout(() => { overlay.style.display = 'none'; showDashboard(userData); }, 4000);
    } catch (e) { alert("Gagal: " + e.message); showDashboard(userData); }
}

// --- 4. PANEL ADMIN ---
window.bukaAdmin = () => {
    const pass = prompt("Password Admin:");
    if (pass !== "1234") return alert("Salah!");
    bukaPanelAdmin();
};

window.bukaPanelAdmin = () => {
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
        <div style="text-align:center; width:100%; display:flex; flex-direction:column; align-items:center;">
            <h4 style="margin-bottom:5px;">${nama}</h4>
            <p style="font-size:12px; margin-bottom:20px;">${waktu.replace('T',' ')}</p>
            
            <div class="qr-item" style="width:100%; display:flex; flex-direction:column; align-items:center; margin-bottom:25px;">
                <p style="font-size:14px; margin-bottom:10px;"><b>Barcode Absensi</b></p>
                <div id="qrcode-absen" style="background:white; padding:10px; border-radius:8px; display:flex; justify-content:center;"></div>
                <button onclick="downloadQR('qrcode-absen','Absen_${nama}')" class="secondary-btn" style="margin-top:10px; width:200px;">🖼️ Preview Barcode</button>
            </div>

            <div class="qr-item" style="width:100%; display:flex; flex-direction:column; align-items:center; margin-bottom:25px;">
                <p style="font-size:14px; margin-bottom:10px;"><b>Barcode Izin</b></p>
                <div id="qrcode-izin" style="background:white; padding:10px; border-radius:8px; display:flex; justify-content:center;"></div>
                <button onclick="downloadQR('qrcode-izin','Izin_${nama}')" class="secondary-btn" style="margin-top:10px; width:200px;">🖼️ Preview Barcode Izin</button>
            </div>

            <button onclick="tutupEvent('${id}')" style="background:#d32f2f; color:white; width:90%; max-width:300px; padding:15px; margin-top:10px; border:none; border-radius:8px; font-weight:bold;">TUTUP EVENT (HAPUS QR)</button>
        </div>`;

    // Render QR Code dengan ukuran yang sedikit lebih kecil agar tidak 'overflow' di HP kecil
    new QRCode(document.getElementById("qrcode-absen"), {
        text: id,
        width: 180,
        height: 180,
        correctLevel: QRCode.CorrectLevel.H
    });
    
    new QRCode(document.getElementById("qrcode-izin"), {
        text: id + "_IZIN",
        width: 180,
        height: 180,
        correctLevel: QRCode.CorrectLevel.H
    });
}

window.downloadQR = (el, name) => {
    const container = document.getElementById(el);
    const canvas = container.querySelector("canvas");
    if (!canvas) return alert("Belum siap.");
    const dataUrl = canvas.toDataURL("image/png");

    const overlay = document.createElement('div');
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:20000; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px;";
    overlay.innerHTML = `
        <div style="background:white; padding:20px; border-radius:15px; text-align:center;">
            <img src="${dataUrl}" style="width:100%; max-width:250px;">
            <button id="btn-do-download" style="width:100%; padding:15px; background:#007bff; color:white; border:none; border-radius:8px; margin-top:15px;">📥 DOWNLOAD</button>
            <button id="close-qr" style="margin-top:10px; background:none; border:none; color:gray;">Tutup</button>
        </div>`;
    document.body.appendChild(overlay);
    document.getElementById('btn-do-download').onclick = () => {
        const link = document.createElement("a");
        link.href = dataUrl; link.download = name + ".png"; link.click();
    };
    document.getElementById('close-qr').onclick = () => document.body.removeChild(overlay);
};

window.tutupEvent = async (id) => {
    if(confirm("Tutup Event?")) { await deleteDoc(doc(db, "events", id)); bukaAdmin(); }
};

// --- 5. LAPORAN & STATISTIK ---
window.lihatLaporan = async () => {
    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = `
        <h3>Laporan</h3>
        <div class="filter-box">
            <select id="f-desa"><option value="">Semua Desa</option>${Object.keys(dataWilayah).map(d => `<option value="${d}">${d}</option>`).join('')}</select>
            <select id="f-kelompok"><option value="">Semua Kelompok</option></select>
            <button onclick="renderTabelLaporan()" class="primary-btn">Tampilkan Detail</button>
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button onclick="downloadLaporan()" class="secondary-btn" style="flex:1;">📥 Excel</button>
                <button onclick="bukaModalStatistik()" class="primary-btn" style="flex:1; background:#28a745;">📊 Statistik</button>
            </div>
        </div>
        <div id="tabel-container"></div>`;
    
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

    try {
        const hSnap = await getDocs(collection(db, "attendance"));
        if (hSnap.empty) { tableDiv.innerHTML = "<p style='text-align:center; padding:20px;'>Riwayat kosong.</p>"; return; }

        const qEvent = query(collection(db, "events"), where("status", "==", "open"));
        const evSnap = await getDocs(qEvent);
        const isEventRunning = !evSnap.empty;

        let qM = collection(db, "master_jamaah");
        if(fD) qM = query(qM, where("desa", "==", fD));
        if(fK) qM = query(qM, where("kelompok", "==", fK));
        const mSnap = await getDocs(qM);

        const statusMap = {};
        hSnap.forEach(doc => { statusMap[doc.data().nama] = doc.data().status; });

        let listJamaah = [];
        mSnap.forEach(doc => { listJamaah.push(doc.data()); });
        listJamaah.sort((a, b) => {
            if (a.desa !== b.desa) return a.desa.localeCompare(b.desa);
            if (a.kelompok !== b.kelompok) return a.kelompok.localeCompare(b.kelompok);
            return a.nama.localeCompare(b.nama);
        });

        window.currentListData = listJamaah;

        let html = `<table><thead><tr><th>Nama</th><th>Info</th><th>Status</th></tr></thead><tbody>`;
        let adaData = false;
        listJamaah.forEach(d => {
            const s = statusMap[d.nama];
            if (isEventRunning && !s) return;
            adaData = true;
            let color = "#ffebee", txt = "❌ ALFA";
            if(s === "hadir") { color = "#e8f5e9"; txt = "✅ HADIR"; }
            else if(s === "izin") { color = "#fff9c4"; txt = "🙏🏻 IZIN"; }
            html += `<tr style="background:${color}"><td><b>${d.nama}</b></td><td><small>${d.desa}<br>${d.kelompok}</small></td><td style="text-align:center;"><b>${txt}</b></td></tr>`;
        });
        tableDiv.innerHTML = adaData ? html + `</tbody></table>` : "<p style='text-align:center; padding:20px;'>Belum ada data scan.</p>";
    } catch (e) { tableDiv.innerHTML = "Error: " + e.message; }
};

window.downloadLaporan = () => {
    const table = document.querySelector("#tabel-container table");
    if(!table) return alert("Data kosong");
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, "Laporan_Absensi.xlsx");
};

// --- 6. MODAL STATISTIK & RESET ---
window.bukaModalStatistik = async () => {
    if (!window.currentListData || window.currentListData.length === 0) {
        return alert("Tidak ada data. Silakan tampilkan laporan terlebih dahulu.");
    }

    const hSnap = await getDocs(collection(db, "attendance"));
    const statusMap = {};
    hSnap.forEach(doc => { statusMap[doc.data().nama] = doc.data().status; });

    // Struktur data: rekap[Desa][Kelompok]
    let rekap = {};
    let grandTotal = { tl:0, tp:0, hl:0, hp:0, il:0, ip:0, al:0, ap:0 };

    window.currentListData.forEach(d => {
        const s = statusMap[d.nama];
        const g = (d.gender || "PUTRA").toUpperCase(); 

        if (!rekap[d.desa]) rekap[d.desa] = {};
        if (!rekap[d.desa][d.kelompok]) {
            rekap[d.desa][d.kelompok] = { tl:0, tp:0, hl:0, hp:0, il:0, ip:0, al:0, ap:0 };
        }

        let target = rekap[d.desa][d.kelompok];
        if (g.includes("PUTRA") || g === "L") {
            target.tl++; grandTotal.tl++;
            if (s === 'hadir') { target.hl++; grandTotal.hl++; }
            else if (s === 'izin') { target.il++; grandTotal.il++; }
            else { target.al++; grandTotal.al++; }
        } else {
            target.tp++; grandTotal.tp++;
            if (s === 'hadir') { target.hp++; grandTotal.hp++; }
            else if (s === 'izin') { target.ip++; grandTotal.ip++; }
            else { target.ap++; grandTotal.ap++; }
        }
    });

    const filterDesa = document.getElementById('f-desa').value || "SEMUA DESA";
    let barisHtml = "";

    // Looping per Desa untuk membuat Baris Rekap Desa dan Baris Kelompok
    for (let desa in rekap) {
        const kelompokDiDesa = rekap[desa];
        const daftarKelompok = Object.keys(kelompokDiDesa);
        const jmlKelompok = daftarKelompok.length;

        // Hitung Subtotal Per Desa
        let subDesa = { tl:0, tp:0, hl:0, hp:0, il:0, ip:0, al:0, ap:0 };
        daftarKelompok.forEach(k => {
            const r = kelompokDiDesa[k];
            subDesa.tl += r.tl; subDesa.tp += r.tp;
            subDesa.hl += r.hl; subDesa.hp += r.hp;
            subDesa.il += r.il; subDesa.ip += r.ip;
            subDesa.al += r.al; subDesa.ap += r.ap;
        });

        const dTotalT = subDesa.tl + subDesa.tp;
        const dTotalH = subDesa.hl + subDesa.hp;
        const dPersen = dTotalT > 0 ? Math.round((dTotalH / dTotalT) * 100) : 0;

        // 1. BARIS REKAP DESA (Header Desa)
        barisHtml += `
            <tr style="background:#f9f9f9; font-weight:bold;">
                <td style="border: 1px solid #000; text-align:left; padding:5px;">${desa}</td>
                <td style="border: 1px solid #000;">${desa}</td>
                <td style="border: 1px solid #000;">${dPersen}%</td>
                <td style="border: 1px solid #000;">${dTotalT}</td>
                <td style="border: 1px solid #000;">${dTotalH}</td>
                <td style="border: 1px solid #000;">${subDesa.il + subDesa.ip}</td>
                <td style="border: 1px solid #000;">${subDesa.al + subDesa.ap}</td>
                <td style="border: 1px solid #000;">${subDesa.hl}</td>
                <td style="border: 1px solid #000;">${subDesa.il}</td>
                <td style="border: 1px solid #000;">${subDesa.al}</td>
                <td style="border: 1px solid #000;">${subDesa.hp}</td>
                <td style="border: 1px solid #000;">${subDesa.ip}</td>
                <td style="border: 1px solid #000;">${subDesa.ap}</td>
            </tr>`;

        // 2. BARIS KELOMPOK (Detail di bawah desa)
        daftarKelompok.forEach((kel, index) => {
            const r = kelompokDiDesa[kel];
            const kTotalT = r.tl + r.tp;
            const kTotalH = r.hl + r.hp;
            const kPersen = kTotalT > 0 ? Math.round((kTotalH / kTotalT) * 100) : 0;

            barisHtml += `
                <tr>
                    ${index === 0 ? `<td rowspan="${jmlKelompok}" style="border: 1px solid #000; font-weight:bold; vertical-align:middle; background:#fff;">${desa}</td>` : ''}
                    <td style="border: 1px solid #000; text-align:left; padding-left:5px;">${kel}</td>
                    <td style="border: 1px solid #000;">${kPersen}%</td>
                    <td style="border: 1px solid #000;">${kTotalT}</td>
                    <td style="border: 1px solid #000;">${kTotalH}</td>
                    <td style="border: 1px solid #000;">${r.il + r.ip}</td>
                    <td style="border: 1px solid #000;">${r.al + r.ap}</td>
                    <td style="border: 1px solid #000;">${r.hl}</td>
                    <td style="border: 1px solid #000;">${r.il}</td>
                    <td style="border: 1px solid #000;">${r.al}</td>
                    <td style="border: 1px solid #000;">${r.hp}</td>
                    <td style="border: 1px solid #000;">${r.ip}</td>
                    <td style="border: 1px solid #000;">${r.ap}</td>
                </tr>`;
        });
    }

    // Hitung Grand Total (Total Daerah)
    const gT = grandTotal.tl + grandTotal.tp;
    const gH = grandTotal.hl + grandTotal.hp;
    const gPersen = gT > 0 ? Math.round((gH / gT) * 100) : 0;

    const modal = document.createElement('div');
    modal.id = "modal-stat";
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding:20px 10px; overflow-y:auto;";

    modal.innerHTML = `
    <div style="background:white; color:black; padding:15px; border-radius:10px; width:95%; max-width:850px; box-sizing:border-box; display:flex; flex-direction:column; max-height:90vh;">
        
        <h3 style="text-align:center; margin:0; font-size:14px;">HASIL REKAP KEHADIRAN</h3>
        <h4 style="text-align:center; margin:5px 0 15px 0; font-size:12px;">${filterDesa} - ${new Date().toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</h4>
        
        <div id="capture-area" style="background:white; overflow-x:auto; width:100%; border: 1px solid #ccc; -webkit-overflow-scrolling: touch;">
            <table style="min-width:700px; width:100%; border-collapse:collapse; font-size:11px; text-align:center; border: 1.5px solid #000; table-layout: fixed;">
                <thead>
                    <tr style="background:#fff;">
                        <th style="border: 1px solid #000; padding:5px; width:80px;">DESA</th>
                        <th style="border: 1px solid #000; padding:5px; width:100px;">KELOMPOK</th>
                        <th style="border: 1px solid #000; width:40px;">%</th>
                        <th colspan="4" style="border: 1px solid #000;">TOTAL</th>
                        <th colspan="3" style="border: 1px solid #000;">PUTRA</th>
                        <th colspan="3" style="border: 1px solid #000;">PUTRI</th>
                    </tr>
                    <tr style="background:#fff;">
                        <th colspan="2" style="border: 1px solid #000;"></th>
                        <th style="border: 1px solid #000;"></th>
                        <th style="border: 1px solid #000;">T</th><th style="border: 1px solid #000;">H</th><th style="border: 1px solid #000;">I</th><th style="border: 1px solid #000;">A</th>
                        <th style="border: 1px solid #000;">H</th><th style="border: 1px solid #000;">I</th><th style="border: 1px solid #000;">A</th>
                        <th style="border: 1px solid #000;">H</th><th style="border: 1px solid #000;">I</th><th style="border: 1px solid #000;">A</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background:#f2f2f2; font-weight:bold;">
                        <td colspan="2" style="border: 1px solid #000; padding:8px; text-align:left;">TOTAL DAERAH</td>
                        <td style="border: 1px solid #000;">${gPersen}%</td>
                        <td style="border: 1px solid #000;">${gT}</td>
                        <td style="border: 1px solid #000;">${gH}</td>
                        <td style="border: 1px solid #000;">${grandTotal.il + grandTotal.ip}</td>
                        <td style="border: 1px solid #000;">${grandTotal.al + grandTotal.ap}</td>
                        <td style="border: 1px solid #000;">${grandTotal.hl}</td>
                        <td style="border: 1px solid #000;">${grandTotal.il}</td>
                        <td style="border: 1px solid #000;">${grandTotal.al}</td>
                        <td style="border: 1px solid #000;">${grandTotal.hp}</td>
                        <td style="border: 1px solid #000;">${grandTotal.ip}</td>
                        <td style="border: 1px solid #000;">${grandTotal.ap}</td>
                    </tr>
                    ${barisHtml}
                </tbody>
            </table>
        </div>

        <div style="margin-top: 15px; display:flex; gap:10px; width:100%;">
            <button onclick="downloadStatistikGambar()" style="flex:1; background:#28a745; color:white; padding:12px; border:none; border-radius:8px; font-weight:bold;">📸 DOWNLOAD</button>
            <button onclick="document.body.removeChild(document.getElementById('modal-stat'))" style="flex:1; background:#666; color:white; border:none; padding:10px; border-radius:8px;">TUTUP</button>
        </div>
    </div>
`;
    document.body.appendChild(modal);
};

window.downloadStatistikGambar = () => {
    const area = document.getElementById('capture-area');
    const table = area.querySelector('table'); // Ambil elemen tabel di dalamnya
    const btnDownload = event.target;
    
    btnDownload.innerText = "⏳ Memproses...";
    btnDownload.disabled = true;

    // Trik: Gunakan lebar asli tabel (scrollWidth) agar tidak terpotong
    html2canvas(table, {
        scale: 2, // Hasil tajam
        useCORS: true,
        backgroundColor: "#ffffff",
        width: table.scrollWidth, // PENTING: Pakai lebar total tabel
        height: table.scrollHeight, // PENTING: Pakai tinggi total tabel
        windowWidth: table.scrollWidth, // Pastikan viewport capture seluas tabel
        onclone: (clonedDoc) => {
            // Opsional: Pastikan di dokumen kloningan tabelnya tidak tersembunyi
            const clonedTable = clonedDoc.querySelector('table');
            clonedTable.style.width = table.scrollWidth + 'px';
        }
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Rekap_Kehadiran_Lengkap.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        
        btnDownload.innerText = "📸 DOWNLOAD GAMBAR";
        btnDownload.disabled = false;
    }).catch(err => {
        alert("Gagal: " + err);
        btnDownload.innerText = "📸 DOWNLOAD GAMBAR";
        btnDownload.disabled = false;
    });
};
window.resetAbsensiDariStatistik = async () => {
    if (confirm("Hapus semua riwayat dan kembali ke menu Event?")) {
        const snap = await getDocs(collection(db, "attendance"));
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "attendance", d.id))));
        const modal = document.getElementById('modal-stat');
        if(modal) document.body.removeChild(modal);
        alert("Berhasil direset!");
        bukaPanelAdmin();
    }
};

// --- 7. DATABASE & UTILITY ---
window.lihatDatabase = async () => {
    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = `<div class="filter-box"><input type="text" id="cari-nama-db" placeholder="Cari nama..."><button onclick="renderTabelDatabase()" class="primary-btn">Cari</button></div><div id="db-container"></div>`;
    renderTabelDatabase();
};

window.renderTabelDatabase = async () => {
    const cari = document.getElementById('cari-nama-db').value.toUpperCase();
    const snap = await getDocs(collection(db, "master_jamaah"));
    let html = `<table><thead><tr><th>Nama</th><th>Info</th><th>Aksi</th></tr></thead><tbody>`;
    snap.forEach(ds => {
        const d = ds.data();
        if (d.nama.includes(cari) || !cari) {
            html += `<tr><td><b>${d.nama}</b></td><td><small>${d.desa}<br>${d.kelompok}</small></td><td><button onclick="hapusJamaah('${ds.id}','${d.nama}')" style="background:red; color:white; border:none; padding:5px; border-radius:5px;">🗑️</button></td></tr>`;
        }
    });
    document.getElementById('db-container').innerHTML = html + `</tbody></table>`;
};

window.hapusJamaah = async (id, nama) => {
    if (confirm(`Hapus ${nama}?`)) { await deleteDoc(doc(db, "master_jamaah", id)); renderTabelDatabase(); }
};

document.getElementById('menu-btn').onclick = (e) => { e.stopPropagation(); document.getElementById('menu-dropdown').classList.toggle('hidden'); };
window.onclick = () => document.getElementById('menu-dropdown').classList.add('hidden');
window.promptAdmin = () => { const p = prompt("Pass:"); if(p==="1234") bukaAdmin(); };

const initApp = () => {
    const accounts = getSavedAccounts();
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser) showDashboard(currentUser);
    else if (accounts.length === 1) pilihAkun(accounts[0]);
    else showPageRegistrasi();
};

initApp();
