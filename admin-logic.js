window.updateTeksTombolAdmin = () => {
    const desa = document.getElementById('sel-desa').value;
    const kelompok = document.getElementById('sel-kelompok').value;
    const btn = document.getElementById('btn-konfirmasi-admin');

    if (desa === "") {
        btn.innerText = "MASUK SEBAGAI ADMIN DAERAH";
        btn.style.background = "#2196F3"; // Biru
    } else if (kelompok === "") {
        btn.innerText = `MASUK SEBAGAI ADMIN DESA ${desa}`;
        btn.style.background = "#4CAF50"; // Hijau
    } else {
        btn.innerText = `MASUK SEBAGAI ADMIN KELOMPOK ${kelompok}`;
        btn.style.background = "#FF9800"; // Oranye
    }
};

window.konfirmasiMasukAdmin = () => {
    const desa = document.getElementById('sel-desa').value;
    const kelompok = document.getElementById('sel-kelompok').value;
    
    // Tentukan Role dan Wilayah
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

    // Simpan di memori aplikasi
    window.currentAdmin = { role, wilayah };
    
    // Tutup modal dan buka panel admin
    document.getElementById('modal-pilih-admin').style.display = 'none';
    alert(`Mode Admin Aktif: ${role} - ${wilayah}`);
    
    // Panggil fungsi bukaAdmin yang ada di app.js kamu
    if(typeof bukaAdmin === 'function') bukaAdmin();
};

window.tutupModalAdmin = () => {
    document.getElementById('modal-pilih-admin').style.display = 'none';
};
