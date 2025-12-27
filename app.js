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
            <div style="margin-top: 10px; text-align: left; color: #010530; font-size: 13px;">
                <p style="margin-bottom: 5px;">Jenis Kelamin:</p>
                <label><input type="radio" name="reg-gender" value="PUTRA" checked> Putra</label>
                <label style="margin-left: 15px;"><input type="radio" name="reg-gender" value="PUTRI"> Putri</label>
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
    const gender = document.querySelector('input[name="reg-gender"]:checked').value;

    if (!nama || !desa || !kelompok) return alert("Lengkapi data!");

    try {
        const q = query(collection(db, "master_jamaah"), 
                  where("desa", "==", desa), 
                  where("kelompok", "==", kelompok), 
                  where("nama", "==", nama));
        const snap = await getDocs(q);
        let userData;

        if (!snap.empty) {
            const dbData = snap.docs[0].data();
            userData = { nama: dbData.nama, desa, kelompok, gender: dbData.gender || gender };
        } else {
            if (confirm(`Nama "${nama}" belum terdaftar. Daftarkan sebagai ${gender}?`)) {
                userData = { nama, desa, kelompok, gender: gender };
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
                <h2 style="font-weight: normal; color: #010530;">Assalaamualaikum,</h2>
                <h1 style="color: #075e54; margin:10px 0; font-size: 2.2em;">${userData.nama}</h1>
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
        <div style="text-align:center;">
            <h4>${nama}</h4>
            <div id="qrcode-absen" style="margin:10px auto;"></div>
            <button onclick="downloadQR('qrcode-absen','Absen_${nama}')" class="secondary-btn">🖼️ Preview Barcode</button>
            <div id="qrcode-izin" style="margin:20px auto;"></div>
            <button onclick="downloadQR('qrcode-izin','Izin_${nama}')" class="secondary-btn">🖼️ Preview Barcode Izin</button>
            <button onclick="tutupEvent('${id}')" style="background:red; color:white; width:100%; padding:15px; margin-top:20px; border:none; border-radius:8px;">TUTUP EVENT</button>
        </div>`;
    new QRCode(document.getElementById("qrcode-absen"), { text: id, width: 200, height: 200 });
    new QRCode(document.getElementById("qrcode-izin"), { text: id + "_IZIN", width: 200, height: 200 });
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

    let rekap = {};
    let total = { tl:0, tp:0, hl:0, hp:0, il:0, ip:0, al:0, ap:0 };

    window.currentListData.forEach(d => {
        const key = `${d.desa} - ${d.kelompok}`;
        const s = statusMap[d.nama];
        const g = (d.gender || "PUTRA").toUpperCase(); 

        if (!rekap[key]) rekap[key] = { tl:0, tp:0, hl:0, hp:0, il:0, ip:0, al:0, ap:0 };

        if (g.includes("PUTRA") || g === "L") {
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

    const filterDesa = document.getElementById('f-desa').value || "SEMUA DESA";
    let barisHtml = "";
    for (let k in rekap) {
        const r = rekap[k];
        barisHtml += `
            <tr>
                <td style="text-align:left; padding:5px;">${k}</td>
                <td>${r.tl}</td><td>${r.tp}</td>
                <td>${r.hl}</td><td>${r.hp}</td>
                <td>${r.il}</td><td>${r.ip}</td>
                <td>${r.al}</td><td>${r.ap}</td>
            </tr>`;
    }

    const modal = document.createElement('div');
    modal.id = "modal-stat";
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding:20px 10px; overflow-y:auto; -webkit-overflow-scrolling:touch;";
    
    modal.innerHTML = `
        <div id="capture-area" style="background:white; color:black; padding:15px; border-radius:10px; width:100%; max-width:600px; box-sizing:border-box;">
            <h3 style="text-align:center; margin:0 0 10px 0; font-size:14px; color:#007bff;">REKAPITULASI - ${filterDesa}</h3>
            <table border="1" style="width:100%; border-collapse:collapse; font-size:10px; text-align:center;">
                <tr style="background:#eee;">
                    <th rowspan="2">KELOMPOK</th><th colspan="2">TARGET</th><th colspan="2">HADIR</th><th colspan="2">IZIN</th><th colspan="2">ALFA</th>
                </tr>
                <tr style="background:#eee;">
                    <th>PA</th><th>PI</th><th>PA</th><th>PI</th><th>PA</th><th>PI</th><th>PA</th><th>PI</th>
                </tr>
                ${barisHtml}
                <tr style="background:#e3f2fd; font-weight:bold;">
                    <td>TOTAL</td>
                    <td>${total.tl}</td><td>${total.tp}</td><td>${total.hl}</td><td>${total.hp}</td><td>${total.il}</td><td>${total.ip}</td><td>${total.al}</td><td>${total.ap}</td>
                </tr>
            </table>
            <p style="font-size:8px; text-align:right; margin-top:5px; color:#999;">Update: ${new Date().toLocaleString('id-ID')}</p>
        </div>
        
        <div style="margin: 20px 0; display:flex; flex-direction:column; gap:10px; width:100%; max-width:600px; padding-bottom:30px;">
            <button onclick="downloadStatistikGambar()" style="background:#28a745; color:white; padding:15px; border:none; border-radius:8px; font-weight:bold; font-size:16px;">📥 DOWNLOAD GAMBAR</button>
            <button onclick="resetAbsensiDariStatistik()" style="background:#d32f2f; color:white; padding:12px; border:none; border-radius:8px;">🗑️ RESET DATA & KELUAR</button>
            <button onclick="document.body.removeChild(document.getElementById('modal-stat'))" style="background:none; color:white; border:1px solid white; padding:10px; border-radius:8px;">TUTUP</button>
        </div>
    `;
    document.body.appendChild(modal);
};

window.downloadStatistikGambar = () => {
    const area = document.getElementById('capture-area');
    const btnDownload = event.target;
    btnDownload.innerText = "⏳ Memproses...";
    btnDownload.disabled = true;

    html2canvas(area, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff"
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Rekap_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        btnDownload.innerText = "📥 DOWNLOAD GAMBAR";
        btnDownload.disabled = false;
    }).catch(err => {
        alert("Gagal: " + err);
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
