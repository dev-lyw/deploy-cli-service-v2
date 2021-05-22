const fs = require('fs')
const ora = require('ora')
const dayjs = require('dayjs')
const path = require('path')
const inquirer = require('inquirer')
const archiver = require('archiver')
const { NodeSSH } = require('node-ssh')
const childProcess = require('child_process')
const { deployConfigPath } = require('../config')
const {
  checkDeployConfigExists,
  log,
  succeed,
  error,
  underline
} = require('../utils')

const ssh = new NodeSSH()
const maxBuffer = 5000 * 1024

// 任务列表
let taskList

// 是否确认部署
const confirmDeploy = (message) => {
  return inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message
    }
  ])
}
// 遍历目录,获取文件夹名称
const dirNames = fs.readdirSync(path.resolve(process.cwd())).filter(c => c !== 'node_modules' && c !== '.git' && c !== '.idea' && c.indexOf('.') === -1 && c !== 'LICENSE');
// 检查环境是否正确
const checkEnvCorrect = (config, env) => {
  const keys = ['name', 'host', 'port', 'username', 'distPath', 'webDir']

  if (config) {
    keys.forEach((key) => {
      if (!config[env][key] || config[env][key] === '/') {
        error(
          `配置错误: ${underline(`${env}环境`)} ${underline(
            `${key}属性`
          )} 配置不正确`
        )
        process.exit(1)
      }
    })
  } else {
    error('配置错误: 未指定部署环境或指定部署环境不存在')
    process.exit(1)
  }
}

// 执行打包脚本
const execBuild = async (config, index) => {
  try {
    const { script } = config
    log(`(${index}) ${script}`)
    const spinner = ora('正在打包中\n')

    spinner.start()

    await new Promise((resolve, reject) => {
      childProcess.exec(
        script,
        { cwd: process.cwd(), maxBuffer: maxBuffer },
        (e) => {
          spinner.stop()
          if (e === null) {
            succeed('打包成功')
            resolve()
          } else {
            reject(e.message)
          }
        }
      )
    })
  } catch (e) {
    error('打包失败')
    error(e)
    process.exit(1)
  }
}

// 打包Zip
const buildZip = async (config, index, j) => {
  return await new Promise((resolve, reject) => {
    log(`(${index}${j ? `.${j}` : ''}) 打包 ${underline(config.distPath)} Zip`)
    const archive = archiver('zip', {
      zlib: { level: 9 }
    }).on('error', (e) => {
      error(e)
    })
    const output = fs
      .createWriteStream(`${process.cwd()}/${config.distPath}.zip`)
      .on('close', (e) => {
        if (e) {
          error(`打包zip出错: ${e}`)
          reject(e)
          process.exit(1)
        } else {
          succeed(`${underline(`${config.distPath}.zip`)} 打包成功`)
          resolve()
        }
      })

    archive.pipe(output)
    archive.directory(config.distPath, false)
    archive.finalize()
  })
}
// 批量打包Zip
const batchBuildZip = async (config, index) => {
    for(let i = 0; i < dirNames.length; i++) {
        const j = i + 1;
        const item = dirNames[i];
        await buildZip({
            distPath: item
        }, index, j)
    } 
}
// 连接ssh
const connectSSH = async (config, index) => {
  try {
    log(`(${index}) ssh连接 ${underline(config.host)}`)

    const { privateKey, passphrase, password } = config
    if (!privateKey && !password) {
      const answers = await inquirer.prompt([
        {
          type: 'password',
          name: 'password',
          message: '请输入服务器密码'
        }
      ])

      config.password = answers.password
    }

    !privateKey && delete config.privateKey
    !passphrase && delete config.passphrase

    await ssh.connect(config)
    succeed('ssh连接成功')
  } catch (e) {
    error(e)
    process.exit(1)
  }
}

