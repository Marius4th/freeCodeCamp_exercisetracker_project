const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

require('dotenv').config();

const app = express();
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const userSchema = new mongoose.Schema({
  username: {type: String, require: true},
  log: [{
    description: {type: String, require: true},
    duration: {type: Number, require: true},
    date: Date
  }]
});

const User = mongoose.model('User', userSchema);

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
          console.log('User already exists ', username);
          return res.json({username, _id: fu._id});
        }

        // Add user to DB
        const u = await User.create({username});
        await u.save();
        res.json({username, _id: u._id});
        //console.log({username, _id: u._id});
      }
      else {
        console.error('Username parameter is empty!');
        return res.json({error: 'Username parameter is empty!'});
      }
  }
  catch(error) { 
    console.error(error)
    return res.json({error: error.toString()}); 
  }
// Get users list
}).get(async (req, res) => {
  try {
    const users = await User.find({}).select('_id username');
    res.json(users);
  }
  catch(error) { 
    console.error(error);
    return res.json({error: error.toString()}); 
  }
});

// Add exercise
app.post('/api/users/:_id/exercises', async (req, res) => {
  try {
    const id = req.params._id;
    const user = await User.findOne({_id: id});

    if (user) {
      // Validate data
      const date = req.body.date ? (new Date(req.body.date)).toDateString() : (new Date()).toDateString();
      const description = req.body.description;
      const duration = parseInt(req.body.duration);
      if (!description || !duration) {
        console.error('Missing input data!');
        console.error(req.body);
        return res.json({error: 'Missing input data!'});
      }

      // Save data to DB
      const exercise = {
        description,
        duration,
        date};
      user.log.push(exercise);
      await user.save();

      // Show saved data to user
      res.json({_id: user._id, username: user.username, description, duration, date});
    }
    else {
      console.error('User id not found ', id);
      res.json({error: 'User id not found!'});
    }
  }
  catch(error) { 
    console.error(error);
    return res.json({error: error.toString()}); 
  }
});

// Get user log
app.get('/api/users/:_id/logs', async (req, res) => {
  try {
    const id = req.params._id;
    if (id) {
    const limit = parseInt(req.query.limit) || null;
    const from = req.query.from || (new Date(0)).toDateString();
    const to = req.query.to || (new Date()).toDateString();
    const user = await User.findById(id, {log: {
      $filter: {
        input: "$log", as: "item",
        cond: {$and: [
          {$gte: ["$$item.date", new Date(from)]},
          {$lte: ["$$item.date", new Date(to)]}
        ]},
        limit: limit
      }
    }});
      
      if (user) {
        res.json({
          _id: id,
          username: user.username, 
          count: user.log.length, 
          log: user.log.map(item => ({
            description: item.description,
            duration: item.duration,
            date: (new Date(item.date)).toDateString()
          }))
        });
      }
      else {
        console.error('User not found ', id);
        return res.json({error: 'User not found!'});
      }
    }
    else {
      console.error('Must provide a user id!');
      return res.json({error: 'Must provide a user id!'});
    }
  }
  catch(error) { 
    console.error(error);
    return res.json({error: error.toString()}); 
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port);
})
