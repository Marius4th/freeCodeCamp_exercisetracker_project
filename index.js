const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

require('dotenv').config();

const app = express();
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
  username: {type: String, require: true}
});

const exerciseSchema = new mongoose.Schema({
  user_id: {type: String, require: true},
  description: {type: String, require: true},
  duration: {type: Number, require: true},
  date: Date
});

const logSchema = new mongoose.Schema({
  user_id: {type: String, require: true},
  date: Date,
  data: Object
});

const User = mongoose.model('User', userSchema);
const Exercise = mongoose.model('Exercise', exerciseSchema);
const Log = mongoose.model('Log', logSchema);

app.use(cors());
app.use(bodyParser.urlencoded({extended: false}));
app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Add user
app.route('/api/users').post(async (req, res) => {
  const username = req.body.username;
  
  try { 
    if (username.length > 0) {
        // Check user doesn't exist
        const fu = await User.findOne({username});
        if (fu) {
          res.json({error: 'User already exists!'});
          return;
        }

        // Add user to DB
        const u = await User.create({username});
        await u.save();
        res.json({username, _id: u._id});
      }
      else res.json({error: 'Username parameter is empty!'});
  }
  catch(error) { 
    console.error(error)
    res.json({error: error.toString()}); 
  }
// Get users list
}).get(async (req, res) => {
  try {
    const users = await User.find({}).select('_id username');
    res.json(users);
  }
  catch(error) { 
    console.error(error);
    res.json({error: error.toString()}); 
  }
});

// Add exercise
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const id = req.body[':_id'];
    const user = await User.findById(id);

    if (user) {
      // Validate data
      const date = req.body.date || (new Date()).toDateString();
      const description = req.body.description;
      const duration = req.body.duration;
      if (!description || !duration) {
        res.json({error: 'Missing input data!'});
        return;
      }

      // Save data to DB
      const ex = await Exercise.create({user_id: id, description, duration, date});
      await ex.save();
      // Add log
      const nlog = await Log.create({user_id: id, date: (new Date()).toDateString(), data: {
        description: ex.description,
        duration: ex.duration,
        date: ex.date}
      });
      nlog.save();
      // Show saved data to user
      res.json({
        _id: id,
        username: user.username,
        date: (new Date(ex.date)).toDateString(),
        duration: ex.duration,
        description: ex.description,
      });
    }
    else res.json({error: 'User id not found!'});
  }
  catch(error) { 
    console.error(error);
    res.json({error: error.toString()}); 
  }
});

// Get user log
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const id = req.params._id;
    if (id) {
      const user = await User.findById(id);
      const limit = req.query.limit || 0;
      const from = req.query.from || (new Date(0)).toDateString();
      const to = req.query.to || (new Date()).toDateString();
      const logs = await Log.find({user_id: id, date: { $gte: from, $lte: to }}).select('data').limit(limit);
      const logsData = logs.map(x => ({description: x.data.description, duration: x.data.duration, date: (new Date(x.data.date)).toDateString()}));

      if (logs && user) {
        res.json({
          _id: id,
          username: user.username, 
          count: logs.length, 
          log: [...logsData]
        });
      }
      else res.json({error: 'User or Log not found!'});
    }
    else res.json({error: 'Must provide a user id!'});
  }
  catch(error) { 
    console.error(error);
    res.json({error: error.toString()}); 
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
})
