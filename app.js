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

window.saveProfile = () => {
    const profile = {
        nama: document.getElementById('p-nama').value,
        kelompok: document.getElementById('p-kelompok').value,
        desa: document.getElementById('p-desa').value
    };
    if(!profile.nama || !profile.kelompok || !profile.desa) return alert("Semua data wajib diisi!");
    localStorage.setItem('ngaji_profile', JSON.stringify(profile));
    location.reload();
};

window.createNewEvent = async () => {
    const eventID = "EVT-" + Date.now();
    await setDoc(doc(db, "settings", "event_aktif"), { id: eventID, status: "OPEN" });
    document.getElementById('qr-codes').classList.remove('hidden');
    QRCode.toCanvas(document.getElementById('canvas-absen'), eventID + "|HADIR");
    QRCode.toCanvas(document.getElementById('canvas-izin'), eventID + "|IZIN");
};

window.closeEvent = async () => {
    await setDoc(doc(db, "settings", "event_aktif"), { status: "CLOSED" });
    alert("Absensi ditutup!");
    location.reload();
};

window.startScanner = () => {
    const scanner = new Html5Qrcode("reader");
    scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (text) => {
        const profile = JSON.parse(localStorage.getItem('ngaji_profile'));
        const [evtID, tipe] = text.split("|");
        try {
            await addDoc(collection(db, "attendance"), {
                ...profile,
                tipe: tipe,
                timestamp: serverTimestamp()
            });
            document.getElementById('scan-result').innerHTML = "<h3 style='color:green'>✅ Berhasil! Tercatat " + tipe + "</h3>";
            scanner.stop();
        } catch (e) { alert("Error: " + e); }
    });
};

window.loadReports = () => {
    const q = query(collection(db, "attendance"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('report-list');
        list.innerHTML = "";
        snapshot.forEach(doc => {
            const d = doc.data();
            const waktu = d.timestamp ? new Date(d.timestamp.seconds * 1000).toLocaleTimeString() : "...";
            list.innerHTML += `<li><b>${d.desa}</b> - ${d.kelompok} | <b>${d.nama}</b> (${d.tipe})</li>`;
        });
    });
};

window.downloadExcel = async () => {
    const q = query(collection(db, "attendance"));
    const querySnapshot = await getDocs(q);
    let dataArray = [];
    querySnapshot.forEach((doc) => dataArray.push(doc.data()));

    dataArray.sort((a, b) => a.desa.localeCompare(b.desa) || a.kelompok.localeCompare(b.kelompok) || a.nama.localeCompare(b.nama));

    let csvContent = "data:text/csv;charset=utf-8,\uFEFFDesa,Kelompok,Nama,Keterangan,Waktu\n";
    dataArray.forEach((d) => {
        const waktu = d.timestamp ? new Date(d.timestamp.seconds * 1000).toLocaleString() : "";
        csvContent += `"${d.desa}","${d.kelompok}","${d.nama}","${d.tipe}","${waktu}"\n`;
    });

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "rekap_ngaji.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
// Fungsi Pindah Role
window.pilihRole = (role) => {
    document.getElementById('login-pilihan').classList.add('hidden');
    if(role === 'peserta') {
        document.getElementById('form-peserta').classList.remove('hidden');
    } else {
        document.getElementById('form-admin').classList.remove('hidden');
    }
};

// Login Admin (Contoh Kode: 1234)
window.loginAdmin = () => {
    const pass = document.getElementById('admin-pass').value;
    if(pass === "1234") { // Ganti 1234 dengan kode rahasiamu
        sessionStorage.setItem('role', 'admin');
        location.reload();
    } else {
        alert("Kode Admin Salah!");
    }
};

// Fungsi Logout
window.logout = () => {
    localStorage.removeItem('ngaji_profile');
    sessionStorage.removeItem('role');
    location.reload();
};
