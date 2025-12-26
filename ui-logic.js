export const WILAYAH = {
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"]
};

window.masterCache = [];

// ui-logic.js

// Fungsi Buka/Tutup Sidebar
window.toggleSidebar = () => {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('overlay');
    if (sb && ov) {
        sb.classList.toggle('active');
        ov.classList.toggle('active');
    }
};

// Fungsi Ganti Tab di Dashboard Admin
window.switchTab = (tabName) => {
    // Sembunyikan semua isi tab
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.add('hidden');
    });
    
    // Matikan semua tombol tab (hapus warna biru/aktif)
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Tampilkan tab yang dipilih
    const targetTab = document.getElementById('tab-' + tabName);
    if (targetTab) {
        targetTab.classList.remove('hidden');
    }
    
    // Kasih warna aktif ke tombol yang diklik
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    // Khusus kalau buka tab laporan, jalankan fungsi filter otomatis
    if (tabName === 'laporan' && window.filterLaporan) {
        window.filterLaporan();
    }
};

// Tutup sidebar otomatis kalau layar diklik di luar area sidebar
window.addEventListener('click', (e) => {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('overlay');
    if (e.target === ov) {
        window.toggleSidebar();
    }
});
