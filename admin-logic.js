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
    if (!window.currentAdmin) return;
    document.getElementById('pendaftar-section').classList.add('hidden');
    const adminSec = document.getElementById('admin-section');
    adminSec.classList.remove('hidden');

    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = `
       <div style="display:flex; justify-content:space-between; align-items:center; padding-bottom:15px; border-bottom:2px solid #eee; margin-bottom:15px;">
            <div style="text-align:left;">
                <h2 style="margin:0; color:#0056b3; font-size:18px;">Admin ${window.currentAdmin.wilayah}</h2>
                <p style="margin:5px 0 0; font-size:12px; color:#666;">Level: <b>${window.currentAdmin.role}</b></p>
            </div>
            <button onclick="window.logoutAdmin()" style="background:#fff0f0; color:red; border:1px solid red; padding:5px 10px; border-radius:8px; font-size:11px; cursor:pointer; font-weight:bold;">🚪 KELUAR</button>
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
    if (!window.currentAdmin) {
        sub.innerHTML = "<button onclick='window.bukaModalPilihAdmin()' class='primary-btn'>Sesi Habis, Silakan Login Admin Kembali</button>";
        return;
    }
    
    sub.innerHTML = "<p>Memeriksa event aktif...</p>";
    
    const q = query(collection(db, "events"), 
                where("status", "==", "open"), 
                where("wilayah", "==", window.currentAdmin.wilayah));
    
    const snap = await getDocs(q);

    if (!snap.empty) {
        const ev = snap.docs[0].data();
        const evId = snap.docs[0].id;
        
        sub.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; gap:20px; padding:10px;">
                <div style="display:flex; gap:10px; width:100%; max-width:320px;">
                    <button id="btn-pilih-hadir" onclick="window.switchQRIS('hadir', '${evId}', '${ev.namaEvent}')" style="flex:1; padding:10px; border-radius:10px; border:none; background:#0056b3; color:white; font-weight:bold; cursor:pointer;">HADIR</button>
                    <button id="btn-pilih-izin" onclick="window.switchQRIS('izin', '${evId}', '${ev.namaEvent}')" style="flex:1; padding:10px; border-radius:10px; border:none; background:#666; color:white; font-weight:bold; cursor:pointer;">IZIN</button>
                </div>

                <div id="qris-box" style="width: 300px; background: white; padding: 20px; border-radius: 20px; border: 3px solid #0056b3; text-align: center; box-shadow:0 10px 20px rgba(0,0,0,0.1);">
                    <div id="qris-header-bg" style="background: #0056b3; color: white; padding: 12px; border-radius: 12px 12px 0 0; margin: -20px -20px 20px -20px;">
                        <h3 id="qris-title-text" style="margin: 0; letter-spacing: 2px; font-size: 16px;">QR HADIR</h3>
                    </div>
                    
                    <div style="font-weight: 900; color: #333; margin-bottom: 15px; font-size: 18px; text-transform: uppercase;">
                        ${ev.namaEvent}
                    </div>
                    
                    <div id="qrcode-target" style="display:flex; justify-content:center; padding:10px; background:white; border: 1px solid #eee; border-radius: 10px;"></div>
                    
                    <div style="margin-top:15px; border-top: 4px solid #ffc107; padding-top:10px;">
                        <p id="qris-footer-text" style="font-size: 11px; font-weight: bold; color: #555; margin: 0;">SCAN UNTUK KEHADIRAN & SHODAQOH</p>
                        <small id="qris-id-text" style="color: #0056b3; font-weight: bold; font-size: 10px;">ID: ${evId}</small>
                    </div>
                </div>
                
                <div style="width: 100%; max-width: 320px; display: flex; flex-direction: column; gap: 10px;">
                    <button onclick="window.downloadQRIS('${ev.namaEvent}')" class="primary-btn" style="background: #28a745;">📥 SIMPAN KE GALERI</button>
                    <button onclick="window.tutupEvent('${evId}')" class="primary-btn" style="background:#dc3545;">TUTUP EVENT</button>
                </div>
            </div>
        `;
        window.switchQRIS('hadir', evId, ev.namaEvent);

    } else {
        sub.innerHTML = `
            <div style="text-align:left; background:#fdfdfd; padding:15px; border-radius:10px; border:1px solid #eee;">
                <h3 style="margin-top:0; color:#0056b3;">Buka Absensi Baru</h3>
                <label style="font-size:12px; font-weight:bold;">Nama Acara:</label>
                <input type="text" id="ev-nama" placeholder="Misal: Pengajian">
                
                <label style="font-size:12px; font-weight:bold;">Waktu Mulai:</label>
                <input type="datetime-local" id="ev-tgl">
                
                <div style="margin-top:15px; padding:10px; background:#eef6ff; border-radius:8px;">
                    <p style="font-size:12px; font-weight:bold; margin-bottom:10px; color:#0056b3;">Target Peserta (Wajib Pilih):</p>
                    <label style="display:block; margin-bottom:5px;"><input type="checkbox" class="target-kelas" value="PRA-REMAJA"> Pra-Remaja</label>
                    <label style="display:block; margin-bottom:5px;"><input type="checkbox" class="target-kelas" value="REMAJA"> Remaja</label>
                    <label style="display:block; margin-bottom:5px;"><input type="checkbox" class="target-kelas" value="PRA-NIKAH"> Pra-Nikah</label>
                </div>
                
                <button onclick="window.simpanEvent()" class="primary-btn" style="margin-top:15px; width:100%;">BUKA ABSENSI SEKARANG</button>
            </div>
        `;
    }
}

