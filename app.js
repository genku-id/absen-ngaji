import { db } from './firebase-config.js';
import { 
    collection, getDocs, query, where, addDoc, 
    doc, setDoc, getDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const dataWilayah = {
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"]
};

let html5QrCode;

// --- FUNGSI AKUN (GOOGLE STYLE) ---
const getSavedAccounts = () => JSON.parse(localStorage.getItem('saved_accounts')) || [];

const saveAccount = (user) => {
    let accounts = getSavedAccounts();
    if (!accounts.find(a => a.nama === user.nama && a.kelompok === user.kelompok)) {
        accounts.push(user);
        localStorage.setItem('saved_accounts', JSON.stringify(accounts));
    }
};

window.hapusAkun = (nama) => {
    let accounts = getSavedAccounts().filter(a => a.nama !== nama);
    localStorage.setItem('saved_accounts', JSON.stringify(accounts));
    showPageRegistrasi();
};

// --- HALAMAN LOGIN/REGISTRASI ---
window.showPageRegistrasi = () => {
    localStorage.removeItem('currentUser');
    
    const content = document.getElementById('pendaftar-section');
    const accounts = getSavedAccounts();

    let htmlAccounts = "";
    if (accounts.length > 0) {
        htmlAccounts = `
            <div style="margin-bottom:20px; text-align:left;">
                <p style="font-size:11px; color:#888; font-weight:bold; margin-bottom:10px;">AKUN TERSIMPAN:</p>
                ${accounts.map(acc => `
                    <div class="account-card" onclick='pilihAkun(${JSON.stringify(acc)})'>
                        <div><b>${acc.nama}</b><br><small>${acc.desa} • ${acc.kelompok}</small></div>
                        <button onclick="event.stopPropagation(); hapusAkun('${acc.nama}')" style="background:none; border:none; color:red; font-weight:bold;">✕</button>
                    </div>
                `).join('')}
                <div style="text-align:center; margin:15px 0; color:#ccc;">— ATAU MASUK BARU —</div>
            </div>
        `;
    }

    content.innerHTML = `
        <h2 style="margin-top:0;">LogIn Peserta</h2>
        ${htmlAccounts}
        <select id="reg-desa">
            <option value="">Pilih Desa</option>
            ${Object.keys(dataWilayah).map(d => `<option value="${d}">${d}</option>`).join('')}
        </select>
        <select id="reg-kelompok" disabled><option value="">Pilih Kelompok</option></select>
        <div style="position:relative;">
            <input type="text" id="reg-nama" placeholder="Ketik Nama Lengkap..." autocomplete="off" disabled>
            <div id="suggestion-box" class="suggestion-container hidden"></div>
        </div>
       <div style="margin:20px 0; text-align:left;">
    <p style="font-size:14px; font-weight:bold; margin-bottom:10px; color:#333;">Jenis Kelamin:</p>
    <div style="display: flex; gap: 20px; align-items: center;">
        <label style="display: flex; align-items: center; cursor: pointer; font-size: 15px;">
            <input type="radio" name="reg-gender" value="PUTRA" style="margin-right: 8px; width: 18px; height: 18px;"> Putra
        </label>
        <label style="display: flex; align-items: center; cursor: pointer; font-size: 15px;">
            <input type="radio" name="reg-gender" value="PUTRI" style="margin-right: 8px; width: 18px; height: 18px;"> Putri
        </label>
    </div>
</div>
        <button id="btn-login" class="primary-btn">MASUK SEKARANG</button>
    `;

    // Dropdown Logic
    const dSel = document.getElementById('reg-desa');
    const kSel = document.getElementById('reg-kelompok');
    const nInp = document.getElementById('reg-nama');
    const sBox = document.getElementById('suggestion-box');

    dSel.onchange = () => {
        const kls = dataWilayah[dSel.value] || [];
        kSel.innerHTML = '<option value="">Pilih Kelompok</option>' + kls.map(k => `<option value="${k}">${k}</option>`).join('');
        kSel.disabled = false;
    };

    kSel.onchange = () => nInp.disabled = false;

    nInp.oninput = async () => {
        const val = nInp.value.toUpperCase();
        if (val.length < 2) { sBox.classList.add('hidden'); return; }

        const q = query(collection(db, "master_jamaah"), where("desa", "==", dSel.value), where("kelompok", "==", kSel.value));
        const snap = await getDocs(q);
        let matches = [];
        snap.forEach(d => { if (d.data().nama.includes(val)) matches.push(d.data().nama); });

        if (matches.length > 0) {
            sBox.innerHTML = matches.map(m => `<div class="suggest-item" onclick="pilihSaran('${m}')">${m}</div>`).join('');
            sBox.classList.remove('hidden');
        } else { sBox.classList.add('hidden'); }
    };

    document.getElementById('btn-login').onclick = prosesLogin;
};

window.pilihSaran = (n) => {
    document.getElementById('reg-nama').value = n;
    document.getElementById('suggestion-box').classList.add('hidden');
};

window.pilihAkun = (user) => {
    localStorage.setItem('currentUser', JSON.stringify(user));
    showDashboard(user);
};

window.prosesLogin = async () => {
    const nama = document.getElementById('reg-nama').value.trim().toUpperCase();
    const desa = document.getElementById('reg-desa').value;
    const kelompok = document.getElementById('reg-kelompok').value;
    const gender = document.querySelector('input[name="reg-gender"]:checked')?.value;

    if (!nama || !desa || !kelompok || !gender) return alert("Mohon lengkapi data!");

    try {
        const q = query(collection(db, "master_jamaah"), where("desa", "==", desa), where("kelompok", "==", kelompok), where("nama", "==", nama));
        const snap = await getDocs(q);
        let user;

        if (!snap.empty) {
            user = snap.docs[0].data();
        } else {
            if (confirm(`Nama "${nama}" belum terdaftar. Daftarkan baru?`)) {
                user = { nama, desa, kelompok, gender };
                await addDoc(collection(db, "master_jamaah"), user);
            } else return;
        }

        saveAccount(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
        showDashboard(user);
    } catch (e) { alert(e.message); }
};

// --- DASHBOARD & SCANNER ---
window.showDashboard = (user) => {
    const content = document.getElementById('pendaftar-section');
    content.innerHTML = `
        <div class="salam-box">
            <p>Assalaamualaikum,</p>
            <h1 style="color:#0056b3;">${user.nama}</h1>
            <p><b>${user.desa} - ${user.kelompok}</b></p>
        </div>
        <button onclick='mulaiScanner(${JSON.stringify(user)})' class="scan-btn">📸 MULAI SCAN BARCODE</button>
    `;
};

window.mulaiScanner = (user) => {
    const content = document.getElementById('pendaftar-section');
    content.innerHTML = `<h3>Scan Barcode</h3><div id="reader"></div><button onclick='showDashboard(${JSON.stringify(user)})' class="primary-btn" style="background:#666;">BATAL</button>`;
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (txt) => {
        await html5QrCode.stop();
        prosesAbsensi(txt, user);
    }).catch(e => alert("Kamera error!"));
};

async function prosesAbsensi(eventId, user) {
    try {
        const cleanId = eventId.replace("_IZIN", "");
        const evSnap = await getDoc(doc(db, "events", cleanId));
        
        if (!evSnap.exists()) return alert("Event tidak aktif!");
        
        const ev = evSnap.data();
        const status = eventId.includes("_IZIN") ? "izin" : "hadir";

        // Simpan data ke Firestore
        await setDoc(doc(db, "attendance", `${cleanId}_${user.nama.replace(/\s/g, '')}`), {
            nama: user.nama,
            desa: user.desa,
            kelompok: user.kelompok,
            gender: user.gender, // Pastikan master_jamaah ada field gender
            eventId: cleanId,
            wilayahEvent: ev.wilayah || "SEMUA",
            status: status,
            waktu: serverTimestamp()
        });

        // --- MULAI OVERLAY SELEBRASI (Sesuai Code Awal Kamu) ---
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

            // Efek Partikel
            if (typeof createParticle === 'function') {
                for (let i = 0; i < 50; i++) {
                    createParticle(overlay);
                }
            }

            // Putar Suara
            const sound = document.getElementById('success-sound');
            if(sound) sound.play().catch(e => console.log("Audio blocked"));

            // Tunggu 4 Detik (Sesuai Keinginanmu)
            setTimeout(() => {
                overlay.style.display = 'none';
                showDashboard(user);
            }, 4000);

        } else { alert("LANCAR BAROKAH!"); showDashboard(user); }

    } catch (e) {
        console.error(e);
        alert("Gagal absen: " + e.message);
    }
}