// 上传本地文件夹Zip
const uploadLocalDirZip = async (config, index) => {
  try {
    const localFileName = `${config.distPath}.zip`
    const remoteFileName = `${config.webDir}.zip`
    const localPath = `${process.cwd()}/${localFileName}`

    log(`(${index}) 上传打包zip至目录 ${underline(remoteFileName)}`)

    const spinner = ora('正在上传中\n')

    spinner.start()

    await ssh.putFile(localPath, remoteFileName, null, {
      concurrency: 1
    })

    spinner.stop()
    succeed('上传成功')
  } catch (e) {
    error(`上传失败: ${e}`)
    process.exit(1)
  }
}
// 上传本地文件,可过滤指定文件不上传
const batchUploadLocalFile = async (config, index) => {
  const {exclude} = config;
  let dirNames = fs.readdirSync(path.resolve(process.cwd())).filter(c => c !== 'node_modules' && c !== '.git' && c !== '.idea' && c.indexOf('.') !== -1 && c !== 'LICENSE' && c !== config.distPath);
  if(exclude && exclude instanceof Array && exclude.length) {
    for(let i = 0; i < dirNames.length; i++)
        for(let j = 0; j < exclude.length; j++) {
            if(dirNames[i] === exclude[j]) {
                dirNames.splice(i, 1);
                i--;
                break;
            }
        }
  }
  for(let i = 0; i < dirNames.length; i++) {
    const item = dirNames[i];
    const j = i + 1;
    try {
      const localPath = `${process.cwd()}/${item}`;
      log(`(${index}${j ? `.${j}` : ''}) 上传附加文件至目录 ${underline(`${config.webPath}/${item}`)}`);
      const spinner = ora('正在上传中\n')

      spinner.start()
  
      await ssh.putFile(localPath, `${config.webPath}/${item}`, null, {
        concurrency: 1
      })
  
      spinner.stop()
      succeed(`${item}上传成功`)
    } catch(e) {
      error(`上传失败: ${e}`)
      process.exit(1)
    }
  }
}
// 批量上传本地文件夹Zip
const batchUploadLocalDirZip = async (config, index) => {
    const fileNames = dirNames.map(item => ({
        localFileName: `${item}.zip`,
        remoteFileName: `${config.webPath}/${item}.zip`
    }))
    for(let i = 0; i < fileNames.length; i++) {
        const item = fileNames[i];
        const j = i + 1;
        try {
        const localPath = `${process.cwd()}/${item.localFileName}`;
        log(`(${index}${j ? `.${j}` : ''}) 上传打包zip至目录 ${underline(item.remoteFileName)}`);
        const spinner = ora('正在上传中\n')

        spinner.start()
    
        await ssh.putFile(localPath, item.remoteFileName, null, {
            concurrency: 1
        })
    
        spinner.stop()
        succeed(`${item.localFileName}上传成功`)
        } catch(e) {
        error(`上传失败: ${e}`)
        process.exit(1)
        }
    } 
}

// 备份远程文件
const backupRemoteFile = async (config, index) => {
  try {
    const { webDir, bakDir } = config
    const dirName = webDir.split('/')[webDir.split('/').length - 1]
    const zipFileName = `${dirName}_${dayjs().format(
      'YYYY-MM-DD_HH:mm:ss'
    )}.zip`

    log(`(${index}) 备份远程文件 ${underline(webDir)}`)

    await ssh.execCommand(`[ ! -d ${bakDir} ] && mkdir ${bakDir}`)

    await ssh.execCommand(`zip -q -r ${bakDir}/${zipFileName} ${webDir}`)

    succeed(`备份成功 备份至 ${underline(`${bakDir}/${zipFileName}`)}`)
  } catch (e) {
    error(e)
    process.exit(1)
  }
}

