var express = require('express');
var router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const {PDFDocument} = require('pdf-lib'); // <-- Using pdf-lib now


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


// New route to fill PDF and return it as a response:
router.get('/generate-pdf', authenticateToken, async (req, res, next) => {
  try {

    const userId = parseInt(req.user.user_id, 10);
    const userResult = await pool.query('SELECT * FROM "tax_data".tax_data WHERE user_id = $1', [userId]);

    // 2) Load the PDF from disk
    const pdfPath = path.join(__dirname, '..', '271265PIT90.pdf');
    const pdfBytes = fs.readFileSync(pdfPath);

    // 3) Load and fill the PDF with pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Get the form in the PDF
    const form = pdfDoc.getForm();
    const fields = form.getFields();

    fields.forEach((field, idx) => {
      const type = field.constructor.name; // e.g. 'PDFTextField', 'PDFCheckBox', etc.
      const name = field.getName();
      console.log(`Field ${idx + 1}: "${name}" (type: ${type})`);
    });


    const total_income = form.getTextField('Text71');
    total_income.setText(userResult.rows[0].total_income);
    const total_expenses = form.getTextField('Text81');
    total_expenses.setText(userResult.rows[0].total_expenses);
    const total_deduction = form.getTextField('Text90');
    total_deduction.setText(userResult.rows[0].total_deduction);
    const tax_payable = form.getTextField('Text72');
    tax_payable.setText(userResult.rows[0].tax_payable);
    const withheld_tax = form.getTextField('Text88');
    withheld_tax.setText(userResult.rows[0].withheld_tax);
    const final_tax_due = form.getTextField('Text95');
    final_tax_due.setText(userResult.rows[0].final_tax_due);
    const final_tax_rounded = form.getTextField('Text94');
    final_tax_rounded.setText(userResult.rows[0].final_tax_rounded);


    // 4) Save the filled PDF
    const filledPdfBytes = await pdfDoc.save();

    // 5) Return the PDF in the response
    res.setHeader('Content-Type', 'application/pdf');

    res.send(Buffer.from(filledPdfBytes));
  } catch (error) {
    next(error);
  }
});

// Example: POST /users/generate-pdf-manual
router.post('/generate-pdf-manual', async (req, res, next) => {
  try {
    // 1) Extract data from req.body
    //    Ensure the client sends fields like { total_income: "...", total_expenses: "..." } in JSON.
    const {
      total_income,
      total_expenses,
      total_deduction,
      tax_payable,
      withheld_tax,
      final_tax_due,
      final_tax_rounded
    } = req.body;

    // 2) Load the PDF
    const pdfPath = path.join(__dirname, '..', '271265PIT90.pdf');
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();

    // 3) Set form fields from the request body
    //    Convert everything to strings just to be safe:
    form.getTextField('Text71').setText(String(total_income || ''));
    form.getTextField('Text81').setText(String(total_expenses || ''));
    form.getTextField('Text90').setText(String(total_deduction || ''));
    form.getTextField('Text72').setText(String(tax_payable || ''));
    form.getTextField('Text88').setText(String(withheld_tax || ''));
    form.getTextField('Text95').setText(String(final_tax_due || ''));
    form.getTextField('Text94').setText(String(final_tax_rounded || ''));

    // If you want to flatten form fields so they're no longer editable, uncomment below:
    // form.flatten();

    // 4) Generate the filled PDF
    const filledPdfBytes = await pdfDoc.save();

    // 5) Return the PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(filledPdfBytes));
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

    // Fetch user details
    const userResult = await pool.query('SELECT * FROM "user".user WHERE user_id = $1', [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(userResult.rows[0]); // Return user details
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Add is-valid route to check if JWT is valid
router.get('/is-valid', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(403).json({ error: 'Token required' });
  }

  const token = authHeader.split(' ')[1]; // Extract token from "Bearer <TOKEN>"

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });

    res.json({ message: 'Token is valid', user });
  });
});

// Update User Profile Route
router.post('/update-profile', authenticateToken, async (req, res) => {
  try {
    // Extract user ID from JWT
    const userId = parseInt(req.user.user_id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // Extract possible fields from the request body
    const { name, surname, phone, email, dob, notification_status, password } = req.body;

    // Build dynamic query parts
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
    // Allow updating notification_status even if false or 0
    if (notification_status !== undefined) {
      updateFields.push(`notification_status = $${updateFields.length + 1}`);
      values.push(notification_status);
    }
    if (password) {
      // Hash the new password before updating
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push(`password = $${updateFields.length + 1}`);
      values.push(hashedPassword);
    }

    // Ensure that at least one field is provided for update
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    // Construct the query with parameterized values
    const queryStr = `
      UPDATE "user".user 
      SET ${updateFields.join(', ')}
      WHERE user_id = $${updateFields.length + 1}
      RETURNING *
    `;
    values.push(userId);

    // Execute the update query
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

// เพิ่ม route สำหรับ toggle notification status
router.post('/toggle-notification', authenticateToken, async (req, res) => {
  try {
    // 1. ตรวจสอบ user_id จาก token
    const userId = parseInt(req.user.user_id, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    // 2. ดึงค่า notification_status จาก request body
    const { notification_status } = req.body;
    if (notification_status === undefined) {
      return res.status(400).json({ error: 'Notification status is required' });
    }

    // 3. อัปเดตค่า notification_status ใน database โดยใช้ parameter
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