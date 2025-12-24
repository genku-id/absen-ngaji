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

// --- NAVIGATION & TABS ---
window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
};

window.switchTab = (tabName) => {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.remove('hidden');
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

window.updateKelompok = (targetId, desaValue) => {
    const kElem = document.getElementById(targetId);
    kElem.innerHTML = '<option value="">-- Pilih Kelompok --</option>';
    if(WILAYAH[desaValue]) WILAYAH[desaValue].forEach(k => kElem.innerHTML += `<option value="${k}">${k}</option>`);
};

// --- REGISTRASI CERDAS (AUTOCOMPLETE) ---
let masterDataLocal = [];
async function fetchMasterOnce() {
    const sn = await getDocs(collection(db, "master_jamaah"));
    masterDataLocal = [];
    sn.forEach(d => masterDataLocal.push(d.data()));
}

window.handleNameInput = (val) => {
    const desa = document.getElementById('p-desa').value;
    const kelompok = document.getElementById('p-kelompok').value;
    const sugBox = document.getElementById('suggestion-box');
    
    if(!desa || !kelompok || val.length < 2) { sugBox.classList.add('hidden'); return; }

    const matches = masterDataLocal.filter(m => 
        m.desa === desa && 
        m.kelompok === kelompok && 
        m.nama.toLowerCase().includes(val.toLowerCase())
    );

    if(matches.length > 0) {
        sugBox.classList.remove('hidden');
        sugBox.innerHTML = matches.map(m => `<div class="suggestion-item" onclick="selectSug('${m.nama}')">${m.nama}</div>`).join('');
    } else {
        sugBox.classList.add('hidden');
    }
};

window.selectSug = (nama) => {
    document.getElementById('p-nama').value = nama;
    document.getElementById('suggestion-box').classList.add('hidden');
};

window.saveProfile = async () => {
    const n = document.getElementById('p-nama').value.trim();
    const d = document.getElementById('p-desa').value;
    const k = document.getElementById('p-kelompok').value;
    if(!n || !d || !k) return alert("Lengkapi data!");

    const id = "USR-" + Date.now();
    const list = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    const akun = { nama: n, desa: d, kelompok: k, id: id };
    
    // Cek jika nama baru (tidak ada di master)
    const exists = masterDataLocal.some(m => m.nama === n && m.kelompok === k);
    if(!exists) await setDoc(doc(db, "master_jamaah", id), { ...akun, gender: "Baru" });

    list.push(akun);
    localStorage.setItem('daftar_akun', JSON.stringify(list));
    localStorage.setItem('akun_aktif', JSON.stringify(akun));
    location.reload();
};

// --- ADMIN: DATABASE MASTER ---
window.searchMaster = () => {
    const val = document.getElementById('m-search').value.toLowerCase();
    const items = document.querySelectorAll('.master-item');
    items.forEach(it => {
        it.style.display = it.innerText.toLowerCase().includes(val) ? 'flex' : 'none';
    });
};

window.loadMasterList = async () => {
    const sn = await getDocs(query(collection(db, "master_jamaah"), orderBy("nama", "asc")));
    const cont = document.getElementById('master-list-cont');
    cont.innerHTML = "";
    sn.forEach(d => {
        const m = d.data();
        cont.innerHTML += `<div class="report-item master-item">
            <span><b>${m.nama}</b><br><small>${m.kelompok} (${m.desa})</small></span>
            <button onclick="hapusMaster('${d.id}')" style="width:auto; background:red; padding:5px 10px; font-size:10px">HAPUS</button>
        </div>`;
    });
};

window.hapusMaster = async (id) => {
    if(confirm("Hapus orang ini dari database permanen?")) {
        await deleteDoc(doc(db, "master_jamaah", id));
        loadMasterList();
    }
};

window.importMaster = async () => {
    const d = document.getElementById('m-desa').value;
    const k = document.getElementById('m-kelompok').value;
    const g = document.getElementById('m-gender').value;
    const names = document.getElementById('m-names').value.split('\n').filter(n => n.trim() !== "");
    if(!d || !k || names.length === 0) return alert("Data tidak lengkap!");

    const batch = writeBatch(db);
    names.forEach(n => {
        const id = "MSTR-" + Math.random().toString(36).substr(2, 9);
        batch.set(doc(db, "master_jamaah", id), { nama: n.trim(), desa: d, kelompok: k, gender: g, id: id });
    });
    await batch.commit();
    alert("Berhasil Impor!");
    location.reload();
};

// --- ADMIN: LAPORAN & RESET ---
window.resetLaporan = async () => {
    if(!confirm("⚠️ PERINGATAN!\nIni akan menghapus semua riwayat kehadiran (Hadir/Izin/Alfa) agar sistem bersih.\n\nDatabase Master tetap aman. Lanjutkan?")) return;
    const sn = await getDocs(collection(db, "attendance"));
    const batch = writeBatch(db);
    sn.forEach(d => batch.delete(d.ref));
    await batch.commit();
    alert("Laporan telah dibersihkan!");
    location.reload();
};

// --- SCAN & EVENT ---
let scanLock = false;
window.startScanner = () => {
    const sc = new Html5Qrcode("reader");
    sc.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (text) => {
        if(scanLock) return; scanLock = true;
        const [eid, tipe] = text.split("|");
        const akun = JSON.parse(localStorage.getItem('akun_aktif'));
        const ev = await getDoc(doc(db, "settings", "event_aktif"));

        if(!ev.exists() || ev.data().status !== "OPEN" || ev.data().id !== eid) {
            alert("QR EXPIRED!"); location.reload(); return;
        }

        let st = tipe;
        if(tipe === "HADIR") {
            const [h, m] = ev.data().jam.split(":");
            const limit = new Date(); limit.setHours(h, parseInt(m)+5, 0);
            if(new Date() > limit) st = "TERLAMBAT";
        }

        await addDoc(collection(db, "attendance"), { ...akun, tipe: st, event: ev.data().nama, timestamp: serverTimestamp() });
        const hist = JSON.parse(localStorage.getItem('history_absen')) || {};
        hist[akun.id] = Date.now();
        localStorage.setItem('history_absen', JSON.stringify(hist));

        sc.stop().then(() => {
            document.getElementById('success-msg').classList.remove('hidden');
            confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
            setTimeout(() => location.reload(), 3000);
        });
    });
};

// --- INIT LOAD ---
window.addEventListener('load', async () => {
    const r = sessionStorage.getItem('role');
    const a = localStorage.getItem('akun_aktif');
    const d = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    
    await fetchMasterOnce();

    if(r === 'admin') {
        document.getElementById('admin-section').classList.remove('hidden');
        const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
        if(evSnap.exists() && evSnap.data().status === "OPEN") {
            document.getElementById('setup-box').classList.add('hidden');
            document.getElementById('qr-box').classList.remove('hidden');
            const cA = document.getElementById('canvas-absen');
            cA.title = evSnap.data().id + "|HADIR";
            QRCode.toCanvas(cA, cA.title, { width: 200 });
            QRCode.toCanvas(document.getElementById('canvas-izin'), evSnap.data().id + "|IZIN", { width: 200 });
        }
        loadMasterList();
        loadReports();
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

// Fungsi Global lainnya (Download Excel, closeEvent, dsb tetap sama seperti v6)
