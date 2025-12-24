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

const WILAYAH = {
    "SAMIGALUH": ["PENGOS", "SUREN", "KALIREJO", "PAGERHARJO", "SEPARANG", "KEBONHARJO"],
    "PENGASIH": ["MARGOSARI", "SENDANGSARI", "BANJARHARJO", "NANGGULAN", "GIRINYONO", "JATIMULYO", "SERUT"],
    "WATES": ["KREMBANGAN", "BOJONG", "GIRIPENI 1", "GIRIPENI 2", "HARGOWILIS", "TRIHARJO"],
    "LENDAH": ["BONOSORO", "BUMIREJO", "CARIKAN", "NGENTAKREJO", "TUKSONO", "SRIKAYANGAN"],
    "TEMON": ["TAWANGSARI", "HARGOREJO", "SIDATAN 1", "SIDATAN 2", "JOGOBOYO", "JOGORESAN"]
};

// Global Data Master untuk Suggestion
let masterCache = [];

window.toggleSidebar = () => {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('overlay');
    if (sb && ov) {
        sb.classList.toggle('active');
        ov.classList.toggle('active');
    } else {
        console.error("Elemen sidebar atau overlay tidak ditemukan!");
    }
};

window.switchTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + id).classList.remove('hidden');
    event.currentTarget.classList.add('active');
};

window.loginAdmin = () => {
    if(prompt("Kode Admin:") === "1234") { sessionStorage.setItem('role', 'admin'); location.reload(); }
};

window.logout = () => {
    localStorage.removeItem('akun_aktif');
    sessionStorage.removeItem('role');
    location.reload();
};

window.updateKelompok = (targetId, desa) => {
    const el = document.getElementById(targetId);
    el.innerHTML = '<option value="">-- Pilih Kelompok --</option>';
    if(WILAYAH[desa]) WILAYAH[desa].forEach(k => el.innerHTML += `<option value="${k}">${k}</option>`);
};

// --- AUTOCOMPLETE LOGIC ---
window.handleNameInput = (val) => {
    const desa = document.getElementById('p-desa').value;
    const kel = document.getElementById('p-kelompok').value;
    const box = document.getElementById('suggestion-box');
    if(!desa || !kel || val.length < 2) { box.classList.add('hidden'); return; }
    
    const matches = masterCache.filter(m => m.desa === desa && m.kelompok === kel && m.nama.toLowerCase().includes(val.toLowerCase()));
    if(matches.length > 0) {
        box.classList.remove('hidden');
        box.innerHTML = matches.map(m => `<div class="suggestion-item" onclick="selectSug('${m.nama}')">${m.nama}</div>`).join('');
    } else box.classList.add('hidden');
};

window.selectSug = (n) => {
    document.getElementById('p-nama').value = n;
    document.getElementById('suggestion-box').classList.add('hidden');
};

window.saveProfile = async () => {
    const n = document.getElementById('p-nama').value.trim();
    const d = document.getElementById('p-desa').value;
    const k = document.getElementById('p-kelompok').value;
    if(!n || !d || !k) return alert("Lengkapi data!");
    const id = "USR-" + Date.now();
    const akun = { nama: n, desa: d, kelompok: k, id: id };
    
    const exists = masterCache.some(m => m.nama === n && m.kelompok === k);
    if(!exists) await setDoc(doc(db, "master_jamaah", id), { ...akun, gender: "Baru" });

    let list = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    list.push(akun);
    localStorage.setItem('daftar_akun', JSON.stringify(list));
    localStorage.setItem('akun_aktif', JSON.stringify(akun));
    location.reload();
};

// --- ADMIN FUNCTIONS ---
window.importMaster = async () => {
    const d = document.getElementById('m-desa').value;
    const k = document.getElementById('m-kelompok').value;
    const names = document.getElementById('m-names').value.split('\n').filter(n => n.trim() !== "");
    if(!d || !k || names.length === 0) return alert("Data tidak lengkap!");
    const batch = writeBatch(db);
    names.forEach(n => {
        const id = "MSTR-" + Math.random().toString(36).substr(2, 9);
        batch.set(doc(db, "master_jamaah", id), { nama: n.trim(), desa: d, kelompok: k, id: id });
    });
    await batch.commit();
    alert("Berhasil!"); location.reload();
};

