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

// ✅ Ensure required folders exist
const menusDir = path.join(__dirname, "public/menus");
const uploadsDir = path.join(__dirname, "public/uploads");

if (!fs.existsSync(menusDir)) {
  fs.mkdirSync(menusDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ✅ Serve static files
app.use('/menus', express.static(menusDir));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, "public")));

// ✅ Setup Multer for file uploads
const upload = multer({ dest: uploadsDir });

// ✅ Upload PDF and generate QR code
app.post("/upload-pdf", upload.single("pdf"), async (req, res) => {
  try {
    const originalExt = path.extname(req.file.originalname);
    const newFileName = `menu_${nanoid()}${originalExt}`;
    const newPath = path.join(uploadsDir, newFileName);

    fs.renameSync(req.file.path, newPath);

    const url = `${req.protocol}://${req.get('host')}/uploads/${newFileName}`;
    const qrCode = await QRCode.toDataURL(url); // ✅ Generate base64 QR code

    res.json({ url, qrCode }); // ✅ Return both URL and QR code
  } catch (err) {
    console.error("QR generation error:", err);
    res.status(500).json({ error: "Failed to upload PDF or generate QR." });
  }
});

// ✅ Generate HTML menu page from data and template
app.post('/generate', (req, res) => {
  try {
    const { menu, template, restaurantName } = req.body;
    const id = nanoid();

    if (!menu || !template || !restaurantName) {
      return res.status(400).json({ error: "Missing menu data, template, or restaurant name." });
    }

    const groupedMenu = menu.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});

    const restaurantScript = `<script>window.restaurantName = ${JSON.stringify(restaurantName)};</script>`;
    const menuDataScript = `<script>window.menuData = ${JSON.stringify(groupedMenu)};</script>`;

    const templatePath = path.join(__dirname, 'templates', `${template}.html`);

    if (!fs.existsSync(templatePath)) {
      return res.status(404).json({ error: "Template not found." });
    }

    let html = fs.readFileSync(templatePath, 'utf-8');
    html = html.replace('{{menuDataScript}}', restaurantScript + menuDataScript);

    const outputPath = path.join(menusDir, `${id}.html`);
    fs.writeFileSync(outputPath, html);

    const url = `${req.protocol}://${req.get('host')}/menus/${id}.html`;
    res.json({ url });

  } catch (err) {
    console.error("Error in /generate:", err);
    res.status(500).json({ error: "Failed to generate menu." });
  }
});

// ✅ Start server on correct port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
