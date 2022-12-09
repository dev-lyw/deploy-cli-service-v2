# 来源
fork from:https://github.com/fuchengwei/deploy-cli-service &  https://github.com/Yukixieyuya821/deploy-cli-service-v2

本项目基于 deploy-cli-service， csr 部署，ssr 部署(批量打包上传)， 指定版本回滚(暂支持本地化部署， 通过远程服务器部署暂不支持)， 远程部署，自启动服务, 

感谢deploy-cli-service fuchengwei 作者,与 Yukixieyuya821。

# deploy-cli-service-v2

前端一键自动化部署脚手架服务，支持开发、测试、生产多环境配置。

csr部署，ssr部署(批量打包上传)，远程部署，可指定版本回滚，可适用于服务端项目，比如nuxt/next脚手架服务。

支持批量打包Zip,批量上传，配置好后一键即可自动完成部署。



## 1 安装

全局安装 deploy-cli-service-v2

```shell
npm install deploy-cli-service-v2 -g
```

本地安装 deploy-cli-service-v2

```shell
npm install deploy-cli-service-v2 --save-dev
```

查看版本，表示安装成功

```javascript
deploy-cli-service-v2 -v
```

注：本地安装的需要在调用前加 `npx`

```shell
npx deploy-cli-service-v2 -v
```

### 2 使用（以下代码都以全局安装为例）

#### 2.1 查看帮助

```shell
deploy-cli-service-v2 -h
```


#### 2.2 初始化配置文件（在项目目录下）

```shell
deploy-cli-service-v2 init # 或者使用简写 deploy-cli-service-v2 i
```

根据提示填写内容，会在项目根目录下生成 `deploy.config.js` 文件，初始化配置只会生成 `dev` (开发环境)、`test` (测试环境)、`prod` (生产环境) 三个配置，再有其他配置可参考模板自行配置。


#### 2.3 手动创建或修改配置文件

在项目根目录下手动创建 `deploy.config.js` 文件，复制以下代码按情况修改即可。

```javascript
module.exports = {
  projectName: 'vue_samples', // 项目名称
  privateKey: '/Users/yukixy/.ssh/id_rsa',
  passphrase: '',
  cluster: [], // 集群部署配置，要同时部署多台配置此属性如: ['dev', 'test', 'prod']
  dev: {
    // 环境对象
    name: '开发环境', // 环境名称
    script: 'npm run build', // 打包命令
    host: '192.168.0.1', // 服务器地址
    port: 22, // 服务器端口号
    username: 'root', // 服务器登录用户名
    password: '123456', // 服务器登录密码
    distPath: 'dist', // 本地打包生成目录， 当isAll为true时，且打包生成目录带. 如.nuxt/.next, 则为必填项
    webDir: '/usr/local/nginx/html', // 服务器部署路径（不可为空或'/'）
    bakDir: '/usr/local/nginx/backup', // 备份路径 (打包前备份之前部署目录 最终备份路径为 /usr/local/nginx/backup/html.zip)  // 批量上传部署（ssr项目）最终备份路径为 /usr/local/nginx/backup/backup_{时间戳}/{file/zipFile}
    maxBackupVersionCount: 3, //最多可存储的备份版本数, default 3
    isRemoveRemoteFile: false, // 是否删除远程文件（默认true）
    isRemoveLocalFile: true, // 是否删除本地文件（默认true）
    isAll: true, // 是否选择项目下所有文件夹打包， 启用则(webDir, bakDir)字段失效,排除带.的（比如.git）以及node_modules文件夹
    exclude: ["README.md"], // isAll为true时有效, 指定不打包上传的文件（仅仅是文件，对文件夹不起作用）
    webPath: "/var/webapp/test", // isAll为true时有效, 上传文件到服务器的路径
    isRemoteDeploy: true, // 是否选择支持远程下载项目（默认true），启用则isAll本地项目打包部署失效。以git为例，需要服务器安装git,并能直接下载,无需输入账号密码才能下载，最好使用ssh密钥
    cloneScript: 'git clone @github...', // isRemoteDeploy为true时有效， 下载项目命令，比如git clone @github....
    webProjectPath: '/usr/local', // // isRemoteDeploy为true时有效， 下载项目到远程服务器的路径
    downloadDirName: 'test', // // isRemoteDeploy为true时有效， 下载项目到远程服务器的默认文件夹名称
    install: "npm install", // isAll为true时有效, 远程安装依赖命令
    startRemoteProgress: "npm start" // isAll为true时有效, 远程启动命令，比如pm2
  },
  test: {
    // 环境对象
    name: '测试环境', // 环境名称
    script: 'npm run build:test', // 打包命令
    host: '192.168.0.1', // 服务器地址
    port: 22, // 服务器端口号
    username: 'root', // 服务器登录用户名
    password: '123456', // 服务器登录密码
    distPath: 'dist', // 本地打包生成目录， 当isAll为true时，且打包生成目录带. 如.nuxt/.next, 则为必填项
    webDir: '/usr/local/nginx/html', // 服务器部署路径（不可为空或'/'）
    bakDir: '/usr/local/nginx/backup', // 备份路径 (打包前备份之前部署目录 最终备份路径为 /usr/local/nginx/backup/html.zip)  // 批量上传部署（ssr项目）最终备份路径为 /usr/local/nginx/backup/backup_{时间戳}/{file/zipFile}
    maxBackupVersionCount: 3, //最多可存储的备份版本数, default 3
    isRemoveRemoteFile: false, // 是否删除远程文件（默认true）
    isRemoveLocalFile: true, // 是否删除本地文件（默认true）
    isAll: true, // 是否选择项目下所有文件夹打包， 启用则(webDir, bakDir)字段失效,排除带.的（比如.git）以及node_modules文件夹
    exclude: ["README.md"], // isAll为true时有效, 指定不打包上传的文件（仅仅是文件，对文件夹不起作用）
    webPath: "/var/webapp/test", // isAll为true时有效, 上传文件到服务器的路径
    isRemoteDeploy: true, // 是否选择支持远程下载项目（默认true）, 启用则isAll本地项目打包部署失效。以git为例，需要服务器安装git,并能直接下载,无需输入账号密码才能下载，最好使用ssh密钥
    cloneScript: 'git clone @github...', // isRemoteDeploy为true时有效， 下载项目命令，比如git clone @github....
    webProjectPath: '/usr/local', // // isRemoteDeploy为true时有效，下载项目到远程服务器的路径
    downloadDirName: 'test', // // isRemoteDeploy为true时有效，下载项目到远程服务器的默认文件夹名称
    install: "npm install", // isAll为true时有效, 远程安装依赖命令
    startRemoteProgress: "npm start" // isAll为true时有效, 远程启动命令，比如pm2
  },
  prod: {
    // 环境对象
    name: '生产环境', // 环境名称
    script: 'npm run build:prod', // 打包命令
    host: '192.168.0.1', // 服务器地址
    port: 22, // 服务器端口号
    username: 'root', // 服务器登录用户名
    password: '123456', // 服务器登录密码
    distPath: 'dist', // 本地打包生成目录， 当isAll为true时，且打包生成目录带. 如.nuxt/.next, 则为必填项
    webDir: '/usr/local/nginx/html', // 服务器部署路径（不可为空或'/'）
    bakDir: '/usr/local/nginx/backup', // 备份路径 (打包前备份之前部署目录 最终备份路径为 /usr/local/nginx/backup/html.zip) // 批量上传部署（ssr项目）最终备份路径为 /usr/local/nginx/backup/backup_{时间戳}/{file/zipFile}
    maxBackupVersionCount: 3, //最多可存储的备份版本数, default 3
    isRemoveRemoteFile: false, // 是否删除远程文件（默认true）
    isRemoveLocalFile: true, // 是否删除本地文件（默认true）
    isAll: true, // 是否选择项目下所有文件夹打包， 启用则(webDir, bakDir)字段失效,排除带.的（比如.git）以及node_modules文件夹
    exclude: ["README.md"], // isAll为true时有效, 指定不打包上传的文件（仅仅是文件，对文件夹不起作用）
    webPath: "/var/webapp/test", // isAll为true时有效, 上传文件到服务器的路径
    isRemoteDeploy: true, // 是否选择支持远程下载项目（默认true），启用则isAll本地项目打包部署失效。以git为例，需要服务器安装git,并能直接下载,无需输入账号密码才能下载，最好使用ssh密钥
    cloneScript: 'git clone @github...', // isRemoteDeploy为true时有效， 下载项目命令，比如git clone @github....
    webProjectPath: '/usr/local', // // isRemoteDeploy为true时有效， 下载项目到远程服务器的路径
    downloadDirName: 'test', // // isRemoteDeploy为true时有效， 下载项目到远程服务器的默认文件夹名称
    install: "npm install", // isAll为true时有效, 远程安装依赖命令
    startRemoteProgress: "npm start" // isAll为true时有效, 远程启动命令，比如pm2
  }
}
```

