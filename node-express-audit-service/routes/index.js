// Install first:
// npm install pdf-fill-form

const express = require('express');
const router = express.Router();
const pdfFillForm = require('pdf-fill-form');
const fs = require('fs');
const path = require('path');

// Existing route (no changes):
router.get('/', function (req, res, next) {
    res.render('index', {title: 'Express'});
});

// New route to fill PDF and return it as a response:
router.get('/generate-pdf', async (req, res, next) => {
    try {
        // 1) Define or collect data (you might get it from req.query or req.body)
        const formData = {
            // The keys must match the field names in your PDF.
            // For example, if your PDF has a field named "TextField1", do:
            // "TextField1": "Some value"
            "TextField1": "John Doe",
            "TextField2": "1234567890",
            // ... add as many fields as you need
        };

        // 2) Read your PDF file into a buffer
        // Adjust the path if 271265PIT90.pdf is stored differently
        const pdfPath = path.join(__dirname, '..', '271265PIT90.pdf');
        const pdfBuffer = fs.readFileSync(pdfPath);

        // 3) Fill the PDF using pdf-fill-form
        //    pdf-fill-form.write returns a Promise with the filled PDF as a Buffer
        const filledPdfBuffer = await pdfFillForm.write(pdfBuffer, formData, {save: 'pdf'});

        // 4) Return the filled PDF to the client
        res.setHeader('Content-Type', 'application/pdf');
        // If you want the browser to “download” it instead:
        // res.setHeader('Content-Disposition', 'attachment; filename="filled-form.pdf"');
        res.send(filledPdfBuffer);

    } catch (error) {
        next(error);
    }
});

module.exports = router;