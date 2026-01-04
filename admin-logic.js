import { db } from './firebase-config.js';
import { 
    collection, getDocs, query, where, addDoc, 
    doc, deleteDoc, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- LOGIN & MODAL ADMIN ---
window.bukaModalPilihAdmin = () => {
    const modal = document.getElementById('modal-pilih-admin');
    if (!modal) return console.error("Elemen modal-pilih-admin tidak ditemukan!");

    modal.innerHTML = `
        <div class="card" style="width:90%; max-width:400px; padding:30px; text-align:center;">
            <h2 style="color:#0056b3; margin-top:0;">Login Admin</h2>
            <input type="text" id="admin-user" placeholder="Username">
            <input type="password" id="admin-pass" placeholder="Password">
            <button onclick="window.prosesLoginAdmin()" id="btn-login-admin" class="primary-btn">MASUK PANEL</button>
            <button onclick="window.tutupModalAdmin()" style="background:none; border:none; color:red; margin-top:15px; cursor:pointer;">Batal</button>
        </div>
    `;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
};

window.tutupModalAdmin = () => {
    const modal = document.getElementById('modal-pilih-admin');
    modal.classList.add('hidden');
    modal.style.display = 'none';
};

window.prosesLoginAdmin = async () => {
    const user = document.getElementById('admin-user').value.trim();
    const pass = document.getElementById('admin-pass').value.trim();
    if (!user || !pass) return alert("Isi Username & Password!");

    try {
        const q = query(collection(db, "admins"), where("username", "==", user));
        const snap = await getDocs(q);

        if (snap.empty) return alert("Username tidak ditemukan!");
        const data = snap.docs[0].data();

        if (String(data.password) === pass) {
            window.currentAdmin = { role: data.role, wilayah: data.wilayah, username: data.username };
            document.getElementById('modal-pilih-admin').classList.add('hidden');
            window.bukaPanelAdmin();
        } else {
            alert("Password Salah!");
        }
    } catch (e) { alert(e.message); }
};

// --- PANEL ADMIN DINAMIS ---
window.bukaPanelAdmin = () => {
    document.getElementById('pendaftar-section').classList.add('hidden');
    const adminSec = document.getElementById('admin-section');
    adminSec.classList.remove('hidden');

    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = `
        <div style="text-align:center; padding-bottom:15px; border-bottom:2px solid #eee; margin-bottom:15px;">
            <h2 style="margin:0; color:#0056b3;">Admin ${window.currentAdmin.wilayah}</h2>
            <p style="margin:5px 0 0; font-size:12px; color:#666;">Level: <b>${window.currentAdmin.role}</b></p>
        </div>
        <div style="display:flex; gap:5px; margin-bottom:20px;">
            <button onclick="switchTab('ev')" id="tab-ev" class="primary-btn" style="flex:1; font-size:12px;">EVENT</button>
            <button onclick="switchTab('lp')" id="tab-lp" class="primary-btn" style="flex:1; font-size:12px; background:#666;">LAPORAN</button>
            <button onclick="switchTab('db')" id="tab-db" class="primary-btn" style="flex:1; font-size:12px; background:#666;">DATABASE</button>
        </div>
        <div id="admin-sub-content"></div>
    `;
    window.switchTab('ev');
};

window.switchTab = (tab) => {
    const btns = { ev: 'tab-ev', lp: 'tab-lp', db: 'tab-db' };
    Object.keys(btns).forEach(k => {
        const el = document.getElementById(btns[k]);
        if(el) el.style.background = (k === tab ? "#007bff" : "#666");
    });

    if (tab === 'ev') renderTabEvent();
    else if (tab === 'lp') renderTabLaporan();
    else if (tab === 'db') renderTabDatabase();
};

// --- TAB EVENT ---
async function renderTabEvent() {
    const sub = document.getElementById('admin-sub-content');
    sub.innerHTML = "<p>Memeriksa event aktif...</p>";
    
    const q = query(collection(db, "events"), where("status", "==", "open"), where("wilayah", "==", window.currentAdmin.wilayah));
    const snap = await getDocs(q);

    if (!snap.empty) {
        const ev = snap.docs[0].data();
        const evId = snap.docs[0].id;
        
        sub.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; gap:20px; padding:10px;">
                <div style="display:flex; gap:10px; width:100%; max-width:320px;">
                    <button id="btn-pilih-hadir" onclick="window.switchQRIS('hadir', '${evId}', '${ev.namaEvent}')" style="flex:1; padding:10px; border-radius:10px; border:none; background:#0056b3; color:white; font-weight:bold; cursor:pointer;">HADIR</button>
                    <button id="btn-pilih-izin" onclick="window.switchQRIS('izin', '${evId}', '${ev.namaEvent}')" style="flex:1; padding:10px; border-radius:10px; border:none; background:#666; color:white; font-weight:bold; cursor:pointer;">IZIN</button>
                </div>

                <div id="qris-box" style="width: 300px; background: white; padding: 20px; border-radius: 20px; border: 3px solid #0056b3; text-align: center; box-shadow:0 10px 20px rgba(0,0,0,0.1);">
                    <div id="qris-header-bg" style="background: #0056b3; color: white; padding: 12px; border-radius: 12px 12px 0 0; margin: -20px -20px 20px -20px;">
                        <h3 id="qris-title-text" style="margin: 0; letter-spacing: 2px; font-size: 16px;">QR HADIR</h3>
                    </div>
                    
                    <div style="font-weight: 900; color: #333; margin-bottom: 15px; font-size: 18px; text-transform: uppercase;">
                        ${ev.namaEvent}
                    </div>
                    
                    <div id="qrcode-target" style="display:flex; justify-content:center; padding:10px; background:white; border: 1px solid #eee; border-radius: 10px;"></div>
                    
                    <div style="margin-top:15px; border-top: 4px solid #ffc107; padding-top:10px;">
                        <p id="qris-footer-text" style="font-size: 11px; font-weight: bold; color: #555; margin: 0;">SCAN UNTUK KEHADIRAN & SHODAQOH</p>
                        <small id="qris-id-text" style="color: #0056b3; font-weight: bold; font-size: 10px;">ID: ${evId}</small>
                    </div>
                </div>
                
                <div style="width: 100%; max-width: 320px; display: flex; flex-direction: column; gap: 10px;">
                    <button onclick="window.downloadQRIS('${ev.namaEvent}')" class="primary-btn" style="background: #28a745;">📥 SIMPAN KE GALERI</button>
                    <button onclick="window.tutupEvent('${evId}')" class="primary-btn" style="background:#dc3545;">TUTUP EVENT</button>
                </div>
            </div>
        `;
        window.switchQRIS('hadir', evId, ev.namaEvent);

    } else {
        sub.innerHTML = `
            <h3>Buat Event Baru</h3>
            <input type="text" id="ev-nama" placeholder="Nama Acara (Misal: Pengajian Mumi)">
            <input type="datetime-local" id="ev-tgl">
            <button onclick="window.simpanEvent()" class="primary-btn">BUKA ABSENSI</button>
        `;
    }
}

window.switchQRIS = (tipe, id, nama) => {
    const target = document.getElementById("qrcode-target");
    const title = document.getElementById("qris-title-text");
    const footer = document.getElementById("qris-footer-text");
    const idTxt = document.getElementById("qris-id-text");
    const header = document.getElementById("qris-header-bg");
    const btnH = document.getElementById("btn-pilih-hadir");
    const btnI = document.getElementById("btn-pilih-izin");

    target.innerHTML = ""; 
    const finalId = (tipe === 'izin') ? id + "_IZIN" : id;

    if (tipe === 'izin') {
        title.innerText = "QR IZIN";
        footer.innerText = "SCAN UNTUK IZIN (SB LAIN)";
        header.style.background = "#6c757d"; 
        btnI.style.background = "#6c757d";
        btnH.style.background = "#ccc";
    } else {
        title.innerText = "QR HADIR";
        footer.innerText = "SCAN UNTUK KEHADIRAN & SHODAQOH";
        header.style.background = "#0056b3";
        btnH.style.background = "#0056b3";
        btnI.style.background = "#ccc";
    }

    idTxt.innerText = "ID: " + finalId;
    new QRCode(target, { text: finalId, width: 220, height: 220, correctLevel : QRCode.CorrectLevel.H });
};

window.simpanEvent = async () => {
    const nama = document.getElementById('ev-nama').value;
    const tgl = document.getElementById('ev-tgl').value;
    
    // Ambil semua target kelas yang dicentang
    const selectedKelas = Array.from(document.querySelectorAll('.target-kelas:checked'))
                               .map(cb => cb.value);

    if (!nama || !tgl || selectedKelas.length === 0) {
        return alert("Isi data event dan pilih minimal satu Target Peserta!");
    }

    await addDoc(collection(db, "events"), {
        namaEvent: nama, 
        waktu: tgl, 
        status: "open",
        targetKelas: selectedKelas, // Simpan array target kelas
        wilayah: window.currentAdmin.wilayah, 
        role: window.currentAdmin.role,
        createdAt: serverTimestamp()
    });
    renderTabEvent();
};

window.downloadQRIS = (nama) => {
    const frame = document.getElementById('qris-box');
    html2canvas(frame, { scale: 3, backgroundColor: "#ffffff" }).then(canvas => {
        const link = document.createElement('a');
        link.download = `QR_Absen_${nama.replace(/\s+/g, '_')}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
};

window.tutupEvent = async (id) => {
    if (confirm("Tutup event ini? Laporan tetap tersimpan.")) {
        try {
            await setDoc(doc(db, "events", id), { status: "closed", closedAt: serverTimestamp() }, { merge: true });
            alert("Event Berhasil Ditutup!");
            renderTabEvent();
        } catch (e) { alert(e.message); }
    }
};

// --- TAB LAPORAN ---
async function renderTabLaporan() {
    const sub = document.getElementById('admin-sub-content');
    const { wilayah, role } = window.currentAdmin;
    sub.innerHTML = `<div id="laporan-table" class="table-responsive">Memproses data...</div>`;

    try {
        const qEv = query(collection(db, "events"), where("status", "==", "open"), where("wilayah", "==", wilayah));
        const evSnap = await getDocs(qEv);

        if (evSnap.empty) {
            sub.innerHTML = `<div style="text-align:center; padding:20px; color:#666;"><p>⚠️ Tidak ada Event yang sedang dibuka.</p></div>`;
            return;
        }

        const activeEventId = evSnap.docs[0].id;
        const activeEventName = evSnap.docs[0].data().namaEvent;

        sub.innerHTML = `
            <div style="margin-bottom:15px; background:#f8f9fa; padding:10px; border-radius:10px; border-left:5px solid #007bff;">
                <small>Laporan Aktif:</small><br><b>${activeEventName}</b>
            </div>
            <div style="display:flex; gap:5px; margin-bottom:15px;">
                <button onclick="window.downloadCSV()" class="primary-btn" style="background:#28a745; font-size:12px;">CSV</button>
                <button onclick="window.bukaStatistik()" class="primary-btn" style="background:#17a2b8; font-size:12px;">Statistik</button>
                <button onclick="window.resetLaporan()" class="primary-btn" style="background:#dc3545; font-size:12px;">Reset</button>
            </div>
            <div id="laporan-table" class="table-responsive">Memuat data...</div>
        `;

        const qAtt = query(collection(db, "attendance"), where("eventId", "==", activeEventId));
        const attSnap = await getDocs(qAtt);
        const allAtt = attSnap.docs.map(d => d.data());

        let qM = collection(db, "master_jamaah");
        if (role === "KELOMPOK") qM = query(qM, where("kelompok", "==", wilayah));
        else if (role === "DESA") qM = query(qM, where("desa", "==", wilayah));
        const mSnap = await getDocs(qM);

        let dataLaporan = [];
        mSnap.forEach(doc => {
            const j = doc.data();
            const absen = allAtt.find(a => a.nama === j.nama);
            let res = { 
                nama: j.nama, kelompok: j.kelompok, desa: j.desa, gender: j.gender, 
                jam: "-", shodaqoh: 0, status: "❌ ALFA", color: "row-alfa", rawStatus: "alfa" 
            };
            if (absen) {
                res.jam = absen.waktu?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) || "-";
                res.shodaqoh = absen.shodaqoh || 0;
                res.status = absen.status === "hadir" ? "✅ HADIR" : "🙏🏻 IZIN";
                res.color = absen.status === "hadir" ? "row-hadir" : "row-izin";
                res.rawStatus = absen.status;
            }
            dataLaporan.push(res);
        });

        // --- LOGIKA PENGURUTAN SAKTI ---
        dataLaporan.sort((a, b) => {
            // 1. Urut berdasarkan Desa
            if (a.desa !== b.desa) return a.desa.localeCompare(b.desa);
            // 2. Jika Desa sama, urut berdasarkan Kelompok
            if (a.kelompok !== b.kelompok) return a.kelompok.localeCompare(b.kelompok);
            // 3. Jika Kelompok sama, urut berdasarkan Nama (A-Z)
            return a.nama.localeCompare(b.nama);
        });

        window.currentReportData = dataLaporan;
        let html = `<table><thead><tr><th>Nama & Wilayah</th><th>Jam</th><th>SHODAQOH</th><th>Status</th></tr></thead><tbody>`;
        
        let lastDesa = "";
        let lastKelompok = "";

        dataLaporan.forEach(d => {
            // Tambahkan Header Desa jika ganti Desa (Hanya untuk Admin Daerah)
            if (role === "DAERAH" && d.desa !== lastDesa) {
                html += `<tr style="background:#333; color:white;"><td colspan="4" style="padding:5px 10px; font-weight:bold;">DESA: ${d.desa}</td></tr>`;
                lastDesa = d.desa;
            }
            // Tambahkan Header Kelompok jika ganti Kelompok
            if (d.kelompok !== lastKelompok) {
                html += `<tr style="background:#e9ecef;"><td colspan="4" style="padding:5px 10px; font-weight:bold; color:#0056b3;">KELOMPOK: ${d.kelompok}</td></tr>`;
                lastKelompok = d.kelompok;
            }

            const txtUang = d.shodaqoh > 0 ? `<b>${d.shodaqoh.toLocaleString('id-ID')}</b>` : `-`;
            html += `<tr class="${d.color}">
                <td><b>${d.nama}</b></td>
                <td align="center">${d.jam}</td>
                <td align="right" style="color:#28a745;">${txtUang}</td>
                <td>${d.status}</td>
            </tr>`;
        });
        document.getElementById('laporan-table').innerHTML = html + "</tbody></table>";
    } catch (e) { console.error(e); alert("Error: " + e.message); }
}
// --- STATISTIK ---
window.bukaStatistik = () => {
    const data = window.currentReportData;
    const { wilayah, role } = window.currentAdmin;
    if (!data) return alert("Data belum tersedia!");

    const hitung = (list) => {
        const T = list.length;
        const H = list.filter(d => d.rawStatus === 'hadir').length;
        const I = list.filter(d => d.rawStatus === 'izin').length;
        const A = list.filter(d => d.rawStatus === 'alfa').length;
        const totalUang = list.reduce((acc, curr) => acc + (curr.shodaqoh || 0), 0);
        
        const isG = (d, g) => d.gender && d.gender.trim().toUpperCase() === g;

        const H_Pa = list.filter(d => d.rawStatus === 'hadir' && isG(d, 'PUTRA')).length;
        const I_Pa = list.filter(d => d.rawStatus === 'izin' && isG(d, 'PUTRA')).length;
        const A_Pa = list.filter(d => d.rawStatus === 'alfa' && isG(d, 'PUTRA')).length;

        const H_Pi = list.filter(d => d.rawStatus === 'hadir' && isG(d, 'PUTRI')).length;
        const I_Pi = list.filter(d => d.rawStatus === 'izin' && isG(d, 'PUTRI')).length;
        const A_Pi = list.filter(d => d.rawStatus === 'alfa' && isG(d, 'PUTRI')).length;

        const P = T > 0 ? Math.round((H / T) * 100) : 0;
        return { T, H, I, A, P, H_Pa, I_Pa, A_Pa, H_Pi, I_Pi, A_Pi, totalUang };
    };

    let rekapDesa = {};
    let detailKelompok = {}; 
    data.forEach(d => {
        if (!rekapDesa[d.desa]) rekapDesa[d.desa] = [];
        rekapDesa[d.desa].push(d);

        if (!detailKelompok[d.desa]) detailKelompok[d.desa] = {};
        if (!detailKelompok[d.desa][d.kelompok]) detailKelompok[d.desa][d.kelompok] = [];
        detailKelompok[d.desa][d.kelompok].push(d);
    });

    const sDarah = hitung(data);

    let tableUtama = `
        <table class="stat-table" style="width:100%; border-collapse:collapse; margin-bottom:20px; border:2px solid black;">
            <tr style="background:#f0f0f0;">
                <th rowspan="2">TOTAL</th><th rowspan="2">%</th><th rowspan="2">SHODAQOH</th><th rowspan="2">T</th><th colspan="3">TOTAL</th><th colspan="3">PUTRA</th><th colspan="3">PUTRI</th>
            </tr>
            <tr style="background:#f0f0f0;">
                <th>H</th><th>I</th><th>A</th><th>H</th><th>I</th><th>A</th><th>H</th><th>I</th><th>A</th>
            </tr>
            <tr style="font-weight:bold; text-align:center; font-size:16px; background:#e8f5e9;">
                <td>TOTAL</td><td>${sDarah.P}%</td><td style="color:#28a745;">${sDarah.totalUang.toLocaleString('id-ID')}</td><td>${sDarah.T}</td>
                <td>${sDarah.H}</td><td>${sDarah.I}</td><td>${sDarah.A}</td>
                <td>${sDarah.H_Pa}</td><td>${sDarah.I_Pa}</td><td>${sDarah.A_Pa}</td>
                <td>${sDarah.H_Pi}</td><td>${sDarah.I_Pi}</td><td>${sDarah.A_Pi}</td>
            </tr>
        </table>
    `;

    let tableDesa = "";
    if (role === "DAERAH") {
        tableDesa = `
            <h4 style="margin: 10px 0 5px 0;">RINGKASAN PER DESA</h4>
            <table class="stat-table" style="width:100%; border-collapse:collapse; text-align:center; margin-bottom:20px;">
                <thead>
                    <tr style="background:#eee;">
                        <th>DESA</th><th>%</th><th>SHODAQOH</th><th>T</th><th>H</th><th>I</th><th>A</th><th>H(Pa)</th><th>I(Pa)</th><th>A(Pa)</th><th>H(Pi)</th><th>I(Pi)</th><th>A(Pi)</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.keys(rekapDesa).map(namaDesa => {
                        const s = hitung(rekapDesa[namaDesa]);
                        return `<tr style="border-bottom:1px solid #ccc;"><td style="text-align:left; font-weight:bold;">${namaDesa}</td><td>${s.P}%</td><td style="color:#28a745; font-weight:bold;">${s.totalUang.toLocaleString('id-ID')}</td><td>${s.T}</td><td>${s.H}</td><td>${s.I}</td><td>${s.A}</td><td>${s.H_Pa}</td><td>${s.I_Pa}</td><td>${s.A_Pa}</td><td>${s.H_Pi}</td><td>${s.I_Pi}</td><td>${s.A_Pi}</td></tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    let tableKelompok = "";
    if (role === "DAERAH" || role === "DESA") {
        tableKelompok = `
            <h4 style="margin: 10px 0 5px 0;">DETAIL PER KELOMPOK</h4>
            ${Object.keys(detailKelompok).map(namaDesa => `
                <div style="margin-bottom:15px; border:1px solid #ddd;">
                    <div style="background:#28a745; color:white; padding:5px; font-weight:bold;">DESA: ${namaDesa}</div>
                    <table class="stat-table" style="width:100%; border-collapse:collapse; text-align:center; font-size:12px;">
                        <tr style="background:#f9f9f9;">
                            <th style="text-align:left;">KELOMPOK</th><th>%</th><th>SHODAQOH</th><th>T</th><th>H</th><th>I</th><th>A</th><th>H(Pa)</th><th>I(Pa)</th><th>A(Pa)</th><th>H(Pi)</th><th>I(Pi)</th><th>A(Pi)</th>
                        </tr>
                        ${Object.keys(detailKelompok[namaDesa]).map(namaKel => {
                            const s = hitung(detailKelompok[namaDesa][namaKel]);
                            return `<tr style="border-top:1px solid #eee;"><td style="text-align:left;">${namaKel}</td><td>${s.P}%</td><td style="color:#28a745; font-weight:bold;">${s.totalUang.toLocaleString('id-ID')}</td><td>${s.T}</td><td>${s.H}</td><td>${s.I}</td><td>${s.A}</td><td>${s.H_Pa}</td><td>${s.I_Pa}</td><td>${s.A_Pa}</td><td>${s.H_Pi}</td><td>${s.I_Pi}</td><td>${s.A_Pi}</td></tr>`;
                        }).join('')}
                    </table>
                </div>
            `).join('')}
        `;
    }

    let htmlStat = `
        <div id="capture-area" style="background:white; padding:20px; color:black; width:800px; font-family:Arial;">
            <h2 style="text-align:center; margin-bottom:5px;">LAPORAN STATISTIK KEHADIRAN</h2>
            <p style="text-align:center; margin-top:0;">Wilayah: ${wilayah} | ${new Date().toLocaleDateString('id-ID')}</p>
            ${tableUtama}
            ${tableDesa}
            ${tableKelompok}
        </div>
    `;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-stat';
    modal.innerHTML = `
        <div class="card" style="max-width:900px; width:95%; max-height:90vh; overflow-y:auto; padding:10px;">
            <div style="overflow-x:auto;">${htmlStat}</div>
            <div style="padding:15px; display:flex; flex-direction:column; gap:10px;">
                <button onclick="window.downloadStatistikGambar()" class="primary-btn" style="background:#17a2b8;">📸 DOWNLOAD GAMBAR (PNG)</button>
                <button onclick="document.body.removeChild(document.getElementById('modal-stat'))" class="secondary-btn">TUTUP</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

window.downloadStatistikGambar = () => {
    const area = document.getElementById('capture-area');
    html2canvas(area, { scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Statistik_${window.currentAdmin.wilayah}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    }).catch(e => console.error(e));
};

window.handleResetLaporan = async () => {
    const konfirmasi = confirm("PERINGATAN: Reset akan menghapus semua data scan saat ini dan memasukannya ke Rekap Bulanan. Lanjutkan?");
    if (!konfirmasi) return;

    // Tampilkan loading (opsional)
    console.log("Sedang merekap dan menghapus data...");
    
    const sukses = await window.prosesRekapDanReset(window.currentAdmin.wilayah, window.currentAdmin.role);
    
    if (sukses) {
        alert("Laporan berhasil di-reset dan data telah direkap.");
        // Refresh tampilan laporan agar kembali kosong/alfa
        if (typeof renderTabLaporan === 'function') renderTabLaporan();
    } else {
        alert("Terjadi kesalahan saat mereset data.");
    }
};
// --- TAB DATABASE JAMAAH ---
async function renderTabDatabase() {
    const sub = document.getElementById('admin-sub-content');
    sub.innerHTML = `<input type="text" id="db-search" placeholder="Cari Nama..." oninput="filterDB()"><div id="db-list"></div>`;
    window.filterDB();
}

window.filterDB = async () => {
    const key = document.getElementById('db-search').value.toUpperCase();
    const { wilayah, role } = window.currentAdmin;
    
    // Filter database sesuai wilayah Admin login
    let q = collection(db, "master_jamaah");
    if (role === "KELOMPOK") q = query(q, where("kelompok", "==", wilayah));
    else if (role === "DESA") q = query(q, where("desa", "==", wilayah));
    
    const snap = await getDocs(q);
    let listJamaah = [];
    snap.forEach(ds => listJamaah.push({id: ds.id, ...ds.data()}));

    // Urutkan A-Z
    listJamaah.sort((a, b) => a.nama.localeCompare(b.nama));

    let html = `<table><thead><tr><th>Nama</th><th>Kelompok</th><th>Aksi</th></tr></thead><tbody>`;
    listJamaah.forEach(d => {
        if (d.nama.includes(key) || !key) {
            html += `<tr>
                <td><b>${d.nama}</b></td>
                <td><small>${d.kelompok}</small></td>
                <td><button onclick="hapusJamaah('${d.id}')" style="background:#dc3545; color:white; border:none; padding:5px 10px; border-radius:5px;">✕</button></td>
            </tr>`;
        }
    });
    document.getElementById('db-list').innerHTML = html + "</tbody></table>";
};

window.hapusJamaah = async (id) => {
    if (confirm("Hapus jamaah dari database?")) {
        await deleteDoc(doc(db, "master_jamaah", id));
        renderTabDatabase();
    }
};

window.downloadCSV = () => {
    const data = window.currentReportData;
    if (!data || data.length === 0) return alert("Tidak ada data untuk didownload");

    let csvContent = "data:text/csv;charset=utf-8,Nama,Kelompok,Jam,Status\n";
    data.forEach(row => {
        const cleanStatus = row.status.replace(/<\/?[^>]+(>|$)/g, "").replace(/[^\x00-\x7F]/g, "");
        csvContent += `${row.nama},${row.kelompok},${row.jam},${cleanStatus}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Absensi_${window.currentAdmin.wilayah}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
