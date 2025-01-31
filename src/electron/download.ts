import fs from 'fs/promises';
import { existsSync, mkdirSync, createWriteStream } from 'fs';
import { Dispatcher, fetch, ProxyAgent } from 'undici';
import filepath from 'path';
import ZIPLoader from '@/loaders/zip';
import { documentsOutputDir } from '@/config';
import sharedInstance from '@/shareInstance';

import { pipeline } from 'stream';
import { promisify } from 'util';
const streamPipeline = promisify(pipeline);
const PRIVATE_CONSTRUCTOR_KEY = Symbol('private');


interface GitHubInfo {
  author?: string,
  repository?: string,
  branch?: string,
  rootName?: string,
  resPath?: string,
  urlPrefix?: string,
  urlPostfix?: string
}

interface Params{
  url: string,
  downloadFileName?: string,
  proxy?: ProxyAgent
  signal?: AbortSignal
}

interface GithubParams extends Params{
  githubInfo: GitHubInfo,
  key:Symbol
}

export class GitHub {
  url: string;
  private downloadFileName: string;
  info: GitHubInfo = {};
  private requestedPromises: (()=>Promise<{ path: string, data: string }[]>)[] = [];
  private dirPaths: string[] = [];
  private proxy:ProxyAgent
  private signal: AbortSignal
  downloadedFiles: string[]

