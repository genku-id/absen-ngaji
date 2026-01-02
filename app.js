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

const getSavedAccounts = () => JSON.parse(localStorage.getItem('saved_accounts')) || [];

window.showPageRegistrasi = () => {
    localStorage.removeItem('currentUser');
    const accounts = getSavedAccounts();
    const content = document.getElementById('pendaftar-section');
    
    let htmlAccounts = "";
    if (accounts.length > 0) {
        htmlAccounts = `
            <div style="width:100%; text-align:left; margin-bottom:20px;">
                <p style="font-size:12px; color:#666; font-weight:bold;">AKUN TERSIMPAN:</p>
                ${accounts.map(acc => `
                    <div class="account-card" onclick='pilihAkun(${JSON.stringify(acc)})' style="display:flex; justify-content:space-between; align-items:center; background:#f8f9fa; padding:12px; border-radius:10px; margin-bottom:8px; border:1px solid #eee;">
                        <div><b>${acc.nama}</b><br><small>${acc.desa}</small></div>
                        <button onclick="event.stopPropagation(); hapusAkunDariList('${acc.nama}')" style="background:none; border:none; color:red;">✕</button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    content.innerHTML = `
        <div class="salam-box">
            <h2 style="margin:0;">Login Jamaah</h2>
            <p style="color:gray;">Silakan masuk atau daftar baru</p>
        </div>
        ${htmlAccounts}
        <select id="reg-desa">
            <option value="">Pilih Desa</option>
            ${Object.keys(dataWilayah).map(d => `<option value="${d}">${d}</option>`).join('')}
        </select>
        <select id="reg-kelompok" disabled><option value="">Pilih Kelompok</option></select>
        <div style="position:relative; width:100%;">
            <input type="text" id="reg-nama" placeholder="Ketik Nama Lengkap..." disabled>
            <div id="suggestion-box" class="suggestion-container hidden"></div>
        </div>
        <div style="display:flex; gap:20px; margin:10px 0;">
            <label><input type="radio" name="reg-gender" value="PUTRA"> Putra</label>
            <label><input type="radio" name="reg-gender" value="PUTRI"> Putri</label>
        </div>
        <button id="btn-login" class="primary-btn">MASUK</button>
    `;

    // Event Listeners
    const dSel = document.getElementById('reg-desa');
    const kSel = document.getElementById('reg-kelompok');
    const nInp = document.getElementById('reg-nama');

    dSel.onchange = () => {
        const kls = dataWilayah[dSel.value] || [];
        kSel.innerHTML = '<option value="">Pilih Kelompok</option>' + kls.map(k => `<option value="${k}">${k}</option>`).join('');
        kSel.disabled = false;
    };
    kSel.onchange = () => nInp.disabled = false;
    document.getElementById('btn-login').onclick = prosesLogin;
};

window.showDashboard = (userData) => {
    const content = document.getElementById('pendaftar-section');
    content.classList.remove('hidden');
    document.getElementById('admin-section').classList.add('hidden');
    
    content.innerHTML = `
        <div class="salam-box">
            <p style="font-size:1.2rem; margin-bottom:0;">Assalaamualaikum,</p>
            <h1 style="margin:5px 0; font-size:2rem;">${userData.nama}</h1>
            <p style="color:#0056b3; font-weight:bold;">${userData.desa} - ${userData.kelompok}</p>
        </div>
        <button onclick='mulaiScanner(${JSON.stringify(userData)})' class="scan-btn">
            📸 MULAI SCAN BARCODE
        </button>
        <p style="margin-top:20px; font-size:12px; color:gray;">Pastikan kamera mendapatkan cahaya cukup</p>
    `;
};

window.mulaiScanner = (userData) => {
    const content = document.getElementById('pendaftar-section');
    content.innerHTML = `
        <h3>Scan Barcode Event</h3>
        <div id="reader"></div>
        <button onclick='showDashboard(${JSON.stringify(userData)})' class="secondary-btn">BATAL</button>
    `;
    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (txt) => {
        await html5QrCode.stop();
        prosesAbsensi(txt, userData);
    }).catch(e => alert("Kamera Error: " + e));
};

async function prosesAbsensi(eventId, userData) {
    try {
        const cleanId = eventId.replace("_IZIN", "");
        const eventSnap = await getDoc(doc(db, "events", cleanId));
        
        if(!eventSnap.exists()) {
            alert("Event tidak aktif!");
            return showDashboard(userData);
        }

        const ev = eventSnap.data();
        const status = eventId.includes("_IZIN") ? "izin" : "hadir";
        const attID = `${cleanId}_${userData.nama.replace(/\s/g, '')}`;

        await setDoc(doc(db, "attendance", attID), {
            nama: userData.nama,
            desa: userData.desa,
            kelompok: userData.kelompok,
            eventId: cleanId,
            wilayahEvent: ev.wilayah || "SEMUA",
            waktu: serverTimestamp(),
            status: status
        });

        const overlay = document.getElementById('success-overlay');
        overlay.innerHTML = `<h1 style="text-align:center;">ALHAMDULILLAH<br>BERHASIL!</h1>`;
        overlay.style.display = 'flex';
        overlay.classList.remove('hidden');

        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.style.display = 'none';
            showDashboard(userData);
        }, 3000);

    } catch (e) { alert("Gagal: " + e.message); showDashboard(userData); }
}

const initApp = () => {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (user) showDashboard(user);
    else showPageRegistrasi();
};

initApp();