// 删除远程文件
const removeRemoteFile = async (config, index) => {
  try {
    const { webDir } = config

    log(`(${index}) 删除远程文件 ${underline(webDir)}`)

    await ssh.execCommand(`rm -rf ${webDir}`)

    succeed('删除成功')
  } catch (e) {
    error(e)
    process.exit(1)
  }
}
// 批量删除远程文件
const batchRemoveRemoteFile = async (config, index) => {
    try {
        const fileNames = dirNames.map(c => `${config.webPath}/${c}`)
        for(let i = 0; i < fileNames.length; i++) {
          const item = fileNames[i];
          const j = i + 1;
          log(`(${index}${j ? `.${j}` : ''}) 删除远程文件 ${underline(item)}`)

          await ssh.execCommand(`rm -rf ${item}`)

          succeed('删除成功')
        }
    
    } catch (e) {
        error(e)
        process.exit(1)
    }
}
// 解压远程文件
const unzipRemoteFile = async (config, index) => {
  try {
    const { webDir } = config
    const remoteFileName = `${webDir}.zip`

    log(`(${index}) 解压远程文件 ${underline(remoteFileName)}`)

    await ssh.execCommand(
      `unzip -o ${remoteFileName} -d ${webDir} && rm -rf ${remoteFileName}`
    )

    succeed('解压成功')
  } catch (e) {
    error(e)
    process.exit(1)
  }
}
// 批量解压远程文件
const batchUnzipRemoteFile = async (config, index) => {
    try {
        const fileNames = dirNames.map(c => ({
          remoteFileName: `${config.webPath}/${c}.zip`,
          webDir: `${config.webPath}/${c}`
        }))
        for(let i = 0; i < fileNames.length; i++) {
        const item = fileNames[i];
        const j = i + 1;
        log(`(${index}${j ? `.${j}` : ''}) 解压远程文件 ${underline(item.remoteFileName)}`)

        await ssh.execCommand(
            `unzip -o ${item.remoteFileName} -d ${item.webDir} && rm -rf ${item.remoteFileName}`
        )
        succeed('解压成功')
        }
        
    } catch (e) {
        error(e)
        process.exit(1)
    }
}
// 删除本地打包文件
const removeLocalFile = async (config, index, j) => {
  return await new Promise(resolve => {
    const localPath = `${process.cwd()}/${config.distPath}`

    log(`(${index}${j ? `.${j}` : ''}) 删除本地打包目录 ${underline(localPath)}`)

    // const remove = (path) => {
    //   if (fs.existsSync(path)) {
    //     fs.readdirSync(path).forEach((file) => {
    //       let currentPath = `${path}/${file}`
    //       if (fs.statSync(currentPath).isDirectory()) {
    //         remove(currentPath)
    //       } else {
    //         fs.unlinkSync(currentPath)
    //       }
    //     })
    //     fs.rmdirSync(path)
    //   }
    // }
    // remove(localPath)
    fs.unlinkSync(`${localPath}.zip`)
    succeed('删除本地打包目录成功')
    resolve(true)
    })
  
}
// 批量删除本地打包文件
const batchRemoveLocalFile = async (config, index) => {
    for(let i = 0; i < dirNames.length; i++) {
      const item = dirNames[i];
      const j = i + 1;
      await removeLocalFile({
          distPath: item
      }, index, j)
    } 
}
// 执行远程安装依赖脚本
const execRemoatInstall = async (config, index) => {
  try {
    const { install } = config
    log(`(${index}) ${install}`)
    const spinner = ora('正在远程安装依赖中\n')

    spinner.start()
    await ssh.execCommand(install, {
        cwd: config.webPath
      })
    spinner.stop()
    succeed('执行远程安装依赖成功');
  } catch (e) {
    error('执行远程安装依赖失败')
    error(e)
    process.exit(1)
  }
}
// 执行远程打包脚本
const execRemoatBuild = async (config, index) => {
  try {
    const { script } = config
    log(`(${index}) ${script}`)
    const spinner = ora('正在远程打包中\n')

    spinner.start()
    await ssh.execCommand(script, {
      cwd: config.webPath
    })
    spinner.stop()
    succeed('执行远程打包成功');
  } catch (e) {
    error('执行远程打包失败')
    error(e)
    process.exit(1)
  }
}
// 执行远程服务脚本
const execRemoatService = async (config, index) => {
  const {webPath, startRemoteProgress} = config
  
  try {
    log(`(${index}) ${startRemoteProgress}`)
    const spinner = ora('正在启动远程服务进程\n')
    spinner.start()
    await ssh.execCommand(startRemoteProgress, {
      cwd: webPath
    })
    spinner.stop()
    succeed('执行远程服务启动成功');
  } catch (e) {
    error('执行远程服务启动失败')
    error(e)
    process.exit(1)
  }
}
// 断开ssh
const disconnectSSH = () => {
  ssh.dispose()
}

