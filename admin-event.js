// admin-event.js

window.generateAllQR = (eventID) => {
    console.log("Mencoba me-render QR untuk ID:", eventID);
    
    const cAbsen = document.getElementById('canvas-absen');
    const cIzin = document.getElementById('canvas-izin');
    
    // 1. Cek apakah Library QRCode sudah ter-load
    if (typeof QRCode === 'undefined') {
        console.error("Library QRCode.js tidak ditemukan! Cek koneksi internet atau script tag di HTML.");
        return;
    }

    // 2. Cek apakah elemen Canvas ada
    if (cAbsen && cIzin) {
        // Render QR Hadir
        QRCode.toCanvas(cAbsen, eventID + "|HADIR", { 
            width: 250, 
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" }
        }, (error) => {
            if (error) console.error("Gagal Render QR Hadir:", error);
            else console.log("QR Hadir Berhasil!");
        });

        // Render QR Izin
        QRCode.toCanvas(cIzin, eventID + "|IZIN", { 
            width: 250, 
            margin: 2,
            color: { dark: "#000000", light: "#ffffff" }
        }, (error) => {
            if (error) console.error("Gagal Render QR Izin:", error);
            else console.log("QR Izin Berhasil!");
        });
    } else {
        console.error("Elemen canvas-absen atau canvas-izin tidak ditemukan di HTML!");
    }
};
