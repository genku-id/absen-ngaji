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

// --- MODAL & LOGIN ADMIN ---
// --- 1. WINDOW LOGIN AKUN (PENGGANTI DROPDOWN) ---

window.bukaModalPilihAdmin = () => {
    // Bersihkan modal dan ganti isinya dengan form login
    const modalBody = document.querySelector('#modal-pilih-admin .modal-content'); 
    // Ganti selektor di atas sesuai ID pembungkus konten modal kamu
    
    modalBody.innerHTML = `
        <h3 style="margin-bottom:20px;">Login Admin</h3>
        <input type="text" id="admin-user" placeholder="Username" style="width:100%; padding:12px; margin-bottom:10px; border-radius:5px; border:1px solid #ccc;">
        <input type="password" id="admin-pass" placeholder="Password" style="width:100%; padding:12px; margin-bottom:20px; border-radius:5px; border:1px solid #ccc;">
        
        <button onclick="prosesLoginAdmin()" id="btn-login-admin" class="primary-btn" style="width:100%; background:#2196F3;">MASUK KE PANEL</button>
        <button onclick="document.getElementById('modal-pilih-admin').style.display='none'" style="width:100%; margin-top:10px; background:none; border:none; color:red; cursor:pointer;">Batal</button>
    `;
    
    document.getElementById('modal-pilih-admin').style.display = 'flex';
};

window.prosesLoginAdmin = async () => {
    const inputUser = document.getElementById('admin-user').value;
    const inputPass = document.getElementById('admin-pass').value;
    const btn = document.getElementById('btn-login-admin');

    if (!inputUser || !inputPass) return alert("Isi username & password!");

    btn.innerText = "Memverifikasi...";
    btn.disabled = true;

    try {
        // Mencocokkan input dengan field 'username' dan 'password' di Firebase
        const q = query(
            collection(db, "admins"), 
            where("username", "==", inputUser), 
            where("password", "==", inputPass)
        );
        
        const snap = await getDocs(q);

        if (snap.empty) {
            alert("Username atau Password Salah!");
            btn.innerText = "MASUK SEKARANG";
            btn.disabled = false;
            return;
        }

        const adminData = snap.docs[0].data();
        
        // Simpan data login ke memori aplikasi
        window.currentAdmin = {
            role: adminData.role,
            wilayah: adminData.wilayah,
            username: adminData.username
        };

        alert(`Selamat Datang, Admin ${adminData.wilayah}!`);
        document.getElementById('modal-pilih-admin').style.display = 'none';
        
        // Langsung buka panel admin
        if (typeof window.bukaPanelAdmin === 'function') window.bukaPanelAdmin();

    } catch (e) {
        console.error("Login Error:", e);
        alert("Gagal Login: " + e.message);
        btn.disabled = false;
        btn.innerText = "MASUK SEKARANG";
    }
};
// --- SIMPAN EVENT TERISOLASI ---
window.simpanEvent = async () => {
    const nama = document.getElementById('ev-nama').value;
    const waktu = document.getElementById('ev-waktu').value;
    const { role, wilayah } = window.currentAdmin;

    if (!nama || !waktu) return alert("Isi data dulu!");

    try {
        await addDoc(collection(db, "events"), {
            namaEvent: nama,
            waktu: waktu,
            status: "open",
            level: role,
            wilayah: wilayah,
            createdAt: serverTimestamp()
        });
        alert("Event Berhasil Dibuka!");
        window.switchAdminTab('ev'); 
    } catch (e) {
        alert("Gagal: " + e.message);
    }
};

window.lihatLaporan = async () => {
    const container = document.getElementById('admin-dynamic-content');
    const { role, wilayah } = window.currentAdmin;

    // Laporan otomatis terkunci sesuai akun login
    container.innerHTML = `
        <div style="background:#f0f7ff; padding:15px; border-radius:10px; border-left:5px solid #2196F3;">
            <h3 style="margin:0;">Laporan ${role}</h3>
            <p style="margin:5px 0 0; font-weight:bold; color:#1976D2;">Wilayah: ${wilayah}</p>
        </div>
        
        <div class="filter-box" style="margin-top:15px;">
            <button onclick="renderTabelLaporan()" class="primary-btn" style="width:100%; padding:15px;">TAMPILKAN DATA TERBARU</button>
            
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button onclick="downloadLaporan()" class="secondary-btn" style="flex:1;">Download Excel</button>
                <button onclick="bukaModalStatistik()" class="primary-btn" style="flex:1; background:#28a745;">Statistik</button>
            </div>
        </div>
        <div id="tabel-container" style="margin-top:20px;"></div>
    `;
    
    // Langsung muat datanya
    window.renderTabelLaporan();
};

