const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const PDFMerger = require('pdf-merger-js').default;

const app = express();
const PORT = 3000;

const uploadDir = path.join(__dirname, 'uploads');
const mergedDir = path.join(__dirname, 'merged');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
if (!fs.existsSync(mergedDir)) fs.mkdirSync(mergedDir);

// 必要：formのPOSTデータ受け取り用
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

app.use('/uploads', express.static(uploadDir));

// 📄 動的HTML生成：アップロードとファイル一覧＋削除ボタン付き
app.get('/', (req, res) => {
  const files = fs.readdirSync(uploadDir).filter(f => f.endsWith('.pdf'));
  const fileListHtml = files.length
    ? files.map(f => `
      <li>
        <a href="/uploads/${f}" target="_blank">${f}</a>
        <form action="/delete" method="post" style="display:inline">
          <input type="hidden" name="filename" value="${f}" />
          <button type="submit" onclick="return confirm('本当に削除しますか？')">🗑削除</button>
        </form>
      </li>
    `).join('')
    : '<li>（まだファイルはありません）</li>';

  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <title>PDFアップローダー</title>
    </head>
    <body>
      <h1>PDFアップロード</h1>
      <form action="/upload" method="post" enctype="multipart/form-data">
        <input type="file" name="pdf" accept=".pdf" required />
        <button type="submit">アップロード</button>
      </form>

      <h2>アップロード済みのPDF</h2>
      <ul>
        ${fileListHtml}
      </ul>

      <p><a href="/merge">PDFをすべて結合してダウンロード</a></p>
    </body>
    </html>
  `);
});

// 📤 アップロード
app.post('/upload', upload.single('pdf'), (req, res) => {
  if (!req.file) return res.status(400).send('ファイルがありません');
  res.redirect('/');
});

// 🗑 削除処理
app.post('/delete', (req, res) => {
  const filename = req.body.filename;
  const filePath = path.join(uploadDir, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`削除: ${filename}`);
  }
  res.redirect('/');
});

// 📦 PDF結合＆ダウンロード
app.get('/merge', async (req, res) => {
  const files = fs.readdirSync(uploadDir).filter(f => f.endsWith('.pdf'));
  if (files.length === 0) return res.status(400).send('PDFが1つもありません');

  const merger = new PDFMerger();
  for (const file of files) {
    const filePath = path.join(uploadDir, file);
    await merger.add(filePath);
  }

  const outputPath = path.join(mergedDir, 'merged.pdf');
  await merger.save(outputPath);
  res.download(outputPath, 'merged.pdf');
});

app.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
});
