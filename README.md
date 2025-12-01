# 🎨 AR 3D Model Generator

Aplikasi WebXR AR yang terintegrasi dengan generator 3D model dari gambar menggunakan Fal.ai API. Anda dapat mengubah gambar 2D menjadi model 3D, menyimpannya ke library, dan menempatkannya di lingkungan AR.

## ✨ Fitur

### 1. **Image-to-3D Generation**
- Upload gambar dan konversi menjadi model 3D (.glb)
- Preview model 3D langsung di browser
- Download hasil dalam format ZIP
- Simpan model ke library untuk digunakan di AR

### 2. **AR Object Placement**
- Tempatkan model 3D di dunia nyata menggunakan WebXR
- Manipulasi objek: rotasi (1 jari), scale (2 jari)
- Seleksi dan hapus objek
- Reset semua objek yang ditempatkan

### 3. **First-Person View (FPV) Mode**
- Masuk ke dalam model 3D dalam skala 1:1
- Jelajahi interior bangunan dengan kontrol joystick
- Deteksi tabrakan otomatis
- Kontrol elevasi (naik/turun)

### 4. **Library 3D Assets**
- Model default tersedia
- Model yang di-generate tersimpan otomatis
- Pilih model dari library untuk ditempatkan di AR

## 🚀 Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup API Key

Edit file `.env` dan masukkan API key Fal.ai Anda:

```env
VITE_FAL_API_KEY=your_actual_fal_api_key_here
```