// Fungsi pembantu untuk dropdown filter di tab laporan
window.updateFilterKelompok = () => {
    const d = document.getElementById('f-desa').value;
    const fK = document.getElementById('f-kelompok');
    if (d && fK) {
        const daftar = dataWilayah[d] || [];
        fK.innerHTML = '<option value="">-- Semua Kelompok --</option>' + daftar.map(k => `<option value="${k}">${k}</option>`).join('');
    }
};

window.renderTabelLaporan = async () => {
    const tableDiv = document.getElementById('tabel-container');
    const { role, wilayah } = window.currentAdmin;
    tableDiv.innerHTML = "Memuat data...";

    try {
        // Ambil data absensi yang hanya sesuai wilayah admin tersebut
        let qAbsen = query(collection(db, "attendance"), where("wilayahEvent", "==", wilayah));
        
        // Jika admin DAERAH, baru boleh lihat semua
        if (role === "DAERAH") qAbsen = collection(db, "attendance");

        const hSnap = await getDocs(qAbsen);
        const allAtt = hSnap.docs.map(doc => doc.data());

        // Master Jamaah dengan Filter dari UI
        let qM = collection(db, "master_jamaah");
        if (role === "KELOMPOK") qM = query(qM, where("kelompok", "==", wilayah));
        else if (role === "DESA") qM = query(qM, where("desa", "==", wilayah));
        
        // Tambahan filter manual dari dropdown laporan
        if(fD && role === "DAERAH") qM = query(qM, where("desa", "==", fD));
        if(fK && (role === "DAERAH" || role === "DESA")) qM = query(qM, where("kelompok", "==", fK));

        const mSnap = await getDocs(qM);
        let listJamaah = [];
        mSnap.forEach(doc => {
            const j = doc.data();
            const sini = allAtt.find(a => a.nama === j.nama && a.wilayahEvent === wilayah);
            const luar = allAtt.find(a => a.nama === j.nama && a.wilayahEvent !== wilayah);
            
            let status = "alfa", jam = "-", color = "#ffebee", txt = "❌ ALFA";
            if (sini) {
                status = sini.status;
                jam = sini.waktu ? sini.waktu.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "-";
            } else if (luar) {
                status = "tugas_luar"; txt = "🚀 SB LAIN"; color = "#e3f2fd";
            }
            if (status === "hadir") { color = "#e8f5e9"; txt = "✅ HADIR"; }
            else if (status === "izin") { color = "#fff9c4"; txt = "🙏🏻 IZIN"; }
            listJamaah.push({ ...j, status, jam, color, txt });
        });

        window.currentListData = listJamaah;
        let html = `<table><thead><tr><th>Nama</th><th>Jam</th><th>Status</th></tr></thead><tbody>`;
        let adaData = false;
        listJamaah.forEach(d => {
            if (!evSnap.empty && d.status === "alfa") return;
            adaData = true;
            html += `<tr style="background:${d.color}"><td><b>${d.nama}</b><br><small>${d.kelompok}</small></td><td align="center">${d.jam}</td><td align="center"><b>${d.txt}</b></td></tr>`;
        });
        tableDiv.innerHTML = adaData ? html + `</tbody></table>` : "<p align='center' style='padding:20px;'>Belum ada data masuk.</p>";
    } catch (e) { tableDiv.innerHTML = "Error: " + e.message; }
};

