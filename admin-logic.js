import { db } from './firebase-config.js';
import { 
    collection, getDocs, query, where, addDoc, 
    doc, deleteDoc, serverTimestamp, getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const dataWilayah = {
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"]
};

// --- 1. MODAL LOGIN (SISTEM ANTI-MACET) ---
window.updateTeksTombolAdmin = () => {
    const selDesa = document.getElementById('sel-desa');
    const selKelompok = document.getElementById('sel-kelompok');
    const btn = document.getElementById('btn-konfirmasi-admin');
    
    if (!selDesa || !selKelompok || !btn) return;
    const desa = selDesa.value;

    if (desa === "") {
        selKelompok.innerHTML = '<option value="">-- Pilih Kelompok --</option>';
        selKelompok.disabled = true;
        btn.innerText = "MASUK SEBAGAI ADMIN DAERAH";
        btn.style.background = "#2196F3"; 
    } else {
        selKelompok.disabled = false;
        // Hanya update jika desa berbeda dari pilihan sebelumnya
        if (selKelompok.getAttribute('data-last') !== desa) {
            const daftar = dataWilayah[desa] || [];
            selKelompok.innerHTML = '<option value="">-- Pilih Kelompok (Opsional) --</option>' + 
                                     daftar.map(k => `<option value="${k}">${k}</option>`).join('');
            selKelompok.setAttribute('data-last', desa);
        }
        // Update teks tombol
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
    document.getElementById('sel-kelompok').innerHTML = '<option value="">-- Pilih Kelompok --</option>';
    document.getElementById('sel-kelompok').disabled = true;
    document.getElementById('sel-kelompok').removeAttribute('data-last');
    document.getElementById('modal-pilih-admin').style.display = 'none';
    if (typeof window.bukaPanelAdmin === 'function') window.bukaPanelAdmin();
};

// --- 2. MANAJEMEN EVENT ---
window.simpanEvent = async () => {
    const nama = document.getElementById('ev-nama').value;
    const waktu = document.getElementById('ev-waktu').value;
    const { role, wilayah } = window.currentAdmin;
    if (!nama || !waktu) return alert("Isi data dulu!");
    try {
        await addDoc(collection(db, "events"), {
            namaEvent: nama, waktu, status: "open",
            level: role, wilayah, createdAt: serverTimestamp()
        });
        alert("Event Berhasil Dibuka!");
        window.switchAdminTab('ev'); 
    } catch (e) { alert(e.message); }
};

// --- 3. LAPORAN SMART (HIRARKI & IZIN OTOMATIS) ---
window.renderTabelLaporan = async () => {
    const tableDiv = document.getElementById('tabel-container');
    const { role, wilayah } = window.currentAdmin;
    tableDiv.innerHTML = "Menyinkronkan data...";
    try {
        const qEv = query(collection(db, "events"), where("status", "==", "open"), where("wilayah", "==", wilayah));
        const evSnap = await getDocs(qEv);
        const hSnap = await getDocs(collection(db, "attendance"));
        const allAtt = hSnap.docs.map(doc => doc.data());

        let qM = collection(db, "master_jamaah");
        if (role === "KELOMPOK") qM = query(qM, where("kelompok", "==", wilayah));
        else if (role === "DESA") qM = query(qM, where("desa", "==", wilayah));
        const mSnap = await getDocs(qM);

        let listJamaah = [];
        mSnap.forEach(doc => {
            const j = doc.data();
            const sini = allAtt.find(a => a.nama === j.nama && a.wilayahEvent === wilayah);
            const luar = allAtt.find(a => a.nama === j.nama && a.wilayahEvent !== wilayah);
            
            let status = "alfa", jam = "-", color = "#ffebee", txt = "❌ ALFA";
            if (sini) {
                status = sini.status;
                jam = sini.waktu ? sini.waktu.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "-";
            } else if (luar) {
                status = "tugas_luar"; txt = "🚀 TUGAS LUAR"; color = "#e3f2fd";
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
        tableDiv.innerHTML = adaData ? html + `</tbody></table>` : "<p align='center'>Data Kosong.</p>";
    } catch (e) { tableDiv.innerHTML = e.message; }
};

// --- 4. STATISTIK & RESET ---
window.bukaModalStatistik = () => {
    if (!window.currentListData || window.currentListData.length === 0) return alert("Tampilkan laporan dulu!");
    const { role } = window.currentAdmin;
    let rekap = {};
    window.currentListData.forEach(d => {
        let key = (role === "DAERAH") ? d.desa : d.kelompok;
        if (!rekap[key]) rekap[key] = { t: 0, h: 0, i: 0, a: 0 };
        rekap[key].t++;
        if (d.status === 'hadir' || d.status === 'tugas_luar') rekap[key].h++;
        else if (d.status === 'izin') rekap[key].i++;
        else rekap[key].a++;
    });
    let tabelHTML = `<table style="width:100%; border-collapse: collapse; font-size: 11px;">
        <tr style="background:#eee;"><th>${role === "DAERAH" ? 'DESA' : 'KELOMPOK'}</th><th>%</th><th>T</th><th>H</th><th>I</th><th>A</th></tr>
        ${Object.keys(rekap).map(key => {
            const r = rekap[key]; const p = Math.round((r.h / r.t) * 100) || 0;
            return `<tr><td>${key}</td><td>${p}%</td><td>${r.t}</td><td>${r.h}</td><td>${r.i}</td><td>${r.a}</td></tr>`;
        }).join('')}</table>`;

    const modal = document.createElement('div');
    modal.id = 'modal-stat';
    modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; justify-content:center; align-items:center; z-index:9999;";
    modal.innerHTML = `<div style="background:white; padding:20px; border-radius:10px; width:90%; max-width:400px;">
        <div id="capture-area"><h4 align="center">REKAP STATISTIK</h4>${tabelHTML}</div>
        <button onclick="downloadStatistikGambar()" style="width:100%; margin-top:15px; background:#17a2b8; color:white;">📸 Download Gambar</button>
        <button onclick="resetAbsensiGass('statistik')" style="width:100%; margin-top:5px; background:red; color:white;">🗑️ Reset Data</button>
        <button onclick="document.body.removeChild(document.getElementById('modal-stat'))" style="width:100%; margin-top:5px;">Tutup</button>
    </div>`;
    document.body.appendChild(modal);
};

window.downloadStatistikGambar = () => {
    const content = document.getElementById('capture-area').innerHTML;
    const pW = window.open('', '', 'height=600,width=800');
    pW.document.write(`<html><head><style>table{width:100%;border-collapse:collapse;} th,td{border:1px solid black;padding:5px;text-align:center;}</style></head><body>${content}</body></html>`);
    pW.document.close(); pW.print();
};

window.resetAbsensiGass = async (asal) => {
    const { wilayah, role } = window.currentAdmin;
    if (confirm("Reset data wilayah ini?")) {
        try {
            let q = query(collection(db, "attendance"), where("wilayahEvent", "==", wilayah));
            if (role === "DAERAH") q = collection(db, "attendance");
            const snap = await getDocs(q);
            await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "attendance", d.id))));
            if (document.getElementById('tabel-container')) document.getElementById('tabel-container').innerHTML = ""; 
            if (asal === 'statistik' && document.getElementById('modal-stat')) document.body.removeChild(document.getElementById('modal-stat'));
            alert("Reset Berhasil!");
            window.switchAdminTab('ev');
        } catch (e) { alert(e.message); }
    }
};

window.downloadLaporan = () => {
    if (!window.currentListData || window.currentListData.length === 0) return alert("Data kosong!");
    let csv = "Nama,Kelompok,Waktu,Status\n" + window.currentListData.map(r => `${r.nama},${r.kelompok},${r.jam},${r.status}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = "Laporan.csv"; a.click();
};
