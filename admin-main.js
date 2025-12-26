import { db } from "./firebase-config.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.addEventListener('DOMContentLoaded', async () => {
    const role = sessionStorage.getItem('role');
    if(role === 'admin') {
        document.getElementById('admin-section').classList.remove('hidden');
        
        // Panggil fungsi dari file lain
        if(window.filterLaporan) window.filterLaporan();
        
        const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
        if (evSnap.exists() && evSnap.data().status === "OPEN") {
            document.getElementById('setup-box').classList.add('hidden');
            document.getElementById('qr-box').classList.remove('hidden');
            setTimeout(() => {
                if(window.generateAllQR) window.generateAllQR(evSnap.data().id);
            }, 1000);
        }
    }
});
