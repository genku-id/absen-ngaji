import { db } from './firebase-config.js';
import { 
    collection, getDocs, query, where, addDoc, 
    doc, deleteDoc, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- LOGIN & MODAL ADMIN ---
window.bukaModalPilihAdmin = () => {
    console.log("Membuka modal admin..."); // Untuk cek di console F12
    const modal = document.getElementById('modal-pilih-admin');
    
    if (!modal) {
        alert("Error: Element modal-pilih-admin tidak ditemukan di HTML!");
        return;
    }

    modal.innerHTML = `
        <div class="card" style="width:92%; max-width:400px; padding:30px; text-align:center; position:relative;">
            <h2 style="color:#0056b3; margin-top:0;">Login Admin</h2>
            <p style="font-size:12px; color:gray; margin-bottom:20px;">Masuk sesuai wilayah tugas Anda.</p>
            <input type="text" id="admin-user" placeholder="Username" autocomplete="username">
            <input type="password" id="admin-pass" placeholder="Password" autocomplete="current-password">
            <button onclick="prosesLoginAdmin()" id="btn-login-admin" class="primary-btn">MASUK PANEL</button>
            <button onclick="window.tutupModalAdmin()" style="background:none; border:none; color:red; margin-top:15px; cursor:pointer; font-weight:bold;">Batal</button>
        </div>
    `;

    // Pastikan class 'hidden' dihapus dan display diset ke flex
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
    if (confirm("Tutup event ini?")) {
        await deleteDoc(doc(db, "events", id));
        renderTabEvent();
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
        mSnap.forEach(doc => {
            const j = doc.data();
            // 1. Cek absen di wilayah sendiri
            const myEvIds = activeEvents.filter(e => e.wilayah === wilayah).map(e => e.id);
            const absenSini = allAtt.find(a => a.nama === j.nama && myEvIds.includes(a.eventId));

            // 2. Cek absen di wilayah lain (SB LAIN)
            const absenLain = allAtt.find(a => a.nama === j.nama && !myEvIds.includes(a.eventId));

            let res = { nama: j.nama, kelompok: j.kelompok, jam: "-", status: "❌ ALFA", color: "row-alfa", rawStatus: "alfa" };

            if (absenSini) {
                res.jam = absenSini.waktu?.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) || "-";
                res.status = absenSini.status === "hadir" ? "✅ HADIR" : "🙏🏻 IZIN";
                res.color = absenSini.status === "hadir" ? "row-hadir" : "";
                res.rawStatus = absenSini.status;
            } else if (absenLain) {
                res.status = `🚀 IKUT ${absenLain.wilayahEvent}`;
                res.color = "";
                res.rawStatus = "hadir"; // Terhitung hadir di statistik
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
    if (!data) return alert("Data belum siap");
    
    const hadir = data.filter(d => d.rawStatus === "hadir").length;
    const izin = data.filter(d => d.rawStatus === "izin").length;
    const alfa = data.filter(d => d.rawStatus === "alfa").length;
    const total = data.length;
    const persen = Math.round((hadir/total)*100) || 0;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-stat';
    modal.innerHTML = `
        <div class="card" id="stat-capture" style="text-align:center;">
            <h3>STATISTIK WILAYAH</h3>
            <hr>
            <div style="font-size:40px; font-weight:bold; color:#007bff;">${persen}%</div>
            <p>Kehadiran</p>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-top:20px;">
                <div style="background:#e8f5e9; padding:10px; border-radius:10px;"><b>H</b><br>${hadir}</div>
                <div style="background:#fff9c4; padding:10px; border-radius:10px;"><b>I</b><br>${izin}</div>
                <div style="background:#ffebee; padding:10px; border-radius:10px;"><b>A</b><br>${alfa}</div>
            </div>
            <button onclick="window.print()" class="primary-btn" style="margin-top:20px; background:#17a2b8;">📸 DOWNLOAD GAMBAR</button>
            <button onclick="document.body.removeChild(document.getElementById('modal-stat'))" class="secondary-btn">TUTUP</button>
        </div>
    `;
    document.body.appendChild(modal);
};

window.resetLaporan = async () => {
    if (confirm("Hapus semua laporan wilayah ini?")) {
        const q = query(collection(db, "attendance"), where("wilayahEvent", "==", window.currentAdmin.wilayah));
        const snap = await getDocs(q);
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "attendance", d.id))));
        alert("Data Bersih!");
        renderTabLaporan();
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