  constructor({githubInfo, proxy, key, url, downloadFileName, signal}:GithubParams) {
    if (key !== PRIVATE_CONSTRUCTOR_KEY) {
      throw new Error('Use GitHub.createInstance() to create an instance.');
    }
    this.signal = signal;
    this.url = url;
    this.downloadFileName = downloadFileName;
    if(this.downloadFileName === undefined){
      this.downloadFileName = encodeURIComponent(new URL(url).pathname)
    }
    this.proxy = proxy
    this.info = githubInfo;
    this.downloadedFiles = []
    if(!existsSync(documentsOutputDir)){
      mkdirSync(documentsOutputDir,{recursive: true})
    }
  }
  static async createInstance({url, downloadFileName,proxy, signal}:Params){
    return new GitHub({
      githubInfo: await GitHub.getParsedInfo(url,proxy, signal),
      proxy,
      key: PRIVATE_CONSTRUCTOR_KEY,
      downloadFileName,
      url,
      signal
    });
  }
  async downloadFile(url:string){
    sharedInstance.getInstance<(message:string)=>void>('toast')('正在下载' + url)
    return new Promise((resolve, reject) => {
      fetch(url,{
        dispatcher: this.proxy,
        signal: this.signal,
        headers:{
          Accept:"application/json, text/plain, */*",
          Origin:"https://minhaskamal.github.io",
          Referer:"https://minhaskamal.github.io/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
        }
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`请求失败: ${response.statusText}`);
          }
          const localFilePath = filepath.join(documentsOutputDir, this.downloadFileName);

          const fileStream = createWriteStream(localFilePath);
          streamPipeline(response.body, fileStream).then(()=>{
            this.downloadedFiles.push(localFilePath)
            resolve(`文件已保存到: ${localFilePath}`);
          })
        })
        .catch(error => {
          reject(error.toString());
        });
    });
  }
  private getFile(path: string, url: string) {
    this.requestedPromises.push(()=>{
      sharedInstance.getInstance<(message:string)=>void>('toast')('正在下载' + url)
      return fetch(url,{
        dispatcher: this.proxy,
        signal: this.signal,
        headers:{
          Accept:"application/json, text/plain, */*",
          Origin:"https://minhaskamal.github.io",
          Referer:"https://minhaskamal.github.io/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36"
        }
      }).then(res => res.text()).then(file => {
        return [{
          path,
          data: file
        }];
      });
    });
  }

  private async mapFileAndDirectory() {
    return fetch(this.info.urlPrefix + this.dirPaths.pop() + this.info.urlPostfix,{
      dispatcher: this.proxy,
      signal: this.signal,
      headers:{
        Origin:"https://minhaskamal.github.io",
        Referer:"https://minhaskamal.github.io/",
        "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
      }
    }).then(response => response.json()).then(async (response: any[]) => {
      for (let i = response.length - 1; i >= 0; i--) {
        if (response[i].type == 'dir') {
          this.dirPaths.push(response[i].path);

        } else {
          if (response[i].download_url) {
            this.getFile(response[i].path,
              response[i].download_url
            );
          } else {
            console.log(response[i]);
          }
        }
      }

      if (this.dirPaths.length <= 0) {
        await this.downloadFiles();
      } else {
        await this.mapFileAndDirectory();
      }
    });
  }

  private async downloadFiles() {
    const outputDir = filepath.join(documentsOutputDir, this.downloadFileName);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    const files = await ZIPLoader.promiseAllWithConcurrency<{path:string, data: string}>(this.requestedPromises);

    return Promise.all(
      files.map(file => {
        const fp = filepath.join(outputDir, file.path.substring(decodeURI(this.info.resPath).length + 1))
        const dirPath = filepath.dirname(fp)
        if(!existsSync(dirPath)){
          mkdirSync(dirPath, {recursive: true})
        }
        return fs.writeFile(
          fp,
          Buffer.from(file.data)
        ).then(()=>{
          this.downloadedFiles.push(fp)
        })
      })
    )
  }

  static async getParsedInfo(url:string, proxy?: Dispatcher, signal?:AbortSignal) {
    const repoPath = new URL(url).pathname;
    const splitPath = repoPath.split('/');
    const [_,author,repository,__ , branch] = splitPath;
    const rootName = splitPath[splitPath.length-1];

    const repoInfo = {
      author,
      repository,
      branch,
      rootName,
      resPath: '',
      urlPrefix: `https://api.github.com/repos/${author}/${repository}/contents/`,
      urlPostfix: `?ref=${branch}`
    };
    if(branch){
      repoInfo.resPath = repoPath.substring(
        repoPath.indexOf(splitPath[4])+splitPath[4].length+1
      )
    }
    if (!repoInfo.resPath || repoInfo.resPath == '') {
      if (!repoInfo.branch || repoInfo.branch == '') {
        repoInfo.branch = await fetch(`https://api.github.com/repos/${author}/${repository}`,{
          dispatcher: proxy,
          signal: signal,
        }).then(res => res.json()).then((res:{default_branch:string})=> res.default_branch);
      }
    }
    return repoInfo;
  }

  private async downloadDir() {
    this.dirPaths.push(this.info.resPath);
    await this.mapFileAndDirectory();
  }

  async downloadZippedFiles() {
    if (!this.info.resPath || this.info.resPath == '') {
      const downloadUrl = 'https://github.com/' + this.info.author + '/' +
        this.info.repository + '/archive/' + this.info.branch + '.zip';
      if(!this.downloadFileName.endsWith('.zip')){
        this.downloadFileName += '.zip'
      }
      await this.downloadFile(downloadUrl);
      return ZIPLoader.unzip({
        zipFilePath: filepath.join(documentsOutputDir, this.downloadFileName),
        foldername:this.downloadFileName.slice(0, -4)
      })
    } else {
      const response = await fetch(this.info.urlPrefix + this.info.resPath + this.info.urlPostfix,{
        dispatcher: this.proxy,
        signal: this.signal,
        headers:{
          Origin:"https://minhaskamal.github.io",
          Referer:"https://minhaskamal.github.io/",
          "User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7"
        }
      }).then(res => res.json());
      if (response instanceof Array) {
        return this.downloadDir();
      } else {
        interface Response {
          download_url:string,
          name:string
        }
        if(!existsSync(filepath.join(documentsOutputDir, this.downloadFileName))){
          mkdirSync(filepath.join(documentsOutputDir, this.downloadFileName), {recursive: true});
        }
        this.downloadFileName = filepath.join(this.downloadFileName, (response as Response).name);

        return this.downloadFile((response as Response).download_url);
      }
    }
  }
}

// GitHub.createInstance(
//   {
//     url:'https://github.com/electron/forge/blob/main/packages/maker/zip/src/MakerZIP.ts',
//     downloadFileName: 'MakerZIP.ts',
//     proxy: new ProxyAgent('http://127.0.0.1:7890')
//   }
// ).then(dl=>{
//   dl.downloadZippedFiles().then(()=>{
//     console.log(dl.downloadedFiles);
//   })
// })