window.createParticle = (parent) => {
    const p = document.createElement('div');
    p.style.position = 'fixed';
    p.style.width = '8px';
    p.style.height = '8px';
    p.style.backgroundColor = ['#FFD700', '#FFFFFF', '#ADFF2F', '#FF69B4'][Math.floor(Math.random() * 4)];
    p.style.left = Math.random() * 100 + 'vw';
    p.style.top = '-10px';
    p.style.borderRadius = '50%';
    p.style.zIndex = '10000';
    p.style.transition = `transform ${Math.random() * 2 + 2}s linear, opacity 2s`;
    
    parent.appendChild(p);
    
    setTimeout(() => {
        p.style.transform = `translateY(110vh) translateX(${Math.random() * 100 - 50}px)`;
        p.style.opacity = '0';
    }, 100);
    
    setTimeout(() => p.remove(), 4000);
};

// --- GLOBAL NAV LISTENERS (Ganti dari baris 198 ke bawah) ---

const setupNav = () => {
    const btnMenu = document.getElementById('menu-btn');
    const dropdown = document.getElementById('menu-dropdown');
    const btnAdmin = document.getElementById('btn-admin-nav');
    const btnLogout = document.getElementById('btn-logout-nav');

    // 1. Klik Titik 3
    if (btnMenu) {
        btnMenu.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
        };
    }

    // 2. Klik Menu Admin
    if (btnAdmin) {
        btnAdmin.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.add('hidden');
            // Memanggil fungsi dari admin-logic.js
            if (typeof window.bukaModalPilihAdmin === 'function') {
                window.bukaModalPilihAdmin();
            } else {
                alert("Sistem Admin belum siap, coba sesaat lagi.");
            }
        };
    }

    // 3. Klik Logout
    // Di dalam file app.js bagian setupNav
