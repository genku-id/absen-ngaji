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

let masterCache = [];

window.toggleSidebar = () => {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('overlay').classList.toggle('active');
};

window.switchTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + id).classList.remove('hidden');
    if(event) event.currentTarget.classList.add('active');
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
    await setDoc(doc(db, "master_jamaah", id), { nama: n, desa: d, kelompok: k, id: id });
    let list = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    list.push({ nama: n, desa: d, kelompok: k, id: id });
    localStorage.setItem('daftar_akun', JSON.stringify(list));
    localStorage.setItem('akun_aktif', JSON.stringify({ nama: n, desa: d, kelompok: k, id: id }));
    location.reload();
};

window.startScanner = () => {
    const sc = new Html5Qrcode("reader");
    let isProcessing = false;
    sc.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, async (text) => {
        if (isProcessing) return;
        isProcessing = true;
        const [eid, tipe] = text.split("|");
        const akun = JSON.parse(localStorage.getItem('akun_aktif'));
        const ev = await getDoc(doc(db, "settings", "event_aktif"));
        if(!ev.exists() || ev.data().status !== "OPEN" || ev.data().id !== eid) {
            alert("QR EXPIRED!"); location.reload(); return;
        }
        const qCheck = query(collection(db, "attendance"), where("event", "==", ev.data().nama), where("nama", "==", akun.nama));
        const check = await getDocs(qCheck);
        if(!check.empty) { alert("Sudah Absen!"); location.reload(); return; }

        let st = tipe;
        if(tipe === "HADIR") {
            const tm = new Date(ev.data().tanggal + "T" + ev.data().jam);
            if(new Date() > new Date(tm.getTime() + 5*60000)) st = "TERLAMBAT";
        }

        await addDoc(collection(db, "attendance"), { ...akun, tipe: st, event: ev.data().nama, timestamp: serverTimestamp() });
        
        document.getElementById('success-msg').classList.remove('hidden');
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, zIndex: 6000 });

        sc.stop().then(() => { setTimeout(() => location.reload(), 3000); });
    });
};

window.loadReports = () => {
    const cont = document.getElementById('report-list-cont');
    if(!cont) return;
    onSnapshot(query(collection(db, "attendance"), orderBy("timestamp", "desc")), (sn) => {
        cont.innerHTML = "";
        const unique = new Set();
        sn.forEach(doc => {
            const r = doc.data();
            if(!unique.has(r.nama)) {
                unique.add(r.nama);
                cont.innerHTML += `<div class="report-item"><span><b>${r.nama}</b><br><small>${r.desa} - ${r.kelompok}</small></span><span class="status-tag tag-${r.tipe.toLowerCase()}">${r.tipe}</span></div>`;
            }
        });
    });
};

window.updateFilterKelompok = (desa) => {
    const el = document.getElementById('f-kelompok');
    el.innerHTML = '<option value="">-- Semua Kelompok --</option>';
    if(WILAYAH[desa]) WILAYAH[desa].forEach(k => el.innerHTML += `<option value="${k}">${k}</option>`);
};

window.filterLaporan = () => {
    const d = document.getElementById('f-desa').value.toLowerCase();
    const k = document.getElementById('f-kelompok').value.toLowerCase();
    document.querySelectorAll('.report-item').forEach(it => {
        const txt = it.innerText.toLowerCase();
        it.style.display = (txt.includes(d) && txt.includes(k)) ? "flex" : "none";
    });
};

window.resetLaporan = async () => {
    if(!confirm("Hapus semua laporan hari ini?")) return;
    const sn = await getDocs(collection(db, "attendance"));
    const batch = writeBatch(db);
    sn.forEach(d => batch.delete(d.ref));
    await batch.commit();
    alert("Reset Berhasil!"); location.reload();
};