window.switchQRIS = (tipe, id, nama) => {
    const target = document.getElementById("qrcode-target");
    const title = document.getElementById("qris-title-text");
    const footer = document.getElementById("qris-footer-text");
    const idTxt = document.getElementById("qris-id-text");
    const header = document.getElementById("qris-header-bg");
    const btnH = document.getElementById("btn-pilih-hadir");
    const btnI = document.getElementById("btn-pilih-izin");

    if (!target) return;
    target.innerHTML = ""; 
    const finalId = (tipe === 'izin') ? id + "_IZIN" : id;

    if (tipe === 'izin') {
        title.innerText = "QR IZIN";
        footer.innerText = "SCAN UNTUK IZIN (SB LAIN)";
        header.style.background = "#6c757d"; 
        btnI.style.background = "#6c757d";
        btnH.style.background = "#ccc";
    } else {
        title.innerText = "QR HADIR";
        footer.innerText = "SCAN UNTUK KEHADIRAN & SHODAQOH";
        header.style.background = "#0056b3";
        btnH.style.background = "#0056b3";
        btnI.style.background = "#ccc";
    }

    idTxt.innerText = "ID: " + finalId;
    new QRCode(target, { text: finalId, width: 220, height: 220, correctLevel : QRCode.CorrectLevel.H });
};

window.simpanEvent = async () => {
    if (!window.currentAdmin) return;
    const nama = document.getElementById('ev-nama').value;
    const tgl = document.getElementById('ev-tgl').value;
    const target = Array.from(document.querySelectorAll('.target-kelas:checked')).map(c => c.value);

    if (!nama || !tgl || target.length === 0) {
        return alert("Lengkapi Nama, Waktu, dan pilih minimal satu Target Peserta!");
    }

    try {
        await addDoc(collection(db, "events"), {
            namaEvent: nama, 
            waktu: tgl, 
            status: "open", 
            targetKelas: target, // Kelas yang ditunjuk
            wilayah: window.currentAdmin.wilayah, 
            role: window.currentAdmin.role,
            createdAt: serverTimestamp()
        });
        renderTabEvent();
    } catch (e) { alert(e.message); }
};

