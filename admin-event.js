import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- FUNGSI 1: MEMBUAT EVENT BARU ---
window.createNewEvent = async () => {
    const n = document.getElementById('ev-nama').value.trim();
    const t = document.getElementById('ev-tgl').value;
    const j = document.getElementById('ev-jam').value;
    
    if(!n || !t || !j) return alert("Mohon lengkapi Nama Acara, Tanggal, dan Jam!");
    
    try {
        const eventID = "EVT-" + Date.now();
        await setDoc(doc(db, "settings", "event_aktif"), { 
            id: eventID, 
            status: "OPEN", 
            nama: n, 
            tanggal: t, 
            jam: j 
        });
        
        alert("Event Berhasil Diaktifkan! QR Code akan segera muncul.");
        location.reload(); 
    } catch (e) {
        alert("Gagal mengaktifkan event: " + e.message);
    }
};

// --- FUNGSI 2: GENERATOR QR CODE ---
window.generateAllQR = (eventID) => {
    const cAbsen = document.getElementById('canvas-absen');
    const cIzin = document.getElementById('canvas-izin');
    
    if (typeof QRCode !== 'undefined' && cAbsen && cIzin) {
        // Render QR Hadir
        QRCode.toCanvas(cAbsen, eventID + "|HADIR", { width: 250, margin: 2 }, (error) => {
            if (error) console.error(error);
        });
        // Render QR Izin
        QRCode.toCanvas(cIzin, eventID + "|IZIN", { width: 250, margin: 2 }, (error) => {
            if (error) console.error(error);
        });
    }
};

// --- FUNGSI 3: TUTUP EVENT & AUTO ALFA ---
window.closeEvent = async () => {
    const btn = document.getElementById('btn-tutup-event');
    if(!confirm("Yakin ingin menutup absen? Jamaah yang belum scan akan otomatis ditandai ALFA.")) return;
    
    btn.innerText = "⏳ Memproses Data... Mohon Tunggu";
    btn.disabled = true;

    try {
        const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
        if (!evSnap.exists()) throw new Error("Tidak ada event aktif.");
        const cur = evSnap.data();

        // Ambil data master dan data yang sudah absen
        const [masterSn, absenSn] = await Promise.all([
            getDocs(collection(db, "master_jamaah")),
            getDocs(query(collection(db, "attendance"), where("event", "==", cur.nama)))
        ]);
        
        const sudahAbsen = absenSn.docs.map(d => d.data().nama);
        const batch = writeBatch(db);
        let jumlahAlfa = 0;

        masterSn.forEach(docM => {
            const dataMaster = docM.data();
            if(!sudahAbsen.includes(dataMaster.nama)) {
                const newRef = doc(collection(db, "attendance"));
                batch.set(newRef, { 
                    ...dataMaster, 
                    tipe: "ALFA", 
                    event: cur.nama, 
                    timestamp: serverTimestamp() 
                });
                jumlahAlfa++;
            }
        });

        await batch.commit();
        await setDoc(doc(db, "settings", "event_aktif"), { status: "CLOSED" });
        
        alert(`Berhasil! Absen ditutup dan ${jumlahAlfa} jamaah otomatis ALFA.`);
        location.reload();
    } catch (e) {
        alert("Gagal menutup event: " + e.message);
        btn.innerText = "TUTUP & HITUNG ALFA";
        btn.disabled = false;
    }
};

// --- FUNGSI PENDUKUNG: DOWNLOAD QR ---
window.downloadQR = (canvasId, fileName) => {
    const canvas = document.getElementById(canvasId);
    const link = document.createElement('a');
    link.download = fileName + '.png';
    link.href = canvas.toDataURL("image/png");
    link.click();
};
