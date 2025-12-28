import { db } from './firebase-config.js';
import { collection, getDocs, query, where, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const dataWilayah = {
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"]
};

window.updateTeksTombolAdmin = () => {
    const selDesa = document.getElementById('sel-desa');
    const selKelompok = document.getElementById('sel-kelompok');
    const btn = document.getElementById('btn-konfirmasi-admin');
    
    const desaTerpilih = selDesa.value;
    const kelompokTerpilih = selKelompok.value;

    // Jika desa baru saja diganti (belum ada kelompok yang dipilih sebelumnya dari list baru)
    if (desaTerpilih === "") {
        selKelompok.innerHTML = '<option value="">-- Pilih Kelompok --</option>';
        selKelompok.disabled = true;
        btn.innerText = "MASUK SEBAGAI ADMIN DAERAH";
        btn.style.background = "#2196F3"; 
    } else {
        selKelompok.disabled = false;
        
        // Hanya isi ulang list kelompok jika listnya masih kosong (mencegah loop saat pilih kelompok)
        if (selKelompok.options.length <= 1) {
            selKelompok.innerHTML = '<option value="">-- Pilih Kelompok --</option>';
            const daftarKelompok = dataWilayah[desaTerpilih] || [];
            daftarKelompok.forEach(klp => {
                const opt = document.createElement('option');
                opt.value = klp;
                opt.innerText = klp;
                selKelompok.appendChild(opt);
            });
        }

        // UPDATE TEKS TOMBOL SECARA DINAMIS
        if (selKelompok.value === "") {
            btn.innerText = `MASUK SEBAGAI ADMIN DESA ${desaTerpilih}`;
            btn.style.background = "#2196F3"; 
        } else {
            btn.innerText = `MASUK SEBAGAI ADMIN KELOMPOK ${selKelompok.value}`;
            btn.style.background = "#2196F3"; 
        }
    }
};

window.konfirmasiMasukAdmin = () => {
    const selDesa = document.getElementById('sel-desa');
    const selKelompok = document.getElementById('sel-kelompok');
    
    const desa = selDesa.value;
    const kelompok = selKelompok.value;
    
    let role = "DAERAH";
    let wilayah = "SEMUA";

    if (desa !== "") {
        role = "DESA";
        wilayah = desa;
    }
    if (kelompok !== "") {
        role = "KELOMPOK";
        wilayah = kelompok;
    }

    // Simpan identitas admin ke memori
    window.currentAdmin = { role, wilayah };
    
    // --- AUTO BERSIHKAN FORM ---
    selDesa.value = ""; 
    selKelompok.innerHTML = '<option value="">-- Pilih Kelompok --</option>'; 
    selKelompok.disabled = true; 
    
    const btn = document.getElementById('btn-konfirmasi-admin');
    btn.innerText = "MASUK SEBAGAI ADMIN DAERAH";
    btn.style.background = "#2196F3";
    // ----------------------------

    // Tutup modal
    document.getElementById('modal-pilih-admin').style.display = 'none';
    
    // PANGGIL PANEL ADMIN (Cara Paling Aman)
    if (typeof window.bukaPanelAdmin === 'function') {
        window.bukaPanelAdmin();
    } else {
        // Jika tidak ada di window, kita coba cari langsung fungsinya
        try {
            bukaPanelAdmin(); 
        } catch (e) {
            console.error("Fungsi bukaPanelAdmin tidak ditemukan!", e);
            alert("Terjadi kesalahan teknis, silakan refresh halaman.");
        }
    }
};

window.lihatLaporan = async () => {
    const container = document.getElementById('admin-dynamic-content');
    const role = window.currentAdmin?.role || "DAERAH";
    const wilayah = window.currentAdmin?.wilayah || "SEMUA";
    // CARI DESA INDUK (Khusus jika admin yang masuk levelnya Kelompok)
    let desaInduk = "";
    if (role === "DESA") {
        desaInduk = wilayah;
    } else if (role === "KELOMPOK") {
        // Cari wilayah ini ada di Desa mana dalam dataWilayah
        for (let d in dataWilayah) {
            if (dataWilayah[d].includes(wilayah)) {
                desaInduk = d;
                break;
            }
        }
    }

    let judul = "Laporan Seluruh Wilayah";
    if (role === "DESA") judul = `Laporan Desa ${wilayah}`;
    if (role === "KELOMPOK") judul = `Laporan Kelompok ${wilayah}`;

    container.innerHTML = `
        <h3>${judul}</h3>
        <div class="filter-box">
            <select id="f-desa" ${role !== 'DAERAH' ? 'disabled' : ''} style="background:#f0f0f0; font-weight:bold;">
                <option value="${role !== 'DAERAH' ? desaInduk : ''}">${role !== 'DAERAH' ? desaInduk : '-- Semua Desa --'}</option>
                ${role === 'DAERAH' ? Object.keys(dataWilayah).map(d => `<option value="${d}">${d}</option>`).join('') : ''}
            </select>

            <select id="f-kelompok" ${role === 'KELOMPOK' ? 'disabled' : ''} style="margin-top:10px;">
                <option value="${role === 'KELOMPOK' ? wilayah : ''}">${role === 'KELOMPOK' ? wilayah : '-- Semua Kelompok --'}</option>
            </select>
            <button onclick="renderTabelLaporan()" class="primary-btn" style="margin-top:10px; width:100%;">Tampilkan Detail</button>
            <div style="display:flex; gap:10px; margin-top:10px;">
                <button onclick="downloadLaporan()" class="secondary-btn" style="flex:1;">📥 Excel</button>
                <button onclick="bukaModalStatistik()" class="primary-btn" style="flex:1; background:#28a745;">📊 Statistik</button>
            </div>
        </div>
        <div id="tabel-container"></div>`;
    // 3. Ambil elemen dropdown
    const fDesa = document.getElementById('f-desa');
    const fKel = document.getElementById('f-kelompok');
    // 4. Logika ganti kelompok saat Desa dipilih (Penting untuk Admin Daerah)
    fDesa.onchange = () => {
        const desaTerpilih = fDesa.value;
        // Bersihkan isi kelompok
        fKel.innerHTML = '<option value="">-- Semua Kelompok --</option>';
        if (desaTerpilih !== "") {
            // Ambil daftar kelompok dari dataWilayah yang sudah ada di file ini
            const daftar = dataWilayah[desaTerpilih] || [];
            daftar.forEach(klp => {
                const opt = document.createElement('option');
                opt.value = klp;
                opt.innerText = klp;
                fKel.appendChild(opt);
            });
        }
    };
    // 5. Jika Admin Desa, langsung tampilkan list kelompoknya
    if (role === "DESA") {
        const daftar = dataWilayah[wilayah] || [];
        fKel.innerHTML = '<option value="">-- Semua Kelompok --</option>' + 
                         daftar.map(k => `<option value="${k}">${k}</option>`).join('');
    }
    // Jalankan tabel pertama kali
    renderTabelLaporan();
};

window.renderTabelLaporan = async () => {
    const fD = document.getElementById('f-desa').value;
    const fK = document.getElementById('f-kelompok').value;
    const tableDiv = document.getElementById('tabel-container');
    tableDiv.innerHTML = "Memuat data...";
    try {
        // 1. Cek status event
        const qEvent = query(
            collection(db, "events"), 
            where("status", "==", "open"),
            where("wilayah", "==", fK || fD || "SEMUA")
        );
        const evSnap = await getDocs(qEvent);
        const isEventRunning = !evSnap.empty;
        // 2. Ambil riwayat absen
        const hSnap = await getDocs(collection(db, "attendance"));
        const statusMap = {};
        hSnap.forEach(doc => { 
            const d = doc.data();
            statusMap[d.nama] = d.status; 
        });
        // 3. Ambil Master Jamaah (PENTING: Ini sumber data statistik)
        let qM = collection(db, "master_jamaah");
        if(fD) qM = query(qM, where("desa", "==", fD));
        if(fK) qM = query(qM, where("kelompok", "==", fK));
        const mSnap = await getDocs(qM);
        let listJamaah = [];
        mSnap.forEach(doc => { 
            const data = doc.data();
            listJamaah.push(data); 
        });
        // KUNCI UTAMA: Simpan ke variabel global agar tombol Statistik bisa baca
        window.currentListData = listJamaah;
        if (listJamaah.length === 0) {
            tableDiv.innerHTML = "<p style='text-align:center; padding:20px;'>Data jamaah tidak ditemukan untuk wilayah ini.</p>";
            return;
        }
        // 4. Render Tabel
        let html = `<table><thead><tr><th>Nama</th><th>Status</th></tr></thead><tbody>`;
        let adaTampilan = false;
        listJamaah.forEach(d => {
            const s = statusMap[d.nama];
            // Logika filter tampilan sesuai diskusi sebelumnya
            if (isEventRunning && !s) return;

            adaTampilan = true;
            let color = "#ffebee", txt = "❌ ALFA";
            if(s === "hadir") { color = "#e8f5e9"; txt = "✅ HADIR"; }
            else if(s === "izin") { color = "#fff9c4"; txt = "🙏🏻 IZIN"; }

            html += `<tr style="background:${color}">
                        <td><b>${d.nama}</b><br><small>${d.kelompok}</small></td>
                        <td style="text-align:center;"><b>${txt}</b></td>
                     </tr>`;
        });
        tableDiv.innerHTML = adaTampilan ? html + `</tbody></table>` : "<p style='text-align:center; padding:20px;'>Belum ada yang melakukan scan.</p>";
    } catch (e) {
        console.error(e);
        tableDiv.innerHTML = "Error: " + e.message;
    }
};
window.downloadLaporan = () => {
    const table = document.querySelector("#tabel-container table");
    if(!table) return alert("Data kosong");
    const wb = XLSX.utils.table_to_book(table);
    XLSX.writeFile(wb, "Laporan_Absensi.xlsx");
};

window.bukaModalStatistik = async () => {
    if (!window.currentListData || window.currentListData.length === 0) return alert("Tampilkan laporan dulu.");
    const hSnap = await getDocs(collection(db, "attendance"));
    const statusMap = {};
    hSnap.forEach(doc => { statusMap[doc.data().nama] = doc.data().status; });
    let rekap = {};
    let grandTotal = { tl:0, tp:0, hl:0, hp:0, il:0, ip:0, al:0, ap:0 };
    window.currentListData.forEach(d => {
        const s = statusMap[d.nama];
        const g = (d.gender || "PUTRA").toUpperCase(); 
        if (!rekap[d.desa]) rekap[d.desa] = {};
        if (!rekap[d.desa][d.kelompok]) rekap[d.desa][d.kelompok] = { tl:0, tp:0, hl:0, hp:0, il:0, ip:0, al:0, ap:0 };
        let target = rekap[d.desa][d.kelompok];
        if (g.includes("PUTRA") || g === "L") {
            target.tl++; grandTotal.tl++;
            if (s === 'hadir') { target.hl++; grandTotal.hl++; }
            else if (s === 'izin') { target.il++; grandTotal.il++; }
            else { target.al++; grandTotal.al++; }
        } else {
            target.tp++; grandTotal.tp++;
            if (s === 'hadir') { target.hp++; grandTotal.hp++; }
            else if (s === 'izin') { target.ip++; grandTotal.ip++; }
            else { target.ap++; grandTotal.ap++; }
        }
    });
    const filterDesa = document.getElementById('f-desa').value || "SEMUA DESA";
    let barisHtml = "";
    for (let desa in rekap) {
        const kelompokDiDesa = rekap[desa];
        const daftarKelompok = Object.keys(kelompokDiDesa);
        const jmlKelompok = daftarKelompok.length;
        let subDesa = { tl:0, tp:0, hl:0, hp:0, il:0, ip:0, al:0, ap:0 };
        daftarKelompok.forEach(k => {
            const r = kelompokDiDesa[k];
            subDesa.tl += r.tl; subDesa.tp += r.tp;
            subDesa.hl += r.hl; subDesa.hp += r.hp;
            subDesa.il += r.il; subDesa.ip += r.ip;
            subDesa.al += r.al; subDesa.ap += r.ap;
        });
        const dTotalT = subDesa.tl + subDesa.tp;
        const dTotalH = subDesa.hl + subDesa.hp;
        const dPersen = dTotalT > 0 ? Math.round((dTotalH / dTotalT) * 100) : 0;
        barisHtml += `<tr style="background:#f9f9f9; font-weight:bold;">
            <td style="border: 1px solid #000; text-align:left; padding:5px;">${desa}</td>
            <td style="border: 1px solid #000;">${desa}</td>
            <td style="border: 1px solid #000;">${dPersen}%</td>
            <td style="border: 1px solid #000;">${dTotalT}</td>
            <td style="border: 1px solid #000;">${dTotalH}</td>
            <td style="border: 1px solid #000;">${subDesa.il + subDesa.ip}</td>
            <td style="border: 1px solid #000;">${subDesa.al + subDesa.ap}</td>
            <td style="border: 1px solid #000;">${subDesa.hl}</td><td style="border: 1px solid #000;">${subDesa.il}</td><td style="border: 1px solid #000;">${subDesa.al}</td>
            <td style="border: 1px solid #000;">${subDesa.hp}</td><td style="border: 1px solid #000;">${subDesa.ip}</td><td style="border: 1px solid #000;">${subDesa.ap}</td>
        </tr>`;
        daftarKelompok.forEach((kel, index) => {
            const r = kelompokDiDesa[kel];
            const kTotalT = r.tl + r.tp;
            const kTotalH = r.hl + r.hp;
            const kPersen = kTotalT > 0 ? Math.round((kTotalH / kTotalT) * 100) : 0;
            barisHtml += `<tr>
                ${index === 0 ? `<td rowspan="${jmlKelompok}" style="border: 1px solid #000; font-weight:bold; vertical-align:middle; background:#fff;">${desa}</td>` : ''}
                <td style="border: 1px solid #000; text-align:left; padding-left:5px;">${kel}</td>
                <td style="border: 1px solid #000;">${kPersen}%</td>
                <td style="border: 1px solid #000;">${kTotalT}</td>
                <td style="border: 1px solid #000;">${kTotalH}</td>
                <td style="border: 1px solid #000;">${r.il + r.ip}</td>
                <td style="border: 1px solid #000;">${r.al + r.ap}</td>
                <td style="border: 1px solid #000;">${r.hl}</td><td style="border: 1px solid #000;">${r.il}</td><td style="border: 1px solid #000;">${r.al}</td>
                <td style="border: 1px solid #000;">${r.hp}</td><td style="border: 1px solid #000;">${r.ip}</td><td style="border: 1px solid #000;">${r.ap}</td>
            </tr>`;
        });
    }
    const gT = grandTotal.tl + grandTotal.tp;
    const gH = grandTotal.hl + grandTotal.hp;
    const gPersen = gT > 0 ? Math.round((gH / gT) * 100) : 0;
    const modal = document.createElement('div');
    modal.id = "modal-stat";
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:99999; display:flex; flex-direction:column; align-items:center; justify-content:flex-start; padding:20px 10px; overflow-y:auto;";
    modal.innerHTML = `
    <div style="background:white; color:black; padding:15px; border-radius:10px; width:95%; max-width:850px; box-sizing:border-box; display:flex; flex-direction:column; max-height:90vh;">
        <h3 style="text-align:center; margin:0; font-size:14px;">HASIL REKAP KEHADIRAN</h3>
        <h4 style="text-align:center; margin:5px 0 15px 0; font-size:12px;">${filterDesa} - ${new Date().toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'})}</h4>
        <div id="capture-area" style="background:white; overflow-x:auto; width:100%; border: 1px solid #ccc; -webkit-overflow-scrolling: touch;">
            <table style="min-width:700px; width:100%; border-collapse:collapse; font-size:11px; text-align:center; border: 1.5px solid #000; table-layout: fixed;">
                <thead>
                    <tr style="background:#fff;">
                        <th style="border: 1px solid #000; padding:5px; width:80px;">DESA</th>
                        <th style="border: 1px solid #000; padding:5px; width:100px;">KELOMPOK</th>
                        <th style="border: 1px solid #000; width:40px;">%</th>
                        <th colspan="4" style="border: 1px solid #000;">TOTAL</th>
                        <th colspan="3" style="border: 1px solid #000;">PUTRA</th>
                        <th colspan="3" style="border: 1px solid #000;">PUTRI</th>
                    </tr>
                    <tr style="background:#fff;">
                        <th colspan="2" style="border: 1px solid #000;"></th>
                        <th style="border: 1px solid #000;"></th>
                        <th style="border: 1px solid #000;">T</th><th style="border: 1px solid #000;">H</th><th style="border: 1px solid #000;">I</th><th style="border: 1px solid #000;">A</th>
                        <th style="border: 1px solid #000;">H</th><th style="border: 1px solid #000;">I</th><th style="border: 1px solid #000;">A</th>
                        <th style="border: 1px solid #000;">H</th><th style="border: 1px solid #000;">I</th><th style="border: 1px solid #000;">A</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="background:#f2f2f2; font-weight:bold;">
                        <td colspan="2" style="border: 1px solid #000; padding:8px; text-align:left;">TOTAL DAERAH</td>
                        <td style="border: 1px solid #000;">${gPersen}%</td>
                        <td style="border: 1px solid #000;">${gT}</td>
                        <td style="border: 1px solid #000;">${gH}</td>
                        <td style="border: 1px solid #000;">${grandTotal.il + grandTotal.ip}</td>
                        <td style="border: 1px solid #000;">${grandTotal.al + grandTotal.ap}</td>
                        <td style="border: 1px solid #000;">${grandTotal.hl}</td><td style="border: 1px solid #000;">${grandTotal.il}</td><td style="border: 1px solid #000;">${grandTotal.al}</td>
                        <td style="border: 1px solid #000;">${grandTotal.hp}</td><td style="border: 1px solid #000;">${grandTotal.ip}</td><td style="border: 1px solid #000;">${grandTotal.ap}</td>
                    </tr>
                    ${barisHtml}
                </tbody>
            </table>
        </div>
        <div style="margin-top: 15px; display:flex; gap:10px; width:100%;">
            <button onclick="downloadStatistikGambar(event)" style="flex:1; background:#28a745; color:white; padding:12px; border:none; border-radius:8px; font-weight:bold;">📸 DOWNLOAD</button>
            <button onclick="document.body.removeChild(document.getElementById('modal-stat'))" style="flex:1; background:#666; color:white; border:none; padding:10px; border-radius:8px;">TUTUP</button>
            <button onclick="resetAbsensiGass('statistik')" style="flex:1; background:#d32f2f; color:white; padding:12px; border:none; border-radius:8px; font-weight:bold;">🗑️ RESET </button>
        </div>
    </div>`;
    document.body.appendChild(modal);
};

window.downloadStatistikGambar = (e) => {
    const area = document.getElementById('capture-area');
    const table = area.querySelector('table');
    const btnDownload = e.target;
    btnDownload.innerText = "⏳ Memproses...";
    btnDownload.disabled = true;
    html2canvas(table, {
        scale: 2, useCORS: true, backgroundColor: "#ffffff",
        width: table.scrollWidth, height: table.scrollHeight, windowWidth: table.scrollWidth
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `Rekap_Kehadiran_Lengkap.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        btnDownload.innerText = "📸 DOWNLOAD GAMBAR";
        btnDownload.disabled = false;
    }).catch(err => {
        alert("Gagal: " + err);
        btnDownload.disabled = false;
    });
};

window.resetAbsensiGass = async (asal) => {
    if (confirm("Hapus semua riwayat absen sekarang?")) {
        try {
            const snap = await getDocs(collection(db, "attendance"));
            await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "attendance", d.id))));
            const modal = document.getElementById('modal-stat');
            if(modal) document.body.removeChild(modal);
            alert("Data Berhasil Dibersihkan!");
            if(asal === 'statistik') bukaPanelAdmin();
            else renderTabelLaporan();
        } catch (e) { alert("Gagal: " + e.message); }
    }
};
