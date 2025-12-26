import { db } from "./firebase-config.js";
import { collection, getDocs, doc, deleteDoc, addDoc, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Fungsi menampilkan daftar jamaah untuk dihapus (pindah domisili)
window.loadMasterList = async () => {
    const cont = document.getElementById('report-list-cont'); // Kita pakai container yang ada
    const snap = await getDocs(collection(db, "users_master"));
    cont.innerHTML = "<h4>Daftar Master Jamaah</h4>";
    snap.forEach(d => {
        const r = d.data();
        cont.innerHTML += `
            <div style="display:flex; justify-content:space-between; padding:8px; border-bottom:1px solid #ddd;">
                <span>${r.nama} (${r.desa})</span>
                <button onclick="window.hapusJamaah('${d.id}')" style="background:red; color:white; border:none; border-radius:3px;">Hapus</button>
            </div>`;
    });
};

window.hapusJamaah = async (id) => {
    if(confirm("Hapus jamaah ini karena pindah?")) {
        await deleteDoc(doc(db, "users_master", id));
        alert("Terhapus");
        window.loadMasterList();
    }
};
