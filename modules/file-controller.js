var fs = require('fs').promises;
var path = require('path');
var _fs = require('fs');
var mkdirp = require('mkdirp');
var fse = require('fs-extra');
var exec = require('child_process').exec;
var moment = require('moment'); 
var db = require('../modules/db-connection');
var sql = require('../sql');


const ROOT= process.env.ROOT_PATH; //project path
const BOILERPLATES = process.env.BOILERPLATE_PATH
const ROOT_PROJECT= process.env.ROOT_CODE;
const ROOT_RECYCLE = process.env.ROOT_RECYCLE;
const ROOT_PROJECTS = process.env.ROOT_PROJECTS;


async function checkProjects(id, username) {
	try {
		const [rows] = await db.query(sql.project.getProjectByUserId, [id]);
		for (var row of rows) {
			var projectId = row.id;
			var projectName = row.name;
			var target = `${ROOT_PROJECTS}/${username}/${projectName}`;
			if(!(_fs.existsSync(target))) {
				await db.query(sql.project.deleteProject, [projectId]);
			}
		}
	} catch (error) {
		console.log(`프로젝트 동기화 오류 ${error}`)
	}
}

function copyFileSync(source, target) {
	var targetFile = target;

	if (_fs.existsSync(target)) {
		if (_fs.lstatSync(target).isDirectory()) {
			targetFile = path.join(target, path.basename(source));
		}
	}

	_fs.writeFileSync(targetFile, _fs.readFileSync(source));
}


function linkFileSync(source, target) {
	var targetFile = target;

	if(_fs.existsSync(target)) {
			if(_fs.lstatSync(target).isDirectory()) {
					targetFile = path.join(target, path.basename(source));
			}
	}

	if(!_fs.existsSync(targetFile)){
			_fs.linkSync(source, targetFile);
	}
}

async function linkFolderRecursiveSync(source, target) {
	var files = [];
	var targetFolder = path.join(target, path.basename(source));

	if (!_fs.existsSync(targetFolder)) {
			_fs.mkdirSync(targetFolder);
	}

	if (_fs.lstatSync(source).isDirectory()) {
		files = _fs.readdirSync(source);
		files.forEach(function (file) {
				var curSource = path.join(source, file);
				if (_fs.lstatSync(curSource).isDirectory()) {
						linkFolderRecursiveSync(curSource, targetFolder);
				} else {
						linkFileSync(curSource, targetFolder);
				}
		});
	}
}

async function copyFolderRecursiveSync(source, target) {
	var files = [];
	var targetFolder = path.join(target, path.basename(source));

	if (!_fs.existsSync(targetFolder)) {
		_fs.mkdirSync(targetFolder);
	}

	if (_fs.lstatSync(source).isDirectory()) {
		files = _fs.readdirSync(source);
		files.forEach(function (file) {
			var curSource = path.join(source, file);
			if (_fs.lstatSync(curSource).isDirectory()) {
				copyFolderRecursiveSync(curSource, targetFolder);
			} else {
				copyFileSync(curSource, targetFolder);
			}
		});
	}
}
async function createFolderSync(targetPath){
	targetPath = path.resolve(targetPath, "")
	
	if (!_fs.existsSync(targetPath)) {
		_fs.mkdirSync(targetPath);
	}else{
		return;
	}
}


async function createProject(childPath, language){

	const destPath = path.resolve(ROOT_PROJECTS, childPath);
	const filePath = path.resolve(BOILERPLATES, language);
	


	if(!_fs.existsSync(filePath)) {
		throw { code: -102, msg: "파일이 존재하지 않습니다", path: filePath};
	}

	// 하위 폴더 구조 생성
	fse.copy(filePath, destPath);
}
function createProjectByCategory(category,language, name, userId){
	const basicCodeProjectPath = path.resolve(BOILERPLATES, language);
	const parent_projectCategoryPath = path.resolve(ROOT_PROJECT, category);

	var today = moment(); 
	var fileName = `${today.format("YYYY-MM-DD")}_user${userId}_${name}_${language}`.replace(/\s/g, '');
	const child_projectCategoryPath = path.resolve(parent_projectCategoryPath, fileName)


	if(!_fs.existsSync(basicCodeProjectPath)) {
		throw { code: -102, msg: "파일이 존재하지 않습니다", path: basicCodeProjectPath};
	}

	// 하위 폴더 구조 생성
	fse.copy(basicCodeProjectPath, child_projectCategoryPath);
}

