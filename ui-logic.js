export const WILAYAH = {
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"]
};

window.masterCache = [];

window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
};

window.switchTab = (tabName) => {
    // Sembunyikan semua konten tab
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    // Hapus class active dari semua tombol
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Tampilkan tab yang dipilih
    document.getElementById('tab-' + tabName).classList.remove('hidden');
    // Beri class active pada tombol yang diklik
    event.currentTarget.classList.add('active');
};

window.updateKelompok = (targetId, desa) => {
    const el = document.getElementById(targetId);
    el.innerHTML = '<option value="">-- Pilih Kelompok --</option>';
    if(WILAYAH[desa]) WILAYAH[desa].forEach(k => el.innerHTML += `<option value="${k}">${k}</option>`);
};

// SARAN NAMA
window.handleNameInput = (val) => {
    const desa = document.getElementById('p-desa').value;
    const kel = document.getElementById('p-kelompok').value;
    const box = document.getElementById('suggestion-box');
    if(!desa || !kel || val.length < 2) { box.classList.add('hidden'); return; }
    const matches = window.masterCache.filter(m => m.desa === desa && m.kelompok === kel && m.nama.toLowerCase().includes(val.toLowerCase()));
    if(matches.length > 0) {
        box.classList.remove('hidden');
        box.innerHTML = matches.map(m => `<div class="suggestion-item" onclick="selectSug('${m.nama}')">${m.nama}</div>`).join('');
    } else box.classList.add('hidden');
};

window.selectSug = (n) => {
    document.getElementById('p-nama').value = n;
    document.getElementById('suggestion-box').classList.add('hidden');
};

// SALAM HANGAT
window.tampilkanSalam = () => {
    const infoPeserta = document.getElementById('display-nama');
    const akunAktif = JSON.parse(localStorage.getItem('akun_aktif'));
    if (infoPeserta && akunAktif) {
        infoPeserta.innerHTML = `Assalaamualaikum,<br><span style="color: #27ae60;">${akunAktif.nama}</span>`;
    }
};
// ui-logic.js

// Pastikan WILAYAH sudah ada di atas
window.updateFilterKelompok = (desa) => {
    const el = document.getElementById('f-kelompok');
    el.innerHTML = '<option value="">-- Semua Kelompok --</option>';
    if(WILAYAH[desa]) {
        WILAYAH[desa].forEach(k => {
            el.innerHTML += `<option value="${k}">${k}</option>`;
        });
    }
};