window.searchMaster = () => {
    const v = document.getElementById('m-search').value.toLowerCase();
    document.querySelectorAll('.master-item').forEach(it => {
        it.style.display = it.innerText.toLowerCase().includes(v) ? 'flex' : 'none';
    });
};

window.resetLaporan = async () => {
    if(!confirm("Hapus semua riwayat kehadiran hari ini?")) return;
    const sn = await getDocs(collection(db, "attendance"));
    const batch = writeBatch(db);
    sn.forEach(d => batch.delete(d.ref));
    await batch.commit();
    alert("Berhasil Reset!"); location.reload();
};

window.createNewEvent = async () => {
    const n = document.getElementById('ev-nama').value;
    const j = document.getElementById('ev-jam').value;
    if(!n || !j) return alert("Isi data!");
    await setDoc(doc(db, "settings", "event_aktif"), { id: "EVT-"+Date.now(), status: "OPEN", nama: n, jam: j });
    location.reload();
};

window.closeEvent = async () => {
    const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
    const currentEvent = evSnap.data();
    
    // Auto Alfa Logic
    const masterSn = await getDocs(collection(db, "master_jamaah"));
    const absenSn = await getDocs(query(collection(db, "attendance"), where("event", "==", currentEvent.nama)));
    const sudahAbsen = [];
    absenSn.forEach(d => sudahAbsen.push(d.data().nama));

    const batch = writeBatch(db);
    masterSn.forEach(docM => {
        const m = docM.data();
        if(!sudahAbsen.includes(m.nama)) {
            batch.set(doc(collection(db, "attendance")), { ...m, tipe: "ALFA", event: currentEvent.nama, timestamp: serverTimestamp() });
        }
    });

    await batch.commit();
    await setDoc(doc(db, "settings", "event_aktif"), { status: "CLOSED" });
    alert("Absen ditutup & Alfa dihitung!");
    location.reload();
};

window.startScanner = () => {
    const sc = new Html5Qrcode("reader");
    sc.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (text) => {
        const [eid, tipe] = text.split("|");
        const akun = JSON.parse(localStorage.getItem('akun_aktif'));
        const ev = await getDoc(doc(db, "settings", "event_aktif"));
        if(!ev.exists() || ev.data().status !== "OPEN" || ev.data().id !== eid) return alert("QR EXPIRED!");

        let st = tipe;
        if(tipe === "HADIR") {
            const [h, m] = ev.data().jam.split(":");
            const limit = new Date(); limit.setHours(h, parseInt(m)+5, 0);
            if(new Date() > limit) st = "TERLAMBAT";
        }
        await addDoc(collection(db, "attendance"), { ...akun, tipe: st, event: ev.data().nama, timestamp: serverTimestamp() });
        sc.stop().then(() => {
            document.getElementById('success-msg').classList.remove('hidden');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            setTimeout(() => location.reload(), 3000);
        });
    });
};

window.downloadExcel = async () => {
    const sn = await getDocs(collection(db, "attendance"));
    let csv = "\uFEFFDesa,Kelompok,Nama,Status,Waktu\n";
    sn.forEach(d => {
        const r = d.data();
        const t = r.timestamp ? new Date(r.timestamp.seconds*1000).toLocaleString() : "";
        csv += `"${r.desa}","${r.kelompok}","${r.nama}","${r.tipe}","${t}"\n`;
    });
    window.open(encodeURI("data:text/csv;charset=utf-8," + csv));
};

window.showFullQR = (id, title) => {
    document.getElementById('full-qr-modal').classList.remove('hidden');
    document.getElementById('full-title').innerText = title;
    QRCode.toCanvas(document.getElementById('full-canvas'), document.getElementById(id).title, { width: 500 });
};