#### 2.4 部署 （在项目目录下）

注意：命令后面需要加 `--mode` 环境对象 （如：`--mode dev`）

```shell
deploy-cli-service-v2 deploy --mode dev # 或者使用 deploy-cli-service-v2 d --mode dev
```

输入 `Y` 确认后即可开始自动部署


#### 2.5 集群部署 （在项目目录下）

注意：集群配置需要在 `deploy-cli-service-v2` 中 配置 `cluster` 字段 （如：`cluster: ['dev', 'test', 'prod']`）

```shell
deploy-cli-service-v2 deploy # 或者使用 deploy-cli-service-v2 d
```

输入 `Y` 确认后即可开始自动部署

#### 2.6 更新优化

如果不想把服务器密码保存在配置文件中，也可以在配置文件中删除 `password` 字段。在部署的时候会弹出输入密码界面。

如果不想在部署前执行打包命令，在配置文件中删除 `script` 字段即可。

如果需要部署前备份，在配置文件中配置 `bakDir` 字段，为空不会备份。ps: 服务器需要安装 zip 模块，可使用 yum install zip 命令。

#### 2.7 本地安装扩展

如果使用本地安装命令的话，可以在项目根目录下的 `package.json` 文件中 `scripts` 脚本中添加如下代码

```json
"scripts": {
  "serve": "vue-cli-service serve",
  "build": "vue-cli-service build",
  "lint": "vue-cli-service lint",
  "deploy": "deploy-cli-service-v2 deploy",
  "deploy:dev": "deploy-cli-service-v2 deploy --mode dev",
  "deploy:test": "deploy-cli-service-v2 deploy --mode test",
  "deploy:prod": "deploy-cli-service-v2 deploy --mode prod",
  "rollback:dev": "deploy-cli-service-v2 rollback --mode dev",
  "rollback:test": "deploy-cli-service-v2 rollback --mode test",
  "rollback:prod": "deploy-cli-service-v2 rollback --mode prod"
}
```

然后使用下面代码也可以完成部署操作

```shell
npm run deploy:dev
```