window.downloadQRIS = (nama) => {
    const frame = document.getElementById('qris-box');
    html2canvas(frame, { scale: 3, backgroundColor: "#ffffff" }).then(canvas => {
        const link = document.createElement('a');
        link.download = `QR_Absen_${nama.replace(/\s+/g, '_')}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    });
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
    if (!window.currentAdmin) return;
    const { wilayah, role } = window.currentAdmin;
    
   // 1. Ambil Event Aktif/Terakhir
    const qEv = query(collection(db, "events"), where("wilayah", "==", wilayah), where("status", "in", ["open", "closed"]));
    const evSnap = await getDocs(qEv);
    const eventAktif = evSnap.docs[0]?.data();
    const eventStatus = eventAktif?.status || "none";
    const targetKelas = eventAktif?.targetKelas || [];

   // 2. Ambil Data Scan Global (untuk SB Lain) & Lokal
    const qAllAtt = query(collection(db, "attendance"));
    const allAttSnap = await getDocs(qAllAtt);
    const globalAttendance = allAttSnap.docs.map(d => d.data());
    const localAttendance = globalAttendance.filter(a => a.kelompok === wilayah);

    // 3. Render Tombol Navigasi Utama (Fitur: Statistik, CSV, Reset)
    sub.innerHTML = `
        <div style="display:flex; gap:8px; margin-bottom:20px; flex-wrap:wrap;">
            <button onclick="window.bukaStatistik()" class="primary-btn" style="background:#17a2b8; font-size:12px; flex:1; min-width:100px; padding:12px 5px;">📊 STATISTIK</button>
            <button onclick="window.downloadCSV()" class="primary-btn" style="background:#28a745; font-size:12px; flex:1; min-width:100px; padding:12px 5px;">📥 CSV</button>
            <button onclick="window.handleResetLaporan()" class="primary-btn" style="background:#dc3545; font-size:12px; flex:1; min-width:100px; padding:12px 5px;">♻️ RESET</button>
        </div>
        <div id="laporan-table" class="table-responsive">Memuat data...</div>
    `;

    let dataFinal = [];

   // 4. Logika Gabungan Status (Hadir/Izin/SB Lain/Alfa)
    if (eventStatus === "closed") {
        let qM = collection(db, "master_jamaah");
        if (role === "KELOMPOK") qM = query(qM, where("kelompok", "==", wilayah));
        else if (role === "DESA") qM = query(qM, where("desa", "==", wilayah));
        
        const mSnap = await getDocs(qM);
        mSnap.forEach(doc => {
            const m = doc.data();
            // Fitur: Hanya tampilkan kelas yang ditunjuk di event ini
            if (targetKelas.includes(m.kelas)) {
                const sdhLokal = localAttendance.find(a => a.nama === m.nama);
                const sdhGlobal = globalAttendance.find(a => a.nama === m.nama && a.kelompok !== wilayah);

                if (sdhLokal) {
                    dataFinal.push(sdhLokal);
                } else if (sdhGlobal) {
                    // Fitur: Logika SB LAIN
                    dataFinal.push({ ...m, status: "SB LAIN", jam: "Lintas", shodaqoh: 0, ket: `Di ${sdhGlobal.kelompok}` });
                } else {
                    // Fitur: Logika ALFA (Default saat closed)
                    dataFinal.push({ ...m, status: "alfa", jam: "-", shodaqoh: 0 });
                }
            }
        });
    } else {
        // Fitur: Event Open -> Sembunyikan Alfa
        dataFinal = localAttendance;
    }
    
    dataFinal.sort((a, b) => a.nama.localeCompare(b.nama));
    window.currentReportData = dataFinal;

    // 5. Tabel Dinamis Sesuai Role (Admin Kelompok/Desa/Daerah)
    let colWilayah = "Kelas";
    if (role === "DAERAH") colWilayah = "Desa-Kel";
    else if (role === "DESA") colWilayah = "Kelompok";

    let html = `<table><thead><tr><th>Nama</th><th>${colWilayah}</th><th>Jam</th><th>Infaq</th><th>Status</th></tr></thead><tbody>`;
    
    dataFinal.forEach(d => {
        const jamStr = d.waktu?.toDate ? d.waktu.toDate().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : (d.jam || "-");
        
        // Fitur: Visualisasi Baris (Warna Merah Muda untuk Alfa, Biru Muda untuk SB Lain)
        const rowStyle = d.status === 'alfa' ? 'style="background:#ffebee;"' : (d.status === 'SB LAIN' ? 'style="background:#e3f2fd;"' : '');
        
        let infoWilayah = d.kelas;
        if (role === "DAERAH") infoWilayah = `${d.desa}-${d.kelompok}`;
        else if (role === "DESA") infoWilayah = d.kelompok;

        html += `
            <tr ${rowStyle}>
                <td><b>${d.nama}</b></td>
                <td><small>${infoWilayah}</small></td>
                <td align="center">${jamStr}</td>
                <td align="right">${(d.shodaqoh || 0).toLocaleString()}</td>
                <td align="center">${d.status === 'hadir' ? '✅' : (d.status === 'izin' ? '🙏🏻' : (d.status === 'SB LAIN' ? '🕌' : '❌'))}</td>
            </tr>`;
    });
    document.getElementById('laporan-table').innerHTML = html + "</tbody></table>";
}
// --- FUNGSI STATISTIK LENGKAP ---
window.bukaStatistik = async () => {
    const data = window.currentReportData;
    if (!window.currentAdmin) return;
    const { wilayah, role } = window.currentAdmin;
    if (!data) return alert("Data belum tersedia!");

    const rekapLalu = await window.getStatistikBulanLalu(wilayah);
    const totalAnggota = await window.getTotalAnggotaPerKelas(wilayah, role);

    // --- REKAYASA FUNGSI HITUNG ---
    const hitung = (list, totalMaster = 0) => {
        // T sekarang mengambil dari Master, bukan list.length
        const T = totalMaster || list.length; 
        const H = list.filter(d => d.status === 'hadir').length;
        // SB LAIN otomatis terhitung karena di laporan statusnya sudah 'izin' atau 'SB LAIN'
        const I = list.filter(d => d.status === 'izin' || d.status === 'SB LAIN').length;
        const A = T - (H + I); // Alfa adalah sisa dari Total Master
        
        const totalUang = list.reduce((acc, curr) => acc + (curr.shodaqoh || 0), 0);
        const isG = (d, g) => d.gender && d.gender.trim().toUpperCase() === g;

        const H_Pa = list.filter(d => d.status === 'hadir' && isG(d, 'PUTRA')).length;
        const I_Pa = list.filter(d => (d.status === 'izin' || d.status === 'SB LAIN') && isG(d, 'PUTRA')).length;
        const A_Pa = list.filter(d => d.status === 'alfa' && isG(d, 'PUTRA')).length;

        const H_Pi = list.filter(d => d.status === 'hadir' && isG(d, 'PUTRI')).length;
        const I_Pi = list.filter(d => (d.status === 'izin' || d.status === 'SB LAIN') && isG(d, 'PUTRI')).length;
        const A_Pi = list.filter(d => d.status === 'alfa' && isG(d, 'PUTRI')).length;

        const P = T > 0 ? Math.round((H / (T - I)) * 100) : 0; // Rumus Persentase Adil
        return { T, H, I, A, P, H_Pa, I_Pa, A_Pa, H_Pi, I_Pi, A_Pi, totalUang };
    };
    // --- REKAYASA TABEL UTAMA (DETAIL PER KELAS UNTUK KELOMPOK) ---
    const sDarah = hitung(data, totalAnggota.totalSemua);
    
    let rowsKelas = "";
    if (role === "KELOMPOK") {
        const kelasList = ["PRA-REMAJA", "REMAJA", "PRA-NIKAH"];
        rowsKelas = kelasList.map(kls => {
            const dataKls = data.filter(d => d.kelas === kls);
            const masterKls = kls === "PRA-REMAJA" ? totalAnggota.totalPR : (kls === "REMAJA" ? totalAnggota.totalR : totalAnggota.totalPN);
            const s = hitung(dataKls, masterKls);
            return `
                <tr style="font-size:12px;">
                    <td align="left" style="padding-left:5px;">${kls}</td><td>${s.P}%</td><td>${s.totalUang.toLocaleString()}</td>
                    <td>${s.T}</td><td>${s.H}</td><td>${s.I}</td><td>${s.A}</td>
                    <td>${s.H_Pa}</td><td>${s.I_Pa}</td><td>${s.A_Pa}</td>
                    <td>${s.H_Pi}</td><td>${s.I_Pi}</td><td>${s.A_Pi}</td>
                </tr>`;
        }).join('');
    }

    let tableUtama = `
        <h3 style="text-align:center; color:#28a745; margin-bottom:10px;">REKAP HARIAN (LIVE)</h3>
        <table class="stat-table" style="width:100%; border-collapse:collapse; margin-bottom:20px; border:2px solid black; text-align:center; font-size:11px;">
            <tr style="background:#f0f0f0;">
                <th rowspan="2">KATEGORI</th><th rowspan="2">%</th><th rowspan="2">INFAQ</th><th colspan="4">TOTAL</th><th colspan="3">PUTRA</th><th colspan="3">PUTRI</th>
            </tr>
            <tr style="background:#f0f0f0;">
                <th>T</th><th>H</th><th>I</th><th>A</th><th>H</th><th>I</th><th>A</th><th>H</th><th>I</th><th>A</th>
            </tr>
            ${rowsKelas}
            <tr style="font-weight:bold; background:#e8f5e9;">
                <td>TOTAL</td><td>${sDarah.P}%</td><td>${sDarah.totalUang.toLocaleString()}</td><td>${sDarah.T}</td>
                <td>${sDarah.H}</td><td>${sDarah.I}</td><td>${sDarah.A}</td>
                <td>${sDarah.H_Pa}</td><td>${sDarah.I_Pa}</td><td>${sDarah.A_Pa}</td>
                <td>${sDarah.H_Pi}</td><td>${sDarah.I_Pi}</td><td>${sDarah.A_Pi}</td>
            </tr>
        </table>
    `;
    let tableBulanan = "";
    if (rekapLalu) {
        const hitungP = (hadir, total) => {
            const target = total * rekapLalu.jumlahPertemuan;
            return target > 0 ? Math.round((hadir / target) * 100) : 0;
        };
        tableBulanan = `
            <div style="margin-top:30px; border:2px solid #0056b3; border-radius:10px; overflow:hidden;">
                <h3 style="text-align:center; background:#0056b3; color:white; margin:0; padding:10px;">REKAP BULAN LALU (${rekapLalu.bulan}/${rekapLalu.tahun})</h3>
                <p style="text-align:center; font-size:12px; margin:5px 0;">Jumlah Pertemuan: ${rekapLalu.jumlahPertemuan}x</p>
                <table class="stat-table" style="width:100%; border-collapse:collapse; text-align:center;">
                    <tr style="background:#eef6ff; font-weight:bold;">
                        <th>KATEGORI KELAS</th><th>SISWA</th><th>KEHADIRAN</th><th>PERSENTASE</th>
                    </tr>
                    <tr><td align="left" style="padding-left:10px;">PRA-REMAJA</td><td>${totalAnggota.totalPR}</td><td>${rekapLalu.hadirPR}</td><td style="font-weight:bold; color:#0056b3;">${hitungP(rekapLalu.hadirPR, totalAnggota.totalPR)}%</td></tr>
                    <tr><td align="left" style="padding-left:10px;">REMAJA</td><td>${totalAnggota.totalR}</td><td>${rekapLalu.hadirR}</td><td style="font-weight:bold; color:#0056b3;">${hitungP(rekapLalu.hadirR, totalAnggota.totalR)}%</td></tr>
                    <tr><td align="left" style="padding-left:10px;">PRA-NIKAH</td><td>${totalAnggota.totalPN}</td><td>${rekapLalu.hadirPN}</td><td style="font-weight:bold; color:#0056b3;">${hitungP(rekapLalu.hadirPN, totalAnggota.totalPN)}%</td></tr>
                </table>
            </div>
        `;
    }

    let tableDesa = "";
    if (role === "DAERAH") {
        tableDesa = `
            <h4 style="margin:20px 0 5px 0; border-bottom:1px solid #ccc;">RINGKASAN PER DESA</h4>
            <table class="stat-table" style="width:100%; border-collapse:collapse; text-align:center; font-size:11px;">
                <tr style="background:#eee;"><th>DESA</th><th>%</th><th>SHODAQOH</th><th>T</th><th>H</th><th>I</th><th>A</th><th>H(Pa)</th><th>I(Pa)</th><th>A(Pa)</th><th>H(Pi)</th><th>I(Pi)</th><th>A(Pi)</th></tr>
                ${Object.keys(rekapDesa).map(namaDesa => {
                    const s = hitung(rekapDesa[namaDesa]);
                    return `<tr><td align="left"><b>${namaDesa}</b></td><td>${s.P}%</td><td style="color:#28a745; font-weight:bold;">${s.totalUang.toLocaleString('id-ID')}</td><td>${s.T}</td><td>${s.H}</td><td>${s.I}</td><td>${s.A}</td><td>${s.H_Pa}</td><td>${s.I_Pa}</td><td>${s.A_Pa}</td><td>${s.H_Pi}</td><td>${s.I_Pi}</td><td>${s.A_Pi}</td></tr>`;
                }).join('')}
            </table>
        `;
    }

    let tableKelompok = "";
    if (role === "DAERAH" || role === "DESA") {
        tableKelompok = `<h4 style="margin:20px 0 5px 0; border-bottom:1px solid #ccc;">DETAIL PER KELOMPOK</h4>`;
        tableKelompok += Object.keys(detailKelompok).map(namaDesa => `
            <div style="margin-bottom:10px; border:1px solid #ddd; border-radius:5px;">
                <div style="background:#28a745; color:white; padding:3px 10px; font-size:11px;">DESA: ${namaDesa}</div>
                <table style="width:100%; border-collapse:collapse; text-align:center; font-size:10px;">
                    <tr style="background:#f9f9f9;">
                        <th style="text-align:left;">KELOMPOK</th><th>%</th><th>Uang</th><th>T</th><th>H</th><th>I</th><th>A</th>
                    </tr>
                    ${Object.keys(detailKelompok[namaDesa]).map(namaKel => {
                        const s = hitung(detailKelompok[namaDesa][namaKel]);
                        return `<tr style="border-bottom:1px solid #eee;"><td align="left" style="padding-left:5px; width:40%;"><b>${namaKel}</b></td><td>${s.P}%</td><td>${s.totalUang.toLocaleString('id-ID')}</td><td>${s.T}</td><td>${s.H}</td><td>${s.I}</td><td>${s.A}</td></tr>`;
                    }).join('')}
                </table>
            </div>
        `).join('');
    }

    const htmlFinal = `
        <div id="capture-area" style="background:white; padding:20px; color:black; width:800px; font-family:Arial;">
            <div style="text-align:center; margin-bottom:20px;">
                <h2 style="margin:0;">LAPORAN STATISTIK KEHADIRAN</h2>
                <p style="margin:5px 0; color:#666;">Wilayah: ${wilayah} | Dicetak: ${new Date().toLocaleDateString('id-ID')}</p>
            </div>
            ${tableUtama}
            ${tableBulanan}
            ${tableDesa}
            ${tableKelompok}
        </div>
    `;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-stat';
    modal.style.zIndex = "11000";
    modal.innerHTML = `
        <div class="card" style="max-width:850px; width:95%; max-height:90vh; overflow-y:auto; padding:15px; border-radius:15px;">
            <div style="overflow-x:auto; background:#eee; padding:10px; border-radius:10px;">
                ${htmlFinal}
            </div>
            <div style="padding:15px; display:flex; flex-direction:column; gap:10px; margin-top:10px;">
                <button onclick="window.downloadStatistikGambar()" class="primary-btn" style="background:#17a2b8; padding:15px;">📸 SIMPAN SEBAGAI GAMBAR (PNG)</button>
                <button onclick="document.body.removeChild(document.getElementById('modal-stat'))" class="secondary-btn" style="padding:12px;">TUTUP</button>
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

window.handleResetLaporan = async () => {
    if (!window.currentAdmin) return alert("Sesi Admin habis.");
    
    // Cari event yang sedang tampil di laporan (status open/closed)
    const qEv = query(collection(db, "events"), 
        where("wilayah", "==", window.currentAdmin.wilayah), 
        where("status", "in", ["open", "closed"])
    );
    const evSnap = await getDocs(qEv);
    
    if (evSnap.empty) return alert("Tidak ada event aktif yang bisa di-reset.");
    
    const eventDoc = evSnap.docs[0];
    const eventId = eventDoc.id;
    const eventData = eventDoc.data();

    const konfirmasi = confirm(`RESET EVENT: "${eventData.namaEvent}"?\n\nData scan event ini akan dipindahkan ke Rekap Bulanan dan dihapus dari daftar hadir.`);
    if (!konfirmasi) return;

    try { 
        // Panggil proses rekap dengan menyertakan ID Event spesifik
        const sukses = await window.prosesRekapDanReset(eventId, window.currentAdmin);
        
        if (sukses) {
            alert(`Event "${eventData.namaEvent}" berhasil di-reset.`);
            renderTabLaporan();
        } else {
            alert("Gagal melakukan reset.");
        }
    } catch (e) {
        console.error("Error saat reset:", e);
        alert("Terjadi kesalahan: " + e.message);
    }
};

// --- TAB DATABASE JAMAAH ---
async function renderTabDatabase() {
    const sub = document.getElementById('admin-sub-content');
    sub.innerHTML = `<input type="text" id="db-search" placeholder="Cari Nama..." oninput="filterDB()"><div id="db-list"></div>`;
    window.filterDB();
}

window.filterDB = async () => {
    if (!window.currentAdmin) return;
    const key = document.getElementById('db-search').value.toUpperCase();
    const { wilayah, role } = window.currentAdmin;
    
    let q = collection(db, "master_jamaah");
    if (role === "KELOMPOK") q = query(q, where("kelompok", "==", wilayah));
    else if (role === "DESA") q = query(q, where("desa", "==", wilayah));
    
    const snap = await getDocs(q);
    let listJamaah = [];
    snap.forEach(ds => listJamaah.push({id: ds.id, ...ds.data()}));

    listJamaah.sort((a, b) => a.nama.localeCompare(b.nama));

    let html = `<table><thead><tr><th>Nama</th><th>Kelompok</th><th>Aksi</th></tr></thead><tbody>`;
    listJamaah.forEach(d => {
        if (d.nama.includes(key) || !key) {
            html += `<tr>
                <td><b>${d.nama}</b></td>
                <td><small>${d.kelompok}</small></td>
                <td><button onclick="hapusJamaah('${d.id}')" style="background:#dc3545; color:white; border:none; padding:5px 10px; border-radius:5px;">✕</button></td>
            </tr>`;
        }
    });
    document.getElementById('db-list').innerHTML = html + "</tbody></table>";
};

window.hapusJamaah = async (id) => {
    if (confirm("Hapus jamaah dari database?")) {
        await deleteDoc(doc(db, "master_jamaah", id));
        renderTabDatabase(); }
};

window.downloadCSV = () => {
    const data = window.currentReportData;
    if (!data || data.length === 0) return alert("Tidak ada data untuk didownload");

    let csvContent = "data:text/csv;charset=utf-8,Nama,Kelompok,Jam,Status\n";
    data.forEach(row => {
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

window.logoutAdmin = () => {
    window.currentAdmin = null;
    const adminSec = document.getElementById('admin-section');
    if (adminSec) adminSec.classList.add('hidden');
    const pendaftarSec = document.getElementById('pendaftar-section');
    if (pendaftarSec) pendaftarSec.classList.remove('hidden');
    if (typeof window.cekUserLogin === 'function') {
        window.cekUserLogin(); 
    }
    alert("Anda telah keluar dari Mode Admin.");
};
