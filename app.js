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

const MAP_DESA = {
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"]
};

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

window.saveProfile = () => {
    const nama = document.getElementById('p-nama').value;
    const kelompok = document.getElementById('p-kelompok').value;
    if(!nama || !kelompok) return alert("Isi data!");

    let ds = "";
    for(let d in MAP_DESA) { if(MAP_DESA[d].includes(kelompok)) ds = d; }

    let list = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    list.push({ nama, kelompok, desa: ds, id: Date.now() });
    localStorage.setItem('daftar_akun', JSON.stringify(list));
    localStorage.setItem('akun_aktif', JSON.stringify(list[list.length-1]));
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

window.createNewEvent = async () => {
    const n = document.getElementById('ev-nama').value;
    const t = document.getElementById('ev-tgl').value;
    const j = document.getElementById('ev-jam').value;
    if(!n || !t || !j) return alert("Lengkapi!");

    const eid = "EVT-" + Date.now();
    await setDoc(doc(db, "settings", "event_aktif"), { id: eid, status: "OPEN", nama: n, jam: j });
    
    document.getElementById('qr-area').classList.remove('hidden');
    // Simpan data teks di atribut untuk sinkronisasi
    const cA = document.getElementById('canvas-absen');
    const cI = document.getElementById('canvas-izin');
    cA.title = eid + "|HADIR";
    cI.title = eid + "|IZIN";

    QRCode.toCanvas(cA, cA.title, { width: 200, margin: 2 });
    QRCode.toCanvas(cI, cI.title, { width: 200, margin: 2 });
};

window.showFullQR = (cid, title) => {
    const txt = document.getElementById(cid).title;
    document.getElementById('full-title').innerText = title;
    document.getElementById('full-qr-modal').classList.remove('hidden');
    QRCode.toCanvas(document.getElementById('full-canvas'), txt, { width: 500, margin: 2 });
};

window.downloadQR = () => {
    const canvas = document.getElementById('full-canvas');
    const link = document.createElement('a');
    link.download = 'QR_ABSEN.png';
    link.href = canvas.toDataURL();
    link.click();
};

window.closeEvent = async () => {
    await setDoc(doc(db, "settings", "event_aktif"), { status: "CLOSED" });
    location.reload();
};

let scanLock = false;
window.startScanner = () => {
    const sc = new Html5Qrcode("reader");
    sc.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (text) => {
        if(scanLock) return;
        scanLock = true;

        const [eid, tipe] = text.split("|");
        const akun = JSON.parse(localStorage.getItem('akun_aktif'));
        
        // Simpel anti-double: Cek local memory
        const lastScan = localStorage.getItem('last_scan_time');
        if(lastScan && Date.now() - lastScan < 3600000) {
            alert("Anda sudah absen baru-baru ini!");
            sc.stop().then(() => { location.reload(); });
            return;
        }

        const ev = await getDoc(doc(db, "settings", "event_aktif"));
        if(!ev.exists() || ev.data().status !== "OPEN" || ev.data().id !== eid) {
            alert("QR TIDAK BERLAKU!");
            sc.stop().then(() => { location.reload(); });
            return;
        }

        // Cek Terlambat
        let st = tipe;
        if(tipe === "HADIR") {
            const [h, m] = ev.data().jam.split(":");
            const limit = new Date(); limit.setHours(h, parseInt(m)+5, 0);
            if(new Date() > limit) st = "TERLAMBAT";
        }

        await addDoc(collection(db, "attendance"), { ...akun, tipe: st, event: ev.data().nama, timestamp: serverTimestamp() });
        localStorage.setItem('last_scan_time', Date.now());
        
        sc.stop().then(() => {
            document.getElementById('success-msg').classList.remove('hidden');
            setTimeout(() => { location.reload(); }, 2000);
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
    rows.sort((a,b) => a.desa.localeCompare(b.desa) || a.kelompok.localeCompare(b.kelompok));
    let csv = "data:text/csv;charset=utf-8,\uFEFFDesa,Kelompok,Nama,Status,Waktu\n";
    rows.forEach(r => {
        const t = r.timestamp ? new Date(r.timestamp.seconds*1000).toLocaleString() : "";
        csv += `"${r.desa}","${r.kelompok}","${r.nama}","${r.tipe}","${t}"\n`;
    });
    window.open(encodeURI(csv));
};
