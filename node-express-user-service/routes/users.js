var express = require('express');
var router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib'); // Using pdf-lib now

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

router.post('/register', async (req, res) => {
  try {
    const { username, password, name, surname, phone, email, dob, notification_status } = req.body;

    // Check if username exists
    const userCheck = await pool.query('SELECT * FROM "user".user WHERE username = $1', [username]);

    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const newUser = await pool.query(
        `INSERT INTO "user".user (username, password, name, surname, phone, email, dob, notification_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [username, hashedPassword, name, surname, phone, email, dob, notification_status]
    );

    res.status(201).json({ message: 'User registered successfully', user: newUser.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Check if user exists
    const userResult = await pool.query('SELECT * FROM "user".user WHERE username = $1', [username]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = userResult.rows[0];

    // Compare password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign(
        { user_id: user.user_id },
        process.env.JWT_SECRET,
        { expiresIn: '2h' }
    );

    res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Middleware to Verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(403).json({ error: 'Token required' });
  }
  const token = authHeader.split(' ')[1]; // Extract token from "Bearer <TOKEN>"
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user; // Store user in request
    next();
  });
};

// New route to fill PDF and return it as a response (GET /generate-pdf)
router.get('/generate-pdf', authenticateToken, async (req, res, next) => {
  try {
    const userId = parseInt(req.user.user_id, 10);
    const userResult = await pool.query('SELECT * FROM "tax_data".tax_data WHERE user_id = $1', [userId]);

    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลภาษีของผู้ใช้' });
    }

    // Load the PDF from disk
    const pdfPath = path.join(__dirname, '..', '271265PIT90.pdf');
    const pdfBytes = fs.readFileSync(pdfPath);

    // Load and fill the PDF with pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const data = userResult.rows[0];

    form.getTextField('Text71').setText(data.total_income);
    form.getTextField('Text81').setText(data.total_expenses);
    form.getTextField('Text90').setText(data.total_deduction);
    form.getTextField('Text72').setText(data.tax_payable);
    form.getTextField('Text88').setText(data.withheld_tax);
    form.getTextField('Text95').setText(data.final_tax_due);
    form.getTextField('Text94').setText(data.final_tax_rounded);

    const filledPdfBytes = await pdfDoc.save();

    // Return PDF as response
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(filledPdfBytes));
  } catch (error) {
    next(error);
  }
});

// Route: POST /users/generate-pdf-manual
router.post('/generate-pdf-manual', authenticateToken, async (req, res, next) => {
  try {
    // 1) ดึง user_id จาก token
    const userId = req.user.user_id;

    // 2) Query หา username จากตาราง user
    const userQuery = await pool.query('SELECT username FROM "user".user WHERE user_id = $1', [userId]);
    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const username = userQuery.rows[0].username;

    // 3) Extract data from req.body
    const {
      total_income,
      total_expenses,
      total_deduction,
      tax_payable,
      withheld_tax,
      final_tax_due,
      final_tax_rounded
    } = req.body;

    // 4) Load the PDF template
    const pdfPath = path.join(__dirname, '..', '271265PIT90.pdf');
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    // 5) Set form fields
    form.getTextField('Text71').setText(String(total_income || ''));
    form.getTextField('Text81').setText(String(total_expenses || ''));
    form.getTextField('Text90').setText(String(total_deduction || ''));
    form.getTextField('Text72').setText(String(tax_payable || ''));
    form.getTextField('Text88').setText(String(withheld_tax || ''));
    form.getTextField('Text95').setText(String(final_tax_due || ''));
    form.getTextField('Text94').setText(String(final_tax_rounded || ''));

    // 6) Generate the filled PDF (Buffer)
    const filledPdfBytes = await pdfDoc.save();

    // 7) สร้างชื่อไฟล์ตาม Username-YYYY.MM.DD-HH.mm.pdf
    const fileName = generateFileName(username);

    // 8) บันทึกไฟล์ลงในโฟลเดอร์ public/pdf_history
    const outputDir = path.join(__dirname, '..', 'public', 'pdf_history');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, fileName);
    fs.writeFileSync(outputPath, filledPdfBytes);

    // 9) เก็บ URL ของไฟล์ (สำหรับให้ client เรียกใช้งาน)
    const pdfUrl = `/pdfs/${fileName}`;

    // 10) บันทึกข้อมูลลงในตาราง tax_form โดยใช้ schema ที่ถูกต้อง (public)
    const taxDetails = `Created from tax calculator on ${new Date().toISOString()}`;
    const formStatus = 'pending';
    const insertQuery = `
      INSERT INTO "tax_form"."tax_form" (tax_details, pdf_data, form_status, user_id)
      VALUES ($1, $2, $3, $4)
      RETURNING form_id
    `;
    const insertValues = [taxDetails, pdfUrl, formStatus, userId];
    const insertResult = await pool.query(insertQuery, insertValues);

    // 11) ส่งข้อมูลกลับให้ client
    res.json({
      message: 'สร้าง PDF และบันทึกข้อมูลในฐานข้อมูลสำเร็จ',
      pdfUrl,
      formId: insertResult.rows[0].form_id
    });
  } catch (error) {
    next(error);
  }
});

/**
 * ฟังก์ชันสร้างชื่อไฟล์ในรูปแบบ
 * Username-YYYY.MM.DD-HH.mm.pdf
 */
function generateFileName(username) {
  // กรณี username มีช่องว่างหรืออักขระพิเศษ อาจต้อง sanitize
  const safeUsername = username.replace(/\s+/g, '_'); // แทน space ด้วย _

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');

  return `${safeUsername}-${year}.${month}.${day}-${hour}.${minute}.pdf`;
}

// Route: GET /users/pdf-history
router.get('/pdf-history', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    // Query ข้อมูลจากตาราง tax_form
    const result = await pool.query(`
      SELECT form_id, generated_at, tax_details, pdf_data, form_status
      FROM "tax_form"."tax_form"
      WHERE user_id = $1
      ORDER BY generated_at DESC
    `, [userId]);

    // Map ข้อมูลให้ตรงกับโครงสร้างที่ Frontend คาดหวัง
    const data = result.rows.map(row => ({
      name: row.tax_details || `Form #${row.form_id}`,
      date: row.generated_at,
      url: row.pdf_data
    }));

    res.json(data);
  } catch (error) {
    next(error);
  }
});

