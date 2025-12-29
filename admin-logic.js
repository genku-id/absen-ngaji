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
    selKelompok.innerHTML = '<option value="">-- Pilih Kelompok --</option>';

    if (desa === "") {
        selKelompok.disabled = true;
        btn.innerText = "MASUK SEBAGAI ADMIN DAERAH";
        btn.style.background = "#2196F3"; 
    } else {
        selKelompok.disabled = false;
        const kelompok = dataWilayah[desa] || [];
        kelompok.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k; opt.innerText = k;
            selKelompok.appendChild(opt);
        });

        if (selKelompok.value === "") {
            btn.innerText = `MASUK SEBAGAI ADMIN DESA ${desa}`;
            btn.style.background = "#4CAF50";
        } else {
            btn.innerText = `MASUK SEBAGAI ADMIN KELOMPOK ${selKelompok.value}`;
            btn.style.background = "#FF9800";
        }
    }
};

window.konfirmasiMasukAdmin = () => {
    const d = document.getElementById('sel-desa').value;
    const k = document.getElementById('sel-kelompok').value;
    
    window.currentAdmin = {
        role: k ? "KELOMPOK" : (d ? "DESA" : "DAERAH"),
        wilayah: k || d || "SEMUA"
    };

    // Reset Form
    document.getElementById('sel-desa').value = "";
    document.getElementById('sel-kelompok').disabled = true;
    document.getElementById('modal-pilih-admin').style.display = 'none';
    
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
            level: role,    // Sesuai screenshot kamu
            wilayah: wilayah, // Sesuai screenshot kamu
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

    // Cari Desa Induk jika Admin Kelompok
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
        // 1. Ambil Riwayat Absen
        let qAbsen = collection(db, "attendance");
        if (role === "KELOMPOK") qAbsen = query(qAbsen, where("kelompok", "==", wilayah));
        else if (role === "DESA") qAbsen = query(qAbsen, where("desa", "==", wilayah));

        const hSnap = await getDocs(qAbsen);
        
        // Simpan status dan waktu ke dalam map
        const attendanceData = {};
        hSnap.forEach(doc => { 
            const d = doc.data();
            // Format waktu jika ada
            let jam = "-";
            if (d.waktu) {
                const date = d.waktu.toDate();
                jam = date.getHours().toString().padStart(2, '0') + ":" + 
                      date.getMinutes().toString().padStart(2, '0');
            }
            attendanceData[d.nama] = { status: d.status, jam: jam }; 
        });

        // 2. Ambil Master Jamaah
        let qM = collection(db, "master_jamaah");
        if (role === "KELOMPOK") qM = query(qM, where("kelompok", "==", wilayah));
        else if (role === "DESA") qM = query(qM, where("desa", "==", wilayah));
        
        // Filter tambahan dari dropdown
        if(fD && role === "DAERAH") qM = query(qM, where("desa", "==", fD));
        if(fK && (role === "DAERAH" || role === "DESA")) qM = query(qM, where("kelompok", "==", fK));

        const mSnap = await getDocs(qM);
        let listJamaah = [];
        mSnap.forEach(doc => {
            const data = doc.data();
            const att = attendanceData[data.nama];
            // Gabungkan data untuk statistik & excel
            listJamaah.push({
                ...data,
                status: att ? att.status : "alfa",
                jam: att ? att.jam : "-"
            });
        });

        // KUNCI: Simpan ke global agar tombol Statistik & Excel bisa baca
        window.currentListData = listJamaah;

        if (listJamaah.length === 0) {
            tableDiv.innerHTML = "Data kosong.";
            return;
        }

        // 3. Render Tabel (Update Header: Tambah Kolom Waktu)
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Nama</th>
                        <th>Waktu</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>`;

        listJamaah.forEach(d => {
            let color = "#ffebee", txt = "❌ ALFA";
            if(d.status === "hadir") { color = "#e8f5e9"; txt = "✅ HADIR"; }
            else if(d.status === "izin") { color = "#fff9c4"; txt = "🙏🏻 IZIN"; }

            html += `
                <tr style="background:${color}">
                    <td><b>${d.nama}</b><br><small>${d.kelompok}</small></td>
                    <td style="text-align:center;">${d.jam}</td>
                    <td style="text-align:center;"><b>${txt}</b></td>
                </tr>`;
        });

        tableDiv.innerHTML = html + `</tbody></table>`;

    } catch (e) {
        tableDiv.innerHTML = "Error: " + e.message;
    }
};
window.downloadLaporan = () => {
    if (!window.currentListData || window.currentListData.length === 0) {
        return alert("Tampilkan data terlebih dahulu!");
    }

    let csv = "Nama,Desa,Kelompok,Waktu,Status\n";
    window.currentListData.forEach(row => {
        csv += `${row.nama},${row.desa},${row.kelompok},${row.jam},${row.status.toUpperCase()}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `Laporan_Absensi_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
};
// --- RESET TERISOLASI ---
window.resetAbsensiGass = async (asal) => {
    const { wilayah } = window.currentAdmin;
    if (confirm(`Hapus permanen riwayat absen wilayah ${wilayah}?`)) {
        try {
            const q = query(collection(db, "attendance"), where("wilayahEvent", "==", wilayah));
            const snap = await getDocs(q);
            await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "attendance", d.id))));
            
            if(asal === 'statistik') document.body.removeChild(document.getElementById('modal-stat'));
            document.getElementById('tabel-container').innerHTML = "";
            alert("Data wilayah Anda telah dibersihkan!");
            if (typeof window.switchAdminTab === 'function') window.switchAdminTab('ev');
        } catch (e) { alert(e.message); }
    }
};
