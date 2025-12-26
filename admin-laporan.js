import { db } from "./firebase-config.js";
import { collection, query, orderBy, onSnapshot, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.filterLaporan = () => {
    const desa = document.getElementById('f-desa').value;
    const kel = document.getElementById('f-kelompok').value;
    const cont = document.getElementById('report-list-cont');
    
    onSnapshot(query(collection(db, "attendance"), orderBy("timestamp", "desc")), (sn) => {
        if(!cont) return;
        cont.innerHTML = "";
        sn.forEach(doc => {
            const r = doc.data();
            if((!desa || r.desa === desa) && (!kel || r.kelompok === kel)) {
                cont.innerHTML += `
                    <div class="report-item" style="padding:10px; border-bottom:1px solid #eee;">
                        <b>${r.nama}</b> <span class="badge">${r.tipe}</span><br>
                        <small>${r.desa} - ${r.kelompok}</small>
                    </div>`;
            }
        });
    });
};

window.downloadExcel = async () => {
    const desa = document.getElementById('f-desa').value;
    const kel = document.getElementById('f-kelompok').value;
    const sn = await getDocs(query(collection(db, "attendance"), orderBy("timestamp", "desc")));
    let csv = "Nama,Desa,Kelompok,Status\n";
    sn.forEach(doc => {
        const r = doc.data();
        if((!desa || r.desa === desa) && (!kel || r.kelompok === kel)) {
            csv += `${r.nama},${r.desa},${r.kelompok},${r.tipe}\n`;
        }
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_${desa||'Semua'}.csv`;
    a.click();
};

window.resetLaporan = async () => {
    if(!confirm("Hapus semua riwayat?")) return;
    const sn = await getDocs(collection(db, "attendance"));
    const batch = writeBatch(db);
    sn.forEach(d => batch.delete(d.ref));
    await batch.commit();
    location.reload();
};
