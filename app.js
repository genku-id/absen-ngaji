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

// AUTH & ROLE LOGIC
window.pilihRole = (role) => {
    document.getElementById('login-pilihan').classList.add('hidden');
    if(role === 'peserta') {
        document.getElementById('form-peserta').classList.remove('hidden');
    } else {
        document.getElementById('form-admin').classList.remove('hidden');
    }
};

window.loginAdmin = () => {
    const pass = document.getElementById('admin-pass').value;
    if(pass === "1234") { // GANTI KODE DISINI
        sessionStorage.setItem('role', 'admin');
        location.reload();
    } else {
        alert("Kode Admin Salah!");
    }
};

window.logout = () => {
    localStorage.removeItem('akun_aktif');
    sessionStorage.removeItem('role');
    location.reload();
};

// ACCOUNTS LOGIC
window.saveProfile = () => {
    const nama = document.getElementById('p-nama').value;
    const kelompok = document.getElementById('p-kelompok').value;
    const desa = document.getElementById('p-desa').value;
    if(!nama || !kelompok || !desa) return alert("Wajib diisi semua!");

    let daftarAkun = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    const profilBaru = { nama, kelompok, desa, id: Date.now() };
    daftarAkun.push(profilBaru);
    localStorage.setItem('daftar_akun', JSON.stringify(daftarAkun));
    window.pilihAkun(profilBaru.id);
};

window.pilihAkun = (id) => {
    let daftarAkun = JSON.parse(localStorage.getItem('daftar_akun'));
    const akun = daftarAkun.find(a => a.id == id);
    localStorage.setItem('akun_aktif', JSON.stringify(akun));
    location.reload();
};

window.hapusAkun = (id) => {
    if(confirm("Hapus akun dari HP ini?")) {
        let daftarAkun = JSON.parse(localStorage.getItem('daftar_akun')) || [];
        daftarAkun = daftarAkun.filter(a => a.id != id);
        localStorage.setItem('daftar_akun', JSON.stringify(daftarAkun));
        location.reload();
    }
};

// ADMIN & SCAN LOGIC
window.createNewEvent = async () => {
    const id = "EVT-" + Date.now();
    await setDoc(doc(db, "settings", "event_aktif"), { id, status: "OPEN" });
    document.getElementById('qr-codes').classList.remove('hidden');
    QRCode.toCanvas(document.getElementById('canvas-absen'), id + "|HADIR");
    QRCode.toCanvas(document.getElementById('canvas-izin'), id + "|IZIN");
};

window.closeEvent = async () => {
    await setDoc(doc(db, "settings", "event_aktif"), { status: "CLOSED" });
    alert("Absen ditutup!");
    location.reload();
};

window.startScanner = () => {
    const scanner = new Html5Qrcode("reader");
    scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (text) => {
        const akun = JSON.parse(localStorage.getItem('akun_aktif'));
        const [evtID, tipe] = text.split("|");
        try {
            await addDoc(collection(db, "attendance"), { ...akun, tipe, timestamp: serverTimestamp() });
            document.getElementById('scan-result').innerHTML = "✅ Berhasil: " + tipe;
            scanner.stop();
        } catch (e) { alert("Error: " + e); }
    });
};

window.loadReports = () => {
    const q = query(collection(db, "attendance"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('report-list');
        list.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            list.innerHTML += `<li><b>${data.desa}</b> - ${data.nama} (${data.tipe})</li>`;
        });
    });
};

window.downloadExcel = async () => {
    const qSnapshot = await getDocs(collection(db, "attendance"));
    let data = [];
    qSnapshot.forEach(d => data.push(d.data()));
    data.sort((a,b) => a.desa.localeCompare(b.desa) || a.kelompok.localeCompare(b.kelompok));
    let csv = "data:text/csv;charset=utf-8,\uFEFFDesa,Kelompok,Nama,Tipe,Waktu\n";
    data.forEach(d => {
        const t = d.timestamp ? new Date(d.timestamp.seconds*1000).toLocaleString() : "";
        csv += `"${d.desa}","${d.kelompok}","${d.nama}","${d.tipe}","${t}"\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = "rekap_ngaji.csv";
    link.click();
};
