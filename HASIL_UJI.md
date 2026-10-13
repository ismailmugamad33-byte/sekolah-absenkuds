# Hasil uji versi 1.3.0 — 13 Oktober 2026

- Build `wrangler deploy --dry-run` berhasil: Worker 62,98 KiB dan 5 aset frontend; tidak melakukan deploy.
- **32 pengujian otomatis lulus** melalui `npm test`: akses Admin, guru baru, perubahan/peniadaan mapel, penugasan per periode, siswa baru kelas 7/10, kenaikan terpilih, kelulusan, pengiriman ulang, pelestarian riwayat, validasi, sesi, dan ekspor.
- Preview diuji dengan DOM HTML melalui LinkeDOM: navigasi tab, tambah guru/mapel, tambah kelas/siswa, pratinjau kelulusan, pergantian periode, log, ekspor 11 lembar Excel, laporan PDF, dan salinan JSON.
- Hasil XLSX dibuka ulang dengan openpyxl; NIS `00007` tetap teks, nilai seperti `=1+1` tetap teks dan tidak menjadi formula, serta nilai angka tetap numerik.
- PDF disiapkan sebagai laporan cetak HTML dengan pilihan Simpan sebagai PDF pada browser; isi yang berasal dari data di-escape.
- Tidak ada perubahan pada D1 atau Worker produksi. Pengujian render visual dan dialog unduhan/cetak pada browser penuh belum dilakukan. Uji DOM tidak sama dengan pemeriksaan visual.

## Riwayat pemeriksaan versi sebelumnya

# Hasil uji pembaruan 1.2.0 — 12 Oktober 2026

`npm test`: 25 pengujian lulus memakai SQLite lokal dan simulasi DOM. Dua mapel pada siswa, tanggal, kelas dan guru yang sama tersimpan terpisah; edit satu tidak menimpa lainnya. Draf frontend, mapel pada payload, dua baris matriks, hak akses, validasi mapel, jurnal dengan mapel/kelas, dan pelestarian data migrasi diuji.

`wrangler deploy --dry-run` berhasil membangun Worker (55,24 KiB) dan membaca empat aset. Tidak ada deploy atau perubahan D1 produksi. Pratinjau HTML menggunakan data simulasi. Pengujian render visual pada browser penuh belum dilakukan; pengujian DOM bukan verifikasi visual.

## Catatan versi sebelumnya

# Hasil pemeriksaan versi 1.1.0

Pemeriksaan menggunakan salinan kode, SQLite lokal, dan data siswa fiktif. Database Cloudflare produksi tidak diakses atau diubah.

## Ringkasan

- 19 pengujian otomatis lulus: `npm test`.
- Pemeriksaan sintaks frontend/backend lulus.
- Build Worker dan empat aset frontend melalui `wrangler deploy --dry-run` lulus; tidak melakukan deploy.
- Data SK halaman 3–4 dicocokkan melalui ekstraksi teks dan gambar halaman PDF: 21 nama, 19 pengajar, 25 penugasan, total 50 JP/minggu.
- Pengujian browser visual penuh tidak berhasil dijalankan karena browser lokal tidak tersedia dan browser jarak jauh tidak berhasil dibuka. Pemeriksaan frontend menggunakan simulasi DOM; hasil ini tidak menggantikan uji visual/perangkat nyata.

## Cakupan 19 pengujian

1. Pilihan kelas setelah login pertama, termasuk 2 MA dan 3 MA; pilihan yang masih valid tetap dipertahankan saat dimuat ulang.
2. Tahun ajaran dari database dan filter kelas berdasarkan jenjang master.
3. Tanggal kalender ketat pada frontend dan pengiriman catatan kosong.
4. Referensi ID elemen frontend tersedia, tidak berulang, serta JavaScript valid.
5. Data SK, jumlah pengajar, identitas lama, nama mirip yang dipisahkan, serta mapel lama yang dipertahankan.
6. Migrasi SK dapat diulang tanpa duplikasi guru/staf.
7. Instalasi database kosong dan pemeriksaan foreign key.
8. Hak akses master hanya Admin dan siswa tidak diberikan kepada pengguna tanpa sesi.
9. Absensi per guru, penolakan perubahan/hapus milik guru lain, dan penolakan penyamaran ID guru.
10. Jam siswa milik Admin tetap tersimpan saat guru mengubah status/keterangan.
11. Penolakan tanggal tidak ada, jam tidak valid, dan urutan waktu terbalik.
12. Simpan waktu guru yang valid; penolakan tanggal invalid pada update.
13. Simpan/edit jurnal sendiri dan penolakan akses jurnal guru lain.
14. Impor gagal secara menyeluruh apabila ada baris salah atau konflik unik pada database.
15. Pindah/nonaktif siswa mempertahankan kelas pada riwayat lama.
16. Pengaturan tahun ajaran/semester disimpan dan divalidasi.
17. Reset password mencabut token lama; login password baru berfungsi.
18. Nonaktif guru mencabut sesi/akun dan mempertahankan riwayat.
19. Migrasi per-guru mempertahankan absensi, jam, akun, jurnal, dan integritas relasi.

## Pemeriksaan setelah pemasangan oleh operator

Periksa skema D1 aktual, hasil pencocokan nama, halaman login, impor CSV dari file nyata, dialog cetak/unduh, tampilan ponsel, dan pembaruan antarperangkat. Uji ini memerlukan lingkungan sekolah dan belum diklaim selesai. Ikuti `PANDUAN_PEMBARUAN.md`.