// 해당하는 code-server 및 project 생성
async function createProjectFolder(childPath){
	try {
		const projectFolder = path.resolve(ROOT, childPath);

		const myProjectPath = path.resolve(projectFolder, 'projects');
		const codeServerPath =  path.resolve(projectFolder, 'code-server');

		const defaultCodeServer = path.resolve(ROOT, 'code-server');
		await (new Promise((resolve, reject) => {
			mkdirp(myProjectPath, (err) => {
				if(err) { console.log(err); reject(err); return; }
				resolve();
			});
		}));
		await (new Promise((resolve, reject) => {
			mkdirp(codeServerPath, (err) => {
				if(err) { console.log(err); reject(err); return; }
				resolve();
			});
		}));

		try {
			var child = exec(`Xcopy ${defaultCodeServer} ${codeServerPath} /s/h/e/k/f/c`,
				function (error, stdout, stderr) {
					if (error !== null) {
						console.log('stdout: ' + stdout);
						console.log('stderr: ' + stderr);
						console.log('exec error: ' + error);
					}
					console.log(stdout)
				});
		} catch (error) {
			console.log(error)
		}
	} catch (error) {
		console.log(error)
	}
}
async function configByUserForProject(username){
	try {
		const configFilePath = path.resolve(ROOT, 'coder.json');
		fs.writeFile(configFilePath,`{
			"lastVisited": {
				"url": "/home/projects/${username}",
				"workspace": false
			}
		}`)
	} catch (error) {
		console.log('Config error ' + error)
	}
}
async function removeFolderNoRec(targetPath){
	try {
		if(!_fs.existsSync(targetPath)) {
			throw { code: -102, msg: "파일이 존재하지 않습니다"};
		}
		_fs.rmdirSync(targetPath, { recursive: true });
	} catch (error) {
		console.log(error);
		return;
	}
}
async function renameFolder(targetFolder, currName, newName){
	try {
		targetFolder = path.resolve(targetFolder);
		const currNamePath = path.resolve(targetFolder, currName)
		const newNamePath = path.resolve(targetFolder, newName)

		if(!_fs.existsSync(currNamePath)) {
			throw { code: -102, msg: "파일이 존재하지 않습니다"};
		}

		_fs.rename(currNamePath, newNamePath, function (err) {
			if (err) {
				console.log(err)
				return false;
			} else {
				return true;
			}
		})
	} catch (error) {
		console.log(error);
		return;
	}
}
async function removeFolder(project){
	try {
		const pathProject = path.resolve(ROOT_PROJECTS, project)
		const pathRecycleProject = path.resolve(ROOT_RECYCLE, project)


		if(!_fs.existsSync(pathProject)) {
			throw { code: -102, msg: "파일이 존재하지 않습니다"};
		}

		if(!_fs.existsSync(pathRecycleProject)) {

			await fs.mkdir(pathRecycleProject, { recursive: true })

			fse.copy(pathProject, pathRecycleProject, err => {
				if (err) return console.error(err)
				_fs.rmdirSync(pathProject, { recursive: true });
			}) 
			fse.copy(pathProject, pathRecycleProject);

		}else{
			fse.copy(pathProject, pathRecycleProject, err => {
				if (err) return console.error(err)
				_fs.rmdirSync(pathProject, { recursive: true });
			}) // 
			fse.copy(pathProject, pathRecycleProject);
		}
	}
	catch(e){
		console.log(e);
		return;
	}
}

function checkExists(targetPath){
	try {
		if(!_fs.existsSync(targetPath)) {
			return false;
		}
		return true;
	} catch (error) {
		console.log(e);
		return;
	}
}
module.exports = { 
	createProject, 
	createProjectFolder, 
	createProjectByCategory, 
	configByUserForProject, 
	removeFolder, 
	copyFolderRecursiveSync, 
	checkProjects , 
	createFolderSync, 
	removeFolderNoRec,
	checkExists,
	renameFolder,
	linkFolderRecursiveSync
}
