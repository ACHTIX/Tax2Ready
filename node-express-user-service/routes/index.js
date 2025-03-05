// Install first:
// npm install pdf-lib

const express = require('express');
const router = express.Router();
const {PDFDocument} = require('pdf-lib'); // <-- Using pdf-lib now
const fs = require('fs');
const path = require('path');

// Existing route (no changes):
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});


module.exports = router;