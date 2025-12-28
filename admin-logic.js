// 1. Data Mapping Desa dan Kelompok
const dataWilayah = {
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"]
};

// 2. Fungsi untuk merubah teks tombol & update dropdown kelompok
window.updateTeksTombolAdmin = () => {
    const selDesa = document.getElementById('sel-desa');
    const selKelompok = document.getElementById('sel-kelompok');
    const btn = document.getElementById('btn-konfirmasi-admin');
    
    const desaTerpilih = selDesa.value;
    const kelompokTerpilih = selKelompok.value;

    // KOSONGKAN & RESET KELOMPOK
    selKelompok.innerHTML = '<option value="">-- Pilih Kelompok --</option>';

    if (desaTerpilih === "") {
        // Mode ADMIN DAERAH
        selKelompok.disabled = true;
        btn.innerText = "MASUK SEBAGAI ADMIN DAERAH";
        btn.style.background = "#2196F3"; // Biru
    } else {
        // Aktifkan dropdown kelompok
        selKelompok.disabled = false;
        
        // Isi dropdown kelompok sesuai desa yang dipilih
        const daftarKelompok = dataWilayah[desaTerpilih] || [];
        daftarKelompok.forEach(klp => {
            const opt = document.createElement('option');
            opt.value = klp;
            opt.innerText = klp;
            selKelompok.appendChild(opt);
        });

        // Kembalikan nilai kelompok yang tadi (jika ada)
        selKelompok.value = kelompokTerpilih;

        // CEK TEKS TOMBOL
        if (selKelompok.value === "") {
            btn.innerText = `MASUK SEBAGAI ADMIN DESA ${desaTerpilih}`;
            btn.style.background = "#4CAF50"; // Hijau
        } else {
            btn.innerText = `MASUK SEBAGAI ADMIN KELOMPOK ${selKelompok.value}`;
            btn.style.background = "#FF9800"; // Oranye
        }
    }
};

// Fungsi saat tombol diklik (Tetap sama)
window.konfirmasiMasukAdmin = () => {
    const desa = document.getElementById('sel-desa').value;
    const kelompok = document.getElementById('sel-kelompok').value;
    
    let role = "DAERAH";
    let wilayah = "SEMUA";

    if (desa !== "") {
        role = "DESA";
        wilayah = desa;
    }
    if (kelompok !== "") {
        role = "KELOMPOK";
        wilayah = kelompok;
    }

    window.currentAdmin = { role, wilayah };
    document.getElementById('modal-pilih-admin').style.display = 'none';
    alert(`Akses Diterima: Admin ${role} ${wilayah}`);
    
    if(typeof bukaAdmin === 'function') bukaAdmin();
};
