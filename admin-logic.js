// admin-logic.js
window.updateTeksTombolAdmin = () => {
    const desa = document.getElementById('sel-desa').value;
    const kelompok = document.getElementById('sel-kelompok').value;
    const btn = document.getElementById('btn-konfirmasi-admin');
    const inputKelompok = document.getElementById('sel-kelompok');

    // Aturan: Kelompok hanya bisa dipilih jika Desa sudah ada isinya
    if (desa === "") {
        inputKelompok.disabled = true;
        inputKelompok.value = ""; // reset kelompok jika desa dikosongkan
        btn.innerText = "MASUK SEBAGAI ADMIN DAERAH";
        btn.style.background = "#2196F3"; 
    } else {
        inputKelompok.disabled = false;
        
        if (kelompok === "") {
            btn.innerText = `MASUK SEBAGAI ADMIN DESA ${desa}`;
            btn.style.background = "#2196F3";
        } else {
            btn.innerText = `MASUK SEBAGAI ADMIN KELOMPOK ${kelompok}`;
            btn.style.background = "#2196F3"; 
        }
    }
};

// Fungsi saat tombol diklik
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

    // Simpan identitas admin di memori aplikasi
    window.currentAdmin = { role, wilayah };
    
    document.getElementById('modal-pilih-admin').style.display = 'none';
    alert(`Akses Diterima: Admin ${role} ${wilayah}`);
    
    // Panggil fungsi utama admin di app.js
    if(typeof bukaAdmin === 'function') {
        bukaAdmin();
    }
};
