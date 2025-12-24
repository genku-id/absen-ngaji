import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, onSnapshot, query, orderBy, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// PROFILE
window.saveProfile = () => {
    const n = document.getElementById('p-nama').value;
    const d = document.getElementById('p-desa').value;
    const k = document.getElementById('p-kelompok').value;
    if(!n || !d || !k) return alert("Isi semua data!");
    
    let list = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    const id = Date.now();
    list.push({ nama: n, desa: d, kelompok: k, id: id });
    localStorage.setItem('daftar_akun', JSON.stringify(list));
    localStorage.setItem('akun_aktif', JSON.stringify(list.find(x => x.id === id)));
    location.reload();
};

window.pilihAkun = (id) => {
    let list = JSON.parse(localStorage.getItem('daftar_akun'));
    localStorage.setItem('akun_aktif', JSON.stringify(list.find(a => a.id == id)));
    location.reload();
};

window.hapusAkun = (id) => {
    if(confirm("Hapus?")) {
        let d = JSON.parse(localStorage.getItem('daftar_akun')).filter(a => a.id != id);
        localStorage.setItem('daftar_akun', JSON.stringify(d));
        location.reload();
    }
};

// ADMIN PERSISTENCE LOGIC
const checkActiveEvent = async () => {
    const ev = await getDoc(doc(db, "settings", "event_aktif"));
    if(ev.exists() && ev.data().status === "OPEN") {
        document.getElementById('event-setup').classList.add('hidden');
        document.getElementById('qr-area').classList.remove('hidden');
        
        const cA = document.getElementById('canvas-absen');
        const cI = document.getElementById('canvas-izin');
        const txtA = ev.data().id + "|HADIR";
        const txtI = ev.data().id + "|IZIN";
        
        cA.title = txtA; cI.title = txtI;
        QRCode.toCanvas(cA, txtA, { width: 200, margin: 2 });
        QRCode.toCanvas(cI, txtI, { width: 200, margin: 2 });
    }
};

window.createNewEvent = async () => {
    const n = document.getElementById('ev-nama').value;
    const t = document.getElementById('ev-tgl').value;
    const j = document.getElementById('ev-jam').value;
    if(!n || !t || !j) return alert("Lengkapi!");
    const eid = "EVT-" + Date.now();
    await setDoc(doc(db, "settings", "event_aktif"), { id: eid, status: "OPEN", nama: n, jam: j });
    location.reload();
};

window.closeEvent = async () => {
    if(confirm("Tutup absensi sekarang?")) {
        await setDoc(doc(db, "settings", "event_aktif"), { status: "CLOSED" });
        location.reload();
    }
};

window.showFullQR = (cid, title) => {
    const txt = document.getElementById(cid).title;
    document.getElementById('full-title').innerText = title;
    document.getElementById('full-qr-modal').classList.remove('hidden');
    QRCode.toCanvas(document.getElementById('full-canvas'), txt, { width: 600, margin: 2 });
};

window.downloadQR = () => {
    const canvas = document.getElementById('full-canvas');
    const link = document.createElement('a');
    link.download = 'QR_CODE.png';
    link.href = canvas.toDataURL();
    link.click();
};

// SCAN LOGIC
let scanLock = false;
window.startScanner = () => {
    const sc = new Html5Qrcode("reader");
    sc.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (text) => {
        if(scanLock) return;
        scanLock = true;

        const [eid, tipe] = text.split("|");
        const akun = JSON.parse(localStorage.getItem('akun_aktif'));
        const history = JSON.parse(localStorage.getItem('history_absen')) || {};
        
        if(history[akun.id] && Date.now() - history[akun.id] < 3600000) {
            alert("Anda sudah absen baru-baru ini!");
            sc.stop().then(() => location.reload()); return;
        }

        const ev = await getDoc(doc(db, "settings", "event_aktif"));
        if(!ev.exists() || ev.data().status !== "OPEN" || ev.data().id !== eid) {
            alert("QR EXPIRED!");
            sc.stop().then(() => location.reload()); return;
        }

        let st = tipe;
        if(tipe === "HADIR") {
            const [h, m] = ev.data().jam.split(":");
            const limit = new Date(); limit.setHours(h, parseInt(m)+5, 0);
            if(new Date() > limit) st = "TERLAMBAT";
        }

        await addDoc(collection(db, "attendance"), { ...akun, tipe: st, event: ev.data().nama, timestamp: serverTimestamp() });
        history[akun.id] = Date.now();
        localStorage.setItem('history_absen', JSON.stringify(history));
        
        sc.stop().then(() => {
            // CELEBRATION!
            document.getElementById('success-msg').classList.remove('hidden');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 4000 });
            setTimeout(() => { location.reload(); }, 3500);
        });
    });
};

window.loadReports = () => {
    onSnapshot(query(collection(db, "attendance"), orderBy("timestamp", "desc")), (sn) => {
        const l = document.getElementById('report-list'); l.innerHTML = "";
        sn.forEach(d => { l.innerHTML += `<li>[${d.data().tipe}] ${d.data().nama}</li>`; });
    });
};

window.downloadExcel = async () => {
    const sn = await getDocs(collection(db, "attendance"));
    let rows = []; sn.forEach(d => rows.push(d.data()));
    rows.sort((a,b) => (a.desa || "").localeCompare(b.desa || "") || (a.kelompok || "").localeCompare(b.kelompok || ""));
    let csv = "data:text/csv;charset=utf-8,\uFEFFDesa,Kelompok,Nama,Status,Waktu\n";
    rows.forEach(r => {
        const t = r.timestamp ? new Date(r.timestamp.seconds*1000).toLocaleString() : "";
        csv += `"${r.desa}","${r.kelompok}","${r.nama}","${r.tipe}","${t}"\n`;
    });
    window.open(encodeURI(csv));
};

// INITIAL LOAD
window.addEventListener('load', () => {
    const r = sessionStorage.getItem('role');
    const a = localStorage.getItem('akun_aktif');
    const d = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    
    if(r === 'admin') {
        document.getElementById('admin-section').classList.remove('hidden');
        document.getElementById('btn-to-peserta').classList.remove('hidden');
        checkActiveEvent();
        loadReports();
    } else if(a) {
        document.getElementById('peserta-section').classList.remove('hidden');
        document.getElementById('display-nama').innerText = JSON.parse(a).nama;
    } else if(d.length > 0) {
        document.getElementById('pilih-akun-section').classList.remove('hidden');
        const c = document.getElementById('list-akun-pilihan');
        d.forEach(x => { 
            c.innerHTML += `<div class="account-box"><span onclick="pilihAkun(${x.id})" style="flex:1; cursor:pointer">${x.nama}</span><button onclick="hapusAkun(${x.id})" style="width:40px; background:#e74c3c">X</button></div>`; 
        });
    } else {
        document.getElementById('modal-tambah').classList.remove('hidden');
    }
});
