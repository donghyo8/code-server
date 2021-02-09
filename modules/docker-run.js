var exec = require('child_process').exec;
var fse = require('fs-extra');
var path = require('path');
var mkdirp = require('mkdirp');
const { spawn } = require('child_process')
var Docker = require('dockerode');
var docker = new Docker();

const ROOT= process.env.ROOT_PATH; //project path
// const ROOT_PROJECT = process.env.ROOT_PROJECTS;
function createUserContainer(name, api) {
    const shareProjectPath = path.resolve('','PROJECTS')

    //! Windows
    // return new Promise(
    //     function(resolve, reject){
    //         try {
    //             var child = exec(`${__dirname}/bash/make-containerwindows.sh ${shareProjectPath} ${name} ${api}`,
    //                 function (error, stdout, stderr) {
    //                     if (error !== null) {
    //                         console.log('stdout: ' + stdout);
    //                         console.log('stderr: ' + stderr);
    //                         console.log('exec error: ' + error);
    //                         resolve(false)
    //                     }
    //                 resolve(true)
    //             });
    //         } catch (error) {
    //             reject(false)
    //             console.log(error)
    //         }
    //     }
    // )

    // ! Ubuntu
    return new Promise(
        function(resolve, reject){
            try {
                var child = exec(`${__dirname}/bash/make-container.sh ${shareProjectPath} ${name} ${api}`,
                    function (error, stdout, stderr) {
                        if (error !== null) {
                            console.log('stdout: ' + stdout);
                            console.log('stderr: ' + stderr);
                            console.log('exec error: ' + error);
                            resolve(false)
                        }
                    resolve(true)
                });
            } catch (error) {
                reject(false)
                console.log(error)
            }
        }
    )
}
function checkContainer(name){
    return new Promise(
        function(resolve, reject){
            try {
                var result;
                var isExits = false;
                var state = "";
                docker.listContainers({all: true},function (err, containers) {
                    if(err){
                        console.log("Check container", err)
                        reject(false)
                    }
                    if(!containers){
                        result = {
                            isExits,
                            state
                        }
                        resolve(result)
                        return;
                    }
                    for(let i = 0; i < containers.length; i++){
                        const containerName =  containers[i].Names[0].substring(1, containers[i].Names[0].length);
                        if(containerName === name){
                            state = containers[i].State;                             
                            isExits = true;
                            break;
                        }
                    }
                    result = {
                        isExits,
                        state
                    }
                    resolve(result)
                });
            } catch (error) {
                console.log("docker error", error)
                reject(false)
            }
        }
    )
}
function setUpContainer(name){
    let docker = spawn("docker", ["start" , name]);
    return docker;
}
function setDownContainer(name){
    let docker = spawn("docker", ["stop" , name]);
    return docker;
}
function deleteContainer(name){
    let docker = spawn("docker", ["rm" , name, "-f"]);
    return docker;
}
module.exports = { createUserContainer, setUpContainer, setDownContainer, checkContainer };