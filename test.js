const pdfFillForm = require('pdf-fill-form');
const fs = require('fs');
const path = require('path');

(async () => {
    try {
        // Replace with the actual path to your PDF
        const pdfPath = path.join(__dirname, '271265PIT90.pdf');
        const pdfData = fs.readFileSync(pdfPath);

        // pdf-fill-form.read(pdfData) returns a Promise with array of fields
        const fields = await pdfFillForm.read(pdfData);

        console.log('Fields:', fields);
    } catch (err) {
        console.error('Error reading PDF form fields:', err);
    }
})();