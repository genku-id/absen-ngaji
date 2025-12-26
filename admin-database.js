import { db } from "./firebase-config.js";
import { collection, getDocs, doc, deleteDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

window.importMaster = async () => {
    const namesRaw = document.getElementById('m-names').value;
    const desa = prompt("Input untuk desa mana?");
    const kelompok = prompt("Input untuk kelompok mana?");
    if(!namesRaw || !desa || !kelompok) return;

    const names = namesRaw.split("\n").filter(n => n.trim() !== "");
    for(let n of names) {
        const id = "MASTER-" + Date.now() + Math.random();
        await setDoc(doc(db, "master_jamaah", id), {
            nama: n.trim(), desa: desa, kelompok: kelompok
        });
    }
    alert("Impor selesai!");
    location.reload();
};
