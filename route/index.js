var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.status(200).json({
    login: req.session.login,
    username: req.session.username,
    authority: req.session.authority,
    page: 'main'
  })
});
router.get('/logout', function(req, res){
  res.status(200);
  req.session.destroy(function(err){
    if(err){
      console.log("Session detroy erros")
    }else{
      res.redirect('/')
    }
  })
})
module.exports = router;