**Cara mendapatkan API Key:**
1. Daftar di [Fal.ai](https://fal.ai)
2. Buka dashboard Anda
3. Generate API key baru
4. Copy dan paste ke file `.env`

### 3. Jalankan Development Server

```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:5173`

### 4. Akses dari Perangkat Mobile

Untuk testing WebXR AR, Anda perlu akses dari perangkat mobile yang mendukung AR:

**Option A: Menggunakan HTTPS (Recommended)**
```bash
# Install ngrok atau cloudflared untuk tunneling
npx ngrok http 5173
```

**Option B: Menggunakan IP Lokal**
```bash
# Lihat IP lokal Anda
npm run dev -- --host
```
Kemudian akses dari mobile: `https://[YOUR_IP]:5173`

## 📱 Cara Penggunaan

### Phase 1: Generation Screen

1. **Upload Gambar**
   - Klik area upload atau drag & drop gambar
   - Format yang didukung: JPG, PNG, WEBP

2. **Generate 3D Model**
   - Klik tombol "Generate 3D Model"
   - Tunggu 1-2 menit untuk proses generation
   - Preview akan muncul di panel kanan

3. **Simpan ke Library**
   - Klik "Save to Library & Start AR"
   - Model akan tersimpan dan langsung tersedia di AR
   
   **ATAU**
   
   - Klik "Skip Generation & Start AR" untuk langsung ke AR dengan model default

### Phase 2: AR Mode

1. **Mulai AR**
   - Klik "Mulai AR"
   - Izinkan akses kamera dan sensor
   - Pindai area lantai untuk deteksi permukaan

2. **Pilih Model**
   - Klik tombol "📂 Library 3D"
   - Pilih model dari library (termasuk model yang baru di-generate)

3. **Tempatkan Objek**
   - Ketuk area lantai untuk menempatkan model
   - Objek akan muncul di lokasi yang ditap

4. **Manipulasi Objek**
   - **Rotasi**: Swipe dengan 1 jari
   - **Scale**: Pinch dengan 2 jari
   - **Hapus**: Pilih objek → Klik tombol "Hapus"

5. **FPV Mode** (Walkthrough Interior)
   - Pilih objek → Klik "🚶 FPV"
   - Gunakan joystick untuk bergerak
   - Gunakan tombol ▲/▼ untuk naik/turun
   - Putar kepala untuk melihat sekeliling
   - Klik ✕ untuk keluar dari FPV

## 🏗️ Struktur Project

```
├── index.html          # HTML utama dengan 3 screens
├── main.js             # Logic untuk generation & AR
├── package.json        # Dependencies
├── .env                # API key configuration
├── .gitignore          # Git ignore rules
└── README.md           # Dokumentasi ini
```

## 🛠️ Teknologi yang Digunakan

- **WebXR Device API** - AR functionality
- **Three.js** - 3D rendering
- **Fal.ai API** - Image-to-3D generation
- **Vite** - Build tool & dev server
- **NippleJS** - Virtual joystick
- **Model Viewer** - 3D preview
- **JSZip** - ZIP extraction
- **IndexedDB** - Persistent blob storage (NEW!)

## 💾 Storage Architecture

The app uses a hybrid storage approach for optimal performance:

```
┌─────────────────────────────────────────┐
│ IndexedDB (ARModelsDB)                  │
│ └─ Stores: Binary model blobs           │
│    - Persistent across sessions         │
│    - No size limitations                │
│    - Survives page reload               │
├─────────────────────────────────────────┤
│ localStorage                            │
│ └─ Stores: Model metadata only          │
│    - Quick access to model info         │
│    - Lightweight references             │
├─────────────────────────────────────────┤
│ Runtime (Memory)                        │
│ └─ Creates: Blob URLs on-demand         │
│    - Generated from IndexedDB blobs     │
│    - Used by AR loader                  │
└─────────────────────────────────────────┘
```

**Why this approach?**
- ✅ Persistent storage (survives reload)
- ✅ No blob URL expiration issues
- ✅ Handles large binary files
- ✅ Fast metadata lookup
- ✅ Works offline

## 📦 Build untuk Production

```bash
npm run build
```

Output akan ada di folder `dist/`. Deploy folder ini ke hosting yang mendukung HTTPS (requirement untuk WebXR).

**Recommended Hosting:**
- Netlify
- Vercel
- GitHub Pages
- Firebase Hosting

## 🔧 Troubleshooting

### API Key Error
```
Error: No API Key found
```
**Solusi:** Pastikan file `.env` ada dan berisi `VITE_FAL_API_KEY` yang valid.

### WebXR Not Supported
```
AR tidak didukung
```
**Solusi:** 
- Pastikan menggunakan perangkat Android dengan ARCore
- Akses melalui HTTPS
- Gunakan browser Chrome

### Model Generation Failed
```
Generation failed. See logs for details.
```
**Solusi:**
- Check API key validity
- Check internet connection
- Lihat console untuk error detail
- Pastikan gambar tidak terlalu besar (max 5MB recommended)

### CORS Error saat Load Generated Model
```
Could not preview 3D model (CORS issue)
```
**Ini normal.** Model tetap bisa di-download dan di-save ke library. Preview mungkin gagal karena CORS policy dari Fal.ai storage.

## 🎯 Tips & Best Practices

1. **Untuk Generation:**
   - Gunakan gambar dengan subjek yang jelas
   - Background polos memberikan hasil lebih baik
   - Resolusi 512x512 sampai 1024x1024 ideal

2. **Untuk AR Placement:**
   - Cari area dengan pencahayaan yang baik
   - Permukaan datar memberikan tracking lebih stabil
   - Hindari permukaan reflektif atau transparan

3. **Untuk FPV Mode:**
   - Mulai dari model bangunan/interior
   - Pastikan model memiliki interior yang detail
   - Gunakan movement speed yang nyaman (default sudah optimal)

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_FAL_API_KEY` | Fal.ai API key untuk generation | Yes |

## 🔐 Keamanan

- API key disimpan di `.env` (tidak di-commit ke git)
- API key hanya digunakan di client-side
- Untuk production, pertimbangkan menggunakan backend proxy untuk menyembunyikan API key

## 📄 License

MIT License - Bebas digunakan untuk project personal maupun komersial

## 🤝 Contributing

Contributions welcome! Silakan buat issue atau pull request.

## 📞 Support

Jika ada pertanyaan atau masalah:
1. Check troubleshooting section
2. Lihat console browser untuk error details
3. Buat issue di repository

---

**Happy Building! 🚀**