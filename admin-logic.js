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
            <div style="text-align:center;">
                <h3>${ev.namaEvent}</h3>
                <div id="qr-hadir" style="display:inline-block; padding:10px; background:white; margin:10px;"></div>
                <p><b>SCAN HADIR</b></p>
                <div id="qr-izin" style="display:inline-block; padding:10px; background:white; margin:10px;"></div>
                <p><b>SCAN IZIN</b></p>
                <button onclick="window.tutupEvent('${evId}')" class="primary-btn" style="background:#dc3545;">TUTUP EVENT</button>
            </div>
        `;
        new QRCode(document.getElementById("qr-hadir"), { text: evId, width: 150, height: 150 });
        new QRCode(document.getElementById("qr-izin"), { text: evId + "_IZIN", width: 150, height: 150 });
    } else {
        sub.innerHTML = `
            <h3>Buat Event Baru</h3>
            <input type="text" id="ev-nama" placeholder="Nama Acara">
            <input type="datetime-local" id="ev-tgl">
            <button onclick="window.simpanEvent()" class="primary-btn">BUKA ABSENSI</button>
        `;
    }
}

window.simpanEvent = async () => {
    const nama = document.getElementById('ev-nama').value;
    const tgl = document.getElementById('ev-tgl').value;
    if (!nama || !tgl) return alert("Isi data event!");

    await addDoc(collection(db, "events"), {
        namaEvent: nama, waktu: tgl, status: "open",
        wilayah: window.currentAdmin.wilayah, role: window.currentAdmin.role,
        createdAt: serverTimestamp()
    });
    renderTabEvent();
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
    sub.innerHTML = `
        <div style="display:flex; gap:5px; margin-bottom:15px;">
            <button onclick="window.downloadCSV()" class="primary-btn" style="background:#28a745; font-size:12px;">Download CSV</button>
            <button onclick="window.bukaStatistik()" class="primary-btn" style="background:#17a2b8; font-size:12px;">Statistik</button>
            <button onclick="window.resetLaporan()" class="primary-btn" style="background:#dc3545; font-size:12px;">Reset</button>
        </div>
        <div id="laporan-table" class="table-responsive">Memproses data...</div>
    `;

    try {
        const attSnap = await getDocs(collection(db, "attendance"));
        const allAtt = attSnap.docs.map(d => d.data());

        let qM = collection(db, "master_jamaah");
        if (role === "KELOMPOK") qM = query(qM, where("kelompok", "==", wilayah));
        else if (role === "DESA") qM = query(qM, where("desa", "==", wilayah));
        const mSnap = await getDocs(qM);

        let dataLaporan = [];
        mSnap.forEach(doc => {
            const j = doc.data();
            const semuaAbsen = allAtt.filter(a => a.nama === j.nama);
            const absenSini = semuaAbsen.find(a => a.wilayahEvent === wilayah);
            const absenLuar = semuaAbsen.find(a => a.wilayahEvent !== wilayah);

            let res = { nama: j.nama, kelompok: j.kelompok, desa: j.desa, gender: j.gender, jam: "-", status: "❌ ALFA", color: "row-alfa", rawStatus: "alfa" };

            if (absenSini) {
                res.jam = absenSini.waktu?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) || "-";
                res.status = absenSini.status === "hadir" ? "✅ HADIR" : "🙏🏻 IZIN";
                res.color = absenSini.status === "hadir" ? "row-hadir" : "";
                res.rawStatus = absenSini.status;
            } else if (absenLuar) {
                res.jam = absenLuar.waktu?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) || "-";
                res.status = `✅ HADIR (SB ${absenLuar.wilayahEvent})`; 
                res.color = "row-hadir";
                res.rawStatus = "hadir";
            }
            dataLaporan.push(res);
        });

        window.currentReportData = dataLaporan;
        let html = `<table><thead><tr><th>Nama</th><th>Jam</th><th>Status</th></tr></thead><tbody>`;
        dataLaporan.forEach(d => {
            html += `<tr class="${d.color}"><td><b>${d.nama}</b><br><small>${d.kelompok}</small></td><td align="center">${d.jam}</td><td>${d.status}</td></tr>`;
        });
        document.getElementById('laporan-table').innerHTML = html + "</tbody></table>";
    } catch (e) { alert(e.message); }
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
        
        const isG = (d, g) => d.gender && d.gender.trim().toUpperCase() === g;

        const H_Pa = list.filter(d => d.rawStatus === 'hadir' && isG(d, 'PUTRA')).length;
        const I_Pa = list.filter(d => d.rawStatus === 'izin' && isG(d, 'PUTRA')).length;
        const A_Pa = list.filter(d => d.rawStatus === 'alfa' && isG(d, 'PUTRA')).length;

        const H_Pi = list.filter(d => d.rawStatus === 'hadir' && isG(d, 'PUTRI')).length;
        const I_Pi = list.filter(d => d.rawStatus === 'izin' && isG(d, 'PUTRI')).length;
        const A_Pi = list.filter(d => d.rawStatus === 'alfa' && isG(d, 'PUTRI')).length;

        const P = T > 0 ? Math.round((H / T) * 100) : 0;
        return { T, H, I, A, P, H_Pa, I_Pa, A_Pa, H_Pi, I_Pi, A_Pi };
    };

    // Kelompokkan data untuk tampilan berjenjang
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

    // MULAI BANGUN HTML (Pastikan semua tabel masuk ke dalam variabel htmlStat)
    let htmlStat = `
        <div id="capture-area" style="background:white; padding:20px; color:black; width:800px; font-family:Arial;">
            <h2 style="text-align:center; margin-bottom:5px;">LAPORAN STATISTIK KEHADIRAN</h2>
            <p style="text-align:center; margin-top:0;">Wilayah: ${wilayah} | ${new Date().toLocaleDateString('id-ID')}</p>
            
            <table class="stat-table" style="width:100%; border-collapse:collapse; margin-bottom:20px; border:2px solid black;">
                <tr style="background:#f0f0f0;">
                    <th rowspan="2">TOTAL</th><th rowspan="2">%</th><th rowspan="2">T</th><th colspan="3">TOTAL</th><th colspan="3">PUTRA</th><th colspan="3">PUTRI</th>
                </tr>
                <tr style="background:#f0f0f0;">
                    <th>H</th><th>I</th><th>A</th><th>H</th><th>I</th><th>A</th><th>H</th><th>I</th><th>A</th>
                </tr>
                <tr style="font-weight:bold; text-align:center; font-size:16px;">
                    <td>TOTAL</td><td>${sDarah.P}%</td><td>${sDarah.T}</td>
                    <td>${sDarah.H}</td><td>${sDarah.I}</td><td>${sDarah.A}</td>
                    <td>${sDarah.H_Pa}</td><td>${sDarah.I_Pa}</td><td>${sDarah.A_Pa}</td>
                    <td>${sDarah.H_Pi}</td><td>${sDarah.I_Pi}</td><td>${sDarah.A_Pi}</td>
                </tr>
            </table>

            <h4 style="margin: 10px 0 5px 0;">RINGKASAN PER DESA</h4>
            <table class="stat-table" style="width:100%; border-collapse:collapse; text-align:center; margin-bottom:20px;">
                <thead>
                    <tr style="background:#eee;">
                        <th>DESA</th><th>%</th><th>T</th><th>H</th><th>I</th><th>A</th><th>H(Pa)</th><th>I(Pa)</th><th>A(Pa)</th><th>H(Pi)</th><th>I(Pi)</th><th>A(Pi)</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.keys(rekapDesa).map(namaDesa => {
                        const s = hitung(rekapDesa[namaDesa]);
                        return `<tr style="border-bottom:1px solid #ccc;"><td style="text-align:left; font-weight:bold;">${namaDesa}</td><td>${s.P}%</td><td>${s.T}</td><td>${s.H}</td><td>${s.I}</td><td>${s.A}</td><td>${s.H_Pa}</td><td>${s.I_Pa}</td><td>${s.A_Pa}</td><td>${s.H_Pi}</td><td>${s.I_Pi}</td><td>${s.A_Pi}</td></tr>`;
                    }).join('')}
                </tbody>
            </table>

            <h4 style="margin: 10px 0 5px 0;">DETAIL PER KELOMPOK</h4>
            ${Object.keys(detailKelompok).map(namaDesa => `
                <div style="margin-bottom:15px; border:1px solid #ddd;">
                    <div style="background:#28a745; color:white; padding:5px; font-weight:bold;">DESA: ${namaDesa}</div>
                    <table class="stat-table" style="width:100%; border-collapse:collapse; text-align:center; font-size:12px;">
                        <tr style="background:#f9f9f9;">
                            <th style="text-align:left;">KELOMPOK</th><th>%</th><th>T</th><th>H</th><th>I</th><th>A</th><th>H(Pa)</th><th>I(Pa)</th><th>A(Pa)</th><th>H(Pi)</th><th>I(Pi)</th><th>A(Pi)</th>
                        </tr>
                        ${Object.keys(detailKelompok[namaDesa]).map(namaKel => {
                            const s = hitung(detailKelompok[namaDesa][namaKel]);
                            return `<tr style="border-top:1px solid #eee;"><td style="text-align:left;">${namaKel}</td><td>${s.P}%</td><td>${s.T}</td><td>${s.H}</td><td>${s.I}</td><td>${s.A}</td><td>${s.H_Pa}</td><td>${s.I_Pa}</td><td>${s.A_Pa}</td><td>${s.H_Pi}</td><td>${s.I_Pi}</td><td>${s.A_Pi}</td></tr>`;
                        }).join('')}
                    </table>
                </div>
            `).join('')}
        </div>
    `;

    // Tampilkan ke Modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-stat';
    modal.innerHTML = `
        <div class="card" style="max-width:900px; width:95%; max-height:90vh; overflow-y:auto; padding:10px;">
            <div style="overflow-x:auto;">${htmlStat}</div>
            <div style="padding:15px; display:flex; flex-direction:column; gap:10px;">
                <button onclick="window.downloadStatistikGambar()" class="primary-btn" style="background:#17a2b8;">📸 DOWNLOAD GAMBAR (PNG)</button>
                <button onclick="window.resetLaporan()" class="primary-btn" style="background:#dc3545;">🗑️ RESET DATA WILAYAH</button>
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