// 创建任务列表
const createTaskList = (config) => {
  const {
    script,
    bakDir,
    isRemoveRemoteFile = true,
    isRemoveLocalFile = true,
    isAll,
    install,
    startRemoteProgress
  } = config

  taskList = []
  if(isAll) {
    taskList.push(batchBuildZip)
    taskList.push(connectSSH)
    taskList.push(batchUploadLocalDirZip)
    taskList.push(batchUploadLocalFile)
    isRemoveRemoteFile && taskList.push(batchRemoveRemoteFile)
    taskList.push(batchUnzipRemoteFile)
    isRemoveLocalFile && taskList.push(batchRemoveLocalFile)
    install && taskList.push(execRemoatInstall)
    script && taskList.push(execRemoatBuild)
    startRemoteProgress && taskList.push(execRemoatService)
    
  } else {
    script && taskList.push(execBuild)
    taskList.push(buildZip)
    taskList.push(connectSSH)
    taskList.push(uploadLocalDirZip)
    bakDir && taskList.push(backupRemoteFile)
    isRemoveRemoteFile && taskList.push(removeRemoteFile)
    taskList.push(unzipRemoteFile)
    isRemoveLocalFile && taskList.push(removeLocalFile)
  }
  taskList.push(disconnectSSH)
}

// 执行任务列表
const executeTaskList = async (config) => {
  for (const [index, execute] of new Map(
    taskList.map((execute, index) => [index, execute])
  )) {
    await execute(config, index + 1)
  }
}

module.exports = {
  description: '部署项目',
  apply: async (env) => {
    if (checkDeployConfigExists()) {
      const config = require(deployConfigPath)
      const cluster = config.cluster
      const projectName = config.projectName
      const currentTime = new Date().getTime()

      const createdEnvConfig = (env) => {
        checkEnvCorrect(config, env)

        return Object.assign(config[env], {
          privateKey: config.privateKey,
          passphrase: config.passphrase
        })
      }

      if (env) {
        const envConfig = createdEnvConfig(env)

        const answers = await confirmDeploy(
          `${underline(projectName)} 项目是否部署到 ${underline(
            envConfig.name
          )}?`
        )

        if (answers.confirm) {
          createTaskList(envConfig)

          await executeTaskList(envConfig)

          succeed(
            `恭喜您，${underline(projectName)}项目已在${underline(
              envConfig.name
            )}部署成功 耗时${(new Date().getTime() - currentTime) / 1000}s\n`
          )
          process.exit(0)
        } else {
          process.exit(1)
        }
      } else if (cluster && cluster.length > 0) {
        const answers = await confirmDeploy(
          `${underline(projectName)} 项目是否部署到 ${underline('集群环境')}?`
        )

        if (answers.confirm) {
          for (const env of cluster) {
            const envConfig = createdEnvConfig(env)

            createTaskList(envConfig)

            await executeTaskList(envConfig)

            succeed(
              `恭喜您，${underline(projectName)}项目已在${underline(
                envConfig.name
              )}部署成功`
            )
          }

          succeed(
            `恭喜您，${underline(projectName)}项目已在${underline(
              '集群环境'
            )}部署成功 耗时${(new Date().getTime() - currentTime) / 1000}s\n`
          )
        } else {
          process.exit(1)
        }
      } else {
        error(
          '请使用 deploy-cli-service -mode 指定部署环境或在配置文件中指定 cluster（集群）地址'
        )
        process.exit(1)
      }
    } else {
      error(
        'deploy.config.js 文件不存，请使用 deploy-cli-service init 命令创建'
      )
      process.exit(1)
    }
  }
}