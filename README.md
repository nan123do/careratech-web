# Website Carera Tech

Lima situs publik statis dalam satu folder. Carera Tech memperkenalkan produk, NotaKu memuat informasi aplikasi dan dokumen legal, dan NOTAKITA memuat informasi produk serta paket. ServisKita dan Receipt Keeper memuat informasi produk dan panduan penggunaan. Portal langganan berjalan di server NOTAKITA.

## Struktur

| Folder | Isi |
| --- | --- |
| `careratech/` | Beranda dan daftar produk Carera Tech |
| `notaku/` | Beranda NotaKu, privasi, dan ketentuan |
| `notakita/` | Beranda, tutorial, panduan paket, kebijakan privasi, dan ketentuan pembelian NOTAKITA |
| `serviskita/` | Beranda dan panduan ServisKita |
| `receipt_keeper/` | Beranda dan panduan Receipt Keeper |
| `shared/` | Tema dan halaman 404 bersama |
| `dist/` | Hasil build yang siap diterbitkan |

Build hanya mengambil folder situs dan aset bersama.

## Preview lokal

Gunakan Node.js 22 atau lebih baru. Jalankan dari root folder website.

```sh
node scripts/build.mjs --serve
```

- Carera Tech di `http://127.0.0.1:4173/`
- NotaKu di `http://127.0.0.1:4174/`
- NOTAKITA di `http://127.0.0.1:4175/`
- ServisKita di `http://127.0.0.1:4176/`
- Receipt Keeper di `http://127.0.0.1:4177/`

Jalankan ulang setelah mengubah source. Gunakan `node scripts/build.mjs` jika hanya perlu build lokal. Tutorial NotaKita tersedia di `/tutorial/`. Tambahkan atau ubah artikel pada `scripts/notakita-tutorial.txt` dan simpan tangkapan layar data contoh di `notakita/assets/tutorial/`. Build membuat halaman statis untuk tiap kategori dan artikel, serta indeks pencariannya. Pemilih Ponsel dan Tablet berlaku di seluruh tutorial. Catat tangkapan layar kedua perangkat pada baris `@` di katalog. Pakai kolom langkah tablet ketika alurnya berbeda. Untuk artikel yang memerlukan gambar per langkah, gunakan `scripts/notakita-tutorial-walkthroughs.json`.

## Penerbitan

1. Simpan source di repo GitHub untuk website ini. Buat satu proyek Cloudflare Pages untuk setiap situs yang ingin diterbitkan.
2. Pada setiap proyek, kosongkan pilihan framework, jalankan build command `node scripts/build.mjs --production`, dan set versi Node dengan `NODE_VERSION=22`. Isi output directory sesuai tabel.
3. Tetapkan variabel URL yang sesuai pada setiap proyek. Gunakan origin HTTPS yang sudah dialokasikan untuk masing-masing proyek. Alamat `pages.dev` bisa dipakai untuk peninjauan sebelum memasang domain.
4. Saat domain siap, pasang custom domain di masing-masing proyek, ganti variabel URL dengan domain yang dikonfirmasi, lalu terbitkan ulang situs yang terhubung agar tautan dan canonical ikut berpindah.

| Proyek | Variabel origin | Output directory | Contoh domain |
| --- | --- | --- | --- |
| Carera Tech | `CARERATECH_URL` | `dist/careratech` | `https://careratech.id` |
| NotaKu | `NOTAKU_URL` | `dist/notaku` | `https://notaku.careratech.id` |
| NOTAKITA | `NOTAKITA_URL` | `dist/notakita` | `https://notakita.careratech.id` |
| ServisKita | `SERVISKITA_URL` | `dist/serviskita` | `https://serviskita.careratech.id` |
| Receipt Keeper | `RECEIPT_KEEPER_URL` | `dist/receipt_keeper` | `https://receiptkeeper.careratech.id` |

`CARERATECH_URL`, `NOTAKU_URL`, dan `NOTAKITA_URL` tetap diperlukan saat build produksi. Tetapkan `SERVISKITA_URL` dan `RECEIPT_KEEPER_URL` sesuai situs yang hendak dibangun dan ditautkan dari katalog Carera Tech.

Set `NOTAKITA_PORTAL_URL` di proyek NOTAKITA setelah portal produksi di DigitalOcean bisa diakses melalui HTTPS. Gunakan URL lengkap menuju `/langganan`. Website menautkan penghapusan akun ke `/hapus-akun` pada origin server yang sama. Periksa kedua alamat setelah deployment.

Di konfigurasi server, set `NOTAKITA_PUBLIC_SITE_ORIGIN` ke origin HTTPS website NotaKita tanpa path. Portal menautkan Ketentuan Pembelian pada halaman Tinjau Tagihan sebelum membuka pembayaran.

## Transisi alamat NotaKu

Periksa URL kebijakan privasi di Play Console dan akses pengelolaan host `careratech.dpdns.org`. Pertahankan situs lama hingga halaman baru terbit dengan HTTPS dan URL legal baru berhasil dibuka.

Jika host lama bisa dikelola, arahkan `/notaku/`, `/notaku/privacy/`, dan `/notaku/terms/` ke `/`, `/privacy/`, dan `/terms/` pada subdomain NotaKu. Uji tiap pengalihan dan perbarui URL yang tercantum di Play Console setelah tujuan baru dapat diakses. Untuk pengajuan Midtrans, gunakan URL publik NOTAKITA yang menampilkan harga paket dalam rupiah.

Tangkapan layar dan cuplikan nota NOTAKITA berasal dari aplikasi dengan data uji UAT. Halaman NotaKu memakai ilustrasi nota dan ikon asli aplikasi.

Referensi penerbitan

- [Konfigurasi build Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Pengaturan custom domain](https://developers.cloudflare.com/pages/configuration/custom-domains/)

## Sumber katalog Android

Beranda memperkenalkan tiga aplikasi yang tercantum pada [profil Carera Tech di Google Play](https://play.google.com/store/apps/developer?id=Carera%20Tech&hl=id&gl=ID). Deskripsi dan gambar promosi dicocokkan dengan listing berbahasa Indonesia pada 19 November 2026.

- [NotaKu](https://play.google.com/store/apps/details?id=com.careratech.notaku&hl=id) untuk transaksi dan persediaan toko.
- [ServisKita](https://play.google.com/store/apps/details?id=com.careratech.serviskita&hl=id) untuk riwayat servis serta pengingat berdasarkan tanggal atau odometer.
- [Receipt Keeper](https://play.google.com/store/apps/details?id=com.careratech.receipt_keeper&hl=id) untuk arsip struk dan garansi barang.

Gambar promosi resmi disajikan dari aset lokal agar halaman tidak bergantung pada server gambar Google Play. Bagian NOTAKITA mengarah ke situs produk yang sedang dikembangkan.

### Menambah aplikasi ke sorotan beranda

Gunakan entri katalog NotaKu sebagai contoh. Isi nama, kategori, judul, ringkasan, dan tautan utama pada entri baru. Simpan gambar di `careratech/assets/`, lalu isi `data-cover` dan `data-alt` pada entri tersebut. Setelah build, slide dan jumlah aplikasi mengikuti urutan entri. Untuk merilis NOTAKITA, pindahkan informasinya dari bagian pengembangan ke katalog dan isi tautan Google Play resmi.
