import { db } from './firebase-config.js';
import { 
    collection, getDocs, query, where, addDoc, 
    doc, deleteDoc, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- LOGIN & MODAL ADMIN ---
// Di awal file admin-logic.js
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

// Daftarkan juga fungsi pendukung lainnya ke window
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
    Object.keys(btns).forEach(k => document.getElementById(btns[k]).style.background = (k === tab ? "#007bff" : "#666"));

    if (tab === 'ev') renderTabEvent();
    else if (tab === 'lp') renderTabLaporan();
    else if (tab === 'db') renderTabDatabase();
};

// --- TAB EVENT (CREATE & QR) ---
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
                <button onclick="tutupEvent('${evId}')" class="primary-btn" style="background:#dc3545;">TUTUP EVENT</button>
            </div>
        `;
        new QRCode(document.getElementById("qr-hadir"), { text: evId, width: 150, height: 150 });
        new QRCode(document.getElementById("qr-izin"), { text: evId + "_IZIN", width: 150, height: 150 });
    } else {
        sub.innerHTML = `
            <h3>Buat Event Baru</h3>
            <input type="text" id="ev-nama" placeholder="Nama Acara (Contoh: Pengajian)">
            <input type="datetime-local" id="ev-tgl">
            <button onclick="simpanEvent()" class="primary-btn">BUKA ABSENSI</button>
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
    if (confirm("Apakah Anda yakin ingin menutup event ini? Data absensi yang sudah masuk akan tetap tersimpan di laporan.")) {
        try {
            // Kita ubah status event menjadi 'closed' alih-alih menghapusnya 
            // Agar relasi data di laporan tetap kuat
            await setDoc(doc(db, "events", id), { 
                status: "closed",
                closedAt: serverTimestamp() 
            }, { merge: true });
            
            alert("Event Berhasil Ditutup!");
            renderTabEvent();
        } catch (e) {
            alert("Gagal menutup event: " + e.message);
        }
    }
};

// --- TAB LAPORAN (LOGIKA PARALEL SB LAIN) ---
async function renderTabLaporan() {
    const sub = document.getElementById('admin-sub-content');
    const { role, wilayah } = window.currentAdmin;
    sub.innerHTML = `
        <div style="display:flex; gap:5px; margin-bottom:15px;">
            <button onclick="downloadCSV()" class="primary-btn" style="background:#28a745; font-size:12px;">Download CSV</button>
            <button onclick="bukaStatistik()" class="primary-btn" style="background:#17a2b8; font-size:12px;">Statistik</button>
            <button onclick="resetLaporan()" class="primary-btn" style="background:#dc3545; font-size:12px;">Reset</button>
        </div>
        <div id="laporan-table" class="table-responsive">Memproses data paralel...</div>
    `;

    try {
        const evSnap = await getDocs(query(collection(db, "events"), where("status", "==", "open")));
        const activeEvents = evSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const attSnap = await getDocs(collection(db, "attendance"));
        const allAtt = attSnap.docs.map(d => d.data());

        let qM = collection(db, "master_jamaah");
        if (role === "KELOMPOK") qM = query(qM, where("kelompok", "==", wilayah));
        else if (role === "DESA") qM = query(qM, where("desa", "==", wilayah));
        const mSnap = await getDocs(qM);

        let dataLaporan = [];
       // Ganti bagian logika di dalam mSnap.forEach pada renderTabLaporan:

        mSnap.forEach(doc => {
            const j = doc.data();
            
            // Cari semua absensi milik jamaah ini (baik di wilayah sendiri maupun luar)
            const semuaAbsenJamaah = allAtt.filter(a => a.nama === j.nama);
            
            // 1. Cari yang absen di wilayah admin ini (Hadir Lokal)
            const absenSini = semuaAbsenJamaah.find(a => a.wilayahEvent === wilayah);

            // 2. Cari yang absen di wilayah lain (SB LAIN)
            // Hanya diambil jika dia TIDAK absen di wilayah sendiri
            const absenLuar = semuaAbsenJamaah.find(a => a.wilayahEvent !== wilayah);

            let res = { 
                nama: j.nama, 
                kelompok: j.kelompok, 
                jam: "-", 
                status: "❌ ALFA", 
                color: "row-alfa", 
                rawStatus: "alfa" 
            };

            if (absenSini) {
                // TETAP HADIR (LOKAL)
                res.jam = absenSini.waktu?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) || "-";
                res.status = absenSini.status === "hadir" ? "✅ HADIR" : "🙏🏻 IZIN";
                res.color = absenSini.status === "hadir" ? "row-hadir" : "";
                res.rawStatus = absenSini.status;
            } else if (absenLuar) {
                // TETAP DIHITUNG HADIR (TAPI ADA KETERANGAN SB LAIN)
                res.jam = absenLuar.waktu?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) || "-";
                // KUNCI: Status teksnya tetap mengandung kata "HADIR" agar tidak membingungkan
                res.status = `✅ HADIR (SB ${absenLuar.wilayahEvent})`; 
                res.color = "row-hadir"; // Warna hijau
                res.rawStatus = "hadir"; // Masuk hitungan statistik hadir
            }
            
            dataLaporan.push(res);
        });

        window.currentReportData = dataLaporan;
        let html = `<table><thead><tr><th>Nama</th><th>Jam</th><th>Status</th></tr></thead><tbody>`;
        dataLaporan.forEach(d => {
            html += `<tr class="${d.color}"><td><b>${d.nama}</b><br><small>${d.kelompok}</small></td><td>${d.jam}</td><td>${d.status}</td></tr>`;
        });
        document.getElementById('laporan-table').innerHTML = html + "</tbody></table>";
    } catch (e) { alert(e.message); }
}