if (btnLogout) {
    btnLogout.onclick = () => {
        // 1. Sembunyikan dropdown menu
        dropdown.classList.add('hidden');
        
        // 2. BERSIHKAN LAYAR (Sembunyikan semua section secara manual)
        const secAdmin = document.getElementById('admin-section');
        const secDash = document.getElementById('dashboard-section');
        const secReg = document.getElementById('pendaftar-section');
        
        if (secAdmin) secAdmin.classList.add('hidden');
        if (secDash) secDash.classList.add('hidden');
        if (secReg) secReg.classList.remove('hidden');

        // 3. Reset data admin di memori
        window.currentAdmin = null;

        // 4. Jalankan fungsi registrasi untuk menampilkan list akun
        window.showPageRegistrasi();
    };
}
};

// Tutup dropdown jika klik di luar area menu
window.onclick = () => {
    const dropdown = document.getElementById('menu-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
};

// --- INIT APP (Inisialisasi Aplikasi) ---
const initApp = () => {
    // Jalankan setup navigasi
    setupNav();
    
    // Cek status login user
    const current = JSON.parse(localStorage.getItem('currentUser'));
    if (current) {
        window.showDashboard(current);
    } else {
        window.showPageRegistrasi();
    }
};
// Jalankan aplikasi
initApp();
