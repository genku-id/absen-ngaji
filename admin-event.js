import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// EXPOSE KE WINDOW AGAR BISA DIPANGGIL ONCLICK
window.createNewEvent = async () => {
    const n = document.getElementById('ev-nama').value.trim();
    const t = document.getElementById('ev-tgl').value;
    const j = document.getElementById('ev-jam').value;
    
    if(!n || !t || !j) return alert("Lengkapi Nama, Tanggal, dan Jam!");
    
    try {
        const eventID = "EVT-" + Date.now();
        await setDoc(doc(db, "settings", "event_aktif"), { 
            id: eventID, status: "OPEN", nama: n, tanggal: t, jam: j 
        });
        alert("Event Berhasil Diaktifkan!");
        location.reload(); 
    } catch (e) {
        alert("Error: " + e.message);
    }
};

window.generateAllQR = (eventID) => {
    const cAbsen = document.getElementById('canvas-absen');
    const cIzin = document.getElementById('canvas-izin');
    
    if (typeof QRCode !== 'undefined' && cAbsen && cIzin) {
        QRCode.toCanvas(cAbsen, eventID + "|HADIR", { width: 250, margin: 2 });
        QRCode.toCanvas(cIzin, eventID + "|IZIN", { width: 250, margin: 2 });
    }
};

window.closeEvent = async () => {
    const btn = document.getElementById('btn-tutup-event');
    if(!confirm("Tutup absen & hitung ALFA?")) return;
    
    btn.innerText = "⏳ Memproses...";
    btn.disabled = true;

    try {
        const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
        const cur = evSnap.data();

        const [mSn, aSn] = await Promise.all([
            getDocs(collection(db, "master_jamaah")),
            getDocs(query(collection(db, "attendance"), where("event", "==", cur.nama)))
        ]);
        
        const sudah = aSn.docs.map(d => d.data().nama);
        const batch = writeBatch(db);
        let c = 0;

        mSn.forEach(docM => {
            if(!sudah.includes(docM.data().nama)) {
                batch.set(doc(collection(db, "attendance")), { 
                    ...docM.data(), tipe: "ALFA", event: cur.nama, timestamp: serverTimestamp() 
                });
                c++;
            }
        });

        await batch.commit();
        await setDoc(doc(db, "settings", "event_aktif"), { status: "CLOSED" });
        alert(`Selesai! ${c} jamaah ALFA.`);
        location.reload();
    } catch (e) {
        alert(e.message);
        btn.disabled = false;
    }
};

window.downloadQR = (canvasId, fileName) => {
    const canvas = document.getElementById(canvasId);
    const link = document.createElement('a');
    link.download = fileName + '.png';
    link.href = canvas.toDataURL("image/png");
    link.click();
};