// --- STATISTIK & RESET ---
window.bukaStatistik = () => {
    const data = window.currentReportData;
    const { role, wilayah } = window.currentAdmin;
    if (!data) return alert("Data belum tersedia!");

    // Fungsi hitung otomatis per gender
    const hitung = (list) => {
        const T = list.length;
        const H = list.filter(d => d.rawStatus === 'hadir').length;
        const I = list.filter(d => d.rawStatus === 'izin').length;
        const A = list.filter(d => d.rawStatus === 'alfa').length;
        
        const H_Pa = list.filter(d => d.rawStatus === 'hadir' && d.gender === 'PUTRA').length;
        const I_Pa = list.filter(d => d.rawStatus === 'izin' && d.gender === 'PUTRA').length;
        const A_Pa = list.filter(d => d.rawStatus === 'alfa' && d.gender === 'PUTRA').length;

        const H_Pi = list.filter(d => d.rawStatus === 'hadir' && d.gender === 'PUTRI').length;
        const I_Pi = list.filter(d => d.rawStatus === 'izin' && d.gender === 'PUTRI').length;
        const A_Pi = list.filter(d => d.rawStatus === 'alfa' && d.gender === 'PUTRI').length;

        const P = T > 0 ? Math.round((H / T) * 100) : 0;
        return { T, H, I, A, P, H_Pa, I_Pa, A_Pa, H_Pi, I_Pi, A_Pi };
    };

    // Pengelompokan data
    let rekapDesa = {};
    let detailKelompok = {}; 
    data.forEach(d => {
        if (!rekapDesa[d.desa]) rekapDesa[d.desa] = [];
        rekapDesa[d.desa].push(d);
        if (!detailKelompok[d.desa]) detailKelompok[d.desa] = {};
        if (!detailKelompok[d.desa][d.kelompok]) detailKelompok[d.desa][d.kelompok] = [];
        detailKelompok[d.desa][d.kelompok].push(d);
    });

    const sDarah = hitung(data); // Total Daerah

    let htmlStat = `
        <div id="capture-area" style="background:white; padding:20px; color:black; width:700px;">
            <h2 style="text-align:center; margin-bottom:5px;">LAPORAN STATISTIK KEHADIRAN</h2>
            <p style="text-align:center; margin-top:0;">Wilayah: ${wilayah} | ${new Date().toLocaleDateString('id-ID')}</p>
            
            <table class="stat-table" style="margin-bottom:20px; border:2px solid #000;">
                <tr style="background:#0056b3; color:white; font-size:16px;">
                    <th rowspan="2" style="width:120px;">TOTAL DAERAH</th>
                    <th rowspan="2">%</th><th rowspan="2">T</th><th colspan="3">TOTAL</th><th colspan="3">PUTRA</th><th colspan="3">PUTRI</th>
                </tr>
                <tr style="background:#0056b3; color:white;">
                    <th>H</th><th>I</th><th>A</th><th>H</th><th>I</th><th>A</th><th>H</th><th>I</th><th>A</th>
                </tr>
                <tr style="font-size:18px; font-weight:bold;">
                    <td>DAERAH</td><td>${sDarah.P}%</td><td>${sDarah.T}</td>
                    <td>${sDarah.H}</td><td>${sDarah.I}</td><td>${sDarah.A}</td>
                    <td>${sDarah.H_Pa}</td><td>${sDarah.I_Pa}</td><td>${sDarah.A_Pa}</td>
                    <td>${sDarah.H_Pi}</td><td>${sDarah.I_Pi}</td><td>${sDarah.A_Pi}</td>
                </tr>
            </table>

            <h4 style="margin-bottom:5px;">RINGKASAN PER DESA</h4>
            <table class="stat-table">
                ${Object.keys(rekapDesa).map(namaDesa => {
                    const s = hitung(rekapDesa[namaDesa]);
                    return `<tr><td style="text-align:left; font-weight:bold; width:120px;">${namaDesa}</td><td>${s.P}%</td><td>${s.T}</td><td>${s.H}</td><td>${s.I}</td><td>${s.A}</td><td>${s.H_Pa}</td><td>${s.I_Pa}</td><td>${s.A_Pa}</td><td>${s.H_Pi}</td><td>${s.I_Pi}</td><td>${s.A_Pi}</td></tr>`;
                }).join('')}
            </table>

            <div style="margin:25px 0;"></div>

            <h4 style="margin-bottom:5px;">RINCIAN PER KELOMPOK</h4>
            ${Object.keys(detailKelompok).map(namaDesa => `
                <div style="margin-bottom:15px; page-break-inside:avoid;">
                    <div style="background:#eee; padding:5px; font-weight:bold; border:1px solid #ccc;">DESA: ${namaDesa}</div>
                    <table class="stat-table">
                        ${Object.keys(detailKelompok[namaDesa]).map(namaKel => {
                            const s = hitung(detailKelompok[namaDesa][namaKel]);
                            return `<tr><td style="text-align:left; width:120px;">${namaKel}</td><td>${s.P}%</td><td>${s.T}</td><td>${s.H}</td><td>${s.I}</td><td>${s.A}</td><td>${s.H_Pa}</td><td>${s.I_Pa}</td><td>${s.A_Pa}</td><td>${s.H_Pi}</td><td>${s.I_Pi}</td><td>${s.A_Pi}</td></tr>`;
                        }).join('')}
                    </table>
                </div>
            `).join('')}
        </div>
    `;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-stat';
    modal.innerHTML = `
        <div class="card" style="max-width:800px; width:95%; max-height:90vh; overflow-y:auto; padding:10px;">
            <div style="overflow-x:auto;">${htmlStat}</div>
            <div style="padding:15px; display:flex; flex-direction:column; gap:10px;">
                <button onclick="downloadStatistikGambar()" class="primary-btn" style="background:#17a2b8;">📸 DOWNLOAD GAMBAR (PNG)</button>
                <button onclick="resetLaporan()" class="primary-btn" style="background:#dc3545;">🗑️ SELESAI & RESET SEMUA</button>
                <button onclick="document.body.removeChild(document.getElementById('modal-stat'))" class="secondary-btn">TUTUP</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
};

// --- FUNGSI DOWNLOAD GAMBAR ASLI ---
window.downloadStatistikGambar = () => {
    const area = document.getElementById('capture-area');
    html2canvas(area, { scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Statistik_Presensi_${window.currentAdmin.wilayah}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
);
};

window.resetLaporan = async () => {
    const { wilayah } = window.currentAdmin;
    
    if (confirm(`PERINGATAN: Menghapus SEMUA laporan dan QR Code untuk wilayah ${wilayah}? Data yang sudah dihapus tidak bisa dikembalikan.`)) {
        try {
            // 1. Cari dan Hapus Event (QR Code) milik wilayah ini
            const qEv = query(collection(db, "events"), where("wilayah", "==", wilayah));
            const snapEv = await getDocs(qEv);
            const deleteEvents = snapEv.docs.map(d => deleteDoc(doc(db, "events", d.id)));

            // 2. Cari dan Hapus Semua Data Absensi (Attendance) milik wilayah ini
            // Kita hapus berdasarkan 'wilayahEvent' agar tepat sasaran
            const qAtt = query(collection(db, "attendance"), where("wilayahEvent", "==", wilayah));
            const snapAtt = await getDocs(qAtt);
            const deleteAtt = snapAtt.docs.map(d => deleteDoc(doc(db, "attendance", d.id)));

            // Jalankan semua proses penghapusan secara bersamaan
            await Promise.all([...deleteEvents, ...deleteAtt]);

            alert(`Berhasil! QR Code dan Laporan wilayah ${wilayah} telah dibersihkan.`);
            
            // Refresh tampilan
            window.switchTab('ev'); // Kembali ke tab event untuk buat baru
        } catch (e) {
            console.error(e);
            alert("Gagal mereset data: " + e.message);
        }
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
