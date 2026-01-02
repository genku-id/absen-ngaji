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
    const content = document.getElementById('pendaftar-section');
    const accounts = getSavedAccounts();
    
    let htmlList = "";
    if (accounts.length > 0) {
        htmlList = `
            <div class="account-list" style="margin-bottom:20px; text-align:left;">
                <p style="font-size: 11px; color: #888; font-weight:bold;">AKUN TERDAFTAR:</p>
                ${accounts.map(acc => `
                    <div class="account-card" onclick='pilihAkun(${JSON.stringify(acc)})' style="background:#f9f9f9; padding:10px; border-radius:10px; margin-bottom:5px; display:flex; justify-content:space-between; border:1px solid #eee; cursor:pointer;">
                        <span><b>${acc.nama}</b><br><small>${acc.kelompok}</small></span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    content.innerHTML = `
        <h2 style="margin-top:0;">LogIn Peserta</h2>
        ${htmlList}
        <select id="reg-desa">
            <option value="">Pilih Desa</option>
            ${Object.keys(dataWilayah).map(desa => `<option value="${desa}">${desa}</option>`).join('')}
        </select>
        <select id="reg-kelompok" disabled><option value="">Pilih Kelompok</option></select>
        <div style="position: relative; width: 100%;">
            <input type="text" id="reg-nama" placeholder="Ketik Nama Anda..." autocomplete="off" disabled>
            <div id="suggestion-box" class="suggestion-container hidden"></div>
        </div>
        <div style="margin: 15px 0; text-align: left;">
            <p style="font-size: 13px; font-weight: bold; margin-bottom:5px;">Jenis Kelamin:</p>
            <label><input type="radio" name="reg-gender" value="PUTRA"> Putra</label> &nbsp;
            <label><input type="radio" name="reg-gender" value="PUTRI"> Putri</label>
        </div>
        <button id="btn-login-peserta" class="primary-btn" style="width:100%;">MASUK</button>
    `;

    // Logic Dropdown & Sugesti
    const desaSel = document.getElementById('reg-desa');
    const kelSel = document.getElementById('reg-kelompok');
    const namaInp = document.getElementById('reg-nama');
    const suggestBox = document.getElementById('suggestion-box');

    desaSel.onchange = () => {
        const kel = dataWilayah[desaSel.value] || [];
        kelSel.innerHTML = '<option value="">Pilih Kelompok</option>' + kel.map(k => `<option value="${k}">${k}</option>`).join('');
        kelSel.disabled = false;
    };

    kelSel.onchange = () => { namaInp.disabled = false; };

    namaInp.oninput = async () => {
        const val = namaInp.value.toUpperCase();
        if (val.length < 2) { suggestBox.classList.add('hidden'); return; }

        const q = query(collection(db, "master_jamaah"), 
                  where("desa", "==", desaSel.value), 
                  where("kelompok", "==", kelSel.value));
        const snap = await getDocs(q);
        let matches = [];
        snap.forEach(d => {
            const n = d.data().nama;
            if (n.includes(val)) matches.push(n);
        });

        if (matches.length > 0) {
            suggestBox.innerHTML = matches.map(name => `<div class="suggest-item" onclick="pilihSaranNama('${name}')">${name}</div>`).join('');
            suggestBox.classList.remove('hidden');
        } else { suggestBox.classList.add('hidden'); }
    };

    document.getElementById('btn-login-peserta').onclick = prosesLogin;
};

window.pilihSaranNama = (nama) => {
    document.getElementById('reg-nama').value = nama;
    document.getElementById('suggestion-box').classList.add('hidden');
};

window.prosesLogin = async () => {
    const nama = document.getElementById('reg-nama').value.trim().toUpperCase();
    const desa = document.getElementById('reg-desa').value;
    const kelompok = document.getElementById('reg-kelompok').value;
    const genderRad = document.querySelector('input[name="reg-gender"]:checked');

    if (!nama || !desa || !kelompok || !genderRad) return alert("Lengkapi data!");

    const gender = genderRad.value;
    try {
        const q = query(collection(db, "master_jamaah"), 
                  where("desa", "==", desa), 
                  where("kelompok", "==", kelompok), 
                  where("nama", "==", nama));
        const snap = await getDocs(q);
        let userData;

        if (!snap.empty) {
            userData = snap.docs[0].data();
        } else {
            // FITUR AUTO-REGISTER JIKA TIDAK ADA DI DB
            if (confirm(`Nama "${nama}" belum terdaftar. Daftarkan baru?`)) {
                userData = { nama, desa, kelompok, gender };
                await addDoc(collection(db, "master_jamaah"), userData);
            } else return;
        }

        let accounts = getSavedAccounts();
        if(!accounts.find(a => a.nama === nama)) {
            accounts.push(userData);
            localStorage.setItem('saved_accounts', JSON.stringify(accounts));
        }
        localStorage.setItem('currentUser', JSON.stringify(userData));
        showDashboard(userData);
    } catch (e) { alert(e.message); }
};

window.pilihAkun = (acc) => {
    localStorage.setItem('currentUser', JSON.stringify(acc));
    showDashboard(acc);
};

window.showDashboard = (user) => {
    const content = document.getElementById('pendaftar-section');
    content.innerHTML = `
        <div class="salam-box">
            <p>Assalaamualaikum,</p>
            <h1 style="margin:10px 0;">${user.nama}</h1>
            <p style="color:#007bff;">${user.desa} - ${user.kelompok}</p>
        </div>
        <button onclick='mulaiScanner(${JSON.stringify(user)})' class="scan-btn" style="width:100%; padding:20px; font-size:18px;">
            📸 MULAI SCAN BARCODE
        </button>
    `;
};

// ... Logika Scanner (mulaiScanner & prosesAbsensi) sama seperti kode sebelumnya ...

// LOGIKA TITIK 3 (HEADER)
document.getElementById('menu-btn').onclick = (e) => {
    e.stopPropagation();
    document.getElementById('menu-dropdown').classList.toggle('hidden');
};
window.onclick = () => document.getElementById('menu-dropdown').classList.add('hidden');

// Start App
window.showPageRegistrasi();
