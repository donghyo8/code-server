var express = require('express');
var router = express.Router();
var db = require('../modules/db-connection');
var sql = require('../sql');
var checkLoginMiddleWare = require('../modules/check-login-middleware');
var randomstring = require("randomstring");
var fileController = require('../modules/file-controller');
var path = require('path');
const zipFolder = require('zip-a-folder');

const ROOT_PROJECTS = process.env.ROOT_PROJECTS;
const ROOT_PROJECTS_BAK = process.env.ROOT_PROJECTS_BAK;

// const CODE = process.env.ROOT_CODE; //project path
// Check user for api
router.use(checkLoginMiddleWare.injectUerforAPI)

/**
 * get
 * 사용자 프로젝트 출력
 * @param
 */
router.get('/', async function(req, res) {
    const { id, username } = req.user._user[0];

    await fileController.checkProjects(id, username);

    try {
        const [rows] = await db.query(sql.project.getProjectByUserId, [id])
        res.status(200).send({
            result: true,
            data: rows,
            message: '해당하는 유저 프로젝트 리스트'
        })
    } catch (error) {
        console.log(`유저 프로젝트 출력 API 오류 ${error}`)
    }

    try {
	const source = `${ROOT_PROJECTS}/${username}`;
	fileController.linkFolderRecursiveSync(source, ROOT_PROJECTS_BAK);
    } catch (error) {
    console.log(`파일 백업 오류 ${error}`)
    }
})

// 프로젝트 생성
//! 경로 암호화 필요함
router.post('/', async function(req, res){
    const { id, username } = req.user._user[0];
    const { name, language, category, tags, usage } = req.body;

    // const path = '/home/' + name;
    var projectPath = randomstring.generate(20);
    try{
        var childPath = `${username}/${name}`;
        fileController.createProject(childPath, language);
        const [rows] = await db.query(sql.project.getProjectByUserId, id)
        const matchingProject = rows.filter(project => project.name == name)

        //프로젝트 생성시 이름 중복 체크함
        if(matchingProject.length === 0){
            var tagString = tags.join(); //,로 추가해서 디비 저장함
            const [row] = await db.query(sql.project.insertProject, [name, language, category, tagString, id, name, usage])
            const { insertId } = row
            const [project] = await db.query(sql.project.selectProjectById, insertId);
            res.status(200).send({
                result: true,
                data: project[0],
                message: '프로젝트 생성 성공'
            })    
        }else{
            res.status(201).send({
                result: false,
                data: [],
                message: '프로젝트 생성 시 이름 중복'
            })   
        }
    }catch(error) {
        console.log(`프로젝트 생성시 오류 ${error}`)
        res.status(400).send({
            result: false,
            data: [],
            message: '프로젝트 생성 실패'
        }) 
    }
})
router.get('/configproject', async function(req, res){
    const { username } = req.user._user[0];
    try {
        fileController.configByUserForProject(username)
        res.status(200).send({
            result: true,
            data: [],
            message: 'Config project success'
        }) 
    } catch (error) {
        res.status(401).send({
            result: true,
            data: [],
            message: error
        }) 
    }
})
router.post('/submithomework', async function(req, res){
    try {
        const { id } = req.user._user[0];
        console.log(id)
        const { projectId, assignid } = req.body;

        if(projectId && assignid){
            await db.query(sql.project.submitHomework, [projectId, id, assignid])
            res.status(200).send({
                result: true,
                data: [],
                message: '과제 제출 성공'
            })    
        }else{
            res.status(200).send({
                result: true,
                data: [],
                message: '과제 제출 실패'
            }) 
        }
    
    } catch (error) {
        res.status(400).send({
            result: false,
            data: error,
            message: '과제 제출 실패'
        }) 
        console.log('Create project fail',error)
    }

})

//!수정
router.delete('/delete', async function(req, res){
    try {
        const { projectId } = req.query;
        const [row] = await db.query(sql.project.selectProjectById, [projectId])
        if(row.length === 1){
            const { username } = req.user._user[0];

            fileController.removeFolder(`${username}/${row[0].name}`, username);
            
            await db.query(sql.project.deleteProject, [projectId]);

            res.status(200).send({
                result: true,
                data: [],
                message: '프로젝트 삭제 성공'
            })    

        }else{
            res.status(201).send({
                result: true,
                data: [],
                message: '프로젝트 삭제 실패'
            })   
        }
    } catch (error) {
        console.log('프로젝트 삭제 실패',error)
    }

})

//!수정
router.get('/download', async function(req, res){
    try {
        const { projectId } = req.query;
        const { id } = req.user._user[0];
        const [row] = await db.query(sql.project.checkProjectForUser, [projectId, id])
        if(row.length === 1){
            const { username } = req.user._user[0];
            const { path : userProjectPath } = row[0];
            
            const public = `public/${username}`;
            const zipProjectPath = path.resolve(public,`${userProjectPath}`)

            if(fileController.checkExists(`${zipProjectPath}.zip`)){
                res.status(200).send({
                    result: true,
                    data: [
                        {path: `${username}/${userProjectPath}.zip`}
                    ],
                    message: '프로젝트 다운로드 성공'
                })  
                return;
            }

            const projectPath = `${ROOT_PROJECTS}/${username}/${userProjectPath}`;

            await fileController.createFolderSync(public)
            await fileController.copyFolderRecursiveSync(projectPath, public)

            zipFolder.zipFolder(zipProjectPath, `${zipProjectPath}.zip`, function(err) {
                if(err) {
                    console.log('Something went wrong!', err);
                }
            });
            
            //set 60s delete folder
            setTimeout(async () => {
                await fileController.removeFolderNoRec(path.resolve(public, ''));
            }, 60 * 1000);

            res.status(200).send({
                result: true,
                data: [
                    {path: `${username}/${userProjectPath}.zip`}
                ],
                message: '프로젝트 다운로드 성공'
            })  
        }else{
            res.status(201).send({
                result: true,
                data: [],
                message: '프로젝트 다운로드 권한이 없음'
            })   
        }
    } catch (error) {
        console.log('프로젝트 다운로드 API',error) 
        res.status(400).send({
            result: true,
            data: [],
            message: '프로젝트 다운로드 권한이 없음'
        })   
    }

})

router.put('/modify', async function(req, res){
    try {
        const { id : userId, username } = req.user._user[0];
        const { id, name, language, category, usage,  tags} = req.body.params;
        const [row] = await db.query(sql.project.checkProjectForUser, [id, userId])
        if(row.length === 1){
            var tagString = tags.join();
            await db.query(sql.project.updateProject, [name, language, category, tagString, usage, name, id])
            await fileController.renameFolder(`PROJECTS/${username}`, row[0].name, name);
            const [project] = await db.query(sql.project.selectProjectById,[id]);
            res.status(200).send({
                result: true,
                data: project[0],
                message: '수정 성공'
            })  
        }else{
            res.status(201).send({
                result: false,
                data: [],
                message: '수정할 프로젝트 존재하지 않거나 수정 권한이 없음'
            })   
        }
    } catch (error) {
        console.log('프로젝트 수정',error)
        res.status(400).send({
            result: false,
            data: error,
            message: '프로젝트 수정 실패'
        }) 
    }

})

module.exports = router;
