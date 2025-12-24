import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, onSnapshot, query, orderBy, serverTimestamp, getDocs, where, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Data Wilayah
const WILAYAH = {
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"]
};

// Global State
let currentEvent = null;

window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
};

// --- AUTH & PROFILE ---
window.loginAdmin = () => {
    if(prompt("Kode Admin:") === "1234") { sessionStorage.setItem('role', 'admin'); location.reload(); }
};

window.logout = () => {
    localStorage.removeItem('akun_aktif');
    sessionStorage.removeItem('role');
    location.reload();
};

window.updateKelompok = (targetId, desaValue) => {
    const kElem = document.getElementById(targetId);
    kElem.innerHTML = '<option value="">-- Pilih Kelompok --</option>';
    if(WILAYAH[desaValue]) {
        WILAYAH[desaValue].forEach(k => kElem.innerHTML += `<option value="${k}">${k}</option>`);
    }
};

window.saveProfile = async () => {
    const n = document.getElementById('p-nama').value.trim();
    const d = document.getElementById('p-desa').value;
    const k = document.getElementById('p-kelompok').value;
    if(!n || !d || !k) return alert("Lengkapi data!");

    const id = "USR-" + Date.now();
    const list = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    const akunBaru = { nama: n, desa: d, kelompok: k, id: id };
    
    // Auto-tambah ke Master Data jika belum ada
    await setDoc(doc(db, "master_jamaah", id), { ...akunBaru, gender: "Belum Set" });
    
    list.push(akunBaru);
    localStorage.setItem('daftar_akun', JSON.stringify(list));
    localStorage.setItem('akun_aktif', JSON.stringify(akunBaru));
    location.reload();
};

// --- MASTER DATA MANAGEMENT ---
window.importMaster = async () => {
    const d = document.getElementById('m-desa').value;
    const k = document.getElementById('m-kelompok').value;
    const g = document.getElementById('m-gender').value;
    const raw = document.getElementById('m-names').value;
    if(!d || !k || !g || !raw) return alert("Data tidak lengkap!");

    const names = raw.split('\n').filter(n => n.trim() !== "");
    const batch = writeBatch(db);
    
    names.forEach(name => {
        const id = "MSTR-" + Math.random().toString(36).substr(2, 9);
        const ref = doc(db, "master_jamaah", id);
        batch.set(ref, { nama: name.trim(), desa: d, kelompok: k, gender: g, id: id });
    });

    await batch.commit();
    alert("Berhasil Impor " + names.length + " nama!");
    document.getElementById('m-names').value = "";
    loadMasterList();
};

async function loadMasterList() {
    const sn = await getDocs(collection(db, "master_jamaah"));
    const cont = document.getElementById('master-list');
    cont.innerHTML = "";
    sn.forEach(d => {
        const item = d.data();
        cont.innerHTML += `<div class="report-item">
            <span>${item.nama} (${item.kelompok})</span>
            <button onclick="hapusMaster('${d.id}')" style="width:auto; background:red; padding:5px">Hapus</button>
        </div>`;
    });
}

window.hapusMaster = async (id) => {
    if(confirm("Hapus dari database?")) { await deleteDoc(doc(db, "master_jamaah", id)); loadMasterList(); }
};

// --- EVENT & SCAN ---
const loadActiveEvent = async () => {
    const snap = await getDoc(doc(db, "settings", "event_aktif"));
    if(snap.exists() && snap.data().status === "OPEN") {
        currentEvent = snap.data();
        document.getElementById('setup-box').classList.add('hidden');
        document.getElementById('qr-box').classList.remove('hidden');
        const cA = document.getElementById('canvas-absen');
        const cI = document.getElementById('canvas-izin');
        cA.title = currentEvent.id + "|HADIR"; cI.title = currentEvent.id + "|IZIN";
        QRCode.toCanvas(cA, cA.title, { width: 200 });
        QRCode.toCanvas(cI, cI.title, { width: 200 });
    }
};

window.createNewEvent = async () => {
    const n = document.getElementById('ev-nama').value;
    const j = document.getElementById('ev-jam').value;
    if(!n || !j) return alert("Isi Nama & Jam!");
    const eid = "EVT-" + Date.now();
    await setDoc(doc(db, "settings", "event_aktif"), { id: eid, status: "OPEN", nama: n, jam: j });
    location.reload();
};

window.closeEvent = async () => {
    if(!confirm("Tutup & Hitung ALFA?")) return;
    
    // Logika Auto-Alfa
    const masterSn = await getDocs(collection(db, "master_jamaah"));
    const absenSn = await getDocs(query(collection(db, "attendance"), where("event", "==", currentEvent.nama)));
    
    const sudahAbsen = [];
    absenSn.forEach(d => sudahAbsen.push(d.data().nama));

    const batch = writeBatch(db);
    masterSn.forEach(docMaster => {
        const m = docMaster.data();
        if(!sudahAbsen.includes(m.nama)) {
            const ref = doc(collection(db, "attendance"));
            batch.set(ref, { ...m, tipe: "ALFA", event: currentEvent.nama, timestamp: serverTimestamp() });
        }
    });

    await batch.commit();
    await setDoc(doc(db, "settings", "event_aktif"), { status: "CLOSED" });
    alert("Absen ditutup. Status ALFA telah dibuat.");
    location.reload();
};

