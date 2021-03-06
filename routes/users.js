var express = require('express');
var router = express.Router();
var docker = require('../modules/docker-run');
const db = require('../modules/db-connection');
const sql = require('../sql');
const jwt = require('jsonwebtoken')
const fileController = require('../modules/file-controller');

const { injectUerforAPI } = require('../modules/check-login-middleware');
const { response } = require('express');
const { user } = require('../sql');

// check user for authentication
// check user for authentication
router.post('/login', async function (req, res, next) {
	const { id, password } = req.body;
	//! password don't compare
	try {
		const [rows] = await db.query(sql.user.getUserById, [id])
		if (rows.length == 1) {
			//로그인 성공인 경우에는 해당하는 사용자의 정보들 전체 다시 보냄
			req.session.username = rows.user_id;
			req.session.login = 'login';
			req.session.save(() => {
				/**
				 * sign 만들시 다음 정보를 입력해주어야한다.
				 * 1. userid
				 * 2. moment().unix();
				 * 3. name
				 */
				const token = jwt.sign({ _user: rows }, process.env.TOKEN);
				res.header('auth-token', token).send({
					result: true,
					jwt: token,
					message: "해당하는 유저가 확장"
				});
			});
		} else {
			res.status(401).send({
				result: false,
				data: [],
				message: '해당하는 유저가 존재하지 않습니다'
			});
		}
	} catch (error) {
		console.log(error)
	}
});

// check user for authentication
router.post('/auth', injectUerforAPI, async function (req, res, next) {
	try {
		res.status(200).send({
			result: true,
			data: req.user._user[0],
			message: '사용자 정보',
			isAuth: true
		})
	} catch (error) {
		console.log(`Auth error ${error}`)
	}
});

router.post('/createfolder', async function (req, res, next){
	try {
		const { user_id } = req.body;
		console.log(user_id)
		fileController.createProjectFolder(`user${user_id}`);
	} catch (error) {
		console.log(error)
	}
})

router.post('/gettimecreated',  async function (req, res, next){
	const { userId } = req.body
	try {
		const [rows] = await db.query(sql.user.getUserById, [userId]);
		if(rows.length == 1)
		{
			var timecreated = rows[0].username + rows[0].timecreated;
			res.status(200).send({
				result: true,
				data: timecreated,
				message: `해당하는 사용자의 Time created 값을 출력함`
			})
		}else{
			res.status(201).send({
				result: true,
				data: [],
				message: `해당하는 사용자의 정보가 없음.`
			})
		}
	} catch (error) {
		console.log('Get last access api: ' + error)
	}
})

router.get('/getmycourses',injectUerforAPI, async function (req, res, next){
	const { id } = req.user._user[0];
	try {
		const [rows] = await db.query(sql.user.getMyCourses, [3]);

		res.status(200).send({
			result: true,
			data: rows,
			message: `해당하는 사용자의 수강한 강의 정보를 출력`
		})
	} catch (error) {
		console.log(error)			
	}
})

//4ad431ca9c1b2e467d2544b0f904b34a6fed4e3a18f55e4fc3ac16e0dc43d787
router.get('/getcontainer',injectUerforAPI, async function (req, res, next){
	const { id, username } = req.user._user[0];
	try {
		//check DB
		let [row] = await db.query(sql.user.getUserContainer, [id]);
		if(row.length !== 0){ //컨테이너 디비에 저장함
			let checkCommand = await docker.checkContainer(username);
			const { status } = row[0] //1 running, 0 exited
			const { isExits, state } = checkCommand;
			// Docker 컨테이너 존재함
			if(isExits){
				//상태 동일함
				if(checkCommand === 'running' && status === 1 ||
				checkCommand === 'exited' && status === 0
				){
					res.status(200).send({
						result: true,
						data: row,
						message: `해당하는 사용자의 컨테이너 정보 있음`
					})
				}else{
					let currentState = state === 'running' ? 1 : 0;
					await db.query(sql.user.updateStatusUserContainer, [currentState, id])
					res.status(200).send({
						result: true,
						data: [{...row[0], status: currentState}],
						message: `해당하는 사용자의 컨테이너 정보 있음`
					})
				}
			}else{
				//디비에 저장되었는데 실제 존재하지 않음
				//디비에 지움
				await db.query(sql.user.deleteUserContainer,[id])
				res.status(201).send({
					result: true,
					data: [],
					message: `해당하는 사용자의 컨테이너 정보 없음`
				})
			}
		}else{ 
			res.status(201).send({
				result: true,
				data: [],
				message: `해당하는 사용자의 컨테이너 정보 없음`
			})
		}
	} catch (error) {
		res.status(400).send({
			result: true,
			data: [],
			message: `해당하는 사용자의 컨테이너 정보 접근 실패`
		})		
	}
})

router.post('/createcontainer',injectUerforAPI, async function (req, res, next){
	const { id, username } = req.user._user[0];
	const { containerAPI } = req.body;
	try {
		const [row] = await db.query(sql.user.getUserContainer, [id]);
		//존재하는지 체크함
		if(row.length === 0)
		{
			let checkCommand = await docker.checkContainer(username);
			const { isExits } = checkCommand; //이미 컨테이너 없음
			if(!isExits){
				const result = await docker.createUserContainer(username, containerAPI);
				if(result) {
					await db.query(sql.user.setUserContainer, [id, username, containerAPI]);
					const [row] = await db.query(sql.user.getUserContainer, [id]);
					res.status(200).send({
						result: true,
						data: row,
						message: `컨테이너 생성 성공`
					})
				}else{
					console.log("컨테이너 올릴때 오류")
					res.status(400).send({
						result: false,
						data: [],
						message: `컨테이너 생성 실패`
					})
				}
			}else{
				res.status(400).send({
					result: false,
					data: [],
					message: `컨테이너 생성 실패: 이미 존재함`
				})
			}
		}else{
			res.status(201).send({
				result: false,
				data: [],
				message: `해당하는 사용자 컨테이너: 이미 생성됨`
			})
		}
	} catch (error) {
		res.status(400).send({
			result: false,
			data: [],
			message: `컨테이너 생성 실패`
		})		
	}
})
router.get('/setstatuscontainer', injectUerforAPI, async function (req, res, next){
	const { id } = req.user._user[0];
	try {
		const [row] = await db.query(sql.user.getUserContainer, [id]);
		if(row.length === 1){
			var newStatus = row[0].status ? 0 : 1;
			let responseDocker;
			//set up container
			if(newStatus)
			{
				responseDocker = docker.setUpContainer(row[0].containername);
			}else{ //set down container
				responseDocker = docker.setDownContainer(row[0].containername);
			}
			// console.log(responseDocker)
			await db.query(sql.user.updateStatusUserContainer, [[newStatus],id]);

			res.status(201).send({
				result: true,
				data: [],
				message: `해당 사용자 컨테이너 상태 변경 성공`
			})	
		}else{
			res.status(201).send({
				result: false,
				data: [],
				message: `해당 사용자 생성된 컨테이너 없음`
			})	
		}
	} catch (error) {
		console.log(error)
		res.status(400).send({
			result: false,
			data: [],
			message: `컨테이너 다운 오류`
		})	
	}
})
module.exports = router;
