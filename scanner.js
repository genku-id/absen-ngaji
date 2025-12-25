import { db } from "./firebase-config.js";
import { doc, getDoc, addDoc, collection, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.startScanner = () => {
    const sc = new Html5Qrcode("reader");
    let isProcessing = false;
    
    sc.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (text) => {
        if (isProcessing) return;
        isProcessing = true;

        const [eid, tipe] = text.split("|");
        const akun = JSON.parse(localStorage.getItem('akun_aktif'));
        const ev = await getDoc(doc(db, "settings", "event_aktif"));

        if(!ev.exists() || ev.data().status !== "OPEN" || ev.data().id !== eid) {
            alert("QR EXPIRED!"); location.reload(); return;
        }

        const qCheck = query(collection(db, "attendance"), where("event", "==", ev.data().nama), where("nama", "==", akun.nama));
        const check = await getDocs(qCheck);
        if(!check.empty) { alert("Sudah Absen!"); location.reload(); return; }

        let st = tipe;
        if(tipe === "HADIR") {
            const tm = new Date(ev.data().tanggal + "T" + ev.data().jam);
            if(new Date() > new Date(tm.getTime() + 5*60000)) st = "TERLAMBAT";
        }

        await addDoc(collection(db, "attendance"), { ...akun, tipe: st, event: ev.data().nama, timestamp: serverTimestamp() });
        
        document.getElementById('success-msg').classList.remove('hidden');
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 6000 });

        sc.stop().then(() => {
            setTimeout(() => location.reload(), 3000);
        });
    });
};
