import { db } from './firebase-config.js';
import { 
    collection, getDocs, query, where, addDoc, 
    doc, setDoc, getDoc, serverTimestamp, limit, orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const dataWilayah = {
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"]
};

let html5QrCode;

// --- LOGIKA TAHUN AJARAN (MULAI 1 JULI) ---
const getPeriodeTA = () => {
    const d = new Date();
    const bulan = d.getMonth() + 1; // 1-12
    const tahun = d.getFullYear();
    // Jika sebelum Juli, masuk TA tahun sebelumnya. Jika Juli keatas, masuk TA tahun ini.
    return bulan >= 7 ? `TA-${tahun}` : `TA-${tahun - 1}`;
};

const getSavedAccounts = () => JSON.parse(localStorage.getItem('saved_accounts')) || [];

const saveAccount = (user) => {
    let accounts = getSavedAccounts();
    const idx = accounts.findIndex(a => a.nama === user.nama && a.kelompok === user.kelompok);
    if (idx === -1) {
        accounts.push(user);
    } else {
        accounts[idx] = user; // Update data jika sudah ada
    }
    localStorage.setItem('saved_accounts', JSON.stringify(accounts));
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
        
        <div style="margin:15px 0; text-align:left;">
            <p style="font-size:14px; font-weight:bold; margin-bottom:10px;">Jenis Kelamin:</p>
            <div style="display: flex; gap: 20px;">
                <label><input type="radio" name="reg-gender" value="PUTRA"> Putra</label>
                <label><input type="radio" name="reg-gender" value="PUTRI"> Putri</label>
            </div>
        </div>

        <div style="margin:15px 0; text-align:left;">
            <p style="font-size:14px; font-weight:bold; margin-bottom:5px;">Pilih Kelas:</p>
            <select id="reg-kelas" style="width:100%; padding:10px; border-radius:8px; border:1px solid #ccc;">
                <option value="">-- Pilih Kelas --</option>
                <option value="PRA-REMAJA">PRA-REMAJA</option>
                <option value="REMAJA">REMAJA</option>
                <option value="PRA-NIKAH">PRA-NIKAH</option>
            </select>
        </div>

        <button id="btn-login" class="primary-btn">MASUK SEKARANG</button>
    `;

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
    const kelas = document.getElementById('reg-kelas').value;

    if (!nama || !desa || !kelompok || !gender || !kelas) return alert("Mohon lengkapi data!");

    try {
        const q = query(collection(db, "master_jamaah"), where("desa", "==", desa), where("kelompok", "==", kelompok), where("nama", "==", nama));
        const snap = await getDocs(q);
        let user;

        if (!snap.empty) {
            user = { id: snap.docs[0].id, ...snap.docs[0].data() };
            // Auto-update TA jika belum ada di DB
            if (!user.lastUpdateTA) {
                user.kelas = kelas;
                user.lastUpdateTA = getPeriodeTA();
                await setDoc(doc(db, "master_jamaah", user.id), { kelas: kelas, lastUpdateTA: user.lastUpdateTA }, { merge: true });
            }
        } else {
            if (confirm(`Nama "${nama}" belum terdaftar. Daftarkan baru?`)) {
                user = { nama, desa, kelompok, gender, kelas, lastUpdateTA: getPeriodeTA() };
                const docRef = await addDoc(collection(db, "master_jamaah"), user);
                user.id = docRef.id;
            } else return;
        }

        saveAccount(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
        showDashboard(user);
    } catch (e) { alert(e.message); }
};

// --- LOGIKA CEGAT PEMUTAKHIRAN ---
window.showDashboard = (user) => {
    const currentTA = getPeriodeTA();
    
    // CEGAT: Jika TA di user berbeda dengan TA sistem sekarang
    if (user.lastUpdateTA !== currentTA) {
        showLayarPemutakhiran(user);
        return;
    }

    const content = document.getElementById('pendaftar-section');
    window.currentUserData = user;
    content.innerHTML = `
        <div class="salam-box" style="margin-bottom:20px;">
            <p>Assalaamualaikum,</p>
            <h1 style="color:#0056b3; margin:5px 0;">${user.nama}</h1>
            <p><b>${user.desa} - ${user.kelompok} (${user.kelas})</b></p>
        </div>
        <div id="riwayat-absen-box">Memuat riwayat...</div>
        <button onclick='mulaiScanner()' class="scan-btn">📸 MULAI SCAN BARCODE</button>
    `;
    if (typeof window.renderRiwayatBeranda === 'function') {
        window.renderRiwayatBeranda(user); 
    }
};

window.showLayarPemutakhiran = (user) => {
    const content = document.getElementById('pendaftar-section');
    content.innerHTML = `
        <div style="text-align:center; padding:20px;">
            <div style="font-size:50px; margin-bottom:10px;">📅</div>
            <h2 style="color:#0056b3;">Tahun Ajaran Baru!</h2>
            <p style="font-size:14px; color:#555;">Halo <b>${user.nama}</b>, silakan perbarui data kelas Anda untuk periode <b>${getPeriodeTA()}</b>.</p>
            
            <div style="margin:25px 0; text-align:left;">
                <label style="font-weight:bold; font-size:13px;">Pilih Kelas Terbaru:</label>
                <select id="update-kelas" style="width:100%; padding:15px; border-radius:10px; border:2px solid #0056b3; margin-top:5px; font-size:16px; font-weight:bold;">
                    <option value="PRA-REMAJA">PRA-REMAJA</option>
                    <option value="REMAJA">REMAJA</option>
                    <option value="PRA-NIKAH">PRA-NIKAH</option>
                </select>
            </div>

            <button id="btn-simpan-update" class="primary-btn" style="width:100%; padding:15px;">SIMPAN DATA KELAS</button>
            <p style="font-size:11px; color:#999; margin-top:15px;">Data ini diperlukan untuk akurasi laporan kehadiran per kelas.</p>
        </div>
    `;

    document.getElementById('btn-simpan-update').onclick = async () => {
        const kelasBaru = document.getElementById('update-kelas').value;
        const currentTA = getPeriodeTA();

        try {
            // Cari ID dokumen jika belum ada di object user
            let docId = user.id;
            if (!docId) {
                const q = query(collection(db, "master_jamaah"), where("nama", "==", user.nama), where("kelompok", "==", user.kelompok));
                const snap = await getDocs(q);
                docId = snap.docs[0].id;
            }

            const updatedUser = { ...user, kelas: kelasBaru, lastUpdateTA: currentTA, id: docId };
            
            // Simpan ke Firestore
            await setDoc(doc(db, "master_jamaah", docId), { kelas: kelasBaru, lastUpdateTA: currentTA }, { merge: true });
            
            // Update LocalStorage
            saveAccount(updatedUser);
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            
            alert("Data Berhasil Diperbarui!");
            showDashboard(updatedUser);
        } catch (e) { alert("Gagal Update: " + e.message); }
    };
};

window.mulaiScanner = () => {
    const scanSec = document.getElementById('scanner-section');
    scanSec.classList.remove('hidden');
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (txt) => {
        window.stopScanner();
        prosesAbsensi(txt, window.currentUserData);
    }).catch(e => {
        alert("Kamera error!");
        window.stopScanner();
    });
};

window.stopScanner = async () => {
    const scanSec = document.getElementById('scanner-section');
    if (html5QrCode) { try { await html5QrCode.stop(); } catch (e) {} }
    scanSec.classList.add('hidden');
};

async function prosesAbsensi(eventId, user) {
    try {
        const cleanId = eventId.replace("_IZIN", "");
        const evSnap = await getDoc(doc(db, "events", cleanId));
        if (!evSnap.exists()) return alert("Event tidak aktif!");
        const ev = evSnap.data();
        const status = eventId.includes("_IZIN") ? "izin" : "hadir";

        window.tampilkanModalShodaqoh(async (nominal) => {
            try {
                await setDoc(doc(db, "attendance", `${cleanId}_${user.nama.replace(/\s/g, '')}`), {
                    nama: user.nama,
                    desa: user.desa,
                    kelompok: user.kelompok,
                    gender: user.gender, 
                    kelas: user.kelas || "-",
                    eventId: cleanId,
                    wilayahEvent: ev.wilayah || "SEMUA",
                    status: status,
                    shodaqoh: nominal,
                    waktu: serverTimestamp()
                });

                const overlay = document.getElementById('success-overlay');
                if (overlay) {
                    overlay.style.display = 'flex';
                    overlay.innerHTML = `
                        <div class="celebration-wrap">
                            <div class="text-top">Alhamdulillah Jazaa Kumullahu Khoiroo</div>
                            <div class="text-main">LANCAR<br>BAROKAH!</div>
                            ${nominal > 0 ? `<p style="margin-top:10px; font-weight:bold; color:white;">Shodaqoh Rp ${nominal.toLocaleString('id-ID')} dicatat</p>` : ''}
                            <audio id="success-sound" src="https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3" preload="auto"></audio>
                        </div>
                    `;
                    if (typeof window.createParticle === 'function') {
                        for (let i = 0; i < 50; i++) { window.createParticle(overlay); }
                    }
                    const sound = document.getElementById('success-sound');
                    if(sound) sound.play().catch(e => console.log("Audio blocked"));
                    setTimeout(() => {
                        overlay.style.display = 'none';
                        showDashboard(user);
                    }, 4000);
                }
            } catch (err) { alert("Gagal menyimpan: " + err.message); }
        }); 
    } catch (e) { alert("Gagal absen: " + e.message); }
}

window.createParticle = (parent) => {
    const p = document.createElement('div');
    p.style.position = 'fixed';
    p.style.width = '8px'; p.style.height = '8px';
    p.style.backgroundColor = ['#FFD700', '#FFFFFF', '#ADFF2F', '#FF69B4'][Math.floor(Math.random() * 4)];
    p.style.left = Math.random() * 100 + 'vw'; p.style.top = '-10px';
    p.style.borderRadius = '50%'; p.style.zIndex = '10001';
    p.style.transition = `transform ${Math.random() * 2 + 2}s linear, opacity 2s`;
    parent.appendChild(p);
    setTimeout(() => {
        p.style.transform = `translateY(110vh) translateX(${Math.random() * 100 - 50}px)`;
        p.style.opacity = '0';
    }, 100);
    setTimeout(() => p.remove(), 4000);
};

const setupNav = () => {
    const btnMenu = document.getElementById('menu-btn');
    const dropdown = document.getElementById('menu-dropdown');
    const btnAdmin = document.getElementById('btn-admin-nav');
    const btnLogout = document.getElementById('btn-logout-nav');
    const inputGaleri = document.getElementById('input-qr-galeri');

    if (btnMenu) btnMenu.onclick = (e) => { e.stopPropagation(); dropdown.classList.toggle('hidden'); };
    if (btnAdmin) btnAdmin.onclick = (e) => {
        e.stopPropagation(); dropdown.classList.add('hidden');
        if (typeof window.bukaModalPilihAdmin === 'function') window.bukaModalPilihAdmin();
    };
    if (btnLogout) btnLogout.onclick = () => {
        dropdown.classList.add('hidden');
        window.currentAdmin = null;
        window.showPageRegistrasi();
    };
    if (inputGaleri) {
        inputGaleri.addEventListener('change', async (e) => {
            if (typeof window.prosesScanGaleri === 'function') {
                await window.stopScanner();
                window.prosesScanGaleri(e, window.currentUserData);
            }
        });
    }
};

window.onclick = () => {
    const dropdown = document.getElementById('menu-dropdown');
    if (dropdown) dropdown.classList.add('hidden');
};

const initApp = () => {
    setupNav();
    const current = JSON.parse(localStorage.getItem('currentUser'));
    if (current) window.showDashboard(current);
    else window.showPageRegistrasi();
};

initApp();