// --- INITIAL LOAD ---
window.addEventListener('load', async () => {
    const r = sessionStorage.getItem('role');
    const a = localStorage.getItem('akun_aktif');
    const d = JSON.parse(localStorage.getItem('daftar_akun')) || [];

    const mSn = await getDocs(collection(db, "master_jamaah"));
    mSn.forEach(doc => masterCache.push(doc.data()));

    if(r === 'admin') {
        document.getElementById('admin-section').classList.remove('hidden');
        const ev = await getDoc(doc(db, "settings", "event_aktif"));
        if(ev.exists() && ev.data().status === "OPEN") {
            document.getElementById('setup-box').classList.add('hidden');
            document.getElementById('qr-box').classList.remove('hidden');
            const cA = document.getElementById('canvas-absen');
            cA.title = ev.data().id + "|HADIR";
            QRCode.toCanvas(cA, cA.title, { width: 200 });
            QRCode.toCanvas(document.getElementById('canvas-izin'), ev.data().id + "|IZIN", { width: 200 });
        }
        // Load Master List
        const mList = document.getElementById('master-list-cont');
        masterCache.forEach(m => {
            mList.innerHTML += `<div class="report-item master-item"><span><b>${m.nama}</b><br><small>${m.kelompok}</small></span><button onclick="hapusMaster('${m.id}')" style="width:auto; background:red; padding:5px 10px; font-size:10px">HAPUS</button></div>`;
        });
        // Load Report
        const repList = document.getElementById('report-list-cont');
        onSnapshot(query(collection(db, "attendance"), orderBy("timestamp", "desc")), (sn) => {
            repList.innerHTML = "";
            sn.forEach(doc => {
                const r = doc.data();
                repList.innerHTML += `<div class="report-item"><span><b>${r.nama}</b><br><small>${r.kelompok}</small></span><span>${r.tipe}</span></div>`;
            });
        });
    } else if(a) {
        document.getElementById('peserta-section').classList.remove('hidden');
        document.getElementById('display-nama').innerText = JSON.parse(a).nama;
    // Bagian Penutup Inisialisasi (Load)
    } else if(d.length > 0) {
        document.getElementById('pilih-akun-section').classList.remove('hidden');
        const cont = document.getElementById('list-akun-pilihan');
        cont.innerHTML = ""; // Bersihkan dulu
        d.forEach(x => {
            cont.innerHTML += `
                <div class="report-item">
                    <b onclick="pilihAkun('${x.id}')" style="flex:1; cursor:pointer">${x.nama}</b>
                    <button onclick="hapusAkunLokal('${x.id}')" style="width:40px; background:#e74c3c; margin-left:10px; color:white; border-radius:5px; border:none;">X</button>
                </div>`;
        });
    } else {
        document.getElementById('modal-tambah').classList.remove('hidden');
    }
});

// --- FUNGSI GLOBAL ---
window.hapusAkunLokal = (id) => {
    if(confirm("Hapus akun ini dari HP?")) {
        let d = JSON.parse(localStorage.getItem('daftar_akun')).filter(a => a.id != id);
        localStorage.setItem('daftar_akun', JSON.stringify(d));
        location.reload();
    }
};

window.pilihAkun = (id) => {
    let list = JSON.parse(localStorage.getItem('daftar_akun'));
    const akun = list.find(a => a.id == id);
    if(akun) {
        localStorage.setItem('akun_aktif', JSON.stringify(akun));
        location.reload();
    }
};

window.hapusMaster = async (id) => {
    if(confirm("Hapus dari database permanen?")) { 
        await deleteDoc(doc(db, "master_jamaah", id)); 
        location.reload(); 
    }
};

window.showFullQR = (id, title) => {
    document.getElementById('full-qr-modal').classList.remove('hidden');
    document.getElementById('full-title').innerText = title;
    const sourceCanvas = document.getElementById(id);
    if(sourceCanvas) {
        QRCode.toCanvas(document.getElementById('full-canvas'), sourceCanvas.title, { width: 500 });
    }
};
