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
window.updateTeksTombolAdmin = () => {
    const selDesa = document.getElementById('sel-desa');
    const selKelompok = document.getElementById('sel-kelompok');
    const btn = document.getElementById('btn-konfirmasi-admin');
    
    const desa = selDesa.value;
    
    if (desa === "") {
        selKelompok.innerHTML = '<option value="">-- Pilih Kelompok --</option>';
        selKelompok.disabled = true;
        btn.innerText = "MASUK SEBAGAI ADMIN DAERAH";
        btn.style.background = "#2196F3"; 
    } else {
        selKelompok.disabled = false;
        // Hanya isi jika dropdown kelompok masih default atau kosong
        if (selKelompok.options.length <= 1) {
            const kelompok = dataWilayah[desa] || [];
            selKelompok.innerHTML = '<option value="">-- Pilih Kelompok (Opsional) --</option>' + 
                                     kelompok.map(k => `<option value="${k}">${k}</option>`).join('');
        }

        if (selKelompok.value === "") {
            btn.innerText = `MASUK SEBAGAI ADMIN DESA ${desa}`;
            btn.style.background = "#4CAF50"; // Warna Hijau untuk Desa
        } else {
            btn.innerText = `MASUK SEBAGAI ADMIN KELOMPOK ${selKelompok.value}`;
            btn.style.background = "#FF9800"; // Warna Oranye untuk Kelompok
        }
    }
};