window.downloadLaporan = () => {
    if (!window.currentListData || window.currentListData.length === 0) return alert("Tampilkan data dahulu!");
    let csv = "Nama,Desa,Kelompok,Waktu,Status\n";
    window.currentListData.forEach(row => {
        csv += `${row.nama},${row.desa},${row.kelompok},${row.jam},${row.status.toUpperCase()}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Absensi_${new Date().toLocaleDateString()}.csv`;
    a.click();
};

window.bukaModalStatistik = () => {
    if (!window.currentListData || window.currentListData.length === 0) return alert("Tampilkan laporan dulu!");
    const { role, wilayah } = window.currentAdmin;
    const data = window.currentListData;
    let rekap = {};
    
    data.forEach(d => {
        let key = (role === "DAERAH") ? d.desa : d.kelompok;
        if (!rekap[key]) rekap[key] = { t: 0, h: 0, i: 0, a: 0 };
        rekap[key].t++;
        if (d.status === 'hadir') rekap[key].h++;
        else if (d.status === 'izin') rekap[key].i++;
        else rekap[key].a++;
    });

    let tabelHTML = `<table style="width:100%; border-collapse: collapse; background: white; color: black; font-size: 12px;">
        <thead><tr style="background: #f2f2f2;"><th style="border:1px solid #000;padding:5px;">${role === "DAERAH" ? 'DESA' : 'KELOMPOK'}</th><th style="border:1px solid #000;padding:5px;">%</th><th style="border:1px solid #000;padding:5px;">T</th><th style="border:1px solid #000;padding:5px;">H</th><th style="border:1px solid #000;padding:5px;">I</th><th style="border:1px solid #000;padding:5px;">A</th></tr></thead>
        <tbody>${Object.keys(rekap).map(key => {
            const r = rekap[key];
            const persen = Math.round((r.h / r.t) * 100) || 0;
            return `<tr><td style="border:1px solid #000;padding:5px;">${key}</td><td style="border:1px solid #000;padding:5px;text-align:center;">${persen}%</td><td style="border:1px solid #000;padding:5px;text-align:center;">${r.t}</td><td style="border:1px solid #000;padding:5px;text-align:center;">${r.h}</td><td style="border:1px solid #000;padding:5px;text-align:center;">${r.i}</td><td style="border:1px solid #000;padding:5px;text-align:center;">${r.a}</td></tr>`;
        }).join('')}</tbody></table>`;

    const modal = document.createElement('div');
    modal.id = 'modal-stat';
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; justify-content:center; align-items:center; z-index:9999;";
    modal.innerHTML = `<div style="background:white; padding:20px; border-radius:10px; width:90%; max-width:500px;">
        <div id="capture-area"><h4 style="text-align:center; color:black;">REKAPITULASI STATISTIK</h4>${tabelHTML}</div>
        <div style="margin-top:20px; display:flex; flex-direction:column; gap:10px;">
            <button onclick="downloadStatistikGambar()" class="primary-btn" style="background:#17a2b8;">📸 Download Gambar</button>
            <button onclick="resetAbsensiGass('statistik')" class="secondary-btn" style="background:#dc3545; color:white;">🗑️ Selesai & Reset Data</button>
            <button onclick="document.body.removeChild(document.getElementById('modal-stat'))" class="primary-btn" style="background:#6c757d;">Tutup</button>
        </div></div>`;
    document.body.appendChild(modal);
};

window.downloadStatistikGambar = () => {
    const content = document.getElementById('capture-area').innerHTML;
    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow.document.write(`<html><head><style>table{width:100%;border-collapse:collapse;} th,td{border:1px solid black;padding:8px;text-align:center;}</style></head><body>${content}</body></html>`);
    printWindow.document.close();
    printWindow.print();
};

// --- 3. WINDOW RESET: KUNCI WILAYAH ---
window.resetAbsensiGass = async (asal) => {
    const { wilayah, role } = window.currentAdmin;
    if (confirm("Hapus semua data absen untuk " + wilayah + "?")) {
        try {
            // Hapus berdasarkan wilayah yang sedang aktif
            let q = query(collection(db, "attendance"), where("wilayahEvent", "==", wilayah));
            if (role === "DAERAH") q = collection(db, "attendance"); // Daerah hapus semua
            
            const snap = await getDocs(q);
            await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "attendance", d.id))));

            // Paksa tutup laporan di layar
            document.getElementById('tabel-container').innerHTML = ""; 
            window.currentListData = [];
            if (asal === 'statistik' && document.getElementById('modal-stat')) document.body.removeChild(document.getElementById('modal-stat'));
            
            alert("Selesai! Data wilayah " + wilayah + " sudah bersih.");
            window.switchAdminTab('ev');
        } catch (e) { alert("Reset Gagal: " + e.message); }
    }
};
