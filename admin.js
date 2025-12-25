import { db } from "./firebase-config.js";
import { doc, setDoc, getDoc, collection, onSnapshot, query, orderBy, serverTimestamp, getDocs, where, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Tempelkan fungsi ke window agar tombol di HTML bisa memanggilnya
window.loginAdmin = () => {
    if(prompt("Kode Admin:") === "1234") { 
        sessionStorage.setItem('role', 'admin'); 
        location.reload(); 
    }
};

window.logout = () => {
    localStorage.removeItem('akun_aktif');
    sessionStorage.removeItem('role');
    location.reload();
};

window.closeEvent = async () => {
    const btn = event.currentTarget;
    if(!confirm("Tutup absen & hitung ALFA?")) return;
    
    btn.innerText = "⏳ Memproses 400 Data...";
    btn.disabled = true;

    try {
        const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
        const currentEvent = evSnap.data();
        const masterSn = await getDocs(collection(db, "master_jamaah"));
        const absenSn = await getDocs(query(collection(db, "attendance"), where("event", "==", currentEvent.nama)));
        
        const sudahAbsen = [];
        absenSn.forEach(d => sudahAbsen.push(d.data().nama));

        const batch = writeBatch(db);
        masterSn.forEach(docM => {
            const m = docM.data();
            if(!sudahAbsen.includes(m.nama)) {
                batch.set(doc(collection(db, "attendance")), { ...m, tipe: "ALFA", event: currentEvent.nama, timestamp: serverTimestamp() });
            }
        });

        await batch.commit();
        await setDoc(doc(db, "settings", "event_aktif"), { status: "CLOSED" });
        alert("Selesai!");
        location.reload();
    } catch (e) {
        alert("Error: " + e.message);
        btn.disabled = false;
    }
};

// Panggil laporan jika sedang login admin
if(sessionStorage.getItem('role') === 'admin') {
    window.addEventListener('load', () => {
        const cont = document.getElementById('report-list-cont');
        if(cont) {
            onSnapshot(query(collection(db, "attendance"), orderBy("timestamp", "desc")), (sn) => {
                cont.innerHTML = "";
                sn.forEach(doc => {
                    const r = doc.data();
                    cont.innerHTML += `<div class="report-item"><b>${r.nama}</b><span>${r.tipe}</span></div>`;
                });
            });
        }
    });
}
