var http = require('http');
var url = require('url');
var express = require('express');
var fs = require('fs');

var app = express.createServer();
app.configure(function() {
   app.use(express.bodyParser());
   app.use(express.cookieParser());
   app.use(express.session({secret: '1234'}));
});

var html = '';
fs.readFile(__dirname+'/index.html', 'utf8', function(err, txt) {
   html = txt;
   start();
});

app.get('/twittertags/', function(req, res) {
   var url_parts = url.parse(req.url, true);
   var param = url_parts.query;

   var handle = param.twitterhandle;
   var type = param.responsetype;

   twittertags(handle, type, function(txt) {
      res.send(txt);
   });
});

function addTag(tags, hashtags, sug, urls) {
   var text;
   for(j in hashtags) {
      text = hashtags[j].text;
      var f = false;
      for(t in tags) {
         if(tags[t].tag == text) {
            tags[t].weight += 10;
            f = true;
            break;
         }
      }
      if(!f) {
         tags.push({
            tag: text,
            weight: 10
         });
      }
      addSug(sug, urls, text);
   }
}

function addSug(sug, urls, tag) {
   var url;
   for(j in urls) {
      url = urls[j].expanded_url || urls[j].url;
      var s_urls = sug[tag];
      if(typeof(s_urls) === 'undefined') {
         sug[tag] = [url];
         continue;
      }
      var f = false;
      for(k in s_urls) {
         if(s_urls[k] == url) {
            f = true;
            break;
         }
      }
      if(!f)
         sug[tag].push(url);
   }
}

function weightTags(json, tags, sug) {
   tags.sort(function(a,b) {
      return b.weight - a.weight;
   });

   var tag = [];
   var suggestions = [];
   var l = (tags.length < 10) ? tags.length : 10;
   for(var i = 0; i < l; i++) {
      tag.push(tags[i]);
      if(sug[tags[i].tag])
         suggestions = suggestions.concat(sug[tags[i].tag]);
   }
   json.tags = tag;
   json.suggestions = suggestions;
}

function twittertags(handle, type, callback) {
   var options = {
      host: 'api.twitter.com',
      port: 80,
      path: '/1/statuses/user_timeline.json?screen_name='+handle+'&count=200&trim_user=1&include_entities=1',
      method: 'GET'
   }
   var json = {
      twitterhandle: handle,
      tags: [],
      suggestions: []
   }
   var tags = [];
   var sug = {};

   var data = '';
   http.request(options, function(tw_res) {
      tw_res.setEncoding('utf8');
      tw_res.on('data', function (chunk) {
         data += chunk;
      });

      tw_res.on('end', function() {
         var o_data = JSON.parse(data);

         for(i in o_data) {
            var tweet = o_data[i];
            var hashtags = [];
            var urls = [];

            if(typeof(tweet.entities) !== 'undefined') {
               urls = tweet.entities.urls;
               hashtags = tweet.entities.hashtags;
            }

            addTag(tags, hashtags, sug, urls);
         }
         weightTags(json, tags, sug);

         if(type == 'json')
            return callback(JSON.stringify(json));

         html = html.replace('{{meta}}', JSON.stringify(json));
         callback(html);
      });
   }).end();
}

function start() {
   app.listen(1337);
   console.log('Starting server at http://127.0.0.1:80/');
}
