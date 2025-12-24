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

const MAPPING_DESA = {
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
    sessionStorage.setItem('role', 'peserta'); // Reset role ke peserta
    location.reload();
};

window.saveProfile = () => {
    const nama = document.getElementById('p-nama').value;
    const kelompok = document.getElementById('p-kelompok').value;
    if(!nama || !kelompok) return alert("Pilih Nama & Kelompok!");

    let desaFound = "";
    for (const [desa, list] of Object.entries(MAPPING_DESA)) {
        if (list.includes(kelompok)) { desaFound = desa; break; }
    }

    let daftar = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    const baru = { nama, kelompok, desa: desaFound, id: Date.now() };
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

window.createNewEvent = async () => {
    const nama = document.getElementById('ev-nama').value;
    const tgl = document.getElementById('ev-tgl').value;
    const jam = document.getElementById('ev-jam').value;
    if(!nama || !tgl || !jam) return alert("Lengkapi Data Event!");
    
    const eventID = "EVT-" + Date.now();
    await setDoc(doc(db, "settings", "event_aktif"), { id: eventID, status: "OPEN", nama, tgl, jam_mulai: jam });
    
    document.getElementById('qr-area').classList.remove('hidden');
    // Simpan teks di atribut data agar Fullscreen & Download sinkron
    const cAbsen = document.getElementById('canvas-absen');
    const cIzin = document.getElementById('canvas-izin');
    cAbsen.dataset.text = eventID + "|HADIR";
    cIzin.dataset.text = eventID + "|IZIN";
    
    QRCode.toCanvas(cAbsen, cAbsen.dataset.text, { width: 250, margin: 2 });
    QRCode.toCanvas(cIzin, cIzin.dataset.text, { width: 250, margin: 2 });
};

window.showFullQR = (canvasID, title) => {
    const fullDiv = document.getElementById('full-qr-modal');
    const source = document.getElementById(canvasID);
    const target = document.getElementById('full-canvas');
    document.getElementById('full-title').innerText = title;
    fullDiv.classList.remove('hidden');
    QRCode.toCanvas(target, source.dataset.text, { width: 600, margin: 2 });
};

window.downloadQR = () => {
    const canvas = document.getElementById('full-canvas');
    const link = document.createElement('a');
    link.download = 'QR_ABSEN.png';
    link.href = canvas.toDataURL("image/png");
    link.click();
};

window.closeEvent = async () => {
    await setDoc(doc(db, "settings", "event_aktif"), { status: "CLOSED" });
    alert("Absen Ditutup!");
    location.reload();
};

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
            alert("QR EXPIRED / ABSEN TUTUP!");
            isProcessing = false; return;
        }

        // Anti-Double 1 Jam
        const satuJamLalu = new Date(Date.now() - 3600000);
        const qCheck = query(collection(db, "attendance"), where("nama", "==", akun.nama), where("timestamp", ">", satuJamLalu));
        const hit = await getDocs(qCheck);
        if(!hit.empty) { alert("Anda sudah absen!"); scanner.stop(); isProcessing = false; return; }

        // Logika Terlambat (5 Menit)
        let statusFinal = tipe;
        if(tipe === "HADIR") {
            const [h, m] = evSnap.data().jam_mulai.split(":");
            const jamMulai = new Date(); jamMulai.setHours(h, m, 0);
            const batas = new Date(jamMulai.getTime() + 5 * 60000); // +5 menit
            if(new Date() > batas) statusFinal = "TERLAMBAT";
        }

        try {
            await addDoc(collection(db, "attendance"), { ...akun, tipe: statusFinal, event: evSnap.data().nama, timestamp: serverTimestamp() });
            scanner.stop();
            // FLASH SUCCESS
            document.getElementById('success-msg').classList.remove('hidden');
            setTimeout(() => { location.reload(); }, 2000);
        } catch (e) { alert("Gagal Simpan!"); isProcessing = false; }
    });
};

window.loadReports = () => {
    const q = query(collection(db, "attendance"), orderBy("timestamp", "desc"));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('report-list');
        list.innerHTML = "";
        snap.forEach(d => {
            const data = d.data();
            list.innerHTML += `<li>[${data.tipe}] ${data.nama} (${data.desa})</li>`;
        });
    });
};

window.downloadExcel = async () => {
    const snap = await getDocs(collection(db, "attendance"));
    let rows = []; snap.forEach(d => rows.push(d.data()));
    rows.sort((a,b) => a.desa.localeCompare(b.desa) || a.kelompok.localeCompare(b.kelompok));
    let csv = "data:text/csv;charset=utf-8,\uFEFFDesa,Kelompok,Nama,Status,Waktu\n";
    rows.forEach(r => {
        const t = r.timestamp ? new Date(r.timestamp.seconds*1000).toLocaleString() : "";
        csv += `"${r.desa}","${r.kelompok}","${r.nama}","${r.tipe}","${t}"\n`;
    });
    const link = document.createElement("a"); link.href = encodeURI(csv); link.download = "rekap.csv"; link.click();
};
