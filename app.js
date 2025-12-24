import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, onSnapshot, query, orderBy, serverTimestamp, getDocs, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDC6EeqCSBHbcDU6ZGWxNhMICeFsnq3YhE",
    authDomain: "absen-ngaji-ku.firebaseapp.com",
    projectId: "absen-ngaji-ku",
    storageBucket: "absen-ngaji-ku.firebasestorage.app",
    messagingSenderId: "347716479254",
    appId: "1:347716479254:web:5875fa7c314c92c08fc837"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// NAV LOGIC
window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
};

window.loginAdmin = () => {
    const pass = prompt("Kode Admin:");
    if(pass === "1234") { sessionStorage.setItem('role', 'admin'); location.reload(); }
};

window.logout = () => {
    localStorage.removeItem('akun_aktif');
    sessionStorage.removeItem('role');
    location.reload();
};

// PROFILE LOGIC
window.saveProfile = () => {
    const nama = document.getElementById('p-nama').value;
    const kelompok = document.getElementById('p-kelompok').value;
    const desa = document.getElementById('p-desa').value;
    if(!nama || !kelompok || !desa) return alert("Lengkapi data!");
    let daftar = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    const baru = { nama, kelompok, desa, id: Date.now() };
    daftar.push(baru);
    localStorage.setItem('daftar_akun', JSON.stringify(daftar));
    window.pilihAkun(baru.id);
};

window.pilihAkun = (id) => {
    let daftar = JSON.parse(localStorage.getItem('daftar_akun'));
    localStorage.setItem('akun_aktif', JSON.stringify(daftar.find(a => a.id == id)));
    location.reload();
};

window.hapusAkun = (id) => {
    if(confirm("Hapus akun?")) {
        let d = JSON.parse(localStorage.getItem('daftar_akun')).filter(a => a.id != id);
        localStorage.setItem('daftar_akun', JSON.stringify(d));
        location.reload();
    }
};

// ADMIN: EVENT & QR LOGIC
window.createNewEvent = async () => {
    const nama = document.getElementById('ev-nama').value;
    const tgl = document.getElementById('ev-tgl').value;
    if(!nama || !tgl) return alert("Isi Nama & Tanggal!");
    
    const eventID = "EVT-" + Date.now();
    await setDoc(doc(db, "settings", "event_aktif"), { id: eventID, status: "OPEN", nama, tgl });
    
    document.getElementById('qr-area').classList.remove('hidden');
    
    // Generate QR Kotak Sempurna
    QRCode.toCanvas(document.getElementById('canvas-absen'), eventID + "|HADIR", { width: 300, margin: 2 });
    QRCode.toCanvas(document.getElementById('canvas-izin'), eventID + "|IZIN", { width: 300, margin: 2 });
};

window.closeEvent = async () => {
    await setDoc(doc(db, "settings", "event_aktif"), { status: "CLOSED" });
    alert("QR dinonaktifkan!");
    location.reload();
};

// DOWNLOAD & FULLSCREEN
window.showFullQR = (canvasID, title) => {
    const fullDiv = document.getElementById('full-qr-modal');
    const source = document.getElementById(canvasID);
    const target = document.getElementById('full-canvas');
    
    document.getElementById('full-title').innerText = title;
    fullDiv.classList.remove('hidden');
    
    // Ambil teks dari canvas asli (id event + tipe)
    const context = source.getContext('2d');
    QRCode.toCanvas(target, source.toDataURL(), { width: 600 }); 
    // Re-render untuk kualitas HD di fullscreen
    const eventData = source.title; 
    QRCode.toCanvas(target, eventData, { width: 800, margin: 2 });
};

window.downloadQR = () => {
    const canvas = document.getElementById('full-canvas');
    const link = document.createElement('a');
    link.download = 'QR_Absen_Ngaji.png';
    link.href = canvas.toDataURL();
    link.click();
};

// SCAN LOGIC
let isProcessing = false;
window.startScanner = () => {
    const scanner = new Html5Qrcode("reader");
    scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (text) => {
        if(isProcessing) return;
        isProcessing = true;
        
        const [evtID, tipe] = text.split("|");
        const akun = JSON.parse(localStorage.getItem('akun_aktif'));

        const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
        if(!evSnap.exists() || evSnap.data().status !== "OPEN" || evSnap.data().id !== evtID) {
            alert("QR Code EXPIRED / Absen ditutup!");
            isProcessing = false;
            return;
        }

        // Anti-Double Scan (Cek 1 jam terakhir)
        const satuJamLalu = new Date(Date.now() - 3600000);
        const q = query(collection(db, "attendance"), 
            where("nama", "==", akun.nama),
            where("timestamp", ">", satuJamLalu)
        );
        const hit = await getDocs(q);
        
        if(!hit.empty) {
            alert("Anda sudah absen/izin baru-baru ini!");
            scanner.stop();
            isProcessing = false;
            return;
        }

        try {
            await addDoc(collection(db, "attendance"), { 
                ...akun, tipe, event_nama: evSnap.data().nama, timestamp: serverTimestamp() 
            });
            document.getElementById('scan-result').innerHTML = "✅ BERHASIL!";
            scanner.stop();
        } catch (e) { alert("Gagal!"); }
        isProcessing = false;
    });
};

window.loadReports = () => {
    const q = query(collection(db, "attendance"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('report-list');
        list.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            list.innerHTML += `<li>[${data.tipe}] ${data.nama}</li>`;
        });
    });
};

window.downloadExcel = async () => {
    const snap = await getDocs(collection(db, "attendance"));
    let rows = []; snap.forEach(d => rows.push(d.data()));
    rows.sort((a,b) => a.desa.localeCompare(b.desa) || a.kelompok.localeCompare(b.kelompok));
    let csv = "data:text/csv;charset=utf-8,\uFEFFDesa,Kelompok,Nama,Tipe,Waktu\n";
    rows.forEach(r => {
        const t = r.timestamp ? new Date(r.timestamp.seconds*1000).toLocaleString() : "";
        csv += `"${r.desa}","${r.kelompok}","${r.nama}","${r.tipe}","${t}"\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI(csv); link.download = "rekap.csv"; link.click();
};
