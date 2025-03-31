require('dotenv').config();
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');

const app = express();

// Middlewares
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
const indexRouter = require('./routes/index');
app.use('/', indexRouter);

const usersRouter = require('./routes/users');
app.use('/users', usersRouter);

const taxDataRouter = require('./routes/tax-data');
app.use('/tax-data', taxDataRouter);

const contactRouter = require('./routes/contact');
app.use('/contact', contactRouter);

const notificationRouter = require('./routes/notification');
app.use('/notification', notificationRouter);


const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// เรียกใช้งาน cron job เพียงครั้งเดียว
require('./cron');

module.exports = app;
