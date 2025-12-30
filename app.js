import { db } from './firebase-config.js';
import { 
    collection, getDocs, query, where, addDoc, 
    doc, setDoc, getDoc, deleteDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const dataWilayah = {
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"]
};
let html5QrCode;

// --- 1. LOGIKA MULTI-AKUN ---
function getSavedAccounts() {
    return JSON.parse(localStorage.getItem('saved_accounts')) || [];
}
function saveAccount(userData) {
    let accounts = getSavedAccounts();
    const exists = accounts.find(a => a.nama === userData.nama && a.desa === userData.desa);
    if (!exists) {
        accounts.push(userData);
        localStorage.setItem('saved_accounts', JSON.stringify(accounts));
    }
}
window.hapusAkunDariList = (nama) => {
    let accounts = getSavedAccounts().filter(a => a.nama !== nama);
    localStorage.setItem('saved_accounts', JSON.stringify(accounts));
    showPageRegistrasi();
};

// --- 2. HALAMAN LOGIN ---
window.showPageRegistrasi = () => {
    localStorage.removeItem('currentUser');
    const accounts = getSavedAccounts();
    const content = document.getElementById('app-content');
    let htmlList = "";
    if (accounts.length > 0) {
        htmlList = `
        <div class="account-list" style="margin-bottom:20px;">
            <p style="font-size: 13px; color: #666; margin-bottom:12px; font-weight: bold;">Masuk dengan akun yang sudah ada:</p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
            ${accounts.map(acc => `
                <div class="account-card" style="display:flex; justify-content:space-between; align-items:center; background: #ffffff; border: 1px solid #e0e0e0; padding: 12px 15px; border-radius: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); transition: 0.3s;">
                    <div onclick='pilihAkun(${JSON.stringify(acc)})' style="flex-grow:1; cursor:pointer;">
                        <div style="font-size: 15px; font-weight: bold; color: #010530; margin-bottom: 2px;">${acc.nama}</div>
                        <div style="font-size: 11px; color: #007bff; text-transform: uppercase; letter-spacing: 0.5px;">${acc.desa} • ${acc.kelompok}</div>
                    </div>
                    <button onclick="hapusAkunDariList('${acc.nama}')" 
                        style="background: #fff5f5; border: none; color: #ff4d4d; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 16px; margin-left: 10px;">
                        ✕
                    </button>
                </div>
            `).join('')}
            </div>
            <div style="display: flex; align-items: center; margin: 20px 0;">
                <div style="flex: 1; height: 1px; background: #eee;"></div>
                <span style="padding: 0 10px; font-size: 11px; color: #bbb; text-transform: uppercase;">atau daftar baru</span>
                <div style="flex: 1; height: 1px; background: #eee;"></div>
            </div>
        </div>`;
    }

    content.innerHTML = `
        <div class="card">
            <h2>LogIn</h2>
            ${htmlList}
            <p style="font-size: 12px; color: #010530;">Masukan data:</p>
            <select id="reg-desa">
                <option value="">Pilih Desa</option>
                ${Object.keys(dataWilayah).map(desa => `<option value="${desa}">${desa}</option>`).join('')}
            </select>
            <select id="reg-kelompok" disabled><option value="">Pilih Kelompok</option></select>
            <div style="position: relative; width: 100%;">
                <input type="text" id="reg-nama" placeholder="Ketik Nama Anda..." autocomplete="off" disabled>
                <div id="suggestion-box" class="suggestion-container hidden"></div>
            </div>
            
            <div style="margin: 15px 0; text-align: left; color: #010530;">
                <p style="font-size: 13px; margin-bottom: 8px; font-weight: bold;">Jenis Kelamin:</p>
                <div style="display: flex; gap: 20px; align-items: center;">
                    <label style="display: flex; align-items: center; cursor: pointer; font-size: 14px;">
                        <input type="radio" name="reg-gender" value="PUTRA" style="margin-right: 8px; width: 18px; height: 18px;"> Putra
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer; font-size: 14px;">
                        <input type="radio" name="reg-gender" value="PUTRI" style="margin-right: 8px; width: 18px; height: 18px;"> Putri
                    </label>
                </div>
            </div>
            <button id="btn-login" class="primary-btn">MASUK</button>
        </div>
    `;

    const desaSel = document.getElementById('reg-desa');
    const kelSel = document.getElementById('reg-kelompok');
    const namaInp = document.getElementById('reg-nama');

    desaSel.onchange = () => {
        const kelompok = dataWilayah[desaSel.value] || [];
        kelSel.innerHTML = '<option value="">Pilih Kelompok</option>' + kelompok.map(k => `<option value="${k}">${k}</option>`).join('');
        kelSel.disabled = false;
    };
    kelSel.onchange = () => { namaInp.disabled = false; };
    namaInp.oninput = async () => {
        const val = namaInp.value.toUpperCase();
        const suggestBox = document.getElementById('suggestion-box');
        if (val.length < 1) { suggestBox.classList.add('hidden'); return; }

        const q = query(collection(db, "master_jamaah"), 
                  where("desa", "==", desaSel.value), 
                  where("kelompok", "==", kelSel.value));
        const snap = await getDocs(q);
        let matches = [];
        snap.forEach(d => {
            const namaDB = d.data().nama;
            if (namaDB.includes(val)) matches.push(namaDB);
        });

        if (matches.length > 0) {
            suggestBox.innerHTML = matches.map(name => `<div class="suggest-item" onclick="pilihSaranNama('${name}')">${name}</div>`).join('');
            suggestBox.classList.remove('hidden');
        } else { suggestBox.classList.add('hidden'); }
    };
    document.getElementById('btn-login').onclick = prosesLogin;
};

window.pilihSaranNama = (nama) => {
    document.getElementById('reg-nama').value = nama;
    document.getElementById('suggestion-box').classList.add('hidden');
};

window.pilihAkun = (userData) => {
    localStorage.setItem('currentUser', JSON.stringify(userData));
    showDashboard(userData);
};

window.prosesLogin = async () => {
    const namaRaw = document.getElementById('reg-nama').value;
    const nama = namaRaw.trim().toUpperCase();
    const desa = document.getElementById('reg-desa').value;
    const kelompok = document.getElementById('reg-kelompok').value;
    const genderRad = document.querySelector('input[name="reg-gender"]:checked');

    if (!nama || !desa || !kelompok || !genderRad) {
        return alert("⚠️ DATA BELUM LENGKAP!\nMohon isi nama dan pilih Jenis Kelamin (Putra/Putri).");
    }

    const gender = genderRad.value;

    try {
        const q = query(collection(db, "master_jamaah"), 
                  where("desa", "==", desa), 
                  where("kelompok", "==", kelompok), 
                  where("nama", "==", nama));
        const snap = await getDocs(q);
        let userData;

        if (!snap.empty) {
            const dbData = snap.docs[0].data();
            userData = { 
                nama: dbData.nama, 
                desa, 
                kelompok, 
                gender: dbData.gender || gender 
            };
        } else {
            if (confirm(`Daftarkan "${nama}" sebagai ${gender}?`)) {
                userData = { nama, desa, kelompok, gender: gender };
                await addDoc(collection(db, "master_jamaah"), userData);
            } else return;
        }

        saveAccount(userData);
        localStorage.setItem('currentUser', JSON.stringify(userData));
        showDashboard(userData);
    } catch (e) { 
        alert("Error: " + e.message); 
    }
};

// --- 3. DASHBOARD & SCANNER ---
window.showDashboard = (userData) => {
    const content = document.getElementById('app-content');
    content.innerHTML = `
        <div class="card animate-in">
            <div style="text-align:center; padding:30px 0;">
                <h2 style="font-weight: normal; color: #010530;">Assalaamualaikum,</h2>
                <h1 style="color: #010530; margin:10px 0; font-size: 2.2em;">${userData.nama}</h1>
                <p style="color: #888; letter-spacing: 1px;">${userData.desa} - ${userData.kelompok}</p>
            </div>
            <button onclick='mulaiScanner(${JSON.stringify(userData)})' class="primary-btn" style="padding:25px; font-size:20px; border-radius: 50px;">📸 MULAI SCAN BARCODE</button>
        </div>`;
};

window.mulaiScanner = (userData) => {
    const content = document.getElementById('app-content');
    content.innerHTML = `<div class="card" style="padding: 10px;"><div id="reader"></div><button onclick='showDashboard(${JSON.stringify(userData)})' class="secondary-btn" style="margin-top:15px;">BATAL</button></div>`;
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (decodedText) => {
        await html5QrCode.stop();
        prosesAbsensi(decodedText, userData);
    }).catch(err => alert("Akses kamera ditolak!"));
};

