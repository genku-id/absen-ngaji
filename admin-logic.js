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
    const modal = document.getElementById('modal-pilih-admin');
    
    // Reset isi form setiap kali modal dibuka
    modal.innerHTML = `
        <div class="modal-content-admin" style="background:white; padding:30px; border-radius:20px; text-align:center; width:90%; max-width:380px; box-shadow:0 10px 30px rgba(0,0,0,0.3);">
            <h2 style="color:#0056b3; margin-top:0;">Login Panel Utama</h2>
            <p style="font-size:13px; color:gray; margin-bottom:20px;">Gunakan akun resmi wilayah Anda.</p>
            
            <input type="text" id="admin-user" placeholder="Username" style="width:100%; padding:12px; margin-bottom:10px; border-radius:10px; border:1px solid #ddd; box-sizing:border-box;">
            <input type="password" id="admin-pass" placeholder="Password" style="width:100%; padding:12px; margin-bottom:20px; border-radius:10px; border:1px solid #ddd; box-sizing:border-box;">
            
            <button onclick="prosesLoginAdmin()" id="btn-login-admin" class="primary-btn" style="width:100%; padding:15px; font-weight:bold; border-radius:10px; background:#2196F3; color:white; border:none; cursor:pointer;">
                MASUK SEKARANG
            </button>
            <button onclick="document.getElementById('modal-pilih-admin').style.display='none'" style="background:none; border:none; color:red; margin-top:15px; cursor:pointer; font-weight:bold;">Batal</button>
        </div>
    `;

    // Pastikan modal di tengah layar
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0,0,0,0.7)';
    modal.style.zIndex = '10000';
};

window.prosesLoginAdmin = async () => {
    const inputUser = document.getElementById('admin-user').value.trim();
    const inputPass = document.getElementById('admin-pass').value.trim();
    const btn = document.getElementById('btn-login-admin');

    if (!inputUser || !inputPass) return alert("Username & Password wajib diisi!");

    // Ubah status tombol agar user tahu proses berjalan
    btn.innerText = "Memverifikasi...";
    btn.disabled = true;
    btn.style.opacity = "0.7";

    try {
        // 1. Ambil data dari koleksi 'admins' berdasarkan username
        const q = query(collection(db, "admins"), where("username", "==", inputUser));
        const snap = await getDocs(q);

        if (snap.empty) {
            alert("Username tidak terdaftar!");
        } else {
            const adminDoc = snap.docs[0];
            const adminData = adminDoc.data();

            // 2. Cek Password (Konversi ke String untuk antisipasi tipe data Number di Firebase)
            if (String(adminData.password) === inputPass) {
                // Login Berhasil
                window.currentAdmin = {
                    role: adminData.role,
                    wilayah: adminData.wilayah,
                    username: adminData.username
                };

                alert(`Selamat Datang, Admin ${adminData.wilayah}!`);
                
                // Tutup Modal & Buka Panel
                document.getElementById('modal-pilih-admin').style.display = 'none';
                if (typeof window.bukaPanelAdmin === 'function') window.bukaPanelAdmin();
                return; // Berhenti di sini jika sukses
            } else {
                alert("Password salah!");
            }
        }
    } catch (e) {
        console.error("Login Error:", e);
        alert("Terjadi kesalahan sistem: " + e.message);
    }

    // --- RESET TOMBOL JIKA GAGAL ---
    // Kode di bawah ini hanya jalan jika proses di atas GAGAL atau salah password
    btn.innerText = "MASUK SEKARANG";
    btn.disabled = false;
    btn.style.opacity = "1";
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
    if (!tableDiv) return;

    tableDiv.innerHTML = "<p align='center'>Menyusun laporan wilayah " + wilayah + "...</p>";

    try {
        // 1. Cari Event yang berstatus "open" di wilayah admin saat ini
        const qEv = query(collection(db, "events"), 
            where("status", "==", "open"), 
            where("wilayah", "==", wilayah)
        );
        const evSnap = await getDocs(qEv);
        
        // Ambil semua ID event yang sedang aktif di wilayah ini
        const activeEventIds = evSnap.docs.map(doc => doc.id);

        // 2. Ambil semua data absensi untuk wilayah ini
        const qAtt = query(collection(db, "attendance"), where("wilayahEvent", "==", wilayah));
        const attSnap = await getDocs(qAtt);
        const allAtt = attSnap.docs.map(doc => doc.data());

        // 3. Ambil Master Jamaah sesuai hirarki admin
        let qM = collection(db, "master_jamaah");
        if (role === "KELOMPOK") qM = query(qM, where("kelompok", "==", wilayah));
        else if (role === "DESA") qM = query(qM, where("desa", "==", wilayah));
        
        const mSnap = await getDocs(qM);

        let listJamaah = [];
        mSnap.forEach(doc => {
            const j = doc.data();
            
            // Cari apakah jamaah ini sudah absen di event wilayah sendiri
            const absenSini = allAtt.find(a => a.nama === j.nama && activeEventIds.includes(a.eventId));
            
            // Cari apakah jamaah ini absen di wilayah lain (Tugas Luar)
            // (Hanya jika belum ada catatan absen di wilayah sendiri)
            const absenLuar = !absenSini ? allAtt.find(a => a.nama === j.nama && !activeEventIds.includes(a.eventId)) : null;

            let status = "alfa", jam = "-", color = "#ffebee", txt = "❌ ALFA";

            if (absenSini) {
                status = absenSini.status;
                jam = absenSini.waktu ? absenSini.waktu.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "-";
            } else if (absenLuar) {
                status = "tugas_luar";
                txt = "🚀 SB LAIN";
                color = "#e3f2fd";
            }

            if (status === "hadir") { color = "#e8f5e9"; txt = "✅ HADIR"; }
            else if (status === "izin") { color = "#fff9c4"; txt = "🙏🏻 IZIN"; }

            listJamaah.push({ ...j, status, jam, color, txt });
        });

        window.currentListData = listJamaah;

        // 4. Render ke Tabel
        let html = `<table><thead><tr><th>Nama</th><th>Jam</th><th>Status</th></tr></thead><tbody>`;
        let adaData = false;

        listJamaah.forEach(d => {
            // Sembunyikan Alfa jika sedang ada event aktif agar tidak penuh
            if (activeEventIds.length > 0 && d.status === "alfa") return;
            
            adaData = true;
            html += `<tr style="background:${d.color}">
                <td><b>${d.nama}</b><br><small>${d.kelompok}</small></td>
                <td align="center">${d.jam}</td>
                <td align="center"><b>${d.txt}</b></td>
            </tr>`;
        });

        tableDiv.innerHTML = adaData ? html + `</tbody></table>` : "<p align='center' style='padding:20px;'>Belum ada data hadir/izin.</p>";

    } catch (e) {
        console.error("Laporan Error:", e);
        tableDiv.innerHTML = "<p style='color:red;'>Gagal memuat: " + e.message + "</p>";
    }
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
