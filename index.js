var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const serverless = require('serverless-http');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const bodyParser = require('body-parser');
const AWS = require('aws-sdk');
var multer = require('multer')
var multerS3 = require('multer-s3')
 
var s3 = new AWS.S3()
 
var uploadS3 = multer({
  storage: multerS3({
    s3: s3,
    bucket: 'myflashcards-storage',
    acl: 'public-read',
    metadata: function (req, file, cb) {
      cb(null, {fieldName: file.fieldname});
    },
    key: function (req, file, cb) {
      cb(null, Date.now().toString() + '.jpg')
    }
  })
})

var uploadLocal = multer({ dest: 'uploads/'})

var app = express();
const USERS_TABLE = process.env.USERS_TABLE;
const IS_OFFLINE = process.env.IS_OFFLINE;
let dynamoDb;
if (IS_OFFLINE === 'true') {
  dynamoDb = new AWS.DynamoDB.DocumentClient({
    region: 'localhost',
    endpoint: 'http://localhost:8000'
  })
  console.log(dynamoDb);
} else {
  dynamoDb = new AWS.DynamoDB.DocumentClient();
  console.log('there is no offline variable');
};

app.use(bodyParser.json({ strict: false }));

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
// app.use(function(req, res, next) {
//   next(createError(404));
// });

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.post('/upload', uploadS3.single('image'), function(req, res, next) {
  res.send(req.file)
})

app.get('/cards/:cardId', function (req, res) {
  const params = {
    TableName: USERS_TABLE,
    Key: {
      cardId: req.params.cardId,
      word: 'amica'
    },
  }

  dynamoDb.get(params, (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not get user' });
      return
    }
    if (result.Item) {
      res.json(result);
    } else {
      res.status(404).json({ error: "User not found" });
    }
  });
})

// Create User endpoint
app.post('/cards', function (req, res) {
  const { cardId, word, repeatTime, images, audio, direction } = req.body;
  if (typeof cardId !== 'string') {
    res.status(400).json({ error: '"userId" must be a string' });
    return
  } else if (typeof word !== 'string') {
    res.status(400).json({ error: '"word" must be a string' });
    return
  }

  const params = {
    TableName: USERS_TABLE,
    Item: {
      cardId: cardId,
      word: word,
      repeatTime, 
      images, 
      audio, 
      direction
    },
  };

  dynamoDb.put(params, (error) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: 'Could not create user' });
    }
    res.json({ cardId, word });
  });
})
app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
})
module.exports.handler = serverless(app);