async function prosesAbsensi(eventID, userData) {
    try {
        const cleanID = eventID.replace("_IZIN", "");
        
        // 1. Ambil data event
        const eventSnap = await getDoc(doc(db, "events", cleanID));
        if (!eventSnap.exists()) { 
            alert("EVENT TIDAK DITEMUKAN ATAU SUDAH DITUTUP"); 
            return showDashboard(userData); 
        }
        
        const evData = eventSnap.data();

        // KUNCI PERBAIKAN: Gunakan 'wilayah', bukan 'ownerWilayah'
        const wilayahPunyaEvent = evData.wilayah || "SEMUA"; 

        const statusAbsen = eventID.includes("_IZIN") ? "izin" : "hadir";
        const attID = `${cleanID}_${userData.nama.replace(/\s/g, '')}`;

        // 2. Simpan absensi
        await setDoc(doc(db, "attendance", attID), {
            nama: userData.nama, 
            desa: userData.desa, 
            kelompok: userData.kelompok,
            eventId: cleanID, 
            wilayahEvent: wilayahPunyaEvent, // Sekarang akan tersimpan "LENDAH"
            waktu: serverTimestamp(), 
            status: statusAbsen
        });
        
        // 3. Feedback Visual
        const overlay = document.getElementById('success-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.innerHTML = `
                <div class="celebration-wrap">
                    <div class="text-top">Alhamdulillah Jazaa Kumullahu Khoiroo</div>
                    <div class="text-main">LANCAR<br>BAROKAH!</div>
                    <audio id="success-sound" src="https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3" preload="auto"></audio>
                </div>
            `;

            // Cek apakah fungsi createParticle ada agar tidak error
            if (typeof createParticle === 'function') {
                for (let i = 0; i < 50; i++) {
                    createParticle(overlay);
                }
            }

            const sound = document.getElementById('success-sound');
            if(sound) sound.play().catch(e => console.log("Audio blocked"));

            setTimeout(() => {
                overlay.style.display = 'none';
                showDashboard(userData);
            }, 4000);
        } else {
            // Jika overlay tidak ada, langsung ke dashboard saja
            alert("BERHASIL ABSEN!");
            showDashboard(userData);
        }

    } catch (e) { 
        console.error("Detail Error:", e);
        alert("Gagal: " + e.message); 
        showDashboard(userData);
    }
}
function createParticle(parent) {
    const p = document.createElement('div');
    p.classList.add('particle');
    const colors = ['#ffffff', '#8ab4f8', '#e8f0fe', '#ffd700'];
    p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = '50%';
    p.style.top = '50%';
    const x = (Math.random() - 0.5) * 400;
    const y = (Math.random() - 0.5) * 400;
    p.style.setProperty('--x', `${x}px`);
    p.style.setProperty('--y', `${y}px`);
    p.style.animation = `particle-fly ${0.5 + Math.random()}s ease-out forwards`;
    parent.appendChild(p);
    setTimeout(() => p.remove(), 2000);
}

// --- 4. PANEL ADMIN ---
window.bukaAdmin = () => {
    const pass = prompt("Password Admin:");
    if (pass !== "1234") return alert("Salah!");
    document.getElementById('modal-pilih-admin').style.display = 'block';
};

window.bukaPanelAdmin = () => {
    // Sembunyikan halaman registrasi/dashboard utama
    document.getElementById('pendaftar-section').classList.add('hidden');
    document.getElementById('admin-section').classList.remove('hidden');

    // Kosongkan konten lama agar tidak "numpuk" dari admin sebelumnya
    const container = document.getElementById('admin-dynamic-content');
    if (container) container.innerHTML = "<h3>Selamat Datang, Admin " + window.currentAdmin.wilayah + "</h3>";
};

window.switchAdminTab = (tab) => {
    // Reset warna semua tombol jadi abu-abu
    document.querySelectorAll('.admin-btn').forEach(b => b.style.background = "#666");
    
    // Warnai tombol yang aktif jadi biru
    const activeBtn = document.getElementById(`btn-${tab}`);
    if(activeBtn) activeBtn.style.background = "#007bff"; 
    
    if (tab === 'ev') {
        window.formBuatEvent();
    } else if (tab === 'lp') {
        window.lihatLaporan();
    } else if (tab === 'db') {
        window.lihatDatabase(); // Pintu ke menu Database
    }
};

window.formBuatEvent = async () => {
    const container = document.getElementById('admin-dynamic-content');
    const { wilayah } = window.currentAdmin;
    
    container.innerHTML = "<p style='text-align:center;'>Memeriksa status event...</p>";

    try {
        // SESUAI SCREENSHOT: Field di database adalah "wilayah"
        const q = query(
            collection(db, "events"), 
            where("status", "==", "open"), 
            where("wilayah", "==", wilayah) 
        );
        
        const snap = await getDocs(q);
        
        if (!snap.empty) {
            const docAktif = snap.docs[0];
            const d = docAktif.data();
            
            // Panggil fungsi tampilkan barcode
            tampilkanBarcode(docAktif.id, d.namaEvent, d.waktu);
            
        } else {
            container.innerHTML = `
                <div style="background:#fff3cd; padding:10px; border-radius:5px; margin-bottom:10px; font-size:12px;">
                    Belum ada event aktif untuk <b>${wilayah}</b>
                </div>
                <h3>Buat Event Baru</h3>
                <input type="text" id="ev-nama" placeholder="Nama Acara" style="width:100%; margin-bottom:10px; padding:8px;">
                <input type="datetime-local" id="ev-waktu" style="width:100%; margin-bottom:15px; padding:8px;">
                <button onclick="simpanEvent()" class="primary-btn" style="width:100%;">BUKA ABSENSI</button>
            `;
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = "Error: " + e.message;
    }
};

window.simpanEvent = async () => {
    const nama = document.getElementById('ev-nama').value;
    const waktu = document.getElementById('ev-waktu').value;
    if (!nama || !waktu) return alert("Isi data!");
    try { await addDoc(collection(db, "events"), {
            namaEvent: nama,
            waktu: waktu,
            status: "open",
            // Data identitas admin yang sedang login
            level: window.currentAdmin.role,   
            wilayah: window.currentAdmin.wilayah, 
            createdAt: serverTimestamp()
        });
        alert("Event Berhasil Dibuat!");
        bukaPanelAdmin(); 
    } catch (e) {
        alert("Gagal simpan: " + e.message);
    }
};

function tampilkanBarcode(id, nama, waktu) {
    document.getElementById('admin-dynamic-content').innerHTML = `
        <div style="text-align:center; width:100%; display:flex; flex-direction:column; align-items:center;">
            <h4 style="margin-bottom:5px;">${nama}</h4>
            <p style="font-size:12px; margin-bottom:20px;">${waktu.replace('T',' ')}</p>
            <div class="qr-item" style="width:100%; display:flex; flex-direction:column; align-items:center; margin-bottom:25px;">
                <p style="font-size:14px; margin-bottom:10px;"><b>Barcode Absensi</b></p>
                <div id="qrcode-absen" style="background:white; padding:10px; border-radius:8px; display:flex; justify-content:center;"></div>
                <button onclick="downloadQR('qrcode-absen','Absen_${nama}')" class="secondary-btn" style="margin-top:10px; width:200px;">🖼️ Preview Barcode</button>
            </div>
            <div class="qr-item" style="width:100%; display:flex; flex-direction:column; align-items:center; margin-bottom:25px;">
                <p style="font-size:14px; margin-bottom:10px;"><b>Barcode Izin</b></p>
                <div id="qrcode-izin" style="background:white; padding:10px; border-radius:8px; display:flex; justify-content:center;"></div>
                <button onclick="downloadQR('qrcode-izin','Izin_${nama}')" class="secondary-btn" style="margin-top:10px; width:200px;">🖼️ Preview Barcode Izin</button>
            </div>
            <button onclick="tutupEvent('${id}')" style="background:#d32f2f; color:white; width:90%; max-width:300px; padding:15px; margin-top:10px; border:none; border-radius:8px; font-weight:bold;">TUTUP EVENT</button>
        </div>`;
    new QRCode(document.getElementById("qrcode-absen"), { text: id, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.H });
    new QRCode(document.getElementById("qrcode-izin"), { text: id + "_IZIN", width: 180, height: 180, correctLevel: QRCode.CorrectLevel.H });
}

window.downloadQR = (el, name) => {
    const container = document.getElementById(el);
    const canvas = container.querySelector("canvas");
    if (!canvas) return alert("Belum siap.");
    const dataUrl = canvas.toDataURL("image/png");
    const overlay = document.createElement('div');
    overlay.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:20000; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px;";
    overlay.innerHTML = `
        <div style="background:white; padding:20px; border-radius:15px; text-align:center;">
            <img src="${dataUrl}" style="width:100%; max-width:250px;">
            <button id="btn-do-download" style="width:100%; padding:15px; background:#007bff; color:white; border:none; border-radius:8px; margin-top:15px;">📥 DOWNLOAD</button>
            <button id="close-qr" style="margin-top:10px; background:none; border:none; color:gray;">Tutup</button>
        </div>`;
    document.body.appendChild(overlay);
    document.getElementById('btn-do-download').onclick = () => {
        const link = document.createElement("a");
        link.href = dataUrl; link.download = name + ".png"; link.click();
    };
    document.getElementById('close-qr').onclick = () => document.body.removeChild(overlay);
};

window.tutupEvent = async (id) => {
    if(confirm("Tutup Event?")) { await deleteDoc(doc(db, "events", id)); bukaPanelAdmin(); }
};

// --- 7. DATABASE & UTILITY ---
window.lihatDatabase = async () => {
    const container = document.getElementById('admin-dynamic-content');
    container.innerHTML = `<div class="filter-box"><input type="text" id="cari-nama-db" placeholder="Cari nama..."><button onclick="renderTabelDatabase()" class="primary-btn">Cari</button></div><div id="db-container"></div>`;
    renderTabelDatabase();
};

window.renderTabelDatabase = async () => {
    const cari = document.getElementById('cari-nama-db').value.toUpperCase();
    const snap = await getDocs(collection(db, "master_jamaah"));
    let html = `<table><thead><tr><th>Nama</th><th>Info</th><th>Aksi</th></tr></thead><tbody>`;
    snap.forEach(ds => {
        const d = ds.data();
        if (d.nama.includes(cari) || !cari) {
            html += `<tr><td><b>${d.nama}</b></td><td><small>${d.desa}<br>${d.kelompok}</small></td><td><button onclick="hapusJamaah('${ds.id}','${d.nama}')" style="background:red; color:white; border:none; padding:5px; border-radius:5px;">🗑️</button></td></tr>`;
        }
    });
    document.getElementById('db-container').innerHTML = html + `</tbody></table>`;
};

window.hapusJamaah = async (id, nama) => {
    if (confirm(`Hapus ${nama}?`)) { await deleteDoc(doc(db, "master_jamaah", id)); renderTabelDatabase(); }
};

document.getElementById('menu-btn').onclick = (e) => { e.stopPropagation(); document.getElementById('menu-dropdown').classList.toggle('hidden'); };
window.onclick = () => {
    const menu = document.getElementById('menu-dropdown');
    if(menu) menu.classList.add('hidden');
};

const initApp = () => {
    const accounts = getSavedAccounts();
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser) showDashboard(currentUser);
    else if (accounts.length === 1) pilihAkun(accounts[0]);
    else showPageRegistrasi();
};

// --- SCRIPT INJECTOR OTOMATIS (JALANKAN SEKALI SAJA) ---
window.autoUploadAkunKelompok = async () => {
    const daftarKelompok = [
        "KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO", 
        "MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT", 
        "TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN", 
        "BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN", 
        "PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO" 
    ];

    console.log("🚀 Memulai upload 31 akun...");

    try {
        // 1. Tambah Admin Daerah
        await addDoc(collection(db, "admins"), {
            username: "pusat01",
            password: "999", 
            role: "DAERAH",
            wilayah: "SEMUA"
        });

        // 2. Tambah 31 Admin Kelompok
        for (let namaKlp of daftarKelompok) {
            let userID = namaKlp.toLowerCase().replace(/\s/g, '') + "01"; 
            
            await addDoc(collection(db, "admins"), {
                username: userID,
                password: "1234", 
                role: "KELOMPOK",
                wilayah: namaKlp
            });
            console.log(`✅ Berhasil: ${userID}`);
        }

        alert("ALHAMDULILLAH! Semua akun sudah masuk ke Firebase.");
    } catch (e) {
        console.error("Gagal Upload:", e);
        alert("Gagal: " + e.message);
    }
};
initApp();
