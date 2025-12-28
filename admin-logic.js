// admin-logic.js

const dataWilayah = {
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"]
};

window.updateTeksTombolAdmin = () => {
    const selDesa = document.getElementById('sel-desa');
    const selKelompok = document.getElementById('sel-kelompok');
    const btn = document.getElementById('btn-konfirmasi-admin');
    
    const desaTerpilih = selDesa.value;
    const kelompokTerpilih = selKelompok.value;

    // Jika desa baru saja diganti (belum ada kelompok yang dipilih sebelumnya dari list baru)
    if (desaTerpilih === "") {
        selKelompok.innerHTML = '<option value="">-- Pilih Kelompok --</option>';
        selKelompok.disabled = true;
        btn.innerText = "MASUK SEBAGAI ADMIN DAERAH";
        btn.style.background = "#2196F3"; 
    } else {
        selKelompok.disabled = false;
        
        // Hanya isi ulang list kelompok jika listnya masih kosong (mencegah loop saat pilih kelompok)
        if (selKelompok.options.length <= 1) {
            selKelompok.innerHTML = '<option value="">-- Pilih Kelompok --</option>';
            const daftarKelompok = dataWilayah[desaTerpilih] || [];
            daftarKelompok.forEach(klp => {
                const opt = document.createElement('option');
                opt.value = klp;
                opt.innerText = klp;
                selKelompok.appendChild(opt);
            });
        }

        // UPDATE TEKS TOMBOL SECARA DINAMIS
        if (selKelompok.value === "") {
            btn.innerText = `MASUK SEBAGAI ADMIN DESA ${desaTerpilih}`;
            btn.style.background = "#2196F3"; 
        } else {
            btn.innerText = `MASUK SEBAGAI ADMIN KELOMPOK ${selKelompok.value}`;
            btn.style.background = "#2196F3"; 
        }
    }
};

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
    selDesa.value = ""; // Reset Desa ke pilihan awal
    selKelompok.innerHTML = '<option value="">-- Pilih Kelompok --</option>'; // Kosongkan list kelompok
    selKelompok.disabled = true; // Kunci kembali dropdown kelompok
    
    // Reset tombol ke tampilan Admin Daerah (Biru)
    const btn = document.getElementById('btn-konfirmasi-admin');
    btn.innerText = "MASUK SEBAGAI ADMIN DAERAH";
    btn.style.background = "#2196F3";
    // -----------------------------------------

    // Tutup modal
    document.getElementById('modal-pilih-admin').style.display = 'none';
    
    alert(`Akses Diterima: Admin ${role} ${wilayah}`);
    
    if (typeof window.bukaPanelAdmin === 'function') {
        window.bukaPanelAdmin();
    }
};
