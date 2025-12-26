import { db } from "./firebase-config.js";
import { collection, query, orderBy, onSnapshot, getDocs, writeBatch, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Fungsi Filter
window.filterLaporan = () => {
    const desa = document.getElementById('f-desa').value;
    const kel = document.getElementById('f-kelompok').value;
    const cont = document.getElementById('report-list-cont');
    
    onSnapshot(query(collection(db, "attendance"), orderBy("timestamp", "desc")), (sn) => {
        if(!cont) return;
        cont.innerHTML = "";
        sn.forEach(doc => {
            const r = doc.data();
            const matchDesa = !desa || r.desa === desa;
            const matchKel = !kel || r.kelompok === kel;
            
            if(matchDesa && matchKel) {
                cont.innerHTML += `
                    <div class="report-item" style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee;">
                        <span><b>${r.nama}</b><br><small>${r.desa} - ${r.kelompok}</small></span>
                        <span class="badge" style="background:${r.tipe=='ALFA'?'#e74c3c':'#2ecc71'}; color:white; padding:5px; border-radius:5px;">${r.tipe}</span>
                    </div>`;
            }
        });
    });
};

// Fungsi Download cerdas (sesuai filter)
// Fungsi Download Berdasarkan Apa yang Tampil (Filter)
window.downloadExcelCerdas = async () => {
    const fDesa = document.getElementById('f-desa')?.value; // Tambahkan id ini di HTML
    const fKel = document.getElementById('f-kelompok')?.value;
    
    const sn = await getDocs(collection(db, "attendance"));
    let csv = "NAMA,DESA,KELOMPOK,STATUS\n";
    
    sn.forEach(doc => {
        const r = doc.data();
        const matchDesa = !fDesa || r.desa === fDesa;
        const matchKel = !fKel || r.kelompok === fKel;

        if(matchDesa && matchKel) {
            csv += `${r.nama},${r.desa},${r.kelompok},${r.tipe}\n`;
        }
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `Laporan_${fDesa || 'Semua'}.csv`);
    a.click();
};
window.resetLaporan = async () => {
    if(!confirm("Hapus semua riwayat? Data ALFA yang tadi akan hilang semua.")) return;
    const sn = await getDocs(collection(db, "attendance"));
    const batch = writeBatch(db);
    sn.forEach(d => batch.delete(d.ref));
    await batch.commit();
    alert("Database laporan dibersihkan!");
    location.reload();
};
