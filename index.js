
const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const { nanoid } = require("nanoid");
const QRCode = require("qrcode");

const app = express();
app.use(cors());
app.use(express.json());

app.use('/menus', express.static(path.join(__dirname, 'public/menus')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.use(express.static(path.join(__dirname, "public")));

const upload = multer({ dest: path.join(__dirname, "public/uploads") });

app.post("/upload-pdf", upload.single("pdf"), async (req, res) => {
  const originalExt = path.extname(req.file.originalname);
  const newFileName = `menu_${nanoid()}${originalExt}`;
  const newPath = path.join(__dirname, "public/uploads", newFileName);

  fs.renameSync(req.file.path, newPath);

  const url = `${req.protocol}://${req.get('host')}/uploads/${newFileName}`;

  try {
    const qrCode = await QRCode.toDataURL(url); // ✅ Generate QR as base64 image
    res.json({ url, qrCode }); // ✅ Return both
  } catch (err) {
    console.error("QR generation error:", err);
    res.status(500).json({ error: "Failed to generate QR code." });
  }
});

app.post('/generate', (req, res) => {
  const { menu, template, restaurantName } = req.body;
  const id = nanoid();

  const groupedMenu = menu.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const restaurantScript = `<script>window.restaurantName = ${JSON.stringify(restaurantName)};</script>`;
  const menuDataScript = `<script>window.menuData = ${JSON.stringify(groupedMenu)};</script>`;

  const templatePath = path.join(__dirname, 'templates', `${template}.html`);
  let html = fs.readFileSync(templatePath, 'utf-8');
  html = html.replace('{{menuDataScript}}', restaurantScript + menuDataScript);

  const outputPath = path.join(__dirname, 'public/menus', `${id}.html`);
  fs.writeFileSync(outputPath, html);

  const url = `https://restaurant-qrapp-server.onrender.com/menus/${id}.html`;
  res.json({ url });
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
