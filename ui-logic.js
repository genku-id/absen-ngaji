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

window.switchTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + id).classList.remove('hidden');
    if(event) event.currentTarget.classList.add('active');
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
