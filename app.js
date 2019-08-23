const express = require('express');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const exupload = require('express-fileupload');
const randomize = require('randomatic');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
const mongoose = require('mongoose');
const fs = require('fs');

// connection the MongoDB database
mongoose.connect('mongodb://localhost:27017/files', { useNewUrlParser: true })
    .then(() => console.log('Connected to Database...'))
    .catch(err => console.log(`Failed! Not Connected to the Database... ${err}`))

// init express
const app = express();

// Static file
app.use(express.static('public'));

// middleware
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');
app.use(bodyParser.json()).use(bodyParser.urlencoded({ extended: true }));
app.use(exupload());
app.use(cookieParser());
app.use(session({
    secret: 'secret123',
    saveUninitialized: true,
    resave: true
}));
app.use(flash());

// model
const FileSchema = new mongoose.Schema({
    file_id: {
        type: String,
        required: true
    },
    file_password: {
        type: String,
        required: true
    },
    file_name: {
        type: String,
        required: true
    },
    message: {
        type: String
    },
    date: {
        type: Date,
        default: Date.now
    }
});

const File = mongoose.model('File', FileSchema);

// routes
app.get('/', (req, res) => {
    res.render('index', {
        title: 'File Transfer',
        messages: req.flash('info'),
        type: req.flash('type')
    });
});

// handlers
app.post('/share', (req, res) => {
    if (req.files) {
        let file = req.files.file_input;
        let filename = file.name;

        // if file size greater than 2mb
        if (file.size > 2000000) {
            req.flash('info', 'Size of the file must be less than 2MB');
            req.flash('type', 'warning');
            res.redirect('/');
            return false;
        }

        else {
            let file_id_ = req.body.file_id;
            let file_pass_ = req.body.file_pass;
            let message_ = req.body.message;

            if (file_id_ === '') {
                req.flash('info', 'Please Enter the ID');
                req.flash('type', 'warning');
                res.redirect('/');
                return false;
            }
            else if (file_pass_ === '') {
                req.flash('type', 'warning');
                req.flash('info', 'Please Enter the Password');
                res.redirect('/');
                return;
            }

            else if (file_id_.length > 12 || file_pass_.length > 12) {
                req.flash('type', 'warning');
                req.flash('info', 'File id or File Password length must be less than 12 characters!');
                res.redirect('/');
                return;
            }

            else if (message_.length > 50) {
                req.flash('type', 'warning');
                req.flash('info', 'Message length must be less than 50 characters!');
                res.redirect('/');
                return;
            }

            else {
                File.findOne({ file_id: file_id_ })
                    .then((id) => {
                        if (id) {
                            req.flash('type', 'warning');
                            req.flash('info', 'File ID already Exists...');
                            res.redirect('/');
                            return
                        }
                        else {
                            let randomChar = randomize('A0', 18);
                            let fileExt = path.extname(filename);
                            let fileNewName = randomChar + fileExt;

                            file.mv("./public/userFiles/" + fileNewName, (err) => {
                                if (!err) {
                                    const newFile = new File({
                                        file_id: file_id_,
                                        file_password: file_pass_,
                                        file_name: fileNewName,
                                        message: message_
                                    });
                                    newFile.save()
                                        .then(() => {
                                            req.flash('type', 'success');
                                            req.flash('info', 'File Added successfully... Now you access the shared file.');
                                            res.redirect('/');
                                        })
                                        .catch((err) => {
                                            req.flash('type', 'warning');
                                            req.flash('info', 'Something went wrong! Please Try Again.');
                                            res.redirect('/');
                                        })
                                } else {
                                    req.flash('type', 'warning');
                                    req.flash('info', 'Something went wrong! Please Try Again.');
                                    res.redirect('/');
                                }
                            });
                        }
                    })
            }

        }
    }
    else {
        req.flash('type', 'warning');
        req.flash('info', 'No file chosen! Please Choose file which you want to share');
        res.redirect('/');
    }

});

app.post('/access', (req, res) => {
    let file_id_ = req.body.file_id;
    let file_pass_ = req.body.file_pass;

    if (file_id_ === '') {
        req.flash('info', 'Please Enter the ID');
        req.flash('type', 'warning');
        res.redirect('/');
        return false;
    }
    else if (file_pass_ === '') {
        req.flash('type', 'warning');
        req.flash('info', 'Please Enter the Password');
        res.redirect('/');
        return;
    }

    else if (file_id_.length > 12 || file_pass_.length > 12) {
        req.flash('type', 'warning');
        req.flash('info', 'File id or File Password length must be less than 12 characters!');
        res.redirect('/');
        return;
    }
    else {
        File.findOne({ file_id: file_id_ })
            .then((doc) => {
                if (!doc) {
                    req.flash('type', 'warning');
                    req.flash('info', 'Wrong ID! Please check it perfectly...');
                    res.redirect('/');
                    return;
                }
                else {
                    if (doc.file_password === file_pass_) {
                        res.render('file', {
                            title: 'File Accessed',
                            filecss: 'css/file.css',
                            f_name: doc.file_name,
                            message: doc.message,
                            obj_id: doc._id
                        })
                    }
                    else {
                        req.flash('type', 'warning');
                        req.flash('info', 'Wrong Password! Please check it perfectly...');
                        res.redirect('/');
                        return;
                    }
                }
            });
    }
});

app.get('/delete/:id', (req, res) => {
    File.findOne({ _id: req.params.id })
        .then((doc) => {
            if (doc) {
                let fname = doc.file_name;
                File.deleteOne({ _id: req.params.id }).exec()
                    .then(result => {
                        const filepath = path.dirname(__filename) + `/public/userFiles/${fname}`;
                        try {
                            fs.unlinkSync(filepath)
                            //file removed
                          } catch(err) {
                            console.error(err)
                          }
                        req.flash('type', 'success');
                        req.flash('info', 'File Seccessfully Removed');
                        res.redirect('/');
                    })
                    .catch(err => {
                        req.flash('type', 'danger');
                        req.flash('info', 'Something Went Wrong!');
                        res.redirect('/access');
                    });
            }
        })
});

// server
const PORT = process.env.PORT || 3000;
app.listen(PORT, console.log(`Server started on PORT ${PORT}`));