window.startScanner = () => {
    const sc = new Html5Qrcode("reader");
    sc.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (text) => {
        const [eid, tipe] = text.split("|");
        const akun = JSON.parse(localStorage.getItem('akun_aktif'));
        const history = JSON.parse(localStorage.getItem('history_absen')) || {};

        if(history[akun.id] && Date.now() - history[akun.id] < 3600000) {
            alert("Sudah absen!"); sc.stop().then(() => location.reload()); return;
        }

        const ev = await getDoc(doc(db, "settings", "event_aktif"));
        if(!ev.exists() || ev.data().status !== "OPEN" || ev.data().id !== eid) {
            alert("QR EXPIRED!"); sc.stop().then(() => location.reload()); return;
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
            document.getElementById('success-msg').classList.remove('hidden');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            setTimeout(() => location.reload(), 3000);
        });
    });
};

// --- REPORTING & FILTERS ---
window.applyFilter = () => {
    const dFilter = document.getElementById('f-desa').value;
    const kFilter = document.getElementById('f-kelompok').value;
    loadReports(dFilter, kFilter);
};

window.loadReports = (fDesa = "", fKel = "") => {
    const q = query(collection(db, "attendance"), orderBy("timestamp", "desc"));
    onSnapshot(q, (sn) => {
        const l = document.getElementById('report-list');
        let h=0, t=0, i=0, a=0;
        l.innerHTML = "";
        
        sn.forEach(doc => {
            const d = doc.data();
            if((fDesa === "" || d.desa === fDesa) && (fKel === "" || d.kelompok === fKel)) {
                if(d.tipe === "HADIR") h++; else if(d.tipe === "TERLAMBAT") t++; else if(d.tipe === "IZIN") i++; else a++;
                const time = d.timestamp ? new Date(d.timestamp.seconds*1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--';
                l.innerHTML += `<div class="report-item">
                    <div><b>${d.nama}</b><br><small>${d.kelompok} • ${time}</small></div>
                    <span class="status-tag tag-${d.tipe.toLowerCase()}">${d.tipe}</span>
                </div>`;
            }
        });
        document.getElementById('count-h').innerText = h;
        document.getElementById('count-t').innerText = t;
        document.getElementById('count-i').innerText = i;
        document.getElementById('count-a').innerText = a;
    });
};

window.downloadExcel = async () => {
    const fDesa = document.getElementById('f-desa').value;
    const fKel = document.getElementById('f-kelompok').value;
    const sn = await getDocs(collection(db, "attendance"));
    let csv = "\uFEFFDesa,Kelompok,Nama,Status,Waktu\n";
    sn.forEach(doc => {
        const d = doc.data();
        if((fDesa === "" || d.desa === fDesa) && (fKel === "" || d.kelompok === fKel)) {
            const t = d.timestamp ? new Date(d.timestamp.seconds*1000).toLocaleString() : "";
            csv += `"${d.desa}","${d.kelompok}","${d.nama}","${d.tipe}","${t}"\n`;
        }
    });
    const link = document.createElement("a");
    link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
    link.download = `rekap_${fDesa || 'semua'}.csv`;
    link.click();
};

window.showFullQR = (id, title) => {
    document.getElementById('full-qr-modal').classList.remove('hidden');
    document.getElementById('full-title').innerText = title;
    QRCode.toCanvas(document.getElementById('full-canvas'), document.getElementById(id).title, { width: 500 });
};

// --- INIT ---
window.addEventListener('load', () => {
    const r = sessionStorage.getItem('role');
    const a = localStorage.getItem('akun_aktif');
    const d = JSON.parse(localStorage.getItem('daftar_akun')) || [];

    if(r === 'admin') {
        document.getElementById('admin-section').classList.remove('hidden');
        loadActiveEvent(); loadReports(); loadMasterList();
    } else if(a) {
        document.getElementById('peserta-section').classList.remove('hidden');
        document.getElementById('display-nama').innerText = JSON.parse(a).nama;
    } else if(d.length > 0) {
        document.getElementById('pilih-akun-section').classList.remove('hidden');
        const cont = document.getElementById('list-akun-pilihan');
        d.forEach(x => cont.innerHTML += `<div class="report-item" onclick="pilihAkun('${x.id}')" style="cursor:pointer"><b>${x.nama}</b><span>➔</span></div>`);
    } else {
        document.getElementById('modal-tambah').classList.remove('hidden');
    }
});
