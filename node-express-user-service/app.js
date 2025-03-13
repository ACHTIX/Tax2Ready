require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');

var app = express();

// Middlewares (เรียกครั้งเดียว)
app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ให้บริการไฟล์ static จากโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));

// ให้บริการไฟล์ PDF จากโฟลเดอร์ pdf_history ผ่าน URL /pdfs
app.use('/pdfs', express.static(path.join(__dirname, 'public', 'pdf_history')));

// Routes
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var taxDataRouter = require('./routes/tax-data');

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/tax-data', taxDataRouter);

var PORT = 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

require('./cron'); // เรียก cron job เพียงครั้งเดียว

module.exports = app;
