import { db } from "./firebase-config.js";
import { getDoc, doc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.addEventListener('load', async () => {
    try {
        const role = sessionStorage.getItem('role');
        const aktif = localStorage.getItem('akun_aktif');
        const daftar = JSON.parse(localStorage.getItem('daftar_akun')) || [];

        // Sembunyikan semua section
        document.querySelectorAll('.card, .tab-content').forEach(c => c.classList.add('hidden'));

        if (role === 'admin') {
            document.getElementById('admin-section').classList.remove('hidden');
            document.getElementById('tab-event').classList.remove('hidden');
            
            // Panggil filter laporan otomatis jika fungsinya sudah ada
            if (window.filterLaporan) window.filterLaporan();
            
            const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
            if (evSnap.exists() && evSnap.data().status === "OPEN") {
                document.getElementById('setup-box').classList.add('hidden');
                document.getElementById('qr-box').classList.remove('hidden');
                
                // Jeda 1 detik agar canvas siap digambar
                setTimeout(() => {
                    if (window.generateAllQR) {
                        window.generateAllQR(evSnap.data().id);
                    }
                }, 1000);
            }
        } else if (aktif) {
            document.getElementById('peserta-section').classList.remove('hidden');
        } else if (daftar.length > 0) {
            document.getElementById('pilih-akun-section').classList.remove('hidden');
            renderDaftarAkun(daftar);
        } else {
            document.getElementById('modal-tambah').classList.remove('hidden');
        }
    } catch (e) { console.error("Error Load:", e); }
});

function renderDaftarAkun(daftar) {
    const cp = document.getElementById('list-akun-pilihan');
    if (!cp) return;
    cp.innerHTML = "";
    daftar.forEach(x => {
        cp.innerHTML += `
        <div style="display:flex; gap:8px; margin-bottom:12px; align-items:center;">
            <button onclick="pilihAkun('${x.id}')" class="btn-pilih-akun">👤 ${x.nama}</button>
            <button onclick="hapusAkunLokal('${x.id}')" style="width:50px; height:50px; background:#ff4757; color:white; border-radius:10px; border:none; font-weight:bold; cursor:pointer;">X</button>
        </div>`;
    });
}
