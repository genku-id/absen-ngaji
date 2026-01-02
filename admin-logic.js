import { db } from './firebase-config.js';
import { 
    collection, getDocs, query, where, addDoc, 
    doc, deleteDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const dataWilayah = {
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"]
};

// --- LOGIN ADMIN ---
window.bukaModalPilihAdmin = () => {
    const modal = document.getElementById('modal-pilih-admin');
    modal.innerHTML = `
        <div class="modal-content">
            <h3>Login Panel Utama</h3>
            <p style="font-size:13px; color:gray; margin-bottom:20px;">Gunakan akun resmi wilayah Anda.</p>
            <input type="text" id="admin-user" placeholder="Username">
            <input type="password" id="admin-pass" placeholder="Password">
            <button onclick="prosesLoginAdmin()" id="btn-login-admin" class="primary-btn">MASUK SEKARANG</button>
            <button onclick="tutupModalAdmin()" class="secondary-btn">Batal</button>
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
    const btn = document.getElementById('btn-login-admin');

    if (!user || !pass) return alert("Isi Username & Password!");

    btn.innerText = "Memverifikasi...";
    btn.disabled = true;

    try {
        const q = query(collection(db, "admins"), where("username", "==", user));
        const snap = await getDocs(q);

        if (snap.empty) {
            alert("Username tidak ditemukan!");
        } else {
            const adminData = snap.docs[0].data();
            if (String(adminData.password) === pass) {
                window.currentAdmin = {
                    role: adminData.role,
                    wilayah: adminData.wilayah,
                    username: adminData.username
                };
                alert("Selamat Datang!");
                tutupModalAdmin();
                window.bukaPanelAdmin();
                return;
            } else {
                alert("Password Salah!");
            }
        }
    } catch (e) { alert("Error: " + e.message); }
    btn.innerText = "MASUK SEKARANG";
    btn.disabled = false;
};

// --- PANEL CONTROL ---
window.bukaPanelAdmin = () => {
    document.getElementById('pendaftar-section').classList.add('hidden');
    const adminSec = document.getElementById('admin-section');
    adminSec.classList.remove('hidden');
    adminSec.style.display = 'block';

    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = `
        <div style="text-align:center;">
            <div style="background:#e7f3ff; padding:15px; border-radius:15px; margin-bottom:20px;">
                <h2 style="margin:0; color:#0056b3;">Panel ${window.currentAdmin.wilayah}</h2>
                <p style="margin:5px 0 0; color:#555;">Level: ${window.currentAdmin.role}</p>
            </div>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <button onclick="switchAdminTab('ev')" id="btn-ev" class="primary-btn admin-btn">EVENT</button>
                <button onclick="switchAdminTab('lp')" id="btn-lp" class="primary-btn admin-btn">LAPORAN</button>
                <button onclick="switchAdminTab('db')" id="btn-db" class="primary-btn admin-btn" style="grid-column: span 2; background:#6c757d;">DATABASE JAMAAH</button>
            </div>
            <hr style="margin:20px 0; border:0; border-top:1px solid #ddd;">
            <div id="admin-sub-content"></div>
        </div>
    `;
    window.switchAdminTab('ev');
};

window.switchAdminTab = (tab) => {
    document.querySelectorAll('.admin-btn').forEach(b => b.style.opacity = "0.6");
    const activeBtn = document.getElementById(`btn-${tab}`);
    if(activeBtn) activeBtn.style.opacity = "1";

    if (tab === 'ev') window.formBuatEvent();
    else if (tab === 'lp') window.lihatLaporan();
    else if (tab === 'db') window.lihatDatabase();
};

window.lihatLaporan = async () => {
    const subContainer = document.getElementById('admin-sub-content');
    subContainer.innerHTML = `
        <div class="filter-box">
            <button onclick="renderTabelLaporan()" class="primary-btn">🔄 REFRESH DATA</button>
            <div style="display:flex; gap:10px;">
                <button onclick="downloadLaporan()" class="secondary-btn" style="flex:1;">CSV</button>
                <button onclick="bukaModalStatistik()" class="primary-btn" style="flex:1; background:#28a745;">Statistik</button>
            </div>
        </div>
        <div id="tabel-container" class="table-responsive"></div>
    `;
    window.renderTabelLaporan();
};

window.renderTabelLaporan = async () => {
    const tableDiv = document.getElementById('tabel-container');
    const { role, wilayah } = window.currentAdmin;
    tableDiv.innerHTML = "<p>Loading data...</p>";

    try {
        const qEv = query(collection(db, "events"), where("status", "==", "open"), where("wilayah", "==", wilayah));
        const evSnap = await getDocs(qEv);
        const activeIds = evSnap.docs.map(d => d.id);

        const qAtt = query(collection(db, "attendance"), where("wilayahEvent", "==", wilayah));
        const attSnap = await getDocs(qAtt);
        const allAtt = attSnap.docs.map(d => d.data());

        let qM = collection(db, "master_jamaah");
        if (role === "KELOMPOK") qM = query(qM, where("kelompok", "==", wilayah));
        else if (role === "DESA") qM = query(qM, where("desa", "==", wilayah));
        const mSnap = await getDocs(qM);

        let list = [];
        mSnap.forEach(doc => {
            const j = doc.data();
            const absen = allAtt.find(a => a.nama === j.nama && activeIds.includes(a.eventId));
            
            let status = "alfa", jam = "-", color = "row-alfa", txt = "❌ ALFA";
            if (absen) {
                status = absen.status;
                jam = absen.waktu ? absen.waktu.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "-";
                if(status === "hadir") { color="row-hadir"; txt="✅ HADIR"; }
                else { color=""; txt="🙏🏻 IZIN"; }
            }
            list.push({ ...j, status, jam, color, txt });
        });

        window.currentListData = list;
        let html = `<table><thead><tr><th>Nama</th><th>Jam</th><th>Status</th></tr></thead><tbody>`;
        list.forEach(d => {
            html += `<tr class="${d.color}"><td><b>${d.nama}</b><br><small>${d.kelompok}</small></td><td>${d.jam}</td><td>${d.txt}</td></tr>`;
        });
        tableDiv.innerHTML = html + `</tbody></table>`;
    } catch (e) { tableDiv.innerHTML = "Error: " + e.message; }
};
