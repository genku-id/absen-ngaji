import { db } from "./firebase-config.js";
import { getDoc, doc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.addEventListener('load', async () => {
    // --- PENDAFTARAN TOMBOL (Agar sidebar & menu jalan) ---
    document.getElementById('btn-menu')?.addEventListener('click', () => window.toggleSidebar());
    document.getElementById('overlay')?.addEventListener('click', () => window.toggleSidebar());
    document.getElementById('btn-login-admin')?.addEventListener('click', () => window.loginAdmin());
    document.getElementById('btn-logout')?.addEventListener('click', () => window.logout());
    document.getElementById('btn-create-event')?.addEventListener('click', () => window.createNewEvent());
    document.getElementById('btn-tutup-event')?.addEventListener('click', () => window.closeEvent());
    document.getElementById('btn-dl-excel')?.addEventListener('click', () => window.downloadExcel());
    document.getElementById('btn-reset-laporan')?.addEventListener('click', () => window.resetLaporan());
    
    // Switch Tab Admin
    document.getElementById('tab-btn-event')?.addEventListener('click', () => window.switchTab('event'));
    document.getElementById('tab-btn-laporan')?.addEventListener('click', () => window.switchTab('laporan'));
    document.getElementById('tab-btn-master')?.addEventListener('click', () => window.switchTab('master'));

    // --- LOGIKA HALAMAN ---
    try {
        const role = sessionStorage.getItem('role');
        const aktif = localStorage.getItem('akun_aktif');

        if (role === 'admin') {
            document.getElementById('admin-section').classList.remove('hidden');
            const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
            
            if (evSnap.exists() && evSnap.data().status === "OPEN") {
                document.getElementById('setup-box').classList.add('hidden');
                document.getElementById('qr-box').classList.remove('hidden');
                
                // Jeda 1 detik agar Barcode digambar
                setTimeout(() => {
                    if (window.generateAllQR) window.generateAllQR(evSnap.data().id);
                }, 1000);
            }
        } else if (!aktif) {
            document.getElementById('modal-tambah').classList.remove('hidden');
        }
    } catch (e) { console.error(e); }
});