// Get User Data
router.get('/get-user', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.user.user_id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const userResult = await pool.query('SELECT * FROM "user".user WHERE user_id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userResult.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Route: GET /users/is-valid
router.get('/is-valid', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(403).json({ error: 'Token required' });
  }

  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });

    res.json({ message: 'Token is valid', user });
  });
});

// Update User Profile Route
router.post('/update-profile', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.user.user_id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const { name, surname, phone, email, dob, notification_status, password } = req.body;
    let updateFields = [];
    let values = [];

    if (name) {
      updateFields.push(`name = $${updateFields.length + 1}`);
      values.push(name);
    }
    if (surname) {
      updateFields.push(`surname = $${updateFields.length + 1}`);
      values.push(surname);
    }
    if (phone) {
      updateFields.push(`phone = $${updateFields.length + 1}`);
      values.push(phone);
    }
    if (email) {
      updateFields.push(`email = $${updateFields.length + 1}`);
      values.push(email);
    }
    if (dob) {
      updateFields.push(`dob = $${updateFields.length + 1}`);
      values.push(dob);
    }
    if (notification_status !== undefined) {
      updateFields.push(`notification_status = $${updateFields.length + 1}`);
      values.push(notification_status);
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push(`password = $${updateFields.length + 1}`);
      values.push(hashedPassword);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    const queryStr = `
      UPDATE "user".user 
      SET ${updateFields.join(', ')}
      WHERE user_id = $${updateFields.length + 1}
      RETURNING *
    `;
    values.push(userId);

    const updatedUser = await pool.query(queryStr, values);
    if (updatedUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Profile updated successfully', user: updatedUser.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Route: POST /users/toggle-notification
router.post('/toggle-notification', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.user.user_id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const { notification_status } = req.body;
    if (notification_status === undefined) {
      return res.status(400).json({ error: 'Notification status is required' });
    }

    const updatedUser = await pool.query(
        'UPDATE "user".user SET notification_status = $1 WHERE user_id = $2 RETURNING *',
        [notification_status, userId]
    );

    if (updatedUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: `Notification status updated to ${notification_status}`, user: updatedUser.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
