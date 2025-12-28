// admin-logic.js

const dataWilayah = {
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"]
};

// Fungsi agar teks tombol berubah dan dropdown kelompok aktif
window.updateTeksTombolAdmin = () => {
    const selDesa = document.getElementById('sel-desa');
    const selKelompok = document.getElementById('sel-kelompok');
    const btn = document.getElementById('btn-konfirmasi-admin');
    
    const desaTerpilih = selDesa.value;

    // 1. Reset isi kelompok dulu
    selKelompok.innerHTML = '<option value="">-- Pilih Kelompok (Kosongkan jika Desa) --</option>';

    if (desaTerpilih === "") {
        // Jika desa kosong -> Admin Daerah
        selKelompok.disabled = true;
        btn.innerText = "MASUK SEBAGAI ADMIN DAERAH";
        btn.style.background = "#2196F3"; 
    } else {
        // Jika desa dipilih -> Aktifkan dropdown kelompok
        selKelompok.disabled = false;
        
        // Isi daftar kelompok sesuai desa
        const daftarKelompok = dataWilayah[desaTerpilih] || [];
        daftarKelompok.forEach(klp => {
            const opt = document.createElement('option');
            opt.value = klp;
            opt.innerText = klp;
            selKelompok.appendChild(opt);
        });

        // 2. Cek apakah kelompok sudah dipilih untuk tentukan teks tombol
        if (selKelompok.value === "") {
            btn.innerText = `MASUK SEBAGAI ADMIN DESA ${desaTerpilih}`;
            btn.style.background = "#4CAF50"; // Hijau
        } else {
            btn.innerText = `MASUK SEBAGAI ADMIN KELOMPOK ${selKelompok.value}`;
            btn.style.background = "#FF9800"; // Oranye
        }
    }
};

// Fungsi saat tombol "MASUK SEBAGAI..." diklik
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

    // Simpan ke memori aplikasi
    window.currentAdmin = { role, wilayah };
    
    // Tutup modal
    document.getElementById('modal-pilih-admin').style.display = 'none';
    
    // Buka Panel Admin yang ada di app.js
    if(typeof window.bukaPanelAdmin === 'function') {
        window.bukaPanelAdmin();
    } else {
        // Jika bukaPanelAdmin bukan window function, panggil langsung
        bukaPanelAdmin();
    }
};
