var express = require('express');
var router = express.Router();
var docker = require('../modules/docker-run');
const db = require('../modules/db-connection');
const sql = require('../sql');

var downTime = {};

router.controller = function(io) {
	io.on("connection", async function(socket){
		try{
			const [rows] = await db.query(sql.user.getUserContainerByApi, [socket.handshake.query.user]);
			if(rows.length == 1){
				console.log("connect code-server:", rows[0].containername);
				clearTimeout(downTime[rows[0].containername]);
				delete(downTime[rows[0].containername]);
			}
		} catch(error){
		}
		
		socket.on('disconnect', async () => {
			try{
				const [rows] = await db.query(sql.user.getUserContainerByApi, [socket.handshake.query.user]);
				if(rows.length == 1){
					console.log("disconnect code-server:", rows[0].containername);
					downTime[rows[0].containername] = setTimeout(() => {docker.setDownContainer(rows[0].containername); console.log("down container:", rows[0].containername); delete(downTime[rows[0].containername]);}, 600 * 1000);

					console.log(downTime);
					//setTimeout(() => console.log("test"), 60000);
				}
			} catch(error){
			}
		})
	})
}

module.exports = router;
