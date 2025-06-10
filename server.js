const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const PDFMerger = require('pdf-merger-js').default;
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000; // RenderではPORTを環境変数で指定

const uploadDir = path.join(__dirname, 'uploads');
const mergedDir = path.join(__dirname, 'merged');

// フォルダ作成
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(mergedDir)) fs.mkdirSync(mergedDir);

// ✅ CORS設定：特定オリジンを許可
app.use(cors({
  origin: 'https://tokuhara.nkmr.io', // ← フロントエンドのURL
  methods: ['GET', 'POST'],
  credentials: false // 認証情報がないなら false
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// multer設定
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// 静的ファイル（Renderでは不要かも）
// app.use('/merger/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

// --- API ---

// PDF一覧取得
app.get('/api/files', (req, res) => {
  const files = fs.readdirSync(uploadDir).filter(f => f.endsWith('.pdf'));
  res.json(files);
});

// アップロード処理
app.post('/api/upload', upload.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'ファイルがありません' });
  res.json({ message: 'アップロード成功', filename: req.file.filename });
});

// 削除処理
app.post('/api/delete', (req, res) => {
  const { filename } = req.body;
  const filePath = path.join(uploadDir, filename);
  if (!filename || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'ファイルが存在しません' });
  }
  fs.unlinkSync(filePath);
  res.json({ message: '削除成功' });
});

// PDF結合処理
app.get('/api/merge', async (req, res) => {
  const files = fs.readdirSync(uploadDir).filter(f => f.endsWith('.pdf'));
  if (files.length === 0) return res.status(400).json({ error: 'PDFがありません' });

  const merger = new PDFMerger();
  for (const file of files) {
    await merger.add(path.join(uploadDir, file));
  }

  const outputPath = path.join(mergedDir, 'merged.pdf');
  await merger.save(outputPath);
  res.download(outputPath, 'merged.pdf');
});

// サーバー起動（Render対応）
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
