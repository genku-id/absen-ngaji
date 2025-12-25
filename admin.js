import { db } from "./firebase-config.js";
import { doc, getDoc, setDoc, collection, query, where, getDocs, writeBatch, serverTimestamp, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.loginAdmin = () => {
    const pin = prompt("Kode Admin:");
    if(pin === "1234") { 
        sessionStorage.setItem('role', 'admin'); 
        location.reload(); 
    } else if(pin !== null) {
        alert("PIN Salah!");
    }
};

window.logout = () => {
    localStorage.removeItem('akun_aktif');
    sessionStorage.removeItem('role');
    location.reload();
};

window.createNewEvent = async () => {
    const n = document.getElementById('ev-nama').value;
    const t = document.getElementById('ev-tgl').value;
    const j = document.getElementById('ev-jam').value;
    if(!n || !t || !j) return alert("Lengkapi data!");
    await setDoc(doc(db, "settings", "event_aktif"), { id: "EVT-"+Date.now(), status: "OPEN", nama: n, tanggal: t, jam: j });
    location.reload();
};

window.closeEvent = async () => {
    const btn = document.getElementById('btn-tutup-event');
    if(!confirm("Tutup & Hitung Alfa?")) return;
    
    btn.innerText = "⏳ Memproses 400 Data...";
    btn.disabled = true;

    try {
        const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
        const cur = evSnap.data();
        const masterSn = await getDocs(collection(db, "master_jamaah"));
        const absenSn = await getDocs(query(collection(db, "attendance"), where("event", "==", cur.nama)));
        
        const sudah = [];
        absenSn.forEach(d => sudah.push(d.data().nama));

        const batch = writeBatch(db);
        masterSn.forEach(docM => {
            if(!sudah.includes(docM.data().nama)) {
                batch.set(doc(collection(db, "attendance")), { ...docM.data(), tipe: "ALFA", event: cur.nama, timestamp: serverTimestamp() });
            }
        });

        await batch.commit();
        await setDoc(doc(db, "settings", "event_aktif"), { status: "CLOSED" });
        alert("Berhasil!");
        location.reload();
    } catch (e) {
        alert("Error: " + e.message);
        btn.disabled = false;
        btn.innerText = "TUTUP & HITUNG ALFA";
    }
};

// Pemicu tampilan saat halaman dimuat
window.addEventListener('DOMContentLoaded', async () => {
    const role = sessionStorage.getItem('role');
    const aktif = localStorage.getItem('akun_aktif');
    
    if(role === 'admin') {
        document.getElementById('admin-section').classList.remove('hidden');
    } else if(aktif) {
        document.getElementById('peserta-section').classList.remove('hidden');
    } else {
        document.getElementById('pilih-akun-section').classList.remove('hidden');
    }
});