window.downloadExcel = () => {
    let csv = "\uFEFFNama,Wilayah,Status\n";
    document.querySelectorAll('.report-item').forEach(it => {
        if(it.style.display !== "none") {
            csv += `"${it.querySelector('b').innerText}","${it.querySelector('small').innerText}","${it.querySelector('.status-tag').innerText}"\n`;
        }
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `Laporan.csv`;
    link.click();
};

window.addEventListener('load', async () => {
    const r = sessionStorage.getItem('role');
    const a = localStorage.getItem('akun_aktif');
    const d = JSON.parse(localStorage.getItem('daftar_akun')) || [];
    const mSn = await getDocs(collection(db, "master_jamaah"));
    const mCont = document.getElementById('master-list-cont');
    mSn.forEach(doc => {
        const m = doc.data();
        masterCache.push(m);
        if(mCont) mCont.innerHTML += `<div class="report-item"><span><b>${m.nama}</b><br><small>${m.kelompok}</small></span><button onclick="hapusMaster('${m.id}')" style="width:auto; background:red; padding:5px;">Hapus</button></div>`;
    });

    if(r === 'admin') {
        document.getElementById('admin-section').classList.remove('hidden');
        const ev = await getDoc(doc(db, "settings", "event_aktif"));
        if(ev.exists() && ev.data().status === "OPEN") {
            document.getElementById('setup-box').classList.add('hidden');
            document.getElementById('qr-box').classList.remove('hidden');
            QRCode.toCanvas(document.getElementById('canvas-absen'), ev.data().id + "|HADIR", { width: 200 });
            QRCode.toCanvas(document.getElementById('canvas-izin'), ev.data().id + "|IZIN", { width: 200 });
        }
        window.loadReports();
    } else if(a) {
        document.getElementById('peserta-section').classList.remove('hidden');
        document.getElementById('display-nama').innerText = JSON.parse(a).nama;
    } else if(d.length > 0) {
        document.getElementById('pilih-akun-section').classList.remove('hidden');
        const cont = document.getElementById('list-akun-pilihan');
        d.forEach(x => {
            cont.innerHTML += `<div class="report-item"><b onclick="pilihAkun('${x.id}')" style="flex:1;">${x.nama}</b><button onclick="hapusAkunLokal('${x.id}')" style="width:40px; background:red;">X</button></div>`;
        });
    } else { document.getElementById('modal-tambah').classList.remove('hidden'); }
});

window.pilihAkun = (id) => {
    const list = JSON.parse(localStorage.getItem('daftar_akun'));
    localStorage.setItem('akun_aktif', JSON.stringify(list.find(a => a.id == id)));
    location.reload();
};

window.hapusAkunLokal = (id) => {
    if(confirm("Hapus?")) {
        localStorage.setItem('daftar_akun', JSON.stringify(JSON.parse(localStorage.getItem('daftar_akun')).filter(a => a.id != id)));
        location.reload();
    }
};

window.hapusMaster = async (id) => {
    if(confirm("Hapus permanen?")) { await deleteDoc(doc(db, "master_jamaah", id)); location.reload(); }
};

window.createNewEvent = async () => {
    const n = document.getElementById('ev-nama').value;
    const t = document.getElementById('ev-tgl').value;
    const j = document.getElementById('ev-jam').value;
    if(!n || !t || !j) return alert("Lengkapi data!");
    await setDoc(doc(db, "settings", "event_aktif"), { id: "EVT-"+Date.now(), status: "OPEN", nama: n, tanggal: t, jam: j });
    location.reload();
};

window.closeEvent = async () => {
    const evSnap = await getDoc(doc(db, "settings", "event_aktif"));
    if(!evSnap.exists()) return;
    const currentEvent = evSnap.data();
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

window.downloadQR = (id, file) => {
    const link = document.createElement('a');
    link.download = file + '.png';
    link.href = document.getElementById(id).toDataURL();
    link.click();
};

window.importMaster = async () => {
    const names = document.getElementById('m-names').value.split('\n').filter(n => n.trim() !== "");
    if(names.length === 0) return alert("Masukkan nama!");
    const batch = writeBatch(db);
    names.forEach(n => {
        const id = "MSTR-" + Math.random().toString(36).substr(2, 9);
        batch.set(doc(db, "master_jamaah", id), { nama: n.trim(), desa: "IMPORT", kelompok: "IMPORT", id: id });
    });
    await batch.commit();
    alert("Impor Berhasil!"); location.reload();
};