window.resetLaporan = async () => {
    const { wilayah } = window.currentAdmin;
    if (confirm(`Hapus SEMUA data ${wilayah}?`)) {
        try {
            const qEv = query(collection(db, "events"), where("wilayah", "==", wilayah));
            const snapEv = await getDocs(qEv);
            await Promise.all(snapEv.docs.map(d => deleteDoc(doc(db, "events", d.id))));

            const qAtt = query(collection(db, "attendance"), where("wilayahEvent", "==", wilayah));
            const snapAtt = await getDocs(qAtt);
            await Promise.all(snapAtt.docs.map(d => deleteDoc(doc(db, "attendance", d.id))));

            alert("Data wilayah " + wilayah + " bersih.");
            renderTabEvent();
        } catch (e) { alert(e.message); }
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
    const snap = await getDocs(collection(db, "master_jamaah"));
    let html = `<table><thead><tr><th>Nama</th><th>Wilayah</th><th>Aksi</th></tr></thead><tbody>`;
    snap.forEach(ds => {
        const d = ds.data();
        if (d.nama.includes(key) || !key) {
            html += `<tr><td>${d.nama}</td><td><small>${d.kelompok}</small></td><td><button onclick="hapusJamaah('${ds.id}')" style="background:red; color:white; border:none; border-radius:5px;">✕</button></td></tr>`;
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
        // Hilangkan simbol emoji dan tag HTML untuk CSV yang bersih
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
