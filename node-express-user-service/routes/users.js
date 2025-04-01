var express = require('express');
var router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const {PDFDocument, rgb} = require('pdf-lib');
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



router.get('/generate-pdf', authenticateToken, async (req, res, next) => {
  try {
    const userId = parseInt(req.user.user_id, 10);
    const userResult = await pool.query(
        'SELECT * FROM "tax_data".tax_data WHERE user_id = $1',
        [userId]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลภาษีของผู้ใช้' });
    }

    const data = userResult.rows[0];
    const pdfPath = path.join(__dirname, '..', '271265PIT90.pdf');
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const page1 = pages[0];

    page1.drawText(String(data.total_income || ''), {x: 400, y: 660, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(data.total_expenses || ''), {x: 400, y: 640, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(data.total_deduction || ''), {x: 400, y: 620, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(data.tax_payable || ''), {x: 400, y: 600, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(data.withheld_tax || ''), {x: 400, y: 580, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(data.final_tax_due || ''), {x: 400, y: 560, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(data.final_tax_rounded || ''), {x: 400, y: 540, size: 10, color: rgb(0, 0, 0)});

    const filledPdfBytes = await pdfDoc.save();
    const base64Pdf = Buffer.from(filledPdfBytes).toString('base64');

    const taxDetails = `Created from tax calculator on ${new Date().toISOString()}`;
    const formStatus = 'pending';

    const insertQuery = `
      INSERT INTO "tax_form"."tax_form" (user_id, tax_details, form_status, file_pdf)
      VALUES ($1, $2, $3, $4) RETURNING form_id
    `;
    const insertValues = [userId, taxDetails, formStatus, base64Pdf];
    const insertResult = await pool.query(insertQuery, insertValues);

    res.json({
      message: 'PDF created and stored successfully',
      base64Pdf,
      formId: insertResult.rows[0].form_id,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/generate-pdf-manual', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    const userQuery = await pool.query(
        'SELECT username FROM "user".user WHERE user_id = $1',
        [userId]
    );
    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const username = userQuery.rows[0].username;

    const {
      total_income,
      total_expenses,
      total_deduction,
      tax_payable,
      withheld_tax,
      final_tax_due,
      final_tax_rounded,
    } = req.body;

    const pdfPath = path.join(__dirname, '..', '271265PIT90.pdf');
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();

    // Use page 1 (index 0) — replace with correct index if needed
    const page1 = pages[0];

    // Draw text at specific (x, y) positions — adjust positions as needed
    page1.drawText(String(total_income || ''), {x: 400, y: 660, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(total_expenses || ''), {x: 400, y: 640, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(total_deduction || ''), {x: 400, y: 620, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(tax_payable || ''), {x: 400, y: 600, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(withheld_tax || ''), {x: 400, y: 580, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(final_tax_due || ''), {x: 400, y: 560, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(final_tax_rounded || ''), {x: 400, y: 540, size: 10, color: rgb(0, 0, 0)});

    const filledPdfBytes = await pdfDoc.save();
    const fileName = generateFileName(username);
    const outputDir = path.join(__dirname, '..', 'public', 'pdf_history');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, fileName);
    fs.writeFileSync(outputPath, filledPdfBytes);

    const pdfUrl = `/pdfs/${fileName}`;
    const taxDetails = `Created from tax calculator on ${new Date().toISOString()}`;
    const formStatus = 'pending';
    const insertQuery = `
      INSERT INTO "tax_form"."tax_form" (tax_details, pdf_data, form_status, user_id)
      VALUES ($1, $2, $3, $4) RETURNING form_id
    `;
    const insertValues = [taxDetails, pdfUrl, formStatus, userId];
    const insertResult = await pool.query(insertQuery, insertValues);

    res.json({
      message: 'สร้าง PDF และบันทึกข้อมูลในฐานข้อมูลสำเร็จ',
      pdfUrl,
      formId: insertResult.rows[0].form_id,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/generate-pdf-test', async (req, res, next) => {
  try {
    const {
      total_income,
      total_expenses,
      total_deduction,
      tax_payable,
      withheld_tax,
      final_tax_due,
      final_tax_rounded,
    } = req.body;

    // 1. Load the PDF template
    const pdfPath = path.join(__dirname, '..', '271265PIT90.pdf');
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const page1 = pages[0]; // adjust this index if needed for another page

    // 2. Draw each value at (x, y) — adjust these manually as needed
    page1.drawText(String(total_income || 'fdfd'), {x: 400, y: 660, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(total_expenses || 'sdf'), {x: 400, y: 640, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(total_deduction || 'xcvx'), {x: 400, y: 620, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(tax_payable || 'ghdf'), {x: 400, y: 600, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(withheld_tax || 'wsdf'), {x: 400, y: 580, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(final_tax_due || 'gdfhdg'), {x: 400, y: 560, size: 10, color: rgb(0, 0, 0)});
    page1.drawText(String(final_tax_rounded || 'xcvxv'), {x: 400, y: 540, size: 10, color: rgb(0, 0, 0)});

    // 3. Save filled PDF to buffer
    const filledPdfBytes = await pdfDoc.save();

    // 4. Save to file
    const fileName = 'test.pdf';
    const outputDir = path.join(__dirname, '..', 'public', 'pdf_history');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, {recursive: true});
    }
    const outputPath = path.join(outputDir, fileName);
    fs.writeFileSync(outputPath, filledPdfBytes);

    // 5. Return PDF URL to client
    const pdfUrl = `/pdfs/${fileName}`;
    res.json({
      message: 'สร้าง PDF และบันทึกข้อมูลในฐานข้อมูลสำเร็จ',
      pdfUrl,
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

    const result = await pool.query(`
      SELECT form_id, generated_at, tax_details, form_status, file_pdf
      FROM "tax_form"."tax_form"
      WHERE user_id = $1
      ORDER BY generated_at DESC
    `, [userId]);

    const data = result.rows.map(row => ({
      name: row.tax_details || `Form #${row.form_id}`,
      date: row.generated_at,
      base64Pdf: row.file_pdf,
      formId: row.form_id,
      status: row.form_status
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
