import { db } from "./firebase-config.js";
import { doc, setDoc, getDoc, addDoc, collection, onSnapshot, query, orderBy, serverTimestamp, getDocs, where, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Load Laporan Otomatis
window.loadReports = () => {
    const cont = document.getElementById('report-list-cont');
    if(!cont) return;
    onSnapshot(query(collection(db, "attendance"), orderBy("timestamp", "desc")), (sn) => {
        cont.innerHTML = "";
        const unique = new Set();
        sn.forEach(doc => {
            const r = doc.data();
            if(!unique.has(r.nama)) {
                unique.add(r.nama);
                cont.innerHTML += `<div class="report-item"><span><b>${r.nama}</b><br><small>${r.desa} - ${r.kelompok}</small></span><span class="status-tag tag-${r.tipe.toLowerCase()}">${r.tipe}</span></div>`;
            }
        });
    });
};

// Tutup Event & Hitung Alfa (Optimasi 400 data)
window.closeEvent = async () => {
    const btn = event.currentTarget;
    if(!confirm("Tutup absen & hitung ALFA?")) return;
    
    // Indikator Loading agar tidak terasa lelet
    const originalText = btn.innerText;
    btn.innerText = "⏳ Memproses Data... Mohon Tunggu";
    btn.disabled = true;
    btn.style.background = "#bdc3c7";

    try {
        const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
        const currentEvent = evSnap.data();
        const masterSn = await getDocs(collection(db, "master_jamaah"));
        const absenSn = await getDocs(query(collection(db, "attendance"), where("event", "==", currentEvent.nama)));
        
        const sudahAbsen = [];
        absenSn.forEach(d => sudahAbsen.push(d.data().nama));

        const batch = writeBatch(db);
        let count = 0;
        
        masterSn.forEach(docM => {
            const m = docM.data();
            if(!sudahAbsen.includes(m.nama)) {
                batch.set(doc(collection(db, "attendance")), { ...m, tipe: "ALFA", event: currentEvent.nama, timestamp: serverTimestamp() });
                count++;
            }
        });

        await batch.commit();
        await setDoc(doc(db, "settings", "event_aktif"), { status: "CLOSED" });
        alert(`Berhasil! ${count} jamaah ditandai ALFA.`);
        location.reload();
    } catch (e) {
        alert("Error: " + e.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// Fungsi Reset & Download
window.resetLaporan = async () => {
    if(confirm("Hapus semua laporan hari ini?")) {
        const sn = await getDocs(collection(db, "attendance"));
        const batch = writeBatch(db);
        sn.forEach(d => batch.delete(d.ref));
        await batch.commit();
        location.reload();
    }
};

window.loadReports(); // Jalankan laporan saat file dimuat
