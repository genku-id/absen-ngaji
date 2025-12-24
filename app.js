import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, addDoc, collection, onSnapshot, query, orderBy, serverTimestamp, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// SIDEBAR NAV
window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
};

// ROLE & LOGIN
window.loginAdmin = () => {
    const pass = prompt("Masukkan Kode Akses Admin:");
    if(pass === "1234") {
        sessionStorage.setItem('role', 'admin');
        location.reload();
    } else if(pass !== null) { alert("Kode Salah!"); }
};

window.logout = () => {
    localStorage.removeItem('akun_aktif');
    sessionStorage.removeItem('role');
    location.reload();
};

// ACCOUNTS
window.saveProfile = () => {
    const nama = document.getElementById('p-nama').value;
    const kelompok = document.getElementById('p-kelompok').value;
    const desa = document.getElementById('p-desa').value;
    if(!nama || !kelompok || !desa) return alert("Isi semua data!");

    let daftar = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    const baru = { nama, kelompok, desa, id: Date.now() };
    daftar.push(baru);
    localStorage.setItem('daftar_akun', JSON.stringify(daftar));
    window.pilihAkun(baru.id);
};

window.pilihAkun = (id) => {
    let daftar = JSON.parse(localStorage.getItem('daftar_akun'));
    const akun = daftar.find(a => a.id == id);
    localStorage.setItem('akun_aktif', JSON.stringify(akun));
    location.reload();
};

window.hapusAkun = (id) => {
    if(confirm("Hapus akun ini?")) {
        let daftar = JSON.parse(localStorage.getItem('daftar_akun')) || [];
        daftar = daftar.filter(a => a.id != id);
        localStorage.setItem('daftar_akun', JSON.stringify(daftar));
        location.reload();
    }
};

// FIREBASE ACTIONS
window.createNewEvent = async () => {
    const id = "EVT-" + Date.now();
    await setDoc(doc(db, "settings", "event_aktif"), { id, status: "OPEN" });
    document.getElementById('qr-area').classList.remove('hidden');
    QRCode.toCanvas(document.getElementById('canvas-absen'), id + "|HADIR");
    QRCode.toCanvas(document.getElementById('canvas-izin'), id + "|IZIN");
};

window.startScanner = () => {
    const scanner = new Html5Qrcode("reader");
    scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (text) => {
        const akun = JSON.parse(localStorage.getItem('akun_aktif'));
        const [evtID, tipe] = text.split("|");
        await addDoc(collection(db, "attendance"), { ...akun, tipe, timestamp: serverTimestamp() });
        document.getElementById('scan-result').innerHTML = "✅ Berhasil Absen!";
        scanner.stop();
    });
};

window.loadReports = () => {
    const q = query(collection(db, "attendance"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('report-list');
        list.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            list.innerHTML += `<li><b>${data.desa}</b> - ${data.nama}</li>`;
        });
    });
};

window.downloadExcel = async () => {
    const snap = await getDocs(collection(db, "attendance"));
    let rows = []; snap.forEach(d => rows.push(d.data()));
    rows.sort((a,b) => a.desa.localeCompare(b.desa) || a.kelompok.localeCompare(b.kelompok));
    let csv = "data:text/csv;charset=utf-8,\uFEFFDesa,Kelompok,Nama,Tipe\n";
    rows.forEach(r => csv += `"${r.desa}","${r.kelompok}","${r.nama}","${r.tipe}"\n`);
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = "rekap_ngaji.csv";
    link.click();
};
