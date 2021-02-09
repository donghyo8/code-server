const jwt = require('jsonwebtoken');


// check user for authorization api
async function injectUerforAPI(req, res, next) {
	//Token 체크함 
    var authToken = req.header('authorization');
    
    if(!authToken) return res.status(401).send('Access Denied');
    
    if (authToken.startsWith("Bearer ")){
        authToken = authToken.substring(7, authToken.length);
    } else {
        return res.status(401).send('Access Denied');
    }

	try { 
        const verified = jwt.verify(authToken, process.env.TOKEN);
        req.user = verified;
		next();
	} catch (e) {
		console.log(e);
		res.status(401).send('Invailid Token');
	}
}

module.exports = {injectUerforAPI}