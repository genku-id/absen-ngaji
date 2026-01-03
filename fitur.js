// Fungsi untuk memformat angka ke Rupiah saat mengetik
window.formatRupiah = (input) => {
    let value = input.value.replace(/[^,\d]/g, '').toString();
    let split = value.split(',');
    let sisa = split[0].length % 3;
    let rupiah = split[0].substr(0, sisa);
    let ribuan = split[0].substr(sisa).match(/\d{3}/gi);
    if (ribuan) {
        let separator = sisa ? '.' : '';
        rupiah += separator + ribuan.join('.');
    }
    rupiah = split[1] !== undefined ? rupiah + ',' + split[1] : rupiah;
    input.value = rupiah;
};

// Fungsi untuk menampilkan Modal Shodaqoh
window.tampilkanModalShodaqoh = (callback) => {
    // Buat elemen modal
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'modal-shodaqoh';
    modal.innerHTML = `
        <div class="card" style="max-width:400px; text-align:center; padding:30px;">
            <h2 style="margin-top:0; color:#0056b3;">Infaq / Shodaqoh</h2>
            <p style="font-size:14px; color:#666;">Silakan masukkan nominal (opsional):</p>
            <div style="position:relative; margin:20px 0;">
                <span style="position:absolute; left:15px; top:14px; font-weight:bold;">Rp</span>
                <input type="text" id="input-shodaqoh" 
                    style="padding-left:45px; font-size:20px; font-weight:bold; color:#28a745;" 
                    placeholder="0" 
                    oninput="window.formatRupiah(this)"
                    inputmode="numeric">
            </div>
            <button id="btn-konfirmasi-shodaqoh" class="primary-btn" style="background:#28a745;">KONFIRMASI & LANJUT</button>
            <button id="btn-skip-shodaqoh" style="background:none; border:none; color:#888; margin-top:15px; cursor:pointer;">Lewati / Nanti saja</button>
        </div>
    `;
    document.body.appendChild(modal);
    const input = document.getElementById('input-shodaqoh');
    const btnOk = document.getElementById('btn-konfirmasi-shodaqoh');
    const btnSkip = document.getElementById('btn-skip-shodaqoh');
    // Fokuskan ke input secara otomatis
    setTimeout(() => input.focus(), 300);
    const kirimData = (nominal) => {
        document.body.removeChild(modal);
        callback(nominal); // Kirim nominal balik ke prosesAbsensi
    };
    btnOk.onclick = () => {
        const nominalBersih = parseInt(input.value.replace(/\./g, '')) || 0;
        kirimData(nominalBersih);
    };
    btnSkip.onclick = () => kirimData(0);
};
