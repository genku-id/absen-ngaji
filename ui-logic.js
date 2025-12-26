import { db } from "./firebase-config.js";
import { collection, getDocs, query, where, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Tambahkan elemen pembungkus saran di index.html nanti (dibawah input nama)
const inputNama = document.getElementById('p-nama');

inputNama.addEventListener('input', async (e) => {
    const val = e.target.value.toUpperCase();
    const desa = document.getElementById('p-desa').value;
    const kel = document.getElementById('p-kelompok').value;

    if (val.length < 2 || !desa || !kel) return;

    // Cari nama yang mirip di database
    const q = query(collection(db, "users_master"), 
              where("desa", "==", desa), 
              where("kelompok", "==", kel));
    
    const snap = await getDocs(q);
    // Buat dropdown sederhana (bisa dikembangkan dengan UI lebih cantik)
    console.log("Saran nama:", snap.docs.map(d => d.data().nama).filter(n => n.includes(val)));
});

window.saveProfile = async () => {
    const n = inputNama.value.trim().toUpperCase();
    const d = document.getElementById('p-desa').value;
    const k = document.getElementById('p-kelompok').value;

    if(!n || !d || !k) return alert("Lengkapi data!");

    // CEK & AUTO TAMBAH MASTER
    const q = query(collection(db, "users_master"), where("nama", "==", n), where("desa", "==", d));
    const cek = await getDocs(q);
    
    if(cek.empty) {
        await addDoc(collection(db, "users_master"), { nama: n, desa: d, kelompok: k });
        alert("Nama baru ditambahkan ke database!");
    }

    localStorage.setItem('akun_aktif', JSON.stringify({nama: n, desa: d, kelompok: k}));
    location.reload();
};
