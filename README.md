# 🗺️ Sitemap Processor and Google Indexing API Script

## 📄 Deskripsi

Script ini bertujuan untuk mengambil dan memproses sitemap dari sebuah situs web, kemudian mengirimkan URL-URL tersebut ke Google Indexing API untuk diperbarui atau dihapus dari indeks Google. Script ini juga memiliki fitur untuk memproses URL dalam batch dan menggunakan beberapa akun layanan Google untuk menghindari batasan kuota.

## ✨ Fitur

- 📥 Mengambil dan memproses sitemap dari URL yang diberikan.
- 🔗 Mendukung sitemap index dan sitemap biasa.
- 🔄 Mengirimkan URL ke Google Indexing API untuk diperbarui atau dihapus.
- 📦 Memproses URL dalam batch untuk menghindari batasan kuota.
- 📝 Menyimpan log keberhasilan dan kegagalan untuk mencegah pemrosesan ulang URL yang sudah diproses.

## ⚙️ Persyaratan

- 🟢 **Node.js** (v12 atau lebih baru)
- 📦 **npm** (biasanya diinstal bersama Node.js)

## 🚀 Instalasi

1. **Clone repositori ini**:
   ```bash
   git clone https://github.com/alqoe/google-index-multi-service.git
   cd google-index-multi-service
   ```

2. **Instal dependensi**:
   ```bash
   npm install
   ```

3. **Konfigurasi**:
   - 📄 Buat file `service_account1.json`, `service_account2.json`, `service_account3.json`, `service_account4.json`, dan `service_account5.json` untuk setiap akun layanan Google yang akan digunakan.
   - 🔧 Ganti `sitemapIndexUrl` di dalam script dengan URL sitemap index yang ingin Anda proses.

### 🛠️ Membuat `service_account.json`

1. **Buka Google Cloud Console**:
   - Kunjungi [Google Cloud Console](https://console.cloud.google.com/).

2. **Buat Proyek Baru** (jika belum memiliki proyek):
   - Klik pada dropdown di bagian atas halaman dan pilih "New Project".
   - 🏷️ Beri nama proyek dan klik "Create".

3. **Aktifkan Google Indexing API**:
   - Di dashboard proyek, klik pada "Enable APIs and Services".
   - 🔍 Cari "Indexing API" dan klik "Enable".

4. **Buat Akun Layanan**:
   - Buka menu "IAM & Admin" di sidebar kiri.
   - Pilih "Service Accounts".
   - Klik "Create Service Account".
   - 📝 Beri nama akun layanan dan klik "Create".
   - Pada langkah "Grant this service account access to project", pilih peran "Project" > "Editor".
   - Klik "Continue".

5. **Buat Kunci Akun Layanan**:
   - Setelah akun layanan dibuat, klik pada nama akun layanan yang baru dibuat.
   - Pada tab "Keys", klik "Add Key" > "Create New Key".
   - Pilih "JSON" sebagai tipe kunci dan klik "Create".
   - 💾 File JSON yang berisi kunci akan otomatis diunduh. Simpan file ini sebagai `service_account1.json` (atau sesuai kebutuhan Anda).

### 📧 Menambahkan Email Akun Layanan ke Google Search Console

1. **Buka Google Search Console**:
   - Kunjungi [Google Search Console](https://search.google.com/search-console).

2. **Pilih Situs Anda**:
   - Pilih situs yang ingin Anda tambahkan izin untuk akun layanan.

3. **Tambahkan Pengguna**:
   - Di sidebar kiri, klik "Settings".
   - Pilih "Users and permissions".
   - Klik "Add user".
   - Masukkan email akun layanan yang Anda buat di Google Cloud Console (email ini dapat ditemukan di file `service_account.json` di bagian `client_email`).
   - Pilih peran "Full" untuk memberikan akses penuh.
   - Klik "Add".

### 🔄 Menggunakan Beberapa Akun Layanan

Jika Anda ingin menggunakan beberapa akun layanan untuk menghindari batasan kuota, Anda dapat mengulangi langkah-langkah di atas untuk membuat akun layanan tambahan. Pastikan untuk menyimpan file JSON yang diunduh sebagai `service_account2.json`, `service_account3.json`, dan seterusnya.

### 📂 Contoh Struktur Proyek

Setelah Anda membuat dan mengonfigurasi akun layanan, struktur proyek Anda mungkin akan terlihat seperti ini:

```
project-root/
│
├── index.js
├── service_account1.json
├── service_account2.json
├── service_account3.json
├── service_account4.json
├── service_account5.json
├── urls.txt
├── log_success.txt
└── log_failure.txt
```

## 🛠️ Penggunaan

1. **Ubah URL Sitemap dengan URL Anda**:
   ```bash
   https://situskamu/sitemap.xml di baris 10 pada index.js
   ```

2. **Jalankan script untuk memperbarui URL**:
   ```bash
   node index.js
   ```

3. **Jalankan script untuk menghapus URL**:
   ```bash
   node index.js --delete
   ```

## 🔍 Cara Kerja

1. **Pengambilan Sitemap**:
   - Script akan mengambil sitemap index dari URL yang diberikan.
   - Jika sitemap index ditemukan, script akan mengambil semua sitemap yang terdaftar di dalamnya.
   - Jika sitemap biasa ditemukan, script akan mengambil semua URL yang terdaftar di dalamnya.

2. **Pemrosesan URL**:
   - URL yang diambil akan ditulis ke dalam `urls.txt`.
   - Script akan membaca `urls.txt` dan memproses URL dalam batch.
   - URL yang sudah berhasil atau gagal diproses sebelumnya akan diabaikan.

3. **Pemanggilan Google Indexing API**:
   - URL akan dikirimkan ke Google Indexing API dalam batch menggunakan beberapa akun layanan Google.
   - Jika suatu batch berhasil diproses, URL akan ditulis ke `log_success.txt`.
   - Jika suatu batch gagal diproses, URL akan ditulis ke `log_failure.txt`.

## 📝 Catatan

- Pastikan Anda memiliki izin yang sesuai untuk mengakses dan memproses sitemap dari situs web yang dituju.
- Pastikan akun layanan Google Anda memiliki izin yang sesuai untuk menggunakan Google Indexing API.

## 🤝 Kontribusi

Kontribusi selalu diterima! Jika Anda ingin berkontribusi, silakan buat _pull request_ atau laporkan _issue_ di repositori ini.

## 📄 Lisensi

Proyek ini dilisensikan di bawah [MIT License](LICENSE).

## 🔗 Referensi

- 📝 [AutoGoogleIndexer oleh Coombaa](https://github.com/Coombaa/AutoGoogleIndexer) - Script ini terinspirasi dari proyek ini yang menyediakan otomatisasi untuk pengindeksan URL ke Google.
