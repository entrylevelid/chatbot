# 📚 Xypher: AI Chat Assistant with Contextual Document Retrieval

Xypher adalah aplikasi asisten berbasis AI yang dirancang untuk menjawab pertanyaan pengguna berdasarkan isi dokumen yang diunggah, dengan memanfaatkan pendekatan **Retrieval-Augmented Generation (RAG)**. Aplikasi ini dirancang untuk lingkungan kerja, edukasi, dan riset yang memerlukan pencarian informasi secara cepat dan relevan.

---

## ⚙️ Teknologi yang Digunakan

### 🔙 Backend (Python + Flask)
- **Flask** — framework web utama untuk routing, session, dan integrasi form.
- **LangChain**:
  - `RecursiveCharacterTextSplitter` — untuk memecah dokumen menjadi potongan teks (chunk).
  - `PyPDFLoader` dan `UnstructuredExcelLoader` — untuk membaca file PDF dan Excel.
  - `FAISS` — untuk menyimpan embedding vektor dan melakukan pencarian berbasis kemiripan.
  - `HuggingFaceEmbeddings` — menggunakan model `all-MiniLM-L6-v2` dari `sentence-transformers`.
- **Ollama** — untuk menjalankan LLM lokal seperti `deepseek-r1:7b`, `llama3`, dll.
- **Session Management** — menyimpan nama pengguna dalam sesi.

### 🖥️ Frontend (HTML + CSS + JavaScript)
- `login.html` — halaman login dengan animasi elegan.
- `main.js` — menangani logika upload file, streaming chat, dan UI interaktif.
- `style.css` — desain antarmuka modern dan responsif.
- `prism.js` & `prism.css` — digunakan untuk menampilkan kode yang dihasilkan AI dengan syntax highlighting.

---

## 🛠️ Fitur Utama

- ✅ **Login pengguna sederhana** (berbasis nama).
- 📤 **Upload dokumen PDF**.
- 💬 **Interaksi tanya jawab dengan LLM** berdasarkan konteks dokumen.
- ⚡ **Streaming jawaban secara real-time** (tanpa reload).
- 🧠 **Penggunaan LLM lokal via Ollama**.
- 🧹 **Fitur penghapusan konteks** agar dapat mengganti dokumen dengan yang baru.

---