window.konfirmasiMasukAdmin = () => {
    const d = document.getElementById('sel-desa').value;
    const k = document.getElementById('sel-kelompok').value;
    
    // Penentuan Level Admin Otomatis
    window.currentAdmin = {
        role: k ? "KELOMPOK" : (d ? "DESA" : "DAERAH"),
        wilayah: k || d || "SEMUA"
    };

    // PENGHAPUSAN ULANG PILIHAN (Reset form agar bersih untuk login berikutnya)
    document.getElementById('sel-desa').value = "";
    document.getElementById('sel-kelompok').innerHTML = '<option value="">-- Pilih Kelompok --</option>';
    document.getElementById('sel-kelompok').disabled = true;
    
    // Tutup Modal
    document.getElementById('modal-pilih-admin').style.display = 'none';
    
    // Muat Panel Admin
    if (typeof window.bukaPanelAdmin === 'function') window.bukaPanelAdmin();
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

// --- LAPORAN TERISOLASI ---
window.lihatLaporan = async () => {
    const container = document.getElementById('admin-dynamic-content');
    const { role, wilayah } = window.currentAdmin;
    let desaInduk = role === "DESA" ? wilayah : "";
    if (role === "KELOMPOK") {
        for (let d in dataWilayah) {
            if (dataWilayah[d].includes(wilayah)) { desaInduk = d; break; }
        }
    }

    container.innerHTML = `
        <h3>Laporan ${role} ${wilayah}</h3>
        <div class="filter-box">
            <select id="f-desa" ${role !== 'DAERAH' ? 'disabled' : ''}>
                <option value="${desaInduk}">${desaInduk || '-- Semua Desa --'}</option>
                ${role === 'DAERAH' ? Object.keys(dataWilayah).map(d => `<option value="${d}">${d}</option>`).join('') : ''}
            </select>
            <select id="f-kelompok" ${role === 'KELOMPOK' ? 'disabled' : ''} style="margin-top:10px;">
                <option value="${role === 'KELOMPOK' ? wilayah : ''}">${role === 'KELOMPOK' ? wilayah : '-- Semua Kelompok --'}</option>
            </select>
            <button onclick="renderTabelLaporan()" class="primary-btn" style="margin-top:10px; width:100%;">Tampilkan Detail</button>
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button onclick="downloadLaporan()" class="secondary-btn" style="flex:1;">Excel</button>
                <button onclick="bukaModalStatistik()" class="primary-btn" style="flex:1; background:#28a745;">Statistik</button>
            </div>
        </div>
        <div id="tabel-container"></div>`;
    if (role === "DESA") {
        const fKel = document.getElementById('f-kelompok');
        const daftar = dataWilayah[wilayah] || [];
        fKel.innerHTML = '<option value="">-- Semua Kelompok --</option>' + daftar.map(k => `<option value="${k}">${k}</option>`).join('');
    }
    window.renderTabelLaporan();
};
window.renderTabelLaporan = async () => {
    const fD = document.getElementById('f-desa').value;
    const fK = document.getElementById('f-kelompok').value;
    const tableDiv = document.getElementById('tabel-container');
    const { role, wilayah } = window.currentAdmin;
    tableDiv.innerHTML = "Memuat data...";
    try {
        // 1. Cek dulu apakah ada Event yang sedang OPEN
        const qEv = query(collection(db, "events"), where("status", "==", "open"), where("wilayah", "==", wilayah));
        const evSnap = await getDocs(qEv);
        const isEventRunning = !evSnap.empty;
        // 2. Ambil Riwayat Absen
        let qAbsen = collection(db, "attendance");
        if (role === "KELOMPOK") qAbsen = query(qAbsen, where("kelompok", "==", wilayah));
        else if (role === "DESA") qAbsen = query(qAbsen, where("desa", "==", wilayah));
        const hSnap = await getDocs(qAbsen);
        // KUNCI: Jika database attendance kosong (setelah reset), SEMBUNYIKAN TABEL
        if (hSnap.empty) {
            tableDiv.innerHTML = ""; 
            window.currentListData = [];
            return;
        }
        const attendanceData = {};
        hSnap.forEach(doc => { 
            const d = doc.data();
            let jam = "-";
            if (d.waktu) {
                const date = d.waktu.toDate();
                jam = date.getHours().toString().padStart(2, '0') + ":" + date.getMinutes().toString().padStart(2, '0');
            }
            attendanceData[d.nama] = { status: d.status, jam: jam }; 
        });
        // 3. Ambil Master Jamaah
        let qM = collection(db, "master_jamaah");
        if (role === "KELOMPOK") qM = query(qM, where("kelompok", "==", wilayah));
        else if (role === "DESA") qM = query(qM, where("desa", "==", wilayah));
        const mSnap = await getDocs(qM);
        let listJamaah = [];
        mSnap.forEach(doc => {
            const data = doc.data();
            const att = attendanceData[data.nama];
            listJamaah.push({
                ...data,
                status: att ? att.status : "alfa",
                jam: att ? att.jam : "-"
            });
        });
        window.currentListData = listJamaah;
        // 4. Render Tabel dengan Logika Filter
        let html = `<table><thead><tr><th>Nama</th><th>Waktu</th><th>Status</th></tr></thead><tbody>`;
        let adaDataDitampilkan = false;
        listJamaah.forEach(d => {
            // ALUR: Jika event masih jalan (OPEN), yang ALFA disembunyikan
            if (isEventRunning && d.status === "alfa") return;
            adaDataDitampilkan = true;
            let color = "#ffebee", txt = "❌ ALFA";
            if(d.status === "hadir") { color = "#e8f5e9"; txt = "✅ HADIR"; }
            else if(d.status === "izin") { color = "#fff9c4"; txt = "🙏🏻 IZIN"; }
            html += `<tr style="background:${color}">
                        <td><b>${d.nama}</b><br><small>${d.kelompok}</small></td>
                        <td style="text-align:center;">${d.jam}</td>
                        <td style="text-align:center;"><b>${txt}</b></td>
                    </tr>`;
        });
        tableDiv.innerHTML = adaDataDitampilkan ? html + `</tbody></table>` : "<p style='text-align:center; padding:20px; color:gray;'>Belum ada yang scan.</p>";
    } catch (e) {
        tableDiv.innerHTML = "Error: " + e.message;
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

window.resetAbsensiGass = async (asal) => {
    const { role, wilayah } = window.currentAdmin;
    if (confirm("⚠️ PERINGATAN: Semua data absen akan dihapus dan laporan akan disembunyikan kembali untuk acara baru.")) {
        try {
            // 1. Cari & Hapus data attendance
            let q = query(collection(db, "attendance"), where("desa", "==", wilayah));
            if (role === "KELOMPOK") q = query(collection(db, "attendance"), where("kelompok", "==", wilayah));
            if (role === "DAERAH") q = collection(db, "attendance");
            const snap = await getDocs(q);
            await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "attendance", d.id))));
            // 2. KUNCI: Sembunyikan Tabel secara fisik dari layar
            const tableDiv = document.getElementById('tabel-container');
            if (tableDiv) tableDiv.innerHTML = ""; 
            window.currentListData = []; // Bersihkan memori
            // 3. Tutup modal statistik
            const modal = document.getElementById('modal-stat');
            if (modal) document.body.removeChild(modal);
            alert("✅ Berhasil Reset! Tabel laporan telah disembunyikan.");
            // Kembali ke tab Event
            if (typeof window.switchAdminTab === 'function') window.switchAdminTab('ev');
        } catch (e) {
            alert("❌ Gagal: " + e.message);
        }
    }
};
